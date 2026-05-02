import { _decorator, Component, Node, EditBox, Button, Label } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('ChangePasswordPanel')
export class ChangePasswordPanel extends Component {
    @property(Node)
    loginPanelNode: Node = null!;

    @property(Node)
    changePasswordPanelNode: Node = null!;

    @property(EditBox)
    accountEditBox: EditBox = null!;

    @property(EditBox)
    oldPasswordEditBox: EditBox = null!;

    @property(EditBox)
    newPasswordEditBox: EditBox = null!;

    @property(Button)
    changeButton: Button = null!;

    @property(Button)
    backButton: Button = null!;

    @property(Label)
    tipLabel: Label = null!;

    private webSocketManager: WebSocketManager = null!;
    private isChanging: boolean = false;
    // 断开对 Login 的 import 循环依赖：改密成功后通过回调通知 Login 更新提示文案
    private _onAfterChangeSuccessTip: ((msg: string) => void) | null = null;

    start() {
        this.webSocketManager = WebSocketManager.getInstance();
        if (this.changeButton && this.changeButton.node) {
            this.changeButton.node.on(Button.EventType.CLICK, this.onChangeClick, this);
        }
        if (this.backButton && this.backButton.node) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
        }
        if (this.tipLabel) this.tipLabel.string = '';
    }

    openFromLogin(defaultAccount: string, onAfterChangeSuccessTip?: (msg: string) => void) {
        this._onAfterChangeSuccessTip = onAfterChangeSuccessTip ?? null;
        if (this.accountEditBox) this.accountEditBox.string = defaultAccount || '';
        if (this.oldPasswordEditBox) this.oldPasswordEditBox.string = '';
        if (this.newPasswordEditBox) this.newPasswordEditBox.string = '';
        if (this.tipLabel) this.tipLabel.string = '';
        if (this.loginPanelNode) this.loginPanelNode.active = false;
        if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = true;
    }

    private onChangeClick() {
        if (this.isChanging) return;

        const account = this.accountEditBox?.string?.trim() || '';
        const oldPassword = this.oldPasswordEditBox?.string || '';
        const newPassword = this.newPasswordEditBox?.string || '';

        if (!account || !oldPassword || !newPassword) {
            if (this.tipLabel) this.tipLabel.string = '账号、旧密码、新密码不能为空';
            return;
        }
        if (oldPassword === newPassword) {
            if (this.tipLabel) this.tipLabel.string = '新密码不能与旧密码相同';
            return;
        }
        if (newPassword.length < 6) {
            if (this.tipLabel) this.tipLabel.string = '新密码长度至少6位';
            return;
        }

        this.isChanging = true;
        if (this.changeButton) this.changeButton.interactable = false;
        if (this.tipLabel) this.tipLabel.string = '修改中...';

        this.webSocketManager.request(
            GameConfig.MESSAGE_TYPES.CHANGE_PASSWORD,
            {
                account: account,
                old_password: oldPassword,
                new_password: newPassword
            },
            (response: any) => {
                this.isChanging = false;
                if (this.changeButton) this.changeButton.interactable = true;

                if (!response || response.code === 408) {
                    if (this.tipLabel) this.tipLabel.string = '请求超时，请重试';
                    return;
                }

                if (response.success) {
                    if (this.tipLabel) this.tipLabel.string = '密码修改成功，请登录';
                    if (this.oldPasswordEditBox) this.oldPasswordEditBox.string = '';
                    if (this.newPasswordEditBox) this.newPasswordEditBox.string = '';
                    if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false;
                    if (this.loginPanelNode) this.loginPanelNode.active = true;

                    // 不自动登录：改密成功后仅回到登录页提示，不保存新token
                    if (this._onAfterChangeSuccessTip) {
                        this._onAfterChangeSuccessTip('密码修改成功，请使用新密码登录');
                    }
                    return;
                }

                const errMsg = response.message || '密码修改失败';
                if (this.tipLabel) this.tipLabel.string = errMsg;
            },
            false,
            10000
        );
    }

    private onBackClick() {
        if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false;
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.tipLabel) this.tipLabel.string = '';
    }

    onDestroy() {
        if (this.changeButton && this.changeButton.node) {
            this.changeButton.node.off(Button.EventType.CLICK, this.onChangeClick, this);
        }
        if (this.backButton && this.backButton.node) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
        }
    }
}
