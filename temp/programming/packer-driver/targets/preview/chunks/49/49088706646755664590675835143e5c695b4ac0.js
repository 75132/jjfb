System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, Label, ScrollView, instantiate, UITransform, Color, Sprite, SpriteFrame, WebSocketManager, GameConfig, DataCacheManager, UILockManager, emitBattleTeamUpdated, emitRobotDataUpdated, robotGameEvents, RobotGameEvent, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _class3, _crd, ccclass, property, RobotList;

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

  function _reportPossibleCrUseOfUILockManager(extras) {
    _reporterNs.report("UILockManager", "../global/UILockManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfemitBattleTeamUpdated(extras) {
    _reporterNs.report("emitBattleTeamUpdated", "../global/RobotGameEvents", _context.meta, extras);
  }

  function _reportPossibleCrUseOfemitRobotDataUpdated(extras) {
    _reporterNs.report("emitRobotDataUpdated", "../global/RobotGameEvents", _context.meta, extras);
  }

  function _reportPossibleCrUseOfrobotGameEvents(extras) {
    _reporterNs.report("robotGameEvents", "../global/RobotGameEvents", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRobotGameEvent(extras) {
    _reporterNs.report("RobotGameEvent", "../global/RobotGameEvents", _context.meta, extras);
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
      Label = _cc.Label;
      ScrollView = _cc.ScrollView;
      instantiate = _cc.instantiate;
      UITransform = _cc.UITransform;
      Color = _cc.Color;
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      DataCacheManager = _unresolved_4.DataCacheManager;
    }, function (_unresolved_5) {
      UILockManager = _unresolved_5.UILockManager;
    }, function (_unresolved_6) {
      emitBattleTeamUpdated = _unresolved_6.emitBattleTeamUpdated;
      emitRobotDataUpdated = _unresolved_6.emitRobotDataUpdated;
      robotGameEvents = _unresolved_6.robotGameEvents;
      RobotGameEvent = _unresolved_6.RobotGameEvent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "97585SY8WNLC5KPkwTlCrrx", "RobotList", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button', 'Label', 'ScrollView', 'instantiate', 'UITransform', 'Color', 'Sprite', 'SpriteAtlas', 'SpriteFrame']);

      ({
        ccclass,
        property
      } = _decorator);
      /** 机甲列表面板：成熟方案，单入口加载、request 串行、按钮统一 Button.CLICK、行级 Set 面板 */

      _export("RobotList", RobotList = (_dec = ccclass('RobotList'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(Node), _dec5 = property(Node), _dec6 = property(ScrollView), _dec7 = property(Node), _dec8 = property({
        type: SpriteFrame
      }), _dec9 = property({
        type: SpriteFrame
      }), _dec10 = property({
        type: SpriteFrame
      }), _dec(_class = (_class2 = (_class3 = class RobotList extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "backButton", _descriptor, this);

          _initializerDefineProperty(this, "confirmButton", _descriptor2, this);

          _initializerDefineProperty(this, "robotPanel", _descriptor3, this);

          _initializerDefineProperty(this, "robotListDataTemplate", _descriptor4, this);

          _initializerDefineProperty(this, "scrollView", _descriptor5, this);

          _initializerDefineProperty(this, "content", _descriptor6, this);

          this.ws = null;
          this.ITEM_HEIGHT = 46;
          this.ITEM_SPACING = 5;
          this.PAGE_SIZE = 50;
          this.MAX_BATTLE_TEAM = 1;
          this.listItems = [];
          this.currentPets = [];
          this.battleTeam = [];
          this.battleTeamVersion = 0;

          /** 已从服务端拿到过 team_version 后才随 set_battle_team 发送，避免默认 0 触发 TEAM_VERSION_MISMATCH */
          this._battleTeamVersionSeeded = false;

          /** 版本冲突后仅自动重拉并重试一次 */
          this._setBattleTeamVersionRetryPending = false;

          /** 单次用户操作内：409 后只自动重试一轮 set_battle_team */
          this._didRetrySetBattleTeamAfterVersionMismatch = false;
          this.selectedIndex = -1;
          this.selectedPet = null;
          this.selectedNode = null;
          this.bgColorMap = new Map();
          this.isLoading = false;

          /** 本轮加载是否已收到出战队伍，用于并行请求后“两者齐再渲染” */
          this._battleTeamReceived = false;

          /** 本轮加载是否已收到机甲列表（首页），用于并行请求后“两者齐再渲染” */
          this._petsReceived = false;
          this.isFromBag = false;
          this.openSetRow = null;
          this.confirmCb = null;
          this.cancelCb = null;

          // MechaClass 图标兜底 SpriteFrame（避免 spriteAtlas 帧名不匹配导致一直显示 gedou）
          _initializerDefineProperty(this, "mechaIconGedou", _descriptor7, this);

          _initializerDefineProperty(this, "mechaIconSheji", _descriptor8, this);

          _initializerDefineProperty(this, "mechaIconQuanneng", _descriptor9, this);

          this.itemClickHandlers = new Map();

          /** 修复点：确认/出战/放生防抖，避免高频点击重复请求 */
          this._confirming = false;
          this._submittingBattleTeam = false;
          this._releasing = false;

          /** 出战/下场入口防抖（毫秒），与 UILockManager 互补 */
          this._lastDeployClickMs = 0;

          /** 旧服未带 battle_team 时仅补拉一次 get_battle_team */
          this._fallbackBattleTeamRequested = false;

          /** 防抖：连续打开面板时合并为一轮网络请求 */
          this._debouncedNetworkLoad = () => {
            if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.tryLock('robot_list', 22000)) {
              this.isLoading = false;
              return;
            }

            this._fallbackBattleTeamRequested = false;
            this.requestPets(0);
          };

          /** 背包用道具 / 放生等成功后刷新列表（面板打开时） */
          this.onExternalRobotDataSignal = () => {
            var _this$node;

            if ((_this$node = this.node) != null && _this$node.active) {
              this.isLoading = false;
              this.loadBattleTeamThenPets(false);
            } else {
              this.forceRefresh();
            }
          };

          /**
           * 处理角色切换事件（清除内部状态）
           */
          this.onCharacterChanged = data => {
            if (data && data.reason === 'character_id_cleared') {
              console.log('🗑️ [RobotList] 检测到角色切换，清除内部状态'); // 清除所有内部状态

              this.currentPets = [];
              this.battleTeam = [];
              this.selectedIndex = -1;
              this.selectedPet = null;
              this.selectedNode = null;
              this.bgColorMap.clear();
              this.isLoading = false;
              this._battleTeamReceived = false;
              this._petsReceived = false;
              this.isFromBag = false;
              this.resetBattleTeamVersionState();
              this._didRetrySetBattleTeamAfterVersionMismatch = false; // 清空渲染

              if (this.node && this.node.active) {
                this.renderList([]);
              }

              (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
                error: Error()
              }), UILockManager) : UILockManager).instance.unlock('robot_list');
            }
          };
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
        }

        start() {
          this.ensureTemplate();
          this.bindBackAndConfirm();
          this.subscribeMessages();
          (_crd && robotGameEvents === void 0 ? (_reportPossibleCrUseOfrobotGameEvents({
            error: Error()
          }), robotGameEvents) : robotGameEvents).on((_crd && RobotGameEvent === void 0 ? (_reportPossibleCrUseOfRobotGameEvent({
            error: Error()
          }), RobotGameEvent) : RobotGameEvent).RobotDataUpdated, this.onExternalRobotDataSignal, this);
          (_crd && robotGameEvents === void 0 ? (_reportPossibleCrUseOfrobotGameEvents({
            error: Error()
          }), robotGameEvents) : robotGameEvents).on((_crd && RobotGameEvent === void 0 ? (_reportPossibleCrUseOfRobotGameEvent({
            error: Error()
          }), RobotGameEvent) : RobotGameEvent).BattleTeamUpdated, this.onExternalRobotDataSignal, this);
        }

        onDestroy() {
          var _this$backButton, _this$confirmButton;

          (_crd && robotGameEvents === void 0 ? (_reportPossibleCrUseOfrobotGameEvents({
            error: Error()
          }), robotGameEvents) : robotGameEvents).off((_crd && RobotGameEvent === void 0 ? (_reportPossibleCrUseOfRobotGameEvent({
            error: Error()
          }), RobotGameEvent) : RobotGameEvent).RobotDataUpdated, this.onExternalRobotDataSignal, this);
          (_crd && robotGameEvents === void 0 ? (_reportPossibleCrUseOfrobotGameEvents({
            error: Error()
          }), robotGameEvents) : robotGameEvents).off((_crd && RobotGameEvent === void 0 ? (_reportPossibleCrUseOfRobotGameEvent({
            error: Error()
          }), RobotGameEvent) : RobotGameEvent).BattleTeamUpdated, this.onExternalRobotDataSignal, this);
          this.unsubscribeMessages(); // 修复点：解绑 back/confirm 按钮，避免节点销毁后仍触发或内存泄漏

          if ((_this$backButton = this.backButton) != null && _this$backButton.isValid) {
            var _backBtn$node;

            var backBtn = this.backButton.getComponent(Button);

            if (backBtn != null && (_backBtn$node = backBtn.node) != null && _backBtn$node.isValid) {
              backBtn.node.off(Button.EventType.CLICK, this.onBack, this);
            }
          }

          if ((_this$confirmButton = this.confirmButton) != null && _this$confirmButton.isValid) {
            var _confirmBtn$node;

            var confirmBtn = this.confirmButton.getComponent(Button);

            if (confirmBtn != null && (_confirmBtn$node = confirmBtn.node) != null && _confirmBtn$node.isValid) {
              confirmBtn.node.off(Button.EventType.CLICK, this.onConfirm, this);
            }
          }
        }

        onEnable() {
          var _this$node2;

          // 仅当节点激活、列表为空且未在加载时补拉一次（避免与 show 重复触发）
          if ((_this$node2 = this.node) != null && _this$node2.active && this.currentPets.length === 0 && !this.isLoading) {
            this.loadBattleTeamThenPets(true);
          }
        }

        onDisable() {
          (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.unlock('robot_list');
          this.closeAllSetPanels();
          this.clearSelection();
          this.isFromBag = false;
        }

        ensureTemplate() {
          if (!this.robotListDataTemplate || !this.content) return;

          if (this.robotListDataTemplate.parent !== this.content) {
            this.robotListDataTemplate.removeFromParent();
            this.content.addChild(this.robotListDataTemplate);
          }
        }

        bindBackAndConfirm() {
          var _this$backButton2, _this$confirmButton2;

          var backBtn = (_this$backButton2 = this.backButton) == null ? void 0 : _this$backButton2.getComponent(Button);

          if (backBtn) {
            backBtn.node.off(Button.EventType.CLICK, this.onBack, this);
            backBtn.node.on(Button.EventType.CLICK, this.onBack, this);
            backBtn.interactable = true;
          }

          var confirmBtn = (_this$confirmButton2 = this.confirmButton) == null ? void 0 : _this$confirmButton2.getComponent(Button);

          if (confirmBtn) {
            confirmBtn.node.off(Button.EventType.CLICK, this.onConfirm, this);
            confirmBtn.node.on(Button.EventType.CLICK, this.onConfirm, this);
            confirmBtn.interactable = true;
            this.confirmButton.active = false;
          }
        }

        subscribeMessages() {
          if (!this.ws) return;
          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onPetsResponse, this);
          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_UPDATE, this.onPetsResponse, this);
          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_TEAM_UPDATE, this.onBattleTeamUpdate, this); // 关键修复：监听角色切换事件，清除内部状态

          this.ws.on('data_changed', this.onCharacterChanged, this);
        }

        unsubscribeMessages() {
          if (!this.ws) return;
          this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onPetsResponse, this);
          this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_UPDATE, this.onPetsResponse, this);
          this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_TEAM_UPDATE, this.onBattleTeamUpdate, this); // 关键修复：取消监听角色切换事件

          this.ws.off('data_changed', this.onCharacterChanged, this);
        }

        onBattleTeamUpdate(data) {
          var _ref, _data$battle_team, _data$data, _this$node3;

          if (!(data != null && data.success)) return;
          var raw = (_ref = (_data$battle_team = data.battle_team) != null ? _data$battle_team : (_data$data = data.data) == null ? void 0 : _data$data.battle_team) != null ? _ref : [];
          this.battleTeam = (Array.isArray(raw) ? raw : []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
          this.applyServerTeamVersion(data);
          if ((_this$node3 = this.node) != null && _this$node3.active && this.currentPets.length > 0) this.refreshListUI();
        }
        /** 唯一入口：打开并加载（优化：先显示缓存，再后台更新） */


        show(fromBag) {
          if (fromBag === void 0) {
            fromBag = false;
          }

          if (!this.node) return; // 修复点：非背包入口时清除 Bag 回调，避免从主菜单打开时误触发上次的 confirmCb（使用物品）

          if (!fromBag) this.clearCallbacks();else if (!this.confirmCb) this.clearCallbacks();
          this._confirming = false;
          this._submittingBattleTeam = false;
          this._releasing = false;
          this._didRetrySetBattleTeamAfterVersionMismatch = false;
          this.node.active = true;
          this.isFromBag = fromBag;
          if (this.robotListDataTemplate) this.robotListDataTemplate.active = true;
          this.updateConfirmVisibility();
          if (!this.ws) this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          if (!this.ws) return;
          this.ensureTemplate();
          this.clearAdditionalItems(); // 重置状态

          this.selectedIndex = -1;
          this.selectedPet = null;
          this.selectedNode = null;
          this.bgColorMap.clear();
          this.isLoading = false; // 关键修复：先加载 battleTeam，确保排序和滤镜正确
          // 即使有缓存数据，也要等 battleTeam 加载完成后再渲染，确保排序和滤镜正确

          this.loadBattleTeamThenPets(true); // 传入 true 表示需要等待 battleTeam 后再渲染缓存
        }
        /** 隐藏（reason 仅兼容旧调用，可忽略） */


        hide(_reason) {
          var _this$confirmButton3;

          if (!this.node) return;
          this.closeAllSetPanels();
          this.clearSelection();
          this.isFromBag = false;
          this._confirming = false;
          this._submittingBattleTeam = false;
          this._releasing = false;
          var confirmBtn = (_this$confirmButton3 = this.confirmButton) == null ? void 0 : _this$confirmButton3.getComponent(Button);
          if (confirmBtn) confirmBtn.interactable = true;
          this.setDeployReleaseButtonsInteractable(true);
          this.node.active = false;
        }

        setCallbacks(onConfirm, onCancel) {
          this.confirmCb = onConfirm;
          this.cancelCb = onCancel != null ? onCancel : null;
        }

        clearCallbacks() {
          this.confirmCb = null;
          this.cancelCb = null;
        }

        forceRefresh() {
          if (!this.ws) return; // 关键修复：即使节点未激活也允许刷新（为下次打开做准备）

          this.isLoading = false;
          this.currentPets = [];
          this.battleTeam = [];
          this.resetBattleTeamVersionState();
          this.loadBattleTeamThenPets();
        }

        getBattleTeam() {
          return [...this.battleTeam];
        }
        /** 背包选宠等：校验 petId 是否在当前已拉取的列表中（仅客户端提示，权威以服务端为准） */


        isPetInCurrentList(petId) {
          var n = this.normPetId(petId);
          if (!n) return false;
          return this.currentPets.some(p => {
            var _ref2, _ref3, _p$pet_id;

            return this.normPetId(String((_ref2 = (_ref3 = (_p$pet_id = p.pet_id) != null ? _p$pet_id : p._id) != null ? _ref3 : p.id) != null ? _ref2 : '')) === n;
          });
        }
        /**
         * 出战与列表都就绪时只渲染一次，避免「先错后对」和重复渲染。
         * 由 GET_BATTLE_TEAM 回调和 onPetsResponse 在收到数据后调用。
         */


        tryRenderIfReady() {
          var _this$node4;

          if (!this._battleTeamReceived || !this._petsReceived || !((_this$node4 = this.node) != null && _this$node4.active)) return;
          this.sortByBattleTeam();
          this.selectedIndex = -1;
          this.selectedPet = null;
          this.selectedNode = null;
          this.renderList(this.currentPets);
          this.isLoading = false;
          (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.unlock('robot_list');
        }

        loadBattleTeamThenPets(useCacheIfAvailable) {
          if (useCacheIfAvailable === void 0) {
            useCacheIfAvailable = false;
          }

          if (!this.ws) return;
          var cid = this.ws.getCharacterId();

          if (!cid) {
            var _this$node5;

            this.battleTeam = [];
            this._battleTeamReceived = true;
            this._petsReceived = true;
            this.currentPets = [];
            this.isLoading = false;
            if ((_this$node5 = this.node) != null && _this$node5.active) this.renderList([]);
            return;
          }

          if (this.isLoading) return;
          this.isLoading = true;
          this._battleTeamReceived = false;
          this._petsReceived = false;
          this.currentPets = [];
          var cache = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
            error: Error()
          }), DataCacheManager) : DataCacheManager).getInstance();
          var cachedData = cache.getRobotPetsCache(cid);
          var hasFullCache = useCacheIfAvailable && (cachedData == null ? void 0 : cachedData.pets) && Array.isArray(cachedData.pets) && cachedData.pets.length > 0 && Array.isArray(cachedData.battle_team);

          if (hasFullCache) {
            this.battleTeam = cachedData.battle_team.map(x => String(x).trim().toLowerCase()).filter(Boolean);
            this.currentPets = cachedData.pets;
            this.applyServerTeamVersion(cachedData);
            this._battleTeamReceived = true;
            this._petsReceived = true;
            this.tryRenderIfReady(); // 不 return：缓存里 battle_team 可能落后于服务端（出战/下场/战斗自动上场等），必须再拉一页对齐排序与出战滤镜
          }

          this.unschedule(this._debouncedNetworkLoad);
          this.scheduleOnce(this._debouncedNetworkLoad, 0.12);
        }

        requestPets(page) {
          if (page === void 0) {
            page = 0;
          }

          if (!this.ws) return;
          var cid = this.ws.getCharacterId();
          if (!cid) return; // 关键修复：即使 isLoading=true 也允许请求（show() 时已重置，但防止其他情况）
          // 使用 request 而不是 notify，确保响应匹配和超时处理

          this.isLoading = true;
          var req = {
            character_id: cid,
            page,
            page_size: this.PAGE_SIZE
          };
          var uid = this.ws.getUserId();
          if (uid) req.user_id = uid;
          var timeoutMs = 18000;

          var deliver = resp => {
            var cbs = RobotList._petsSfCallbacks.splice(0);

            RobotList._petsSfCid = null;

            for (var cb of cbs) {
              try {
                cb(resp);
              } catch (e) {
                console.error('[RobotList] onPetsResponse fan-out', e);
              }
            }
          };

          if (page === 0) {
            if (RobotList._petsSfCid === cid && RobotList._petsSfCallbacks.length > 0) {
              RobotList._petsSfCallbacks.push(resp => this.onPetsResponse(resp));

              return;
            }

            RobotList._petsSfCid = cid;
            RobotList._petsSfCallbacks = [resp => this.onPetsResponse(resp)];
            this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PETS, req, resp => deliver(resp), true, timeoutMs);
            return;
          }

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PETS, req, resp => this.onPetsResponse(resp), true, timeoutMs);
        }

        onPetsResponse(data) {
          var _data$data2, _data$battle_team2, _data$data3, _data$pagination, _data$data4, _pagination$page;

          var isUpdate = (data == null ? void 0 : data.type) === (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_UPDATE;

          if (isUpdate) {
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('robot_list');
            this.currentPets = [];
            this._petsReceived = false;
            this.requestPets(0);
            return;
          }

          var ok = (data == null ? void 0 : data.success) === true || (data == null ? void 0 : data.success) === 'true';

          if (!ok) {
            var _this$ws, _stale$pets, _this$node6, _this$node7;

            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('robot_list');
            this.isLoading = false;
            var cidFail = (_this$ws = this.ws) == null ? void 0 : _this$ws.getCharacterId();
            var stale = cidFail ? (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
              error: Error()
            }), DataCacheManager) : DataCacheManager).getInstance().getRobotPetsCache(cidFail) : null;

            if (stale != null && (_stale$pets = stale.pets) != null && _stale$pets.length && (_this$node6 = this.node) != null && _this$node6.active) {
              this.currentPets = stale.pets;
              this.applyServerTeamVersion(stale);

              if (Array.isArray(stale.battle_team)) {
                this.battleTeam = stale.battle_team.map(x => String(x).trim().toLowerCase()).filter(Boolean);
                this._battleTeamReceived = true;
              } else {
                this._battleTeamReceived = false;
              }

              this._petsReceived = true;

              if (!this._battleTeamReceived && this.ws && cidFail && !this._fallbackBattleTeamRequested) {
                this._fallbackBattleTeamRequested = true;
                this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_BATTLE_TEAM, {
                  character_id: cidFail
                }, resp => {
                  var _resp$data$battle_tea, _resp$data;

                  var raw = (_resp$data$battle_tea = resp == null || (_resp$data = resp.data) == null ? void 0 : _resp$data.battle_team) != null ? _resp$data$battle_tea : resp == null ? void 0 : resp.battle_team;
                  this.battleTeam = (Array.isArray(raw) ? raw : []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
                  this.applyServerTeamVersion(resp);
                  this._battleTeamReceived = true;
                  this.tryRenderIfReady();
                }, true, 6000);
              }

              this.tryRenderIfReady();
              return;
            }

            this.currentPets = [];
            this._petsReceived = true;
            this._battleTeamReceived = true;
            this.battleTeam = [];
            if ((_this$node7 = this.node) != null && _this$node7.active) this.renderList([]);
            return;
          }

          var pets = [];
          if (Array.isArray(data.pets)) pets = data.pets;else if (data != null && (_data$data2 = data.data) != null && _data$data2.pets) pets = data.data.pets; // 单一数据源：若响应携带 battle_team/team_version，则优先使用并标记已就绪

          var bt = (_data$battle_team2 = data.battle_team) != null ? _data$battle_team2 : (_data$data3 = data.data) == null ? void 0 : _data$data3.battle_team;

          if (Array.isArray(bt)) {
            this.battleTeam = bt.map(x => String(x).trim().toLowerCase()).filter(Boolean);
            this._battleTeamReceived = true;
          }

          this.applyServerTeamVersion(data);
          var pagination = (_data$pagination = data.pagination) != null ? _data$pagination : (_data$data4 = data.data) == null ? void 0 : _data$data4.pagination;
          var page = (_pagination$page = pagination == null ? void 0 : pagination.page) != null ? _pagination$page : 0;

          if (page === 0 && !Array.isArray(bt) && this.ws && !this._fallbackBattleTeamRequested) {
            this._fallbackBattleTeamRequested = true;
            var cid0 = this.ws.getCharacterId();

            if (cid0) {
              this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_BATTLE_TEAM, {
                character_id: cid0
              }, resp => {
                var _resp$data$battle_tea2, _resp$data2;

                var raw = (_resp$data$battle_tea2 = resp == null || (_resp$data2 = resp.data) == null ? void 0 : _resp$data2.battle_team) != null ? _resp$data$battle_tea2 : resp == null ? void 0 : resp.battle_team;
                this.battleTeam = (Array.isArray(raw) ? raw : []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
                this.applyServerTeamVersion(resp);
                this._battleTeamReceived = true;
                this.tryRenderIfReady();
              }, true, 6000);
            }
          }

          var hasMore = !!(pagination != null && pagination.has_more);

          if (page === 0) {
            this.currentPets = pets;
            this._petsReceived = true;
          } else {
            this.currentPets = [...this.currentPets, ...pets];
          }

          if (page === 0) {
            var _this$ws2;

            var cid = (_this$ws2 = this.ws) == null ? void 0 : _this$ws2.getCharacterId();

            if (cid) {
              var cache = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                error: Error()
              }), DataCacheManager) : DataCacheManager).getInstance();
              cache.setRobotPetsCache(cid, _extends({}, data, {
                battle_team: this.battleTeam
              }));
            }
          } // 统一经 tryRenderIfReady 渲染，只在出战+列表都就绪时渲染一次，避免首次“出战0个”


          this.tryRenderIfReady();

          if (hasMore && this.ws) {
            var _cid = this.ws.getCharacterId();

            if (_cid) {
              var req = {
                character_id: _cid,
                page: page + 1,
                page_size: this.PAGE_SIZE
              };
              var uid = this.ws.getUserId();
              if (uid) req.user_id = uid;
              this.requestPets(page + 1);
            }
          }
        }

        sortByBattleTeam() {
          var _this = this;

          if (!this.currentPets.length) return; // 关键修复：确保出战机甲排在前面，按出战顺序排序

          var inTeam = [];
          var rest = []; // 分离出战和非出战机甲（用规范化 id 比较，与 battleTeam 小写存储一致）

          var _loop = function _loop() {
            var _ref4, _ref5, _p$pet_id2;

            var id = _this.normPetId(String((_ref4 = (_ref5 = (_p$pet_id2 = p.pet_id) != null ? _p$pet_id2 : p._id) != null ? _ref5 : p.id) != null ? _ref4 : ''));

            var battleIndex = _this.battleTeam.findIndex(bid => _this.normPetId(bid) === id);

            if (battleIndex >= 0) {
              // 在出战队伍中，记录顺序
              inTeam.push({
                pet: p,
                order: battleIndex
              });
            } else {
              // 不在出战队伍中
              rest.push(p);
            }
          };

          for (var p of this.currentPets) {
            _loop();
          } // 按出战顺序排序（主战在前，副战在后）


          inTeam.sort((a, b) => a.order - b.order); // 关键修复：合并列表，出战机甲在前，其他在后

          this.currentPets = [...inTeam.map(item => item.pet), ...rest];
          console.log("[RobotList] \u6392\u5E8F\u5B8C\u6210: \u51FA\u6218" + inTeam.length + "\u4E2A, \u5176\u4ED6" + rest.length + "\u4E2A, \u51FA\u6218\u961F\u4F0D:", this.battleTeam);
        }

        refreshListUI() {
          var _ref6, _ref7, _this$selectedPet$pet;

          var sid = this.selectedPet ? this.normPetId(String((_ref6 = (_ref7 = (_this$selectedPet$pet = this.selectedPet.pet_id) != null ? _this$selectedPet$pet : this.selectedPet._id) != null ? _ref7 : this.selectedPet.id) != null ? _ref6 : '')) : '';
          this.sortByBattleTeam();
          this.bgColorMap.clear();
          this.renderList(this.currentPets);

          if (sid) {
            var idx = this.currentPets.findIndex(p => {
              var _ref8, _ref9, _p$pet_id3;

              return this.normPetId(String((_ref8 = (_ref9 = (_p$pet_id3 = p.pet_id) != null ? _p$pet_id3 : p._id) != null ? _ref9 : p.id) != null ? _ref8 : '')) === sid;
            });

            if (idx >= 0) {
              var node = idx === 0 ? this.robotListDataTemplate : idx > 0 && idx - 1 < this.listItems.length ? this.listItems[idx - 1] : null;
              if (node != null && node.isValid) this.onRowClick(node, idx);
            }
          }
        }

        renderList(pets) {
          if (!this.content || !this.robotListDataTemplate) return;
          this.clearSelection();
          this.closeAllSetPanels();

          if (pets.length === 0) {
            this.robotListDataTemplate.active = false;
            this.clearAdditionalItems();
            this.updateContentHeight(0);
            return;
          }

          this.ensureTemplate();
          var firstY = this.robotListDataTemplate.position.y;

          for (var i = 0; i < this.listItems.length; i++) {
            var n = this.listItems[i];

            if (n != null && n.isValid) {
              this.setRowSelection(n, false);
              this.closeSetForRow(n);
              n.active = false;
            }
          }

          for (var _i = 0; _i < pets.length; _i++) {
            var pet = pets[_i];
            var node = _i === 0 ? this.robotListDataTemplate : this.getOrCreateRow(_i, firstY);
            if (!node) continue;
            node.active = true;
            this.fillRow(node, pet, _i);
            this.setRowLayout(node, _i, firstY);
            this.bindRowClick(node, _i);
            this.bindSetAndActions(node, pet, _i); // 关键修复：先更新滤镜，再设置未选中状态（确保红色滤镜不被覆盖）

            this.updateRowBattleFilter(node, pet); // 先应用红色滤镜

            this.setRowSelection(node, false); // 再设置未选中状态（不会覆盖已应用的滤镜）

            this.updateSetVisibility(node);
            if (node.parent !== this.content) this.content.addChild(node);
          }

          var hideFrom = pets.length <= 1 ? 0 : pets.length - 1;

          for (var _i2 = hideFrom; _i2 < this.listItems.length; _i2++) {
            var _n = this.listItems[_i2];

            if (_n != null && _n.isValid) {
              this.setRowSelection(_n, false);
              this.closeSetForRow(_n);
              _n.active = false;
            }
          }

          this.updateContentHeight(pets.length, firstY);
          this.updateConfirmVisibility();
        }
        /** P1 性能：首行 template + listItems 复用，避免每次打开都全量 instantiate。 */


        getOrCreateRow(index, firstY) {
          var i = index - 1;

          if (i >= 0 && i < this.listItems.length && this.listItems[i].isValid) {
            return this.listItems[i];
          }

          if (!this.robotListDataTemplate) return null;
          var node = instantiate(this.robotListDataTemplate);
          var y = firstY - index * (this.ITEM_HEIGHT + this.ITEM_SPACING);
          node.setPosition(node.position.x, y, node.position.z);

          while (this.listItems.length <= i) this.listItems.push(null);

          this.listItems[i] = node;
          return node;
        }

        fillRow(node, pet, _index) {
          var _ref10, _ref11, _pet$pet_id, _ref12, _pet$Form, _pet$Level, _pet$Class;

          var id = String((_ref10 = (_ref11 = (_pet$pet_id = pet.pet_id) != null ? _pet$pet_id : pet._id) != null ? _ref11 : pet.id) != null ? _ref10 : '');
          var form = Number((_ref12 = (_pet$Form = pet.Form) != null ? _pet$Form : pet.Fo) != null ? _ref12 : 0);
          var name = (pet.RobotName || '') + (form === 1 ? '|初' : form === 2 ? '|中' : form === 3 ? '|终' : '');
          var level = String((_pet$Level = pet.Level) != null ? _pet$Level : 1);
          var cls = Number((_pet$Class = pet.Class) != null ? _pet$Class : 1); // MechaClass 图标键：兼容两种常见命名方式
          // 1) spriteAtlas 帧名通常是文件名不带扩展名：sheji/quanneng/gedou
          // 2) 自动图集/单图有时帧名包含扩展名：sheji.png/quanneng.png/gedou.png

          var iconKey = cls === 2 ? 'sheji' : cls === 3 ? 'quanneng' : 'gedou';
          var iconCandidates = [iconKey, iconKey + ".png"];
          var shouldDebug = _index < 5; // 只打印前几条，避免刷屏

          var nameN = this.findChild(node, 'Name') || this.findChild(node, 'T Name');

          if (nameN) {
            var l = nameN.getComponent(Label);
            if (l) l.string = name;
          }

          var lvN = this.findChild(node, 'LevelNumber') || this.findChild(node, 'T LevelNumber');

          if (lvN) {
            var _l = lvN.getComponent(Label);

            if (_l) _l.string = level;
          }

          var tagN = this.findChild(node, 'TeamTag');

          if (tagN) {
            var tl = tagN.getComponent(Label);

            if (tl) {
              var _ref13, _ref14, _pet$pet_id2;

              var pid = String((_ref13 = (_ref14 = (_pet$pet_id2 = pet.pet_id) != null ? _pet$pet_id2 : pet._id) != null ? _ref14 : pet.id) != null ? _ref13 : '');
              var inTeam = !!pid && this.battleTeam.some(bid => this.normPetId(bid) === this.normPetId(pid));
              tl.string = inTeam ? '出战' : '';
            }
          }

          var mcN = this.findChild(node, 'MechaClass');

          if (mcN) {
            var s = mcN.getComponent(Sprite);
            var atlas = s == null ? void 0 : s.spriteAtlas;
            var appliedFromAtlas = false;

            if (atlas) {
              var sf = null;
              var matchedName = null;

              for (var _name of iconCandidates) {
                var trySf = atlas.getSpriteFrame(_name);

                if (trySf) {
                  sf = trySf;
                  matchedName = _name;
                  break;
                }
              }

              if (sf) {
                s.spriteFrame = sf;
                appliedFromAtlas = true;

                if (shouldDebug) {
                  var _matchedName;

                  console.log("[RobotList][Icon] index=" + _index + " pet.Class=" + pet.Class + " cls=" + cls + " iconKey=" + iconKey + " matched=" + ((_matchedName = matchedName) != null ? _matchedName : 'unknown'));
                }
              } else {
                console.warn("[RobotList] MechaClass \u56FE\u6807\u5E27\u672A\u627E\u5230\uFF0Ccls=" + cls + ", candidates=" + iconCandidates.join(','), {
                  atlasFramesNotEnumerated: true
                });

                if (shouldDebug) {
                  console.log("[RobotList][Icon] index=" + _index + " pet.Class=" + pet.Class + " cls=" + cls + " iconKey=" + iconKey + " iconCandidates=" + iconCandidates.join(','));
                }
              }
            } // 兜底：atlas 没命中时，直接用外部拖拽的 SpriteFrame 替换，保证切换必然生效


            if (!appliedFromAtlas) {
              var fallback = null;
              if (cls === 2) fallback = this.mechaIconSheji;else if (cls === 3) fallback = this.mechaIconQuanneng;else fallback = this.mechaIconGedou;

              if (fallback) {
                s.spriteFrame = fallback;
              } else if (shouldDebug) {
                console.warn("[RobotList][Icon] fallback SpriteFrame \u4E3A\u7A7A\uFF1Acls=" + cls + ", mechaIconGedou=" + !!this.mechaIconGedou + ", mechaIconSheji=" + !!this.mechaIconSheji + ", mechaIconQuanneng=" + !!this.mechaIconQuanneng);
              }
            }
          }

          node._petId = id;
          node._pet = pet;
        }

        setRowLayout(node, index, firstY) {
          var y = firstY - index * (this.ITEM_HEIGHT + this.ITEM_SPACING);
          node.setPosition(node.position.x, y, node.position.z);
        }

        bindRowClick(node, index) {
          var btn = node.getComponent(Button);
          if (!btn) btn = node.addComponent(Button);
          if (!btn) return;
          btn.interactable = true;
          btn.transition = Button.Transition.NONE;
          var prev = this.itemClickHandlers.get(node);

          if (prev && typeof btn.node.off === 'function') {
            btn.node.off(Button.EventType.CLICK, prev, this);
          }

          var handler = () => this.onRowClick(node, index);

          this.itemClickHandlers.set(node, handler);
          btn.node.on(Button.EventType.CLICK, handler, this);
        }

        onRowClick(node, index) {
          var _this$currentPets$ind;

          this.clearSelection();
          this.selectedIndex = index;
          this.selectedNode = node;
          this.selectedPet = (_this$currentPets$ind = this.currentPets[index]) != null ? _this$currentPets$ind : null;
          this.setRowSelection(node, true);
          this.updateConfirmVisibility();
        }

        setRowSelection(node, selected) {
          var _bg$getComponent;

          var bg = this.findChild(node, 'BG1') || this.findChild(node, 'BG2') || this.findChild(node, 'BG') || this.findChild(node, 'Background');
          var sprite = (_bg$getComponent = bg == null ? void 0 : bg.getComponent(Sprite)) != null ? _bg$getComponent : node.getComponent(Sprite);
          if (!sprite) return;

          if (selected) {
            // 选中时：保存当前颜色（可能是红色滤镜或白色），然后应用黄色
            if (!this.bgColorMap.has(sprite.node)) {
              this.bgColorMap.set(sprite.node, sprite.color.clone());
            }

            sprite.color = new Color(255, 255, 100, 255); // 黄色选中效果
          } else {
            // 未选中时：恢复原始颜色（如果有保存），否则根据出战状态设置
            var orig = this.bgColorMap.get(sprite.node);

            if (orig) {
              sprite.color = orig;
              this.bgColorMap.delete(sprite.node);
            } else {
              // 关键修复：恢复时根据出战状态设置红色滤镜或白色
              var _petId = node._petId;
              var inTeam = !!_petId && this.battleTeam.some(bid => this.normPetId(bid) === this.normPetId(_petId));
              sprite.color = inTeam ? new Color(255, 100, 100, 255) : new Color(255, 255, 255, 255);
            }
          }
        }

        updateRowBattleFilter(node, pet) {
          var _ref15, _ref16, _pet$pet_id3, _bg$getComponent2;

          // 关键修复：如果当前行被选中，不覆盖选中效果（黄色优先）
          if (this.selectedNode === node) return;
          var id = this.normPetId(String((_ref15 = (_ref16 = (_pet$pet_id3 = pet.pet_id) != null ? _pet$pet_id3 : pet._id) != null ? _ref16 : pet.id) != null ? _ref15 : ''));
          var inTeam = this.battleTeam.some(bid => this.normPetId(bid) === id);
          var bg = this.findChild(node, 'BG1') || this.findChild(node, 'BG2') || this.findChild(node, 'BG') || this.findChild(node, 'Background');
          var sprite = (_bg$getComponent2 = bg == null ? void 0 : bg.getComponent(Sprite)) != null ? _bg$getComponent2 : node.getComponent(Sprite);
          if (!sprite) return; // 关键修复：强制应用红色滤镜（如果不在选中状态且没有保存选中颜色）
          // 只有在没有保存选中颜色时才更新（避免覆盖选中效果）

          if (!this.bgColorMap.has(sprite.node)) {
            var targetColor = inTeam ? new Color(255, 100, 100, 255) : new Color(255, 255, 255, 255);
            sprite.color = targetColor;
          }
        }

        updateSetVisibility(node) {
          var setN = this.findChild(node, 'Set');
          if (setN) setN.active = !this.isFromBag;
        }

        bindSetAndActions(node, pet, index) {
          var _ref17, _ref18, _pet$pet_id4;

          var setN = this.findChild(node, 'Set');
          if (!setN) return;
          var panel = this.findChild(setN, 'Button');
          if (!panel) return;
          panel.active = false; // 关键修复：确保使用正确的 petId（服务器返回的是 pet_id 字段，对应数据库的 _id）

          var petId = String((_ref17 = (_ref18 = (_pet$pet_id4 = pet.pet_id) != null ? _pet$pet_id4 : pet._id) != null ? _ref18 : pet.id) != null ? _ref17 : ''); // 将 pet 数据绑定到节点，方便后续使用

          node._pet = pet;
          node._petId = petId;
          var row = node;
          var setBtn = setN.getComponent(Button);
          if (!setBtn) setBtn = setN.addComponent(Button);

          if (setBtn) {
            setBtn.interactable = true;
            setBtn.transition = Button.Transition.NONE;
            setBtn.node.targetOff(this);
            setBtn.node.on(Button.EventType.CLICK, () => this.toggleSetPanel(row, setN, panel), this);
          }

          var viewN = this.findChild(panel, 'View');
          var deployN = this.findChild(panel, 'Deploy');
          var releaseN = this.findChild(panel, 'Release');
          var maskN = this.findChild(panel, 'MASK');

          for (var n of [viewN, deployN, releaseN]) {
            if (!n) continue;
            var b = n.getComponent(Button);

            if (b) {
              b.interactable = true;
              b.transition = Button.Transition.NONE;
              n.targetOff(this);
            }
          }

          if (viewN) {
            viewN.on(Button.EventType.CLICK, () => this.onView(petId, row, panel), this);
          }

          if (deployN) {
            this.updateDeployButtonLabel(deployN, petId);
            deployN.on(Button.EventType.CLICK, () => this.onDeploy(petId, row, panel), this);
          }

          if (releaseN) {
            releaseN.on(Button.EventType.CLICK, () => this.onRelease(petId, row, panel), this);
          }

          if (maskN) {
            maskN.targetOff(this);
            maskN.on(Node.EventType.TOUCH_END, () => this.closeSetForRow(row), this);
          }
        }

        toggleSetPanel(row, setN, panel) {
          this.clearSelection();
          this.closeAllSetPanelsExcept(row);
          var open = !!panel.active;
          panel.active = !open;

          if (panel.active) {
            this.openSetRow = row;
            var _petId2 = row._petId;
            var deployN = _petId2 ? this.findChild(panel, 'Deploy') : null;
            if (deployN && _petId2) this.updateDeployButtonLabel(deployN, _petId2);

            if (row.parent === this.content && this.content.children.length > 0) {
              row.setSiblingIndex(this.content.children.length - 1);
            }
          } else {
            if (this.openSetRow === row) this.openSetRow = null;
          }
        }

        closeSetForRow(row) {
          var setN = this.findChild(row, 'Set');
          if (!setN) return;
          var panel = this.findChild(setN, 'Button');
          if (panel) panel.active = false;
          if (this.openSetRow === row) this.openSetRow = null;
        }

        closeAllSetPanelsExcept(except) {
          if (this.robotListDataTemplate && this.robotListDataTemplate !== except) {
            this.closeSetForRow(this.robotListDataTemplate);
          }

          for (var n of this.listItems) {
            if (n != null && n.isValid && n !== except) this.closeSetForRow(n);
          }
        }

        closeAllSetPanels() {
          this.closeAllSetPanelsExcept(null);
        }

        onView(petId, row, panel) {
          this.clearSelection();
          this.closeSetForRow(row);
          var rp = this.robotPanel;

          if (rp) {
            var att = rp.getComponent('RobotAttributePanel');

            if (att != null && att.showSelectedRobot) {
              rp.active = true;
              att.showSelectedRobot(petId);
            }
          }

          this.hide();
        }
        /** 规范化 petId（小写、trim），与 battleTeam 存储格式一致，避免大小写导致“在队伍”判断错 */


        normPetId(id) {
          return String(id || '').trim().toLowerCase();
        }

        resetBattleTeamVersionState() {
          this.battleTeamVersion = 0;
          this._battleTeamVersionSeeded = false;
        }
        /** 从任意服务端 payload 根级或 data 内读取 team_version */


        applyServerTeamVersion(payload) {
          var _payload$team_version, _payload$data;

          if (!payload || typeof payload !== 'object') return;
          var tv = (_payload$team_version = payload.team_version) != null ? _payload$team_version : (_payload$data = payload.data) == null ? void 0 : _payload$data.team_version;
          if (tv === undefined || tv === null) return;
          var n = Number(tv);
          if (Number.isNaN(n)) return;
          this.battleTeamVersion = n;
          this._battleTeamVersionSeeded = true;
        }
        /** 修复点：请求中禁用/恢复所有行的出战、放生按钮，避免高频点击与视觉误导 */


        setDeployReleaseButtonsInteractable(enabled) {
          var _this$robotListDataTe;

          // 模板行也需要覆盖（否则第一行仍可点）
          if ((_this$robotListDataTe = this.robotListDataTemplate) != null && _this$robotListDataTe.isValid) {
            var row = this.robotListDataTemplate;
            var setN = this.findChild(row, 'Set');

            if (setN) {
              var panel = this.findChild(setN, 'Button');

              if (panel) {
                var deployN = this.findChild(panel, 'Deploy');
                var releaseN = this.findChild(panel, 'Release');
                var db = deployN == null ? void 0 : deployN.getComponent(Button);
                var rb = releaseN == null ? void 0 : releaseN.getComponent(Button);
                if (db) db.interactable = enabled;
                if (rb) rb.interactable = enabled;
              }
            }
          }

          for (var _row of this.listItems) {
            if (!(_row != null && _row.isValid)) continue;

            var _setN = this.findChild(_row, 'Set');

            if (!_setN) continue;

            var _panel = this.findChild(_setN, 'Button');

            if (!_panel) continue;

            var _deployN = this.findChild(_panel, 'Deploy');

            var _releaseN = this.findChild(_panel, 'Release');

            var _db = _deployN == null ? void 0 : _deployN.getComponent(Button);

            var _rb = _releaseN == null ? void 0 : _releaseN.getComponent(Button);

            if (_db) _db.interactable = enabled;
            if (_rb) _rb.interactable = enabled;
          }
        }
        /** 根据是否在出战队伍中更新 Deploy 按钮文字：出战 / 下场 */


        updateDeployButtonLabel(deployN, petId) {
          var n = this.normPetId(petId);
          var inTeam = this.battleTeam.some(bid => this.normPetId(bid) === n);
          var label = deployN.getComponentInChildren(Label);

          if (label) {
            label.string = inTeam ? '下场' : '出战';
          }
        }

        onDeploy(petId, row, panel) {
          var now = Date.now();
          if (now - this._lastDeployClickMs < 300) return;
          this._lastDeployClickMs = now;
          this.clearSelection();
          this.closeSetForRow(row); // 关键修复：优先使用节点绑定的 petId（确保是最新的、正确的）

          var finalPetId = row._petId || petId;
          var nodePet = row._pet;

          if (nodePet) {
            var _ref19, _ref20, _nodePet$pet_id;

            // 从 pet 数据中获取正确的 pet_id（服务器返回的 pet_id 对应数据库的 _id）
            var correctId = String((_ref19 = (_ref20 = (_nodePet$pet_id = nodePet.pet_id) != null ? _nodePet$pet_id : nodePet._id) != null ? _ref20 : nodePet.id) != null ? _ref19 : '');

            if (correctId && correctId.length === 24) {
              finalPetId = correctId;
              console.log("[RobotList] \u4F7F\u7528 petId: " + finalPetId + " (\u6765\u81EA\u8282\u70B9\u6570\u636E)");
            } else {
              console.warn("[RobotList] petId \u683C\u5F0F\u5F02\u5E38: " + correctId + ", \u4F7F\u7528\u4F20\u5165\u7684: " + petId);
            }
          } // 验证 petId 格式


          if (!finalPetId || finalPetId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(finalPetId)) {
            console.error("[RobotList] \u65E0\u6548\u7684 petId \u683C\u5F0F: " + finalPetId);
            return;
          } // 若已在出战队伍中，则下场：从队伍中移除并提交（用规范化 id 比较）


          var nid = this.normPetId(finalPetId);

          if (this.battleTeam.some(bid => this.normPetId(bid) === nid)) {
            var _next = this.battleTeam.filter(bid => this.normPetId(bid) !== nid);

            this.submitBattleTeam(_next);
            return;
          }

          var next = this.nextBattleTeam(finalPetId);
          console.log("[RobotList] \u51C6\u5907\u8BBE\u7F6E\u51FA\u6218\u961F\u4F0D\uFF0CpetId: " + finalPetId + ", \u5F53\u524D\u961F\u4F0D: " + this.battleTeam + ", \u65B0\u961F\u4F0D: " + next);
          this.submitBattleTeam(next);
        }
        /** 修复点：使用 normPetId 比较，避免大小写导致“已在队伍”误判 */


        nextBattleTeam(petId) {
          var cur = [...this.battleTeam];
          var nid = this.normPetId(petId);
          if (cur.some(bid => this.normPetId(bid) === nid)) return cur;
          if (cur.length < this.MAX_BATTLE_TEAM) return [petId, ...cur].slice(0, this.MAX_BATTLE_TEAM);
          return [petId, cur[0]].filter(Boolean).slice(0, this.MAX_BATTLE_TEAM);
        }

        submitBattleTeam(team) {
          var _this2 = this;

          if (this._submittingBattleTeam) return;
          if (!this.ws) return;
          var cid = this.ws.getCharacterId();
          if (!cid) return;

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('battle_team', 8500)) {
            return;
          }

          this._submittingBattleTeam = true;
          this.setDeployReleaseButtonsInteractable(false); // 下场导致空队伍时，直接提交空数组并刷新

          if (team.length === 0) {
            var emptyReq = {
              character_id: cid,
              battle_team: []
            };
            if (this._battleTeamVersionSeeded) emptyReq.team_version = this.battleTeamVersion;
            this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.SET_BATTLE_TEAM, emptyReq, r => {
              this._submittingBattleTeam = false;
              this.setDeployReleaseButtonsInteractable(true);
              (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
                error: Error()
              }), UILockManager) : UILockManager).instance.unlock('battle_team');

              if ((r == null ? void 0 : r.success) !== false) {
                this.battleTeam = [];
                this.applyServerTeamVersion(r);
                this._didRetrySetBattleTeamAfterVersionMismatch = false;
                this.mergeBattleTeamIntoCache(cid, []);
                this.refreshListUI();
                (_crd && emitBattleTeamUpdated === void 0 ? (_reportPossibleCrUseOfemitBattleTeamUpdated({
                  error: Error()
                }), emitBattleTeamUpdated) : emitBattleTeamUpdated)({
                  character_id: cid
                });
              } else {
                var _r$message;

                console.error('[RobotList] 设置出战队伍（空）失败:', (_r$message = r == null ? void 0 : r.message) != null ? _r$message : '未知错误', r);
                this.refreshListUI();
              }
            }, true, 8000);
            return;
          } // 关键修复：验证并规范化 petId（服务器期望 ObjectId 字符串，且必须属于当前角色）


          var normalizedTeam = [];

          var _loop2 = function _loop2() {
            var str = String(id).trim();

            if (!str || str.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(str)) {
              console.warn("[RobotList] \u8DF3\u8FC7\u65E0\u6548\u7684 petId \u683C\u5F0F: " + str);
              return 0; // continue
            } // 验证这个 petId 是否在当前机甲列表中（确保属于当前角色，用规范化 id 比较）


            var pet = _this2.currentPets.find(p => {
              var _ref25, _ref26, _p$pet_id6;

              var pid = _this2.normPetId(String((_ref25 = (_ref26 = (_p$pet_id6 = p.pet_id) != null ? _p$pet_id6 : p._id) != null ? _ref26 : p.id) != null ? _ref25 : ''));

              return pid === _this2.normPetId(str);
            });

            if (!pet) {
              console.warn("[RobotList] petId " + str + " \u4E0D\u5728\u5F53\u524D\u673A\u7532\u5217\u8868\u4E2D\uFF0C\u8DF3\u8FC7");
              return 0; // continue
            }

            normalizedTeam.push(str);
          },
              _ret;

          for (var id of team) {
            _ret = _loop2();
            if (_ret === 0) continue;
          }

          if (normalizedTeam.length === 0) {
            console.error('[RobotList] 没有有效的 petId 可以设置出战队伍');
            this._submittingBattleTeam = false;
            this.setDeployReleaseButtonsInteractable(true);
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('battle_team');
            return;
          } // 关键修复：验证所有 petId 都属于当前角色（用规范化 id 比较）


          var validPets = normalizedTeam.filter(pid => {
            var pn = this.normPetId(pid);
            var pet = this.currentPets.find(p => {
              var _ref21, _ref22, _p$pet_id4;

              return this.normPetId(String((_ref21 = (_ref22 = (_p$pet_id4 = p.pet_id) != null ? _p$pet_id4 : p._id) != null ? _ref22 : p.id) != null ? _ref21 : '')) === pn;
            });

            if (!pet) {
              console.warn("[RobotList] petId " + pid + " \u4E0D\u5728\u5F53\u524D\u673A\u7532\u5217\u8868\u4E2D");
              return false;
            } // 验证机甲是否属于当前角色（如果数据中有 character_id 字段）


            if (pet.character_id && pet.character_id !== cid) {
              console.warn("[RobotList] petId " + pid + " \u4E0D\u5C5E\u4E8E\u5F53\u524D\u89D2\u8272 " + cid + "\uFF0C\u5C5E\u4E8E " + pet.character_id);
              return false;
            }

            return true;
          });

          if (validPets.length === 0) {
            console.error('[RobotList] 没有有效的机甲可以设置出战队伍');
            this._submittingBattleTeam = false;
            this.setDeployReleaseButtonsInteractable(true);
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('battle_team');
            return;
          }

          if (validPets.length !== normalizedTeam.length) {
            console.warn("[RobotList] \u8FC7\u6EE4\u540E\u6709\u6548\u673A\u7532\u6570\u91CF: " + validPets.length + "/" + normalizedTeam.length);
          }

          console.log('[RobotList] 设置出战队伍:', validPets, '当前角色ID:', cid);
          console.log('[RobotList] 当前机甲列表 petIds:', this.currentPets.map(p => {
            var _ref23, _ref24, _p$pet_id5;

            return String((_ref23 = (_ref24 = (_p$pet_id5 = p.pet_id) != null ? _p$pet_id5 : p._id) != null ? _ref24 : p.id) != null ? _ref23 : '');
          }));
          var setReq = {
            character_id: cid,
            battle_team: validPets
          };
          if (this._battleTeamVersionSeeded) setReq.team_version = this.battleTeamVersion;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.SET_BATTLE_TEAM, setReq, r => {
            var _r$data$battle_team, _r$data, _r$message2;

            var raw = (_r$data$battle_team = r == null || (_r$data = r.data) == null ? void 0 : _r$data.battle_team) != null ? _r$data$battle_team : r == null ? void 0 : r.battle_team;

            if (r != null && r.success && Array.isArray(raw)) {
              this._submittingBattleTeam = false;
              this.setDeployReleaseButtonsInteractable(true);
              (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
                error: Error()
              }), UILockManager) : UILockManager).instance.unlock('battle_team');
              this.battleTeam = raw.map(x => String(x).trim().toLowerCase()).filter(Boolean);
              this.applyServerTeamVersion(r);
              this._didRetrySetBattleTeamAfterVersionMismatch = false;
              this.mergeBattleTeamIntoCache(cid, this.battleTeam);
              this.refreshListUI();
              (_crd && emitBattleTeamUpdated === void 0 ? (_reportPossibleCrUseOfemitBattleTeamUpdated({
                error: Error()
              }), emitBattleTeamUpdated) : emitBattleTeamUpdated)({
                character_id: cid
              });
              return;
            }

            var mismatch = (r == null ? void 0 : r.code) === 409 || (r == null ? void 0 : r.error_code) === 'TEAM_VERSION_MISMATCH' || typeof (r == null ? void 0 : r.message) === 'string' && r.message.includes('队伍版本');

            if (mismatch && this.ws && !this._setBattleTeamVersionRetryPending && !this._didRetrySetBattleTeamAfterVersionMismatch) {
              this._didRetrySetBattleTeamAfterVersionMismatch = true;
              this._setBattleTeamVersionRetryPending = true;
              this._submittingBattleTeam = false;
              this.setDeployReleaseButtonsInteractable(true);
              (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
                error: Error()
              }), UILockManager) : UILockManager).instance.unlock('battle_team');
              this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_BATTLE_TEAM, {
                character_id: cid
              }, resp => {
                var _resp$data$battle_tea3, _resp$data3;

                this._setBattleTeamVersionRetryPending = false;

                if ((resp == null ? void 0 : resp.success) === false) {
                  var _resp$message;

                  this._didRetrySetBattleTeamAfterVersionMismatch = false;
                  console.error('[RobotList] 同步队伍版本失败:', (_resp$message = resp == null ? void 0 : resp.message) != null ? _resp$message : resp, resp);
                  this.refreshListUI();
                  return;
                }

                this.applyServerTeamVersion(resp);
                var btRaw = (_resp$data$battle_tea3 = resp == null || (_resp$data3 = resp.data) == null ? void 0 : _resp$data3.battle_team) != null ? _resp$data$battle_tea3 : resp == null ? void 0 : resp.battle_team;

                if (Array.isArray(btRaw)) {
                  this.battleTeam = btRaw.map(x => String(x).trim().toLowerCase()).filter(Boolean);
                }

                this.submitBattleTeam(validPets);
              }, true, 8000);
              return;
            }

            this._submittingBattleTeam = false;
            this.setDeployReleaseButtonsInteractable(true);
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('battle_team');
            console.error('[RobotList] 设置出战队伍失败:', (_r$message2 = r == null ? void 0 : r.message) != null ? _r$message2 : '未知错误', r);
            this.refreshListUI();
          }, true, 8000);
        }
        /** 将最新 battle_team 写回 DataCacheManager，避免返回列表时用旧缓存覆盖 */


        mergeBattleTeamIntoCache(cid, battleTeam) {
          try {
            var cache = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
              error: Error()
            }), DataCacheManager) : DataCacheManager).getInstance();
            var cur = cache.getRobotPetsCache(cid);
            var verPatch = this._battleTeamVersionSeeded ? {
              team_version: this.battleTeamVersion
            } : {};
            var next = cur && typeof cur === 'object' ? _extends({}, cur, {
              battle_team: battleTeam
            }, verPatch) : _extends({
              battle_team: battleTeam,
              pets: this.currentPets
            }, verPatch);
            cache.setRobotPetsCache(cid, next);
          } catch (_) {}
        }

        onRelease(petId, row, panel) {
          this.clearSelection();
          this.closeSetForRow(row);
          this.releasePet(petId);
        }

        releasePet(petId) {
          if (this._releasing) return;
          if (!this.ws) return;
          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('robot_release', 10500)) return;
          this._releasing = true;
          this.setDeployReleaseButtonsInteractable(false);
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_RELEASE_PET, {
            pet_id: petId,
            character_id: this.ws.getCharacterId()
          }, r => {
            var _r$message3;

            this._releasing = false;
            this.setDeployReleaseButtonsInteractable(true);
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('robot_release');

            if (r != null && r.success) {
              var _this$ws$getCharacter, _this$ws$getCharacter2;

              (_crd && emitRobotDataUpdated === void 0 ? (_reportPossibleCrUseOfemitRobotDataUpdated({
                error: Error()
              }), emitRobotDataUpdated) : emitRobotDataUpdated)({
                character_id: (_this$ws$getCharacter = this.ws.getCharacterId()) != null ? _this$ws$getCharacter : undefined
              });
              (_crd && emitBattleTeamUpdated === void 0 ? (_reportPossibleCrUseOfemitBattleTeamUpdated({
                error: Error()
              }), emitBattleTeamUpdated) : emitBattleTeamUpdated)({
                character_id: (_this$ws$getCharacter2 = this.ws.getCharacterId()) != null ? _this$ws$getCharacter2 : undefined
              });
              this.forceRefresh();
            } else console.error('[RobotList] 放生失败:', (_r$message3 = r == null ? void 0 : r.message) != null ? _r$message3 : '未知错误');
          }, true, 10000);
        }

        onBack() {
          if (this.openSetRow) {
            this.closeSetForRow(this.openSetRow);
            return;
          }

          if (this.cancelCb) this.cancelCb();
          this.hide();
        }

        onConfirm() {
          var _ref27, _ref28, _this$selectedPet$pet2;

          if (this._confirming) return;
          if (this.selectedIndex < 0 || !this.selectedPet) return;
          var petId = String((_ref27 = (_ref28 = (_this$selectedPet$pet2 = this.selectedPet.pet_id) != null ? _this$selectedPet$pet2 : this.selectedPet._id) != null ? _ref28 : this.selectedPet.id) != null ? _ref27 : '');

          if (this.confirmCb) {
            var _this$confirmButton4;

            this._confirming = true;
            var confirmBtn = (_this$confirmButton4 = this.confirmButton) == null ? void 0 : _this$confirmButton4.getComponent(Button);
            if (confirmBtn) confirmBtn.interactable = false;
            this.confirmCb(petId, this.selectedPet);
            return;
          }

          var rp = this.robotPanel;

          if (rp) {
            var att = rp.getComponent('RobotAttributePanel');

            if (att != null && att.showSelectedRobot) {
              rp.active = true;
              att.showSelectedRobot(petId);
            }
          }

          this.hide();
        }

        updateConfirmVisibility() {
          if (this.confirmButton) {
            this.confirmButton.active = this.selectedIndex >= 0 && this.selectedPet != null;
          }
        }

        clearSelection() {
          var _this$selectedNode;

          if ((_this$selectedNode = this.selectedNode) != null && _this$selectedNode.isValid) this.setRowSelection(this.selectedNode, false);
          this.selectedIndex = -1;
          this.selectedPet = null;
          this.selectedNode = null;
          this.bgColorMap.clear();
          this.updateConfirmVisibility();
        }

        clearAdditionalItems() {
          var _this$content;

          for (var n of this.listItems) {
            if (n != null && n.isValid) n.active = false;
          }

          var ui = (_this$content = this.content) == null ? void 0 : _this$content.getComponent(UITransform);
          if (ui) ui.setContentSize(ui.width, this.ITEM_HEIGHT);
          this.clearSelection();
        }

        updateContentHeight(count, firstY) {
          var _this$content2;

          if (firstY === void 0) {
            firstY = 0;
          }

          var ui = (_this$content2 = this.content) == null ? void 0 : _this$content2.getComponent(UITransform);
          if (!ui) return;

          if (count <= 0) {
            ui.setContentSize(ui.width, this.ITEM_HEIGHT);
            return;
          }

          var lastY = firstY - (count - 1) * (this.ITEM_HEIGHT + this.ITEM_SPACING);
          var h = Math.abs(lastY - firstY) + this.ITEM_HEIGHT;
          ui.setContentSize(ui.width, Math.max(h, ui.height));
        }

        findChild(p, name) {
          if (!p) return null;
          if (p.name === name) return p;

          for (var c of p.children) {
            var f = this.findChild(c, name);
            if (f) return f;
          }

          return null;
        }

      }, _class3._petsSfCid = null, _class3._petsSfCallbacks = [], _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "confirmButton", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "robotPanel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "robotListDataTemplate", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "scrollView", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "content", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "mechaIconGedou", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "mechaIconSheji", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "mechaIconQuanneng", [_dec10], {
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
//# sourceMappingURL=49088706646755664590675835143e5c695b4ac0.js.map