import { _decorator, Component, Node, Label, Sprite, Button, Color, instantiate } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { Logger } from '../global/Logger';
import { applySkillIcon } from './SkillIconAtlas';
import * as SkillData from './SkillData';

const { ccclass } = _decorator;

/** 面板回调（由 `BattleScene` 注入；面板本身不认识战斗逻辑） */
export interface SkillSelectCallbacks {
    /** 点了「确认」：把选中技能交回调用方去施放（面板已自行关闭） */
    onConfirm?: (skillKey: string, skill: any) => void;
    /** 面板被关闭（点遮罩「返回」/ 外部调用 `close()`） */
    onClosed?: () => void;
}

/** 一个技能槽（节点 + 需要改写的子节点 + 点击回调引用，便于 off） */
interface SlotRef {
    node: Node;
    sprite: Sprite | null;
    icon: Sprite | null;
    name: Label | null;
    level: Label | null;
    handler: (() => void) | null;
}

/**
 * SkillSelectPanel —— 战斗内「选择机甲技能」面板（BattleScene/SkillSelect）。
 *
 * 节点约定（编辑器里搭好，运行时按名字递归查找，**本组件不需要在编辑器挂任何引用**）：
 *
 *     SkillSelect                 ← 本组件挂在这个节点上（或由 BattleScene 运行时挂载）
 *       ├─ Mask        (Button)   ← 点空白处 = 「返回」→ 关闭面板
 *       ├─ BG1 / BG2
 *       ├─ Skill1      (Button)   ← 技能槽模板（含 Icon / SkillName / Level / SkillLevel）
 *       │    ├─ Icon      （cc.Sprite）技能图标
 *       │    ├─ SkillName （cc.Label） 技能名字
 *       │    ├─ Level     （cc.Label） 静态「【等级】」
 *       │    └─ SkillLevel（cc.Label） 技能等级数字
 *       ├─ Title       （cc.Label）标题「选择机甲技能」
 *       └─ Confirm     (Button)   ← **选中技能后才出现**；点击 = 用该技能攻击
 *
 * 与机甲面板（`MechSkillPanel`）的关系：
 *   - **同构**：技能槽命名、槽内子节点、图标口径（`SkillIcon/skill_N`）、
 *     「槽位不够就往**下**复制一份、y 轴 − 50」的排布规则完全一致；
 *   - 差异：这里多一层「**选中 → 确认**」交互（Confirm 初始隐藏），
 *     多一个「已学但能量不足」的置灰态（`usable === false`）。
 *
 * 数据来源：服务端 `skill_list`（**默认只列该机甲已学且可主动施放**的技能）。
 * ⚠ 机甲初始 / 获得时没有技能 → 列表为空是**正常状态**（面板标题会改提示语）。
 */
@ccclass('SkillSelectPanel')
export class SkillSelectPanel extends Component {
    /** 技能槽之间的垂直间距（像素，与机甲面板同口径）：新槽 y = 上一个槽 y − 50 */
    private static readonly SLOT_STEP_Y = 50;
    /**
     * 面板根节点的**直接**子节点里必须存在的关键节点（缺任一 → 本组件挂错节点）。
     *
     * ⚠ 必须用**直接子节点**判定：下面找节点用的是递归查找，所以把本组件误挂到
     *   `BattleScene` 这类父节点上时，一样能"找到" `SkillSelect/Mask`；
     *   一旦绑上，点遮罩就会走 `close()` → `this.node.active = false`
     *   → **把整个战斗面板关掉**（2026-09-30 实际踩到的 bug）。
     */
    private static readonly PANEL_ROOT_MARKERS = ['Mask', 'Confirm'];
    /** 默认标题（0 条时替换为 EMPTY_TITLE，重新有数据后还原） */
    public static readonly DEFAULT_TITLE = '选择机甲技能';
    public static readonly EMPTY_TITLE = '尚未学会任何技能';

    private static readonly TINT_NORMAL = new Color(255, 255, 255, 255);
    private static readonly TINT_SELECTED = new Color(255, 214, 102, 255);
    private static readonly TINT_DISABLED = new Color(140, 140, 140, 255);

