import { _decorator, Component, Node, Label, Button, tween, Tween, Vec3, UITransform, Sprite, SpriteAtlas, SpriteFrame, Color, resources, JsonAsset } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
import { RobotShow } from './RobotShow';
import { BattleResumeController, ensureBattleResumeController } from './BattleResumeController';
import { isActiveRoomConflict, roomIdOf, type BattleRoomStateLike } from './battle-resume-gate';
import {
    resolveOnEnableAction,
    validateStoryBattleCreate,
    type BattleEntryIntent,
} from './battle-entry-intent';
import { validateBattleRestoreState } from './battle-restore';
import type { StoryBattleFinishedResult } from './story-runtime-mode';
import { Logger } from '../global/Logger';
import * as SkillData from './SkillData';
import { SkillSelectPanel } from './SkillSelectPanel';

const { ccclass, property } = _decorator;

enum BattleState {
    INIT = 'INIT',
    WAITING_COMMANDS = 'WAITING_COMMANDS', // 双方都在“选指令”阶段（玩家等待输入，敌方可默认选择）
    ANIMATING = 'ANIMATING',
    FINISHED = 'FINISHED',
}

type Side = 'player' | 'enemy';

interface BattleUnit {
    side: Side;
    name: string;
    level: number;
    maxHp: number;
    hp: number;
    /** 能量上限（MaxMP）。被动「能量恢复」回的就是它；老数据无 MP 时为 0 */
    maxMp: number;
    /** 当前能量（CurrentMP） */
    mp: number;
    attack: number;
    defense: number;
    initiative: number;
    /** 攻击次数 AttackCount（= 一次攻击拆成几段，默认 1）。 */
    attackTimes: number;
    petId?: string;
    rawData: any;   // 原始 robot_pet_info，用于 RobotShow
}

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
function resolveAttackTimes(info: any): number {
    if (!info) return 1;

    const pick = (v: any): number | null => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return (!Number.isNaN(n) && n >= 1) ? Math.floor(n) : null;
    };

    // 1) 装备加成后的最终段数（服务端权威）
    const current = pick(info.CurrentAttackCount ?? info.currentAttackCount);
    if (current !== null) return current;

    // 2) 兼容老结构：顶层直传
    const direct = pick(info.AttackCount ?? info.attackCount);
    if (direct !== null) return direct;

    // 3) 装备累加：每件装备的 attackCount 为"该装备提供的段数加成"（0/1/2），
    //   总段数 = 1 + Σ(装备加成)
    const equip = info.equipment || info?.data?.equipment;
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
            const text: string = item?.effecttext || item?.effect_text || '';
            const m = /攻击次数\s*\+\s*(\d+)/.exec(text || '');
            if (m) { sum += Number(m[1]); found = true; }
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
function computeAttackSegments(baseDamage: number, attackCount: number, rng?: () => number): number[] {
    const total = Math.max(1, Math.floor(baseDamage));
    const segN = Math.max(1, Math.floor(attackCount || 1));
    if (segN <= 1) {
        return [total];
    }
    const rand = rng || Math.random;

    // 总体提升上限 20%：本轮实际提升量在 [0, 0.20] 内随机（偏向低值，避免每次都满 20%）
    const boost = Math.pow(rand(), 1.6) * 0.20;
    let grand = total * (1 + boost);

    // 每段权重大致均分，带 ±35% 的小幅波动（体现“每段有区间小变化”）
    const weights: number[] = [];
    let wsum = 0;
    for (let i = 0; i < segN; i++) {
        const w = (1.0 / segN) * (0.65 + rand() * 0.70); // 0.65 ~ 1.35 相对权重
        weights.push(w);
        wsum += w;
    }
    // 归一化 + 取整，最后一段吸收舍入误差，保证总和 == floor(grand)
    const segs: number[] = [];
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


type ActionType = 'ATTACK' | 'DEFEND' | 'ESCAPE' | 'ITEM' | 'SKILL';

interface BattleAction {
    side: Side;
    type: ActionType;
    payload?: any;
}

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
@ccclass('BattleScene')
export class BattleScene extends Component {
    // 玩家与敌方的展示
    @property({ type: RobotShow, tooltip: '玩家机甲 RobotShow（左侧）' })
    playerRobotShow: RobotShow | null = null;

    @property({ type: RobotShow, tooltip: '敌人机甲 EnemyRobotShow（右侧，已镜像）' })
    enemyRobotShow: RobotShow | null = null;

    // 操作面板
    @property({ type: Node, tooltip: '战斗操作面板 BattleSelectButton（含攻击 / 逃跑 / 返回按钮）' })
    battleSelectPanel: Node | null = null;

    @property({ type: Button, tooltip: '攻击按钮' })
    attackButton: Button | null = null;

    @property({ type: Button, tooltip: '防御/待机按钮（本回合啥也不做）' })
    defendButton: Button | null = null;

    @property({ type: Button, tooltip: '逃跑按钮' })
    escapeButton: Button | null = null;

    @property({ type: Button, tooltip: '返回（仅切换操作面板显示，不退出战斗）' })
    backButton: Button | null = null;

    // ========= 新增：战斗内「技能」按钮 + 技能选择面板（SkillSelect） =========
    // 两者都可以留空：运行时按名字在场景里找（Skill / SkillSelect），找到后再兜底 addComponent。
    @property({ type: Button, tooltip: '技能按钮（BattleSelectButton/Skill）——点击打开技能选择面板' })
    skillButton: Button | null = null;

    @property({ type: SkillSelectPanel, tooltip: '技能选择面板（场景内的 SkillSelect；选中技能后才出现「确认」）' })
    skillSelectPanel: SkillSelectPanel | null = null;

    // 倒计时显示（Time/Number）
    @property({ type: Label, tooltip: '倒计时文本（Time/Number）' })
    timerLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Time 根节点（可选，仅用于显隐控制）' })
    timerRoot: Node | null = null;

    // 简单战斗日志（可选）
    @property({ type: Label, tooltip: '战斗日志文本（可选）' })
    logLabel: Label | null = null;

    // 匹配 Loading 面板（PVP 匹配中显示）
    @property({ type: Node, tooltip: '匹配 Loading 面板（PVP 匹配中显示，可选）' })
    matchingLoadingPanel: Node | null = null;

    // ========= 新增：战斗中机甲属性面板（实时刷新当前出场机甲） =========
    @property({ type: Node, tooltip: '机甲属性面板根节点（场景内的 MechAttribute）' })
    mechAttributeRoot: Node | null = null;

    // ========= 新增：MechaClass/Player1 图标 =========
    // 图标帧由你在 Inspector 手动绑定（gedou / quanneng / sheji），避免依赖 spriteAtlas 命名/配置
    @property({ type: Sprite, tooltip: 'MechaClass 下 Player1 图标（Sprite）' })
    player1ClassIcon: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: '格斗 gedou 图标（SpriteFrame）' })
    player1ClassIconGedou: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '全能 quanneng 图标（SpriteFrame）' })
    player1ClassIconQuanneng: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '射击 sheji 图标（SpriteFrame）' })
    player1ClassIconSheji: SpriteFrame | null = null;

    // ========= 新增：敌方职业图标 =========
    // 同样允许你在 Inspector 手动绑定帧，确保与当前 atlas/UI 配置无关
    @property({ type: Sprite, tooltip: '敌方职业图标（Sprite）' })
    enemy1ClassIcon: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: '敌方格斗 gedou 图标（SpriteFrame）' })
    enemy1ClassIconGedou: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '敌方全能 quanneng 图标（SpriteFrame）' })
    enemy1ClassIconQuanneng: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '敌方射击 sheji 图标（SpriteFrame）' })
    enemy1ClassIconSheji: SpriteFrame | null = null;

    // ========= 新增：左右角色形象与名字（PlayerShow / EnemyPlayerShow） =========
    @property({ type: Node, tooltip: '玩家角色显示根节点（PlayerShow，含 Player(Sprite) 与 Name(Label)）' })
    playerShowRoot: Node | null = null;

    @property({ type: Node, tooltip: '敌方角色显示根节点（EnemyPlayerShow，含 Player(Sprite) 与 Name(Label)）' })
    enemyPlayerShowRoot: Node | null = null;

    @property({ type: [SpriteFrame], tooltip: '角色头像 SpriteFrames（与 Character 面板一致，Sprite=1 对应索引0）' })
    characterAvatarFrames: SpriteFrame[] = [];

    private ws: WebSocketManager = null!;
    private cacheManager: DataCacheManager = null!;

    private playerUnit: BattleUnit | null = null;
    private enemyUnit: BattleUnit | null = null;

    private state: BattleState = BattleState.INIT;

    // 玩家操作倒计时（秒）
    private readonly TURN_TIME_LIMIT = 30;
    private turnTimeLeft: number = 0;

    // 「空窗挽回期」：进入指令阶段后先静默观察 GRACE_SECONDS 秒，任一方/双方无操作才显示并启动倒计时
    private readonly GRACE_SECONDS = 5;
    /** 本回合空窗观察剩余秒数（>0 表示还在静默期，倒计时面板隐藏） */
    private graceTimeLeft: number = 0;
    /** 倒计时是否已激活（激活后才显示「剩余时间」面板） */
    private graceActive: boolean = false;

    /** PVP：已播放过动画的最大回合号，用于对服务端 pvp_round_update 推送去重 */
    private _lastPlayedPvpRound: number = 0;
    /** PVP：自己已提交本回合指令、正在等待对方（此期间倒计时继续显示，便于判断对方是否挂机） */
    private _waitingOpponent: boolean = false;
    /** PVP：倒计时归零后等待服务器推送的累计时长（秒），超过兜底自行提交普攻 */
    private _afterZeroWait: number = 0;

    // 动画控制
    private isAnimating: boolean = false;
    /** 看门狗计时：ANIMATING 状态持续时长（秒），超阈值强制恢复，防止死锁 */
    private animWatchdog: number = 0;

    // 当前回合双方的指令（先选指令，再按先后手结算）
    private pendingPlayerAction: BattleAction | null = null;
    private pendingEnemyAction: BattleAction | null = null;

    // 敌人是否在生成中（服务器异步返回）
    private isEnemyGenerating: boolean = false;

    // 入场动画：缓存起点/终点，避免每次打开叠加位移
    private entrancePlayerPos: Vec3 | null = null;
    private entranceEnemyPos: Vec3 | null = null;
    private battlePlayerPos: Vec3 | null = null;
    private battleEnemyPos: Vec3 | null = null;

    // ====== MechAttribute 面板绑定缓存（复用 MechAttributeTEST 的结构）======
    private mechAttrInited: boolean = false;
    private mechTextMap: Record<string, Label> = {};
    private mechNodeMap: Record<string, { left: Label | null; right: Label | null; slash: Node | null }> = {};
    private mechBarMap: Record<string, { bar: Node | null; label: Label | null }> = {};
    private readonly ATTR_BAR_MAX_WIDTH = 147; // 与 MechAttributeTEST 保持一致

    private attributeAutoRefreshStarted: boolean = false;
    private readonly ATTR_REFRESH_INTERVAL = 0.1; // 100ms 刷新一次，足够“实时”且性能可控
    private readonly attrRefreshTick = () => {
        this.refreshPlayerMechAttributeUI(false);
    };

    // 玩家信息请求的一次性监听器（防止 BattleScene 关闭时泄漏）
    private playerInfoListener: ((resp: any) => void) | null = null;
    private enemyInfoListener: ((resp: any) => void) | null = null;

    // 房间制战斗相关（默认开启，一场战斗一个房间，支持断线恢复）
    private useServerRoomBattle: boolean = true;
    private roomId: string | null = null;         // 当前战斗房间 ID（PVE 单人一房间）
    private isRequestingAction: boolean = false;  // 正在向服务器发送指令中，防止重复点击

    private currentBattleMode: 'pve' | 'pvp' = 'pve';
    private _pvpFlatMatchInProgress: boolean = false;

    /** 修复点：会话标识，异步回调中校验，避免快速开关面板时旧回调覆盖新状态 */
    private _sessionId: number = 0;
    /**
     * 显式进入意图。onEnable 不得推测来源。
     * new-pve | story | resume | pvp
     */
    private _entryIntent: BattleEntryIntent | null = null;
    /** 已应用过的恢复 room_id，避免同房重复入场动画 */
    private _appliedRestoreRoomId: string | null = null;
    /** 剧情战斗结束回调与上下文（由 story intent 携带，不参与来源猜测） */
    private _storyBattleCallback: ((result: StoryBattleFinishedResult) => void) | null = null;
    private _storyContext: { eventId: string; battleRef: string; mapCode: string } | null = null;

    /**
     * 进入服务器战斗房间兜底：
     * - resume/create 后，如果一定时间内没有拿到并应用到完整 room state
     * - 或者 room state 里缺少 player/enemy
     * 则直接关闭 BattleScene，避免客户端卡在“房间里但没法继续”的状态。
     */
    private _roomStateApplied = false;
    private readonly BATTLE_ENTER_TIMEOUT_SEC = 12;
    private _onBattleEnterTimeout = () => {
        if (!this.node?.isValid) return;
        if (this._roomStateApplied) return;
        // 仅在服务端房间战斗模式下启用该兜底
        if (!this.useServerRoomBattle) return;
        Logger.error('[BattleScene] 进入战斗房间超时：未能应用完整 room state，自动退出面板避免卡死');
        const storyCb = this._storyBattleCallback;
        if (storyCb) {
            this._storyBattleCallback = null;
            this._storyContext = null;
            storyCb({
                won: false,
                roomId: this.roomId || '',
                winner: 'enemy',
                reason: 'timeout',
                errMsg: '进入战斗超时，请重试',
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
    private readonly COMMAND_PANEL_DELAY_AFTER_ANIMATIONS = 0.25;

    // 在线房间战斗：用于“服务器结算 + 本地动画”的回合快照
    private lastRoundPlayerHp: number = 0;
    private lastRoundEnemyHp: number = 0;
    private lastRoundPlayerAction: ActionType | null = null;
    private readonly SERVER_ENEMY_ACTION: ActionType = 'ATTACK';

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        this.cacheManager = DataCacheManager.getInstance();

        // 资源预热：提前加载 RobotShow 所需的 json/图集/装备位置，避免进入战斗时现加载卡顿
        // 这里调用是幂等的（RobotShow 内部有静态缓存）
        try {
            RobotShow.preloadResources();
        } catch {}

        // 自动恢复由 BattleResumeController 统一负责（本组件只注册自身供恢复打开面板）
        ensureBattleResumeController().registerBattleScene(this);

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

        // 技能按钮（BattleSelectButton/Skill）→ 打开技能选择面板。
        //   没在 Inspector 挂也没关系：按名字在战斗操作面板下找。
        const skillBtn = this.resolveSkillButton();
        if (skillBtn) {
            skillBtn.node.on(Button.EventType.CLICK, this.onSkillClicked, this);
        }
        // 技能选择面板：先确保组件在（找不到就 addComponent），并初始关闭（场景里可能留着显示状态）
        this.ensureSkillSelectPanel();
        this.closeSkillSelectPanel();

        // 监听服务端主动推送的「PVP 回合结算」消息：
        //   挂机方从不发请求，靠该推送才能拿到新 state 并播放整回合动画（含自己被攻击）。
        this.ws.on(GameConfig.MESSAGE_TYPES.PVP_ROUND_UPDATE, this.onPvpRoundUpdate, this);

        // 技能目录：技能名 / 特效名 / 能量消耗 / 可施放列表都从 Skills.json 读（服务端同源副本）
        this.loadSkillCatalog();
    }

    /**
     * 加载技能目录（`assets/resources/json/Skills.json`，v5）并注入 SkillData。
     *
     * 注入后 `SkillData` 才能提供：技能名/特效名查询、能量消耗、可施放技能列表（供后续技能面板接入）。
     * ⚠ 加载失败不影响战斗：结算与表现的全部权威数据都由服务端 state.round_events 下发，
     *   目录只用于「名称/特效/UI 列表」这类展示信息。
     */
    private loadSkillCatalog(): void {
        try {
            resources.load('json/Skills', JsonAsset, (err: Error | null, asset: JsonAsset | null) => {
                if (err || !asset) {
                    Logger.warn('[BattleScene] 技能目录 json/Skills 加载失败（仅影响技能名/列表展示）:', err);
                    return;
                }
                const data: any = (asset as any).json || null;
                SkillData.setSkillCatalog(data);
                Logger.info(
                    `[BattleScene] 技能目录已注入：v${data?.version} / ` +
                    `${Array.isArray(data?.skills) ? data.skills.length : 0} 条`
                );
            });
        } catch (err) {
            Logger.warn('[BattleScene] 技能目录加载异常:', err);
        }
    }

    /** 修复点：onDestroy 解绑按钮，避免节点销毁后仍触发事件导致泄漏或报错 */
    onDestroy() {
        if (this.attackButton?.node) {
            this.attackButton.node.off(Button.EventType.CLICK, this.onAttackClicked, this);
        }
        if (this.defendButton?.node) {
            this.defendButton.node.off(Button.EventType.CLICK, this.onDefendClicked, this);
        }
        if (this.escapeButton?.node) {
            this.escapeButton.node.off(Button.EventType.CLICK, this.onEscapeClicked, this);
        }
        if (this.backButton?.node) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClicked, this);
        }
        if (this.skillButton?.node) {
            this.skillButton.node.off(Button.EventType.CLICK, this.onSkillClicked, this);
        }
        this.ws.off(GameConfig.MESSAGE_TYPES.PVP_ROUND_UPDATE, this.onPvpRoundUpdate, this);
        this.clearPlayerInfoListener();
        this.clearEnemyInfoListener();
        try {
            BattleResumeController.getInstance().unregisterBattleScene(this);
        } catch (_) {}
    }

    onEnable() {
        const intent: BattleEntryIntent = this._entryIntent ?? 'new-pve';
        const action = resolveOnEnableAction(intent);

        // resume：状态已由 restoreFromServerState 同步应用，禁止 create / resume 网络请求
        if (action === 'resume-ready') {
            // 加固：恢复战斗时，若当前状态卡在「动画中」等中间态，强制回到指令阶段，
            //   避免残留的 ANIMATING 状态导致面板不可操作、无法退出。
            //   注意：FINISHED 是合法终态（战斗已结束），不能强制恢复。
            if (this.state !== BattleState.WAITING_COMMANDS && this.state !== BattleState.FINISHED) {
                Logger.warn(`[BattleScene] resume-ready 状态异常(state=${this.state})，强制恢复指令阶段`);
                this.isAnimating = false;
                this.isRequestingAction = false;
                this.animWatchdog = 0;
                this.startCommandPhase();
            }
            this._syncBattlePortraitVisibility();
            return;
        }

        // story：CREATE 由 startStoryBattle 发起，此处不得退化随机 PVE
        if (action === 'story-wait') {
            this.prepareRobotShowsForNewBattle();
            this._syncBattlePortraitVisibility();
            return;
        }

        // 重置所有状态标志，确保每次打开都是干净的状态
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
        }

        // new-pve：调用一次 create，不先 resume
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
        // 关键修复：关闭面板 ≠ 战斗结束。此前把 state 设为 FINISHED，会导致再次打开时
        //   onEnable 的 resume-ready 分支带着 FINISHED 状态进入，入场动画播完后
        //   startCommandPhase() 因 `state === FINISHED` 直接 return → 战斗卡死且退不出。
        //   这里只清理动画/请求锁（保留 FINISHED 供结算逻辑判断），状态复位交由 onEnable 分支处理。
        this.isAnimating = false;
        this.isRequestingAction = false;
        this.animWatchdog = 0;
        // 若当前不是「战斗结束」，说明是中途关闭面板，复位为 INIT，避免下次打开带着脏状态
        if (this.state !== BattleState.FINISHED) {
            this.state = BattleState.INIT;
        }
        if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
        if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false);

        // 清理事件监听
        if (this.ws) {
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
        }
        this.stopAttributeAutoRefresh();
        this.clearPlayerInfoListener();
        this.clearEnemyInfoListener();

        // 修复点：停止所有 Tween 和 schedule，避免禁用后回调仍执行导致状态错乱
        if (this.playerRobotShow?.node) Tween.stopAllByTarget(this.playerRobotShow.node);
        if (this.enemyRobotShow?.node) Tween.stopAllByTarget(this.enemyRobotShow.node);
        this.unscheduleAllCallbacks();

        // 清理回合快照（防止第二次战斗时数据错乱）
        this.lastRoundPlayerHp = 0;
        this.lastRoundEnemyHp = 0;
        this.lastRoundPlayerAction = null;

        // 清理待处理动作
        this.pendingPlayerAction = null;
        this.pendingEnemyAction = null;

        // 离开面板 ≠ 战斗结束：不销毁房间、不清除 Controller 已恢复标记，避免重复入场
        // roomId / _appliedRestoreRoomId 保留，供再次打开或 resume 去重
        this._entryIntent = null;

        this.unschedule(this._onBattleEnterTimeout);

        // 隐藏匹配 Loading
        if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;
        this._pvpFlatMatchInProgress = false;

        // 关闭面板时把位置复位到入场起点，避免下次打开叠加
        this.resetEntrancePositions();
    }

    /**
     * 被 Test.ts 点击后调用：请求进入 PVP 平匹配流程
     * 注意：真正发起网络请求在 onEnable 内执行，避免竞态（panel.active 切换触发生命周期）。
     */
    public requestPvpFlatMatch(): void {
        this._entryIntent = 'pvp';
    }

    private readonly PVP_MATCH_TIMEOUT_SEC = 5;

    private startPvpFlatMatchFlow(): void {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            Logger.error('[BattleScene] PVP 匹配：未获取到 characterId');
            this.node.active = false;
            return;
        }

        this._pvpFlatMatchInProgress = true;
        const sessionId = this._sessionId;

        // 匹配中先不“入场”：把双方机甲放回入场起点，并仅显示 Loading
        this.resetEntrancePositions();

        // 匹配中 UI：只显示 Loading，禁止操作
        if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = true;
        if (this.battleSelectPanel) this.battleSelectPanel.active = false;
        if (this.timerRoot) this.timerRoot.active = false;
        this.setButtonsInteractable(false);

        const tryCloseIfStillMatching = () => {
            if (!this.node?.isValid) return;
            if (this._sessionId !== sessionId) return;
            if (!this._pvpFlatMatchInProgress) return;
            this._pvpFlatMatchInProgress = false;
            if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;
            this.node.active = false;
        };
        this.scheduleOnce(tryCloseIfStillMatching, this.PVP_MATCH_TIMEOUT_SEC);

        // 向服务器请求“平匹配”（服务端会等待 5 秒内找到对手）
        this.ws.request(
            GameConfig.MESSAGE_TYPES.PVP_FLAT_MATCH,
            { character_id: characterId },
            (resp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                this._pvpFlatMatchInProgress = false;
                if (this.matchingLoadingPanel) this.matchingLoadingPanel.active = false;

                if (!resp?.success || !resp.data?.state) {
                    this.node.active = false;
                    return;
                }

                // 匹配成功：直接应用房间 state（isNewRoom=false，使用服务器剩余倒计时更精确）
                // isNewRoom=true：匹配成功后播放入场动画，再进入指令阶段
                this.applyServerRoomState(resp.data.state, true);
            },
            true,
            (this.PVP_MATCH_TIMEOUT_SEC + 2) * 1000
        );
    }

    // =========================
    // 房间制战斗入口与状态同步
    // =========================

    /**
     * 剧情战斗入口：intent=story，必须携带 story_event_id + map_code（除非 skipServerAuth）。
     * 不得退化为普通随机 PVE。
     */
    public startStoryBattle(opts: {
        mapCode: string;
        eventId: string;
        battleRef: string;
        /** 跳过 story_interact 授权（本地剧情验收）；战斗仍走 battle_room_create */
        skipServerAuth?: boolean;
        onFinished: (result: StoryBattleFinishedResult) => void;
    }): void {
        const validated = validateStoryBattleCreate({
            eventId: opts.eventId,
            mapCode: opts.mapCode,
            battleRef: opts.battleRef,
            skipServerAuth: opts.skipServerAuth,
        });
        if (validated.ok === false) {
            Logger.error('[BattleScene] 剧情战拒绝创建:', validated.reason);
            opts.onFinished({
                won: false,
                roomId: '',
                winner: 'enemy',
                reason: validated.reason,
                errMsg: validated.reason === 'missing_event_id'
                    ? '缺少 event_id'
                    : validated.reason === 'missing_map_code'
                        ? '缺少 map_code'
                        : '剧情战斗参数不完整',
            });
            return;
        }

        this._entryIntent = 'story';
        this._storyBattleCallback = opts.onFinished;
        this._storyContext = {
            eventId: opts.eventId,
            battleRef: opts.battleRef,
            mapCode: opts.mapCode,
        };
        this.currentBattleMode = 'pve';
        this._sessionId += 1;
        this._roomStateApplied = false;
        this.unschedule(this._onBattleEnterTimeout);
        this.prepareRobotShowsForNewBattle();

        this.node.active = true;
        this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);

        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            Logger.error('[BattleScene] 剧情战：未获取 characterId');
            opts.onFinished({
                won: false,
                roomId: '',
                winner: 'enemy',
                reason: 'no_character',
                errMsg: '未选择角色，无法进入战斗',
            });
            return;
        }
        const sessionId = this._sessionId;
        const createPayload: Record<string, string> = { character_id: characterId };
        if (!opts.skipServerAuth) {
            createPayload.story_event_id = opts.eventId;
            createPayload.map_code = opts.mapCode;
            if (opts.battleRef) createPayload.battle_ref = opts.battleRef;
        } else if (opts.battleRef) {
            createPayload.battle_ref = opts.battleRef;
        }
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_CREATE,
            createPayload,
            (createResp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (isActiveRoomConflict(createResp)) {
                    Logger.debug('[BattleScene] 剧情 create 冲突：转统一恢复');
                    this._storyBattleCallback = null;
                    this._storyContext = null;
                    this._entryIntent = null;
                    this.node.active = false;
                    ensureBattleResumeController().scheduleCheck('story_create_conflict');
                    return;
                }
                if (!createResp?.success || !createResp.data?.state) {
                    const msg = createResp?.message || '剧情战斗房间创建失败';
                    Logger.error('[BattleScene] 剧情战斗房间创建失败', createResp);
                    this._storyBattleCallback?.({
                        won: false,
                        roomId: '',
                        winner: 'enemy',
                        reason: 'create_failed',
                        errMsg: msg,
                    });
                    this._storyBattleCallback = null;
                    this._storyContext = null;
                    this._entryIntent = null;
                    this.node.active = false;
                    return;
                }
                this.applyServerRoomState(createResp.data.state, true);
            },
            true,
            12000,
        );
    }

    /**
     * 玩家明确发起普通新战斗：直接 battle_room_create。
     * 自动恢复不走此路径（由 BattleResumeController 负责）。
     * 若服务端返回已有活动房间冲突 → 转统一恢复，不二次 create。
     */
    private enterBattleRoom() {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            Logger.error('[BattleScene] 未获取到 characterId，无法进入战斗房间');
            return;
        }

        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_CREATE,
            { character_id: characterId },
            (createResp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (isActiveRoomConflict(createResp)) {
                    Logger.debug('[BattleScene] create 冲突：已有活动房间，转 BattleResumeController');
                    this.node.active = false;
                    ensureBattleResumeController().scheduleCheck('create_conflict');
                    return;
                }
                if (!createResp?.success || !createResp.data?.state) {
                    Logger.error('[BattleScene] 创建战斗房间失败:', createResp?.message || createResp);
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
            },
            true,
            10000
        );
    }

    /**
     * 统一恢复入口：同步校验并应用服务端状态。
     * 成功返回 true；失败返回 false，且不改变当前 roomId、不标记已恢复。
     * resume 意图下不发起任何网络请求、不 create。
     */
    public restoreFromServerState(state: BattleRoomStateLike): boolean {
        const characterId = this.ws?.getCharacterId?.() ?? null;
        const validated = validateBattleRestoreState(state, characterId);
        if (validated.ok === false) {
            const rejectReason = validated.reason;
            Logger.error(`[BattleScene] restore rejected: ${rejectReason}`);
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
                Logger.error('[BattleScene] restore apply did not set roomId');
                return false;
            }
            this.log('已恢复战斗连接，状态已同步');
            return true;
        } catch (e) {
            this.roomId = prevRoomId;
            this._appliedRestoreRoomId = prevApplied;
            this._entryIntent = prevIntent;
            Logger.error('[BattleScene] restore apply exception', e);
            return false;
        }
    }

    /**
     * 将服务器房间状态映射到本地 BattleScene（HP/属性/UI）
     * @param state 服务器返回的房间状态
     * @param isNewRoom 是否是新创建的房间（true=新房间需要播放动画，false=恢复房间直接设置位置）
     * @param forRoundAnimation 若为 true：仅同步单位/展示数据，不调用 finishBattle、不显示操作面板（用于本回合动画播完后再收尾）
     */
    private applyServerRoomState(state: any, isNewRoom: boolean = false, forRoundAnimation: boolean = false) {
        if (!state) return;

        const incomingRoomId = roomIdOf(state as BattleRoomStateLike);
        // 同一 room 已恢复过：仅同步数据，不重复入场动画
        if (!forRoundAnimation && !isNewRoom && incomingRoomId && this._appliedRestoreRoomId === incomingRoomId && this._roomStateApplied) {
            Logger.debug(`[BattleScene] skip duplicate restore animation room_id=${incomingRoomId}`);
            return;
        }

        if (isNewRoom && !forRoundAnimation) {
            this.prepareRobotShowsForNewBattle();
        }

        // 根据服务器返回的模式切换：PVP 可能需要更长的 action 等待时间（双方都提交完才结算）
        this.currentBattleMode = state?.mode === 'pvp' ? 'pvp' : 'pve';

        this.roomId = state.room_id || state.roomId || null;
        if (!isNewRoom && incomingRoomId) {
            this._appliedRestoreRoomId = incomingRoomId;
        }

        // 修复点：应用进行中房间状态前清空战斗日志，避免上一场「玩家胜利/失败」残留导致误以为「直接胜利/击败」
        if (state.status !== 'finished') {
            this.logClear();
        }

        const playerActor = state.player;
        const enemyActor = state.enemy;
        if (!playerActor || !enemyActor) {
            Logger.error('[BattleScene] 房间状态缺少 player/enemy');
            return;
        }

        // 只要拿到并解析出了 player/enemy，就认为“进入房间应用成功”，取消兜底超时
        this._roomStateApplied = true;
        this.unschedule(this._onBattleEnterTimeout);

        // 使用服务器 actor.raw 作为原始属性来源
        const playerRaw = playerActor.raw || {};
        const enemyRaw = enemyActor.raw || {};

        this.playerUnit = this.buildUnitFromRobotInfo(
            'player',
            playerRaw.pet_id || '',
            playerRaw,
            playerActor.name || '玩家机甲'
        );
        this.enemyUnit = this.buildUnitFromRobotInfo(
            'enemy',
            enemyRaw.pet_id || '',
            enemyRaw,
            enemyActor.name || '敌方机甲'
        );

        // 覆盖实时 HP / MP / 攻防 / 出手值
        if (this.playerUnit) {
            this.playerUnit.maxHp = Number(playerActor.max_hp ?? playerActor.maxHp ?? this.playerUnit.maxHp);
            this.playerUnit.hp = Number(playerActor.hp ?? this.playerUnit.hp);
            this.playerUnit.maxMp = Number(playerActor.max_mp ?? playerActor.maxMp ?? this.playerUnit.maxMp);
            this.playerUnit.mp = Number(playerActor.mp ?? this.playerUnit.mp);
            this.playerUnit.attack = Number(playerActor.attack ?? this.playerUnit.attack);
            this.playerUnit.defense = Number(playerActor.defense ?? this.playerUnit.defense);
            this.playerUnit.initiative = Number(playerActor.initiative ?? this.playerUnit.initiative);
        }
        if (this.enemyUnit) {
            this.enemyUnit.maxHp = Number(enemyActor.max_hp ?? enemyActor.maxHp ?? this.enemyUnit.maxHp);
            this.enemyUnit.hp = Number(enemyActor.hp ?? this.enemyUnit.hp);
            this.enemyUnit.maxMp = Number(enemyActor.max_mp ?? enemyActor.maxMp ?? this.enemyUnit.maxMp);
            this.enemyUnit.mp = Number(enemyActor.mp ?? this.enemyUnit.mp);
            this.enemyUnit.attack = Number(enemyActor.attack ?? this.enemyUnit.attack);
            this.enemyUnit.defense = Number(enemyActor.defense ?? this.enemyUnit.defense);
            this.enemyUnit.initiative = Number(enemyActor.initiative ?? this.enemyUnit.initiative);
        }

        // 根据出场职业（Class）刷新 Player1 图标（重连/恢复战斗也会走到这里）
        const classValue = Number(playerRaw?.Class ?? playerRaw?.data?.Class ?? 1);
        this.updatePlayer1ClassIcon(classValue);

        // 根据出场职业（Class）刷新 敌人职业图标（重连/恢复战斗也会走到这里）
        const enemyClassValue = Number(enemyRaw?.Class ?? enemyRaw?.data?.Class ?? 1);
        this.updateEnemy1ClassIcon(enemyClassValue);

        // 更新 RobotShow 展示
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
            const enemyCid = enemyActor?.character_id ? String(enemyActor.character_id) : null;
            this.refreshPlayerAndEnemyShows(enemyCid);
        }

        // 更新属性面板与 HP 条
        this.ensureMechAttributeInited();
        this.refreshPlayerMechAttributeUI(true);

        // 战斗内：显示局内血条并刷新实时 HP。若为本回合动画（forRoundAnimation），不刷新上方战斗血条，等伤害数字出现后在 performAttackWithDamage 里再更新
        if (state.status !== 'finished' && !forRoundAnimation) {
            this.refreshBattleBarsVisibilityAndValue();
        } else if (state.status !== 'finished' && forRoundAnimation && this.playerRobotShow && this.enemyRobotShow) {
            this.playerRobotShow.setBattleBarsVisible(true);
            this.enemyRobotShow.setBattleBarsVisible(true);
        }

        // 修复点：仅用于本回合动画时只同步数据，不切 UI、不结束战斗；击杀/胜负在 playServerRoundAnimation 播完双方动画后再处理
        if (forRoundAnimation) return;

        // 根据房间状态切换 UI
        if (state.status === 'finished' && state.result) {
            const winner: Side = state.result.winner === 'player' ? 'player' : 'enemy';
            const reason: any = state.result.reason === 'escape' ? 'escape' : 'ko';
            this.finishBattle(winner, reason);
        } else {
            // 房间仍在进行中：新房间播放入场动画；恢复房间则直接设置到战斗位置
            if (isNewRoom) {
                // 新房间：确保状态正确，然后播放入场动画（动画完成后会调用 startCommandPhase）
                this.state = BattleState.INIT;
                this.isAnimating = false;
                this.pendingPlayerAction = null;
                this.pendingEnemyAction = { side: 'enemy', type: 'ATTACK' };
                
                // 确保位置已缓存
                this.cacheEntranceAndBattlePositionsIfNeeded();
                
                // 播放入场动画（动画完成后会调用 startCommandPhase 并开启倒计时/按钮）
                this.playEntranceAnimation();
                return;
            }

            // 恢复/刷新状态：不播放动画，直接放到战斗位置并进入“等待指令”阶段
            this.setBattlePositionsDirectly();
            this.state = BattleState.WAITING_COMMANDS;
            this.isAnimating = false;
            this.pendingPlayerAction = null;
            this.pendingEnemyAction = { side: 'enemy', type: 'ATTACK' };

            // 恢复战斗：按服务器 state 还原「空窗挽回期」状态与剩余时间，不重置为 30 秒
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
    private refreshBattleBarsVisibilityAndValue(): void {
        if (this.playerRobotShow) {
            this.playerRobotShow.setBattleBarsVisible(true);
            if (this.playerUnit) {
                this.playerRobotShow.updateBattleBars(
                    this.playerUnit.hp, this.playerUnit.maxHp,
                    this.playerUnit.mp, this.playerUnit.maxMp,
                );
            }
        }
        if (this.enemyRobotShow) {
            this.enemyRobotShow.setBattleBarsVisible(true);
            if (this.enemyUnit) {
                this.enemyRobotShow.updateBattleBars(
                    this.enemyUnit.hp, this.enemyUnit.maxHp,
                    this.enemyUnit.mp, this.enemyUnit.maxMp,
                );
            }
        }
    }

    /**
     * 从服务器房间 state 解析本回合指令阶段剩余秒数（恢复战斗时倒计时不重置为 30）
     * 支持字段：remaining_command_seconds / remaining_seconds / command_remaining_seconds（秒）、command_deadline_ts（截止时间戳 ms）、round_start_ts / round_start_time（回合开始时间戳 ms，用 30 - 已过秒数）
     */
    private _getRemainingCommandSecondsFromState(state: any): number {
        const limit = this.TURN_TIME_LIMIT;
        if (!state || typeof state !== 'object') return limit;
        const n = (v: any) => (v != null && typeof v === 'number' && !Number.isNaN(v) ? v : null);
        const now = Date.now();
        // 1) 直接剩余秒数（多种命名）
        const direct = n(state.remaining_command_seconds) ?? n(state.remaining_seconds) ?? n(state.command_remaining_seconds);
        if (direct != null && direct >= 0) return Math.min(limit, Math.ceil(direct));
        // 2) 截止时间戳（毫秒）
        const deadline = n(state.command_deadline_ts) ?? n(state.command_deadline_ms);
        if (deadline != null) {
            const sec = (deadline - now) / 1000;
            if (sec > 0) return Math.min(limit, Math.ceil(sec));
        }
        // 3) 回合开始时间戳（毫秒），剩余 = 30 - 已过秒数
        const startTs = n(state.round_start_ts) ?? n(state.round_start_time) ?? n(state.command_phase_start_ts);
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
    private restoreGraceWindowFromState(state: any) {
        const n = (v: any) => (v != null && typeof v === 'number' && !Number.isNaN(v) ? v : null);
        this._waitingOpponent = false;
        this._afterZeroWait = 0;
        const activeRaw = state?.grace_active;
        const active = activeRaw === true || activeRaw === 1 || activeRaw === 'true' || activeRaw === '1';
        if (active) {
            this.graceActive = true;
            this.turnTimeLeft = this._getRemainingCommandSecondsFromState(state);
            if (this.timerRoot) this.timerRoot.active = true;
            this.updateTimerLabel();
            return;
        }
        // 静默期
        this.graceActive = false;
        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        let graceLeft = this.GRACE_SECONDS;
        const graceDl = n(state?.grace_deadline_ts);
        if (graceDl != null) {
            graceLeft = Math.max(0, (graceDl - Date.now()) / 1000);
        } else {
            const startTs = n(state?.command_phase_start_ts);
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
    private setBattlePositionsDirectly() {
        const playerNode = this.playerRobotShow?.node;
        const enemyNode = this.enemyRobotShow?.node;
        if (!playerNode || !enemyNode) return;

        // 确保位置已缓存
        this.cacheEntranceAndBattlePositionsIfNeeded();
        if (!this.battlePlayerPos || !this.battleEnemyPos) {
            Logger.warn('[BattleScene] 战斗位置未缓存，使用默认位置');
            return;
        }

        // 直接设置到战斗位置
        playerNode.setPosition(this.battlePlayerPos);
        enemyNode.setPosition(this.battleEnemyPos);
    }

    private cacheEntranceAndBattlePositionsIfNeeded() {
        const playerNode = this.playerRobotShow?.node;
        const enemyNode = this.enemyRobotShow?.node;
        if (!playerNode || !enemyNode) return;

        if (!this.entrancePlayerPos || !this.entranceEnemyPos || !this.battlePlayerPos || !this.battleEnemyPos) {
            // 以编辑器里当前摆放的位置作为“入场起点”（例如 -450 / 440）
            this.entrancePlayerPos = playerNode.position.clone();
            this.entranceEnemyPos = enemyNode.position.clone();
            // 终点 = 起点 X 偏移（玩家 +300，敌人 -300）
            this.battlePlayerPos = new Vec3(this.entrancePlayerPos.x + 300, this.entrancePlayerPos.y, this.entrancePlayerPos.z);
            this.battleEnemyPos = new Vec3(this.entranceEnemyPos.x - 300, this.entranceEnemyPos.y, this.entranceEnemyPos.z);
        }
    }

    private resetEntrancePositions() {
        const playerNode = this.playerRobotShow?.node;
        const enemyNode = this.enemyRobotShow?.node;
        if (!playerNode || !enemyNode) return;
        this.cacheEntranceAndBattlePositionsIfNeeded();
        if (this.entrancePlayerPos) playerNode.setPosition(this.entrancePlayerPos);
        if (this.entranceEnemyPos) enemyNode.setPosition(this.entranceEnemyPos);
    }

    /** 本地模拟战（useServerRoomBattle=false）无法开战时关闭面板 */
    private _abortBattleEntry(errMsg: string): void {
        Logger.error('[BattleScene]', errMsg);
        this.node.active = false;
    }

    /**
     * 检查缓存并开始战斗（如果缓存为空则先请求数据）
     */
    private checkAndStartBattle() {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            this._abortBattleEntry('未选择角色，无法进入战斗');
            return;
        }

        const listCache = this.cacheManager.getRobotPetsCache(characterId);
        let pets: any[] = [];
        if (listCache) {
            if (listCache.data && Array.isArray(listCache.data.pets)) {
                pets = listCache.data.pets;
            } else if (Array.isArray(listCache.pets)) {
                pets = listCache.pets;
            }
        }

        // 如果缓存为空，先请求机甲列表数据
        if (!pets || pets.length === 0) {
            Logger.debug('[BattleScene] 机甲列表缓存为空，正在请求数据...');
            this.requestRobotPetsAndStart();
            return;
        }

        // 缓存有数据，直接开始战斗
        this.startNewBattle();
    }

    /**
     * 请求机甲列表数据，收到响应后开始战斗
     */
    private requestRobotPetsAndStart() {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            this._abortBattleEntry('未选择角色，无法进入战斗');
            return;
        }

        // 监听机甲列表响应
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);

        // 发送请求
        const requestData: any = {
            character_id: characterId,
            page: 0,
            page_size: 50
        };

        const userId = this.ws.getUserId();
        if (userId) {
            requestData.user_id = userId;
        }

        this.ws.notify(
            GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS,
            requestData,
            true
        );

        Logger.debug('[BattleScene] 已发送机甲列表请求，等待响应...');
    }

    /**
     * 机甲列表响应处理（用于战斗场景）
     */
    private onRobotPetsResponseForBattle = (data: any): void => {
        // 移除监听（只监听一次）
        this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
        if (!this.node?.isValid) return;

        const success = data.success === true || data.success === 'true';
        if (!success) {
            this._abortBattleEntry(String(data.message || data.data?.message || '获取机甲列表失败'));
            return;
        }

        const characterId = this.ws.getCharacterId?.();
        if (characterId) {
            this.cacheManager.setRobotPetsCache(characterId, data);
        }

        const pets = this._extractPetsFromCache(data);
        if (pets.length === 0) {
            this._abortBattleEntry('你没有可用的机甲，无法进入战斗');
            return;
        }

        Logger.debug('[BattleScene] 机甲列表数据已更新，开始战斗');
        this.startNewBattle();
    };

    private _extractPetsFromCache(raw: any): any[] {
        const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
        if (data?.data && Array.isArray(data.data.pets)) return data.data.pets;
        if (Array.isArray(data?.pets)) return data.pets;
        return [];
    }

    private _normPetId(id: string): string {
        return String(id || '').trim().toLowerCase();
    }

    private _battleTeamFromCache(listCache: any): string[] {
        const raw =
            listCache?.battle_team ??
            listCache?.data?.battle_team ??
            listCache?.data?.data?.battle_team;
        if (!Array.isArray(raw)) return [];
        return raw.map((x: any) => String(x)).filter((x: string) => x);
    }

    /** 优先出战队伍第一位，否则列表第一只有效机甲 */
    private _pickBattlePet(
        pets: any[],
        battleTeam: string[],
    ): { petId: string; firstPet: any } | null {
        if (!pets?.length) return null;
        const norm = (id: string) => this._normPetId(id);
        if (battleTeam.length > 0) {
            const bid = battleTeam[0];
            const matched = pets.find(
                (p) => norm(String(p.pet_id || p._id || p.id || '')) === norm(bid),
            );
            if (matched) {
                const petId = String(matched.pet_id || matched._id || matched.id || '');
                if (petId) return { petId, firstPet: matched };
            }
        }
        const firstPet = pets[0];
        const petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');
        if (!petId) return null;
        return { petId, firstPet };
    }

    private _applyPlayerPetFromInfo(petId: string, info: any): void {
        this.playerUnit = this.buildUnitFromRobotInfo('player', petId, info, '玩家机甲');

        if (this.playerRobotShow && info) {
            try {
                const dataForShow = { ...info, pet_id: petId };
                this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
                Logger.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
        }

        this.ensureMechAttributeInited();
        this.refreshPlayerMechAttributeUI(true);
        this.startAttributeAutoRefresh();
        const classValue = Number((info as any)?.Class ?? (info as any)?.data?.Class ?? 1);
        this.updatePlayer1ClassIcon(classValue);
        this.initEnemyUnit();
    }

    private startNewBattle() {
        this.logClear();
        this.state = BattleState.INIT;
        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        this.graceActive = false;
        this.graceTimeLeft = this.GRACE_SECONDS;
        this._lastPlayedPvpRound = 0;
        this.updateTimerLabel();

        // 每次开战都先把双方位置重置到入场起点
        this.resetEntrancePositions();

        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示
        }
        this.closeSkillSelectPanel();

        // 刷新“玩家/敌人角色形象+名字”
        this.refreshPlayerAndEnemyShows();

        // 初始化玩家单位（会在准备好后触发 initEnemyUnit）
        // 注意：玩家单位可能需要异步请求（出战队伍/机甲详情），不能在这里立刻校验 playerUnit
        this.playerUnit = null;
        this.enemyUnit = null;
        this.initPlayerUnit();
        this.log('正在准备玩家机甲...（请稍候）');
    }

    /**
     * 双方都准备好后开始战斗（根据 Initiative 决定先后手）
     */
    private beginBattleAfterReady() {
        // 再次检查双方单位是否都初始化完成
        if (!this.playerUnit || !this.enemyUnit) {
            Logger.error('[BattleScene] 双方单位未完全初始化，无法开始战斗');
            return;
        }

        // 进入指令选择阶段前的本地提示（不再发送未注册的 battle_start；正式开战走 battle_room_*）
        this.log('战斗开始！进入指令选择阶段（双方先选，再按出手值结算）');

        // 播放入场平移动画，动画完成后开始第一回合的指令选择
        this.playEntranceAnimation();
    }

    /**
     * 入场平移动画：双方从左右各偏移300的位置，1秒内平移到目标位置
     */
    private playEntranceAnimation() {
        const playerNode = this.playerRobotShow?.node;
        const enemyNode = this.enemyRobotShow?.node;

        if (!playerNode || !enemyNode) {
            Logger.warn('[BattleScene] 入场动画：缺少 RobotShow 节点，跳过动画直接开始战斗');
            this.startCommandPhase();
            return;
        }

        // 固定起点/终点（避免每次打开叠加）
        this.cacheEntranceAndBattlePositionsIfNeeded();
        if (!this.entrancePlayerPos || !this.entranceEnemyPos || !this.battlePlayerPos || !this.battleEnemyPos) {
            this.startCommandPhase();
            return;
        }

        const playerStartPos = this.entrancePlayerPos.clone();
        const enemyStartPos = this.entranceEnemyPos.clone();
        const playerTargetPos = this.battlePlayerPos.clone();
        const enemyTargetPos = this.battleEnemyPos.clone();

        // 每次动画都先强制回到起点
        playerNode.setPosition(playerStartPos);
        enemyNode.setPosition(enemyStartPos);

        // 动画时长：1秒
        const animDuration = 1.0;

        // 玩家和敌人同时平移到目标位置
        let playerAnimDone = false;
        let enemyAnimDone = false;

        const checkAllDone = () => {
            this.log(`[入场动画] playerDone=${playerAnimDone} enemyDone=${enemyAnimDone}`);
            if (playerAnimDone && enemyAnimDone) {
                // 动画完成，开始第一回合的指令选择
                this.startCommandPhase();
            }
        };

        // 超时保底：入场动画 1s，若 2.5s 后仍未进入指令阶段（tween 回调丢失），强制开始，避免卡死
        this.scheduleOnce(() => {
            if (!(playerAnimDone && enemyAnimDone)) {
                Logger.warn('[BattleScene] 入场动画超时未回调，强制进入指令阶段');
                playerAnimDone = true;
                enemyAnimDone = true;
                checkAllDone();
            }
        }, 2.5);

        // 玩家平移动画
        tween(playerNode)
            .to(animDuration, { position: playerTargetPos }, { easing: 'sineOut' })
            .call(() => {
                playerAnimDone = true;
                checkAllDone();
            })
            .start();

        // 敌人平移动画
        tween(enemyNode)
            .to(animDuration, { position: enemyTargetPos }, { easing: 'sineOut' })
            .call(() => {
                enemyAnimDone = true;
                checkAllDone();
            })
            .start();
    }

    /**
     * 入场平移动画完成后的回调：开始指令选择阶段
     * 这个函数会被 playEntranceAnimation 中的 checkAllDone 调用
     */

    /**
     * 从缓存中取出玩家机甲库列表的第一个机甲，并从机甲详情缓存中读取属性
     * 优先使用出战队伍的第一位机甲
     */
    private initPlayerUnit() {
        const characterId = this.ws.getCharacterId?.();
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

        const finishPick = (battleTeam: string[]) => {
            if (!this.node?.isValid || this._sessionId !== sessionId) return;
            const picked = this._pickBattlePet(pets, battleTeam);
            if (!picked) {
                this._abortBattleEntry('你没有可用的机甲，无法进入战斗');
                return;
            }
            const { petId, firstPet } = picked;
            Logger.debug(`[BattleScene] 使用机甲: ${petId}`);

            let info = this.cacheManager.getRobotPetInfoCache(petId);
            if (!info) {
                Logger.warn('[BattleScene] 未找到机甲详情缓存，正在请求详情数据...');
                this.requestRobotPetInfoAndInit(petId, firstPet);
                return;
            }
            if (info.data) info = info.data;
            this._applyPlayerPetFromInfo(petId, info);
        };

        // 仍请求服务端出战队伍；失败或未设置时回退缓存/列表首只（与 battle_room_handler 对齐）
        this.ws.request(
            GameConfig.MESSAGE_TYPES.GET_BATTLE_TEAM,
            { character_id: characterId },
            (resp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                let battleTeam: string[] = [];
                if (resp?.success && resp.data && Array.isArray(resp.data.battle_team)) {
                    battleTeam = resp.data.battle_team.map((x: any) => String(x)).filter((x: string) => x);
                }
                if (battleTeam.length > 0) {
                    finishPick(battleTeam);
                    return;
                }
                if (!resp?.success) {
                    Logger.warn('[BattleScene] GET_BATTLE_TEAM 失败，尝试缓存/列表回退:', resp?.message);
                }
                finishPick(cachedTeam.length > 0 ? cachedTeam : []);
            },
            true,
            5000,
        );
    }

    /**
     * 请求机甲详情数据并初始化玩家单位
     */
    private requestRobotPetInfoAndInit(petId: string, fallbackData: any) {
        // 监听机甲详情响应
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);

        // 发送请求
        this.ws.request(
            GameConfig.MESSAGE_TYPES.GET_ROBOT_PET_INFO,
            {
                pet_id: petId
            },
            (response: any) => {
                // request 回调会自动处理响应
            },
            true,
            10000
        );

        Logger.debug(`[BattleScene] 已发送机甲详情请求 (pet_id: ${petId})，等待响应...`);
    }

    /**
     * 机甲详情响应处理（用于战斗场景）
     */
    private onRobotPetInfoResponseForBattle = (data: any): void => {
        // 移除监听（只监听一次）
        this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
        if (!this.node?.isValid) return;

        const success = data.success === true || data.success === 'true';
        if (!success) {
            Logger.warn('[BattleScene] 获取机甲详情失败，使用列表基础数据:', data.message || data.data?.message);
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
        }

        // 更新缓存
        const petId = data.pet_id ?? data.data?.pet_id;
        if (petId) {
            this.cacheManager.setRobotPetInfoCache(String(petId), data);
        }

        Logger.debug('[BattleScene] 机甲详情数据已更新，重新初始化玩家单位');
        // 数据已更新，重新初始化
        this.initPlayerUnit();
        // 如果玩家单位初始化成功，继续初始化敌人单位
        if (this.playerUnit) {
            this.initEnemyUnit();
            // 如果双方都初始化成功，等待双方都准备好后再开始战斗
            if (this.playerUnit && this.enemyUnit) {
                // 延迟一小段时间，确保双方展示都更新完成
                this.scheduleOnce(() => {
                    this.beginBattleAfterReady();
                }, 0.1); // 减少等待：进入战斗更快，RobotShow 自身有资源就绪重试
            }
        }
    };

    /**
     * 使用列表中的基础数据初始化玩家单位（备用方案）
     */
    private initPlayerUnitWithFallback() {
        const characterId = this.ws.getCharacterId?.();
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

        const { petId, firstPet } = picked;
        Logger.warn('[BattleScene] 使用列表中的基础数据构建玩家单位（可能缺少完整属性）');
        this.playerUnit = this.buildUnitFromRobotInfo('player', petId, firstPet, '玩家机甲');

        if (this.playerRobotShow) {
            try {
                const dataForShow = { ...firstPet, pet_id: petId };
                this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
                Logger.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
        }

        this.ensureMechAttributeInited();
        this.refreshPlayerMechAttributeUI(true);
        this.startAttributeAutoRefresh();
        const classValue = Number((firstPet as any)?.Class ?? 1);
        this.updatePlayer1ClassIcon(classValue);
    }

    /**
     * 敌方单位：目前先简单复用玩家属性做随机偏移（后续由服务器提供正式接口）
     * 为保持与服务器成长公式一致，后续可以改为直接请求服务器生成一只敌人机甲。
     */
    private initEnemyUnit() {
        if (!this.playerUnit) {
            Logger.error('[BattleScene] 玩家单位未初始化，无法构建敌人单位');
            return;
        }

        // 敌人由服务器生成（随机角色 + 满装备 + 最终属性 + 装备限制）
        const playerPetId = this.playerUnit.petId;
        this.enemyUnit = null;
        this.isEnemyGenerating = true;

        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_GENERATE_ENEMY,
            { player_pet_id: playerPetId || undefined },
            (resp: any) => {
                this.isEnemyGenerating = false;
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (!resp || resp.success === false) {
                    Logger.error('[BattleScene] 生成敌人失败:', resp?.message || resp?.error || resp);
                    return;
                }
                const enemy = resp.enemy || resp.data?.enemy || null;
                if (!enemy) {
                    Logger.error('[BattleScene] 生成敌人失败：响应缺少 enemy 字段', resp);
                    return;
                }

                const melee = Number(enemy.CurrentMelee ?? enemy.Melee ?? 0);
                const shoot = Number(enemy.CurrentShooting ?? enemy.Shooting ?? 0);
                const armor = Number(enemy.CurrentArmor ?? enemy.Armor ?? 0);
                const maxHp = Number(enemy.MaxHP ?? 1000);
                const hp = Number(enemy.CurrentHP ?? maxHp);
                const maxMp = Number(enemy.MaxMP ?? 0);
                const mp = Number(enemy.CurrentMP ?? maxMp);
                const initiative = Number(enemy.CurrentInitiative ?? enemy.Initiative ?? 10);

                // 攻击次数：与玩家/在线路径一致，敌方也要带 attackTimes，否则 computeAttackSegments 只能按 1 段处理
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
                    rawData: enemy,
                };

                if (this.enemyRobotShow) {
                    try {
                        this.enemyRobotShow.updateFromRobotData(enemy);
                    } catch (e) {
                        Logger.error('[BattleScene] 更新敌人 RobotShow 失败:', e);
                    }
                }

                if (this.state === BattleState.INIT && this.playerUnit && this.enemyUnit) {
                    this.beginBattleAfterReady();
                }
            },
            true,
            10000,
        );
    }

    private buildUnitFromRobotInfo(side: Side, petId: string, info: any, defaultName: string): BattleUnit {
        const name = info?.RobotName || info?.name || defaultName;
        const level = Number(info?.Level || info?.level || 1);

        // 属性字段命名尽量兼容现有 MechAttributeTEST 使用的键
        const maxHp = Number(info?.MaxHP ?? info?.max_hp ?? info?.hp ?? 100);
        const hp = Number(info?.CurrentHP ?? info?.current_hp ?? maxHp);
        // 能量：老数据可能没有 MP 字段 → 0（该单位不参与「能量恢复」）
        const maxMp = Number(info?.MaxMP ?? info?.max_mp ?? 0);
        const mp = Number(info?.CurrentMP ?? info?.current_mp ?? maxMp);
        const melee = Number(info?.Melee ?? info?.melee ?? 0);
        const shoot = Number(info?.Shooting ?? info?.shoot ?? 0);
        const armor = Number(info?.Armor ?? info?.armor ?? 0);

        const attack = melee + shoot;
        const defense = armor;
        const initiative = Number(info?.Initiative ?? info?.initiative ?? 10);

        // 攻击次数：优先直接字段，其次从装备累加（装备「攻击次数+N」已在服务端写入属性或 equipment）
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
            rawData: info,
        };
    }

    private determineFirstTurn() {
        if (!this.playerUnit || !this.enemyUnit) return;
        // 保留方法：用于回合结算时决定出手顺序（不再用于“是否立即行动”）
    }

    /**
     * 指令选择阶段：双方都先选指令（当前敌方默认普攻，但不会提前出手）
     *
     * 「空窗挽回期」：进入指令阶段后**不立即倒计时**，先静默观察 GRACE_SECONDS 秒；
     *   任一方/双方无操作满 5 秒才显示并启动「剩余时间」倒计时（见 update）。
     */
    private startCommandPhase() {
        if (this.state === BattleState.FINISHED) {
            this.log('[指令阶段] 被跳过：战斗已结束');
            return;
        }
        this.state = BattleState.WAITING_COMMANDS;
        this.pendingPlayerAction = null;
        // 敌方 AI：默认普攻（后续可扩展技能/物品）
        this.pendingEnemyAction = { side: 'enemy', type: 'ATTACK' };

        // 空窗挽回期：先进入静默观察，不显示倒计时
        this.enterGraceWindow();

        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = true;
        }
        this.setButtonsInteractable(true);
        this.refreshBattleBarsVisibilityAndValue();
        this.log(`[指令阶段] 已恢复操作，按钮可点=${!!this.attackButton?.interactable}，面板=${!!this.battleSelectPanel?.active}`);
    }

    /**
     * 进入空窗观察期：隐藏「剩余时间」面板，开始静默 GRACE_SECONDS 秒
     */
    private enterGraceWindow() {
        this.graceActive = false;
        this.graceTimeLeft = this.GRACE_SECONDS;
        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        this._waitingOpponent = false;
        this._afterZeroWait = 0;
        // 静默期不显示倒计时面板
        if (this.timerRoot) this.timerRoot.active = false;
        this.updateTimerLabel();
    }

    /**
     * 激活倒计时：空窗满 5 秒后调用，显示「剩余时间」面板并开始计时
     */
    private activateGraceCountdown() {
        if (this.graceActive) return;
        this.graceActive = true;
        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        this._afterZeroWait = 0;
        if (this.timerRoot) this.timerRoot.active = true;
        this.updateTimerLabel();
        this.log('[空窗] 无操作满 5 秒，开始倒计时');
    }

    update(dt: number) {
        // 看门狗：ANIMATING 状态若长时间未推进（回调链断裂），强制恢复到指令阶段，避免战斗死锁
        //   注意：请求等待（isRequestingAction）期间也计时，但阈值更宽松（20s），防止请求永不返回时死锁
        if (this.state === BattleState.ANIMATING) {
            this.animWatchdog += dt;
            // 请求等待期（isRequestingAction）的阈值需覆盖服务端「空窗挽回期」最坏耗时：
            //   PVP = 空窗静默 5s + 倒计时 30s = 35s，故 PVP 取 45s；PVE 无空窗，20s 足够。
            let limit = 12;
            if (this.isRequestingAction) {
                limit = this.currentBattleMode === 'pvp' ? 45 : 20;
            }
            if (this.animWatchdog > limit) {
                Logger.warn(`[BattleScene] 看门狗：ANIMATING 超时(${limit}s)，强制恢复指令阶段`);
                this.log('[看门狗] 动画超时未推进，强制恢复操作');
                this.animWatchdog = 0;
                this.isAnimating = false;
                this.isRequestingAction = false;
                this._waitingOpponent = false;
                this.startCommandPhase();
            }
        } else {
            this.animWatchdog = 0;
        }

        // 等待指令阶段，或「自己已提交、正在等对方」期间 —— 都需要推进空窗/倒计时。
        //   后者保证：自己 5 秒后点了操作，但对方仍未动时，倒计时继续走完，玩家能看到对方是否挂机。
        const tickingCommands =
            this.state === BattleState.WAITING_COMMANDS ||
            (this.state === BattleState.ANIMATING && this.isRequestingAction && this._waitingOpponent);

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
                    this.updateTimerLabel();
                    // 倒计时归零：技能选择面板一并关掉（游戏原机制 —— 到点就关面板、改走普通攻击）
                    this.closeSkillSelectPanel();
                    // 服务器制 PVP：倒计时归零后的「自动补普攻」由服务端权威执行，
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
                                this.pendingPlayerAction = { side: 'player', type: 'ATTACK' };
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

    private updateTimerLabel() {
        if (!this.timerLabel) return;
        this.timerLabel.string = `${Math.ceil(this.turnTimeLeft)}`;
        // 显示条件：等待指令 + 倒计时已激活；或自己已提交、正等对方（此期间倒计时继续可见）
        if (this.timerRoot) {
            const show =
                this.graceActive &&
                (this.state === BattleState.WAITING_COMMANDS ||
                    (this.state === BattleState.ANIMATING && this.isRequestingAction && this._waitingOpponent));
            this.timerRoot.active = show;
        }
    }

    private setButtonsInteractable(enable: boolean) {
        if (this.attackButton) this.attackButton.interactable = enable;
        if (this.defendButton) this.defendButton.interactable = enable;
        if (this.escapeButton) this.escapeButton.interactable = enable;
        if (this.skillButton) this.skillButton.interactable = enable;
        // 返回键始终可点：保证任何时候都有逃生通道（卡死时也能恢复/退出）
        if (this.backButton) this.backButton.interactable = true;
    }

    // ========== 按钮事件 ==========

    private onAttackClicked() {
        if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) return;
        if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('ATTACK');
            return;
        }
        // 本地模拟模式：保留旧逻辑
        this.pendingPlayerAction = { side: 'player', type: 'ATTACK' };
        this.tryResolveRound();
    }

    private onDefendClicked() {
        if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) return;
        if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('DEFEND');
            return;
        }
        // 本地模拟模式：保留旧逻辑
        this.pendingPlayerAction = { side: 'player', type: 'DEFEND' };
        this.tryResolveRound();
    }

    private onEscapeClicked() {
        if (this.state === BattleState.FINISHED || this.isAnimating || this.isRequestingAction) return;

        // 玩家选择逃跑（按需求：直接失败并通知服务器）
        if (this.state === BattleState.WAITING_COMMANDS) {
            if (this.useServerRoomBattle && this.roomId) {
                this.sendBattleRoomAction('ESCAPE');
                return;
            }
            this.pendingPlayerAction = { side: 'player', type: 'ESCAPE' };
            this.tryResolveRound();
        }
    }

    // ====== 技能按钮 / 技能选择面板（SkillSelect） ======

    /** 找「技能」按钮：优先 Inspector 绑定，其次在战斗操作面板里按名字找（BattleSelectButton/Skill） */
    private resolveSkillButton(): Button | null {
        if (this.skillButton && this.skillButton.isValid) return this.skillButton;
        const root = this.battleSelectPanel || this.node;
        const node: Node | null = root
            ? (root.getChildByName('Skill') || this.findChildByName(root, 'Skill'))
            : null;
        const btn = node ? node.getComponent(Button) : null;
        if (btn) {
            this.skillButton = btn;
            Logger.info('[BattleScene] 技能按钮已由运行时查找绑定：' + node!.name);
        } else {
            Logger.warn('[BattleScene] 没找到技能按钮（期望 BattleSelectButton/Skill）');
        }
        return btn;
    }

    /**
     * 确保技能选择面板组件存在。
     * 面板节点 = `BattleScene/SkillSelect`（场景里已搭好）；组件没挂就运行时 `addComponent` 兜底
     * （与机甲面板 `MechSkillPanel` 的零挂载风格一致）。
     */
    private ensureSkillSelectPanel(): SkillSelectPanel | null {
        if (this.skillSelectPanel && this.skillSelectPanel.isValid) return this.skillSelectPanel;
        const node = this.findChildByName(this.node, 'SkillSelect');
        if (!node) {
            Logger.warn('[BattleScene] 没找到技能选择面板节点（期望 BattleScene/SkillSelect）');
            return null;
        }
        let comp = node.getComponent(SkillSelectPanel);
        if (!comp) comp = node.addComponent(SkillSelectPanel);
        this.skillSelectPanel = comp;
        // 场景里可能留着显示状态 → 战斗未开始/未点技能前一律不显示
        if (node.active) node.active = false;
        return comp;
    }

    /** 关闭技能选择面板（幂等；`notify=false` 不触发 onClosed，避免与战斗流程互相递归） */
    private closeSkillSelectPanel(): void {
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
    private onSkillClicked() {
        if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) {
            Logger.warn(`[BattleScene] 技能按钮被忽略：state=${this.state}`);
            return;
        }
        const panel = this.ensureSkillSelectPanel();
        if (!panel) return;
        // 已打开 → 再点一次收起（等同「返回」）
        if (panel.isOpen()) {
            panel.close();
            return;
        }
        const petId = this.playerUnit?.petId || null;
        if (!petId) {
            this.log('未找到出战机甲，暂时无法选择技能');
            Logger.warn('[BattleScene] 技能面板打开失败：playerUnit.petId 为空');
            return;
        }
        panel.open(petId, {
            // 确认 → 用该技能提交本回合指令（服务端校验「已学 + 能量足够 + 主动技」）
            onConfirm: (skillKey: string) => {
                Logger.info(`[BattleScene] 技能面板确认，施放「${skillKey}」`);
                this.castSkill(skillKey);
            },
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
    public castSkill(skillKey: unknown): boolean {
        if (this.state !== BattleState.WAITING_COMMANDS || this.isAnimating || this.isRequestingAction) {
            Logger.warn(`[BattleScene] castSkill 被忽略：state=${this.state}`);
            return false;
        }
        const key = SkillData.resolveSkillRef(skillKey) ?? (skillKey == null ? null : String(skillKey));
        if (!key) {
            Logger.warn('[BattleScene] castSkill 缺少有效 skill_key:', skillKey);
            return false;
        }
        if (this.useServerRoomBattle && this.roomId) {
            this.sendBattleRoomAction('SKILL', key);
            return true;
        }
        // 本地模拟模式：保留旧逻辑（本地模拟暂不结算技能，按待机处理）
        Logger.warn('[BattleScene] 本地模拟模式暂不结算技能，本回合按待机处理');
        this.pendingPlayerAction = { side: 'player', type: 'SKILL' };
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
    private sendBattleRoomAction(action: ActionType, skillKey?: string) {
        if (!this.roomId || this.isRequestingAction) return;
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) return;

        // 【空窗挽回期】玩家主动操作 → 通知服务端解除本方关窗计数（_clear_side_noop）。
        //   但「剩余时间」面板不隐藏：若自己已提交、对方仍未操作，倒计时继续走完，
        //   让玩家能直观看到对方是否挂机（走完由服务端自动补普攻结算）。
        this._waitingOpponent = true;
        if (!this.graceActive) {
            // 自己是在 5 秒静默期内操作的：对方此前可能也一直没动 → 立即激活倒计时展示
            this.activateGraceCountdown();
        }

        // 记录本回合开始前的 HP 快照和玩家动作
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
        this.setButtonsInteractable(false);
        // 进入动画等待态并启动看门狗计时，保证后续任何一环断链都能被 update() 兜底恢复
        this.state = BattleState.ANIMATING;
        this.isAnimating = true;
        this.animWatchdog = 0;
        // 关闭操作面板（已提交本回合指令，无需再点）；但「剩余时间」面板保持可见并可继续倒计时，
        //   让玩家能看到对方是否仍在挂机（需求：自己操作后倒计时继续，直到对方也操作）。
        if (this.battleSelectPanel) this.battleSelectPanel.active = false;
        this.closeSkillSelectPanel();   // 已提交指令 → 技能面板一并收起
        if (this.timerRoot) this.timerRoot.active = this.graceActive;

        // 组包：技能指令额外带 skill_key（服务端归一后校验「已学 + 能量足够 + 主动技」）
        const payload: any = {
            room_id: this.roomId,
            action_type: action,
            character_id: characterId,
        };
        if (action === 'SKILL') {
            const key = skillKey ? (SkillData.resolveSkillRef(skillKey) ?? skillKey) : null;
            if (!key) {
                // 兜底：技能 key 丢失时按普攻提交，避免服务端 400 后本回合彻底卡住
                Logger.warn('[BattleScene] 技能指令缺少可识别的 skill_key，已改为提交普攻');
                payload.action_type = 'ATTACK';
            } else {
                payload.skill_key = key;
            }
        }

        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_ACTION,
            payload,
            (resp: any) => {
                this.isRequestingAction = false;
                this._waitingOpponent = false;
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (!resp?.success || !resp.data?.state) {
                    Logger.error('[BattleScene] battle_room_action 失败:', resp?.message || resp);
                    this.state = BattleState.WAITING_COMMANDS;
                    this.isAnimating = false;
                    this.setButtonsInteractable(true);
                    // 修复点：请求失败时恢复操作面板显示，便于玩家重试
                    if (this.battleSelectPanel) this.battleSelectPanel.active = true;
                    return;
                }

                const state = resp.data.state;

                if (!this.playerUnit || !this.enemyUnit || this.lastRoundPlayerAction == null) {
                    // 关键兜底：缺快照/单位时绝不能直接 return —— 那会让 state 永远停在 ANIMATING，
                    //   面板不显示、按钮不可点、退不出（战斗卡死）。
                    Logger.warn(
                        `[BattleScene] 回合数据缺失，跳过动画直接恢复操作：` +
                        `playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit} lastAction=${this.lastRoundPlayerAction}`
                    );
                    this.applyServerRoomState(state, false, true);
                    this.state = BattleState.INIT;
                    this.isAnimating = false;
                    this.isRequestingAction = false;
                    this.animWatchdog = 0;
                    if (this.node?.isValid) this.startCommandPhase();
                    return;
                }

                // 标记本回合已由自己路径播放，避免随后的 pvp_round_update 推送重复播
                const respRound = Number(state?.round ?? 0);
                if (this.currentBattleMode === 'pvp' && respRound > 0) {
                    this._lastPlayedPvpRound = Math.max(this._lastPlayedPvpRound, respRound - 1);
                }

                // 共用「按服务器 state 播整回合动画」的逻辑
                this.playRoundFromServerState(
                    state,
                    this.lastRoundPlayerAction,
                    this.lastRoundPlayerHp,
                    this.lastRoundEnemyHp,
                );
            },
            true,
            // PVP 最坏情况：空窗静默 5s + 倒计时 30s = 35s，服务器才结算返回。
            //   请求超时必须大于该上限（留 10s 余量），否则会在服务器结算前被客户端提前判超时。
            this.currentBattleMode === 'pvp' ? 45000 : 10000
        );
    }

    private onBackClicked() {
        // 【联动】技能选择面板开着时，返回键先关技能面板（不退出战斗、也不切换操作面板）
        const skillPanel = this.skillSelectPanel;
        if (skillPanel && skillPanel.isValid && skillPanel.isOpen()) {
            skillPanel.close();
            return;
        }
        // 正常情况：只在指令选择阶段开关面板
        if (this.state === BattleState.WAITING_COMMANDS) {
            if (!this.battleSelectPanel) return;
            this.battleSelectPanel.active = !this.battleSelectPanel.active;
            return;
        }
        // 逃生通道：非指令阶段（动画卡住 / 状态异常）时，点返回键强制恢复操作，避免彻底无法操作
        Logger.warn(`[BattleScene] 返回键在非指令阶段被点击（state=${this.state}），强制恢复指令阶段`);
        this.isAnimating = false;
        this.isRequestingAction = false;
        this.animWatchdog = 0;
        this.startCommandPhase();
    }

    // ========== 战斗核心 ==========

    private getUnit(side: Side): BattleUnit | null {
        return side === 'player' ? this.playerUnit : this.enemyUnit;
    }

    private getOpponent(side: Side): BattleUnit | null {
        return side === 'player' ? this.enemyUnit : this.playerUnit;
        }

    /**
     * 伤害数字的弧形方向：向**受击者身后**（被击退的方向）抛出。
     * 攻击方在左 → 受击者在右 → 数字向右（+）；
     * 攻击方在右 → 受击者在左 → 数字向左（−）。
     * 自己方受击同理（数字从自己身上向自己身后飞出，远离攻击方）。
     * 返回的 y 仅作兼容占位（弧线由 RobotShow 内的重力自动生成）。
     */
    private damageDriftFor(attackerSide: Side): { x: number; y: number } {
        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
        const aNode = attackerShow?.node;
        const dNode = defenderShow?.node;
        // 用屏幕世界坐标判断左右（UI 下 worldPosition 即屏幕坐标）
        const ax = aNode ? aNode.worldPosition.x : 0;
        const dx = dNode ? dNode.worldPosition.x : 0;
        // 受击者在攻击者屏幕右侧 → +1（数字向右飞）；左侧 → −1
        const dir = dx >= ax ? 1 : -1;
        Logger.warn(`[方向诊断] 攻方=${attackerSide} 攻屏幕x=${ax.toFixed(0)} 守屏幕x=${dx.toFixed(0)} → 期望屏幕方向=${dir}`);
        return { x: dir, y: 0 };
    }

    private performAttack(attackerSide: Side, onDone: () => void) {
        const attacker = this.getUnit(attackerSide);
        const defender = this.getOpponent(attackerSide);
        if (!attacker || !defender) return;
        if (this.state === BattleState.FINISHED) return;

        this.state = BattleState.ANIMATING;
        this.isAnimating = true;
        this.setButtonsInteractable(false);

        const rawDamage = attacker.attack - defender.defense;
        const damage = Math.max(1, rawDamage);
        // 伤害数字漂移方向：远离攻击方（与击退方向一致），形成"连续冒出→旧的后退消失"的轨迹
        const drift = this.damageDriftFor(attackerSide);
        // 「攻击次数」：把这一次攻击拆成 N 段（总伤上限 +20%），逐段扣血/弹数字
        const segments = computeAttackSegments(damage, attacker.attackTimes);
        const applySegments = (onApplied: () => void) => {
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

        this.log(
            `${attackerSide === 'player' ? '玩家' : '敌人'} 普攻造成 ${damage} 点伤害` +
            (segments.length > 1 ? `（攻击 ${attacker.attack} - 防御 ${defender.defense}，分 ${segments.length} 段）` :
                `（攻击 ${attacker.attack} - 防御 ${defender.defense}）`)
        );

        // 判定是否为“远程攻击”（是否装备枪械）
        const attackerEquip = attacker.rawData?.equipment || attacker.rawData?.data?.equipment || {};
        const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);

        // 播放攻击动画（根据是否有枪械区分远程/近战）
        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
        // 结算与收尾解耦：
        //   · 逐段扣血 + 弹伤害数字 → 挂在「接触到对方」的瞬间启动（onImpact）
        //   · 死亡判定 / 解锁 → 必须等「动画播完」且「分段结算完」两者到齐
        let segStarted = false;
        let segDone = false;
        let animFinished = false;
        const afterAll = () => {
            if (!segDone || !animFinished) return;
            if (defender.side === 'player') {
                this.refreshPlayerMechAttributeUI(true);
            }
            // 检查是否有人死亡
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
            }
            // 单次攻击完成
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
                Logger.error('[BattleScene] 本地段结算异常，强制收尾:', e);
                segDone = true;
                this.isAnimating = false;
                onDone();
            }
        };

        this.playAttackAnimation(
            attackerShow, defenderShow, attackerHasGun,
            // onComplete：动画播完（兜底启动分段结算 + 补齐收尾条件）
            () => {
                animFinished = true;
                startSegments();
                afterAll();
            },
            // onImpact：接触到对方的瞬间 —— 只弹伤害数字（**普攻不播技能特效**，2026-09-30 用户要求去掉）
            () => {
                startSegments();
            },
        );
    }

    /** 关闭面板后延迟多久再开始动作（秒），提升“点击→收面板→再开打”的节奏感 */
    private readonly ACTION_DELAY_AFTER_PANEL_CLOSE = 1.0;

    /**
     * 回合结束被动恢复（生命恢复 / 能量恢复）多条效果之间的间隔（秒）。
     * 一次回合最多 2 条（生命 + 能量），0.6s 足以看清特效与治疗数字。
     */
    private static readonly PASSIVE_EFFECT_GAP = 0.6;

    /**
     * 「服务端出手明细」（round_events）两条事件之间的间隔（秒）。
     * 服务端一份 state 里会给出本回合每一次出手（先手方 + 后手方），
     * 逐条播完才能看清「谁先打、谁后打」。
     */
    private static readonly ROUND_EVENT_GAP = 0.55;

    /**
     * 近战「接触间隔」（像素）：攻击方贴身位置 = 受击方当前 x ∓ 该值。
     * 普攻近战与「近身技」共用同一口径，保证两种出招的贴身距离一致。
     */
    private static readonly MELEE_CONTACT_GAP = 30;

    /** 受击方被击退的位移量（像素）。普攻近战与近身技共用。 */
    private static readonly KNOCKBACK_DELTA = 30;

    /**
     * 近身技「打完归位」的位移用时（秒）。
     * 近身技流程：位移贴到目标身前 → 播技能特效 → **特效一结束即滑回原位**（不等伤害数字）。
     */
    private static readonly MELEE_RETURN_TIME = 0.14;

    /**
     * 如果双方指令都已选择，则按 Initiative 结算本回合
     * 先关闭操作面板，延迟 1 秒后再开始动作，避免“刚点完就攻击”的仓促感
     */
    private tryResolveRound() {
        if (this.state !== BattleState.WAITING_COMMANDS) return;
        if (!this.pendingPlayerAction || !this.pendingEnemyAction) return;

        // 一旦双方都有指令，先关闭面板并锁定 UI
        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false;
        }
        this.closeSkillSelectPanel();
        this.setButtonsInteractable(false);

        // 延迟一段时间再执行动作，让玩家有“确认选择→收板→再开打”的体验
        this.scheduleOnce(() => {
            if (this.state === BattleState.FINISHED) return;

            // 逃跑优先：玩家选择逃跑则直接失败结束（不再结算攻击）
            if (this.pendingPlayerAction?.type === 'ESCAPE') {
                this.log('你选择了逃跑，本次战斗失败。');
                this.finishBattle('enemy', 'escape');
                return;
            }

            // 仅支持普攻（后续扩展技能/物品：在这里增加分支）
            this.resolveByInitiative();
        }, this.ACTION_DELAY_AFTER_PANEL_CLOSE);
    }

    /**
     * 按 Initiative 决定先后手，依次执行（目前只有普攻）
     */
    private resolveByInitiative() {
        if (!this.playerUnit || !this.enemyUnit) return;
        const playerFirst =
            this.playerUnit.initiative > this.enemyUnit.initiative ||
            (this.playerUnit.initiative === this.enemyUnit.initiative);

        const first: Side = playerFirst ? 'player' : 'enemy';
        const second: Side = playerFirst ? 'enemy' : 'player';

        const firstAction = first === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;
        const secondAction = second === 'player' ? this.pendingPlayerAction : this.pendingEnemyAction;

        const execAction = (side: Side, action: BattleAction | null, done: () => void) => {
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
                this.log(`${side === 'player' ? '玩家' : '敌人'} 选择了防御/待机（本回合不行动）`);
                // 给一点点时间作为“动作占位”，避免过于突兀
                this.scheduleOnce(done, 0.15);
                return;
            }
            // 其他动作暂未实现：先当作待机
            this.log(`${side === 'player' ? '玩家' : '敌人'} 动作(${action.type})暂未实现，本回合跳过`);
            this.scheduleOnce(done, 0.15);
        };

        execAction(first, firstAction, () => {
            if (this.state === BattleState.FINISHED) return;
            // 隔 1 秒再播下一方动画，避免双方动作叠在一起看不出谁在攻击
            this.scheduleOnce(() => {
                if (this.state === BattleState.FINISHED) return;
                execAction(second, secondAction, () => {
                    if (this.state === BattleState.FINISHED) return;
                    // 修复点：双方动画都结束后再延迟显示操作面板（与在线模式一致）
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
    private playServerRoundAnimation(
        playerAction: ActionType,
        damageToPlayer: number,
        damageToEnemy: number,
        targetPlayerHp: number,
        targetEnemyHp: number,
        serverState: any,
    ) {
        if (!this.playerUnit || !this.enemyUnit) {
            Logger.warn(`[BattleScene] playServerRoundAnimation 单位缺失，直接恢复操作 playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit}`);
            this.state = BattleState.INIT;
            this.isAnimating = false;
            this.isRequestingAction = false;
            this.animWatchdog = 0;
            if (this.node?.isValid) this.startCommandPhase();
            return;
        }

        // 逃跑：服务器已经把结果算好了，这里只做简单提示和 finish
        if (playerAction === 'ESCAPE') {
            this.log('你选择了逃跑，本次战斗失败。');
            const winner: Side = serverState?.result?.winner === 'player' ? 'player' : 'enemy';
            const reason: any = serverState?.result?.reason === 'escape' ? 'escape' : 'ko';
            this.scheduleOnce(() => {
                this.finishBattle(winner, reason);
            }, 0.3);
            return;
        }

        const playerFirst =
            this.playerUnit.initiative > this.enemyUnit.initiative ||
            this.playerUnit.initiative === this.enemyUnit.initiative;

        const order: Side[] = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];

        const runAction = (side: Side, done: () => void) => {
            if (this.state === BattleState.FINISHED) {
                done();
                return;
            }
            Logger.warn(`[攻击诊断] runAction side=${side} state=${this.state}`);

            if (side === 'player') {
                if (playerAction === 'ATTACK' && damageToEnemy > 0) {
                    this.performAttackWithDamage('player', damageToEnemy, done);
                } else if (playerAction === 'DEFEND') {
                    this.log('玩家选择了防御/待机（本回合不行动）');
                    this.scheduleOnce(done, 0.15);
                } else {
                    Logger.warn(`[攻击诊断] 玩家攻击被跳过：playerAction=${playerAction} damageToEnemy=${damageToEnemy}`);
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
        };

        // 执行先手/后手
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
    private finishRoundPresentation(serverState: any, targetPlayerHp: number, targetEnemyHp: number): void {
        const peList = (side: Side): any[] => {
            const l = serverState?.round_passive_effects?.[side];
            return Array.isArray(l) ? l : [];
        };
        const hpBack = (side: Side, finalHp: number): number =>
            Math.max(0, finalHp - peList(side).reduce(
                (s: number, e: any) => s + (e?.attr === 'hp' ? (Number(e.value) || 0) : 0), 0));

        if (this.playerUnit) {
            this.playerUnit.hp = hpBack('player', targetPlayerHp);
            this.syncUnitHpToRawData(this.playerUnit);
        }
        if (this.enemyUnit) {
            this.enemyUnit.hp = hpBack('enemy', targetEnemyHp);
            this.syncUnitHpToRawData(this.enemyUnit);
        }
        this.refreshPlayerMechAttributeUI(true);

        // 回合结束被动恢复表现（生命恢复 / 能量恢复）：特效 + 治疗数字 + 血/蓝条
        this.playPassiveRecoverEffects(serverState, () => {
            if (this.state === BattleState.FINISHED) return;

            // 根据服务器结果收尾：击杀/胜负在双方动画都播完后才结束战斗，符合回合制常规体验
            if (serverState?.status === 'finished' && serverState.result) {
                const winner: Side = serverState.result.winner === 'player' ? 'player' : 'enemy';
                const reason: any = serverState.result.reason === 'escape' ? 'escape' : 'ko';
                // 胜负已定：为被击破的一方播放同款击破动画（敌我一致），再结束战斗
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
    }

    // ========== 服务端出手明细（round_events）演绎 ==========

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
    private playRoundEvents(
        serverState: any,
        events: any[],
        targetPlayerHp: number,
        targetEnemyHp: number,
    ): void {
        let i = 0;
        const step = () => {
            if (!this.node?.isValid || this.state === BattleState.FINISHED) return;
            if (i >= events.length) {
                this.finishRoundPresentation(serverState, targetPlayerHp, targetEnemyHp);
                return;
            }
            const ev = events[i++];
            this.playOneRoundEvent(ev, () => {
                if (!this.node?.isValid || this.state === BattleState.FINISHED) return;
                // 包一层匿名闭包：Cocos 以 target+callback 为唯一键，同一函数引用会被去重
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
    private playOneRoundEvent(ev: any, done: () => void): void {
        if (!ev || typeof ev !== 'object') {
            done();
            return;
        }

        const side: Side = ev.side === 'enemy' ? 'enemy' : 'player';
        const who = side === 'player' ? '你' : '敌方';
        const atype = String(ev.action || '').toUpperCase();
        const skillKey = SkillData.resolveSkillRef(ev.skill_key);
        const skillName = String(ev.skill_name || '') || SkillData.roundEventLabel(ev) || '普通攻击';
        const level = Math.max(1, Number(ev.level) || 1);

        // 施放失败（技能不存在 / 能量不足 / 未实装）：只提示，不改任何数值
        if (ev.failed) {
            this.log(`${who} 的「${skillName}」未能施放：${ev.failed}`);
            this.scheduleOnce(done, 0.15);
            return;
        }

        // 防御：本回合不出手，只进入防御姿态（「伤害减半」由服务端 applyGuard 算完）
        if (atype === 'DEFEND') {
            this.log(`${who} 进入防御姿态`);
            this.scheduleOnce(done, 0.15);
            return;
        }

        if (atype !== 'ATTACK' && atype !== 'SKILL') {
            done();
            return;
        }

        const targets: any[] = Array.isArray(ev.targets) ? ev.targets : [];
        const totalDamage = targets.reduce(
            (s: number, t: any) => s + Math.max(0, Number(t?.damage) || 0), 0);

        // ---- 普攻：沿用既有动画链路（远程/近战判定 + 按攻击次数拆段弹数字）----
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
        }

        // ---- 技能 ----
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
        this.log(
            `${who} 施放「${skillName}」` +
            (level > 1 ? `（Lv${level}）` : '') +
            (cost > 0 ? ` −${cost} 能量` : '') +
            (totalDamage > 0 ? ` → ${totalDamage} 点伤害` : '') +
            (totalDamage > 0 && (this.getUnit(side)?.attackTimes || 1) > 1
                ? `（攻击次数 ${this.getUnit(side)?.attackTimes}）`
                : '')
        );

        // 2) 特效打在「本次出手的目标」身上；自身 / 己方技能（护盾、修理）打在自己身上
        const t0 = targets[0]?.side;
        const effectSide: Side = t0 === 'enemy' ? 'enemy' : (t0 === 'player' ? 'player' : side);
        const effectShow = effectSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const anim = String(ev.anim || '')
            || (skillKey ? String(SkillData.getSkillDef(skillKey)?.anim || '') : '');

        // 2.5) 距离：近身技必须先位移贴到目标身前再出招；远程技原地出招。
        //    口径 = Skills.json 的 `range`（melee/ranged/dynamic/none），见 tools/skill_range_todo.md。
        //    dynamic 按「是否持枪」判定（与普攻同口径）；自身/己方技能（护盾、修理）不以敌人为目标 → 不位移。
        //    ⚠ 读不到技能定义（目录加载失败 / 技能不在目录）时**按普攻口径兜底**（持枪=远程，否则近身），
        //      绝不默认成「远程」—— 否则近身技会一直在原地出招（2026-10-01 实测事故）。
        const skillDef = skillKey ? SkillData.getSkillDef(skillKey) : null;
        const attackerShow = side === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const rawAny: any = attackerUnit?.rawData;
        const attackerHasGun = SkillData.hasGunEquipped(
            SkillData.equipmentOf(rawAny) || SkillData.equipmentOf(rawAny?.data));
        const skillRanged = SkillData.isRangedSkill(skillDef, attackerHasGun);
        const meleeMove = (!skillRanged && effectShow && effectShow !== attackerShow)
            ? this.moveInForMeleeSkill(attackerShow, effectShow, skillName)
            : null;
        Logger.warn(
            `[近身技] 「${skillName}」(key=${skillKey || '-'}) ` +
            (skillDef ? `range=${skillDef.range || '缺失'}` : '目录未命中→按普攻口径') +
            ` 持枪=${attackerHasGun} → ${skillRanged ? '远程/原地' : (meleeMove ? '近身/位移' : '近身/无需位移')}`
        );

        /** 近身技：技能动画一结束就归位，不等伤害数字播完。 */
        const startMeleeRestore = () => {
            meleeMove?.restore(() => {});
        };

        const afterEffect = () => {
            startMeleeRestore();
            if (!this.node?.isValid || this.state === BattleState.FINISHED) {
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
                Logger.warn(`[BattleScene] 技能特效播放失败 ${anim}:`, err);
            }
            // 兜底：Skill 节点缺该动画 / 回调丢失时也要推进，避免战斗卡死
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
    private applyRoundEventDamage(
        ev: any,
        attackerSide: Side,
        targets: any[],
        onDone: () => void,
    ): void {
        const attacker = this.getUnit(attackerSide);
        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const attackTimes = Math.max(1, Math.floor(Number(attacker?.attackTimes) || 1));
        const drift = this.damageDriftFor(attackerSide);

        type Job = {
            unit: BattleUnit;
            show: RobotShow | null;
            value: number;
            isMp: boolean;
            /** 仅首段 HP 伤害：整次出手击退一次 */
            shake: boolean;
        };
        const jobs: Job[] = [];
        for (const t of targets) {
            const tSide: Side | null = t?.side === 'enemy' ? 'enemy' : (t?.side === 'player' ? 'player' : null);
            if (!tSide) continue;
            const unit = this.getUnit(tSide);
            if (!unit) continue;
            const show = tSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
            const kind = String(t?.kind || 'hp_damage');
            const isMp = kind === 'mp_damage' || kind === 'mp_drain';
            const dmg = Math.max(0, Number(t?.damage) || 0);
            if (dmg <= 0) {
                // 无伤害（护盾 / 纯 buff）：仍要把服务端权威血蓝对齐
                this.clampUnitToServer(unit, t);
                this.syncUnitHpToRawData(unit);
                this.syncUnitMpToRawData(unit);
                if (show) show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
                continue;
            }
            // HP：按攻击次数拆段（与普攻 performAttackWithDamage 同口径）
            // MP：无攻击次数语义，仍均分到 skill.repeats（至少 1）
            if (isMp) {
                const repeats = Math.max(1, Math.floor(Number(ev?.repeats) || 1));
                for (const seg of this.splitEvenly(dmg, repeats)) {
                    jobs.push({ unit, show, value: seg, isMp: true, shake: false });
                }
            } else {
                const segs = computeAttackSegments(dmg, attackTimes);
                for (let si = 0; si < segs.length; si++) {
                    // 每个目标整次出手只击退一次（首段）
                    jobs.push({ unit, show, value: segs[si], isMp: false, shake: si === 0 });
                }
            }
            // 逐段取整可能与服务端总量差 1~2 点 → 该目标最后用服务端 hp_after/mp_after 兜底
            jobs.push({ unit, show, value: -1, isMp, shake: false });
        }

        if (jobs.length === 0) {
            onDone();
            return;
        }

        let i = 0;
        const step = () => {
            if (!this.node?.isValid || this.state === BattleState.FINISHED) {
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
            }

            // 整次出手只在首段 HP 伤害时击退一次
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
    private playDefenderHitShake(
        defenderShow: RobotShow | null,
        attackerShow: RobotShow | null,
        onDone?: () => void,
    ): void {
        const dNode = defenderShow?.node;
        if (!dNode?.isValid) {
            onDone?.();
            return;
        }
        const aNode = attackerShow?.node;
        let attackerOnLeft = defenderShow === this.enemyRobotShow;
        if (aNode?.isValid) {
            attackerOnLeft = aNode.worldPosition.x < dNode.worldPosition.x;
        }
        const home = dNode.position.clone();
        const delta = attackerOnLeft ? BattleScene.KNOCKBACK_DELTA : -BattleScene.KNOCKBACK_DELTA;
        const knockPos = new Vec3(home.x + delta, home.y, home.z);

        let fired = false;
        const once = () => {
            if (fired) return;
            fired = true;
            onDone?.();
        };
        try {
            Tween.stopAllByTarget(dNode);
            tween(dNode)
                .to(0.08, { position: knockPos })
                .to(0.12, { position: home })
                .call(once)
                .start();
            this.scheduleOnce(once, 0.35);
        } catch (err) {
            Logger.warn('[BattleScene] 受击抖动失败:', err);
            if (dNode.isValid) dNode.setPosition(home);
            once();
        }
    }

    /**
     * 落地一次出手的治疗 / 吸血 / 回蓝（`ev.heals`）。
     * 服务端已在结算时把成长量写进 actor，这里只做表现 + 本地数值同步。
     */
    private applyRoundEventHeals(ev: any): void {
        const list = Array.isArray(ev?.heals) ? ev.heals : [];
        for (const h of list) {
            const hSide: Side | null = h?.side === 'enemy' ? 'enemy' : (h?.side === 'player' ? 'player' : null);
            if (!hSide) continue;
            const unit = this.getUnit(hSide);
            if (!unit) continue;
            const show = hSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
            const attr = String(h?.attr || '');
            const value = Math.max(0, Number(h?.value) || 0);
            if (value <= 0) continue;

            if (attr === 'hp') {
                unit.hp = Math.min(unit.maxHp, unit.hp + value);
                if (show) show.showDamageNumber(value, true);   // isHeal → 治疗样式
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
    private clampUnitToServer(unit: BattleUnit, target: any): void {
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
    private splitEvenly(total: number, n: number): number[] {
        const count = Math.max(1, Math.floor(n || 1));
        const amount = Math.max(0, Math.floor(total));
        if (count === 1 || amount === 0) return [amount];
        const base = Math.floor(amount / count);
        const out: number[] = [];
        for (let i = 0; i < count; i++) out.push(base);
        out[count - 1] += amount - base * count;
        return out.filter((v) => v > 0);
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
    private playPassiveRecoverEffects(serverState: any, onDone: () => void): void {
        const jobs: Array<() => void> = [];

        const collect = (side: Side, show: RobotShow | null) => {
            const list = serverState?.round_passive_effects?.[side];
            if (!Array.isArray(list) || list.length === 0) return;
            const unit = side === 'player' ? this.playerUnit : this.enemyUnit;
            if (!unit) return;

            for (const e of list) {
                const attr = String(e?.attr || '');
                const healed = Number(e?.value) || 0;
                const cur = Number(e?.cur ?? NaN);
                const anim = String(e?.anim || '');
                const skillName = String(e?.name || '被动技能');
                if (healed <= 0) continue;

                jobs.push(() => {
                    // 特效（名字须在 Skill 节点播放列表里），出错不影响战斗结算
                    if (show && anim) {
                        try {
                            show.playSkillEffect(anim, 1);
                        } catch (err) {
                            Logger.warn(`[BattleScene] 被动恢复特效播放失败 ${anim}:`, err);
                        }
                    }

                    const who = side === 'player' ? '你' : '敌方';
                    if (attr === 'hp') {
                        unit.hp = Number.isFinite(cur)
                            ? Math.min(unit.maxHp, cur)
                            : Math.min(unit.maxHp, unit.hp + healed);
                        this.syncUnitHpToRawData(unit);
                        if (show) {
                            show.showDamageNumber(healed, true);   // isHeal = true → 治疗样式
                            show.updateBattleBars(unit.hp, unit.maxHp, unit.mp, unit.maxMp);
                        }
                        this.log(`${who}的「${skillName}」恢复 ${healed} 点生命（${unit.hp}/${unit.maxHp}）`);
                    } else if (attr === 'mp') {
                        unit.mp = Number.isFinite(cur)
                            ? Math.min(unit.maxMp, cur)
                            : Math.min(unit.maxMp, unit.mp + healed);
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
            if (!this.node?.isValid) {
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
                Logger.error('[BattleScene] 被动恢复表现异常（已吞掉，不影响战斗流程）:', err);
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
    private playRoundFromServerState(
        serverState: any,
        playerAction: ActionType,
        basePlayerHp: number,
        baseEnemyHp: number,
    ) {
        if (!this.playerUnit || !this.enemyUnit) {
            Logger.warn(
                `[BattleScene] playRoundFromServerState 单位缺失，直接恢复操作 ` +
                `playerUnit=${!!this.playerUnit} enemyUnit=${!!this.enemyUnit}`
            );
            this.state = BattleState.INIT;
            this.isAnimating = false;
            this.isRequestingAction = false;
            this.animWatchdog = 0;
            if (this.node?.isValid) this.startCommandPhase();
            return;
        }

        const targetPlayerHp = Number(serverState?.player?.hp ?? this.playerUnit.hp ?? 0);
        const targetEnemyHp = Number(serverState?.enemy?.hp ?? this.enemyUnit.hp ?? 0);

        // 回合结束被动恢复（生命恢复 / 能量恢复）—— 服务端在「死亡判定之后」算好再下发。
        // ⚠ 服务端给的 hp 是「攻击结算 + 被动恢复」后的最终值，算伤害时必须先把恢复量剥掉，
        //   否则本回合伤害会被少算（伤害数字偏小、动画表现与真实掉血不符）。
        const recoverHp = (side: Side): number => {
            const list = serverState?.round_passive_effects?.[side];
            if (!Array.isArray(list)) return 0;
            return list.reduce(
                (sum: number, e: any) => sum + (e?.attr === 'hp' ? (Number(e.value) || 0) : 0),
                0,
            );
        };
        const hpAfterAttackPlayer = Math.max(0, targetPlayerHp - recoverHp('player'));
        const hpAfterAttackEnemy = Math.max(0, targetEnemyHp - recoverHp('enemy'));

        // 攻击不改能量 → 回合开始前的 MP 就是被动恢复的动画起点
        const basePlayerMp = this.playerUnit.mp;
        const baseEnemyMp = this.enemyUnit.mp;

        this.animWatchdog = 0;
        this.state = BattleState.ANIMATING;
        this.isAnimating = true;
        this.setButtonsInteractable(false);
        if (this.battleSelectPanel) this.battleSelectPanel.active = false;
        this.closeSkillSelectPanel();
        if (this.timerRoot) this.timerRoot.active = false;

        // 同步单位/展示数据（不结束战斗、不显示面板）
        this.applyServerRoomState(serverState, false, true);

        // 按服务器结果计算本回合掉血量（不能为负）。基于「攻击后、被动恢复前」的 HP
        const damageToPlayer = Math.max(0, basePlayerHp - hpAfterAttackPlayer);
        const damageToEnemy = Math.max(0, baseEnemyHp - hpAfterAttackEnemy);
        Logger.warn(
            `[攻击诊断] 服务器回合结果: 玩家HP ${basePlayerHp}→${hpAfterAttackPlayer}(伤${damageToPlayer}) ` +
            `敌人HP ${baseEnemyHp}→${hpAfterAttackEnemy}(伤${damageToEnemy}) 玩家动作=${playerAction} ` +
            `被动恢复 玩家+${recoverHp('player')}/敌人+${recoverHp('enemy')}`
        );

        // 为了播动画，把本地 HP 暂时「回滚」到回合开始前（MP 同样回到回合开始值，
        // 这样被动恢复能演出「涨上去」的过程；攻击不改 MP，回滚不会丢信息）
        this.playerUnit.hp = basePlayerHp;
        this.enemyUnit.hp = baseEnemyHp;
        this.playerUnit.mp = basePlayerMp;
        this.enemyUnit.mp = baseEnemyMp;
        this.syncUnitHpToRawData(this.playerUnit);
        this.syncUnitHpToRawData(this.enemyUnit);
        this.refreshPlayerMechAttributeUI(true);

        // 演绎本回合：
        //   ① 服务端给了「出手明细」（round_events）→ 走事件路径，逐次出手演绎（技能/普攻/防御、暴击、治疗都能还原）；
        //   ② 没给（老服务端 / 空回合）→ 回落到「按 HP 差值反推」的旧路径，保证不回归。
        const events: any[] = Array.isArray(serverState?.round_events) ? serverState.round_events : [];
        if (events.length > 0) {
            this.playRoundEvents(serverState, events, targetPlayerHp, targetEnemyHp);
        } else {
            // 用服务器伤害驱动一轮动画，播完再落到服务器最终 HP
            this.playServerRoundAnimation(
                playerAction,
                damageToPlayer,
                damageToEnemy,
                targetPlayerHp,
                targetEnemyHp,
                serverState,
            );
        }
    }

    /**
     * 服务端主动推送「PVP 回合已结算」：
     *   解决挂机方从不发请求 → 永远拿不到新 state → 看不到动画/血条不更新的缺陷。
     *
     * 去重：仅当推送的 settled_round >= 自己已知的回合数、且当前不在播同一回合时才处理。
     */
    private onPvpRoundUpdate(msg: any) {
        if (!this.node?.isValid) return;
        const data = msg?.data ?? msg;
        const state = data?.state;
        if (!state) return;

        // 只处理本房间的推送
        const incomingRoomId = state.room_id || state.roomId || data?.room_id || null;
        if (this.roomId && incomingRoomId && incomingRoomId !== this.roomId) return;

        const settledRound = Number(data?.settled_round ?? state.round ?? 0);

        // 去重：同一回合的推送只处理一次
        if (settledRound > 0 && settledRound <= this._lastPlayedPvpRound) {
            Logger.debug(`[BattleScene] 忽略重复的 pvp_round_update round=${settledRound}`);
            return;
        }

        // 正在播自己的动作动画（请求还没回来）时，交给请求回调处理，避免重复播
        if (this.isRequestingAction) {
            Logger.debug('[BattleScene] 请求进行中，忽略 pvp_round_update（由请求回调统一处理）');
            return;
        }
        // 正在播动画（同一回合）时不打断
        if (this.isAnimating) {
            Logger.debug('[BattleScene] 动画进行中，忽略 pvp_round_update');
            return;
        }
        if (state.status === 'finished' && this.state === BattleState.FINISHED) return;

        this._lastPlayedPvpRound = settledRound > 0 ? settledRound : this._lastPlayedPvpRound;

        // 推送里「自己」的动作由自己的 round_actions 决定（视角已交换）：
        //   取不到时按 ATTACK 处理（服务器补普攻的场景）。
        const myAction: ActionType =
            (state.round_actions?.player as ActionType) ||
            (state.my_action as ActionType) ||
            'ATTACK';

        const basePlayerHp = this.playerUnit?.hp ?? Number(state.player?.hp ?? 0);
        const baseEnemyHp = this.enemyUnit?.hp ?? Number(state.enemy?.hp ?? 0);

        this.log('[PVP] 收到服务器回合推送，播放整回合动画');
        this.playRoundFromServerState(state, myAction, basePlayerHp, baseEnemyHp);
    }

    /**
     * 在线模式专用：按服务器给定伤害值播放一次攻击动画（不再用本地公式算伤害）。
     * 流程：先播攻击动画 → 动画结束后扣血、弹出伤害数字 → 延迟后再更新血条（敌我都等伤害数字弹出后再改）。
     */
    private performAttackWithDamage(attackerSide: Side, damage: number, onDone: () => void) {
        const attacker = this.getUnit(attackerSide);
        const defender = this.getOpponent(attackerSide);
        Logger.warn(`[攻击诊断] 进入 performAttackWithDamage side=${attackerSide} damage=${damage} attacker=${!!attacker} defender=${!!defender}`);
        if (!attacker || !defender) {
            Logger.warn('[攻击诊断] attacker/defender 缺失，直接 onDone');
            onDone();
            return;
        }
        if (this.state === BattleState.FINISHED) {
            Logger.warn('[攻击诊断] state=FINISHED，直接 onDone');
            onDone();
            return;
        }

        this.state = BattleState.ANIMATING;
        this.isAnimating = true;
        this.setButtonsInteractable(false);

        damage = Math.max(1, Math.floor(damage));

        // 「攻击次数」：服务端给的是整次伤害，客户端按攻击次数拆段展示（总伤上限 +20%）
        const segments = computeAttackSegments(damage, attacker.attackTimes);
        const totalApplied = segments.reduce((a, b) => a + b, 0);
        const drift = this.damageDriftFor(attackerSide);

        this.log(
            `${attackerSide === 'player' ? '玩家' : '敌人'} 造成 ${totalApplied} 点伤害（按服务器结果）` +
            (segments.length > 1 ? `，分 ${segments.length} 段` : '')
        );

        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;

        // 是否远程：沿用原来判断
        const attackerEquip = attacker.rawData?.equipment || attacker.rawData?.data?.equipment || {};
        const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);

        Logger.warn(`[攻击诊断] 段数=${segments.length} 总伤=${totalApplied} attackerShow=${!!attackerShow} defenderShow=${!!defenderShow} 远程=${attackerHasGun}`);
        // 逐段扣血、弹伤害数字（此时不刷新任何血条，等伤害数字一起）。
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
            Logger.warn(`[攻击诊断] 开始逐段结算 segments=${segments.length}`);
            let i = 0;
            const step = () => {
                Logger.warn(`[攻击诊断] step 执行 i=${i} 总段=${segments.length}`);
                if (i < segments.length) {
                    const segVal = segments[i];
                    defender.hp = Math.max(0, defender.hp - segVal);
                    this.syncUnitHpToRawData(defender);
                    Logger.warn(`[攻击诊断] 段 ${i + 1}/${segments.length} -${segVal} 剩余HP=${defender.hp}/${defender.maxHp} defenderShow=${!!defenderShow}`);
                    if (defenderShow) {
                        defenderShow.showDamageNumber(segVal, false, drift.x, drift.y);
                    }
                    i++;
                    if (i < segments.length) {
                        // 关键：包一层匿名闭包，避免同一 callback 引用被 Cocos 去重而丢失调度
                        this.scheduleOnce(() => step(), 0.18);
                        return;
                    }
                }
                // 全部段落结束：等伤害数字弹出后，血条与属性面板一起更新，再结束本动作
                this.scheduleOnce(() => {
                    Logger.warn(`[攻击诊断] 段结算收尾更新血条 defenderHP=${defender.hp}/${defender.maxHp}`);
                    if (this.state !== BattleState.FINISHED) {
                        if (defenderShow) {
                            defenderShow.updateBattleBars(
                                defender.hp, defender.maxHp, defender.mp, defender.maxMp,
                            );
                        }
                        if (defender.side === 'player') {
                            this.refreshPlayerMechAttributeUI(true);
                        }
                    }
                    if (this.node?.isValid) {
                        Logger.warn('[攻击诊断] 调用 onDone 解除锁定');
                        onDone();
                    }
                }, 0.35);
            };
            step();
        };

        this.playAttackAnimation(
            attackerShow, defenderShow, attackerHasGun,
            // onComplete：动画播完（兜底启动分段结算 + 解锁）
            () => {
                Logger.warn(`[攻击诊断] 攻击动画回调已触发（onComplete）segments=${segments.length}`);
                this.isAnimating = false;
                startSegments();
            },
            // onImpact：接触到对方的瞬间 —— 只弹伤害数字（**普攻不播技能特效**，2026-09-30 用户要求去掉）
            () => {
                startSegments();
            },
        );
    }

    private playAttackAnimation(
        attackerShow: RobotShow | null,
        defenderShow: RobotShow | null,
        isRanged: boolean,
        onComplete: () => void,
        /**
         * 「接触瞬间」回调：攻击方触及受击者的那一刻触发（近战=瞬移到位即接触；远程=子弹命中击退开始）。
         * 伤害数字/扣血由调用方挂在这里，做到「一打到就弹数字」，不等整段动画播完。
         */
        onImpact?: () => void
    ) {
        const attackerNode: Node | null = attackerShow?.node || null;
        const defenderNode: Node | null = defenderShow?.node || null;

        Logger.warn(`[攻击诊断] playAttackAnimation 进入 attackerNode=${!!attackerNode} defenderNode=${!!defenderNode} 远程=${isRanged}`);

        // 接触回调幂等：tween 回调与兜底可能都触发，保证只结算一次
        let impactFired = false;
        const fireImpact = () => {
            if (impactFired) return;
            impactFired = true;
            Logger.warn('[攻击诊断] onImpact 接触瞬间触发');
            onImpact?.();
        };

        if (!attackerNode || !defenderNode) {
            Logger.warn('[BattleScene] 攻击动画：缺少 RobotShow 节点，跳过动画');
            fireImpact();   // 无动画也要先结算伤害
            onComplete();
            return;
        }

        const attackerStart = attackerNode.position.clone();
        const defenderStart = defenderNode.position.clone();

        // 敌人被击退方向：始终远离攻击方
        const attackerOnLeft = attackerNode.worldPosition.x < defenderNode.worldPosition.x;
        const knockbackDelta = attackerOnLeft ? BattleScene.KNOCKBACK_DELTA : -BattleScene.KNOCKBACK_DELTA; // 击退像素（与近身技共用）
        const knockbackPos = new Vec3(defenderStart.x + knockbackDelta, defenderStart.y, defenderStart.z);

        // 为了避免双方动作重叠，这里统一用“全部 tween 结束后再回调”的计数逻辑
        let activeTweens = 0;
        let animDone = false;
        let animFallback: (() => void) | null = null;
        const fireComplete = () => {
            if (animDone) return;   // 单次守卫：防止 tween 与兜底重复触发造成伤害重复结算
            animDone = true;
            // 兜底：极端情况下接触回调未触发（tween 丢回调等），此处补发，保证伤害一定结算
            fireImpact();
            // 动画已正常完成：清掉兜底调度，避免每次攻击都往 scheduler 里堆积一个 2.2s 定时器
            if (animFallback) {
                this.unschedule(animFallback);
                animFallback = null;
            }
            Logger.warn('[攻击诊断] playAttackAnimation 动画完成（fireComplete）');
            onComplete();
        };
        const onTweenStart = () => {
            activeTweens += 1;
        };
        const onTweenDone = () => {
            activeTweens -= 1;
            Logger.warn(`[攻击诊断] onTweenDone 剩余 activeTweens=${activeTweens}`);
            if (activeTweens <= 0) {
                // 所有本次攻击相关的 tween 都完成，才能开始下一方行为
                fireComplete();
            }
        };
        // 兜底：tween 若因节点失效/引擎原因丢回调，2.2s 后强制推进，避免战斗死锁
        animFallback = () => {
            if (animDone) return;
            Logger.warn('[攻击诊断] playAttackAnimation 2.2s 兜底触发');
            fireComplete();
        };
        this.scheduleOnce(animFallback, 2.2);

        // 远程（射击）：攻击方「后坐 + 回位」+ 敌人「中弹击退 + 拉回」，错开时序让“先开火→再中弹”更清晰
        if (isRanged) {
            const recoilDelta = attackerOnLeft ? -22 : 22; // 后坐方向：远离敌人
            const recoilPos = new Vec3(attackerStart.x + recoilDelta, attackerStart.y, attackerStart.z);
            onTweenStart();
            tween(attackerNode)
                .to(0.07, { position: recoilPos })
                .to(0.11, { position: attackerStart })
                .call(onTweenDone)
                .start();
            onTweenStart();
            tween(defenderNode)
                .delay(0.05)
                .to(0.08, { position: knockbackPos })
                // 子弹命中（击退到位）的瞬间即视为「接触」，立即弹出伤害数字
                .call(() => {
                    fireImpact();
                })
                .to(0.12, { position: defenderStart })
                .call(onTweenDone)
                .start();
            return;
        }

        // 近战：攻击方瞬移到对方面前（间隔 MELEE_CONTACT_GAP 的 X），两者一起产生击退/拉回效果，然后攻击方快速回位
        const meleeGap = BattleScene.MELEE_CONTACT_GAP;
        const meleeContactX = attackerOnLeft
            ? defenderStart.x - meleeGap
            : defenderStart.x + meleeGap;
        const meleeContactPos = new Vec3(meleeContactX, attackerStart.y, attackerStart.z);

        // 瞬移到近战位置
        attackerNode.setPosition(meleeContactPos);
        // 瞬移到位即「接触到对方」——立刻弹出伤害数字，不留等待
        fireImpact();

        // 敌人击退 + 拉回，同时攻击方稍微跟随一点拉回感，然后回原位
        onTweenStart();
        tween(defenderNode)
            .to(0.08, { position: knockbackPos })
            .to(0.12, { position: defenderStart })
            .call(() => {
                onTweenDone();
            })
            .start();

        onTweenStart();
        tween(attackerNode)
            // 稍微跟随敌人方向轻微移动，增强打击感
            .to(0.08, { position: new Vec3(meleeContactPos.x + knockbackDelta * 0.3, meleeContactPos.y, meleeContactPos.z) })
            .to(0.12, { position: meleeContactPos })
            // 回到原位
            .to(0.12, { position: attackerStart })
            .call(() => {
                onTweenDone();
            })
            .start();
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
    private moveInForMeleeSkill(
        attackerShow: RobotShow | null,
        targetShow: RobotShow | null,
        skillName: string = '',
    ): { restore: (cb: () => void) => void } | null {
        const aNode = attackerShow?.node;
        const tNode = targetShow?.node;
        if (!aNode || !tNode || aNode === tNode) return null;

        // 归位点优先用缓存的「战斗站位」（不受上一次击退残留影响），没有才用当前位置
        const cachedHome = attackerShow === this.playerRobotShow ? this.battlePlayerPos : this.battleEnemyPos;
        const home = cachedHome ? cachedHome.clone() : aNode.position.clone();
        const targetStart = tNode.position.clone();
        const attackerOnLeft = aNode.worldPosition.x < tNode.worldPosition.x;
        const gap = BattleScene.MELEE_CONTACT_GAP;
        const contactPos = new Vec3(
            attackerOnLeft ? targetStart.x - gap : targetStart.x + gap,
            home.y, home.z,
        );
        // 清掉可能残留的位移 tween，避免叠加造成错位
        try {
            Tween.stopAllByTarget(aNode);
        } catch (e) { /* 忽略 */ }
        aNode.setPosition(contactPos);
        Logger.warn(
            `[近身技] 位移「${skillName || '技能'}」：x ${home.x.toFixed(0)} → ${contactPos.x.toFixed(0)}` +
            `（目标 x=${targetStart.x.toFixed(0)}，${attackerOnLeft ? '左→右' : '右→左'}）`
        );

        return {
            restore: (cb: () => void) => {
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
                    tween(aNode)
                        .to(BattleScene.MELEE_RETURN_TIME, { position: home })
                        .call(once)
                        .start();
                    // 兜底：tween 回调丢失（节点失效 / 战斗收尾）时也要归位并推进，避免死锁
                    this.scheduleOnce(once, BattleScene.MELEE_RETURN_TIME + 0.3);
                } catch (err) {
                    Logger.warn('[BattleScene] 近身技归位失败:', err);
                    if (aNode.isValid) aNode.setPosition(home);
                    once();
                }
            },
        };
    }

    /** 新一场战斗开始前：恢复击破动画后的透明度，并清理上一场残留的 tween（不动本场已排程的 scheduleOnce） */
    private prepareRobotShowsForNewBattle(): void {
        if (this.playerRobotShow?.node) Tween.stopAllByTarget(this.playerRobotShow.node);
        if (this.enemyRobotShow?.node) Tween.stopAllByTarget(this.enemyRobotShow.node);
        this.resetRobotShowOpacity(this.playerRobotShow);
        this.resetRobotShowOpacity(this.enemyRobotShow);
        if (this.playerRobotShow) this.playerRobotShow.resetVisualState();
        if (this.enemyRobotShow) this.enemyRobotShow.resetVisualState();
    }

    /** 将 RobotShow 下所有 Sprite 的透明度恢复为 255，避免击破动画后下次战斗不显示 */
    private resetRobotShowOpacity(show: RobotShow | null) {
        if (!show?.node?.isValid) return;
        const sprites = show.node.getComponentsInChildren(Sprite);
        sprites.forEach(s => {
            if (!s?.node?.isValid) return;
            const c = s.color;
            s.color = new Color(c.r, c.g, c.b, 255);
        });
    }

    /**
     * 机甲被击败时的消失动画（敌我通用）：整机闪烁 → 装备透明度快速消失 → 机甲透明度消失，总时长 1 秒内，再回调
     * 不同步频率，分阶段进行。
     */
    private playDefeatAnimation(defeatedShow: RobotShow, onComplete: () => void) {
        const root = defeatedShow.node;
        if (!root || !root.isValid) {
            onComplete();
            return;
        }
        const body = defeatedShow.body;
        const equipNodes = [defeatedShow.weaponIcon, defeatedShow.gunIcon, defeatedShow.dunIcon, defeatedShow.wingIcon].filter(Boolean) as Node[];
        const allSprites: Sprite[] = root.getComponentsInChildren(Sprite);
        const equipSprites: Sprite[] = [];
        const bodySprites: Sprite[] = [];
        for (const n of equipNodes) {
            const s = n?.getComponent(Sprite);
            if (s) equipSprites.push(s);
        }
        if (body?.isValid) {
            bodySprites.push(...body.getComponentsInChildren(Sprite));
        }
        const setAlpha = (list: Sprite[], a: number) => {
            const alpha = Math.max(0, Math.min(255, Math.round(a)));
            list.forEach(s => {
                if (!s?.node?.isValid) return;
                const c = s.color;
                s.color = new Color(c.r, c.g, c.b, alpha);
            });
        };

        // 1) 0~0.25s：整机闪烁（不统一频率）
        this.scheduleOnce(() => setAlpha(allSprites, 120), 0.06);
        this.scheduleOnce(() => setAlpha(allSprites, 255), 0.12);
        this.scheduleOnce(() => setAlpha(allSprites, 120), 0.18);
        this.scheduleOnce(() => setAlpha(allSprites, 255), 0.25);

        // 2) 0.2s 起：装备透明度快速消失（约 0.25s 内消失）
        const equipFadeStart = 0.2;
        const equipFadeDur = 0.25;
        const equipSteps = 8;
        for (let i = 0; i <= equipSteps; i++) {
            const t = equipFadeStart + (equipFadeDur * i) / equipSteps;
            const alpha = 255 * (1 - i / equipSteps);
            this.scheduleOnce(() => setAlpha(equipSprites, alpha), t);
        }

        // 3) 0.35s 起：机甲本体透明度消失（约 0.4s 内消失）
        const bodyFadeStart = 0.35;
        const bodyFadeDur = 0.4;
        const bodySteps = 10;
        for (let i = 0; i <= bodySteps; i++) {
            const t = bodyFadeStart + (bodyFadeDur * i) / bodySteps;
            const alpha = 255 * (1 - i / bodySteps);
            this.scheduleOnce(() => setAlpha(bodySprites, alpha), t);
        }

        this.scheduleOnce(() => {
            if (typeof onComplete === 'function') onComplete();
        }, 1.0);
    }

    private finishBattle(winner: Side, reason: 'ko' | 'escape') {
        if (this.state === BattleState.FINISHED) return;
        this.state = BattleState.FINISHED;
        this.isAnimating = false;
        this.setButtonsInteractable(false);
        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false;
        }
        this.closeSkillSelectPanel();
        if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
        if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false);

        // 战斗结束后：玩家机甲若在本场被打倒（血量归零），保底恢复 1 滴血
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
            reason,
        };

        // 通知服务器战斗结果（仅日志，无胜负权威意义；剧情结算走 story_battle_finalize）
        try {
            this.ws.send(
                {
                    type: 'battle_result',
                    // DEPRECATED: 客户端 battle_result / battle_won 不得作为剧情权威证据
                    winner: winner === 'player' ? 'player' : 'enemy',
                    reason,
                    player: this.playerUnit ? this.buildUnitSummary(this.playerUnit) : null,
                    enemy: this.enemyUnit ? this.buildUnitSummary(this.enemyUnit) : null,
                } as any,
                true,
            );
        } catch (e) {
            Logger.warn('[BattleScene] 发送 battle_result 失败:', e);
        }

        // 战斗结束后：清除本场机甲详情缓存，保证回到机甲属性时重新拉取并显示实打实的血量/经验
        try {
            const petId = this.playerUnit?.petId != null ? String(this.playerUnit.petId) : null;
            if (petId) {
                this.cacheManager.clearRobotPetInfoCache(petId);
            }
            const cid = this.ws.getCharacterId?.();
            if (cid) {
                const req: any = { type: 'get_player', character_id: cid };
                const uid = this.ws.getUserId?.();
                if (uid != null) req.user_id = uid;
                this.ws.send(req as any, true, true);
            }
        } catch (e) {
            Logger.warn('[BattleScene] 战斗结束刷新缓存/拉取失败:', e);
        }

        this.log(`战斗结束：${result.type === 'win' ? '玩家胜利' : '玩家失败'}（原因：${reason === 'ko' ? '击倒' : '逃跑'}）`);

        const finishedRoomId = this.roomId || '';
        if (finishedRoomId) {
            try {
                BattleResumeController.getInstance().notifyRoomFinished(finishedRoomId);
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
                reason,
            });
        }

        // 关闭 BattleScene 面板（上层可选择重新激活）
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.active = false;
            }
        }, 1.0);
    }

    private buildUnitSummary(unit: BattleUnit | null) {
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
            pet_id: unit.petId,
        };
    }

    private log(msg: string) {
        Logger.debug('[BattleScene]', msg);
        if (!this.logLabel) return;
        const old = this.logLabel.string || '';
        this.logLabel.string = old ? `${old}\n${msg}` : msg;
    }

    private logClear() {
        if (this.logLabel) {
            this.logLabel.string = '';
        }
    }

    // =========================
    // PlayerShow / EnemyPlayerShow（角色形象+名字）
    // 剧情战：玩家形象+机甲；敌方仅机甲
    // 模拟战/PVP：双方形象+机甲
    // =========================

    private _isStoryBattle(): boolean {
        return this._entryIntent === 'story' || !!this._storyContext;
    }

    /** 按战斗类型切换人物形象节点显隐（机甲 RobotShow 始终展示） */
    private _syncBattlePortraitVisibility(): void {
        const story = this._isStoryBattle();
        if (this.playerShowRoot) {
            this.playerShowRoot.active = true;
        }
        if (this.enemyPlayerShowRoot) {
            this.enemyPlayerShowRoot.active = !story;
        }
        if (this.playerRobotShow?.node) {
            this.playerRobotShow.node.active = true;
        }
        if (this.enemyRobotShow?.node) {
            this.enemyRobotShow.node.active = true;
        }
    }

    private refreshPlayerAndEnemyShows(enemyCharacterId?: string | null): void {
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

    private refreshPlayerShowFromServer(): void {
        if (!this.playerShowRoot) return;
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) return;

        const requestId = `battle_get_player_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const req: any = { character_id: characterId, request_id: requestId };
        const userId = this.ws.getUserId?.();
        if (userId) req.user_id = userId;

        // 先清掉上一次遗留的监听
        this.clearPlayerInfoListener();

        // 兼容服务器实际事件：'player_info' / 'player_info_response'
        // 同时尽量用 request_id 过滤，避免吃到其他面板的返回
        const handler = (resp: any) => {
            const data = (resp && resp.success && resp.data && typeof resp.data === 'object')
                ? { ...resp, ...resp.data }
                : resp;
            if (!data || data.success !== true) return;
            const isSelf = data.is_self === true || data.is_self === 'true' || data.is_self === 1 || data.is_self === '1';
            if (!isSelf) return;
            // 若响应携带 request_id，则必须匹配；否则退化为 character_id 匹配
            if (data.request_id !== undefined && data.request_id !== null) {
                if (data.request_id !== requestId) return;
            } else {
                const respCid = String(data.character_id || '');
                if (respCid && respCid !== characterId) return;
            }
            const name = String(data.role_name || '');
            const spriteIndex = Number(data.Sprite || data.sprite || 0);
            this.applyRoleShow(this.playerShowRoot!, name, spriteIndex);
            cleanup();
        };
        this.playerInfoListener = handler;
        const cleanup = () => this.clearPlayerInfoListener();

        this.ws.on('player_info', handler, this);
        this.ws.on('player_info_response', handler, this);
        // 不做 3 秒超时自动清理：进入战斗时可能卡加载/网络慢，避免错过回包导致永远不显示

        // 发送请求（不依赖 request() 的 *_response 机制）
        this.ws.send({ type: 'get_player', ...req } as any, true, true);
    }

    private clearPlayerInfoListener(): void {
        if (!this.playerInfoListener) return;
        if (this.ws) {
            this.ws.off('player_info', this.playerInfoListener, this);
            this.ws.off('player_info_response', this.playerInfoListener, this);
        }
        this.playerInfoListener = null;
    }

    private refreshEnemyShowFromCharacterId(characterId: string): void {
        if (!this.enemyPlayerShowRoot || !characterId) {
            this.refreshEnemyShowRandom();
            return;
        }

        const requestId = `battle_get_enemy_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const req: any = { character_id: characterId, request_id: requestId };
        const userId = this.ws.getUserId?.();
        if (userId) req.user_id = userId;

        this.clearEnemyInfoListener();

        const handler = (resp: any) => {
            const data = (resp && resp.success && resp.data && typeof resp.data === 'object')
                ? { ...resp, ...resp.data }
                : resp;
            if (!data || data.success !== true) return;
            if (data.request_id !== undefined && data.request_id !== null) {
                if (data.request_id !== requestId) return;
            } else {
                const respCid = String(data.character_id || '');
                if (respCid && respCid !== characterId) return;
            }
            const name = String(data.role_name || '');
            const spriteIndex = Number(data.Sprite || data.sprite || 0);
            this.applyRoleShow(this.enemyPlayerShowRoot!, name, spriteIndex);
            cleanup();
        };
        this.enemyInfoListener = handler;
        const cleanup = () => this.clearEnemyInfoListener();

        this.ws.on('player_info', handler, this);
        this.ws.on('player_info_response', handler, this);
        this.ws.send({ type: 'get_player', ...req } as any, true, true);
    }

    private clearEnemyInfoListener(): void {
        if (!this.enemyInfoListener) return;
        if (this.ws) {
            this.ws.off('player_info', this.enemyInfoListener, this);
            this.ws.off('player_info_response', this.enemyInfoListener, this);
        }
        this.enemyInfoListener = null;
    }

    private refreshEnemyShowRandom(): void {
        if (!this.enemyPlayerShowRoot) return;
        const randomNames = ['敌人', '神秘人', '挑战者', '对手', '来者不善'];
        const name = `${randomNames[Math.floor(Math.random() * randomNames.length)]}${Math.floor(100 + Math.random() * 900)}`;
        const spriteIndex = this.characterAvatarFrames.length > 0
            ? (1 + Math.floor(Math.random() * this.characterAvatarFrames.length))
            : 0;
        this.applyRoleShow(this.enemyPlayerShowRoot, name, spriteIndex);
    }

    private applyRoleShow(root: Node, roleName: string, spriteIndex: number): void {
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
    }

    // =========================
    // 新增：MechaClass/Player1 图标切换
    // =========================

    private updatePlayer1ClassIcon(classValue: number): void {
        if (!this.player1ClassIcon) return;
        let frame: SpriteFrame | null = null;
        // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng
        if (classValue === 2) frame = this.player1ClassIconSheji;
        else if (classValue === 3) frame = this.player1ClassIconQuanneng;
        else frame = this.player1ClassIconGedou;
        if (frame) this.player1ClassIcon.spriteFrame = frame;
    }

    private updateEnemy1ClassIcon(classValue: number): void {
        if (!this.enemy1ClassIcon) return;
        let frame: SpriteFrame | null = null;
        // Class 约定：1=格斗 gedou，2=射击 sheji，3=全能 quanneng
        if (classValue === 2) frame = this.enemy1ClassIconSheji;
        else if (classValue === 3) frame = this.enemy1ClassIconQuanneng;
        else frame = this.enemy1ClassIconGedou;
        if (frame) this.enemy1ClassIcon.spriteFrame = frame;
    }

    // =========================
    // 新增：战斗机甲属性面板（实时）
    // =========================

    private ensureMechAttributeInited(): void {
        if (this.mechAttrInited) return;
        if (!this.mechAttributeRoot) return;
        this.initMechAttributeBindings(this.mechAttributeRoot);
        this.mechAttrInited = true;
    }

    private initMechAttributeBindings(root: Node): void {
        this.mechTextMap = {};
        this.mechNodeMap = {};
        this.mechBarMap = {};

        // 普通文本型
        const textKeys = ['Growth', 'Comprehension', 'StarLevel', 'Star', 'RobotName', 'Level', 'Class'];
        for (const key of textKeys) {
            const parent = this.findChildByName(root, key);
            const labelNode = parent?.getChildByName('NumericalValue') || null;
            const label = labelNode?.getComponent(Label) || null;
            if (label) this.mechTextMap[key] = label;
        }

        // 分割型（基础值/当前值）
        const nodeKeys = [
            'Melee', 'Armor', 'Accuracy', 'Corrosion', 'Initiative',
            'Block', 'AttackCount', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'
        ];
        for (const key of nodeKeys) {
            const parent = this.findChildByName(root, key);
            const layoutNode = parent?.getChildByName('Node') || null;
            if (!layoutNode) continue;
            this.mechNodeMap[key] = {
                left: layoutNode.getChildByName('LeftLabel')?.getComponent(Label) || null,
                right: layoutNode.getChildByName('RightLabel')?.getComponent(Label) || null,
                slash: layoutNode.getChildByName('SlashSprite') || null,
            };
        }

        // 进度条（HP/MP/EXP）
        const barKeys = [
            { key: 'HP', max: 'MaxHP', cur: 'CurrentHP', panel: 'HPpanel' },
            { key: 'MP', max: 'MaxMP', cur: 'CurrentMP', panel: 'MPpanel' },
            { key: 'EXP', max: 'MaxEXP', cur: 'CurrentEXP', panel: 'EXPpanel' },
        ];
        for (const item of barKeys) {
            const parent = this.findChildByName(root, item.key);
            const panel = parent?.getChildByName(item.panel) || null;
            const barNode = panel?.getChildByName(item.cur) || null;
            const labelNode = panel?.getChildByName('NumericalValue') || null;
            const label = labelNode?.getComponent(Label) || null;
            if (barNode || label) {
                this.mechBarMap[item.key] = { bar: barNode, label };
            }
        }
    }

    private refreshPlayerMechAttributeUI(force: boolean = false): void {
        if (!this.mechAttributeRoot) return;
        if (!this.playerUnit) return;
        this.ensureMechAttributeInited();
        const data = this.buildPlayerMechDisplayData();
        if (!data) return;
        this.applyMechAttributeDataToUI(data);
    }

    private startAttributeAutoRefresh(): void {
        if (this.attributeAutoRefreshStarted) return;
        this.attributeAutoRefreshStarted = true;
        // 低频定时刷新兜底（多数时候我们会在伤害结算时立刻刷新）
        this.unschedule(this.attrRefreshTick);
        this.schedule(this.attrRefreshTick, this.ATTR_REFRESH_INTERVAL);
    }

    private stopAttributeAutoRefresh(): void {
        if (!this.attributeAutoRefreshStarted) return;
        this.attributeAutoRefreshStarted = false;
        this.unschedule(this.attrRefreshTick);
    }

    private buildPlayerMechDisplayData(): any | null {
        if (!this.playerUnit) return null;
        let raw = this.playerUnit.rawData;
        if (raw && raw.data && typeof raw.data === 'object') {
            raw = { ...raw, ...raw.data };
        }
        const base = raw && typeof raw === 'object' ? raw : {};
        // 用战斗内实时值覆盖 CurrentHP
        return {
            ...base,
            pet_id: this.playerUnit.petId,
            RobotName: base.RobotName ?? this.playerUnit.name,
            Level: base.Level ?? this.playerUnit.level,
            MaxHP: Number(base.MaxHP ?? this.playerUnit.maxHp),
            CurrentHP: Number(this.playerUnit.hp),
        };
    }

    private applyMechAttributeDataToUI(data: any): void {
        // 文本
        for (const key of Object.keys(this.mechTextMap)) {
            const label = this.mechTextMap[key];
            if (!label) continue;
            if (key === 'Star') {
                label.string = String(data['StarLevel'] ?? '');
                continue;
            }
            if (key === 'RobotName') {
                const name = String(data['RobotName'] ?? '');
                const formNum = Number(data['Form'] !== undefined ? data['Form'] : (data['Fo'] !== undefined ? data['Fo'] : 0));
                let suffix = '';
                if (formNum === 1) suffix = '|初';
                else if (formNum === 2) suffix = '|中';
                else if (formNum === 3) suffix = '|终';
                label.string = name + suffix;
                continue;
            }
            if (key === 'Class') {
                const classNum = Number(data['Class'] ?? 1);
                let classStr = '格斗型';
                if (classNum === 2) classStr = '射击型';
                else if (classNum === 3) classStr = '全能型';
                label.string = classStr;
                continue;
            }
            label.string = String(data[key] ?? '');
        }

        // 分割值
        for (const key of Object.keys(this.mechNodeMap)) {
            const group = this.mechNodeMap[key];
            if (!group || !group.left) continue;
            const baseValue = data[key] ?? 0;
            const currentKey = 'Current' + key;
            const hasCurrent = Object.prototype.hasOwnProperty.call(data, currentKey);
            // 有 Current 且节点含 RightLabel/SlashSprite → 显示 base/current 分割；
            // 否则只显示 base（节点缺 right/slash 时也不能整块跳过）
            if (hasCurrent && group.right && group.slash) {
                group.left.string = String(baseValue);
                group.right.string = String(data[currentKey] ?? 0);
                group.slash.active = true;
            } else {
                group.left.string = String(baseValue);
                if (group.right) group.right.string = '';
                if (group.slash) group.slash.active = false;
            }
        }

        // 进度条
        const barKeys = [
            { key: 'HP', max: 'MaxHP', cur: 'CurrentHP' },
            { key: 'MP', max: 'MaxMP', cur: 'CurrentMP' },
            { key: 'EXP', max: 'MaxEXP', cur: 'CurrentEXP' },
        ];
        for (const item of barKeys) {
            const bar = this.mechBarMap[item.key];
            if (!bar) continue;
            const cur = Number(data[item.cur] ?? 0);
            const max = Number(data[item.max] ?? 0);
            if (bar.label) {
                bar.label.string = `${cur}/${max}`;
            }
            if (bar.bar) {
                this.setBarWidth(bar.bar, cur, max);
            }
        }
    }

    private setBarWidth(barNode: Node, cur: number, max: number): void {
        const percent = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
        const width = Math.max(1, this.ATTR_BAR_MAX_WIDTH * percent);
        const uiTrans = barNode.getComponent(UITransform);
        if (uiTrans) {
            uiTrans.setContentSize(width, uiTrans.height);
        }
    }

    private syncUnitHpToRawData(unit: BattleUnit): void {
        if (!unit || !unit.rawData) return;
        try {
            // 同步到 rawData 供 UI 读取（不强行写入缓存，避免污染其他面板的“服务器权威数据”）
            (unit.rawData as any).CurrentHP = unit.hp;
            if ((unit.rawData as any).data && typeof (unit.rawData as any).data === 'object') {
                (unit.rawData as any).data.CurrentHP = unit.hp;
            }
        } catch {}
    }

    /**
     * 把单位 MP 回写进 rawData（与 `syncUnitHpToRawData` 同构）。
     * 技能会扣蓝、吸血/回蓝会涨蓝，UI 读的是 rawData.CurrentMP，必须同步。
     */
    private syncUnitMpToRawData(unit: BattleUnit): void {
        if (!unit || !unit.rawData) return;
        try {
            (unit.rawData as any).CurrentMP = unit.mp;
            if ((unit.rawData as any).data && typeof (unit.rawData as any).data === 'object') {
                (unit.rawData as any).data.CurrentMP = unit.mp;
            }
        } catch {}
    }

    /**
     * 递归查找子节点（容错：找不到返回 null）
     */
    private findChildByName(parent: Node, name: string): Node | null {
        if (parent.name === name) return parent;
        for (const child of parent.children) {
            const found = this.findChildByName(child, name);
            if (found) return found;
        }
        return null;
    }
}

