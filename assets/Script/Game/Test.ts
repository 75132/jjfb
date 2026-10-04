import { _decorator, Component, Node, Button, EventTouch, Vec3, UITransform } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameCommonData } from './GameCommonData';
import { BattleScene } from './BattleScene';
import { Logger } from '../global/Logger';

const { ccclass, property } = _decorator;

/**
 * Test - 测试脚本（可拖动，点击切换面板）
 * 职责：
 * - 提供可拖动的测试按钮
 * - 点击切换GameTest面板显示/隐藏
 * - 提供加经验等测试功能
 * 设计原则：纯测试功能，便于调试
 */
@ccclass('Test')
export class Test extends Component {
    @property(Button)
    clearTokenBtn: Button = null!;

    @property(Button)
    clearUserIdBtn: Button = null!;

    @property(Button)
    clearCharacterIdBtn: Button = null!;

    @property(Button)
    logInfoBtn: Button = null!;

    @property({ type: Node, tooltip: 'GameTest面板节点（用于显示/隐藏）' })
    gameTestPanel: Node = null!;

    @property({ type: Button, tooltip: '加经验按钮（在GameTest面板内）' })
    addExpBtn: Button = null!;

    @property({ type: Button, tooltip: '升级所有机甲按钮（在GameTest面板内）' })
    upgradeAllRobotsBtn: Button = null!;

    @property({ type: Button, tooltip: '启动战斗按钮' })
    startBattleBtn: Button = null!;

    @property({ type: Button, tooltip: '进入平匹配按钮（PVP）' })
    pvpMatchBtn: Button | null = null;

    @property({ type: Node, tooltip: 'BattleScene 战斗场景面板节点' })
    battleScenePanel: Node = null!;

    private isDragging: boolean = false;
    private hasMoved: boolean = false;  // 记录是否真的移动了
    private isClick: boolean = false;  // 记录是否是点击（不是拖动）
    private dragOffset: Vec3 = new Vec3();
    private panelVisible: boolean = false;

    start() {
        Logger.debug('🧪 测试脚本启动');
        
        // 初始化面板状态
        if (this.gameTestPanel) {
            this.panelVisible = this.gameTestPanel.active;
        }
        
        // 绑定按钮事件
        this.bindButtonEvents();
        
        // 设置拖动功能
        this.setupDrag();
        
        // 监听GameCommonData的数据更新事件
        this.setupDataListener();

        // 战斗自动恢复已迁移至 BattleResumeController（生产入口），Test 不再 resume / 打开战斗面板
    }

    /**
     * 设置拖动功能
     */
    private setupDrag(): void {
        // 监听触摸开始
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        // 监听触摸移动
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        // 监听触摸结束
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        // 监听触摸取消
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        // 如果节点有 Button 组件，使用按钮点击事件来切换面板
        // 这样可以避免触摸事件被 Button 拦截的问题
        const button = this.node.getComponent(Button);
        if (button) {
            // 监听按钮点击事件
            button.node.on(Button.EventType.CLICK, this.onNodeButtonClick, this);
        }
    }
    
    /**
     * 节点按钮点击事件（用于切换面板）
     */
    private onNodeButtonClick(): void {
        // 检查是否是点击（不是拖动）
        // 延迟检查，确保触摸事件已经处理完成
        this.scheduleOnce(() => {
            if (this.isClick && !this.hasMoved) {
                this.togglePanel();
            }
            // 重置标志
            this.isClick = false;
        }, 0.05);
    }

    /**
     * 触摸开始
     */
    private onTouchStart(event: EventTouch): void {
        this.isDragging = true;
        this.hasMoved = false;  // 重置移动标志
        this.isClick = true;  // 初始认为是点击
        const touchPos = event.getUILocation();
        const worldPos = new Vec3(touchPos.x, touchPos.y, 0);
        const localPos = new Vec3();
        this.node.getComponent(UITransform)?.convertToNodeSpaceAR(worldPos, localPos);
        this.dragOffset = localPos;
    }

