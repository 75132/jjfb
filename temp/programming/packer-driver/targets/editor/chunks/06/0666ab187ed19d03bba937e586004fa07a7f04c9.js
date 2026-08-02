System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, EditBox, Button, Label, WebSocketManager, GameConfig, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _crd, ccclass, property, ChangePasswordPanel;

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
      Node = _cc.Node;
      EditBox = _cc.EditBox;
      Button = _cc.Button;
      Label = _cc.Label;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "65684rLw+pMIqtL6bbEDbiF", "ChangePasswordPanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'EditBox', 'Button', 'Label']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ChangePasswordPanel", ChangePasswordPanel = (_dec = ccclass('ChangePasswordPanel'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(EditBox), _dec5 = property(EditBox), _dec6 = property(EditBox), _dec7 = property(Button), _dec8 = property(Button), _dec9 = property(Label), _dec(_class = (_class2 = class ChangePasswordPanel extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "loginPanelNode", _descriptor, this);

          _initializerDefineProperty(this, "changePasswordPanelNode", _descriptor2, this);

          _initializerDefineProperty(this, "accountEditBox", _descriptor3, this);

          _initializerDefineProperty(this, "oldPasswordEditBox", _descriptor4, this);

          _initializerDefineProperty(this, "newPasswordEditBox", _descriptor5, this);

          _initializerDefineProperty(this, "changeButton", _descriptor6, this);

          _initializerDefineProperty(this, "backButton", _descriptor7, this);

          _initializerDefineProperty(this, "tipLabel", _descriptor8, this);

          this.webSocketManager = null;
          this.isChanging = false;
          // 断开对 Login 的 import 循环依赖：改密成功后通过回调通知 Login 更新提示文案
          this._onAfterChangeSuccessTip = null;
        }

        start() {
          this.webSocketManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (this.changeButton && this.changeButton.node) {
            this.changeButton.node.on(Button.EventType.CLICK, this.onChangeClick, this);
          }

          if (this.backButton && this.backButton.node) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
          }

          if (this.tipLabel) this.tipLabel.string = '';
        }

        openFromLogin(defaultAccount, onAfterChangeSuccessTip) {
          this._onAfterChangeSuccessTip = onAfterChangeSuccessTip != null ? onAfterChangeSuccessTip : null;
          if (this.accountEditBox) this.accountEditBox.string = defaultAccount || '';
          if (this.oldPasswordEditBox) this.oldPasswordEditBox.string = '';
          if (this.newPasswordEditBox) this.newPasswordEditBox.string = '';
          if (this.tipLabel) this.tipLabel.string = '';
          if (this.loginPanelNode) this.loginPanelNode.active = false;
          if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = true;
        }

        onChangeClick() {
          var _this$accountEditBox, _this$oldPasswordEdit, _this$newPasswordEdit;

          if (this.isChanging) return;
          const account = ((_this$accountEditBox = this.accountEditBox) == null || (_this$accountEditBox = _this$accountEditBox.string) == null ? void 0 : _this$accountEditBox.trim()) || '';
          const oldPassword = ((_this$oldPasswordEdit = this.oldPasswordEditBox) == null ? void 0 : _this$oldPasswordEdit.string) || '';
          const newPassword = ((_this$newPasswordEdit = this.newPasswordEditBox) == null ? void 0 : _this$newPasswordEdit.string) || '';

          if (!account || !oldPassword || !newPassword) {
            if (this.tipLabel) this.tipLabel.string = '账号、旧密码、新密码不能为空';
            return;
          }

          if (oldPassword === newPassword) {
            if (this.tipLabel) this.tipLabel.string = '新密码不能与旧密码相同';
            return;
          }

          if (newPassword.length < 6) {
            if (this.tipLabel) this.tipLabel.string = '新密码长度至少6位';
            return;
          }

          this.isChanging = true;
          if (this.changeButton) this.changeButton.interactable = false;
          if (this.tipLabel) this.tipLabel.string = '修改中...';
          this.webSocketManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.CHANGE_PASSWORD, {
            account: account,
            old_password: oldPassword,
            new_password: newPassword
          }, response => {
            this.isChanging = false;
            if (this.changeButton) this.changeButton.interactable = true;

            if (!response || response.code === 408) {
              if (this.tipLabel) this.tipLabel.string = '请求超时，请重试';
              return;
            }

            if (response.success) {
              if (this.tipLabel) this.tipLabel.string = '密码修改成功，请登录';
              if (this.oldPasswordEditBox) this.oldPasswordEditBox.string = '';
              if (this.newPasswordEditBox) this.newPasswordEditBox.string = '';
              if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false;
              if (this.loginPanelNode) this.loginPanelNode.active = true; // 不自动登录：改密成功后仅回到登录页提示，不保存新token

              if (this._onAfterChangeSuccessTip) {
                this._onAfterChangeSuccessTip('密码修改成功，请使用新密码登录');
              }

              return;
            }

            const errMsg = response.message || '密码修改失败';
            if (this.tipLabel) this.tipLabel.string = errMsg;
          }, false, 10000);
        }

        onBackClick() {
          if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false;
          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.tipLabel) this.tipLabel.string = '';
        }

        onDestroy() {
          if (this.changeButton && this.changeButton.node) {
            this.changeButton.node.off(Button.EventType.CLICK, this.onChangeClick, this);
          }

          if (this.backButton && this.backButton.node) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "loginPanelNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "changePasswordPanelNode", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "accountEditBox", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "oldPasswordEditBox", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "newPasswordEditBox", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "changeButton", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "tipLabel", [_dec9], {
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
//# sourceMappingURL=0666ab187ed19d03bba937e586004fa07a7f04c9.js.map