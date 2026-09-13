import {
    _decorator,
    Button,
    Component,
    director,
    Node,
    Toggle,
} from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
import { emitBattleTeamUpdated, emitRobotDataUpdated } from '../global/RobotGameEvents';
import { TipWindows } from '../global/TipWindows';

const { ccclass } = _decorator;

export type StarterMechOption = {
    robotId: number;
    name: string;
    hint: string;
};

/** 与服务端 STARTER_MECH_OPTIONS 对齐；Toggle 顺序：鹰眼 / 铁壁 / 钢板 */
export const STARTER_MECH_OPTIONS: StarterMechOption[] = [
    { robotId: 3, name: '鹰眼', hint: '远程 · 高命中' },
    { robotId: 0, name: '铁壁', hint: '重装 · 高防御' },
    { robotId: 6, name: '钢板', hint: '均衡 · 全能型' },
];

/**
 * 进游戏未选初始机甲时强制弹出 SelectWindow；领取后 15 级并自动出战。
 */
@ccclass('StarterMechPicker')
export class StarterMechPicker extends Component {
    private static _instance: StarterMechPicker | null = null;

    private _ws: WebSocketManager | null = null;
    private _selectWindow: Node | null = null;
    private _toggles: Toggle[] = [];
    private _selectedRobotId = STARTER_MECH_OPTIONS[0].robotId;
    private _checking = false;
    private _submitting = false;
    private _shown = false;
    private _bound = false;
    private _resolved = false;
    private _retryTimer: ReturnType<typeof setTimeout> | null = null;

    public static ensure(): StarterMechPicker {
        if (StarterMechPicker._instance?.isValid) {
            return StarterMechPicker._instance;
        }
        const scene = director.getScene();
        const host = scene?.getChildByName('Canvas') ?? scene;
        const node = new Node('StarterMechPicker');
        if (host) {
            host.addChild(node);
        }
        const comp = node.addComponent(StarterMechPicker);
        StarterMechPicker._instance = comp;
        return comp;
    }

    onLoad(): void {
        if (StarterMechPicker._instance && StarterMechPicker._instance !== this) {
            this.destroy();
            return;
        }
        StarterMechPicker._instance = this;
        this._ws = WebSocketManager.getInstance();
        TipWindows.warmup();
        this.bindSelectWindow();
        this.bindWsEvents();
        this.checkAndPrompt();
    }

    onDestroy(): void {
        this.clearRetryTimer();
        this.unbindWsEvents();
        if (StarterMechPicker._instance === this) {
            StarterMechPicker._instance = null;
        }
    }

    private bindWsEvents(): void {
        const ws = this._ws ?? WebSocketManager.getInstance();
        ws.on('network_connect', this.onWsReady, this);
        ws.on('data_changed', this.onDataChanged, this);
    }

    private unbindWsEvents(): void {
        const ws = this._ws ?? WebSocketManager.getInstance();
        ws.off('network_connect', this.onWsReady, this);
        ws.off('data_changed', this.onDataChanged, this);
    }

    private onWsReady = (): void => {
        this.checkAndPrompt();
    };

    private onDataChanged = (data: any): void => {
        if (data?.reason === 'game_ids_saved' || data?.reason === 'character_id_cleared') {
            this._resolved = false;
            this.checkAndPrompt();
        }
    };

    /** 进 Game 场景后调用：服务端未记录初始机甲选择则立即强制弹窗 */
    public checkAndPrompt(): void {
        if (this._resolved || this._submitting) return;

        const ws = this._ws ?? WebSocketManager.getInstance();
        const characterId = ws?.getCharacterId?.();
        if (!characterId) {
            this.scheduleRetry(120);
            return;
        }

        const cache = DataCacheManager.getInstance().getRobotPetsCache(characterId);
        if (cache?.starter_mech_chosen === true) {
            this._resolved = true;
            this.hidePicker();
            return;
        }

        // 未确认前先弹出，避免等网络请求才出现
        this.showPicker();

        if (!ws?.isConnected?.()) {
            this.scheduleRetry(150);
            return;
        }

        this.fetchStarterStatus(characterId);
    }

