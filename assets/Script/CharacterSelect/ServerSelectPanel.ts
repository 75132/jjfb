import {
    _decorator,
    Button,
    Color,
    Component,
    director,
    instantiate,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    sys,
    UITransform,
} from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { Back } from './Return';

const { ccclass } = _decorator;

/** 模拟服务器状态 */
export type MockServerStatus = 'normal' | 'full' | 'maintenance';

export interface MockServerInfo {
    id: string;
    zone: string;
    name: string;
    status: MockServerStatus;
}

const ITEM_GAP = 18;
const LAST_SERVER_KEY = 'jjfb_last_server_id';
const COL_GAP = '      ';

const COLOR_NORMAL = new Color(255, 255, 255, 255);
const COLOR_MAINTENANCE = new Color(150, 150, 150, 255);
const COLOR_LAST_LOGIN = new Color(255, 64, 64, 255);

/** 模拟四区数据（暂不区分真实服务器） */
const MOCK_SERVERS: MockServerInfo[] = [
    { id: 's1', zone: '一区', name: '火星风暴', status: 'full' },
    { id: 's2', zone: '二区', name: '星际远征', status: 'normal' },
    { id: 's3', zone: '三区', name: '钢铁洪流', status: 'maintenance' },
    { id: 's4', zone: '四区', name: '虚空裂隙', status: 'normal' },
];

/**
 * CharacterSelect 选服面板：进入场景强制打开，单选四区，确认后关闭。
 * 场景内 BackControl 打开本面板；面板内 BackControl-001 返回 Login。
 */
@ccclass('ServerSelectPanel')
export class ServerSelectPanel extends Component {
    private static _bootstrapped = false;

    private listTemplate: Node | null = null;
    private confirmNode: Node | null = null;
    private sceneBackControl: Node | null = null;
    private panelBackControl: Node | null = null;

    private normalSf: SpriteFrame | null = null;
    private selectedSf: SpriteFrame | null = null;

    private itemNodes: Node[] = [];
    private selectedIndex = -1;
    private lastServerId = '';
    private _backToLoginBusy = false;

    /** 由 CharacterSelect 调用，确保场景里挂上并初始化选服面板 */
    public static ensureInScene(host?: Node | null): void {
        if (ServerSelectPanel._bootstrapped) {
            const existing = director.getScene()?.getComponentInChildren(ServerSelectPanel);
            if (existing?.isValid) {
                existing.openPanel(true);
                return;
            }
            ServerSelectPanel._bootstrapped = false;
        }

        const canvas = host?.parent?.name === 'Canvas'
            ? host.parent
            : (director.getScene()?.getChildByName('Canvas') ?? null);
        if (!canvas) {
            console.warn('[ServerSelectPanel] Canvas 未找到，跳过选服初始化');
            return;
        }

        const panelNode = canvas.getChildByName('ServerSelect');
        if (!panelNode) {
            console.warn('[ServerSelectPanel] ServerSelect 节点未找到');
            return;
        }

        let panel = panelNode.getComponent(ServerSelectPanel);
        if (!panel) {
            panel = panelNode.addComponent(ServerSelectPanel);
        }
        ServerSelectPanel._bootstrapped = true;
        panel.openPanel(true);
    }

    onLoad(): void {
        this.resolveNodes();
        this.cacheSprites();
        this.disableMountedBackScripts();
        this.bindButtons();
        this.buildServerList();
        this.updateConfirmVisible();
    }

    onDestroy(): void {
        this.unbindButtons();
        if (ServerSelectPanel._bootstrapped) {
            ServerSelectPanel._bootstrapped = false;
        }
    }

    /** 打开选服面板；forceReset 时清空当前选择 */
    public openPanel(forceReset = true): void {
        this.node.active = true;
        if (this.panelBackControl && this.panelBackControl.parent !== this.node) {
            this.panelBackControl.setParent(this.node);
        }
        if (forceReset) {
            this.clearSelection();
        }
        this.refreshItemVisuals();
        this.updateConfirmVisible();
    }

    public closePanel(): void {
        this.node.active = false;
    }

