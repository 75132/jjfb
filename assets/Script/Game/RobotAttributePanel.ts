import { _decorator, Component, Node, Button, Widget, Sprite } from 'cc';
import { MechAttributeTEST } from './MechAttributeTEST';
import { robotGameEvents, RobotGameEvent } from '../global/RobotGameEvents';
const { ccclass, property } = _decorator;

@ccclass('RobotAttributePanel')
export class RobotAttributePanel extends Component {
    
    // 三个功能按钮和对应的面板
    @property({ type: [Button], tooltip: "三个功能按钮" })
    functionButtons: Button[] = [];
    
    @property({ type: [Node], tooltip: "对应的功能面板" })
    functionPanels: Node[] = [];
    
    // 隐藏按钮
    @property({ type: Button, tooltip: "隐藏按钮" })
    destroyButton: Button = null;

    // 新增：要隐藏的目标节点（未设置则隐藏本组件节点）
    @property({ type: Node, tooltip: "点击隐藏的目标节点（不设置则隐藏当前组件节点）" })
    targetToHide: Node | null = null;
    
    // 新增：MechAttributeTEST组件（用于显示机甲信息）
    @property({ type: MechAttributeTEST, tooltip: "机甲属性显示组件（可选，会自动查找）" })
    mechAttributeComponent: MechAttributeTEST | null = null;
    
    // 面板状态
    private panelStates: { [key: string]: boolean } = {};
    private currentOpenPanel: Node | null = null;
    private _lastShownPetId: string | null = null;

    onLoad() {
        robotGameEvents.on(RobotGameEvent.RobotDataUpdated, this.onGlobalRobotRefresh, this);
        robotGameEvents.on(RobotGameEvent.BattleTeamUpdated, this.onGlobalRobotRefresh, this);
    }

    start() {
        // 隐藏初始化日志

        // 延迟初始化，避免阻塞场景加载
        setTimeout(() => {
            this.initializePanels();
            this.bindButtonEvents();
            this.bindDestroyButton();
            
            // 如果没有手动绑定MechAttributeTEST，尝试自动查找
            if (!this.mechAttributeComponent) {
                // 隐藏详细日志
                this.mechAttributeComponent = this.node.getComponentInChildren(MechAttributeTEST);
                if (!this.mechAttributeComponent) {
                    // 只在找不到时记录警告
                    console.warn('⚠️ [RobotAttributePanel] 未找到 MechAttributeTEST 组件');
                }
            }

        }, 50); // 延迟50ms初始化
    }

    private onGlobalRobotRefresh = (): void => {
        if (!this.node?.active || !this._lastShownPetId) return;
        this.showSelectedRobot(this._lastShownPetId);
    };
    
    /**
     * 初始化面板状态
     */
    private initializePanels(): void {
        // 简化日志输出，减少初始化时间
        console.log(`🔧 初始化面板状态 - 按钮:${this.functionButtons.length}, 面板:${this.functionPanels.length}`);

        // 初始化所有面板状态
        this.functionPanels.forEach((panel, index) => {
            if (panel) {
                if (index === 0) {
                    // 第一个面板默认显示
                    panel.active = true;
                    this.panelStates[panel.name] = true;
                    this.currentOpenPanel = panel;
                } else {
                    // 其他面板隐藏
                    panel.active = false;
                    this.panelStates[panel.name] = false;
                }
            }
        });
        
        // 初始化按钮的Sprite组件状态
        this.functionButtons.forEach((button, buttonIndex) => {
            if (button) {
                const buttonNode = button.node;
                const sprite = buttonNode.getComponent(Sprite);

                if (sprite) {
                    sprite.enabled = buttonIndex === 0; // 只有第一个按钮启用
                }
            }
        });

        console.log(`✅ RobotAttributePanel初始化完成 - 当前面板: ${this.currentOpenPanel?.name || '无'}`);
    }
    
    /**
     * 绑定功能按钮事件
     */
    private bindButtonEvents(): void {
        this.functionButtons.forEach((button, index) => {
            if (button && this.functionPanels[index]) {
                const panelName = this.functionPanels[index].name;
                
                button.node.on(Button.EventType.CLICK, () => {
                    this.switchToPanel(panelName);
                }, this);
                
                // 隐藏绑定日志
            }
        });
    }
    
    /**
     * 绑定隐藏按钮事件
     */
    private bindDestroyButton(): void {
        if (this.destroyButton) {
            this.destroyButton.node.on(Button.EventType.CLICK, () => {
                this.hideTarget();
            }, this);
            
            // 隐藏绑定日志
        }
    }

    /**
     * 设置要隐藏的目标节点（可在运行时动态指定）
     */
    public setTargetToHide(node: Node | null): void {
        this.targetToHide = node;
    }
    
    /**
     * 隐藏目标（若未设置则隐藏自身节点）
     */
    public hideTarget(): void {
        const target = this.targetToHide || this.node;
        if (target) {
            target.active = false;
            // 隐藏日志
        }
    }
    
