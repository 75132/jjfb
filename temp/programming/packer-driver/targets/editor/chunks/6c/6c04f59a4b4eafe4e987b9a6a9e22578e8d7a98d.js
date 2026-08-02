System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, Sprite, MechAttributeTEST, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _crd, ccclass, property, RobotAttributePanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfMechAttributeTEST(extras) {
    _reporterNs.report("MechAttributeTEST", "./MechAttributeTEST", _context.meta, extras);
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
      Sprite = _cc.Sprite;
    }, function (_unresolved_2) {
      MechAttributeTEST = _unresolved_2.MechAttributeTEST;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "72490g1qDdPRZ3PQ760nXAI", "RobotAttributePanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button', 'Widget', 'Sprite']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("RobotAttributePanel", RobotAttributePanel = (_dec = ccclass('RobotAttributePanel'), _dec2 = property({
        type: [Button],
        tooltip: "三个功能按钮"
      }), _dec3 = property({
        type: [Node],
        tooltip: "对应的功能面板"
      }), _dec4 = property({
        type: Button,
        tooltip: "隐藏按钮"
      }), _dec5 = property({
        type: Node,
        tooltip: "点击隐藏的目标节点（不设置则隐藏当前组件节点）"
      }), _dec6 = property({
        type: _crd && MechAttributeTEST === void 0 ? (_reportPossibleCrUseOfMechAttributeTEST({
          error: Error()
        }), MechAttributeTEST) : MechAttributeTEST,
        tooltip: "机甲属性显示组件（可选，会自动查找）"
      }), _dec(_class = (_class2 = class RobotAttributePanel extends Component {
        constructor(...args) {
          super(...args);

          // 三个功能按钮和对应的面板
          _initializerDefineProperty(this, "functionButtons", _descriptor, this);

          _initializerDefineProperty(this, "functionPanels", _descriptor2, this);

          // 隐藏按钮
          _initializerDefineProperty(this, "destroyButton", _descriptor3, this);

          // 新增：要隐藏的目标节点（未设置则隐藏本组件节点）
          _initializerDefineProperty(this, "targetToHide", _descriptor4, this);

          // 新增：MechAttributeTEST组件（用于显示机甲信息）
          _initializerDefineProperty(this, "mechAttributeComponent", _descriptor5, this);

          // 面板状态
          this.panelStates = {};
          this.currentOpenPanel = null;
        }

        start() {
          // 隐藏初始化日志
          // 延迟初始化，避免阻塞场景加载
          setTimeout(() => {
            this.initializePanels();
            this.bindButtonEvents();
            this.bindDestroyButton(); // 如果没有手动绑定MechAttributeTEST，尝试自动查找

            if (!this.mechAttributeComponent) {
              // 隐藏详细日志
              this.mechAttributeComponent = this.node.getComponentInChildren(_crd && MechAttributeTEST === void 0 ? (_reportPossibleCrUseOfMechAttributeTEST({
                error: Error()
              }), MechAttributeTEST) : MechAttributeTEST);

              if (!this.mechAttributeComponent) {
                // 只在找不到时记录警告
                console.warn('⚠️ [RobotAttributePanel] 未找到 MechAttributeTEST 组件');
              }
            }
          }, 50); // 延迟50ms初始化
        }
        /**
         * 初始化面板状态
         */


        initializePanels() {
          var _this$currentOpenPane;

          // 简化日志输出，减少初始化时间
          console.log(`🔧 初始化面板状态 - 按钮:${this.functionButtons.length}, 面板:${this.functionPanels.length}`); // 初始化所有面板状态

          this.functionPanels.forEach((panel, index) => {
            if (panel) {
              if (index === 0) {
                // 第一个面板默认显示
                panel.active = true;
                this.panelStates[panel.name] = true;
                this.currentOpenPanel = panel;
              } else {
                // 其他面板隐藏
                panel.active = false;
                this.panelStates[panel.name] = false;
              }
            }
          }); // 初始化按钮的Sprite组件状态

          this.functionButtons.forEach((button, buttonIndex) => {
            if (button) {
              const buttonNode = button.node;
              const sprite = buttonNode.getComponent(Sprite);

              if (sprite) {
                sprite.enabled = buttonIndex === 0; // 只有第一个按钮启用
              }
            }
          });
          console.log(`✅ RobotAttributePanel初始化完成 - 当前面板: ${((_this$currentOpenPane = this.currentOpenPanel) == null ? void 0 : _this$currentOpenPane.name) || '无'}`);
        }
        /**
         * 绑定功能按钮事件
         */


        bindButtonEvents() {
          this.functionButtons.forEach((button, index) => {
            if (button && this.functionPanels[index]) {
              const panelName = this.functionPanels[index].name;
              button.node.on(Button.EventType.CLICK, () => {
                this.switchToPanel(panelName);
              }, this); // 隐藏绑定日志
            }
          });
        }
        /**
         * 绑定隐藏按钮事件
         */


        bindDestroyButton() {
          if (this.destroyButton) {
            this.destroyButton.node.on(Button.EventType.CLICK, () => {
              this.hideTarget();
            }, this); // 隐藏绑定日志
          }
        }
        /**
         * 设置要隐藏的目标节点（可在运行时动态指定）
         */


        setTargetToHide(node) {
          this.targetToHide = node;
        }
        /**
         * 隐藏目标（若未设置则隐藏自身节点）
         */


        hideTarget() {
          const target = this.targetToHide || this.node;

          if (target) {
            target.active = false; // 隐藏日志
          }
        }
        /**
         * 切换到指定面板
         */


        switchToPanel(panelName) {
          const targetPanel = this.functionPanels.find(p => p.name === panelName);

          if (!targetPanel) {
            console.warn(`⚠️ 未找到面板: ${panelName}`);
            return;
          } // 如果点击的是当前已打开的面板，不做任何操作


          if (this.currentOpenPanel === targetPanel) {
            return;
          } // 隐藏当前打开的面板


          if (this.currentOpenPanel) {
            this.hidePanel(this.currentOpenPanel.name);
          } // 显示目标面板


          this.showPanel(panelName);
        }
        /**
         * 显示面板
         */


        showPanel(panelName) {
          const panel = this.functionPanels.find(p => p.name === panelName);
          if (!panel) return; // 强制隐藏其他面板

          this.functionPanels.forEach(p => {
            if (p && p !== panel) {
              p.active = false;
              this.panelStates[p.name] = false;
            }
          }); // 显示目标面板

          panel.active = true;
          this.panelStates[panelName] = true;
          this.currentOpenPanel = panel; // 控制按钮的Sprite组件显示/隐藏

          this.functionButtons.forEach((button, buttonIndex) => {
            if (button) {
              const sprite = button.node.getComponent(Sprite);

              if (sprite) {
                sprite.enabled = buttonIndex === this.functionPanels.findIndex(p => p.name === panelName);
              }
            }
          });
        }
        /**
         * 隐藏面板
         */


        hidePanel(panelName) {
          const panel = this.functionPanels.find(p => p.name === panelName);
          if (!panel) return;
          panel.active = false;
          this.panelStates[panelName] = false;

          if (this.currentOpenPanel === panel) {
            this.currentOpenPanel = null;
          }
        }
        /**
         * 隐藏整个RobotAttributePanel节点（兼容旧接口）
         */


        hideRobotAttributePanel() {
          this.hideTarget();
        }
        /**
         * 获取面板状态
         */


        isPanelOpen(panelName) {
          return this.panelStates[panelName] || false;
        }
        /**
         * 获取当前打开的面板
         */


        getCurrentOpenPanel() {
          return this.currentOpenPanel;
        }
        /**
         * 获取所有面板状态
         */


        getAllPanelStates() {
          return { ...this.panelStates
          };
        }
        /**
         * 获取节点的完整路径（用于调试）
         */


        getNodePath(node) {
          if (!node) return '';
          const path = [];
          let current = node;

          while (current) {
            path.unshift(current.name);
            current = current.parent;
          }

          return path.join('/');
        }
        /**
         * 显示选中的机甲信息
         * @param petId 机甲宠物的_id
         */


        showSelectedRobot(petId) {
          // 隐藏详细日志，只保留错误日志
          // 确保面板显示
          if (this.node) {
            this.node.active = true;
          } // 默认切换到第一个面板（属性面板）


          if (this.functionPanels.length > 0) {
            this.showPanel(this.functionPanels[0].name);
          } else {
            console.warn('⚠️ [RobotAttributePanel] 没有功能面板可用');
          } // 性能优化：立即调用，不延迟
          // 调用MechAttributeTEST组件显示机甲信息


          if (this.mechAttributeComponent && this.mechAttributeComponent.node && this.mechAttributeComponent.node.isValid) {
            this.mechAttributeComponent.showSelectedRobot(petId);
          } else {
            // 尝试重新查找
            this.mechAttributeComponent = this.node.getComponentInChildren(_crd && MechAttributeTEST === void 0 ? (_reportPossibleCrUseOfMechAttributeTEST({
              error: Error()
            }), MechAttributeTEST) : MechAttributeTEST);

            if (!this.mechAttributeComponent) {
              const scene = this.node.scene;

              if (scene) {
                this.mechAttributeComponent = scene.getComponentInChildren(_crd && MechAttributeTEST === void 0 ? (_reportPossibleCrUseOfMechAttributeTEST({
                  error: Error()
                }), MechAttributeTEST) : MechAttributeTEST);
              }
            }

            if (this.mechAttributeComponent && this.mechAttributeComponent.node && this.mechAttributeComponent.node.isValid) {
              this.mechAttributeComponent.showSelectedRobot(petId);
            } else {
              console.error('❌ [RobotAttributePanel] 找不到 MechAttributeTEST 组件');
            }
          }
        }

        onDestroy() {
          // 清理事件监听
          this.functionButtons.forEach(button => {
            if (button && button.node && button.node.isValid) {
              button.node.off(Button.EventType.CLICK);
            }
          });

          if (this.destroyButton && this.destroyButton.node && this.destroyButton.node.isValid) {
            this.destroyButton.node.off(Button.EventType.CLICK);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "functionButtons", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "functionPanels", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "destroyButton", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "targetToHide", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "mechAttributeComponent", [_dec6], {
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
//# sourceMappingURL=6c04f59a4b4eafe4e987b9a6a9e22578e8d7a98d.js.map