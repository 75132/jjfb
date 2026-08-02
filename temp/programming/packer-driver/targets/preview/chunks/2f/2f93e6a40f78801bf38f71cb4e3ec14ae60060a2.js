System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, ScrollView, Label, Button, UITransform, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _crd, ccclass, property, Log;

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
      Node = _cc.Node;
      ScrollView = _cc.ScrollView;
      Label = _cc.Label;
      Button = _cc.Button;
      UITransform = _cc.UITransform;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "318f1RUE3NG+ogxi/mrORws", "log", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'ScrollView', 'Label', 'Button', 'UITransform']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Log", Log = (_dec = ccclass('Log'), _dec2 = property(ScrollView), _dec3 = property(Node), _dec4 = property(Label), _dec5 = property(Button), _dec6 = property({
        tooltip: '追加时自动滚动到底部'
      }), _dec7 = property({
        tooltip: '自动调整内容高度以显示全部文本'
      }), _dec(_class = (_class2 = class Log extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "scrollView", _descriptor, this);

          _initializerDefineProperty(this, "content", _descriptor2, this);

          _initializerDefineProperty(this, "text", _descriptor3, this);

          _initializerDefineProperty(this, "openButton", _descriptor4, this);

          _initializerDefineProperty(this, "autoScroll", _descriptor5, this);

          _initializerDefineProperty(this, "autoResize", _descriptor6, this);

          this.lines = [];
          this.origLog = void 0;
          this.origWarn = void 0;
          this.origError = void 0;
        }

        onLoad() {
          var _this = this;

          this.origLog = console.log.bind(console);
          this.origWarn = console.warn.bind(console);
          this.origError = console.error.bind(console);

          var append = (level, args) => {
            try {
              var msg = args.map(v => {
                try {
                  return typeof v === 'string' ? v : JSON.stringify(v);
                } catch (_unused) {
                  return String(v);
                }
              }).join(' ');
              var line = "[" + level + "] " + msg;
              this.lines.push(line);
              this.render();
            } catch (_unused2) {}
          };

          console.log = function () {
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }

            _this.origLog(...args);

            append('INFO', args);
          };

          console.warn = function () {
            for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              args[_key2] = arguments[_key2];
            }

            _this.origWarn(...args);

            append('WARN', args);
          };

          console.error = function () {
            for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
              args[_key3] = arguments[_key3];
            }

            _this.origError(...args);

            append('ERROR', args);
          };

          if (this.openButton) this.openButton.node.on(Button.EventType.CLICK, this.togglePanel, this);
          if (!this.content && this.scrollView) this.content = this.scrollView.content;
          if (!this.text && this.content) this.text = this.content.getComponent(Label);
          if (this.text) this.text.overflow = Label.Overflow.RESIZE_HEIGHT;
        }

        onDestroy() {
          if (this.origLog) console.log = this.origLog;
          if (this.origWarn) console.warn = this.origWarn;
          if (this.origError) console.error = this.origError;

          if (this.openButton && this.openButton.node && this.openButton.node.isValid) {
            this.openButton.node.off(Button.EventType.CLICK, this.togglePanel, this);
          }
        }

        openPanel() {
          if (this.scrollView && this.scrollView.node) this.scrollView.node.active = true;
        }

        togglePanel() {
          if (this.scrollView && this.scrollView.node) {
            var n = this.scrollView.node;
            n.active = !n.active;
            if (n.active && this.autoScroll) this.scrollView.scrollToBottom(0.2, true);
          }
        }

        render() {
          if (this.text) this.text.string = this.lines.join('\n');

          if (this.autoResize && this.text && this.content) {
            var lt = this.text.node.getComponent(UITransform);
            var ct = this.content.getComponent(UITransform);

            if (lt && ct) {
              var h = lt.contentSize.height;
              var w = ct.contentSize.width;
              ct.setContentSize(w, h);
            }
          }

          if (this.autoScroll && this.scrollView) this.scrollView.scrollToBottom(0.2, true);
        }

        clear() {
          this.lines = [];
          if (this.text) this.text.string = '';
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "scrollView", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "content", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "text", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "openButton", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "autoScroll", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "autoResize", [_dec7], {
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
//# sourceMappingURL=2f93e6a40f78801bf38f71cb4e3ec14ae60060a2.js.map