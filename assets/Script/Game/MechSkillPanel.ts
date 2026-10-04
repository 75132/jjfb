import { _decorator, Component, Node, Label, Sprite, instantiate } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { Logger } from '../global/Logger';
import { applySkillIcon } from './SkillIconAtlas';

const { ccclass } = _decorator;

/**
 * MechSkill —— 机甲「技能」面板（RobotPanel 的第三个功能面板）。
 *
 * 节点约定（由美术在编辑器里搭好，运行时按名字查找，**本组件不需要在编辑器挂任何引用**）：
 *
 *     MechSkill                     ← 本组件挂在这个节点上（或由 RobotAttributePanel 运行时挂载）
 *       └─ BG
 *            └─ Skill1              ← 技能槽（模板，可复制出 Skill2 / Skill3 …）
 *                 ├─ Icon           （cc.Sprite）技能图标
 *                 ├─ SkillName      （cc.Label） 技能名字
 *                 ├─ Level          （cc.Label） 静态标题「【等级】」
 *                 └─ SkillLevel     （cc.Label） 技能等级数字
 *
 * 数据来源（服务端权威）：
 *   - `skill_list`  → 该机甲**已学且可主动施放**的技能（含 iconIndex / level / 能量消耗 / 可用性）
 *   - 技能图标 = 图集 `assets/resources/SkillIcon/SkillIcon` 的帧 `skill_1`…`skill_5`
 *     （分类口径见 `tools/skill_category_todo.md`；帧名来自 Skills.json 的 `iconIndex`）
 *     → 加载 / 取帧统一走 `SkillIconAtlas`，与战斗技能选择面板 `SkillSelectPanel` **共用同一份缓存与口径**。
 *
 * 零挂载说明：图集已移入 `assets/resources/`，用 `resources.load` 取；节点靠名字递归查找；
 *   组件若不在场景里，`RobotAttributePanel` 会在需要时 `addComponent` 自动挂上。
 */
@ccclass('MechSkillPanel')
export class MechSkillPanel extends Component {
    /** 当前展示的机甲 pet_id */
    private petId: string | null = null;
    /** 已渲染的技能（用于避免同一机甲重复请求） */
    private renderedPetId: string | null = null;
    /** 请求进行中标志（防连点重复请求） */
    private requesting = false;
    /**
     * 已创建的实例登记表。
     * ⚠ 面板节点默认 `active=false`，`getComponentInChildren` **遍历不到未激活节点**，
     *   所以背包用完技能书后要靠这张表找到面板并刷新（否则得等下次切页才更新）。
     */
    private static _instances: MechSkillPanel[] = [];
    /**
     * 技能槽之间的垂直间距（像素，用户约定）：
     * 技能多于已有槽位时，**往下复制一份，y 轴减 50** → 新槽 y = 上一个槽 y − 50。
     */
    private static readonly SLOT_STEP_Y = 50;

    /**
     * 背包「使用技能书」成功后调用：刷新该机甲的技能面板。
     * @param petId 指定机甲；不传则刷新所有面板
     */
    public static refreshForPet(petId?: string | null): void {
        const want = petId === undefined || petId === null || String(petId).trim() === ''
            ? null
            : String(petId).trim();
        for (const p of MechSkillPanel._instances) {
            if (!p || !p.isValid) continue;
            if (want && p.getPetId() !== want) continue;
            try {
                p.refresh();
            } catch (err) {
                Logger.warn('[MechSkillPanel] refreshForPet 异常:', err);
            }
        }
    }
    /** 槽位节点缓存：索引 → { node, icon, name, level } */
    private slots: Array<{ node: Node; icon: Sprite | null; name: Label | null; level: Label | null }> = [];
    /** 槽位模板（第一个槽，用于克隆出更多槽） */
    private slotTemplate: Node | null = null;

    // ========== 对外接口 ==========

    /**
     * 设置要展示的机甲并刷新。
     * @param petId 机甲 pet_id；传空则清空面板
     */
    public setPetId(petId: string | null | undefined): void {
        const wanted = petId !== null && petId !== undefined && String(petId).trim() !== ''
            ? String(petId).trim()
            : null;
        this.petId = wanted;
        if (!wanted) {
            this.clearSlots();
            this.renderedPetId = null;
            return;
        }
        this.requestSkills(wanted);
    }

