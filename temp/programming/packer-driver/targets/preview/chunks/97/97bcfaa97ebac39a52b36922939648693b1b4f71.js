System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5", "__unresolved_6"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Node, director, Button, WebSocketManager, BaseSceneController, GameConfig, GameCommonData, ResourceManager, RobotShow, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _class3, _crd, ccclass, property, GameControl;

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

  function _reportPossibleCrUseOfGameCommonData(extras) {
    _reporterNs.report("GameCommonData", "./GameCommonData", _context.meta, extras);
  }

  function _reportPossibleCrUseOfResourceManager(extras) {
    _reporterNs.report("ResourceManager", "./ResourceManager", _context.meta, extras);
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
      Node = _cc.Node;
      director = _cc.director;
      Button = _cc.Button;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      BaseSceneController = _unresolved_3.BaseSceneController;
    }, function (_unresolved_4) {
      GameConfig = _unresolved_4.GameConfig;
    }, function (_unresolved_5) {
      GameCommonData = _unresolved_5.GameCommonData;
    }, function (_unresolved_6) {
      ResourceManager = _unresolved_6.ResourceManager;
    }, function (_unresolved_7) {
      RobotShow = _unresolved_7.RobotShow;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "6cf1dauZHpHtoRqvrsYhMl8", "GameControl", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'director', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * GameControl - 游戏场景控制器
       * 职责：监控Token和游戏ID状态，自动跳转到相应场景
       * 设计原则：纯后台运行，无UI依赖，自动监控
       *
       * 注意：当前已禁用服务器验证功能，仅保留基础监控
       */

      _export("GameControl", GameControl = (_dec = ccclass('GameControl'), _dec2 = property({
        type: Button,
        tooltip: "第一个按钮"
      }), _dec3 = property({
        type: Node,
        tooltip: "第一个面板"
      }), _dec4 = property({
        type: Button,
        tooltip: "第二个按钮"
      }), _dec5 = property({
        type: Node,
        tooltip: "第二个面板"
      }), _dec6 = property({
        type: Button,
        tooltip: "第三个按钮"
      }), _dec7 = property({
        type: Node,
        tooltip: "第三个面板"
      }), _dec8 = property({
        type: Node,
        tooltip: "Loading面板（用于显示加载状态）"
      }), _dec(_class = (_class2 = (_class3 = class GameControl extends (_crd && BaseSceneController === void 0 ? (_reportPossibleCrUseOfBaseSceneController({
        error: Error()
      }), BaseSceneController) : BaseSceneController) {
        constructor() {
          super(...arguments);
          // 监控相关属性 - 继承自基类，这里只需要游戏场景特有的属性
          this.lastUserId = null;
          this.lastCharacterId = null;
          // 游戏场景使用更长的检查间隔，减少性能消耗
          this.tokenCheckInterval = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).TOKEN_CHECK_INTERVAL_GAME;

          // 新增：三个按钮和面板的绑定
          _initializerDefineProperty(this, "button1", _descriptor, this);

          _initializerDefineProperty(this, "panel1", _descriptor2, this);

          _initializerDefineProperty(this, "button2", _descriptor3, this);

          _initializerDefineProperty(this, "panel2", _descriptor4, this);

          _initializerDefineProperty(this, "button3", _descriptor5, this);

          _initializerDefineProperty(this, "panel3", _descriptor6, this);

          _initializerDefineProperty(this, "loadingPanel", _descriptor7, this);

          // 面板显示状态
          this.panelStates = {};
          // 重连相关
          this.reconnectTimer = -1;
          this.reconnectTimeout = 3000;
          // 3秒超时
          this.isReconnecting = false;
        }

        start() {
          // 调用父类start方法，启动监控（父类会延迟2秒，不影响场景加载）
          super.start(); // 延迟初始化非关键操作，避免阻塞场景加载
          // 先让场景快速显示出来，再初始化其他功能

          this.scheduleOnce(() => {
            // 初始化游戏场景特有的属性
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            this.lastUserId = wsManager.getUserId();
            this.lastCharacterId = wsManager.getCharacterId(); // 初始化面板状态为隐藏（保证按钮首次点击有确定行为）

            this.initializePanelStates(); // 初始化Loading面板为隐藏

            if (this.loadingPanel) {
              this.loadingPanel.active = false;
            } // 绑定按钮事件（用于面板1~3的开/关循环）


            this.bindButtonEvents(); // 监听WebSocketManager的数据变化事件（关键：无论从哪里清除数据都能立即响应）

            this.setupDataChangeListener(); // 预加载游戏常用资源（陆续加载，不阻塞主线程）

            this.preloadGameResources();
          }, 0.05); // 延迟50ms，确保场景渲染完成
        }
        /**
         * 设置数据变化监听（监听WebSocketManager的数据清除事件）
         */


        setupDataChangeListener() {
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          wsManager.on('data_changed', this.onDataChanged, this);
        }
        /**
         * 处理数据变化事件（当WebSocketManager的数据被清除时立即触发）
         * 修复：重写基类方法，现在可以正确使用 super 调用基类方法
         */


        onDataChanged(data) {
          // 处理 GameControl 特有的逻辑
          if (data && typeof data === 'object' && data.reason) {
            console.log("\uD83D\uDEA8 [GameControl] \u68C0\u6D4B\u5230\u6570\u636E\u53D8\u5316\uFF1A" + data.reason); // 切换角色回选角（清除 characterId），不应按断线处理 Loading/重连

            if (data.reason === 'character_id_cleared') {
              console.log('ℹ️ [GameControl] 检测到切换角色（清除角色ID），不触发 Loading'); // 停止监控，准备场景切换

              this.stopMonitoring();
              return;
            } // 如果是完全清除所有数据（all_cleared），说明是异常情况或完全退出登录


            if (data.reason === 'all_cleared') {
              console.log('⚠️ [GameControl] 检测到所有数据被清除，停止监控');
              this.stopMonitoring();
              return;
            } // 立即检查数据完整性


            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var hasToken = data.token !== null && data.token !== undefined && data.token.length > 0;
            var hasUserId = data.userId !== null && data.userId !== undefined && data.userId.length > 0;
            var hasCharacterId = data.characterId !== null && data.characterId !== undefined && data.characterId.length > 0;
            var isConnected = wsManager.isConnected(); // 如果任何关键数据缺失，立即显示Loading

            if (!isConnected || !hasToken || !hasUserId || !hasCharacterId) {
              console.log('❌ [GameControl] 数据不完整，立即显示Loading');
              this.showLoadingAndReconnect("data_changed: " + data.reason);
              return;
            }
          } // 调用基类方法（基类会调用 checkStatus）


          super.onDataChanged(data);
        }
        /**
         * 初始化面板状态
         */


        initializePanelStates() {
          if (this.panel1) {
            this.panelStates['panel1'] = false;
            this.panel1.active = false;
          }

          if (this.panel2) {
            this.panelStates['panel2'] = false;
            this.panel2.active = false;
          }

          if (this.panel3) {
            this.panelStates['panel3'] = false;
            this.panel3.active = false;
          }
        }
        /**
         * 绑定按钮事件
         */


        bindButtonEvents() {
          // 绑定第一个按钮
          if (this.button1 && this.panel1) {
            this.button1.node.on(Button.EventType.CLICK, () => {
              this.togglePanel('panel1', this.panel1);
            }, this);
          } // 绑定第二个按钮


          if (this.button2 && this.panel2) {
            this.button2.node.on(Button.EventType.CLICK, () => {
              this.togglePanel('panel2', this.panel2);
            }, this);
          } // 绑定第三个按钮


          if (this.button3 && this.panel3) {
            this.button3.node.on(Button.EventType.CLICK, () => {
              this.togglePanel('panel3', this.panel3);
            }, this);
          }
        } // 注：GameControl 仅负责自身按钮/面板的开/关循环，不与 GameMenu/中央菜单耦合

        /**
         * 切换面板显示状态
         */


        togglePanel(panelKey, panel) {
          // 点击一次：显示；再点击：关闭（循环）
          var willOpen = !panel.active;
          this.panelStates[panelKey] = willOpen;
          panel.active = willOpen; // 只在“打开”时关闭其他面板，避免关闭当前面板时把其他面板误伤

          if (willOpen) this.closeOtherPanels(panelKey);
        }
        /**
         * 关闭其他面板
         */


        closeOtherPanels(currentPanelKey) {
          Object.keys(this.panelStates).forEach(key => {
            if (key !== currentPanelKey) {
              this.panelStates[key] = false;
              var panel = this.getPanelByKey(key);

              if (panel) {
                panel.active = false;
              }
            }
          });
        }
        /**
         * 根据key获取面板
         */


        getPanelByKey(key) {
          switch (key) {
            case 'panel1':
              return this.panel1;

            case 'panel2':
              return this.panel2;

            case 'panel3':
              return this.panel3;

            default:
              return null;
          }
        }
        /**
         * 开始监控
         */


        startMonitoring() {
          // 🔧 检查是否禁用服务器验证
          if (GameControl.DISABLE_SERVER_VALIDATION) {
            console.log('🚫 服务器验证已禁用，跳过监控启动');
            return;
          }

          if (this.isMonitoring) {
            return;
          }

          this.isMonitoring = true;
          this.lastToken = this.getCurrentToken();
          this.lastUserId = this.getCurrentUserId();
          this.lastCharacterId = this.getCurrentCharacterId(); // 设置定时器，定期检查状态（使用更长的间隔减少性能消耗）

          this.tokenCheckTimer = setInterval(() => {
            this.checkStatus();
          }, this.tokenCheckInterval); // 使用 requestAnimationFrame 优化检查频率（仅在游戏运行时）
          // 这样可以减少不必要的检查，提高性能

          console.log("\uD83D\uDD0D \u6E38\u620F\u72B6\u6001\u76D1\u63A7\u5DF2\u542F\u52A8 - \u68C0\u67E5\u95F4\u9694: " + this.tokenCheckInterval + "ms"); // 立即检查一次

          this.checkStatus();
        }
        /**
         * 停止监控
         */


        stopMonitoring() {
          if (this.tokenCheckTimer !== -1) {
            clearInterval(this.tokenCheckTimer);
            this.tokenCheckTimer = -1;
          }

          this.isMonitoring = false;
          console.log('⏹️ 游戏状态监控已停止');
        }
        /**
         * 检查状态（加强版：立即检测数据缺失）
         */


        checkStatus() {
          // 🔧 如果禁用服务器验证，直接返回
          if (GameControl.DISABLE_SERVER_VALIDATION) {
            console.log('🚫 服务器验证已禁用，跳过状态检查');
            return;
          }

          try {
            var currentToken = this.getCurrentToken();
            var currentUserId = this.getCurrentUserId();
            var currentCharacterId = this.getCurrentCharacterId();
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 立即检查：任何数据缺失都立刻显示Loading

            if (!wsManager.isConnected()) {
              console.warn("\u26A0\uFE0F WebSocket\u8FDE\u63A5\u65AD\u5F00 - \u573A\u666F: " + this.currentSceneName);
              this.handleConnectionLost();
              return;
            }

            if (!this.isTokenValid(currentToken)) {
              console.warn("\u26A0\uFE0F Token\u5DF2\u5931\u6548 - \u573A\u666F: " + this.currentSceneName);
              this.handleTokenInvalid();
              return;
            } // Game场景需要完整的验证：Token、UserId和CharacterId都必须存在


            if (!currentUserId || currentUserId.length === 0) {
              console.warn("\u26A0\uFE0F \u7528\u6237ID\u7F3A\u5931 - \u573A\u666F: " + this.currentSceneName);
              this.handleTokenInvalid();
              return;
            }

            if (!currentCharacterId || currentCharacterId.length === 0) {
              console.warn("\u26A0\uFE0F \u89D2\u8272ID\u7F3A\u5931 - \u573A\u666F: " + this.currentSceneName);
              this.handleTokenInvalid();
              return;
            } // 检查状态是否发生变化


            if (this.lastToken !== currentToken || this.lastUserId !== currentUserId || this.lastCharacterId !== currentCharacterId) {
              console.log("\uD83D\uDD04 \u6E38\u620F\u72B6\u6001\u5DF2\u66F4\u65B0 - \u573A\u666F: " + this.currentSceneName);
              this.lastToken = currentToken;
              this.lastUserId = currentUserId;
              this.lastCharacterId = currentCharacterId;
            }
          } catch (error) {
            console.error("\u274C \u6E38\u620F\u72B6\u6001\u68C0\u67E5\u5931\u8D25 - \u573A\u666F: " + this.currentSceneName + ":", error);
            this.handleTokenInvalid();
          }
        }
        /**
         * 处理数据完整性失败（供GameCommonData调用）
         */


        handleDataIntegrityFailed(reason) {
          console.error("\uD83D\uDEA8 [GameControl] \u6570\u636E\u5B8C\u6574\u6027\u5931\u8D25\uFF1A" + reason + "\uFF0C\u7ACB\u5373\u663E\u793ALoading");

          if (reason === 'player_not_found_or_unauthorized') {
            // 角色数据不存在/鉴权失效：不重连，直接清会话并回登录。
            try {
              (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance().clearAll();
            } catch (_unused) {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          this.showLoadingAndReconnect("data_integrity_failed: " + reason);
        }
        /**
         * 处理Token失效或数据缺失（显示Loading并尝试重连）
         */


        handleTokenInvalid() {
          // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不走“重连”）
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn("\u26A0\uFE0F [GameControl] \u5B89\u5168\u9600\u89E6\u53D1\uFF08token_idle_expired\uFF09\uFF0C\u6E05\u4F1A\u8BDD\u5E76\u56DE\u767B\u5F55 - \u573A\u666F: " + this.currentSceneName);

            try {
              wsManager.clearAll();
            } catch (_unused2) {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log("\uD83D\uDEA8 Token\u5931\u6548\uFF0C\u663E\u793ALoading\u5E76\u5C1D\u8BD5\u91CD\u8FDE - \u5F53\u524D\u573A\u666F: " + this.currentSceneName);
          this.showLoadingAndReconnect('token_invalid');
        }
        /**
         * 处理游戏ID不完整（显示Loading并尝试重连）
         */


        handleGameIdsIncomplete() {
          console.log("\uD83D\uDEA8 \u6E38\u620FID\u4E0D\u5B8C\u6574\uFF0C\u663E\u793ALoading\u5E76\u5C1D\u8BD5\u91CD\u8FDE - \u5F53\u524D\u573A\u666F: " + this.currentSceneName);
          this.showLoadingAndReconnect('game_ids_incomplete');
        }
        /**
         * 处理连接丢失（显示Loading并尝试重连）
         */


        handleConnectionLost() {
          // 安全阀：离线/未鉴权超过阈值 => 不再重连，直接重登并清理本地会话
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn("\u26A0\uFE0F [GameControl] \u5B89\u5168\u9600\u89E6\u53D1\uFF08connection_idle_expired\uFF09\uFF0C\u6E05\u4F1A\u8BDD\u5E76\u56DE\u767B\u5F55 - \u573A\u666F: " + this.currentSceneName);

            try {
              wsManager.clearAll();
            } catch (_unused3) {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log("\uD83D\uDD0C WebSocket\u8FDE\u63A5\u4E22\u5931\uFF0C\u663E\u793ALoading\u5E76\u5C1D\u8BD5\u91CD\u8FDE - \u573A\u666F: " + this.currentSceneName);
          this.showLoadingAndReconnect('connection_lost');
        }
        /**
         * 显示Loading面板并尝试重连
         * @param reason 重连原因
         */


        showLoadingAndReconnect(reason) {
          // 如果已经在重连中，不重复处理
          if (this.isReconnecting) {
            console.log('⏳ 已在重连中，跳过重复请求');
            return;
          }

          this.isReconnecting = true; // 停止监控

          this.stopMonitoring(); // 显示Loading面板

          if (this.loadingPanel) {
            this.loadingPanel.active = true;
            console.log('📱 Loading面板已显示');
          } // 开始重连


          this.attemptReconnect(reason);
        }
        /**
         * 尝试重连
         */


        attemptReconnect(reason) {
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          var reconnectAttempts = 0;
          var maxAttempts = 5; // 最多尝试5次

          var attemptInterval = 500; // 每次尝试间隔500ms

          var tryConnect = () => {
            reconnectAttempts++;
            console.log("\uD83D\uDD04 \u91CD\u8FDE\u5C1D\u8BD5 " + reconnectAttempts + "/" + maxAttempts + "...");

            try {
              // 尝试连接
              wsManager.connect(); // 检查连接状态和数据完整性（延迟检查，给连接时间）

              setTimeout(() => {
                // 检查是否真正重连成功（需要 WebSocket 连接 + 完整的数据）
                if (this.isReconnectTrulySuccess()) {
                  console.log('✅ 重连成功（WebSocket连接 + 数据完整）');
                  this.onReconnectSuccess();
                  return;
                } // 如果还没成功且未超时，继续尝试


                if (reconnectAttempts < maxAttempts) {
                  tryConnect();
                } else {
                  console.log('⏰ 重连尝试次数已达上限');
                  this.onReconnectTimeout();
                }
              }, attemptInterval);
            } catch (error) {
              console.error('❌ 重连尝试失败:', error);

              if (reconnectAttempts < maxAttempts) {
                tryConnect();
              } else {
                this.onReconnectTimeout();
              }
            }
          }; // 开始第一次尝试


          tryConnect(); // 设置超时（3秒后如果还没成功，跳转到登录）

          this.reconnectTimer = setTimeout(() => {
            if (this.isReconnecting) {
              console.log('⏰ 重连超时（3秒），跳转到登录场景');
              this.onReconnectTimeout();
            }
          }, this.reconnectTimeout);
        }
        /**
         * 检查是否真正重连成功（需要 WebSocket 连接 + 完整的数据）
         */


        isReconnectTrulySuccess() {
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (!wsManager.isConnected()) {
            console.log('❌ WebSocket未连接');
            return false;
          }

          var token = wsManager.getToken();

          if (!this.isTokenValid(token)) {
            console.log('❌ Token无效或不存在');
            return false;
          }

          var userId = wsManager.getUserId();

          if (!userId || userId.length === 0) {
            console.log('❌ 用户ID缺失');
            return false;
          }

          var characterId = wsManager.getCharacterId();

          if (!characterId || characterId.length === 0) {
            console.log('❌ 角色ID缺失');
            return false;
          }

          console.log('✅ 重连条件满足：WebSocket连接 + Token/用户ID/角色ID均有效');
          return true;
        }
        /**
         * 重连成功回调
         */


        onReconnectSuccess() {
          // 清除超时定时器
          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isReconnecting = false; // 隐藏Loading面板

          if (this.loadingPanel) {
            this.loadingPanel.active = false;
            console.log('📱 Loading面板已隐藏');
          } // 刷新数据


          console.log('🔄 重连成功，刷新数据并重新加载场景...'); // 轻微延迟：给 WebSocketManager 的 auth_request/auth_response 一轮处理时间

          setTimeout(() => {
            this.refreshDataAndReloadScene();
          }, 300);
          this.startMonitoring();
        }
        /**
         * 重连超时回调
         */


        onReconnectTimeout() {
          // 清除超时定时器
          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isReconnecting = false; // 隐藏Loading面板

          if (this.loadingPanel) {
            this.loadingPanel.active = false;
            console.log('📱 Loading面板已隐藏');
          } // 规范性修复：连接超时但不要清 token
          // 否则“断线/重进”会被当作“登出”，从而失去自动登录链路


          setTimeout(() => {
            this.jumpToLoginScene();
          }, 300);
        }
        /**
         * 刷新数据并重新加载当前场景
         */


        refreshDataAndReloadScene() {
          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
              error: Error()
            }), GameCommonData) : GameCommonData).instance.refreshPlayerInfo().then(() => {
              console.log('✅ 数据刷新完成');
            }).catch(error => {
              console.error('❌ 数据刷新失败:', error);
            });
          } else {
            console.log('⚠️ GameCommonData未初始化');
          }
        }
        /**
         * 重新加载当前场景
         */


        reloadCurrentScene() {
          var sceneName = this.currentSceneName || 'Game';
          console.log("\uD83D\uDD04 \u91CD\u65B0\u52A0\u8F7D\u573A\u666F: " + sceneName);

          try {
            director.loadScene(sceneName, error => {
              if (error) {
                console.error("\u274C \u91CD\u65B0\u52A0\u8F7D\u573A\u666F\u5931\u8D25: " + sceneName, error); // 如果重新加载失败，跳转到登录场景

                this.jumpToLoginScene();
              } else {
                console.log("\u2705 \u573A\u666F\u91CD\u65B0\u52A0\u8F7D\u6210\u529F: " + sceneName);
              }
            });
          } catch (error) {
            console.error('❌ 场景重新加载异常:', error);
            this.jumpToLoginScene();
          }
        }
        /**
         * 跳转到登录场景（重写基类方法，添加日志）
         */


        jumpToLoginScene() {
          console.log("\uD83D\uDD04 \u8DF3\u8F6C\u5230\u767B\u5F55\u573A\u666F - \u6765\u6E90\u573A\u666F: " + this.currentSceneName);
          super.jumpToLoginScene();
        }
        /**
         * 获取当前用户ID
         */


        getCurrentUserId() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            return wsManager.getUserId();
          } catch (error) {
            console.error('❌ 获取用户ID失败:', error);
            return null;
          }
        }
        /**
         * 获取当前角色ID
         */


        getCurrentCharacterId() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            return wsManager.getCharacterId();
          } catch (error) {
            console.error('❌ 获取角色ID失败:', error);
            return null;
          }
        }
        /**
         * 检查游戏ID是否完整
         */


        isGameIdsComplete(userId, characterId) {
          return userId !== null && userId.length > 0 && characterId !== null && characterId.length > 0;
        }
        /**
         * 手动触发状态检查（调试用）
         */


        manualStatusCheck() {
          console.log('🔍 手动触发游戏状态检查');
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
         * 🔧 临时禁用/启用服务器验证
         */


        static setServerValidation(enabled) {
          GameControl.DISABLE_SERVER_VALIDATION = !enabled;
          console.log("\uD83D\uDD27 \u670D\u52A1\u5668\u9A8C\u8BC1\u5DF2" + (enabled ? '启用' : '禁用'));
        }
        /**
         * 🔧 获取服务器验证状态
         */


        static isServerValidationEnabled() {
          return !GameControl.DISABLE_SERVER_VALIDATION;
        }
        /**
         * 输出详细信息（调试用）
         */


        logDetails() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var token = this.getCurrentToken();
            var userId = this.getCurrentUserId();
            var characterId = this.getCurrentCharacterId();
            console.log("\uD83D\uDCCB \u6E38\u620F\u72B6\u6001\u8BE6\u7EC6\u4FE1\u606F - \u573A\u666F: " + this.currentSceneName + ":");
            console.log('  - Token存在:', token !== null);
            console.log('  - 用户ID存在:', userId !== null);
            console.log('  - 角色ID存在:', characterId !== null);
            console.log('  - 游戏ID完整:', this.isGameIdsComplete(userId, characterId));
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
            console.error('❌ 输出详细信息失败:', error);
          }
        }
        /**
         * 预加载游戏常用资源（陆续加载，不阻塞主线程）
         */


        preloadGameResources() {
          var resourceMgr = (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance(); // 方式1：使用统一的资源预加载方法（推荐）
          // 这会预加载所有核心资源：JSON配表、图集等

          resourceMgr.preloadGameCoreResources(progress => {
            // 可以在这里显示加载进度（如果需要）
            if (progress % 20 === 0) {
              // 每20%打印一次，避免日志过多
              console.log("\uD83D\uDCE6 [GameControl] \u8D44\u6E90\u9884\u52A0\u8F7D\u8FDB\u5EA6: " + progress + "%");
            }
          }, (successCount, failCount) => {
            console.log("\u2705 [GameControl] \u6E38\u620F\u6838\u5FC3\u8D44\u6E90\u9884\u52A0\u8F7D\u5B8C\u6210: \u6210\u529F " + successCount + ", \u5931\u8D25 " + failCount);
          }); // 方式2：预加载 RobotShow 所需的资源（通过 RobotShow 的预加载方法）
          // 这个方法内部已经实现了陆续加载，不会造成卡顿
          // 注意：由于 RobotShow.preloadResources() 和 preloadGameCoreResources() 会加载相同的资源
          // ResourceManager 的缓存机制会避免重复加载，所以两个都调用也没问题

          try {
            (_crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
              error: Error()
            }), RobotShow) : RobotShow).preloadResources();
          } catch (error) {
            console.warn('⚠️ [GameControl] RobotShow 资源预加载失败:', error);
          }
        }

        onDestroy() {
          // 先调用父类的 onDestroy（父类会调用 stopMonitoring）
          super.onDestroy(); // 清除重连定时器

          if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
          }

          this.isReconnecting = false; // 取消数据变化监听（setupDataChangeListener 中添加的）

          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager) {
            wsManager.off('data_changed', this.onDataChanged, this);
          }

          console.log("\uD83C\uDFAE \u6E38\u620F\u573A\u666F\u63A7\u5236\u5668\u9500\u6BC1 - \u573A\u666F: " + this.currentSceneName);
        }

      }, _class3.DISABLE_SERVER_VALIDATION = false, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "button1", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "panel1", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "button2", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "panel2", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "button3", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "panel3", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "loadingPanel", [_dec8], {
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
//# sourceMappingURL=97bcfaa97ebac39a52b36922939648693b1b4f71.js.map