    // ========== 状态 ==========
    private petId: string | null = null;
    private renderedPetId: string | null = null;
    private requesting = false;
    private opened = false;
    /** 已渲染的技能数据（与 slots 同序） */
    private list: any[] = [];
    /** 当前选中的槽索引（−1 = 未选中 → Confirm 隐藏） */
    private selectedIndex = -1;
    private callbacks: SkillSelectCallbacks = {};

    // ========== 节点引用 ==========
    private slots: SlotRef[] = [];
    private slotTemplate: Node | null = null;
    private maskButton: Button | null = null;
    private confirmButton: Button | null = null;
    private titleLabel: Label | null = null;
    private bindingsReady = false;
    private maskHandler: (() => void) | null = null;
    private confirmHandler: (() => void) | null = null;
    /** 面板根判定是否已做过（一次性；结果缓存在 rootOk） */
    private rootChecked = false;
    private rootOk = false;

    // ========== 生命周期 ==========

    onLoad(): void {
        if (!this.ensurePanelRoot()) return;
        this.ensureBindings();
        this.resetSelection();
    }

    onDestroy(): void {
        this.unbindButtons();
    }

    // ========== 挂载位置自检 ==========

    /** 判定给定节点是不是「面板根」：按名字找的必须是它的**直接**子节点 */
    private static isPanelRoot(node: Node | null): boolean {
        if (!node || !node.isValid) return false;
        for (const marker of SkillSelectPanel.PANEL_ROOT_MARKERS) {
            if (!node.getChildByName(marker)) return false;
        }
        return true;
    }

    /**
     * 自检：本组件必须挂在面板根（`SkillSelect`）上。
     *
     * 挂错（例如被复制到 `BattleScene`）时：只打一条错误日志 + 运行期停用本副本，
     * **绝不去改 active**——否则那个副本会把父节点（整个战斗面板）关掉。
     * 这样任何误挂的副本都是「惰性」的，不会再出现"点空白处整个战斗面板消失"。
     */
    private ensurePanelRoot(): boolean {
        if (this.rootChecked) return this.rootOk;
        this.rootChecked = true;
        this.rootOk = SkillSelectPanel.isPanelRoot(this.node);
        if (!this.rootOk) {
            Logger.error(
                `[SkillSelectPanel] 组件挂在「${this.node ? this.node.name : '?'}」上，`
                + `但它不是技能选择面板根节点（直接子节点缺少 ${SkillSelectPanel.PANEL_ROOT_MARKERS.join(' / ')}）`
                + '→ 本副本已停用。请把组件挂在 SkillSelect 节点上，并从父节点（如 BattleScene）移除这个多余副本。',
            );
            this.enabled = false;
        }
        return this.rootOk;
    }

    // ========== 对外接口 ==========

    public isOpen(): boolean {
        return this.opened;
    }

    /**
     * 打开面板并拉取该机甲的技能列表。
     * @param petId     出战机甲 pet_id（缺省则只显示空面板）
     * @param callbacks 确认 / 关闭回调
     */
    public open(petId: string | null | undefined, callbacks: SkillSelectCallbacks = {}): void {
        // 挂错节点的副本一律拒绝（否则它的 close/active 会波及父节点）
        if (!this.ensurePanelRoot()) return;
        const wanted = (petId === null || petId === undefined || String(petId).trim() === '')
            ? null
            : String(petId).trim();
        this.callbacks = callbacks || {};
        this.petId = wanted;
        this.opened = true;
        this.node.active = true;
        this.ensureBindings();
        this.resetSelection();
        if (!wanted) {
            Logger.warn('[SkillSelectPanel] open 缺少 pet_id，无法拉取技能列表');
            this.render([]);
            return;
        }
        this.requestSkills(wanted, true);
    }

    /**
     * 关闭面板（清空选中 / 隐藏 Confirm）。
     * @param notify 是否触发 `onClosed`（内部关闭 / 已确认时传 false，避免递归）
     */
    public close(notify: boolean = true): void {
        // ⚠ 关键守卫：挂错节点的副本**绝不能**执行 `node.active = false`
        //   （它的 node 可能是 BattleScene → 会把整个战斗面板关掉）
        if (!this.ensurePanelRoot()) {
            this.opened = false;
            return;
        }
        const wasOpen = this.opened;
        this.opened = false;
        this.resetSelection();
        this.updateTitle(this.list.length);   // 清掉「能量不足」之类的临时提示
        if (this.node && this.node.isValid) this.node.active = false;
        if (notify && wasOpen) {
            const cb = this.callbacks.onClosed;
            if (cb) {
                try { cb(); } catch (err) { Logger.warn('[SkillSelectPanel] onClosed 异常:', err); }
            }
        }
    }

