System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Animation, Component, Vec3, PlayerAnimRuntime, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, RemoteAvatarController;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

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
      Animation = _cc.Animation;
      Component = _cc.Component;
      Vec3 = _cc.Vec3;
    }, function (_unresolved_2) {
      PlayerAnimRuntime = _unresolved_2.PlayerAnimRuntime;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a7e2cSxnQ5KH7LDjZ4PGis8", "RemoteAvatarController", undefined);

      __checkObsolete__(['_decorator', 'Animation', 'Component', 'Vec3']);

      ({
        ccclass,
        property
      } = _decorator);

      /**
       * 挂在大世界「他人」实例上：以恒定像素速度追网络目标点，避免指数插值「先快后慢」；
       * 到达目标当帧立即切 idle，避免停步后动画还拖半拍。
       */
      _export("RemoteAvatarController", RemoteAvatarController = (_dec = ccclass('RemoteAvatarController'), _dec2 = property({
        tooltip: '追坐标速度（像素/秒）。本地 MV 速度 4 时约一格 48px 用时 ~0.27s，折合约 180px/s；可按手感微调'
      }), _dec(_class = (_class2 = class RemoteAvatarController extends Component {
        constructor() {
          super(...arguments);
          this.characterId = '';

          _initializerDefineProperty(this, "moveSpeedPxPerSec", _descriptor, this);

          this._target = new Vec3();
          this._anim = null;
          this._lastFacing = 'down';
          this._playingWalk = false;
          this._firstSnap = true;
        }

        onLoad() {
          this._anim = this.getComponent(_crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
            error: Error()
          }), PlayerAnimRuntime) : PlayerAnimRuntime);
          var legacy = this.getComponent(Animation);

          if (legacy) {
            legacy.playOnLoad = false;
          }
        }
        /**
         * 只更新目标点与朝向；位移与 walk/idle 全在 update 里按匀速处理，避免动画与位置不同步。
         */


        applySnapshot(x, y, facing, _moving) {
          var f = facing || 'down';

          if (f === 'left' || f === 'right' || f === 'up' || f === 'down') {
            this._lastFacing = f;
          }

          this._target.set(x, y, this.node.position.z);

          if (this._firstSnap) {
            var _this$_anim;

            var cur = this.node.position;
            this.node.setPosition(Math.round(x), Math.round(y), cur.z);
            this._firstSnap = false;
            this._playingWalk = false;
            (_this$_anim = this._anim) == null || _this$_anim.playIdle(this._lastFacing, true);
          }
        }

        update(dt) {
          if (this._firstSnap) {
            return;
          }

          var cur = this.node.position;
          var t = this._target;
          var dx = t.x - cur.x;
          var dy = t.y - cur.y;
          var dist = Math.hypot(dx, dy); // 已到格点：立刻 idle，避免「停住后动画还播一会」

          if (dist < 0.05) {
            this.node.setPosition(Math.round(t.x), Math.round(t.y), cur.z);

            if (this._playingWalk) {
              var _this$_anim2;

              this._playingWalk = false;
              (_this$_anim2 = this._anim) == null || _this$_anim2.playIdle(this._lastFacing, true);
            }

            return;
          }

          var speed = Math.max(60, this.moveSpeedPxPerSec);
          var maxStep = speed * dt;

          if (dist <= maxStep) {
            this.node.setPosition(Math.round(t.x), Math.round(t.y), cur.z);

            if (this._playingWalk) {
              var _this$_anim3;

              this._playingWalk = false;
              (_this$_anim3 = this._anim) == null || _this$_anim3.playIdle(this._lastFacing, true);
            }

            return;
          }

          dx /= dist;
          dy /= dist;
          var nx = cur.x + dx * maxStep;
          var ny = cur.y + dy * maxStep;
          this.node.setPosition(Math.round(nx), Math.round(ny), cur.z);

          if (!this._playingWalk) {
            var _this$_anim4;

            this._playingWalk = true;
            (_this$_anim4 = this._anim) == null || _this$_anim4.playMove(this._lastFacing);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "moveSpeedPxPerSec", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 195;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=1e67fa4e77f7fb770e03a27e683c54744b2dc8e6.js.map