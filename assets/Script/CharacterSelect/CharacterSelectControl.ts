import { _decorator, Component, Node, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
const { ccclass, property } = _decorator;

/**
 * 示例/调试用组件。请勿挂到选角场景根节点：`update` 在断线时每帧 `loadScene` 会导致严重问题。
 * 若需断线回登录，请使用 WebSocketControl / WebSocketManager 的统一策略。
 */
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
            director.loadScene(GameConfig.SCENE_NAMES.LOGIN);
        }
    }
}