    /** 强制重新拉取（战斗中能量变化 / 学会新技能后） */
    public refresh(): void {
        if (this.petId) this.requestSkills(this.petId, true);
    }

    public getPetId(): string | null {
        return this.petId;
    }

    /** 当前选中的技能数据（未选中返回 null） */
    public getSelectedSkill(): any | null {
        return this.selectedIndex >= 0 ? (this.list[this.selectedIndex] || null) : null;
    }

    // ========== 交互绑定 ==========

    /** 绑定遮罩（返回）与确认按钮（幂等，只绑一次） */
    private ensureBindings(): void {
        if (this.bindingsReady) return;
        if (!this.node || !this.node.isValid) return;

        const maskNode = this.findChildByName(this.node, 'Mask');
        if (maskNode) {
            this.maskButton = maskNode.getComponent(Button);
            this.maskHandler = () => this.close(true);
            if (this.maskButton) {
                this.maskButton.node.on(Button.EventType.CLICK, this.maskHandler, this);
            } else {
                // 没挂 Button 也能点：退化为触摸结束（保证「返回」一定可用）
                maskNode.on(Node.EventType.TOUCH_END, this.maskHandler, this);
            }
        } else {
            Logger.warn('[SkillSelectPanel] 没找到遮罩节点 Mask（点击空白处关闭将不可用）');
        }

        const confirmNode = this.findChildByName(this.node, 'Confirm');
        if (confirmNode) {
            this.confirmButton = confirmNode.getComponent(Button);
            this.confirmHandler = () => this.onConfirmClicked();
            if (this.confirmButton) {
                this.confirmButton.node.on(Button.EventType.CLICK, this.confirmHandler, this);
            } else {
                confirmNode.on(Node.EventType.TOUCH_END, this.confirmHandler, this);
            }
            confirmNode.active = false;   // 未选中技能前不显示
        } else {
            Logger.warn('[SkillSelectPanel] 没找到确认按钮 Confirm（将只能用遮罩取消）');
        }

        const titleNode = this.findChildByName(this.node, 'Title');
        if (titleNode) {
            this.titleLabel = this.childComponent(titleNode, 'Label', Label) || titleNode.getComponent(Label);
        }

        this.bindingsReady = true;
    }

    private unbindButtons(): void {
        if (this.maskButton && this.maskButton.node && this.maskHandler) {
            this.maskButton.node.off(Button.EventType.CLICK, this.maskHandler, this);
        }
        if (this.confirmButton && this.confirmButton.node && this.confirmHandler) {
            this.confirmButton.node.off(Button.EventType.CLICK, this.confirmHandler, this);
        }
        for (const slot of this.slots) {
            if (slot.handler) slot.node.off(Button.EventType.CLICK, slot.handler);
        }
    }

    /** 点「确认」：把选中技能交回调用方（先关面板，再回调，避免二次点击） */
    private onConfirmClicked(): void {
        const skill = this.getSelectedSkill();
        if (!skill) {
            Logger.warn('[SkillSelectPanel] 未选中技能，确认被忽略');
            return;
        }
        const cb = this.callbacks.onConfirm;
        this.close(false);
        if (cb) {
            try {
                cb(String(skill.key), skill);
            } catch (err) {
                Logger.error('[SkillSelectPanel] onConfirm 异常:', err);
            }
        }
    }

