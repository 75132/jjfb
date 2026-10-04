import { _decorator, BlockInputEvents, Button, Color, Component, director, Label, Node } from 'cc';
import { Logger } from './Logger';

const { ccclass, property } = _decorator;

export type TipWindowsShowOptions = {
    message: string;
    confirmText?: string;
    cancelText?: string;
    /** 默认 true；为 false 时仅显示确定按钮 */
    showCancel?: boolean;
    /** 大于 0 时自动关闭（用于替代背包 ErrorTips 的短暂提示） */
    autoCloseMs?: number;
    /** 文案颜色，默认白色 */
    messageColor?: Color;
};

/**
 * 全局通用提示窗（TipWindows 预制体）。
 * Game 场景 Canvas 下需有名为 TipWindows 的节点；首次调用时自动挂载本组件。
 */
@ccclass('TipWindows')
export class TipWindows extends Component {
    private static _instance: TipWindows | null = null;

    @property(Label)
    messageLabel: Label | null = null;

    @property(Node)
    confirmButton: Node | null = null;

    @property(Node)
    cancelButton: Node | null = null;

    private _onConfirm: (() => void) | null = null;
    private _onCancel: (() => void) | null = null;
    private _autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
    private _initialized = false;
    /** 节点首次激活时 onLoad 会晚于 open，避免把刚打开的窗口又关掉 */
    private _opening = false;

    public static getInstance(): TipWindows | null {
        if (TipWindows._instance?.isValid) {
            return TipWindows._instance;
        }
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const node = canvas?.getChildByName('TipWindows') ?? scene?.getChildByName('TipWindows');
        if (!node) {
            Logger.warn('[TipWindows] 场景中未找到 TipWindows 节点');
            return null;
        }
        const comp = node.getComponent(TipWindows);
        if (!comp) {
            Logger.warn('[TipWindows] 预制体上未挂载 TipWindows 组件，请在编辑器中绑定');
            return null;
        }
        return comp;
    }

    /** 进场景时预热组件，避免首次弹出时初始化竞态 */
    public static warmup(): void {
        const tip = TipWindows.getInstance();
        tip?.initialize();
    }

    onLoad(): void {
        this.initialize();
        if (!this._opening) {
            this.node.active = false;
        }
    }

    onEnable(): void {
        this.bindButtons();
    }

    onDestroy(): void {
        this.clearAutoClose();
        if (TipWindows._instance === this) {
            TipWindows._instance = null;
        }
        this._initialized = false;
    }

    /** 双按钮确认框 */
    public showConfirm(
        message: string,
        onConfirm: () => void,
        onCancel?: () => void,
        options?: Partial<TipWindowsShowOptions>,
    ): void {
        this.open({
            message,
            showCancel: true,
            autoCloseMs: 0,
            ...options,
        }, onConfirm, onCancel);
    }

    public isVisible(): boolean {
        return this.node.active;
    }

    /** 单按钮或自动关闭提示（替代背包 ErrorTips） */
    public showAlert(message: string, onOk?: () => void, options?: Partial<TipWindowsShowOptions>): void {
        this.open({
            message,
            showCancel: false,
            autoCloseMs: options?.autoCloseMs ?? 2000,
            ...options,
        }, onOk);
    }

    private initialize(): void {
        if (TipWindows._instance && TipWindows._instance !== this) {
            this.destroy();
            return;
        }
        if (this._initialized) return;
        this._initialized = true;
        TipWindows._instance = this;
        this.resolveRefs();
        this.bindButtons();
    }

    /** 正文 Label：根节点下名为 Label 的直系子节点（不是 Confirm/Cancel/MASK 里的） */
    private findMessageLabel(): Label | null {
        for (const child of this.node.children) {
            if (child.name !== 'Label') continue;
            const lbl = child.getComponent(Label);
            if (lbl) return lbl;
        }
        return null;
    }

    private resolveRefs(): void {
        const foundLabel = this.findMessageLabel();
        if (foundLabel) {
            this.messageLabel = foundLabel;
        }
        if (!this.confirmButton) {
            this.confirmButton = this.node.getChildByName('Confirm');
        }
        if (!this.cancelButton) {
            this.cancelButton = this.node.getChildByName('Cancel');
        }
    }