    private scheduleRetry(delayMs: number): void {
        if (this._resolved || this._retryTimer) return;
        this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this.checkAndPrompt();
        }, delayMs);
    }

    private clearRetryTimer(): void {
        if (this._retryTimer) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
    }

    private fetchStarterStatus(characterId: string): void {
        if (this._checking || this._resolved) return;
        const ws = this._ws ?? WebSocketManager.getInstance();
        if (!ws?.isConnected?.()) return;

        this._checking = true;
        ws.request(
            GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS,
            { character_id: characterId, page: 0, page_size: 1 },
            (resp: any) => {
                this._checking = false;
                if (!resp?.success) {
                    this.scheduleRetry(400);
                    return;
                }

                const starterChosen = resp.starter_mech_chosen ?? resp.data?.starter_mech_chosen;
                if (starterChosen === true) {
                    this._resolved = true;
                    this.hidePicker();
                    return;
                }

                this.showPicker();
            },
            true,
            8000,
        );
    }

    private bindSelectWindow(): void {
        if (this._bound) return;

        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const win = canvas?.getChildByName('SelectWindow') ?? scene?.getChildByName('SelectWindow');
        if (!win) {
            console.warn('[StarterMechPicker] 场景中未找到 SelectWindow 节点');
            return;
        }

        this._selectWindow = win;
        win.active = false;

        const toggleGroup = win.getChildByName('ToggleGroup');

        this._toggles = [];
        for (let i = 0; i < STARTER_MECH_OPTIONS.length; i++) {
            const toggleNode = toggleGroup?.getChildByName(`Toggle${i + 1}`);
            const toggle = toggleNode?.getComponent(Toggle);
            if (!toggle) continue;

            const robotId = STARTER_MECH_OPTIONS[i].robotId;
            this._toggles.push(toggle);
            toggle.node.on(Toggle.EventType.TOGGLE, () => {
                if (toggle.isChecked) {
                    this._selectedRobotId = robotId;
                }
            }, this);
        }

        if (this._toggles[0]) {
            this._toggles[0].isChecked = true;
            this._selectedRobotId = STARTER_MECH_OPTIONS[0].robotId;
        }

        const confirmNode = win.getChildByName('Confirm');
        const confirmBtn = confirmNode?.getComponent(Button);
        if (confirmBtn) {
            confirmBtn.node.off(Button.EventType.CLICK, this.onConfirmClick, this);
            confirmBtn.node.on(Button.EventType.CLICK, this.onConfirmClick, this);
        }

        this._bound = true;
    }

    private getSelectedRobotId(): number {
        for (let i = 0; i < this._toggles.length; i++) {
            const toggle = this._toggles[i];
            if (toggle?.isChecked) {
                return STARTER_MECH_OPTIONS[i]?.robotId ?? this._selectedRobotId;
            }
        }
        return this._selectedRobotId;
    }

    private showPicker(): void {
        if (this._resolved) return;
        this.bindSelectWindow();
        if (!this._selectWindow) return;

        this._shown = true;
        this._selectWindow.active = true;
        const tip = TipWindows.getInstance();
        if (!tip?.isVisible()) {
            const parent = this._selectWindow.parent;
            if (parent) {
                this._selectWindow.setSiblingIndex(parent.children.length - 1);
            }
        }
    }

    private hidePicker(): void {
        if (this._selectWindow?.isValid) {
            this._selectWindow.active = false;
        }
        this._shown = false;
    }

    private onConfirmClick(): void {
        if (this._submitting) return;

        const robotId = this.getSelectedRobotId();
        const opt = STARTER_MECH_OPTIONS.find((o) => o.robotId === robotId);
        if (!opt) return;

        const tip = TipWindows.getInstance();
        if (tip) {
            tip.showConfirm(
                `确定选择「${opt.name}」作为初始机甲吗？\n选择后无法更改。`,
                () => this.submitChoice(opt),
                () => {
                    if (!this._resolved) {
                        this.showPicker();
                    }
                },
                { confirmText: '确定', cancelText: '取消' },
            );
            if (this._selectWindow?.isValid) {
                this._selectWindow.active = false;
            }
            return;
        }
        this.submitChoice(opt);
    }

    private submitChoice(opt: StarterMechOption): void {
        if (this._submitting) return;
        const ws = this._ws ?? WebSocketManager.getInstance();
        const characterId = ws?.getCharacterId();
        if (!characterId) return;

        this._submitting = true;
        const tip = TipWindows.getInstance();
        tip?.showAlert('正在领取初始机甲…', undefined, { autoCloseMs: 0 });
        ws.request(
            GameConfig.MESSAGE_TYPES.CHOOSE_STARTER_MECH,
            { character_id: characterId, robot_id: opt.robotId },
            (resp: any) => {
                this._submitting = false;
                if (!resp?.success) {
                    const msg = resp?.message || '领取初始机甲失败';
                    console.warn('[StarterMechPicker] 领取失败:', msg);
                    this.showPicker();
                    tip?.showAlert(msg, undefined, { autoCloseMs: 0 });
                    return;
                }

                const data = resp.data ?? resp;
                const pets = data.pet_id
                    ? [{
                        pet_id: data.pet_id,
                        RobotID: data.robot_id,
                        RobotName: data.robot_name,
                        Level: data.level,
                    }]
                    : [];
                DataCacheManager.getInstance().setRobotPetsCache(characterId, {
                    pets,
                    robotcount: data.robotcount ?? 1,
                    battle_team: data.battle_team ?? [data.pet_id],
                    team_version: data.team_version ?? 1,
                    starter_mech_chosen: true,
                });
                emitRobotDataUpdated({ character_id: characterId, petId: data.pet_id });
                emitBattleTeamUpdated({ character_id: characterId });
                console.log(`✅ [StarterMechPicker] 已领取 ${opt.name} Lv${data.level ?? 15}`);
                this._resolved = true;
                this.clearRetryTimer();
                tip?.close();
                this.hidePicker();
            },
            true,
            12000,
        );
    }
}

export function ensureStarterMechPicker(): StarterMechPicker {
    return StarterMechPicker.ensure();
}
