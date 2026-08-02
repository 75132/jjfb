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
        constructor(...args) {
          super(...args);
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
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
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
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
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
            console.log(`🚨 [GameControl] 检测到数据变化：${data.reason}`); // 切换角色回选角（清除 characterId），不应按断线处理 Loading/重连

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


            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            const hasToken = data.token !== null && data.token !== undefined && data.token.length > 0;
            const hasUserId = data.userId !== null && data.userId !== undefined && data.userId.length > 0;
            const hasCharacterId = data.characterId !== null && data.characterId !== undefined && data.characterId.length > 0;
            const isConnected = wsManager.isConnected(); // 如果任何关键数据缺失，立即显示Loading

            if (!isConnected || !hasToken || !hasUserId || !hasCharacterId) {
              console.log('❌ [GameControl] 数据不完整，立即显示Loading');
              this.showLoadingAndReconnect(`data_changed: ${data.reason}`);
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
          const willOpen = !panel.active;
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
              const panel = this.getPanelByKey(key);

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

          console.log(`🔍 游戏状态监控已启动 - 检查间隔: ${this.tokenCheckInterval}ms`); // 立即检查一次

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
            const currentToken = this.getCurrentToken();
            const currentUserId = this.getCurrentUserId();
            const currentCharacterId = this.getCurrentCharacterId();
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 立即检查：任何数据缺失都立刻显示Loading

            if (!wsManager.isConnected()) {
              console.warn(`⚠️ WebSocket连接断开 - 场景: ${this.currentSceneName}`);
              this.handleConnectionLost();
              return;
            }

            if (!this.isTokenValid(currentToken)) {
              console.warn(`⚠️ Token已失效 - 场景: ${this.currentSceneName}`);
              this.handleTokenInvalid();
              return;
            } // Game场景需要完整的验证：Token、UserId和CharacterId都必须存在


            if (!currentUserId || currentUserId.length === 0) {
              console.warn(`⚠️ 用户ID缺失 - 场景: ${this.currentSceneName}`);
              this.handleTokenInvalid();
              return;
            }

            if (!currentCharacterId || currentCharacterId.length === 0) {
              console.warn(`⚠️ 角色ID缺失 - 场景: ${this.currentSceneName}`);
              this.handleTokenInvalid();
              return;
            } // 检查状态是否发生变化


            if (this.lastToken !== currentToken || this.lastUserId !== currentUserId || this.lastCharacterId !== currentCharacterId) {
              console.log(`🔄 游戏状态已更新 - 场景: ${this.currentSceneName}`);
              this.lastToken = currentToken;
              this.lastUserId = currentUserId;
              this.lastCharacterId = currentCharacterId;
            }
          } catch (error) {
            console.error(`❌ 游戏状态检查失败 - 场景: ${this.currentSceneName}:`, error);
            this.handleTokenInvalid();
          }
        }
        /**
         * 处理数据完整性失败（供GameCommonData调用）
         */


        handleDataIntegrityFailed(reason) {
          console.error(`🚨 [GameControl] 数据完整性失败：${reason}，立即显示Loading`);

          if (reason === 'player_not_found_or_unauthorized') {
            // 角色数据不存在/鉴权失效：不重连，直接清会话并回登录。
            try {
              (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance().clearAll();
            } catch {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          this.showLoadingAndReconnect(`data_integrity_failed: ${reason}`);
        }
        /**
         * 处理Token失效或数据缺失（显示Loading并尝试重连）
         */


        handleTokenInvalid() {
          // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不走“重连”）
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [GameControl] 安全阀触发（token_idle_expired），清会话并回登录 - 场景: ${this.currentSceneName}`);

            try {
              wsManager.clearAll();
            } catch {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log(`🚨 Token失效，显示Loading并尝试重连 - 当前场景: ${this.currentSceneName}`);
          this.showLoadingAndReconnect('token_invalid');
        }
        /**
         * 处理游戏ID不完整（显示Loading并尝试重连）
         */


        handleGameIdsIncomplete() {
          console.log(`🚨 游戏ID不完整，显示Loading并尝试重连 - 当前场景: ${this.currentSceneName}`);
          this.showLoadingAndReconnect('game_ids_incomplete');
        }
        /**
         * 处理连接丢失（显示Loading并尝试重连）
         */


        handleConnectionLost() {
          // 安全阀：离线/未鉴权超过阈值 => 不再重连，直接重登并清理本地会话
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [GameControl] 安全阀触发（connection_idle_expired），清会话并回登录 - 场景: ${this.currentSceneName}`);

            try {
              wsManager.clearAll();
            } catch {}

            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
          }

          console.log(`🔌 WebSocket连接丢失，显示Loading并尝试重连 - 场景: ${this.currentSceneName}`);
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
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          let reconnectAttempts = 0;
          const maxAttempts = 5; // 最多尝试5次

          const attemptInterval = 500; // 每次尝试间隔500ms

          const tryConnect = () => {
            reconnectAttempts++;
            console.log(`🔄 重连尝试 ${reconnectAttempts}/${maxAttempts}...`);

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
          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (!wsManager.isConnected()) {
            console.log('❌ WebSocket未连接');
            return false;
          }

          const token = wsManager.getToken();

          if (!this.isTokenValid(token)) {
            console.log('❌ Token无效或不存在');
            return false;
          }

          const userId = wsManager.getUserId();

          if (!userId || userId.length === 0) {
            console.log('❌ 用户ID缺失');
            return false;
          }

          const characterId = wsManager.getCharacterId();

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
          const sceneName = this.currentSceneName || 'Game';
          console.log(`🔄 重新加载场景: ${sceneName}`);

          try {
            director.loadScene(sceneName, error => {
              if (error) {
                console.error(`❌ 重新加载场景失败: ${sceneName}`, error); // 如果重新加载失败，跳转到登录场景

                this.jumpToLoginScene();
              } else {
                console.log(`✅ 场景重新加载成功: ${sceneName}`);
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
          console.log(`🔄 跳转到登录场景 - 来源场景: ${this.currentSceneName}`);
          super.jumpToLoginScene();
        }
        /**
         * 获取当前用户ID
         */


        getCurrentUserId() {
          try {
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
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
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
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
          console.log(`🔧 服务器验证已${enabled ? '启用' : '禁用'}`);
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
            const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            const token = this.getCurrentToken();
            const userId = this.getCurrentUserId();
            const characterId = this.getCurrentCharacterId();
            console.log(`📋 游戏状态详细信息 - 场景: ${this.currentSceneName}:`);
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
          const resourceMgr = (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance(); // 方式1：使用统一的资源预加载方法（推荐）
          // 这会预加载所有核心资源：JSON配表、图集等

          resourceMgr.preloadGameCoreResources(progress => {
            // 可以在这里显示加载进度（如果需要）
            if (progress % 20 === 0) {
              // 每20%打印一次，避免日志过多
              console.log(`📦 [GameControl] 资源预加载进度: ${progress}%`);
            }
          }, (successCount, failCount) => {
            console.log(`✅ [GameControl] 游戏核心资源预加载完成: 成功 ${successCount}, 失败 ${failCount}`);
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

          const wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (wsManager) {
            wsManager.off('data_changed', this.onDataChanged, this);
          }

          console.log(`🎮 游戏场景控制器销毁 - 场景: ${this.currentSceneName}`);
        }

      }, _class3.DISABLE_SERVER_VALIDATION = false, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "button1", [_dec2], {
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
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "loadingPanel", [_dec8], {
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
//# sourceMappingURL=bd7d814de753fdaafe945b4ab6e984f919759279.js.map