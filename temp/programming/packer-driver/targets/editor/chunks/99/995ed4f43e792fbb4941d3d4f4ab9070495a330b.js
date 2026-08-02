System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, TiledLayer, PlayerAnimBank, PlayerAnimRuntime, PlayerGridMove, _dec, _dec2, _dec3, _class, _class2, _descriptor, _crd, ccclass, property, executionOrder, PlayerSceneRefs;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerAnimBank(extras) {
    _reporterNs.report("PlayerAnimBank", "./PlayerAnimBank", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerAnimRuntime(extras) {
    _reporterNs.report("PlayerAnimRuntime", "./PlayerAnimRuntime", _context.meta, extras);
  }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./PlayerGridMove", _context.meta, extras);
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
      TiledLayer = _cc.TiledLayer;
    }, function (_unresolved_2) {
      PlayerAnimBank = _unresolved_2.PlayerAnimBank;
    }, function (_unresolved_3) {
      PlayerAnimRuntime = _unresolved_3.PlayerAnimRuntime;
    }, function (_unresolved_4) {
      PlayerGridMove = _unresolved_4.PlayerGridMove;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f8c3ekaCy1PXpwafo2bDBov", "PlayerSceneRefs", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'TiledLayer']);

      ({
        ccclass,
        property,
        executionOrder
      } = _decorator);
      /**
       * 挂在 Player 预制体上：进入场景后若 Map Root / Anim Bank 未拖引用，则按常见层级自动补齐。
       * 层级约定：Canvas/.../GameArea/WorldRoot/Player（与 WorldRoot 平级的地图节点含 TiledLayer）。
       */

      _export("PlayerSceneRefs", PlayerSceneRefs = (_dec = ccclass('PlayerSceneRefs'), _dec2 = executionOrder(-50), _dec3 = property({
        tooltip: '关闭后不在运行时解析，完全依赖预制体/场景里手拖引用'
      }), _dec(_class = _dec2(_class = (_class2 = class PlayerSceneRefs extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "autoResolve", _descriptor, this);
        }

        onLoad() {
          if (!this.autoResolve) {
            return;
          }

          const pgm = this.getComponent(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove);
          const animRt = this.getComponent(_crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
            error: Error()
          }), PlayerAnimRuntime) : PlayerAnimRuntime);

          if (pgm && !pgm.mapRoot) {
            const root = this._resolveMapRoot();

            if (root) {
              pgm.mapRoot = root;
            }
          }

          if (animRt && !animRt.bank) {
            const bank = this._resolveAnimBank();

            if (bank) {
              animRt.bank = bank;
            }
          }
        }

        _resolveMapRoot() {
          const worldRoot = this.node.parent;

          if (!worldRoot) {
            return null;
          }

          const tryNames = ['TiledMap', 'Tilemap', 'MapRoot', 'mapRoot'];

          for (let i = 0; i < tryNames.length; i++) {
            const n = worldRoot.getChildByName(tryNames[i]);

            if (n && this._hasTiledLayerInSubtree(n)) {
              return n;
            }
          }

          for (let c = 0; c < worldRoot.children.length; c++) {
            const ch = worldRoot.children[c];

            if (ch === this.node) {
              continue;
            }

            if (this._hasTiledLayerInSubtree(ch)) {
              return ch;
            }
          }

          return null;
        }

        _hasTiledLayerInSubtree(root) {
          const stack = [root];

          while (stack.length > 0) {
            const n = stack.pop();

            if (n.getComponent(TiledLayer)) {
              return true;
            }

            for (let i = 0; i < n.children.length; i++) {
              stack.push(n.children[i]);
            }
          }

          return false;
        }

        _resolveAnimBank() {
          let cur = this.node;

          while (cur) {
            const bank = cur.getComponentInChildren(_crd && PlayerAnimBank === void 0 ? (_reportPossibleCrUseOfPlayerAnimBank({
              error: Error()
            }), PlayerAnimBank) : PlayerAnimBank);

            if (bank) {
              return bank;
            }

            cur = cur.parent;
          }

          return null;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "autoResolve", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return true;
        }
      })), _class2)) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=995ed4f43e792fbb4941d3d4f4ab9070495a330b.js.map