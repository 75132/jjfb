System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5", "__unresolved_6", "__unresolved_7", "__unresolved_8", "__unresolved_9", "__unresolved_10", "__unresolved_11"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, tween, Tween, Vec3, UITransform, Sprite, SpriteFrame, Color, resources, JsonAsset, WebSocketManager, GameConfig, DataCacheManager, RobotShow, BattleResumeController, ensureBattleResumeController, isActiveRoomConflict, roomIdOf, resolveOnEnableAction, validateStoryBattleCreate, validateBattleRestoreState, Logger, SkillData, SkillSelectPanel, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _dec23, _dec24, _dec25, _dec26, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _descriptor24, _descriptor25, _class3, _crd, ccclass, property, BattleState, BattleScene;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  /**
   * 解析单位的「攻击次数」AttackCount（= 一次攻击拆成几段，默认 1）。
   * 语义（用户口径）：AttackCount 就是装备那个攻击次数值，默认 1；
   *   AttackCount = 1 → 单段；= 2 → 拆 2 段；以此类推。
   * 取值优先级（非常重要）：
   *   1) CurrentAttackCount / currentAttackCount —— **装备加成后的最终段数**（服务端已把
   *      「机甲基础 AttackCount + 装备 attackCount 加成」写入 CurrentAttackCount）；
   *      真实玩家机甲的顶层 AttackCount 恒为 1，装备效果只在 CurrentAttackCount 里，
   *      所以必须优先读它，否则装备「攻击次数」永远不生效（PVP/PVE 都一样）。
   *   2) 顶层 AttackCount / attackCount（服务端已聚合的直传字段，老数据兼容）
   *   3) info.equipment 各槽位的 attackCount 字段累加 / effecttext「攻击次数+N」
   *   4) 兜底 1
   */
  function resolveAttackTimes(info) {
    var _info$CurrentAttackCo, _info$AttackCount, _info$data;

    if (!info) return 1;

    const pick = v => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return !Number.isNaN(n) && n >= 1 ? Math.floor(n) : null;
    }; // 1) 装备加成后的最终段数（服务端权威）


    const current = pick((_info$CurrentAttackCo = info.CurrentAttackCount) != null ? _info$CurrentAttackCo : info.currentAttackCount);
    if (current !== null) return current; // 2) 兼容老结构：顶层直传

    const direct = pick((_info$AttackCount = info.AttackCount) != null ? _info$AttackCount : info.attackCount);
    if (direct !== null) return direct; // 3) 装备累加：每件装备的 attackCount 为"该装备提供的段数加成"（0/1/2），
    //   总段数 = 1 + Σ(装备加成)

    const equip = info.equipment || (info == null || (_info$data = info.data) == null ? void 0 : _info$data.equipment);

    if (equip && typeof equip === 'object') {
      let sum = 0;
      let found = false;

      for (const slot of Object.keys(equip)) {
        const item = equip[slot];
        if (!item) continue;

        if (item.attackCount !== undefined && item.attackCount !== null) {
          sum += Number(item.attackCount) || 0;
          found = true;
          continue;
        }

        const text = (item == null ? void 0 : item.effecttext) || (item == null ? void 0 : item.effect_text) || '';
        const m = /攻击次数\s*\+\s*(\d+)/.exec(text || '');

        if (m) {
          sum += Number(m[1]);
          found = true;
        }
      }

      if (found) return Math.max(1, 1 + sum);
    }

    return 1;
  }
  /**
   * 「攻击次数」机制（设计见 docs/攻击次数机制设计.md）
   * ---------------------------------------------------------------
   * 规则（用户口径）：
   *   - 一次攻击的总伤害不变（仍是 damage = 攻击 − 防御）；
   *   - 把这一次攻击**拆成 N 段**：N = attackCount（AttackCount 字段，默认 1）；
   *   - 每段带小幅区间波动（如单段暴击 +X%），但**N 段总和相对单次伤害最多 +20%**，不离谱；
   *   - 默认倾向「不超发」：多数情况总伤 ≈ 原伤害（0%~+20% 区间内浮动）。
   *
   * @param attackCount 总段数（= 单位的 AttackCount 字段，默认 1）
   * 返回每段伤害数组（已取整，至少 1）；调用方依次扣血/弹数字。
   */


  function computeAttackSegments(baseDamage, attackCount, rng) {
    const total = Math.max(1, Math.floor(baseDamage));
    const segN = Math.max(1, Math.floor(attackCount || 1));

    if (segN <= 1) {
      return [total];
    }

    const rand = rng || Math.random; // 总体提升上限 20%：本轮实际提升量在 [0, 0.20] 内随机（偏向低值，避免每次都满 20%）

    const boost = Math.pow(rand(), 1.6) * 0.20;
    let grand = total * (1 + boost); // 每段权重大致均分，带 ±35% 的小幅波动（体现“每段有区间小变化”）

    const weights = [];
    let wsum = 0;

    for (let i = 0; i < segN; i++) {
      const w = 1.0 / segN * (0.65 + rand() * 0.70); // 0.65 ~ 1.35 相对权重

      weights.push(w);
      wsum += w;
    } // 归一化 + 取整，最后一段吸收舍入误差，保证总和 == floor(grand)


    const segs = [];
    let acc = 0;
    const targetTotal = Math.max(1, Math.floor(grand));

    for (let i = 0; i < segN; i++) {
      if (i === segN - 1) {
        segs.push(Math.max(1, targetTotal - acc));
      } else {
        const v = Math.max(1, Math.round(targetTotal * (weights[i] / wsum)));
        segs.push(v);
        acc += v;
      }
    }

    return segs;
  }

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

  function _reportPossibleCrUseOfBattleResumeController(extras) {
    _reporterNs.report("BattleResumeController", "./BattleResumeController", _context.meta, extras);
  }

  function _reportPossibleCrUseOfensureBattleResumeController(extras) {
    _reporterNs.report("ensureBattleResumeController", "./BattleResumeController", _context.meta, extras);
  }

  function _reportPossibleCrUseOfisActiveRoomConflict(extras) {
    _reporterNs.report("isActiveRoomConflict", "./battle-resume-gate", _context.meta, extras);
  }

  function _reportPossibleCrUseOfroomIdOf(extras) {
    _reporterNs.report("roomIdOf", "./battle-resume-gate", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleRoomStateLike(extras) {
    _reporterNs.report("BattleRoomStateLike", "./battle-resume-gate", _context.meta, extras);
  }

  function _reportPossibleCrUseOfresolveOnEnableAction(extras) {
    _reporterNs.report("resolveOnEnableAction", "./battle-entry-intent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfvalidateStoryBattleCreate(extras) {
    _reporterNs.report("validateStoryBattleCreate", "./battle-entry-intent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleEntryIntent(extras) {
    _reporterNs.report("BattleEntryIntent", "./battle-entry-intent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfvalidateBattleRestoreState(extras) {
    _reporterNs.report("validateBattleRestoreState", "./battle-restore", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryBattleFinishedResult(extras) {
    _reporterNs.report("StoryBattleFinishedResult", "./story-runtime-mode", _context.meta, extras);
  }

  function _reportPossibleCrUseOfLogger(extras) {
    _reporterNs.report("Logger", "../global/Logger", _context.meta, extras);
  }

  function _reportPossibleCrUseOfSkillSelectPanel(extras) {
    _reporterNs.report("SkillSelectPanel", "./SkillSelectPanel", _context.meta, extras);
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
      resources = _cc.resources;
      JsonAsset = _cc.JsonAsset;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      DataCacheManager = _unresolved_4.DataCacheManager;
    }, function (_unresolved_5) {
      RobotShow = _unresolved_5.RobotShow;
    }, function (_unresolved_6) {
      BattleResumeController = _unresolved_6.BattleResumeController;
      ensureBattleResumeController = _unresolved_6.ensureBattleResumeController;
    }, function (_unresolved_7) {
      isActiveRoomConflict = _unresolved_7.isActiveRoomConflict;
      roomIdOf = _unresolved_7.roomIdOf;
    }, function (_unresolved_8) {
      resolveOnEnableAction = _unresolved_8.resolveOnEnableAction;
      validateStoryBattleCreate = _unresolved_8.validateStoryBattleCreate;
    }, function (_unresolved_9) {
      validateBattleRestoreState = _unresolved_9.validateBattleRestoreState;
    }, function (_unresolved_10) {
      Logger = _unresolved_10.Logger;
    }, function (_unresolved_11) {
      SkillData = _unresolved_11;
    }, function (_unresolved_12) {
      SkillSelectPanel = _unresolved_12.SkillSelectPanel;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "90ca8rrJ/1FT4PR5nkVCiFP", "BattleScene", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button', 'tween', 'Tween', 'Vec3', 'UITransform', 'Sprite', 'SpriteAtlas', 'SpriteFrame', 'Color', 'resources', 'JsonAsset']);

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
        type: Button,
        tooltip: '技能按钮（BattleSelectButton/Skill）——点击打开技能选择面板'
      }), _dec10 = property({
        type: _crd && SkillSelectPanel === void 0 ? (_reportPossibleCrUseOfSkillSelectPanel({
          error: Error()
        }), SkillSelectPanel) : SkillSelectPanel,
        tooltip: '技能选择面板（场景内的 SkillSelect；选中技能后才出现「确认」）'
      }), _dec11 = property({
        type: Label,
        tooltip: '倒计时文本（Time/Number）'
      }), _dec12 = property({
        type: Node,
        tooltip: 'Time 根节点（可选，仅用于显隐控制）'
      }), _dec13 = property({
        type: Label,
        tooltip: '战斗日志文本（可选）'
      }), _dec14 = property({
        type: Node,
        tooltip: '匹配 Loading 面板（PVP 匹配中显示，可选）'
      }), _dec15 = property({
        type: Node,
        tooltip: '机甲属性面板根节点（场景内的 MechAttribute）'
      }), _dec16 = property({
        type: Sprite,
        tooltip: 'MechaClass 下 Player1 图标（Sprite）'
      }), _dec17 = property({
        type: SpriteFrame,
        tooltip: '格斗 gedou 图标（SpriteFrame）'
      }), _dec18 = property({
        type: SpriteFrame,
        tooltip: '全能 quanneng 图标（SpriteFrame）'
      }), _dec19 = property({
        type: SpriteFrame,
        tooltip: '射击 sheji 图标（SpriteFrame）'
      }), _dec20 = property({
        type: Sprite,
        tooltip: '敌方职业图标（Sprite）'
      }), _dec21 = property({
        type: SpriteFrame,
        tooltip: '敌方格斗 gedou 图标（SpriteFrame）'
      }), _dec22 = property({
        type: SpriteFrame,
        tooltip: '敌方全能 quanneng 图标（SpriteFrame）'
      }), _dec23 = property({
        type: SpriteFrame,
        tooltip: '敌方射击 sheji 图标（SpriteFrame）'
      }), _dec24 = property({
        type: Node,
        tooltip: '玩家角色显示根节点（PlayerShow，含 Player(Sprite) 与 Name(Label)）'
      }), _dec25 = property({
        type: Node,
        tooltip: '敌方角色显示根节点（EnemyPlayerShow，含 Player(Sprite) 与 Name(Label)）'
      }), _dec26 = property({
        type: [SpriteFrame],
        tooltip: '角色头像 SpriteFrames（与 Character 面板一致，Sprite=1 对应索引0）'
      }), _dec(_class = (_class2 = (_class3 = class BattleScene extends Component {
        constructor(...args) {
          super(...args);

          // 玩家与敌方的展示
          _initializerDefineProperty(this, "playerRobotShow", _descriptor, this);

          _initializerDefineProperty(this, "enemyRobotShow", _descriptor2, this);

          // 操作面板
          _initializerDefineProperty(this, "battleSelectPanel", _descriptor3, this);

          _initializerDefineProperty(this, "attackButton", _descriptor4, this);

          _initializerDefineProperty(this, "defendButton", _descriptor5, this);

          _initializerDefineProperty(this, "escapeButton", _descriptor6, this);

          _initializerDefineProperty(this, "backButton", _descriptor7, this);

          // ========= 新增：战斗内「技能」按钮 + 技能选择面板（SkillSelect） =========
          // 两者都可以留空：运行时按名字在场景里找（Skill / SkillSelect），找到后再兜底 addComponent。
          _initializerDefineProperty(this, "skillButton", _descriptor8, this);

          _initializerDefineProperty(this, "skillSelectPanel", _descriptor9, this);

          // 倒计时显示（Time/Number）
          _initializerDefineProperty(this, "timerLabel", _descriptor10, this);

          _initializerDefineProperty(this, "timerRoot", _descriptor11, this);

          // 简单战斗日志（可选）
          _initializerDefineProperty(this, "logLabel", _descriptor12, this);

          // 匹配 Loading 面板（PVP 匹配中显示）
          _initializerDefineProperty(this, "matchingLoadingPanel", _descriptor13, this);

          // ========= 新增：战斗中机甲属性面板（实时刷新当前出场机甲） =========
          _initializerDefineProperty(this, "mechAttributeRoot", _descriptor14, this);

          // ========= 新增：MechaClass/Player1 图标 =========
          // 图标帧由你在 Inspector 手动绑定（gedou / quanneng / sheji），避免依赖 spriteAtlas 命名/配置
          _initializerDefineProperty(this, "player1ClassIcon", _descriptor15, this);

          _initializerDefineProperty(this, "player1ClassIconGedou", _descriptor16, this);

          _initializerDefineProperty(this, "player1ClassIconQuanneng", _descriptor17, this);

          _initializerDefineProperty(this, "player1ClassIconSheji", _descriptor18, this);

          // ========= 新增：敌方职业图标 =========
          // 同样允许你在 Inspector 手动绑定帧，确保与当前 atlas/UI 配置无关
          _initializerDefineProperty(this, "enemy1ClassIcon", _descriptor19, this);

          _initializerDefineProperty(this, "enemy1ClassIconGedou", _descriptor20, this);

          _initializerDefineProperty(this, "enemy1ClassIconQuanneng", _descriptor21, this);

          _initializerDefineProperty(this, "enemy1ClassIconSheji", _descriptor22, this);

          // ========= 新增：左右角色形象与名字（PlayerShow / EnemyPlayerShow） =========
          _initializerDefineProperty(this, "playerShowRoot", _descriptor23, this);

          _initializerDefineProperty(this, "enemyPlayerShowRoot", _descriptor24, this);

          _initializerDefineProperty(this, "characterAvatarFrames", _descriptor25, this);

          this.ws = null;
          this.cacheManager = null;
          this.playerUnit = null;
          this.enemyUnit = null;
          this.state = BattleState.INIT;
          // 玩家操作倒计时（秒）
          this.TURN_TIME_LIMIT = 30;
          this.turnTimeLeft = 0;
          // 「空窗挽回期」：进入指令阶段后先静默观察 GRACE_SECONDS 秒，任一方/双方无操作才显示并启动倒计时
          this.GRACE_SECONDS = 5;

          /** 本回合空窗观察剩余秒数（>0 表示还在静默期，倒计时面板隐藏） */
          this.graceTimeLeft = 0;

          /** 倒计时是否已激活（激活后才显示「剩余时间」面板） */
          this.graceActive = false;

          /** PVP：已播放过动画的最大回合号，用于对服务端 pvp_round_update 推送去重 */
          this._lastPlayedPvpRound = 0;

          /** PVP：自己已提交本回合指令、正在等待对方（此期间倒计时继续显示，便于判断对方是否挂机） */
          this._waitingOpponent = false;

          /** PVP：倒计时归零后等待服务器推送的累计时长（秒），超过兜底自行提交普攻 */
          this._afterZeroWait = 0;
          // 动画控制
          this.isAnimating = false;

          /** 看门狗计时：ANIMATING 状态持续时长（秒），超阈值强制恢复，防止死锁 */
          this.animWatchdog = 0;
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
          this.enemyInfoListener = null;
          // 房间制战斗相关（默认开启，一场战斗一个房间，支持断线恢复）
          this.useServerRoomBattle = true;
          this.roomId = null;
          // 当前战斗房间 ID（PVE 单人一房间）
          this.isRequestingAction = false;
          // 正在向服务器发送指令中，防止重复点击
          this.currentBattleMode = 'pve';
          this._pvpFlatMatchInProgress = false;

          /** 修复点：会话标识，异步回调中校验，避免快速开关面板时旧回调覆盖新状态 */
          this._sessionId = 0;

          /**
           * 显式进入意图。onEnable 不得推测来源。
           * new-pve | story | resume | pvp
           */
          this._entryIntent = null;

          /** 已应用过的恢复 room_id，避免同房重复入场动画 */
          this._appliedRestoreRoomId = null;

          /** 剧情战斗结束回调与上下文（由 story intent 携带，不参与来源猜测） */
          this._storyBattleCallback = null;
          this._storyContext = null;

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
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 进入战斗房间超时：未能应用完整 room state，自动退出面板避免卡死');
            const storyCb = this._storyBattleCallback;

            if (storyCb) {
              this._storyBattleCallback = null;
              this._storyContext = null;
              storyCb({
                won: false,
                roomId: this.roomId || '',
                winner: 'enemy',
                reason: 'timeout',
                errMsg: '进入战斗超时，请重试'
              });
            }

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
           * 机甲列表响应处理（用于战斗场景）
           */
          this.onRobotPetsResponseForBattle = data => {
            var _this$node2, _this$ws$getCharacter, _this$ws;

            // 移除监听（只监听一次）
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
            if (!((_this$node2 = this.node) != null && _this$node2.isValid)) return;
            const success = data.success === true || data.success === 'true';

            if (!success) {
              var _data$data;

              this._abortBattleEntry(String(data.message || ((_data$data = data.data) == null ? void 0 : _data$data.message) || '获取机甲列表失败'));

              return;
            }

            const characterId = (_this$ws$getCharacter = (_this$ws = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter.call(_this$ws);

            if (characterId) {
              this.cacheManager.setRobotPetsCache(characterId, data);
            }

            const pets = this._extractPetsFromCache(data);

            if (pets.length === 0) {
              this._abortBattleEntry('你没有可用的机甲，无法进入战斗');

              return;
            }

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[BattleScene] 机甲列表数据已更新，开始战斗');
            this.startNewBattle();
          };

          /**
           * 机甲详情响应处理（用于战斗场景）
           */
          this.onRobotPetInfoResponseForBattle = data => {
            var _this$node3, _data$pet_id, _data$data3;

            // 移除监听（只监听一次）
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
            if (!((_this$node3 = this.node) != null && _this$node3.isValid)) return;
            const success = data.success === true || data.success === 'true';

            if (!success) {
              var _data$data2;

              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[BattleScene] 获取机甲详情失败，使用列表基础数据:', data.message || ((_data$data2 = data.data) == null ? void 0 : _data$data2.message));
              this.initPlayerUnitWithFallback();

              if (this.playerUnit) {
                this.initEnemyUnit();

                if (this.enemyUnit) {
                  this.scheduleOnce(() => this.beginBattleAfterReady(), 0.1);
                }
              } else {
                this._abortBattleEntry('获取机甲详情失败');
              }

              return;
            } // 更新缓存


            const petId = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data3 = data.data) == null ? void 0 : _data$data3.pet_id;

            if (petId) {
              this.cacheManager.setRobotPetInfoCache(String(petId), data);
            }

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[BattleScene] 机甲详情数据已更新，重新初始化玩家单位'); // 数据已更新，重新初始化

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
          } catch {} // 自动恢复由 BattleResumeController 统一负责（本组件只注册自身供恢复打开面板）


          (_crd && ensureBattleResumeController === void 0 ? (_reportPossibleCrUseOfensureBattleResumeController({
            error: Error()
          }), ensureBattleResumeController) : ensureBattleResumeController)().registerBattleScene(this); // 绑定按钮事件（使用 Button.EventType.CLICK 与项目其他模块一致）

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
          } // 技能按钮（BattleSelectButton/Skill）→ 打开技能选择面板。
          //   没在 Inspector 挂也没关系：按名字在战斗操作面板下找。


          const skillBtn = this.resolveSkillButton();

          if (skillBtn) {
            skillBtn.node.on(Button.EventType.CLICK, this.onSkillClicked, this);
          } // 技能选择面板：先确保组件在（找不到就 addComponent），并初始关闭（场景里可能留着显示状态）


          this.ensureSkillSelectPanel();
          this.closeSkillSelectPanel(); // 监听服务端主动推送的「PVP 回合结算」消息：
          //   挂机方从不发请求，靠该推送才能拿到新 state 并播放整回合动画（含自己被攻击）。

          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.PVP_ROUND_UPDATE, this.onPvpRoundUpdate, this); // 技能目录：技能名 / 特效名 / 能量消耗 / 可施放列表都从 Skills.json 读（服务端同源副本）

          this.loadSkillCatalog();
        }
        /**
         * 加载技能目录（`assets/resources/json/Skills.json`，v5）并注入 SkillData。
         *
         * 注入后 `SkillData` 才能提供：技能名/特效名查询、能量消耗、可施放技能列表（供后续技能面板接入）。
         * ⚠ 加载失败不影响战斗：结算与表现的全部权威数据都由服务端 state.round_events 下发，
         *   目录只用于「名称/特效/UI 列表」这类展示信息。
         */


        loadSkillCatalog() {
          try {
            resources.load('json/Skills', JsonAsset, (err, asset) => {
              if (err || !asset) {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn('[BattleScene] 技能目录 json/Skills 加载失败（仅影响技能名/列表展示）:', err);
                return;
              }

              const data = asset.json || null;
              SkillData.setSkillCatalog(data);
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).info(`[BattleScene] 技能目录已注入：v${data == null ? void 0 : data.version} / ` + `${Array.isArray(data == null ? void 0 : data.skills) ? data.skills.length : 0} 条`);
            });
          } catch (err) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 技能目录加载异常:', err);
          }
        }
        /** 修复点：onDestroy 解绑按钮，避免节点销毁后仍触发事件导致泄漏或报错 */


        onDestroy() {
          var _this$attackButton, _this$defendButton, _this$escapeButton, _this$backButton, _this$skillButton;

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

          if ((_this$skillButton = this.skillButton) != null && _this$skillButton.node) {
            this.skillButton.node.off(Button.EventType.CLICK, this.onSkillClicked, this);
          }

          this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.PVP_ROUND_UPDATE, this.onPvpRoundUpdate, this);
          this.clearPlayerInfoListener();
          this.clearEnemyInfoListener();

          try {
            (_crd && BattleResumeController === void 0 ? (_reportPossibleCrUseOfBattleResumeController({
              error: Error()
            }), BattleResumeController) : BattleResumeController).getInstance().unregisterBattleScene(this);
          } catch (_) {}
        }

        onEnable() {
          var _this$_entryIntent;

          const intent = (_this$_entryIntent = this._entryIntent) != null ? _this$_entryIntent : 'new-pve';
          const action = (_crd && resolveOnEnableAction === void 0 ? (_reportPossibleCrUseOfresolveOnEnableAction({
            error: Error()
          }), resolveOnEnableAction) : resolveOnEnableAction)(intent); // resume：状态已由 restoreFromServerState 同步应用，禁止 create / resume 网络请求

          if (action === 'resume-ready') {
            // 加固：恢复战斗时，若当前状态卡在「动画中」等中间态，强制回到指令阶段，
            //   避免残留的 ANIMATING 状态导致面板不可操作、无法退出。
            //   注意：FINISHED 是合法终态（战斗已结束），不能强制恢复。
            if (this.state !== BattleState.WAITING_COMMANDS && this.state !== BattleState.FINISHED) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn(`[BattleScene] resume-ready 状态异常(state=${this.state})，强制恢复指令阶段`);
              this.isAnimating = false;
              this.isRequestingAction = false;
              this.animWatchdog = 0;
              this.startCommandPhase();
            }

            this._syncBattlePortraitVisibility();

            return;
          } // story：CREATE 由 startStoryBattle 发起，此处不得退化随机 PVE


          if (action === 'story-wait') {
            this.prepareRobotShowsForNewBattle();

            this._syncBattlePortraitVisibility();

            return;
          } // 重置所有状态标志，确保每次打开都是干净的状态


          this._sessionId += 1;
          this.state = BattleState.INIT;
          this._roomStateApplied = false;
          this.isAnimating = false;
          this.isRequestingAction = false;
          this.pendingPlayerAction = null;
          this.pendingEnemyAction = null;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this.graceActive = false;
          this.graceTimeLeft = this.GRACE_SECONDS;
          this.lastRoundPlayerHp = 0;
          this.lastRoundEnemyHp = 0;
          this.lastRoundPlayerAction = null;
          this._lastPlayedPvpRound = 0;
          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          if (this.timerRoot) this.timerRoot.active = false;
          this.closeSkillSelectPanel();
          this.prepareRobotShowsForNewBattle();

          this._syncBattlePortraitVisibility();

          if (action === 'pvp-match') {
            this.startPvpFlatMatchFlow();
            return;
          } // new-pve：调用一次 create，不先 resume


          this._entryIntent = 'new-pve';

          if (this.useServerRoomBattle) {
            this.enterBattleRoom();
            this.unschedule(this._onBattleEnterTimeout);
            this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);
          } else {
            this.checkAndStartBattle();
          }
        }

        onDisable() {
          var _this$playerRobotShow, _this$enemyRobotShow;

          // 关键修复：关闭面板 ≠ 战斗结束。此前把 state 设为 FINISHED，会导致再次打开时
          //   onEnable 的 resume-ready 分支带着 FINISHED 状态进入，入场动画播完后
          //   startCommandPhase() 因 `state === FINISHED` 直接 return → 战斗卡死且退不出。
          //   这里只清理动画/请求锁（保留 FINISHED 供结算逻辑判断），状态复位交由 onEnable 分支处理。
          this.isAnimating = false;
          this.isRequestingAction = false;
          this.animWatchdog = 0; // 若当前不是「战斗结束」，说明是中途关闭面板，复位为 INIT，避免下次打开带着脏状态

          if (this.state !== BattleState.FINISHED) {
            this.state = BattleState.INIT;
          }

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
          this.clearPlayerInfoListener();
          this.clearEnemyInfoListener(); // 修复点：停止所有 Tween 和 schedule，避免禁用后回调仍执行导致状态错乱

          if ((_this$playerRobotShow = this.playerRobotShow) != null && _this$playerRobotShow.node) Tween.stopAllByTarget(this.playerRobotShow.node);
          if ((_this$enemyRobotShow = this.enemyRobotShow) != null && _this$enemyRobotShow.node) Tween.stopAllByTarget(this.enemyRobotShow.node);
          this.unscheduleAllCallbacks(); // 清理回合快照（防止第二次战斗时数据错乱）

          this.lastRoundPlayerHp = 0;
          this.lastRoundEnemyHp = 0;
          this.lastRoundPlayerAction = null; // 清理待处理动作

          this.pendingPlayerAction = null;
          this.pendingEnemyAction = null; // 离开面板 ≠ 战斗结束：不销毁房间、不清除 Controller 已恢复标记，避免重复入场
          // roomId / _appliedRestoreRoomId 保留，供再次打开或 resume 去重

          this._entryIntent = null;
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
          this._entryIntent = 'pvp';
        }

        startPvpFlatMatchFlow() {
          var _this$ws$getCharacter2, _this$ws2;

          const characterId = (_this$ws$getCharacter2 = (_this$ws2 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter2.call(_this$ws2);

          if (!characterId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] PVP 匹配：未获取到 characterId');
            this.node.active = false;
            return;
          }

          this._pvpFlatMatchInProgress = true;
          const sessionId = this._sessionId; // 匹配中先不“入场”：把双方机甲放回入场起点，并仅显示 Loading

          this.resetEntrancePositions(); // 匹配中 UI：只显示 Loading，禁止操作

          if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = true;
          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          if (this.timerRoot) this.timerRoot.active = false;
          this.setButtonsInteractable(false);

          const tryCloseIfStillMatching = () => {
            var _this$node4;

            if (!((_this$node4 = this.node) != null && _this$node4.isValid)) return;
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
            var _this$node5, _resp$data;

            if (!((_this$node5 = this.node) != null && _this$node5.isValid) || this._sessionId !== sessionId) return;
            this._pvpFlatMatchInProgress = false;
            if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;

            if (!(resp != null && resp.success) || !((_resp$data = resp.data) != null && _resp$data.state)) {
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
         * 剧情战斗入口：intent=story，必须携带 story_event_id + map_code（除非 skipServerAuth）。
         * 不得退化为普通随机 PVE。
         */


        startStoryBattle(opts) {
          var _this$ws$getCharacter3, _this$ws3;

          const validated = (_crd && validateStoryBattleCreate === void 0 ? (_reportPossibleCrUseOfvalidateStoryBattleCreate({
            error: Error()
          }), validateStoryBattleCreate) : validateStoryBattleCreate)({
            eventId: opts.eventId,
            mapCode: opts.mapCode,
            battleRef: opts.battleRef,
            skipServerAuth: opts.skipServerAuth
          });

          if (validated.ok === false) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 剧情战拒绝创建:', validated.reason);
            opts.onFinished({
              won: false,
              roomId: '',
              winner: 'enemy',
              reason: validated.reason,
              errMsg: validated.reason === 'missing_event_id' ? '缺少 event_id' : validated.reason === 'missing_map_code' ? '缺少 map_code' : '剧情战斗参数不完整'
            });
            return;
          }

          this._entryIntent = 'story';
          this._storyBattleCallback = opts.onFinished;
          this._storyContext = {
            eventId: opts.eventId,
            battleRef: opts.battleRef,
            mapCode: opts.mapCode
          };
          this.currentBattleMode = 'pve';
          this._sessionId += 1;
          this._roomStateApplied = false;
          this.unschedule(this._onBattleEnterTimeout);
          this.prepareRobotShowsForNewBattle();
          this.node.active = true;
          this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);
          const characterId = (_this$ws$getCharacter3 = (_this$ws3 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter3.call(_this$ws3);

          if (!characterId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 剧情战：未获取 characterId');
            opts.onFinished({
              won: false,
              roomId: '',
              winner: 'enemy',
              reason: 'no_character',
              errMsg: '未选择角色，无法进入战斗'
            });
            return;
          }

          const sessionId = this._sessionId;
          const createPayload = {
            character_id: characterId
          };

          if (!opts.skipServerAuth) {
            createPayload.story_event_id = opts.eventId;
            createPayload.map_code = opts.mapCode;
            if (opts.battleRef) createPayload.battle_ref = opts.battleRef;
          } else if (opts.battleRef) {
            createPayload.battle_ref = opts.battleRef;
          }

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_CREATE, createPayload, createResp => {
            var _this$node6, _createResp$data;

            if (!((_this$node6 = this.node) != null && _this$node6.isValid) || this._sessionId !== sessionId) return;

            if ((_crd && isActiveRoomConflict === void 0 ? (_reportPossibleCrUseOfisActiveRoomConflict({
              error: Error()
            }), isActiveRoomConflict) : isActiveRoomConflict)(createResp)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug('[BattleScene] 剧情 create 冲突：转统一恢复');
              this._storyBattleCallback = null;
              this._storyContext = null;
              this._entryIntent = null;
              this.node.active = false;
              (_crd && ensureBattleResumeController === void 0 ? (_reportPossibleCrUseOfensureBattleResumeController({
                error: Error()
              }), ensureBattleResumeController) : ensureBattleResumeController)().scheduleCheck('story_create_conflict');
              return;
            }

            if (!(createResp != null && createResp.success) || !((_createResp$data = createResp.data) != null && _createResp$data.state)) {
              var _this$_storyBattleCal;

              const msg = (createResp == null ? void 0 : createResp.message) || '剧情战斗房间创建失败';
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 剧情战斗房间创建失败', createResp);
              (_this$_storyBattleCal = this._storyBattleCallback) == null || _this$_storyBattleCal.call(this, {
                won: false,
                roomId: '',
                winner: 'enemy',
                reason: 'create_failed',
                errMsg: msg
              });
              this._storyBattleCallback = null;
              this._storyContext = null;
              this._entryIntent = null;
              this.node.active = false;
              return;
            }

            this.applyServerRoomState(createResp.data.state, true);
          }, true, 12000);
        }
        /**
         * 玩家明确发起普通新战斗：直接 battle_room_create。
         * 自动恢复不走此路径（由 BattleResumeController 负责）。
         * 若服务端返回已有活动房间冲突 → 转统一恢复，不二次 create。
         */


        enterBattleRoom() {
          var _this$ws$getCharacter4, _this$ws4;

          const characterId = (_this$ws$getCharacter4 = (_this$ws4 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter4.call(_this$ws4);

          if (!characterId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 未获取到 characterId，无法进入战斗房间');
            return;
          }

          const sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_CREATE, {
            character_id: characterId
          }, createResp => {
            var _this$node7, _createResp$data2;

            if (!((_this$node7 = this.node) != null && _this$node7.isValid) || this._sessionId !== sessionId) return;

            if ((_crd && isActiveRoomConflict === void 0 ? (_reportPossibleCrUseOfisActiveRoomConflict({
              error: Error()
            }), isActiveRoomConflict) : isActiveRoomConflict)(createResp)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug('[BattleScene] create 冲突：已有活动房间，转 BattleResumeController');
              this.node.active = false;
              (_crd && ensureBattleResumeController === void 0 ? (_reportPossibleCrUseOfensureBattleResumeController({
                error: Error()
              }), ensureBattleResumeController) : ensureBattleResumeController)().scheduleCheck('create_conflict');
              return;
            }

            if (!(createResp != null && createResp.success) || !((_createResp$data2 = createResp.data) != null && _createResp$data2.state)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 创建战斗房间失败:', (createResp == null ? void 0 : createResp.message) || createResp);
              this.roomId = null;
              this.state = BattleState.FINISHED;
              this.pendingPlayerAction = null;
              this.pendingEnemyAction = null;
              this.isAnimating = false;
              this.isRequestingAction = false;
              this.setButtonsInteractable(true);
              this.node.active = false;
              return;
            }

            this.applyServerRoomState(createResp.data.state, true);
          }, true, 10000);
        }
        /**
         * 统一恢复入口：同步校验并应用服务端状态。
         * 成功返回 true；失败返回 false，且不改变当前 roomId、不标记已恢复。
         * resume 意图下不发起任何网络请求、不 create。
         */


        restoreFromServerState(state) {
          var _this$ws$getCharacter5, _this$ws5;

          const characterId = (_this$ws$getCharacter5 = (_this$ws5 = this.ws) == null || _this$ws5.getCharacterId == null ? void 0 : _this$ws5.getCharacterId()) != null ? _this$ws$getCharacter5 : null;
          const validated = (_crd && validateBattleRestoreState === void 0 ? (_reportPossibleCrUseOfvalidateBattleRestoreState({
            error: Error()
          }), validateBattleRestoreState) : validateBattleRestoreState)(state, characterId);

          if (validated.ok === false) {
            const rejectReason = validated.reason;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error(`[BattleScene] restore rejected: ${rejectReason}`);
            return false;
          }

          const prevRoomId = this.roomId;
          const prevApplied = this._appliedRestoreRoomId;
          const prevIntent = this._entryIntent;

          try {
            this._entryIntent = 'resume';
            this.applyServerRoomState(state, false);

            if (!this.roomId) {
              // apply 未成功写入 room（例如内部早退）
              this.roomId = prevRoomId;
              this._appliedRestoreRoomId = prevApplied;
              this._entryIntent = prevIntent;
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] restore apply did not set roomId');
              return false;
            }

            this.log('已恢复战斗连接，状态已同步');
            return true;
          } catch (e) {
            this.roomId = prevRoomId;
            this._appliedRestoreRoomId = prevApplied;
            this._entryIntent = prevIntent;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] restore apply exception', e);
            return false;
          }
        }
        /**
         * 将服务器房间状态映射到本地 BattleScene（HP/属性/UI）
         * @param state 服务器返回的房间状态
         * @param isNewRoom 是否是新创建的房间（true=新房间需要播放动画，false=恢复房间直接设置位置）
         * @param forRoundAnimation 若为 true：仅同步单位/展示数据，不调用 finishBattle、不显示操作面板（用于本回合动画播完后再收尾）
         */


        applyServerRoomState(state, isNewRoom = false, forRoundAnimation = false) {
          var _ref5, _playerRaw$Class, _playerRaw$data, _ref6, _enemyRaw$Class, _enemyRaw$data;

          if (!state) return;
          const incomingRoomId = (_crd && roomIdOf === void 0 ? (_reportPossibleCrUseOfroomIdOf({
            error: Error()
          }), roomIdOf) : roomIdOf)(state); // 同一 room 已恢复过：仅同步数据，不重复入场动画

          if (!forRoundAnimation && !isNewRoom && incomingRoomId && this._appliedRestoreRoomId === incomingRoomId && this._roomStateApplied) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug(`[BattleScene] skip duplicate restore animation room_id=${incomingRoomId}`);
            return;
          }

          if (isNewRoom && !forRoundAnimation) {
            this.prepareRobotShowsForNewBattle();
          } // 根据服务器返回的模式切换：PVP 可能需要更长的 action 等待时间（双方都提交完才结算）


          this.currentBattleMode = (state == null ? void 0 : state.mode) === 'pvp' ? 'pvp' : 'pve';
          this.roomId = state.room_id || state.roomId || null;

          if (!isNewRoom && incomingRoomId) {
            this._appliedRestoreRoomId = incomingRoomId;
          } // 修复点：应用进行中房间状态前清空战斗日志，避免上一场「玩家胜利/失败」残留导致误以为「直接胜利/击败」


          if (state.status !== 'finished') {
            this.logClear();
          }

          const playerActor = state.player;
          const enemyActor = state.enemy;

          if (!playerActor || !enemyActor) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 房间状态缺少 player/enemy');
            return;
          } // 只要拿到并解析出了 player/enemy，就认为“进入房间应用成功”，取消兜底超时


          this._roomStateApplied = true;
          this.unschedule(this._onBattleEnterTimeout); // 使用服务器 actor.raw 作为原始属性来源

          const playerRaw = playerActor.raw || {};
          const enemyRaw = enemyActor.raw || {};
          this.playerUnit = this.buildUnitFromRobotInfo('player', playerRaw.pet_id || '', playerRaw, playerActor.name || '玩家机甲');
          this.enemyUnit = this.buildUnitFromRobotInfo('enemy', enemyRaw.pet_id || '', enemyRaw, enemyActor.name || '敌方机甲'); // 覆盖实时 HP / MP / 攻防 / 出手值

          if (this.playerUnit) {
            var _ref, _playerActor$max_hp, _playerActor$hp, _ref2, _playerActor$max_mp, _playerActor$mp, _playerActor$attack, _playerActor$defense, _playerActor$initiati;

            this.playerUnit.maxHp = Number((_ref = (_playerActor$max_hp = playerActor.max_hp) != null ? _playerActor$max_hp : playerActor.maxHp) != null ? _ref : this.playerUnit.maxHp);
            this.playerUnit.hp = Number((_playerActor$hp = playerActor.hp) != null ? _playerActor$hp : this.playerUnit.hp);
            this.playerUnit.maxMp = Number((_ref2 = (_playerActor$max_mp = playerActor.max_mp) != null ? _playerActor$max_mp : playerActor.maxMp) != null ? _ref2 : this.playerUnit.maxMp);
            this.playerUnit.mp = Number((_playerActor$mp = playerActor.mp) != null ? _playerActor$mp : this.playerUnit.mp);
            this.playerUnit.attack = Number((_playerActor$attack = playerActor.attack) != null ? _playerActor$attack : this.playerUnit.attack);
            this.playerUnit.defense = Number((_playerActor$defense = playerActor.defense) != null ? _playerActor$defense : this.playerUnit.defense);
            this.playerUnit.initiative = Number((_playerActor$initiati = playerActor.initiative) != null ? _playerActor$initiati : this.playerUnit.initiative);
          }

          if (this.enemyUnit) {
            var _ref3, _enemyActor$max_hp, _enemyActor$hp, _ref4, _enemyActor$max_mp, _enemyActor$mp, _enemyActor$attack, _enemyActor$defense, _enemyActor$initiativ;

            this.enemyUnit.maxHp = Number((_ref3 = (_enemyActor$max_hp = enemyActor.max_hp) != null ? _enemyActor$max_hp : enemyActor.maxHp) != null ? _ref3 : this.enemyUnit.maxHp);
            this.enemyUnit.hp = Number((_enemyActor$hp = enemyActor.hp) != null ? _enemyActor$hp : this.enemyUnit.hp);
            this.enemyUnit.maxMp = Number((_ref4 = (_enemyActor$max_mp = enemyActor.max_mp) != null ? _enemyActor$max_mp : enemyActor.maxMp) != null ? _ref4 : this.enemyUnit.maxMp);
            this.enemyUnit.mp = Number((_enemyActor$mp = enemyActor.mp) != null ? _enemyActor$mp : this.enemyUnit.mp);
            this.enemyUnit.attack = Number((_enemyActor$attack = enemyActor.attack) != null ? _enemyActor$attack : this.enemyUnit.attack);
            this.enemyUnit.defense = Number((_enemyActor$defense = enemyActor.defense) != null ? _enemyActor$defense : this.enemyUnit.defense);
            this.enemyUnit.initiative = Number((_enemyActor$initiativ = enemyActor.initiative) != null ? _enemyActor$initiativ : this.enemyUnit.initiative);
          } // 根据出场职业（Class）刷新 Player1 图标（重连/恢复战斗也会走到这里）


          const classValue = Number((_ref5 = (_playerRaw$Class = playerRaw == null ? void 0 : playerRaw.Class) != null ? _playerRaw$Class : playerRaw == null || (_playerRaw$data = playerRaw.data) == null ? void 0 : _playerRaw$data.Class) != null ? _ref5 : 1);
          this.updatePlayer1ClassIcon(classValue); // 根据出场职业（Class）刷新 敌人职业图标（重连/恢复战斗也会走到这里）

          const enemyClassValue = Number((_ref6 = (_enemyRaw$Class = enemyRaw == null ? void 0 : enemyRaw.Class) != null ? _enemyRaw$Class : enemyRaw == null || (_enemyRaw$data = enemyRaw.data) == null ? void 0 : _enemyRaw$data.Class) != null ? _ref6 : 1);
          this.updateEnemy1ClassIcon(enemyClassValue); // 更新 RobotShow 展示

          if (this.playerRobotShow) {
            try {
              this.playerRobotShow.updateFromRobotData(playerRaw);
            } catch {}
          }

          if (this.enemyRobotShow) {
            try {
              this.enemyRobotShow.updateFromRobotData(enemyRaw);
            } catch {}
          }

          if (!forRoundAnimation) {
            const enemyCid = enemyActor != null && enemyActor.character_id ? String(enemyActor.character_id) : null;
            this.refreshPlayerAndEnemyShows(enemyCid);
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
            const winner = state.result.winner === 'player' ? 'player' : 'enemy';
            const reason = state.result.reason === 'escape' ? 'escape' : 'ko';
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
            }; // 恢复战斗：按服务器 state 还原「空窗挽回期」状态与剩余时间，不重置为 30 秒
            //   - grace_active=True  → 倒计时已在跑，显示面板并从服务器剩余秒数续跑；
            //   - grace_active=False → 仍在 5 秒静默观察期，隐藏面板（若服务器给了 grace 剩余则用它）。

            this.restoreGraceWindowFromState(state);

            if (this.battleSelectPanel) {
              this.battleSelectPanel.active = true;
            }

            this.setButtonsInteractable(true);
            this.refreshBattleBarsVisibilityAndValue();
          }
        }
        /** 战斗时显示双方局内血条并刷新为当前 HP / MP（与机甲属性面板一致） */


        refreshBattleBarsVisibilityAndValue() {
          if (this.playerRobotShow) {
            this.playerRobotShow.setBattleBarsVisible(true);

            if (this.playerUnit) {
              this.playerRobotShow.updateBattleBars(this.playerUnit.hp, this.playerUnit.maxHp, this.playerUnit.mp, this.playerUnit.maxMp);
            }
          }

          if (this.enemyRobotShow) {
            this.enemyRobotShow.setBattleBarsVisible(true);

            if (this.enemyUnit) {
              this.enemyRobotShow.updateBattleBars(this.enemyUnit.hp, this.enemyUnit.maxHp, this.enemyUnit.mp, this.enemyUnit.maxMp);
            }
          }
        }
        /**
         * 从服务器房间 state 解析本回合指令阶段剩余秒数（恢复战斗时倒计时不重置为 30）
         * 支持字段：remaining_command_seconds / remaining_seconds / command_remaining_seconds（秒）、command_deadline_ts（截止时间戳 ms）、round_start_ts / round_start_time（回合开始时间戳 ms，用 30 - 已过秒数）
         */


        _getRemainingCommandSecondsFromState(state) {
          var _ref7, _n, _n2, _ref8, _n3;

          const limit = this.TURN_TIME_LIMIT;
          if (!state || typeof state !== 'object') return limit;

          const n = v => v != null && typeof v === 'number' && !Number.isNaN(v) ? v : null;

          const now = Date.now(); // 1) 直接剩余秒数（多种命名）

          const direct = (_ref7 = (_n = n(state.remaining_command_seconds)) != null ? _n : n(state.remaining_seconds)) != null ? _ref7 : n(state.command_remaining_seconds);
          if (direct != null && direct >= 0) return Math.min(limit, Math.ceil(direct)); // 2) 截止时间戳（毫秒）

          const deadline = (_n2 = n(state.command_deadline_ts)) != null ? _n2 : n(state.command_deadline_ms);

          if (deadline != null) {
            const sec = (deadline - now) / 1000;
            if (sec > 0) return Math.min(limit, Math.ceil(sec));
          } // 3) 回合开始时间戳（毫秒），剩余 = 30 - 已过秒数


          const startTs = (_ref8 = (_n3 = n(state.round_start_ts)) != null ? _n3 : n(state.round_start_time)) != null ? _ref8 : n(state.command_phase_start_ts);

          if (startTs != null) {
            const elapsed = (now - startTs) / 1000;
            const remain = limit - elapsed;
            if (remain > 0) return Math.ceil(remain);
          }

          return limit;
        }
        /**
         * 从服务器 state 还原「空窗挽回期」状态：
         *   - grace_active=True  → 倒计时已激活：显示面板，turnTimeLeft 续用服务器剩余秒数；
         *   - grace_active=False → 仍在静默观察期：隐藏面板，graceTimeLeft 用服务器 grace 截止时间推算（无则重置为满）。
         */


        restoreGraceWindowFromState(state) {
          const n = v => v != null && typeof v === 'number' && !Number.isNaN(v) ? v : null;

          this._waitingOpponent = false;
          this._afterZeroWait = 0;
          const activeRaw = state == null ? void 0 : state.grace_active;
          const active = activeRaw === true || activeRaw === 1 || activeRaw === 'true' || activeRaw === '1';

          if (active) {
            this.graceActive = true;
            this.turnTimeLeft = this._getRemainingCommandSecondsFromState(state);
            if (this.timerRoot) this.timerRoot.active = true;
            this.updateTimerLabel();
            return;
          } // 静默期


          this.graceActive = false;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          let graceLeft = this.GRACE_SECONDS;
          const graceDl = n(state == null ? void 0 : state.grace_deadline_ts);

          if (graceDl != null) {
            graceLeft = Math.max(0, (graceDl - Date.now()) / 1000);
          } else {
            const startTs = n(state == null ? void 0 : state.command_phase_start_ts);

            if (startTs != null) {
              graceLeft = Math.max(0, this.GRACE_SECONDS - (Date.now() - startTs) / 1000);
            }
          }

          this.graceTimeLeft = graceLeft;
          if (this.timerRoot) this.timerRoot.active = false;
          this.updateTimerLabel();
        }
        /**
         * 直接将机甲设置到战斗位置（用于恢复房间时，不需要动画）
         */


        setBattlePositionsDirectly() {
          var _this$playerRobotShow2, _this$enemyRobotShow2;

          const playerNode = (_this$playerRobotShow2 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow2.node;
          const enemyNode = (_this$enemyRobotShow2 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow2.node;
          if (!playerNode || !enemyNode) return; // 确保位置已缓存

          this.cacheEntranceAndBattlePositionsIfNeeded();

          if (!this.battlePlayerPos || !this.battleEnemyPos) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 战斗位置未缓存，使用默认位置');
            return;
          } // 直接设置到战斗位置


          playerNode.setPosition(this.battlePlayerPos);
          enemyNode.setPosition(this.battleEnemyPos);
        }

        cacheEntranceAndBattlePositionsIfNeeded() {
          var _this$playerRobotShow3, _this$enemyRobotShow3;

          const playerNode = (_this$playerRobotShow3 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow3.node;
          const enemyNode = (_this$enemyRobotShow3 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow3.node;
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

          const playerNode = (_this$playerRobotShow4 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow4.node;
          const enemyNode = (_this$enemyRobotShow4 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow4.node;
          if (!playerNode || !enemyNode) return;
          this.cacheEntranceAndBattlePositionsIfNeeded();
          if (this.entrancePlayerPos) playerNode.setPosition(this.entrancePlayerPos);
          if (this.entranceEnemyPos) enemyNode.setPosition(this.entranceEnemyPos);
        }
        /** 本地模拟战（useServerRoomBattle=false）无法开战时关闭面板 */


        _abortBattleEntry(errMsg) {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).error('[BattleScene]', errMsg);
          this.node.active = false;
        }
        /**
         * 检查缓存并开始战斗（如果缓存为空则先请求数据）
         */


        checkAndStartBattle() {
          var _this$ws$getCharacter6, _this$ws6;

          const characterId = (_this$ws$getCharacter6 = (_this$ws6 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter6.call(_this$ws6);

          if (!characterId) {
            this._abortBattleEntry('未选择角色，无法进入战斗');

            return;
          }

          const listCache = this.cacheManager.getRobotPetsCache(characterId);
          let pets = [];

          if (listCache) {
            if (listCache.data && Array.isArray(listCache.data.pets)) {
              pets = listCache.data.pets;
            } else if (Array.isArray(listCache.pets)) {
              pets = listCache.pets;
            }
          } // 如果缓存为空，先请求机甲列表数据


          if (!pets || pets.length === 0) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[BattleScene] 机甲列表缓存为空，正在请求数据...');
            this.requestRobotPetsAndStart();
            return;
          } // 缓存有数据，直接开始战斗


          this.startNewBattle();
        }
        /**
         * 请求机甲列表数据，收到响应后开始战斗
         */


        requestRobotPetsAndStart() {
          var _this$ws$getCharacter7, _this$ws7;

          const characterId = (_this$ws$getCharacter7 = (_this$ws7 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter7.call(_this$ws7);

          if (!characterId) {
            this._abortBattleEntry('未选择角色，无法进入战斗');

            return;
          } // 监听机甲列表响应


          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this); // 发送请求

          const requestData = {
            character_id: characterId,
            page: 0,
            page_size: 50
          };
          const userId = this.ws.getUserId();

          if (userId) {
            requestData.user_id = userId;
          }

          this.ws.notify((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PETS, requestData, true);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[BattleScene] 已发送机甲列表请求，等待响应...');
        }

        _extractPetsFromCache(raw) {
          const data = raw != null && raw.data && typeof raw.data === 'object' ? raw.data : raw;
          if (data != null && data.data && Array.isArray(data.data.pets)) return data.data.pets;
          if (Array.isArray(data == null ? void 0 : data.pets)) return data.pets;
          return [];
        }

        _normPetId(id) {
          return String(id || '').trim().toLowerCase();
        }

        _battleTeamFromCache(listCache) {
          var _ref9, _listCache$battle_tea, _listCache$data, _listCache$data2;

          const raw = (_ref9 = (_listCache$battle_tea = listCache == null ? void 0 : listCache.battle_team) != null ? _listCache$battle_tea : listCache == null || (_listCache$data = listCache.data) == null ? void 0 : _listCache$data.battle_team) != null ? _ref9 : listCache == null || (_listCache$data2 = listCache.data) == null || (_listCache$data2 = _listCache$data2.data) == null ? void 0 : _listCache$data2.battle_team;
          if (!Array.isArray(raw)) return [];
          return raw.map(x => String(x)).filter(x => x);
        }
        /** 优先出战队伍第一位，否则列表第一只有效机甲 */


        _pickBattlePet(pets, battleTeam) {
          if (!(pets != null && pets.length)) return null;

          const norm = id => this._normPetId(id);

          if (battleTeam.length > 0) {
            const bid = battleTeam[0];
            const matched = pets.find(p => norm(String(p.pet_id || p._id || p.id || '')) === norm(bid));

            if (matched) {
              const petId = String(matched.pet_id || matched._id || matched.id || '');
              if (petId) return {
                petId,
                firstPet: matched
              };
            }
          }

          const firstPet = pets[0];
          const petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');
          if (!petId) return null;
          return {
            petId,
            firstPet
          };
        }

        _applyPlayerPetFromInfo(petId, info) {
          var _ref10, _Class, _data;

          this.playerUnit = this.buildUnitFromRobotInfo('player', petId, info, '玩家机甲');

          if (this.playerRobotShow && info) {
            try {
              const dataForShow = { ...info,
                pet_id: petId
              };
              this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
          }

          this.ensureMechAttributeInited();
          this.refreshPlayerMechAttributeUI(true);
          this.startAttributeAutoRefresh();
          const classValue = Number((_ref10 = (_Class = info == null ? void 0 : info.Class) != null ? _Class : info == null || (_data = info.data) == null ? void 0 : _data.Class) != null ? _ref10 : 1);
          this.updatePlayer1ClassIcon(classValue);
          this.initEnemyUnit();
        }

        startNewBattle() {
          this.logClear();
          this.state = BattleState.INIT;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this.graceActive = false;
          this.graceTimeLeft = this.GRACE_SECONDS;
          this._lastPlayedPvpRound = 0;
          this.updateTimerLabel(); // 每次开战都先把双方位置重置到入场起点

          this.resetEntrancePositions();

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示
          }

          this.closeSkillSelectPanel(); // 刷新“玩家/敌人角色形象+名字”

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
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 双方单位未完全初始化，无法开始战斗');
            return;
          } // 进入指令选择阶段前的本地提示（不再发送未注册的 battle_start；正式开战走 battle_room_*）


          this.log('战斗开始！进入指令选择阶段（双方先选，再按出手值结算）'); // 播放入场平移动画，动画完成后开始第一回合的指令选择

          this.playEntranceAnimation();
        }
        /**
         * 入场平移动画：双方从左右各偏移300的位置，1秒内平移到目标位置
         */


        playEntranceAnimation() {
          var _this$playerRobotShow5, _this$enemyRobotShow5;

          const playerNode = (_this$playerRobotShow5 = this.playerRobotShow) == null ? void 0 : _this$playerRobotShow5.node;
          const enemyNode = (_this$enemyRobotShow5 = this.enemyRobotShow) == null ? void 0 : _this$enemyRobotShow5.node;

          if (!playerNode || !enemyNode) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 入场动画：缺少 RobotShow 节点，跳过动画直接开始战斗');
            this.startCommandPhase();
            return;
          } // 固定起点/终点（避免每次打开叠加）


          this.cacheEntranceAndBattlePositionsIfNeeded();

          if (!this.entrancePlayerPos || !this.entranceEnemyPos || !this.battlePlayerPos || !this.battleEnemyPos) {
            this.startCommandPhase();
            return;
          }

          const playerStartPos = this.entrancePlayerPos.clone();
          const enemyStartPos = this.entranceEnemyPos.clone();
          const playerTargetPos = this.battlePlayerPos.clone();
          const enemyTargetPos = this.battleEnemyPos.clone(); // 每次动画都先强制回到起点

          playerNode.setPosition(playerStartPos);
          enemyNode.setPosition(enemyStartPos); // 动画时长：1秒

          const animDuration = 1.0; // 玩家和敌人同时平移到目标位置

          let playerAnimDone = false;
          let enemyAnimDone = false;

          const checkAllDone = () => {
            this.log(`[入场动画] playerDone=${playerAnimDone} enemyDone=${enemyAnimDone}`);

            if (playerAnimDone && enemyAnimDone) {
              // 动画完成，开始第一回合的指令选择
              this.startCommandPhase();
            }
          }; // 超时保底：入场动画 1s，若 2.5s 后仍未进入指令阶段（tween 回调丢失），强制开始，避免卡死


          this.scheduleOnce(() => {
            if (!(playerAnimDone && enemyAnimDone)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[BattleScene] 入场动画超时未回调，强制进入指令阶段');
              playerAnimDone = true;
              enemyAnimDone = true;
              checkAllDone();
            }
          }, 2.5); // 玩家平移动画

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
          var _this$ws$getCharacter8, _this$ws8;

          const characterId = (_this$ws$getCharacter8 = (_this$ws8 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter8.call(_this$ws8);

          if (!characterId) {
            this._abortBattleEntry('未选择角色，无法进入战斗');

            return;
          }

          const listCache = this.cacheManager.getRobotPetsCache(characterId);

          const pets = this._extractPetsFromCache(listCache);

          if (!pets || pets.length === 0) {
            this._abortBattleEntry('你没有可用的机甲，无法进入战斗');

            return;
          }

          const cachedTeam = this._battleTeamFromCache(listCache);

          const sessionId = this._sessionId;

          const finishPick = battleTeam => {
            var _this$node8;

            if (!((_this$node8 = this.node) != null && _this$node8.isValid) || this._sessionId !== sessionId) return;

            const picked = this._pickBattlePet(pets, battleTeam);

            if (!picked) {
              this._abortBattleEntry('你没有可用的机甲，无法进入战斗');

              return;
            }

            const {
              petId,
              firstPet
            } = picked;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug(`[BattleScene] 使用机甲: ${petId}`);
            let info = this.cacheManager.getRobotPetInfoCache(petId);

            if (!info) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[BattleScene] 未找到机甲详情缓存，正在请求详情数据...');
              this.requestRobotPetInfoAndInit(petId, firstPet);
              return;
            }

            if (info.data) info = info.data;

            this._applyPlayerPetFromInfo(petId, info);
          }; // 仍请求服务端出战队伍；失败或未设置时回退缓存/列表首只（与 battle_room_handler 对齐）


          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_BATTLE_TEAM, {
            character_id: characterId
          }, resp => {
            var _this$node9;

            if (!((_this$node9 = this.node) != null && _this$node9.isValid) || this._sessionId !== sessionId) return;
            let battleTeam = [];

            if (resp != null && resp.success && resp.data && Array.isArray(resp.data.battle_team)) {
              battleTeam = resp.data.battle_team.map(x => String(x)).filter(x => x);
            }

            if (battleTeam.length > 0) {
              finishPick(battleTeam);
              return;
            }

            if (!(resp != null && resp.success)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[BattleScene] GET_BATTLE_TEAM 失败，尝试缓存/列表回退:', resp == null ? void 0 : resp.message);
            }

            finishPick(cachedTeam.length > 0 ? cachedTeam : []);
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
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug(`[BattleScene] 已发送机甲详情请求 (pet_id: ${petId})，等待响应...`);
        }

        /**
         * 使用列表中的基础数据初始化玩家单位（备用方案）
         */
        initPlayerUnitWithFallback() {
          var _this$ws$getCharacter9, _this$ws9, _Class2;

          const characterId = (_this$ws$getCharacter9 = (_this$ws9 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter9.call(_this$ws9);

          if (!characterId) {
            return;
          }

          const listCache = this.cacheManager.getRobotPetsCache(characterId);

          const pets = this._extractPetsFromCache(listCache);

          const cachedTeam = this._battleTeamFromCache(listCache);

          const picked = this._pickBattlePet(pets, cachedTeam);

          if (!picked) {
            return;
          }

          const {
            petId,
            firstPet
          } = picked;
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn('[BattleScene] 使用列表中的基础数据构建玩家单位（可能缺少完整属性）');
          this.playerUnit = this.buildUnitFromRobotInfo('player', petId, firstPet, '玩家机甲');

          if (this.playerRobotShow) {
            try {
              const dataForShow = { ...firstPet,
                pet_id: petId
              };
              this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
          }

          this.ensureMechAttributeInited();
          this.refreshPlayerMechAttributeUI(true);
          this.startAttributeAutoRefresh();
          const classValue = Number((_Class2 = firstPet == null ? void 0 : firstPet.Class) != null ? _Class2 : 1);
          this.updatePlayer1ClassIcon(classValue);
        }
        /**
         * 敌方单位：目前先简单复用玩家属性做随机偏移（后续由服务器提供正式接口）
         * 为保持与服务器成长公式一致，后续可以改为直接请求服务器生成一只敌人机甲。
         */


        initEnemyUnit() {
          if (!this.playerUnit) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[BattleScene] 玩家单位未初始化，无法构建敌人单位');
            return;
          } // 敌人由服务器生成（随机角色 + 满装备 + 最终属性 + 装备限制）


          const playerPetId = this.playerUnit.petId;
          this.enemyUnit = null;
          this.isEnemyGenerating = true;
          const sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_GENERATE_ENEMY, {
            player_pet_id: playerPetId || undefined
          }, resp => {
            var _this$node10, _resp$data2, _ref11, _enemy$CurrentMelee, _ref12, _enemy$CurrentShootin, _ref13, _enemy$CurrentArmor, _enemy$MaxHP, _enemy$CurrentHP, _enemy$MaxMP, _enemy$CurrentMP, _ref14, _enemy$CurrentInitiat;

            this.isEnemyGenerating = false;
            if (!((_this$node10 = this.node) != null && _this$node10.isValid) || this._sessionId !== sessionId) return;

            if (!resp || resp.success === false) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 生成敌人失败:', (resp == null ? void 0 : resp.message) || (resp == null ? void 0 : resp.error) || resp);
              return;
            }

            const enemy = resp.enemy || ((_resp$data2 = resp.data) == null ? void 0 : _resp$data2.enemy) || null;

            if (!enemy) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 生成敌人失败：响应缺少 enemy 字段', resp);
              return;
            }

            const melee = Number((_ref11 = (_enemy$CurrentMelee = enemy.CurrentMelee) != null ? _enemy$CurrentMelee : enemy.Melee) != null ? _ref11 : 0);
            const shoot = Number((_ref12 = (_enemy$CurrentShootin = enemy.CurrentShooting) != null ? _enemy$CurrentShootin : enemy.Shooting) != null ? _ref12 : 0);
            const armor = Number((_ref13 = (_enemy$CurrentArmor = enemy.CurrentArmor) != null ? _enemy$CurrentArmor : enemy.Armor) != null ? _ref13 : 0);
            const maxHp = Number((_enemy$MaxHP = enemy.MaxHP) != null ? _enemy$MaxHP : 1000);
            const hp = Number((_enemy$CurrentHP = enemy.CurrentHP) != null ? _enemy$CurrentHP : maxHp);
            const maxMp = Number((_enemy$MaxMP = enemy.MaxMP) != null ? _enemy$MaxMP : 0);
            const mp = Number((_enemy$CurrentMP = enemy.CurrentMP) != null ? _enemy$CurrentMP : maxMp);
            const initiative = Number((_ref14 = (_enemy$CurrentInitiat = enemy.CurrentInitiative) != null ? _enemy$CurrentInitiat : enemy.Initiative) != null ? _ref14 : 10); // 攻击次数：与玩家/在线路径一致，敌方也要带 attackTimes，否则 computeAttackSegments 只能按 1 段处理

            const attackTimes = resolveAttackTimes(enemy);
            this.enemyUnit = {
              side: 'enemy',
              name: enemy.RobotName || '敌方机甲',
              level: Number(enemy.Level || 1),
              maxHp,
              hp,
              maxMp,
              mp,
              attack: melee + shoot,
              defense: armor,
              initiative,
              attackTimes,
              petId: undefined,
              rawData: enemy
            };

            if (this.enemyRobotShow) {
              try {
                this.enemyRobotShow.updateFromRobotData(enemy);
              } catch (e) {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).error('[BattleScene] 更新敌人 RobotShow 失败:', e);
              }
            }

            if (this.state === BattleState.INIT && this.playerUnit && this.enemyUnit) {
              this.beginBattleAfterReady();
            }
          }, true, 10000);
        }

        buildUnitFromRobotInfo(side, petId, info, defaultName) {
          var _ref15, _ref16, _info$MaxHP, _ref17, _info$CurrentHP, _ref18, _info$MaxMP, _ref19, _info$CurrentMP, _ref20, _info$Melee, _ref21, _info$Shooting, _ref22, _info$Armor, _ref23, _info$Initiative;

          const name = (info == null ? void 0 : info.RobotName) || (info == null ? void 0 : info.name) || defaultName;
          const level = Number((info == null ? void 0 : info.Level) || (info == null ? void 0 : info.level) || 1); // 属性字段命名尽量兼容现有 MechAttributeTEST 使用的键

          const maxHp = Number((_ref15 = (_ref16 = (_info$MaxHP = info == null ? void 0 : info.MaxHP) != null ? _info$MaxHP : info == null ? void 0 : info.max_hp) != null ? _ref16 : info == null ? void 0 : info.hp) != null ? _ref15 : 100);
          const hp = Number((_ref17 = (_info$CurrentHP = info == null ? void 0 : info.CurrentHP) != null ? _info$CurrentHP : info == null ? void 0 : info.current_hp) != null ? _ref17 : maxHp); // 能量：老数据可能没有 MP 字段 → 0（该单位不参与「能量恢复」）

          const maxMp = Number((_ref18 = (_info$MaxMP = info == null ? void 0 : info.MaxMP) != null ? _info$MaxMP : info == null ? void 0 : info.max_mp) != null ? _ref18 : 0);
          const mp = Number((_ref19 = (_info$CurrentMP = info == null ? void 0 : info.CurrentMP) != null ? _info$CurrentMP : info == null ? void 0 : info.current_mp) != null ? _ref19 : maxMp);
          const melee = Number((_ref20 = (_info$Melee = info == null ? void 0 : info.Melee) != null ? _info$Melee : info == null ? void 0 : info.melee) != null ? _ref20 : 0);
          const shoot = Number((_ref21 = (_info$Shooting = info == null ? void 0 : info.Shooting) != null ? _info$Shooting : info == null ? void 0 : info.shoot) != null ? _ref21 : 0);
          const armor = Number((_ref22 = (_info$Armor = info == null ? void 0 : info.Armor) != null ? _info$Armor : info == null ? void 0 : info.armor) != null ? _ref22 : 0);
          const attack = melee + shoot;
          const defense = armor;
          const initiative = Number((_ref23 = (_info$Initiative = info == null ? void 0 : info.Initiative) != null ? _info$Initiative : info == null ? void 0 : info.initiative) != null ? _ref23 : 10); // 攻击次数：优先直接字段，其次从装备累加（装备「攻击次数+N」已在服务端写入属性或 equipment）

          const attackTimes = resolveAttackTimes(info);
          return {
            side,
            name,
            level,
            maxHp,
            hp,
            maxMp,
            mp,
            attack,
            defense,
            initiative,
            attackTimes,
            petId,
            rawData: info
          };
        }

        determineFirstTurn() {
          if (!this.playerUnit || !this.enemyUnit) return; // 保留方法：用于回合结算时决定出手顺序（不再用于“是否立即行动”）
        }
        /**
         * 指令选择阶段：双方都先选指令（当前敌方默认普攻，但不会提前出手）
         *
         * 「空窗挽回期」：进入指令阶段后**不立即倒计时**，先静默观察 GRACE_SECONDS 秒；
         *   任一方/双方无操作满 5 秒才显示并启动「剩余时间」倒计时（见 update）。
         */


        startCommandPhase() {
          var _this$attackButton2, _this$battleSelectPan;

          if (this.state === BattleState.FINISHED) {
            this.log('[指令阶段] 被跳过：战斗已结束');
            return;
          }

          this.state = BattleState.WAITING_COMMANDS;
          this.pendingPlayerAction = null; // 敌方 AI：默认普攻（后续可扩展技能/物品）

          this.pendingEnemyAction = {
            side: 'enemy',
            type: 'ATTACK'
          }; // 空窗挽回期：先进入静默观察，不显示倒计时

          this.enterGraceWindow();

          if (this.battleSelectPanel) {
            this.battleSelectPanel.active = true;
          }

          this.setButtonsInteractable(true);
          this.refreshBattleBarsVisibilityAndValue();
          this.log(`[指令阶段] 已恢复操作，按钮可点=${!!((_this$attackButton2 = this.attackButton) != null && _this$attackButton2.interactable)}，面板=${!!((_this$battleSelectPan = this.battleSelectPanel) != null && _this$battleSelectPan.active)}`);
        }
        /**
         * 进入空窗观察期：隐藏「剩余时间」面板，开始静默 GRACE_SECONDS 秒
         */


        enterGraceWindow() {
          this.graceActive = false;
          this.graceTimeLeft = this.GRACE_SECONDS;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this._waitingOpponent = false;
          this._afterZeroWait = 0; // 静默期不显示倒计时面板

          if (this.timerRoot) this.timerRoot.active = false;
          this.updateTimerLabel();
        }
        /**
         * 激活倒计时：空窗满 5 秒后调用，显示「剩余时间」面板并开始计时
         */


        activateGraceCountdown() {
          if (this.graceActive) return;
          this.graceActive = true;
          this.turnTimeLeft = this.TURN_TIME_LIMIT;
          this._afterZeroWait = 0;
          if (this.timerRoot) this.timerRoot.active = true;
          this.updateTimerLabel();
          this.log('[空窗] 无操作满 5 秒，开始倒计时');
        }

        update(dt) {
          // 看门狗：ANIMATING 状态若长时间未推进（回调链断裂），强制恢复到指令阶段，避免战斗死锁
          //   注意：请求等待（isRequestingAction）期间也计时，但阈值更宽松（20s），防止请求永不返回时死锁
          if (this.state === BattleState.ANIMATING) {
            this.animWatchdog += dt; // 请求等待期（isRequestingAction）的阈值需覆盖服务端「空窗挽回期」最坏耗时：
            //   PVP = 空窗静默 5s + 倒计时 30s = 35s，故 PVP 取 45s；PVE 无空窗，20s 足够。

            let limit = 12;

            if (this.isRequestingAction) {
              limit = this.currentBattleMode === 'pvp' ? 45 : 20;
            }

            if (this.animWatchdog > limit) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn(`[BattleScene] 看门狗：ANIMATING 超时(${limit}s)，强制恢复指令阶段`);
              this.log('[看门狗] 动画超时未推进，强制恢复操作');
              this.animWatchdog = 0;
              this.isAnimating = false;
              this.isRequestingAction = false;
              this._waitingOpponent = false;
              this.startCommandPhase();
            }
          } else {
            this.animWatchdog = 0;
          } // 等待指令阶段，或「自己已提交、正在等对方」期间 —— 都需要推进空窗/倒计时。
          //   后者保证：自己 5 秒后点了操作，但对方仍未动时，倒计时继续走完，玩家能看到对方是否挂机。


          const tickingCommands = this.state === BattleState.WAITING_COMMANDS || this.state === BattleState.ANIMATING && this.isRequestingAction && this._waitingOpponent;

          if (tickingCommands) {
            if (!this.graceActive) {
              // 阶段一：空窗静默观察期（不显示倒计时）。任一方/双方无操作满 5 秒才激活倒计时。
              this.graceTimeLeft -= dt;

              if (this.graceTimeLeft <= 0) {
                this.graceTimeLeft = 0;
                this.activateGraceCountdown();
              }
            } else {
              // 阶段二：倒计时已激活，正常倒计时
              this.turnTimeLeft -= dt;

              if (this.turnTimeLeft <= 0) {
                this.turnTimeLeft = 0;
                this.updateTimerLabel(); // 倒计时归零：技能选择面板一并关掉（游戏原机制 —— 到点就关面板、改走普通攻击）

                this.closeSkillSelectPanel(); // 服务器制 PVP：倒计时归零后的「自动补普攻」由服务端权威执行，
                //   并通过 pvp_round_update 主动推送回双方。客户端优先等待推送，
                //   避免自行发送的 ATTACK 被写进「下一回合」（玩家未决策却自动出招）。

                if (!this.isAnimating && !this._waitingOpponent && this.state === BattleState.WAITING_COMMANDS) {
                  if (this.useServerRoomBattle && this.roomId) {
                    // 兜底：推送最多再等 3 秒；仍无响应则自行提交普攻，防止网络丢包导致永久卡住。
                    this._afterZeroWait += dt;

                    if (this._afterZeroWait >= 3) {
                      this.log('倒计时结束且未收到服务器推送，兜底自动普攻');
                      this.sendBattleRoomAction('ATTACK');
                    }
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
        }

        updateTimerLabel() {
          if (!this.timerLabel) return;
          this.timerLabel.string = `${Math.ceil(this.turnTimeLeft)}`; // 显示条件：等待指令 + 倒计时已激活；或自己已提交、正等对方（此期间倒计时继续可见）

          if (this.timerRoot) {
            const show = this.graceActive && (this.state === BattleState.WAITING_COMMANDS || this.state === BattleState.ANIMATING && this.isRequestingAction && this._waitingOpponent);
            this.timerRoot.active = show;
          }
        }

        setButtonsInteractable(enable) {
          if (this.attackButton) this.attackButton.interactable = enable;
          if (this.defendButton) this.defendButton.interactable = enable;
          if (this.escapeButton) this.escapeButton.interactable = enable;
          if (this.skillButton) this.skillButton.interactable = enable; // 返回键始终可点：保证任何时候都有逃生通道（卡死时也能恢复/退出）

          if (this.backButton) this.backButton.interactable = true;
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
        } // ====== 技能按钮 / 技能选择面板（SkillSelect） ======

        /** 找「技能」按钮：优先 Inspector 绑定，其次在战斗操作面板里按名字找（BattleSelectButton/Skill） */


        resolveSkillButton() {
          if (this.skillButton && this.skillButton.isValid) return this.skillButton;
          const root = this.battleSelectPanel || this.node;
          const node = root ? root.getChildByName('Skill') || this.findChildByName(root, 'Skill') : null;
          const btn = node ? node.getComponent(Button) : null;

          if (btn) {
            this.skillButton = btn;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).info('[BattleScene] 技能按钮已由运行时查找绑定：' + node.name);
          } else {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 没找到技能按钮（期望 BattleSelectButton/Skill）');
          }

          return btn;
        }
        /**
         * 确保技能选择面板组件存在。
         * 面板节点 = `BattleScene/SkillSelect`（场景里已搭好）；组件没挂就运行时 `addComponent` 兜底
         * （与机甲面板 `MechSkillPanel` 的零挂载风格一致）。
         */


        ensureSkillSelectPanel() {
          if (this.skillSelectPanel && this.skillSelectPanel.isValid) return this.skillSelectPanel;
          const node = this.findChildByName(this.node, 'SkillSelect');

          if (!node) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 没找到技能选择面板节点（期望 BattleScene/SkillSelect）');
            return null;
          }

          let comp = node.getComponent(_crd && SkillSelectPanel === void 0 ? (_reportPossibleCrUseOfSkillSelectPanel({
            error: Error()
          }), SkillSelectPanel) : SkillSelectPanel);
          if (!comp) comp = node.addComponent(_crd && SkillSelectPanel === void 0 ? (_reportPossibleCrUseOfSkillSelectPanel({
            error: Error()
          }), SkillSelectPanel) : SkillSelectPanel);
          this.skillSelectPanel = comp; // 场景里可能留着显示状态 → 战斗未开始/未点技能前一律不显示

          if (node.active) node.active = false;
          return comp;
        }
        /** 关闭技能选择面板（幂等；`notify=false` 不触发 onClosed，避免与战斗流程互相递归） */


        closeSkillSelectPanel() {
          const panel = this.skillSelectPanel;
          if (panel && panel.isValid && panel.isOpen()) panel.close(false);
        }
        /**
         * 点「技能」按钮 → 打开 / 收起技能选择面板。
         *
         * 面板里的技能来自服务端 `skill_list`（该机甲**已学且可主动施放**的技能，含能量消耗与可用性）；
         * 面板内部「点技能槽 = 选中 → 出现确认 → 确认即施放」，确认后回调 `castSkill()`。
         * 打开期间倒计时照常走（游戏原有机制），归零由 `update()` 关面板并自动普攻。
         */


        onSkillClicked() {
          var _this$playerUnit;

          if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[BattleScene] 技能按钮被忽略：state=${this.state}`);
            return;
          }

          const panel = this.ensureSkillSelectPanel();
          if (!panel) return; // 已打开 → 再点一次收起（等同「返回」）

          if (panel.isOpen()) {
            panel.close();
            return;
          }

          const petId = ((_this$playerUnit = this.playerUnit) == null ? void 0 : _this$playerUnit.petId) || null;

          if (!petId) {
            this.log('未找到出战机甲，暂时无法选择技能');
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 技能面板打开失败：playerUnit.petId 为空');
            return;
          }

          panel.open(petId, {
            // 确认 → 用该技能提交本回合指令（服务端校验「已学 + 能量足够 + 主动技」）
            onConfirm: skillKey => {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).info(`[BattleScene] 技能面板确认，施放「${skillKey}」`);
              this.castSkill(skillKey);
            }
          });
          this.log('打开技能选择面板');
        }
        /**
         * 【技能指令入口】提交一次技能施放（供后续技能面板 / UI 调用）。
         *
         * 与服务端同口径：`{ type: 'SKILL', skill_key }`，服务端会校验「已学 + 能量足够 + 是主动技」。
         * 返回 true 表示已发出请求；false 表示当前不在指令阶段（或缺少 skill_key）。
         *
         * @param skillKey 技能 key / 中文名 / 技能书 id 均可（客户端会先归一成 key）
         */


        castSkill(skillKey) {
          var _SkillData$resolveSki;

          if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[BattleScene] castSkill 被忽略：state=${this.state}`);
            return false;
          }

          const key = (_SkillData$resolveSki = SkillData.resolveSkillRef(skillKey)) != null ? _SkillData$resolveSki : skillKey == null ? null : String(skillKey);

          if (!key) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] castSkill 缺少有效 skill_key:', skillKey);
            return false;
          }

          if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('SKILL', key);
            return true;
          } // 本地模拟模式：保留旧逻辑（本地模拟暂不结算技能，按待机处理）


          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn('[BattleScene] 本地模拟模式暂不结算技能，本回合按待机处理');
          this.pendingPlayerAction = {
            side: 'player',
            type: 'SKILL'
          };
          this.tryResolveRound();
          return true;
        }
        /**
         * 房间制：向服务器提交一次指令，并用返回的新 state 刷新 UI + 播放本地动画
         * 伤害和胜负全部以服务器为准，本地只负责表现。
         *
         * @param action  ATTACK / DEFEND / ESCAPE / SKILL
         * @param skillKey 仅 SKILL 需要（key / 名称 / 技能书 id，会被归一成 key）
         */


        sendBattleRoomAction(action, skillKey) {
          var _this$ws$getCharacter10, _this$ws10;

          if (!this.roomId || this.isRequestingAction) return;
          const characterId = (_this$ws$getCharacter10 = (_this$ws10 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter10.call(_this$ws10);
          if (!characterId) return; // 【空窗挽回期】玩家主动操作 → 通知服务端解除本方关窗计数（_clear_side_noop）。
          //   但「剩余时间」面板不隐藏：若自己已提交、对方仍未操作，倒计时继续走完，
          //   让玩家能直观看到对方是否挂机（走完由服务端自动补普攻结算）。

          this._waitingOpponent = true;

          if (!this.graceActive) {
            // 自己是在 5 秒静默期内操作的：对方此前可能也一直没动 → 立即激活倒计时展示
            this.activateGraceCountdown();
          } // 记录本回合开始前的 HP 快照和玩家动作


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
          this.setButtonsInteractable(false); // 进入动画等待态并启动看门狗计时，保证后续任何一环断链都能被 update() 兜底恢复

          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.animWatchdog = 0; // 关闭操作面板（已提交本回合指令，无需再点）；但「剩余时间」面板保持可见并可继续倒计时，
          //   让玩家能看到对方是否仍在挂机（需求：自己操作后倒计时继续，直到对方也操作）。

          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          this.closeSkillSelectPanel(); // 已提交指令 → 技能面板一并收起

          if (this.timerRoot) this.timerRoot.active = this.graceActive; // 组包：技能指令额外带 skill_key（服务端归一后校验「已学 + 能量足够 + 主动技」）

          const payload = {
            room_id: this.roomId,
            action_type: action,
            character_id: characterId
          };

          if (action === 'SKILL') {
            var _SkillData$resolveSki2;

            const key = skillKey ? (_SkillData$resolveSki2 = SkillData.resolveSkillRef(skillKey)) != null ? _SkillData$resolveSki2 : skillKey : null;

            if (!key) {
              // 兜底：技能 key 丢失时按普攻提交，避免服务端 400 后本回合彻底卡住
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[BattleScene] 技能指令缺少可识别的 skill_key，已改为提交普攻');
              payload.action_type = 'ATTACK';
            } else {
              payload.skill_key = key;
            }
          }

          const sessionId = this._sessionId;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BATTLE_ROOM_ACTION, payload, resp => {
            var _this$node11, _resp$data3, _state$round;

            this.isRequestingAction = false;
            this._waitingOpponent = false;
            if (!((_this$node11 = this.node) != null && _this$node11.isValid) || this._sessionId !== sessionId) return;

            if (!(resp != null && resp.success) || !((_resp$data3 = resp.data) != null && _resp$data3.state)) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] battle_room_action 失败:', (resp == null ? void 0 : resp.message) || resp);
              this.state = BattleState.WAITING_COMMANDS;
              this.isAnimating = false;
              this.setButtonsInteractable(true); // 修复点：请求失败时恢复操作面板显示，便于玩家重试

              if (this.battleSelectPanel) this.battleSelectPanel.active = true;
              return;
            }

            const state = resp.data.state;

            if (!this.playerUnit || !this.enemyUnit || this.lastRoundPlayerAction == null) {
              var _this$node12;

              // 关键兜底：缺快照/单位时绝不能直接 return —— 那会让 state 永远停在 ANIMATING，
              //   面板不显示、按钮不可点、退不出（战斗卡死）。
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn(`[BattleScene] 回合数据缺失，跳过动画直接恢复操作：` + `playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit} lastAction=${this.lastRoundPlayerAction}`);
              this.applyServerRoomState(state, false, true);
              this.state = BattleState.INIT;
              this.isAnimating = false;
              this.isRequestingAction = false;
              this.animWatchdog = 0;
              if ((_this$node12 = this.node) != null && _this$node12.isValid) this.startCommandPhase();
              return;
            } // 标记本回合已由自己路径播放，避免随后的 pvp_round_update 推送重复播


            const respRound = Number((_state$round = state == null ? void 0 : state.round) != null ? _state$round : 0);

            if (this.currentBattleMode === 'pvp' && respRound > 0) {
              this._lastPlayedPvpRound = Math.max(this._lastPlayedPvpRound, respRound - 1);
            } // 共用「按服务器 state 播整回合动画」的逻辑


            this.playRoundFromServerState(state, this.lastRoundPlayerAction, this.lastRoundPlayerHp, this.lastRoundEnemyHp);
          }, true, // PVP 最坏情况：空窗静默 5s + 倒计时 30s = 35s，服务器才结算返回。
          //   请求超时必须大于该上限（留 10s 余量），否则会在服务器结算前被客户端提前判超时。
          this.currentBattleMode === 'pvp' ? 45000 : 10000);
        }

        onBackClicked() {
          // 【联动】技能选择面板开着时，返回键先关技能面板（不退出战斗、也不切换操作面板）
          const skillPanel = this.skillSelectPanel;

          if (skillPanel && skillPanel.isValid && skillPanel.isOpen()) {
            skillPanel.close();
            return;
          } // 正常情况：只在指令选择阶段开关面板


          if (this.state === BattleState.WAITING_COMMANDS) {
            if (!this.battleSelectPanel) return;
            this.battleSelectPanel.active = !this.battleSelectPanel.active;
            return;
          } // 逃生通道：非指令阶段（动画卡住 / 状态异常）时，点返回键强制恢复操作，避免彻底无法操作


          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[BattleScene] 返回键在非指令阶段被点击（state=${this.state}），强制恢复指令阶段`);
          this.isAnimating = false;
          this.isRequestingAction = false;
          this.animWatchdog = 0;
          this.startCommandPhase();
        } // ========== 战斗核心 ==========


        getUnit(side) {
          return side === 'player' ? this.playerUnit : this.enemyUnit;
        }

        getOpponent(side) {
          return side === 'player' ? this.enemyUnit : this.playerUnit;
        }
        /**
         * 伤害数字的弧形方向：向**受击者身后**（被击退的方向）抛出。
         * 攻击方在左 → 受击者在右 → 数字向右（+）；
         * 攻击方在右 → 受击者在左 → 数字向左（−）。
         * 自己方受击同理（数字从自己身上向自己身后飞出，远离攻击方）。
         * 返回的 y 仅作兼容占位（弧线由 RobotShow 内的重力自动生成）。
         */


        damageDriftFor(attackerSide) {
          const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
          const aNode = attackerShow == null ? void 0 : attackerShow.node;
          const dNode = defenderShow == null ? void 0 : defenderShow.node; // 用屏幕世界坐标判断左右（UI 下 worldPosition 即屏幕坐标）

          const ax = aNode ? aNode.worldPosition.x : 0;
          const dx = dNode ? dNode.worldPosition.x : 0; // 受击者在攻击者屏幕右侧 → +1（数字向右飞）；左侧 → −1

          const dir = dx >= ax ? 1 : -1;
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[方向诊断] 攻方=${attackerSide} 攻屏幕x=${ax.toFixed(0)} 守屏幕x=${dx.toFixed(0)} → 期望屏幕方向=${dir}`);
          return {
            x: dir,
            y: 0
          };
        }

        performAttack(attackerSide, onDone) {
          var _attacker$rawData, _attacker$rawData2;

          const attacker = this.getUnit(attackerSide);
          const defender = this.getOpponent(attackerSide);
          if (!attacker || !defender) return;
          if (this.state === BattleState.FINISHED) return;
          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.setButtonsInteractable(false);
          const rawDamage = attacker.attack - defender.defense;
          const damage = Math.max(1, rawDamage); // 伤害数字漂移方向：远离攻击方（与击退方向一致），形成"连续冒出→旧的后退消失"的轨迹

          const drift = this.damageDriftFor(attackerSide); // 「攻击次数」：把这一次攻击拆成 N 段（总伤上限 +20%），逐段扣血/弹数字

          const segments = computeAttackSegments(damage, attacker.attackTimes);

          const applySegments = onApplied => {
            let i = 0;
            const defenderShowRef = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
            let applied = false;

            const step = () => {
              if (i < segments.length) {
                defender.hp = Math.max(0, defender.hp - segments[i]);

                if (defenderShowRef) {
                  defenderShowRef.showDamageNumber(segments[i], false, drift.x, drift.y);
                }

                this.syncUnitHpToRawData(defender);
                i++;

                if (i < segments.length) {
                  // 包匿名闭包：避免同一 callback 引用被 Cocos 去重导致调度丢失
                  this.scheduleOnce(() => step(), 0.18);
                  return;
                }
              }

              if (applied) return;
              applied = true;
              onApplied();
            };

            step();
          };

          this.log(`${attackerSide === 'player' ? '玩家' : '敌人'} 普攻造成 ${damage} 点伤害` + (segments.length > 1 ? `（攻击 ${attacker.attack} - 防御 ${defender.defense}，分 ${segments.length} 段）` : `（攻击 ${attacker.attack} - 防御 ${defender.defense}）`)); // 判定是否为“远程攻击”（是否装备枪械）

          const attackerEquip = ((_attacker$rawData = attacker.rawData) == null ? void 0 : _attacker$rawData.equipment) || ((_attacker$rawData2 = attacker.rawData) == null || (_attacker$rawData2 = _attacker$rawData2.data) == null ? void 0 : _attacker$rawData2.equipment) || {};
          const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id); // 播放攻击动画（根据是否有枪械区分远程/近战）

          const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow; // 结算与收尾解耦：
          //   · 逐段扣血 + 弹伤害数字 → 挂在「接触到对方」的瞬间启动（onImpact）
          //   · 死亡判定 / 解锁 → 必须等「动画播完」且「分段结算完」两者到齐

          let segStarted = false;
          let segDone = false;
          let animFinished = false;

          const afterAll = () => {
            if (!segDone || !animFinished) return;

            if (defender.side === 'player') {
              this.refreshPlayerMechAttributeUI(true);
            } // 检查是否有人死亡


            if (defender.hp <= 0) {
              const winner = attacker.side;
              this.log(`${winner === 'player' ? '玩家' : '敌人'} 获胜！`);
              const defeatedShow = winner === 'player' ? this.enemyRobotShow : this.playerRobotShow;

              if (defeatedShow) {
                this.playDefeatAnimation(defeatedShow, () => this.finishBattle(winner, 'ko'));
              } else {
                this.finishBattle(winner, 'ko');
              }

              return;
            } // 单次攻击完成


            this.isAnimating = false;
            onDone();
          };

          const startSegments = () => {
            if (segStarted) return;
            segStarted = true;

            try {
              applySegments(() => {
                segDone = true;
                afterAll();
              });
            } catch (e) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 本地段结算异常，强制收尾:', e);
              segDone = true;
              this.isAnimating = false;
              onDone();
            }
          };

          this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, // onComplete：动画播完（兜底启动分段结算 + 补齐收尾条件）
          () => {
            animFinished = true;
            startSegments();
            afterAll();
          }, // onImpact：接触到对方的瞬间 —— 只弹伤害数字（**普攻不播技能特效**，2026-09-30 用户要求去掉）
          () => {
            startSegments();
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

          this.closeSkillSelectPanel();
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
          const playerFirst = this.playerUnit.initiative > this.enemyUnit.initiative || this.playerUnit.initiative === this.enemyUnit.initiative;
          const first = playerFirst ? 'player' : 'enemy';
          const second = playerFirst ? 'enemy' : 'player';
          const firstAction = first === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;
          const secondAction = second === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;

          const execAction = (side, action, done) => {
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
              this.log(`${side === 'player' ? '玩家' : '敌人'} 选择了防御/待机（本回合不行动）`); // 给一点点时间作为“动作占位”，避免过于突兀

              this.scheduleOnce(done, 0.15);
              return;
            } // 其他动作暂未实现：先当作待机


            this.log(`${side === 'player' ? '玩家' : '敌人'} 动作(${action.type})暂未实现，本回合跳过`);
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
            var _this$node13;

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[BattleScene] playServerRoundAnimation 单位缺失，直接恢复操作 playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit}`);
            this.state = BattleState.INIT;
            this.isAnimating = false;
            this.isRequestingAction = false;
            this.animWatchdog = 0;
            if ((_this$node13 = this.node) != null && _this$node13.isValid) this.startCommandPhase();
            return;
          } // 逃跑：服务器已经把结果算好了，这里只做简单提示和 finish


          if (playerAction === 'ESCAPE') {
            var _serverState$result, _serverState$result2;

            this.log('你选择了逃跑，本次战斗失败。');
            const winner = (serverState == null || (_serverState$result = serverState.result) == null ? void 0 : _serverState$result.winner) === 'player' ? 'player' : 'enemy';
            const reason = (serverState == null || (_serverState$result2 = serverState.result) == null ? void 0 : _serverState$result2.reason) === 'escape' ? 'escape' : 'ko';
            this.scheduleOnce(() => {
              this.finishBattle(winner, reason);
            }, 0.3);
            return;
          }

          const playerFirst = this.playerUnit.initiative > this.enemyUnit.initiative || this.playerUnit.initiative === this.enemyUnit.initiative;
          const order = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];

          const runAction = (side, done) => {
            if (this.state === BattleState.FINISHED) {
              done();
              return;
            }

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[攻击诊断] runAction side=${side} state=${this.state}`);

            if (side === 'player') {
              if (playerAction === 'ATTACK' && damageToEnemy > 0) {
                this.performAttackWithDamage('player', damageToEnemy, done);
              } else if (playerAction === 'DEFEND') {
                this.log('玩家选择了防御/待机（本回合不行动）');
                this.scheduleOnce(done, 0.15);
              } else {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn(`[攻击诊断] 玩家攻击被跳过：playerAction=${playerAction} damageToEnemy=${damageToEnemy}`);
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
                if (this.state === BattleState.FINISHED) return;
                this.finishRoundPresentation(serverState, targetPlayerHp, targetEnemyHp);
              });
            }, 1.0);
          });
        }
        /**
         * 回合收尾（两条演绎路径共用）：
         *   1) 把 HP 落到「攻击结算后、被动恢复前」的值；
         *   2) 播回合结束被动恢复（生命恢复 / 能量恢复）；
         *   3) 按服务器结果判胜负（播击破动画）或回到指令阶段。
         *
         * ⚠ 服务端给的 hp 是「攻击结算 + 被动恢复」后的最终值，算伤害前必须先把恢复量剥掉，
         *   否则本回合伤害会被少算（伤害数字偏小、与真实掉血不符）。
         */


        finishRoundPresentation(serverState, targetPlayerHp, targetEnemyHp) {
          const peList = side => {
            var _serverState$round_pa;

            const l = serverState == null || (_serverState$round_pa = serverState.round_passive_effects) == null ? void 0 : _serverState$round_pa[side];
            return Array.isArray(l) ? l : [];
          };

          const hpBack = (side, finalHp) => Math.max(0, finalHp - peList(side).reduce((s, e) => s + ((e == null ? void 0 : e.attr) === 'hp' ? Number(e.value) || 0 : 0), 0));

          if (this.playerUnit) {
            this.playerUnit.hp = hpBack('player', targetPlayerHp);
            this.syncUnitHpToRawData(this.playerUnit);
          }

          if (this.enemyUnit) {
            this.enemyUnit.hp = hpBack('enemy', targetEnemyHp);
            this.syncUnitHpToRawData(this.enemyUnit);
          }

          this.refreshPlayerMechAttributeUI(true); // 回合结束被动恢复表现（生命恢复 / 能量恢复）：特效 + 治疗数字 + 血/蓝条

          this.playPassiveRecoverEffects(serverState, () => {
            if (this.state === BattleState.FINISHED) return; // 根据服务器结果收尾：击杀/胜负在双方动画都播完后才结束战斗，符合回合制常规体验

            if ((serverState == null ? void 0 : serverState.status) === 'finished' && serverState.result) {
              const winner = serverState.result.winner === 'player' ? 'player' : 'enemy';
              const reason = serverState.result.reason === 'escape' ? 'escape' : 'ko'; // 胜负已定：为被击破的一方播放同款击破动画（敌我一致），再结束战斗

              const defeatedShow = winner === 'player' ? this.enemyRobotShow : this.playerRobotShow;

              if (defeatedShow) {
                this.playDefeatAnimation(defeatedShow, () => {
                  if (this.state !== BattleState.FINISHED) this.finishBattle(winner, reason);
                });
              } else {
                this.scheduleOnce(() => {
                  if (this.state !== BattleState.FINISHED) this.finishBattle(winner, reason);
                }, 0.5);
              }
            } else {
              // 修复点：双方动画都结束后再延迟一小段时间才显示操作面板，避免「动作未播完就出按钮」
              this.scheduleOnce(() => {
                if (this.state !== BattleState.FINISHED) this.startCommandPhase();
              }, this.COMMAND_PANEL_DELAY_AFTER_ANIMATIONS);
            }
          });
        } // ========== 服务端出手明细（round_events）演绎 ==========

        /**
         * 按服务端「出手明细」`serverState.round_events` 演绎一整个回合。
         *
         * 与「HP 差值反推」路径相比，事件路径能精确表达：
         *   - 本回合每一次出手用的技能 / 要播的特效（`anim`）；
         *   - 每次出手的伤害、暴击、治疗，而不是只拿到一个「掉血总量」；
         *   - 施放失败（技能不存在 / 能量不足 / 未实装）这类没有数值变化的出手。
         *
         * ⚠ 服务端是唯一权威：本方法**只做表现**，不重算任何伤害；单位最终 HP/MP 一律取 state。
         *   服务端没给 round_events（老版本 / 空回合）时，调用方自动回落到 HP 差值路径。
         */


        playRoundEvents(serverState, events, targetPlayerHp, targetEnemyHp) {
          let i = 0;

          const step = () => {
            var _this$node14;

            if (!((_this$node14 = this.node) != null && _this$node14.isValid) || this.state === BattleState.FINISHED) return;

            if (i >= events.length) {
              this.finishRoundPresentation(serverState, targetPlayerHp, targetEnemyHp);
              return;
            }

            const ev = events[i++];
            this.playOneRoundEvent(ev, () => {
              var _this$node15;

              if (!((_this$node15 = this.node) != null && _this$node15.isValid) || this.state === BattleState.FINISHED) return; // 包一层匿名闭包：Cocos 以 target+callback 为唯一键，同一函数引用会被去重

              this.scheduleOnce(() => step(), BattleScene.ROUND_EVENT_GAP);
            });
          };

          step();
        }
        /**
         * 演绎一次出手（一条 round_event）。
         *
         * 事件结构（服务端 `battle_room_service._exec_action`，view 已按视角交换）：
         *   { side, action, skill_key, skill_name, anim, level, repeats, mp_cost, mp_after,
         *     targets: [{ side, kind, damage, crit, hp_after, mp_after, drained }],
         *     heals:   [{ side, attr, value, cur, max, from }],
         *     effects: [], pending_effects: [], failed }
         */


        playOneRoundEvent(ev, done) {
          var _this$getUnit, _this$getUnit2, _targets$, _SkillData$getSkillDe;

          if (!ev || typeof ev !== 'object') {
            done();
            return;
          }

          const side = ev.side === 'enemy' ? 'enemy' : 'player';
          const who = side === 'player' ? '你' : '敌方';
          const atype = String(ev.action || '').toUpperCase();
          const skillKey = SkillData.resolveSkillRef(ev.skill_key);
          const skillName = String(ev.skill_name || '') || SkillData.roundEventLabel(ev) || '普通攻击';
          const level = Math.max(1, Number(ev.level) || 1); // 施放失败（技能不存在 / 能量不足 / 未实装）：只提示，不改任何数值

          if (ev.failed) {
            this.log(`${who} 的「${skillName}」未能施放：${ev.failed}`);
            this.scheduleOnce(done, 0.15);
            return;
          } // 防御：本回合不出手，只进入防御姿态（「伤害减半」由服务端 applyGuard 算完）


          if (atype === 'DEFEND') {
            this.log(`${who} 进入防御姿态`);
            this.scheduleOnce(done, 0.15);
            return;
          }

          if (atype !== 'ATTACK' && atype !== 'SKILL') {
            done();
            return;
          }

          const targets = Array.isArray(ev.targets) ? ev.targets : [];
          const totalDamage = targets.reduce((s, t) => s + Math.max(0, Number(t == null ? void 0 : t.damage) || 0), 0); // ---- 普攻：沿用既有动画链路（远程/近战判定 + 按攻击次数拆段弹数字）----

          if (atype === 'ATTACK') {
            if (totalDamage <= 0) {
              this.log(`${who} 的普通攻击未造成伤害`);
              this.applyRoundEventHeals(ev);
              this.scheduleOnce(done, 0.15);
              return;
            }

            this.performAttackWithDamage(side, totalDamage, () => {
              this.applyRoundEventHeals(ev);
              done();
            });
            return;
          } // ---- 技能 ----
          // 1) 能量：以服务端 mp_after 为权威（扣蓝已由服务端在结算时落地）


          const attackerUnit = this.getUnit(side);

          if (attackerUnit) {
            const mpAfter = Number(ev.mp_after);

            if (Number.isFinite(mpAfter)) {
              attackerUnit.mp = Math.max(0, Math.min(attackerUnit.maxMp, mpAfter));
              this.syncUnitMpToRawData(attackerUnit);
            }
          }

          const cost = Math.max(0, Number(ev.mp_cost) || 0);
          this.log(`${who} 施放「${skillName}」` + (level > 1 ? `（Lv${level}）` : '') + (cost > 0 ? ` −${cost} 能量` : '') + (totalDamage > 0 ? ` → ${totalDamage} 点伤害` : '') + (totalDamage > 0 && (((_this$getUnit = this.getUnit(side)) == null ? void 0 : _this$getUnit.attackTimes) || 1) > 1 ? `（攻击次数 ${(_this$getUnit2 = this.getUnit(side)) == null ? void 0 : _this$getUnit2.attackTimes}）` : '')); // 2) 特效打在「本次出手的目标」身上；自身 / 己方技能（护盾、修理）打在自己身上

          const t0 = (_targets$ = targets[0]) == null ? void 0 : _targets$.side;
          const effectSide = t0 === 'enemy' ? 'enemy' : t0 === 'player' ? 'player' : side;
          const effectShow = effectSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const anim = String(ev.anim || '') || (skillKey ? String(((_SkillData$getSkillDe = SkillData.getSkillDef(skillKey)) == null ? void 0 : _SkillData$getSkillDe.anim) || '') : ''); // 2.5) 距离：近身技必须先位移贴到目标身前再出招；远程技原地出招。
          //    口径 = Skills.json 的 `range`（melee/ranged/dynamic/none），见 tools/skill_range_todo.md。
          //    dynamic 按「是否持枪」判定（与普攻同口径）；自身/己方技能（护盾、修理）不以敌人为目标 → 不位移。
          //    ⚠ 读不到技能定义（目录加载失败 / 技能不在目录）时**按普攻口径兜底**（持枪=远程，否则近身），
          //      绝不默认成「远程」—— 否则近身技会一直在原地出招（2026-10-01 实测事故）。

          const skillDef = skillKey ? SkillData.getSkillDef(skillKey) : null;
          const attackerShow = side === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const rawAny = attackerUnit == null ? void 0 : attackerUnit.rawData;
          const attackerHasGun = SkillData.hasGunEquipped(SkillData.equipmentOf(rawAny) || SkillData.equipmentOf(rawAny == null ? void 0 : rawAny.data));
          const skillRanged = SkillData.isRangedSkill(skillDef, attackerHasGun);
          const meleeMove = !skillRanged && effectShow && effectShow !== attackerShow ? this.moveInForMeleeSkill(attackerShow, effectShow, skillName) : null;
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[近身技] 「${skillName}」(key=${skillKey || '-'}) ` + (skillDef ? `range=${skillDef.range || '缺失'}` : '目录未命中→按普攻口径') + ` 持枪=${attackerHasGun} → ${skillRanged ? '远程/原地' : meleeMove ? '近身/位移' : '近身/无需位移'}`);
          /** 近身技：技能动画一结束就归位，不等伤害数字播完。 */

          const startMeleeRestore = () => {
            meleeMove == null || meleeMove.restore(() => {});
          };

          const afterEffect = () => {
            var _this$node16;

            startMeleeRestore();

            if (!((_this$node16 = this.node) != null && _this$node16.isValid) || this.state === BattleState.FINISHED) {
              done();
              return;
            }

            this.applyRoundEventDamage(ev, side, targets, () => {
              this.applyRoundEventHeals(ev);
              this.refreshPlayerMechAttributeUI(true);
              done();
            });
          };

          if (effectShow && anim) {
            let fired = false;

            const fire = () => {
              if (fired) return;
              fired = true;
              afterEffect();
            };

            try {
              effectShow.playSkillEffect(anim, 1, fire);
            } catch (err) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn(`[BattleScene] 技能特效播放失败 ${anim}:`, err);
            } // 兜底：Skill 节点缺该动画 / 回调丢失时也要推进，避免战斗卡死


            this.scheduleOnce(fire, 1.0);
          } else {
            this.scheduleOnce(afterEffect, 0.15);
          }
        }
        /** 把一次出手的伤害落到单位身上（弹伤害数字 + 写 HP/MP + 刷血条）。
         *
         * 技能与普攻同口径：
         *   - 总伤来自服务端（已含技能 `repeats` 多次公式求和）；
         *   - 客户端再按攻击方 **AttackCount（攻击次数）** 拆段展示（`computeAttackSegments`）；
         *   - **整次出手只击退一次**（首段 HP 伤害时抖动），多段只弹数字、不再重复击退。
         * 技能特效 / 近身贴脸是**前置表现**，不替代本段击退。
         */


        applyRoundEventDamage(ev, attackerSide, targets, onDone) {
          const attacker = this.getUnit(attackerSide);
          const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const attackTimes = Math.max(1, Math.floor(Number(attacker == null ? void 0 : attacker.attackTimes) || 1));
          const drift = this.damageDriftFor(attackerSide);
          const jobs = [];

          for (const t of targets) {
            const tSide = (t == null ? void 0 : t.side) === 'enemy' ? 'enemy' : (t == null ? void 0 : t.side) === 'player' ? 'player' : null;
            if (!tSide) continue;
            const unit = this.getUnit(tSide);
            if (!unit) continue;
            const show = tSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
            const kind = String((t == null ? void 0 : t.kind) || 'hp_damage');
            const isMp = kind === 'mp_damage' || kind === 'mp_drain';
            const dmg = Math.max(0, Number(t == null ? void 0 : t.damage) || 0);

            if (dmg <= 0) {
              // 无伤害（护盾 / 纯 buff）：仍要把服务端权威血蓝对齐
              this.clampUnitToServer(unit, t);
              this.syncUnitHpToRawData(unit);
              this.syncUnitMpToRawData(unit);
              if (show) show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
              continue;
            } // HP：按攻击次数拆段（与普攻 performAttackWithDamage 同口径）
            // MP：无攻击次数语义，仍均分到 skill.repeats（至少 1）


            if (isMp) {
              const repeats = Math.max(1, Math.floor(Number(ev == null ? void 0 : ev.repeats) || 1));

              for (const seg of this.splitEvenly(dmg, repeats)) {
                jobs.push({
                  unit,
                  show,
                  value: seg,
                  isMp: true,
                  shake: false
                });
              }
            } else {
              const segs = computeAttackSegments(dmg, attackTimes);

              for (let si = 0; si < segs.length; si++) {
                // 每个目标整次出手只击退一次（首段）
                jobs.push({
                  unit,
                  show,
                  value: segs[si],
                  isMp: false,
                  shake: si === 0
                });
              }
            } // 逐段取整可能与服务端总量差 1~2 点 → 该目标最后用服务端 hp_after/mp_after 兜底


            jobs.push({
              unit,
              show,
              value: -1,
              isMp,
              shake: false
            });
          }

          if (jobs.length === 0) {
            onDone();
            return;
          }

          let i = 0;

          const step = () => {
            var _this$node17;

            if (!((_this$node17 = this.node) != null && _this$node17.isValid) || this.state === BattleState.FINISHED) {
              onDone();
              return;
            }

            if (i >= jobs.length) {
              onDone();
              return;
            }

            const job = jobs[i++];

            if (job.value < 0) {
              // 哨兵：用服务端给的 hp_after / mp_after 对齐（避免分段取整误差累积）
              this.clampUnitToServer(job.unit, null);
              this.syncUnitHpToRawData(job.unit);
              this.syncUnitMpToRawData(job.unit);

              if (job.show) {
                job.show.updateBattleBars(job.unit.hp, job.unit.maxHp, job.unit.mp, job.unit.maxMp);
              }

              this.scheduleOnce(() => step(), 0.05);
              return;
            }

            if (job.isMp) {
              job.unit.mp = Math.max(0, job.unit.mp - job.value);
            } else {
              job.unit.hp = Math.max(0, job.unit.hp - job.value);
              if (job.show) job.show.showDamageNumber(job.value, false, drift.x, drift.y);
            }

            this.syncUnitHpToRawData(job.unit);
            this.syncUnitMpToRawData(job.unit);

            if (job.show) {
              job.show.updateBattleBars(job.unit.hp, job.unit.maxHp, job.unit.mp, job.unit.maxMp);
            } // 整次出手只在首段 HP 伤害时击退一次


            if (job.shake) {
              this.playDefenderHitShake(job.show, attackerShow, () => {
                this.scheduleOnce(() => step(), 0.06);
              });
              return;
            }

            this.scheduleOnce(() => step(), Math.max(0.12, BattleScene.ROUND_EVENT_GAP / 3));
          };

          step();
        }
        /**
         * 受击方「击退一小段再拉回」——普攻接触 / 技能段伤共用。
         * 只动受击节点；攻击方站位由近身技前置位移单独管。
         */


        playDefenderHitShake(defenderShow, attackerShow, onDone) {
          const dNode = defenderShow == null ? void 0 : defenderShow.node;

          if (!(dNode != null && dNode.isValid)) {
            onDone == null || onDone();
            return;
          }

          const aNode = attackerShow == null ? void 0 : attackerShow.node;
          let attackerOnLeft = defenderShow === this.enemyRobotShow;

          if (aNode != null && aNode.isValid) {
            attackerOnLeft = aNode.worldPosition.x < dNode.worldPosition.x;
          }

          const home = dNode.position.clone();
          const delta = attackerOnLeft ? BattleScene.KNOCKBACK_DELTA : -BattleScene.KNOCKBACK_DELTA;
          const knockPos = new Vec3(home.x + delta, home.y, home.z);
          let fired = false;

          const once = () => {
            if (fired) return;
            fired = true;
            onDone == null || onDone();
          };

          try {
            Tween.stopAllByTarget(dNode);
            tween(dNode).to(0.08, {
              position: knockPos
            }).to(0.12, {
              position: home
            }).call(once).start();
            this.scheduleOnce(once, 0.35);
          } catch (err) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 受击抖动失败:', err);
            if (dNode.isValid) dNode.setPosition(home);
            once();
          }
        }
        /**
         * 落地一次出手的治疗 / 吸血 / 回蓝（`ev.heals`）。
         * 服务端已在结算时把成长量写进 actor，这里只做表现 + 本地数值同步。
         */


        applyRoundEventHeals(ev) {
          const list = Array.isArray(ev == null ? void 0 : ev.heals) ? ev.heals : [];

          for (const h of list) {
            const hSide = (h == null ? void 0 : h.side) === 'enemy' ? 'enemy' : (h == null ? void 0 : h.side) === 'player' ? 'player' : null;
            if (!hSide) continue;
            const unit = this.getUnit(hSide);
            if (!unit) continue;
            const show = hSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
            const attr = String((h == null ? void 0 : h.attr) || '');
            const value = Math.max(0, Number(h == null ? void 0 : h.value) || 0);
            if (value <= 0) continue;

            if (attr === 'hp') {
              unit.hp = Math.min(unit.maxHp, unit.hp + value);
              if (show) show.showDamageNumber(value, true); // isHeal → 治疗样式
            } else if (attr === 'mp') {
              unit.mp = Math.min(unit.maxMp, unit.mp + value);
            } else {
              continue;
            }

            this.syncUnitHpToRawData(unit);
            this.syncUnitMpToRawData(unit);
            if (show) show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
            const who = hSide === 'player' ? '你' : '敌方';
            this.log(`${who} 恢复 ${value} 点${attr === 'hp' ? '生命' : '能量'}`);
          }
        }
        /**
         * 用服务端给的血蓝落地值对齐单位（`target` 为 null 时按当前单位自身上限夹取）。
         * ⚠ 「死亡空血优先」：显式判 NaN，绝不用 `||`（`0 || maxHp` 会静默满血复活）。
         */


        clampUnitToServer(unit, target) {
          const hpAfter = target ? Number(target.hp_after) : NaN;

          if (Number.isFinite(hpAfter)) {
            unit.hp = Math.max(0, Math.min(unit.maxHp, hpAfter));
          } else {
            unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp));
          }

          const mpAfter = target ? Number(target.mp_after) : NaN;

          if (Number.isFinite(mpAfter)) {
            unit.mp = Math.max(0, Math.min(unit.maxMp, mpAfter));
          } else {
            unit.mp = Math.max(0, Math.min(unit.maxMp, unit.mp));
          }
        }
        /**
         * 把总伤害平均拆成 n 段（末段吸收余数），保证 Σ段 === total。
         * 只影响「跳几次数、每次多少」的打击感，不改总伤（对比：普攻用 computeAttackSegments 的加权拆段）。
         */


        splitEvenly(total, n) {
          const count = Math.max(1, Math.floor(n || 1));
          const amount = Math.max(0, Math.floor(total));
          if (count === 1 || amount === 0) return [amount];
          const base = Math.floor(amount / count);
          const out = [];

          for (let i = 0; i < count; i++) out.push(base);

          out[count - 1] += amount - base * count;
          return out.filter(v => v > 0);
        }
        /**
         * 回合结束被动恢复表现（生命恢复 / 能量恢复）。
         *
         * 权威在服务端：服务端在「死亡判定**之后**」结算，并把结果放进
         * `serverState.round_passive_effects`（按 side 分组，view 已按视角交换）。
         * 这里只做表现、不重复判定 —— 空血单位服务端根本不会下发恢复效果；
         * 客户端若自作主张补判，反而会与权威状态不一致。
         *
         * 每条效果：播对应动画（shengminghuifu / nenglianghuifu）+ 治疗数字 + 刷新血/蓝条；
         * 多条之间按 PASSIVE_EFFECT_GAP 秒依次播，全部播完再回调（战斗收尾等它）。
         */


        playPassiveRecoverEffects(serverState, onDone) {
          const jobs = [];

          const collect = (side, show) => {
            var _serverState$round_pa2;

            const list = serverState == null || (_serverState$round_pa2 = serverState.round_passive_effects) == null ? void 0 : _serverState$round_pa2[side];
            if (!Array.isArray(list) || list.length === 0) return;
            const unit = side === 'player' ? this.playerUnit : this.enemyUnit;
            if (!unit) return;

            for (const e of list) {
              var _e$cur;

              const attr = String((e == null ? void 0 : e.attr) || '');
              const healed = Number(e == null ? void 0 : e.value) || 0;
              const cur = Number((_e$cur = e == null ? void 0 : e.cur) != null ? _e$cur : NaN);
              const anim = String((e == null ? void 0 : e.anim) || '');
              const skillName = String((e == null ? void 0 : e.name) || '被动技能');
              if (healed <= 0) continue;
              jobs.push(() => {
                // 特效（名字须在 Skill 节点播放列表里），出错不影响战斗结算
                if (show && anim) {
                  try {
                    show.playSkillEffect(anim, 1);
                  } catch (err) {
                    (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                      error: Error()
                    }), Logger) : Logger).warn(`[BattleScene] 被动恢复特效播放失败 ${anim}:`, err);
                  }
                }

                const who = side === 'player' ? '你' : '敌方';

                if (attr === 'hp') {
                  unit.hp = Number.isFinite(cur) ? Math.min(unit.maxHp, cur) : Math.min(unit.maxHp, unit.hp + healed);
                  this.syncUnitHpToRawData(unit);

                  if (show) {
                    show.showDamageNumber(healed, true); // isHeal = true → 治疗样式

                    show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
                  }

                  this.log(`${who}的「${skillName}」恢复 ${healed} 点生命（${unit.hp}/${unit.maxHp}）`);
                } else if (attr === 'mp') {
                  unit.mp = Number.isFinite(cur) ? Math.min(unit.maxMp, cur) : Math.min(unit.maxMp, unit.mp + healed);
                  if (show) show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
                  this.log(`${who}的「${skillName}」恢复 ${healed} 点能量（${unit.mp}/${unit.maxMp}）`);
                }
              });
            }
          };

          collect('player', this.playerRobotShow);
          collect('enemy', this.enemyRobotShow);

          if (jobs.length === 0) {
            onDone();
            return;
          }

          let i = 0;

          const step = () => {
            var _this$node18;

            if (!((_this$node18 = this.node) != null && _this$node18.isValid)) {
              onDone();
              return;
            }

            if (i >= jobs.length) {
              this.refreshPlayerMechAttributeUI(true);
              onDone();
              return;
            }

            const job = jobs[i++];

            try {
              job();
            } catch (err) {
              // 表现层出错绝不吞掉战斗流程
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).error('[BattleScene] 被动恢复表现异常（已吞掉，不影响战斗流程）:', err);
            }

            this.scheduleOnce(step, BattleScene.PASSIVE_EFFECT_GAP);
          };

          step();
        }
        /**
         * 用一份服务器 state 演绎一整个回合（含双方攻击动画、伤害数字、血条）。
         *
         * 供两条路径共用：
         *   1) 自己提交动作后 battle_room_action 的回调；
         *   2) 服务端主动推送的 pvp_round_update（自己挂机时也能看到整回合）。
         *
         * playerAction：本回合「自己」的动作（用于决定是否播自己的攻击动画）。
         *      推送到挂机方时是 'ATTACK'（服务器代打普攻），因此挂机方也能看到自己的攻击动画。
         * basePlayerHp/baseEnemyHp：本回合开始前的 HP 快照（用于算伤害差）。
         */


        playRoundFromServerState(serverState, playerAction, basePlayerHp, baseEnemyHp) {
          var _ref24, _serverState$player$h, _serverState$player, _ref25, _serverState$enemy$hp, _serverState$enemy;

          if (!this.playerUnit || !this.enemyUnit) {
            var _this$node19;

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[BattleScene] playRoundFromServerState 单位缺失，直接恢复操作 ` + `playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit}`);
            this.state = BattleState.INIT;
            this.isAnimating = false;
            this.isRequestingAction = false;
            this.animWatchdog = 0;
            if ((_this$node19 = this.node) != null && _this$node19.isValid) this.startCommandPhase();
            return;
          }

          const targetPlayerHp = Number((_ref24 = (_serverState$player$h = serverState == null || (_serverState$player = serverState.player) == null ? void 0 : _serverState$player.hp) != null ? _serverState$player$h : this.playerUnit.hp) != null ? _ref24 : 0);
          const targetEnemyHp = Number((_ref25 = (_serverState$enemy$hp = serverState == null || (_serverState$enemy = serverState.enemy) == null ? void 0 : _serverState$enemy.hp) != null ? _serverState$enemy$hp : this.enemyUnit.hp) != null ? _ref25 : 0); // 回合结束被动恢复（生命恢复 / 能量恢复）—— 服务端在「死亡判定之后」算好再下发。
          // ⚠ 服务端给的 hp 是「攻击结算 + 被动恢复」后的最终值，算伤害时必须先把恢复量剥掉，
          //   否则本回合伤害会被少算（伤害数字偏小、动画表现与真实掉血不符）。

          const recoverHp = side => {
            var _serverState$round_pa3;

            const list = serverState == null || (_serverState$round_pa3 = serverState.round_passive_effects) == null ? void 0 : _serverState$round_pa3[side];
            if (!Array.isArray(list)) return 0;
            return list.reduce((sum, e) => sum + ((e == null ? void 0 : e.attr) === 'hp' ? Number(e.value) || 0 : 0), 0);
          };

          const hpAfterAttackPlayer = Math.max(0, targetPlayerHp - recoverHp('player'));
          const hpAfterAttackEnemy = Math.max(0, targetEnemyHp - recoverHp('enemy')); // 攻击不改能量 → 回合开始前的 MP 就是被动恢复的动画起点

          const basePlayerMp = this.playerUnit.mp;
          const baseEnemyMp = this.enemyUnit.mp;
          this.animWatchdog = 0;
          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.setButtonsInteractable(false);
          if (this.battleSelectPanel) this.battleSelectPanel.active = false;
          this.closeSkillSelectPanel();
          if (this.timerRoot) this.timerRoot.active = false; // 同步单位/展示数据（不结束战斗、不显示面板）

          this.applyServerRoomState(serverState, false, true); // 按服务器结果计算本回合掉血量（不能为负）。基于「攻击后、被动恢复前」的 HP

          const damageToPlayer = Math.max(0, basePlayerHp - hpAfterAttackPlayer);
          const damageToEnemy = Math.max(0, baseEnemyHp - hpAfterAttackEnemy);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[攻击诊断] 服务器回合结果: 玩家HP ${basePlayerHp}→${hpAfterAttackPlayer}(伤${damageToPlayer}) ` + `敌人HP ${baseEnemyHp}→${hpAfterAttackEnemy}(伤${damageToEnemy}) 玩家动作=${playerAction} ` + `被动恢复 玩家+${recoverHp('player')}/敌人+${recoverHp('enemy')}`); // 为了播动画，把本地 HP 暂时「回滚」到回合开始前（MP 同样回到回合开始值，
          // 这样被动恢复能演出「涨上去」的过程；攻击不改 MP，回滚不会丢信息）

          this.playerUnit.hp = basePlayerHp;
          this.enemyUnit.hp = baseEnemyHp;
          this.playerUnit.mp = basePlayerMp;
          this.enemyUnit.mp = baseEnemyMp;
          this.syncUnitHpToRawData(this.playerUnit);
          this.syncUnitHpToRawData(this.enemyUnit);
          this.refreshPlayerMechAttributeUI(true); // 演绎本回合：
          //   ① 服务端给了「出手明细」（round_events）→ 走事件路径，逐次出手演绎（技能/普攻/防御、暴击、治疗都能还原）；
          //   ② 没给（老服务端 / 空回合）→ 回落到「按 HP 差值反推」的旧路径，保证不回归。

          const events = Array.isArray(serverState == null ? void 0 : serverState.round_events) ? serverState.round_events : [];

          if (events.length > 0) {
            this.playRoundEvents(serverState, events, targetPlayerHp, targetEnemyHp);
          } else {
            // 用服务器伤害驱动一轮动画，播完再落到服务器最终 HP
            this.playServerRoundAnimation(playerAction, damageToPlayer, damageToEnemy, targetPlayerHp, targetEnemyHp, serverState);
          }
        }
        /**
         * 服务端主动推送「PVP 回合已结算」：
         *   解决挂机方从不发请求 → 永远拿不到新 state → 看不到动画/血条不更新的缺陷。
         *
         * 去重：仅当推送的 settled_round >= 自己已知的回合数、且当前不在播同一回合时才处理。
         */


        onPvpRoundUpdate(msg) {
          var _this$node20, _msg$data, _ref26, _data$settled_round, _state$round_actions, _this$playerUnit$hp, _this$playerUnit2, _state$player$hp, _state$player, _this$enemyUnit$hp, _this$enemyUnit, _state$enemy$hp, _state$enemy;

          if (!((_this$node20 = this.node) != null && _this$node20.isValid)) return;
          const data = (_msg$data = msg == null ? void 0 : msg.data) != null ? _msg$data : msg;
          const state = data == null ? void 0 : data.state;
          if (!state) return; // 只处理本房间的推送

          const incomingRoomId = state.room_id || state.roomId || (data == null ? void 0 : data.room_id) || null;
          if (this.roomId && incomingRoomId && incomingRoomId !== this.roomId) return;
          const settledRound = Number((_ref26 = (_data$settled_round = data == null ? void 0 : data.settled_round) != null ? _data$settled_round : state.round) != null ? _ref26 : 0); // 去重：同一回合的推送只处理一次

          if (settledRound > 0 && settledRound <= this._lastPlayedPvpRound) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug(`[BattleScene] 忽略重复的 pvp_round_update round=${settledRound}`);
            return;
          } // 正在播自己的动作动画（请求还没回来）时，交给请求回调处理，避免重复播


          if (this.isRequestingAction) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[BattleScene] 请求进行中，忽略 pvp_round_update（由请求回调统一处理）');
            return;
          } // 正在播动画（同一回合）时不打断


          if (this.isAnimating) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[BattleScene] 动画进行中，忽略 pvp_round_update');
            return;
          }

          if (state.status === 'finished' && this.state === BattleState.FINISHED) return;
          this._lastPlayedPvpRound = settledRound > 0 ? settledRound : this._lastPlayedPvpRound; // 推送里「自己」的动作由自己的 round_actions 决定（视角已交换）：
          //   取不到时按 ATTACK 处理（服务器补普攻的场景）。

          const myAction = ((_state$round_actions = state.round_actions) == null ? void 0 : _state$round_actions.player) || state.my_action || 'ATTACK';
          const basePlayerHp = (_this$playerUnit$hp = (_this$playerUnit2 = this.playerUnit) == null ? void 0 : _this$playerUnit2.hp) != null ? _this$playerUnit$hp : Number((_state$player$hp = (_state$player = state.player) == null ? void 0 : _state$player.hp) != null ? _state$player$hp : 0);
          const baseEnemyHp = (_this$enemyUnit$hp = (_this$enemyUnit = this.enemyUnit) == null ? void 0 : _this$enemyUnit.hp) != null ? _this$enemyUnit$hp : Number((_state$enemy$hp = (_state$enemy = state.enemy) == null ? void 0 : _state$enemy.hp) != null ? _state$enemy$hp : 0);
          this.log('[PVP] 收到服务器回合推送，播放整回合动画');
          this.playRoundFromServerState(state, myAction, basePlayerHp, baseEnemyHp);
        }
        /**
         * 在线模式专用：按服务器给定伤害值播放一次攻击动画（不再用本地公式算伤害）。
         * 流程：先播攻击动画 → 动画结束后扣血、弹出伤害数字 → 延迟后再更新血条（敌我都等伤害数字弹出后再改）。
         */


        performAttackWithDamage(attackerSide, damage, onDone) {
          var _attacker$rawData3, _attacker$rawData4;

          const attacker = this.getUnit(attackerSide);
          const defender = this.getOpponent(attackerSide);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[攻击诊断] 进入 performAttackWithDamage side=${attackerSide} damage=${damage} attacker=${!!attacker} defender=${!!defender}`);

          if (!attacker || !defender) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[攻击诊断] attacker/defender 缺失，直接 onDone');
            onDone();
            return;
          }

          if (this.state === BattleState.FINISHED) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[攻击诊断] state=FINISHED，直接 onDone');
            onDone();
            return;
          }

          this.state = BattleState.ANIMATING;
          this.isAnimating = true;
          this.setButtonsInteractable(false);
          damage = Math.max(1, Math.floor(damage)); // 「攻击次数」：服务端给的是整次伤害，客户端按攻击次数拆段展示（总伤上限 +20%）

          const segments = computeAttackSegments(damage, attacker.attackTimes);
          const totalApplied = segments.reduce((a, b) => a + b, 0);
          const drift = this.damageDriftFor(attackerSide);
          this.log(`${attackerSide === 'player' ? '玩家' : '敌人'} 造成 ${totalApplied} 点伤害（按服务器结果）` + (segments.length > 1 ? `，分 ${segments.length} 段` : ''));
          const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
          const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow; // 是否远程：沿用原来判断

          const attackerEquip = ((_attacker$rawData3 = attacker.rawData) == null ? void 0 : _attacker$rawData3.equipment) || ((_attacker$rawData4 = attacker.rawData) == null || (_attacker$rawData4 = _attacker$rawData4.data) == null ? void 0 : _attacker$rawData4.equipment) || {};
          const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[攻击诊断] 段数=${segments.length} 总伤=${totalApplied} attackerShow=${!!attackerShow} defenderShow=${!!defenderShow} 远程=${attackerHasGun}`); // 逐段扣血、弹伤害数字（此时不刷新任何血条，等伤害数字一起）。
          //   「攻击次数」：一次攻击的整段伤害拆成 N 段，间隔 0.18s 逐段弹出。
          //   注意：绝不能用 `scheduleOnce(step, ...)` 递归调度同一个函数引用 —— Cocos 以
          //   target+callback 为唯一键，同一函数重入时会被去重/覆盖（日志报
          //   "Selector already scheduled"），导致第 2 段后再也不执行、战斗卡死。
          //   这里每次调度都包一层新的匿名闭包，保证 callback 引用唯一。

          let segStarted = false;

          const startSegments = () => {
            // 幂等：接触瞬间与动画结束都会调用，保证只启动一次
            if (segStarted) return;
            segStarted = true;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[攻击诊断] 开始逐段结算 segments=${segments.length}`);
            let i = 0;

            const step = () => {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn(`[攻击诊断] step 执行 i=${i} 总段=${segments.length}`);

              if (i < segments.length) {
                const segVal = segments[i];
                defender.hp = Math.max(0, defender.hp - segVal);
                this.syncUnitHpToRawData(defender);
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn(`[攻击诊断] 段 ${i + 1}/${segments.length} -${segVal} 剩余HP=${defender.hp}/${defender.maxHp} defenderShow=${!!defenderShow}`);

                if (defenderShow) {
                  defenderShow.showDamageNumber(segVal, false, drift.x, drift.y);
                }

                i++;

                if (i < segments.length) {
                  // 关键：包一层匿名闭包，避免同一 callback 引用被 Cocos 去重而丢失调度
                  this.scheduleOnce(() => step(), 0.18);
                  return;
                }
              } // 全部段落结束：等伤害数字弹出后，血条与属性面板一起更新，再结束本动作


              this.scheduleOnce(() => {
                var _this$node21;

                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn(`[攻击诊断] 段结算收尾更新血条 defenderHP=${defender.hp}/${defender.maxHp}`);

                if (this.state !== BattleState.FINISHED) {
                  if (defenderShow) {
                    defenderShow.updateBattleBars(defender.hp, defender.maxHp, defender.mp, defender.maxMp);
                  }

                  if (defender.side === 'player') {
                    this.refreshPlayerMechAttributeUI(true);
                  }
                }

                if ((_this$node21 = this.node) != null && _this$node21.isValid) {
                  (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                    error: Error()
                  }), Logger) : Logger).warn('[攻击诊断] 调用 onDone 解除锁定');
                  onDone();
                }
              }, 0.35);
            };

            step();
          };

          this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, // onComplete：动画播完（兜底启动分段结算 + 解锁）
          () => {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[攻击诊断] 攻击动画回调已触发（onComplete）segments=${segments.length}`);
            this.isAnimating = false;
            startSegments();
          }, // onImpact：接触到对方的瞬间 —— 只弹伤害数字（**普攻不播技能特效**，2026-09-30 用户要求去掉）
          () => {
            startSegments();
          });
        }

        playAttackAnimation(attackerShow, defenderShow, isRanged, onComplete,
        /**
         * 「接触瞬间」回调：攻击方触及受击者的那一刻触发（近战=瞬移到位即接触；远程=子弹命中击退开始）。
         * 伤害数字/扣血由调用方挂在这里，做到「一打到就弹数字」，不等整段动画播完。
         */
        onImpact) {
          const attackerNode = (attackerShow == null ? void 0 : attackerShow.node) || null;
          const defenderNode = (defenderShow == null ? void 0 : defenderShow.node) || null;
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[攻击诊断] playAttackAnimation 进入 attackerNode=${!!attackerNode} defenderNode=${!!defenderNode} 远程=${isRanged}`); // 接触回调幂等：tween 回调与兜底可能都触发，保证只结算一次

          let impactFired = false;

          const fireImpact = () => {
            if (impactFired) return;
            impactFired = true;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[攻击诊断] onImpact 接触瞬间触发');
            onImpact == null || onImpact();
          };

          if (!attackerNode || !defenderNode) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 攻击动画：缺少 RobotShow 节点，跳过动画');
            fireImpact(); // 无动画也要先结算伤害

            onComplete();
            return;
          }

          const attackerStart = attackerNode.position.clone();
          const defenderStart = defenderNode.position.clone(); // 敌人被击退方向：始终远离攻击方

          const attackerOnLeft = attackerNode.worldPosition.x < defenderNode.worldPosition.x;
          const knockbackDelta = attackerOnLeft ? BattleScene.KNOCKBACK_DELTA : -BattleScene.KNOCKBACK_DELTA; // 击退像素（与近身技共用）

          const knockbackPos = new Vec3(defenderStart.x + knockbackDelta, defenderStart.y, defenderStart.z); // 为了避免双方动作重叠，这里统一用“全部 tween 结束后再回调”的计数逻辑

          let activeTweens = 0;
          let animDone = false;
          let animFallback = null;

          const fireComplete = () => {
            if (animDone) return; // 单次守卫：防止 tween 与兜底重复触发造成伤害重复结算

            animDone = true; // 兜底：极端情况下接触回调未触发（tween 丢回调等），此处补发，保证伤害一定结算

            fireImpact(); // 动画已正常完成：清掉兜底调度，避免每次攻击都往 scheduler 里堆积一个 2.2s 定时器

            if (animFallback) {
              this.unschedule(animFallback);
              animFallback = null;
            }

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[攻击诊断] playAttackAnimation 动画完成（fireComplete）');
            onComplete();
          };

          const onTweenStart = () => {
            activeTweens += 1;
          };

          const onTweenDone = () => {
            activeTweens -= 1;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn(`[攻击诊断] onTweenDone 剩余 activeTweens=${activeTweens}`);

            if (activeTweens <= 0) {
              // 所有本次攻击相关的 tween 都完成，才能开始下一方行为
              fireComplete();
            }
          }; // 兜底：tween 若因节点失效/引擎原因丢回调，2.2s 后强制推进，避免战斗死锁


          animFallback = () => {
            if (animDone) return;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[攻击诊断] playAttackAnimation 2.2s 兜底触发');
            fireComplete();
          };

          this.scheduleOnce(animFallback, 2.2); // 远程（射击）：攻击方「后坐 + 回位」+ 敌人「中弹击退 + 拉回」，错开时序让“先开火→再中弹”更清晰

          if (isRanged) {
            const recoilDelta = attackerOnLeft ? -22 : 22; // 后坐方向：远离敌人

            const recoilPos = new Vec3(attackerStart.x + recoilDelta, attackerStart.y, attackerStart.z);
            onTweenStart();
            tween(attackerNode).to(0.07, {
              position: recoilPos
            }).to(0.11, {
              position: attackerStart
            }).call(onTweenDone).start();
            onTweenStart();
            tween(defenderNode).delay(0.05).to(0.08, {
              position: knockbackPos
            }) // 子弹命中（击退到位）的瞬间即视为「接触」，立即弹出伤害数字
            .call(() => {
              fireImpact();
            }).to(0.12, {
              position: defenderStart
            }).call(onTweenDone).start();
            return;
          } // 近战：攻击方瞬移到对方面前（间隔 MELEE_CONTACT_GAP 的 X），两者一起产生击退/拉回效果，然后攻击方快速回位


          const meleeGap = BattleScene.MELEE_CONTACT_GAP;
          const meleeContactX = attackerOnLeft ? defenderStart.x - meleeGap : defenderStart.x + meleeGap;
          const meleeContactPos = new Vec3(meleeContactX, attackerStart.y, attackerStart.z); // 瞬移到近战位置

          attackerNode.setPosition(meleeContactPos); // 瞬移到位即「接触到对方」——立刻弹出伤害数字，不留等待

          fireImpact(); // 敌人击退 + 拉回，同时攻击方稍微跟随一点拉回感，然后回原位

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
        /**
         * 【近身技位移】把攻击方挪到目标身前（间隔 {@link MELEE_CONTACT_GAP} 像素，与普攻近战同口径）。
         * 只做贴脸前置，**不在此处击退**——受击击退统一在伤害结算时打一次（见 {@link playDefenderHitShake}）。
         *
         * 调用方拿到的 `restore(cb)`：技能特效一结束即调用 —— 机甲滑回原位，不等伤害数字。
         * 无需位移（节点缺失、敌我同一节点）时返回 `null`，调用方直接推进即可。
         *
         * ⚠ 只是**表现层**位移；伤害结算完全走服务端权威值，与位置无关。
         */


        moveInForMeleeSkill(attackerShow, targetShow, skillName = '') {
          const aNode = attackerShow == null ? void 0 : attackerShow.node;
          const tNode = targetShow == null ? void 0 : targetShow.node;
          if (!aNode || !tNode || aNode === tNode) return null; // 归位点优先用缓存的「战斗站位」（不受上一次击退残留影响），没有才用当前位置

          const cachedHome = attackerShow === this.playerRobotShow ? this.battlePlayerPos : this.battleEnemyPos;
          const home = cachedHome ? cachedHome.clone() : aNode.position.clone();
          const targetStart = tNode.position.clone();
          const attackerOnLeft = aNode.worldPosition.x < tNode.worldPosition.x;
          const gap = BattleScene.MELEE_CONTACT_GAP;
          const contactPos = new Vec3(attackerOnLeft ? targetStart.x - gap : targetStart.x + gap, home.y, home.z); // 清掉可能残留的位移 tween，避免叠加造成错位

          try {
            Tween.stopAllByTarget(aNode);
          } catch (e) {
            /* 忽略 */
          }

          aNode.setPosition(contactPos);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn(`[近身技] 位移「${skillName || '技能'}」：x ${home.x.toFixed(0)} → ${contactPos.x.toFixed(0)}` + `（目标 x=${targetStart.x.toFixed(0)}，${attackerOnLeft ? '左→右' : '右→左'}）`);
          return {
            restore: cb => {
              // 幂等：tween 回调与兜底调度都可能触发，只推进一次
              let fired = false;

              const once = () => {
                if (fired) return;
                fired = true;
                cb();
              };

              if (!aNode.isValid) {
                once();
                return;
              }

              try {
                Tween.stopAllByTarget(aNode);
                tween(aNode).to(BattleScene.MELEE_RETURN_TIME, {
                  position: home
                }).call(once).start(); // 兜底：tween 回调丢失（节点失效 / 战斗收尾）时也要归位并推进，避免死锁

                this.scheduleOnce(once, BattleScene.MELEE_RETURN_TIME + 0.3);
              } catch (err) {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn('[BattleScene] 近身技归位失败:', err);
                if (aNode.isValid) aNode.setPosition(home);
                once();
              }
            }
          };
        }
        /** 新一场战斗开始前：恢复击破动画后的透明度，并清理上一场残留的 tween（不动本场已排程的 scheduleOnce） */


        prepareRobotShowsForNewBattle() {
          var _this$playerRobotShow6, _this$enemyRobotShow6;

          if ((_this$playerRobotShow6 = this.playerRobotShow) != null && _this$playerRobotShow6.node) Tween.stopAllByTarget(this.playerRobotShow.node);
          if ((_this$enemyRobotShow6 = this.enemyRobotShow) != null && _this$enemyRobotShow6.node) Tween.stopAllByTarget(this.enemyRobotShow.node);
          this.resetRobotShowOpacity(this.playerRobotShow);
          this.resetRobotShowOpacity(this.enemyRobotShow);
          if (this.playerRobotShow) this.playerRobotShow.resetVisualState();
          if (this.enemyRobotShow) this.enemyRobotShow.resetVisualState();
        }
        /** 将 RobotShow 下所有 Sprite 的透明度恢复为 255，避免击破动画后下次战斗不显示 */


        resetRobotShowOpacity(show) {
          var _show$node;

          if (!(show != null && (_show$node = show.node) != null && _show$node.isValid)) return;
          const sprites = show.node.getComponentsInChildren(Sprite);
          sprites.forEach(s => {
            var _s$node;

            if (!(s != null && (_s$node = s.node) != null && _s$node.isValid)) return;
            const c = s.color;
            s.color = new Color(c.r, c.g, c.b, 255);
          });
        }
        /**
         * 机甲被击败时的消失动画（敌我通用）：整机闪烁 → 装备透明度快速消失 → 机甲透明度消失，总时长 1 秒内，再回调
         * 不同步频率，分阶段进行。
         */


        playDefeatAnimation(defeatedShow, onComplete) {
          const root = defeatedShow.node;

          if (!root || !root.isValid) {
            onComplete();
            return;
          }

          const body = defeatedShow.body;
          const equipNodes = [defeatedShow.weaponIcon, defeatedShow.gunIcon, defeatedShow.dunIcon, defeatedShow.wingIcon].filter(Boolean);
          const allSprites = root.getComponentsInChildren(Sprite);
          const equipSprites = [];
          const bodySprites = [];

          for (const n of equipNodes) {
            const s = n == null ? void 0 : n.getComponent(Sprite);
            if (s) equipSprites.push(s);
          }

          if (body != null && body.isValid) {
            bodySprites.push(...body.getComponentsInChildren(Sprite));
          }

          const setAlpha = (list, a) => {
            const alpha = Math.max(0, Math.min(255, Math.round(a)));
            list.forEach(s => {
              var _s$node2;

              if (!(s != null && (_s$node2 = s.node) != null && _s$node2.isValid)) return;
              const c = s.color;
              s.color = new Color(c.r, c.g, c.b, alpha);
            });
          }; // 1) 0~0.25s：整机闪烁（不统一频率）


          this.scheduleOnce(() => setAlpha(allSprites, 120), 0.06);
          this.scheduleOnce(() => setAlpha(allSprites, 255), 0.12);
          this.scheduleOnce(() => setAlpha(allSprites, 120), 0.18);
          this.scheduleOnce(() => setAlpha(allSprites, 255), 0.25); // 2) 0.2s 起：装备透明度快速消失（约 0.25s 内消失）

          const equipFadeStart = 0.2;
          const equipFadeDur = 0.25;
          const equipSteps = 8;

          for (let i = 0; i <= equipSteps; i++) {
            const t = equipFadeStart + equipFadeDur * i / equipSteps;
            const alpha = 255 * (1 - i / equipSteps);
            this.scheduleOnce(() => setAlpha(equipSprites, alpha), t);
          } // 3) 0.35s 起：机甲本体透明度消失（约 0.4s 内消失）


          const bodyFadeStart = 0.35;
          const bodyFadeDur = 0.4;
          const bodySteps = 10;

          for (let i = 0; i <= bodySteps; i++) {
            const t = bodyFadeStart + bodyFadeDur * i / bodySteps;
            const alpha = 255 * (1 - i / bodySteps);
            this.scheduleOnce(() => setAlpha(bodySprites, alpha), t);
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

          this.closeSkillSelectPanel();
          if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
          if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false); // 战斗结束后：玩家机甲若在本场被打倒（血量归零），保底恢复 1 滴血
          // （与服务端收尾回写口径一致）—— 回到大地图/属性面板应是「存活但残血」，
          // 而不是永久 0 血（0 血会被当死尸，无法出战）。必须在发送 battle_result
          // 与刷新属性面板之前执行，保证各处显示同源。

          if (this.playerUnit && Number(this.playerUnit.hp) <= 0) {
            this.playerUnit.hp = 1;
            this.syncUnitHpToRawData(this.playerUnit);
            this.log('机甲被击倒，战斗结束保底恢复 1 点血量');
          }

          const result = {
            type: winner === 'player' ? 'win' : 'lose',
            reason
          }; // 通知服务器战斗结果（仅日志，无胜负权威意义；剧情结算走 story_battle_finalize）

          try {
            this.ws.send({
              type: 'battle_result',
              // DEPRECATED: 客户端 battle_result / battle_won 不得作为剧情权威证据
              winner: winner === 'player' ? 'player' : 'enemy',
              reason,
              player: this.playerUnit ? this.buildUnitSummary(this.playerUnit) : null,
              enemy: this.enemyUnit ? this.buildUnitSummary(this.enemyUnit) : null
            }, true);
          } catch (e) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 发送 battle_result 失败:', e);
          } // 战斗结束后：清除本场机甲详情缓存，保证回到机甲属性时重新拉取并显示实打实的血量/经验


          try {
            var _this$playerUnit3, _this$ws$getCharacter11, _this$ws11;

            const petId = ((_this$playerUnit3 = this.playerUnit) == null ? void 0 : _this$playerUnit3.petId) != null ? String(this.playerUnit.petId) : null;

            if (petId) {
              this.cacheManager.clearRobotPetInfoCache(petId);
            }

            const cid = (_this$ws$getCharacter11 = (_this$ws11 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter11.call(_this$ws11);

            if (cid) {
              var _this$ws$getUserId, _this$ws12;

              const req = {
                type: 'get_player',
                character_id: cid
              };
              const uid = (_this$ws$getUserId = (_this$ws12 = this.ws).getUserId) == null ? void 0 : _this$ws$getUserId.call(_this$ws12);
              if (uid != null) req.user_id = uid;
              this.ws.send(req, true, true);
            }
          } catch (e) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[BattleScene] 战斗结束刷新缓存/拉取失败:', e);
          }

          this.log(`战斗结束：${result.type === 'win' ? '玩家胜利' : '玩家失败'}（原因：${reason === 'ko' ? '击倒' : '逃跑'}）`);
          const finishedRoomId = this.roomId || '';

          if (finishedRoomId) {
            try {
              (_crd && BattleResumeController === void 0 ? (_reportPossibleCrUseOfBattleResumeController({
                error: Error()
              }), BattleResumeController) : BattleResumeController).getInstance().notifyRoomFinished(finishedRoomId);
            } catch (_) {}
          }

          this._appliedRestoreRoomId = null;
          this.roomId = null;
          this._entryIntent = null;
          const storyCb = this._storyBattleCallback;
          const won = winner === 'player';

          if (storyCb) {
            this._storyBattleCallback = null;
            this._storyContext = null;
            storyCb({
              won,
              roomId: finishedRoomId,
              winner,
              reason
            });
          } // 关闭 BattleScene 面板（上层可选择重新激活）


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
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[BattleScene]', msg);
          if (!this.logLabel) return;
          const old = this.logLabel.string || '';
          this.logLabel.string = old ? `${old}\n${msg}` : msg;
        }

        logClear() {
          if (this.logLabel) {
            this.logLabel.string = '';
          }
        } // =========================
        // PlayerShow / EnemyPlayerShow（角色形象+名字）
        // 剧情战：玩家形象+机甲；敌方仅机甲
        // 模拟战/PVP：双方形象+机甲
        // =========================


        _isStoryBattle() {
          return this._entryIntent === 'story' || !!this._storyContext;
        }
        /** 按战斗类型切换人物形象节点显隐（机甲 RobotShow 始终展示） */


        _syncBattlePortraitVisibility() {
          var _this$playerRobotShow7, _this$enemyRobotShow7;

          const story = this._isStoryBattle();

          if (this.playerShowRoot) {
            this.playerShowRoot.active = true;
          }

          if (this.enemyPlayerShowRoot) {
            this.enemyPlayerShowRoot.active = !story;
          }

          if ((_this$playerRobotShow7 = this.playerRobotShow) != null && _this$playerRobotShow7.node) {
            this.playerRobotShow.node.active = true;
          }

          if ((_this$enemyRobotShow7 = this.enemyRobotShow) != null && _this$enemyRobotShow7.node) {
            this.enemyRobotShow.node.active = true;
          }
        }

        refreshPlayerAndEnemyShows(enemyCharacterId) {
          this._syncBattlePortraitVisibility();

          this.refreshPlayerShowFromServer();

          if (this._isStoryBattle()) {
            return;
          }

          if (enemyCharacterId && this.currentBattleMode === 'pvp') {
            this.refreshEnemyShowFromCharacterId(enemyCharacterId);
          } else {
            this.refreshEnemyShowRandom();
          }
        }

        refreshPlayerShowFromServer() {
          var _this$ws$getCharacter12, _this$ws13, _this$ws$getUserId2, _this$ws14;

          if (!this.playerShowRoot) return;
          const characterId = (_this$ws$getCharacter12 = (_this$ws13 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter12.call(_this$ws13);
          if (!characterId) return;
          const requestId = `battle_get_player_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
          const req = {
            character_id: characterId,
            request_id: requestId
          };
          const userId = (_this$ws$getUserId2 = (_this$ws14 = this.ws).getUserId) == null ? void 0 : _this$ws$getUserId2.call(_this$ws14);
          if (userId) req.user_id = userId; // 先清掉上一次遗留的监听

          this.clearPlayerInfoListener(); // 兼容服务器实际事件：'player_info' / 'player_info_response'
          // 同时尽量用 request_id 过滤，避免吃到其他面板的返回

          const handler = resp => {
            const data = resp && resp.success && resp.data && typeof resp.data === 'object' ? { ...resp,
              ...resp.data
            } : resp;
            if (!data || data.success !== true) return;
            const isSelf = data.is_self === true || data.is_self === 'true' || data.is_self === 1 || data.is_self === '1';
            if (!isSelf) return; // 若响应携带 request_id，则必须匹配；否则退化为 character_id 匹配

            if (data.request_id !== undefined && data.request_id !== null) {
              if (data.request_id !== requestId) return;
            } else {
              const respCid = String(data.character_id || '');
              if (respCid && respCid !== characterId) return;
            }

            const name = String(data.role_name || '');
            const spriteIndex = Number(data.Sprite || data.sprite || 0);
            this.applyRoleShow(this.playerShowRoot, name, spriteIndex);
            cleanup();
          };

          this.playerInfoListener = handler;

          const cleanup = () => this.clearPlayerInfoListener();

          this.ws.on('player_info', handler, this);
          this.ws.on('player_info_response', handler, this); // 不做 3 秒超时自动清理：进入战斗时可能卡加载/网络慢，避免错过回包导致永远不显示
          // 发送请求（不依赖 request() 的 *_response 机制）

          this.ws.send({
            type: 'get_player',
            ...req
          }, true, true);
        }

        clearPlayerInfoListener() {
          if (!this.playerInfoListener) return;

          if (this.ws) {
            this.ws.off('player_info', this.playerInfoListener, this);
            this.ws.off('player_info_response', this.playerInfoListener, this);
          }

          this.playerInfoListener = null;
        }

        refreshEnemyShowFromCharacterId(characterId) {
          var _this$ws$getUserId3, _this$ws15;

          if (!this.enemyPlayerShowRoot || !characterId) {
            this.refreshEnemyShowRandom();
            return;
          }

          const requestId = `battle_get_enemy_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
          const req = {
            character_id: characterId,
            request_id: requestId
          };
          const userId = (_this$ws$getUserId3 = (_this$ws15 = this.ws).getUserId) == null ? void 0 : _this$ws$getUserId3.call(_this$ws15);
          if (userId) req.user_id = userId;
          this.clearEnemyInfoListener();

          const handler = resp => {
            const data = resp && resp.success && resp.data && typeof resp.data === 'object' ? { ...resp,
              ...resp.data
            } : resp;
            if (!data || data.success !== true) return;

            if (data.request_id !== undefined && data.request_id !== null) {
              if (data.request_id !== requestId) return;
            } else {
              const respCid = String(data.character_id || '');
              if (respCid && respCid !== characterId) return;
            }

            const name = String(data.role_name || '');
            const spriteIndex = Number(data.Sprite || data.sprite || 0);
            this.applyRoleShow(this.enemyPlayerShowRoot, name, spriteIndex);
            cleanup();
          };

          this.enemyInfoListener = handler;

          const cleanup = () => this.clearEnemyInfoListener();

          this.ws.on('player_info', handler, this);
          this.ws.on('player_info_response', handler, this);
          this.ws.send({
            type: 'get_player',
            ...req
          }, true, true);
        }

        clearEnemyInfoListener() {
          if (!this.enemyInfoListener) return;

          if (this.ws) {
            this.ws.off('player_info', this.enemyInfoListener, this);
            this.ws.off('player_info_response', this.enemyInfoListener, this);
          }

          this.enemyInfoListener = null;
        }

        refreshEnemyShowRandom() {
          if (!this.enemyPlayerShowRoot) return;
          const randomNames = ['敌人', '神秘人', '挑战者', '对手', '来者不善'];
          const name = `${randomNames[Math.floor(Math.random() * randomNames.length)]}${Math.floor(100 + Math.random() * 900)}`;
          const spriteIndex = this.characterAvatarFrames.length > 0 ? 1 + Math.floor(Math.random() * this.characterAvatarFrames.length) : 0;
          this.applyRoleShow(this.enemyPlayerShowRoot, name, spriteIndex);
        }

        applyRoleShow(root, roleName, spriteIndex) {
          const nameNode = root.getChildByName('Name');

          if (nameNode) {
            const label = nameNode.getComponent(Label);
            if (label) label.string = roleName || '';
          }

          const playerNode = root.getChildByName('Player');

          if (playerNode) {
            const sprite = playerNode.getComponent(Sprite);

            if (sprite) {
              const idx = spriteIndex - 1;

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
          let frame = null; // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng

          if (classValue === 2) frame = this.player1ClassIconSheji;else if (classValue === 3) frame = this.player1ClassIconQuanneng;else frame = this.player1ClassIconGedou;
          if (frame) this.player1ClassIcon.spriteFrame = frame;
        }

        updateEnemy1ClassIcon(classValue) {
          if (!this.enemy1ClassIcon) return;
          let frame = null; // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng

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

          const textKeys = ['Growth', 'Comprehension', 'StarLevel', 'Star', 'RobotName', 'Level', 'Class'];

          for (const key of textKeys) {
            const parent = this.findChildByName(root, key);
            const labelNode = (parent == null ? void 0 : parent.getChildByName('NumericalValue')) || null;
            const label = (labelNode == null ? void 0 : labelNode.getComponent(Label)) || null;
            if (label) this.mechTextMap[key] = label;
          } // 分割型（基础值/当前值）


          const nodeKeys = ['Melee', 'Armor', 'Accuracy', 'Corrosion', 'Initiative', 'Block', 'AttackCount', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'];

          for (const key of nodeKeys) {
            var _layoutNode$getChildB, _layoutNode$getChildB2;

            const parent = this.findChildByName(root, key);
            const layoutNode = (parent == null ? void 0 : parent.getChildByName('Node')) || null;
            if (!layoutNode) continue;
            this.mechNodeMap[key] = {
              left: ((_layoutNode$getChildB = layoutNode.getChildByName('LeftLabel')) == null ? void 0 : _layoutNode$getChildB.getComponent(Label)) || null,
              right: ((_layoutNode$getChildB2 = layoutNode.getChildByName('RightLabel')) == null ? void 0 : _layoutNode$getChildB2.getComponent(Label)) || null,
              slash: layoutNode.getChildByName('SlashSprite') || null
            };
          } // 进度条（HP/MP/EXP）


          const barKeys = [{
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

          for (const item of barKeys) {
            const parent = this.findChildByName(root, item.key);
            const panel = (parent == null ? void 0 : parent.getChildByName(item.panel)) || null;
            const barNode = (panel == null ? void 0 : panel.getChildByName(item.cur)) || null;
            const labelNode = (panel == null ? void 0 : panel.getChildByName('NumericalValue')) || null;
            const label = (labelNode == null ? void 0 : labelNode.getComponent(Label)) || null;

            if (barNode || label) {
              this.mechBarMap[item.key] = {
                bar: barNode,
                label
              };
            }
          }
        }

        refreshPlayerMechAttributeUI(force = false) {
          if (!this.mechAttributeRoot) return;
          if (!this.playerUnit) return;
          this.ensureMechAttributeInited();
          const data = this.buildPlayerMechDisplayData();
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
          let raw = this.playerUnit.rawData;

          if (raw && raw.data && typeof raw.data === 'object') {
            raw = { ...raw,
              ...raw.data
            };
          }

          const base = raw && typeof raw === 'object' ? raw : {}; // 用战斗内实时值覆盖 CurrentHP

          return { ...base,
            pet_id: this.playerUnit.petId,
            RobotName: (_base$RobotName = base.RobotName) != null ? _base$RobotName : this.playerUnit.name,
            Level: (_base$Level = base.Level) != null ? _base$Level : this.playerUnit.level,
            MaxHP: Number((_base$MaxHP = base.MaxHP) != null ? _base$MaxHP : this.playerUnit.maxHp),
            CurrentHP: Number(this.playerUnit.hp)
          };
        }

        applyMechAttributeDataToUI(data) {
          // 文本
          for (const key of Object.keys(this.mechTextMap)) {
            var _data$key;

            const label = this.mechTextMap[key];
            if (!label) continue;

            if (key === 'Star') {
              var _data$StarLevel;

              label.string = String((_data$StarLevel = data['StarLevel']) != null ? _data$StarLevel : '');
              continue;
            }

            if (key === 'RobotName') {
              var _data$RobotName;

              const name = String((_data$RobotName = data['RobotName']) != null ? _data$RobotName : '');
              const formNum = Number(data['Form'] !== undefined ? data['Form'] : data['Fo'] !== undefined ? data['Fo'] : 0);
              let suffix = '';
              if (formNum === 1) suffix = '|初';else if (formNum === 2) suffix = '|中';else if (formNum === 3) suffix = '|终';
              label.string = name + suffix;
              continue;
            }

            if (key === 'Class') {
              var _data$Class;

              const classNum = Number((_data$Class = data['Class']) != null ? _data$Class : 1);
              let classStr = '格斗型';
              if (classNum === 2) classStr = '射击型';else if (classNum === 3) classStr = '全能型';
              label.string = classStr;
              continue;
            }

            label.string = String((_data$key = data[key]) != null ? _data$key : '');
          } // 分割值


          for (const key of Object.keys(this.mechNodeMap)) {
            var _data$key2;

            const group = this.mechNodeMap[key];
            if (!group || !group.left) continue;
            const baseValue = (_data$key2 = data[key]) != null ? _data$key2 : 0;
            const currentKey = 'Current' + key;
            const hasCurrent = Object.prototype.hasOwnProperty.call(data, currentKey); // 有 Current 且节点含 RightLabel/SlashSprite → 显示 base/current 分割；
            // 否则只显示 base（节点缺 right/slash 时也不能整块跳过）

            if (hasCurrent && group.right && group.slash) {
              var _data$currentKey;

              group.left.string = String(baseValue);
              group.right.string = String((_data$currentKey = data[currentKey]) != null ? _data$currentKey : 0);
              group.slash.active = true;
            } else {
              group.left.string = String(baseValue);
              if (group.right) group.right.string = '';
              if (group.slash) group.slash.active = false;
            }
          } // 进度条


          const barKeys = [{
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

          for (const item of barKeys) {
            var _data$item$cur, _data$item$max;

            const bar = this.mechBarMap[item.key];
            if (!bar) continue;
            const cur = Number((_data$item$cur = data[item.cur]) != null ? _data$item$cur : 0);
            const max = Number((_data$item$max = data[item.max]) != null ? _data$item$max : 0);

            if (bar.label) {
              bar.label.string = `${cur}/${max}`;
            }

            if (bar.bar) {
              this.setBarWidth(bar.bar, cur, max);
            }
          }
        }

        setBarWidth(barNode, cur, max) {
          const percent = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
          const width = Math.max(1, this.ATTR_BAR_MAX_WIDTH * percent);
          const uiTrans = barNode.getComponent(UITransform);

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
          } catch {}
        }
        /**
         * 把单位 MP 回写进 rawData（与 `syncUnitHpToRawData` 同构）。
         * 技能会扣蓝、吸血/回蓝会涨蓝，UI 读的是 rawData.CurrentMP，必须同步。
         */


        syncUnitMpToRawData(unit) {
          if (!unit || !unit.rawData) return;

          try {
            unit.rawData.CurrentMP = unit.mp;

            if (unit.rawData.data && typeof unit.rawData.data === 'object') {
              unit.rawData.data.CurrentMP = unit.mp;
            }
          } catch {}
        }
        /**
         * 递归查找子节点（容错：找不到返回 null）
         */


        findChildByName(parent, name) {
          if (parent.name === name) return parent;

          for (const child of parent.children) {
            const found = this.findChildByName(child, name);
            if (found) return found;
          }

          return null;
        }

      }, _class3.PASSIVE_EFFECT_GAP = 0.6, _class3.ROUND_EVENT_GAP = 0.55, _class3.MELEE_CONTACT_GAP = 30, _class3.KNOCKBACK_DELTA = 30, _class3.MELEE_RETURN_TIME = 0.14, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "playerRobotShow", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "enemyRobotShow", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "battleSelectPanel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "attackButton", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "defendButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "escapeButton", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "skillButton", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "skillSelectPanel", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "timerLabel", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "timerRoot", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "logLabel", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "matchingLoadingPanel", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "mechAttributeRoot", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIcon", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconGedou", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconQuanneng", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "player1ClassIconSheji", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIcon", [_dec20], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconGedou", [_dec21], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconQuanneng", [_dec22], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class2.prototype, "enemy1ClassIconSheji", [_dec23], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class2.prototype, "playerShowRoot", [_dec24], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor24 = _applyDecoratedDescriptor(_class2.prototype, "enemyPlayerShowRoot", [_dec25], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor25 = _applyDecoratedDescriptor(_class2.prototype, "characterAvatarFrames", [_dec26], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return [];
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=12dd9bdad0808c821c7cf9253f53d13628985bd3.js.map