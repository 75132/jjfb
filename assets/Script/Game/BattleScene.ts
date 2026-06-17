import { _decorator, Component, Node, Label, Button, tween, Tween, Vec3, UITransform, Sprite, SpriteAtlas, SpriteFrame, Color } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
import { RobotShow } from './RobotShow';

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
    attack: number;
    defense: number;
    initiative: number;
    petId?: string;
    rawData: any;   // 原始 robot_pet_info，用于 RobotShow
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

    // 动画控制
    private isAnimating: boolean = false;

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

    // 房间制战斗相关（默认开启，一场战斗一个房间，支持断线恢复）
    private useServerRoomBattle: boolean = true;
    private roomId: string | null = null;         // 当前战斗房间 ID（PVE 单人一房间）
    private isRequestingAction: boolean = false;  // 正在向服务器发送指令中，防止重复点击

    private currentBattleMode: 'pve' | 'pvp' = 'pve';
    private _pvpFlatMatchRequested: boolean = false;
    private _pvpFlatMatchInProgress: boolean = false;

    /** 修复点：会话标识，异步回调中校验，避免快速开关面板时旧回调覆盖新状态 */
    private _sessionId: number = 0;
    /** 修复点：重连恢复中置位，避免 onEnable 再次请求 resume 覆盖已拉取的状态 */
    private _restoringFromReconnect: boolean = false;
    /** 剧情战斗结束回调 */
    private _storyBattleCallback: ((won: boolean) => void) | null = null;
    private _storyBattleMeta: { eventId: string; battleRef: string; mapCode: string } | null = null;

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

        // 修复点：在 onLoad 绑定重连监听，断线重连后无论面板是否可见都尝试恢复战斗并刷新数据
        this._bindNetworkReconnect();

        // 注：加载时“是否在战斗中”的检测由常驻节点 Test 负责（BattleScene 面板默认隐藏时 schedule 不执行，无法在此处可靠检测）

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
        this.lastRoundPlayerAction = null;

        // 修复点：进入战斗时先隐藏操作面板，等入场动画完成或恢复房间后再显示（避免一直显示）
        if (this.battleSelectPanel) this.battleSelectPanel.active = false;
        if (this.timerRoot) this.timerRoot.active = false;

        // 修复点：重置双方机甲透明度，避免上一场击破动画（alpha=0）导致下次战斗不显示
        this.resetRobotShowOpacity(this.playerRobotShow);
        this.resetRobotShowOpacity(this.enemyRobotShow);

        // 修复点：重连/加载时由外部已拉取 state，直接应用并不再请求 resume（避免二次请求导致误创建新房间）
        if (this._restoringFromReconnect) {
            this._restoringFromReconnect = false;
            if (this._pendingRestoreState) {
                const state = this._pendingRestoreState;
                this._pendingRestoreState = null;
                this.applyServerRoomState(state, false);
                this.log('已恢复战斗连接，状态已同步');
            }
            return;
        }

        // PVP 平匹配：进入后先做匹配流程，匹配到再进入回合界面
        if (this._pvpFlatMatchRequested) {
            this._pvpFlatMatchRequested = false;
            this.startPvpFlatMatchFlow();
            return;
        }

        if (this.useServerRoomBattle) {
            this.enterBattleRoom();
            // 只对“服务端房间战斗入口”设置超时兜底
            this.unschedule(this._onBattleEnterTimeout);
            this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);
        } else {
            // 兼容旧逻辑：本地模拟一场战斗
            this.checkAndStartBattle();
        }
    }

    onDisable() {
        // 清理状态
        this.state = BattleState.FINISHED;
        this.isAnimating = false;
        this.isRequestingAction = false;
        if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
        if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false);

        // 清理事件监听
        if (this.ws) {
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onRobotPetsResponseForBattle, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfoResponseForBattle, this);
        }
        this.stopAttributeAutoRefresh();
        this.clearPlayerInfoListener();

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

        // 离开面板时不主动销毁房间，由服务器根据超时自动清理
        this.roomId = null;

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
        this._pvpFlatMatchRequested = true;
    }

    private readonly PVP_MATCH_TIMEOUT_SEC = 5;

    private startPvpFlatMatchFlow(): void {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            console.error('[BattleScene] PVP 匹配：未获取到 characterId');
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
     * 剧情战斗入口：先 story_interact 授权后，带 story_event_id 创建 PVE 房间
     */
    public startStoryBattle(opts: {
        mapCode: string;
        eventId: string;
        battleRef: string;
        onFinished: (won: boolean) => void;
    }): void {
        this._storyBattleCallback = opts.onFinished;
        this._storyBattleMeta = {
            eventId: opts.eventId,
            battleRef: opts.battleRef,
            mapCode: opts.mapCode,
        };
        this.currentBattleMode = 'pve';
        this._sessionId += 1;
        this.node.active = true;
        this._roomStateApplied = false;
        this.unschedule(this._onBattleEnterTimeout);
        this.scheduleOnce(this._onBattleEnterTimeout, this.BATTLE_ENTER_TIMEOUT_SEC);

        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            console.error('[BattleScene] 剧情战：未获取 characterId');
            opts.onFinished(false);
            return;
        }
        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_CREATE,
            {
                character_id: characterId,
                story_event_id: opts.eventId,
                map_code: opts.mapCode,
            },
            (createResp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (!createResp?.success || !createResp.data?.state) {
                    console.error('[BattleScene] 剧情战斗房间创建失败', createResp);
                    this._storyBattleCallback?.(false);
                    this._storyBattleCallback = null;
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
     * 进入房间制战斗：
     * - 先尝试 resume（恢复进行中的战斗）
     * - 没有房间时再创建一场新的 PVE 房间
     */
    private enterBattleRoom() {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法进入战斗房间');
            return;
        }

        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_RESUME,
            { character_id: characterId },
            (resp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                // 只有服务器仍在战斗中才恢复；掉线期间战斗已结束则不再拉入房间，走创建新局
                if (resp?.success && resp.data?.has_room && resp.data.state && resp.data.state.status === 'in_progress') {
                    // 恢复已有房间：isNewRoom = false，直接设置到战斗位置
                    this.applyServerRoomState(resp.data.state, false);
                    return;
                }
                // 没有进行中的房间（或房间已结束），创建一场新的战斗
                this.ws.request(
                    GameConfig.MESSAGE_TYPES.BATTLE_ROOM_CREATE,
                    { character_id: characterId },
                    (createResp: any) => {
                        if (!this.node?.isValid || this._sessionId !== sessionId) return;
                        if (!createResp?.success || !createResp.data?.state) {
                            console.error('[BattleScene] 创建战斗房间失败:', createResp?.message || createResp);
                            // PvE：数据异常/没有机甲，进入房间不应继续卡在面板里
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
                        // 新创建房间：isNewRoom = true，播放入场动画
                        this.applyServerRoomState(createResp.data.state, true);
                    },
                    true,
                    10000
                );
            },
            true,
            8000
        );
    }

    /**
     * 修复点：断线重连恢复战斗——重连后若服务器仍在战斗中，立即恢复战斗场景并刷新最新数据。
     * 不依赖 roomId 与面板是否打开：仅凭 character_id 向服务器 resume，有房间则展示面板并应用 state。
     */
    private _onNetworkReconnect = (): void => {
        if (!this.node?.isValid || !this.ws) return;
        if (!this.useServerRoomBattle) return;
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) return;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_RESUME,
            { character_id: characterId },
            (resp: any) => {
                if (!this.node?.isValid) return;
                if (!resp?.success || !resp.data?.has_room || !resp.data.state) return;
                // 只有服务器仍在战斗中才恢复；掉线期间战斗已自动结束则不再拉入房间
                if (resp.data.state.status !== 'in_progress') return;
                // 立即恢复战斗场景（可能之前被关掉），再应用最新房间状态；置位避免 onEnable 内再次 resume
                this._restoringFromReconnect = true;
                this.node.active = true;
                this.applyServerRoomState(resp.data.state, false);
                this.log('已恢复战斗连接，状态已同步');
            },
            true,
            6000
        );
    };

    private _bindNetworkReconnect(): void {
        this._unbindNetworkReconnect();
        const node = (this.ws as any)?.node;
        if (node && typeof node.on === 'function') {
            node.on('network_connect', this._onNetworkReconnect, this);
        }
    }

    private _unbindNetworkReconnect(): void {
        const node = (this.ws as any)?.node;
        if (node && typeof node.off === 'function') {
            node.off('network_connect', this._onNetworkReconnect, this);
        }
    }

    /**
     * 由 Test 等外部在打开面板前调用：注入已拉取的 resume state，打开后面板 onEnable 内会直接应用该 state，
     * 不再请求 resume/创建新房间，避免“先空场景再变成新房间”的问题。
     */
    public prepareRestoreState(state: any): void {
        this._pendingRestoreState = state;
        this._restoringFromReconnect = true;
    }

    /**
     * 将服务器房间状态映射到本地 BattleScene（HP/属性/UI）
     * @param state 服务器返回的房间状态
     * @param isNewRoom 是否是新创建的房间（true=新房间需要播放动画，false=恢复房间直接设置位置）
     * @param forRoundAnimation 若为 true：仅同步单位/展示数据，不调用 finishBattle、不显示操作面板（用于本回合动画播完后再收尾）
     */
    private applyServerRoomState(state: any, isNewRoom: boolean = false, forRoundAnimation: boolean = false) {
        if (!state) return;

        // 根据服务器返回的模式切换：PVP 可能需要更长的 action 等待时间（双方都提交完才结算）
        this.currentBattleMode = state?.mode === 'pvp' ? 'pvp' : 'pve';

        this.roomId = state.room_id || state.roomId || null;

        // 修复点：应用进行中房间状态前清空战斗日志，避免上一场「玩家胜利/失败」残留导致误以为「直接胜利/击败」
        if (state.status !== 'finished') {
            this.logClear();
        }

        const playerActor = state.player;
        const enemyActor = state.enemy;
        if (!playerActor || !enemyActor) {
            console.error('[BattleScene] 房间状态缺少 player/enemy');
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

        // 覆盖实时 HP / 攻防 / 出手值
        if (this.playerUnit) {
            this.playerUnit.maxHp = Number(playerActor.max_hp ?? playerActor.maxHp ?? this.playerUnit.maxHp);
            this.playerUnit.hp = Number(playerActor.hp ?? this.playerUnit.hp);
            this.playerUnit.attack = Number(playerActor.attack ?? this.playerUnit.attack);
            this.playerUnit.defense = Number(playerActor.defense ?? this.playerUnit.defense);
            this.playerUnit.initiative = Number(playerActor.initiative ?? this.playerUnit.initiative);
        }
        if (this.enemyUnit) {
            this.enemyUnit.maxHp = Number(enemyActor.max_hp ?? enemyActor.maxHp ?? this.enemyUnit.maxHp);
            this.enemyUnit.hp = Number(enemyActor.hp ?? this.enemyUnit.hp);
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

            // 修复点：恢复战斗时使用服务器剩余时间，不重置为 30 秒（支持多种字段名与回合开始时间推算）
            let remainingSec = this._getRemainingCommandSecondsFromState(state);
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
    private refreshBattleBarsVisibilityAndValue(): void {
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
     * 直接将机甲设置到战斗位置（用于恢复房间时，不需要动画）
     */
    private setBattlePositionsDirectly() {
        const playerNode = this.playerRobotShow?.node;
        const enemyNode = this.enemyRobotShow?.node;
        if (!playerNode || !enemyNode) return;

        // 确保位置已缓存
        this.cacheEntranceAndBattlePositionsIfNeeded();
        if (!this.battlePlayerPos || !this.battleEnemyPos) {
            console.warn('[BattleScene] 战斗位置未缓存，使用默认位置');
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

    /**
     * 检查缓存并开始战斗（如果缓存为空则先请求数据）
     */
    private checkAndStartBattle() {
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) {
            console.error('[BattleScene] 未获取到 characterId，无法开始战斗');
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
            console.log('[BattleScene] 机甲列表缓存为空，正在请求数据...');
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
            console.error('[BattleScene] 未获取到 characterId，无法请求机甲列表');
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

        console.log('[BattleScene] 已发送机甲列表请求，等待响应...');
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
            console.error('[BattleScene] 获取机甲列表失败:', data.message || data.data?.message || '未知错误');
            return;
        }

        // 更新缓存
        const characterId = this.ws.getCharacterId?.();
        if (characterId) {
            this.cacheManager.setRobotPetsCache(characterId, data);
        }

        console.log('[BattleScene] 机甲列表数据已更新，开始战斗');
        // 数据已更新，开始战斗
        this.startNewBattle();
    };

    private startNewBattle() {
        this.logClear();
        this.state = BattleState.INIT;
        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        this.updateTimerLabel();

        // 每次开战都先把双方位置重置到入场起点
        this.resetEntrancePositions();

        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = false; // 初始先隐藏，等轮到玩家时再显示
        }

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
            console.error('[BattleScene] 双方单位未完全初始化，无法开始战斗');
            return;
        }

        // 进入"指令选择阶段"：双方都需要先选择（目前敌方默认普攻）
        this.log('战斗开始！进入指令选择阶段（双方先选，再按出手值结算）');

        // 通知服务器一场战斗开始（先用于日志，后续可扩展为真正战斗接口）
        try {
            this.ws.send(
                {
                    type: 'battle_start',
                    player: this.buildUnitSummary(this.playerUnit),
                    enemy: this.buildUnitSummary(this.enemyUnit),
                } as any,
                true,
            );
        } catch (e) {
            console.warn('[BattleScene] 发送 battle_start 失败:', e);
        }

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
            console.warn('[BattleScene] 入场动画：缺少 RobotShow 节点，跳过动画直接开始战斗');
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
            if (playerAnimDone && enemyAnimDone) {
                // 动画完成，开始第一回合的指令选择
                this.startCommandPhase();
            }
        };

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
            console.error('[BattleScene] 未获取到 characterId，无法初始化玩家单位');
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

        if (!pets || pets.length === 0) {
            console.error('[BattleScene] 机甲列表缓存为空，无法初始化玩家单位');
            return;
        }

        // 出战队伍改为服务器权威：先拉取，再决定使用哪台机甲（当前只取第一位主战）
        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.GET_BATTLE_TEAM,
            { character_id: characterId },
            (resp: any) => {
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                let battleTeam: string[] = [];
                if (resp && resp.success === true && resp.data && Array.isArray(resp.data.battle_team)) {
                    battleTeam = resp.data.battle_team.map((x: any) => String(x)).filter((x: string) => x);
                }

                // 优先使用出战队伍第一位，否则回退列表第一位
                let firstPet: any = null;
                let petId: string = '';
                if (battleTeam.length > 0) {
                    const battlePetId = battleTeam[0];
                    firstPet = pets.find(p => String(p.pet_id || p._id || p.id || '') === battlePetId);
                    if (firstPet) {
                        petId = battlePetId;
                        console.log(`[BattleScene] 使用服务器出战队伍第一位机甲: ${petId}`);
                    }
                }

                if (!firstPet || !petId) {
                    firstPet = pets[0];
                    petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');
                    if (!petId) {
                        console.error('[BattleScene] 第一个机甲缺少 pet_id，无法初始化玩家单位');
                        return;
                    }
                }

                // 从机甲详情缓存中读取属性（MechAttributeTEST 已经在查看详情时写入）
                let info = this.cacheManager.getRobotPetInfoCache(petId);
                if (!info) {
                    console.warn('[BattleScene] 未找到机甲详情缓存，正在请求详情数据...');
                    this.requestRobotPetInfoAndInit(petId, firstPet);
                    return;
                } else if (info.data) {
                    info = info.data;
                }

                this.playerUnit = this.buildUnitFromRobotInfo('player', petId, info, '玩家机甲');

                // 更新展示（RobotShow）
                if (this.playerRobotShow && info) {
                    try {
                        const dataForShow = { ...info, pet_id: petId };
                        this.playerRobotShow.updateFromRobotData(dataForShow);
                    } catch (e) {
                        console.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
                    }
                }

                // ✅ 战斗机甲属性面板：初始化 + 立刻刷新（只显示当前出场机甲）
                this.ensureMechAttributeInited();
                this.refreshPlayerMechAttributeUI(true);
                this.startAttributeAutoRefresh();

                // ✅ Player1 图标：按机甲类型切换 gedou/sheji/quanneng
                const classValue = Number((info as any)?.Class ?? (info as any)?.data?.Class ?? 1);
                this.updatePlayer1ClassIcon(classValue);

                // 玩家准备好后再生成敌人（敌人依赖 playerUnit.petId）
                this.initEnemyUnit();
            },
            true,
            5000
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

        console.log(`[BattleScene] 已发送机甲详情请求 (pet_id: ${petId})，等待响应...`);
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
            console.error('[BattleScene] 获取机甲详情失败:', data.message || data.data?.message || '未知错误');
            // 失败时使用列表中的基础数据
            this.initPlayerUnitWithFallback();
            return;
        }

        // 更新缓存
        const petId = data.pet_id ?? data.data?.pet_id;
        if (petId) {
            this.cacheManager.setRobotPetInfoCache(String(petId), data);
        }

        console.log('[BattleScene] 机甲详情数据已更新，重新初始化玩家单位');
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
        let pets: any[] = [];
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

        const firstPet = pets[0];
        const petId = String(firstPet.pet_id || firstPet._id || firstPet.id || '');
        if (!petId) {
            return;
        }

        console.warn('[BattleScene] 使用列表中的基础数据构建玩家单位（可能缺少完整属性）');
        this.playerUnit = this.buildUnitFromRobotInfo('player', petId, firstPet, '玩家机甲');

        // 更新展示
        if (this.playerRobotShow) {
            try {
                const dataForShow = { ...firstPet, pet_id: petId };
                this.playerRobotShow.updateFromRobotData(dataForShow);
            } catch (e) {
                console.error('[BattleScene] 更新玩家 RobotShow 失败:', e);
            }
        }

        // 备用数据也尽量刷新属性面板与图标
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
            console.error('[BattleScene] 玩家单位未初始化，无法构建敌人单位');
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
                    console.error('[BattleScene] 生成敌人失败:', resp?.message || resp?.error || resp);
                    return;
                }
                const enemy = resp.enemy || resp.data?.enemy || null;
                if (!enemy) {
                    console.error('[BattleScene] 生成敌人失败：响应缺少 enemy 字段', resp);
                    return;
                }

                // 构建敌方单位（攻击/防御/initiative 用 Current* 优先）
                const melee = Number(enemy.CurrentMelee ?? enemy.Melee ?? 0);
                const shoot = Number(enemy.CurrentShooting ?? enemy.Shooting ?? 0);
                const armor = Number(enemy.CurrentArmor ?? enemy.Armor ?? 0);
                const maxHp = Number(enemy.MaxHP ?? 1000);
                const hp = Number(enemy.CurrentHP ?? maxHp);
                const initiative = Number(enemy.CurrentInitiative ?? enemy.Initiative ?? 10);

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
                    rawData: enemy,
                };

                // 更新敌方展示（含满装备）
                if (this.enemyRobotShow) {
                    try {
                        this.enemyRobotShow.updateFromRobotData(enemy);
                    } catch (e) {
                        console.error('[BattleScene] 更新敌人 RobotShow 失败:', e);
                    }
                }

                // ✅ 敌人已生成：如果当前还在 INIT（或刚启动战斗），立即进入指令选择阶段
                // 这样操作面板/倒计时必然会出现
                if (this.state === BattleState.INIT && this.playerUnit && this.enemyUnit) {
                    this.beginBattleAfterReady();
                }
            },
            true,
            10000
        );
    }

    private buildUnitFromRobotInfo(side: Side, petId: string, info: any, defaultName: string): BattleUnit {
        const name = info?.RobotName || info?.name || defaultName;
        const level = Number(info?.Level || info?.level || 1);

        // 属性字段命名尽量兼容现有 MechAttributeTEST 使用的键
        const maxHp = Number(info?.MaxHP ?? info?.max_hp ?? info?.hp ?? 100);
        const hp = Number(info?.CurrentHP ?? info?.current_hp ?? maxHp);
        const melee = Number(info?.Melee ?? info?.melee ?? 0);
        const shoot = Number(info?.Shooting ?? info?.shoot ?? 0);
        const armor = Number(info?.Armor ?? info?.armor ?? 0);

        const attack = melee + shoot;
        const defense = armor;
        const initiative = Number(info?.Initiative ?? info?.initiative ?? 10);

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
            rawData: info,
        };
    }

    private determineFirstTurn() {
        if (!this.playerUnit || !this.enemyUnit) return;
        // 保留方法：用于回合结算时决定出手顺序（不再用于“是否立即行动”）
    }

    /**
     * 指令选择阶段：双方都先选指令（当前敌方默认普攻，但不会提前出手）
     */
    private startCommandPhase() {
        if (this.state === BattleState.FINISHED) return;
        this.state = BattleState.WAITING_COMMANDS;
        this.pendingPlayerAction = null;
        // 敌方 AI：默认普攻（后续可扩展技能/物品）
        this.pendingEnemyAction = { side: 'enemy', type: 'ATTACK' };

        this.turnTimeLeft = this.TURN_TIME_LIMIT;
        this.updateTimerLabel();

        if (this.battleSelectPanel) {
            this.battleSelectPanel.active = true;
        }
        this.setButtonsInteractable(true);
        this.refreshBattleBarsVisibilityAndValue();
        this.log('请选择指令（普攻 / 逃跑）。30 秒未操作则自动选择普攻。');
    }

    update(dt: number) {
        if (this.state === BattleState.WAITING_COMMANDS) {
            this.turnTimeLeft -= dt;
            if (this.turnTimeLeft <= 0) {
                this.turnTimeLeft = 0;
                this.updateTimerLabel();
                // 超时自动普攻（仅触发一次）
                if (!this.isAnimating) {
                    if (this.useServerRoomBattle && this.roomId) {
                        this.log('超时未操作，自动选择普攻');
                        this.sendBattleRoomAction('ATTACK');
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

    private updateTimerLabel() {
        if (!this.timerLabel) return;
        this.timerLabel.string = `${Math.ceil(this.turnTimeLeft)}`;
        // 在等待指令阶段显示倒计时
        if (this.timerRoot) {
            this.timerRoot.active = this.state === BattleState.WAITING_COMMANDS;
        }
    }

    private setButtonsInteractable(enable: boolean) {
        if (this.attackButton) this.attackButton.interactable = enable;
        if (this.defendButton) this.defendButton.interactable = enable;
        if (this.escapeButton) this.escapeButton.interactable = enable;
        if (this.backButton) this.backButton.interactable = enable;
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

    /**
     * 房间制：向服务器提交一次指令，并用返回的新 state 刷新 UI + 播放本地动画
     * 伤害和胜负全部以服务器为准，本地只负责表现。
     */
    private sendBattleRoomAction(action: ActionType) {
        if (!this.roomId || this.isRequestingAction) return;
        const characterId = this.ws.getCharacterId?.();
        if (!characterId) return;

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
        // 修复点：提交指令时关闭操作面板，与本地模式 tryResolveRound 行为一致，避免动画期间面板仍显示
        if (this.battleSelectPanel) this.battleSelectPanel.active = false;

        const sessionId = this._sessionId;
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BATTLE_ROOM_ACTION,
            {
                room_id: this.roomId,
                action_type: action,
                character_id: characterId,
            },
            (resp: any) => {
                this.isRequestingAction = false;
                if (!this.node?.isValid || this._sessionId !== sessionId) return;
                if (!resp?.success || !resp.data?.state) {
                    console.error('[BattleScene] battle_room_action 失败:', resp?.message || resp);
                    this.setButtonsInteractable(true);
                    // 修复点：请求失败时恢复操作面板显示，便于玩家重试
                    if (this.battleSelectPanel) this.battleSelectPanel.active = true;
                    return;
                }

                const state = resp.data.state;
                const playerActor = state.player;
                const enemyActor = state.enemy;

                // 服务器结算后的最终 HP
                const targetPlayerHp = Number(playerActor?.hp ?? this.playerUnit?.hp ?? 0);
                const targetEnemyHp = Number(enemyActor?.hp ?? this.enemyUnit?.hp ?? 0);

                // 修复点：只同步单位/展示数据，不调 finishBattle、不显示面板；击杀时先播完本回合双方动画，再在 playServerRoundAnimation 收尾时调 finishBattle
                this.applyServerRoomState(state, false, true);

                if (!this.playerUnit || !this.enemyUnit || this.lastRoundPlayerAction == null) {
                    return; // 缺快照或单位，直接用静态 UI
                }

                // 按服务器结果计算本回合掉血量（不能为负）
                const damageToPlayer = Math.max(0, this.lastRoundPlayerHp - targetPlayerHp);
                const damageToEnemy = Math.max(0, this.lastRoundEnemyHp - targetEnemyHp);

                // 为了播动画，把本地 HP 暂时“回滚”到回合开始前
                this.playerUnit.hp = this.lastRoundPlayerHp;
                this.enemyUnit.hp = this.lastRoundEnemyHp;
                this.syncUnitHpToRawData(this.playerUnit);
                this.syncUnitHpToRawData(this.enemyUnit);
                this.refreshPlayerMechAttributeUI(true);

                // 用服务器伤害驱动一轮动画，播完再落到服务器最终 HP
                this.playServerRoundAnimation(
                    this.lastRoundPlayerAction,
                    damageToPlayer,
                    damageToEnemy,
                    targetPlayerHp,
                    targetEnemyHp,
                    state,
                );
            },
            true,
            this.currentBattleMode === 'pvp' ? 35000 : 10000
        );
    }

    private onBackClicked() {
        // 只在指令选择阶段允许开关面板
        if (this.state !== BattleState.WAITING_COMMANDS) return;
        if (!this.battleSelectPanel) return;
        this.battleSelectPanel.active = !this.battleSelectPanel.active;
    }

    // ========== 战斗核心 ==========

    private getUnit(side: Side): BattleUnit | null {
        return side === 'player' ? this.playerUnit : this.enemyUnit;
    }

    private getOpponent(side: Side): BattleUnit | null {
        return side === 'player' ? this.enemyUnit : this.playerUnit;
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
        defender.hp = Math.max(0, defender.hp - damage);
        this.syncUnitHpToRawData(defender);
        // 只在“玩家机甲”受伤时刷新属性面板（敌方不显示面板）
        if (defender.side === 'player') {
            this.refreshPlayerMechAttributeUI(true);
        }

        this.log(
            `${attackerSide === 'player' ? '玩家' : '敌人'} 普攻造成 ${damage} 点伤害（攻击 ${attacker.attack} - 防御 ${defender.defense}）`
        );

        // 判定是否为“远程攻击”（是否装备枪械）
        const attackerEquip = attacker.rawData?.equipment || attacker.rawData?.data?.equipment || {};
        const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);

        // 播放攻击动画（根据是否有枪械区分远程/近战）
        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;
        this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, () => {
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
        });
    }

    /** 关闭面板后延迟多久再开始动作（秒），提升“点击→收面板→再开打”的节奏感 */
    private readonly ACTION_DELAY_AFTER_PANEL_CLOSE = 1.0;

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
        };

        // 执行先手/后手
        runAction(order[0], () => {
            if (this.state === BattleState.FINISHED) return;
            this.scheduleOnce(() => {
                if (this.state === BattleState.FINISHED) return;
                runAction(order[1], () => {
                    if (this.state === BattleState.FINISHED) return;

                    // 动画播完后，将 HP 校准到服务器最终值
                    if (this.playerUnit) {
                        this.playerUnit.hp = targetPlayerHp;
                        this.syncUnitHpToRawData(this.playerUnit);
                    }
                    if (this.enemyUnit) {
                        this.enemyUnit.hp = targetEnemyHp;
                        this.syncUnitHpToRawData(this.enemyUnit);
                    }
                    this.refreshPlayerMechAttributeUI(true);

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
            }, 1.0);
        });
    }

    /**
     * 在线模式专用：按服务器给定伤害值播放一次攻击动画（不再用本地公式算伤害）。
     * 流程：先播攻击动画 → 动画结束后扣血、弹出伤害数字 → 延迟后再更新血条（敌我都等伤害数字弹出后再改）。
     */
    private performAttackWithDamage(attackerSide: Side, damage: number, onDone: () => void) {
        const attacker = this.getUnit(attackerSide);
        const defender = this.getOpponent(attackerSide);
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

        this.log(
            `${attackerSide === 'player' ? '玩家' : '敌人'} 造成 ${damage} 点伤害（按服务器结果）`
        );

        const attackerShow = attackerSide === 'player' ? this.playerRobotShow : this.enemyRobotShow;
        const defenderShow = attackerSide === 'player' ? this.enemyRobotShow : this.playerRobotShow;

        // 是否远程：沿用原来判断
        const attackerEquip = attacker.rawData?.equipment || attacker.rawData?.data?.equipment || {};
        const attackerHasGun = !!(attackerEquip && attackerEquip.Gun && attackerEquip.Gun.item_id);

        this.playAttackAnimation(attackerShow, defenderShow, attackerHasGun, () => {
            this.isAnimating = false;
            // 动画结束后再扣血、弹伤害数字（此时不刷新任何血条，等伤害数字一起）
            defender.hp = Math.max(0, defender.hp - damage);
            this.syncUnitHpToRawData(defender);
            if (defenderShow) {
                defenderShow.showDamageNumber(damage, false);
            }
            // 等伤害数字弹出后，上面战斗血条和底下属性面板血条一起更新，再结束本动作
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

    private playAttackAnimation(
        attackerShow: RobotShow | null,
        defenderShow: RobotShow | null,
        isRanged: boolean,
        onComplete: () => void
    ) {
        const attackerNode: Node | null = attackerShow?.node || null;
        const defenderNode: Node | null = defenderShow?.node || null;

        if (!attackerNode || !defenderNode) {
            console.warn('[BattleScene] 攻击动画：缺少 RobotShow 节点，跳过动画');
            onComplete();
            return;
        }

        const attackerStart = attackerNode.position.clone();
        const defenderStart = defenderNode.position.clone();

        // 敌人被击退方向：始终远离攻击方
        const attackerOnLeft = attackerNode.worldPosition.x < defenderNode.worldPosition.x;
        const knockbackDelta = attackerOnLeft ? 30 : -30; // 击退 30 像素
        const knockbackPos = new Vec3(defenderStart.x + knockbackDelta, defenderStart.y, defenderStart.z);

        // 为了避免双方动作重叠，这里统一用“全部 tween 结束后再回调”的计数逻辑
        let activeTweens = 0;
        const onTweenStart = () => {
            activeTweens += 1;
        };
        const onTweenDone = () => {
            activeTweens -= 1;
            if (activeTweens <= 0) {
                // 所有本次攻击相关的 tween 都完成，才能开始下一方行为
                onComplete();
            }
        };

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
                .to(0.12, { position: defenderStart })
                .call(onTweenDone)
                .start();
            return;
        }

        // 近战：攻击方瞬移到对方面前（间隔 30 的 X），两者一起产生击退/拉回效果，然后攻击方快速回位
        const meleeGap = 30;
        const meleeContactX = attackerOnLeft
            ? defenderStart.x - meleeGap
            : defenderStart.x + meleeGap;
        const meleeContactPos = new Vec3(meleeContactX, attackerStart.y, attackerStart.z);

        // 瞬移到近战位置
        attackerNode.setPosition(meleeContactPos);

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
        if (this.playerRobotShow) this.playerRobotShow.setBattleBarsVisible(false);
        if (this.enemyRobotShow) this.enemyRobotShow.setBattleBarsVisible(false);

        const result = {
            type: winner === 'player' ? 'win' : 'lose',
            reason,
        };

        // 通知服务器战斗结果（当前仅用于记录日志）
        try {
            this.ws.send(
                {
                    type: 'battle_result',
                    winner: winner === 'player' ? 'player' : 'enemy',
                    reason,
                    player: this.playerUnit ? this.buildUnitSummary(this.playerUnit) : null,
                    enemy: this.enemyUnit ? this.buildUnitSummary(this.enemyUnit) : null,
                } as any,
                true,
            );
        } catch (e) {
            console.warn('[BattleScene] 发送 battle_result 失败:', e);
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
            console.warn('[BattleScene] 战斗结束刷新缓存/拉取失败:', e);
        }

        this.log(`战斗结束：${result.type === 'win' ? '玩家胜利' : '玩家失败'}（原因：${reason === 'ko' ? '击倒' : '逃跑'}）`);

        const storyCb = this._storyBattleCallback;
        const won = winner === 'player';
        if (storyCb) {
            this._storyBattleCallback = null;
            this._storyBattleMeta = null;
            storyCb(won);
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
        console.log('[BattleScene]', msg);
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
    // 新增：PlayerShow / EnemyPlayerShow（角色形象+名字）
    // =========================

    private refreshPlayerAndEnemyShows(): void {
        // 玩家：必须与玩家数据一致（get_player / is_self=true）
        this.refreshPlayerShowFromServer();
        // 敌人：暂时随机
        this.refreshEnemyShowRandom();
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
            'Block', 'ParticleShield', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'
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
            if (Object.prototype.hasOwnProperty.call(data, currentKey)) {
                group.left.string = String(baseValue);
                if (group.right) group.right.string = String(data[currentKey] ?? 0);
                if (group.slash) group.slash.active = true;
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

