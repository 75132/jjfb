import { _decorator, Component, Node } from 'cc';
import { WebSocketManager } from '../../global/WebSocketManager';
import { GameConfig } from '../../global/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('ChatRoom')
export class ChatRoom extends Component {
    @property({ type: Node }) fullPanel: Node | null = null;
    @property({ type: Node }) trigger: Node | null = null;

    private ws: WebSocketManager = null!;
    private _touchBound: boolean = false;

    start() {
        this.ws = WebSocketManager.getInstance();
        const target = this.trigger || this.findDefaultTrigger() || this.node;
        if (target && typeof (target as any).on === 'function') {
            target.on(Node.EventType.TOUCH_END, this.openFull, this);
            this._touchBound = true;
        }
    }

    onDisable() {
        const target = this.trigger || this.findDefaultTrigger() || this.node;
        try {
            if (this._touchBound && target && (target as any).isValid && typeof (target as any).off === 'function' && (target as any)._eventProcessor) {
                target.off(Node.EventType.TOUCH_END, this.openFull, this);
                this._touchBound = false;
            }
        } catch {}
    }

    onDestroy() {
        const target = this.trigger || this.findDefaultTrigger() || this.node;
        try {
            if (this._touchBound && target && (target as any).isValid && typeof (target as any).off === 'function' && (target as any)._eventProcessor) {
                target.off(Node.EventType.TOUCH_END, this.openFull, this);
            }
        } catch {}
    }

    private openFull() {
        if (!this.fullPanel) { this.fullPanel = this.findFullPanel(); }
        if (!this.fullPanel) { return; }
        this.fullPanel.active = true;
    }

    private findDefaultTrigger(): Node | null {
        const n = this.node.getChildByName('Button');
        return n || null;
    }

    private findFullPanel(): Node | null {
        const p = this.node.parent;
        if (!p) { return null; }
        const n = p.getChildByName('ChatRoomFull');
        return n || null;
    }
}
