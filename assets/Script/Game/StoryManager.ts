/**
 * 剧情中枢：解析 map JSON、零挂载发现 NPC、范围检测、驱动 StoryUIViewRefs。
 * 与 StoryUIViewRefs 挂在同一节点（如 CanvasRoot(UI)），并绑定同一份 mapConfig JsonAsset。
 *
 * 编辑器说明：若从 MapNpcInteract 迁移，请把本组件挂到 CanvasRoot(UI)，拖入 mapConfig，
 * 并从 NPC 节点移除旧 MapNpcInteract；场景里原组件槽位可复用同一 UUID（已由工程处理）。
 */
import {
    _decorator,
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
    Sprite,
    SpriteFrame,
    UITransform,
    v3,
    Vec3,
} from 'cc';
import { PlayerGridMove } from './GameArea/PlayerGridMove';
import { BattleTriggerOnContact } from './GameArea/BattleTriggerOnContact';
import { StoryUIViewRefs } from './StoryUIViewRefs';
import { WebSocketManager } from '../global/WebSocketManager';
import { BattleScene } from './BattleScene';

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
const TILE_CELL = 48;

export type DialogueLineScript = { speaker: string; lines: string[] };

export type ChoiceOption = {
    id: string;
    text: string;
    npcReply?: string;
    systemTip?: string;
    forcedResult?: string;
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

type MapNpcEvent = {
    eventId?: string;
    eventType?: string;
    order?: number;
    server?: { requirements?: unknown[]; battleRef?: string; effects?: unknown[] };
    client?: {
        dialogueScriptId?: string;
        choiceScriptId?: string;
        taskUiHint?: string;
    };
};

type NpcJson = {
    npcUid?: string;
    npcName?: string;
    prefabKey?: string;
    x?: number;
    y?: number;
    /** 可选：从场景根的路径，如 Game/MapRoot/NPCs/Hanno */
    nodePath?: string;
    events?: MapNpcEvent[];
};

@ccclass('StoryManager')
@executionOrder(-50)
export class StoryManager extends Component {
    @property(JsonAsset)
    mapConfig: JsonAsset | null = null;

    @property({ tooltip: '本地调试：忽略 map JSON 里 server.requirements' })
    skipServerRequirements = false;

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
    interactHintText = '按 E / 回车 / 空格 交谈';

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
     * 本地测试：>0 时克隆 NPC 从场景模板（WorldRoot/NPC）起沿父节点本地 Y 轴依次向下每隔「该格数×48px」摆放；
     * 0 表示关闭，仍按 mapRoot 世界坐标或 JSON 相对韩诺偏移摆放。
     */
    @property
    testStackNpcGapTiles = 2;

    @property({ type: [SpriteFrame], tooltip: '非空时可为每个 NPC 节点随机一张立绘（Sprite 在本节点或子节点）' })
    randomNpcPortraitFrames: SpriteFrame[] = [];

    @property({ type: Node, tooltip: 'BattleScene 根节点（剧情战斗）' })
    battleRoot: Node | null = null;

    @property({ tooltip: '地图 code，与 JSON mapCode 一致' })
    mapCode = 'test_base';

    private _refs: StoryUIViewRefs | null = null;
    private _dialogueScripts: Record<string, DialogueLineScript> = {};
    private _choiceScripts: Record<string, ChoiceScript> = {};
    private _npcRows: NpcJson[] = [];

    private _resolved: Array<{ npcUid: string; node: Node; events: MapNpcEvent[] }> = [];
    /** 由 StoryManager 克隆的节点，onDestroy / 重新解析时销毁 */
    private readonly _spawnedNpcRoots: Node[] = [];
    /** 与 _resolveNpcs 中 ordered 一致，用于逐个显示 NPC */
    private _storyNpcOrder: string[] = [];
    private _playerMove: PlayerGridMove | null = null;
    private _playerCollider: Collider2D | null = null;
    private _lastPlayerResolveAt = 0;

    private _playerTouchingNpcUid: string | null = null;
    /** 玩家在 NPC 碰撞箱内时，用 toast 槽位常驻显示 interactHintText（离开或打开对白时收起） */
    private _interactRangeToastPinned = false;
    private _lastOutOfRangeKeyLogAt = 0;

    private readonly _localCompletedEventIds = new Set<string>();
    private _serverCompletedEventIds = new Set<string>();
    private _storyStateLoaded = false;
    private _ws: WebSocketManager | null = null;
    private _activeTasks: Array<{ taskId: number; status: string }> = [];
    private _mainlineStep = 0;

    private _lineIndex = 0;
    private _script: DialogueLineScript | null = null;
    private _onDialogueEnd: (() => void) | null = null;
    private _nextBound = false;
    private _choiceHandlers: Array<() => void> = [];
    private _lastAdvanceWallMs = 0;
    private static readonly _ADVANCE_DEBOUNCE_MS = 90;

    private readonly _tmpV3 = v3();
    private readonly _tmpWorld = v3();
    private readonly _tmpLp = v3();

    onLoad(): void {
        this._resolveRefs();
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        this._parseMap();
        this._resolveLocalPlayerOnce();
        this._resolveNpcs();
        if (this.debugLog) {
            storyLog('info', 'StoryManager.onLoad', {
                host: this.node?.name,
                npcResolved: this._resolved.length,
                hasMap: Boolean(this.mapConfig?.json),
            });
        }
    }

    start(): void {
        this._resolveRefs();
        this._resolveLocalPlayerOnce();
        this._resolveNpcs();
        this.scheduleOnce(() => {
            this._resolveLocalPlayerOnce();
            this._resolveNpcs();
            this._fetchStoryStateFromServer();
        }, 0);
    }

    /** 供 TaskTracker 读取 */
    public getStoryTaskSnapshot(): { mainlineStep: number; tasks: Array<{ taskId: number; status: string }> } {
        return { mainlineStep: this._mainlineStep, tasks: [...this._activeTasks] };
    }

    private _fetchStoryStateFromServer(): void {
        if (this.skipServerRequirements) return;
        this._ws = WebSocketManager.getInstance();
        if (!this._ws?.getCharacterId?.()) return;
        this._ws.request(
            'story_get_state',
            { map_code: this.mapCode },
            (resp: any) => {
                if (!resp?.success) return;
                const d = resp.data || resp;
                const ids: string[] = d.completed_event_ids || [];
                this._serverCompletedEventIds = new Set(ids);
                for (const id of ids) this._localCompletedEventIds.add(id);
                this._activeTasks = d.active_tasks || d.tasks || [];
                this._mainlineStep = Number(d.mainline_step || 0);
                this._storyStateLoaded = true;
                this._syncSequentialNpcVisibility();
                this.node.emit('story_state_updated', d);
            },
            true,
            8000,
        );
    }

    private _isEventDone(eventId: string): boolean {
        return this._localCompletedEventIds.has(eventId) || this._serverCompletedEventIds.has(eventId);
    }

    private _serverCompleteEvent(
        eventId: string,
        opts?: { battleWon?: boolean; choiceId?: string },
        onDone?: () => void,
    ): void {
        if (this.skipServerRequirements) {
            onDone?.();
            return;
        }
        const ws = this._ws || WebSocketManager.getInstance();
        ws.request(
            'story_event_complete',
            {
                map_code: this.mapCode,
                event_id: eventId,
                battle_won: opts?.battleWon !== false,
                choice_id: opts?.choiceId,
            },
            (resp: any) => {
                if (!resp?.success) {
                    this.showToast(resp?.message || '剧情同步失败', 2800);
                    return;
                }
                const d = resp.data || resp;
                const ids: string[] = d.completed_event_ids || [];
                this._serverCompletedEventIds = new Set(ids);
                for (const id of ids) this._localCompletedEventIds.add(id);
                this._activeTasks = d.active_tasks || d.tasks || [];
                this._mainlineStep = Number(d.mainline_step || 0);
                this.node.emit('story_state_updated', d);
                onDone?.();
            },
            true,
            10000,
        );
    }

    private _serverInteract(
        npcUid: string,
        ev: MapNpcEvent,
        choiceId: string | undefined,
        onAllowed: (payload: any) => void,
    ): void {
        const eventId = this._stableEventId(npcUid, ev);
        if (this.skipServerRequirements) {
            onAllowed({ action: ev.eventType });
            return;
        }
        const ws = this._ws || WebSocketManager.getInstance();
        ws.request(
            'story_interact',
            { map_code: this.mapCode, event_id: eventId, npc_uid: npcUid, choice_id: choiceId },
            (resp: any) => {
                if (!resp?.success) {
                    this.showToast(resp?.message || '无法推进剧情', 2800);
                    return;
                }
                onAllowed(resp.data || resp);
            },
            true,
            8000,
        );
    }

    private _runEventFlow(npcUid: string, ev: MapNpcEvent): void {
        const client = ev.client ?? {};
        const eventId = this._stableEventId(npcUid, ev);

        this._serverInteract(npcUid, ev, undefined, (payload) => {
            const action = payload?.action || ev.eventType;
            if (action === 'battle' || action === 'choice_then_battle' || ev.eventType === 'battle') {
                if (action === 'choice_then_battle' && client.choiceScriptId) {
                    const ch = this._choiceScripts[client.choiceScriptId];
                    if (ch) {
                        this.startChoice(
                            ch,
                            (opt) => this._startStoryBattle(npcUid, ev, opt?.id),
                        );
                        return;
                    }
                }
                this._startStoryBattle(npcUid, ev);
                return;
            }
            if (ev.eventType === 'dialog' && client.dialogueScriptId) {
                const scr = this._dialogueScripts[client.dialogueScriptId];
                if (scr) {
                    this.startDialogue(scr, () => {
                        this._serverCompleteEvent(eventId, {}, () => this._markEventDone(npcUid, ev));
                    });
                    return;
                }
            }
            if (client.choiceScriptId) {
                const ch = this._choiceScripts[client.choiceScriptId];
                if (ch) {
                    this.startChoice(
                        ch,
                        (opt) => {
                            this._serverInteract(npcUid, ev, opt?.id, () => {
                                this._serverCompleteEvent(eventId, { choiceId: opt?.id }, () =>
                                    this._markEventDone(npcUid, ev),
                                );
                            });
                        },
                    );
                    return;
                }
            }
            if (ev.eventType === 'task' && client.taskUiHint) {
                this.showToast(client.taskUiHint, 3200);
                this._serverCompleteEvent(eventId, {}, () => this._markEventDone(npcUid, ev));
                return;
            }
            this.showToast(`未接入的 NPC 事件: ${ev.eventType ?? 'unknown'}`, 3200);
            this._serverCompleteEvent(eventId, {}, () => this._markEventDone(npcUid, ev));
        });
    }

    private _startStoryBattle(npcUid: string, ev: MapNpcEvent, _choiceId?: string): void {
        const eventId = this._stableEventId(npcUid, ev);
        const battleRef = ev.server?.battleRef || 'battle_300001';
        const root = this.battleRoot;
        const battle = root?.getComponent(BattleScene);
        if (!battle) {
            this.showToast('未配置 BattleScene，无法进入剧情战', 3000);
            return;
        }
        battle.startStoryBattle({
            mapCode: this.mapCode,
            eventId,
            battleRef,
            onFinished: (won) => {
                if (!won) {
                    this.showToast('战斗失败', 2400);
                    return;
                }
                this._serverCompleteEvent(eventId, { battleWon: true }, () => this._markEventDone(npcUid, ev));
            },
        });
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        this._unbindNext();
        this._clearChoiceHandlers();
        this.unschedule(this._hideToast);
        this._destroySpawnedNpcs();
    }

    update(): void {
        this._pollTouchOverlap();
    }

    get isBlocking(): boolean {
        const d = this._refs?.dialoguePanel?.active ?? false;
        const c = this._refs?.choiceModal?.active ?? false;
        return d || c;
    }

    // --- map ---

    private _parseMap(): void {
        const raw = this.mapConfig?.json as Record<string, unknown> | null;
        if (!raw) {
            if (this.debugLog) storyLog('warn', 'StoryManager._parseMap: mapConfig 为空', {});
            return;
        }
        const client = (raw.client ?? {}) as Record<string, unknown>;
        this._dialogueScripts = (client.dialogueScripts ?? {}) as Record<string, DialogueLineScript>;
        this._choiceScripts = (client.choiceScripts ?? {}) as Record<string, ChoiceScript>;
        this._npcRows = (raw.npcs ?? []) as NpcJson[];

        const server = (raw.server ?? {}) as Record<string, unknown>;
        const anti = (server.antiCheat ?? {}) as Record<string, unknown>;
        const maxD = Number(anti.maxInteractDistance);
        if (Number.isFinite(maxD) && maxD > 0) {
            this.interactDistanceFallbackPx = Math.min(this.interactDistanceFallbackPx, maxD);
        }
    }

    private _requirementsMet(reqs: unknown[] | undefined): boolean {
        if (this.skipServerRequirements) return true;
        if (!reqs?.length) return true;
        return true;
    }

    private _stableEventId(npcUid: string, ev: MapNpcEvent): string {
        if (ev.eventId) return ev.eventId;
        return `${npcUid}#order_${ev.order ?? 0}`;
    }

    private _markEventDone(npcUid: string, ev: MapNpcEvent): void {
        this._localCompletedEventIds.add(this._stableEventId(npcUid, ev));
        if (this.debugLog) {
            storyLog('info', 'StoryManager: 事件已完成', {
                npcUid,
                eventId: this._stableEventId(npcUid, ev),
                eventType: ev.eventType,
            });
        }
        if (this.hideNpcWhenStoryComplete) {
            this._hideNpcIfStoryComplete(npcUid);
        }
        this._syncSequentialNpcVisibility();
    }

    /** 顺序显示：仅当前应推进的一名 NPC 节点 active，其余在 _resolved 中的先隐藏 */
    private _syncSequentialNpcVisibility(): void {
        if (!this.sequentialStoryNpcReveal) {
            for (const { node } of this._resolved) {
                if (!node?.isValid) continue;
                node.active = true;
                const bc = node.getComponent(BoxCollider2D);
                if (bc) bc.enabled = true;
            }
            return;
        }

        let currentUid: string | null = null;
        let currentNode: Node | null = null;
        for (const uid of this._storyNpcOrder) {
            const entry = this._resolved.find((r) => r.npcUid === uid);
            if (!entry) continue;
            if (this._pickInteractEvent(uid, entry.events) !== null) {
                currentUid = uid;
                currentNode = entry.node;
                break;
            }
        }

        for (const { npcUid, node } of this._resolved) {
            if (!node?.isValid) continue;
            if (currentUid === null) {
                node.active = false;
                const bc0 = node.getComponent(BoxCollider2D);
                if (bc0) bc0.enabled = false;
                continue;
            }
            const isCurrent = npcUid === currentUid;
            const isAncestorOfCurrent =
                currentNode !== null && node !== currentNode && this._isDescendantOf(currentNode, node);
            const show = isCurrent || isAncestorOfCurrent;
            node.active = show;
            const bc = node.getComponent(BoxCollider2D);
            if (bc) bc.enabled = isCurrent;
        }

        if (this.debugLog) {
            storyLog('info', 'StoryManager: 顺序可见性', { currentUid, resolved: this._resolved.map((r) => r.npcUid) });
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

    /** 该 npcUid 下已无未完成事件时，隐藏或销毁对应场景节点 */
    private _hideNpcIfStoryComplete(npcUid: string): void {
        const ix = this._resolved.findIndex((r) => r.npcUid === npcUid);
        if (ix < 0) return;
        const entry = this._resolved[ix];
        if (this._pickInteractEvent(npcUid, entry.events) !== null) return;

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
            return;
        }

        node.active = false;
        const bc = node.getComponent(BoxCollider2D);
        if (bc) bc.enabled = false;
        if (this.debugLog) storyLog('info', 'StoryManager: 剧情已完成，已隐藏 NPC 节点', { npcUid });
    }

    private _pickInteractEvent(npcUid: string, events: MapNpcEvent[]): MapNpcEvent | null {
        const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const ev of sorted) {
            const reqs = ev.server?.requirements as unknown[] | undefined;
            if (!this._requirementsMet(reqs)) continue;
            const eid = this._stableEventId(npcUid, ev);
            if (this._isEventDone(eid)) continue;
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
            if (!node) {
                node = this._findNpcNodeFallback(scene, row, used);
            }
            if (node && used.has(node)) {
                node = null;
            }
            if (!node && this.spawnMissingNpcClones && templateNpc?.isValid) {
                cloneStackSlot++;
                node = this._spawnNpcFromTemplate(scene, templateNpc, row, refRow, cloneStackSlot);
            }
            if (!node && canvas) {
                const generic = this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC');
                if (generic && !used.has(generic)) node = generic;
            }
            if (!node) {
                storyLog('warn', 'StoryManager: 未解析到 NPC 节点', { npcUid, nodePath: row.nodePath ?? '' });
                continue;
            }

            used.add(node);

            if (!this.letBattleTriggerHandleCombat) {
                const battle = node.getComponent(BattleTriggerOnContact);
                if (battle) battle.enabled = false;
            }

            this._maybeRandomizeNpcPortrait(node);

            this._resolved.push({ npcUid, node, events });
            if (this.debugLog) {
                storyLog('info', 'StoryManager: NPC 已绑定', { npcUid, node: node.name, spawned: this._spawnedNpcRoots.includes(node) });
            }
        }

        this._syncSequentialNpcVisibility();
    }

    private _maybeRandomizeNpcPortrait(root: Node): void {
        if (!this.randomizeNpcPortraits || this.randomNpcPortraitFrames.length === 0) return;
        const sp = root.getComponent(Sprite) ?? root.getComponentInChildren(Sprite);
        if (!sp) return;
        const frames = this.randomNpcPortraitFrames;
        sp.spriteFrame = frames[Math.floor(Math.random() * frames.length)] ?? sp.spriteFrame;
    }

    /** mapRoot 可用时，把 JSON 像素格心换算到世界坐标（与 _findNodeByJsonCoord 一致） */
    private _computeJsonRowWorldPos(scene: Node, row: NpcJson): Readonly<Vec3> | null {
        const pm = this._playerMove ?? scene.getComponentInChildren(PlayerGridMove);
        if (!pm?.mapRoot) return null;
        const map = pm.mapRoot;
        const mapUt = map.getComponent(UITransform);
        if (!mapUt) return null;

        const nx = Number(row.x);
        const ny = Number(row.y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

        const col = Math.floor(nx / TILE_CELL);
        const rowIdx = Math.floor(ny / TILE_CELL);
        const m = this._mapGridMetrics(pm, map, mapUt);
        if (m.cols <= 0 || m.rows <= 0) return null;
        const lx = m.originX + (Math.min(m.cols - 1, Math.max(0, col)) + 0.5) * TILE_CELL;
        const ly = pm.useAnchorAsGridOrigin
            ? m.originY - (Math.min(m.rows - 1, Math.max(0, rowIdx)) + 0.5) * TILE_CELL
            : m.originY + (Math.min(m.rows - 1, Math.max(0, rowIdx)) + 0.5) * TILE_CELL;

        const parent = map.parent;
        if (!parent) return null;
        const pUt = parent.getComponent(UITransform);
        if (!pUt) return null;

        this._tmpV3.set(lx, ly, 0);
        pUt.convertToWorldSpaceAR(this._tmpV3, this._tmpWorld);
        return this._tmpWorld;
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
        if (gapTiles > 0 && stackSlotFromTemplate > 0) {
            const stepPx = gapTiles * TILE_CELL;
            clone.setPosition(
                template.position.x,
                template.position.y - stackSlotFromTemplate * stepPx,
                template.position.z,
            );
        } else {
            const wp = this._computeJsonRowWorldPos(scene, row);
            if (wp) {
                clone.setWorldPosition(wp.x, wp.y, wp.z);
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

        const col = Math.floor(nx / TILE_CELL);
        const rowIdx = Math.floor(ny / TILE_CELL);
        const m = this._mapGridMetrics(pm, map, mapUt);
        if (m.cols <= 0 || m.rows <= 0) return null;
        const lx = m.originX + (Math.min(m.cols - 1, Math.max(0, col)) + 0.5) * TILE_CELL;
        const ly = pm.useAnchorAsGridOrigin
            ? m.originY - (Math.min(m.rows - 1, Math.max(0, rowIdx)) + 0.5) * TILE_CELL
            : m.originY + (Math.min(m.rows - 1, Math.max(0, rowIdx)) + 0.5) * TILE_CELL;

        const parent = map.parent;
        if (!parent) return null;
        const pUt = parent.getComponent(UITransform);
        if (!pUt) return null;

        this._tmpV3.set(lx, ly, 0);
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

    private _mapGridMetrics(pm: PlayerGridMove, map: Node, mapUt: UITransform) {
        const b = this._mapBoundsInParentSpace(map, mapUt);
        const originX = pm.useAnchorAsGridOrigin ? map.position.x : b.minX;
        const originY = pm.useAnchorAsGridOrigin ? map.position.y : b.minY;
        const cols = pm.useAnchorAsGridOrigin
            ? Math.floor((b.maxX - originX) / TILE_CELL)
            : Math.floor((b.maxX - b.minX) / TILE_CELL);
        const rows = pm.useAnchorAsGridOrigin
            ? Math.floor((originY - b.minY) / TILE_CELL)
            : Math.floor((b.maxY - b.minY) / TILE_CELL);
        return { originX, originY, cols, rows };
    }

    /** 与 PlayerGridMove._mapBoundsInParentSpace 对齐，供 JSON 坐标换算 */
    private _mapBoundsInParentSpace(map: Node, mapUt: UITransform) {
        const parentUt = map.parent?.getComponent(UITransform);
        const tmp = this._tmpV3;
        if (!parentUt) {
            const w = mapUt.width;
            const h = mapUt.height;
            const left = map.position.x - mapUt.anchorX * w;
            const right = left + w;
            const bottom = map.position.y - mapUt.anchorY * h;
            const top = bottom + h;
            return { minX: left, maxX: right, minY: bottom, maxY: top };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const updateByNode = (n: Node) => {
            const ut = n.getComponent(UITransform);
            if (!ut) return;
            const w = ut.width;
            const h = ut.height;
            const l = -ut.anchorX * w;
            const r = (1 - ut.anchorX) * w;
            const b = -ut.anchorY * h;
            const t = (1 - ut.anchorY) * h;
            const corners = [
                { x: l, y: b },
                { x: r, y: b },
                { x: l, y: t },
                { x: r, y: t },
            ];
            for (let i = 0; i < corners.length; i++) {
                tmp.set(corners[i].x, corners[i].y, 0);
                ut.convertToWorldSpaceAR(tmp, tmp);
                parentUt.convertToNodeSpaceAR(tmp, tmp);
                minX = Math.min(minX, tmp.x);
                maxX = Math.max(maxX, tmp.x);
                minY = Math.min(minY, tmp.y);
                maxY = Math.max(maxY, tmp.y);
            }
        };
        const stack: Node[] = [map];
        while (stack.length > 0) {
            const n = stack.pop()!;
            updateByNode(n);
            for (let i = 0; i < n.children.length; i++) {
                stack.push(n.children[i]);
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            const w = mapUt.width;
            const h = mapUt.height;
            const left = map.position.x - mapUt.anchorX * w;
            const right = left + w;
            const bottom = map.position.y - mapUt.anchorY * h;
            const top = bottom + h;
            return { minX: left, maxX: right, minY: bottom, maxY: top };
        }
        return { minX, maxX, minY, maxY };
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
        this._syncInteractRangeHint(bestUid);

        if (prevUid !== bestUid && this.debugLog) {
            storyLog('info', 'StoryManager: range', { prevUid, bestUid, bestDist });
        }
    }

    /** 在 NPC 碰撞范围内常驻显示交互提示（使用 toast 节点，不收自动消失计时） */
    private _syncInteractRangeHint(activeNpcUid: string | null): void {
        const want = Boolean(activeNpcUid) && !this.isBlocking;
        this._resolveRefs();
        if (!this._refs?.toastItem || !this._refs.toastTextLabel) return;

        if (want) {
            const lab = this._label(this._refs.toastTextLabel);
            if (lab) lab.string = this.interactHintText;
            this._refs.toastItem.active = true;
            this.unschedule(this._hideToast);
            this._interactRangeToastPinned = true;
        } else if (this._interactRangeToastPinned) {
            this._interactRangeToastPinned = false;
            this._refs.toastItem.active = false;
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
            return;
        }

        if (!this._isStoryInteractKey(e.keyCode)) return;

        const npcUid = this._playerTouchingNpcUid;
        if (!npcUid) {
            const now = Date.now();
            if (this.debugLog && now - this._lastOutOfRangeKeyLogAt > 2000) {
                this._lastOutOfRangeKeyLogAt = now;
                storyLog('info', 'StoryManager: 按交互键但不在任何 NPC 范围内', {});
            }
            return;
        }

        const entry = this._resolved.find((x) => x.npcUid === npcUid);
        if (!entry) return;

        const ev = this._pickInteractEvent(npcUid, entry.events);
        if (!ev) {
            if (this.debugLog) {
                storyLog('info', 'StoryManager: 无可推进事件', { npcUid });
            }
            return;
        }
        this._runEventFlow(npcUid, ev);
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
        if (this._refs?.toastItem) this._refs.toastItem.active = false;
        this.unschedule(this._hideToast);
        this._interactRangeToastPinned = false;
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
        if (this._refs.dialoguePanel?.active) {
            this._refs.dialoguePanel.active = false;
        }
        this._refs.choiceModal.active = true;
        const titleLab = this._label(this._refs.choiceTitleLabel);
        if (titleLab) titleLab.string = choice.title ?? '';

        const btns = this._refs.choiceButtons ?? [];
        for (let i = 0; i < btns.length; i++) {
            const btnNode = btns[i];
            if (!btnNode) continue;
            const opt = choice.options[i];
            if (!opt) {
                btnNode.active = false;
                continue;
            }
            btnNode.active = true;
            const lab = btnNode.getComponentInChildren(Label);
            if (lab) lab.string = opt.text;
            const fn = () => {
                this._refs!.choiceModal!.active = false;
                this._clearChoiceHandlers();
                onPick?.(opt);
                if (opt.npcReply) this.showToast(opt.npcReply, 3500);
                if (opt.systemTip) this.showToast(opt.systemTip, 3500);
                onClose?.();
            };
            btnNode.on(Node.EventType.TOUCH_END, fn, this);
            this._choiceHandlers.push(() => btnNode.off(Node.EventType.TOUCH_END, fn, this));
        }

        const btnComp = this._refs.nextButton?.getComponent(Button);
        if (btnComp) btnComp.interactable = false;
    }

    showToast(text: string, durationMs = 2500): void {
        this._resolveRefs();
        if (!this._refs?.toastItem || !this._refs.toastTextLabel) return;
        const lab = this._label(this._refs.toastTextLabel);
        if (lab) lab.string = text;
        this._refs.toastItem.active = true;
        this.unschedule(this._hideToast);
        this._interactRangeToastPinned = false;
        this.scheduleOnce(this._hideToast, durationMs / 1000);
    }

    private _hideToast = (): void => {
        if (this._refs?.toastItem) this._refs.toastItem.active = false;
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
        if (sp) sp.string = this._script.speaker ?? '';
        if (tx) tx.string = lines[this._lineIndex] ?? '';
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
            const btnComp = nb.getComponent(Button);
            if (btnComp?.node) {
                btnComp.node.off(Button.EventType.CLICK, this._onNextClickBound, this);
            }
            nb.off(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
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
        const btnComp = this._refs?.nextButton?.getComponent(Button);
        if (btnComp) btnComp.interactable = true;
    }
}
