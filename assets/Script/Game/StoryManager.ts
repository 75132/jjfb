/**
 * 剧情 UI：对白/选项在 StoryLayer；剧情反馈在 GameArea/Tips；ToastItem 专用于「按 E 交谈」等系统提示。
 *
 * 编辑器说明：若从 MapNpcInteract 迁移，请把本组件挂到 CanvasRoot(UI)，拖入 mapConfig，
 * 并从 NPC 节点移除旧 MapNpcInteract；场景里原组件槽位可复用同一 UUID（已由工程处理）。
 */
import {
    _decorator,
    assetManager,
    BoxCollider2D,
    Button,
    Collider2D,
    Component,
    director,
    EventKeyboard,
    EventTouch,
    input,
    Input,
    instantiate,
    JsonAsset,
    KeyCode,
    Label,
    Node,
    Color,
    Sprite,
    SpriteFrame,
    UITransform,
    v3,
    Vec3,
} from 'cc';
import { PlayerGridMove } from './GameArea/PlayerGridMove';
import { BattleTriggerOnContact } from './GameArea/BattleTriggerOnContact';
import { ResourceManager } from './ResourceManager';
import { StoryUIViewRefs } from './StoryUIViewRefs';
import { WebSocketManager } from '../global/WebSocketManager';
import { BattleScene } from './BattleScene';
import {
    isBattleInteractAction,
    isChoiceBlockedMessage,
    promisifyWsRequest,
    shouldCompleteChoice,
    shouldStartBattleFromChoice,
    type StoryInteractPayload,
} from './story-event-flow';
import {
    evaluateAppearRequirements,
    evaluateRequirements,
    type StoryRequirementContext,
} from './story-requirements';
import {
    buildLocalCompletePayload,
    clearLocalStoryPersist,
    loadLocalStoryPersist,
    localStoryStorageKey,
    saveLocalStoryPersist,
    type LocalStoryPersist,
} from './story-local-mode';
import { sanitizeBattlePseudoChoicesInRuntime, type RuntimeMapLike } from './story-runtime-sanitize';
import {
    decideNpcVisibility,
    isHiddenByMainlineStep,
    isNpcHiddenUntilReveal as visibilityHiddenUntilReveal,
    isStaleMainlineGiver,
    parseEnemyGiverUid,
} from './story-npc-visibility';

const { ccclass, property, executionOrder } = _decorator;

const PREFIX = '[Story]';
type LogLevel = 'info' | 'warn' | 'error';

function storyLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const tail = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
    const line = `${PREFIX} ${message}${tail}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

/** 与 map JSON 对齐的格子像素（与 PlayerGridMove CELL 一致） */
import { logicalToParentLocal, mapContentBoundsInParentSpace, TILE_CELL } from './tilemap-coords';
import {
    getNpcTaskStatusFrameUuids,
    npcTaskIndicatorKindToIndex,
    resolveNpcTaskIndicatorKind,
    type NpcTaskIndicatorKind,
} from './npc-task-indicator';

export type DialogueLineScript = { speaker: string; lines: string[] };

export type ChoiceOption = {
    id: string;
    text: string;
    npcReply?: string;
    systemTip?: string;
    forcedResult?: 'start_battle' | 'block' | 'teleport';
    /** 默认 true；false 时不完成事件、不推进主线 */
    completesEvent?: boolean;
};

export type ChoiceScript = { title: string; options: ChoiceOption[] };

export function normalizeDialogueScript(raw: unknown): DialogueLineScript {
    const o = (raw ?? {}) as Record<string, unknown>;
    const speaker = String(o.speaker ?? '');
    let lines: string[] = [];
    if (Array.isArray(o.lines)) {
        lines = o.lines.map((x) => String(x ?? ''));
    } else if (typeof o.line === 'string' && o.line.length) {
        lines = [o.line];
    } else if (typeof o.text === 'string' && o.text.length) {
        lines = [o.text];
    }
    return { speaker, lines };
}

type MapNpcEventClient = {
    dialogueScriptId?: string;
    choiceScriptId?: string;
    taskUiHint?: string;
    /** true：须再次靠近 NPC 按 E 才触发（用于分段剧情） */
    requiresApproach?: boolean;
    /** true：本事件结束后结束当前接触会话 */
    endsSession?: boolean;
};

type MapNpcEvent = {
    eventId?: string;
    eventType?: string;
    order?: number;
    server?: { requirements?: unknown[]; battleRef?: string; effects?: unknown[]; allowedChoiceIds?: string[] };
    client?: MapNpcEventClient;
};

type NpcJson = {
    npcUid?: string;
    npcName?: string;
    /** 头顶 Name 显示用（角色名）；缺省时从对白 speaker 推断 */
    characterName?: string;
    prefabKey?: string;
    x?: number;
    y?: number;
    initialHidden?: boolean;
    appear?: {
        mode?: 'always' | 'conditional';
        matchMode?: 'ALL' | 'ANY';
        requirements?: unknown[];
    };
    hideWhenComplete?: boolean;
    /** 可选：从场景根的路径，如 Game/MapRoot/NPCs/Hanno */
    nodePath?: string;
    events?: MapNpcEvent[];
};

@ccclass('StoryManager')
@executionOrder(-50)
export class StoryManager extends Component {
    @property(JsonAsset)
    mapConfig: JsonAsset | null = null;

    @property({
        tooltip:
            '本地剧情模式（默认开启）：不请求 story_get_state / story_interact / story_event_complete；战斗仍走 WS 房间。接回服务端时取消勾选。',
    })
    skipServerRequirements = true;

    @property({
        tooltip:
            '本地模式下每次进入场景从头跑主线（清 localStorage、不存档）。关则可跨次保留进度。',
    })
    resetLocalStoryOnEnter = true;

    @property({ tooltip: '与 NPC 范围内触发交互的额外键（另固定支持 E、回车、空格）' })
    interactKey = KeyCode.KEY_E;

    @property({ tooltip: '该 NPC 在 map JSON 中的事件全部完成后隐藏节点（克隆体会销毁）' })
    hideNpcWhenStoryComplete = true;

    @property({
        tooltip:
            'true：按 map npcs 顺序（韩诺 0_lead_01 优先）每次只显示一名仍有未完成事件的 NPC；false：全部可同时出现。若子 NPC 挂在公共父节点下，父链会保持显示但仅当前节点启用碰撞体。',
    })
    sequentialStoryNpcReveal = true;

    @property({ tooltip: '打印 [Story] 诊断日志' })
    debugLog = false;

    @property({ tooltip: '与 BattleTriggerOnContact 同节点时默认禁用战斗触发（对齐旧 MapNpcInteract）' })
    letBattleTriggerHandleCombat = false;

    @property
    interactDistanceFallbackPx = 120;

    @property
    interactReleaseHysteresisPx = 18;

    @property({
        tooltip:
            '保留兼容；交互提示已改为「在 NPC 碰撞箱内常驻」。若仍用旧版按间隔弹 Toast，可改代码恢复；当前逻辑不再读取本字段。',
    })
    interactHintMinIntervalMs = 8000;

    @property
    interactHintText = '按 E 或点击 交谈';

    @property({ tooltip: '离开 NPC 碰撞范围时取消当前事件链激活（RMV 式）' })
    cancelActivationOnLeaveRange = true;

    @property({ tooltip: '剧情战开始前过渡提示时长（秒）' })
    battleTransitionDelaySec = 0.3;

    /** 坐标就近匹配：JSON (x,y) 像素到最近场景节点的最大误差（像素） */
    @property
    coordMatchMaxPx = 240;

    /** 无独立节点时，从场景模板（如 WorldRoot/NPC）复制一份并摆到 JSON 坐标 */
    @property({ tooltip: '为每条 npc 配置在无法绑定已有节点时，从 WorldRoot/NPC 克隆' })
    spawnMissingNpcClones = true;

    /** JSON 与模板无 mapRoot 换算时，用「相对 0_lead_01 的像素差」叠在模板位置上（coordinateSystem tiled_top_left） */
    @property
    spawnUseJsonDeltaFromLead = true;

    /**
     * 本地测试：>0 时且无有效 JSON 坐标时，克隆 NPC 沿模板纵向堆叠；
     * 0 = 始终按 JSON 格心坐标摆放（与 Juben 地图埋点一致）。
     */
    @property
    testStackNpcGapTiles = 0;

    @property({ type: [SpriteFrame], tooltip: '非空时可为每个 NPC 节点随机一张立绘（Sprite 在本节点或子节点）' })
    randomNpcPortraitFrames: SpriteFrame[] = [];

    @property({
        type: [SpriteFrame],
        tooltip: 'NPC 任务状态 1~4：橙!/橙?/灰?/灰!；留空则按内置 UUID 自动加载',
    })
    npcTaskStatusFrames: SpriteFrame[] = [];

    @property({ tooltip: '为克隆 NPC 随机分配 randomNpcPortraitFrames 中的立绘' })
    randomizeNpcPortraits = true;

    @property({ type: Node, tooltip: 'BattleScene 根节点（剧情战斗）' })
    battleRoot: Node | null = null;

    @property({ tooltip: '地图 code，与 JSON mapCode 一致' })
    mapCode = 'world_1782661910893';

    private _refs: StoryUIViewRefs | null = null;
    private _dialogueScripts: Record<string, DialogueLineScript> = {};
    private _choiceScripts: Record<string, ChoiceScript> = {};
    private _npcRows: NpcJson[] = [];
    /** JSON 导出 mapWidth/mapHeight，与 TiledMap 不一致时用于诊断（运行时仍以 mapRoot UIT 为准） */
    private _jsonMapContentSize: { w: number; h: number } | null = null;

    private _resolved: Array<{ npcUid: string; node: Node; events: MapNpcEvent[] }> = [];
    /** 由 StoryManager 克隆的节点，onDestroy / 重新解析时销毁 */
    private readonly _spawnedNpcRoots: Node[] = [];
    /** 与 _resolveNpcs 中 ordered 一致，用于逐个显示 NPC */
    private _storyNpcOrder: string[] = [];
    private _playerMove: PlayerGridMove | null = null;
    private _playerCollider: Collider2D | null = null;
    private _lastPlayerResolveAt = 0;

    private _playerTouchingNpcUid: string | null = null;
    /** 玩家在 NPC 碰撞箱内时显示 RMV 式交互提示（不再占用 Toast 队列） */
    private _interactHintPinned = false;
    private _lastOutOfRangeKeyLogAt = 0;

    private readonly _localCompletedEventIds = new Set<string>();
    private _serverCompletedEventIds = new Set<string>();
    /** 仅战斗胜利后才写入；图标/下一环判定以此为准，避免逃跑后仍显示可提交 */
    private readonly _battleClearedEventIds = new Set<string>();
    /** 本客户端已确认战斗胜利的事件（与服务端 completed 对齐前也用于图标判定） */
    private readonly _localBattleWonEventIds = new Set<string>();
    /** 本地已接取任务（按 choiceId 过滤后的 task_accept） */
    private readonly _acceptedTaskIds = new Set<number>();
    private _storyStateLoaded = false;
    private _ws: WebSocketManager | null = null;
    private _activeTasks: Array<{ taskId: number; status: string; taskName?: string }> = [];
    private _tasksSnapshot: Array<{ taskId: number; status: string; taskName?: string }> = [];
    private _completedTaskIds = new Set<number>();
    private _mainlineStep = 0;
    private readonly _revealedNpcUids = new Set<string>();
    private readonly _spawnedNpcUids = new Set<string>();

    private _toastQueue: Array<{ text: string; durationMs: number }> = [];
    private _toastPlaying = false;
    private _storyTipsQueue: Array<{ text: string; durationMs: number }> = [];
    private _storyTipsPlaying = false;
    private _activeChoicePick: ((opt: ChoiceOption) => void) | null = null;
    private _activeChoiceOptions: ChoiceOption[] = [];
    private _startupSelfCheckDone = false;
    private _taskStatusFramesReady = false;
    private _taskStatusFramesLoading = false;

    private _lineIndex = 0;
    private _script: DialogueLineScript | null = null;
    private _onDialogueEnd: (() => void) | null = null;
    private _nextBound = false;
    private _choiceHandlers: Array<() => void> = [];
    private _lastAdvanceWallMs = 0;
    private static readonly _ADVANCE_DEBOUNCE_MS = 90;
    /** 当前 NPC 接触会话：同一次接触内可手动按 E 衔接下一步，直到 endsSession */
    private _chainNpcUid: string | null = null;
    /** 下一步 requiresApproach 时，须离开再靠近后才允许触发 */
    private _npcApproachOk = true;
    private _eventFlowRunning = false;
    /** RMV 式一次确认激活：同次按键会话内自动续跑 NPC 事件链 */
    private _activationNpcUid: string | null = null;
    private _activationPausedForBattle = false;
    private _playerLevel = 0;
    private readonly _ownedItemIds = new Set<number>();
    private _lastInteractTriggerAt = 0;
    private _choiceHighlightIndex = 0;
    private readonly _dynamicChoiceNodes: Node[] = [];
    private readonly _npcTouchUnbinders: Array<() => void> = [];
    private _flowWaitingVisible = false;
    private _taskDefs: Array<{ taskId?: number; taskName?: string; mainlineStep?: number }> = [];

    private readonly _tmpV3 = v3();
    private readonly _tmpWorld = v3();
    private readonly _tmpLp = v3();

    onLoad(): void {
        this._resolveRefs();
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        this._parseMap();
        this._resolveLocalPlayerOnce();
        this._resolveNpcs();
        this._ensureTaskStatusFramesLoaded();
        if (this.debugLog) {
            storyLog('info', 'StoryManager.onLoad', {
                host: this.node?.name,
                npcResolved: this._resolved.length,
                hasMap: Boolean(this.mapConfig?.json),
            });
        }
        this._runStartupSelfCheck();
    }

    start(): void {
        this._resolveRefs();
        this._resolveLocalPlayerOnce();
        this._resolveNpcs();
        const ws = WebSocketManager.getInstance();
        ws?.on('select_character_response', this._onCharacterSelected, this);
        ws?.on('data_changed', this._onWsDataChanged, this);
        ws?.on('player_info', this._onPlayerInfoCache, this);
        ws?.on('player_info_response', this._onPlayerInfoCache, this);
        this.scheduleOnce(() => {
            this._resolveLocalPlayerOnce();
            this._resolveNpcs();
            if (this.skipServerRequirements) {
                this._loadLocalStoryState();
            } else {
                this._fetchStoryStateFromServer();
            }
        }, 0);
    }

    private _onCharacterSelected = (data: { success?: boolean } | null): void => {
        if (!data?.success) return;
        if (this.skipServerRequirements) {
            if (!this._storyStateLoaded) {
                this._loadLocalStoryState();
            }
            return;
        }
        this._resetStoryRuntimeState();
        this.scheduleOnce(() => this._fetchStoryStateFromServer(), 0.15);
    };

    private _onWsDataChanged = (payload: { reason?: string } | null): void => {
        const reason = payload?.reason ?? '';
        if (reason === 'character_id_cleared') {
            this._resetStoryRuntimeState();
        }
        if (reason === 'bag_updated' || reason === 'inventory_changed') {
            this._refreshOwnedItemsFromWs();
        }
    };

    private _onPlayerInfoCache = (data: Record<string, unknown> | null): void => {
        if (!data) return;
        const payload = (data.data && typeof data.data === 'object' ? data.data : data) as Record<string, unknown>;
        const lvl = Number(payload.level ?? 0);
        if (Number.isFinite(lvl) && lvl > 0) this._playerLevel = lvl;
    };

    private _refreshOwnedItemsFromWs(): void {
        const ws = this._ws || WebSocketManager.getInstance();
        if (!ws?.getCharacterId?.()) return;
        ws.request('bag_get', {}, (resp: { success?: boolean; data?: { slots?: Array<{ item_id?: number; itemId?: number; count?: number }> } }) => {
            if (!resp?.success) return;
            this._ownedItemIds.clear();
            const slots = resp.data?.slots ?? [];
            for (const s of slots) {
                const iid = Number(s.item_id ?? s.itemId ?? 0);
                const cnt = Number(s.count ?? 0);
                if (iid > 0 && cnt > 0) this._ownedItemIds.add(iid);
            }
            this._refreshNpcVisibility();
            this._syncNpcTaskIndicators();
        });
    }

    /** 选角 / 切角后清空本地剧情缓存，等待 story_get_state 重新拉取 */
    private _resetStoryRuntimeState(): void {
        this._localCompletedEventIds.clear();
        this._serverCompletedEventIds.clear();
        this._battleClearedEventIds.clear();
        this._localBattleWonEventIds.clear();
        this._acceptedTaskIds.clear();
        this._completedTaskIds.clear();
        this._activeTasks = [];
        this._tasksSnapshot = [];
        this._mainlineStep = 0;
        this._revealedNpcUids.clear();
        this._spawnedNpcUids.clear();
        this._storyStateLoaded = false;
        this._endActivation();
        this._refreshNpcVisibility();
        if (this.debugLog) storyLog('info', 'StoryManager: 剧情状态已重置（等待服务端同步）', {});
    }

    /** 供 TaskTracker 读取 */
    public getStoryTaskSnapshot(): {
        mainlineStep: number;
        tasks: Array<{ taskId: number; status: string; taskName?: string }>;
    } {
        const tasks = this._tasksSnapshot.length
            ? this._tasksSnapshot.filter((t) => t.status === 'accepted')
            : this._activeTasks;
        return { mainlineStep: this._mainlineStep, tasks: [...tasks] };
    }

    private _syncProgressFromPayload(d: Record<string, unknown>): void {
        if (!this._alive()) return;
        const ids: string[] = (d.completed_event_ids as string[]) || [];
        this._serverCompletedEventIds = new Set(ids);
        this._localCompletedEventIds.clear();
        for (const id of ids) this._localCompletedEventIds.add(id);
        this._activeTasks = (d.active_tasks as typeof this._activeTasks) || [];
        this._tasksSnapshot = (d.tasks as typeof this._tasksSnapshot) || [];
        this._mainlineStep = Number(d.mainline_step || 0);
        this._completedTaskIds.clear();
        const completed = (d.completed_task_ids as number[]) || [];
        for (const x of completed) this._completedTaskIds.add(Number(x));
        for (const t of this._tasksSnapshot) {
            if (!t) continue;
            if (t.status === 'completed' || t.status === 'Completed') {
                this._completedTaskIds.add(Number(t.taskId));
            }
        }
        this._revealedNpcUids.clear();
        for (const uid of (d.revealed_npc_uids as string[]) || []) {
            if (uid) this._revealedNpcUids.add(uid);
        }
        this._spawnedNpcUids.clear();
        for (const uid of (d.spawned_npc_uids as string[]) || []) {
            if (uid) this._spawnedNpcUids.add(uid);
        }
        this._applyDynamicNpcsFromPayload(d);
        this._rebuildQuestPhaseFromState();
        this._refreshNpcVisibility();
        if (this.node?.isValid) {
            this.node.emit('story_state_updated', d);
        }
    }

    /** 组件仍挂载且可用（异步回调入口应优先检查） */
    private _alive(): boolean {
        return Boolean(this.isValid && this.node?.isValid);
    }

    private _applyDynamicNpcsFromPayload(d: Record<string, unknown>): void {
        const dynamics = (d.dynamic_npcs as NpcJson[]) || [];
        for (const row of dynamics) {
            const uid = row.npcUid;
            if (!uid || this._spawnedNpcUids.has(uid)) continue;
            this._spawnDynamicNpcRow(row);
        }
    }

    private _buildRequirementContext(): StoryRequirementContext {
        const activeTaskIds = new Set<number>();
        for (const t of this._activeTasks) {
            const tid = Number(t?.taskId ?? 0);
            if (tid > 0) activeTaskIds.add(tid);
        }
        return {
            completedEventIds: this._serverCompletedEventIds,
            battleClearedEventIds: this._battleClearedEventIds,
            completedTaskIds: this._completedTaskIds,
            acceptedTaskIds: this._acceptedTaskIds,
            activeTaskIds,
            mainlineStep: this._mainlineStep,
            playerLevel: this._playerLevel,
            ownedItemIds: this._ownedItemIds,
            isEventQuestStepComplete: (eventId) => this._isAppearEventDone(eventId),
            debugLog: this.debugLog,
            onUnknownRequirement: (type) => {
                if (this.debugLog) storyLog('warn', 'StoryManager: 未实现 requirement type，已跳过', { type });
            },
        };
    }

    private _isNpcHiddenUntilReveal(npcUid: string): boolean {
        const row = this._npcRows.find((r) => r.npcUid === npcUid);
        return visibilityHiddenUntilReveal(npcUid, row, this._revealedNpcUids, this._buildRequirementContext());
    }

    private _npcAppearRequirementsMet(row: NpcJson): boolean {
        const appear = row.appear;
        if (!appear || appear.mode !== 'conditional') return appear?.mode === 'always';
        return evaluateAppearRequirements(
            appear.requirements,
            appear.matchMode,
            this._buildRequirementContext(),
        );
    }

    private _singleRequirementMet(req: unknown): boolean {
        return evaluateRequirements([req], this._buildRequirementContext());
    }

    /** 地图战斗敌人（独立 runtime NPC，uid 形如 *_enemy / *_enemy_2） */
    private _isBattleEnemyNpcUid(npcUid: string): boolean {
        return npcUid.endsWith('_enemy') || /_enemy_\d+$/.test(npcUid);
    }

    private _enemyGiverUid(npcUid: string): string | null {
        return parseEnemyGiverUid(npcUid);
    }

    /** 该 NPC 是否仍有未完成剧情环（含「须先战斗」等暂不可交互的环） */
    private _hasIncompleteStoryEvents(npcUid: string, events: MapNpcEvent[]): boolean {
        return events.some((ev) => !this._isQuestStepComplete(npcUid, ev));
    }

    /** appear / 交付条件：地图无此 eventId 时，若所属 giver 链已全部完成则视为满足 */
    private _isAppearEventDone(eventId: string): boolean {
        if (!eventId) return true;
        if (this._isEventIdQuestStepComplete(eventId)) return true;
        if (this._findMapEventById(eventId)) return false;
        const m = eventId.match(/^(task_\d+)_e\d+$/);
        if (!m) return false;
        const giverUid = m[1];
        const row = this._npcRows.find((r) => r.npcUid === giverUid);
        if (!row?.events?.length) return false;
        return (row.events as MapNpcEvent[]).every((ev) => this._isQuestStepComplete(giverUid, ev));
    }

    private _findMapEventById(eventId: string): { npcUid: string; ev: MapNpcEvent } | null {
        for (const row of this._npcRows) {
            const uid = row.npcUid ?? '';
            if (!uid) continue;
            for (const ev of row.events ?? []) {
                const cast = ev as MapNpcEvent;
                if (this._stableEventId(uid, cast) === eventId || cast.eventId === eventId) {
                    return { npcUid: uid, ev: cast };
                }
            }
        }
        return null;
    }

    /** giver 是否已完成至少一环 task_accept */
    private _giverChainAccepted(giverUid: string, giverEvents: MapNpcEvent[]): boolean {
        for (const ev of giverEvents) {
            const hasAccept = (ev.server?.effects ?? []).some(
                (raw) => String((raw as { action?: string }).action ?? '') === 'task_accept',
            );
            if (hasAccept && this._isQuestStepComplete(giverUid, ev)) return true;
        }
        return false;
    }

    private _enemyBattleEventIds(npcUid: string, events: MapNpcEvent[]): Set<string> {
        const ids = new Set<string>();
        for (const ev of events) {
            if (ev.eventType === 'battle') ids.add(this._stableEventId(npcUid, ev));
        }
        return ids;
    }

    /** 战斗敌人：所属任务官仍有未完成环且已接取时显现（不要求 pickInteract 非空） */
    private _shouldShowBattleEnemy(npcUid: string, events: MapNpcEvent[], currentMainlineUid: string | null): boolean {
        const giverUid = this._enemyGiverUid(npcUid);
        if (!giverUid) return false;
        if (currentMainlineUid && giverUid !== currentMainlineUid) return false;
        if (!currentMainlineUid) return false;

        const giverRow = this._npcRows.find((r) => r.npcUid === giverUid);
        const giverEvents = (giverRow?.events ?? []) as MapNpcEvent[];
        if (!this._giverChainAccepted(giverUid, giverEvents)) return false;
        if (!this._hasIncompleteStoryEvents(giverUid, giverEvents)) return false;

        const row = this._npcRows.find((r) => r.npcUid === npcUid);
        if (row && visibilityHiddenUntilReveal(npcUid, row, this._revealedNpcUids, this._buildRequirementContext())) {
            return false;
        }

        const battleIds = this._enemyBattleEventIds(npcUid, events);
        if (battleIds.size > 0 && [...battleIds].every((id) => this._isAppearEventDone(id))) return false;

        return this._pickInteractEvent(npcUid, events) !== null;
    }

    /** 任务状态图标用：战斗环须胜利才算完成 */
    private _evaluateRequirements(reqs: unknown[] | undefined): boolean {
        return evaluateRequirements(reqs, this._buildRequirementContext());
    }

    private _hasTaskBeenAccepted(taskId: number): boolean {
        if (this._acceptedTaskIds.has(taskId)) return true;
        return this._activeTasks.some((t) => Number(t.taskId) === taskId);
    }

    /** 战斗须胜利；其余事件看 completed_event_ids */
    private _isQuestStepComplete(npcUid: string, ev: MapNpcEvent): boolean {
        const eid = this._stableEventId(npcUid, ev);
        if (ev.eventType === 'battle') {
            return this._battleClearedEventIds.has(eid);
        }
        return this._isEventDone(eid);
    }

    private _isEventIdQuestStepComplete(eventId: string): boolean {
        if (!eventId) return true;
        for (const row of this._npcRows) {
            const uid = row.npcUid ?? '';
            if (!uid) continue;
            for (const ev of row.events ?? []) {
                const cast = ev as MapNpcEvent;
                const eid = this._stableEventId(uid, cast);
                if (eid !== eventId && cast.eventId !== eventId) continue;
                return this._isQuestStepComplete(uid, cast);
            }
        }
        const found = this._findMapEventById(eventId);
        if (found) {
            return this._isQuestStepComplete(found.npcUid, found.ev);
        }
        return this._isEventDone(eventId);
    }

    private _eventIsTaskTurnIn(ev: MapNpcEvent): boolean {
        return (
            ev.eventType === 'task' &&
            (ev.server?.effects ?? []).some(
                (raw) => String((raw as { action?: string }).action ?? '') === 'task_complete',
            )
        );
    }

    /** 本 NPC 链段内是否仍有未胜利的战斗（含交付 requirements 与关联战斗敌人） */
    private _hasOutstandingBattlesForChain(npcUid: string, events: MapNpcEvent[]): boolean {
        const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        let segmentStartOrder = 0;
        for (const ev of sorted) {
            if (this._eventIsTaskTurnIn(ev) && this._isQuestStepComplete(npcUid, ev)) {
                segmentStartOrder = (ev.order ?? 0) + 1;
            }
        }

        let turnInEv: MapNpcEvent | null = null;
        for (const ev of sorted) {
            if ((ev.order ?? 0) < segmentStartOrder) continue;
            if (!this._eventIsTaskTurnIn(ev)) continue;
            if (!this._isQuestStepComplete(npcUid, ev)) {
                turnInEv = ev;
                break;
            }
        }

        const battleEventIds = new Set<string>();
        const segmentEndOrder = turnInEv?.order ?? Number.MAX_SAFE_INTEGER;

        for (const ev of sorted) {
            const order = ev.order ?? 0;
            if (order < segmentStartOrder || order >= segmentEndOrder) continue;
            if (ev.eventType === 'battle') {
                battleEventIds.add(this._stableEventId(npcUid, ev));
            }
        }

        if (turnInEv) {
            for (const req of turnInEv.server?.requirements ?? []) {
                const rec = req as { type?: string; eventId?: string };
                if (rec.type === 'event_done' && rec.eventId) {
                    battleEventIds.add(rec.eventId);
                }
            }
        }

        for (const row of this._npcRows) {
            const uid = row.npcUid ?? '';
            if (!this._isBattleEnemyNpcUid(uid)) continue;
            if (this._enemyGiverUid(uid) !== npcUid) continue;
            for (const raw of row.events ?? []) {
                const ev = raw as MapNpcEvent;
                if (ev.eventType !== 'battle') continue;
                battleEventIds.add(this._stableEventId(uid, ev));
            }
        }

        for (const eid of battleEventIds) {
            const found = this._findMapEventById(eid);
            if (!found) continue;
            if (!this._isQuestStepComplete(found.npcUid, found.ev)) return true;
        }
        return false;
    }

    private _recordTaskEffectsFromEvent(ev: MapNpcEvent, choiceId?: string): void {
        for (const raw of ev.server?.effects ?? []) {
            const eff = raw as { action?: string; taskId?: number; choiceId?: string };
            const action = String(eff.action ?? '');
            const tid = Number(eff.taskId ?? 0);
            if (!tid) continue;
            const effChoice = eff.choiceId?.trim();
            if (effChoice && choiceId && effChoice !== choiceId) continue;
            if (action === 'task_accept') this._acceptedTaskIds.add(tid);
            if (action === 'task_complete') this._completedTaskIds.add(tid);
        }
    }

    /** 从已同步的 completed_event_ids / active_tasks 还原战斗胜利与接取 */
    private _rebuildQuestPhaseFromState(): void {
        this._battleClearedEventIds.clear();
        this._localBattleWonEventIds.clear();
        this._acceptedTaskIds.clear();
        for (const t of this._activeTasks) {
            const tid = Number(t?.taskId ?? 0);
            if (tid > 0) this._acceptedTaskIds.add(tid);
        }
        for (const row of this._npcRows) {
            const uid = row.npcUid ?? '';
            if (!uid || this._isBattleEnemyNpcUid(uid)) continue;
            for (const ev of row.events ?? []) {
                const cast = ev as MapNpcEvent;
                const eid = this._stableEventId(uid, cast);
                for (const raw of cast.server?.effects ?? []) {
                    const eff = raw as { action?: string; taskId?: number };
                    const action = String(eff.action ?? '');
                    const tid = Number(eff.taskId ?? 0);
                    if (action === 'task_accept' && tid > 0 && this._isEventDone(eid)) {
                        this._acceptedTaskIds.add(tid);
                    }
                }
                if (cast.eventType !== 'battle') continue;
                if (this._serverCompletedEventIds.has(eid) || this._localBattleWonEventIds.has(eid)) {
                    this._battleClearedEventIds.add(eid);
                    if (this._serverCompletedEventIds.has(eid)) {
                        this._localBattleWonEventIds.add(eid);
                    }
                }
            }
        }
        this._syncNpcTaskIndicators();
    }

    private _clearBattleProgress(npcUid: string, ev: MapNpcEvent): void {
        const eid = this._stableEventId(npcUid, ev);
        this._battleClearedEventIds.delete(eid);
        this._localBattleWonEventIds.delete(eid);
        this._localCompletedEventIds.delete(eid);
    }

    private _resolveNpcTaskIndicatorKind(npcUid: string, events: MapNpcEvent[]): NpcTaskIndicatorKind | null {
        return resolveNpcTaskIndicatorKind(npcUid, events, {
            stableEventId: (uid, ev) => this._stableEventId(uid, ev),
            isStepComplete: (uid, ev) => this._isQuestStepComplete(uid, ev),
            requirementsMet: (reqs) => this._evaluateRequirements(reqs),
            hasOutstandingBattlesForChain: (uid, evs) =>
                this._hasOutstandingBattlesForChain(uid, evs as MapNpcEvent[]),
            pickNextInteract: () => this._pickNextQuestStepForIndicator(npcUid, events),
        });
    }

    /** 任务图标：下一未完成环（战斗未胜利不算完成） */
    private _pickNextQuestStepForIndicator(npcUid: string, events: MapNpcEvent[]): MapNpcEvent | null {
        const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const ev of sorted) {
            if (this._isQuestStepComplete(npcUid, ev)) continue;
            const reqs = ev.server?.requirements as unknown[] | undefined;
            if (!this._evaluateRequirements(reqs)) return ev;
            return ev;
        }
        return null;
    }

    /** 头顶 Name：角色名（非任务链标题 / taskUiHint） */
    private _resolveNpcHeadLabel(row: NpcJson | undefined, events: MapNpcEvent[]): string {
        const skip = new Set(['系统', '对话', '']);
        const character = row?.characterName?.trim();
        if (character && !skip.has(character)) return character;
        for (const ev of events) {
            const dlgId = ev.client?.dialogueScriptId;
            if (!dlgId) continue;
            const sp = this._dialogueScripts[dlgId]?.speaker?.trim();
            if (sp && !skip.has(sp)) return sp;
        }
        const fallback = row?.npcName?.trim();
        return fallback || row?.npcUid || 'NPC';
    }

    private _ensureTaskStatusFramesLoaded(onReady?: () => void): void {
        if (this.npcTaskStatusFrames.length >= 4) {
            this._taskStatusFramesReady = true;
            onReady?.();
            return;
        }
        if (this._taskStatusFramesReady) {
            onReady?.();
            return;
        }
        if (this._taskStatusFramesLoading) return;
        this._taskStatusFramesLoading = true;
        const uuids = getNpcTaskStatusFrameUuids();
        let pending = uuids.length;
        const frames: SpriteFrame[] = [];
        for (let i = 0; i < uuids.length; i++) {
            assetManager.loadAny({ uuid: uuids[i] }, (err, asset) => {
                pending--;
                if (!err && asset) {
                    frames[i] = asset as SpriteFrame;
                }
                if (pending <= 0) {
                    this._taskStatusFramesLoading = false;
                    if (frames.filter(Boolean).length >= 4) {
                        this.npcTaskStatusFrames = frames;
                        this._taskStatusFramesReady = true;
                    }
                    if (this._alive()) onReady?.();
                }
            });
        }
    }

    private _applyTaskStatusSprite(statuNode: Node, kind: NpcTaskIndicatorKind): void {
        const sp = statuNode.getComponent(Sprite) ?? statuNode.addComponent(Sprite);
        const ix = npcTaskIndicatorKindToIndex(kind);
        const sf = this.npcTaskStatusFrames[ix];
        if (sf) sp.spriteFrame = sf;
    }

    /** 同步 NPC 子节点 Name / Statu：有任务链时按状态显示，否则隐藏 */
    private _syncNpcTaskIndicators(): void {
        const sync = (): void => {
            if (!this._alive()) return;
            for (const { npcUid, node, events } of this._resolved) {
                const nameNode = node?.getChildByName('Name') ?? null;
                const statuNode = node?.getChildByName('Statu') ?? null;
                if (!nameNode || !statuNode) continue;

                const row = this._npcRows.find((r) => r.npcUid === npcUid);
                const chainEvents = events.length ? events : row?.events ?? [];
                const hasChain = chainEvents.length > 0;

                if (!hasChain || !node?.isValid || !node.active || this._isNpcHiddenUntilReveal(npcUid)) {
                    nameNode.active = false;
                    statuNode.active = false;
                    continue;
                }

                // 战斗敌人不显示任务图标（仅任务官显示）
                if (this._isBattleEnemyNpcUid(npcUid)) {
                    nameNode.active = false;
                    statuNode.active = false;
                    continue;
                }

                const kind = this._resolveNpcTaskIndicatorKind(npcUid, chainEvents);
                if (this.debugLog && kind) {
                    storyLog('info', 'StoryManager: NPC 任务图标', {
                        npcUid,
                        kind,
                        frameIndex: npcTaskIndicatorKindToIndex(kind),
                    });
                }
                if (!kind) {
                    nameNode.active = false;
                    statuNode.active = false;
                    continue;
                }

                const label = nameNode.getComponent(Label);
                if (label) {
                    label.string = this._resolveNpcHeadLabel(row, chainEvents);
                }
                this._applyTaskStatusSprite(statuNode, kind);
                nameNode.active = true;
                statuNode.active = true;
            }
        };

        if (this.npcTaskStatusFrames.length >= 4 || this._taskStatusFramesReady) {
            sync();
            return;
        }
        this._ensureTaskStatusFramesLoaded(sync);
    }

    private _runStartupSelfCheck(): void {
        if (this._startupSelfCheckDone) return;
        this._startupSelfCheckDone = true;
        const issues: string[] = [];
        if (!this.mapConfig?.json) issues.push('mapConfig');
        if (!this._refs) issues.push('StoryUIViewRefs');
        if (!this.battleRoot) issues.push('battleRoot');
        if (issues.length) {
            storyLog('error', 'StoryManager 启动自检失败', { issues });
            this.scheduleOnce(() => {
                this.showToast(`剧情系统配置缺失：${issues.join('、')}`, 5000);
            }, 0.5);
        }
    }

    private _fetchStoryStateFromServer(): void {
        if (this.skipServerRequirements) return;
        this._ws = WebSocketManager.getInstance();
        if (!this._ws?.getCharacterId?.()) return;
        this._ws.request(
            'story_get_state',
            { map_code: this.mapCode },
            (resp: any) => {
                if (!this._alive()) return;
                if (!resp?.success) {
                    this.showToast('剧情状态同步失败，请重登后再试', 3200);
                    return;
                }
                const d = (resp.data ?? resp) as Record<string, unknown>;
                if (!d || typeof d !== 'object') return;
                this._syncProgressFromPayload(d);
                this._storyStateLoaded = true;
                this._refreshNpcVisibility();
                this._refreshOwnedItemsFromWs();
            },
            true,
            8000,
        );
    }

    private _localStoryStorageKey(): string {
        const ws = this._ws || WebSocketManager.getInstance();
        const cid = ws?.getCharacterId?.() ?? null;
        return localStoryStorageKey(this.mapCode, cid);
    }

    private _loadLocalStoryState(): void {
        if (!this.skipServerRequirements) return;

        if (this.resetLocalStoryOnEnter) {
            clearLocalStoryPersist(this._localStoryStorageKey());
            this._resetStoryRuntimeState();
            this._rebuildQuestPhaseFromState();
            this._storyStateLoaded = true;
            this._syncNpcTaskIndicators();
            if (this.debugLog) {
                storyLog('info', 'StoryManager: 本地剧情已重置（每次进入从头跑）', { mapCode: this.mapCode });
            }
            return;
        }

        const saved = loadLocalStoryPersist(this._localStoryStorageKey());
        if (!saved) {
            this._storyStateLoaded = true;
            return;
        }
        const completed = [...(saved.completed_event_ids ?? [])];
        const battleIds = saved.battle_cleared_event_ids ?? [];
        for (const id of battleIds) {
            if (id && !completed.includes(id)) completed.push(id);
        }
        this._syncProgressFromPayload({
            completed_event_ids: completed,
            revealed_npc_uids: saved.revealed_npc_uids ?? [],
            mainline_step: saved.mainline_step ?? 0,
            completed_task_ids: saved.completed_task_ids ?? [],
        });
        this._acceptedTaskIds.clear();
        for (const tid of saved.accepted_task_ids ?? []) {
            const n = Number(tid);
            if (n > 0) this._acceptedTaskIds.add(n);
        }
        this._battleClearedEventIds.clear();
        for (const id of battleIds) {
            if (id) this._battleClearedEventIds.add(id);
        }
        this._rebuildQuestPhaseFromState();
        this._storyStateLoaded = true;
        if (this.debugLog) {
            storyLog('info', 'StoryManager: 已加载本地剧情进度', { mapCode: this.mapCode });
        }
    }

    private _persistLocalStoryState(): void {
        if (!this.skipServerRequirements || this.resetLocalStoryOnEnter) return;
        const data: LocalStoryPersist = {
            completed_event_ids: [...this._localCompletedEventIds],
            battle_cleared_event_ids: [...this._battleClearedEventIds],
            accepted_task_ids: [...this._acceptedTaskIds],
            completed_task_ids: [...this._completedTaskIds],
            revealed_npc_uids: [...this._revealedNpcUids],
            mainline_step: this._mainlineStep,
        };
        saveLocalStoryPersist(this._localStoryStorageKey(), data);
    }

    /** 清除当前 map 本地剧情进度（调试 / 重开主线） */
    public clearLocalStoryProgress(): void {
        if (!this.skipServerRequirements) return;
        clearLocalStoryPersist(this._localStoryStorageKey());
        this._resetStoryRuntimeState();
        if (this.debugLog) storyLog('info', 'StoryManager: 本地剧情进度已清除', { mapCode: this.mapCode });
    }

    private _isEventDone(eventId: string): boolean {
        return this._localCompletedEventIds.has(eventId) || this._serverCompletedEventIds.has(eventId);
    }

    private _showFlowWaiting(show: boolean): void {
        if (show === this._flowWaitingVisible) return;
        this._flowWaitingVisible = show;
        this._resolveRefs();
        const panel = this._refs?.storyTipsPanel;
        if (!panel) return;
        if (show) {
            const lab = this._label(this._refs?.storyTipsLabel ?? panel);
            if (lab) lab.string = '…';
            panel.active = true;
            this._storyTipsPlaying = true;
            this.unschedule(this._hideStoryTip);
        } else {
            panel.active = false;
            this._storyTipsPlaying = false;
        }
    }

    private async _promiseInteract(
        npcUid: string,
        ev: MapNpcEvent,
        choiceId?: string,
    ): Promise<StoryInteractPayload> {
        if (this.skipServerRequirements) {
            const client = ev.client ?? {};
            if (ev.eventType === 'battle' && client.choiceScriptId && !choiceId) {
                return { action: 'choice_then_battle' };
            }
            return { action: ev.eventType };
        }
        this._showFlowWaiting(true);
        try {
            const ws = this._ws || WebSocketManager.getInstance();
            const eventId = this._stableEventId(npcUid, ev);
            const resp = await promisifyWsRequest(
                (route, payload, cb, useRid, timeout) => ws.request(route, payload, cb, useRid, timeout),
                'story_interact',
                { map_code: this.mapCode, event_id: eventId, npc_uid: npcUid, choice_id: choiceId },
                8000,
            );
            return (resp.data || resp) as StoryInteractPayload;
        } finally {
            this._showFlowWaiting(false);
        }
    }

    private async _promiseComplete(
        npcUid: string,
        ev: MapNpcEvent,
        opts?: { battleWon?: boolean; choiceId?: string },
    ): Promise<Record<string, unknown>> {
        if (this.skipServerRequirements) {
            if (opts?.battleWon === false) return {};
            const data = buildLocalCompletePayload(ev, opts?.choiceId);
            this._applyEffectsFromResponse(data);
            this._persistLocalStoryState();
            return data;
        }
        const eventId = this._stableEventId(npcUid, ev);
        this._showFlowWaiting(true);
        try {
            const ws = this._ws || WebSocketManager.getInstance();
            const resp = await promisifyWsRequest(
                (route, payload, cb, useRid, timeout) => ws.request(route, payload, cb, useRid, timeout),
                'story_event_complete',
                {
                    map_code: this.mapCode,
                    event_id: eventId,
                    battle_won: opts?.battleWon !== false,
                    choice_id: opts?.choiceId,
                },
                10000,
            );
            if (isChoiceBlockedMessage(resp.message)) {
                this.showStoryTip('已暂缓，任务未推进。再次靠近按 E 或点击可继续。', 3200);
                this._endActivation();
                return {};
            }
            const d = (resp.data || resp) as Record<string, unknown>;
            this._syncProgressFromPayload(d);
            return d;
        } catch (err) {
            const msg = err instanceof Error ? err.message : '剧情同步失败';
            this.showToast(msg, 2800);
            throw err;
        } finally {
            this._showFlowWaiting(false);
        }
    }

    private _promiseDialogue(script: DialogueLineScript): Promise<void> {
        return new Promise((resolve) => {
            this.startDialogue(script, () => resolve());
        });
    }

    private _promiseChoice(choice: ChoiceScript): Promise<ChoiceOption> {
        return new Promise((resolve) => {
            this.startChoice(choice, (opt) => resolve(opt));
        });
    }

    private _promiseStoryBattle(
        npcUid: string,
        ev: MapNpcEvent,
        choiceId?: string,
        alreadyAuthorized = false,
    ): Promise<boolean> {
        return new Promise((resolve) => {
            this._startStoryBattle(npcUid, ev, choiceId, alreadyAuthorized, (won) => resolve(won));
        });
    }

    private _showChoiceFeedback(opt: ChoiceOption): void {
        if (opt.npcReply) this.showStoryTip(opt.npcReply, 3500);
        if (opt.systemTip) this.showStoryTip(opt.systemTip, 3500);
    }

    private async _runEventFlow(npcUid: string, ev: MapNpcEvent): Promise<void> {
        if (this._eventFlowRunning) return;
        this._eventFlowRunning = true;
        const client = ev.client ?? {};
        const eventId = this._stableEventId(npcUid, ev);

        const failFlow = (): void => {
            this.closeAll();
            this._endActivation();
        };

        try {
            if (isBattleInteractAction(undefined, ev)) {
                this.showStoryTip('进入战斗…', 900);
                await new Promise<void>((r) => {
                    this.scheduleOnce(() => r(), Math.max(0, this.battleTransitionDelaySec));
                });
                if (!this._alive()) return;

                const payload = await this._promiseInteract(npcUid, ev);
                if (payload.action === 'choice_then_battle' && client.choiceScriptId) {
                    const ch = this._choiceScripts[client.choiceScriptId];
                    if (!ch) {
                        this.showToast('战前选项配置缺失', 3000);
                        failFlow();
                        return;
                    }
                    const opt = await this._promiseChoice(ch);
                    this._showChoiceFeedback(opt);
                    if (!shouldStartBattleFromChoice(opt, ev)) {
                        this._clearBattleProgress(npcUid, ev);
                        this._endActivation();
                        this._syncNpcTaskIndicators();
                        return;
                    }
                    this._activationPausedForBattle = true;
                    await this._promiseInteract(npcUid, ev, opt.id);
                    const won = await this._promiseStoryBattle(npcUid, ev, opt.id, true);
                    if (!won) return;
                    const data = await this._promiseComplete(npcUid, ev, { battleWon: true });
                    this._applyEffectsFromResponse(data);
                    this._markEventDone(npcUid, ev, {});
                    return;
                }

                this._activationPausedForBattle = true;
                const won = await this._promiseStoryBattle(npcUid, ev, undefined, true);
                if (!won) return;
                const data = await this._promiseComplete(npcUid, ev, { battleWon: true });
                this._applyEffectsFromResponse(data);
                this._markEventDone(npcUid, ev, {});
                return;
            }

            const interactPayload = await this._promiseInteract(npcUid, ev);

            if (ev.eventType === 'dialog' && client.dialogueScriptId) {
                const scr = this._dialogueScripts[client.dialogueScriptId];
                if (!scr) {
                    this.showToast('对白配置缺失', 3000);
                    failFlow();
                    return;
                }
                await this._promiseDialogue(scr);
                const data = await this._promiseComplete(npcUid, ev, {});
                this._applyEffectsFromResponse(data);
                this._markEventDone(npcUid, ev, {});
                return;
            }

            const choiceScriptId =
                client.choiceScriptId ||
                (interactPayload.choice_script_id as string | undefined);
            if (choiceScriptId || ev.eventType === 'choice' || ev.eventType === 'teleport') {
                const sid = choiceScriptId || client.choiceScriptId;
                const ch = sid ? this._choiceScripts[sid] : null;
                if (!ch) {
                    this.showToast('选项配置缺失', 3000);
                    failFlow();
                    return;
                }
                const opt = await this._promiseChoice(ch);
                this._showChoiceFeedback(opt);
                if (!shouldCompleteChoice(opt, ev)) {
                    if (!opt.npcReply && !opt.systemTip) {
                        this.showStoryTip('已暂缓，任务未推进。再次靠近按 E 或点击可继续。', 3200);
                    }
                    this._endNpcChainSession();
                    this._endActivation();
                    this._syncNpcTaskIndicators();
                    return;
                }
                const data = await this._promiseComplete(npcUid, ev, { choiceId: opt.id });
                if (!this.skipServerRequirements && (!data || Object.keys(data).length === 0)) return;
                this._applyEffectsFromResponse(data);
                this._markEventDone(npcUid, ev, { choiceId: opt.id });
                return;
            }

            if (ev.eventType === 'task') {
                const hint = client.taskUiHint?.trim();
                if (hint && hint !== '节点') {
                    await this._promiseDialogue({ speaker: '系统', lines: [hint] });
                }
                const data = await this._promiseComplete(npcUid, ev, {});
                this._applyEffectsFromResponse(data);
                this._markEventDone(npcUid, ev, {});
                return;
            }

            this.showToast(`未接入的 NPC 事件: ${ev.eventType ?? 'unknown'}`, 3200);
            failFlow();
        } catch {
            failFlow();
        } finally {
            this._eventFlowRunning = false;
            this._syncPlayerInputLock();
        }
    }

    private _applyEffectsFromResponse(data?: Record<string, unknown>): void {
        const applied = (data?.applied_effects as Array<Record<string, unknown>>) || [];
        let rewardEmitted = false;
        for (const eff of applied) {
            const action = String(eff.action ?? '');
            if (action === 'reveal_npc') {
                this._revealNpc(String(eff.npcUid ?? ''));
            } else if (action === 'spawn_npc') {
                this._spawnNpcFromEffect(eff);
            } else if (action === 'task_accept') {
                const tid = Number(eff.taskId ?? 0);
                if (tid > 0) this._acceptedTaskIds.add(tid);
                const name = this._taskNameById(tid);
                this.showStoryTip(name ? `已接取任务：${name}` : '已接取新任务', 3200);
            } else if (action === 'task_complete') {
                const tid = Number(eff.taskId ?? 0);
                const name = this._taskNameById(tid);
                if (tid > 0) {
                    this._completedTaskIds.add(tid);
                    this._acceptedTaskIds.delete(tid);
                }
                this.showStoryTip(name ? `任务完成：${name}` : '任务已完成', 3200);
            } else if (action === 'give_item') {
                const iid = Number(eff.itemId ?? 0);
                const cnt = Number(eff.count ?? 1);
                this.showStoryTip(iid ? `获得物品 ×${cnt}` : '获得物品', 2800);
                rewardEmitted = true;
            } else if (action === 'add_exp') {
                const exp = Number(eff.value ?? eff.exp ?? 0);
                this.showStoryTip(exp > 0 ? `获得经验 +${exp}` : '获得经验', 2800);
                rewardEmitted = true;
            } else if (action === 'send_mail') {
                this.showStoryTip('奖励已发送至邮箱', 2800);
                rewardEmitted = true;
            }
        }
        const tp = applied.find((e) => e.action === 'teleport');
        if (tp) this._applyTeleport(tp);
        if (rewardEmitted && this.node?.isValid) {
            this.node.emit('story_reward_applied', applied);
        }
        const taskFx = applied.some(
            (e) => e.action === 'task_accept' || e.action === 'task_complete',
        );
        if (taskFx) {
            this._syncNpcTaskIndicators();
            this._refreshNpcVisibility();
        }
    }

    private _taskNameById(taskId: number): string {
        if (!taskId) return '';
        const fromSnap = this._tasksSnapshot.find((t) => Number(t.taskId) === taskId);
        if (fromSnap?.taskName) return fromSnap.taskName;
        const fromDef = this._taskDefs.find((t) => Number(t.taskId) === taskId);
        return fromDef?.taskName?.trim() || '';
    }

    private _revealNpc(npcUid: string): void {
        if (!npcUid) return;
        this._revealedNpcUids.add(npcUid);
        const entry = this._resolved.find((r) => r.npcUid === npcUid);
        if (entry?.node?.isValid) {
            entry.node.active = true;
            const bc = entry.node.getComponent(BoxCollider2D);
            if (bc) bc.enabled = true;
        }
        this._refreshNpcVisibility();
        if (this.debugLog) storyLog('info', 'StoryManager: NPC 已显现', { npcUid });
        this._persistLocalStoryState();
    }

    private _spawnNpcFromEffect(eff: Record<string, unknown>): void {
        const uid = String(eff.npcUid ?? '').trim();
        if (!uid) return;
        if (this._resolved.some((r) => r.npcUid === uid)) {
            this._revealNpc(uid);
            return;
        }
        const row: NpcJson = {
            npcUid: uid,
            npcName: eff.npcName ? String(eff.npcName) : undefined,
            prefabKey: eff.prefabKey ? String(eff.prefabKey) : undefined,
            x: Number(eff.x),
            y: Number(eff.y),
            events: [],
        };
        if (!Number.isFinite(row.x)) row.x = undefined;
        if (!Number.isFinite(row.y)) row.y = undefined;
        this._spawnDynamicNpcRow(row);
    }

    private _spawnDynamicNpcRow(row: NpcJson): void {
        const uid = row.npcUid;
        if (!uid) return;
        const scene = director.getScene();
        if (!scene) return;
        const canvas = this._findNodeByName(scene, 'Canvas');
        const templateNpc =
            (canvas && this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC')) ?? null;
        const refRow = this._npcRows.find((r) => r.npcUid === '0_lead_01') ?? this._npcRows[0];
        if (!templateNpc?.isValid) return;
        const cloneStackSlot = this._spawnedNpcRoots.length + 1;
        const node = this._spawnNpcFromTemplate(scene, templateNpc, row, refRow, cloneStackSlot);
        if (!node) return;
        this._applyNpcPortraitFromRow(node, row);
        this._spawnedNpcUids.add(uid);
        if (!this._npcRows.some((r) => r.npcUid === uid)) {
            this._npcRows.push(row);
        }
        if (!this._storyNpcOrder.includes(uid)) {
            this._storyNpcOrder.push(uid);
        }
        this._resolved.push({ npcUid: uid, node, events: row.events ?? [] });
        this._bindNpcTouchHandlers();
        this._refreshNpcVisibility();
        if (this.debugLog) storyLog('info', 'StoryManager: 动态生成 NPC', { npcUid: uid });
    }

    private _applyTeleport(tp: Record<string, unknown>): void {
        const mapId = Number(tp.toMapId ?? 0);
        const x = Number(tp.toX ?? 0);
        const y = Number(tp.toY ?? 0);
        if (mapId === 1) {
            this._resolveLocalPlayerOnce();
            const node = this._playerMove?.node;
            if (node?.isValid) {
                node.setPosition(x, y, node.position.z);
                this.showStoryTip('已传送至指定地点', 2800);
            }
        } else {
            this.showStoryTip(`法西城（地图 ${mapId}）传送已登记，该地图场景后续接入`, 4500);
        }
    }

    /**
     * @param onFinished 战斗结束回调（剧情流 Promise 用）
     */
    private _startStoryBattle(
        npcUid: string,
        ev: MapNpcEvent,
        choiceId?: string,
        alreadyAuthorized = false,
        onFinished?: (won: boolean) => void,
    ): void {
        const eventId = this._stableEventId(npcUid, ev);
        const battleRef = ev.server?.battleRef || 'battle_300001';
        const root = this.battleRoot;
        const battle = root?.getComponent(BattleScene);
        if (!battle) {
            this._activationPausedForBattle = false;
            this.showToast('未配置 BattleScene，无法进入剧情战', 3000);
            onFinished?.(false);
            return;
        }

        const launchBattle = (): void => {
            this.closeAll();
            battle.startStoryBattle({
                mapCode: this.mapCode,
                eventId,
                battleRef,
                skipServerAuth: this.skipServerRequirements,
                onFinished: (won, errMsg) => {
                    this._activationPausedForBattle = false;
                    if (!won) {
                        this._clearBattleProgress(npcUid, ev);
                        this._endActivation();
                        this.showToast(errMsg || '战斗失败', 3200);
                        this._syncNpcTaskIndicators();
                        onFinished?.(false);
                        return;
                    }
                    onFinished?.(true);
                },
            });
        };

        if (this.skipServerRequirements || alreadyAuthorized) {
            launchBattle();
            return;
        }

        const ws = this._ws || WebSocketManager.getInstance();
        const eid = this._stableEventId(npcUid, ev);
        ws.request(
            'story_interact',
            { map_code: this.mapCode, event_id: eid, npc_uid: npcUid, choice_id: choiceId },
            (resp: { success?: boolean; message?: string }) => {
                if (!this._alive()) return;
                if (!resp?.success) {
                    this._activationPausedForBattle = false;
                    this.showToast(resp?.message || '战斗未授权', 3200);
                    this._endActivation();
                    onFinished?.(false);
                    return;
                }
                launchBattle();
            },
            true,
            8000,
        );
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        const ws = WebSocketManager.getInstance();
        ws?.off('select_character_response', this._onCharacterSelected, this);
        ws?.off('data_changed', this._onWsDataChanged, this);
        ws?.off('player_info', this._onPlayerInfoCache, this);
        ws?.off('player_info_response', this._onPlayerInfoCache, this);
        this._unbindNpcTouchHandlers();
        this._unbindNext();
        this._clearChoiceHandlers();
        this.unschedule(this._hideToast);
        this._playerMove?.setInputLocked(false);
        this._destroySpawnedNpcs();
    }

    update(): void {
        this._pollTouchOverlap();
        this._syncPlayerInputLock();
    }

    get isBlocking(): boolean {
        const d = this._refs?.dialoguePanel?.active ?? false;
        const c = this._refs?.choiceModal?.active ?? false;
        const battle = this.battleRoot?.active ?? false;
        return d || c || battle;
    }

    /** 对白/选项/剧情战/事件链激活中锁定玩家移动 */
    private _shouldLockPlayerMovement(): boolean {
        return this.isBlocking || Boolean(this._activationNpcUid) || this._eventFlowRunning || this._flowWaitingVisible;
    }

    private _syncPlayerInputLock(): void {
        this._resolveLocalPlayerOnce();
        this._playerMove?.setInputLocked(this._shouldLockPlayerMovement());
    }

    // --- map ---

    private _parseMap(): void {
        const raw = this.mapConfig?.json as Record<string, unknown> | null;
        if (!raw) {
            if (this.debugLog) storyLog('warn', 'StoryManager._parseMap: mapConfig 为空', {});
            return;
        }
        const jsonMapCode = String(raw.mapCode ?? raw.map_code ?? '').trim();
        if (jsonMapCode && jsonMapCode !== this.mapCode) {
            if (this.debugLog) {
                storyLog('warn', 'StoryManager: mapCode 与 JsonAsset 不一致，已以 JSON 为准', {
                    sceneMapCode: this.mapCode,
                    jsonMapCode,
                });
            }
            this.mapCode = jsonMapCode;
        }
        sanitizeBattlePseudoChoicesInRuntime(raw as RuntimeMapLike);
        const client = (raw.client ?? {}) as Record<string, unknown>;
        this._dialogueScripts = (client.dialogueScripts ?? {}) as Record<string, DialogueLineScript>;
        this._choiceScripts = (client.choiceScripts ?? {}) as Record<string, ChoiceScript>;
        this._npcRows = (raw.npcs ?? []) as NpcJson[];
        this._taskDefs = (raw.tasks ?? raw.quests ?? []) as typeof this._taskDefs;

        const mw = Number(raw.mapWidth ?? raw.map_width);
        const mh = Number(raw.mapHeight ?? raw.map_height);
        if (Number.isFinite(mw) && Number.isFinite(mh) && mw > 0 && mh > 0) {
            this._jsonMapContentSize = { w: mw, h: mh };
        } else {
            this._jsonMapContentSize = null;
        }

        const server = (raw.server ?? {}) as Record<string, unknown>;
        const anti = (server.antiCheat ?? {}) as Record<string, unknown>;
        const maxD = Number(anti.maxInteractDistance);
        if (Number.isFinite(maxD) && maxD > 0) {
            this.interactDistanceFallbackPx = Math.min(this.interactDistanceFallbackPx, maxD);
        }
        this._warnMisplacedBattleFlowInMap();
        this._validateChoiceDeferContracts();
    }

    /** 加载时校验：defer 选项不应在 allowedChoiceIds，暂缓文案应 block */
    private _validateChoiceDeferContracts(): void {
        const deferTextRe =
            /暂缓|拒绝|算了|稍后再|下次再说|不感兴趣|离开|不做|还没准备好|再想想|稍后|暂不|未准备好|考虑一下/;
        for (const row of this._npcRows) {
            const npcUid = row.npcUid ?? '';
            for (const ev of row.events ?? []) {
                if (ev.eventType !== 'choice' && ev.eventType !== 'teleport') continue;
                const sid = ev.client?.choiceScriptId;
                if (!sid) continue;
                const script = this._choiceScripts[sid];
                if (!script?.options?.length) continue;
                const allowed = ev.server?.allowedChoiceIds ?? [];
                for (const opt of script.options) {
                    const blocked =
                        opt.completesEvent === false ||
                        opt.forcedResult === 'block' ||
                        opt.forcedResult === 'none';
                    if (blocked && allowed.includes(opt.id)) {
                        storyLog('warn', 'StoryManager: defer 选项仍在 allowedChoiceIds', {
                            npcUid,
                            eventId: ev.eventId,
                            choiceId: opt.id,
                            text: opt.text,
                        });
                    }
                    if (
                        !blocked &&
                        deferTextRe.test(String(opt.text ?? '').trim()) &&
                        allowed.includes(opt.id)
                    ) {
                        storyLog('warn', 'StoryManager: 暂缓文案但未 block，可能误推进任务', {
                            npcUid,
                            eventId: ev.eventId,
                            choiceId: opt.id,
                            text: opt.text,
                        });
                    }
                }
            }
        }
    }

    /** 旧版 AI 链：任务官含「战斗结果」且无 battle 事件 / 无 _enemy NPC */
    private _warnMisplacedBattleFlowInMap(): void {
        const hasBattleEvent = this._npcRows.some((row) =>
            (row.events ?? []).some((ev) => ev.eventType === 'battle'),
        );
        const hasEnemyNpc = this._npcRows.some((row) => {
            const uid = row.npcUid ?? '';
            return uid.endsWith('_enemy') || /_enemy_\d+$/.test(uid);
        });
        for (const row of this._npcRows) {
            const uid = row.npcUid ?? '';
            if (uid.endsWith('_enemy')) continue;
            for (const ev of row.events ?? []) {
                if (ev.eventType !== 'choice') continue;
                const desc = String(ev.eventTypeDesc ?? '');
                if (!desc.includes('战斗结果')) continue;
                storyLog('warn', 'StoryManager: 任务官链内误含「战斗结果」选项，应去红色战斗敌人处开战', {
                    npcUid: uid,
                    eventId: ev.eventId,
                    hasBattleEvent,
                    hasEnemyNpc,
                    hint: '请在 Juben 添加战斗分支并重新 publish:map',
                });
            }
        }
        if (!hasBattleEvent && !hasEnemyNpc) {
            const giverWithBattleResult = this._npcRows.some((row) =>
                (row.events ?? []).some((ev) => String(ev.eventTypeDesc ?? '').includes('战斗结果')),
            );
            if (giverWithBattleResult) {
                storyLog('warn', 'StoryManager: 当前 map JSON 缺少 battle 事件与战斗敌人 NPC，剧情战无法触发', {
                    mapCode: this.mapCode,
                });
            }
        }
    }

    private _getSequentialBlockHint(): string | null {
        if (!this.sequentialStoryNpcReveal || !this._playerMove) return null;
        let currentUid: string | null = null;
        for (const uid of this._storyNpcOrder) {
            if (this._isBattleEnemyNpcUid(uid)) continue;
            if (this._isNpcHiddenUntilReveal(uid)) continue;
            const row = this._npcRows.find((r) => r.npcUid === uid);
            if (isHiddenByMainlineStep(row, { mainlineStep: this._mainlineStep } as { mainlineStep: number })) {
                continue;
            }
            const entry = this._resolved.find((r) => r.npcUid === uid);
            if (!entry) continue;
            if (this._hasIncompleteStoryEvents(uid, entry.events)) {
                currentUid = uid;
                break;
            }
        }
        if (!currentUid) return null;
        const R = this.interactDistanceFallbackPx;
        for (const { npcUid, node } of this._resolved) {
            if (npcUid === currentUid || !node?.isValid || node.active) continue;
            if (this._isBattleEnemyNpcUid(npcUid)) continue;
            if (this._isNpcHiddenUntilReveal(npcUid)) continue;
            if (this._distanceToPlayer(node) > R) continue;
            const curRow = this._npcRows.find((n) => n.npcUid === currentUid);
            const row = this._npcRows.find((n) => n.npcUid === npcUid);
            const curName = curRow?.npcName || currentUid;
            const name = row?.npcName || npcUid;
            return `请先完成 ${curName} 的主线，再与 ${name} 对话`;
        }
        return null;
    }

    private _stableEventId(npcUid: string, ev: MapNpcEvent): string {
        if (ev.eventId) return ev.eventId;
        return `${npcUid}#order_${ev.order ?? 0}`;
    }

    private _markEventDone(npcUid: string, ev: MapNpcEvent, opts?: { choiceId?: string }): void {
        const eid = this._stableEventId(npcUid, ev);
        this._recordTaskEffectsFromEvent(ev, opts?.choiceId);
        if (ev.eventType === 'battle') {
            this._battleClearedEventIds.add(eid);
            this._localBattleWonEventIds.add(eid);
        }
        this._localCompletedEventIds.add(eid);
        if (this.debugLog) {
            storyLog('info', 'StoryManager: 事件已完成', {
                npcUid,
                eventId: eid,
                eventType: ev.eventType,
            });
        }
        if (ev.client?.endsSession) {
            this._endNpcChainSession();
        }
        if (this._shouldHideNpcWhenComplete(npcUid)) {
            this._hideNpcIfStoryComplete(npcUid);
        }
        this._refreshNpcVisibility();
        this._syncNpcTaskIndicators();
        this._persistLocalStoryState();

        const entry = this._resolved.find((r) => r.npcUid === npcUid);
        const next = entry ? this._pickInteractEvent(npcUid, entry.events) : null;
        if (!next) {
            this._endActivation();
            return;
        }
        if (next.client?.requiresApproach) {
            this._npcApproachOk = false;
        }
        this._continueChain(npcUid);
    }

    private _tryTriggerActivation(npcUid: string): void {
        const now = Date.now();
        if (now - this._lastInteractTriggerAt < 200) return;
        this._lastInteractTriggerAt = now;
        this._beginActivation(npcUid);
    }

    private _beginActivation(npcUid: string): void {
        if (this._activationNpcUid) {
            if (this._activationNpcUid !== npcUid) return;
            if (this._eventFlowRunning || this.isBlocking || this._activationPausedForBattle) return;
        }
        this._activationNpcUid = npcUid;
        this._activationPausedForBattle = false;
        this._beginNpcChainSession(npcUid);
        const entry = this._resolved.find((x) => x.npcUid === npcUid);
        if (!entry) {
            this._endActivation();
            return;
        }
        this._facePlayerTowardNpc(entry.node);
        const ev = this._pickInteractEvent(npcUid, entry.events);
        if (!ev) {
            this._endActivation();
            return;
        }
        if (ev.client?.requiresApproach && !this._npcApproachOk) {
            this.showToast('请先离开再靠近 NPC', 2000);
            this._endActivation();
            return;
        }
        void this._runEventFlow(npcUid, ev);
    }

    private _facePlayerTowardNpc(npcNode: Node): void {
        this._resolveLocalPlayerOnce();
        if (!this._playerMove?.node?.isValid || !npcNode?.isValid) return;
        const p = npcNode.worldPosition;
        this._playerMove.faceToward(p.x, p.y);
    }

    private _continueChain(npcUid: string, attempt = 0): void {
        if (this._activationNpcUid !== npcUid || this._activationPausedForBattle) return;

        const maxAttempts = 5;
        if (this._eventFlowRunning || this.isBlocking) {
            if (attempt < maxAttempts) {
                this.scheduleOnce(() => this._continueChain(npcUid, attempt + 1), 0.1);
            } else {
                storyLog('warn', 'StoryManager: 续链等待超时', { npcUid, attempt });
                this.showToast('剧情衔接中断，请再按 E 或点击交谈', 2800);
                this._endActivation();
            }
            return;
        }

        const entry = this._resolved.find((r) => r.npcUid === npcUid);
        const next = entry ? this._pickInteractEvent(npcUid, entry.events) : null;
        if (!next) {
            this._endActivation();
            return;
        }
        if (this.cancelActivationOnLeaveRange && this._playerTouchingNpcUid !== npcUid) {
            this._endActivation();
            return;
        }
        if (next.client?.requiresApproach && !this._npcApproachOk) {
            this._endActivation();
            return;
        }

        this.scheduleOnce(() => {
            if (!this._alive()) return;
            if (
                this._activationNpcUid !== npcUid ||
                this._activationPausedForBattle ||
                this._eventFlowRunning ||
                this.isBlocking
            ) {
                if (attempt < maxAttempts) {
                    this._continueChain(npcUid, attempt + 1);
                } else {
                    this.showToast('剧情衔接中断，请再按 E 或点击交谈', 2800);
                    this._endActivation();
                }
                return;
            }
            void this._runEventFlow(npcUid, next);
        }, 0);
    }

    private _endActivation(): void {
        this._activationNpcUid = null;
        this._activationPausedForBattle = false;
        this._endNpcChainSession();
        this._syncPlayerInputLock();
    }

    private _beginNpcChainSession(npcUid: string): void {
        this._chainNpcUid = npcUid;
        this._npcApproachOk = true;
    }

    private _endNpcChainSession(): void {
        this._chainNpcUid = null;
        this._npcApproachOk = true;
    }

    private _shouldHideNpcWhenComplete(npcUid: string): boolean {
        if (!this.hideNpcWhenStoryComplete) return false;
        const row = this._npcRows.find((r) => r.npcUid === npcUid);
        return row?.hideWhenComplete ?? true;
    }

    private _resolveCurrentMainlineNpcUid(): string | null {
        const hasIncomplete = (uid: string): boolean => {
            const entry = this._resolved.find((r) => r.npcUid === uid);
            if (!entry) return false;
            return this._hasIncompleteStoryEvents(uid, entry.events);
        };
        const hasInteract = (uid: string): boolean => {
            const entry = this._resolved.find((r) => r.npcUid === uid);
            if (!entry) return false;
            return this._pickInteractEvent(uid, entry.events) !== null;
        };
        for (const uid of this._storyNpcOrder) {
            if (this._isBattleEnemyNpcUid(uid)) continue;
            if (this._isNpcHiddenUntilReveal(uid)) continue;
            const row = this._npcRows.find((r) => r.npcUid === uid);
            if (isHiddenByMainlineStep(row, { mainlineStep: this._mainlineStep } as { mainlineStep: number })) {
                continue;
            }
            if (!hasIncomplete(uid)) continue;
            if (
                isStaleMainlineGiver(
                    uid,
                    this._storyNpcOrder,
                    (u) => this._isBattleEnemyNpcUid(u),
                    (u) => this._isNpcHiddenUntilReveal(u),
                    hasIncomplete,
                    hasInteract,
                )
            ) {
                continue;
            }
            return uid;
        }
        return null;
    }

    /** 统一 NPC 可见性：appear + mainline_step + 顺序显现 */
    private _refreshNpcVisibility(): void {
        if (!this.sequentialStoryNpcReveal) {
            const currentUid = this._resolveCurrentMainlineNpcUid();
            for (const { npcUid, node, events } of this._resolved) {
                if (!node?.isValid) continue;
                if (this._isNpcHiddenUntilReveal(npcUid)) {
                    node.active = false;
                    const bc = node.getComponent(BoxCollider2D);
                    if (bc) bc.enabled = false;
                    continue;
                }
                const show = this._isBattleEnemyNpcUid(npcUid)
                    ? this._shouldShowBattleEnemy(npcUid, events, currentUid)
                    : this._hasIncompleteStoryEvents(npcUid, events);
                node.active = show;
                const bc2 = node.getComponent(BoxCollider2D);
                if (bc2) bc2.enabled = this._isBattleEnemyNpcUid(npcUid) ? show : this._pickInteractEvent(npcUid, events) !== null;
            }
            this._syncNpcTaskIndicators();
            return;
        }

        const currentUid = this._resolveCurrentMainlineNpcUid();
        const currentEntry = currentUid ? this._resolved.find((r) => r.npcUid === currentUid) : null;
        const currentNode = currentEntry?.node ?? null;

        for (const { npcUid, node, events } of this._resolved) {
            if (!node?.isValid) continue;
            const row = this._npcRows.find((r) => r.npcUid === npcUid);
            const isAncestor =
                currentNode !== null && node !== currentNode && this._isDescendantOf(currentNode, node);
            const decision = decideNpcVisibility(
                npcUid,
                row,
                events,
                {
                    revealedNpcUids: this._revealedNpcUids,
                    mainlineStep: this._mainlineStep,
                    taskDefs: new Map(),
                    sequentialReveal: true,
                    storyNpcOrder: this._storyNpcOrder,
                    reqCtx: this._buildRequirementContext(),
                    isBattleEnemyNpcUid: (uid) => this._isBattleEnemyNpcUid(uid),
                    hasActiveInteractEvent: (uid, evs) => {
                        const evList = evs as MapNpcEvent[];
                        if (this._isBattleEnemyNpcUid(uid)) {
                            return this._shouldShowBattleEnemy(uid, evList, currentUid);
                        }
                        return this._pickInteractEvent(uid, evList) !== null;
                    },
                    isNpcHiddenByAppear: (uid) => this._isNpcHiddenUntilReveal(uid),
                },
                currentUid,
                isAncestor,
            );
            node.active = decision.visible;
            const bc = node.getComponent(BoxCollider2D);
            if (bc) bc.enabled = decision.colliderEnabled;
        }

        if (this.debugLog) {
            storyLog('info', 'StoryManager: 顺序可见性', {
                currentUid,
                resolved: this._resolved.map((r) => r.npcUid),
            });
        }
        this._syncNpcTaskIndicators();
    }

    private _unbindNpcTouchHandlers(): void {
        for (const off of this._npcTouchUnbinders) off();
        this._npcTouchUnbinders.length = 0;
    }

    private _bindNpcTouchHandlers(): void {
        this._unbindNpcTouchHandlers();
        for (const { npcUid, node } of this._resolved) {
            if (!node?.isValid) continue;
            const handler = (e: EventTouch) => {
                e.propagationStopped = true;
                if (this._playerTouchingNpcUid !== npcUid) return;
                if (this.isBlocking || this._eventFlowRunning || this._activationNpcUid) return;
                this._tryTriggerActivation(npcUid);
            };
            node.on(Node.EventType.TOUCH_END, handler, this);
            this._npcTouchUnbinders.push(() => {
                if (node?.isValid) node.off(Node.EventType.TOUCH_END, handler, this);
            });
        }
    }

    /** E / 回车 / 空格 + 编辑器里配置的 interactKey */
    private _isStoryInteractKey(code: KeyCode): boolean {
        return (
            code === KeyCode.KEY_E ||
            code === KeyCode.ENTER ||
            code === KeyCode.SPACE ||
            code === this.interactKey
        );
    }

    /** 该 npcUid 下剧情链全部完成时，隐藏或销毁对应场景节点 */
    private _hideNpcIfStoryComplete(npcUid: string): void {
        const ix = this._resolved.findIndex((r) => r.npcUid === npcUid);
        if (ix < 0) return;
        const entry = this._resolved[ix];
        if (this._hasIncompleteStoryEvents(npcUid, entry.events)) return;

        const node = entry.node;
        this._resolved.splice(ix, 1);
        if (this._playerTouchingNpcUid === npcUid) {
            this._playerTouchingNpcUid = null;
        }

        if (!node?.isValid) return;

        const si = this._spawnedNpcRoots.indexOf(node);
        if (si >= 0) {
            this._spawnedNpcRoots.splice(si, 1);
            node.destroy();
            if (this.debugLog) storyLog('info', 'StoryManager: 剧情已完成，已销毁克隆 NPC', { npcUid });
            this._refreshNpcVisibility();
            this._syncNpcTaskIndicators();
            return;
        }

        node.active = false;
        const bc = node.getComponent(BoxCollider2D);
        if (bc) bc.enabled = false;
        if (this.debugLog) storyLog('info', 'StoryManager: 剧情已完成，已隐藏 NPC 节点', { npcUid });
        this._refreshNpcVisibility();
        this._syncNpcTaskIndicators();
    }

    private _pickInteractEvent(npcUid: string, events: MapNpcEvent[]): MapNpcEvent | null {
        const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const ev of sorted) {
            if (this._isQuestStepComplete(npcUid, ev)) continue;
            const reqs = ev.server?.requirements as unknown[] | undefined;
            // 首个未完成环未满足条件时不得跳到后面（如 e5 待战斗时禁止连到 e6/e8）
            if (!this._evaluateRequirements(reqs)) return null;
            return ev;
        }
        return null;
    }

    // --- NPC 发现 ---

    private _destroySpawnedNpcs(): void {
        for (let i = 0; i < this._spawnedNpcRoots.length; i++) {
            const n = this._spawnedNpcRoots[i];
            if (n?.isValid) n.destroy();
        }
        this._spawnedNpcRoots.length = 0;
    }

    private _resolveNpcs(): void {
        this._unbindNpcTouchHandlers();
        this._destroySpawnedNpcs();
        this._resolved = [];
        const scene = director.getScene();
        if (!scene) return;

        const used = new Set<Node>();
        const canvas = this._findNodeByName(scene, 'Canvas');
        const templateNpc =
            (canvas && this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC')) ?? null;
        const refRow = this._npcRows.find((r) => r.npcUid === '0_lead_01') ?? this._npcRows[0];

        const ordered = [...this._npcRows].sort((a, b) => {
            const pa = a.npcUid === '0_lead_01' ? 1 : 0;
            const pb = b.npcUid === '0_lead_01' ? 1 : 0;
            return pb - pa;
        });
        this._storyNpcOrder = ordered.map((r) => r.npcUid).filter((u): u is string => Boolean(u && typeof u === 'string'));

        let cloneStackSlot = 0;
        for (const row of ordered) {
            const npcUid = row.npcUid;
            if (!npcUid) continue;
            const events = row.events ?? [];
            let node: Node | null = null;

            if (row.nodePath?.length) {
                node = this._getChildByPath(scene, row.nodePath) ?? null;
            }
            if (!node) {
                node = this._findNodeByName(scene, npcUid);
            }
            if (!node) {
                node = this._findNodeByJsonCoord(scene, row, used);
            }
            if (!node && !this._rowHasJsonCoords(row)) {
                node = this._findNpcNodeFallback(scene, row, used);
            }
            if (node && used.has(node)) {
                node = null;
            }
            if (!node && this.spawnMissingNpcClones && templateNpc?.isValid) {
                cloneStackSlot++;
                node = this._spawnNpcFromTemplate(scene, templateNpc, row, refRow, cloneStackSlot);
            }
            if (!node && canvas && !this._rowHasJsonCoords(row)) {
                const generic = this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC');
                if (generic && !used.has(generic)) node = generic;
            }
            if (!node) {
                storyLog('warn', 'StoryManager: 未解析到 NPC 节点', { npcUid, nodePath: row.nodePath ?? '' });
                continue;
            }

            used.add(node);
            this._applyJsonNpcPosition(scene, node, row);

            if (!this.letBattleTriggerHandleCombat) {
                const battle = node.getComponent(BattleTriggerOnContact);
                if (battle) battle.enabled = false;
            }

            this._applyNpcPortraitFromRow(node, row);

            this._resolved.push({ npcUid, node, events });
            if (this.debugLog) {
                storyLog('info', 'StoryManager: NPC 已绑定', { npcUid, node: node.name, spawned: this._spawnedNpcRoots.includes(node) });
            }
        }

        this._bindNpcTouchHandlers();
        this._refreshNpcVisibility();
        this._ensureTaskStatusFramesLoaded();
    }

    private _applyNpcPortraitFromRow(root: Node, row: NpcJson): void {
        const key = row.prefabKey?.trim();
        if (key) {
            this._loadAndApplyNpcPortrait(root, key);
            return;
        }
        this._maybeRandomizeNpcPortrait(root);
    }

    /** prefabKey 如 Npc/Npc_01，对应 assets/resources/Npc/Npc_01.png */
    private _loadAndApplyNpcPortrait(root: Node, prefabKey: string): void {
        const sp = root.getComponent(Sprite) ?? root.getComponentInChildren(Sprite);
        if (!sp) return;
        const base = prefabKey.replace(/\/spriteFrame$/i, '').replace(/\.png$/i, '');
        const path = base.includes('/') ? `${base}/spriteFrame` : `Npc/${base}/spriteFrame`;
        ResourceManager.getInstance().loadAsset<SpriteFrame>(path, SpriteFrame, (err, sf) => {
            if (err || !sf || !root.isValid) {
                if (this.debugLog) {
                    storyLog('warn', 'StoryManager: NPC 立绘加载失败', { prefabKey, path, err: err?.message ?? '' });
                }
                return;
            }
            const target = root.getComponent(Sprite) ?? root.getComponentInChildren(Sprite);
            if (target?.isValid) target.spriteFrame = sf;
        });
    }

    private _maybeRandomizeNpcPortrait(root: Node): void {
        if (!this.randomizeNpcPortraits || this.randomNpcPortraitFrames.length === 0) return;
        const sp = root.getComponent(Sprite) ?? root.getComponentInChildren(Sprite);
        if (!sp) return;
        const frames = this.randomNpcPortraitFrames;
        sp.spriteFrame = frames[Math.floor(Math.random() * frames.length)] ?? sp.spriteFrame;
    }

    private _rowHasJsonCoords(row: NpcJson): boolean {
        return Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y));
    }

    /** 将 JSON 逻辑格心坐标应用到已解析的 NPC 节点（绑定模板/已有节点时同样生效） */
    private _applyJsonNpcPosition(scene: Node, node: Node, row: NpcJson): void {
        if (!this._rowHasJsonCoords(row)) return;
        const placed = this._computeJsonRowWorldPos(scene, row);
        if (!placed) return;
        node.setWorldPosition(placed.world.x, placed.world.y, placed.world.z);
        if (this.debugLog) {
            storyLog('info', 'StoryManager: NPC 已对齐 JSON 坐标', {
                npcUid: row.npcUid,
                x: row.x,
                y: row.y,
                mapW: placed.mapW,
                mapH: placed.mapH,
                localX: placed.localX,
                localY: placed.localY,
            });
        }
    }

    /** mapRoot 可用时，把 JSON 逻辑格心换算到世界坐标（与 Juben MapEditorView 埋点一致） */
    private _computeJsonRowWorldPos(
        scene: Node,
        row: NpcJson,
    ): { world: Readonly<Vec3>; mapW: number; mapH: number; localX: number; localY: number } | null {
        const pm = this._playerMove ?? scene.getComponentInChildren(PlayerGridMove);
        if (!pm?.mapRoot) return null;
        const map = pm.mapRoot;
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) return null;

        const nx = Number(row.x);
        const ny = Number(row.y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

        const b = this._mapBoundsInParentSpace(map, mapUt);
        const mapH = b.maxY - b.minY;
        const mapW = b.maxX - b.minX;
        if (mapH <= 0 || mapW <= 0) return null;

        const parent = map.parent;
        if (!parent) return null;
        const pUt = parent.getComponent(UITransform);
        if (!pUt) return null;

        const local = logicalToParentLocal(nx, ny, b, TILE_CELL);
        this._tmpV3.set(local.x, local.y, 0);
        pUt.convertToWorldSpaceAR(this._tmpV3, this._tmpWorld);
        return {
            world: this._tmpWorld,
            mapW: Math.round(mapW),
            mapH: Math.round(mapH),
            localX: Math.round(local.x),
            localY: Math.round(local.y),
        };
    }

    private _spawnNpcFromTemplate(
        scene: Node,
        template: Node,
        row: NpcJson,
        refRow: NpcJson | undefined,
        stackSlotFromTemplate: number,
    ): Node | null {
        const parent = template.parent;
        if (!parent) return null;
        const clone = instantiate(template);
        clone.name = row.npcUid ?? 'StoryNpc';
        parent.addChild(clone);

        const gapTiles = this.testStackNpcGapTiles;
        const placed = this._computeJsonRowWorldPos(scene, row);
        const hasJsonCoords = Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y));

        if (placed && hasJsonCoords) {
            clone.setWorldPosition(placed.world.x, placed.world.y, placed.world.z);
        } else if (gapTiles > 0 && stackSlotFromTemplate > 0) {
            const stepPx = gapTiles * TILE_CELL;
            clone.setPosition(
                template.position.x,
                template.position.y - stackSlotFromTemplate * stepPx,
                template.position.z,
            );
        } else if (this.spawnUseJsonDeltaFromLead && refRow) {
            const rx = Number(refRow.x);
            const ry = Number(refRow.y);
            const nx = Number(row.x);
            const ny = Number(row.y);
            if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(rx) && Number.isFinite(ry)) {
                const dx = nx - rx;
                const dy = ny - ry;
                clone.setPosition(template.position.x + dx, template.position.y - dy, template.position.z);
            }
        }

        this._spawnedNpcRoots.push(clone);
        if (this.debugLog) {
            storyLog('info', 'StoryManager: 已克隆 NPC', { npcUid: row.npcUid, parent: parent.name });
        }
        return clone;
    }

    /** 按 `父/子/孙` 名称链解析，不含场景名前缀 */
    private _getChildByPath(root: Node, path: string): Node | null {
        let cur: Node | null = root;
        for (const segment of path.split('/').map((s) => s.trim()).filter(Boolean)) {
            const next = cur?.children.find((c) => c.name === segment);
            if (!next) return null;
            cur = next;
        }
        return cur;
    }

    private _findNodeByName(root: Node, name: string): Node | null {
        const stack: Node[] = [...root.children];
        while (stack.length) {
            const n = stack.pop()!;
            if (n.name === name) return n;
            stack.push(...n.children);
        }
        return null;
    }

    private _findNodeByJsonCoord(scene: Node, row: NpcJson, used: Set<Node>): Node | null {
        const pm = this._playerMove ?? scene.getComponentInChildren(PlayerGridMove);
        if (!pm?.mapRoot) return null;
        const map = pm.mapRoot;
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) return null;

        const nx = Number(row.x);
        const ny = Number(row.y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

        const b = this._mapBoundsInParentSpace(map, mapUt);
        const mapH = b.maxY - b.minY;
        if (mapH <= 0) return null;

        const parent = map.parent;
        if (!parent) return null;
        const pUt = parent.getComponent(UITransform);
        if (!pUt) return null;

        const local = logicalToParentLocal(nx, ny, b, TILE_CELL);
        this._tmpV3.set(local.x, local.y, 0);
        pUt.convertToWorldSpaceAR(this._tmpV3, this._tmpWorld);

        let best: Node | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        const pmNode = pm.node;

        const stack: Node[] = [scene];
        while (stack.length) {
            const n = stack.pop()!;
            if (used.has(n)) continue;
            if (n !== pmNode && n.getComponent(BoxCollider2D)) {
                const w = n.worldPosition;
                const d = Math.hypot(w.x - this._tmpWorld.x, w.y - this._tmpWorld.y);
                if (d < bestD) {
                    bestD = d;
                    best = n;
                }
            }
            stack.push(...n.children);
        }

        if (best && bestD <= this.coordMatchMaxPx) return best;
        return null;
    }

    /**
     * mapRoot 未绑、节点名≠npcUid 时的兜底（本工程：Canvas/GameArea/WorldRoot/NPC）。
     * 多 NPC 共用同一节点时仅绑定第一条未占用配置，其余跳过并打 warn。
     */
    private _findNpcNodeFallback(scene: Node, row: NpcJson, used: Set<Node>): Node | null {
        const canvas = this._findNodeByName(scene, 'Canvas');
        if (canvas) {
            const byUid = this._getChildByPath(canvas, `GameArea/WorldRoot/${row.npcUid ?? ''}`);
            if (byUid && !used.has(byUid)) return byUid;
            const generic = this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC');
            if (generic && !used.has(generic)) return generic;
        }
        const wr = this._findNodeByName(scene, 'WorldRoot');
        if (!wr) return null;

        const pmNode = this._playerMove?.node ?? scene.getComponentInChildren(PlayerGridMove)?.node ?? null;
        const colliders = this._collectColliderNpcNodes(wr, pmNode).filter((n) => !used.has(n));
        if (colliders.length === 0) return null;

        const uid = row.npcUid ?? '';
        const byName = colliders.find((n) => n.name === uid);
        if (byName) return byName;

        const definedRows = this._npcRows.filter((r) => Boolean(r.npcUid)).length;
        if (definedRows === 1 && colliders.length === 1) return colliders[0];

        const nx = Number(row.x);
        const ny = Number(row.y);
        const wrUt = wr.getComponent(UITransform);
        if (!Number.isFinite(nx) || !Number.isFinite(ny) || !wrUt) {
            return colliders[0] ?? null;
        }

        let best: Node | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const nd of colliders) {
            wrUt.convertToNodeSpaceAR(nd.worldPosition, this._tmpLp);
            const lp = this._tmpLp;
            const d1 = Math.hypot(lp.x - nx, lp.y - ny);
            const d2 = Math.hypot(lp.x - nx, lp.y + ny);
            const d = Math.min(d1, d2);
            if (d < bestD) {
                bestD = d;
                best = nd;
            }
        }
        if (best && bestD <= this.coordMatchMaxPx * 3) return best;
        return null;
    }

    /** WorldRoot 下带 BoxCollider2D 的节点，排除玩家子树 */
    private _collectColliderNpcNodes(root: Node, pmNode: Node | null): Node[] {
        const out: Node[] = [];
        const walk = (n: Node) => {
            if (pmNode && this._isDescendantOf(n, pmNode)) return;
            if (n.getComponent(BoxCollider2D)) out.push(n);
            for (const c of n.children) walk(c);
        };
        walk(root);
        return out;
    }

    private _isDescendantOf(n: Node, ancestor: Node): boolean {
        let p: Node | null = n;
        while (p) {
            if (p === ancestor) return true;
            p = p.parent;
        }
        return false;
    }

    /** 与 TiledMap UITransform Content Size 一致（1584×1725 等），供 JSON 坐标换算 */
    private _mapBoundsInParentSpace(map: Node, mapUt: UITransform) {
        const bounds = mapContentBoundsInParentSpace(map.position, mapUt);
        if (this._jsonMapContentSize && this.debugLog) {
            const rw = bounds.maxX - bounds.minX;
            const rh = bounds.maxY - bounds.minY;
            if (
                Math.abs(rw - this._jsonMapContentSize.w) > 2 ||
                Math.abs(rh - this._jsonMapContentSize.h) > 2
            ) {
                storyLog('warn', 'StoryManager: JSON 地图尺寸与 TiledMap 不一致', {
                    jsonW: this._jsonMapContentSize.w,
                    jsonH: this._jsonMapContentSize.h,
                    tiledW: Math.round(rw),
                    tiledH: Math.round(rh),
                });
            }
        }
        return bounds;
    }

    // --- 玩家与范围 ---

    private _resolveLocalPlayerOnce(): void {
        const now = Date.now();
        const resolved = Boolean(this._playerMove && this._playerCollider);
        if (resolved && this._lastPlayerResolveAt > 0 && now - this._lastPlayerResolveAt < 2000) return;
        this._lastPlayerResolveAt = now;
        try {
            const scene = director.getScene?.();
            this._playerMove = scene?.getComponentInChildren(PlayerGridMove) ?? null;
            const pNode = this._playerMove?.node;
            if (pNode) {
                const box = pNode.getComponentInChildren(BoxCollider2D);
                if (box?.enabled) {
                    this._playerCollider = box as unknown as Collider2D;
                } else {
                    const cols = pNode.getComponentsInChildren(Collider2D).filter((c) => c.enabled);
                    this._playerCollider = cols[0] ?? null;
                }
            } else {
                this._playerCollider = null;
            }
        } catch {
            this._playerMove = null;
            this._playerCollider = null;
        }
    }

    private _distanceToPlayer(target: Node): number {
        if (!this._playerMove?.node) return Number.POSITIVE_INFINITY;
        const a = target.worldPosition;
        const b = this._playerMove.node.worldPosition;
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private _aabbValid(rect: { width: number; height: number } | null | undefined): boolean {
        return Boolean(rect && rect.width > 1e-6 && rect.height > 1e-6);
    }

    /**
     * NPC 触发箱与玩家碰撞体在世界空间 AABB 是否重叠。
     * @param playerAabbInflate 像素：对玩家 AABB 各边外扩，用于离开时的滞回，减少边缘抖动。
     */
    private _computeAabbOverlap(npcNode: Node, trig: Collider2D | null, playerAabbInflate = 0): boolean {
        if (!trig || !this._playerCollider) return false;
        const a = trig.worldAABB;
        const b0 = this._playerCollider.worldAABB;
        const inf = Math.max(0, playerAabbInflate);
        const b = {
            x: b0.x - inf,
            y: b0.y - inf,
            width: b0.width + 2 * inf,
            height: b0.height + 2 * inf,
        };
        if (!this._aabbValid(a) || !this._aabbValid(b)) return false;
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    private _pollTouchOverlap(): void {
        this._resolveLocalPlayerOnce();
        if (!this._playerMove?.node || this._resolved.length === 0) {
            this._playerTouchingNpcUid = null;
            this._syncInteractRangeHint(null);
            return;
        }

        const R = this.interactDistanceFallbackPx;
        const RLeave = R + this.interactReleaseHysteresisPx;
        const hy = this.interactReleaseHysteresisPx;
        let bestUid: string | null = null;
        let bestDist = Number.POSITIVE_INFINITY;

        for (const { npcUid, node } of this._resolved) {
            if (!node.isValid || !node.active) continue;
            const trig = node.getComponent(BoxCollider2D) as unknown as Collider2D | null;
            const dist = this._distanceToPlayer(node);
            const prev = this._playerTouchingNpcUid === npcUid;
            const hasNpcBox = Boolean(trig?.enabled && this._aabbValid(trig.worldAABB));
            const hasPlayerCol = Boolean(this._playerCollider?.enabled);

            let hit = false;
            if (hasNpcBox && hasPlayerCol) {
                const overlapIn = this._computeAabbOverlap(node, trig, 0);
                const overlapLeave = hy > 0 ? this._computeAabbOverlap(node, trig, hy) : overlapIn;
                hit = overlapIn || (prev && overlapLeave);
            } else {
                const withinCenter = dist <= R;
                const withinLeave = dist <= RLeave;
                if (!prev) {
                    hit = withinCenter;
                } else {
                    hit = withinLeave;
                }
            }

            if (hit && dist < bestDist) {
                bestDist = dist;
                bestUid = npcUid;
            }
        }

        const prevUid = this._playerTouchingNpcUid;
        this._playerTouchingNpcUid = bestUid;
        if (!prevUid && bestUid) {
            this._npcApproachOk = true;
        }
        if (
            this.cancelActivationOnLeaveRange &&
            this._activationNpcUid &&
            !bestUid &&
            !this.isBlocking &&
            !this._eventFlowRunning
        ) {
            this._endActivation();
            this.closeAll();
        }
        this._syncInteractRangeHint(bestUid);

        if (prevUid !== bestUid && this.debugLog) {
            storyLog('info', 'StoryManager: range', { prevUid, bestUid, bestDist });
        }
    }

    /** NPC 碰撞范围内用 ToastItem 常驻「按 E 交谈」；与剧情反馈 Tips 分离 */
    private _syncInteractRangeHint(activeNpcUid: string | null): void {
        const want = Boolean(activeNpcUid) && !this.isBlocking && !this._activationNpcUid;
        this._resolveRefs();
        if (!this._refs) return;

        if (want && this._refs.toastItem && this._refs.toastTextLabel) {
            const lab = this._label(this._refs.toastTextLabel);
            if (lab) lab.string = this.interactHintText;
            this._refs.toastItem.active = true;
            this._toastPlaying = false;
            this.unschedule(this._hideToast);
            this._interactHintPinned = true;
        } else if (this._interactHintPinned) {
            this._interactHintPinned = false;
            if (this._refs.toastItem) this._refs.toastItem.active = false;
            this._drainToastQueue();
        }
    }

    // --- 输入与事件 ---

    private _onKeyDown = (e: EventKeyboard): void => {
        this._resolveRefs();
        if (this._refs?.dialoguePanel?.active) {
            if (this._isStoryInteractKey(e.keyCode)) {
                this._advanceFromUi('key');
            }
            return;
        }
        if (this._refs?.choiceModal?.active) {
            const n = this._activeChoiceOptions.length;
            if (
                e.keyCode === KeyCode.ARROW_UP ||
                e.keyCode === KeyCode.KEY_W ||
                e.keyCode === KeyCode.DIGIT_8 ||
                e.keyCode === KeyCode.NUM_8
            ) {
                this._moveChoiceHighlight(-1);
            } else if (
                e.keyCode === KeyCode.ARROW_DOWN ||
                e.keyCode === KeyCode.KEY_S
            ) {
                this._moveChoiceHighlight(1);
            } else if (e.keyCode >= KeyCode.DIGIT_1 && e.keyCode <= KeyCode.DIGIT_6) {
                this._pickChoiceByIndex(e.keyCode - KeyCode.DIGIT_1);
            } else if (e.keyCode >= KeyCode.NUM_1 && e.keyCode <= KeyCode.NUM_6) {
                this._pickChoiceByIndex(e.keyCode - KeyCode.NUM_1);
            } else if (this._isStoryInteractKey(e.keyCode)) {
                this._pickChoiceByIndex(this._choiceHighlightIndex);
            }
            return;
        }

        if (!this._isStoryInteractKey(e.keyCode)) return;
        if (this._eventFlowRunning) return;
        if (this._activationNpcUid) return;

        const npcUid = this._playerTouchingNpcUid;
        if (!npcUid) {
            const now = Date.now();
            if (now - this._lastOutOfRangeKeyLogAt > 2000) {
                this._lastOutOfRangeKeyLogAt = now;
                const seqHint = this._getSequentialBlockHint();
                this.showToast(seqHint || '靠近 NPC 再交谈', 2000);
            }
            return;
        }

        this._tryTriggerActivation(npcUid);
    };

    // --- UI（原 StoryDialoguePlayer） ---

    private _resolveRefs(): void {
        this._refs =
            this.getComponent(StoryUIViewRefs) ??
            this.node?.getComponentInChildren(StoryUIViewRefs) ??
            null;
        if (!this._refs) {
            storyLog('error', 'StoryManager: 未找到 StoryUIViewRefs（请挂在同一节点或子节点）', {
                host: this.node?.name,
            });
        }
    }

    closeAll(): void {
        this._unbindNext();
        this._clearChoiceHandlers();
        this._script = null;
        this._onDialogueEnd = null;
        if (this._refs?.dialoguePanel) this._refs.dialoguePanel.active = false;
        if (this._refs?.choiceModal) this._refs.choiceModal.active = false;
        if (this._refs?.toastItem && !this._interactHintPinned) this._refs.toastItem.active = false;
        this.unschedule(this._hideToast);
        if (!this._interactHintPinned) {
            this._interactHintPinned = false;
        }
    }

    startDialogue(script: DialogueLineScript | unknown, onComplete?: () => void): void {
        this._resolveRefs();
        if (!this._refs) return;

        const norm = normalizeDialogueScript(script);
        const rawKeys = script && typeof script === 'object' ? Object.keys(script as object) : [];

        if (this.debugLog) {
            storyLog('info', 'StoryManager.startDialogue', {
                speaker: norm.speaker,
                linesLen: norm.lines.length,
                rawKeys,
            });
        }

        if (norm.lines.length === 0) {
            storyLog('warn', 'StoryManager.startDialogue: lines 为空', { rawKeys });
            this.closeAll();
            this.showToast('对白数据无效（无 lines）', 4000);
            return;
        }

        this.closeAll();
        this._script = norm;
        this._lineIndex = 0;
        this._onDialogueEnd = onComplete ?? null;
        if (this._refs.dialoguePanel) this._refs.dialoguePanel.active = true;
        this._applyLine();
        this._bindNext();
    }

    startChoice(choice: ChoiceScript, onPick?: (opt: ChoiceOption) => void, onClose?: () => void): void {
        this._resolveRefs();
        if (!this._refs?.choiceModal) return;
        this._clearChoiceHandlers();
        this._activeChoicePick = onPick ?? null;
        const options = (choice.options ?? []).slice(0, 6);
        if ((choice.options ?? []).length > 6) {
            this.showToast('选项超过 6 项，仅显示前 6 项', 2800);
        }
        this._activeChoiceOptions = options;
        this._choiceHighlightIndex = 0;
        if (this._refs.dialoguePanel?.active) {
            this._refs.dialoguePanel.active = false;
        }
        this._refs.choiceModal.active = true;
        const titleLab = this._label(this._refs.choiceTitleLabel);
        if (titleLab) titleLab.string = choice.title ?? '';

        const btns = [...(this._refs.choiceButtons ?? [])];
        const template = btns[0];
        const parent = template?.parent ?? this._refs.choiceModal;
        while (btns.length < options.length && template?.isValid && parent?.isValid) {
            const clone = instantiate(template);
            parent.addChild(clone);
            btns.push(clone);
            this._dynamicChoiceNodes.push(clone);
        }

        for (let i = 0; i < btns.length; i++) {
            const btnNode = btns[i];
            if (!btnNode) continue;
            const opt = options[i];
            if (!opt) {
                btnNode.active = false;
                continue;
            }
            btnNode.active = true;
            const lab = btnNode.getComponentInChildren(Label);
            if (lab) lab.string = `${i + 1}. ${opt.text}`;
            const fn = () => {
                this._refs!.choiceModal!.active = false;
                this._clearChoiceHandlers();
                onPick?.(opt);
                onClose?.();
            };
            btnNode.on(Node.EventType.TOUCH_END, fn, this);
            this._choiceHandlers.push(() => {
                if (btnNode?.isValid) btnNode.off(Node.EventType.TOUCH_END, fn, this);
            });
        }
        this._applyChoiceHighlight();

        const btnComp = this._refs.nextButton?.getComponent(Button);
        if (btnComp) btnComp.interactable = false;
    }

    private _moveChoiceHighlight(delta: number): void {
        const n = this._activeChoiceOptions.length;
        if (n <= 0) return;
        this._choiceHighlightIndex = (this._choiceHighlightIndex + delta + n) % n;
        this._applyChoiceHighlight();
    }

    private _applyChoiceHighlight(): void {
        const btns = [...(this._refs?.choiceButtons ?? []), ...this._dynamicChoiceNodes];
        for (let i = 0; i < btns.length; i++) {
            const btnNode = btns[i];
            if (!btnNode?.active) continue;
            const lab = btnNode.getComponentInChildren(Label);
            if (!lab) continue;
            const highlighted = i === this._choiceHighlightIndex;
            lab.color = highlighted ? new Color(255, 220, 120, 255) : new Color(255, 255, 255, 255);
        }
    }

    private _pickChoiceByIndex(index: number): void {
        const opt = this._activeChoiceOptions[index];
        const pick = this._activeChoicePick;
        if (!opt || !pick || !this._refs?.choiceModal?.active) return;
        this._refs.choiceModal.active = false;
        this._clearChoiceHandlers();
        pick(opt);
    }

    /** 系统 Toast（靠近 NPC 时「按 E 交谈」等）；与 ToastItem 绑定 */
    showToast(text: string, durationMs = 2500): void {
        this._toastQueue.push({ text, durationMs });
        this._drainToastQueue();
    }

    /** 剧情反馈（完成任务、选项 systemTip 等）；绑定 GameArea/Tips，与 ToastItem 分离 */
    showStoryTip(text: string, durationMs = 2500): void {
        this._storyTipsQueue.push({ text, durationMs });
        this._drainStoryTipsQueue();
    }

    private _drainToastQueue(): void {
        if (this._toastPlaying || this._interactHintPinned) return;
        const item = this._toastQueue.shift();
        if (!item) return;
        this._resolveRefs();
        if (!this._refs?.toastItem || !this._refs.toastTextLabel) return;
        this._toastPlaying = true;
        const lab = this._label(this._refs.toastTextLabel);
        if (lab) lab.string = item.text;
        this._refs.toastItem.active = true;
        this.unschedule(this._hideToast);
        this.scheduleOnce(this._hideToast, item.durationMs / 1000);
    }

    private _hideToast = (): void => {
        if (this._refs?.toastItem) this._refs.toastItem.active = false;
        this._toastPlaying = false;
        if (!this._interactHintPinned) {
            this._drainToastQueue();
        }
    };

    private _drainStoryTipsQueue(): void {
        if (this._storyTipsPlaying) return;
        const item = this._storyTipsQueue.shift();
        if (!item) return;
        this._resolveRefs();
        const panel = this._refs?.storyTipsPanel;
        if (!panel) return;
        const lab = this._label(this._refs?.storyTipsLabel ?? panel);
        if (lab) lab.string = item.text;
        panel.active = true;
        this._storyTipsPlaying = true;
        this.unschedule(this._hideStoryTip);
        this.scheduleOnce(this._hideStoryTip, item.durationMs / 1000);
    }

    private _hideStoryTip = (): void => {
        if (this._refs?.storyTipsPanel) this._refs.storyTipsPanel.active = false;
        this._storyTipsPlaying = false;
        this._drainStoryTipsQueue();
    };

    private _label(n: Node | null): Label | null {
        if (!n) return null;
        return n.getComponent(Label) ?? n.getComponentInChildren(Label);
    }

    private _applyLine(): void {
        if (!this._refs || !this._script) return;
        const lines = this._script.lines ?? [];
        const sp = this._label(this._refs.dialogueSpeakerLabel);
        const tx = this._label(this._refs.dialogueTextLabel);
        const total = lines.length;
        const progress = total > 1 ? ` (${this._lineIndex + 1}/${total})` : '';
        if (sp) sp.string = this._script.speaker ?? '';
        if (tx) tx.string = (lines[this._lineIndex] ?? '') + progress;
    }

    private _bindNext(): void {
        if (this._nextBound || !this._refs?.nextButton) return;
        const nb = this._refs.nextButton;
        const btnComp = nb.getComponent(Button);
        if (btnComp) {
            btnComp.node.on(Button.EventType.CLICK, this._onNextClickBound, this);
        }
        nb.on(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
        this._nextBound = true;
    }

    private _unbindNext(): void {
        if (!this._refs?.nextButton) {
            this._nextBound = false;
            return;
        }
        if (this._nextBound) {
            const nb = this._refs.nextButton;
            if (nb?.isValid) {
                const btnComp = nb.getComponent(Button);
                if (btnComp?.node?.isValid) {
                    btnComp.node.off(Button.EventType.CLICK, this._onNextClickBound, this);
                }
                nb.off(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
            }
        }
        this._nextBound = false;
    }

    private _onNextClickBound = (): void => {
        this._advanceFromUi('click');
    };

    private _onNextTouchBound = (e: EventTouch): void => {
        e.propagationStopped = true;
        this._advanceFromUi('touch');
    };

    private _advanceFromUi(source: 'click' | 'touch' | 'key'): void {
        const now = Date.now();
        if (now - this._lastAdvanceWallMs < StoryManager._ADVANCE_DEBOUNCE_MS) {
            return;
        }
        this._lastAdvanceWallMs = now;
        if (this.debugLog) storyLog('info', 'StoryManager._advanceFromUi', { source });
        this._advanceLine();
    }

    private _advanceLine(): void {
        if (!this._script) return;
        const lines = this._script.lines ?? [];
        const linesLen = lines.length;
        if (this.debugLog) {
            storyLog('info', 'StoryManager._advanceLine', {
                lineIndex: this._lineIndex,
                linesLen,
                willClose: !(this._lineIndex < linesLen - 1),
            });
        }

        if (this._lineIndex < linesLen - 1) {
            this._lineIndex++;
            this._applyLine();
            return;
        }
        this._unbindNext();
        if (this._refs?.dialoguePanel) this._refs.dialoguePanel.active = false;
        const cb = this._onDialogueEnd;
        this._script = null;
        this._onDialogueEnd = null;
        cb?.();
    }

    private _clearChoiceHandlers(): void {
        for (const u of this._choiceHandlers) u();
        this._choiceHandlers = [];
        for (const n of this._dynamicChoiceNodes) {
            if (n?.isValid) n.destroy();
        }
        this._dynamicChoiceNodes.length = 0;
        this._activeChoicePick = null;
        this._activeChoiceOptions = [];
        this._choiceHighlightIndex = 0;
        const btnComp = this._refs?.nextButton?.getComponent(Button);
        if (btnComp) btnComp.interactable = true;
    }
}
