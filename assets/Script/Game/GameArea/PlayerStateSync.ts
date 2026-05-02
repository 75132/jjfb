import { _decorator, Component, Label } from 'cc';
import { WebSocketManager } from '../../global/WebSocketManager';
import { PlayerGridMove } from './PlayerGridMove';
import { PlayerAnimRuntime } from './PlayerAnimRuntime';

const { ccclass, property } = _decorator;

@ccclass('PlayerStateSync')
export class PlayerStateSync extends Component {
    @property({ type: PlayerGridMove, tooltip: '玩家移动脚本（用于设置坐标/形象前缀）' })
    playerMove: PlayerGridMove | null = null;

    @property({ type: PlayerAnimRuntime, tooltip: '运行时动画注入器（推荐绑定）' })
    animRuntime: PlayerAnimRuntime | null = null;

    @property({ tooltip: '地图ID（当前固定 1）' })
    mapId = 1;

    @property({ tooltip: '是否用服务器 Sprite 强制覆盖本地 animPrefix（推荐开启，网游权威形象）' })
    syncAnimPrefixFromServer = true;
    private ws: WebSocketManager = null!;
    private restored = false;
    private _nameLabel: Label | null = null;

    private _resolveNameLabel() {
        if (this._nameLabel) return this._nameLabel;
        const n = this.node.getChildByName('Name');
        this._nameLabel = n?.getComponent(Label) ?? null;
        return this._nameLabel;
    }

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        this.ws.on('player_info_response', this.onPlayerInfo, this);
        this.ws.on('player_info', this.onPlayerInfo, this);
        this.playerMove?.onStep(null); // 保留纯本地移动，不做网络上报
    }

    start() {
        this.requestRestore();
    }

    onDestroy() {
        this.ws?.off('player_info_response', this.onPlayerInfo, this);
        this.ws?.off('player_info', this.onPlayerInfo, this);
        this.playerMove?.onStep(null);
    }

    public requestRestore() {
        const cid = this.ws.getCharacterId();
        if (!cid || this.restored) return;
        this.ws.request('get_player', { character_id: cid, map_id: this.mapId }, undefined, true, 10000);
    }

    private onPlayerInfo = (resp: any) => {
        const data = resp?.data && typeof resp.data === 'object' ? { ...resp, ...resp.data } : resp;
        if (!data || data.success !== true || data.is_self !== true) return;

        const roleName = String(data.role_name ?? '');

        const pos = data.position || {};
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        // 本地玩家名字显示：写入 Player.prefab 下挂的 Name/Label。
        const nameLabel = this._resolveNameLabel();
        if (nameLabel) {
            nameLabel.string = roleName;
            if (nameLabel.node) nameLabel.node.active = roleName.length > 0;
        }

        // 只在首次进入时用服务器权威坐标覆盖，避免后续打断本地移动。
        if (!this.restored) {
            this.playerMove?.setPixelPosition(x, y, true);
            this.playerMove?.markServerRestored();
            this.restored = true;
        }

        const spriteIndex = Number(data.Sprite || 0);
        if (this.syncAnimPrefixFromServer && spriteIndex > 0) {
            this.animRuntime?.applyServerSprite(spriteIndex);
        }
    };

}

