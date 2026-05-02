import { _decorator, Component, Node, Label, Sprite, Color, Button, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

export enum FriendItemMode {
    FRIEND = 0,          // 好友列表
    REQUEST = 1,         // 申请列表（同意 / 拒绝）
    SEARCH_RESULT = 2,   // 搜索结果（查看 / 添加）
}

@ccclass('FriendItem')
export class FriendItem extends Component {
    // ====== 基础 UI 引用 ======
    @property(Sprite)
    public avatarSprite: Sprite = null!;

    @property([SpriteFrame])
    public avatarFrames: SpriteFrame[] = [];

    @property(Label)
    public nameLabel: Label = null!;

    @property(Label)
    public statusLabel: Label = null!;

    @property(Node)
    public setButton: Node = null!;          // `Set` 按钮本体

    @property(Node)
    public setPanelBG: Node = null!;        // `Set/BG` 面板（包含两个按钮）

    @property(Label)
    public leftActionLabel: Label = null!;  // `Character` / `同意` / `查看`

    @property(Label)
    public rightActionLabel: Label = null!; // `Delete` / `拒绝` / `添加好友`

    @property(Button)
    public leftActionButton: Button = null!;

    @property(Button)
    public rightActionButton: Button = null!;

    // ====== 颜色配置 ======
    /** 离线颜色 A5A5A5 */
    private readonly offlineColor = new Color(0xA5, 0xA5, 0xA5, 0xFF);
    /** 在线颜色 50FFD5 */
    private readonly onlineColor = new Color(0x50, 0xFF, 0xD5, 0xFF);

    // ====== 数据 ======
    public characterId: string = '';   // 服务器角色ID
    public friendId: string = '';      // 好友六位ID
    public spriteIndex: number = 0;    // Sprite 数值（服务器返回从 1 开始：1、2、3...）
    public roleName: string = '';      // 角色名
    public isOnline: boolean = false;
    public mode: FriendItemMode = FriendItemMode.FRIEND;

    // 由 FriendPanel 在实例化后注入的回调（保持客户端只做显示 / 发送请求）
    public onOpenSetPanel: (item: FriendItem) => void = null!;
    public onLeftAction: (item: FriendItem) => void = null!;
    public onRightAction: (item: FriendItem) => void = null!;

    onLoad() {
        if (this.setButton) {
            this.setButton.on(Node.EventType.TOUCH_END, this.handleSetClick, this);
        }
        if (this.leftActionButton) {
            this.leftActionButton.node.on(Node.EventType.TOUCH_END, this.handleLeftActionClick, this);
        }
        if (this.rightActionButton) {
            this.rightActionButton.node.on(Node.EventType.TOUCH_END, this.handleRightActionClick, this);
        }

        if (this.setPanelBG) {
            this.setPanelBG.active = false;
        }
    }

    public init(
        opts: {
            characterId: string;
            friendId: string;
            spriteIndex: number;
            roleName: string;
            isOnline: boolean;
            mode: FriendItemMode;
        },
        callbacks: {
            onOpenSetPanel?: (item: FriendItem) => void;
            onLeftAction?: (item: FriendItem) => void;
            onRightAction?: (item: FriendItem) => void;
        } = {}
    ): void {
        this.characterId = opts.characterId;
        this.friendId = opts.friendId;
        this.spriteIndex = opts.spriteIndex;
        this.roleName = opts.roleName;
        this.isOnline = opts.isOnline;
        this.mode = opts.mode;

        this.onOpenSetPanel = callbacks.onOpenSetPanel || null!;
        this.onLeftAction = callbacks.onLeftAction || null!;
        this.onRightAction = callbacks.onRightAction || null!;

        this.refreshView();
    }

    /** 根据当前数据刷新 UI（头像 / 名字 / 状态 / 按钮文字） */
    public refreshView(): void {
        if (this.nameLabel) {
            this.nameLabel.string = this.roleName || '';
        }
        if (this.statusLabel) {
            this.statusLabel.string = this.isOnline ? '在线' : '离线';
            this.statusLabel.color = this.isOnline ? this.onlineColor : this.offlineColor;
        }
        this.refreshAvatar();
        this.refreshButtons();
    }

    /** 根据 Sprite 数值设置头像（服务器返回的 Sprite 值从 1 开始，需要减 1 转换为数组索引） */
    private refreshAvatar(): void {
        if (!this.avatarSprite || !this.avatarFrames.length) {
            return;
        }
        // 服务器返回的 Sprite 值从 1 开始（1, 2, 3...），数组索引从 0 开始（0, 1, 2...），需要减 1
        const idx = Math.max(0, Math.min(this.spriteIndex - 1, this.avatarFrames.length - 1));
        if (idx >= 0 && idx < this.avatarFrames.length && this.avatarFrames[idx]) {
            this.avatarSprite.spriteFrame = this.avatarFrames[idx];
        }
    }

    /** 刷新 Set 面板两个按钮的文案（根据不同模式切换） */
    private refreshButtons(): void {
        if (!this.leftActionLabel || !this.rightActionLabel) {
            return;
        }
        switch (this.mode) {
            case FriendItemMode.FRIEND:
                this.leftActionLabel.string = '角色';
                this.rightActionLabel.string = '删除';
                break;
            case FriendItemMode.REQUEST:
                this.leftActionLabel.string = '同意';
                this.rightActionLabel.string = '拒绝';
                break;
            case FriendItemMode.SEARCH_RESULT:
                this.leftActionLabel.string = '查看';
                this.rightActionLabel.string = '添加好友';
                break;
        }
    }

    private handleSetClick(): void {
        if (this.setPanelBG) {
            this.setPanelBG.active = true;
        }
        if (this.onOpenSetPanel) {
            this.onOpenSetPanel(this);
        }
    }

    private handleLeftActionClick(): void {
        if (this.onLeftAction) {
            this.onLeftAction(this);
        }
    }

    private handleRightActionClick(): void {
        if (this.onRightAction) {
            this.onRightAction(this);
        }
    }

    /** 关闭 Set 面板（由 FriendPanel 和 BackControl 调用） */
    public closeSetPanel(): void {
        if (this.setPanelBG) {
            this.setPanelBG.active = false;
        }
    }

    /** 检查 Set 面板是否打开 */
    public isSetPanelOpen(): boolean {
        return this.setPanelBG ? this.setPanelBG.active : false;
    }
}


