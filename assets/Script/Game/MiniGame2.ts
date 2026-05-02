import { _decorator, Component, Node, Label, Button, Sprite, SpriteFrame, instantiate, Prefab, EditBox, assetManager, UITransform, v2 } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';

const { ccclass, property } = _decorator;

type CategoryKey = 'bear' | 'bull' | 'nano' | 'quantum_mine' | 'stellar_route' | 'annihilation';

const SYNC_INTERVAL_SEC = 10;
const MAX_BET_AMOUNT = 999999999;
const MIN_BET_AMOUNT = 1;

const CATEGORIES: Array<{ key: CategoryKey; name: string; multiplier: number }> = [
    { key: 'bear', name: '熊市', multiplier: 2 },
    { key: 'bull', name: '牛市', multiplier: 2 },
    { key: 'nano', name: '纳米科技', multiplier: 3 },
    { key: 'quantum_mine', name: '量子矿脉', multiplier: 4 },
    { key: 'stellar_route', name: '星海航线', multiplier: 5 },
    { key: 'annihilation', name: '湮灭能量', multiplier: 7 },
];

/** 与 sync.categories 一致；客户端默认列表用 CATEGORIES 转成此结构 */
export type MiniGame2CategoryRow = { key: string; name: string; multiplier: number };

export interface MiniGame2MyBet {
    selected_key: string;
    bet_amount: number;
}

export interface MiniGame2SyncPayload {
    issue_key: string;
    seconds_until_close: number;
    round_drawn: boolean;
    energy_blocks: number;
    categories: Array<{ key: CategoryKey | string; name: string; multiplier: number }>;
    my_bets?: MiniGame2MyBet[] | null;
    my_bet_total?: number;
    winner_key?: CategoryKey | string;
    winner_multiplier?: number;
    server_time: string;
}

@ccclass('MiniGame2')
export class MiniGame2 extends Component {
    // 下方选项项 prefab（MiniGame2ListPrefab）。建议你拖进来，确保动态生成选项一定可用。
    @property({ type: Prefab })
    optionItemPrefab: Prefab | null = null;

    // 当前期数显示（你在编辑器里把 Label 拖到这里即可）
    @property({ type: Label })
    currentIssueLabel: Label | null = null;

    // 本期已投资明细显示（你在编辑器里把 Label 拖到这里即可）
    @property({ type: Label })
    myBetsLabel: Label | null = null;

    private ws: WebSocketManager = null!;

    private _lastPayload: MiniGame2SyncPayload | null = null;

    private _serverTimeBaseMs: number | null = null;
    private _serverTimeRecvAtMs: number = 0;
    private _roundCloseMs: number | null = null;

    private _requestingBet: boolean = false;

    private countdownLabel: Label | null = null;
    private energyAvailableLabel: Label | null = null;
    private topEnergyLabel: Label | null = null;
    private currentSelectionLabel: Label | null = null;
    private editBox: EditBox | null = null;
    private confirmBtn: Node | null = null;
    private confirmButtonComp: Button | null = null;
    private optionContent: Node | null = null;

    /** 当前用于展示/解析类目的权威行（来自最近一次 sync 或默认 CATEGORIES） */
    private _displayRows: MiniGame2CategoryRow[] = [];
    private selectedKey: string | null = null;
    private optionItems: Array<{
        key: string;
        btn: Button;
        label: Label;
        node: Node;
        sprite?: Sprite | null;
        normalSprite?: SpriteFrame | null;
        pressedSprite?: SpriteFrame | null;
    }> = [];
    /** 类目结构签名（不含期号）：变化时重建选项按钮 */
    private _optionCategorySig = '';
    private _rebuildToken = 0;

    private backControlNode: Node | null = null;
    private _backBtnNode: Node | null = null;

    private errorPanel: Node | null = null;
    private errorLabel: Label | null = null;
    // 顶部提示文案（场景中 MiniGame2 下的 Label，用来显示“乱投资是吧”等提示）
    private mainTipLabel: Label | null = null;
    private errorConfirmNode: Node | null = null;
    private errorCancelNode: Node | null = null;
    private errorConfirmBtn: Button | null = null;
    private errorCancelBtn: Button | null = null;
    private _pendingBetAmount: number | null = null;
    private _pendingBetKey: string | null = null;

    private viewHistoryBtn: Node | null = null;

    // InvestmentReturnHistory 看板（点击 ViewInvestmentReturnHistory 后弹出）
    private investmentReturnHistoryOpen = false;
    private investmentReturnHistoryPanel: Node | null = null;
    private investmentReturnHistoryTotalLabel: Label | null = null;
    private investmentReturnHistoryHistoryProtoNode: Node | null = null;
    private investmentReturnHistoryHistoryProtoLabel: Label | null = null;
    private investmentReturnHistoryHistoryParent: Node | null = null;
    private investmentReturnHistoryDynamicNodes: Node[] = [];
    private _requestingHistory: boolean = false;

