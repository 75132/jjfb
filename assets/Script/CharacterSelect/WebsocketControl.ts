import { _decorator, Component, director, Button, Node } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { BaseSceneController } from '../global/BaseSceneController';
import { GameConfig } from '../global/GameConfig';

const { ccclass, property } = _decorator;

/**
 * WebSocketControl - 后台场景控制器
 * 职责：监控Token状态，Token失效时自动跳转到登录场景
 * 设计原则：纯后台运行，无UI依赖，自动监控
 */
@ccclass('WebSocketControl')
export class WebSocketControl extends BaseSceneController {
    @property(Button)
    clearTokenBtn: Button = null!;
    
    @property({ type: Node, tooltip: '异常/重连时显示的Loading面板（非Login场景）' })
    loadingPanel: Node | null = null;
    
    private reconnectTimer: number = -1;
    private isRecovering: boolean = false;
    private readonly maxRecoverAttempts: number = 5;
    private readonly recoverIntervalMs: number = 600;
    private readonly recoverTimeoutMs: number = 3500;

    // 监控相关属性 - 继承自基类，这里只需要角色选择特有的属性

    start() {
        // 调用父类start方法，启动监控
        super.start();
        
        if (this.loadingPanel) {
            this.loadingPanel.active = false;
        }

        // 绑定清除Token按钮事件
        if (this.clearTokenBtn) {
            this.clearTokenBtn.node.on(Button.EventType.CLICK, this.onClearTokenClick, this);
        }
    }

    /**
     * 清除Token按钮点击事件
     */
    private onClearTokenClick(): void {
        console.log('🧪 测试：手动清除Token');
        this.handleTokenInvalid();
    }

    // 移除重复的监控方法，继承自基类

    /**
     * 检查Token状态 - 实现基类抽象方法
     * 角色选择场景需要验证：Token、UserId（已登录账号必须有账号数据）
     * 不需要验证：CharacterId（因为这是选择角色的场景，还没有选择角色）
     */
    protected checkStatus(): void {
        try {
            if (!this.currentSceneName) {
                this.currentSceneName = director.getScene()?.name || '';
            }
            const currentToken = this.getCurrentToken();
            const wsManager = WebSocketManager.getInstance();
            
            // 检查WebSocket连接状态（优先检查）
            if (!wsManager.isConnected()) {
                console.warn(`⚠️ WebSocket连接断开 - 场景: ${this.currentSceneName}`);
                this.handleConnectionLost();
                return;
            }

            // 检查Token是否失效
            if (!this.isTokenValid(currentToken)) {
                console.warn(`⚠️ Token已失效 - 场景: ${this.currentSceneName}`);
                this.handleTokenInvalid();
                return;
            }

            // 角色选择场景需要验证UserId（已登录账号必须有账号数据）
            const currentUserId = wsManager.getUserId();
            if (!currentUserId || currentUserId.length === 0) {
                console.warn(`⚠️ 用户ID缺失 - 场景: ${this.currentSceneName}，已登录账号必须有账号数据`);
                this.handleTokenInvalid();
                return;
            }

            // 检查Token是否发生变化
            if (this.lastToken !== currentToken) {
                console.log(`🔄 Token已更新 - 场景: ${this.currentSceneName}`);
                this.lastToken = currentToken;
            }

            // 角色选择场景不需要验证CharacterId（因为这是选择角色的场景，还没有选择角色）

        } catch (error) {
            console.error(`❌ Token状态检查失败 - 场景: ${this.currentSceneName}:`, error);
            this.handleTokenInvalid();
        }
    }

