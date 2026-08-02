System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, tween, Tween, Vec3, UITransform, Sprite, SpriteFrame, Color, WebSocketManager, GameConfig, DataCacheManager, RobotShow, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _dec23, _dec24, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _crd, ccclass, property, BattleState, BattleScene;

  function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDataCacheManager(extras) {
    _reporterNs.report("DataCacheManager", "../global/DataCacheManager", _context.meta, extras);
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
      Label = _cc.Label;
      Button = _cc.Button;
      tween = _cc.tween;
      Tween = _cc.Tween;
      Vec3 = _cc.Vec3;
      UITransform = _cc.UITransform;
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
      Color = _cc.Color;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      DataCacheManager = _unresolved_4.DataCacheManager;
    }, function (_unresolved_5) {
      RobotShow = _unresolved_5.RobotShow;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "90ca8rrJ/1FT4PR5nkVCiFP", "BattleScene", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button', 'tween', 'Tween', 'Vec3', 'UITransform', 'Sprite', 'SpriteAtlas', 'SpriteFrame', 'Color']);

      ({
        ccclass,
        property
      } = _decorator);

      BattleState = /*#__PURE__*/function (BattleState) {
        BattleState["INIT"] = "INIT";
        BattleState["WAITING_COMMANDS"] = "WAITING_COMMANDS";
        BattleState["ANIMATING"] = "ANIMATING";
        BattleState["FINISHED"] = "FINISHED";
        return BattleState;
      }(BattleState || {});

      /**
       * BattleScene 面板控制脚本
       * - 左侧 RobotShow：玩家机甲（玩家机甲库第一个）
       * - 右侧 EnemyRobotShow：敌方机甲（镜像预制体）
       * - BattleSelectButton：操作面板（攻击 / 逃跑 / 返回）
       * - Time/Number：倒计时（30 秒）
       *
       * 说明：
       * - 普攻伤害公式：damage = max(1, Attack - Defense)
       * - 先后手：比较 Initiative（出手值），高者先攻；相同则玩家先
       * - 回合制：当前行动方为玩家时，30 秒内可选择攻击 / 逃跑；超时自动普攻
       * - 动画播放期间（ANIMATING 状态）按钮无效
       * - 一方 HP <= 0 时结束战斗，关闭 BattleScene，并通过 WebSocket 通知服务器战斗结果
       */
      _export("BattleScene", BattleScene = (_dec = ccclass('BattleScene'), _dec2 = property({
        type: _crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
          error: Error()
        }), RobotShow) : RobotShow,
        tooltip: '玩家机甲 RobotShow（左侧）'
      }), _dec3 = property({
        type: _crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
          error: Error()
        }), RobotShow) : RobotShow,
        tooltip: '敌人机甲 EnemyRobotShow（右侧，已镜像）'
      }), _dec4 = property({
        type: Node,
        tooltip: '战斗操作面板 BattleSelectButton（含攻击 / 逃跑 / 返回按钮）'
      }), _dec5 = property({
        type: Button,
        tooltip: '攻击按钮'
      }), _dec6 = property({
        type: Button,
        tooltip: '防御/待机按钮（本回合啥也不做）'
      }), _dec7 = property({
        type: Button,
        tooltip: '逃跑按钮'
      }), _dec8 = property({
        type: Button,
        tooltip: '返回（仅切换操作面板显示，不退出战斗）'
      }), _dec9 = property({
        type: Label,
        tooltip: '倒计时文本（Time/Number）'
      }), _dec10 = property({
        type: Node,
        tooltip: 'Time 根节点（可选，仅用于显隐控制）'
      }), _dec11 = property({
        type: Label,
        tooltip: '战斗日志文本（可选）'
      }), _dec12 = property({
        type: Node,
        tooltip: '匹配 Loading 面板（PVP 匹配中显示，可选）'
      }), _dec13 = property({
        type: Node,
        tooltip: '机甲属性面板根节点（场景内的 MechAttribute）'
      }), _dec14 = property({
        type: Sprite,
        tooltip: 'MechaClass 下 Player1 图标（Sprite）'
      }), _dec15 = property({
        type: SpriteFrame,
        tooltip: '格斗 gedou 图标（SpriteFrame）'
      }), _dec16 = property({
        type: SpriteFrame,
        tooltip: '全能 quanneng 图标（SpriteFrame）'
      }), _dec17 = property({
        type: SpriteFrame,
        tooltip: '射击 sheji 图标（SpriteFrame）'
      }), _dec18 = property({
        type: Sprite,
        tooltip: '敌方职业图标（Sprite）'
      }), _dec19 = property({
        type: SpriteFrame,
        tooltip: '敌方格斗 gedou 图标（SpriteFrame）'
      }), _dec20 = property({
        type: SpriteFrame,
        tooltip: '敌方全能 quanneng 图标（SpriteFrame）'
      }), _dec21 = property({
        type: SpriteFrame,
        tooltip: '敌方射击 sheji 图标（SpriteFrame）'
      }), _dec22 = property({
        type: Node,
        tooltip: '玩家角色显示根节点（PlayerShow，含 Player(Sprite) 与 Name(Label)）'
      }), _dec23 = property({
        type: Node,
        tooltip: '敌方角色显示根节点（EnemyPlayerShow，含 Player(Sprite) 与 Name(Label)）'
      }), _dec24 = property({
        type: [SpriteFrame],
        tooltip: '角色头像 SpriteFrames（与 Character 面板一致，Sprite=1 对应索引0）'
      }), _dec(_class = (_class2 = class BattleScene extends Component {
        constructor() {
          super(...arguments);

          // 玩家与敌方的展示
          _initializerDefineProperty(this, "playerRobotShow", _descriptor, this);

          _initializerDefineProperty(this, "enemyRobotShow", _descriptor2, this);

          // 操作面板
          _initializerDefineProperty(this, "battleSelectPanel", _descriptor3, this);

          _initializerDefineProperty(this, "attackButton", _descriptor4, this);

          _initializerDefineProperty(this, "defendButton", _descriptor5, this);

          _initializerDefineProperty(this, "escapeButton", _descriptor6, this);

          _initializerDefineProperty(this, "backButton", _descriptor7, this);

          // 倒计时显示（Time/Number）
          _initializerDefineProperty(this, "timerLabel", _descriptor8, this);

          _initializerDefineProperty(this, "timerRoot", _descriptor9, this);

          // 简单战斗日志（可选）
          _initializerDefineProperty(this, "logLabel", _descriptor10, this);

          // 匹配 Loading 面板（PVP 匹配中显示）
          _initializerDefineProperty(this, "matchingLoadingPanel", _descriptor11, this);

          // ========= 新增：战斗中机甲属性面板（实时刷新当前出场机甲） =========
          _initializerDefineProperty(this, "mechAttributeRoot", _descriptor12, this);

          // ========= 新增：MechaClass/Player1 图标 =========
          // 图标帧由你在 Inspector 手动绑定（gedou / quanneng / sheji），避免依赖 spriteAtlas 命名/配置
          _initializerDefineProperty(this, "player1ClassIcon", _descriptor13, this);

          _initializerDefineProperty(this, "player1ClassIconGedou", _descriptor14, this);

          _initializerDefineProperty(this, "player1ClassIconQuanneng", _descriptor15, this);

          _initializerDefineProperty(this, "player1ClassIconSheji", _descriptor16, this);

          // ========= 新增：敌方职业图标 =========
          // 同样允许你在 Inspector 手动绑定帧，确保与当前 atlas/UI 配置无关
          _initializerDefineProperty(this, "enemy1ClassIcon", _descriptor17, this);

          _initializerDefineProperty(this, "enemy1ClassIconGedou", _descriptor18, this);

          _initializerDefineProperty(this, "enemy1ClassIconQuanneng", _descriptor19, this);

          _initializerDefineProperty(this, "enemy1ClassIconSheji", _descriptor20, this);

          // ========= 新增：左右角色形象与名字（PlayerShow / EnemyPlayerShow） =========
          _initializerDefineProperty(this, "playerShowRoot", _descriptor21, this);

          _initializerDefineProperty(this, "enemyPlayerShowRoot", _descriptor22, this);

          _initializerDefineProperty(this, "characterAvatarFrames", _descriptor23, this);

          this.ws = null;
          this.cacheManager = null;
          this.playerUnit = null;
          this.enemyUnit = null;
          this.state = BattleState.INIT;
          // 玩家操作倒计时（秒）
          this.TURN_TIME_LIMIT = 30;
          this.turnTimeLeft = 0;
          // 动画控制
          this.isAnimating = false;
          // 当前回合双方的指令（先选指令，再按先后手结算）
          this.pendingPlayerAction = null;
          this.pendingEnemyAction = null;
          // 敌人是否在生成中（服务器异步返回）
          this.isEnemyGenerating = false;
          // 入场动画：缓存起点/终点，避免每次打开叠加位移
          this.entrancePlayerPos = null;
          this.entranceEnemyPos = null;
          this.battlePlayerPos = null;
          this.battleEnemyPos = null;
          // ====== MechAttribute 面板绑定缓存（复用 MechAttributeTEST 的结构）======
          this.mechAttrInited = false;
          this.mechTextMap = {};
          this.mechNodeMap = {};
          this.mechBarMap = {};
          this.ATTR_BAR_MAX_WIDTH = 147;
          // 与 MechAttributeTEST 保持一致
          this.attributeAutoRefreshStarted = false;
          this.ATTR_REFRESH_INTERVAL = 0.1;

          // 100ms 刷新一次，足够“实时”且性能可控
          this.attrRefreshTick = () => {
            this.refreshPlayerMechAttributeUI(false);
          };

          // 玩家信息请求的一次性监听器（防止 BattleScene 关闭时泄漏）
          this.playerInfoListener = null;
          // 房间制战斗相关（默认开启，一场战斗一个房间，支持断线恢复）
          this.useServerRoomBattle = true;
          this.roomId = null;
          // 当前战斗房间 ID（PVE 单人一房间）
          this.isRequestingAction = false;
          // 正在向服务器发送指令中，防止重复点击
          this.currentBattleMode = 'pve';
          this._pvpFlatMatchRequested = false;
          this._pvpFlatMatchInProgress = false;

          /** 修复点：会话标识，异步回调中校验，避免快速开关面板时旧回调覆盖新状态 */
          this._sessionId = 0;

          /** 修复点：重连恢复中置位，避免 onEnable 再次请求 resume 覆盖已拉取的状态 */
          this._restoringFromReconnect = false;

          /** 修复点：由 Test 等外部在打开面板前注入的已拉取 state，打开后直接应用，不再发 resume/创建新房间 */
          this._pendingRestoreState = null;

          /**
           * 进入服务器战斗房间兜底：
           * - resume/create 后，如果一定时间内没有拿到并应用到完整 room state
           * - 或者 room state 里缺少 player/enemy
           * 则直接关闭 BattleScene，避免客户端卡在“房间里但没法继续”的状态。
           */
          this._roomStateApplied = false;
          this.BATTLE_ENTER_TIMEOUT_SEC = 12;

          this._onBattleEnterTimeout = () => {
            var _this$node;

            if (!((_this$node = this.node) != null && _this$node.isValid)) return;
            if (this._roomStateApplied) return; // 仅在服务端房间战斗模式下启用该兜底

            if (!this.useServerRoomBattle) return;
            console.error('[BattleScene] 进入战斗房间超时：未能应用完整 room state，自动退出面板避免卡死');
            this.state = BattleState.FINISHED;
            this.isAnimating = false;
            this.isRequestingAction = false;
            this.pendingPlayerAction = null;
            this.pendingEnemyAction = null;
            this.roomId = null;
            this.node.active = false;
          };

          /** 双方动画都结束后，再延迟此时间（秒）才显示操作面板，避免「动作未播完就出按钮」 */
          this.COMMAND_PANEL_DELAY_AFTER_ANIMATIONS = 0.25;
          // 在线房间战斗：用于“服务器结算 + 本地动画”的回合快照
          this.lastRoundPlayerHp = 0;
          this.lastRoundEnemyHp = 0;
          this.lastRoundPlayerAction = null;
          this.SERVER_ENEMY_ACTION = 'ATTACK';
          this.PVP_MATCH_TIMEOUT_SEC = 5;

          /**
           * 修复点：断线重连恢复战斗——重连后若服务器仍在战斗中，立即恢复战斗场景并刷新最新数据。
           * 不依赖 roomId 与面板是否打开：仅凭 character_id 向服务器 resume，有房间则展示面板并应用 state。
           */
          this._onNetworkReconnect = () => {
            var _this$node2, _this$ws$getCharacter, _this$ws;

            if (!((_this$node2 = this.node) != null && _this$node2.isValid) || !this.ws) return;
            if (!this.useServerRoomBattle) return;
            var characterId = (_this$ws$getCharacter = (_this$ws = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter.call(_this$ws);
            if (!characterId) return;
            this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_RESUME, {
              character_id: characterId
            }, resp => {
              var _this$node3, _resp$data;

              if (!((_this$node3 = this.node) != null && _this$node3.isValid)) return;
              if (!(resp != null && resp.success) || !((_resp$data = resp.data) != null && _resp$data.has_room) || !resp.data.state) return; // 只有服务器仍在战斗中才恢复；掉线期间战斗已自动结束则不再拉入房间

              if (resp.data.state.status !== 'in_progress') return; // 立即恢复战斗场景（可能之前被关掉），再应用最新房间状态；置位避免 onEnable 内再次 resume

              this._restoringFromReconnect = true;
              this.node.active = true;
              this.applyServerRoomState(resp.data.state, false);
              this.log('已恢复战斗连接，状态已同步');
            }, true, 6000);
          };

          /**
           * 机甲列表响应处理（用于战斗场景）
           */
          this.onRobotPetsResponseForBattle = data => {
            var _this$node4, _this$ws$getCharacter2, _this$ws2;

            // 移除监听（只监听一次）
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
            if (!((_this$node4 = this.node) != null && _this$node4.isValid)) return;
            var success = data.success === true || data.success === 'true';

            if (!success) {
              var _data$data;

              console.error('[BattleScene] 获取机甲列表失败:', data.message || ((_data$data = data.data) == null ? void 0 : _data$data.message) || '未知错误');
              return;
            } // 更新缓存


            var characterId = (_this$ws$getCharacter2 = (_this$ws2 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter2.call(_this$ws2);

            if (characterId) {
              this.cacheManager.setRobotPetsCache(characterId, data);
            }

            console.log('[BattleScene] 机甲列表数据已更新，开始战斗'); // 数据已更新，开始战斗

            this.startNewBattle();
          };

          /**
           * 机甲详情响应处理（用于战斗场景）
           */
          this.onRobotPetInfoResponseForBattle = data => {
            var _this$node5, _data$pet_id, _data$data3;

            // 移除监听（只监听一次）
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
            if (!((_this$node5 = this.node) != null && _this$node5.isValid)) return;
            var success = data.success === true || data.success === 'true';

            if (!success) {
              var _data$data2;

              console.error('[BattleScene] 获取机甲详情失败:', data.message || ((_data$data2 = data.data) == null ? void 0 : _data$data2.message) || '未知错误'); // 失败时使用列表中的基础数据

              this.initPlayerUnitWithFallback();
              return;
            } // 更新缓存


            var petId = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data3 = data.data) == null ? void 0 : _data$data3.pet_id;

            if (petId) {
              this.cacheManager.setRobotPetInfoCache(String(petId), data);
            }

            console.log('[BattleScene] 机甲详情数据已更新，重新初始化玩家单位'); // 数据已更新，重新初始化

            this.initPlayerUnit(); // 如果玩家单位初始化成功，继续初始化敌人单位

            if (this.playerUnit) {
              this.initEnemyUnit(); // 如果双方都初始化成功，等待双方都准备好后再开始战斗

              if (this.playerUnit && this.enemyUnit) {
                // 延迟一小段时间，确保双方展示都更新完成
                this.scheduleOnce(() => {
                  this.beginBattleAfterReady();
                }, 0.1); // 减少等待：进入战斗更快，RobotShow 自身有资源就绪重试
              }
            }
          };

          /** 关闭面板后延迟多久再开始动作（秒），提升“点击→收面板→再开打”的节奏感 */
          this.ACTION_DELAY_AFTER_PANEL_CLOSE = 1.0;
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
            error: Error()
          }), DataCacheManager) : DataCacheManager).getInstance(); // 资源预热：提前加载 RobotShow 所需的 json/图集/装备位置，避免进入战斗时现加载卡顿
          // 这里调用是幂等的（RobotShow 内部有静态缓存）

          try {
            (_crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
              error: Error()
            }), RobotShow) : RobotShow).preloadResources();
          } catch (_unused) {} // 修复点：在 onLoad 绑定重连监听，断线重连后无论面板是否可见都尝试恢复战斗并刷新数据


          this._bindNetworkReconnect(); // 注：加载时“是否在战斗中”的检测由常驻节点 Test 负责（BattleScene 面板默认隐藏时 schedule 不执行，无法在此处可靠检测）
          // 绑定按钮事件（使用 Button.EventType.CLICK 与项目其他模块一致）


          if (this.attackButton) {
            this.attackButton.node.on(Button.EventType.CLICK, this.onAttackClicked, this);
          }

          if (this.defendButton) {
            this.defendButton.node.on(Button.EventType.CLICK, this.onDefendClicked, this);
          }

          if (this.escapeButton) {
            this.escapeButton.node.on(Button.EventType.CLICK, this.onEscapeClicked, this);
          }

          if (this.backButton) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClicked, this);
          }
        }
        /** 修复点：onDestroy 解绑按钮，避免节点销毁后仍触发事件导致泄漏或报错 */


        onDestroy() {
          var _this$attackButton, _this$defendButton, _this$escapeButton, _this$backButton;

          if ((_this$attackButton = this.attackButton) != null && _this$attackButton.node) {
            this.attackButton.node.off(Button.EventType.CLICK, this.onAttackClicked, this);
          }

          if ((_this$defendButton = this.defendButton) != null && _this$defendButton.node) {
            this.defendButton.node.off(Button.EventType.CLICK, this.onDefendClicked, this);
          }

          if ((_this$escapeButton = this.escapeButton) != null && _this$escapeButton.node) {
            this.escapeButton.node.off(Button.EventType.CLICK, this.onEscapeClicked, this);
          }

          if ((_this$backButton = this.backButton) != null && _this$backButton.node) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClicked, this);
          }

          this.clearPlayerInfoListener();

          this._unbindNetworkReconnect();
        }

        onEnable() {
          // 重置所有状态标志，确保每次打开都是干净的状态
          this._sessionId += 1;
          this.state = BattleState.INIT;
          this._roomStateApplied = false;
          this.isAnimating = false;
          this.isRequestingAction = false;
          this.pendingPlayerAction = null;
          this.pendingEnemyAction = null;
          this.turnTimeLeft = this.TURN_TIME_LIMIT; // 恢复时由 applyServerRoomState 用服务器剩余时间覆盖

          this.lastRoundPlayerHp = 0;
          this.lastRoundEnemyHp = 0;
          this.lastRoundPlayerAction = null; // 修复点：进入战斗时先隐藏操作面板，等入场动画完成或恢复房间后再显示（避免一直显示）

          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          if (this.timerRoot) this.timerRoot.active = false; // 修复点：重置双方机甲透明度，避免上一场击破动画（alpha=0）导致下次战斗不显示

          this.resetRobotShowOpacity(this.playerRobotShow);
          this.resetRobotShowOpacity(this.enemyRobotShow); // 修复点：重连/加载时由外部已拉取 state，直接应用并不再请求 resume（避免二次请求导致误创建新房间）

          if (this._restoringFromReconnect) {
            this._restoringFromReconnect = false;

            if (this._pendingRestoreState) {
              var state = this._pendingRestoreState;
              this._pendingRestoreState = null;
              this.applyServerRoomState(state, false);
              this.log('已恢复战斗连接，状态已同步');
            }

            return;
          } // PVP 平匹配：进入后先做匹配流程，匹配到再进入回合界面


          if (this._pvpFlatMatchRequested) {
            this._pvpFlatMatchRequested = false;
            this.startPvpFlatMatchFlow();
            return;
          }

          if (this.useServerRoomBattle) {
            this.enterBattleRoom(); // 只对“服务端房间战斗入口”设置超时兜底

            this.unschedule(this._onBattleEnterTimeout);
            this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);
          } else {
            // 兼容旧逻辑：本地模拟一场战斗
            this.checkAndStartBattle();
          }
        }

        onDisable() {
          var _this$playerRobotShow, _this$enemyRobotShow;

          // 清理状态
          this.state = BattleState.FINISHED;
          this.isAnimating = false;
          this.isRequestingAction = false;
          if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
          if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false); // 清理事件监听

          if (this.ws) {
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
          }

          this.stopAttributeAutoRefresh();
          this.clearPlayerInfoListener(); // 修复点：停止所有 Tween 和 schedule，避免禁用后回调仍执行导致状态错乱

          if ((_this$playerRobotShow = this.playerRobotShow) != null && _this$playerRobotShow.node) Tween.stopAllByTarget(this.playerRobotShow.node);
          if ((_this$enemyRobotShow = this.enemyRobotShow) != null && _this$enemyRobotShow.node) Tween.stopAllByTarget(this.enemyRobotShow.node);
          this.unscheduleAllCallbacks(); // 清理回合快照（防止第二次战斗时数据错乱）

          this.lastRoundPlayerHp = 0;
          this.lastRoundEnemyHp = 0;
          this.lastRoundPlayerAction = null; // 清理待处理动作

          this.pendingPlayerAction = null;
          this.pendingEnemyAction = null; // 离开面板时不主动销毁房间，由服务器根据超时自动清理

          this.roomId = null;
          this.unschedule(this._onBattleEnterTimeout); // 隐藏匹配 Loading

          if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;
          this._pvpFlatMatchInProgress = false; // 关闭面板时把位置复位到入场起点，避免下次打开叠加

          this.resetEntrancePositions();
        }
        /**
         * 被 Test.ts 点击后调用：请求进入 PVP 平匹配流程
         * 注意：真正发起网络请求在 onEnable 内执行，避免竞态（panel.active 切换触发生命周期）。
         */


        requestPvpFlatMatch() {
          this._pvpFlatMatchRequested = true;
        }

        startPvpFlatMatchFlow() {
          var _this$ws$getCharacter3, _this$ws3;

          var characterId = (_this$ws$getCharacter3 = (_this$ws3 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter3.call(_this$ws3);

          if (!characterId) {
            console.error('[BattleScene] PVP 匹配：未获取到 characterId');
            this.node.active = false;
            return;
          }

          this._pvpFlatMatchInProgress = true;
          var sessionId = this._sessionId; // 匹配中先不“入场”：把双方机甲放回入场起点，并仅显示 Loading

          this.resetEntrancePositions(); // 匹配中 UI：只显示 Loading，禁止操作

          if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = true;
          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          if (this.timerRoot) this.timerRoot.active = false;
          this.setButtonsInteractable(false);

          var tryCloseIfStillMatching = () => {
            var _this$node6;

            if (!((_this$node6 = this.node) != null && _this$node6.isValid)) return;
            if (this._sessionId !== sessionId) return;
            if (!this._pvpFlatMatchInProgress) return;
            this._pvpFlatMatchInProgress = false;
            if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;
            this.node.active = false;
          };

          this.scheduleOnce(tryCloseIfStillMatching, this.PVP_MATCH_TIMEOUT_SEC); // 向服务器请求“平匹配”（服务端会等待 5 秒内找到对手）

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.PVP_FLAT_MATCH, {
            character_id: characterId
          }, resp => {
            var _this$node7, _resp$data2;

            if (!((_this$node7 = this.node) != null && _this$node7.isValid) || this._sessionId !== sessionId) return;
            this._pvpFlatMatchInProgress = false;
            if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;

            if (!(resp != null && resp.success) || !((_resp$data2 = resp.data) != null && _resp$data2.state)) {
              this.node.active = false;
              return;
            } // 匹配成功：直接应用房间 state（isNewRoom=false，使用服务器剩余倒计时更精确）
            // isNewRoom=true：匹配成功后播放入场动画，再进入指令阶段


            this.applyServerRoomState(resp.data.state, true);
          }, true, (this.PVP_MATCH_TIMEOUT_SEC + 2) * 1000);
        } // =========================
        // 房间制战斗入口与状态同步
        // =========================

        /**
         * 进入房间制战斗：
         * - 先尝试 resume（恢复进行中的战斗）
         * - 没有房间时再创建一场新的 PVE 房间
         */


        enterBattleRoom() {
          var _this$ws$getCharacter4, _this$ws4;

          var characterId = (_this$ws$getCharacter4 = (_this$ws4 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter4.call(_this$ws4);

          if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法进入战斗房间');
            return;
          }

          var sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_RESUME, {
            character_id: characterId
          }, resp => {
            var _this$node8, _resp$data3;

            if (!((_this$node8 = this.node) != null && _this$node8.isValid) || this._sessionId !== sessionId) return; // 只有服务器仍在战斗中才恢复；掉线期间战斗已结束则不再拉入房间，走创建新局

            if (resp != null && resp.success && (_resp$data3 = resp.data) != null && _resp$data3.has_room && resp.data.state && resp.data.state.status === 'in_progress') {
              // 恢复已有房间：isNewRoom = false，直接设置到战斗位置
              this.applyServerRoomState(resp.data.state, false);
              return;
            } // 没有进行中的房间（或房间已结束），创建一场新的战斗


            this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_CREATE, {
              character_id: characterId
            }, createResp => {
              var _this$node9, _createResp$data;

              if (!((_this$node9 = this.node) != null && _this$node9.isValid) || this._sessionId !== sessionId) return;

              if (!(createResp != null && createResp.success) || !((_createResp$data = createResp.data) != null && _createResp$data.state)) {
                console.error('[BattleScene] 创建战斗房间失败:', (createResp == null ? void 0 : createResp.message) || createResp); // PvE：数据异常/没有机甲，进入房间不应继续卡在面板里

                this.roomId = null;
                this.state = BattleState.FINISHED;
                this.pendingPlayerAction = null;
                this.pendingEnemyAction = null;
                this.isAnimating = false;
                this.isRequestingAction = false;
                this.setButtonsInteractable(true);
                this.node.active = false;
                return;
              } // 新创建房间：isNewRoom = true，播放入场动画


              this.applyServerRoomState(createResp.data.state, true);
            }, true, 10000);
          }, true, 8000);
        }

        _bindNetworkReconnect() {
          var _this$ws5;

          this._unbindNetworkReconnect();

          var node = (_this$ws5 = this.ws) == null ? void 0 : _this$ws5.node;

          if (node && typeof node.on === 'function') {
            node.on('network_connect', this._onNetworkReconnect, this);
          }
        }

        _unbindNetworkReconnect() {
          var _this$ws6;

          var node = (_this$ws6 = this.ws) == null ? void 0 : _this$ws6.node;

          if (node && typeof node.off === 'function') {
            node.off('network_connect', this._onNetworkReconnect, this);
          }
        }
        /**
         * 由 Test 等外部在打开面板前调用：注入已拉取的 resume state，打开后面板 onEnable 内会直接应用该 state，
         * 不再请求 resume/创建新房间，避免“先空场景再变成新房间”的问题。
         */


        prepareRestoreState(state) {
          this._pendingRestoreState = state;
          this._restoringFromReconnect = true;
        }
        /**
         * 将服务器房间状态映射到本地 BattleScene（HP/属性/UI）
         * @param state 服务器返回的房间状态
         * @param isNewRoom 是否是新创建的房间（true=新房间需要播放动画，false=恢复房间直接设置位置）
         * @param forRoundAnimation 若为 true：仅同步单位/展示数据，不调用 finishBattle、不显示操作面板（用于本回合动画播完后再收尾）
         */


        applyServerRoomState(state, isNewRoom, forRoundAnimation) {
          var _ref3, _playerRaw$Class, _playerRaw$data, _ref4, _enemyRaw$Class, _enemyRaw$data;

          if (isNewRoom === void 0) {
            isNewRoom = false;
          }

          if (forRoundAnimation === void 0) {
            forRoundAnimation = false;
          }

          if (!state) return; // 根据服务器返回的模式切换：PVP 可能需要更长的 action 等待时间（双方都提交完才结算）

          this.currentBattleMode = (state == null ? void 0 : state.mode) === 'pvp' ? 'pvp' : 'pve';
          this.roomId = state.room_id || state.roomId || null; // 修复点：应用进行中房间状态前清空战斗日志，避免上一场「玩家胜利/失败」残留导致误以为「直接胜利/击败」

          if (state.status !== 'finished') {
            this.logClear();
          }

          var playerActor = state.player;
          var enemyActor = state.enemy;

          if (!playerActor || !enemyActor) {
            console.error('[BattleScene] 房间状态缺少 player/enemy');
            return;
          } // 只要拿到并解析出了 player/enemy，就认为“进入房间应用成功”，取消兜底超时


          this._roomStateApplied = true;
          this.unschedule(this._onBattleEnterTimeout); // 使用服务器 actor.raw 作为原始属性来源

          var playerRaw = playerActor.raw || {};
          var enemyRaw = enemyActor.raw || {};
          this.playerUnit = this.buildUnitFromRobotInfo('player', playerRaw.pet_id || '', playerRaw, playerActor.name || '玩家机甲');
          this.enemyUnit = this.buildUnitFromRobotInfo('enemy', enemyRaw.pet_id || '', enemyRaw, enemyActor.name || '敌方机甲'); // 覆盖实时 HP / 攻防 / 出手值

          if (this.playerUnit) {
            var _ref, _playerActor$max_hp, _playerActor$hp, _playerActor$attack, _playerActor$defense, _playerActor$initiati;

            this.playerUnit.maxHp = Number((_ref = (_playerActor$max_hp = playerActor.max_hp) != null ? _playerActor$max_hp : playerActor.maxHp) != null ? _ref : this.playerUnit.maxHp);
            this.playerUnit.hp = Number((_playerActor$hp = playerActor.hp) != null ? _playerActor$hp : this.playerUnit.hp);
            this.playerUnit.attack = Number((_playerActor$attack = playerActor.attack) != null ? _playerActor$attack : this.playerUnit.attack);
            this.playerUnit.defense = Number((_playerActor$defense = playerActor.defense) != null ? _playerActor$defense : this.playerUnit.defense);
            this.playerUnit.initiative = Number((_playerActor$initiati = playerActor.initiative) != null ? _playerActor$initiati : this.playerUnit.initiative);
          }

          if (this.enemyUnit) {
            var _ref2, _enemyActor$max_hp, _enemyActor$hp, _enemyActor$attack, _enemyActor$defense, _enemyActor$initiativ;

            this.enemyUnit.maxHp = Number((_ref2 = (_enemyActor$max_hp = enemyActor.max_hp) != null ? _enemyActor$max_hp : enemyActor.maxHp) != null ? _ref2 : this.enemyUnit.maxHp);
            this.enemyUnit.hp = Number((_enemyActor$hp = enemyActor.hp) != null ? _enemyActor$hp : this.enemyUnit.hp);
            this.enemyUnit.attack = Number((_enemyActor$attack = enemyActor.attack) != null ? _enemyActor$attack : this.enemyUnit.attack);
            this.enemyUnit.defense = Number((_enemyActor$defense = enemyActor.defense) != null ? _enemyActor$defense : this.enemyUnit.defense);
            this.enemyUnit.initiative = Number((_enemyActor$initiativ = enemyActor.initiative) != null ? _enemyActor$initiativ : this.enemyUnit.initiative);
          } // 根据出场职业（Class）刷新 Player1 图标（重连/恢复战斗也会走到这里）


          var classValue = Number((_ref3 = (_playerRaw$Class = playerRaw == null ? void 0 : playerRaw.Class) != null ? _playerRaw$Class : playerRaw == null || (_playerRaw$data = playerRaw.data) == null ? void 0 : _playerRaw$data.Class) != null ? _ref3 : 1);
          this.updatePlayer1ClassIcon(classValue); // 根据出场职业（Class）刷新 敌人职业图标（重连/恢复战斗也会走到这里）

          var enemyClassValue = Number((_ref4 = (_enemyRaw$Class = enemyRaw == null ? void 0 : enemyRaw.Class) != null ? _enemyRaw$Class : enemyRaw == null || (_enemyRaw$data = enemyRaw.data) == null ? void 0 : _enemyRaw$data.Class) != null ? _ref4 : 1);
          this.updateEnemy1ClassIcon(enemyClassValue); // 更新 RobotShow 展示

          if (this.playerRobotShow) {
            try {
              this.playerRobotShow.updateFromRobotData(playerRaw);
            } catch (_unused2) {}
          }

          if (this.enemyRobotShow) {
            try {
              this.enemyRobotShow.updateFromRobotData(enemyRaw);
            } catch (_unused3) {}
          } // 更新属性面板与 HP 条


          this.ensureMechAttributeInited();
          this.refreshPlayerMechAttributeUI(true); // 战斗内：显示局内血条并刷新实时 HP。若为本回合动画（forRoundAnimation），不刷新上方战斗血条，等伤害数字出现后在 performAttackWithDamage 里再更新

          if (state.status !== 'finished' && !forRoundAnimation) {
            this.refreshBattleBarsVisibilityAndValue();
          } else if (state.status !== 'finished' && forRoundAnimation && this.playerRobotShow && this.enemyRobotShow) {
            this.playerRobotShow.setBattleBarsVisible(true);
            this.enemyRobotShow.setBattleBarsVisible(true);
          } // 修复点：仅用于本回合动画时只同步数据，不切 UI、不结束战斗；击杀/胜负在 playServerRoundAnimation 播完双方动画后再处理


          if (forRoundAnimation) return; // 根据房间状态切换 UI

          if (state.status === 'finished' && state.result) {
            var winner = state.result.winner === 'player' ? 'player' : 'enemy';
            var reason = state.result.reason === 'escape' ? 'escape' : 'ko';
            this.finishBattle(winner, reason);
          } else {
            // 房间仍在进行中：新房间播放入场动画；恢复房间则直接设置到战斗位置
            if (isNewRoom) {
              // 新房间：确保状态正确，然后播放入场动画（动画完成后会调用 startCommandPhase）
              this.state = BattleState.INIT;
              this.isAnimating = false;
              this.pendingPlayerAction = null;
              this.pendingEnemyAction = {
                side: 'enemy',
                type: 'ATTACK'
              }; // 确保位置已缓存

              this.cacheEntranceAndBattlePositionsIfNeeded(); // 播放入场动画（动画完成后会调用 startCommandPhase 并开启倒计时/按钮）

              this.playEntranceAnimation();
              return;
            } // 恢复/刷新状态：不播放动画，直接放到战斗位置并进入“等待指令”阶段


            this.setBattlePositionsDirectly();
            this.state = BattleState.WAITING_COMMANDS;
            this.isAnimating = false;
            this.pendingPlayerAction = null;
            this.pendingEnemyAction = {
              side: 'enemy',
              type: 'ATTACK'
            }; // 修复点：恢复战斗时使用服务器剩余时间，不重置为 30 秒（支持多种字段名与回合开始时间推算）

            var remainingSec = this._getRemainingCommandSecondsFromState(state);

            this.turnTimeLeft = remainingSec;
            this.updateTimerLabel();

            if (this.battleSelectPanel) {
              this.battleSelectPanel.active = true;
            }

            this.setButtonsInteractable(true);
            this.refreshBattleBarsVisibilityAndValue();
          }
        }
        /** 战斗时显示双方局内血条并刷新为当前 HP（与机甲属性面板一致） */


        refreshBattleBarsVisibilityAndValue() {
          if (this.playerRobotShow) {
            this.playerRobotShow.setBattleBarsVisible(true);

            if (this.playerUnit) {
              this.playerRobotShow.updateBattleBars(this.playerUnit.hp, this.playerUnit.maxHp);
            }
          }

          if (this.enemyRobotShow) {
            this.enemyRobotShow.setBattleBarsVisible(true);

            if (this.enemyUnit) {
              this.enemyRobotShow.updateBattleBars(this.enemyUnit.hp, this.enemyUnit.maxHp);
            }
          }
        }
        /**
         * 从服务器房间 state 解析本回合指令阶段剩余秒数（恢复战斗时倒计时不重置为 30）
         * 支持字段：remaining_command_seconds / remaining_seconds / command_remaining_seconds（秒）、command_deadline_ts（截止时间戳 ms）、round_start_ts / round_start_time（回合开始时间戳 ms，用 30 - 已过秒数）
         */


        _getRemainingCommandSecondsFromState(state) {
          var _ref5, _n, _n2, _ref6, _n3;

          var limit = this.TURN_TIME_LIMIT;
          if (!state || typeof state !== 'object') return limit;

          var n = v => v != null && typeof v === 'number' && !Number.isNaN(v) ? v : null;

          var now = Date.now(); // 1) 直接剩余秒数（多种命名）

          var direct = (_ref5 = (_n = n(state.remaining_command_seconds)) != null ? _n : n(state.remaining_seconds)) != null ? _ref5 : n(state.command_remaining_seconds);
          if (direct != null && direct >= 0) return Math.min(limit, Math.ceil(direct)); // 2) 截止时间戳（毫秒）

          var deadline = (_n2 = n(state.command_deadline_ts)) != null ? _n2 : n(state.command_deadline_ms);

          if (deadline != null) {
            var sec = (deadline - now) / 1000;
            if (sec > 0) return Math.min(limit, Math.ceil(sec));
          } // 3) 回合开始时间戳（毫秒），剩余 = 30 - 已过秒数


          var startTs = (_ref6 = (_n3 = n(state.round_start_ts)) != null ? _n3 : n(state.round_start_time)) != null ? _ref6 : n(state.command_phase_start_ts);

          if (startTs != null) {
            var elapsed = (now - startTs) / 1000;
            var remain = limit - elapsed;
            if (remain > 0) return Math.ceil(remain);
          }

          return limit;
        }
        /**
         * 直接将机甲设置到战斗位置（用于恢复房间时，不需要动画）
         */


        setBattlePositionsDirectly() {
          var _this$playerRobotShow2, _this$enemyRobotShow2;

          var playerNode = (_this$playerRobotShow2 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow2.node;
          var enemyNode = (_this$enemyRobotShow2 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow2.node;
          if (!playerNode || !enemyNode) return; // 确保位置已缓存

          this.cacheEntranceAndBattlePositionsIfNeeded();

          if (!this.battlePlayerPos || !this.battleEnemyPos) {
            console.warn('[BattleScene] 战斗位置未缓存，使用默认位置');
            return;
          } // 直接设置到战斗位置


          playerNode.setPosition(this.battlePlayerPos);
          enemyNode.setPosition(this.battleEnemyPos);
        }

        cacheEntranceAndBattlePositionsIfNeeded() {
          var _this$playerRobotShow3, _this$enemyRobotShow3;

          var playerNode = (_this$playerRobotShow3 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow3.node;
          var enemyNode = (_this$enemyRobotShow3 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow3.node;
          if (!playerNode || !enemyNode) return;

          if (!this.entrancePlayerPos || !this.entranceEnemyPos || !this.battlePlayerPos || !this.battleEnemyPos) {
            // 以编辑器里当前摆放的位置作为“入场起点”（例如 -450 / 440）
            this.entrancePlayerPos = playerNode.position.clone();
            this.entranceEnemyPos = enemyNode.position.clone(); // 终点 = 起点 X 偏移（玩家 +300，敌人 -300）

            this.battlePlayerPos = new Vec3(this.entrancePlayerPos.x + 300, this.entrancePlayerPos.y, this.entrancePlayerPos.z);
            this.battleEnemyPos = new Vec3(this.entranceEnemyPos.x - 300, this.entranceEnemyPos.y, this.entranceEnemyPos.z);
          }
        }

        resetEntrancePositions() {
          var _this$playerRobotShow4, _this$enemyRobotShow4;

          var playerNode = (_this$playerRobotShow4 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow4.node;
          var enemyNode = (_this$enemyRobotShow4 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow4.node;
          if (!playerNode || !enemyNode) return;
          this.cacheEntranceAndBattlePositionsIfNeeded();
          if (this.entrancePlayerPos) playerNode.setPosition(this.entrancePlayerPos);
          if (this.entranceEnemyPos) enemyNode.setPosition(this.entranceEnemyPos);
        }
        /**
         * 检查缓存并开始战斗（如果缓存为空则先请求数据）
         */


        checkAndStartBattle() {
          var _this$ws$getCharacter5, _this$ws7;

          var characterId = (_this$ws$getCharacter5 = (_this$ws7 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter5.call(_this$ws7);

          if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法开始战斗');
            return;
          }

          var listCache = this.cacheManager.getRobotPetsCache(characterId);
          var pets = [];

          if (listCache) {
            if (listCache.data && Array.isArray(listCache.data.pets)) {
              pets = listCache.data.pets;
            } else if (Array.isArray(listCache.pets)) {
              pets = listCache.pets;
            }
          } // 如果缓存为空，先请求机甲列表数据


          if (!pets || pets.length === 0) {
            console.log('[BattleScene] 机甲列表缓存为空，正在请求数据...');
            this.requestRobotPetsAndStart();
            return;
          } // 缓存有数据，直接开始战斗


          this.startNewBattle();
        }
        /**
         * 请求机甲列表数据，收到响应后开始战斗
         */


        requestRobotPetsAndStart() {
          var _this$ws$getCharacter6, _this$ws8;

          var characterId = (_this$ws$getCharacter6 = (_this$ws8 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter6.call(_this$ws8);

          if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法请求机甲列表');
            return;
          } // 监听机甲列表响应


          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this); // 发送请求

          var requestData = {
            character_id: characterId,
            page: 0,
            page_size: 50
          };
          var userId = this.ws.getUserId();

          if (userId) {
            requestData.user_id = userId;
          }

          this.ws.notify((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PETS, requestData, true);
          console.log('[BattleScene] 已发送机甲列表请求，等待响应...');
        }

        startNewBattle() {
          this.logClear();
          this.state = BattleState.INIT;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this.updateTimerLabel(); // 每次开战都先把双方位置重置到入场起点

          this.resetEntrancePositions();

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示
          } // 刷新“玩家/敌人角色形象+名字”


          this.refreshPlayerAndEnemyShows(); // 初始化玩家单位（会在准备好后触发 initEnemyUnit）
          // 注意：玩家单位可能需要异步请求（出战队伍/机甲详情），不能在这里立刻校验 playerUnit

          this.playerUnit = null;
          this.enemyUnit = null;
          this.initPlayerUnit();
          this.log('正在准备玩家机甲...（请稍候）');
        }
        /**
         * 双方都准备好后开始战斗（根据 Initiative 决定先后手）
         */


        beginBattleAfterReady() {
          // 再次检查双方单位是否都初始化完成
          if (!this.playerUnit || !this.enemyUnit) {
            console.error('[BattleScene] 双方单位未完全初始化，无法开始战斗');
            return;
          } // 进入"指令选择阶段"：双方都需要先选择（目前敌方默认普攻）


          this.log('战斗开始！进入指令选择阶段（双方先选，再按出手值结算）'); // 通知服务器一场战斗开始（先用于日志，后续可扩展为真正战斗接口）

          try {
            this.ws.send({
              type: 'battle_start',
              player: this.buildUnitSummary(this.playerUnit),
              enemy: this.buildUnitSummary(this.enemyUnit)
            }, true);
          } catch (e) {
            console.warn('[BattleScene] 发送 battle_start 失败:', e);
          } // 播放入场平移动画，动画完成后开始第一回合的指令选择


          this.playEntranceAnimation();
        }
        /**
         * 入场平移动画：双方从左右各偏移300的位置，1秒内平移到目标位置
         */


        playEntranceAnimation() {
          var _this$playerRobotShow5, _this$enemyRobotShow5;

          var playerNode = (_this$playerRobotShow5 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow5.node;
          var enemyNode = (_this$enemyRobotShow5 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow5.node;

          if (!playerNode || !enemyNode) {
            console.warn('[BattleScene] 入场动画：缺少 RobotShow 节点，跳过动画直接开始战斗');
            this.startCommandPhase();
            return;
          } // 固定起点/终点（避免每次打开叠加）


          this.cacheEntranceAndBattlePositionsIfNeeded();

          if (!this.entrancePlayerPos || !this.entranceEnemyPos || !this.battlePlayerPos || !this.battleEnemyPos) {
            this.startCommandPhase();
            return;
          }

          var playerStartPos = this.entrancePlayerPos.clone();
          var enemyStartPos = this.entranceEnemyPos.clone();
          var playerTargetPos = this.battlePlayerPos.clone();
          var enemyTargetPos = this.battleEnemyPos.clone(); // 每次动画都先强制回到起点

          playerNode.setPosition(playerStartPos);
          enemyNode.setPosition(enemyStartPos); // 动画时长：1秒

          var animDuration = 1.0; // 玩家和敌人同时平移到目标位置

          var playerAnimDone = false;
          var enemyAnimDone = false;

          var checkAllDone = () => {
            if (playerAnimDone && enemyAnimDone) {
              // 动画完成，开始第一回合的指令选择
              this.startCommandPhase();
            }
          }; // 玩家平移动画


          tween(playerNode).to(animDuration, {
            position: playerTargetPos
          }, {
            easing: 'sineOut'
          }).call(() => {
            playerAnimDone = true;
            checkAllDone();
          }).start(); // 敌人平移动画

          tween(enemyNode).to(animDuration, {
            position: enemyTargetPos
          }, {
            easing: 'sineOut'
          }).call(() => {
            enemyAnimDone = true;
            checkAllDone();
          }).start();
        }
        /**
         * 入场平移动画完成后的回调：开始指令选择阶段
         * 这个函数会被 playEntranceAnimation 中的 checkAllDone 调用
         */

        /**
         * 从缓存中取出玩家机甲库列表的第一个机甲，并从机甲详情缓存中读取属性
         * 优先使用出战队伍的第一位机甲
         */


        initPlayerUnit() {
          var _this$ws$getCharacter7, _this$ws9;

          var characterId = (_this$ws$getCharacter7 = (_this$ws9 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter7.call(_this$ws9);

          if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法初始化玩家单位');
            return;
          }

          var listCache = this.cacheManager.getRobotPetsCache(characterId);
          var pets = [];

          if (listCache) {
            if (listCache.data && Array.isArray(listCache.data.pets)) {
              pets = listCache.data.pets;
            } else if (Array.isArray(listCache.pets)) {
              pets = listCache.pets;
            }
          }

          if (!pets || pets.length === 0) {
            console.error('[BattleScene] 机甲列表缓存为空，无法初始化玩家单位');
            return;
          } // 出战队伍改为服务器权威：先拉取，再决定使用哪台机甲（当前只取第一位主战）


          var sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_BATTLE_TEAM, {
            character_id: characterId
          }, resp => {
            var _this$node10, _ref7, _Class, _info, _info2;

            if (!((_this$node10 = this.node) != null && _this$node10.isValid) || this._sessionId !== sessionId) return;
            var battleTeam = [];

            if (resp && resp.success === true && resp.data && Array.isArray(resp.data.battle_team)) {
              battleTeam = resp.data.battle_team.map(x => String(x)).filter(x => x);
            } // 优先使用出战队伍第一位，否则回退列表第一位


            var firstPet = null;
            var petId = '';

            if (battleTeam.length > 0) {
              var battlePetId = battleTeam[0];
              firstPet = pets.find(p => String(p.pet_id || p._id || p.id || '') === battlePetId);

              if (firstPet) {
                petId = battlePetId;
                console.log("[BattleScene] \u4F7F\u7528\u670D\u52A1\u5668\u51FA\u6218\u961F\u4F0D\u7B2C\u4E00\u4F4D\u673A\u7532: " + petId);
              }
            }

            if (!firstPet || !petId) {
              firstPet = pets[0];
              petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');

              if (!petId) {
                console.error('[BattleScene] 第一个机甲缺少 pet_id，无法初始化玩家单位');
                return;
              }
            } // 从机甲详情缓存中读取属性（MechAttributeTEST 已经在查看详情时写入）


            var info = this.cacheManager.getRobotPetInfoCache(petId);

            if (!info) {
              console.warn('[BattleScene] 未找到机甲详情缓存，正在请求详情数据...');
              this.requestRobotPetInfoAndInit(petId, firstPet);
              return;
            } else if (info.data) {
              info = info.data;
            }

            this.playerUnit = this.buildUnitFromRobotInfo('player', petId, info, '玩家机甲'); // 更新展示（RobotShow）

            if (this.playerRobotShow && info) {
              try {
                var dataForShow = _extends({}, info, {
                  pet_id: petId
                });

                this.playerRobotShow.updateFromRobotData(dataForShow);
              } catch (e) {
                console.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
              }
            } // ✅ 战斗机甲属性面板：初始化 + 立刻刷新（只显示当前出场机甲）


            this.ensureMechAttributeInited();
            this.refreshPlayerMechAttributeUI(true);
            this.startAttributeAutoRefresh(); // ✅ Player1 图标：按机甲类型切换 gedou/sheji/quanneng

            var classValue = Number((_ref7 = (_Class = (_info = info) == null ? void 0 : _info.Class) != null ? _Class : (_info2 = info) == null || (_info2 = _info2.data) == null ? void 0 : _info2.Class) != null ? _ref7 : 1);
            this.updatePlayer1ClassIcon(classValue); // 玩家准备好后再生成敌人（敌人依赖 playerUnit.petId）

            this.initEnemyUnit();
          }, true, 5000);
        }
        /**
         * 请求机甲详情数据并初始化玩家单位
         */


        requestRobotPetInfoAndInit(petId, fallbackData) {
          // 监听机甲详情响应
          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this); // 发送请求

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PET_INFO, {
            pet_id: petId
          }, response => {// request 回调会自动处理响应
          }, true, 10000);
          console.log("[BattleScene] \u5DF2\u53D1\u9001\u673A\u7532\u8BE6\u60C5\u8BF7\u6C42 (pet_id: " + petId + ")\uFF0C\u7B49\u5F85\u54CD\u5E94...");
        }

        /**
         * 使用列表中的基础数据初始化玩家单位（备用方案）
         */
        initPlayerUnitWithFallback() {
          var _this$ws$getCharacter8, _this$ws10, _Class2;

          var characterId = (_this$ws$getCharacter8 = (_this$ws10 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter8.call(_this$ws10);

          if (!characterId) {
            return;
          }

          var listCache = this.cacheManager.getRobotPetsCache(characterId);
          var pets = [];

          if (listCache) {
            if (listCache.data && Array.isArray(listCache.data.pets)) {
              pets = listCache.data.pets;
            } else if (Array.isArray(listCache.pets)) {
              pets = listCache.pets;
            }
          }

          if (!pets || pets.length === 0) {
            return;
          }

          var firstPet = pets[0];
          var petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');

          if (!petId) {
            return;
          }

          console.warn('[BattleScene] 使用列表中的基础数据构建玩家单位（可能缺少完整属性）');
          this.playerUnit = this.buildUnitFromRobotInfo('player', petId, firstPet, '玩家机甲'); // 更新展示

          if (this.playerRobotShow) {
            try {
              var dataForShow = _extends({}, firstPet, {
                pet_id: petId
              });

              this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
              console.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
          } // 备用数据也尽量刷新属性面板与图标


          this.ensureMechAttributeInited();
          this.refreshPlayerMechAttributeUI(true);
          this.startAttributeAutoRefresh();
          var classValue = Number((_Class2 = firstPet == null ? void 0 : firstPet.Class) != null ? _Class2 : 1);
          this.updatePlayer1ClassIcon(classValue);
        }
        /**
         * 敌方单位：目前先简单复用玩家属性做随机偏移（后续由服务器提供正式接口）
         * 为保持与服务器成长公式一致，后续可以改为直接请求服务器生成一只敌人机甲。
         */


        initEnemyUnit() {
          if (!this.playerUnit) {
            console.error('[BattleScene] 玩家单位未初始化，无法构建敌人单位');
            return;
          } // 敌人由服务器生成（随机角色 + 满装备 + 最终属性 + 装备限制）


          var playerPetId = this.playerUnit.petId;
          this.enemyUnit = null;
          this.isEnemyGenerating = true;
          var sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_GENERATE_ENEMY, {
            player_pet_id: playerPetId || undefined
          }, resp => {
            var _this$node11, _resp$data4, _ref8, _enemy$CurrentMelee, _ref9, _enemy$CurrentShootin, _ref10, _enemy$CurrentArmor, _enemy$MaxHP, _enemy$CurrentHP, _ref11, _enemy$CurrentInitiat;

            this.isEnemyGenerating = false;
            if (!((_this$node11 = this.node) != null && _this$node11.isValid) || this._sessionId !== sessionId) return;

            if (!resp || resp.success === false) {
              console.error('[BattleScene] 生成敌人失败:', (resp == null ? void 0 : resp.message) || (resp == null ? void 0 : resp.error) || resp);
              return;
            }

            var enemy = resp.enemy || ((_resp$data4 = resp.data) == null ? void 0 : _resp$data4.enemy) || null;

            if (!enemy) {
              console.error('[BattleScene] 生成敌人失败：响应缺少 enemy 字段', resp);
              return;
            } // 构建敌方单位（攻击/防御/initiative 用 Current* 优先）


            var melee = Number((_ref8 = (_enemy$CurrentMelee = enemy.CurrentMelee) != null ? _enemy$CurrentMelee : enemy.Melee) != null ? _ref8 : 0);
            var shoot = Number((_ref9 = (_enemy$CurrentShootin = enemy.CurrentShooting) != null ? _enemy$CurrentShootin : enemy.Shooting) != null ? _ref9 : 0);
            var armor = Number((_ref10 = (_enemy$CurrentArmor = enemy.CurrentArmor) != null ? _enemy$CurrentArmor : enemy.Armor) != null ? _ref10 : 0);
            var maxHp = Number((_enemy$MaxHP = enemy.MaxHP) != null ? _enemy$MaxHP : 1000);
            var hp = Number((_enemy$CurrentHP = enemy.CurrentHP) != null ? _enemy$CurrentHP : maxHp);
            var initiative = Number((_ref11 = (_enemy$CurrentInitiat = enemy.CurrentInitiative) != null ? _enemy$CurrentInitiat : enemy.Initiative) != null ? _ref11 : 10);
            this.enemyUnit = {
              side: 'enemy',
              name: enemy.RobotName || '敌方机甲',
              level: Number(enemy.Level || 1),
              maxHp,
              hp,
              attack: melee + shoot,
              defense: armor,
              initiative,
              petId: undefined,
              rawData: enemy
            }; // 更新敌方展示（含满装备）

            if (this.enemyRobotShow) {
              try {
                this.enemyRobotShow.updateFromRobotData(enemy);
              } catch (e) {
                console.error('[BattleScene] 更新敌人 RobotShow 失败:', e);
              }
            } // ✅ 敌人已生成：如果当前还在 INIT（或刚启动战斗），立即进入指令选择阶段
            // 这样操作面板/倒计时必然会出现


            if (this.state === BattleState.INIT && this.playerUnit && this.enemyUnit) {
              this.beginBattleAfterReady();
            }
          }, true, 10000);
        }

        buildUnitFromRobotInfo(side, petId, info, defaultName) {
          var _ref12, _ref13, _info$MaxHP, _ref14, _info$CurrentHP, _ref15, _info$Melee, _ref16, _info$Shooting, _ref17, _info$Armor, _ref18, _info$Initiative;

          var name = (info == null ? void 0 : info.RobotName) || (info == null ? void 0 : info.name) || defaultName;
          var level = Number((info == null ? void 0 : info.Level) || (info == null ? void 0 : info.level) || 1); // 属性字段命名尽量兼容现有 MechAttributeTEST 使用的键

          var maxHp = Number((_ref12 = (_ref13 = (_info$MaxHP = info == null ? void 0 : info.MaxHP) != null ? _info$MaxHP : info == null ? void 0 : info.max_hp) != null ? _ref13 : info == null ? void 0 : info.hp) != null ? _ref12 : 100);
          var hp = Number((_ref14 = (_info$CurrentHP = info == null ? void 0 : info.CurrentHP) != null ? _info$CurrentHP : info == null ? void 0 : info.current_hp) != null ? _ref14 : maxHp);
          var melee = Number((_ref15 = (_info$Melee = info == null ? void 0 : info.Melee) != null ? _info$Melee : info == null ? void 0 : info.melee) != null ? _ref15 : 0);
          var shoot = Number((_ref16 = (_info$Shooting = info == null ? void 0 : info.Shooting) != null ? _info$Shooting : info == null ? void 0 : info.shoot) != null ? _ref16 : 0);
          var armor = Number((_ref17 = (_info$Armor = info == null ? void 0 : info.Armor) != null ? _info$Armor : info == null ? void 0 : info.armor) != null ? _ref17 : 0);
          var attack = melee + shoot;
          var defense = armor;
          var initiative = Number((_ref18 = (_info$Initiative = info == null ? void 0 : info.Initiative) != null ? _info$Initiative : info == null ? void 0 : info.initiative) != null ? _ref18 : 10);
          return {
            side,
            name,
            level,
            maxHp,
            hp,
            attack,
            defense,
            initiative,
            petId,
            rawData: info
          };
        }

        determineFirstTurn() {
          if (!this.playerUnit || !this.enemyUnit) return; // 保留方法：用于回合结算时决定出手顺序（不再用于“是否立即行动”）
        }
        /**
         * 指令选择阶段：双方都先选指令（当前敌方默认普攻，但不会提前出手）
         */


        startCommandPhase() {
          if (this.state === BattleState.FINISHED) return;
          this.state = BattleState.WAITING_COMMANDS;
          this.pendingPlayerAction = null; // 敌方 AI：默认普攻（后续可扩展技能/物品）

          this.pendingEnemyAction = {
            side: 'enemy',
            type: 'ATTACK'
          };
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this.updateTimerLabel();

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = true;
          }

          this.setButtonsInteractable(true);
          this.refreshBattleBarsVisibilityAndValue();
          this.log('请选择指令（普攻 / 逃跑）。30 秒未操作则自动选择普攻。');
        }

        update(dt) {
          if (this.state === BattleState.WAITING_COMMANDS) {
            this.turnTimeLeft -= dt;

            if (this.turnTimeLeft <= 0) {
              this.turnTimeLeft = 0;
              this.updateTimerLabel(); // 超时自动普攻（仅触发一次）

              if (!this.isAnimating) {
                if (this.useServerRoomBattle && this.roomId) {
                  this.log('超时未操作，自动选择普攻');
                  this.sendBattleRoomAction('ATTACK');
                } else {
                  this.log('超时未操作，自动选择普攻');

                  if (!this.pendingPlayerAction) {
                    this.pendingPlayerAction = {
                      side: 'player',
                      type: 'ATTACK'
                    };
                  }

                  this.tryResolveRound();
                }
              }
            } else {
              this.updateTimerLabel();
            }
          }
        }

        updateTimerLabel() {
          if (!this.timerLabel) return;
          this.timerLabel.string = "" + Math.ceil(this.turnTimeLeft); // 在等待指令阶段显示倒计时

          if (this.timerRoot) {
            this.timerRoot.active = this.state === BattleState.WAITING_COMMANDS;
          }
        }

        setButtonsInteractable(enable) {
          if (this.attackButton) this.attackButton.interactable = enable;
          if (this.defendButton) this.defendButton.interactable = enable;
          if (this.escapeButton) this.escapeButton.interactable = enable;
          if (this.backButton) this.backButton.interactable = enable;
        } // ========== 按钮事件 ==========


        onAttackClicked() {
          if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) return;

          if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('ATTACK');
            return;
          } // 本地模拟模式：保留旧逻辑


          this.pendingPlayerAction = {
            side: 'player',
            type: 'ATTACK'
          };
          this.tryResolveRound();
        }

        onDefendClicked() {
          if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) return;

          if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('DEFEND');
            return;
          } // 本地模拟模式：保留旧逻辑


          this.pendingPlayerAction = {
            side: 'player',
            type: 'DEFEND'
          };
          this.tryResolveRound();
        }

        onEscapeClicked() {
          if (this.state === BattleState.FINISHED || this.isAnimating || this.isRequestingAction) return; // 玩家选择逃跑（按需求：直接失败并通知服务器）

          if (this.state === BattleState.WAITING_COMMANDS) {
            if (this.useServerRoomBattle && this.roomId) {
              this.sendBattleRoomAction('ESCAPE');
              return;
            }

            this.pendingPlayerAction = {
              side: 'player',
              type: 'ESCAPE'
            };
            this.tryResolveRound();
          }
        }
        /**
         * 房间制：向服务器提交一次指令，并用返回的新 state 刷新 UI + 播放本地动画
         * 伤害和胜负全部以服务器为准，本地只负责表现。
         */


        sendBattleRoomAction(action) {
          var _this$ws$getCharacter9, _this$ws11;

          if (!this.roomId || this.isRequestingAction) return;
          var characterId = (_this$ws$getCharacter9 = (_this$ws11 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter9.call(_this$ws11);
          if (!characterId) return; // 记录本回合开始前的 HP 快照和玩家动作

          if (this.playerUnit && this.enemyUnit) {
            this.lastRoundPlayerHp = this.playerUnit.hp;
            this.lastRoundEnemyHp = this.enemyUnit.hp;
            this.lastRoundPlayerAction = action;
          } else {
            this.lastRoundPlayerHp = 0;
            this.lastRoundEnemyHp = 0;
            this.lastRoundPlayerAction = null;
          }

          this.isRequestingAction = true;
          this.setButtonsInteractable(false); // 修复点：提交指令时关闭操作面板，与本地模式 tryResolveRound 行为一致，避免动画期间面板仍显示

          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          var sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_ACTION, {
            room_id: this.roomId,
            action_type: action,
            character_id: characterId
          }, resp => {
            var _this$node12, _resp$data5, _ref19, _playerActor$hp2, _this$playerUnit, _ref20, _enemyActor$hp2, _this$enemyUnit;

            this.isRequestingAction = false;
            if (!((_this$node12 = this.node) != null && _this$node12.isValid) || this._sessionId !== sessionId) return;

            if (!(resp != null && resp.success) || !((_resp$data5 = resp.data) != null && _resp$data5.state)) {
              console.error('[BattleScene] battle_room_action 失败:', (resp == null ? void 0 : resp.message) || resp);
              this.setButtonsInteractable(true); // 修复点：请求失败时恢复操作面板显示，便于玩家重试

              if (this.battleSelectPanel) this.battleSelectPanel.active = true;
              return;
            }

            var state = resp.data.state;
            var playerActor = state.player;
            var enemyActor = state.enemy; // 服务器结算后的最终 HP

            var targetPlayerHp = Number((_ref19 = (_playerActor$hp2 = playerActor == null ? void 0 : playerActor.hp) != null ? _playerActor$hp2 : (_this$playerUnit = this.playerUnit) == null ? void 0 : _this$playerUnit.hp) != null ? _ref19 : 0);
            var targetEnemyHp = Number((_ref20 = (_enemyActor$hp2 = enemyActor == null ? void 0 : enemyActor.hp) != null ? _enemyActor$hp2 : (_this$enemyUnit = this.enemyUnit) == null ? void 0 : _this$enemyUnit.hp) != null ? _ref20 : 0); // 修复点：只同步单位/展示数据，不调 finishBattle、不显示面板；击杀时先播完本回合双方动画，再在 playServerRoundAnimation 收尾时调 finishBattle

            this.applyServerRoomState(state, false, true);

            if (!this.playerUnit || !this.enemyUnit || this.lastRoundPlayerAction == null) {
              return; // 缺快照或单位，直接用静态 UI
            } // 按服务器结果计算本回合掉血量（不能为负）


            var damageToPlayer = Math.max(0, this.lastRoundPlayerHp - targetPlayerHp);
            var damageToEnemy = Math.max(0, this.lastRoundEnemyHp - targetEnemyHp); // 为了播动画，把本地 HP 暂时“回滚”到回合开始前

            this.playerUnit.hp = this.lastRoundPlayerHp;
            this.enemyUnit.hp = this.lastRoundEnemyHp;
            this.syncUnitHpToRawData(this.playerUnit);
            this.syncUnitHpToRawData(this.enemyUnit);
            this.refreshPlayerMechAttributeUI(true); // 用服务器伤害驱动一轮动画，播完再落到服务器最终 HP

            this.playServerRoundAnimation(this.lastRoundPlayerAction, damageToPlayer, damageToEnemy, targetPlayerHp, targetEnemyHp, state);
          }, true, this.currentBattleMode === 'pvp' ? 35000 : 10000);
        }

        onBackClicked() {
          // 只在指令选择阶段允许开关面板
          if (this.state !== BattleState.WAITING_COMMANDS) return;
          if (!this.battleSelectPanel) return;
          this.battleSelectPanel.active = !this.battleSelectPanel.active;
        } // ========== 战斗核心 ==========


        getUnit(side) {
          return side === 'player' ? this.playerUnit : this.enemyUnit;
        }

        getOpponent(side) {
          return side === 'player' ? this.enemyUnit : this.playerUnit;
        }

        performAttack(attackerSide, onDone) {
          var _attacker$rawData, _attacker$rawData2;

          var attacker = this.getUnit(attackerSide);
          var defender = this.getOpponent(attackerSide);
          if (!attacker || !defender) return;
          if (this.state === BattleState.FINISHED) return;
          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.setButtonsInteractable(false);
          var rawDamage = attacker.attack - defender.defense;
          var damage = Math.max(1, rawDamage);
          defender.hp = Math.max(0, defender.hp - damage);
          this.syncUnitHpToRawData(defender); // 只在“玩家机甲”受伤时刷新属性面板（敌方不显示面板）

          if (defender.side === 'player') {
            this.refreshPlayerMechAttributeUI(true);
          }

          this.log((attackerSide === 'player' ? '玩家' : '敌人') + " \u666E\u653B\u9020\u6210 " + damage + " \u70B9\u4F24\u5BB3\uFF08\u653B\u51FB " + attacker.attack + " - \u9632\u5FA1 " + defender.defense + "\uFF09"); // 判定是否为“远程攻击”（是否装备枪械）

          var attackerEquip = ((_attacker$rawData = attacker.rawData) == null ? void 0 : _attacker$rawData.equipment) || ((_attacker$rawData2 = attacker.rawData) == null || (_attacker$rawData2 = _attacker$rawData2.data) == null ? void 0 : _attacker$rawData2.equipment) || {};
          var attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id); // 播放攻击动画（根据是否有枪械区分远程/近战）

          var attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          var defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
          this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, () => {
            // 检查是否有人死亡
            if (defender.hp <= 0) {
              var winner = attacker.side;
              this.log((winner === 'player' ? '玩家' : '敌人') + " \u83B7\u80DC\uFF01");
              var defeatedShow = winner === 'player' ? this.enemyRobotShow : this.playerRobotShow;

              if (defeatedShow) {
                this.playDefeatAnimation(defeatedShow, () => this.finishBattle(winner, 'ko'));
              } else {
                this.finishBattle(winner, 'ko');
              }

              return;
            } // 单次攻击完成


            this.isAnimating = false;
            onDone();
          });
        }

        /**
         * 如果双方指令都已选择，则按 Initiative 结算本回合
         * 先关闭操作面板，延迟 1 秒后再开始动作，避免“刚点完就攻击”的仓促感
         */
        tryResolveRound() {
          if (this.state !== BattleState.WAITING_COMMANDS) return;
          if (!this.pendingPlayerAction || !this.pendingEnemyAction) return; // 一旦双方都有指令，先关闭面板并锁定 UI

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false;
          }

          this.setButtonsInteractable(false); // 延迟一段时间再执行动作，让玩家有“确认选择→收板→再开打”的体验

          this.scheduleOnce(() => {
            var _this$pendingPlayerAc;

            if (this.state === BattleState.FINISHED) return; // 逃跑优先：玩家选择逃跑则直接失败结束（不再结算攻击）

            if (((_this$pendingPlayerAc = this.pendingPlayerAction) == null ? void 0 : _this$pendingPlayerAc.type) === 'ESCAPE') {
              this.log('你选择了逃跑，本次战斗失败。');
              this.finishBattle('enemy', 'escape');
              return;
            } // 仅支持普攻（后续扩展技能/物品：在这里增加分支）


            this.resolveByInitiative();
          }, this.ACTION_DELAY_AFTER_PANEL_CLOSE);
        }
        /**
         * 按 Initiative 决定先后手，依次执行（目前只有普攻）
         */


        resolveByInitiative() {
          if (!this.playerUnit || !this.enemyUnit) return;
          var playerFirst = this.playerUnit.initiative > this.enemyUnit.initiative || this.playerUnit.initiative === this.enemyUnit.initiative;
          var first = playerFirst ? 'player' : 'enemy';
          var second = playerFirst ? 'enemy' : 'player';
          var firstAction = first === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;
          var secondAction = second === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;

          var execAction = (side, action, done) => {
            if (this.state === BattleState.FINISHED) return;

            if (!action) {
              done();
              return;
            }

            if (action.type === 'ATTACK') {
              this.performAttack(side, done);
              return;
            }

            if (action.type === 'DEFEND') {
              this.log((side === 'player' ? '玩家' : '敌人') + " \u9009\u62E9\u4E86\u9632\u5FA1/\u5F85\u673A\uFF08\u672C\u56DE\u5408\u4E0D\u884C\u52A8\uFF09"); // 给一点点时间作为“动作占位”，避免过于突兀

              this.scheduleOnce(done, 0.15);
              return;
            } // 其他动作暂未实现：先当作待机


            this.log((side === 'player' ? '玩家' : '敌人') + " \u52A8\u4F5C(" + action.type + ")\u6682\u672A\u5B9E\u73B0\uFF0C\u672C\u56DE\u5408\u8DF3\u8FC7");
            this.scheduleOnce(done, 0.15);
          };

          execAction(first, firstAction, () => {
            if (this.state === BattleState.FINISHED) return; // 隔 1 秒再播下一方动画，避免双方动作叠在一起看不出谁在攻击

            this.scheduleOnce(() => {
              if (this.state === BattleState.FINISHED) return;
              execAction(second, secondAction, () => {
                if (this.state === BattleState.FINISHED) return; // 修复点：双方动画都结束后再延迟显示操作面板（与在线模式一致）

                this.scheduleOnce(() => {
                  if (this.state !== BattleState.FINISHED) this.startCommandPhase();
                }, this.COMMAND_PANEL_DELAY_AFTER_ANIMATIONS);
              });
            }, 1.0);
          });
        }
        /**
         * 在线模式：依据服务器给的伤害结果，按先后手播放一轮动画
         */


        playServerRoundAnimation(playerAction, damageToPlayer, damageToEnemy, targetPlayerHp, targetEnemyHp, serverState) {
          if (!this.playerUnit || !this.enemyUnit) {
            return;
          } // 逃跑：服务器已经把结果算好了，这里只做简单提示和 finish


          if (playerAction === 'ESCAPE') {
            var _serverState$result, _serverState$result2;

            this.log('你选择了逃跑，本次战斗失败。');
            var winner = (serverState == null || (_serverState$result = serverState.result) == null ? void 0 : _serverState$result.winner) === 'player' ? 'player' : 'enemy';
            var reason = (serverState == null || (_serverState$result2 = serverState.result) == null ? void 0 : _serverState$result2.reason) === 'escape' ? 'escape' : 'ko';
            this.scheduleOnce(() => {
              this.finishBattle(winner, reason);
            }, 0.3);
            return;
          }

          var playerFirst = this.playerUnit.initiative > this.enemyUnit.initiative || this.playerUnit.initiative === this.enemyUnit.initiative;
          var order = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];

          var runAction = (side, done) => {
            if (this.state === BattleState.FINISHED) {
              done();
              return;
            }

            if (side === 'player') {
              if (playerAction === 'ATTACK' && damageToEnemy > 0) {
                this.performAttackWithDamage('player', damageToEnemy, done);
              } else if (playerAction === 'DEFEND') {
                this.log('玩家选择了防御/待机（本回合不行动）');
                this.scheduleOnce(done, 0.15);
              } else {
                this.scheduleOnce(done, 0.1);
              }
            } else {
              if (damageToPlayer > 0) {
                this.performAttackWithDamage('enemy', damageToPlayer, done);
              } else {
                this.log('敌人本回合未造成伤害');
                this.scheduleOnce(done, 0.15);
              }
            }
          }; // 执行先手/后手


          runAction(order[0], () => {
            if (this.state === BattleState.FINISHED) return;
            this.scheduleOnce(() => {
              if (this.state === BattleState.FINISHED) return;
              runAction(order[1], () => {
                if (this.state === BattleState.FINISHED) return; // 动画播完后，将 HP 校准到服务器最终值

                if (this.playerUnit) {
                  this.playerUnit.hp = targetPlayerHp;
                  this.syncUnitHpToRawData(this.playerUnit);
                }

                if (this.enemyUnit) {
                  this.enemyUnit.hp = targetEnemyHp;
                  this.syncUnitHpToRawData(this.enemyUnit);
                }

                this.refreshPlayerMechAttributeUI(true); // 根据服务器结果收尾：击杀/胜负在双方动画都播完后才结束战斗，符合回合制常规体验

                if ((serverState == null ? void 0 : serverState.status) === 'finished' && serverState.result) {
                  var _winner = serverState.result.winner === 'player' ? 'player' : 'enemy';

                  var _reason = serverState.result.reason === 'escape' ? 'escape' : 'ko'; // 胜负已定：为被击破的一方播放同款击破动画（敌我一致），再结束战斗


                  var defeatedShow = _winner === 'player' ? this.enemyRobotShow : this.playerRobotShow;

                  if (defeatedShow) {
                    this.playDefeatAnimation(defeatedShow, () => {
                      if (this.state !== BattleState.FINISHED) this.finishBattle(_winner, _reason);
                    });
                  } else {
                    this.scheduleOnce(() => {
                      if (this.state !== BattleState.FINISHED) this.finishBattle(_winner, _reason);
                    }, 0.5);
                  }
                } else {
                  // 修复点：双方动画都结束后再延迟一小段时间才显示操作面板，避免「动作未播完就出按钮」
                  this.scheduleOnce(() => {
                    if (this.state !== BattleState.FINISHED) this.startCommandPhase();
                  }, this.COMMAND_PANEL_DELAY_AFTER_ANIMATIONS);
                }
              });
            }, 1.0);
          });
        }
        /**
         * 在线模式专用：按服务器给定伤害值播放一次攻击动画（不再用本地公式算伤害）。
         * 流程：先播攻击动画 → 动画结束后扣血、弹出伤害数字 → 延迟后再更新血条（敌我都等伤害数字弹出后再改）。
         */


        performAttackWithDamage(attackerSide, damage, onDone) {
          var _attacker$rawData3, _attacker$rawData4;

          var attacker = this.getUnit(attackerSide);
          var defender = this.getOpponent(attackerSide);

          if (!attacker || !defender) {
            onDone();
            return;
          }

          if (this.state === BattleState.FINISHED) {
            onDone();
            return;
          }

          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.setButtonsInteractable(false);
          damage = Math.max(1, Math.floor(damage));
          this.log((attackerSide === 'player' ? '玩家' : '敌人') + " \u9020\u6210 " + damage + " \u70B9\u4F24\u5BB3\uFF08\u6309\u670D\u52A1\u5668\u7ED3\u679C\uFF09");
          var attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          var defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow; // 是否远程：沿用原来判断

          var attackerEquip = ((_attacker$rawData3 = attacker.rawData) == null ? void 0 : _attacker$rawData3.equipment) || ((_attacker$rawData4 = attacker.rawData) == null || (_attacker$rawData4 = _attacker$rawData4.data) == null ? void 0 : _attacker$rawData4.equipment) || {};
          var attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);
          this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, () => {
            this.isAnimating = false; // 动画结束后再扣血、弹伤害数字（此时不刷新任何血条，等伤害数字一起）

            defender.hp = Math.max(0, defender.hp - damage);
            this.syncUnitHpToRawData(defender);

            if (defenderShow) {
              defenderShow.showDamageNumber(damage, false);
            } // 等伤害数字弹出后，上面战斗血条和底下属性面板血条一起更新，再结束本动作


            this.scheduleOnce(() => {
              if (this.state !== BattleState.FINISHED) {
                if (defenderShow) {
                  defenderShow.updateBattleBars(defender.hp, defender.maxHp);
                }

                if (defender.side === 'player') {
                  this.refreshPlayerMechAttributeUI(true);
                }
              }

              onDone();
            }, 0.35);
          });
        }

        playAttackAnimation(attackerShow, defenderShow, isRanged, onComplete) {
          var attackerNode = (attackerShow == null ? void 0 : attackerShow.node) || null;
          var defenderNode = (defenderShow == null ? void 0 : defenderShow.node) || null;

          if (!attackerNode || !defenderNode) {
            console.warn('[BattleScene] 攻击动画：缺少 RobotShow 节点，跳过动画');
            onComplete();
            return;
          }

          var attackerStart = attackerNode.position.clone();
          var defenderStart = defenderNode.position.clone(); // 敌人被击退方向：始终远离攻击方

          var attackerOnLeft = attackerNode.worldPosition.x < defenderNode.worldPosition.x;
          var knockbackDelta = attackerOnLeft ? 30 : -30; // 击退 30 像素

          var knockbackPos = new Vec3(defenderStart.x + knockbackDelta, defenderStart.y, defenderStart.z); // 为了避免双方动作重叠，这里统一用“全部 tween 结束后再回调”的计数逻辑

          var activeTweens = 0;

          var onTweenStart = () => {
            activeTweens += 1;
          };

          var onTweenDone = () => {
            activeTweens -= 1;

            if (activeTweens <= 0) {
              // 所有本次攻击相关的 tween 都完成，才能开始下一方行为
              onComplete();
            }
          }; // 远程（射击）：攻击方「后坐 + 回位」+ 敌人「中弹击退 + 拉回」，错开时序让“先开火→再中弹”更清晰


          if (isRanged) {
            var recoilDelta = attackerOnLeft ? -22 : 22; // 后坐方向：远离敌人

            var recoilPos = new Vec3(attackerStart.x + recoilDelta, attackerStart.y, attackerStart.z);
            onTweenStart();
            tween(attackerNode).to(0.07, {
              position: recoilPos
            }).to(0.11, {
              position: attackerStart
            }).call(onTweenDone).start();
            onTweenStart();
            tween(defenderNode).delay(0.05).to(0.08, {
              position: knockbackPos
            }).to(0.12, {
              position: defenderStart
            }).call(onTweenDone).start();
            return;
          } // 近战：攻击方瞬移到对方面前（间隔 30 的 X），两者一起产生击退/拉回效果，然后攻击方快速回位


          var meleeGap = 30;
          var meleeContactX = attackerOnLeft ? defenderStart.x - meleeGap : defenderStart.x + meleeGap;
          var meleeContactPos = new Vec3(meleeContactX, attackerStart.y, attackerStart.z); // 瞬移到近战位置

          attackerNode.setPosition(meleeContactPos); // 敌人击退 + 拉回，同时攻击方稍微跟随一点拉回感，然后回原位

          onTweenStart();
          tween(defenderNode).to(0.08, {
            position: knockbackPos
          }).to(0.12, {
            position: defenderStart
          }).call(() => {
            onTweenDone();
          }).start();
          onTweenStart();
          tween(attackerNode) // 稍微跟随敌人方向轻微移动，增强打击感
          .to(0.08, {
            position: new Vec3(meleeContactPos.x + knockbackDelta * 0.3, meleeContactPos.y, meleeContactPos.z)
          }).to(0.12, {
            position: meleeContactPos
          }) // 回到原位
          .to(0.12, {
            position: attackerStart
          }).call(() => {
            onTweenDone();
          }).start();
        }
        /** 将 RobotShow 下所有 Sprite 的透明度恢复为 255，避免击破动画后下次战斗不显示 */


        resetRobotShowOpacity(show) {
          var _show$node;

          if (!(show != null && (_show$node = show.node) != null && _show$node.isValid)) return;
          var sprites = show.node.getComponentsInChildren(Sprite);
          sprites.forEach(s => {
            var _s$node;

            if (!(s != null && (_s$node = s.node) != null && _s$node.isValid)) return;
            var c = s.color;
            s.color = new Color(c.r, c.g, c.b, 255);
          });
        }
        /**
         * 机甲被击败时的消失动画（敌我通用）：整机闪烁 → 装备透明度快速消失 → 机甲透明度消失，总时长 1 秒内，再回调
         * 不同步频率，分阶段进行。
         */


        playDefeatAnimation(defeatedShow, onComplete) {
          var _this = this;

          var root = defeatedShow.node;

          if (!root || !root.isValid) {
            onComplete();
            return;
          }

          var body = defeatedShow.body;
          var equipNodes = [defeatedShow.weaponIcon, defeatedShow.gunIcon, defeatedShow.dunIcon, defeatedShow.wingIcon].filter(Boolean);
          var allSprites = root.getComponentsInChildren(Sprite);
          var equipSprites = [];
          var bodySprites = [];

          for (var n of equipNodes) {
            var s = n == null ? void 0 : n.getComponent(Sprite);
            if (s) equipSprites.push(s);
          }

          if (body != null && body.isValid) {
            bodySprites.push(...body.getComponentsInChildren(Sprite));
          }

          var setAlpha = (list, a) => {
            var alpha = Math.max(0, Math.min(255, Math.round(a)));
            list.forEach(s => {
              var _s$node2;

              if (!(s != null && (_s$node2 = s.node) != null && _s$node2.isValid)) return;
              var c = s.color;
              s.color = new Color(c.r, c.g, c.b, alpha);
            });
          }; // 1) 0~0.25s：整机闪烁（不统一频率）


          this.scheduleOnce(() => setAlpha(allSprites, 120), 0.06);
          this.scheduleOnce(() => setAlpha(allSprites, 255), 0.12);
          this.scheduleOnce(() => setAlpha(allSprites, 120), 0.18);
          this.scheduleOnce(() => setAlpha(allSprites, 255), 0.25); // 2) 0.2s 起：装备透明度快速消失（约 0.25s 内消失）

          var equipFadeStart = 0.2;
          var equipFadeDur = 0.25;
          var equipSteps = 8;

          var _loop = function _loop() {
            var t = equipFadeStart + equipFadeDur * i / equipSteps;
            var alpha = 255 * (1 - i / equipSteps);

            _this.scheduleOnce(() => setAlpha(equipSprites, alpha), t);
          };

          for (var i = 0; i <= equipSteps; i++) {
            _loop();
          } // 3) 0.35s 起：机甲本体透明度消失（约 0.4s 内消失）


          var bodyFadeStart = 0.35;
          var bodyFadeDur = 0.4;
          var bodySteps = 10;

          var _loop2 = function _loop2() {
            var t = bodyFadeStart + bodyFadeDur * _i / bodySteps;
            var alpha = 255 * (1 - _i / bodySteps);

            _this.scheduleOnce(() => setAlpha(bodySprites, alpha), t);
          };

          for (var _i = 0; _i <= bodySteps; _i++) {
            _loop2();
          }

          this.scheduleOnce(() => {
            if (typeof onComplete === 'function') onComplete();
          }, 1.0);
        }

        finishBattle(winner, reason) {
          if (this.state === BattleState.FINISHED) return;
          this.state = BattleState.FINISHED;
          this.isAnimating = false;
          this.setButtonsInteractable(false);

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false;
          }

          if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
          if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false);
          var result = {
            type: winner === 'player' ? 'win' : 'lose',
            reason
          }; // 通知服务器战斗结果（当前仅用于记录日志）

          try {
            this.ws.send({
              type: 'battle_result',
              winner: winner === 'player' ? 'player' : 'enemy',
              reason,
              player: this.playerUnit ? this.buildUnitSummary(this.playerUnit) : null,
              enemy: this.enemyUnit ? this.buildUnitSummary(this.enemyUnit) : null
            }, true);
          } catch (e) {
            console.warn('[BattleScene] 发送 battle_result 失败:', e);
          } // 战斗结束后：清除本场机甲详情缓存，保证回到机甲属性时重新拉取并显示实打实的血量/经验


          try {
            var _this$playerUnit2, _this$ws$getCharacter10, _this$ws12;

            var petId = ((_this$playerUnit2 = this.playerUnit) == null ? void 0 : _this$playerUnit2.petId) != null ? String(this.playerUnit.petId) : null;

            if (petId) {
              this.cacheManager.clearRobotPetInfoCache(petId);
            }

            var cid = (_this$ws$getCharacter10 = (_this$ws12 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter10.call(_this$ws12);

            if (cid) {
              var _this$ws$getUserId, _this$ws13;

              var req = {
                type: 'get_player',
                character_id: cid
              };
              var uid = (_this$ws$getUserId = (_this$ws13 = this.ws).getUserId) == null ? void 0 : _this$ws$getUserId.call(_this$ws13);
              if (uid != null) req.user_id = uid;
              this.ws.send(req, true, true);
            }
          } catch (e) {
            console.warn('[BattleScene] 战斗结束刷新缓存/拉取失败:', e);
          }

          this.log("\u6218\u6597\u7ED3\u675F\uFF1A" + (result.type === 'win' ? '玩家胜利' : '玩家失败') + "\uFF08\u539F\u56E0\uFF1A" + (reason === 'ko' ? '击倒' : '逃跑') + "\uFF09"); // 关闭 BattleScene 面板（上层可选择重新激活）

          this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
              this.node.active = false;
            }
          }, 1.0);
        }

        buildUnitSummary(unit) {
          if (!unit) return null;
          return {
            side: unit.side,
            name: unit.name,
            level: unit.level,
            maxHp: unit.maxHp,
            hp: unit.hp,
            attack: unit.attack,
            defense: unit.defense,
            initiative: unit.initiative,
            pet_id: unit.petId
          };
        }

        log(msg) {
          console.log('[BattleScene]', msg);
          if (!this.logLabel) return;
          var old = this.logLabel.string || '';
          this.logLabel.string = old ? old + "\n" + msg : msg;
        }

        logClear() {
          if (this.logLabel) {
            this.logLabel.string = '';
          }
        } // =========================
        // 新增：PlayerShow / EnemyPlayerShow（角色形象+名字）
        // =========================


        refreshPlayerAndEnemyShows() {
          // 玩家：必须与玩家数据一致（get_player / is_self=true）
          this.refreshPlayerShowFromServer(); // 敌人：暂时随机

          this.refreshEnemyShowRandom();
        }

        refreshPlayerShowFromServer() {
          var _this$ws$getCharacter11, _this$ws14, _this$ws$getUserId2, _this$ws15;

          if (!this.playerShowRoot) return;
          var characterId = (_this$ws$getCharacter11 = (_this$ws14 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter11.call(_this$ws14);
          if (!characterId) return;
          var requestId = "battle_get_player_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
          var req = {
            character_id: characterId,
            request_id: requestId
          };
          var userId = (_this$ws$getUserId2 = (_this$ws15 = this.ws).getUserId) == null ? void 0 : _this$ws$getUserId2.call(_this$ws15);
          if (userId) req.user_id = userId; // 先清掉上一次遗留的监听

          this.clearPlayerInfoListener(); // 兼容服务器实际事件：'player_info' / 'player_info_response'
          // 同时尽量用 request_id 过滤，避免吃到其他面板的返回

          var handler = resp => {
            var data = resp && resp.success && resp.data && typeof resp.data === 'object' ? _extends({}, resp, resp.data) : resp;
            if (!data || data.success !== true) return;
            var isSelf = data.is_self === true || data.is_self === 'true' || data.is_self === 1 || data.is_self === '1';
            if (!isSelf) return; // 若响应携带 request_id，则必须匹配；否则退化为 character_id 匹配

            if (data.request_id !== undefined && data.request_id !== null) {
              if (data.request_id !== requestId) return;
            } else {
              var respCid = String(data.character_id || '');
              if (respCid && respCid !== characterId) return;
            }

            var name = String(data.role_name || '');
            var spriteIndex = Number(data.Sprite || data.sprite || 0);
            this.applyRoleShow(this.playerShowRoot, name, spriteIndex);
            cleanup();
          };

          this.playerInfoListener = handler;

          var cleanup = () => this.clearPlayerInfoListener();

          this.ws.on('player_info', handler, this);
          this.ws.on('player_info_response', handler, this); // 不做 3 秒超时自动清理：进入战斗时可能卡加载/网络慢，避免错过回包导致永远不显示
          // 发送请求（不依赖 request() 的 *_response 机制）

          this.ws.send(_extends({
            type: 'get_player'
          }, req), true, true);
        }

        clearPlayerInfoListener() {
          if (!this.playerInfoListener) return;

          if (this.ws) {
            this.ws.off('player_info', this.playerInfoListener, this);
            this.ws.off('player_info_response', this.playerInfoListener, this);
          }

          this.playerInfoListener = null;
        }

        refreshEnemyShowRandom() {
          if (!this.enemyPlayerShowRoot) return;
          var randomNames = ['敌人', '神秘人', '挑战者', '对手', '来者不善'];
          var name = "" + randomNames[Math.floor(Math.random() * randomNames.length)] + Math.floor(100 + Math.random() * 900);
          var spriteIndex = this.characterAvatarFrames.length > 0 ? 1 + Math.floor(Math.random() * this.characterAvatarFrames.length) : 0;
          this.applyRoleShow(this.enemyPlayerShowRoot, name, spriteIndex);
        }

        applyRoleShow(root, roleName, spriteIndex) {
          var nameNode = root.getChildByName('Name');

          if (nameNode) {
            var label = nameNode.getComponent(Label);
            if (label) label.string = roleName || '';
          }

          var playerNode = root.getChildByName('Player');

          if (playerNode) {
            var sprite = playerNode.getComponent(Sprite);

            if (sprite) {
              var idx = spriteIndex - 1;

              if (idx >= 0 && idx < this.characterAvatarFrames.length && this.characterAvatarFrames[idx]) {
                sprite.spriteFrame = this.characterAvatarFrames[idx];
                playerNode.active = true;
              } else {
                // 若没有配置头像列表，则保持原先的 spriteFrame（不强制清空）
                playerNode.active = true;
              }
            }
          }
        } // =========================
        // 新增：MechaClass/Player1 图标切换
        // =========================


        updatePlayer1ClassIcon(classValue) {
          if (!this.player1ClassIcon) return;
          var frame = null; // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng

          if (classValue === 2) frame = this.player1ClassIconSheji;else if (classValue === 3) frame = this.player1ClassIconQuanneng;else frame = this.player1ClassIconGedou;
          if (frame) this.player1ClassIcon.spriteFrame = frame;
        }

        updateEnemy1ClassIcon(classValue) {
          if (!this.enemy1ClassIcon) return;
          var frame = null; // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng

          if (classValue === 2) frame = this.enemy1ClassIconSheji;else if (classValue === 3) frame = this.enemy1ClassIconQuanneng;else frame = this.enemy1ClassIconGedou;
          if (frame) this.enemy1ClassIcon.spriteFrame = frame;
        } // =========================
        // 新增：战斗机甲属性面板（实时）
        // =========================


        ensureMechAttributeInited() {
          if (this.mechAttrInited) return;
          if (!this.mechAttributeRoot) return;
          this.initMechAttributeBindings(this.mechAttributeRoot);
          this.mechAttrInited = true;
        }

        initMechAttributeBindings(root) {
          this.mechTextMap = {};
          this.mechNodeMap = {};
          this.mechBarMap = {}; // 普通文本型

          var textKeys = ['Growth', 'Comprehension', 'StarLevel', 'Star', 'RobotName', 'Level', 'Class'];

          for (var key of textKeys) {
            var parent = this.findChildByName(root, key);
            var labelNode = (parent == null ? void 0 : parent.getChildByName('NumericalValue')) || null;
            var label = (labelNode == null ? void 0 : labelNode.getComponent(Label)) || null;
            if (label) this.mechTextMap[key] = label;
          } // 分割型（基础值/当前值）


          var nodeKeys = ['Melee', 'Armor', 'Accuracy', 'Corrosion', 'Initiative', 'Block', 'ParticleShield', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'];

          for (var _key of nodeKeys) {
            var _layoutNode$getChildB, _layoutNode$getChildB2;

            var _parent = this.findChildByName(root, _key);

            var layoutNode = (_parent == null ? void 0 : _parent.getChildByName('Node')) || null;
            if (!layoutNode) continue;
            this.mechNodeMap[_key] = {
              left: ((_layoutNode$getChildB = layoutNode.getChildByName('LeftLabel')) == null ? void 0 : _layoutNode$getChildB.getComponent(Label)) || null,
              right: ((_layoutNode$getChildB2 = layoutNode.getChildByName('RightLabel')) == null ? void 0 : _layoutNode$getChildB2.getComponent(Label)) || null,
              slash: layoutNode.getChildByName('SlashSprite') || null
            };
          } // 进度条（HP/MP/EXP）


          var barKeys = [{
            key: 'HP',
            max: 'MaxHP',
            cur: 'CurrentHP',
            panel: 'HPpanel'
          }, {
            key: 'MP',
            max: 'MaxMP',
            cur: 'CurrentMP',
            panel: 'MPpanel'
          }, {
            key: 'EXP',
            max: 'MaxEXP',
            cur: 'CurrentEXP',
            panel: 'EXPpanel'
          }];

          for (var item of barKeys) {
            var _parent2 = this.findChildByName(root, item.key);

            var panel = (_parent2 == null ? void 0 : _parent2.getChildByName(item.panel)) || null;
            var barNode = (panel == null ? void 0 : panel.getChildByName(item.cur)) || null;

            var _labelNode = (panel == null ? void 0 : panel.getChildByName('NumericalValue')) || null;

            var _label = (_labelNode == null ? void 0 : _labelNode.getComponent(Label)) || null;

            if (barNode || _label) {
              this.mechBarMap[item.key] = {
                bar: barNode,
                label: _label
              };
            }
          }
        }

        refreshPlayerMechAttributeUI(force) {
          if (force === void 0) {
            force = false;
          }

          if (!this.mechAttributeRoot) return;
          if (!this.playerUnit) return;
          this.ensureMechAttributeInited();
          var data = this.buildPlayerMechDisplayData();
          if (!data) return;
          this.applyMechAttributeDataToUI(data);
        }

        startAttributeAutoRefresh() {
          if (this.attributeAutoRefreshStarted) return;
          this.attributeAutoRefreshStarted = true; // 低频定时刷新兜底（多数时候我们会在伤害结算时立刻刷新）

          this.unschedule(this.attrRefreshTick);
          this.schedule(this.attrRefreshTick, this.ATTR_REFRESH_INTERVAL);
        }

        stopAttributeAutoRefresh() {
          if (!this.attributeAutoRefreshStarted) return;
          this.attributeAutoRefreshStarted = false;
          this.unschedule(this.attrRefreshTick);
        }

        buildPlayerMechDisplayData() {
          var _base$RobotName, _base$Level, _base$MaxHP;

          if (!this.playerUnit) return null;
          var raw = this.playerUnit.rawData;

          if (raw && raw.data && typeof raw.data === 'object') {
            raw = _extends({}, raw, raw.data);
          }

          var base = raw && typeof raw === 'object' ? raw : {}; // 用战斗内实时值覆盖 CurrentHP

          return _extends({}, base, {
            pet_id: this.playerUnit.petId,
            RobotName: (_base$RobotName = base.RobotName) != null ? _base$RobotName : this.playerUnit.name,
            Level: (_base$Level = base.Level) != null ? _base$Level : this.playerUnit.level,
            MaxHP: Number((_base$MaxHP = base.MaxHP) != null ? _base$MaxHP : this.playerUnit.maxHp),
            CurrentHP: Number(this.playerUnit.hp)
          });
        }

        applyMechAttributeDataToUI(data) {
          // 文本
          for (var key of Object.keys(this.mechTextMap)) {
            var _data$key;

            var label = this.mechTextMap[key];
            if (!label) continue;

            if (key === 'Star') {
              var _data$StarLevel;

              label.string = String((_data$StarLevel = data['StarLevel']) != null ? _data$StarLevel : '');
              continue;
            }

            if (key === 'RobotName') {
              var _data$RobotName;

              var name = String((_data$RobotName = data['RobotName']) != null ? _data$RobotName : '');
              var formNum = Number(data['Form'] !== undefined ? data['Form'] : data['Fo'] !== undefined ? data['Fo'] : 0);
              var suffix = '';
              if (formNum === 1) suffix = '|初';else if (formNum === 2) suffix = '|中';else if (formNum === 3) suffix = '|终';
              label.string = name + suffix;
              continue;
            }

            if (key === 'Class') {
              var _data$Class;

              var classNum = Number((_data$Class = data['Class']) != null ? _data$Class : 1);
              var classStr = '格斗型';
              if (classNum === 2) classStr = '射击型';else if (classNum === 3) classStr = '全能型';
              label.string = classStr;
              continue;
            }

            label.string = String((_data$key = data[key]) != null ? _data$key : '');
          } // 分割值


          for (var _key2 of Object.keys(this.mechNodeMap)) {
            var _data$_key;

            var group = this.mechNodeMap[_key2];
            if (!group || !group.left) continue;
            var baseValue = (_data$_key = data[_key2]) != null ? _data$_key : 0;
            var currentKey = 'Current' + _key2;

            if (Object.prototype.hasOwnProperty.call(data, currentKey)) {
              var _data$currentKey;

              group.left.string = String(baseValue);
              if (group.right) group.right.string = String((_data$currentKey = data[currentKey]) != null ? _data$currentKey : 0);
              if (group.slash) group.slash.active = true;
            } else {
              group.left.string = String(baseValue);
              if (group.right) group.right.string = '';
              if (group.slash) group.slash.active = false;
            }
          } // 进度条


          var barKeys = [{
            key: 'HP',
            max: 'MaxHP',
            cur: 'CurrentHP'
          }, {
            key: 'MP',
            max: 'MaxMP',
            cur: 'CurrentMP'
          }, {
            key: 'EXP',
            max: 'MaxEXP',
            cur: 'CurrentEXP'
          }];

          for (var item of barKeys) {
            var _data$item$cur, _data$item$max;

            var bar = this.mechBarMap[item.key];
            if (!bar) continue;
            var cur = Number((_data$item$cur = data[item.cur]) != null ? _data$item$cur : 0);
            var max = Number((_data$item$max = data[item.max]) != null ? _data$item$max : 0);

            if (bar.label) {
              bar.label.string = cur + "/" + max;
            }

            if (bar.bar) {
              this.setBarWidth(bar.bar, cur, max);
            }
          }
        }

        setBarWidth(barNode, cur, max) {
          var percent = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
          var width = Math.max(1, this.ATTR_BAR_MAX_WIDTH * percent);
          var uiTrans = barNode.getComponent(UITransform);

          if (uiTrans) {
            uiTrans.setContentSize(width, uiTrans.height);
          }
        }

        syncUnitHpToRawData(unit) {
          if (!unit || !unit.rawData) return;

          try {
            // 同步到 rawData 供 UI 读取（不强行写入缓存，避免污染其他面板的“服务器权威数据”）
            unit.rawData.CurrentHP = unit.hp;

            if (unit.rawData.data && typeof unit.rawData.data === 'object') {
              unit.rawData.data.CurrentHP = unit.hp;
            }
          } catch (_unused4) {}
        }
        /**
         * 递归查找子节点（容错：找不到返回 null）
         */


        findChildByName(parent, name) {
          if (parent.name === name) return parent;

          for (var child of parent.children) {
            var found = this.findChildByName(child, name);
            if (found) return found;
          }

          return null;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "playerRobotShow", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "enemyRobotShow", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "battleSelectPanel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "attackButton", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "defendButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "escapeButton", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "timerLabel", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "timerRoot", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "logLabel", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "matchingLoadingPanel", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "mechAttributeRoot", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIcon", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconGedou", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconQuanneng", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconSheji", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIcon", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconGedou", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconQuanneng", [_dec20], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconSheji", [_dec21], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class2.prototype, "playerShowRoot", [_dec22], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class2.prototype, "enemyPlayerShowRoot", [_dec23], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class2.prototype, "characterAvatarFrames", [_dec24], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=42f4f7e531e7b1fc873cfefb3bb744b4cf83f039.js.map