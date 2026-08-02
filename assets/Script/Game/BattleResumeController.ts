import { _decorator, Component, Node, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import {
    applyResumeAfterRestore,
    beginResume,
    cachePendingResume,
    cancelDebounced,
    clearPendingResume,
    createBattleResumeGate,
    createDebounceSchedule,
    createPendingResumeCache,
    endResume,
    forceClearInFlight,
    invalidateForCharacterChange,
    isPendingResumeStillValid,
    isResumeResponseAcceptable,
    RESUME_DEBOUNCE_MS,
    scheduleDebounced,
    shouldOpenBattlePanel,
    type BattleResumeGate,
    type BattleRoomStateLike,
    type DebounceSchedule,
    type PendingResumeCache,
} from './battle-resume-gate';
import type { BattleScene } from './BattleScene';

const { ccclass } = _decorator;

/**
 * 战斗自动恢复唯一入口（生产组件）。
 * - boot / auth / 选角 / 重连 / game_ids_saved → scheduleCheck（debounce 合并）
 * - 同一时刻仅一个 resume；generation + 角色门控丢弃旧响应
 * - 恢复成功后才 markRoomApplied；无房间 / 失败 → 不创建新房间
 */
@ccclass('BattleResumeController')
export class BattleResumeController extends Component {
    private static _instance: BattleResumeController | null = null;
    private static _instanceNode: Node | null = null;

    private _ws: WebSocketManager | null = null;
    private _gate: BattleResumeGate = createBattleResumeGate();
    private _pendingCache: PendingResumeCache = createPendingResumeCache();
    private _debounce: DebounceSchedule = createDebounceSchedule();
    private _battleScene: BattleScene | null = null;
    private _started = false;

    /** 测试/观测：最近一次 debounce 合并的原因 */
    public lastMergedReasons: string[] = [];

    public static getInstance(): BattleResumeController {
        if (this._instance && this._instance.isValid) {
            return this._instance;
        }
        const node = new Node('BattleResumeController');
        const comp = node.addComponent(BattleResumeController);
        director.addPersistRootNode(node);
        this._instance = comp;
        this._instanceNode = node;
        return comp;
    }

    onLoad(): void {
        if (BattleResumeController._instance && BattleResumeController._instance !== this) {
            this.destroy();
            return;
        }
        BattleResumeController._instance = this;
        BattleResumeController._instanceNode = this.node;
        this._ws = WebSocketManager.getInstance();
        this._bind();
        this._started = true;
        this.scheduleCheck('boot');
    }

    onDestroy(): void {
        cancelDebounced(this._debounce);
        forceClearInFlight(this._gate);
        clearPendingResume(this._pendingCache);
        this._unbind();
        if (BattleResumeController._instance === this) {
            BattleResumeController._instance = null;
            BattleResumeController._instanceNode = null;
        }
    }

    /** BattleScene 自注册；若有缓存 state 则尝试应用 */
    public registerBattleScene(scene: BattleScene): void {
        this._battleScene = scene;
        this._tryApplyPending('register_battle_scene');
    }

    public unregisterBattleScene(scene: BattleScene): void {
        if (this._battleScene === scene) {
            this._battleScene = null;
        }
    }

    /**
     * 房间确已结束（finished / 逃跑确认 / 销毁 / 完成事件）时清除已恢复标记。
     * 普通关闭面板不得调用此方法。
     */
    public notifyRoomFinished(roomId: string): void {
        const last = this._gate.lastAppliedRoomId;
        if (!roomId || (last && last !== roomId)) {
            // 仍允许清空：服务端可能已换房；以显式 finished 为准
        }
        this._gate.lastAppliedRoomId = null;
        console.log(`[BattleResume] notifyRoomFinished room_id=${roomId}`);
    }

    /** @deprecated 使用 notifyRoomFinished */
    public notifyBattleSessionEnded(): void {
        console.warn('[BattleResume] notifyBattleSessionEnded is deprecated; use notifyRoomFinished');
    }

    /** 角色切换时彻底失效旧 resume / 缓存 */
    public invalidateForCharacterChange(characterId?: string): void {
        invalidateForCharacterChange(this._gate, this._pendingCache, characterId);
        console.log(`[BattleResume] invalidate character change cid=${characterId ?? 'null'} gen=${this._gate.generation}`);
    }

    /**
     * 统一调度入口：500～800ms debounce，新触发覆盖旧调度，同一轮只发一个 resume。
     */
    public scheduleCheck(reason: string): void {
        scheduleDebounced(this._debounce, reason, RESUME_DEBOUNCE_MS, (merged) => {
            this.lastMergedReasons = merged;
            console.log(`[BattleResume] debounce fire reasons=${merged.join(',')}`);
            this.checkAndRestore(merged.join('+'));
        });
    }

    /**
     * 统一恢复入口。无房间、失败、重复 room 均不会创建新战斗。
     */
    public checkAndRestore(reason: string = 'manual'): void {
        const ws = this._ws || WebSocketManager.getInstance();
        this._ws = ws;
        if (!ws?.isConnected?.()) {
            console.log(`[BattleResume] skip (${reason}): not connected`);
            return;
        }
        if (!ws.isSessionAuthenticated?.()) {
            console.log(`[BattleResume] skip (${reason}): not authenticated`);
            return;
        }
        const characterId = ws.getCharacterId?.();
        if (!characterId) {
            console.log(`[BattleResume] skip (${reason}): no character`);
            return;
        }
        if (this._gate.inFlight) {
            console.log(`[BattleResume] skip (${reason}): resume in-flight gen=${this._gate.generation}`);
            return;
        }

        const generation = beginResume(this._gate, characterId);
        const requestCharacterId = characterId;
        console.log(`[BattleResume] resume start reason=${reason} gen=${generation} cid=${characterId}`);

        ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_RESUME,
            { character_id: characterId },
            (resp: any) => {
                this._onResumeResponse(resp, generation, requestCharacterId, reason);
            },
            true,
            8000,
        );
    }

    private _onResumeResponse(
        resp: any,
        generation: number,
        requestCharacterId: string,
        reason: string,
    ): void {
        const ws = this._ws || WebSocketManager.getInstance();
        const acceptable = isResumeResponseAcceptable(this._gate, {
            requestGeneration: generation,
            requestCharacterId,
            currentCharacterId: ws?.getCharacterId?.() ?? null,
            authenticated: !!ws?.isSessionAuthenticated?.(),
            connected: !!ws?.isConnected?.(),
        });
        if (acceptable.ok === false) {
            const dropReason = acceptable.reason;
            console.log(`[BattleResume] drop response reason=${dropReason} gen=${generation}`);
            // stale / character 切换时 generation 已变；仅当仍是本次请求才解除 inFlight
            if (dropReason === 'stale_generation' || dropReason === 'character_changed') {
                // invalidate / begin 已处理；若仍是同 gen 但角色变了，也要 end
                if (this._gate.generation === generation) {
                    endResume(this._gate, generation);
                }
                return;
            }
            endResume(this._gate, generation);
            return;
        }

        endResume(this._gate, generation);

        if (!shouldOpenBattlePanel(resp)) {
            console.log(`[BattleResume] no in-progress room (reason=${reason})`);
            return;
        }

        const state = resp.data.state as BattleRoomStateLike;
        this._applyOrCacheState(state, requestCharacterId, generation, reason);
    }

    private _applyOrCacheState(
        state: BattleRoomStateLike,
        characterId: string,
        generation: number,
        reason: string,
    ): void {
        const battle = this._resolveBattleScene();
        if (!battle) {
            cachePendingResume(this._pendingCache, state, characterId, this._gate.generation);
            console.warn(
                `[BattleResume] BattleScene not registered; cached state room_id=${state.room_id || state.roomId} reason=${reason}`,
            );
            return;
        }

        const result = applyResumeAfterRestore(this._gate, state, (s) => battle.restoreFromServerState(s));
        if (!result.restored) {
            console.error(
                `[BattleResume] restore failed reason=${result.reason} room_id=${state.room_id || state.roomId} trigger=${reason}`,
            );
            // 保留一次可重试：不 mark；允许后续 scheduleCheck 再试
            return;
        }

        if (battle.node && !battle.node.active) {
            battle.node.active = true;
        }
        console.log(`[BattleResume] restored room_id=${state.room_id || state.roomId} marked=${result.marked}`);
    }

    private _tryApplyPending(reason: string): void {
        const ws = this._ws || WebSocketManager.getInstance();
        const cid = ws?.getCharacterId?.() ?? null;
        const valid = isPendingResumeStillValid(this._gate, this._pendingCache, cid);
        if (valid.ok === false) {
            if (valid.reason !== 'no_pending') {
                console.log(`[BattleResume] drop pending cache reason=${valid.reason}`);
                clearPendingResume(this._pendingCache);
            }
            return;
        }
        const battle = this._resolveBattleScene();
        if (!battle) return;

        const state = valid.state;
        const result = applyResumeAfterRestore(this._gate, state, (s) => battle.restoreFromServerState(s));
        clearPendingResume(this._pendingCache);
        if (!result.restored) {
            console.error(`[BattleResume] pending restore failed reason=${result.reason} trigger=${reason}`);
            return;
        }
        if (battle.node && !battle.node.active) {
            battle.node.active = true;
        }
        console.log(`[BattleResume] pending applied room_id=${state.room_id || state.roomId}`);
    }

    private _resolveBattleScene(): BattleScene | null {
        if (this._battleScene && (this._battleScene as any).node?.isValid) {
            return this._battleScene;
        }
        return null;
    }

    private _bind(): void {
        const ws = this._ws;
        if (!ws) return;
        ws.on('auth_response', this._onAuthResponse, this);
        ws.on('select_character_response', this._onSelectCharacter, this);
        const node = (ws as any).node;
        if (node?.on) {
            node.on('network_connect', this._onNetworkConnect, this);
            node.on('network_disconnect', this._onNetworkDisconnect, this);
            node.on('data_changed', this._onDataChanged, this);
        }
    }

    private _unbind(): void {
        const ws = this._ws;
        if (!ws) return;
        ws.off('auth_response', this._onAuthResponse, this);
        ws.off('select_character_response', this._onSelectCharacter, this);
        const node = (ws as any).node;
        if (node?.off) {
            node.off('network_connect', this._onNetworkConnect, this);
            node.off('network_disconnect', this._onNetworkDisconnect, this);
            node.off('data_changed', this._onDataChanged, this);
        }
    }

    private _onAuthResponse = (data: any): void => {
        if (!data?.success) return;
        this.scheduleCheck('auth_response');
    };

    private _onSelectCharacter = (data: any): void => {
        if (!data?.success) return;
        const cid = data?.data?.character_id || data?.character_id || this._ws?.getCharacterId?.();
        this.invalidateForCharacterChange(cid != null ? String(cid) : undefined);
        this.scheduleCheck('select_character_response');
    };

    private _onNetworkConnect = (): void => {
        this.scheduleCheck('network_connect');
    };

    private _onNetworkDisconnect = (): void => {
        // 请求期间断线：解除 inFlight，避免永久门控
        if (this._gate.inFlight) {
            forceClearInFlight(this._gate);
            console.log('[BattleResume] disconnect cleared inFlight');
        }
    };

    private _onDataChanged = (payload: { reason?: string } | null): void => {
        const reason = payload?.reason || '';
        if (reason === 'game_ids_saved') {
            this.scheduleCheck('game_ids_saved');
        }
        if (reason === 'character_id_cleared' || reason === 'all_cleared') {
            this.invalidateForCharacterChange(null);
        }
    };

    /** 测试钩子 */
    public getGateForTest(): BattleResumeGate {
        return this._gate;
    }

    public getPendingForTest(): PendingResumeCache {
        return this._pendingCache;
    }
}

/** 确保常驻恢复控制器已创建（可在 GameControl / 场景入口调用） */
export function ensureBattleResumeController(): BattleResumeController {
    return BattleResumeController.getInstance();
}
