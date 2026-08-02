System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Label, WebSocketManager, PlayerGridMove, PlayerAnimRuntime, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, PlayerStateSync;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerAnimRuntime(extras) {
    _reporterNs.report("PlayerAnimRuntime", "./PlayerAnimRuntime", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Label = _cc.Label;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      PlayerGridMove = _unresolved_3.PlayerGridMove;
    }, function (_unresolved_4) {
      PlayerAnimRuntime = _unresolved_4.PlayerAnimRuntime;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "74342i9JH5Bl6XN0F1yfINm", "PlayerStateSync", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Label']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("PlayerStateSync", PlayerStateSync = (_dec = ccclass('PlayerStateSync'), _dec2 = property({
        type: _crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
          error: Error()
        }), PlayerGridMove) : PlayerGridMove,
        tooltip: '玩家移动脚本（用于设置坐标/形象前缀）'
      }), _dec3 = property({
        type: _crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
          error: Error()
        }), PlayerAnimRuntime) : PlayerAnimRuntime,
        tooltip: '运行时动画注入器（推荐绑定）'
      }), _dec4 = property({
        tooltip: '地图ID（当前固定 1）'
      }), _dec5 = property({
        tooltip: '是否用服务器 Sprite 强制覆盖本地 animPrefix（推荐开启，网游权威形象）'
      }), _dec(_class = (_class2 = class PlayerStateSync extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "playerMove", _descriptor, this);

          _initializerDefineProperty(this, "animRuntime", _descriptor2, this);

          _initializerDefineProperty(this, "mapId", _descriptor3, this);

          _initializerDefineProperty(this, "syncAnimPrefixFromServer", _descriptor4, this);

          this.ws = null;
          this.restored = false;
          this._nameLabel = null;

          this.onPlayerInfo = resp => {
            var _data$role_name;

            const data = resp != null && resp.data && typeof resp.data === 'object' ? { ...resp,
              ...resp.data
            } : resp;
            if (!data || data.success !== true || data.is_self !== true) return;
            const roleName = String((_data$role_name = data.role_name) != null ? _data$role_name : '');
            const pos = data.position || {};
            const x = Number(pos.x);
            const y = Number(pos.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return; // 本地玩家名字显示：写入 Player.prefab 下挂的 Name/Label。

            const nameLabel = this._resolveNameLabel();

            if (nameLabel) {
              nameLabel.string = roleName;
              if (nameLabel.node) nameLabel.node.active = roleName.length > 0;
            } // 只在首次进入时用服务器权威坐标覆盖，避免后续打断本地移动。


            if (!this.restored) {
              var _this$playerMove, _this$playerMove2;

              (_this$playerMove = this.playerMove) == null || _this$playerMove.setPixelPosition(x, y, true);
              (_this$playerMove2 = this.playerMove) == null || _this$playerMove2.markServerRestored();
              this.restored = true;
            }

            const spriteIndex = Number(data.Sprite || 0);

            if (this.syncAnimPrefixFromServer && spriteIndex > 0) {
              var _this$animRuntime;

              (_this$animRuntime = this.animRuntime) == null || _this$animRuntime.applyServerSprite(spriteIndex);
            }
          };
        }

        _resolveNameLabel() {
          var _n$getComponent;

          if (this._nameLabel) return this._nameLabel;
          const n = this.node.getChildByName('Name');
          this._nameLabel = (_n$getComponent = n == null ? void 0 : n.getComponent(Label)) != null ? _n$getComponent : null;
          return this._nameLabel;
        }

        onLoad() {
          var _this$playerMove3;

          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.ws.on('player_info_response', this.onPlayerInfo, this);
          this.ws.on('player_info', this.onPlayerInfo, this);
          (_this$playerMove3 = this.playerMove) == null || _this$playerMove3.onStep(null); // 保留纯本地移动，不做网络上报
        }

        start() {
          this.requestRestore();
        }

        onDestroy() {
          var _this$ws, _this$ws2, _this$playerMove4;

          (_this$ws = this.ws) == null || _this$ws.off('player_info_response', this.onPlayerInfo, this);
          (_this$ws2 = this.ws) == null || _this$ws2.off('player_info', this.onPlayerInfo, this);
          (_this$playerMove4 = this.playerMove) == null || _this$playerMove4.onStep(null);
        }

        requestRestore() {
          const cid = this.ws.getCharacterId();
          if (!cid || this.restored) return;
          this.ws.request('get_player', {
            character_id: cid,
            map_id: this.mapId
          }, undefined, true, 10000);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "playerMove", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "animRuntime", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "mapId", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return 1;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "syncAnimPrefixFromServer", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return true;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=58381477c82c8927aeaa5d81b58b4d2f0ad0984e.js.map