    /**
     * 处理Token失效 - 实现基类抽象方法
     */
    protected handleTokenInvalid(): void {
        // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不做重连恢复）
        const wsManager = WebSocketManager.getInstance();
        if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [WebSocketControl] 安全阀触发（token_idle_expired），清会话并回登录`);
            try { wsManager.clearAll(); } catch {}
            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
        }

        console.log(`🚨 Token失效，显示Loading并尝试恢复 - 当前场景: ${this.currentSceneName}`);
        this.showLoadingAndRecover('token_invalid');
    }

    /**
     * 处理连接丢失 - 实现基类抽象方法
     */
    protected handleConnectionLost(): void {
        // 安全阀：离线/未鉴权超过阈值 => 直接重登并清理本地会话（不做重连恢复）
        const wsManager = WebSocketManager.getInstance();
        if (wsManager.isReloginRequiredByIdle()) {
            console.warn(`⚠️ [WebSocketControl] 安全阀触发（connection_idle_expired），清会话并回登录`);
            try { wsManager.clearAll(); } catch {}
            this.stopMonitoring();
            this.jumpToLoginScene();
            return;
        }

        console.log(`🔌 WebSocket连接丢失，显示Loading并尝试恢复 - 场景: ${this.currentSceneName}`);
        this.showLoadingAndRecover('connection_lost');
    }
    
    /**
     * 处理数据变化事件：切换角色回选角 / 完全清空账号时不进入异常恢复流
     */
    protected onDataChanged(data: any): void {
        const reason = data?.reason;
        if (reason === 'character_id_cleared' || reason === 'all_cleared') {
            // character_id_cleared：游戏内切换角色；all_cleared：登录页完全登出等。均不显示 Loading、不做断线恢复重试。
            this.stopMonitoring();
            return;
        }
        super.onDataChanged(data);
    }
    
    private showLoadingAndRecover(reason: string): void {
        // Login 场景不做此策略，避免登录页反复遮罩
        const sceneName = director.getScene()?.name || '';
        if (sceneName === GameConfig.SCENE_NAMES.LOGIN) {
            this.jumpToLoginScene();
            return;
        }
        
        if (this.isRecovering) {
            return;
        }
        this.isRecovering = true;
        this.stopMonitoring();
        
        if (this.loadingPanel) {
            this.loadingPanel.active = true;
        }
        
        const wsManager = WebSocketManager.getInstance();
        let attempts = 0;
        
        const tryRecover = () => {
            attempts += 1;
            try {
                wsManager.connect();
            } catch (error) {
                console.error('❌ [WebSocketControl] 恢复连接异常:', error);
            }
            
            setTimeout(() => {
                if (this.isRecoveryReady()) {
                    this.onRecoverSuccess();
                    return;
                }
                
                if (attempts < this.maxRecoverAttempts) {
                    tryRecover();
                } else {
                    this.onRecoverFailed(`attempt_limit: ${reason}`);
                }
            }, this.recoverIntervalMs);
        };
        
        tryRecover();
        
        this.reconnectTimer = setTimeout(() => {
            if (this.isRecovering) {
                this.onRecoverFailed(`timeout: ${reason}`);
            }
        }, this.recoverTimeoutMs) as any;
    }
    
    private isRecoveryReady(): boolean {
        const wsManager = WebSocketManager.getInstance();
        if (!wsManager.isConnected()) return false;
        const token = wsManager.getToken();
        const userId = wsManager.getUserId();
        return !!(token && token.length > 0 && userId && userId.length > 0);
    }
    
    private onRecoverSuccess(): void {
        if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
        }
        this.isRecovering = false;
        if (this.loadingPanel) {
            this.loadingPanel.active = false;
        }
        this.startMonitoring();
        this.checkStatus();
    }
    
    private onRecoverFailed(reason: string): void {
        console.warn(`⚠️ [WebSocketControl] 恢复失败，回登录: ${reason}`);
        if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
        }
        this.isRecovering = false;
        if (this.loadingPanel) {
            this.loadingPanel.active = false;
        }
        
        // 恢复失败再清理会话并回登录（直接清理，避免额外 logout 401 噪音）
        try {
            WebSocketManager.getInstance().clearAll();
        } catch {}
        setTimeout(() => this.jumpToLoginScene(), 200);
    }

    // 移除重复的sendClearTokenCommand方法，继承自基类

    // 移除重复的jumpToLoginScene方法，继承自基类

    // 移除重复的getCurrentToken和isTokenValidInternal方法，继承自基类

    /**
     * 手动触发Token检查（调试用）
     */
    public manualTokenCheck(): void {
        console.log('🔍 手动触发Token检查');
        this.checkStatus();
    }

    /**
     * 获取当前场景名称
     */
    public getCurrentSceneName(): string {
        return this.currentSceneName;
    }

    /**
     * 获取监控状态
     */
    public getMonitoringStatus(): boolean {
        return this.isMonitoring;
    }

    /**
     * 输出Token详细信息（调试用）
     */
    public logTokenDetails(): void {
        try {
            const wsManager = WebSocketManager.getInstance();
            const token = this.getCurrentToken();
            const userId = wsManager.getUserId();
            const characterId = wsManager.getCharacterId();
            
            console.log(`📋 Token详细信息 - 场景: ${this.currentSceneName}:`);
            console.log('  - Token存在:', token !== null);
            console.log('  - Token长度:', token ? token.length : 0);
            console.log('  - 用户ID存在:', userId !== null);
            console.log('  - 角色ID存在:', characterId !== null);
            console.log('  - 游戏ID完整:', wsManager.hasGameIds());
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
            console.error('❌ 输出Token详细信息失败:', error);
        }
    }

    onDestroy() {
        // 停止监控
        super.onDestroy();
        
        if (this.reconnectTimer !== -1) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = -1;
        }
        this.isRecovering = false;
        
        // 清理事件监听
        try {
            if (this.clearTokenBtn && this.clearTokenBtn.node) {
                this.clearTokenBtn.node.off(Button.EventType.CLICK, this.onClearTokenClick, this);
            }
        } catch {}

        console.log(`🎮 后台场景控制器销毁 - 场景: ${this.currentSceneName}`);
    }
}