    /**
     * 切换到指定面板
     */
    public switchToPanel(panelName: string): void {
        const targetPanel = this.functionPanels.find(p => p.name === panelName);
        if (!targetPanel) {
            console.warn(`⚠️ 未找到面板: ${panelName}`);
            return;
        }
        
        // 如果点击的是当前已打开的面板，不做任何操作
        if (this.currentOpenPanel === targetPanel) {
            return;
        }
        
        // 隐藏当前打开的面板
        if (this.currentOpenPanel) {
            this.hidePanel(this.currentOpenPanel.name);
        }
        
        // 显示目标面板
        this.showPanel(panelName);
    }
    
    /**
     * 显示面板
     */
    public showPanel(panelName: string): void {
        const panel = this.functionPanels.find(p => p.name === panelName);
        if (!panel) return;
        
        // 强制隐藏其他面板
        this.functionPanels.forEach(p => {
            if (p && p !== panel) {
                p.active = false;
                this.panelStates[p.name] = false;
            }
        });
        
        // 显示目标面板
        panel.active = true;
        this.panelStates[panelName] = true;
        this.currentOpenPanel = panel;
        
        // 控制按钮的Sprite组件显示/隐藏
        this.functionButtons.forEach((button, buttonIndex) => {
            if (button) {
                const sprite = button.node.getComponent(Sprite);
                if (sprite) {
                    sprite.enabled = (buttonIndex === this.functionPanels.findIndex(p => p.name === panelName));
                }
            }
        });
    }
    
    /**
     * 隐藏面板
     */
    public hidePanel(panelName: string): void {
        const panel = this.functionPanels.find(p => p.name === panelName);
        if (!panel) return;
        
        panel.active = false;
        this.panelStates[panelName] = false;
        
        if (this.currentOpenPanel === panel) {
            this.currentOpenPanel = null;
        }
    }
    
    /**
     * 隐藏整个RobotAttributePanel节点（兼容旧接口）
     */
    public hideRobotAttributePanel(): void {
        this.hideTarget();
    }
    
    /**
     * 获取面板状态
     */
    public isPanelOpen(panelName: string): boolean {
        return this.panelStates[panelName] || false;
    }
    
    /**
     * 获取当前打开的面板
     */
    public getCurrentOpenPanel(): Node | null {
        return this.currentOpenPanel;
    }
    
    /**
     * 获取所有面板状态
     */
    public getAllPanelStates(): { [key: string]: boolean } {
        return { ...this.panelStates };
    }
    
    /**
     * 获取节点的完整路径（用于调试）
     */
    private getNodePath(node: Node | null): string {
        if (!node) return '';
        const path: string[] = [];
        let current: Node | null = node;
        while (current) {
            path.unshift(current.name);
            current = current.parent;
        }
        return path.join('/');
    }
    
    /**
     * 显示选中的机甲信息
     * @param petId 机甲宠物的_id
     */
    public showSelectedRobot(petId: string): void {
        this._lastShownPetId = petId ? String(petId) : null;
        // 隐藏详细日志，只保留错误日志
        
        // 确保面板显示
        if (this.node) {
            this.node.active = true;
        }
        
        // 默认切换到第一个面板（属性面板）
        if (this.functionPanels.length > 0) {
            this.showPanel(this.functionPanels[0].name);
        } else {
            console.warn('⚠️ [RobotAttributePanel] 没有功能面板可用');
        }
        
        // 性能优化：立即调用，不延迟
        // 调用MechAttributeTEST组件显示机甲信息
        if (this.mechAttributeComponent && this.mechAttributeComponent.node && this.mechAttributeComponent.node.isValid) {
            this.mechAttributeComponent.showSelectedRobot(petId);
        } else {
            // 尝试重新查找
            this.mechAttributeComponent = this.node.getComponentInChildren(MechAttributeTEST);
            
            if (!this.mechAttributeComponent) {
                const scene = this.node.scene;
                if (scene) {
                    this.mechAttributeComponent = scene.getComponentInChildren(MechAttributeTEST);
                }
            }
            
            if (this.mechAttributeComponent && this.mechAttributeComponent.node && this.mechAttributeComponent.node.isValid) {
                this.mechAttributeComponent.showSelectedRobot(petId);
            } else {
                console.error('❌ [RobotAttributePanel] 找不到 MechAttributeTEST 组件');
            }
        }
    }
    
    onDestroy() {
        robotGameEvents.off(RobotGameEvent.RobotDataUpdated, this.onGlobalRobotRefresh, this);
        robotGameEvents.off(RobotGameEvent.BattleTeamUpdated, this.onGlobalRobotRefresh, this);
        // 清理事件监听
        this.functionButtons.forEach(button => {
            if (button && button.node && button.node.isValid) {
                button.node.off(Button.EventType.CLICK);
            }
        });
        
        if (this.destroyButton && this.destroyButton.node && this.destroyButton.node.isValid) {
            this.destroyButton.node.off(Button.EventType.CLICK);
        }
    }
}