    /**
     * 触摸移动（拖动）
     */
    private onTouchMove(event: EventTouch): void {
        if (!this.isDragging) return;
        
        const touchPos = event.getUILocation();
        const worldPos = new Vec3(touchPos.x, touchPos.y, 0);
        const localPos = new Vec3();
        const parent = this.node.parent;
        if (parent) {
            parent.getComponent(UITransform)?.convertToNodeSpaceAR(worldPos, localPos);
            this.node.setPosition(localPos);
            this.hasMoved = true;  // 标记为已移动
            this.isClick = false;  // 移动了就不是点击
        }
    }

    /**
     * 触摸结束
     */
    private onTouchEnd(event: EventTouch): void {
        // 如果节点没有 Button 组件，直接在这里处理点击切换
        const button = this.node.getComponent(Button);
        if (!button && this.isClick && !this.hasMoved) {
            this.togglePanel();
        }
        
        // 延迟重置状态，确保 Button 点击事件能检查到
        this.scheduleOnce(() => {
            this.isDragging = false;
            this.hasMoved = false;
        }, 0.1);
    }

    /**
     * 切换面板显示/隐藏
     */
    private togglePanel(): void {
        if (!this.gameTestPanel) {
            Logger.warn('⚠️ GameTest面板未绑定');
            return;
        }
        
        this.panelVisible = !this.panelVisible;
        this.gameTestPanel.active = this.panelVisible;
        Logger.debug(`🧪 GameTest面板已${this.panelVisible ? '显示' : '隐藏'}`);
    }

    /**
     * 设置数据监听（监听GameCommonData的数据更新）
     */
    private setupDataListener(): void {
        if (GameCommonData.instance) {
            GameCommonData.instance.node.on('data_updated', this.onDataUpdated, this);
        } else {
            // 延迟设置
            this.scheduleOnce(() => {
                if (GameCommonData.instance) {
                    GameCommonData.instance.node.on('data_updated', this.onDataUpdated, this);
                }
            }, 0.1);
        }
    }

    /**
     * 处理数据更新事件
     */
    private onDataUpdated = (data: { level: number; totalExp: number; roleName: string; levelUpCount?: number }): void => {
        // 输出等级和经验信息
        this.logExpInfo();
    }

    /**
     * 绑定按钮事件
     */
    private bindButtonEvents(): void {
        // 清除Token按钮
        if (this.clearTokenBtn) {
            this.clearTokenBtn.node.on(Button.EventType.CLICK, this.onClearTokenClick, this);
            Logger.debug('✅ 清除Token按钮事件已绑定');
        }

        // 清除用户ID按钮
        if (this.clearUserIdBtn) {
            this.clearUserIdBtn.node.on(Button.EventType.CLICK, this.onClearUserIdClick, this);
            Logger.debug('✅ 清除用户ID按钮事件已绑定');
        }

        // 清除角色ID按钮
        if (this.clearCharacterIdBtn) {
            this.clearCharacterIdBtn.node.on(Button.EventType.CLICK, this.onClearCharacterIdClick, this);
            Logger.debug('✅ 清除角色ID按钮事件已绑定');
        }

        // 输出信息按钮
        if (this.logInfoBtn) {
            this.logInfoBtn.node.on(Button.EventType.CLICK, this.onLogInfoClick, this);
            Logger.debug('✅ 输出信息按钮事件已绑定');
        }

        // 加经验按钮
        if (this.addExpBtn) {
            this.addExpBtn.node.on(Button.EventType.CLICK, this.onAddExpClick, this);
            Logger.debug('✅ 加经验按钮事件已绑定');
        }

        // 升级所有机甲按钮
        if (this.upgradeAllRobotsBtn) {
            this.upgradeAllRobotsBtn.node.on(Button.EventType.CLICK, this.onUpgradeAllRobotsClick, this);
            Logger.debug('✅ 升级所有机甲按钮事件已绑定');
        }

        // 启动战斗按钮
        if (this.startBattleBtn) {
            this.startBattleBtn.node.on(Button.EventType.CLICK, this.onStartBattleClick, this);
            Logger.debug('✅ 启动战斗按钮事件已绑定');
        }

        // 平匹配按钮
        if (this.pvpMatchBtn) {
            this.pvpMatchBtn.node.on(Button.EventType.CLICK, this.onPvpMatchClick, this);
            Logger.debug('✅ 平匹配按钮事件已绑定');
        }
    }

