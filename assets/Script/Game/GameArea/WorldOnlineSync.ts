import { _decorator, Animation, Component, instantiate, Label, Node, Prefab } from 'cc';
import { WebSocketManager } from '../../global/WebSocketManager';
import { PlayerAnimBank } from './PlayerAnimBank';
import { PlayerAnimRuntime } from './PlayerAnimRuntime';
import { PlayerGridMove } from './PlayerGridMove';
import { PlayerSceneRefs } from './PlayerSceneRefs';
import { PlayerStateSync } from './PlayerStateSync';
import { RemoteAvatarController } from './RemoteAvatarController';

const { ccclass, property } = _decorator;

type MoveDir = 'left' | 'right' | 'up' | 'down';

/**
 * 大世界同图多人在线：进入房间、同步他人、断线/切角/切号时清远端节点。
 * 服务端：world_enter / world_leave / world_step + 推送 world_player_* 
 */
@ccclass('WorldOnlineSync')
export class WorldOnlineSync extends Component {
    @property({
        type: Node,
        tooltip: '兜底父节点；未设 remoteMountRoot 时，优先用「本地 Player 的父节点」（与坐标系一致）',
    })
    worldRoot: Node | null = null;

    @property({
        type: Node,
        tooltip: '远端角色父节点，须与本地 Player 同一坐标系（多为 TiledMap）。留空则用本地 Player.node.parent，再空则用 World Root',
    })
    remoteMountRoot: Node | null = null;

    @property({ type: Prefab, tooltip: '与本地 Player 结构一致的预制体（勿挂本地输入同步组件亦可）' })
    remotePlayerPrefab: Prefab | null = null;

    @property({ type: PlayerGridMove, tooltip: '本地玩家，用于上报每格终点坐标' })
    localPlayerMove: PlayerGridMove | null = null;

    @property({ type: PlayerAnimBank, tooltip: '注入到远端实例的 PlayerAnimRuntime.bank' })
    animBank: PlayerAnimBank | null = null;

    @property({ tooltip: '地图 ID（须与 PlayerStateSync / 服务端一致）' })
    mapId = 1;

    @property({ tooltip: '关闭则不占网、不实例化他人' })
    enableOnline = true;

    @property({ tooltip: '每隔多少秒强制 world_enter 对齐同屏；0=关闭（重连/鉴权仍会拉一次）' })
    worldResyncSec = 15;

    private ws: WebSocketManager = null!;
    private readonly _remoteByCid = new Map<string, Node>();
    /** 远端 role_name 可能在 join/move 里不一定都有：缓存一下，确保“都显示”。 */
    private readonly _remoteRoleNameByCid = new Map<string, string>();
    /** world_enter / join 回调早于场景挂好时，父节点为空会静默丢包；缓存在此，update 再实例化（静止玩家只靠 others，无 move 补建） */
    private readonly _deferredRemoteRawByCid = new Map<string, any>();
    private _enteredCid: string | null = null;
    private _pendingEnter = false;
    private _lastEnterOkAt = 0;

    private _setRemoteNameLabel(node: Node, cid: string, roleName: unknown) {
        const label = node.getChildByName('Name')?.getComponent(Label) ?? null;
        if (!label) return;
        const s = String(roleName ?? '');
        if (s.length > 0) {
            this._remoteRoleNameByCid.set(cid, s);
        }
        const final = s.length > 0 ? s : (this._remoteRoleNameByCid.get(cid) ?? '');
        label.string = final;
        if (label.node) label.node.active = final.length > 0;
    }

