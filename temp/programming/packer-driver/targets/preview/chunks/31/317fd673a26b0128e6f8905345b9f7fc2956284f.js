System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Label, GameCommonData, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, TopRole;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfGameCommonData(extras) {
    _reporterNs.report("GameCommonData", "./GameCommonData", _context.meta, extras);
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
      GameCommonData = _unresolved_2.GameCommonData;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "39630G8ETVPZJU7hNvbJcZz", "TopRole", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Label']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * TopRole - 顶部角色信息显示组件
       * 
       * 职责：从 GameCommonData 数据中心读取数据并更新 UI
       * 数据流向：服务器 -> GameCommonData -> TopRole (UI显示)
       */

      _export("TopRole", TopRole = (_dec = ccclass('TopRole'), _dec2 = property({
        type: Label
      }), _dec3 = property({
        type: Label
      }), _dec(_class = (_class2 = class TopRole extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "nameLabel", _descriptor, this);

          _initializerDefineProperty(this, "levelNumberLabel", _descriptor2, this);

          /**
           * 处理数据更新事件
           */
          this.onDataUpdated = data => {
            this.updateUI(); // 如果有升级，可以在这里播放升级特效等

            if (data.levelUpCount && data.levelUpCount > 0) {
              console.log("[TopRole] \u89D2\u8272\u5347\u7EA7\u4E86 " + data.levelUpCount + " \u7EA7\uFF01");
            }
          };
        }

        start() {
          // 等待 GameCommonData 初始化完成
          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            this.setupDataListener(); // 立即更新一次 UI（如果数据已存在）

            this.updateUI();
          } else {
            // 如果 GameCommonData 还没初始化，延迟一下再设置
            this.scheduleOnce(() => {
              if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
                error: Error()
              }), GameCommonData) : GameCommonData).instance) {
                this.setupDataListener();
                this.updateUI();
              }
            }, 0.1);
          }
        }
        /**
         * 设置数据监听（监听 GameCommonData 的数据更新事件）
         */


        setupDataListener() {
          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
              error: Error()
            }), GameCommonData) : GameCommonData).instance.node.on('data_updated', this.onDataUpdated, this);
          }
        }

        /**
         * 更新 UI 显示
         */
        updateUI() {
          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            return;
          }

          var roleName = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.roleName;
          var level = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.level;

          if (this.nameLabel) {
            this.nameLabel.string = roleName || '';
          }

          if (this.levelNumberLabel) {
            this.levelNumberLabel.string = String(level);
          }
        }

        onDestroy() {
          // 取消事件监听
          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
              error: Error()
            }), GameCommonData) : GameCommonData).instance.node.off('data_updated', this.onDataUpdated, this);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "nameLabel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "levelNumberLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=317fd673a26b0128e6f8905345b9f7fc2956284f.js.map