    /**
     * 平匹配按钮点击事件：进入 BattleScene，并让 BattleScene 自己发起匹配（显示 Loading，5 秒超时退出）
     */
    private onPvpMatchClick(): void {
        Logger.debug('🆚 测试：进入平匹配（PVP）');

        if (!this.battleScenePanel) {
            Logger.error('❌ BattleScene 面板未绑定');
            return;
        }

        const battleScene = this.battleScenePanel.getComponent(BattleScene);
        if (!battleScene) {
            Logger.error('❌ BattleScene 组件未找到');
            return;
        }

        // 先请求匹配，再打开面板（BattleScene 的 onEnable 会接管匹配流程）
        battleScene.requestPvpFlatMatch();
        this.battleScenePanel.active = true;
    }

    /**
     * 清除Token按钮点击事件
     */
    private onClearTokenClick(): void {
        Logger.debug('🧪 测试：清除Token');
        
        try {
            const wsManager = WebSocketManager.getInstance();
            
            // 发送登出消息到服务器
            wsManager.send({
                type: 'logout',
                token: wsManager.getToken()
            }, false);

            // 清除本地Token
            wsManager.clearToken();
            
            Logger.debug('✅ Token已清除');
            Logger.debug('📋 当前状态:');
            this.logCurrentStatus();
            
            // 注意：不需要手动触发，WebSocketManager.clearToken()会自动触发data_changed事件
            
        } catch (error) {
            Logger.error('❌ 清除Token失败:', error);
        }
    }

    /**
     * 清除用户ID按钮点击事件
     */
    private onClearUserIdClick(): void {
        Logger.debug('🧪 测试：清除用户ID');
        
        try {
            const wsManager = WebSocketManager.getInstance();
            
            // 清除用户ID
            wsManager.clearUserId();
            
            Logger.debug('✅ 用户ID已清除');
            Logger.debug('📋 当前状态:');
            this.logCurrentStatus();
            
            // 注意：不需要手动触发，WebSocketManager.clearUserId()会自动触发data_changed事件
            
        } catch (error) {
            Logger.error('❌ 清除用户ID失败:', error);
        }
    }

    /**
     * 清除角色ID按钮点击事件
     */
    private onClearCharacterIdClick(): void {
        Logger.debug('🧪 测试：清除角色ID');
        
        try {
            const wsManager = WebSocketManager.getInstance();
            
            // 清除角色ID
            wsManager.clearCharacterId();
            
            Logger.debug('✅ 角色ID已清除');
            Logger.debug('📋 当前状态:');
            this.logCurrentStatus();
            
            // 注意：不需要手动触发，WebSocketManager.clearCharacterId()会自动触发data_changed事件
            
        } catch (error) {
            Logger.error('❌ 清除角色ID失败:', error);
        }
    }


    /**
     * 输出信息按钮点击事件
     */
    private onLogInfoClick(): void {
        Logger.debug('🧪 测试：输出Token和ID信息');
        this.logCurrentStatus();
    }

