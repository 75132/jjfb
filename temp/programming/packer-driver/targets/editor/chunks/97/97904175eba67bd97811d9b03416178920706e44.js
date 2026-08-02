System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Button, Label, director, WebSocketManager, GameConfig, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, Back;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
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
      Button = _cc.Button;
      Label = _cc.Label;
      director = _cc.director;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "7b24eGVjEVNyo9sEQEkVu3H", "Return", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Button', 'Label', 'director']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Back", Back = (_dec = ccclass('Back'), _dec2 = property(Button), _dec3 = property({
        type: Label,
        tooltip: '返回登录时的提示文案（可选）'
      }), _dec(_class = (_class2 = class Back extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "backBtn", _descriptor, this);

          _initializerDefineProperty(this, "statusLabel", _descriptor2, this);

          // 修复点：返回按钮防抖，避免高频点击多次切场景
          this._backClicked = false;
        }

        start() {
          if (this.backBtn && this.backBtn.node) {
            this.backBtn.node.on(Button.EventType.CLICK, this.onBackClick, this);
          }
        }

        onBackClick() {
          if (this._backClicked) {
            return;
          }

          this._backClicked = true;
          if (this.backBtn) this.backBtn.interactable = false;
          if (this.statusLabel) this.statusLabel.string = '正在返回登录…'; // 返回登录页必须是“彻底退出”，避免被本地 token 自动拉回角色选择。

          try {
            const ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            ws.fullLogout();
          } catch {}

          director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN, error => {
            if (error) {
              console.error('❌ 返回登录场景失败:', error); // 修复点：加载失败时允许再次点击返回

              this._backClicked = false;
              if (this.backBtn) this.backBtn.interactable = true;
              if (this.statusLabel) this.statusLabel.string = '';
            }
          });
        }

        onDestroy() {
          if (this.backBtn && this.backBtn.node) {
            this.backBtn.node.off(Button.EventType.CLICK, this.onBackClick, this);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "backBtn", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "statusLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=97904175eba67bd97811d9b03416178920706e44.js.map