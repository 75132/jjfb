import { _decorator, Component, Node, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import {
    beginResume,
    clearAppliedRoom,
    createBattleResumeGate,
    endResume,
    isStaleResume,
    markRoomApplied,
    shouldOpenBattlePanel,
    shouldSkipDuplicateRestore,
    type BattleResumeGate,
    type BattleRoomStateLike,
} from './battle-resume-gate';
import type { BattleScene } from './BattleScene';

const { ccclass } = _decorator;

/**
 * 战斗自动恢复唯一入口（生产组件）。
 * - 登录鉴权成功 / 选角完成 / 网络重连 → checkAndRestore
 * - 同一时刻仅一个 resume 在途；generation 丢弃旧响应
 * - 无房间 / 失败 → 不创建新房间
 */
@ccclass('BattleResumeController')
export class BattleResumeController extends Component {
    private static _instance: BattleResumeController | null = null;
    private static _instanceNode: Node | null = null;

    private _ws: WebSocketManager | null = null;
    private _gate: BattleResumeGate = createBattleResumeGate();
    private _battleScene: BattleScene | null = null;
    private _started = false;

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
        // 场景加载后若已具备角色会话，尝试一次恢复
        this.scheduleOnce(() => this.checkAndRestore('boot'), 0.3);
    }

    onDestroy(): void {
        this._unbind();
        if (BattleResumeController._instance === this) {
            BattleResumeController._instance = null;
            BattleResumeController._instanceNode = null;
        }
    }

    /** BattleScene 自注册，避免依赖场景引用与 .meta 改动 */
    public registerBattleScene(scene: BattleScene): void {
        this._battleScene = scene;
    }

    public unregisterBattleScene(scene: BattleScene): void {
        if (this._battleScene === scene) {
            this._battleScene = null;
        }
    }

    /** 战斗结束 / 面板关闭时清除「已恢复 room」标记，允许下次恢复 */
    public notifyBattleSessionEnded(): void {
        clearAppliedRoom(this._gate);
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

        const generation = beginResume(this._gate);
        console.log(`[BattleResume] resume start reason=${reason} gen=${generation} cid=${characterId}`);

        ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_RESUME,
            { character_id: characterId },
            (resp: any) => {
                if (isStaleResume(this._gate, generation)) {
                    console.log(`[BattleResume] drop stale response gen=${generation} current=${this._gate.generation}`);
                    return;
                }
                endResume(this._gate, generation);

                if (!shouldOpenBattlePanel(resp)) {
                    console.log(`[BattleResume] no in-progress room (reason=${reason})`);
                    return;
                }

                const state = resp.data.state as BattleRoomStateLike;
                if (shouldSkipDuplicateRestore(this._gate, state)) {
                    console.log(`[BattleResume] skip duplicate room_id=${state.room_id || state.roomId}`);
                    return;
                }

                const battle = this._resolveBattleScene();
                if (!battle) {
                    console.warn('[BattleResume] BattleScene not found, cannot restore panel');
                    return;
                }

                markRoomApplied(this._gate, state);
                battle.restoreFromServerState(state);
                if (battle.node && !battle.node.active) {
                    battle.node.active = true;
                }
                console.log(`[BattleResume] restored room_id=${state.room_id || state.roomId}`);
            },
            true,
            8000,
        );
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
            node.off('data_changed', this._onDataChanged, this);
        }
    }

    private _onAuthResponse = (data: any): void => {
        if (!data?.success) return;
        // 登录完成：若本地已有角色 ID（自动登录续局），尝试恢复
        this.scheduleOnce(() => this.checkAndRestore('auth_response'), 0.2);
    };

    private _onSelectCharacter = (data: any): void => {
        if (!data?.success) return;
        this.scheduleOnce(() => this.checkAndRestore('select_character'), 0.25);
    };

    private _onNetworkConnect = (): void => {
        this.scheduleOnce(() => this.checkAndRestore('network_reconnect'), 0.35);
    };

    private _onDataChanged = (payload: { reason?: string } | null): void => {
        const reason = payload?.reason || '';
        if (reason === 'game_ids_saved') {
            this.scheduleOnce(() => this.checkAndRestore('character_ready'), 0.2);
        }
        if (reason === 'character_id_cleared' || reason === 'all_cleared') {
            clearAppliedRoom(this._gate);
        }
    };
}

/** 确保常驻恢复控制器已创建（可在 GameControl / 场景入口调用） */
export function ensureBattleResumeController(): BattleResumeController {
    return BattleResumeController.getInstance();
}
