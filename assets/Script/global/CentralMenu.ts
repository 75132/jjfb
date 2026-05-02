import { _decorator, Component, Node, Button } from 'cc';
import { GameMenu } from '../Game/GameMenu';

const { ccclass, property } = _decorator;

/**
 * CentralMenu
 * - 统一管理 7 组“按钮 <-> 面板”显隐切换
 * - 每次只允许一个面板处于打开状态（点击已打开面板按钮会关闭）
 * - 如果按钮被 GameMenu 管理（挂在 GameMenu 里），则不在这里绑定，避免冲突
 */
@ccclass('CentralMenu')
export class CentralMenu extends Component {
    @property({ type: Button, tooltip: '第1组按钮' })
    button1: Button | null = null;
    @property({ type: Node, tooltip: '第1组面板' })
    panel1: Node | null = null;

    @property({ type: Button, tooltip: '第2组按钮' })
    button2: Button | null = null;
    @property({ type: Node, tooltip: '第2组面板' })
    panel2: Node | null = null;

    @property({ type: Button, tooltip: '第3组按钮' })
    button3: Button | null = null;
    @property({ type: Node, tooltip: '第3组面板' })
    panel3: Node | null = null;

    @property({ type: Button, tooltip: '第4组按钮（预留）' })
    button4: Button | null = null;
    @property({ type: Node, tooltip: '第4组面板（预留）' })
    panel4: Node | null = null;

    @property({ type: Button, tooltip: '第5组按钮（预留）' })
    button5: Button | null = null;
    @property({ type: Node, tooltip: '第5组面板（预留）' })
    panel5: Node | null = null;

    @property({ type: Button, tooltip: '第6组按钮（预留）' })
    button6: Button | null = null;
    @property({ type: Node, tooltip: '第6组面板（预留）' })
    panel6: Node | null = null;

    @property({ type: Button, tooltip: '第7组按钮（预留）' })
    button7: Button | null = null;
    @property({ type: Node, tooltip: '第7组面板（预留）' })
    panel7: Node | null = null;

    start() {
        this.initPanelsHidden();
        this.bindButtons();
    }

    private getPanels(): Array<Node | null> {
        return [this.panel1, this.panel2, this.panel3, this.panel4, this.panel5, this.panel6, this.panel7];
    }

    private getButtons(): Array<Button | null> {
        return [this.button1, this.button2, this.button3, this.button4, this.button5, this.button6, this.button7];
    }

    private initPanelsHidden(): void {
        for (const p of this.getPanels()) {
            if (p?.isValid) p.active = false;
        }
    }

    private bindButtons(): void {
        const buttons = this.getButtons();
        const panels = this.getPanels();
        for (let i = 0; i < 7; i++) {
            const btn = buttons[i];
            const panel = panels[i];
            if (!btn || !panel) continue;

            btn.node.on(Button.EventType.CLICK, () => {
                this.togglePanelByIndex(i);
            }, this);
        }
    }

    private isManagedByGameMenu(node: Node | null): boolean {
        if (!node) return false;
        try {
            let current: Node | null = node;
            while (current) {
                const menu = current.getComponent(GameMenu);
                if (menu) return true;
                current = current.parent;
            }
            return false;
        } catch {
            return false;
        }
    }

    private togglePanelByIndex(index: number): void {
        const panels = this.getPanels();
        const currentPanel = panels[index];
        if (!currentPanel) return;

        // 始终打开目标面板，并关闭其他面板（避免重复绑定导致“打开后又被关回去”）
        currentPanel.active = true;
        for (let i = 0; i < panels.length; i++) {
            if (i !== index && panels[i]) {
                panels[i]!.active = false;
            }
        }
    }
}

