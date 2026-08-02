System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Animation, PlayerAnimBank, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, PlayerAnimRuntime;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerAnimBank(extras) {
    _reporterNs.report("PlayerAnimBank", "./PlayerAnimBank", _context.meta, extras);
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
      Animation = _cc.Animation;
    }, function (_unresolved_2) {
      PlayerAnimBank = _unresolved_2.PlayerAnimBank;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "bf6b6dDRXlHgYMX4sNKPbJN", "PlayerAnimRuntime", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Animation', 'AnimationClip']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("PlayerAnimRuntime", PlayerAnimRuntime = (_dec = ccclass('PlayerAnimRuntime'), _dec2 = property({
        type: _crd && PlayerAnimBank === void 0 ? (_reportPossibleCrUseOfPlayerAnimBank({
          error: Error()
        }), PlayerAnimBank) : PlayerAnimBank,
        tooltip: '动画库（全局一个节点挂一次即可）'
      }), _dec3 = property({
        tooltip: '是否在切换Sprite时强制停止并切到待机'
      }), _dec(_class = (_class2 = class PlayerAnimRuntime extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "bank", _descriptor, this);

          _initializerDefineProperty(this, "resetOnApply", _descriptor2, this);

          this.anim = null;
          this._prefix = 'player1';
          this._facing = 'down';
        }

        onLoad() {
          this.anim = this.getComponent(Animation);

          if (this.anim) {
            this.anim.playOnLoad = false;
          }
        }

        get prefix() {
          return this._prefix;
        }

        setFacing(dir) {
          this._facing = dir;
        }
        /** 服务器Sprite=7 => player7，并注入8个clip到本节点 Animation */


        applyServerSprite(spriteIndex) {
          var idx = Math.floor(Number(spriteIndex));
          if (!Number.isFinite(idx) || idx <= 0) return false;
          return this.applyPrefix("player" + idx);
        }

        applyPrefix(prefix) {
          var anim = this.anim;
          var bank = this.bank;
          var p = (prefix || '').trim();
          if (!anim || !bank || !p) return false;

          var neededNames = this._neededClipNames(p);

          var clips = [];
          var missing = [];

          for (var i = 0; i < neededNames.length; i++) {
            var name = neededNames[i];
            var clip = bank.getClip(name);
            if (!clip) missing.push(name);else clips.push(clip);
          }

          if (missing.length) {
            console.warn("[PlayerAnimRuntime] \u52A8\u753B\u5E93\u7F3A\u5C11clip: " + missing.join(', '));
            return false;
          } // 注入：只保留当前角色8个，避免串号


          anim.clips = clips;
          this._prefix = p;

          if (this.resetOnApply) {
            try {
              anim.stop();
            } catch (_unused) {}

            this.playIdle(this._facing, true);
          }

          return true;
        }

        playMove(dir, force) {
          if (force === void 0) {
            force = false;
          }

          this._facing = dir;

          this._play(this._prefix + "_walk_" + dir, force);
        }

        playIdle(dir, force) {
          if (force === void 0) {
            force = false;
          }

          this._facing = dir;

          this._play(this._prefix + "_idle_" + dir, force);
        }

        _play(name, force) {
          var anim = this.anim;
          if (!anim) return;
          var st = anim.getState(name);

          if (!st) {
            console.warn("[PlayerAnimRuntime] Animation\u7F3A\u5C11state: " + name + "\uFF08\u8BF7\u5148applyPrefix/applyServerSprite\u6CE8\u51658\u4E2Aclip\uFF09");
            return;
          }

          if (!force && st.isPlaying) return;
          anim.play(name);
        }

        _neededClipNames(prefix) {
          var dirs = ['down', 'left', 'right', 'up'];
          var out = [];

          for (var i = 0; i < dirs.length; i++) out.push(prefix + "_idle_" + dirs[i]);

          for (var _i = 0; _i < dirs.length; _i++) out.push(prefix + "_walk_" + dirs[_i]);

          return out;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "bank", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "resetOnApply", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=e785b928f0bc40ba766acaa7f0aa5db4d349a3f4.js.map