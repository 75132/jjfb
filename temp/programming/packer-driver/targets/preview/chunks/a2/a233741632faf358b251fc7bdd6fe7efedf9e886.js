System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, AnimationClip, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, PlayerAnimBank;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      AnimationClip = _cc.AnimationClip;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f0d9b62As1MYIH+leXysJtf", "PlayerAnimBank", undefined);

      __checkObsolete__(['_decorator', 'Component', 'AnimationClip']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("PlayerAnimBank", PlayerAnimBank = (_dec = ccclass('PlayerAnimBank'), _dec2 = property({
        type: [AnimationClip],
        tooltip: '把所有 player1~player7 的 idle/walk 四方向 .anim 一次性拖进来（共56个）'
      }), _dec(_class = (_class2 = class PlayerAnimBank extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "clips", _descriptor, this);

          this._map = new Map();
        }

        onLoad() {
          this._rebuildMap();
        }

        rebuild() {
          this._rebuildMap();
        }

        getClip(name) {
          return this._map.get(name) || null;
        }

        _rebuildMap() {
          this._map.clear();

          for (var i = 0; i < this.clips.length; i++) {
            var c = this.clips[i];
            if (!c || !c.name) continue;

            this._map.set(c.name, c);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "clips", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=a233741632faf358b251fc7bdd6fe7efedf9e886.js.map