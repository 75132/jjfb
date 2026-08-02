System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5", "__unresolved_6", "__unresolved_7"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Animation, Component, instantiate, Label, Node, Prefab, WebSocketManager, PlayerAnimBank, PlayerAnimRuntime, PlayerGridMove, PlayerSceneRefs, PlayerStateSync, RemoteAvatarController, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _crd, ccclass, property, WorldOnlineSync;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerAnimBank(extras) {
    _reporterNs.report("PlayerAnimBank", "./PlayerAnimBank", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerAnimRuntime(extras) {
    _reporterNs.report("PlayerAnimRuntime", "./PlayerAnimRuntime", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerSceneRefs(extras) {
    _reporterNs.report("PlayerSceneRefs", "./PlayerSceneRefs", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerStateSync(extras) {
    _reporterNs.report("PlayerStateSync", "./PlayerStateSync", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRemoteAvatarController(extras) {
    _reporterNs.report("RemoteAvatarController", "./RemoteAvatarController", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Animation = _cc.Animation;
      Component = _cc.Component;
      instantiate = _cc.instantiate;
      Label = _cc.Label;
      Node = _cc.Node;
      Prefab = _cc.Prefab;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      PlayerAnimBank = _unresolved_3.PlayerAnimBank;
    }, function (_unresolved_4) {
      PlayerAnimRuntime = _unresolved_4.PlayerAnimRuntime;
    }, function (_unresolved_5) {
      PlayerGridMove = _unresolved_5.PlayerGridMove;
    }, function (_unresolved_6) {
      PlayerSceneRefs = _unresolved_6.PlayerSceneRefs;
    }, function (_unresolved_7) {
      PlayerStateSync = _unresolved_7.PlayerStateSync;
    }, function (_unresolved_8) {
      RemoteAvatarController = _unresolved_8.RemoteAvatarController;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "fa08djjN1ZD8ZeH66LfdXbu", "WorldOnlineSync", undefined);

      __checkObsolete__(['_decorator', 'Animation', 'Component', 'instantiate', 'Label', 'Node', 'Prefab']);

      ({
        ccclass,
        property
      } = _decorator);

      /**
       * 大世界同图多人在线：进入房间、同步他人、断线/切角/切号时清远端节点。
       * 服务端：world_enter / world_leave / world_step + 推送 world_player_* 
       */
      _export("WorldOnlineSync", WorldOnlineSync = (_dec = ccclass('WorldOnlineSync'), _dec2 = property({
        type: Node,
        tooltip: '兜底父节点；未设 remoteMountRoot 时，优先用「本地 Player 的父节点」（与坐标系一致）'
      }), _dec3 = property({
        type: Node,
        tooltip: '远端角色父节点，须与本地 Player 同一坐标系（多为 TiledMap）。留空则用本地 Player.node.parent，再空则用 World Root'
      }), _dec4 = property({
        type: Prefab,
        tooltip: '与本地 Player 结构一致的预制体（勿挂本地输入同步组件亦可）'
      }), _dec5 = property({
        type: _crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
          error: Error()
        }), PlayerGridMove) : PlayerGridMove,
        tooltip: '本地玩家，用于上报每格终点坐标'
      }), _dec6 = property({
        type: _crd && PlayerAnimBank === void 0 ? (_reportPossibleCrUseOfPlayerAnimBank({
          error: Error()
        }), PlayerAnimBank) : PlayerAnimBank,
        tooltip: '注入到远端实例的 PlayerAnimRuntime.bank'
      }), _dec7 = property({
        tooltip: '地图 ID（须与 PlayerStateSync / 服务端一致）'
      }), _dec8 = property({
        tooltip: '关闭则不占网、不实例化他人'
      }), _dec9 = property({
        tooltip: '每隔多少秒强制 world_enter 对齐同屏；0=关闭（重连/鉴权仍会拉一次）'
      }), _dec(_class = (_class2 = class WorldOnlineSync extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "worldRoot", _descriptor, this);

          _initializerDefineProperty(this, "remoteMountRoot", _descriptor2, this);

          _initializerDefineProperty(this, "remotePlayerPrefab", _descriptor3, this);

          _initializerDefineProperty(this, "localPlayerMove", _descriptor4, this);

          _initializerDefineProperty(this, "animBank", _descriptor5, this);

          _initializerDefineProperty(this, "mapId", _descriptor6, this);

          _initializerDefineProperty(this, "enableOnline", _descriptor7, this);

          _initializerDefineProperty(this, "worldResyncSec", _descriptor8, this);

          this.ws = null;
          this._remoteByCid = new Map();

          /** 远端 role_name 可能在 join/move 里不一定都有：缓存一下，确保“都显示”。 */
          this._remoteRoleNameByCid = new Map();

          /** world_enter / join 回调早于场景挂好时，父节点为空会静默丢包；缓存在此，update 再实例化（静止玩家只靠 others，无 move 补建） */
          this._deferredRemoteRawByCid = new Map();
          this._enteredCid = null;
          this._pendingEnter = false;
          this._lastEnterOkAt = 0;

          this._intervalResync = () => {
            this.fullResyncWorldPresence('interval');
          };

          this.onDataChanged = ev => {
            const r = ev == null ? void 0 : ev.reason;

            if (r === 'character_id_cleared' || r === 'all_cleared' || r === 'user_id_cleared') {
              this._deferredRemoteRawByCid.clear();

              this.clearAllRemotes();
              this._enteredCid = null;
              this._pendingEnter = false;
            }
          };

          this.onSelfPlayerInfo = resp => {
            if (!this.enableOnline) return;
            const data = resp != null && resp.data && typeof resp.data === 'object' ? { ...resp,
              ...resp.data
            } : resp;
            if (!data || data.success !== true || data.is_self !== true) return; // 本地玩家名字显示：即使 PlayerStateSync 没挂在本地 Player 上，也能显示

            this._setLocalNameLabel(data.role_name);

            const pos = data.position || {};
            let x = Number(pos.x);
            let y = Number(pos.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const mv = this.localPlayerMove;

            if (mv != null && mv.isLikelyUninitializedPosition(x, y)) {
              const fb = mv.getFallbackSpawn();
              x = fb.x;
              y = fb.y;
            }

            const cid = this.ws.getCharacterId();
            if (!cid) return;

            if (this._enteredCid === cid && Date.now() - this._lastEnterOkAt < 4000) {
              return;
            }

            if (this._pendingEnter) return;
            this._pendingEnter = true;
            this.ws.request('world_enter', {
              map_id: this.mapId,
              x,
              y,
              facing: 'down',
              request_id: `we_pi_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
            }, r => {
              this._pendingEnter = false;

              if (!r || r.success !== true) {
                return;
              }

              this._applyEnterOthers(r, cid);
            }, true, 12000);
          };

          this.onNetworkConnect = () => {
            this.scheduleOnce(() => this.fullResyncWorldPresence('net'), 0.45);
          };

          this.onNetworkDisconnect = () => {
            this._enteredCid = null;
            this._pendingEnter = false;

            this._deferredRemoteRawByCid.clear();

            this.clearAllRemotes();
          };

          this.onAuthResponseWorld = data => {
            if (data != null && data.success) {
              this.scheduleOnce(() => this.fullResyncWorldPresence('auth'), 0.35);
            }
          };

          this.onWorldJoin = msg => {
            var _msg$data;

            if (!this.enableOnline) return;
            const selfCid = this.ws.getCharacterId();
            const p = (msg == null ? void 0 : msg.player) || (msg == null || (_msg$data = msg.data) == null ? void 0 : _msg$data.player);
            if (!p || !p.character_id) return;
            if (String(p.character_id) === String(selfCid)) return;
            this.spawnOrUpdateRemote(p);
          };

          this.onWorldLeave = msg => {
            var _msg$character_id, _msg$data2;

            const cid = (_msg$character_id = msg == null ? void 0 : msg.character_id) != null ? _msg$character_id : msg == null || (_msg$data2 = msg.data) == null ? void 0 : _msg$data2.character_id;
            if (!cid) return;
            this.removeRemote(String(cid));
          };

          this.onWorldMove = msg => {
            var _msg$data3, _node$getComponent;

            if (!this.enableOnline) return;
            const selfCid = this.ws.getCharacterId();
            const cid = msg == null ? void 0 : msg.character_id;
            if (!cid || String(cid) === String(selfCid)) return;
            const pos = msg.position || (msg == null || (_msg$data3 = msg.data) == null ? void 0 : _msg$data3.position);
            if (!pos) return;
            const x = Number(pos.x);
            const y = Number(pos.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const facing = String(msg.facing || 'down');
            const moving = Boolean(msg.moving);
            const cidStr = String(cid);

            let node = this._remoteByCid.get(cidStr);

            if (!node || !node.isValid) {
              var _ref, _msg$Sprite;

              this.spawnOrUpdateRemote({
                character_id: cidStr,
                position: {
                  x,
                  y,
                  map_id: this.mapId
                },
                facing,
                moving,
                Sprite: Number((_ref = (_msg$Sprite = msg.Sprite) != null ? _msg$Sprite : msg.sprite) != null ? _ref : 0),
                role_name: msg.role_name
              });
              return;
            } // 远端名字可能在不同包里补齐，这里每次 move 都刷新一次，保证“都显示”。
            // 每次 move 都刷新一次：如果本包没带 role_name，就用缓存补齐。


            this._setRemoteNameLabel(node, cidStr, msg.role_name);

            (_node$getComponent = node.getComponent(_crd && RemoteAvatarController === void 0 ? (_reportPossibleCrUseOfRemoteAvatarController({
              error: Error()
            }), RemoteAvatarController) : RemoteAvatarController)) == null || _node$getComponent.applySnapshot(x, y, facing, moving);
          };
        }

        _setRemoteNameLabel(node, cid, roleName) {
          var _node$getChildByName$, _node$getChildByName, _this$_remoteRoleName;

          const label = (_node$getChildByName$ = (_node$getChildByName = node.getChildByName('Name')) == null ? void 0 : _node$getChildByName.getComponent(Label)) != null ? _node$getChildByName$ : null;
          if (!label) return;
          const s = String(roleName != null ? roleName : '');

          if (s.length > 0) {
            this._remoteRoleNameByCid.set(cid, s);
          }

          const final = s.length > 0 ? s : (_this$_remoteRoleName = this._remoteRoleNameByCid.get(cid)) != null ? _this$_remoteRoleName : '';
          label.string = final;
          if (label.node) label.node.active = final.length > 0;
        }

        _setLocalNameLabel(roleName) {
          var _this$localPlayerMove, _node$getChildByName$2, _node$getChildByName2;

          const node = (_this$localPlayerMove = this.localPlayerMove) == null ? void 0 : _this$localPlayerMove.node;
          if (!node || !node.isValid) return;
          const label = (_node$getChildByName$2 = (_node$getChildByName2 = node.getChildByName('Name')) == null ? void 0 : _node$getChildByName2.getComponent(Label)) != null ? _node$getChildByName$2 : null;
          if (!label) return;
          const s = String(roleName != null ? roleName : '');
          label.string = s;
          if (label.node) label.node.active = s.length > 0;
        }

        onLoad() {
          var _this$localPlayerMove2;

          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.ws.on('player_info_response', this.onSelfPlayerInfo, this);
          this.ws.on('player_info', this.onSelfPlayerInfo, this);
          this.ws.on('world_player_join', this.onWorldJoin, this);
          this.ws.on('world_player_leave', this.onWorldLeave, this);
          this.ws.on('world_player_move', this.onWorldMove, this);
          const node = this.ws.node;

          if (node && typeof node.on === 'function') {
            node.on('data_changed', this.onDataChanged, this);
            node.on('network_connect', this.onNetworkConnect, this);
            node.on('network_disconnect', this.onNetworkDisconnect, this);
            node.on('auth_response', this.onAuthResponseWorld, this);
          }

          this._resolveLocalPlayerMove();

          (_this$localPlayerMove2 = this.localPlayerMove) == null || _this$localPlayerMove2.onStep((dir, x, y) => this.onLocalStepEnd(dir, x, y));
        }

        _resolveLocalPlayerMove() {
          var _this$localPlayerMove3, _this$worldRoot, _wr$getComponentInChi;

          if ((_this$localPlayerMove3 = this.localPlayerMove) != null && (_this$localPlayerMove3 = _this$localPlayerMove3.node) != null && _this$localPlayerMove3.isValid) return;
          const wr = (_this$worldRoot = this.worldRoot) != null ? _this$worldRoot : this.node.getChildByName('WorldRoot');
          this.localPlayerMove = (_wr$getComponentInChi = wr == null ? void 0 : wr.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove)) != null ? _wr$getComponentInChi : null;
        }

        start() {
          this.scheduleOnce(() => this.tryWorldEnterFallback(), 0.5);
          this.scheduleOnce(() => this._reassertRemoteConfigs(), 0.05);

          if (this.worldResyncSec > 0) {
            this.schedule(this._intervalResync, this.worldResyncSec);
          }
        }

        /** 远端须与本地 Player 同一父节点坐标系（常见：TiledMap），否则坐标会落到「地图角」 */
        _getRemoteParent() {
          var _this$remoteMountRoot, _this$localPlayerMove4, _lp$parent;

          if ((_this$remoteMountRoot = this.remoteMountRoot) != null && _this$remoteMountRoot.isValid) {
            return this.remoteMountRoot;
          }

          const lp = (_this$localPlayerMove4 = this.localPlayerMove) == null ? void 0 : _this$localPlayerMove4.node;

          if (lp != null && (_lp$parent = lp.parent) != null && _lp$parent.isValid) {
            return lp.parent;
          }

          return this.worldRoot;
        }
        /** 防止预制体/编辑器里仍启用本地移动，抢远端表现 */


        _configureRemoteInstance(node) {
          if (!(node != null && node.isValid)) return;
          const pgm = node.getComponent(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove);

          if (pgm) {
            pgm.enabled = false;
          }

          const st = node.getComponent(_crd && PlayerStateSync === void 0 ? (_reportPossibleCrUseOfPlayerStateSync({
            error: Error()
          }), PlayerStateSync) : PlayerStateSync);

          if (st) {
            st.enabled = false;
          }

          const psr = node.getComponent(_crd && PlayerSceneRefs === void 0 ? (_reportPossibleCrUseOfPlayerSceneRefs({
            error: Error()
          }), PlayerSceneRefs) : PlayerSceneRefs);

          if (psr) {
            psr.enabled = false;
          }

          const ac = node.getComponent(Animation);

          if (ac) {
            ac.playOnLoad = false;
          }
        }

        _reassertRemoteConfigs() {
          this._remoteByCid.forEach(node => this._configureRemoteInstance(node));
        }

        update(_dt) {
          if (this._deferredRemoteRawByCid.size === 0) {
            return;
          }

          const parent = this._getRemoteParent();

          if (!(parent != null && parent.isValid) || !this.remotePlayerPrefab) {
            return;
          }

          const batch = [...this._deferredRemoteRawByCid.values()];

          this._deferredRemoteRawByCid.clear();

          for (let i = 0; i < batch.length; i++) {
            this._spawnRemoteOnParent(batch[i], parent);
          }
        }

        onDestroy() {
          var _this$localPlayerMove5, _this$ws, _this$ws2, _this$ws3, _this$ws4, _this$ws5, _this$ws6;

          this.unschedule(this._intervalResync);
          (_this$localPlayerMove5 = this.localPlayerMove) == null || _this$localPlayerMove5.onStep(null);
          (_this$ws = this.ws) == null || _this$ws.off('player_info_response', this.onSelfPlayerInfo, this);
          (_this$ws2 = this.ws) == null || _this$ws2.off('player_info', this.onSelfPlayerInfo, this);
          (_this$ws3 = this.ws) == null || _this$ws3.off('world_player_join', this.onWorldJoin, this);
          (_this$ws4 = this.ws) == null || _this$ws4.off('world_player_leave', this.onWorldLeave, this);
          (_this$ws5 = this.ws) == null || _this$ws5.off('world_player_move', this.onWorldMove, this);
          const node = this.ws.node;

          if (node && typeof node.off === 'function') {
            node.off('data_changed', this.onDataChanged, this);
            node.off('network_connect', this.onNetworkConnect, this);
            node.off('network_disconnect', this.onNetworkDisconnect, this);
            node.off('auth_response', this.onAuthResponseWorld, this);
          }

          if (this._enteredCid && (_this$ws6 = this.ws) != null && _this$ws6.isConnected()) {
            this.ws.notify('world_leave', {
              map_id: this.mapId,
              request_id: `wl_${Date.now()}`
            }, true);
          }

          this._deferredRemoteRawByCid.clear();

          this.clearAllRemotes();
          this._enteredCid = null;
        }

        /** 进图/重连上报前过滤未初始化坐标，避免 world_enter 把 (0,0) 落库。 */
        _resolveWorldEnterPosition() {
          const mv = this.localPlayerMove;
          if (!mv) return null;
          const p = mv.getPixelPosition();
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
          if (mv.isLikelyUninitializedPosition(p.x, p.y)) return null;
          return {
            x: p.x,
            y: p.y
          };
        }

        /** 无 player_info 时兜底（例如缓存直进游戏） */
        tryWorldEnterFallback() {
          if (!this.enableOnline || this._enteredCid || this._pendingEnter) return;
          const cid = this.ws.getCharacterId();
          if (!cid || !this.ws.isConnected()) return;

          const pos = this._resolveWorldEnterPosition();

          if (!pos) return;
          const mv = this.localPlayerMove;
          if (!mv) return;
          this._pendingEnter = true;
          this.ws.request('world_enter', {
            map_id: this.mapId,
            x: pos.x,
            y: pos.y,
            facing: mv.getFacingDir(),
            request_id: `we_fb_${Date.now()}`
          }, r => {
            this._pendingEnter = false;
            if (!r || r.success !== true) return;

            this._applyEnterOthers(r, cid);
          }, true, 12000);
        }
        /** 重连 / 定时 / 鉴权后：用当前本地像素坐标再进房，拉全量 others（成熟做法：快照对齐） */


        fullResyncWorldPresence(_source) {
          if (!this.enableOnline || !this.ws.isConnected()) return;
          const cid = this.ws.getCharacterId();
          if (!cid) return;

          const pos = this._resolveWorldEnterPosition();

          if (!pos) return;
          const mv = this.localPlayerMove;
          if (!mv) return;
          if (this._pendingEnter) return;
          this._pendingEnter = true;
          this.ws.request('world_enter', {
            map_id: this.mapId,
            x: pos.x,
            y: pos.y,
            facing: mv.getFacingDir(),
            request_id: `we_sync_${Date.now()}`
          }, r => {
            this._pendingEnter = false;
            if (!(r != null && r.success)) return;

            this._applyEnterOthers(r, cid);
          }, true, 12000);
        }

        _applyEnterOthers(r, cid) {
          var _payload$others;

          const payload = r.data && typeof r.data === 'object' ? r.data : r;
          const others = (_payload$others = payload.others) != null ? _payload$others : r.others;
          const list = Array.isArray(others) ? others : [];
          this._enteredCid = cid;
          this._lastEnterOkAt = Date.now();

          this._deferredRemoteRawByCid.clear();

          this.clearAllRemotes();

          for (let i = 0; i < list.length; i++) {
            this.spawnOrUpdateRemote(list[i]);
          }
        }

        onLocalStepEnd(dir, x, y) {
          if (!this.enableOnline || !this._enteredCid || !this.ws.isConnected()) return;
          this.ws.notify('world_step', {
            map_id: this.mapId,
            x,
            y,
            facing: dir,
            moving: false,
            request_id: `ws_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
          }, true);
        }

        spawnOrUpdateRemote(raw) {
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

          if (!(parent != null && parent.isValid)) {
            this._deferredRemoteRawByCid.set(cid, raw);

            return;
          }

          this._spawnRemoteOnParent(raw, parent);
        }

        _spawnRemoteOnParent(raw, parent) {
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

            let rc = node.getComponent(_crd && RemoteAvatarController === void 0 ? (_reportPossibleCrUseOfRemoteAvatarController({
              error: Error()
            }), RemoteAvatarController) : RemoteAvatarController);

            if (!rc) {
              rc = node.addComponent(_crd && RemoteAvatarController === void 0 ? (_reportPossibleCrUseOfRemoteAvatarController({
                error: Error()
              }), RemoteAvatarController) : RemoteAvatarController);
            }

            rc.characterId = cid;
            const anim = node.getComponent(_crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
              error: Error()
            }), PlayerAnimRuntime) : PlayerAnimRuntime);

            if (anim && this.animBank) {
              anim.bank = this.animBank;
            }

            const sp = Number(raw.Sprite || raw.sprite || 0);

            if (sp > 0) {
              var _node$getComponent2;

              (_node$getComponent2 = node.getComponent(_crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
                error: Error()
              }), PlayerAnimRuntime) : PlayerAnimRuntime)) == null || _node$getComponent2.applyServerSprite(sp);
            }

            this._configureRemoteInstance(node);
          } else {
            this._configureRemoteInstance(node);
          } // 远端名字显示：把服务端 role_name 写进 Player.prefab 的 Name/Label。


          this._setRemoteNameLabel(node, cid, raw == null ? void 0 : raw.role_name);

          const rc = node.getComponent(_crd && RemoteAvatarController === void 0 ? (_reportPossibleCrUseOfRemoteAvatarController({
            error: Error()
          }), RemoteAvatarController) : RemoteAvatarController);
          rc == null || rc.applySnapshot(x, y, String(raw.facing || 'down'), Boolean(raw.moving));
        }

        removeRemote(cid) {
          const n = this._remoteByCid.get(cid);

          if (n && n.isValid) {
            n.removeFromParent();
            n.destroy();
          }

          this._remoteByCid.delete(cid);

          this._remoteRoleNameByCid.delete(cid);
        }

        clearAllRemotes() {
          this._remoteByCid.forEach(n => {
            if (n && n.isValid) {
              n.removeFromParent();
              n.destroy();
            }
          });

          this._remoteByCid.clear();

          this._remoteRoleNameByCid.clear();
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "worldRoot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "remoteMountRoot", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "remotePlayerPrefab", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "localPlayerMove", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "animBank", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "mapId", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return 1;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "enableOnline", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return true;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "worldResyncSec", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return 15;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=baf40d0fc3825a47315e7a092ea0eeadb7bb5d2e.js.map