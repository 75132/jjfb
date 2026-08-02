System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, Vec3, UITransform, WebSocketManager, GameCommonData, GameConfig, BattleScene, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _crd, ccclass, property, Test;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameCommonData(extras) {
    _reporterNs.report("GameCommonData", "./GameCommonData", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleScene(extras) {
    _reporterNs.report("BattleScene", "./BattleScene", _context.meta, extras);
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
      Vec3 = _cc.Vec3;
      UITransform = _cc.UITransform;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameCommonData = _unresolved_3.GameCommonData;
    }, function (_unresolved_4) {
      GameConfig = _unresolved_4.GameConfig;
    }, function (_unresolved_5) {
      BattleScene = _unresolved_5.BattleScene;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "e18b4fILghLCZrkx9h/P6dh", "Test", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button', 'EventTouch', 'Vec3', 'UITransform']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * Test - 测试脚本（可拖动，点击切换面板）
       * 职责：
       * - 提供可拖动的测试按钮
       * - 点击切换GameTest面板显示/隐藏
       * - 提供加经验等测试功能
       * 设计原则：纯测试功能，便于调试
       */

      _export("Test", Test = (_dec = ccclass('Test'), _dec2 = property(Button), _dec3 = property(Button), _dec4 = property(Button), _dec5 = property(Button), _dec6 = property({
        type: Node,
        tooltip: 'GameTest面板节点（用于显示/隐藏）'
      }), _dec7 = property({
        type: Button,
        tooltip: '加经验按钮（在GameTest面板内）'
      }), _dec8 = property({
        type: Button,
        tooltip: '升级所有机甲按钮（在GameTest面板内）'
      }), _dec9 = property({
        type: Button,
        tooltip: '启动战斗按钮'
      }), _dec10 = property({
        type: Button,
        tooltip: '进入平匹配按钮（PVP）'
      }), _dec11 = property({
        type: Node,
        tooltip: 'BattleScene 战斗场景面板节点'
      }), _dec(_class = (_class2 = class Test extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "clearTokenBtn", _descriptor, this);

          _initializerDefineProperty(this, "clearUserIdBtn", _descriptor2, this);

          _initializerDefineProperty(this, "clearCharacterIdBtn", _descriptor3, this);

          _initializerDefineProperty(this, "logInfoBtn", _descriptor4, this);

          _initializerDefineProperty(this, "gameTestPanel", _descriptor5, this);

          _initializerDefineProperty(this, "addExpBtn", _descriptor6, this);

          _initializerDefineProperty(this, "upgradeAllRobotsBtn", _descriptor7, this);

          _initializerDefineProperty(this, "startBattleBtn", _descriptor8, this);

          _initializerDefineProperty(this, "pvpMatchBtn", _descriptor9, this);

          _initializerDefineProperty(this, "battleScenePanel", _descriptor10, this);

          this.isDragging = false;
          this.hasMoved = false;
          // 记录是否真的移动了
          this.isClick = false;
          // 记录是否是点击（不是拖动）
          this.dragOffset = new Vec3();
          this.panelVisible = false;

          /** 修复点：加载/连接后检测是否在战斗中，是则自动打开战斗面板（BattleScene 面板默认隐藏时 schedule 不执行，故由常驻的 Test 负责） */
          this._checkInBattleAndOpenPanel = () => {
            var _this$battleScenePane;

            if (!((_this$battleScenePane = this.battleScenePanel) != null && _this$battleScenePane.isValid)) return;
            if (this.battleScenePanel.active) return;
            var ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            if (!(ws.isConnected != null && ws.isConnected())) return;
            var characterId = ws.getCharacterId == null ? void 0 : ws.getCharacterId();
            if (!characterId) return;
            ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_RESUME, {
              character_id: characterId
            }, resp => {
              var _this$node, _this$battleScenePane2, _resp$data;

              if (!((_this$node = this.node) != null && _this$node.isValid) || !((_this$battleScenePane2 = this.battleScenePanel) != null && _this$battleScenePane2.isValid)) return;
              if (!(resp != null && resp.success) || !((_resp$data = resp.data) != null && _resp$data.has_room) || !resp.data.state) return; // 只有服务器仍在战斗中才恢复；掉线期间战斗已结束则不再拉入房间

              if (resp.data.state.status !== 'in_progress') return; // 用已拉取的 state 直接恢复，不再让 BattleScene 再发 resume（避免误走创建新房间、界面先空再变新局）

              var battleScene = this.battleScenePanel.getComponent(_crd && BattleScene === void 0 ? (_reportPossibleCrUseOfBattleScene({
                error: Error()
              }), BattleScene) : BattleScene);
              if (battleScene) battleScene.prepareRestoreState(resp.data.state);
              this.battleScenePanel.active = true;
              console.log('[Test] 检测到战斗中，已用服务器实时数据恢复战斗场景');
            }, true, 6000);
          };

          /**
           * 处理数据更新事件
           */
          this.onDataUpdated = data => {
            // 输出等级和经验信息
            this.logExpInfo();
          };
        }

        start() {
          var _getInstance;

          console.log('🧪 测试脚本启动'); // 初始化面板状态

          if (this.gameTestPanel) {
            this.panelVisible = this.gameTestPanel.active;
          } // 绑定按钮事件


          this.bindButtonEvents(); // 设置拖动功能

          this.setupDrag(); // 监听GameCommonData的数据更新事件

          this.setupDataListener(); // 修复点：加载游戏时检测是否在战斗中并自动打开战斗面板（服务器显示在房间但客户端未进时必跑）
          // 1) 若已连接且有 characterId，立即检测一次

          this._checkInBattleAndOpenPanel(); // 2) 多次延迟检测，覆盖 auth/characterId 稍晚就绪的情况（0.5s、1.5s、3s、5s）


          [0.5, 1.5, 3, 5].forEach(delay => {
            this.scheduleOnce(() => {
              this._checkInBattleAndOpenPanel();
            }, delay);
          }); // 修复点：连接/重连时也检测是否在战斗中，立即打开战斗面板

          var wsNode = (_getInstance = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance()) == null ? void 0 : _getInstance.node;

          if (wsNode && typeof wsNode.on === 'function') {
            wsNode.on('network_connect', this._checkInBattleAndOpenPanel, this);
          }
        }
        /**
         * 设置拖动功能
         */


        setupDrag() {
          // 监听触摸开始
          this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this); // 监听触摸移动

          this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this); // 监听触摸结束

          this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this); // 监听触摸取消

          this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this); // 如果节点有 Button 组件，使用按钮点击事件来切换面板
          // 这样可以避免触摸事件被 Button 拦截的问题

          var button = this.node.getComponent(Button);

          if (button) {
            // 监听按钮点击事件
            button.node.on(Button.EventType.CLICK, this.onNodeButtonClick, this);
          }
        }
        /**
         * 节点按钮点击事件（用于切换面板）
         */


        onNodeButtonClick() {
          // 检查是否是点击（不是拖动）
          // 延迟检查，确保触摸事件已经处理完成
          this.scheduleOnce(() => {
            if (this.isClick && !this.hasMoved) {
              this.togglePanel();
            } // 重置标志


            this.isClick = false;
          }, 0.05);
        }
        /**
         * 触摸开始
         */


        onTouchStart(event) {
          var _this$node$getCompone;

          this.isDragging = true;
          this.hasMoved = false; // 重置移动标志

          this.isClick = true; // 初始认为是点击

          var touchPos = event.getUILocation();
          var worldPos = new Vec3(touchPos.x, touchPos.y, 0);
          var localPos = new Vec3();
          (_this$node$getCompone = this.node.getComponent(UITransform)) == null || _this$node$getCompone.convertToNodeSpaceAR(worldPos, localPos);
          this.dragOffset = localPos;
        }
        /**
         * 触摸移动（拖动）
         */


        onTouchMove(event) {
          if (!this.isDragging) return;
          var touchPos = event.getUILocation();
          var worldPos = new Vec3(touchPos.x, touchPos.y, 0);
          var localPos = new Vec3();
          var parent = this.node.parent;

          if (parent) {
            var _parent$getComponent;

            (_parent$getComponent = parent.getComponent(UITransform)) == null || _parent$getComponent.convertToNodeSpaceAR(worldPos, localPos);
            this.node.setPosition(localPos);
            this.hasMoved = true; // 标记为已移动

            this.isClick = false; // 移动了就不是点击
          }
        }
        /**
         * 触摸结束
         */


        onTouchEnd(event) {
          // 如果节点没有 Button 组件，直接在这里处理点击切换
          var button = this.node.getComponent(Button);

          if (!button && this.isClick && !this.hasMoved) {
            this.togglePanel();
          } // 延迟重置状态，确保 Button 点击事件能检查到


          this.scheduleOnce(() => {
            this.isDragging = false;
            this.hasMoved = false;
          }, 0.1);
        }
        /**
         * 切换面板显示/隐藏
         */


        togglePanel() {
          if (!this.gameTestPanel) {
            console.warn('⚠️ GameTest面板未绑定');
            return;
          }

          this.panelVisible = !this.panelVisible;
          this.gameTestPanel.active = this.panelVisible;
          console.log("\uD83E\uDDEA GameTest\u9762\u677F\u5DF2" + (this.panelVisible ? '显示' : '隐藏'));
        }
        /**
         * 设置数据监听（监听GameCommonData的数据更新）
         */


        setupDataListener() {
          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
              error: Error()
            }), GameCommonData) : GameCommonData).instance.node.on('data_updated', this.onDataUpdated, this);
          } else {
            // 延迟设置
            this.scheduleOnce(() => {
              if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
                error: Error()
              }), GameCommonData) : GameCommonData).instance) {
                (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
                  error: Error()
                }), GameCommonData) : GameCommonData).instance.node.on('data_updated', this.onDataUpdated, this);
              }
            }, 0.1);
          }
        }

        /**
         * 绑定按钮事件
         */
        bindButtonEvents() {
          // 清除Token按钮
          if (this.clearTokenBtn) {
            this.clearTokenBtn.node.on(Button.EventType.CLICK, this.onClearTokenClick, this);
            console.log('✅ 清除Token按钮事件已绑定');
          } // 清除用户ID按钮


          if (this.clearUserIdBtn) {
            this.clearUserIdBtn.node.on(Button.EventType.CLICK, this.onClearUserIdClick, this);
            console.log('✅ 清除用户ID按钮事件已绑定');
          } // 清除角色ID按钮


          if (this.clearCharacterIdBtn) {
            this.clearCharacterIdBtn.node.on(Button.EventType.CLICK, this.onClearCharacterIdClick, this);
            console.log('✅ 清除角色ID按钮事件已绑定');
          } // 输出信息按钮


          if (this.logInfoBtn) {
            this.logInfoBtn.node.on(Button.EventType.CLICK, this.onLogInfoClick, this);
            console.log('✅ 输出信息按钮事件已绑定');
          } // 加经验按钮


          if (this.addExpBtn) {
            this.addExpBtn.node.on(Button.EventType.CLICK, this.onAddExpClick, this);
            console.log('✅ 加经验按钮事件已绑定');
          } // 升级所有机甲按钮


          if (this.upgradeAllRobotsBtn) {
            this.upgradeAllRobotsBtn.node.on(Button.EventType.CLICK, this.onUpgradeAllRobotsClick, this);
            console.log('✅ 升级所有机甲按钮事件已绑定');
          } // 启动战斗按钮


          if (this.startBattleBtn) {
            this.startBattleBtn.node.on(Button.EventType.CLICK, this.onStartBattleClick, this);
            console.log('✅ 启动战斗按钮事件已绑定');
          } // 平匹配按钮


          if (this.pvpMatchBtn) {
            this.pvpMatchBtn.node.on(Button.EventType.CLICK, this.onPvpMatchClick, this);
            console.log('✅ 平匹配按钮事件已绑定');
          }
        }
        /**
         * 平匹配按钮点击事件：进入 BattleScene，并让 BattleScene 自己发起匹配（显示 Loading，5 秒超时退出）
         */


        onPvpMatchClick() {
          console.log('🆚 测试：进入平匹配（PVP）');

          if (!this.battleScenePanel) {
            console.error('❌ BattleScene 面板未绑定');
            return;
          }

          var battleScene = this.battleScenePanel.getComponent(_crd && BattleScene === void 0 ? (_reportPossibleCrUseOfBattleScene({
            error: Error()
          }), BattleScene) : BattleScene);

          if (!battleScene) {
            console.error('❌ BattleScene 组件未找到');
            return;
          } // 先请求匹配，再打开面板（BattleScene 的 onEnable 会接管匹配流程）


          battleScene.requestPvpFlatMatch();
          this.battleScenePanel.active = true;
        }
        /**
         * 清除Token按钮点击事件
         */


        onClearTokenClick() {
          console.log('🧪 测试：清除Token');

          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 发送登出消息到服务器

            wsManager.send({
              type: 'logout',
              token: wsManager.getToken()
            }, false); // 清除本地Token

            wsManager.clearToken();
            console.log('✅ Token已清除');
            console.log('📋 当前状态:');
            this.logCurrentStatus(); // 注意：不需要手动触发，WebSocketManager.clearToken()会自动触发data_changed事件
          } catch (error) {
            console.error('❌ 清除Token失败:', error);
          }
        }
        /**
         * 清除用户ID按钮点击事件
         */


        onClearUserIdClick() {
          console.log('🧪 测试：清除用户ID');

          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 清除用户ID

            wsManager.clearUserId();
            console.log('✅ 用户ID已清除');
            console.log('📋 当前状态:');
            this.logCurrentStatus(); // 注意：不需要手动触发，WebSocketManager.clearUserId()会自动触发data_changed事件
          } catch (error) {
            console.error('❌ 清除用户ID失败:', error);
          }
        }
        /**
         * 清除角色ID按钮点击事件
         */


        onClearCharacterIdClick() {
          console.log('🧪 测试：清除角色ID');

          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance(); // 清除角色ID

            wsManager.clearCharacterId();
            console.log('✅ 角色ID已清除');
            console.log('📋 当前状态:');
            this.logCurrentStatus(); // 注意：不需要手动触发，WebSocketManager.clearCharacterId()会自动触发data_changed事件
          } catch (error) {
            console.error('❌ 清除角色ID失败:', error);
          }
        }
        /**
         * 输出信息按钮点击事件
         */


        onLogInfoClick() {
          console.log('🧪 测试：输出Token和ID信息');
          this.logCurrentStatus();
        }
        /**
         * 输出当前状态
         */


        logCurrentStatus() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var token = wsManager.getToken();
            var userId = wsManager.getUserId();
            var characterId = wsManager.getCharacterId();
            console.log('📋 当前Token和ID状态:');
            console.log('  - Token存在:', token !== null);
            console.log('  - 用户ID存在:', userId !== null);
            console.log('  - 角色ID存在:', characterId !== null);
            console.log('  - 游戏ID完整:', wsManager.hasGameIds());
            console.log('  - WebSocket连接状态:', wsManager.isConnected());

            if (token) {
              console.log('  - Token:', token);
              console.log('  - Token长度:', token.length);
              console.log('  - Token前10位:', token.substring(0, 10));
              console.log('  - Token后10位:', token.substring(token.length - 10));
            } else {
              console.log('  - Token: null');
            }

            if (userId) {
              console.log('  - 用户ID:', userId);
            } else {
              console.log('  - 用户ID: null');
            }

            if (characterId) {
              console.log('  - 角色ID:', characterId);
            } else {
              console.log('  - 角色ID: null');
            }
          } catch (error) {
            console.error('❌ 输出状态失败:', error);
          }
        }
        /**
         * 手动触发状态检查（调试用）
         */


        manualStatusCheck() {
          console.log('🔍 手动触发状态检查');
          this.logCurrentStatus();
        }
        /**
         * 获取当前Token（调试用）
         */


        getCurrentToken() {
          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            return wsManager.getToken();
          } catch (error) {
            console.error('❌ 获取Token失败:', error);
            return null;
          }
        }
        /**
         * 获取当前用户ID（调试用）
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
         * 获取当前角色ID（调试用）
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
         * 加经验按钮点击事件
         */


        onAddExpClick() {
          console.log('🧪 测试：增加经验值 9999'); // 严格验证数据完整性（防止未授权操作）

          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            console.error('❌ GameCommonData未初始化，无法增加经验');
            return;
          } // 验证数据完整性（会触发Loading如果数据缺失）


          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.validateDataIntegrity()) {
            console.error('❌ 数据不完整，无法增加经验');
            return;
          }

          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var token = wsManager.getToken();
            var userId = wsManager.getUserId();
            var characterId = wsManager.getCharacterId(); // 双重验证（防止绕过）

            if (!token || !userId || !characterId) {
              console.error('❌ 数据验证失败：Token、用户ID或角色ID缺失');
              (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
                error: Error()
              }), GameCommonData) : GameCommonData).instance.validateDataIntegrity(); // 触发Loading

              return;
            } // 发送加经验请求到服务器（包含完整验证信息）


            var msg = {
              type: 'add_exp',
              exp: 9999,
              token: token,
              // 明确传递token
              user_id: userId,
              // 明确传递user_id
              character_id: characterId
            };
            wsManager.send(msg, true);
            console.log('📤 已发送加经验请求：9999 经验值（已验证数据完整性）');
          } catch (error) {
            console.error('❌ 增加经验失败:', error);
          }
        }
        /**
         * 升级所有机甲按钮点击事件
         */


        onUpgradeAllRobotsClick() {
          console.log('🧪 测试：给所有机甲增加经验值 9999'); // 严格验证数据完整性（防止未授权操作）

          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            console.error('❌ GameCommonData未初始化，无法升级机甲');
            return;
          } // 验证数据完整性（会触发Loading如果数据缺失）


          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.validateDataIntegrity()) {
            console.error('❌ 数据不完整，无法升级机甲');
            return;
          }

          try {
            var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
            var token = wsManager.getToken();
            var userId = wsManager.getUserId();
            var characterId = wsManager.getCharacterId(); // 双重验证（防止绕过）

            if (!token || !userId || !characterId) {
              console.error('❌ 数据验证失败：Token、用户ID或角色ID缺失');
              (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
                error: Error()
              }), GameCommonData) : GameCommonData).instance.validateDataIntegrity(); // 触发Loading

              return;
            } // 发送升级所有机甲请求到服务器（包含完整验证信息）


            var msg = {
              type: 'upgrade_all_robots',
              exp: 9999,
              token: token,
              // 明确传递token
              character_id: characterId
            };
            wsManager.send(msg, true);
            console.log('📤 已发送升级所有机甲请求：每个机甲增加 9999 经验值（已验证数据完整性）');
          } catch (error) {
            console.error('❌ 升级所有机甲失败:', error);
          }
        }
        /**
         * 启动战斗按钮点击事件
         */


        onStartBattleClick() {
          console.log('⚔️ 测试：启动战斗场景');

          if (!this.battleScenePanel) {
            console.error('❌ BattleScene 面板未绑定');
            return;
          } // 激活 BattleScene 面板（onEnable 会自动调用 startNewBattle）


          this.battleScenePanel.active = true;
          console.log('✅ 战斗场景已启动');
        }
        /**
         * 输出经验值相关信息
         */


        logExpInfo() {
          if (!(_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance) {
            console.warn('⚠️ GameCommonData 未初始化');
            return;
          }

          var level = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.level;
          var totalExp = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.totalExp;
          var needExp = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.needExpForNextLevel;
          var isMaxLevel = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.isMaxLevel;
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📊 角色经验信息：');
          console.log("  - \u5F53\u524D\u7B49\u7EA7\uFF1A" + level);
          console.log("  - \u5F53\u524D\u603B\u7ECF\u9A8C\uFF1A" + totalExp.toLocaleString());

          if (isMaxLevel) {
            console.log("  - \u72B6\u6001\uFF1A\u5DF2\u6EE1\u7EA7\uFF08" + level + "\u7EA7\u5C01\u9876\uFF09");
          } else {
            console.log("  - \u8DDD\u79BB\u4E0B\u6B21\u5347\u7EA7\u6240\u9700\u7ECF\u9A8C\uFF1A" + needExp.toLocaleString());
          }

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        onDestroy() {
          var _this$node2, _instance$node, _getInstance2;

          // 清理事件监听（节点可能已被销毁，需判空与有效性）
          var safeOffButton = (btn, handler) => {
            if (btn && btn.node && btn.node.isValid) {
              btn.node.off(Button.EventType.CLICK, handler, this);
            }
          };

          safeOffButton(this.clearTokenBtn, this.onClearTokenClick);
          safeOffButton(this.clearUserIdBtn, this.onClearUserIdClick);
          safeOffButton(this.clearCharacterIdBtn, this.onClearCharacterIdClick);
          safeOffButton(this.logInfoBtn, this.onLogInfoClick);
          safeOffButton(this.addExpBtn, this.onAddExpClick);
          safeOffButton(this.upgradeAllRobotsBtn, this.onUpgradeAllRobotsClick);
          safeOffButton(this.startBattleBtn, this.onStartBattleClick);
          safeOffButton(this.pvpMatchBtn, this.onPvpMatchClick); // 清理拖动事件

          if (this.node && this.node.isValid) {
            this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
          } // 清理节点按钮点击事件


          var button = (_this$node2 = this.node) == null ? void 0 : _this$node2.getComponent(Button);

          if (button && button.node && button.node.isValid) {
            button.node.off(Button.EventType.CLICK, this.onNodeButtonClick, this);
          } // 清理数据监听


          if ((_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance && (_instance$node = (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
            error: Error()
          }), GameCommonData) : GameCommonData).instance.node) != null && _instance$node.isValid) {
            (_crd && GameCommonData === void 0 ? (_reportPossibleCrUseOfGameCommonData({
              error: Error()
            }), GameCommonData) : GameCommonData).instance.node.off('data_updated', this.onDataUpdated, this);
          } // 修复点：解绑战斗检测


          var wsNode = (_getInstance2 = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance()) == null ? void 0 : _getInstance2.node;

          if (wsNode && typeof wsNode.off === 'function') {
            wsNode.off('network_connect', this._checkInBattleAndOpenPanel, this);
          }

          console.log('🧪 测试脚本销毁');
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "clearTokenBtn", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "clearUserIdBtn", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "clearCharacterIdBtn", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "logInfoBtn", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "gameTestPanel", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "addExpBtn", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "upgradeAllRobotsBtn", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "startBattleBtn", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "pvpMatchBtn", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "battleScenePanel", [_dec11], {
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
//# sourceMappingURL=1dcf9022c5a3c4f6d45edb586421e137e829a9b5.js.map