    private prepareMaskLayer(): void {
        const mask = this.node.getChildByName('MASK');
        if (!mask) return;
        mask.setSiblingIndex(0);
        const maskBtn = mask.getComponent(Button);
        if (maskBtn) {
            maskBtn.interactable = false;
            maskBtn.enabled = false;
        }
        if (!mask.getComponent(BlockInputEvents)) {
            mask.addComponent(BlockInputEvents);
        }
    }

    private bringButtonsToFront(): void {
        if (this.confirmButton?.isValid) {
            this.confirmButton.setSiblingIndex(this.node.children.length - 1);
        }
        if (this.cancelButton?.isValid) {
            this.cancelButton.setSiblingIndex(this.node.children.length - 1);
        }
    }

    private bindButtons(): void {
        this.resolveRefs();
        const confirmBtn = this.confirmButton?.getComponent(Button);
        const cancelBtn = this.cancelButton?.getComponent(Button);
        if (confirmBtn) {
            confirmBtn.interactable = true;
            confirmBtn.node.off(Button.EventType.CLICK, this.onConfirmClick, this);
            confirmBtn.node.on(Button.EventType.CLICK, this.onConfirmClick, this);
        }
        if (cancelBtn) {
            cancelBtn.node.off(Button.EventType.CLICK, this.onCancelClick, this);
            cancelBtn.node.on(Button.EventType.CLICK, this.onCancelClick, this);
        }
    }

    private open(
        options: TipWindowsShowOptions,
        onConfirm?: () => void,
        onCancel?: () => void,
    ): void {
        this.initialize();
        this.resolveRefs();
        this.bindButtons();
        this.clearAutoClose();
        this._onConfirm = onConfirm ?? null;
        this._onCancel = onCancel ?? null;

        const label = this.messageLabel ?? this.findMessageLabel();
        if (label) {
            label.string = options.message;
            label.color = options.messageColor ?? new Color(255, 255, 255, 255);
        } else {
            Logger.warn('[TipWindows] 未找到正文 Label，无法显示:', options.message);
        }

        const showCancel = options.showCancel !== false && !!this.cancelButton;
        if (this.confirmButton) {
            this.confirmButton.active = true;
            const confirmBtn = this.confirmButton.getComponent(Button);
            if (confirmBtn) confirmBtn.interactable = true;
        }
        if (this.cancelButton) {
            this.cancelButton.active = showCancel;
            const cancelBtn = this.cancelButton.getComponent(Button);
            if (cancelBtn) cancelBtn.interactable = showCancel;
        }

        if (options.confirmText && this.confirmButton) {
            const lbl = this.confirmButton.getChildByName('Label')?.getComponent(Label);
            if (lbl) lbl.string = options.confirmText;
        }
        if (options.cancelText && this.cancelButton) {
            const lbl = this.cancelButton.getChildByName('Label')?.getComponent(Label);
            if (lbl) lbl.string = options.cancelText;
        }

        this.prepareMaskLayer();
        this._opening = true;
        this.node.active = true;
        this._opening = false;
        this.bringButtonsToFront();
        this.bringToFront();

        const autoCloseMs = options.autoCloseMs ?? 0;
        if (autoCloseMs > 0) {
            this._autoCloseTimer = setTimeout(() => this.hide(), autoCloseMs);
        }
    }

    public bringToFront(): void {
        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }
    }

    public close(): void {
        this.hide();
    }

    private hide(): void {
        this.clearAutoClose();
        this.node.active = false;
        this._onConfirm = null;
        this._onCancel = null;
    }

    private clearAutoClose(): void {
        if (this._autoCloseTimer) {
            clearTimeout(this._autoCloseTimer);
            this._autoCloseTimer = null;
        }
    }

    private onConfirmClick(): void {
        const cb = this._onConfirm;
        this.hide();
        cb?.();
    }

    private onCancelClick(): void {
        const cb = this._onCancel;
        this.hide();
        cb?.();
    }
}
