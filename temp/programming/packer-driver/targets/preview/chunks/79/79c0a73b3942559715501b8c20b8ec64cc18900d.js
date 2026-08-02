System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, WebSocketManager, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, ChatRoom;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../../global/WebSocketManager", _context.meta, extras);
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
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "ee603gyK9tEDqKPmpf7Hte6", "ChatRoom", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ChatRoom", ChatRoom = (_dec = ccclass('ChatRoom'), _dec2 = property({
        type: Node
      }), _dec3 = property({
        type: Node
      }), _dec(_class = (_class2 = class ChatRoom extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "fullPanel", _descriptor, this);

          _initializerDefineProperty(this, "trigger", _descriptor2, this);

          this.ws = null;
          this._touchBound = false;
        }

        start() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          var target = this.trigger || this.findDefaultTrigger() || this.node;

          if (target && typeof target.on === 'function') {
            target.on(Node.EventType.TOUCH_END, this.openFull, this);
            this._touchBound = true;
          }
        }

        onDisable() {
          var target = this.trigger || this.findDefaultTrigger() || this.node;

          try {
            if (this._touchBound && target && target.isValid && typeof target.off === 'function' && target._eventProcessor) {
              target.off(Node.EventType.TOUCH_END, this.openFull, this);
              this._touchBound = false;
            }
          } catch (_unused) {}
        }

        onDestroy() {
          var target = this.trigger || this.findDefaultTrigger() || this.node;

          try {
            if (this._touchBound && target && target.isValid && typeof target.off === 'function' && target._eventProcessor) {
              target.off(Node.EventType.TOUCH_END, this.openFull, this);
            }
          } catch (_unused2) {}
        }

        openFull() {
          if (!this.fullPanel) {
            this.fullPanel = this.findFullPanel();
          }

          if (!this.fullPanel) {
            return;
          }

          this.fullPanel.active = true;
        }

        findDefaultTrigger() {
          var n = this.node.getChildByName('Button');
          return n || null;
        }

        findFullPanel() {
          var p = this.node.parent;

          if (!p) {
            return null;
          }

          var n = p.getChildByName('ChatRoomFull');
          return n || null;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "fullPanel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "trigger", [_dec3], {
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
//# sourceMappingURL=79c0a73b3942559715501b8c20b8ec64cc18900d.js.map