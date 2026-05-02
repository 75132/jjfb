import { _decorator, Component, Label } from 'cc';
import { GameCommonData } from './GameCommonData';
const { ccclass, property } = _decorator;

/**
 * TopRole - 顶部角色信息显示组件
 * 
 * 职责：从 GameCommonData 数据中心读取数据并更新 UI
 * 数据流向：服务器 -> GameCommonData -> TopRole (UI显示)
 */
@ccclass('TopRole')
export class TopRole extends Component {
    @property({ type: Label }) nameLabel: Label | null = null;
    @property({ type: Label }) levelNumberLabel: Label | null = null;

    start() {
        // 等待 GameCommonData 初始化完成
        if (GameCommonData.instance) {
            this.setupDataListener();
            // 立即更新一次 UI（如果数据已存在）
            this.updateUI();
        } else {
            // 如果 GameCommonData 还没初始化，延迟一下再设置
            this.scheduleOnce(() => {
                if (GameCommonData.instance) {
                    this.setupDataListener();
                    this.updateUI();
                }
            }, 0.1);
        }
    }

    /**
     * 设置数据监听（监听 GameCommonData 的数据更新事件）
     */
    private setupDataListener(): void {
        if (GameCommonData.instance) {
            GameCommonData.instance.node.on('data_updated', this.onDataUpdated, this);
        }
    }

    /**
     * 处理数据更新事件
     */
    private onDataUpdated = (data: { level: number; totalExp: number; roleName: string; levelUpCount?: number }): void => {
        this.updateUI();
        
        // 如果有升级，可以在这里播放升级特效等
        if (data.levelUpCount && data.levelUpCount > 0) {
            console.log(`[TopRole] 角色升级了 ${data.levelUpCount} 级！`);
        }
    }

    /**
     * 更新 UI 显示
     */
    private updateUI(): void {
        if (!GameCommonData.instance) { return; }
        
        const roleName = GameCommonData.instance.roleName;
        const level = GameCommonData.instance.level;
        
        if (this.nameLabel) {
            this.nameLabel.string = roleName || '';
        }
        if (this.levelNumberLabel) {
            this.levelNumberLabel.string = String(level);
        }
    }

    onDestroy() {
        // 取消事件监听
        if (GameCommonData.instance) {
            GameCommonData.instance.node.off('data_updated', this.onDataUpdated, this);
        }
    }
}