    /** 强制重新拉取（技能升级后用） */
    public refresh(): void {
        if (this.petId) this.requestSkills(this.petId, true);
    }

    public getPetId(): string | null {
        return this.petId;
    }

    onLoad(): void {
        if (MechSkillPanel._instances.indexOf(this) < 0) {
            MechSkillPanel._instances.push(this);
        }
    }

    onDestroy(): void {
        const i = MechSkillPanel._instances.indexOf(this);
        if (i >= 0) MechSkillPanel._instances.splice(i, 1);
    }

    onEnable(): void {
        // 面板被打开时若已有目标机甲且数据不是最新的，补一次刷新
        if (this.petId && this.renderedPetId !== this.petId) {
            this.requestSkills(this.petId);
        }
    }

    // ========== 请求 & 渲染 ==========

    private requestSkills(petId: string, force: boolean = false): void {
        if (!force && this.renderedPetId === petId && this.slots.length > 0) return;
        if (this.requesting) return;

        const ws = WebSocketManager.getInstance();
        if (!ws) {
            Logger.warn('[MechSkillPanel] WebSocketManager 不可用，跳过技能列表请求');
            return;
        }

        this.requesting = true;
        try {
            ws.request(
                GameConfig.MESSAGE_TYPES.SKILL_LIST,
                { pet_id: petId },
                (resp: any) => {
                    this.requesting = false;
                    // 快速切换机甲时丢弃晚到的响应
                    if (this.petId !== petId) return;
                    if (!resp || resp.success === false) {
                        Logger.warn(`[MechSkillPanel] skill_list 失败: ${resp && (resp.message || resp.error)}`);
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
            Logger.warn('[MechSkillPanel] 请求技能列表异常:', err);
        }
    }

    /** 把技能列表渲染进槽位 */
    private render(list: any[]): void {
        const slots = this.ensureSlots(list.length);
        if (slots.length === 0) {
            Logger.warn('[MechSkillPanel] 没找到技能槽节点（期望 MechSkill/BG/Skill1…，槽内含 Icon/SkillName/SkillLevel）');
            return;
        }
        if (list.length === 0) {
            // 0 条是**正常状态**：机甲初始 / 获得时没有技能，用技能书学会后才会出现
            Logger.info('[MechSkillPanel] 该机甲尚未学会任何技能（技能书学会后自动出现）');
        }

        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const data = list[i];
            if (!data) {
                // 多余槽位隐藏，不做假数据
                slot.node.active = false;
                continue;
            }
            slot.node.active = true;
            if (slot.name) slot.name.string = String(data.name || '');
            if (slot.level) slot.level.string = String(Number(data.level) || 1);
            this.applyIcon(slot.icon, data);
        }
        Logger.info(`[MechSkillPanel] 渲染技能 ${list.length} 条（槽位 ${slots.length} 个）`);
    }

    /**
     * 设置图标：图集帧名 = skill.iconIndex（缺省 skill_1）。
     * 图集的加载 / 取帧 / 回退统一走 `SkillIconAtlas`（与战斗技能选择面板共用同一份缓存）。
     */
    private applyIcon(sprite: Sprite | null, data: any): void {
        applySkillIcon(sprite, data && data.iconIndex);
    }

    // ========== 槽位管理 ==========

    /**
     * 保证至少有 count 个槽位。
     * 槽位节点 = 面板子树里形如 `Skill1` / `Skill2` … 的节点（按编号升序）。
     * 不够时**克隆第 1 个槽**追加（模板取自场景，样式一致）。
     */
    private ensureSlots(count: number): Array<{ node: Node; icon: Sprite | null; name: Label | null; level: Label | null }> {
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
            clone.setPosition(p.x, p.y - MechSkillPanel.SLOT_STEP_Y, p.z);
            this.slots.push(this.bindSlot(clone));
        }
        return this.slots;
    }

    /** 绑定一个槽节点的 3 个显示子节点 */
    private bindSlot(node: Node): { node: Node; icon: Sprite | null; name: Label | null; level: Label | null } {
        return {
            node,
            icon: this.childComponent(node, 'Icon', Sprite),
            name: this.childComponent(node, 'SkillName', Label),
            level: this.childComponent(node, 'SkillLevel', Label),
        };
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

    private clearSlots(): void {
        for (const s of this.slots) {
            if (s.node && s.node.isValid) s.node.active = false;
        }
    }
}
