System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, director, Button, Node, WebSocketManager, BaseSceneController, GameConfig, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, WebSocketControl;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBaseSceneController(extras) {
    _reporterNs.report("BaseSceneController", "../global/BaseSceneController", _context.meta, extras);
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
      director = _cc.director;
      Button = _cc.Button;
      Node = _cc.Node;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      BaseSceneController = _unresolved_3.BaseSceneController;
    }, function (_unresolved_4) {
      GameConfig = _unresolved_4.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "6e878WPsshOiIEKeugcVmtc", "WebsocketControl", undefined);

      __checkObsolete__(['_decorator', 'Component', 'director', 'Button', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * WebSocketControl - 后台场景控制器
       * 职责：监控Token状态，Token失效时自动跳转到登录场景
       * 设计原则：纯后台运行，无UI依赖，自动监控
       */

      _export("WebSocketControl", WebSocketControl = (_dec = ccclass('WebSocketControl'), _dec2 = property(Button), _dec3 = property({
        type: Node,
        tooltip: '异常/重连时显示的Loading面板（非Login场景）'
      }), _dec(_class = (_class2 = class WebSocketControl extends (_crd && BaseSceneController === void 0 ? (_reportPossibleCrUseOfBaseSceneController({
        error: Error()
      }), BaseSceneController) : BaseSceneController) {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "clearTokenBtn", _descriptor, this);

          _initializerDefineProperty(this, "loadingPanel", _descriptor2, this);

          this.reconnectTimer = -1;
          this.isRecovering = false;
          this.maxRecoverAttempts = 5;
          this.recoverIntervalMs = 600;
          this.recoverTimeoutMs = 3500;
        }

        // 监控相关属性 - 继承自基类，这里只需要角色选择特有的属性
        start() {
          // 调用父类start方法，启动监控
          super.start();

          if (this.loadingPanel) {
            this.loadingPanel.active = false;
          } // 绑定清除Token按钮事件


          if (this.clearTokenBtn) {
            this.clearTokenBtn.node.on(Button.EventType.CLICK, this.onClearTokenClick, this);
          }
        }
        /**
         * 清除Token按钮点击事件
         */


        onClearTokenClick() {
          console.log('🧪 测试：手动清除Token');
          this.handleTokenInvalid();
        } // 移除重复的监控方法，继承自基类

        /**
         * 检查Token状态 - 实现基类抽象方法
         * 角色选择场景需要验证：Token、UserId（已登录账号必须有账号数据）
         * 不需要验证：CharacterId（因为这是选择角色的场景，还没有选择角色）
         */


        checkStatus() {
          try {
            if (!this.currentSceneName) {
              var _director$getScene;

              this.currentSceneName = ((_director$getScene = director.getScene()) == null ? void 0 : _director$getScene.name) || '';
            }

            const currentToken = this.getCurrentToken();
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 检查WebSocket连接状态（优先检查）

            if (!wsManager.isConnected()) {
              console.warn(`⚠️ WebSocket连接断开 - 场景: ${this.currentSceneName}`);
              this.handleConnectionLost();
              return;
            } // 检查Token是否失效


            if (!this.isTokenValid(currentToken)) {
              console.warn(`⚠️ Token已失效 - 场景: ${this.currentSceneName}`);
              this.handleTokenInvalid();
              return;
            } // 角色选择场景需要验证UserId（已登录账号必须有账号数据）


            const currentUserId = wsManager.getUserId();

            if (!currentUserId || currentUserId.length === 0) {
              console.warn(`⚠️ 用户ID缺失 - 场景: ${this.currentSceneName}，已登录账号必须有账号数据`);
              this.handleTokenInvalid();
              return;
            } // 检查Token是否发生变化


            if (this.lastToken !== currentToken) {
              console.log(`🔄 Token已更新 - 场景: ${this.currentSceneName}`);
              this.lastToken = currentToken;
            } // 角色选择场景不需要验证CharacterId（因为这是选择角色的场景，还没有选择角色）

          } catch (error) {
            console.error(`❌ Token状态检查失败 - 场景: ${this.currentSceneName}:`, error);
            this.handleTokenInvalid();
          }
        }
        /**
         * 处理Token失效 - 实现基类抽象方法
         */


        handleTokenInvalid() {
          // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不做重连恢复）
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [WebSocketControl] 安全阀触发（token_idle_expired），清会话并回登录`);

            try {
              wsManager.clearAll();
            } catch {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log(`🚨 Token失效，显示Loading并尝试恢复 - 当前场景: ${this.currentSceneName}`);
          this.showLoadingAndRecover('token_invalid');
        }
        /**
         * 处理连接丢失 - 实现基类抽象方法
         */


        handleConnectionLost() {
          // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不做重连恢复）
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [WebSocketControl] 安全阀触发（connection_idle_expired），清会话并回登录`);

            try {
              wsManager.clearAll();
            } catch {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log(`🔌 WebSocket连接丢失，显示Loading并尝试恢复 - 场景: ${this.currentSceneName}`);
          this.showLoadingAndRecover('connection_lost');
        }
        /**
         * 处理数据变化事件：切换角色回选角 / 完全清空账号时不进入异常恢复流
         */


        onDataChanged(data) {
          const reason = data == null ? void 0 : data.reason;

          if (reason === 'character_id_cleared' || reason === 'all_cleared') {
            // character_id_cleared：游戏内切换角色；all_cleared：登录页完全登出等。均不显示 Loading、不做断线恢复重试。
            this.stopMonitoring();
            return;
          }

          super.onDataChanged(data);
        }

        showLoadingAndRecover(reason) {
          var _director$getScene2;

          // Login 场景不做此策略，避免登录页反复遮罩
          const sceneName = ((_director$getScene2 = director.getScene()) == null ? void 0 : _director$getScene2.name) || '';

          if (sceneName === (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN) {
            this.jumpToLoginScene();
            return;
          }

          if (this.isRecovering) {
            return;
          }

          this.isRecovering = true;
          this.stopMonitoring();

          if (this.loadingPanel) {
            this.loadingPanel.active = true;
          }

          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          let attempts = 0;

          const tryRecover = () => {
            attempts += 1;

            try {
              wsManager.connect();
            } catch (error) {
              console.error('❌ [WebSocketControl] 恢复连接异常:', error);
            }

            setTimeout(() => {
              if (this.isRecoveryReady()) {
                this.onRecoverSuccess();
                return;
              }

              if (attempts < this.maxRecoverAttempts) {
                tryRecover();
              } else {
                this.onRecoverFailed(`attempt_limit: ${reason}`);
              }
            }, this.recoverIntervalMs);
          };

          tryRecover();
          this.reconnectTimer = setTimeout(() => {
            if (this.isRecovering) {
              this.onRecoverFailed(`timeout: ${reason}`);
            }
          }, this.recoverTimeoutMs);
        }

        isRecoveryReady() {
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          if (!wsManager.isConnected()) return false;
          const token = wsManager.getToken();
          const userId = wsManager.getUserId();
          return !!(token && token.length > 0 && userId && userId.length > 0);
        }

        onRecoverSuccess() {
          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isRecovering = false;

          if (this.loadingPanel) {
            this.loadingPanel.active = false;
          }

          this.startMonitoring();
          this.checkStatus();
        }

        onRecoverFailed(reason) {
          console.warn(`⚠️ [WebSocketControl] 恢复失败，回登录: ${reason}`);

          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isRecovering = false;

          if (this.loadingPanel) {
            this.loadingPanel.active = false;
          } // 恢复失败再清理会话并回登录（直接清理，避免额外 logout 401 噪音）


          try {
            (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance().clearAll();
          } catch {}

          setTimeout(() => this.jumpToLoginScene(), 200);
        } // 移除重复的sendClearTokenCommand方法，继承自基类
        // 移除重复的jumpToLoginScene方法，继承自基类
        // 移除重复的getCurrentToken和isTokenValidInternal方法，继承自基类

        /**
         * 手动触发Token检查（调试用）
         */


        manualTokenCheck() {
          console.log('🔍 手动触发Token检查');
          this.checkStatus();
        }
        /**
         * 获取当前场景名称
         */


        getCurrentSceneName() {
          return this.currentSceneName;
        }
        /**
         * 获取监控状态
         */


        getMonitoringStatus() {
          return this.isMonitoring;
        }
        /**
         * 输出Token详细信息（调试用）
         */


        logTokenDetails() {
          try {
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            const token = this.getCurrentToken();
            const userId = wsManager.getUserId();
            const characterId = wsManager.getCharacterId();
            console.log(`📋 Token详细信息 - 场景: ${this.currentSceneName}:`);
            console.log('  - Token存在:', token !== null);
            console.log('  - Token长度:', token ? token.length : 0);
            console.log('  - 用户ID存在:', userId !== null);
            console.log('  - 角色ID存在:', characterId !== null);
            console.log('  - 游戏ID完整:', wsManager.hasGameIds());
            console.log('  - WebSocket连接状态:', wsManager.isConnected());
            console.log('  - 监控状态:', this.isMonitoring);

            if (token) {
              console.log('  - Token前10位:', token.substring(0, 10));
              console.log('  - Token后10位:', token.substring(token.length - 10));
            }

            if (userId) {
              console.log('  - 用户ID:', userId);
            }

            if (characterId) {
              console.log('  - 角色ID:', characterId);
            }
          } catch (error) {
            console.error('❌ 输出Token详细信息失败:', error);
          }
        }

        onDestroy() {
          // 停止监控
          super.onDestroy();

          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isRecovering = false; // 清理事件监听

          try {
            if (this.clearTokenBtn && this.clearTokenBtn.node) {
              this.clearTokenBtn.node.off(Button.EventType.CLICK, this.onClearTokenClick, this);
            }
          } catch {}

          console.log(`🎮 后台场景控制器销毁 - 场景: ${this.currentSceneName}`);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "clearTokenBtn", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "loadingPanel", [_dec3], {
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
//# sourceMappingURL=c372b3a6db25e8ef72f0e7619bbe9c0ba32b7fff.js.map