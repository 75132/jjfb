import { _decorator, Component, Node, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('CharacterSelectControl')
export class CharacterSelectControl extends Component {
    private wsManager: WebSocketManager = null!;

    start() {
        this.wsManager = WebSocketManager.getInstance();
        const token = this.wsManager.getToken();
    }

    // 新增：添加物品事件示例
    onAddItemClick() {
        // 示例：添加物品id为1，数量为32
        this.wsManager.send({
            type: GameConfig.MESSAGE_TYPES.ADD_ITEM,
            itemId: '1',
            quantity: 32,
            character_id: this.wsManager.getCharacterId() || undefined
        });
    }

    update(deltaTime: number) {
        if (this.wsManager && !this.wsManager.isConnected()) {
            console.warn('WebSocket已断开，返回登录场景');
            director.loadScene('Login');
        }
    }
}