    private resolveNodes(): void {
        const canvas = this.node.parent;
        this.listTemplate = this.node.getChildByName('List01');
        this.confirmNode = this.node.getChildByName('Confirm');
        this.sceneBackControl = canvas?.getChildByName('BackControl') ?? null;
        this.panelBackControl =
            this.node.getChildByName('BackControl-001') ??
            canvas?.getChildByName('BackControl-001') ??
            null;

        if (this.panelBackControl && this.panelBackControl.parent !== this.node) {
            this.panelBackControl.setParent(this.node);
        }

        if (this.listTemplate) {
            this.listTemplate.active = false;
        }
        if (this.confirmNode) {
            this.confirmNode.active = false;
        }

        try {
            this.lastServerId = sys.localStorage.getItem(LAST_SERVER_KEY) || '';
        } catch {
            this.lastServerId = '';
        }
    }

    private cacheSprites(): void {
        const btn = this.listTemplate?.getComponent(Button);
        if (!btn) return;
        this.normalSf = btn.normalSprite ?? this.listTemplate?.getComponent(Sprite)?.spriteFrame ?? null;
        this.selectedSf = btn.pressedSprite ?? this.normalSf;
    }

    /** 场景里挂的 Back 组件 backBtn 多为空；统一由本面板接管点击，避免冲突 */
    private disableMountedBackScripts(): void {
        for (const n of [this.sceneBackControl, this.panelBackControl]) {
            const back = n?.getComponent(Back);
            if (back) back.enabled = false;
        }
    }

    private bindButtons(): void {
        const sceneBtn = this.findButton(this.sceneBackControl);
        if (sceneBtn) {
            sceneBtn.node.on(Button.EventType.CLICK, this.onSceneBackClick, this);
        }
        const panelBtn = this.findButton(this.panelBackControl);
        if (panelBtn) {
            panelBtn.node.on(Button.EventType.CLICK, this.onPanelBackClick, this);
        }
        const confirmBtn = this.findButton(this.confirmNode);
        if (confirmBtn) {
            confirmBtn.node.on(Button.EventType.CLICK, this.onConfirmClick, this);
        }
    }

    private unbindButtons(): void {
        const sceneBtn = this.findButton(this.sceneBackControl);
        if (sceneBtn?.node?.isValid) {
            sceneBtn.node.off(Button.EventType.CLICK, this.onSceneBackClick, this);
        }
        const panelBtn = this.findButton(this.panelBackControl);
        if (panelBtn?.node?.isValid) {
            panelBtn.node.off(Button.EventType.CLICK, this.onPanelBackClick, this);
        }
        const confirmBtn = this.findButton(this.confirmNode);
        if (confirmBtn?.node?.isValid) {
            confirmBtn.node.off(Button.EventType.CLICK, this.onConfirmClick, this);
        }
        for (const item of this.itemNodes) {
            if (!item?.isValid) continue;
            const btn = item.getComponent(Button);
            if (btn?.node?.isValid) {
                btn.node.off(Button.EventType.CLICK, this.onItemClick, this);
            }
        }
    }

    private findButton(node: Node | null): Button | null {
        if (!node?.isValid) return null;
        return node.getComponent(Button) ?? node.getComponentInChildren(Button);
    }

    private buildServerList(): void {
        if (!this.listTemplate) return;

        for (const n of this.itemNodes) {
            if (n?.isValid) n.destroy();
        }
        this.itemNodes = [];
        this.selectedIndex = -1;

        const basePos = this.listTemplate.position.clone();
        const itemH = this.listTemplate.getComponent(UITransform)?.height ?? 50;
        const step = itemH + ITEM_GAP;

        for (let i = 0; i < MOCK_SERVERS.length; i++) {
            const info = MOCK_SERVERS[i];
            const node = instantiate(this.listTemplate);
            node.name = `List01_${i}`;
            node.active = true;
            node.setParent(this.listTemplate.parent);
            node.setSiblingIndex(this.listTemplate.getSiblingIndex() + 1 + i);
            node.setPosition(basePos.x, basePos.y - step * i, basePos.z);

            this.applyItemContent(node, info);
            const btn = node.getComponent(Button);
            if (btn) {
                // 选中态由脚本长显，不用 Button 按下瞬时切换
                btn.transition = Button.Transition.NONE;
                btn.node.on(Button.EventType.CLICK, this.onItemClick, this);
                btn.interactable = info.status !== 'maintenance';
            }
            this.itemNodes.push(node);
        }

        this.refreshItemVisuals();
    }

