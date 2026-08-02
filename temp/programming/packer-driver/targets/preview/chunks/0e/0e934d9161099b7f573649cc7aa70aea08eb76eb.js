System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Button, Component, Label, Node, WebSocketManager, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, MailPanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Button = _cc.Button;
      Component = _cc.Component;
      Label = _cc.Label;
      Node = _cc.Node;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "dd262xGa9FHv5B+VjrahAXs", "MailPanel", undefined);
      /**
       * 邮件面板
       */


      __checkObsolete__(['_decorator', 'Button', 'Component', 'Label', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("MailPanel", MailPanel = (_dec = ccclass('MailPanel'), _dec2 = property(Node), _dec3 = property(Label), _dec4 = property(Button), _dec5 = property(Button), _dec(_class = (_class2 = class MailPanel extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "listRoot", _descriptor, this);

          _initializerDefineProperty(this, "detailLabel", _descriptor2, this);

          _initializerDefineProperty(this, "claimButton", _descriptor3, this);

          _initializerDefineProperty(this, "refreshButton", _descriptor4, this);

          this._ws = null;
          this._mails = [];
          this._selectedId = null;

          this.refreshList = () => {
            if (!this._ws) return;

            this._ws.request('mail_list', {}, resp => {
              var _resp$data;

              if (!(resp != null && resp.success)) return;
              this._mails = ((_resp$data = resp.data) == null ? void 0 : _resp$data.mails) || resp.mails || [];
              this.renderList();
            }, true, 8000);
          };

          this.onClaim = () => {
            if (!this._ws || !this._selectedId) return;

            this._ws.request('mail_claim', {
              mail_id: this._selectedId
            }, resp => {
              if (resp != null && resp.success) {
                this.refreshList();
              }
            }, true, 8000);
          };
        }

        onLoad() {
          var _this$claimButton, _this$refreshButton;

          this._ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          (_this$claimButton = this.claimButton) == null || _this$claimButton.node.on(Button.EventType.CLICK, this.onClaim, this);
          (_this$refreshButton = this.refreshButton) == null || _this$refreshButton.node.on(Button.EventType.CLICK, this.refreshList, this);
        }

        onEnable() {
          this.refreshList();
        }

        renderList() {
          var _this = this;

          if (!this.listRoot) return;
          var children = this.listRoot.children;

          var _loop = function _loop() {
            var row = children[i];
            var mail = _this._mails[i];
            if (!row) return 0; // continue

            if (!mail) {
              row.active = false;
              return 0; // continue
            }

            row.active = true;
            var lab = row.getComponentInChildren(Label);
            if (lab) lab.string = "" + (mail.read ? '' : '[新]') + mail.title;
            var btn = row.getComponent(Button);

            if (btn) {
              btn.node.off(Button.EventType.CLICK);
              btn.node.on(Button.EventType.CLICK, () => _this.selectMail(mail.mail_id), _this);
            }
          },
              _ret;

          for (var i = 0; i < Math.max(children.length, this._mails.length); i++) {
            _ret = _loop();
            if (_ret === 0) continue;
          }

          if (this._mails.length && !this._selectedId) {
            this.selectMail(this._mails[0].mail_id);
          }
        }

        selectMail(mailId) {
          var _this$_ws;

          this._selectedId = mailId;

          var mail = this._mails.find(m => m.mail_id === mailId);

          if (!mail) return;

          if (this.detailLabel) {
            this.detailLabel.string = mail.title + "\n\n" + (mail.body || '');
          }

          (_this$_ws = this._ws) == null || _this$_ws.request('mail_read', {
            mail_id: mailId
          }, () => {}, true, 5000);

          if (this.claimButton) {
            this.claimButton.interactable = !mail.claimed;
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "listRoot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "detailLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "claimButton", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "refreshButton", [_dec5], {
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
//# sourceMappingURL=0e934d9161099b7f573649cc7aa70aea08eb76eb.js.map