    private readonly _scheduledSyncTick = () => {
        this.requestSync();
    };

    public static mountFromSceneRoot(root: Node): void {
        const scene = root.scene;
        if (!scene) return;
        const stack: Node[] = [...scene.children];
        while (stack.length) {
            const n = stack.pop()!;
            if (n.name === 'MiniGame2') {
                if (!n.getComponent(MiniGame2)) n.addComponent(MiniGame2);
                return;
            }
            stack.push(...n.children);
        }
    }

    private updateOptionVisual() {
        if (!this.optionItems.length) return;
        const p = this._lastPayload;
        const canBetBase = p ? !p.round_drawn && (p.seconds_until_close ?? 0) > 0 : false;
        const winnerKey = p?.round_drawn ? String(p.winner_key ?? '').trim() : '';
        for (const item of this.optionItems) {
            if (!item.sprite || !item.normalSprite || !item.pressedSprite) continue;
            const isWinner = !!winnerKey && item.key === winnerKey;
            const isSelected = this.selectedKey === item.key && canBetBase;
            const usePressed = isWinner || isSelected;
            item.sprite.spriteFrame = usePressed ? item.pressedSprite : item.normalSprite;
        }
    }

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        this.resolveBindings();
    }

    onEnable() {
        this.bindViewHistoryTrigger();
        this.requestSync();
        this.schedule(this._scheduledSyncTick, SYNC_INTERVAL_SEC);
    }

    onDisable() {
        this.unschedule(this._scheduledSyncTick);
    }

    start() {
        // 初次渲染选项：不依赖首个 sync，先把 UI 列表画出来，减少“卡很久才出现”的体感
        if (this.optionContent) {
            void this.rebuildOptionItems(this.defaultCategoryRows(), ++this._rebuildToken);
        }
    }

    update(): void {
        this.refreshCountdown();
    }

    private resolveBindings() {
        const g = (name: string) => this.findDeep(this.node, name);

        this.countdownLabel = g('CountdownToDraw')?.getComponent(Label) ?? null;
        if (!this.countdownLabel) {
            // 兜底：找该节点下任意 Label
            const cd = g('CountdownToDraw');
            if (cd) this.countdownLabel = cd.getComponentInChildren(Label);
        }

        this.energyAvailableLabel = g('EnergyAvailable')?.getComponent(Label) ?? null;
        // 顶部能量块显示（节点名为 EnergyBlock，下挂一个 Label）
        const topEnergyNode = g('EnergyBlock');
        if (topEnergyNode) {
            this.topEnergyLabel = topEnergyNode.getComponent(Label) ?? topEnergyNode.getComponentInChildren(Label);
        }
        this.currentSelectionLabel = g('CurrentSelection')?.getComponent(Label) ?? null;

        // 顶部提示 Label（节点名就叫 Label，在 MiniGame2 根下）
        const topLabelNode = g('Label');
        if (topLabelNode) {
            this.mainTipLabel = topLabelNode.getComponent(Label) ?? topLabelNode.getComponentInChildren(Label);
        }

        const ebNode = g('EnergyBlockInput');
        this.editBox = ebNode?.getComponent(EditBox) ?? null;

        this.confirmBtn = g('ConfirmInvestment');
        this.confirmButtonComp = this.confirmBtn?.getComponent(Button) ?? null;
        if (this.confirmBtn) {
            if (this.confirmButtonComp) {
                this.confirmButtonComp.node.on(Button.EventType.CLICK, this.onConfirmInvestmentClick, this);
            } else {
                const btn = this.confirmBtn.getComponentInChildren(Button);
                if (btn) btn.node.on(Button.EventType.CLICK, this.onConfirmInvestmentClick, this);
            }
        }

        // MiniGame2List -> view -> content
        const listRoot = g('MiniGame2List');
        this.optionContent = listRoot ? this.findDeep(listRoot, 'content') : null;

        // 错误提示面板：兼容 Errortip / ErrorTip
        this.errorPanel = g('Errortip') ?? g('ErrorTip') ?? null;
        // 若在 MiniGame2 节点下没找到，就从整个场景再兜底找一次
        if (!this.errorPanel && this.node.scene) {
            const findInScene = (root: Node, name: string): Node | null => {
                if (root.name === name) return root;
                for (const c of root.children) {
                    const r = findInScene(c, name);
                    if (r) return r;
                }
                return null;
            };
            this.errorPanel =
                findInScene(this.node.scene, 'Errortip') ??
                findInScene(this.node.scene, 'ErrorTip');
        }
        if (this.errorPanel) {
            // 先优先从 Errortip 直系子节点中查找名为 "Label" 的节点，确保拿到的是主文案 Label，
            // 而不是 Confirm/Cancel 等按钮内部的 Label，避免把按钮文字当成错误文案。
            const directChildLabelNode =
                this.errorPanel.children.find((c) => c.name === 'Label') ?? null;
            this.errorLabel =
                directChildLabelNode?.getComponent(Label) ??
                this.findDeep(this.errorPanel, 'Label')?.getComponent(Label) ??
                this.errorPanel.getComponentInChildren(Label);
            // 确认/取消按钮（用于“确认投资”对话框）
            this.errorConfirmNode = this.findDeep(this.errorPanel, 'Confirm');
            this.errorCancelNode = this.findDeep(this.errorPanel, 'Cancel');
            this.errorConfirmBtn =
                this.errorConfirmNode?.getComponent(Button) ?? this.errorConfirmNode?.getComponentInChildren(Button) ?? null;
            this.errorCancelBtn =
                this.errorCancelNode?.getComponent(Button) ?? this.errorCancelNode?.getComponentInChildren(Button) ?? null;
            if (this.errorConfirmBtn) {
                this.errorConfirmBtn.node.on(Button.EventType.CLICK, this.onErrorConfirmClick, this);
            }
            if (this.errorCancelBtn) {
                this.errorCancelBtn.node.on(Button.EventType.CLICK, this.onErrorCancelClick, this);
            }
            // 进场时按钮默认隐藏
            if (this.errorConfirmNode) this.errorConfirmNode.active = false;
            if (this.errorCancelNode) this.errorCancelNode.active = false;
            // 进场时保持隐藏，只有有错误时才短暂显示
            this.errorPanel.active = false;
        }

        this.viewHistoryBtn = g('ViewInvestmentReturnHistory');
        this.bindViewHistoryTrigger();

        // InvestmentReturnHistory 看板节点（场景内已布置好，直接复用，不动态新建面板）
        this.investmentReturnHistoryPanel = g('InvestmentReturnHistory');
        if (this.investmentReturnHistoryPanel) {
            const totalNode = this.findDeep(this.investmentReturnHistoryPanel, 'Number');
            this.investmentReturnHistoryTotalLabel = totalNode?.getComponent(Label) ?? totalNode?.getComponentInChildren(Label) ?? null;

            this.investmentReturnHistoryHistoryProtoNode = this.findDeep(this.investmentReturnHistoryPanel, 'History');
            this.investmentReturnHistoryHistoryProtoLabel =
                this.investmentReturnHistoryHistoryProtoNode?.getComponent(Label) ??
                this.investmentReturnHistoryHistoryProtoNode?.getComponentInChildren(Label) ??
                null;

            this.investmentReturnHistoryHistoryParent = this.investmentReturnHistoryHistoryProtoNode?.parent ?? null;

            // 面板内部的返回按钮：关闭看板即可
            const panelBack = this.findDeep(this.investmentReturnHistoryPanel, 'BackControl');
            if (panelBack) {
                const btn = panelBack.getComponent(Button) ?? panelBack.getComponentInChildren(Button);
                if (btn) {
                    btn.node.on(Button.EventType.CLICK, this.onBackControl, this);
                } else {
                    panelBack.on(Node.EventType.TOUCH_END, this.onBackControl, this);
                }
            }

            // 防御：场景里默认 active=false，确保脚本逻辑一致
            this.investmentReturnHistoryPanel.active = false;
        }

        // Back 按钮：关闭 MiniGame2 面板
        this.backControlNode = g('BackControl');
        const back = this.backControlNode;
        if (back) {
            const btn = back.getComponent(Button) ?? back.getComponentInChildren(Button);
            if (btn) {
                this._backBtnNode = btn.node;
                btn.node.on(Button.EventType.CLICK, this.onBackControl, this);
            } else {
                this._backBtnNode = back;
                back.on(Node.EventType.TOUCH_END, this.onBackControl, this);
            }
        }
    }

    private findDeep(root: Node, name: string): Node | null {
        if (root.name === name) return root;
        for (const c of root.children) {
            const r = this.findDeep(c, name);
            if (r) return r;
        }
        return null;
    }

    private bindViewHistoryTrigger() {
        if (!this.viewHistoryBtn) return;
        const btn = this.viewHistoryBtn.getComponent(Button) ?? this.viewHistoryBtn.getComponentInChildren(Button);

        // 防止重复绑定（onEnable 会兜底再次调用）
        if (btn) {
            btn.node.off(Button.EventType.CLICK, this.openInvestmentReturnHistoryPanel, this);
            btn.node.on(Button.EventType.CLICK, this.openInvestmentReturnHistoryPanel, this);
        }
        this.viewHistoryBtn.off(Node.EventType.TOUCH_END, this.openInvestmentReturnHistoryPanel, this);
        this.viewHistoryBtn.on(Node.EventType.TOUCH_END, this.openInvestmentReturnHistoryPanel, this);
    }

    private defaultCategoryRows(): MiniGame2CategoryRow[] {
        return CATEGORIES.map((c) => ({ key: c.key, name: c.name, multiplier: c.multiplier }));
    }

    private resolveCategoryRows(p: MiniGame2SyncPayload): MiniGame2CategoryRow[] {
        if (Array.isArray(p.categories) && p.categories.length > 0) {
            const out: MiniGame2CategoryRow[] = [];
            for (const c of p.categories) {
                const key = String((c as any)?.key ?? '').trim();
                if (!key) continue;
                const name = String((c as any)?.name ?? key).trim() || key;
                const mult = Math.floor(Number((c as any)?.multiplier) || 0);
                out.push({ key, name, multiplier: mult > 0 ? mult : 1 });
            }
            if (out.length > 0) return out;
        }
        return this.defaultCategoryRows();
    }

    private categoryStructureSig(rows: MiniGame2CategoryRow[]): string {
        return rows.map((r) => `${r.key}:${r.multiplier}`).join('|');
    }

    private rowDisplayName(key: string): string {
        return this._displayRows.find((r) => r.key === key)?.name ?? key;
    }

    private fmtHMS(sec: number): string {
        const s = Math.max(0, Math.floor(sec));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${h}:${p(m)}:${p(r)}`;
    }

    private parseServerTimeToMs(serverTime: string): number | null {
        const s = String(serverTime || '').trim();
        // YYYY-MM-DD HH:mm:ss
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return null;
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const h = parseInt(m[4], 10);
        const mi = parseInt(m[5], 10);
        const se = parseInt(m[6], 10);
        // server_time 是 Asia/Shanghai 的本地时间（无时区字符串），这里按 UTC+8 还原到 epoch，避免客户端时区不同导致倒计时偏差
        const utcMs = Date.UTC(y, mo, d, h, mi, se);
        const shanghaiOffsetMs = 8 * 3600 * 1000;
        const ms = utcMs - shanghaiOffsetMs;
        return Number.isFinite(ms) ? ms : null;
    }

    private refreshCountdown() {
        if (!this.countdownLabel?.isValid) return;
        if (this._lastPayload?.round_drawn) {
            this.countdownLabel.string = '已开奖';
            return;
        }
        if (!this._roundCloseMs || !this._serverTimeBaseMs) return;
        const nowMs = this._serverTimeBaseMs + (Date.now() - this._serverTimeRecvAtMs);
        const remaining = Math.floor((this._roundCloseMs - nowMs) / 1000);
        this.countdownLabel.string = this.fmtHMS(remaining);
    }

    /**
     * 按服务端类目（或默认）重建选项列表；token 用于丢弃过期的异步完成回调。
     */
    private async rebuildOptionItems(rows: MiniGame2CategoryRow[], token: number) {
        if (!this.optionContent) return;
        const prefab = await this.ensureOptionItemPrefab();
        if (token !== this._rebuildToken) return;

        this._displayRows = rows.slice();

        try {
            this.optionContent.removeAllChildren();
            this.optionItems = [];

            for (const cat of rows) {
                if (prefab) {
                    const node = instantiate(prefab);
                    this.optionContent.addChild(node);

                    const labelNode = this.findDeep(node, 'Label');
                    const labelComp = labelNode?.getComponent(Label) ?? node.getComponentInChildren(Label);
                    const btnComp = node.getComponent(Button) ?? node.getComponentInChildren(Button);
                    const spriteComp = node.getComponent(Sprite) ?? node.getComponentInChildren(Sprite);
                    if (!btnComp || !labelComp) continue;

                    labelComp.string = `${cat.name} X ${cat.multiplier}`;

                    const item = {
                        key: cat.key,
                        btn: btnComp,
                        label: labelComp,
                        node,
                        sprite: spriteComp,
                        normalSprite: (btnComp as any).normalSprite as SpriteFrame | null,
                        pressedSprite: (btnComp as any).pressedSprite as SpriteFrame | null,
                    };
                    this.optionItems.push(item);

                    const keyRef = cat.key;
                    const nameRef = cat.name;
                    btnComp.node.on(
                        Button.EventType.CLICK,
                        () => {
                            if (this._lastPayload?.round_drawn) return;
                            if ((this._lastPayload?.seconds_until_close ?? 0) <= 0) return;
                            this.selectedKey = keyRef;
                            if (this.currentSelectionLabel) this.currentSelectionLabel.string = nameRef;
                            this.updateOptionVisual();
                        },
                        this
                    );
                } else {
                    const node = new Node(cat.key);
                    const ui = node.addComponent(UITransform);
                    ui.setAnchorPoint(v2(0.5, 0.5));
                    ui.setContentSize(120, 40);

                    const label = node.addComponent(Label);
                    label.string = `${cat.name} X ${cat.multiplier}`;
                    label.fontSize = 20;
                    label.horizontalAlign = 1;
                    label.verticalAlign = 1;

                    const btn = node.addComponent(Button);
                    this.optionContent.addChild(node);

                    const item = { key: cat.key, btn, label, node };
                    this.optionItems.push(item);

                    const keyRef = cat.key;
                    const nameRef = cat.name;
                    btn.node.on(
                        Button.EventType.CLICK,
                        () => {
                            if (this._lastPayload?.round_drawn) return;
                            if ((this._lastPayload?.seconds_until_close ?? 0) <= 0) return;
                            this.selectedKey = keyRef;
                            if (this.currentSelectionLabel) this.currentSelectionLabel.string = nameRef;
                            this.updateOptionVisual();
                        },
                        this
                    );
                }
            }

            const validKeys = new Set(rows.map((r) => r.key));
            if (this.selectedKey && !validKeys.has(this.selectedKey)) {
                this.selectedKey = rows[0]?.key ?? null;
            }
            if (!this.selectedKey && rows.length > 0) {
                this.selectedKey = rows[0].key;
            }
            if (this.currentSelectionLabel && this.selectedKey && !this._lastPayload?.round_drawn) {
                this.currentSelectionLabel.string = this.rowDisplayName(this.selectedKey);
            }

            this._optionCategorySig = this.categoryStructureSig(rows);
        } catch (e) {
            console.warn('[MiniGame2] rebuildOptionItems', e);
        }

        if (token !== this._rebuildToken) return;
        if (this._lastPayload) {
            this.applyInteractableFromPayload(this._lastPayload);
        }
        this.updateOptionVisual();
    }

    private async ensureOptionItemPrefab(): Promise<Prefab | null> {
        if (this.optionItemPrefab) return this.optionItemPrefab;

        // 尝试从外部资源路径加载（如果你没在编辑器里填 prefab，这里兜底）
        const tryLoad = (): Promise<Prefab | null> =>
            new Promise((resolve) => {
                assetManager.loadAny(
                    { path: 'UIPrefab/MiniGame2ListPrefab', type: Prefab },
                    (err: Error | null, asset: Prefab | null) => {
                        if (err) {
                            console.warn('[MiniGame2] load MiniGame2ListPrefab failed:', err);
                            resolve(null);
                            return;
                        }
                        resolve(asset);
                    }
                );
            });

        this.optionItemPrefab = await tryLoad();
        return this.optionItemPrefab;
    }

    private ensureInvestmentReturnHistoryPanelReady() {
        // 面板应当已经在场景里存在：InvestmentReturnHistory（active 默认 false）
        if (!this.investmentReturnHistoryPanel) {
            this.investmentReturnHistoryPanel = this.findDeep(this.node, 'InvestmentReturnHistory');
        }

        if (this.investmentReturnHistoryPanel && !this.investmentReturnHistoryTotalLabel) {
            const totalNode = this.findDeep(this.investmentReturnHistoryPanel, 'Number');
            this.investmentReturnHistoryTotalLabel =
                totalNode?.getComponent(Label) ?? totalNode?.getComponentInChildren(Label) ?? null;
        }

        if (this.investmentReturnHistoryPanel && !this.investmentReturnHistoryHistoryProtoNode) {
            this.investmentReturnHistoryHistoryProtoNode = this.findDeep(this.investmentReturnHistoryPanel, 'History');
            this.investmentReturnHistoryHistoryProtoLabel =
                this.investmentReturnHistoryHistoryProtoNode?.getComponent(Label) ??
                this.investmentReturnHistoryHistoryProtoNode?.getComponentInChildren(Label) ??
                null;
            this.investmentReturnHistoryHistoryParent =
                this.investmentReturnHistoryHistoryProtoNode?.parent ?? null;
        }
    }

    /** 历史请求失败或异常：关闭看板并恢复主界面可操作，避免 investmentReturnHistoryOpen 卡死 */
    private resetHistoryPanelAfterError() {
        this.investmentReturnHistoryOpen = false;
        if (this.investmentReturnHistoryPanel) this.investmentReturnHistoryPanel.active = false;
        if (this._lastPayload) this.applyInteractableFromPayload(this._lastPayload);
    }

    private closeInvestmentReturnHistoryPanel() {
        this.investmentReturnHistoryOpen = false;
        if (this.investmentReturnHistoryDynamicNodes.length > 0) {
            for (const n of this.investmentReturnHistoryDynamicNodes) n.destroy();
            this.investmentReturnHistoryDynamicNodes = [];
        }
        if (this.investmentReturnHistoryPanel) this.investmentReturnHistoryPanel.active = false;
        // 回到主玩法交互态（基于最新 sync）
        if (this._lastPayload) this.applyPayload(this._lastPayload);
    }

    private openInvestmentReturnHistoryPanel = async () => {
        if (!this.ws.isConnected()) {
            this.showError('网络未连接');
            return;
        }

        this.ensureInvestmentReturnHistoryPanelReady();
        if (!this.investmentReturnHistoryPanel || !this.investmentReturnHistoryTotalLabel || !this.investmentReturnHistoryHistoryProtoNode || !this.investmentReturnHistoryHistoryProtoLabel) {
            this.showError('历史看板节点未就绪');
            return;
        }

        // 面板打开时：禁止主玩法交互（避免你点着点着又下注）
        this.investmentReturnHistoryOpen = true;
        this.investmentReturnHistoryPanel.active = true;
        // 若尚未拿到 sync payload，先手动禁用，避免用户误操作
        if (this.editBox) (this.editBox as any).enabled = false;
        for (const item of this.optionItems) item.btn.interactable = false;
        if (this.confirmButtonComp) this.confirmButtonComp.interactable = false;
        if (this._lastPayload) this.applyPayload(this._lastPayload);

        // 清理上一次动态复制的行
        if (this.investmentReturnHistoryDynamicNodes.length > 0) {
            for (const n of this.investmentReturnHistoryDynamicNodes) n.destroy();
            this.investmentReturnHistoryDynamicNodes = [];
        }

        // 先展示加载态（使用你场景里已有的 History 文本作为第一行模板）
        this.investmentReturnHistoryTotalLabel.string = '今日总收益：加载中...';
        this.investmentReturnHistoryHistoryProtoLabel.string = '加载中...';

        await this.requestInvestmentReturnHistory();
    };

    private async requestInvestmentReturnHistory() {
        if (this._requestingHistory) return;
        this._requestingHistory = true;

        this.ws.request(
            'minigame2_return_history_sync',
            {},
            (resp: any) => {
                this._requestingHistory = false;
                if (resp?.success && resp?.data) {
                    this.populateInvestmentReturnHistory(resp.data);
                    return;
                }
                const msg = String(resp?.message ?? '获取回报历史失败').replace(/\\n/g, '\n');
                // 失败时必须退出「历史独占」态，否则主界面 EditBox/类目会一直禁用
                this.resetHistoryPanelAfterError();
                this.showError(msg);
            },
            true,
            15000
        );
    }

    private populateInvestmentReturnHistory(data: any) {
        const total = Math.floor(Number(data?.total_profit ?? 0));
        if (this.investmentReturnHistoryTotalLabel) {
            // 文案改为“最近收益：0”（最近若干期总和），避免与自然日强绑定引起困惑
            this.investmentReturnHistoryTotalLabel.string = `最近收益：${total}`;
        }
        if (!this.investmentReturnHistoryHistoryProtoLabel) return;

        // 清掉之前的动态行（即使以后不再创建，也安全防御一下）
        if (this.investmentReturnHistoryDynamicNodes.length > 0) {
            for (const n of this.investmentReturnHistoryDynamicNodes) n.destroy();
            this.investmentReturnHistoryDynamicNodes = [];
        }

        const list: any[] = Array.isArray(data?.history) ? data.history : [];
        if (list.length === 0) {
            this.investmentReturnHistoryHistoryProtoLabel.string = '暂无记录';
            return;
        }

        const formatLine = (timeKeyOrHm: string, catName: string, profit: number) => {
            return `[${timeKeyOrHm}] ${catName} | 收益 ${profit}`;
        };

        const lines: string[] = [];
        for (const it of list) {
            const timeKeyOrHm = String(it?.close_time_key ?? it?.close_time_hm ?? '');
            const catName = String(it?.winner_category_name ?? it?.winner_key ?? '');
            const profit = Math.floor(Number(it?.profit ?? 0));
            lines.push(formatLine(timeKeyOrHm, catName, profit));
        }
        this.investmentReturnHistoryHistoryProtoLabel.string = lines.join('\n');
    }

    private onBackControl = () => {
        // 返回按钮：优先关闭 InvestmentReturnHistory，否则关闭 MiniGame2 面板
        if (this.investmentReturnHistoryOpen) {
            this.closeInvestmentReturnHistoryPanel();
            return;
        }
        this.node.active = false;
    };

    private requestSync() {
        if (!this.ws.isConnected()) return;
        this.ws.request(
            'minigame2_sync',
            {},
            (resp: any) => {
                if (resp?.success && resp?.data) {
                    this.applyPayload(resp.data as MiniGame2SyncPayload);
                }
            },
            true,
            12000
        );
    }

    private applyInteractableFromPayload(p: MiniGame2SyncPayload) {
        const canBetBase = !p.round_drawn && (p.seconds_until_close ?? 0) > 0;
        const canBet = canBetBase && !this.investmentReturnHistoryOpen;

        if (this.editBox) {
            (this.editBox as any).enabled = canBet;
        }
        for (const item of this.optionItems) {
            item.btn.interactable = canBet;
        }

        if (this.confirmButtonComp) {
            this.confirmButtonComp.interactable = canBet && this.selectedKey != null;
        }
        this.updateOptionVisual();
    }

    private applyPayload(p: MiniGame2SyncPayload) {
        this._lastPayload = p;

        const rows = this.resolveCategoryRows(p);
        this._displayRows = rows;

        // 当前期数：issue_key 是轮次开始时间（YYYYMMDDHH）
        if (this.currentIssueLabel) {
            const ik = String(p.issue_key ?? '').trim();
            this.currentIssueLabel.string = ik ? `当前期：${ik}` : '当前期：-';
        }

        // 本期已投资明细：多类目累计（名称以 sync 类目为准）
        if (this.myBetsLabel) {
            const bets = Array.isArray(p.my_bets) ? p.my_bets : [];
            const total = Math.floor(Number(p.my_bet_total ?? 0));
            if (bets.length === 0) {
                this.myBetsLabel.string = '本期已投资：无';
            } else {
                const lines: string[] = [];
                for (const b of bets) {
                    const key = String((b as any)?.selected_key ?? '').trim();
                    const amt = Math.floor(Number((b as any)?.bet_amount ?? 0));
                    if (!key || !Number.isFinite(amt) || amt <= 0) continue;
                    const name = rows.find((r) => r.key === key)?.name ?? key;
                    lines.push(`${name} x ${amt}`);
                }
                if (!lines.length) {
                    this.myBetsLabel.string = '本期已投资：无';
                } else {
                    const detail = lines.join('，');
                    this.myBetsLabel.string =
                        total > 0 ? `本期已投资：合计 ${total}（${detail}）` : `本期已投资：${detail}`;
                }
            }
        }

        const energyStr = String(p.energy_blocks ?? 0);
        if (this.energyAvailableLabel) this.energyAvailableLabel.string = energyStr;
        if (this.topEnergyLabel) this.topEnergyLabel.string = energyStr;

        // 倒计时刷新基准
        if (p.server_time) {
            const parsed = this.parseServerTimeToMs(p.server_time);
            if (parsed != null) {
                this._serverTimeBaseMs = parsed;
                this._serverTimeRecvAtMs = Date.now();
                const sec = p.round_drawn ? 0 : p.seconds_until_close ?? 0;
                this._roundCloseMs = parsed + sec * 1000;
            }
        }
        if (this.countdownLabel) {
            this.countdownLabel.string = p.round_drawn ? '已开奖' : this.fmtHMS(p.seconds_until_close ?? 0);
        }
        if (p.round_drawn && this.currentSelectionLabel) {
            const wk = String(p.winner_key ?? '').trim();
            const wn = wk ? this.rowDisplayName(wk) : '';
            if (wn) this.currentSelectionLabel.string = `本期开奖：${wn}`;
        }

        const sig = this.categoryStructureSig(rows);
        const needRebuild = sig !== this._optionCategorySig || this.optionItems.length !== rows.length;
        if (needRebuild) {
            void this.rebuildOptionItems(rows, ++this._rebuildToken);
        } else {
            this.applyInteractableFromPayload(p);
        }
    }

    private showError(text: string) {
        console.warn('[MiniGame2]', text);
        if (!this.errorPanel) return;

        // 若之前没找到 Label，这里再兜底找一次，优先直系子节点名为 "Label" 的主文案
        if (!this.errorLabel) {
            const directChildLabelNode =
                this.errorPanel.children.find((c) => c.name === 'Label') ?? null;
            this.errorLabel =
                directChildLabelNode?.getComponent(Label) ??
                this.findDeep(this.errorPanel, 'Label')?.getComponent(Label) ??
                this.errorPanel.getComponentInChildren(Label);
        }
        if (!this.errorLabel) return;

        // 错误提示：只显示文案，隐藏确认/取消按钮
        if (this.errorConfirmNode) this.errorConfirmNode.active = false;
        if (this.errorCancelNode) this.errorCancelNode.active = false;

        this.errorLabel.string = text;
        if (this.mainTipLabel) this.mainTipLabel.string = text;
        this.errorPanel.active = true;
        setTimeout(() => {
            if (this.errorPanel?.isValid) this.errorPanel.active = false;
        }, 1400);
    }

    private showConfirmInvest(text: string, amount: number, key: string) {
        if (!this.errorPanel) return;

        this._pendingBetAmount = amount;
        this._pendingBetKey = key;

        if (!this.errorLabel) {
            const directChildLabelNode =
                this.errorPanel.children.find((c) => c.name === 'Label') ?? null;
            this.errorLabel =
                directChildLabelNode?.getComponent(Label) ??
                this.findDeep(this.errorPanel, 'Label')?.getComponent(Label) ??
                this.errorPanel.getComponentInChildren(Label) ??
                null;
        }
        if (!this.errorLabel) return;

        this.errorLabel.string = text;
        if (this.mainTipLabel) this.mainTipLabel.string = text;
        if (this.errorConfirmNode) this.errorConfirmNode.active = true;
        if (this.errorCancelNode) this.errorCancelNode.active = true;
        this.errorPanel.active = true;
    }

    private onErrorConfirmClick = () => {
        if (!this.ws.isConnected()) {
            this.showError('网络未连接');
            return;
        }
        if (this._requestingBet) return;

        const amount = this._pendingBetAmount;
        const key = this._pendingBetKey;
        if (!amount || !key) {
            this.errorPanel && (this.errorPanel.active = false);
            return;
        }

        // 关闭确认框，开始真正下注
        if (this.errorPanel) this.errorPanel.active = false;
        if (this.errorConfirmNode) this.errorConfirmNode.active = false;
        if (this.errorCancelNode) this.errorCancelNode.active = false;

        this._requestingBet = true;
        if (this.confirmButtonComp) this.confirmButtonComp.interactable = false;

        this.ws.request(
            'minigame2_bet',
            {
                selected_key: key,
                bet_amount: amount,
            },
            (resp: any) => {
                this._requestingBet = false;
                if (resp?.success && resp?.data) {
                    const data = resp.data as MiniGame2SyncPayload;
                    this.applyPayload(data);
                    // 服务端支持同一期多类目累计下注：这里只提示“本次请求”的类目与金额即可
                    const respSelected = (resp?.data as any)?.selected_key;
                    const respAmt = (resp?.data as any)?.bet_amount;
                    if (respSelected && respAmt) {
                        const catName = this.rowDisplayName(String(respSelected));
                        this.showError(`已投资 ${respAmt} 到 ${catName}`);
                    } else {
                        this.showError('投资成功');
                    }
                } else {
                    const msg = String(resp?.message ?? '下注失败').replace(/\\n/g, '\n');
                    this.showError(msg);
                    if (this._lastPayload) this.applyPayload(this._lastPayload);
                }
                // 用完以后清掉 pending
                this._pendingBetAmount = null;
                this._pendingBetKey = null;
            },
            true,
            15000
        );
    };

    private onErrorCancelClick = () => {
        // 取消：只关闭确认框，不扣钱
        this._pendingBetAmount = null;
        this._pendingBetKey = null;
        if (this.errorConfirmNode) this.errorConfirmNode.active = false;
        if (this.errorCancelNode) this.errorCancelNode.active = false;
        if (this.errorPanel) this.errorPanel.active = false;
    };

    private onConfirmInvestmentClick() {
        if (!this.ws.isConnected()) {
            this.showError('网络未连接');
            return;
        }
        if (this._requestingBet) return;

        const payload = this._lastPayload;
        if (!payload) return;
        if (payload.round_drawn || (payload.seconds_until_close ?? 0) <= 0) {
            this.showError('已到开奖时间');
            return;
        }

        if (!this.editBox) {
            this.showError('缺少投资输入框');
            return;
        }

        const raw = (this.editBox.string ?? '').trim();
        const amt = Math.floor(Number(raw));
        if (!Number.isFinite(amt) || amt < MIN_BET_AMOUNT || amt > MAX_BET_AMOUNT) {
            this.showError(`无效下注金额（范围 ${MIN_BET_AMOUNT}-${MAX_BET_AMOUNT}）`);
            return;
        }
        if (!this.selectedKey) {
            this.showError('请选择期货类目');
            return;
        }

        const catName = this.rowDisplayName(this.selectedKey);
        this.showConfirmInvest(`确认投资 ${amt} 到 ${catName} 吗？`, amt, this.selectedKey);
    }
}

