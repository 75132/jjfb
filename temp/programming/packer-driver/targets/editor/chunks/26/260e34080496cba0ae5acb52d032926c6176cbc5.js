System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, director, RobotList, WebSocketManager, GameConfig, RobotShow, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _crd, ccclass, property, GameMenu;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfRobotList(extras) {
    _reporterNs.report("RobotList", "./RobotList", _context.meta, extras);
  }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRobotShow(extras) {
    _reporterNs.report("RobotShow", "./RobotShow", _context.meta, extras);
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
      director = _cc.director;
    }, function (_unresolved_2) {
      RobotList = _unresolved_2.RobotList;
    }, function (_unresolved_3) {
      WebSocketManager = _unresolved_3.WebSocketManager;
    }, function (_unresolved_4) {
      GameConfig = _unresolved_4.GameConfig;
    }, function (_unresolved_5) {
      RobotShow = _unresolved_5.RobotShow;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c49f5IvjbJH/bJ9fOuwAO9W", "GameMenu", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button', 'Widget', 'Vec3', 'tween', 'Tween', 'director']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("GameMenu", GameMenu = (_dec = ccclass('GameMenu'), _dec2 = property({
        type: [Button],
        tooltip: "控制按钮"
      }), _dec3 = property({
        type: [Node],
        tooltip: "对应的面板"
      }), _dec4 = property({
        type: Button,
        tooltip: "返回角色选择按钮"
      }), _dec5 = property({
        type: Node,
        tooltip: "确认弹窗"
      }), _dec6 = property({
        type: Button,
        tooltip: "确认按钮"
      }), _dec7 = property({
        type: Button,
        tooltip: "取消按钮"
      }), _dec(_class = (_class2 = class GameMenu extends Component {
        constructor(...args) {
          super(...args);

          // 按钮和面板的绑定数组
          _initializerDefineProperty(this, "buttons", _descriptor, this);

          _initializerDefineProperty(this, "panels", _descriptor2, this);

          // 返回角色选择按钮和确认弹窗
          _initializerDefineProperty(this, "returnButton", _descriptor3, this);

          _initializerDefineProperty(this, "confirmDialog", _descriptor4, this);

          _initializerDefineProperty(this, "confirmButton", _descriptor5, this);

          _initializerDefineProperty(this, "cancelButton", _descriptor6, this);

          // 面板状态
          this.panelStates = {};
          this.activePanel = null;
          // 动画相关
          this.panelAnimations = {};
          this.lastOpenTs = 0;
          this.lastOpenName = '';
        }

        start() {
          console.log('🎮 GameMenu 开始初始化...'); // 资源预热：在主界面就提前把 RobotShow 的资源加载好，战斗/机甲界面打开更快
          // 幂等调用，不会重复加载

          try {
            (_crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
              error: Error()
            }), RobotShow) : RobotShow).preloadResources();
          } catch {} // 延迟初始化，避免阻塞场景加载


          setTimeout(() => {
            this.initializePanels();
            this.bindButtonEvents();
            console.log('✅ GameMenu 初始化完成');
          }, 20); // 延迟20ms初始化
        }
        /**
         * 初始化面板状态
         */


        initializePanels() {
          var _this$confirmDialog;

          // 初始化所有面板为隐藏状态
          this.panels.forEach(panel => {
            if (panel) {
              panel.active = false; // 所有面板默认隐藏

              this.panelStates[panel.name] = false;
            }
          }); // 初始化确认弹窗为隐藏状态

          if (this.confirmDialog) {
            this.confirmDialog.active = false;
          }

          console.log('🎮 GameMenu初始化完成，按钮数量:', this.buttons.length);
          console.log('📱 所有面板已设置为默认隐藏状态');
          console.log('🎯 返回按钮绑定弹窗:', ((_this$confirmDialog = this.confirmDialog) == null ? void 0 : _this$confirmDialog.name) || '未设置');
        }
        /**
         * 绑定按钮事件
         */


        bindButtonEvents() {
          // 绑定面板打开按钮
          this.buttons.forEach((button, index) => {
            if (button && this.panels[index]) {
              const panelName = this.panels[index].name;
              button.node.on(Button.EventType.CLICK, () => {
                this.openPanel(panelName);
              }, this);
              console.log(`🔗 按钮 ${button.node.name} 绑定到面板 ${panelName}`);
            }
          }); // 绑定返回按钮

          if (this.returnButton) {
            this.returnButton.node.on(Button.EventType.CLICK, () => {
              this.showConfirmDialog();
            }, this);
            console.log(`🎯 返回按钮 ${this.returnButton.node.name} 已绑定`);
          } // 绑定确认弹窗按钮


          if (this.confirmButton) {
            this.confirmButton.node.on(Button.EventType.CLICK, () => {
              this.confirmReturnToCharacterSelect();
            }, this);
          }

          if (this.cancelButton) {
            this.cancelButton.node.on(Button.EventType.CLICK, () => {
              this.hideConfirmDialog();
            }, this);
          }
        }
        /**
         * 打开面板
         */


        openPanel(panelName) {
          const now = Date.now();

          if (this.lastOpenName === panelName && now - this.lastOpenTs < 200) {
            return;
          }

          this.lastOpenName = panelName;
          this.lastOpenTs = now;
          const panel = this.panels.find(p => p.name === panelName);

          if (!panel) {
            console.warn(`⚠️ 未找到面板: ${panelName}`);
            return;
          } // 检查实际节点状态，如果已经显示就直接返回


          if (panel.active) {
            console.log(`🔄 面板 ${panelName} 节点已经是显示状态，无需操作`);
            return;
          } // 关闭其他面板


          this.closeAllPanels(); // 直接显示当前面板（无动画）

          panel.active = true;
          this.panelStates[panelName] = true;
          this.activePanel = panel;
          const robotList = panel.getComponent(_crd && RobotList === void 0 ? (_reportPossibleCrUseOfRobotList({
            error: Error()
          }), RobotList) : RobotList);

          if (robotList && typeof robotList.show === 'function') {
            robotList.show(false); // 明确 fromBag=false，保证 Set/设置出战 面板显示
          }

          console.log(`🚪 打开面板: ${panelName}`);
        }
        /**
         * 关闭面板
         */


        closePanel(panelName) {
          const panel = this.panels.find(p => p.name === panelName);
          if (!panel) return; // 直接隐藏面板（无动画）

          panel.active = false;
          this.panelStates[panelName] = false;
          this.activePanel = null;
          console.log(`🚪 隐藏面板: ${panelName}`);
        }
        /**
         * 关闭所有面板
         */


        closeAllPanels() {
          // 关闭普通面板
          this.panels.forEach(panel => {
            if (panel && panel.active) {
              this.closePanel(panel.name);
            }
          });
        }
        /**
         * 获取面板状态
         */


        isPanelOpen(panelName) {
          return this.panelStates[panelName] || false;
        }
        /**
         * 获取当前活动面板
         */


        getActivePanel() {
          return this.activePanel;
        }
        /**
         * 同步面板状态
         */


        syncPanelStates() {
          // 同步普通面板状态
          this.panels.forEach(panel => {
            if (panel) {
              this.panelStates[panel.name] = panel.active;

              if (panel.active) {
                this.activePanel = panel;
              }
            }
          });
          console.log('🔄 面板状态已同步');
        }

        onDestroy() {
          // 清理资源
          this.panelAnimations = {};

          try {
            // 解绑按钮事件，防止销毁期间空引用异常
            this.buttons.forEach(button => {
              if (button && button.node && button.node.isValid) {
                button.node.off(Button.EventType.CLICK);
              }
            });

            if (this.returnButton && this.returnButton.node && this.returnButton.node.isValid) {
              this.returnButton.node.off(Button.EventType.CLICK);
            }

            if (this.confirmButton && this.confirmButton.node && this.confirmButton.node.isValid) {
              this.confirmButton.node.off(Button.EventType.CLICK);
            }

            if (this.cancelButton && this.cancelButton.node && this.cancelButton.node.isValid) {
              this.cancelButton.node.off(Button.EventType.CLICK);
            }
          } catch {}
        }
        /**
         * 显示确认弹窗
         */


        showConfirmDialog() {
          if (this.confirmDialog) {
            this.confirmDialog.active = true;
            console.log('❓ 显示返回确认弹窗');
          }
        }
        /**
         * 隐藏确认弹窗
         */


        hideConfirmDialog() {
          if (this.confirmDialog) {
            this.confirmDialog.active = false;
            console.log('❌ 隐藏返回确认弹窗');
          }
        }
        /**
         * 确认返回角色选择场景
         */


        confirmReturnToCharacterSelect() {
          console.log('✅ 用户确认切换角色（返回选角，非账号登出）');

          try {
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 隐藏确认弹窗

            this.hideConfirmDialog(); // 切换角色前若仍在线，立即预拉角色列表（断线则忽略，由选角场景再拉）

            if (wsManager.isConnected()) {
              wsManager.prefetchAllCharactersIfConnected(true);
            }

            wsManager.switchCharacterAndReturnToSelect(); // 延迟一小段时间确保数据清除完成，然后切换场景

            setTimeout(() => {
              // 返回角色选择场景（不是登录场景）
              director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).SCENE_NAMES.CHARACTER_SELECT, error => {
                if (error) {
                  console.error('❌ 跳转角色选择场景失败:', error);
                } else {
                  console.log('✅ 已返回角色选择场景');
                }
              });
            }, 100); // 延迟100ms确保数据清除和事件处理完成
          } catch (error) {
            console.error('❌ 返回选角流程异常:', error);
            this.hideConfirmDialog();
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "buttons", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "panels", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "returnButton", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "confirmDialog", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "confirmButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "cancelButton", [_dec7], {
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
//# sourceMappingURL=260e34080496cba0ae5acb52d032926c6176cbc5.js.map