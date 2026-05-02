import { _decorator, Component, director } from 'cc';
import { WebSocketManager } from './WebSocketManager';
import { GameConfig } from './GameConfig';

const { ccclass } = _decorator;

@ccclass('BaseSceneController')
export abstract class BaseSceneController extends Component {
    protected tokenCheckInterval: number = GameConfig.TOKEN_CHECK_INTERVAL;
    protected tokenCheckTimer: number = -1;
    protected lastToken: string | null = null;
    protected isMonitoring: boolean = false;
    protected currentSceneName: string = '';
    private static navigating: boolean = false;

    start() {
        this.currentSceneName = director.getScene().name;
        this.scheduleOnce(() => { this.startMonitoring(); }, 2.0);
    }
    protected startMonitoring(): void {
        if (this.isMonitoring) { return; }
        this.isMonitoring = true; 
        this.lastToken = this.getCurrentToken();
        
        // 网游级优化：事件驱动替代频繁轮询
        // 监听WebSocket连接状态变化事件
        const wsManager = WebSocketManager.getInstance();
        wsManager.on('network_connect', this.onNetworkConnect, this);
        wsManager.on('network_disconnect', this.onNetworkDisconnect, this);
        wsManager.on('data_changed', this.onDataChanged, this);
        
        // 减少轮询频率，使用更长的间隔（事件驱动为主，轮询为辅）
        this.tokenCheckTimer = setInterval(() => { this.checkStatus(); }, this.tokenCheckInterval);
        setTimeout(() => { this.checkStatus(); }, 1000);
    }
    
    /**
     * 网游级优化：事件驱动处理网络连接
     * 修复：改为方法而不是箭头函数字段，允许子类正确重写
     */
    protected onNetworkConnect(): void {
        // 连接恢复时立即检查状态
        this.checkStatus();
    }
    
    /**
     * 网游级优化：事件驱动处理网络断开
     * 修复：改为方法而不是箭头函数字段，允许子类正确重写
     */
    protected onNetworkDisconnect(): void {
        // 断开时立即处理
        this.handleConnectionLost();
    }
    
    /**
     * 网游级优化：事件驱动处理数据变化
     * 修复：改为方法而不是箭头函数字段，允许子类正确重写
     */
    protected onDataChanged(data: any): void {
        // 数据变化时立即检查
        this.checkStatus();
    }
    protected stopMonitoring(): void { 
        if (this.tokenCheckTimer !== -1) { 
            clearInterval(this.tokenCheckTimer); 
            this.tokenCheckTimer = -1; 
        } 
        
        // 网游级优化：取消事件监听
        // 修复：使用箭头函数包装，确保 this 绑定正确
        const wsManager = WebSocketManager.getInstance();
        wsManager.off('network_connect', this.onNetworkConnect, this);
        wsManager.off('network_disconnect', this.onNetworkDisconnect, this);
        wsManager.off('data_changed', this.onDataChanged, this);
        
        this.isMonitoring = false; 
    }
    protected abstract checkStatus(): void;
    protected abstract handleTokenInvalid(): void;
    protected abstract handleConnectionLost(): void;
    protected sendClearTokenCommand(): void {
        try {
            const wsManager = WebSocketManager.getInstance();
            wsManager.send({ type: GameConfig.MESSAGE_TYPES.LOGOUT, token: wsManager.getToken() }, false);
            wsManager.clearToken();
        } catch {}
    }
    protected jumpToLoginScene(): void { if (BaseSceneController.navigating) { return; } BaseSceneController.navigating = true; try { director.loadScene(GameConfig.SCENE_NAMES.LOGIN, () => { BaseSceneController.navigating = false; }); } catch { BaseSceneController.navigating = false; } }
    protected jumpToCharacterSelectScene(): void { if (BaseSceneController.navigating) { return; } BaseSceneController.navigating = true; try { director.loadScene(GameConfig.SCENE_NAMES.CHARACTER_SELECT, () => { BaseSceneController.navigating = false; }); } catch { BaseSceneController.navigating = false; } }
    protected getCurrentToken(): string | null { try { return WebSocketManager.getInstance().getToken(); } catch { return null; } }
    protected isTokenValid(token: string | null): boolean { return token !== null && token.length > 0; }
    public manualStatusCheck(): void { this.checkStatus(); }
    public getCurrentSceneName(): string { return this.currentSceneName; }
    public getMonitoringStatus(): boolean { return this.isMonitoring; }
    public logDetails(): void { try { const wsManager = WebSocketManager.getInstance(); const token = this.getCurrentToken(); } catch {} }
    onDestroy() { this.stopMonitoring(); }
}
