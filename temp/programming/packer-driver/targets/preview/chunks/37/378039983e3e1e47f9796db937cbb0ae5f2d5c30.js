System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5", "__unresolved_6", "__unresolved_7", "__unresolved_8", "__unresolved_9", "__unresolved_10", "__unresolved_11", "__unresolved_12", "__unresolved_13", "__unresolved_14"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, assetManager, BoxCollider2D, Button, Collider2D, Component, director, input, Input, instantiate, JsonAsset, KeyCode, Label, Node, Color, Sprite, SpriteFrame, UITransform, v3, PlayerGridMove, BattleTriggerOnContact, ResourceManager, StoryUIViewRefs, WebSocketManager, normalizeBagItemsResponse, ownedItemIdsFromSnapshot, BattleScene, isBattleInteractAction, isChoiceBlockedMessage, promisifyWsRequest, shouldCompleteChoice, shouldStartBattleFromChoice, evaluateAppearRequirements, evaluateRequirements, buildLocalCompletePayload, clearLocalStoryPersist, loadLocalStoryPersist, localStoryStorageKey, saveLocalStoryPersist, sanitizeBattlePseudoChoicesInRuntime, decideNpcVisibility, isHiddenByMainlineStep, visibilityHiddenUntilReveal, isStaleMainlineGiver, parseEnemyGiverUid, logicalToParentLocal, mapContentBoundsInParentSpace, TILE_CELL, getNpcTaskStatusFrameUuids, npcTaskIndicatorKindToIndex, resolveNpcTaskIndicatorKind, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _class3, _crd, ccclass, property, executionOrder, PREFIX, StoryManager;

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

  function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function storyLog(level, message, context) {
    var tail = context && Object.keys(context).length ? " " + JSON.stringify(context) : '';
    var line = PREFIX + " " + message + tail;
    if (level === 'error') console.error(line);else if (level === 'warn') console.warn(line);else console.log(line);
  }
  /** 与 map JSON 对齐的格子像素（与 PlayerGridMove CELL 一致） */


  function normalizeDialogueScript(raw) {
    var _o$speaker;

    var o = raw != null ? raw : {};
    var speaker = String((_o$speaker = o.speaker) != null ? _o$speaker : '');
    var lines = [];

    if (Array.isArray(o.lines)) {
      lines = o.lines.map(x => String(x != null ? x : ''));
    } else if (typeof o.line === 'string' && o.line.length) {
      lines = [o.line];
    } else if (typeof o.text === 'string' && o.text.length) {
      lines = [o.text];
    }

    return {
      speaker,
      lines
    };
  }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./GameArea/PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleTriggerOnContact(extras) {
    _reporterNs.report("BattleTriggerOnContact", "./GameArea/BattleTriggerOnContact", _context.meta, extras);
  }

  function _reportPossibleCrUseOfResourceManager(extras) {
    _reporterNs.report("ResourceManager", "./ResourceManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryUIViewRefs(extras) {
    _reporterNs.report("StoryUIViewRefs", "./StoryUIViewRefs", _context.meta, extras);
  }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfnormalizeBagItemsResponse(extras) {
    _reporterNs.report("normalizeBagItemsResponse", "../global/protocol/BagProtocol", _context.meta, extras);
  }

  function _reportPossibleCrUseOfownedItemIdsFromSnapshot(extras) {
    _reporterNs.report("ownedItemIdsFromSnapshot", "../global/protocol/BagProtocol", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleScene(extras) {
    _reporterNs.report("BattleScene", "./BattleScene", _context.meta, extras);
  }

  function _reportPossibleCrUseOfisBattleInteractAction(extras) {
    _reporterNs.report("isBattleInteractAction", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfisChoiceBlockedMessage(extras) {
    _reporterNs.report("isChoiceBlockedMessage", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfpromisifyWsRequest(extras) {
    _reporterNs.report("promisifyWsRequest", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfshouldCompleteChoice(extras) {
    _reporterNs.report("shouldCompleteChoice", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfshouldStartBattleFromChoice(extras) {
    _reporterNs.report("shouldStartBattleFromChoice", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryInteractPayload(extras) {
    _reporterNs.report("StoryInteractPayload", "./story-event-flow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfevaluateAppearRequirements(extras) {
    _reporterNs.report("evaluateAppearRequirements", "./story-requirements", _context.meta, extras);
  }

  function _reportPossibleCrUseOfevaluateRequirements(extras) {
    _reporterNs.report("evaluateRequirements", "./story-requirements", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryRequirementContext(extras) {
    _reporterNs.report("StoryRequirementContext", "./story-requirements", _context.meta, extras);
  }

  function _reportPossibleCrUseOfbuildLocalCompletePayload(extras) {
    _reporterNs.report("buildLocalCompletePayload", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfclearLocalStoryPersist(extras) {
    _reporterNs.report("clearLocalStoryPersist", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfloadLocalStoryPersist(extras) {
    _reporterNs.report("loadLocalStoryPersist", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOflocalStoryStorageKey(extras) {
    _reporterNs.report("localStoryStorageKey", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfsaveLocalStoryPersist(extras) {
    _reporterNs.report("saveLocalStoryPersist", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfLocalStoryPersist(extras) {
    _reporterNs.report("LocalStoryPersist", "./story-local-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfsanitizeBattlePseudoChoicesInRuntime(extras) {
    _reporterNs.report("sanitizeBattlePseudoChoicesInRuntime", "./story-runtime-sanitize", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRuntimeMapLike(extras) {
    _reporterNs.report("RuntimeMapLike", "./story-runtime-sanitize", _context.meta, extras);
  }

  function _reportPossibleCrUseOfdecideNpcVisibility(extras) {
    _reporterNs.report("decideNpcVisibility", "./story-npc-visibility", _context.meta, extras);
  }

  function _reportPossibleCrUseOfisHiddenByMainlineStep(extras) {
    _reporterNs.report("isHiddenByMainlineStep", "./story-npc-visibility", _context.meta, extras);
  }

  function _reportPossibleCrUseOfvisibilityHiddenUntilReveal(extras) {
    _reporterNs.report("visibilityHiddenUntilReveal", "./story-npc-visibility", _context.meta, extras);
  }

  function _reportPossibleCrUseOfisStaleMainlineGiver(extras) {
    _reporterNs.report("isStaleMainlineGiver", "./story-npc-visibility", _context.meta, extras);
  }

  function _reportPossibleCrUseOfparseEnemyGiverUid(extras) {
    _reporterNs.report("parseEnemyGiverUid", "./story-npc-visibility", _context.meta, extras);
  }

  function _reportPossibleCrUseOflogicalToParentLocal(extras) {
    _reporterNs.report("logicalToParentLocal", "./tilemap-coords", _context.meta, extras);
  }

  function _reportPossibleCrUseOfmapContentBoundsInParentSpace(extras) {
    _reporterNs.report("mapContentBoundsInParentSpace", "./tilemap-coords", _context.meta, extras);
  }

  function _reportPossibleCrUseOfTILE_CELL(extras) {
    _reporterNs.report("TILE_CELL", "./tilemap-coords", _context.meta, extras);
  }

  function _reportPossibleCrUseOfgetNpcTaskStatusFrameUuids(extras) {
    _reporterNs.report("getNpcTaskStatusFrameUuids", "./npc-task-indicator", _context.meta, extras);
  }

  function _reportPossibleCrUseOfnpcTaskIndicatorKindToIndex(extras) {
    _reporterNs.report("npcTaskIndicatorKindToIndex", "./npc-task-indicator", _context.meta, extras);
  }

  function _reportPossibleCrUseOfresolveNpcTaskIndicatorKind(extras) {
    _reporterNs.report("resolveNpcTaskIndicatorKind", "./npc-task-indicator", _context.meta, extras);
  }

  function _reportPossibleCrUseOfNpcTaskIndicatorKind(extras) {
    _reporterNs.report("NpcTaskIndicatorKind", "./npc-task-indicator", _context.meta, extras);
  }

  _export("normalizeDialogueScript", normalizeDialogueScript);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      assetManager = _cc.assetManager;
      BoxCollider2D = _cc.BoxCollider2D;
      Button = _cc.Button;
      Collider2D = _cc.Collider2D;
      Component = _cc.Component;
      director = _cc.director;
      input = _cc.input;
      Input = _cc.Input;
      instantiate = _cc.instantiate;
      JsonAsset = _cc.JsonAsset;
      KeyCode = _cc.KeyCode;
      Label = _cc.Label;
      Node = _cc.Node;
      Color = _cc.Color;
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
      UITransform = _cc.UITransform;
      v3 = _cc.v3;
    }, function (_unresolved_2) {
      PlayerGridMove = _unresolved_2.PlayerGridMove;
    }, function (_unresolved_3) {
      BattleTriggerOnContact = _unresolved_3.BattleTriggerOnContact;
    }, function (_unresolved_4) {
      ResourceManager = _unresolved_4.ResourceManager;
    }, function (_unresolved_5) {
      StoryUIViewRefs = _unresolved_5.StoryUIViewRefs;
    }, function (_unresolved_6) {
      WebSocketManager = _unresolved_6.WebSocketManager;
    }, function (_unresolved_7) {
      normalizeBagItemsResponse = _unresolved_7.normalizeBagItemsResponse;
      ownedItemIdsFromSnapshot = _unresolved_7.ownedItemIdsFromSnapshot;
    }, function (_unresolved_8) {
      BattleScene = _unresolved_8.BattleScene;
    }, function (_unresolved_9) {
      isBattleInteractAction = _unresolved_9.isBattleInteractAction;
      isChoiceBlockedMessage = _unresolved_9.isChoiceBlockedMessage;
      promisifyWsRequest = _unresolved_9.promisifyWsRequest;
      shouldCompleteChoice = _unresolved_9.shouldCompleteChoice;
      shouldStartBattleFromChoice = _unresolved_9.shouldStartBattleFromChoice;
    }, function (_unresolved_10) {
      evaluateAppearRequirements = _unresolved_10.evaluateAppearRequirements;
      evaluateRequirements = _unresolved_10.evaluateRequirements;
    }, function (_unresolved_11) {
      buildLocalCompletePayload = _unresolved_11.buildLocalCompletePayload;
      clearLocalStoryPersist = _unresolved_11.clearLocalStoryPersist;
      loadLocalStoryPersist = _unresolved_11.loadLocalStoryPersist;
      localStoryStorageKey = _unresolved_11.localStoryStorageKey;
      saveLocalStoryPersist = _unresolved_11.saveLocalStoryPersist;
    }, function (_unresolved_12) {
      sanitizeBattlePseudoChoicesInRuntime = _unresolved_12.sanitizeBattlePseudoChoicesInRuntime;
    }, function (_unresolved_13) {
      decideNpcVisibility = _unresolved_13.decideNpcVisibility;
      isHiddenByMainlineStep = _unresolved_13.isHiddenByMainlineStep;
      visibilityHiddenUntilReveal = _unresolved_13.isNpcHiddenUntilReveal;
      isStaleMainlineGiver = _unresolved_13.isStaleMainlineGiver;
      parseEnemyGiverUid = _unresolved_13.parseEnemyGiverUid;
    }, function (_unresolved_14) {
      logicalToParentLocal = _unresolved_14.logicalToParentLocal;
      mapContentBoundsInParentSpace = _unresolved_14.mapContentBoundsInParentSpace;
      TILE_CELL = _unresolved_14.TILE_CELL;
    }, function (_unresolved_15) {
      getNpcTaskStatusFrameUuids = _unresolved_15.getNpcTaskStatusFrameUuids;
      npcTaskIndicatorKindToIndex = _unresolved_15.npcTaskIndicatorKindToIndex;
      resolveNpcTaskIndicatorKind = _unresolved_15.resolveNpcTaskIndicatorKind;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c3d8afxTitcnaGyPE1eb3CB", "StoryManager", undefined);
      /**
       * 剧情 UI：对白/选项在 StoryLayer；剧情反馈在 GameArea/Tips；ToastItem 专用于「按 E 交谈」等系统提示。
       *
       * 编辑器说明：若从 MapNpcInteract 迁移，请把本组件挂到 CanvasRoot(UI)，拖入 mapConfig，
       * 并从 NPC 节点移除旧 MapNpcInteract；场景里原组件槽位可复用同一 UUID（已由工程处理）。
       */


      __checkObsolete__(['_decorator', 'assetManager', 'BoxCollider2D', 'Button', 'Collider2D', 'Component', 'director', 'EventKeyboard', 'EventTouch', 'input', 'Input', 'instantiate', 'JsonAsset', 'KeyCode', 'Label', 'Node', 'Color', 'Sprite', 'SpriteFrame', 'UITransform', 'v3', 'Vec3']);

      ({
        ccclass,
        property,
        executionOrder
      } = _decorator);
      PREFIX = '[Story]';

      _export("StoryManager", StoryManager = (_dec = ccclass('StoryManager'), _dec2 = executionOrder(-50), _dec3 = property(JsonAsset), _dec4 = property({
        tooltip: '本地剧情模式（默认开启）：不请求 story_get_state / story_interact / story_event_complete；战斗仍走 WS 房间。接回服务端时取消勾选。'
      }), _dec5 = property({
        tooltip: '本地模式下每次进入场景从头跑主线（清 localStorage、不存档）。关则可跨次保留进度。'
      }), _dec6 = property({
        tooltip: '与 NPC 范围内触发交互的额外键（另固定支持 E、回车、空格）'
      }), _dec7 = property({
        tooltip: '该 NPC 在 map JSON 中的事件全部完成后隐藏节点（克隆体会销毁）'
      }), _dec8 = property({
        tooltip: 'true：按 map npcs 顺序（韩诺 0_lead_01 优先）每次只显示一名仍有未完成事件的 NPC；false：全部可同时出现。若子 NPC 挂在公共父节点下，父链会保持显示但仅当前节点启用碰撞体。'
      }), _dec9 = property({
        tooltip: '打印 [Story] 诊断日志'
      }), _dec10 = property({
        tooltip: '与 BattleTriggerOnContact 同节点时默认禁用战斗触发（对齐旧 MapNpcInteract）'
      }), _dec11 = property({
        tooltip: '保留兼容；交互提示已改为「在 NPC 碰撞箱内常驻」。若仍用旧版按间隔弹 Toast，可改代码恢复；当前逻辑不再读取本字段。'
      }), _dec12 = property({
        tooltip: '离开 NPC 碰撞范围时取消当前事件链激活（RMV 式）'
      }), _dec13 = property({
        tooltip: '剧情战开始前过渡提示时长（秒）'
      }), _dec14 = property({
        tooltip: '为每条 npc 配置在无法绑定已有节点时，从 WorldRoot/NPC 克隆'
      }), _dec15 = property({
        type: [SpriteFrame],
        tooltip: '非空时可为每个 NPC 节点随机一张立绘（Sprite 在本节点或子节点）'
      }), _dec16 = property({
        type: [SpriteFrame],
        tooltip: 'NPC 任务状态 1~4：橙!/橙?/灰?/灰!；留空则按内置 UUID 自动加载'
      }), _dec17 = property({
        tooltip: '为克隆 NPC 随机分配 randomNpcPortraitFrames 中的立绘'
      }), _dec18 = property({
        type: Node,
        tooltip: 'BattleScene 根节点（剧情战斗）'
      }), _dec19 = property({
        tooltip: '地图 code，与 JSON mapCode 一致'
      }), _dec(_class = _dec2(_class = (_class2 = (_class3 = class StoryManager extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mapConfig", _descriptor, this);

          _initializerDefineProperty(this, "skipServerRequirements", _descriptor2, this);

          _initializerDefineProperty(this, "resetLocalStoryOnEnter", _descriptor3, this);

          _initializerDefineProperty(this, "interactKey", _descriptor4, this);

          _initializerDefineProperty(this, "hideNpcWhenStoryComplete", _descriptor5, this);

          _initializerDefineProperty(this, "sequentialStoryNpcReveal", _descriptor6, this);

          _initializerDefineProperty(this, "debugLog", _descriptor7, this);

          _initializerDefineProperty(this, "letBattleTriggerHandleCombat", _descriptor8, this);

          _initializerDefineProperty(this, "interactDistanceFallbackPx", _descriptor9, this);

          _initializerDefineProperty(this, "interactReleaseHysteresisPx", _descriptor10, this);

          _initializerDefineProperty(this, "interactHintMinIntervalMs", _descriptor11, this);

          _initializerDefineProperty(this, "interactHintText", _descriptor12, this);

          _initializerDefineProperty(this, "cancelActivationOnLeaveRange", _descriptor13, this);

          _initializerDefineProperty(this, "battleTransitionDelaySec", _descriptor14, this);

          /** 坐标就近匹配：JSON (x,y) 像素到最近场景节点的最大误差（像素） */
          _initializerDefineProperty(this, "coordMatchMaxPx", _descriptor15, this);

          /** 无独立节点时，从场景模板（如 WorldRoot/NPC）复制一份并摆到 JSON 坐标 */
          _initializerDefineProperty(this, "spawnMissingNpcClones", _descriptor16, this);

          /** JSON 与模板无 mapRoot 换算时，用「相对 0_lead_01 的像素差」叠在模板位置上（coordinateSystem tiled_top_left） */
          _initializerDefineProperty(this, "spawnUseJsonDeltaFromLead", _descriptor17, this);

          /**
           * 本地测试：>0 时且无有效 JSON 坐标时，克隆 NPC 沿模板纵向堆叠；
           * 0 = 始终按 JSON 格心坐标摆放（与 Juben 地图埋点一致）。
           */
          _initializerDefineProperty(this, "testStackNpcGapTiles", _descriptor18, this);

          _initializerDefineProperty(this, "randomNpcPortraitFrames", _descriptor19, this);

          _initializerDefineProperty(this, "npcTaskStatusFrames", _descriptor20, this);

          _initializerDefineProperty(this, "randomizeNpcPortraits", _descriptor21, this);

          _initializerDefineProperty(this, "battleRoot", _descriptor22, this);

          _initializerDefineProperty(this, "mapCode", _descriptor23, this);

          this._refs = null;
          this._dialogueScripts = {};
          this._choiceScripts = {};
          this._npcRows = [];

          /** JSON 导出 mapWidth/mapHeight，与 TiledMap 不一致时用于诊断（运行时仍以 mapRoot UIT 为准） */
          this._jsonMapContentSize = null;
          this._resolved = [];

          /** 由 StoryManager 克隆的节点，onDestroy / 重新解析时销毁 */
          this._spawnedNpcRoots = [];

          /** 与 _resolveNpcs 中 ordered 一致，用于逐个显示 NPC */
          this._storyNpcOrder = [];
          this._playerMove = null;
          this._playerCollider = null;
          this._lastPlayerResolveAt = 0;
          this._playerTouchingNpcUid = null;

          /** 玩家在 NPC 碰撞箱内时显示 RMV 式交互提示（不再占用 Toast 队列） */
          this._interactHintPinned = false;
          this._lastOutOfRangeKeyLogAt = 0;
          this._localCompletedEventIds = new Set();
          this._serverCompletedEventIds = new Set();

          /** 仅战斗胜利后才写入；图标/下一环判定以此为准，避免逃跑后仍显示可提交 */
          this._battleClearedEventIds = new Set();

          /** 本客户端已确认战斗胜利的事件（与服务端 completed 对齐前也用于图标判定） */
          this._localBattleWonEventIds = new Set();

          /** 本地已接取任务（按 choiceId 过滤后的 task_accept） */
          this._acceptedTaskIds = new Set();
          this._storyStateLoaded = false;
          this._ws = null;
          this._activeTasks = [];
          this._tasksSnapshot = [];
          this._completedTaskIds = new Set();
          this._mainlineStep = 0;
          this._revealedNpcUids = new Set();
          this._spawnedNpcUids = new Set();
          this._toastQueue = [];
          this._toastPlaying = false;
          this._storyTipsQueue = [];
          this._storyTipsPlaying = false;
          this._activeChoicePick = null;
          this._activeChoiceOptions = [];
          this._startupSelfCheckDone = false;
          this._taskStatusFramesReady = false;
          this._taskStatusFramesLoading = false;
          this._lineIndex = 0;
          this._script = null;
          this._onDialogueEnd = null;
          this._nextBound = false;
          this._choiceHandlers = [];
          this._lastAdvanceWallMs = 0;

          /** 当前 NPC 接触会话：同一次接触内可手动按 E 衔接下一步，直到 endsSession */
          this._chainNpcUid = null;

          /** 下一步 requiresApproach 时，须离开再靠近后才允许触发 */
          this._npcApproachOk = true;
          this._eventFlowRunning = false;

          /** RMV 式一次确认激活：同次按键会话内自动续跑 NPC 事件链 */
          this._activationNpcUid = null;
          this._activationPausedForBattle = false;
          this._playerLevel = 0;
          this._ownedItemIds = new Set();
          this._lastInteractTriggerAt = 0;
          this._choiceHighlightIndex = 0;
          this._dynamicChoiceNodes = [];
          this._npcTouchUnbinders = [];
          this._flowWaitingVisible = false;
          this._taskDefs = [];
          this._tmpV3 = v3();
          this._tmpWorld = v3();
          this._tmpLp = v3();

          this._onCharacterSelected = data => {
            if (!(data != null && data.success)) return;

            if (this.skipServerRequirements) {
              if (!this._storyStateLoaded) {
                this._loadLocalStoryState();
              }

              return;
            }

            this._resetStoryRuntimeState();

            this.scheduleOnce(() => this._fetchStoryStateFromServer(), 0.15);
          };

          this._onWsDataChanged = payload => {
            var _payload$reason;

            var reason = (_payload$reason = payload == null ? void 0 : payload.reason) != null ? _payload$reason : '';

            if (reason === 'character_id_cleared') {
              this._resetStoryRuntimeState();
            }

            if (reason === 'bag_updated' || reason === 'inventory_changed') {
              this._refreshOwnedItemsFromWs();
            }
          };

          this._onPlayerInfoCache = data => {
            var _payload$level;

            if (!data) return;
            var payload = data.data && typeof data.data === 'object' ? data.data : data;
            var lvl = Number((_payload$level = payload.level) != null ? _payload$level : 0);
            if (Number.isFinite(lvl) && lvl > 0) this._playerLevel = lvl;
          };

          // --- 输入与事件 ---
          this._onKeyDown = e => {
            var _this$_refs, _this$_refs2;

            this._resolveRefs();

            if ((_this$_refs = this._refs) != null && (_this$_refs = _this$_refs.dialoguePanel) != null && _this$_refs.active) {
              if (this._isStoryInteractKey(e.keyCode)) {
                this._advanceFromUi('key');
              }

              return;
            }

            if ((_this$_refs2 = this._refs) != null && (_this$_refs2 = _this$_refs2.choiceModal) != null && _this$_refs2.active) {
              var n = this._activeChoiceOptions.length;

              if (e.keyCode === KeyCode.ARROW_UP || e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.DIGIT_8 || e.keyCode === KeyCode.NUM_8) {
                this._moveChoiceHighlight(-1);
              } else if (e.keyCode === KeyCode.ARROW_DOWN || e.keyCode === KeyCode.KEY_S) {
                this._moveChoiceHighlight(1);
              } else if (e.keyCode >= KeyCode.DIGIT_1 && e.keyCode <= KeyCode.DIGIT_6) {
                this._pickChoiceByIndex(e.keyCode - KeyCode.DIGIT_1);
              } else if (e.keyCode >= KeyCode.NUM_1 && e.keyCode <= KeyCode.NUM_6) {
                this._pickChoiceByIndex(e.keyCode - KeyCode.NUM_1);
              } else if (this._isStoryInteractKey(e.keyCode)) {
                this._pickChoiceByIndex(this._choiceHighlightIndex);
              }

              return;
            }

            if (!this._isStoryInteractKey(e.keyCode)) return;
            if (this._eventFlowRunning) return;
            if (this._activationNpcUid) return;
            var npcUid = this._playerTouchingNpcUid;

            if (!npcUid) {
              var now = Date.now();

              if (now - this._lastOutOfRangeKeyLogAt > 2000) {
                this._lastOutOfRangeKeyLogAt = now;

                var seqHint = this._getSequentialBlockHint();

                this.showToast(seqHint || '靠近 NPC 再交谈', 2000);
              }

              return;
            }

            this._tryTriggerActivation(npcUid);
          };

          this._hideToast = () => {
            var _this$_refs3;

            if ((_this$_refs3 = this._refs) != null && _this$_refs3.toastItem) this._refs.toastItem.active = false;
            this._toastPlaying = false;

            if (!this._interactHintPinned) {
              this._drainToastQueue();
            }
          };

          this._hideStoryTip = () => {
            var _this$_refs4;

            if ((_this$_refs4 = this._refs) != null && _this$_refs4.storyTipsPanel) this._refs.storyTipsPanel.active = false;
            this._storyTipsPlaying = false;

            this._drainStoryTipsQueue();
          };

          this._onNextClickBound = () => {
            this._advanceFromUi('click');
          };

          this._onNextTouchBound = e => {
            e.propagationStopped = true;

            this._advanceFromUi('touch');
          };
        }

        onLoad() {
          this._resolveRefs();

          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);

          this._parseMap();

          this._resolveLocalPlayerOnce();

          this._resolveNpcs();

          this._ensureTaskStatusFramesLoaded();

          if (this.debugLog) {
            var _this$node, _this$mapConfig;

            storyLog('info', 'StoryManager.onLoad', {
              host: (_this$node = this.node) == null ? void 0 : _this$node.name,
              npcResolved: this._resolved.length,
              hasMap: Boolean((_this$mapConfig = this.mapConfig) == null ? void 0 : _this$mapConfig.json)
            });
          }

          this._runStartupSelfCheck();
        }

        start() {
          this._resolveRefs();

          this._resolveLocalPlayerOnce();

          this._resolveNpcs();

          var ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          ws == null || ws.on('select_character_response', this._onCharacterSelected, this);
          ws == null || ws.on('data_changed', this._onWsDataChanged, this);
          ws == null || ws.on('player_info', this._onPlayerInfoCache, this);
          ws == null || ws.on('player_info_response', this._onPlayerInfoCache, this);
          this.scheduleOnce(() => {
            this._resolveLocalPlayerOnce();

            this._resolveNpcs();

            if (this.skipServerRequirements) {
              this._loadLocalStoryState();
            } else {
              this._fetchStoryStateFromServer();
            }
          }, 0);
        }

        _refreshOwnedItemsFromWs() {
          var ws = this._ws || (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          if (!(ws != null && ws.getCharacterId != null && ws.getCharacterId())) return;
          ws.request('bag_get', {
            page: 1,
            page_size: 200
          }, resp => {
            var snapshot = (_crd && normalizeBagItemsResponse === void 0 ? (_reportPossibleCrUseOfnormalizeBagItemsResponse({
              error: Error()
            }), normalizeBagItemsResponse) : normalizeBagItemsResponse)(resp);
            if (!snapshot.success) return;

            this._ownedItemIds.clear();

            for (var id of (_crd && ownedItemIdsFromSnapshot === void 0 ? (_reportPossibleCrUseOfownedItemIdsFromSnapshot({
              error: Error()
            }), ownedItemIdsFromSnapshot) : ownedItemIdsFromSnapshot)(snapshot)) {
              this._ownedItemIds.add(id);
            }

            this._refreshNpcVisibility();

            this._syncNpcTaskIndicators();
          });
        }
        /** 选角 / 切角后清空本地剧情缓存，等待 story_get_state 重新拉取 */


        _resetStoryRuntimeState() {
          this._localCompletedEventIds.clear();

          this._serverCompletedEventIds.clear();

          this._battleClearedEventIds.clear();

          this._localBattleWonEventIds.clear();

          this._acceptedTaskIds.clear();

          this._completedTaskIds.clear();

          this._activeTasks = [];
          this._tasksSnapshot = [];
          this._mainlineStep = 0;

          this._revealedNpcUids.clear();

          this._spawnedNpcUids.clear();

          this._storyStateLoaded = false;

          this._endActivation();

          this._refreshNpcVisibility();

          if (this.debugLog) storyLog('info', 'StoryManager: 剧情状态已重置（等待服务端同步）', {});
        }
        /** 供 TaskTracker 读取 */


        getStoryTaskSnapshot() {
          var tasks = this._tasksSnapshot.length ? this._tasksSnapshot.filter(t => t.status === 'accepted') : this._activeTasks;
          return {
            mainlineStep: this._mainlineStep,
            tasks: [...tasks]
          };
        }

        _syncProgressFromPayload(d) {
          var _this$node2;

          if (!this._alive()) return;
          var ids = d.completed_event_ids || [];
          this._serverCompletedEventIds = new Set(ids);

          this._localCompletedEventIds.clear();

          for (var id of ids) this._localCompletedEventIds.add(id);

          this._activeTasks = d.active_tasks || [];
          this._tasksSnapshot = d.tasks || [];
          this._mainlineStep = Number(d.mainline_step || 0);

          this._completedTaskIds.clear();

          var completed = d.completed_task_ids || [];

          for (var x of completed) this._completedTaskIds.add(Number(x));

          for (var t of this._tasksSnapshot) {
            if (!t) continue;

            if (t.status === 'completed' || t.status === 'Completed') {
              this._completedTaskIds.add(Number(t.taskId));
            }
          }

          this._revealedNpcUids.clear();

          for (var uid of d.revealed_npc_uids || []) {
            if (uid) this._revealedNpcUids.add(uid);
          }

          this._spawnedNpcUids.clear();

          for (var _uid of d.spawned_npc_uids || []) {
            if (_uid) this._spawnedNpcUids.add(_uid);
          }

          this._applyDynamicNpcsFromPayload(d);

          this._rebuildQuestPhaseFromState();

          this._refreshNpcVisibility();

          if ((_this$node2 = this.node) != null && _this$node2.isValid) {
            this.node.emit('story_state_updated', d);
          }
        }
        /** 组件仍挂载且可用（异步回调入口应优先检查） */


        _alive() {
          var _this$node3;

          return Boolean(this.isValid && ((_this$node3 = this.node) == null ? void 0 : _this$node3.isValid));
        }

        _applyDynamicNpcsFromPayload(d) {
          var dynamics = d.dynamic_npcs || [];

          for (var row of dynamics) {
            var uid = row.npcUid;
            if (!uid || this._spawnedNpcUids.has(uid)) continue;

            this._spawnDynamicNpcRow(row);
          }
        }

        _buildRequirementContext() {
          var activeTaskIds = new Set();

          for (var t of this._activeTasks) {
            var _t$taskId;

            var tid = Number((_t$taskId = t == null ? void 0 : t.taskId) != null ? _t$taskId : 0);
            if (tid > 0) activeTaskIds.add(tid);
          }

          return {
            completedEventIds: this._serverCompletedEventIds,
            battleClearedEventIds: this._battleClearedEventIds,
            completedTaskIds: this._completedTaskIds,
            acceptedTaskIds: this._acceptedTaskIds,
            activeTaskIds,
            mainlineStep: this._mainlineStep,
            playerLevel: this._playerLevel,
            ownedItemIds: this._ownedItemIds,
            isEventQuestStepComplete: eventId => this._isAppearEventDone(eventId),
            debugLog: this.debugLog,
            onUnknownRequirement: type => {
              if (this.debugLog) storyLog('warn', 'StoryManager: 未实现 requirement type，已跳过', {
                type
              });
            }
          };
        }

        _isNpcHiddenUntilReveal(npcUid) {
          var row = this._npcRows.find(r => r.npcUid === npcUid);

          return (_crd && visibilityHiddenUntilReveal === void 0 ? (_reportPossibleCrUseOfvisibilityHiddenUntilReveal({
            error: Error()
          }), visibilityHiddenUntilReveal) : visibilityHiddenUntilReveal)(npcUid, row, this._revealedNpcUids, this._buildRequirementContext());
        }

        _npcAppearRequirementsMet(row) {
          var appear = row.appear;
          if (!appear || appear.mode !== 'conditional') return (appear == null ? void 0 : appear.mode) === 'always';
          return (_crd && evaluateAppearRequirements === void 0 ? (_reportPossibleCrUseOfevaluateAppearRequirements({
            error: Error()
          }), evaluateAppearRequirements) : evaluateAppearRequirements)(appear.requirements, appear.matchMode, this._buildRequirementContext());
        }

        _singleRequirementMet(req) {
          return (_crd && evaluateRequirements === void 0 ? (_reportPossibleCrUseOfevaluateRequirements({
            error: Error()
          }), evaluateRequirements) : evaluateRequirements)([req], this._buildRequirementContext());
        }
        /** 地图战斗敌人（独立 runtime NPC，uid 形如 *_enemy / *_enemy_2） */


        _isBattleEnemyNpcUid(npcUid) {
          return npcUid.endsWith('_enemy') || /_enemy_\d+$/.test(npcUid);
        }

        _enemyGiverUid(npcUid) {
          return (_crd && parseEnemyGiverUid === void 0 ? (_reportPossibleCrUseOfparseEnemyGiverUid({
            error: Error()
          }), parseEnemyGiverUid) : parseEnemyGiverUid)(npcUid);
        }
        /** 该 NPC 是否仍有未完成剧情环（含「须先战斗」等暂不可交互的环） */


        _hasIncompleteStoryEvents(npcUid, events) {
          return events.some(ev => !this._isQuestStepComplete(npcUid, ev));
        }
        /** appear / 交付条件：地图无此 eventId 时，若所属 giver 链已全部完成则视为满足 */


        _isAppearEventDone(eventId) {
          var _row$events;

          if (!eventId) return true;
          if (this._isEventIdQuestStepComplete(eventId)) return true;
          if (this._findMapEventById(eventId)) return false;
          var m = eventId.match(/^(task_\d+)_e\d+$/);
          if (!m) return false;
          var giverUid = m[1];

          var row = this._npcRows.find(r => r.npcUid === giverUid);

          if (!(row != null && (_row$events = row.events) != null && _row$events.length)) return false;
          return row.events.every(ev => this._isQuestStepComplete(giverUid, ev));
        }

        _findMapEventById(eventId) {
          for (var row of this._npcRows) {
            var _row$npcUid;

            var uid = (_row$npcUid = row.npcUid) != null ? _row$npcUid : '';
            if (!uid) continue;

            for (var ev of (_row$events2 = row.events) != null ? _row$events2 : []) {
              var _row$events2;

              var cast = ev;

              if (this._stableEventId(uid, cast) === eventId || cast.eventId === eventId) {
                return {
                  npcUid: uid,
                  ev: cast
                };
              }
            }
          }

          return null;
        }
        /** giver 是否已完成至少一环 task_accept */


        _giverChainAccepted(giverUid, giverEvents) {
          for (var ev of giverEvents) {
            var _ev$server$effects, _ev$server;

            var hasAccept = ((_ev$server$effects = (_ev$server = ev.server) == null ? void 0 : _ev$server.effects) != null ? _ev$server$effects : []).some(raw => {
              var _action;

              return String((_action = raw.action) != null ? _action : '') === 'task_accept';
            });
            if (hasAccept && this._isQuestStepComplete(giverUid, ev)) return true;
          }

          return false;
        }

        _enemyBattleEventIds(npcUid, events) {
          var ids = new Set();

          for (var ev of events) {
            if (ev.eventType === 'battle') ids.add(this._stableEventId(npcUid, ev));
          }

          return ids;
        }
        /** 战斗敌人：所属任务官仍有未完成环且已接取时显现（不要求 pickInteract 非空） */


        _shouldShowBattleEnemy(npcUid, events, currentMainlineUid) {
          var _giverRow$events;

          var giverUid = this._enemyGiverUid(npcUid);

          if (!giverUid) return false;
          if (currentMainlineUid && giverUid !== currentMainlineUid) return false;
          if (!currentMainlineUid) return false;

          var giverRow = this._npcRows.find(r => r.npcUid === giverUid);

          var giverEvents = (_giverRow$events = giverRow == null ? void 0 : giverRow.events) != null ? _giverRow$events : [];
          if (!this._giverChainAccepted(giverUid, giverEvents)) return false;
          if (!this._hasIncompleteStoryEvents(giverUid, giverEvents)) return false;

          var row = this._npcRows.find(r => r.npcUid === npcUid);

          if (row && (_crd && visibilityHiddenUntilReveal === void 0 ? (_reportPossibleCrUseOfvisibilityHiddenUntilReveal({
            error: Error()
          }), visibilityHiddenUntilReveal) : visibilityHiddenUntilReveal)(npcUid, row, this._revealedNpcUids, this._buildRequirementContext())) {
            return false;
          }

          var battleIds = this._enemyBattleEventIds(npcUid, events);

          if (battleIds.size > 0 && [...battleIds].every(id => this._isAppearEventDone(id))) return false;
          return this._pickInteractEvent(npcUid, events) !== null;
        }
        /** 任务状态图标用：战斗环须胜利才算完成 */


        _evaluateRequirements(reqs) {
          return (_crd && evaluateRequirements === void 0 ? (_reportPossibleCrUseOfevaluateRequirements({
            error: Error()
          }), evaluateRequirements) : evaluateRequirements)(reqs, this._buildRequirementContext());
        }

        _hasTaskBeenAccepted(taskId) {
          if (this._acceptedTaskIds.has(taskId)) return true;
          return this._activeTasks.some(t => Number(t.taskId) === taskId);
        }
        /** 战斗须胜利；其余事件看 completed_event_ids */


        _isQuestStepComplete(npcUid, ev) {
          var eid = this._stableEventId(npcUid, ev);

          if (ev.eventType === 'battle') {
            return this._battleClearedEventIds.has(eid);
          }

          return this._isEventDone(eid);
        }

        _isEventIdQuestStepComplete(eventId) {
          if (!eventId) return true;

          for (var row of this._npcRows) {
            var _row$npcUid2;

            var uid = (_row$npcUid2 = row.npcUid) != null ? _row$npcUid2 : '';
            if (!uid) continue;

            for (var ev of (_row$events3 = row.events) != null ? _row$events3 : []) {
              var _row$events3;

              var cast = ev;

              var eid = this._stableEventId(uid, cast);

              if (eid !== eventId && cast.eventId !== eventId) continue;
              return this._isQuestStepComplete(uid, cast);
            }
          }

          var found = this._findMapEventById(eventId);

          if (found) {
            return this._isQuestStepComplete(found.npcUid, found.ev);
          }

          return this._isEventDone(eventId);
        }

        _eventIsTaskTurnIn(ev) {
          var _ev$server$effects2, _ev$server2;

          return ev.eventType === 'task' && ((_ev$server$effects2 = (_ev$server2 = ev.server) == null ? void 0 : _ev$server2.effects) != null ? _ev$server$effects2 : []).some(raw => {
            var _action2;

            return String((_action2 = raw.action) != null ? _action2 : '') === 'task_complete';
          });
        }
        /** 本 NPC 链段内是否仍有未胜利的战斗（含交付 requirements 与关联战斗敌人） */


        _hasOutstandingBattlesForChain(npcUid, events) {
          var _turnInEv$order, _turnInEv;

          var sorted = [...events].sort((a, b) => {
            var _a$order, _b$order;

            return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
          });
          var segmentStartOrder = 0;

          for (var ev of sorted) {
            if (this._eventIsTaskTurnIn(ev) && this._isQuestStepComplete(npcUid, ev)) {
              var _ev$order;

              segmentStartOrder = ((_ev$order = ev.order) != null ? _ev$order : 0) + 1;
            }
          }

          var turnInEv = null;

          for (var _ev of sorted) {
            var _ev$order2;

            if (((_ev$order2 = _ev.order) != null ? _ev$order2 : 0) < segmentStartOrder) continue;
            if (!this._eventIsTaskTurnIn(_ev)) continue;

            if (!this._isQuestStepComplete(npcUid, _ev)) {
              turnInEv = _ev;
              break;
            }
          }

          var battleEventIds = new Set();
          var segmentEndOrder = (_turnInEv$order = (_turnInEv = turnInEv) == null ? void 0 : _turnInEv.order) != null ? _turnInEv$order : Number.MAX_SAFE_INTEGER;

          for (var _ev2 of sorted) {
            var _ev2$order;

            var order = (_ev2$order = _ev2.order) != null ? _ev2$order : 0;
            if (order < segmentStartOrder || order >= segmentEndOrder) continue;

            if (_ev2.eventType === 'battle') {
              battleEventIds.add(this._stableEventId(npcUid, _ev2));
            }
          }

          if (turnInEv) {
            for (var req of (_turnInEv$server$requ = (_turnInEv$server = turnInEv.server) == null ? void 0 : _turnInEv$server.requirements) != null ? _turnInEv$server$requ : []) {
              var _turnInEv$server$requ, _turnInEv$server;

              var rec = req;

              if (rec.type === 'event_done' && rec.eventId) {
                battleEventIds.add(rec.eventId);
              }
            }
          }

          for (var row of this._npcRows) {
            var _row$npcUid3;

            var uid = (_row$npcUid3 = row.npcUid) != null ? _row$npcUid3 : '';
            if (!this._isBattleEnemyNpcUid(uid)) continue;
            if (this._enemyGiverUid(uid) !== npcUid) continue;

            for (var raw of (_row$events4 = row.events) != null ? _row$events4 : []) {
              var _row$events4;

              var _ev3 = raw;
              if (_ev3.eventType !== 'battle') continue;
              battleEventIds.add(this._stableEventId(uid, _ev3));
            }
          }

          for (var eid of battleEventIds) {
            var found = this._findMapEventById(eid);

            if (!found) continue;
            if (!this._isQuestStepComplete(found.npcUid, found.ev)) return true;
          }

          return false;
        }

        _recordTaskEffectsFromEvent(ev, choiceId) {
          for (var raw of (_ev$server$effects3 = (_ev$server3 = ev.server) == null ? void 0 : _ev$server3.effects) != null ? _ev$server$effects3 : []) {
            var _ev$server$effects3, _ev$server3, _eff$action, _eff$taskId, _eff$choiceId;

            var eff = raw;
            var action = String((_eff$action = eff.action) != null ? _eff$action : '');
            var tid = Number((_eff$taskId = eff.taskId) != null ? _eff$taskId : 0);
            if (!tid) continue;
            var effChoice = (_eff$choiceId = eff.choiceId) == null ? void 0 : _eff$choiceId.trim();
            if (effChoice && choiceId && effChoice !== choiceId) continue;
            if (action === 'task_accept') this._acceptedTaskIds.add(tid);
            if (action === 'task_complete') this._completedTaskIds.add(tid);
          }
        }
        /** 从已同步的 completed_event_ids / active_tasks 还原战斗胜利与接取 */


        _rebuildQuestPhaseFromState() {
          this._battleClearedEventIds.clear();

          this._localBattleWonEventIds.clear();

          this._acceptedTaskIds.clear();

          for (var t of this._activeTasks) {
            var _t$taskId2;

            var tid = Number((_t$taskId2 = t == null ? void 0 : t.taskId) != null ? _t$taskId2 : 0);
            if (tid > 0) this._acceptedTaskIds.add(tid);
          }

          for (var row of this._npcRows) {
            var _row$npcUid4;

            var uid = (_row$npcUid4 = row.npcUid) != null ? _row$npcUid4 : '';
            if (!uid || this._isBattleEnemyNpcUid(uid)) continue;

            for (var ev of (_row$events5 = row.events) != null ? _row$events5 : []) {
              var _row$events5;

              var cast = ev;

              var eid = this._stableEventId(uid, cast);

              for (var raw of (_cast$server$effects = (_cast$server = cast.server) == null ? void 0 : _cast$server.effects) != null ? _cast$server$effects : []) {
                var _cast$server$effects, _cast$server, _eff$action2, _eff$taskId2;

                var eff = raw;
                var action = String((_eff$action2 = eff.action) != null ? _eff$action2 : '');

                var _tid = Number((_eff$taskId2 = eff.taskId) != null ? _eff$taskId2 : 0);

                if (action === 'task_accept' && _tid > 0 && this._isEventDone(eid)) {
                  this._acceptedTaskIds.add(_tid);
                }
              }

              if (cast.eventType !== 'battle') continue;

              if (this._serverCompletedEventIds.has(eid) || this._localBattleWonEventIds.has(eid)) {
                this._battleClearedEventIds.add(eid);

                if (this._serverCompletedEventIds.has(eid)) {
                  this._localBattleWonEventIds.add(eid);
                }
              }
            }
          }

          this._syncNpcTaskIndicators();
        }

        _clearBattleProgress(npcUid, ev) {
          var eid = this._stableEventId(npcUid, ev);

          this._battleClearedEventIds.delete(eid);

          this._localBattleWonEventIds.delete(eid);

          this._localCompletedEventIds.delete(eid);
        }

        _resolveNpcTaskIndicatorKind(npcUid, events) {
          return (_crd && resolveNpcTaskIndicatorKind === void 0 ? (_reportPossibleCrUseOfresolveNpcTaskIndicatorKind({
            error: Error()
          }), resolveNpcTaskIndicatorKind) : resolveNpcTaskIndicatorKind)(npcUid, events, {
            stableEventId: (uid, ev) => this._stableEventId(uid, ev),
            isStepComplete: (uid, ev) => this._isQuestStepComplete(uid, ev),
            requirementsMet: reqs => this._evaluateRequirements(reqs),
            hasOutstandingBattlesForChain: (uid, evs) => this._hasOutstandingBattlesForChain(uid, evs),
            pickNextInteract: () => this._pickNextQuestStepForIndicator(npcUid, events)
          });
        }
        /** 任务图标：下一未完成环（战斗未胜利不算完成） */


        _pickNextQuestStepForIndicator(npcUid, events) {
          var sorted = [...events].sort((a, b) => {
            var _a$order2, _b$order2;

            return ((_a$order2 = a.order) != null ? _a$order2 : 0) - ((_b$order2 = b.order) != null ? _b$order2 : 0);
          });

          for (var ev of sorted) {
            var _ev$server4;

            if (this._isQuestStepComplete(npcUid, ev)) continue;
            var reqs = (_ev$server4 = ev.server) == null ? void 0 : _ev$server4.requirements;
            if (!this._evaluateRequirements(reqs)) return ev;
            return ev;
          }

          return null;
        }
        /** 头顶 Name：角色名（非任务链标题 / taskUiHint） */


        _resolveNpcHeadLabel(row, events) {
          var _row$characterName, _row$npcName;

          var skip = new Set(['系统', '对话', '']);
          var character = row == null || (_row$characterName = row.characterName) == null ? void 0 : _row$characterName.trim();
          if (character && !skip.has(character)) return character;

          for (var ev of events) {
            var _ev$client, _this$_dialogueScript;

            var dlgId = (_ev$client = ev.client) == null ? void 0 : _ev$client.dialogueScriptId;
            if (!dlgId) continue;
            var sp = (_this$_dialogueScript = this._dialogueScripts[dlgId]) == null || (_this$_dialogueScript = _this$_dialogueScript.speaker) == null ? void 0 : _this$_dialogueScript.trim();
            if (sp && !skip.has(sp)) return sp;
          }

          var fallback = row == null || (_row$npcName = row.npcName) == null ? void 0 : _row$npcName.trim();
          return fallback || (row == null ? void 0 : row.npcUid) || 'NPC';
        }

        _ensureTaskStatusFramesLoaded(onReady) {
          var _this = this;

          if (this.npcTaskStatusFrames.length >= 4) {
            this._taskStatusFramesReady = true;
            onReady == null || onReady();
            return;
          }

          if (this._taskStatusFramesReady) {
            onReady == null || onReady();
            return;
          }

          if (this._taskStatusFramesLoading) return;
          this._taskStatusFramesLoading = true;
          var uuids = (_crd && getNpcTaskStatusFrameUuids === void 0 ? (_reportPossibleCrUseOfgetNpcTaskStatusFrameUuids({
            error: Error()
          }), getNpcTaskStatusFrameUuids) : getNpcTaskStatusFrameUuids)();
          var pending = uuids.length;
          var frames = [];

          var _loop = function _loop(i) {
            assetManager.loadAny({
              uuid: uuids[i]
            }, (err, asset) => {
              pending--;

              if (!err && asset) {
                frames[i] = asset;
              }

              if (pending <= 0) {
                _this._taskStatusFramesLoading = false;

                if (frames.filter(Boolean).length >= 4) {
                  _this.npcTaskStatusFrames = frames;
                  _this._taskStatusFramesReady = true;
                }

                if (_this._alive()) onReady == null || onReady();
              }
            });
          };

          for (var i = 0; i < uuids.length; i++) {
            _loop(i);
          }
        }

        _applyTaskStatusSprite(statuNode, kind) {
          var _statuNode$getCompone;

          var sp = (_statuNode$getCompone = statuNode.getComponent(Sprite)) != null ? _statuNode$getCompone : statuNode.addComponent(Sprite);
          var ix = (_crd && npcTaskIndicatorKindToIndex === void 0 ? (_reportPossibleCrUseOfnpcTaskIndicatorKindToIndex({
            error: Error()
          }), npcTaskIndicatorKindToIndex) : npcTaskIndicatorKindToIndex)(kind);
          var sf = this.npcTaskStatusFrames[ix];
          if (sf) sp.spriteFrame = sf;
        }
        /** 同步 NPC 子节点 Name / Statu：有任务链时按状态显示，否则隐藏 */


        _syncNpcTaskIndicators() {
          var _this2 = this;

          var sync = () => {
            if (!this._alive()) return;

            var _loop2 = function _loop2(npcUid) {
              var _node$getChildByName, _node$getChildByName2, _row$events6;

              var nameNode = (_node$getChildByName = node == null ? void 0 : node.getChildByName('Name')) != null ? _node$getChildByName : null;
              var statuNode = (_node$getChildByName2 = node == null ? void 0 : node.getChildByName('Statu')) != null ? _node$getChildByName2 : null;
              if (!nameNode || !statuNode) return 0; // continue

              var row = _this2._npcRows.find(r => r.npcUid === npcUid);

              var chainEvents = events.length ? events : (_row$events6 = row == null ? void 0 : row.events) != null ? _row$events6 : [];
              var hasChain = chainEvents.length > 0;

              if (!hasChain || !(node != null && node.isValid) || !node.active || _this2._isNpcHiddenUntilReveal(npcUid)) {
                nameNode.active = false;
                statuNode.active = false;
                return 0; // continue
              } // 战斗敌人不显示任务图标（仅任务官显示）


              if (_this2._isBattleEnemyNpcUid(npcUid)) {
                nameNode.active = false;
                statuNode.active = false;
                return 0; // continue
              }

              var kind = _this2._resolveNpcTaskIndicatorKind(npcUid, chainEvents);

              if (_this2.debugLog && kind) {
                storyLog('info', 'StoryManager: NPC 任务图标', {
                  npcUid,
                  kind,
                  frameIndex: (_crd && npcTaskIndicatorKindToIndex === void 0 ? (_reportPossibleCrUseOfnpcTaskIndicatorKindToIndex({
                    error: Error()
                  }), npcTaskIndicatorKindToIndex) : npcTaskIndicatorKindToIndex)(kind)
                });
              }

              if (!kind) {
                nameNode.active = false;
                statuNode.active = false;
                return 0; // continue
              }

              var label = nameNode.getComponent(Label);

              if (label) {
                label.string = _this2._resolveNpcHeadLabel(row, chainEvents);
              }

              _this2._applyTaskStatusSprite(statuNode, kind);

              nameNode.active = true;
              statuNode.active = true;
            },
                _ret;

            for (var {
              npcUid,
              node,
              events
            } of this._resolved) {
              _ret = _loop2(npcUid);
              if (_ret === 0) continue;
            }
          };

          if (this.npcTaskStatusFrames.length >= 4 || this._taskStatusFramesReady) {
            sync();
            return;
          }

          this._ensureTaskStatusFramesLoaded(sync);
        }

        _runStartupSelfCheck() {
          var _this$mapConfig2;

          if (this._startupSelfCheckDone) return;
          this._startupSelfCheckDone = true;
          var issues = [];
          if (!((_this$mapConfig2 = this.mapConfig) != null && _this$mapConfig2.json)) issues.push('mapConfig');
          if (!this._refs) issues.push('StoryUIViewRefs');
          if (!this.battleRoot) issues.push('battleRoot');

          if (issues.length) {
            storyLog('error', 'StoryManager 启动自检失败', {
              issues
            });
            this.scheduleOnce(() => {
              this.showToast("\u5267\u60C5\u7CFB\u7EDF\u914D\u7F6E\u7F3A\u5931\uFF1A" + issues.join('、'), 5000);
            }, 0.5);
          }
        }

        _fetchStoryStateFromServer() {
          var _this$_ws;

          if (this.skipServerRequirements) return;
          this._ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          if (!((_this$_ws = this._ws) != null && _this$_ws.getCharacterId != null && _this$_ws.getCharacterId())) return;

          this._ws.request('story_get_state', {
            map_code: this.mapCode
          }, resp => {
            var _resp$data;

            if (!this._alive()) return;

            if (!(resp != null && resp.success)) {
              this.showToast('剧情状态同步失败，请重登后再试', 3200);
              return;
            }

            var d = (_resp$data = resp.data) != null ? _resp$data : resp;
            if (!d || typeof d !== 'object') return;

            this._syncProgressFromPayload(d);

            this._storyStateLoaded = true;

            this._refreshNpcVisibility();

            this._refreshOwnedItemsFromWs();
          }, true, 8000);
        }

        _localStoryStorageKey() {
          var _ws$getCharacterId;

          var ws = this._ws || (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          var cid = (_ws$getCharacterId = ws == null || ws.getCharacterId == null ? void 0 : ws.getCharacterId()) != null ? _ws$getCharacterId : null;
          return (_crd && localStoryStorageKey === void 0 ? (_reportPossibleCrUseOflocalStoryStorageKey({
            error: Error()
          }), localStoryStorageKey) : localStoryStorageKey)(this.mapCode, cid);
        }

        _loadLocalStoryState() {
          var _saved$completed_even, _saved$battle_cleared, _saved$revealed_npc_u, _saved$mainline_step, _saved$completed_task;

          if (!this.skipServerRequirements) return;

          if (this.resetLocalStoryOnEnter) {
            (_crd && clearLocalStoryPersist === void 0 ? (_reportPossibleCrUseOfclearLocalStoryPersist({
              error: Error()
            }), clearLocalStoryPersist) : clearLocalStoryPersist)(this._localStoryStorageKey());

            this._resetStoryRuntimeState();

            this._rebuildQuestPhaseFromState();

            this._storyStateLoaded = true;

            this._syncNpcTaskIndicators();

            if (this.debugLog) {
              storyLog('info', 'StoryManager: 本地剧情已重置（每次进入从头跑）', {
                mapCode: this.mapCode
              });
            }

            return;
          }

          var saved = (_crd && loadLocalStoryPersist === void 0 ? (_reportPossibleCrUseOfloadLocalStoryPersist({
            error: Error()
          }), loadLocalStoryPersist) : loadLocalStoryPersist)(this._localStoryStorageKey());

          if (!saved) {
            this._storyStateLoaded = true;
            return;
          }

          var completed = [...((_saved$completed_even = saved.completed_event_ids) != null ? _saved$completed_even : [])];
          var battleIds = (_saved$battle_cleared = saved.battle_cleared_event_ids) != null ? _saved$battle_cleared : [];

          for (var id of battleIds) {
            if (id && !completed.includes(id)) completed.push(id);
          }

          this._syncProgressFromPayload({
            completed_event_ids: completed,
            revealed_npc_uids: (_saved$revealed_npc_u = saved.revealed_npc_uids) != null ? _saved$revealed_npc_u : [],
            mainline_step: (_saved$mainline_step = saved.mainline_step) != null ? _saved$mainline_step : 0,
            completed_task_ids: (_saved$completed_task = saved.completed_task_ids) != null ? _saved$completed_task : []
          });

          this._acceptedTaskIds.clear();

          for (var tid of (_saved$accepted_task_ = saved.accepted_task_ids) != null ? _saved$accepted_task_ : []) {
            var _saved$accepted_task_;

            var n = Number(tid);
            if (n > 0) this._acceptedTaskIds.add(n);
          }

          this._battleClearedEventIds.clear();

          for (var _id of battleIds) {
            if (_id) this._battleClearedEventIds.add(_id);
          }

          this._rebuildQuestPhaseFromState();

          this._storyStateLoaded = true;

          if (this.debugLog) {
            storyLog('info', 'StoryManager: 已加载本地剧情进度', {
              mapCode: this.mapCode
            });
          }
        }

        _persistLocalStoryState() {
          if (!this.skipServerRequirements || this.resetLocalStoryOnEnter) return;
          var data = {
            completed_event_ids: [...this._localCompletedEventIds],
            battle_cleared_event_ids: [...this._battleClearedEventIds],
            accepted_task_ids: [...this._acceptedTaskIds],
            completed_task_ids: [...this._completedTaskIds],
            revealed_npc_uids: [...this._revealedNpcUids],
            mainline_step: this._mainlineStep
          };
          (_crd && saveLocalStoryPersist === void 0 ? (_reportPossibleCrUseOfsaveLocalStoryPersist({
            error: Error()
          }), saveLocalStoryPersist) : saveLocalStoryPersist)(this._localStoryStorageKey(), data);
        }
        /** 清除当前 map 本地剧情进度（调试 / 重开主线） */


        clearLocalStoryProgress() {
          if (!this.skipServerRequirements) return;
          (_crd && clearLocalStoryPersist === void 0 ? (_reportPossibleCrUseOfclearLocalStoryPersist({
            error: Error()
          }), clearLocalStoryPersist) : clearLocalStoryPersist)(this._localStoryStorageKey());

          this._resetStoryRuntimeState();

          if (this.debugLog) storyLog('info', 'StoryManager: 本地剧情进度已清除', {
            mapCode: this.mapCode
          });
        }

        _isEventDone(eventId) {
          return this._localCompletedEventIds.has(eventId) || this._serverCompletedEventIds.has(eventId);
        }

        _showFlowWaiting(show) {
          var _this$_refs5;

          if (show === this._flowWaitingVisible) return;
          this._flowWaitingVisible = show;

          this._resolveRefs();

          var panel = (_this$_refs5 = this._refs) == null ? void 0 : _this$_refs5.storyTipsPanel;
          if (!panel) return;

          if (show) {
            var _this$_refs$storyTips, _this$_refs6;

            var lab = this._label((_this$_refs$storyTips = (_this$_refs6 = this._refs) == null ? void 0 : _this$_refs6.storyTipsLabel) != null ? _this$_refs$storyTips : panel);

            if (lab) lab.string = '…';
            panel.active = true;
            this._storyTipsPlaying = true;
            this.unschedule(this._hideStoryTip);
          } else {
            panel.active = false;
            this._storyTipsPlaying = false;
          }
        }

        _promiseInteract(npcUid, ev, choiceId) {
          var _this3 = this;

          return _asyncToGenerator(function* () {
            if (_this3.skipServerRequirements) {
              var _ev$client2;

              var client = (_ev$client2 = ev.client) != null ? _ev$client2 : {};

              if (ev.eventType === 'battle' && client.choiceScriptId && !choiceId) {
                return {
                  action: 'choice_then_battle'
                };
              }

              return {
                action: ev.eventType
              };
            }

            _this3._showFlowWaiting(true);

            try {
              var ws = _this3._ws || (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance();

              var eventId = _this3._stableEventId(npcUid, ev);

              var resp = yield (_crd && promisifyWsRequest === void 0 ? (_reportPossibleCrUseOfpromisifyWsRequest({
                error: Error()
              }), promisifyWsRequest) : promisifyWsRequest)((route, payload, cb, useRid, timeout) => ws.request(route, payload, cb, useRid, timeout), 'story_interact', {
                map_code: _this3.mapCode,
                event_id: eventId,
                npc_uid: npcUid,
                choice_id: choiceId
              }, 8000);
              return resp.data || resp;
            } finally {
              _this3._showFlowWaiting(false);
            }
          })();
        }

        _promiseComplete(npcUid, ev, opts) {
          var _this4 = this;

          return _asyncToGenerator(function* () {
            if (_this4.skipServerRequirements) {
              if ((opts == null ? void 0 : opts.battleWon) === false) return {};
              var data = (_crd && buildLocalCompletePayload === void 0 ? (_reportPossibleCrUseOfbuildLocalCompletePayload({
                error: Error()
              }), buildLocalCompletePayload) : buildLocalCompletePayload)(ev, opts == null ? void 0 : opts.choiceId);

              _this4._applyEffectsFromResponse(data);

              _this4._persistLocalStoryState();

              return data;
            }

            var eventId = _this4._stableEventId(npcUid, ev);

            _this4._showFlowWaiting(true);

            try {
              var ws = _this4._ws || (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance();
              var resp = yield (_crd && promisifyWsRequest === void 0 ? (_reportPossibleCrUseOfpromisifyWsRequest({
                error: Error()
              }), promisifyWsRequest) : promisifyWsRequest)((route, payload, cb, useRid, timeout) => ws.request(route, payload, cb, useRid, timeout), 'story_event_complete', {
                map_code: _this4.mapCode,
                event_id: eventId,
                battle_won: (opts == null ? void 0 : opts.battleWon) !== false,
                choice_id: opts == null ? void 0 : opts.choiceId
              }, 10000);

              if ((_crd && isChoiceBlockedMessage === void 0 ? (_reportPossibleCrUseOfisChoiceBlockedMessage({
                error: Error()
              }), isChoiceBlockedMessage) : isChoiceBlockedMessage)(resp.message)) {
                _this4.showStoryTip('已暂缓，任务未推进。再次靠近按 E 或点击可继续。', 3200);

                _this4._endActivation();

                return {};
              }

              var d = resp.data || resp;

              _this4._syncProgressFromPayload(d);

              return d;
            } catch (err) {
              var msg = err instanceof Error ? err.message : '剧情同步失败';

              _this4.showToast(msg, 2800);

              throw err;
            } finally {
              _this4._showFlowWaiting(false);
            }
          })();
        }

        _promiseDialogue(script) {
          return new Promise(resolve => {
            this.startDialogue(script, () => resolve());
          });
        }

        _promiseChoice(choice) {
          return new Promise(resolve => {
            this.startChoice(choice, opt => resolve(opt));
          });
        }

        _promiseStoryBattle(npcUid, ev, choiceId, alreadyAuthorized) {
          if (alreadyAuthorized === void 0) {
            alreadyAuthorized = false;
          }

          return new Promise(resolve => {
            this._startStoryBattle(npcUid, ev, choiceId, alreadyAuthorized, won => resolve(won));
          });
        }

        _showChoiceFeedback(opt) {
          if (opt.npcReply) this.showStoryTip(opt.npcReply, 3500);
          if (opt.systemTip) this.showStoryTip(opt.systemTip, 3500);
        }

        _runEventFlow(npcUid, ev) {
          var _this5 = this;

          return _asyncToGenerator(function* () {
            var _ev$client3;

            if (_this5._eventFlowRunning) return;
            _this5._eventFlowRunning = true;
            var client = (_ev$client3 = ev.client) != null ? _ev$client3 : {};

            var eventId = _this5._stableEventId(npcUid, ev);

            var failFlow = () => {
              _this5.closeAll();

              _this5._endActivation();
            };

            try {
              var _ev$eventType;

              if ((_crd && isBattleInteractAction === void 0 ? (_reportPossibleCrUseOfisBattleInteractAction({
                error: Error()
              }), isBattleInteractAction) : isBattleInteractAction)(undefined, ev)) {
                _this5.showStoryTip('进入战斗…', 900);

                yield new Promise(r => {
                  _this5.scheduleOnce(() => r(), Math.max(0, _this5.battleTransitionDelaySec));
                });
                if (!_this5._alive()) return;
                var payload = yield _this5._promiseInteract(npcUid, ev);

                if (payload.action === 'choice_then_battle' && client.choiceScriptId) {
                  var ch = _this5._choiceScripts[client.choiceScriptId];

                  if (!ch) {
                    _this5.showToast('战前选项配置缺失', 3000);

                    failFlow();
                    return;
                  }

                  var _opt = yield _this5._promiseChoice(ch);

                  _this5._showChoiceFeedback(_opt);

                  if (!(_crd && shouldStartBattleFromChoice === void 0 ? (_reportPossibleCrUseOfshouldStartBattleFromChoice({
                    error: Error()
                  }), shouldStartBattleFromChoice) : shouldStartBattleFromChoice)(_opt, ev)) {
                    _this5._clearBattleProgress(npcUid, ev);

                    _this5._endActivation();

                    _this5._syncNpcTaskIndicators();

                    return;
                  }

                  _this5._activationPausedForBattle = true;
                  yield _this5._promiseInteract(npcUid, ev, _opt.id);

                  var _won = yield _this5._promiseStoryBattle(npcUid, ev, _opt.id, true);

                  if (!_won) return;

                  var _data = yield _this5._promiseComplete(npcUid, ev, {
                    battleWon: true
                  });

                  _this5._applyEffectsFromResponse(_data);

                  _this5._markEventDone(npcUid, ev, {});

                  return;
                }

                _this5._activationPausedForBattle = true;

                var _won2 = yield _this5._promiseStoryBattle(npcUid, ev, undefined, true);

                if (!_won2) return;
                var data = yield _this5._promiseComplete(npcUid, ev, {
                  battleWon: true
                });

                _this5._applyEffectsFromResponse(data);

                _this5._markEventDone(npcUid, ev, {});

                return;
              }

              var interactPayload = yield _this5._promiseInteract(npcUid, ev);

              if (ev.eventType === 'dialog' && client.dialogueScriptId) {
                var scr = _this5._dialogueScripts[client.dialogueScriptId];

                if (!scr) {
                  _this5.showToast('对白配置缺失', 3000);

                  failFlow();
                  return;
                }

                yield _this5._promiseDialogue(scr);

                var _data2 = yield _this5._promiseComplete(npcUid, ev, {});

                _this5._applyEffectsFromResponse(_data2);

                _this5._markEventDone(npcUid, ev, {});

                return;
              }

              var choiceScriptId = client.choiceScriptId || interactPayload.choice_script_id;

              if (choiceScriptId || ev.eventType === 'choice' || ev.eventType === 'teleport') {
                var sid = choiceScriptId || client.choiceScriptId;

                var _ch = sid ? _this5._choiceScripts[sid] : null;

                if (!_ch) {
                  _this5.showToast('选项配置缺失', 3000);

                  failFlow();
                  return;
                }

                var _opt2 = yield _this5._promiseChoice(_ch);

                _this5._showChoiceFeedback(_opt2);

                if (!(_crd && shouldCompleteChoice === void 0 ? (_reportPossibleCrUseOfshouldCompleteChoice({
                  error: Error()
                }), shouldCompleteChoice) : shouldCompleteChoice)(_opt2, ev)) {
                  if (!_opt2.npcReply && !_opt2.systemTip) {
                    _this5.showStoryTip('已暂缓，任务未推进。再次靠近按 E 或点击可继续。', 3200);
                  }

                  _this5._endNpcChainSession();

                  _this5._endActivation();

                  _this5._syncNpcTaskIndicators();

                  return;
                }

                var _data3 = yield _this5._promiseComplete(npcUid, ev, {
                  choiceId: _opt2.id
                });

                if (!_this5.skipServerRequirements && (!_data3 || Object.keys(_data3).length === 0)) return;

                _this5._applyEffectsFromResponse(_data3);

                _this5._markEventDone(npcUid, ev, {
                  choiceId: _opt2.id
                });

                return;
              }

              if (ev.eventType === 'task') {
                var _client$taskUiHint;

                var hint = (_client$taskUiHint = client.taskUiHint) == null ? void 0 : _client$taskUiHint.trim();

                if (hint && hint !== '节点') {
                  yield _this5._promiseDialogue({
                    speaker: '系统',
                    lines: [hint]
                  });
                }

                var _data4 = yield _this5._promiseComplete(npcUid, ev, {});

                _this5._applyEffectsFromResponse(_data4);

                _this5._markEventDone(npcUid, ev, {});

                return;
              }

              _this5.showToast("\u672A\u63A5\u5165\u7684 NPC \u4E8B\u4EF6: " + ((_ev$eventType = ev.eventType) != null ? _ev$eventType : 'unknown'), 3200);

              failFlow();
            } catch (_unused) {
              failFlow();
            } finally {
              _this5._eventFlowRunning = false;

              _this5._syncPlayerInputLock();
            }
          })();
        }

        _applyEffectsFromResponse(data) {
          var _this$node4;

          var applied = (data == null ? void 0 : data.applied_effects) || [];
          var rewardEmitted = false;

          for (var eff of applied) {
            var _eff$action3;

            var action = String((_eff$action3 = eff.action) != null ? _eff$action3 : '');

            if (action === 'reveal_npc') {
              var _eff$npcUid;

              this._revealNpc(String((_eff$npcUid = eff.npcUid) != null ? _eff$npcUid : ''));
            } else if (action === 'spawn_npc') {
              this._spawnNpcFromEffect(eff);
            } else if (action === 'task_accept') {
              var _eff$taskId3;

              var tid = Number((_eff$taskId3 = eff.taskId) != null ? _eff$taskId3 : 0);
              if (tid > 0) this._acceptedTaskIds.add(tid);

              var name = this._taskNameById(tid);

              this.showStoryTip(name ? "\u5DF2\u63A5\u53D6\u4EFB\u52A1\uFF1A" + name : '已接取新任务', 3200);
            } else if (action === 'task_complete') {
              var _eff$taskId4;

              var _tid2 = Number((_eff$taskId4 = eff.taskId) != null ? _eff$taskId4 : 0);

              var _name = this._taskNameById(_tid2);

              if (_tid2 > 0) {
                this._completedTaskIds.add(_tid2);

                this._acceptedTaskIds.delete(_tid2);
              }

              this.showStoryTip(_name ? "\u4EFB\u52A1\u5B8C\u6210\uFF1A" + _name : '任务已完成', 3200);
            } else if (action === 'give_item') {
              var _eff$itemId, _eff$count;

              var iid = Number((_eff$itemId = eff.itemId) != null ? _eff$itemId : 0);
              var cnt = Number((_eff$count = eff.count) != null ? _eff$count : 1);
              this.showStoryTip(iid ? "\u83B7\u5F97\u7269\u54C1 \xD7" + cnt : '获得物品', 2800);
              rewardEmitted = true;
            } else if (action === 'add_exp') {
              var _ref, _eff$value;

              var exp = Number((_ref = (_eff$value = eff.value) != null ? _eff$value : eff.exp) != null ? _ref : 0);
              this.showStoryTip(exp > 0 ? "\u83B7\u5F97\u7ECF\u9A8C +" + exp : '获得经验', 2800);
              rewardEmitted = true;
            } else if (action === 'send_mail') {
              this.showStoryTip('奖励已发送至邮箱', 2800);
              rewardEmitted = true;
            }
          }

          var tp = applied.find(e => e.action === 'teleport');
          if (tp) this._applyTeleport(tp);

          if (rewardEmitted && (_this$node4 = this.node) != null && _this$node4.isValid) {
            this.node.emit('story_reward_applied', applied);
          }

          var taskFx = applied.some(e => e.action === 'task_accept' || e.action === 'task_complete');

          if (taskFx) {
            this._syncNpcTaskIndicators();

            this._refreshNpcVisibility();
          }
        }

        _taskNameById(taskId) {
          var _fromDef$taskName;

          if (!taskId) return '';

          var fromSnap = this._tasksSnapshot.find(t => Number(t.taskId) === taskId);

          if (fromSnap != null && fromSnap.taskName) return fromSnap.taskName;

          var fromDef = this._taskDefs.find(t => Number(t.taskId) === taskId);

          return (fromDef == null || (_fromDef$taskName = fromDef.taskName) == null ? void 0 : _fromDef$taskName.trim()) || '';
        }

        _revealNpc(npcUid) {
          var _entry$node;

          if (!npcUid) return;

          this._revealedNpcUids.add(npcUid);

          var entry = this._resolved.find(r => r.npcUid === npcUid);

          if (entry != null && (_entry$node = entry.node) != null && _entry$node.isValid) {
            entry.node.active = true;
            var bc = entry.node.getComponent(BoxCollider2D);
            if (bc) bc.enabled = true;
          }

          this._refreshNpcVisibility();

          if (this.debugLog) storyLog('info', 'StoryManager: NPC 已显现', {
            npcUid
          });

          this._persistLocalStoryState();
        }

        _spawnNpcFromEffect(eff) {
          var _eff$npcUid2;

          var uid = String((_eff$npcUid2 = eff.npcUid) != null ? _eff$npcUid2 : '').trim();
          if (!uid) return;

          if (this._resolved.some(r => r.npcUid === uid)) {
            this._revealNpc(uid);

            return;
          }

          var row = {
            npcUid: uid,
            npcName: eff.npcName ? String(eff.npcName) : undefined,
            prefabKey: eff.prefabKey ? String(eff.prefabKey) : undefined,
            x: Number(eff.x),
            y: Number(eff.y),
            events: []
          };
          if (!Number.isFinite(row.x)) row.x = undefined;
          if (!Number.isFinite(row.y)) row.y = undefined;

          this._spawnDynamicNpcRow(row);
        }

        _spawnDynamicNpcRow(row) {
          var _ref2, _this$_npcRows$find, _row$events7;

          var uid = row.npcUid;
          if (!uid) return;
          var scene = director.getScene();
          if (!scene) return;

          var canvas = this._findNodeByName(scene, 'Canvas');

          var templateNpc = (_ref2 = canvas && this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC')) != null ? _ref2 : null;
          var refRow = (_this$_npcRows$find = this._npcRows.find(r => r.npcUid === '0_lead_01')) != null ? _this$_npcRows$find : this._npcRows[0];
          if (!(templateNpc != null && templateNpc.isValid)) return;
          var cloneStackSlot = this._spawnedNpcRoots.length + 1;

          var node = this._spawnNpcFromTemplate(scene, templateNpc, row, refRow, cloneStackSlot);

          if (!node) return;

          this._applyNpcPortraitFromRow(node, row);

          this._spawnedNpcUids.add(uid);

          if (!this._npcRows.some(r => r.npcUid === uid)) {
            this._npcRows.push(row);
          }

          if (!this._storyNpcOrder.includes(uid)) {
            this._storyNpcOrder.push(uid);
          }

          this._resolved.push({
            npcUid: uid,
            node,
            events: (_row$events7 = row.events) != null ? _row$events7 : []
          });

          this._bindNpcTouchHandlers();

          this._refreshNpcVisibility();

          if (this.debugLog) storyLog('info', 'StoryManager: 动态生成 NPC', {
            npcUid: uid
          });
        }

        _applyTeleport(tp) {
          var _tp$toMapId, _tp$toX, _tp$toY;

          var mapId = Number((_tp$toMapId = tp.toMapId) != null ? _tp$toMapId : 0);
          var x = Number((_tp$toX = tp.toX) != null ? _tp$toX : 0);
          var y = Number((_tp$toY = tp.toY) != null ? _tp$toY : 0);

          if (mapId === 1) {
            var _this$_playerMove;

            this._resolveLocalPlayerOnce();

            var node = (_this$_playerMove = this._playerMove) == null ? void 0 : _this$_playerMove.node;

            if (node != null && node.isValid) {
              node.setPosition(x, y, node.position.z);
              this.showStoryTip('已传送至指定地点', 2800);
            }
          } else {
            this.showStoryTip("\u6CD5\u897F\u57CE\uFF08\u5730\u56FE " + mapId + "\uFF09\u4F20\u9001\u5DF2\u767B\u8BB0\uFF0C\u8BE5\u5730\u56FE\u573A\u666F\u540E\u7EED\u63A5\u5165", 4500);
          }
        }
        /**
         * @param onFinished 战斗结束回调（剧情流 Promise 用）
         */


        _startStoryBattle(npcUid, ev, choiceId, alreadyAuthorized, _onFinished) {
          var _ev$server5;

          if (alreadyAuthorized === void 0) {
            alreadyAuthorized = false;
          }

          var eventId = this._stableEventId(npcUid, ev);

          var battleRef = ((_ev$server5 = ev.server) == null ? void 0 : _ev$server5.battleRef) || 'battle_300001';
          var root = this.battleRoot;
          var battle = root == null ? void 0 : root.getComponent(_crd && BattleScene === void 0 ? (_reportPossibleCrUseOfBattleScene({
            error: Error()
          }), BattleScene) : BattleScene);

          if (!battle) {
            this._activationPausedForBattle = false;
            this.showToast('未配置 BattleScene，无法进入剧情战', 3000);
            _onFinished == null || _onFinished(false);
            return;
          }

          var launchBattle = () => {
            this.closeAll();
            battle.startStoryBattle({
              mapCode: this.mapCode,
              eventId,
              battleRef,
              skipServerAuth: this.skipServerRequirements,
              onFinished: (won, errMsg) => {
                this._activationPausedForBattle = false;

                if (!won) {
                  this._clearBattleProgress(npcUid, ev);

                  this._endActivation();

                  this.showToast(errMsg || '战斗失败', 3200);

                  this._syncNpcTaskIndicators();

                  _onFinished == null || _onFinished(false);
                  return;
                }

                _onFinished == null || _onFinished(true);
              }
            });
          };

          if (this.skipServerRequirements || alreadyAuthorized) {
            launchBattle();
            return;
          }

          var ws = this._ws || (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          var eid = this._stableEventId(npcUid, ev);

          ws.request('story_interact', {
            map_code: this.mapCode,
            event_id: eid,
            npc_uid: npcUid,
            choice_id: choiceId
          }, resp => {
            if (!this._alive()) return;

            if (!(resp != null && resp.success)) {
              this._activationPausedForBattle = false;
              this.showToast((resp == null ? void 0 : resp.message) || '战斗未授权', 3200);

              this._endActivation();

              _onFinished == null || _onFinished(false);
              return;
            }

            launchBattle();
          }, true, 8000);
        }

        onDestroy() {
          var _this$_playerMove2;

          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
          var ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          ws == null || ws.off('select_character_response', this._onCharacterSelected, this);
          ws == null || ws.off('data_changed', this._onWsDataChanged, this);
          ws == null || ws.off('player_info', this._onPlayerInfoCache, this);
          ws == null || ws.off('player_info_response', this._onPlayerInfoCache, this);

          this._unbindNpcTouchHandlers();

          this._unbindNext();

          this._clearChoiceHandlers();

          this.unschedule(this._hideToast);
          (_this$_playerMove2 = this._playerMove) == null || _this$_playerMove2.setInputLocked(false);

          this._destroySpawnedNpcs();
        }

        update() {
          this._pollTouchOverlap();

          this._syncPlayerInputLock();
        }

        get isBlocking() {
          var _this$_refs$dialogueP, _this$_refs7, _this$_refs$choiceMod, _this$_refs8, _this$battleRoot$acti, _this$battleRoot;

          var d = (_this$_refs$dialogueP = (_this$_refs7 = this._refs) == null || (_this$_refs7 = _this$_refs7.dialoguePanel) == null ? void 0 : _this$_refs7.active) != null ? _this$_refs$dialogueP : false;
          var c = (_this$_refs$choiceMod = (_this$_refs8 = this._refs) == null || (_this$_refs8 = _this$_refs8.choiceModal) == null ? void 0 : _this$_refs8.active) != null ? _this$_refs$choiceMod : false;
          var battle = (_this$battleRoot$acti = (_this$battleRoot = this.battleRoot) == null ? void 0 : _this$battleRoot.active) != null ? _this$battleRoot$acti : false;
          return d || c || battle;
        }
        /** 对白/选项/剧情战/事件链激活中锁定玩家移动 */


        _shouldLockPlayerMovement() {
          return this.isBlocking || Boolean(this._activationNpcUid) || this._eventFlowRunning || this._flowWaitingVisible;
        }

        _syncPlayerInputLock() {
          var _this$_playerMove3;

          this._resolveLocalPlayerOnce();

          (_this$_playerMove3 = this._playerMove) == null || _this$_playerMove3.setInputLocked(this._shouldLockPlayerMovement());
        } // --- map ---


        _parseMap() {
          var _this$mapConfig3, _ref3, _raw$mapCode, _raw$client, _client$dialogueScrip, _client$choiceScripts, _raw$npcs, _ref4, _raw$tasks, _raw$mapWidth, _raw$mapHeight, _raw$server, _server$antiCheat;

          var raw = (_this$mapConfig3 = this.mapConfig) == null ? void 0 : _this$mapConfig3.json;

          if (!raw) {
            if (this.debugLog) storyLog('warn', 'StoryManager._parseMap: mapConfig 为空', {});
            return;
          }

          var jsonMapCode = String((_ref3 = (_raw$mapCode = raw.mapCode) != null ? _raw$mapCode : raw.map_code) != null ? _ref3 : '').trim();

          if (jsonMapCode && jsonMapCode !== this.mapCode) {
            if (this.debugLog) {
              storyLog('warn', 'StoryManager: mapCode 与 JsonAsset 不一致，已以 JSON 为准', {
                sceneMapCode: this.mapCode,
                jsonMapCode
              });
            }

            this.mapCode = jsonMapCode;
          }

          (_crd && sanitizeBattlePseudoChoicesInRuntime === void 0 ? (_reportPossibleCrUseOfsanitizeBattlePseudoChoicesInRuntime({
            error: Error()
          }), sanitizeBattlePseudoChoicesInRuntime) : sanitizeBattlePseudoChoicesInRuntime)(raw);
          var client = (_raw$client = raw.client) != null ? _raw$client : {};
          this._dialogueScripts = (_client$dialogueScrip = client.dialogueScripts) != null ? _client$dialogueScrip : {};
          this._choiceScripts = (_client$choiceScripts = client.choiceScripts) != null ? _client$choiceScripts : {};
          this._npcRows = (_raw$npcs = raw.npcs) != null ? _raw$npcs : [];
          this._taskDefs = (_ref4 = (_raw$tasks = raw.tasks) != null ? _raw$tasks : raw.quests) != null ? _ref4 : [];
          var mw = Number((_raw$mapWidth = raw.mapWidth) != null ? _raw$mapWidth : raw.map_width);
          var mh = Number((_raw$mapHeight = raw.mapHeight) != null ? _raw$mapHeight : raw.map_height);

          if (Number.isFinite(mw) && Number.isFinite(mh) && mw > 0 && mh > 0) {
            this._jsonMapContentSize = {
              w: mw,
              h: mh
            };
          } else {
            this._jsonMapContentSize = null;
          }

          var server = (_raw$server = raw.server) != null ? _raw$server : {};
          var anti = (_server$antiCheat = server.antiCheat) != null ? _server$antiCheat : {};
          var maxD = Number(anti.maxInteractDistance);

          if (Number.isFinite(maxD) && maxD > 0) {
            this.interactDistanceFallbackPx = Math.min(this.interactDistanceFallbackPx, maxD);
          }

          this._warnMisplacedBattleFlowInMap();

          this._validateChoiceDeferContracts();
        }
        /** 加载时校验：defer 选项不应在 allowedChoiceIds，暂缓文案应 block */


        _validateChoiceDeferContracts() {
          var deferTextRe = /暂缓|拒绝|算了|稍后再|下次再说|不感兴趣|离开|不做|还没准备好|再想想|稍后|暂不|未准备好|考虑一下/;

          for (var row of this._npcRows) {
            var _row$npcUid5;

            var npcUid = (_row$npcUid5 = row.npcUid) != null ? _row$npcUid5 : '';

            for (var ev of (_row$events8 = row.events) != null ? _row$events8 : []) {
              var _row$events8, _ev$client4, _script$options, _ev$server$allowedCho, _ev$server6;

              if (ev.eventType !== 'choice' && ev.eventType !== 'teleport') continue;
              var sid = (_ev$client4 = ev.client) == null ? void 0 : _ev$client4.choiceScriptId;
              if (!sid) continue;
              var script = this._choiceScripts[sid];
              if (!(script != null && (_script$options = script.options) != null && _script$options.length)) continue;
              var allowed = (_ev$server$allowedCho = (_ev$server6 = ev.server) == null ? void 0 : _ev$server6.allowedChoiceIds) != null ? _ev$server$allowedCho : [];

              for (var _opt3 of script.options) {
                var _opt3$text;

                var blocked = _opt3.completesEvent === false || _opt3.forcedResult === 'block' || _opt3.forcedResult === 'none';

                if (blocked && allowed.includes(_opt3.id)) {
                  storyLog('warn', 'StoryManager: defer 选项仍在 allowedChoiceIds', {
                    npcUid,
                    eventId: ev.eventId,
                    choiceId: _opt3.id,
                    text: _opt3.text
                  });
                }

                if (!blocked && deferTextRe.test(String((_opt3$text = _opt3.text) != null ? _opt3$text : '').trim()) && allowed.includes(_opt3.id)) {
                  storyLog('warn', 'StoryManager: 暂缓文案但未 block，可能误推进任务', {
                    npcUid,
                    eventId: ev.eventId,
                    choiceId: _opt3.id,
                    text: _opt3.text
                  });
                }
              }
            }
          }
        }
        /** 旧版 AI 链：任务官含「战斗结果」且无 battle 事件 / 无 _enemy NPC */


        _warnMisplacedBattleFlowInMap() {
          var hasBattleEvent = this._npcRows.some(row => {
            var _row$events9;

            return ((_row$events9 = row.events) != null ? _row$events9 : []).some(ev => ev.eventType === 'battle');
          });

          var hasEnemyNpc = this._npcRows.some(row => {
            var _row$npcUid6;

            var uid = (_row$npcUid6 = row.npcUid) != null ? _row$npcUid6 : '';
            return uid.endsWith('_enemy') || /_enemy_\d+$/.test(uid);
          });

          for (var row of this._npcRows) {
            var _row$npcUid7;

            var uid = (_row$npcUid7 = row.npcUid) != null ? _row$npcUid7 : '';
            if (uid.endsWith('_enemy')) continue;

            for (var ev of (_row$events10 = row.events) != null ? _row$events10 : []) {
              var _row$events10, _ev$eventTypeDesc;

              if (ev.eventType !== 'choice') continue;
              var desc = String((_ev$eventTypeDesc = ev.eventTypeDesc) != null ? _ev$eventTypeDesc : '');
              if (!desc.includes('战斗结果')) continue;
              storyLog('warn', 'StoryManager: 任务官链内误含「战斗结果」选项，应去红色战斗敌人处开战', {
                npcUid: uid,
                eventId: ev.eventId,
                hasBattleEvent,
                hasEnemyNpc,
                hint: '请在 Juben 添加战斗分支并重新 publish:map'
              });
            }
          }

          if (!hasBattleEvent && !hasEnemyNpc) {
            var giverWithBattleResult = this._npcRows.some(row => {
              var _row$events11;

              return ((_row$events11 = row.events) != null ? _row$events11 : []).some(ev => {
                var _ev$eventTypeDesc2;

                return String((_ev$eventTypeDesc2 = ev.eventTypeDesc) != null ? _ev$eventTypeDesc2 : '').includes('战斗结果');
              });
            });

            if (giverWithBattleResult) {
              storyLog('warn', 'StoryManager: 当前 map JSON 缺少 battle 事件与战斗敌人 NPC，剧情战无法触发', {
                mapCode: this.mapCode
              });
            }
          }
        }

        _getSequentialBlockHint() {
          var _this6 = this;

          if (!this.sequentialStoryNpcReveal || !this._playerMove) return null;
          var currentUid = null;

          var _loop3 = function _loop3(uid) {
            if (_this6._isBattleEnemyNpcUid(uid)) return 0; // continue

            if (_this6._isNpcHiddenUntilReveal(uid)) return 0; // continue

            var row = _this6._npcRows.find(r => r.npcUid === uid);

            if ((_crd && isHiddenByMainlineStep === void 0 ? (_reportPossibleCrUseOfisHiddenByMainlineStep({
              error: Error()
            }), isHiddenByMainlineStep) : isHiddenByMainlineStep)(row, {
              mainlineStep: _this6._mainlineStep
            })) {
              return 0; // continue
            }

            var entry = _this6._resolved.find(r => r.npcUid === uid);

            if (!entry) return 0; // continue

            if (_this6._hasIncompleteStoryEvents(uid, entry.events)) {
              currentUid = uid;
              return 1; // break
            }
          },
              _ret2;

          for (var uid of this._storyNpcOrder) {
            _ret2 = _loop3(uid);
            if (_ret2 === 0) continue;
            if (_ret2 === 1) break;
          }

          if (!currentUid) return null;
          var R = this.interactDistanceFallbackPx;

          var _loop4 = function _loop4(npcUid) {
            if (npcUid === currentUid || !(node != null && node.isValid) || node.active) return 0; // continue

            if (_this6._isBattleEnemyNpcUid(npcUid)) return 0; // continue

            if (_this6._isNpcHiddenUntilReveal(npcUid)) return 0; // continue

            if (_this6._distanceToPlayer(node) > R) return 0; // continue

            var curRow = _this6._npcRows.find(n => n.npcUid === currentUid);

            var row = _this6._npcRows.find(n => n.npcUid === npcUid);

            var curName = (curRow == null ? void 0 : curRow.npcName) || currentUid;
            var name = (row == null ? void 0 : row.npcName) || npcUid;
            return {
              v: "\u8BF7\u5148\u5B8C\u6210 " + curName + " \u7684\u4E3B\u7EBF\uFF0C\u518D\u4E0E " + name + " \u5BF9\u8BDD"
            };
          },
              _ret3;

          for (var {
            npcUid,
            node
          } of this._resolved) {
            _ret3 = _loop4(npcUid);
            if (_ret3 === 0) continue;
            if (_ret3) return _ret3.v;
          }

          return null;
        }

        _stableEventId(npcUid, ev) {
          var _ev$order3;

          if (ev.eventId) return ev.eventId;
          return npcUid + "#order_" + ((_ev$order3 = ev.order) != null ? _ev$order3 : 0);
        }

        _markEventDone(npcUid, ev, opts) {
          var _ev$client5, _next$client;

          var eid = this._stableEventId(npcUid, ev);

          this._recordTaskEffectsFromEvent(ev, opts == null ? void 0 : opts.choiceId);

          if (ev.eventType === 'battle') {
            this._battleClearedEventIds.add(eid);

            this._localBattleWonEventIds.add(eid);
          }

          this._localCompletedEventIds.add(eid);

          if (this.debugLog) {
            storyLog('info', 'StoryManager: 事件已完成', {
              npcUid,
              eventId: eid,
              eventType: ev.eventType
            });
          }

          if ((_ev$client5 = ev.client) != null && _ev$client5.endsSession) {
            this._endNpcChainSession();
          }

          if (this._shouldHideNpcWhenComplete(npcUid)) {
            this._hideNpcIfStoryComplete(npcUid);
          }

          this._refreshNpcVisibility();

          this._syncNpcTaskIndicators();

          this._persistLocalStoryState();

          var entry = this._resolved.find(r => r.npcUid === npcUid);

          var next = entry ? this._pickInteractEvent(npcUid, entry.events) : null;

          if (!next) {
            this._endActivation();

            return;
          }

          if ((_next$client = next.client) != null && _next$client.requiresApproach) {
            this._npcApproachOk = false;
          }

          this._continueChain(npcUid);
        }

        _tryTriggerActivation(npcUid) {
          var now = Date.now();
          if (now - this._lastInteractTriggerAt < 200) return;
          this._lastInteractTriggerAt = now;

          this._beginActivation(npcUid);
        }

        _beginActivation(npcUid) {
          var _ev$client6;

          if (this._activationNpcUid) {
            if (this._activationNpcUid !== npcUid) return;
            if (this._eventFlowRunning || this.isBlocking || this._activationPausedForBattle) return;
          }

          this._activationNpcUid = npcUid;
          this._activationPausedForBattle = false;

          this._beginNpcChainSession(npcUid);

          var entry = this._resolved.find(x => x.npcUid === npcUid);

          if (!entry) {
            this._endActivation();

            return;
          }

          this._facePlayerTowardNpc(entry.node);

          var ev = this._pickInteractEvent(npcUid, entry.events);

          if (!ev) {
            this._endActivation();

            return;
          }

          if ((_ev$client6 = ev.client) != null && _ev$client6.requiresApproach && !this._npcApproachOk) {
            this.showToast('请先离开再靠近 NPC', 2000);

            this._endActivation();

            return;
          }

          void this._runEventFlow(npcUid, ev);
        }

        _facePlayerTowardNpc(npcNode) {
          var _this$_playerMove4;

          this._resolveLocalPlayerOnce();

          if (!((_this$_playerMove4 = this._playerMove) != null && (_this$_playerMove4 = _this$_playerMove4.node) != null && _this$_playerMove4.isValid) || !(npcNode != null && npcNode.isValid)) return;
          var p = npcNode.worldPosition;

          this._playerMove.faceToward(p.x, p.y);
        }

        _continueChain(npcUid, attempt) {
          var _next$client2;

          if (attempt === void 0) {
            attempt = 0;
          }

          if (this._activationNpcUid !== npcUid || this._activationPausedForBattle) return;
          var maxAttempts = 5;

          if (this._eventFlowRunning || this.isBlocking) {
            if (attempt < maxAttempts) {
              this.scheduleOnce(() => this._continueChain(npcUid, attempt + 1), 0.1);
            } else {
              storyLog('warn', 'StoryManager: 续链等待超时', {
                npcUid,
                attempt
              });
              this.showToast('剧情衔接中断，请再按 E 或点击交谈', 2800);

              this._endActivation();
            }

            return;
          }

          var entry = this._resolved.find(r => r.npcUid === npcUid);

          var next = entry ? this._pickInteractEvent(npcUid, entry.events) : null;

          if (!next) {
            this._endActivation();

            return;
          }

          if (this.cancelActivationOnLeaveRange && this._playerTouchingNpcUid !== npcUid) {
            this._endActivation();

            return;
          }

          if ((_next$client2 = next.client) != null && _next$client2.requiresApproach && !this._npcApproachOk) {
            this._endActivation();

            return;
          }

          this.scheduleOnce(() => {
            if (!this._alive()) return;

            if (this._activationNpcUid !== npcUid || this._activationPausedForBattle || this._eventFlowRunning || this.isBlocking) {
              if (attempt < maxAttempts) {
                this._continueChain(npcUid, attempt + 1);
              } else {
                this.showToast('剧情衔接中断，请再按 E 或点击交谈', 2800);

                this._endActivation();
              }

              return;
            }

            void this._runEventFlow(npcUid, next);
          }, 0);
        }

        _endActivation() {
          this._activationNpcUid = null;
          this._activationPausedForBattle = false;

          this._endNpcChainSession();

          this._syncPlayerInputLock();
        }

        _beginNpcChainSession(npcUid) {
          this._chainNpcUid = npcUid;
          this._npcApproachOk = true;
        }

        _endNpcChainSession() {
          this._chainNpcUid = null;
          this._npcApproachOk = true;
        }

        _shouldHideNpcWhenComplete(npcUid) {
          var _row$hideWhenComplete;

          if (!this.hideNpcWhenStoryComplete) return false;

          var row = this._npcRows.find(r => r.npcUid === npcUid);

          return (_row$hideWhenComplete = row == null ? void 0 : row.hideWhenComplete) != null ? _row$hideWhenComplete : true;
        }

        _resolveCurrentMainlineNpcUid() {
          var _this7 = this;

          var hasIncomplete = uid => {
            var entry = this._resolved.find(r => r.npcUid === uid);

            if (!entry) return false;
            return this._hasIncompleteStoryEvents(uid, entry.events);
          };

          var hasInteract = uid => {
            var entry = this._resolved.find(r => r.npcUid === uid);

            if (!entry) return false;
            return this._pickInteractEvent(uid, entry.events) !== null;
          };

          var _loop5 = function _loop5(uid) {
            if (_this7._isBattleEnemyNpcUid(uid)) return 0; // continue

            if (_this7._isNpcHiddenUntilReveal(uid)) return 0; // continue

            var row = _this7._npcRows.find(r => r.npcUid === uid);

            if ((_crd && isHiddenByMainlineStep === void 0 ? (_reportPossibleCrUseOfisHiddenByMainlineStep({
              error: Error()
            }), isHiddenByMainlineStep) : isHiddenByMainlineStep)(row, {
              mainlineStep: _this7._mainlineStep
            })) {
              return 0; // continue
            }

            if (!hasIncomplete(uid)) return 0; // continue

            if ((_crd && isStaleMainlineGiver === void 0 ? (_reportPossibleCrUseOfisStaleMainlineGiver({
              error: Error()
            }), isStaleMainlineGiver) : isStaleMainlineGiver)(uid, _this7._storyNpcOrder, u => _this7._isBattleEnemyNpcUid(u), u => _this7._isNpcHiddenUntilReveal(u), hasIncomplete, hasInteract)) {
              return 0; // continue
            }

            return {
              v: uid
            };
          },
              _ret4;

          for (var uid of this._storyNpcOrder) {
            _ret4 = _loop5(uid);
            if (_ret4 === 0) continue;
            if (_ret4) return _ret4.v;
          }

          return null;
        }
        /** 统一 NPC 可见性：appear + mainline_step + 顺序显现 */


        _refreshNpcVisibility() {
          var _currentEntry$node,
              _this8 = this;

          if (!this.sequentialStoryNpcReveal) {
            var _currentUid = this._resolveCurrentMainlineNpcUid();

            for (var {
              npcUid,
              node,
              events
            } of this._resolved) {
              if (!(node != null && node.isValid)) continue;

              if (this._isNpcHiddenUntilReveal(npcUid)) {
                node.active = false;
                var bc = node.getComponent(BoxCollider2D);
                if (bc) bc.enabled = false;
                continue;
              }

              var show = this._isBattleEnemyNpcUid(npcUid) ? this._shouldShowBattleEnemy(npcUid, events, _currentUid) : this._hasIncompleteStoryEvents(npcUid, events);
              node.active = show;
              var bc2 = node.getComponent(BoxCollider2D);
              if (bc2) bc2.enabled = this._isBattleEnemyNpcUid(npcUid) ? show : this._pickInteractEvent(npcUid, events) !== null;
            }

            this._syncNpcTaskIndicators();

            return;
          }

          var currentUid = this._resolveCurrentMainlineNpcUid();

          var currentEntry = currentUid ? this._resolved.find(r => r.npcUid === currentUid) : null;
          var currentNode = (_currentEntry$node = currentEntry == null ? void 0 : currentEntry.node) != null ? _currentEntry$node : null;

          var _loop6 = function _loop6(_npcUid) {
            if (!(_node != null && _node.isValid)) return 1; // continue

            var row = _this8._npcRows.find(r => r.npcUid === _npcUid);

            var isAncestor = currentNode !== null && _node !== currentNode && _this8._isDescendantOf(currentNode, _node);

            var decision = (_crd && decideNpcVisibility === void 0 ? (_reportPossibleCrUseOfdecideNpcVisibility({
              error: Error()
            }), decideNpcVisibility) : decideNpcVisibility)(_npcUid, row, _events, {
              revealedNpcUids: _this8._revealedNpcUids,
              mainlineStep: _this8._mainlineStep,
              taskDefs: new Map(),
              sequentialReveal: true,
              storyNpcOrder: _this8._storyNpcOrder,
              reqCtx: _this8._buildRequirementContext(),
              isBattleEnemyNpcUid: uid => _this8._isBattleEnemyNpcUid(uid),
              hasActiveInteractEvent: (uid, evs) => {
                var evList = evs;

                if (_this8._isBattleEnemyNpcUid(uid)) {
                  return _this8._shouldShowBattleEnemy(uid, evList, currentUid);
                }

                return _this8._pickInteractEvent(uid, evList) !== null;
              },
              isNpcHiddenByAppear: uid => _this8._isNpcHiddenUntilReveal(uid)
            }, currentUid, isAncestor);
            _node.active = decision.visible;

            var bc = _node.getComponent(BoxCollider2D);

            if (bc) bc.enabled = decision.colliderEnabled;
          };

          for (var {
            npcUid: _npcUid,
            node: _node,
            events: _events
          } of this._resolved) {
            if (_loop6(_npcUid)) continue;
          }

          if (this.debugLog) {
            storyLog('info', 'StoryManager: 顺序可见性', {
              currentUid,
              resolved: this._resolved.map(r => r.npcUid)
            });
          }

          this._syncNpcTaskIndicators();
        }

        _unbindNpcTouchHandlers() {
          for (var off of this._npcTouchUnbinders) off();

          this._npcTouchUnbinders.length = 0;
        }

        _bindNpcTouchHandlers() {
          var _this9 = this;

          this._unbindNpcTouchHandlers();

          var _loop7 = function _loop7(npcUid, node) {
            if (!(node != null && node.isValid)) return 1; // continue

            var handler = e => {
              e.propagationStopped = true;
              if (_this9._playerTouchingNpcUid !== npcUid) return;
              if (_this9.isBlocking || _this9._eventFlowRunning || _this9._activationNpcUid) return;

              _this9._tryTriggerActivation(npcUid);
            };

            node.on(Node.EventType.TOUCH_END, handler, _this9);

            _this9._npcTouchUnbinders.push(() => {
              if (node != null && node.isValid) node.off(Node.EventType.TOUCH_END, handler, _this9);
            });
          };

          for (var {
            npcUid,
            node
          } of this._resolved) {
            if (_loop7(npcUid, node)) continue;
          }
        }
        /** E / 回车 / 空格 + 编辑器里配置的 interactKey */


        _isStoryInteractKey(code) {
          return code === KeyCode.KEY_E || code === KeyCode.ENTER || code === KeyCode.SPACE || code === this.interactKey;
        }
        /** 该 npcUid 下剧情链全部完成时，隐藏或销毁对应场景节点 */


        _hideNpcIfStoryComplete(npcUid) {
          var ix = this._resolved.findIndex(r => r.npcUid === npcUid);

          if (ix < 0) return;
          var entry = this._resolved[ix];
          if (this._hasIncompleteStoryEvents(npcUid, entry.events)) return;
          var node = entry.node;

          this._resolved.splice(ix, 1);

          if (this._playerTouchingNpcUid === npcUid) {
            this._playerTouchingNpcUid = null;
          }

          if (!(node != null && node.isValid)) return;

          var si = this._spawnedNpcRoots.indexOf(node);

          if (si >= 0) {
            this._spawnedNpcRoots.splice(si, 1);

            node.destroy();
            if (this.debugLog) storyLog('info', 'StoryManager: 剧情已完成，已销毁克隆 NPC', {
              npcUid
            });

            this._refreshNpcVisibility();

            this._syncNpcTaskIndicators();

            return;
          }

          node.active = false;
          var bc = node.getComponent(BoxCollider2D);
          if (bc) bc.enabled = false;
          if (this.debugLog) storyLog('info', 'StoryManager: 剧情已完成，已隐藏 NPC 节点', {
            npcUid
          });

          this._refreshNpcVisibility();

          this._syncNpcTaskIndicators();
        }

        _pickInteractEvent(npcUid, events) {
          var sorted = [...events].sort((a, b) => {
            var _a$order3, _b$order3;

            return ((_a$order3 = a.order) != null ? _a$order3 : 0) - ((_b$order3 = b.order) != null ? _b$order3 : 0);
          });

          for (var ev of sorted) {
            var _ev$server7;

            if (this._isQuestStepComplete(npcUid, ev)) continue;
            var reqs = (_ev$server7 = ev.server) == null ? void 0 : _ev$server7.requirements; // 首个未完成环未满足条件时不得跳到后面（如 e5 待战斗时禁止连到 e6/e8）

            if (!this._evaluateRequirements(reqs)) return null;
            return ev;
          }

          return null;
        } // --- NPC 发现 ---


        _destroySpawnedNpcs() {
          for (var i = 0; i < this._spawnedNpcRoots.length; i++) {
            var n = this._spawnedNpcRoots[i];
            if (n != null && n.isValid) n.destroy();
          }

          this._spawnedNpcRoots.length = 0;
        }

        _resolveNpcs() {
          var _ref5, _this$_npcRows$find2;

          this._unbindNpcTouchHandlers();

          this._destroySpawnedNpcs();

          this._resolved = [];
          var scene = director.getScene();
          if (!scene) return;
          var used = new Set();

          var canvas = this._findNodeByName(scene, 'Canvas');

          var templateNpc = (_ref5 = canvas && this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC')) != null ? _ref5 : null;
          var refRow = (_this$_npcRows$find2 = this._npcRows.find(r => r.npcUid === '0_lead_01')) != null ? _this$_npcRows$find2 : this._npcRows[0];
          var ordered = [...this._npcRows].sort((a, b) => {
            var pa = a.npcUid === '0_lead_01' ? 1 : 0;
            var pb = b.npcUid === '0_lead_01' ? 1 : 0;
            return pb - pa;
          });
          this._storyNpcOrder = ordered.map(r => r.npcUid).filter(u => Boolean(u && typeof u === 'string'));
          var cloneStackSlot = 0;

          for (var row of ordered) {
            var _row$events12, _row$nodePath;

            var npcUid = row.npcUid;
            if (!npcUid) continue;
            var events = (_row$events12 = row.events) != null ? _row$events12 : [];
            var node = null;

            if ((_row$nodePath = row.nodePath) != null && _row$nodePath.length) {
              var _this$_getChildByPath;

              node = (_this$_getChildByPath = this._getChildByPath(scene, row.nodePath)) != null ? _this$_getChildByPath : null;
            }

            if (!node) {
              node = this._findNodeByName(scene, npcUid);
            }

            if (!node) {
              node = this._findNodeByJsonCoord(scene, row, used);
            }

            if (!node && !this._rowHasJsonCoords(row)) {
              node = this._findNpcNodeFallback(scene, row, used);
            }

            if (node && used.has(node)) {
              node = null;
            }

            if (!node && this.spawnMissingNpcClones && templateNpc != null && templateNpc.isValid) {
              cloneStackSlot++;
              node = this._spawnNpcFromTemplate(scene, templateNpc, row, refRow, cloneStackSlot);
            }

            if (!node && canvas && !this._rowHasJsonCoords(row)) {
              var generic = this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC');

              if (generic && !used.has(generic)) node = generic;
            }

            if (!node) {
              var _row$nodePath2;

              storyLog('warn', 'StoryManager: 未解析到 NPC 节点', {
                npcUid,
                nodePath: (_row$nodePath2 = row.nodePath) != null ? _row$nodePath2 : ''
              });
              continue;
            }

            used.add(node);

            this._applyJsonNpcPosition(scene, node, row);

            if (!this.letBattleTriggerHandleCombat) {
              var battle = node.getComponent(_crd && BattleTriggerOnContact === void 0 ? (_reportPossibleCrUseOfBattleTriggerOnContact({
                error: Error()
              }), BattleTriggerOnContact) : BattleTriggerOnContact);
              if (battle) battle.enabled = false;
            }

            this._applyNpcPortraitFromRow(node, row);

            this._resolved.push({
              npcUid,
              node,
              events
            });

            if (this.debugLog) {
              storyLog('info', 'StoryManager: NPC 已绑定', {
                npcUid,
                node: node.name,
                spawned: this._spawnedNpcRoots.includes(node)
              });
            }
          }

          this._bindNpcTouchHandlers();

          this._refreshNpcVisibility();

          this._ensureTaskStatusFramesLoaded();
        }

        _applyNpcPortraitFromRow(root, row) {
          var _row$prefabKey;

          var key = (_row$prefabKey = row.prefabKey) == null ? void 0 : _row$prefabKey.trim();

          if (key) {
            this._loadAndApplyNpcPortrait(root, key);

            return;
          }

          this._maybeRandomizeNpcPortrait(root);
        }
        /** prefabKey 如 Npc/Npc_01，对应 assets/resources/Npc/Npc_01.png */


        _loadAndApplyNpcPortrait(root, prefabKey) {
          var _root$getComponent;

          var sp = (_root$getComponent = root.getComponent(Sprite)) != null ? _root$getComponent : root.getComponentInChildren(Sprite);
          if (!sp) return;
          var base = prefabKey.replace(/\/spriteFrame$/i, '').replace(/\.png$/i, '');
          var path = base.includes('/') ? base + "/spriteFrame" : "Npc/" + base + "/spriteFrame";
          (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance().loadAsset(path, SpriteFrame, (err, sf) => {
            var _root$getComponent2;

            if (err || !sf || !root.isValid) {
              if (this.debugLog) {
                var _err$message;

                storyLog('warn', 'StoryManager: NPC 立绘加载失败', {
                  prefabKey,
                  path,
                  err: (_err$message = err == null ? void 0 : err.message) != null ? _err$message : ''
                });
              }

              return;
            }

            var target = (_root$getComponent2 = root.getComponent(Sprite)) != null ? _root$getComponent2 : root.getComponentInChildren(Sprite);
            if (target != null && target.isValid) target.spriteFrame = sf;
          });
        }

        _maybeRandomizeNpcPortrait(root) {
          var _root$getComponent3, _frames$Math$floor;

          if (!this.randomizeNpcPortraits || this.randomNpcPortraitFrames.length === 0) return;
          var sp = (_root$getComponent3 = root.getComponent(Sprite)) != null ? _root$getComponent3 : root.getComponentInChildren(Sprite);
          if (!sp) return;
          var frames = this.randomNpcPortraitFrames;
          sp.spriteFrame = (_frames$Math$floor = frames[Math.floor(Math.random() * frames.length)]) != null ? _frames$Math$floor : sp.spriteFrame;
        }

        _rowHasJsonCoords(row) {
          return Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y));
        }
        /** 将 JSON 逻辑格心坐标应用到已解析的 NPC 节点（绑定模板/已有节点时同样生效） */


        _applyJsonNpcPosition(scene, node, row) {
          if (!this._rowHasJsonCoords(row)) return;

          var placed = this._computeJsonRowWorldPos(scene, row);

          if (!placed) return;
          node.setWorldPosition(placed.world.x, placed.world.y, placed.world.z);

          if (this.debugLog) {
            storyLog('info', 'StoryManager: NPC 已对齐 JSON 坐标', {
              npcUid: row.npcUid,
              x: row.x,
              y: row.y,
              mapW: placed.mapW,
              mapH: placed.mapH,
              localX: placed.localX,
              localY: placed.localY
            });
          }
        }
        /** mapRoot 可用时，把 JSON 逻辑格心换算到世界坐标（与 Juben MapEditorView 埋点一致） */


        _computeJsonRowWorldPos(scene, row) {
          var _this$_playerMove5;

          var pm = (_this$_playerMove5 = this._playerMove) != null ? _this$_playerMove5 : scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove);
          if (!(pm != null && pm.mapRoot)) return null;
          var map = pm.mapRoot;
          var mapUt = map.getComponent(UITransform);
          if (!mapUt) return null;
          var nx = Number(row.x);
          var ny = Number(row.y);
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

          var b = this._mapBoundsInParentSpace(map, mapUt);

          var mapH = b.maxY - b.minY;
          var mapW = b.maxX - b.minX;
          if (mapH <= 0 || mapW <= 0) return null;
          var parent = map.parent;
          if (!parent) return null;
          var pUt = parent.getComponent(UITransform);
          if (!pUt) return null;
          var local = (_crd && logicalToParentLocal === void 0 ? (_reportPossibleCrUseOflogicalToParentLocal({
            error: Error()
          }), logicalToParentLocal) : logicalToParentLocal)(nx, ny, b, _crd && TILE_CELL === void 0 ? (_reportPossibleCrUseOfTILE_CELL({
            error: Error()
          }), TILE_CELL) : TILE_CELL);

          this._tmpV3.set(local.x, local.y, 0);

          pUt.convertToWorldSpaceAR(this._tmpV3, this._tmpWorld);
          return {
            world: this._tmpWorld,
            mapW: Math.round(mapW),
            mapH: Math.round(mapH),
            localX: Math.round(local.x),
            localY: Math.round(local.y)
          };
        }

        _spawnNpcFromTemplate(scene, template, row, refRow, stackSlotFromTemplate) {
          var _row$npcUid8;

          var parent = template.parent;
          if (!parent) return null;
          var clone = instantiate(template);
          clone.name = (_row$npcUid8 = row.npcUid) != null ? _row$npcUid8 : 'StoryNpc';
          parent.addChild(clone);
          var gapTiles = this.testStackNpcGapTiles;

          var placed = this._computeJsonRowWorldPos(scene, row);

          var hasJsonCoords = Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y));

          if (placed && hasJsonCoords) {
            clone.setWorldPosition(placed.world.x, placed.world.y, placed.world.z);
          } else if (gapTiles > 0 && stackSlotFromTemplate > 0) {
            var stepPx = gapTiles * (_crd && TILE_CELL === void 0 ? (_reportPossibleCrUseOfTILE_CELL({
              error: Error()
            }), TILE_CELL) : TILE_CELL);
            clone.setPosition(template.position.x, template.position.y - stackSlotFromTemplate * stepPx, template.position.z);
          } else if (this.spawnUseJsonDeltaFromLead && refRow) {
            var rx = Number(refRow.x);
            var ry = Number(refRow.y);
            var nx = Number(row.x);
            var ny = Number(row.y);

            if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(rx) && Number.isFinite(ry)) {
              var dx = nx - rx;
              var dy = ny - ry;
              clone.setPosition(template.position.x + dx, template.position.y - dy, template.position.z);
            }
          }

          this._spawnedNpcRoots.push(clone);

          if (this.debugLog) {
            storyLog('info', 'StoryManager: 已克隆 NPC', {
              npcUid: row.npcUid,
              parent: parent.name
            });
          }

          return clone;
        }
        /** 按 `父/子/孙` 名称链解析，不含场景名前缀 */


        _getChildByPath(root, path) {
          var cur = root;

          var _loop8 = function _loop8(segment) {
            var _cur;

            var next = (_cur = cur) == null ? void 0 : _cur.children.find(c => c.name === segment);
            if (!next) return {
              v: null
            };
            cur = next;
          },
              _ret5;

          for (var segment of path.split('/').map(s => s.trim()).filter(Boolean)) {
            _ret5 = _loop8(segment);
            if (_ret5) return _ret5.v;
          }

          return cur;
        }

        _findNodeByName(root, name) {
          var stack = [...root.children];

          while (stack.length) {
            var n = stack.pop();
            if (n.name === name) return n;
            stack.push(...n.children);
          }

          return null;
        }

        _findNodeByJsonCoord(scene, row, used) {
          var _this$_playerMove6;

          var pm = (_this$_playerMove6 = this._playerMove) != null ? _this$_playerMove6 : scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove);
          if (!(pm != null && pm.mapRoot)) return null;
          var map = pm.mapRoot;
          var mapUt = map.getComponent(UITransform);
          if (!mapUt) return null;
          var nx = Number(row.x);
          var ny = Number(row.y);
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

          var b = this._mapBoundsInParentSpace(map, mapUt);

          var mapH = b.maxY - b.minY;
          if (mapH <= 0) return null;
          var parent = map.parent;
          if (!parent) return null;
          var pUt = parent.getComponent(UITransform);
          if (!pUt) return null;
          var local = (_crd && logicalToParentLocal === void 0 ? (_reportPossibleCrUseOflogicalToParentLocal({
            error: Error()
          }), logicalToParentLocal) : logicalToParentLocal)(nx, ny, b, _crd && TILE_CELL === void 0 ? (_reportPossibleCrUseOfTILE_CELL({
            error: Error()
          }), TILE_CELL) : TILE_CELL);

          this._tmpV3.set(local.x, local.y, 0);

          pUt.convertToWorldSpaceAR(this._tmpV3, this._tmpWorld);
          var best = null;
          var bestD = Number.POSITIVE_INFINITY;
          var pmNode = pm.node;
          var stack = [scene];

          while (stack.length) {
            var n = stack.pop();
            if (used.has(n)) continue;

            if (n !== pmNode && n.getComponent(BoxCollider2D)) {
              var w = n.worldPosition;
              var d = Math.hypot(w.x - this._tmpWorld.x, w.y - this._tmpWorld.y);

              if (d < bestD) {
                bestD = d;
                best = n;
              }
            }

            stack.push(...n.children);
          }

          if (best && bestD <= this.coordMatchMaxPx) return best;
          return null;
        }
        /**
         * mapRoot 未绑、节点名≠npcUid 时的兜底（本工程：Canvas/GameArea/WorldRoot/NPC）。
         * 多 NPC 共用同一节点时仅绑定第一条未占用配置，其余跳过并打 warn。
         */


        _findNpcNodeFallback(scene, row, used) {
          var _ref6, _this$_playerMove$nod, _this$_playerMove7, _scene$getComponentIn, _row$npcUid10;

          var canvas = this._findNodeByName(scene, 'Canvas');

          if (canvas) {
            var _row$npcUid9;

            var byUid = this._getChildByPath(canvas, "GameArea/WorldRoot/" + ((_row$npcUid9 = row.npcUid) != null ? _row$npcUid9 : ''));

            if (byUid && !used.has(byUid)) return byUid;

            var generic = this._getChildByPath(canvas, 'GameArea/WorldRoot/NPC');

            if (generic && !used.has(generic)) return generic;
          }

          var wr = this._findNodeByName(scene, 'WorldRoot');

          if (!wr) return null;
          var pmNode = (_ref6 = (_this$_playerMove$nod = (_this$_playerMove7 = this._playerMove) == null ? void 0 : _this$_playerMove7.node) != null ? _this$_playerMove$nod : (_scene$getComponentIn = scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove)) == null ? void 0 : _scene$getComponentIn.node) != null ? _ref6 : null;

          var colliders = this._collectColliderNpcNodes(wr, pmNode).filter(n => !used.has(n));

          if (colliders.length === 0) return null;
          var uid = (_row$npcUid10 = row.npcUid) != null ? _row$npcUid10 : '';
          var byName = colliders.find(n => n.name === uid);
          if (byName) return byName;

          var definedRows = this._npcRows.filter(r => Boolean(r.npcUid)).length;

          if (definedRows === 1 && colliders.length === 1) return colliders[0];
          var nx = Number(row.x);
          var ny = Number(row.y);
          var wrUt = wr.getComponent(UITransform);

          if (!Number.isFinite(nx) || !Number.isFinite(ny) || !wrUt) {
            var _colliders$;

            return (_colliders$ = colliders[0]) != null ? _colliders$ : null;
          }

          var best = null;
          var bestD = Number.POSITIVE_INFINITY;

          for (var nd of colliders) {
            wrUt.convertToNodeSpaceAR(nd.worldPosition, this._tmpLp);
            var lp = this._tmpLp;
            var d1 = Math.hypot(lp.x - nx, lp.y - ny);
            var d2 = Math.hypot(lp.x - nx, lp.y + ny);
            var d = Math.min(d1, d2);

            if (d < bestD) {
              bestD = d;
              best = nd;
            }
          }

          if (best && bestD <= this.coordMatchMaxPx * 3) return best;
          return null;
        }
        /** WorldRoot 下带 BoxCollider2D 的节点，排除玩家子树 */


        _collectColliderNpcNodes(root, pmNode) {
          var out = [];

          var walk = n => {
            if (pmNode && this._isDescendantOf(n, pmNode)) return;
            if (n.getComponent(BoxCollider2D)) out.push(n);

            for (var c of n.children) walk(c);
          };

          walk(root);
          return out;
        }

        _isDescendantOf(n, ancestor) {
          var p = n;

          while (p) {
            if (p === ancestor) return true;
            p = p.parent;
          }

          return false;
        }
        /** 与 TiledMap UITransform Content Size 一致（1584×1725 等），供 JSON 坐标换算 */


        _mapBoundsInParentSpace(map, mapUt) {
          var bounds = (_crd && mapContentBoundsInParentSpace === void 0 ? (_reportPossibleCrUseOfmapContentBoundsInParentSpace({
            error: Error()
          }), mapContentBoundsInParentSpace) : mapContentBoundsInParentSpace)(map.position, mapUt);

          if (this._jsonMapContentSize && this.debugLog) {
            var rw = bounds.maxX - bounds.minX;
            var rh = bounds.maxY - bounds.minY;

            if (Math.abs(rw - this._jsonMapContentSize.w) > 2 || Math.abs(rh - this._jsonMapContentSize.h) > 2) {
              storyLog('warn', 'StoryManager: JSON 地图尺寸与 TiledMap 不一致', {
                jsonW: this._jsonMapContentSize.w,
                jsonH: this._jsonMapContentSize.h,
                tiledW: Math.round(rw),
                tiledH: Math.round(rh)
              });
            }
          }

          return bounds;
        } // --- 玩家与范围 ---


        _resolveLocalPlayerOnce() {
          var now = Date.now();
          var resolved = Boolean(this._playerMove && this._playerCollider);
          if (resolved && this._lastPlayerResolveAt > 0 && now - this._lastPlayerResolveAt < 2000) return;
          this._lastPlayerResolveAt = now;

          try {
            var _scene$getComponentIn2, _this$_playerMove8;

            var scene = director.getScene == null ? void 0 : director.getScene();
            this._playerMove = (_scene$getComponentIn2 = scene == null ? void 0 : scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
              error: Error()
            }), PlayerGridMove) : PlayerGridMove)) != null ? _scene$getComponentIn2 : null;
            var pNode = (_this$_playerMove8 = this._playerMove) == null ? void 0 : _this$_playerMove8.node;

            if (pNode) {
              var box = pNode.getComponentInChildren(BoxCollider2D);

              if (box != null && box.enabled) {
                this._playerCollider = box;
              } else {
                var _cols$;

                var cols = pNode.getComponentsInChildren(Collider2D).filter(c => c.enabled);
                this._playerCollider = (_cols$ = cols[0]) != null ? _cols$ : null;
              }
            } else {
              this._playerCollider = null;
            }
          } catch (_unused2) {
            this._playerMove = null;
            this._playerCollider = null;
          }
        }

        _distanceToPlayer(target) {
          var _this$_playerMove9;

          if (!((_this$_playerMove9 = this._playerMove) != null && _this$_playerMove9.node)) return Number.POSITIVE_INFINITY;
          var a = target.worldPosition;
          var b = this._playerMove.node.worldPosition;
          return Math.hypot(a.x - b.x, a.y - b.y);
        }

        _aabbValid(rect) {
          return Boolean(rect && rect.width > 1e-6 && rect.height > 1e-6);
        }
        /**
         * NPC 触发箱与玩家碰撞体在世界空间 AABB 是否重叠。
         * @param playerAabbInflate 像素：对玩家 AABB 各边外扩，用于离开时的滞回，减少边缘抖动。
         */


        _computeAabbOverlap(npcNode, trig, playerAabbInflate) {
          if (playerAabbInflate === void 0) {
            playerAabbInflate = 0;
          }

          if (!trig || !this._playerCollider) return false;
          var a = trig.worldAABB;
          var b0 = this._playerCollider.worldAABB;
          var inf = Math.max(0, playerAabbInflate);
          var b = {
            x: b0.x - inf,
            y: b0.y - inf,
            width: b0.width + 2 * inf,
            height: b0.height + 2 * inf
          };
          if (!this._aabbValid(a) || !this._aabbValid(b)) return false;
          return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        }

        _pollTouchOverlap() {
          var _this$_playerMove10;

          this._resolveLocalPlayerOnce();

          if (!((_this$_playerMove10 = this._playerMove) != null && _this$_playerMove10.node) || this._resolved.length === 0) {
            this._playerTouchingNpcUid = null;

            this._syncInteractRangeHint(null);

            return;
          }

          var R = this.interactDistanceFallbackPx;
          var RLeave = R + this.interactReleaseHysteresisPx;
          var hy = this.interactReleaseHysteresisPx;
          var bestUid = null;
          var bestDist = Number.POSITIVE_INFINITY;

          for (var {
            npcUid,
            node
          } of this._resolved) {
            var _this$_playerCollider;

            if (!node.isValid || !node.active) continue;
            var trig = node.getComponent(BoxCollider2D);

            var dist = this._distanceToPlayer(node);

            var prev = this._playerTouchingNpcUid === npcUid;
            var hasNpcBox = Boolean((trig == null ? void 0 : trig.enabled) && this._aabbValid(trig.worldAABB));
            var hasPlayerCol = Boolean((_this$_playerCollider = this._playerCollider) == null ? void 0 : _this$_playerCollider.enabled);
            var hit = false;

            if (hasNpcBox && hasPlayerCol) {
              var overlapIn = this._computeAabbOverlap(node, trig, 0);

              var overlapLeave = hy > 0 ? this._computeAabbOverlap(node, trig, hy) : overlapIn;
              hit = overlapIn || prev && overlapLeave;
            } else {
              var withinCenter = dist <= R;
              var withinLeave = dist <= RLeave;

              if (!prev) {
                hit = withinCenter;
              } else {
                hit = withinLeave;
              }
            }

            if (hit && dist < bestDist) {
              bestDist = dist;
              bestUid = npcUid;
            }
          }

          var prevUid = this._playerTouchingNpcUid;
          this._playerTouchingNpcUid = bestUid;

          if (!prevUid && bestUid) {
            this._npcApproachOk = true;
          }

          if (this.cancelActivationOnLeaveRange && this._activationNpcUid && !bestUid && !this.isBlocking && !this._eventFlowRunning) {
            this._endActivation();

            this.closeAll();
          }

          this._syncInteractRangeHint(bestUid);

          if (prevUid !== bestUid && this.debugLog) {
            storyLog('info', 'StoryManager: range', {
              prevUid,
              bestUid,
              bestDist
            });
          }
        }
        /** NPC 碰撞范围内用 ToastItem 常驻「按 E 交谈」；与剧情反馈 Tips 分离 */


        _syncInteractRangeHint(activeNpcUid) {
          var want = Boolean(activeNpcUid) && !this.isBlocking && !this._activationNpcUid;

          this._resolveRefs();

          if (!this._refs) return;

          if (want && this._refs.toastItem && this._refs.toastTextLabel) {
            var lab = this._label(this._refs.toastTextLabel);

            if (lab) lab.string = this.interactHintText;
            this._refs.toastItem.active = true;
            this._toastPlaying = false;
            this.unschedule(this._hideToast);
            this._interactHintPinned = true;
          } else if (this._interactHintPinned) {
            this._interactHintPinned = false;
            if (this._refs.toastItem) this._refs.toastItem.active = false;

            this._drainToastQueue();
          }
        }

        // --- UI（原 StoryDialoguePlayer） ---
        _resolveRefs() {
          var _ref7, _this$getComponent, _this$node5;

          this._refs = (_ref7 = (_this$getComponent = this.getComponent(_crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
            error: Error()
          }), StoryUIViewRefs) : StoryUIViewRefs)) != null ? _this$getComponent : (_this$node5 = this.node) == null ? void 0 : _this$node5.getComponentInChildren(_crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
            error: Error()
          }), StoryUIViewRefs) : StoryUIViewRefs)) != null ? _ref7 : null;

          if (!this._refs) {
            var _this$node6;

            storyLog('error', 'StoryManager: 未找到 StoryUIViewRefs（请挂在同一节点或子节点）', {
              host: (_this$node6 = this.node) == null ? void 0 : _this$node6.name
            });
          }
        }

        closeAll() {
          var _this$_refs9, _this$_refs10, _this$_refs11;

          this._unbindNext();

          this._clearChoiceHandlers();

          this._script = null;
          this._onDialogueEnd = null;
          if ((_this$_refs9 = this._refs) != null && _this$_refs9.dialoguePanel) this._refs.dialoguePanel.active = false;
          if ((_this$_refs10 = this._refs) != null && _this$_refs10.choiceModal) this._refs.choiceModal.active = false;
          if ((_this$_refs11 = this._refs) != null && _this$_refs11.toastItem && !this._interactHintPinned) this._refs.toastItem.active = false;
          this.unschedule(this._hideToast);

          if (!this._interactHintPinned) {
            this._interactHintPinned = false;
          }
        }

        startDialogue(script, onComplete) {
          this._resolveRefs();

          if (!this._refs) return;
          var norm = normalizeDialogueScript(script);
          var rawKeys = script && typeof script === 'object' ? Object.keys(script) : [];

          if (this.debugLog) {
            storyLog('info', 'StoryManager.startDialogue', {
              speaker: norm.speaker,
              linesLen: norm.lines.length,
              rawKeys
            });
          }

          if (norm.lines.length === 0) {
            storyLog('warn', 'StoryManager.startDialogue: lines 为空', {
              rawKeys
            });
            this.closeAll();
            this.showToast('对白数据无效（无 lines）', 4000);
            return;
          }

          this.closeAll();
          this._script = norm;
          this._lineIndex = 0;
          this._onDialogueEnd = onComplete != null ? onComplete : null;
          if (this._refs.dialoguePanel) this._refs.dialoguePanel.active = true;

          this._applyLine();

          this._bindNext();
        }

        startChoice(choice, onPick, onClose) {
          var _this$_refs12,
              _choice$options,
              _choice$options2,
              _this$_refs$dialogueP2,
              _choice$title,
              _this$_refs$choiceBut,
              _template$parent,
              _this10 = this,
              _this$_refs$nextButto;

          this._resolveRefs();

          if (!((_this$_refs12 = this._refs) != null && _this$_refs12.choiceModal)) return;

          this._clearChoiceHandlers();

          this._activeChoicePick = onPick != null ? onPick : null;
          var options = ((_choice$options = choice.options) != null ? _choice$options : []).slice(0, 6);

          if (((_choice$options2 = choice.options) != null ? _choice$options2 : []).length > 6) {
            this.showToast('选项超过 6 项，仅显示前 6 项', 2800);
          }

          this._activeChoiceOptions = options;
          this._choiceHighlightIndex = 0;

          if ((_this$_refs$dialogueP2 = this._refs.dialoguePanel) != null && _this$_refs$dialogueP2.active) {
            this._refs.dialoguePanel.active = false;
          }

          this._refs.choiceModal.active = true;

          var titleLab = this._label(this._refs.choiceTitleLabel);

          if (titleLab) titleLab.string = (_choice$title = choice.title) != null ? _choice$title : '';
          var btns = [...((_this$_refs$choiceBut = this._refs.choiceButtons) != null ? _this$_refs$choiceBut : [])];
          var template = btns[0];
          var parent = (_template$parent = template == null ? void 0 : template.parent) != null ? _template$parent : this._refs.choiceModal;

          while (btns.length < options.length && template != null && template.isValid && parent != null && parent.isValid) {
            var clone = instantiate(template);
            parent.addChild(clone);
            btns.push(clone);

            this._dynamicChoiceNodes.push(clone);
          }

          var _loop9 = function _loop9() {
            var btnNode = btns[i];
            if (!btnNode) return 0; // continue

            var opt = options[i];

            if (!opt) {
              btnNode.active = false;
              return 0; // continue
            }

            btnNode.active = true;
            var lab = btnNode.getComponentInChildren(Label);
            if (lab) lab.string = i + 1 + ". " + opt.text;

            var fn = () => {
              _this10._refs.choiceModal.active = false;

              _this10._clearChoiceHandlers();

              onPick == null || onPick(opt);
              onClose == null || onClose();
            };

            btnNode.on(Node.EventType.TOUCH_END, fn, _this10);

            _this10._choiceHandlers.push(() => {
              if (btnNode != null && btnNode.isValid) btnNode.off(Node.EventType.TOUCH_END, fn, _this10);
            });
          },
              _ret6;

          for (var i = 0; i < btns.length; i++) {
            _ret6 = _loop9();
            if (_ret6 === 0) continue;
          }

          this._applyChoiceHighlight();

          var btnComp = (_this$_refs$nextButto = this._refs.nextButton) == null ? void 0 : _this$_refs$nextButto.getComponent(Button);
          if (btnComp) btnComp.interactable = false;
        }

        _moveChoiceHighlight(delta) {
          var n = this._activeChoiceOptions.length;
          if (n <= 0) return;
          this._choiceHighlightIndex = (this._choiceHighlightIndex + delta + n) % n;

          this._applyChoiceHighlight();
        }

        _applyChoiceHighlight() {
          var _this$_refs$choiceBut2, _this$_refs13;

          var btns = [...((_this$_refs$choiceBut2 = (_this$_refs13 = this._refs) == null ? void 0 : _this$_refs13.choiceButtons) != null ? _this$_refs$choiceBut2 : []), ...this._dynamicChoiceNodes];

          for (var i = 0; i < btns.length; i++) {
            var btnNode = btns[i];
            if (!(btnNode != null && btnNode.active)) continue;
            var lab = btnNode.getComponentInChildren(Label);
            if (!lab) continue;
            var highlighted = i === this._choiceHighlightIndex;
            lab.color = highlighted ? new Color(255, 220, 120, 255) : new Color(255, 255, 255, 255);
          }
        }

        _pickChoiceByIndex(index) {
          var _this$_refs14;

          var opt = this._activeChoiceOptions[index];
          var pick = this._activeChoicePick;
          if (!opt || !pick || !((_this$_refs14 = this._refs) != null && (_this$_refs14 = _this$_refs14.choiceModal) != null && _this$_refs14.active)) return;
          this._refs.choiceModal.active = false;

          this._clearChoiceHandlers();

          pick(opt);
        }
        /** 系统 Toast（靠近 NPC 时「按 E 交谈」等）；与 ToastItem 绑定 */


        showToast(text, durationMs) {
          if (durationMs === void 0) {
            durationMs = 2500;
          }

          this._toastQueue.push({
            text,
            durationMs
          });

          this._drainToastQueue();
        }
        /** 剧情反馈（完成任务、选项 systemTip 等）；绑定 GameArea/Tips，与 ToastItem 分离 */


        showStoryTip(text, durationMs) {
          if (durationMs === void 0) {
            durationMs = 2500;
          }

          this._storyTipsQueue.push({
            text,
            durationMs
          });

          this._drainStoryTipsQueue();
        }

        _drainToastQueue() {
          var _this$_refs15;

          if (this._toastPlaying || this._interactHintPinned) return;

          var item = this._toastQueue.shift();

          if (!item) return;

          this._resolveRefs();

          if (!((_this$_refs15 = this._refs) != null && _this$_refs15.toastItem) || !this._refs.toastTextLabel) return;
          this._toastPlaying = true;

          var lab = this._label(this._refs.toastTextLabel);

          if (lab) lab.string = item.text;
          this._refs.toastItem.active = true;
          this.unschedule(this._hideToast);
          this.scheduleOnce(this._hideToast, item.durationMs / 1000);
        }

        _drainStoryTipsQueue() {
          var _this$_refs16, _this$_refs$storyTips2, _this$_refs17;

          if (this._storyTipsPlaying) return;

          var item = this._storyTipsQueue.shift();

          if (!item) return;

          this._resolveRefs();

          var panel = (_this$_refs16 = this._refs) == null ? void 0 : _this$_refs16.storyTipsPanel;
          if (!panel) return;

          var lab = this._label((_this$_refs$storyTips2 = (_this$_refs17 = this._refs) == null ? void 0 : _this$_refs17.storyTipsLabel) != null ? _this$_refs$storyTips2 : panel);

          if (lab) lab.string = item.text;
          panel.active = true;
          this._storyTipsPlaying = true;
          this.unschedule(this._hideStoryTip);
          this.scheduleOnce(this._hideStoryTip, item.durationMs / 1000);
        }

        _label(n) {
          var _n$getComponent;

          if (!n) return null;
          return (_n$getComponent = n.getComponent(Label)) != null ? _n$getComponent : n.getComponentInChildren(Label);
        }

        _applyLine() {
          var _this$_script$lines, _this$_script$speaker, _lines$this$_lineInde;

          if (!this._refs || !this._script) return;
          var lines = (_this$_script$lines = this._script.lines) != null ? _this$_script$lines : [];

          var sp = this._label(this._refs.dialogueSpeakerLabel);

          var tx = this._label(this._refs.dialogueTextLabel);

          var total = lines.length;
          var progress = total > 1 ? " (" + (this._lineIndex + 1) + "/" + total + ")" : '';
          if (sp) sp.string = (_this$_script$speaker = this._script.speaker) != null ? _this$_script$speaker : '';
          if (tx) tx.string = ((_lines$this$_lineInde = lines[this._lineIndex]) != null ? _lines$this$_lineInde : '') + progress;
        }

        _bindNext() {
          var _this$_refs18;

          if (this._nextBound || !((_this$_refs18 = this._refs) != null && _this$_refs18.nextButton)) return;
          var nb = this._refs.nextButton;
          var btnComp = nb.getComponent(Button);

          if (btnComp) {
            btnComp.node.on(Button.EventType.CLICK, this._onNextClickBound, this);
          }

          nb.on(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
          this._nextBound = true;
        }

        _unbindNext() {
          var _this$_refs19;

          if (!((_this$_refs19 = this._refs) != null && _this$_refs19.nextButton)) {
            this._nextBound = false;
            return;
          }

          if (this._nextBound) {
            var nb = this._refs.nextButton;

            if (nb != null && nb.isValid) {
              var _btnComp$node;

              var btnComp = nb.getComponent(Button);

              if (btnComp != null && (_btnComp$node = btnComp.node) != null && _btnComp$node.isValid) {
                btnComp.node.off(Button.EventType.CLICK, this._onNextClickBound, this);
              }

              nb.off(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
            }
          }

          this._nextBound = false;
        }

        _advanceFromUi(source) {
          var now = Date.now();

          if (now - this._lastAdvanceWallMs < StoryManager._ADVANCE_DEBOUNCE_MS) {
            return;
          }

          this._lastAdvanceWallMs = now;
          if (this.debugLog) storyLog('info', 'StoryManager._advanceFromUi', {
            source
          });

          this._advanceLine();
        }

        _advanceLine() {
          var _this$_script$lines2, _this$_refs20;

          if (!this._script) return;
          var lines = (_this$_script$lines2 = this._script.lines) != null ? _this$_script$lines2 : [];
          var linesLen = lines.length;

          if (this.debugLog) {
            storyLog('info', 'StoryManager._advanceLine', {
              lineIndex: this._lineIndex,
              linesLen,
              willClose: !(this._lineIndex < linesLen - 1)
            });
          }

          if (this._lineIndex < linesLen - 1) {
            this._lineIndex++;

            this._applyLine();

            return;
          }

          this._unbindNext();

          if ((_this$_refs20 = this._refs) != null && _this$_refs20.dialoguePanel) this._refs.dialoguePanel.active = false;
          var cb = this._onDialogueEnd;
          this._script = null;
          this._onDialogueEnd = null;
          cb == null || cb();
        }

        _clearChoiceHandlers() {
          var _this$_refs21;

          for (var u of this._choiceHandlers) u();

          this._choiceHandlers = [];

          for (var n of this._dynamicChoiceNodes) {
            if (n != null && n.isValid) n.destroy();
          }

          this._dynamicChoiceNodes.length = 0;
          this._activeChoicePick = null;
          this._activeChoiceOptions = [];
          this._choiceHighlightIndex = 0;
          var btnComp = (_this$_refs21 = this._refs) == null || (_this$_refs21 = _this$_refs21.nextButton) == null ? void 0 : _this$_refs21.getComponent(Button);
          if (btnComp) btnComp.interactable = true;
        }

      }, _class3._ADVANCE_DEBOUNCE_MS = 90, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mapConfig", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "skipServerRequirements", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "resetLocalStoryOnEnter", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "interactKey", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return KeyCode.KEY_E;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "hideNpcWhenStoryComplete", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "sequentialStoryNpcReveal", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "debugLog", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "letBattleTriggerHandleCombat", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "interactDistanceFallbackPx", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 120;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "interactReleaseHysteresisPx", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 18;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "interactHintMinIntervalMs", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 8000;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "interactHintText", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return '按 E 或点击 交谈';
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "cancelActivationOnLeaveRange", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "battleTransitionDelaySec", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.3;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "coordMatchMaxPx", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 240;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "spawnMissingNpcClones", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "spawnUseJsonDeltaFromLead", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "testStackNpcGapTiles", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class2.prototype, "randomNpcPortraitFrames", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class2.prototype, "npcTaskStatusFrames", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class2.prototype, "randomizeNpcPortraits", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class2.prototype, "battleRoot", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class2.prototype, "mapCode", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'world_1782661910893';
        }
      })), _class2)) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=378039983e3e1e47f9796db937cbb0ae5f2d5c30.js.map