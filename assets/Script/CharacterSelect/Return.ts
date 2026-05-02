import { _decorator, Component, Button, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
const { ccclass, property } = _decorator;

@ccclass('Back')
export class Back extends Component {
    @property(Button)
    backBtn: Button = null!;

    // 修复点：返回按钮防抖，避免高频点击多次切场景
    private _backClicked: boolean = false;

    start() {
        if (this.backBtn && this.backBtn.node) {
            this.backBtn.node.on(Button.EventType.CLICK, this.onBackClick, this);
        }
    }

    onBackClick() {
        if (this._backClicked) {
            return;
        }
        this._backClicked = true;
        // 返回登录页必须是“彻底退出”，避免被本地 token 自动拉回角色选择。
        try {
            const ws = WebSocketManager.getInstance();
            ws.fullLogout();
        } catch {}
        director.loadScene('Login', (error) => {
            if (error) {
                console.error('❌ 返回登录场景失败:', error);
                // 修复点：加载失败时允许再次点击返回
                this._backClicked = false;
            }
        });
    }

    onDestroy() {
        if (this.backBtn && this.backBtn.node) {
            this.backBtn.node.off(Button.EventType.CLICK, this.onBackClick, this);
        }
    }
}
