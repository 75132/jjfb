import { _decorator, Component, Node, Button, Widget, Vec3, tween, Tween, director } from 'cc';
import { RobotList } from './RobotList';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { RobotShow } from './RobotShow';
const { ccclass, property } = _decorator;

@ccclass('GameMenu')
export class GameMenu extends Component {
    
    // 按钮和面板的绑定数组
    @property({ type: [Button], tooltip: "控制按钮" })
    buttons: Button[] = [];
    
    @property({ type: [Node], tooltip: "对应的面板" })
    panels: Node[] = [];

    // 返回角色选择按钮和确认弹窗
    @property({ type: Button, tooltip: "返回角色选择按钮" })
    returnButton: Button | null = null;
    
    @property({ type: Node, tooltip: "确认弹窗" })
    confirmDialog: Node | null = null;
    
    @property({ type: Button, tooltip: "确认按钮" })
    confirmButton: Button | null = null;
    
    @property({ type: Button, tooltip: "取消按钮" })
    cancelButton: Button | null = null;

    // 面板状态
    private panelStates: { [key: string]: boolean } = {};
    private activePanel: Node | null = null;
    
    // 动画相关
    private panelAnimations: { [key: string]: Tween<Node> } = {};
    private lastOpenTs: number = 0;
    private lastOpenName: string = '';
    
    start() {
        console.log('🎮 GameMenu 开始初始化...');

        // 资源预热：在主界面就提前把 RobotShow 的资源加载好，战斗/机甲界面打开更快
        // 幂等调用，不会重复加载
        try {
            RobotShow.preloadResources();
        } catch {}

        // 延迟初始化，避免阻塞场景加载
        setTimeout(() => {
            this.initializePanels();
            this.bindButtonEvents();
            console.log('✅ GameMenu 初始化完成');
        }, 20); // 延迟20ms初始化
    }
    
    /**
     * 初始化面板状态
     */
    private initializePanels(): void {
        // 初始化所有面板为隐藏状态
        this.panels.forEach(panel => {
            if (panel) {
                panel.active = false;  // 所有面板默认隐藏
                this.panelStates[panel.name] = false;
            }
        });
        
        // 初始化确认弹窗为隐藏状态
        if (this.confirmDialog) {
            this.confirmDialog.active = false;
        }
        
        console.log('🎮 GameMenu初始化完成，按钮数量:', this.buttons.length);
        console.log('📱 所有面板已设置为默认隐藏状态');
        console.log('🎯 返回按钮绑定弹窗:', this.confirmDialog?.name || '未设置');
    }
    
    /**
     * 绑定按钮事件
     */
    private bindButtonEvents(): void {
        // 绑定面板打开按钮
        this.buttons.forEach((button, index) => {
            if (button && this.panels[index]) {
                const panelName = this.panels[index].name;

                button.node.on(Button.EventType.CLICK, () => {
                    this.openPanel(panelName);
                }, this);

                console.log(`🔗 按钮 ${button.node.name} 绑定到面板 ${panelName}`);
            }
        });

        // 绑定返回按钮
        if (this.returnButton) {
            this.returnButton.node.on(Button.EventType.CLICK, () => {
                this.showConfirmDialog();
            }, this);
            
            console.log(`🎯 返回按钮 ${this.returnButton.node.name} 已绑定`);
        }
        
        // 绑定确认弹窗按钮
        if (this.confirmButton) {
            this.confirmButton.node.on(Button.EventType.CLICK, () => {
                this.confirmReturnToCharacterSelect();
            }, this);
        }
        
        if (this.cancelButton) {
            this.cancelButton.node.on(Button.EventType.CLICK, () => {
                this.hideConfirmDialog();
            }, this);
        }
    }
    
    /**
     * 打开面板
     */
    public openPanel(panelName: string): void {
        const now = Date.now();
        if (this.lastOpenName === panelName && (now - this.lastOpenTs) < 200) {
            return;
        }
        this.lastOpenName = panelName;
        this.lastOpenTs = now;
        const panel = this.panels.find(p => p.name === panelName);
        if (!panel) {
            console.warn(`⚠️ 未找到面板: ${panelName}`);
            return;
        }
        
        // 检查实际节点状态，如果已经显示就直接返回
        if (panel.active) {
            console.log(`🔄 面板 ${panelName} 节点已经是显示状态，无需操作`);
            return;
        }
        
        // 关闭其他面板
        this.closeAllPanels();
        
        // 直接显示当前面板（无动画）
        panel.active = true;
        this.panelStates[panelName] = true;
        this.activePanel = panel;
        const robotList = panel.getComponent(RobotList);
        if (robotList && typeof (robotList as any).show === 'function') {
            (robotList as any).show(false); // 明确 fromBag=false，保证 Set/设置出战 面板显示
        }
        console.log(`🚪 打开面板: ${panelName}`);
    }
    
