System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, GameMenu, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _crd, ccclass, property, CentralMenu;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfGameMenu(extras) {
    _reporterNs.report("GameMenu", "./GameMenu", _context.meta, extras);
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
      Button = _cc.Button;
    }, function (_unresolved_2) {
      GameMenu = _unresolved_2.GameMenu;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "7ef24X0iH1AoJJSwpv2XfB+", "CentralMenu", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * CentralMenu
       * - 统一管理 7 组“按钮 <-> 面板”显隐切换
       * - 点击触发：只打开目标面板，不做“再次点击关闭”的循环效果
       * - 始终关闭其它面板，保证同一时刻只有一个面板处于打开状态
       * - 如果按钮被 GameMenu 管理（挂在 GameMenu 里），则不在这里绑定，避免冲突
       */

      _export("CentralMenu", CentralMenu = (_dec = ccclass('CentralMenu'), _dec2 = property({
        type: Button,
        tooltip: '第1组按钮'
      }), _dec3 = property({
        type: Node,
        tooltip: '第1组面板'
      }), _dec4 = property({
        type: Button,
        tooltip: '第2组按钮'
      }), _dec5 = property({
        type: Node,
        tooltip: '第2组面板'
      }), _dec6 = property({
        type: Button,
        tooltip: '第3组按钮'
      }), _dec7 = property({
        type: Node,
        tooltip: '第3组面板'
      }), _dec8 = property({
        type: Button,
        tooltip: '第4组按钮（预留）'
      }), _dec9 = property({
        type: Node,
        tooltip: '第4组面板（预留）'
      }), _dec10 = property({
        type: Button,
        tooltip: '第5组按钮（预留）'
      }), _dec11 = property({
        type: Node,
        tooltip: '第5组面板（预留）'
      }), _dec12 = property({
        type: Button,
        tooltip: '第6组按钮（预留）'
      }), _dec13 = property({
        type: Node,
        tooltip: '第6组面板（预留）'
      }), _dec14 = property({
        type: Button,
        tooltip: '第7组按钮（预留）'
      }), _dec15 = property({
        type: Node,
        tooltip: '第7组面板（预留）'
      }), _dec(_class = (_class2 = class CentralMenu extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "button1", _descriptor, this);

          _initializerDefineProperty(this, "panel1", _descriptor2, this);

          _initializerDefineProperty(this, "button2", _descriptor3, this);

          _initializerDefineProperty(this, "panel2", _descriptor4, this);

          _initializerDefineProperty(this, "button3", _descriptor5, this);

          _initializerDefineProperty(this, "panel3", _descriptor6, this);

          _initializerDefineProperty(this, "button4", _descriptor7, this);

          _initializerDefineProperty(this, "panel4", _descriptor8, this);

          _initializerDefineProperty(this, "button5", _descriptor9, this);

          _initializerDefineProperty(this, "panel5", _descriptor10, this);

          _initializerDefineProperty(this, "button6", _descriptor11, this);

          _initializerDefineProperty(this, "panel6", _descriptor12, this);

          _initializerDefineProperty(this, "button7", _descriptor13, this);

          _initializerDefineProperty(this, "panel7", _descriptor14, this);
        }

        start() {
          this.initPanelsHidden();
          this.bindButtons();
        }

        getPanels() {
          return [this.panel1, this.panel2, this.panel3, this.panel4, this.panel5, this.panel6, this.panel7];
        }

        getButtons() {
          return [this.button1, this.button2, this.button3, this.button4, this.button5, this.button6, this.button7];
        }

        initPanelsHidden() {
          for (const p of this.getPanels()) {
            if (p != null && p.isValid) p.active = false;
          }
        }

        bindButtons() {
          const buttons = this.getButtons();
          const panels = this.getPanels();

          for (let i = 0; i < 7; i++) {
            const btn = buttons[i];
            const panel = panels[i];
            if (!btn || !panel) continue; // 如果按钮由 GameMenu 管理，则不在这里绑定

            if (this.isManagedByGameMenu(btn.node)) continue;
            btn.node.on(Button.EventType.CLICK, () => {
              this.togglePanelByIndex(i);
            }, this);
          }
        }

        isManagedByGameMenu(node) {
          if (!node) return false;

          try {
            let current = node;

            while (current) {
              const menu = current.getComponent(_crd && GameMenu === void 0 ? (_reportPossibleCrUseOfGameMenu({
                error: Error()
              }), GameMenu) : GameMenu);
              if (menu) return true;
              current = current.parent;
            }

            return false;
          } catch {
            return false;
          }
        }

        togglePanelByIndex(index) {
          const panels = this.getPanels();
          const currentPanel = panels[index];
          if (!currentPanel) return; // 触发式：始终打开当前面板，并关闭其他面板

          currentPanel.active = true;

          for (let i = 0; i < panels.length; i++) {
            if (i !== index && panels[i]) {
              panels[i].active = false;
            }
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "button1", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "panel1", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "button2", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "panel2", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "button3", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "panel3", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "button4", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "panel4", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "button5", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "panel5", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "button6", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "panel6", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "button7", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "panel7", [_dec15], {
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
//# sourceMappingURL=edc248c91b347403f64a22452e47069d623a4c24.js.map