    /**
     * 点某个技能槽：选中它（不直接施放）；不可用（能量不足）的技能只提示、不选中。
     * 槽索引从**节点名**解析（`Skill2` → 索引 1），避免克隆顺序与闭包错位。
     */
    private selectSlot(node: Node | null): void {
        if (!node || !node.isValid) return;
        const m = /^Skill(\d+)$/.exec(node.name);
        const index = m ? Number(m[1]) - 1 : -1;
        if (index < 0 || index >= this.list.length) {
            Logger.warn(`[SkillSelectPanel] 点击了无数据的技能槽「${node.name}」`);
            return;
        }
        const data = this.list[index];
        if (data && data.usable === false) {
            const reason = data.reason || '当前无法使用该技能';
            Logger.warn(`[SkillSelectPanel] 「${data.name}」不可用：${reason}`);
            this.flashTitle(`${data.name}：${reason}`);
            return;
        }
        this.selectedIndex = index;
        this.updateTitle(this.list.length);   // 还原标题（清掉上一次的「能量不足」提示）
        this.syncSlotTints();
        this.syncConfirmVisibility();
        Logger.info(`[SkillSelectPanel] 已选中技能「${data?.name}」(key=${data?.key})`);
    }

    /** 选中态切换：Confirm 只在「有选中技能」时出现 */
    private syncConfirmVisibility(): void {
        if (this.confirmButton && this.confirmButton.node && this.confirmButton.node.isValid) {
            this.confirmButton.node.active = this.selectedIndex >= 0;
        } else {
            const n = this.findChildByName(this.node, 'Confirm');
            if (n) n.active = this.selectedIndex >= 0;
        }
    }

    private resetSelection(): void {
        this.selectedIndex = -1;
        this.syncConfirmVisibility();
        this.syncSlotTints();
    }

    /** 槽位着色：选中 = 高亮；不可用 = 置灰；其余 = 白 */
    private syncSlotTints(): void {
        for (let i = 0; i < this.slots.length; i++) {
            const sprite = this.slots[i].sprite;
            if (!sprite || !sprite.isValid) continue;
            if (i === this.selectedIndex) {
                sprite.color = SkillSelectPanel.TINT_SELECTED;
            } else if (this.list[i] && this.list[i].usable === false) {
                sprite.color = SkillSelectPanel.TINT_DISABLED;
            } else {
                sprite.color = SkillSelectPanel.TINT_NORMAL;
            }
        }
    }

    /** 标题临时提示（「能量不足」等）：**不用定时器**，下次成功选中 / 重新渲染 / 关闭时自动还原 */
    private flashTitle(text: string): void {
        this.updateTitle(-1, text);
    }

    private updateTitle(count: number, override?: string): void {
        if (!this.titleLabel || !this.titleLabel.isValid) return;
        if (override !== undefined) {
            this.titleLabel.string = override;
            return;
        }
        this.titleLabel.string = count > 0
            ? SkillSelectPanel.DEFAULT_TITLE
            : SkillSelectPanel.EMPTY_TITLE;
    }

    // ========== 请求 & 渲染 ==========

    private requestSkills(petId: string, force: boolean = false): void {
        if (!force && this.renderedPetId === petId && this.list.length > 0) return;
        if (this.requesting) return;

        const ws = WebSocketManager.getInstance();
        if (!ws) {
            Logger.warn('[SkillSelectPanel] WebSocketManager 不可用，跳过技能列表请求');
            return;
        }

        this.requesting = true;
        try {
            ws.request(
                GameConfig.MESSAGE_TYPES.SKILL_LIST,
                { pet_id: petId },
                (resp: any) => {
                    this.requesting = false;
                    // 面板已关闭 / 已切机甲 → 丢弃晚到的响应
                    if (this.petId !== petId || !this.opened) return;
                    if (!resp || resp.success === false) {
                        Logger.warn(`[SkillSelectPanel] skill_list 失败: ${resp && (resp.message || resp.error)}`);
                        this.render([]);
                        return;
                    }
                    const data = resp.data || resp;
                    const list: any[] = Array.isArray(data && data.skills) ? data.skills : [];
                    this.render(list);
                    this.renderedPetId = petId;
                },
                true,     // 需要认证
                10000,
            );
        } catch (err) {
            this.requesting = false;
            Logger.warn('[SkillSelectPanel] 请求技能列表异常:', err);
        }
    }