    /**
     * 输出当前状态
     */
    private logCurrentStatus(): void {
        try {
            const wsManager = WebSocketManager.getInstance();
            const token = wsManager.getToken();
            const userId = wsManager.getUserId();
            const characterId = wsManager.getCharacterId();
            
            Logger.debug('📋 当前Token和ID状态:');
            Logger.debug('  - Token存在:', token !== null);
            Logger.debug('  - 用户ID存在:', userId !== null);
            Logger.debug('  - 角色ID存在:', characterId !== null);
            Logger.debug('  - 游戏ID完整:', wsManager.hasGameIds());
            Logger.debug('  - WebSocket连接状态:', wsManager.isConnected());
            
            if (token) {
                Logger.debug('  - Token:', token);
                Logger.debug('  - Token长度:', token.length);
                Logger.debug('  - Token前10位:', token.substring(0, 10));
                Logger.debug('  - Token后10位:', token.substring(token.length - 10));
            } else {
                Logger.debug('  - Token: null');
            }
            
            if (userId) {
                Logger.debug('  - 用户ID:', userId);
            } else {
                Logger.debug('  - 用户ID: null');
            }
            
            if (characterId) {
                Logger.debug('  - 角色ID:', characterId);
            } else {
                Logger.debug('  - 角色ID: null');
            }
            
        } catch (error) {
            Logger.error('❌ 输出状态失败:', error);
        }
    }

    /**
     * 手动触发状态检查（调试用）
     */
    public manualStatusCheck(): void {
        Logger.debug('🔍 手动触发状态检查');
        this.logCurrentStatus();
    }

    /**
     * 获取当前Token（调试用）
     */
    public getCurrentToken(): string | null {
        try {
            const wsManager = WebSocketManager.getInstance();
            return wsManager.getToken();
        } catch (error) {
            Logger.error('❌ 获取Token失败:', error);
            return null;
        }
    }

    /**
     * 获取当前用户ID（调试用）
     */
    public getCurrentUserId(): string | null {
        try {
            const wsManager = WebSocketManager.getInstance();
            return wsManager.getUserId();
        } catch (error) {
            Logger.error('❌ 获取用户ID失败:', error);
            return null;
        }
    }

    /**
     * 获取当前角色ID（调试用）
     */
    public getCurrentCharacterId(): string | null {
        try {
            const wsManager = WebSocketManager.getInstance();
            return wsManager.getCharacterId();
        } catch (error) {
            Logger.error('❌ 获取角色ID失败:', error);
            return null;
        }
    }

    /**
     * 加经验按钮点击事件
     */
    private onAddExpClick(): void {
        Logger.debug('🧪 测试：增加经验值 9999');
        
        // 严格验证数据完整性（防止未授权操作）
        if (!GameCommonData.instance) {
            Logger.error('❌ GameCommonData未初始化，无法增加经验');
            return;
        }

        // 验证数据完整性（会触发Loading如果数据缺失）
        if (!GameCommonData.instance.validateDataIntegrity()) {
            Logger.error('❌ 数据不完整，无法增加经验');
            return;
        }

        try {
            const wsManager = WebSocketManager.getInstance();
            const token = wsManager.getToken();
            const userId = wsManager.getUserId();
            const characterId = wsManager.getCharacterId();
            
            // 双重验证（防止绕过）
            if (!token || !userId || !characterId) {
                Logger.error('❌ 数据验证失败：Token、用户ID或角色ID缺失');
                GameCommonData.instance.validateDataIntegrity(); // 触发Loading
                return;
            }

            // 发送加经验请求到服务器（包含完整验证信息）
            const msg: any = {
                type: 'add_exp',
                exp: 9999,
                token: token,  // 明确传递token
                user_id: userId,  // 明确传递user_id
                character_id: characterId
            };
            wsManager.send(msg, true);
            
            Logger.debug('📤 已发送加经验请求：9999 经验值（已验证数据完整性）');
        } catch (error) {
            Logger.error('❌ 增加经验失败:', error);
        }
    }