    /**
     * 关闭面板
     */
    public closePanel(panelName: string): void {
        const panel = this.panels.find(p => p.name === panelName);
        if (!panel) return;

        // 直接隐藏面板（无动画）
        panel.active = false;
        this.panelStates[panelName] = false;
        this.activePanel = null;

        console.log(`🚪 隐藏面板: ${panelName}`);
    }
    
    /**
     * 关闭所有面板
     */
    public closeAllPanels(): void {
        // 关闭普通面板
        this.panels.forEach(panel => {
            if (panel && panel.active) {
                this.closePanel(panel.name);
            }
        });
    }
    
    /**
     * 获取面板状态
     */
    public isPanelOpen(panelName: string): boolean {
        return this.panelStates[panelName] || false;
    }
    
    /**
     * 获取当前活动面板
     */
    public getActivePanel(): Node | null {
        return this.activePanel;
    }
    
    /**
     * 同步面板状态
     */
    public syncPanelStates(): void {
        // 同步普通面板状态
        this.panels.forEach(panel => {
            if (panel) {
                this.panelStates[panel.name] = panel.active;
                if (panel.active) {
                    this.activePanel = panel;
                }
            }
        });
        
        console.log('🔄 面板状态已同步');
    }
    
    onDestroy() {
        // 清理资源
        this.panelAnimations = {};
        try {
            // 解绑按钮事件，防止销毁期间空引用异常
            this.buttons.forEach((button) => {
                if (button && button.node && button.node.isValid) {
                    button.node.off(Button.EventType.CLICK);
                }
            });
            if (this.returnButton && this.returnButton.node && this.returnButton.node.isValid) {
                this.returnButton.node.off(Button.EventType.CLICK);
            }
            if (this.confirmButton && this.confirmButton.node && this.confirmButton.node.isValid) {
                this.confirmButton.node.off(Button.EventType.CLICK);
            }
            if (this.cancelButton && this.cancelButton.node && this.cancelButton.node.isValid) {
                this.cancelButton.node.off(Button.EventType.CLICK);
            }
        } catch {}
    }

    /**
     * 显示确认弹窗
     */
    private showConfirmDialog(): void {
        if (this.confirmDialog) {
            this.confirmDialog.active = true;
            console.log('❓ 显示返回确认弹窗');
        }
    }
    
    /**
     * 隐藏确认弹窗
     */
    private hideConfirmDialog(): void {
        if (this.confirmDialog) {
            this.confirmDialog.active = false;
            console.log('❌ 隐藏返回确认弹窗');
        }
    }
    
    /**
     * 确认返回角色选择场景
     */
    private confirmReturnToCharacterSelect(): void {
        console.log('✅ 用户确认切换角色（返回选角，非账号登出）');
        try {
            const wsManager = WebSocketManager.getInstance();
            // 隐藏确认弹窗
            this.hideConfirmDialog();
            // 切换角色前若仍在线，立即预拉角色列表（断线则忽略，由选角场景再拉）
            if (wsManager.isConnected()) {
                wsManager.prefetchAllCharactersIfConnected(true);
            }
            wsManager.switchCharacterAndReturnToSelect();
            // 延迟一小段时间确保数据清除完成，然后切换场景
            setTimeout(() => {
                // 返回角色选择场景（不是登录场景）
                director.loadScene(GameConfig.SCENE_NAMES.CHARACTER_SELECT, (error) => {
                    if (error) {
                        console.error('❌ 跳转角色选择场景失败:', error);
                    } else {
                        console.log('✅ 已返回角色选择场景');
                    }
                });
            }, 100); // 延迟100ms确保数据清除和事件处理完成
        } catch (error) {
            console.error('❌ 返回选角流程异常:', error);
            this.hideConfirmDialog();
        }
    }
}