    /** 把技能列表渲染进槽位 */
    private render(list: any[]): void {
        this.list = Array.isArray(list) ? list : [];
        const slots = this.ensureSlots(this.list.length);
        if (slots.length === 0) {
            Logger.warn('[SkillSelectPanel] 没找到技能槽节点（期望 SkillSelect/Skill1…，槽内含 Icon/SkillName/SkillLevel）');
            return;
        }

        this.selectedIndex = -1;
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const data = this.list[i];
            if (!data) {
                slot.node.active = false;   // 多余槽位隐藏，不做假数据
                continue;
            }
            slot.node.active = true;
            if (slot.name) slot.name.string = String(data.name || '');
            if (slot.level) slot.level.string = String(Number(data.level) || 1);
            applySkillIcon(slot.icon, data.iconIndex);
        }
        this.updateTitle(this.list.length);
        this.syncSlotTints();
        this.syncConfirmVisibility();
        if (this.list.length === 0) {
            // 0 条是正常状态：机甲还没学会技能（技能书学会后才有）
            Logger.info('[SkillSelectPanel] 该机甲尚未学会任何技能');
        } else {
            Logger.info(`[SkillSelectPanel] 渲染技能 ${this.list.length} 条（槽位 ${slots.length} 个）`);
        }
    }

    // ========== 槽位管理 ==========

    /**
     * 保证至少有 count 个槽位。
     * 槽位节点 = 面板子树里形如 `Skill1` / `Skill2` … 的节点（按编号升序）。
     * 不够时**克隆第 1 个槽**追加（模板取自场景，样式一致），并**往下 y − 50**。
     */
    private ensureSlots(count: number): SlotRef[] {
        if (this.slots.length === 0) {
            const found = this.findSlotNodes();
            if (found.length === 0) return [];
            this.slotTemplate = found[0];
            this.slots = found.map((n) => this.bindSlot(n));
        }
        while (this.slots.length < count && this.slotTemplate) {
            const parent = this.slotTemplate.parent;
            if (!parent) break;
            const prev = this.slots[this.slots.length - 1].node;
            const clone = instantiate(this.slotTemplate);
            clone.name = `Skill${this.slots.length + 1}`;
            clone.active = true;
            parent.addChild(clone);
            // 往下复制一份：y 轴 − 50（基于**上一个**槽而非模板，连续复制才逐级递减）
            const p = prev.position;
            clone.setPosition(p.x, p.y - SkillSelectPanel.SLOT_STEP_Y, p.z);
            this.slots.push(this.bindSlot(clone));
        }
        return this.slots;
    }

    /** 绑定一个槽节点：3 个显示子节点 + 点击事件 */
    private bindSlot(node: Node): SlotRef {
        const sprite = node.getComponent(Sprite);
        const handler = () => this.selectSlot(node);
        const ref: SlotRef = {
            node,
            sprite,
            icon: this.childComponent(node, 'Icon', Sprite),
            name: this.childComponent(node, 'SkillName', Label),
            level: this.childComponent(node, 'SkillLevel', Label),
            handler,
        };
        // 槽索引由节点名在回调里解析，所以所有槽可以共用同一段逻辑
        node.on(Button.EventType.CLICK, handler);
        return ref;
    }

    /** 递归找出所有形如 Skill{N} 的槽节点，按 N 升序 */
    private findSlotNodes(): Node[] {
        const out: Array<{ node: Node; num: number }> = [];
        const walk = (n: Node) => {
            for (const c of n.children) {
                const m = /^Skill(\d+)$/.exec(c.name);
                if (m) out.push({ node: c, num: Number(m[1]) });
                walk(c);
            }
        };
        walk(this.node);
        out.sort((a, b) => a.num - b.num);
        return out.map((x) => x.node);
    }

    /** 找直接/间接子节点里的首个组件（按名字精确匹配，找不到返回 null） */
    private childComponent<T extends Component>(root: Node, name: string, comp: new () => T): T | null {
        const hit = this.findChildByName(root, name);
        return hit ? hit.getComponent(comp) : null;
    }

    /** 递归找子节点（先同级再深入；找不到返回 null） */
    private findChildByName(parent: Node, name: string): Node | null {
        for (const c of parent.children) {
            if (c.name === name) return c;
        }
        for (const c of parent.children) {
            const deep = this.findChildByName(c, name);
            if (deep) return deep;
        }
        return null;
    }
}