    /**
     * 升级所有机甲按钮点击事件
     */
    private onUpgradeAllRobotsClick(): void {
        Logger.debug('🧪 测试：给所有机甲增加经验值 9999');
        
        // 严格验证数据完整性（防止未授权操作）
        if (!GameCommonData.instance) {
            Logger.error('❌ GameCommonData未初始化，无法升级机甲');
            return;
        }

        // 验证数据完整性（会触发Loading如果数据缺失）
        if (!GameCommonData.instance.validateDataIntegrity()) {
            Logger.error('❌ 数据不完整，无法升级机甲');
            return;
        }

        try {
            const wsManager = WebSocketManager.getInstance();
            const token = wsManager.getToken();
            const userId = wsManager.getUserId();
            const characterId = wsManager.getCharacterId();
            
            // 双重验证（防止绕过）
            if (!token || !userId || !characterId) {
                Logger.error('❌ 数据验证失败：Token、用户ID或角色ID缺失');
                GameCommonData.instance.validateDataIntegrity(); // 触发Loading
                return;
            }

            // 发送升级所有机甲请求到服务器（包含完整验证信息）
            const msg: any = {
                type: 'upgrade_all_robots',
                exp: 9999,
                token: token,  // 明确传递token
                character_id: characterId
            };
            wsManager.send(msg, true);
            
            Logger.debug('📤 已发送升级所有机甲请求：每个机甲增加 9999 经验值（已验证数据完整性）');
        } catch (error) {
            Logger.error('❌ 升级所有机甲失败:', error);
        }
    }

    /**
     * 启动战斗按钮点击事件
     */
    private onStartBattleClick(): void {
        Logger.debug('⚔️ 测试：启动战斗场景');
        
        if (!this.battleScenePanel) {
            Logger.error('❌ BattleScene 面板未绑定');
            return;
        }

        // 激活 BattleScene 面板（onEnable 会自动调用 startNewBattle）
        this.battleScenePanel.active = true;
        Logger.debug('✅ 战斗场景已启动');
    }

    /**
     * 输出经验值相关信息
     */
    private logExpInfo(): void {
        if (!GameCommonData.instance) {
            Logger.warn('⚠️ GameCommonData 未初始化');
            return;
        }

        const level = GameCommonData.instance.level;
        const totalExp = GameCommonData.instance.totalExp;
        const needExp = GameCommonData.instance.needExpForNextLevel;
        const isMaxLevel = GameCommonData.instance.isMaxLevel;

        Logger.debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.debug('📊 角色经验信息：');
        Logger.debug(`  - 当前等级：${level}`);
        Logger.debug(`  - 当前总经验：${totalExp.toLocaleString()}`);
        
        if (isMaxLevel) {
            Logger.debug(`  - 状态：已满级（${level}级封顶）`);
        } else {
            Logger.debug(`  - 距离下次升级所需经验：${needExp.toLocaleString()}`);
        }
        Logger.debug('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    onDestroy() {
        // 清理事件监听（节点可能已被销毁，需判空与有效性）
        const safeOffButton = (btn: Button | null, handler: Function) => {
            if (btn && btn.node && btn.node.isValid) {
                btn.node.off(Button.EventType.CLICK, handler as any, this);
            }
        };

        safeOffButton(this.clearTokenBtn, this.onClearTokenClick);
        safeOffButton(this.clearUserIdBtn, this.onClearUserIdClick);
        safeOffButton(this.clearCharacterIdBtn, this.onClearCharacterIdClick);
        safeOffButton(this.logInfoBtn, this.onLogInfoClick);
        safeOffButton(this.addExpBtn, this.onAddExpClick);
        safeOffButton(this.upgradeAllRobotsBtn, this.onUpgradeAllRobotsClick);
        safeOffButton(this.startBattleBtn, this.onStartBattleClick);
        safeOffButton(this.pvpMatchBtn, this.onPvpMatchClick);

        // 清理拖动事件
        if (this.node && this.node.isValid) {
            this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
        
        // 清理节点按钮点击事件
        const button = this.node?.getComponent(Button);
        if (button && button.node && button.node.isValid) {
            button.node.off(Button.EventType.CLICK, this.onNodeButtonClick, this);
        }

        // 清理数据监听
        if (GameCommonData.instance && GameCommonData.instance.node?.isValid) {
            GameCommonData.instance.node.off('data_updated', this.onDataUpdated, this);
        }

        Logger.debug('🧪 测试脚本销毁');
    }
}