    private _setLocalNameLabel(roleName: unknown) {
        const node = this.localPlayerMove?.node;
        if (!node || !node.isValid) return;
        const label = node.getChildByName('Name')?.getComponent(Label) ?? null;
        if (!label) return;
        const s = String(roleName ?? '');
        label.string = s;
        if (label.node) label.node.active = s.length > 0;
    }

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        this.ws.on('player_info_response', this.onSelfPlayerInfo, this);
        this.ws.on('player_info', this.onSelfPlayerInfo, this);
        this.ws.on('world_player_join', this.onWorldJoin, this);
        this.ws.on('world_player_leave', this.onWorldLeave, this);
        this.ws.on('world_player_move', this.onWorldMove, this);
        const node = (this.ws as any).node;
        if (node && typeof node.on === 'function') {
            node.on('data_changed', this.onDataChanged, this);
            node.on('network_connect', this.onNetworkConnect, this);
            node.on('network_disconnect', this.onNetworkDisconnect, this);
            node.on('auth_response', this.onAuthResponseWorld, this);
        }
        this.localPlayerMove?.onStep((dir, x, y) => this.onLocalStepEnd(dir, x, y));
    }

    start() {
        this.scheduleOnce(() => this.tryWorldEnterFallback(), 0.5);
        this.scheduleOnce(() => this._reassertRemoteConfigs(), 0.05);
        if (this.worldResyncSec > 0) {
            this.schedule(this._intervalResync, this.worldResyncSec);
        }
    }

    private _intervalResync = () => {
        this.fullResyncWorldPresence('interval');
    };

    /** 远端须与本地 Player 同一父节点坐标系（常见：TiledMap），否则坐标会落到「地图角」 */
    private _getRemoteParent(): Node | null {
        if (this.remoteMountRoot?.isValid) {
            return this.remoteMountRoot;
        }
        const lp = this.localPlayerMove?.node;
        if (lp?.parent?.isValid) {
            return lp.parent;
        }
        return this.worldRoot;
    }

    /** 防止预制体/编辑器里仍启用本地移动，抢远端表现 */
    private _configureRemoteInstance(node: Node) {
        if (!node?.isValid) return;
        const pgm = node.getComponent(PlayerGridMove);
        if (pgm) {
            pgm.enabled = false;
        }
        const st = node.getComponent(PlayerStateSync);
        if (st) {
            st.enabled = false;
        }
        const psr = node.getComponent(PlayerSceneRefs);
        if (psr) {
            psr.enabled = false;
        }
        const ac = node.getComponent(Animation);
        if (ac) {
            ac.playOnLoad = false;
        }
    }

    private _reassertRemoteConfigs() {
        this._remoteByCid.forEach((node) => this._configureRemoteInstance(node));
    }

    update(_dt: number) {
        if (this._deferredRemoteRawByCid.size === 0) {
            return;
        }
        const parent = this._getRemoteParent();
        if (!parent?.isValid || !this.remotePlayerPrefab) {
            return;
        }
        const batch = [...this._deferredRemoteRawByCid.values()];
        this._deferredRemoteRawByCid.clear();
        for (let i = 0; i < batch.length; i++) {
            this._spawnRemoteOnParent(batch[i], parent);
        }
    }

    onDestroy() {
        this.unschedule(this._intervalResync);
        this.localPlayerMove?.onStep(null);
        this.ws?.off('player_info_response', this.onSelfPlayerInfo, this);
        this.ws?.off('player_info', this.onSelfPlayerInfo, this);
        this.ws?.off('world_player_join', this.onWorldJoin, this);
        this.ws?.off('world_player_leave', this.onWorldLeave, this);
        this.ws?.off('world_player_move', this.onWorldMove, this);
        const node = (this.ws as any).node;
        if (node && typeof node.off === 'function') {
            node.off('data_changed', this.onDataChanged, this);
            node.off('network_connect', this.onNetworkConnect, this);
            node.off('network_disconnect', this.onNetworkDisconnect, this);
            node.off('auth_response', this.onAuthResponseWorld, this);
        }
        if (this._enteredCid && this.ws?.isConnected()) {
            this.ws.notify(
                'world_leave',
                { map_id: this.mapId, request_id: `wl_${Date.now()}` },
                true
            );
        }
        this._deferredRemoteRawByCid.clear();
        this.clearAllRemotes();
        this._enteredCid = null;
    }

    private onDataChanged = (ev: { reason?: string }) => {
        const r = ev?.reason;
        if (r === 'character_id_cleared' || r === 'all_cleared' || r === 'user_id_cleared') {
            this._deferredRemoteRawByCid.clear();
            this.clearAllRemotes();
            this._enteredCid = null;
            this._pendingEnter = false;
        }
    };

    private onSelfPlayerInfo = (resp: any) => {
        if (!this.enableOnline) return;
        const data = resp?.data && typeof resp.data === 'object' ? { ...resp, ...resp.data } : resp;
        if (!data || data.success !== true || data.is_self !== true) return;

        // 本地玩家名字显示：即使 PlayerStateSync 没挂在本地 Player 上，也能显示
        this._setLocalNameLabel(data.role_name);

        const pos = data.position || {};
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const cid = this.ws.getCharacterId();
        if (!cid) return;

        if (this._enteredCid === cid && Date.now() - this._lastEnterOkAt < 4000) {
            return;
        }
        if (this._pendingEnter) return;
        this._pendingEnter = true;
        this.ws.request(
            'world_enter',
            {
                map_id: this.mapId,
                x,
                y,
                facing: 'down',
                request_id: `we_pi_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
            },
            (r: any) => {
                this._pendingEnter = false;
                if (!r || r.success !== true) {
                    return;
                }
                this._applyEnterOthers(r, cid);
            },
            true,
            12000
        );
    };

    /** 无 player_info 时兜底（例如缓存直进游戏） */
    private tryWorldEnterFallback() {
        if (!this.enableOnline || this._enteredCid || this._pendingEnter) return;
        const cid = this.ws.getCharacterId();
        if (!cid || !this.ws.isConnected()) return;
        const mv = this.localPlayerMove;
        if (!mv) return;
        const p = mv.getPixelPosition();
        if (!Number.isFinite(p.x)) return;
        this._pendingEnter = true;
        this.ws.request(
            'world_enter',
            {
                map_id: this.mapId,
                x: p.x,
                y: p.y,
                facing: mv.getFacingDir(),
                request_id: `we_fb_${Date.now()}`,
            },
            (r: any) => {
                this._pendingEnter = false;
                if (!r || r.success !== true) return;
                this._applyEnterOthers(r, cid);
            },
            true,
            12000
        );
    }

    /** 重连 / 定时 / 鉴权后：用当前本地像素坐标再进房，拉全量 others（成熟做法：快照对齐） */
    private fullResyncWorldPresence(_source: string) {
        if (!this.enableOnline || !this.ws.isConnected()) return;
        const cid = this.ws.getCharacterId();
        if (!cid) return;
        const mv = this.localPlayerMove;
        if (!mv) return;
        const p = mv.getPixelPosition();
        if (!Number.isFinite(p.x)) return;
        if (this._pendingEnter) return;
        this._pendingEnter = true;
        this.ws.request(
            'world_enter',
            {
                map_id: this.mapId,
                x: p.x,
                y: p.y,
                facing: mv.getFacingDir(),
                request_id: `we_sync_${Date.now()}`,
            },
            (r: any) => {
                this._pendingEnter = false;
                if (!r?.success) return;
                this._applyEnterOthers(r, cid);
            },
            true,
            12000
        );
    }

    private _applyEnterOthers(r: any, cid: string) {
        const payload = r.data && typeof r.data === 'object' ? r.data : r;
        const others = payload.others ?? (r as any).others;
        const list = Array.isArray(others) ? others : [];
        this._enteredCid = cid;
        this._lastEnterOkAt = Date.now();
        this._deferredRemoteRawByCid.clear();
        this.clearAllRemotes();
        for (let i = 0; i < list.length; i++) {
            this.spawnOrUpdateRemote(list[i]);
        }
    }

    private onNetworkConnect = () => {
        this.scheduleOnce(() => this.fullResyncWorldPresence('net'), 0.45);
    };

    private onNetworkDisconnect = () => {
        this._enteredCid = null;
        this._pendingEnter = false;
        this._deferredRemoteRawByCid.clear();
        this.clearAllRemotes();
    };

    private onAuthResponseWorld = (data: any) => {
        if (data?.success) {
            this.scheduleOnce(() => this.fullResyncWorldPresence('auth'), 0.35);
        }
    }

    private onLocalStepEnd(dir: MoveDir, x: number, y: number) {
        if (!this.enableOnline || !this._enteredCid || !this.ws.isConnected()) return;
        this.ws.notify(
            'world_step',
            {
                map_id: this.mapId,
                x,
                y,
                facing: dir,
                moving: false,
                request_id: `ws_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
            },
            true
        );
    }

    private onWorldJoin = (msg: any) => {
        if (!this.enableOnline) return;
        const selfCid = this.ws.getCharacterId();
        const p = msg?.player || msg?.data?.player;
        if (!p || !p.character_id) return;
        if (String(p.character_id) === String(selfCid)) return;
        this.spawnOrUpdateRemote(p);
    };

    private onWorldLeave = (msg: any) => {
        const cid = msg?.character_id ?? msg?.data?.character_id;
        if (!cid) return;
        this.removeRemote(String(cid));
    };

    private onWorldMove = (msg: any) => {
        if (!this.enableOnline) return;
        const selfCid = this.ws.getCharacterId();
        const cid = msg?.character_id;
        if (!cid || String(cid) === String(selfCid)) return;
        const pos = msg.position || msg?.data?.position;
        if (!pos) return;
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const facing = String(msg.facing || 'down');
        const moving = Boolean(msg.moving);
        const cidStr = String(cid);
        let node = this._remoteByCid.get(cidStr);
        if (!node || !node.isValid) {
            this.spawnOrUpdateRemote({
                character_id: cidStr,
                position: { x, y, map_id: this.mapId },
                facing,
                moving,
                Sprite: Number(msg.Sprite ?? msg.sprite ?? 0),
                role_name: msg.role_name,
            });
            return;
        }
        // 远端名字可能在不同包里补齐，这里每次 move 都刷新一次，保证“都显示”。
        // 每次 move 都刷新一次：如果本包没带 role_name，就用缓存补齐。
        this._setRemoteNameLabel(node, cidStr, (msg as any).role_name);
        node.getComponent(RemoteAvatarController)?.applySnapshot(x, y, facing, moving);
    };

    private spawnOrUpdateRemote(raw: any) {
        const cid = String(raw.character_id || '');
        if (!cid || !this.remotePlayerPrefab) {
            return;
        }
        const selfCid = this.ws.getCharacterId();
        if (selfCid && cid === String(selfCid)) {
            return;
        }
        const pos = raw.position || {};
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }
        const parent = this._getRemoteParent();
        if (!parent?.isValid) {
            this._deferredRemoteRawByCid.set(cid, raw);
            return;
        }
        this._spawnRemoteOnParent(raw, parent);
    }

    private _spawnRemoteOnParent(raw: any, parent: Node) {
        const cid = String(raw.character_id || '');
        if (!cid || !this.remotePlayerPrefab) {
            return;
        }
        const selfCid = this.ws.getCharacterId();
        if (selfCid && cid === String(selfCid)) {
            return;
        }
        const pos = raw.position || {};
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        let node = this._remoteByCid.get(cid);
        if (!node || !node.isValid) {
            node = instantiate(this.remotePlayerPrefab);
            node.name = `Remote_${cid.slice(-8)}`;
            parent.addChild(node);
            this._remoteByCid.set(cid, node);

            let rc = node.getComponent(RemoteAvatarController);
            if (!rc) {
                rc = node.addComponent(RemoteAvatarController);
            }
            rc.characterId = cid;

            const anim = node.getComponent(PlayerAnimRuntime);
            if (anim && this.animBank) {
                anim.bank = this.animBank;
            }
            const sp = Number(raw.Sprite || raw.sprite || 0);
            if (sp > 0) {
                node.getComponent(PlayerAnimRuntime)?.applyServerSprite(sp);
            }
            this._configureRemoteInstance(node);
        } else {
            this._configureRemoteInstance(node);
        }

        // 远端名字显示：把服务端 role_name 写进 Player.prefab 的 Name/Label。
        this._setRemoteNameLabel(node, cid, raw?.role_name);

        const rc = node.getComponent(RemoteAvatarController);
        rc?.applySnapshot(x, y, String(raw.facing || 'down'), Boolean(raw.moving));
    }

    private removeRemote(cid: string) {
        const n = this._remoteByCid.get(cid);
        if (n && n.isValid) {
            n.removeFromParent();
            n.destroy();
        }
        this._remoteByCid.delete(cid);
        this._remoteRoleNameByCid.delete(cid);
    }

    private clearAllRemotes() {
        this._remoteByCid.forEach((n) => {
            if (n && n.isValid) {
                n.removeFromParent();
                n.destroy();
            }
        });
        this._remoteByCid.clear();
        this._remoteRoleNameByCid.clear();
    }
}