    private applyItemContent(node: Node, info: MockServerInfo): void {
        const tip = node.getChildByName('Tip')?.getComponent(Label);
        if (!tip) return;

        const isLast = !!this.lastServerId && this.lastServerId === info.id;
        tip.string = this.formatServerText(info, isLast);

        if (info.status === 'maintenance') {
            tip.color = COLOR_MAINTENANCE;
        } else if (isLast) {
            tip.color = COLOR_LAST_LOGIN;
        } else {
            tip.color = COLOR_NORMAL;
        }

        const tipUt = tip.node.getComponent(UITransform);
        if (tipUt && tipUt.width < 400) {
            tipUt.setContentSize(400, tipUt.height || 50.4);
        }
    }

    private formatServerText(info: MockServerInfo, isLastLogin: boolean): string {
        let text = `${info.zone}${COL_GAP}${info.name}`;
        if (info.status === 'maintenance') {
            text += `${COL_GAP}维护`;
            return text;
        }
        if (info.status === 'full') {
            text += `${COL_GAP}爆满`;
        }
        if (isLastLogin) {
            text += `${COL_GAP}[上次登陆]`;
        }
        return text;
    }

    private onItemClick = (btn?: Button): void => {
        const targetNode = btn?.node ?? null;
        if (!targetNode) return;
        const idx = this.itemNodes.findIndex((n) => n === targetNode);
        if (idx < 0) return;
        const info = MOCK_SERVERS[idx];
        if (!info || info.status === 'maintenance') return;

        this.selectedIndex = idx;
        this.refreshItemVisuals();
        this.updateConfirmVisible();
    };

    private clearSelection(): void {
        this.selectedIndex = -1;
        this.refreshItemVisuals();
        this.updateConfirmVisible();
    }

    private refreshItemVisuals(): void {
        for (let i = 0; i < this.itemNodes.length; i++) {
            const node = this.itemNodes[i];
            if (!node?.isValid) continue;
            const selected = i === this.selectedIndex;
            const sprite = node.getComponent(Sprite);
            const frame = selected ? this.selectedSf : this.normalSf;
            if (sprite && frame) {
                sprite.spriteFrame = frame;
            }
            const btn = node.getComponent(Button);
            if (btn && frame) {
                btn.normalSprite = frame;
            }
        }
    }

    private updateConfirmVisible(): void {
        if (this.confirmNode) {
            this.confirmNode.active = this.selectedIndex >= 0;
        }
    }

    private onConfirmClick = (): void => {
        if (this.selectedIndex < 0) return;
        const info = MOCK_SERVERS[this.selectedIndex];
        if (!info) return;

        this.lastServerId = info.id;
        try {
            sys.localStorage.setItem(LAST_SERVER_KEY, info.id);
        } catch (_) {}

        // 关闭后面板再打开时要刷新「上次登陆」标记
        for (let i = 0; i < this.itemNodes.length; i++) {
            const n = this.itemNodes[i];
            const s = MOCK_SERVERS[i];
            if (n?.isValid && s) this.applyItemContent(n, s);
        }

        console.log(`[ServerSelectPanel] 模拟选服确认: ${info.zone} ${info.name}`);
        this.closePanel();
    };

    private onSceneBackClick = (): void => {
        this.openPanel(true);
    };

    private onPanelBackClick = (): void => {
        if (this._backToLoginBusy) return;
        this._backToLoginBusy = true;

        const panelBtn = this.findButton(this.panelBackControl);
        if (panelBtn) panelBtn.interactable = false;

        try {
            WebSocketManager.getInstance().fullLogout();
        } catch (_) {}

        director.loadScene(GameConfig.SCENE_NAMES.LOGIN, (error) => {
            if (error) {
                console.error('[ServerSelectPanel] 返回 Login 失败:', error);
                this._backToLoginBusy = false;
                if (panelBtn) panelBtn.interactable = true;
            }
        });
    };
}
