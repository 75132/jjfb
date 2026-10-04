import { _decorator, Component, Node, Sprite, SpriteFrame, Animation, AnimationClip, Label, UITransform, tween, Tween, UIOpacity, JsonAsset, instantiate, Vec3, Color } from 'cc';
import { ResourceManager } from './ResourceManager';
import { Logger } from '../global/Logger';

const { ccclass, property } = _decorator;

type EquipSlot = 'Weapon' | 'Gun' | 'Dun' | 'Wing';

interface EquipConfig {
    id: number | string;
    img?: number | string;
}

@ccclass('RobotShow')
export class RobotShow extends Component {
    // 机体本体（动画在这里）
    @property({ type: Node, tooltip: '机甲本体节点（挂有 Animation 的那个 Robot 节点）' })
    body: Node | null = null;

    // 四个装备图标节点（按预制体子节点命名）
    @property({ type: Node, tooltip: '武器图标节点（Weapon）' })
    weaponIcon: Node | null = null;

    @property({ type: Node, tooltip: '枪械图标节点（Gun）' })
    gunIcon: Node | null = null;

    @property({ type: Node, tooltip: '盾牌图标节点（Dun）' })
    dunIcon: Node | null = null;

    @property({ type: Node, tooltip: '机翼图标节点（Wing）' })
    wingIcon: Node | null = null;

    /** 伤害/治疗数字父节点（空节点，下有 1 个精灵模板 Sprite，按位数复制显示） */
    @property({ type: Node, tooltip: 'Number 空节点，其下 1 个精灵模板，按伤害位数复制并居中对齐' })
    numberNode: Node | null = null;

    /**
     * 技能特效节点（预制体内名为 Skill，挂着 cc.Animation，播放列表已拖入全部技能动画）。
     * 默认隐藏；播放技能时临时激活，播完自动隐藏。
     */
    @property({ type: Node, tooltip: '技能特效节点 Skill（挂 Animation，默认隐藏；播放技能时临时显示）' })
    skillNode: Node | null = null;

    // ==== 静态缓存：配表 + 图集 ====
    private static configsLoaded = false;
    private static weaponConfig: Map<number, EquipConfig> = new Map();
    private static gunConfig: Map<number, EquipConfig> = new Map();
    private static dunConfig: Map<number, EquipConfig> = new Map();
    private static wingConfig: Map<number, EquipConfig> = new Map();

    // 直接数组按索引取；同时建立 name->frame 映射，避免 loadDir 顺序乱导致贴图错位
    private static weaponFrames: SpriteFrame[] | null = null;
    private static gunFrames: SpriteFrame[] | null = null;
    private static dunFrames: SpriteFrame[] | null = null;
    private static wingFrames: SpriteFrame[] | null = null;

    private static weaponFrameMap: Map<number, SpriteFrame> = new Map();
    private static gunFrameMap: Map<number, SpriteFrame> = new Map();
    private static dunFrameMap: Map<number, SpriteFrame> = new Map();
    private static wingFrameMap: Map<number, SpriteFrame> = new Map();

    // 装备位置数据：AniID -> 装备类型 -> 装备ID -> {x, y}
    private static equipPositions: Map<string, Map<string, Map<number, {x: number, y: number}>>> = new Map();

    // 伤害/治疗数字图（NumberIcon：Damage-0～9, bloodreturning-0～9）
    private static numberFramesMap: Map<string, SpriteFrame> = new Map();
    private static numberFramesLoaded = false;

    /** 数字精灵模板（Number 下唯一的 Sprite 子节点，复制用） */
    private digitTemplateNode: Node | null = null;
    /** 当前在飞的伤害数字「容器」节点（每次攻击一个独立容器，互不干扰，形成连击轨迹） */
    private activeDamageNodes: Node[] = [];
    /** 兼容旧字段：当前正在跑的 tween 列表 */
    private damageTween: Tween<any> | null = null;
    /** 战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel/CurrentHP/NumericalValue） */
    private battleBarMap: Map<string, { bar: Node | null; label: Label | null }> = new Map();

    /**
     * 从 equip_position.json 中查找位置：
     * - 先精确匹配 AniID
     * - 再做常见归一化（trim/去扩展名/截断分隔符）
     * - 最后做前缀匹配兜底（例如 AniID= "xm_L3_idle" 命中 "xm_L3"）
     */
    private static resolveEquipPosition(
        aniId: string | undefined,
        slotName: EquipSlot,
        spriteIndex: number
    ): { pos?: { x: number; y: number }; matchedAniId?: string } {
        if (!aniId) return {};
        const raw = String(aniId);
        const candidates: string[] = [];

        const push = (s: string) => {
            const v = s?.trim();
            if (!v) return;
            // 兼容较低 TS lib：不用 Array.prototype.includes
            if (candidates.indexOf(v) === -1) candidates.push(v);
        };

        // 1) 原始值
        push(raw);

        // 2) 去掉常见扩展名/参数
        //    e.g. "xm_L3.anim" / "xm_L3?x=1" / "xm_L3#tag"
        push(raw.split('?')[0]);
        push(raw.split('#')[0]);
        push(raw.split('.')[0]);

        // 3) 常见分隔符截断（避免服务端返回 "xm_L3_idle" 这类）
        const seps = ['@', '|', ':', ' ', '\t', '\n', '\r', '-', '_'];
        for (const sep of seps) {
            const idx = raw.indexOf(sep);
            if (idx > 0) push(raw.slice(0, idx));
        }

        // 精确匹配候选
        for (const key of candidates) {
            const aniMap = this.equipPositions.get(key);
            const typeMap = aniMap?.get(slotName);
            const pos = typeMap?.get(spriteIndex);
            if (pos) return { pos, matchedAniId: key };
        }

        // 前缀匹配兜底：jsonKey 是 aniId 的前缀 / 或 aniId 是 jsonKey 的前缀
        // （避免 AniID 拼接了动作名/等级名）
        for (const [jsonKey, aniMap] of this.equipPositions.entries()) {
            const a = raw.trim();
            if (!a) continue;
            if (!a.startsWith(jsonKey) && !jsonKey.startsWith(a)) continue;
            const typeMap = aniMap.get(slotName);
            const pos = typeMap?.get(spriteIndex);
            if (pos) return { pos, matchedAniId: jsonKey };
        }

        return {};
    }

    // 关键修复：缓存最后一次更新的数据，资源加载完成后重新应用
    private lastRobotData: any = null;
    private lastPetId: string | null = null; // 跟踪当前显示的机甲ID
    private applyReadyTimers: ReturnType<typeof setTimeout>[] = [];

    onLoad() {
        RobotShow.ensureConfigsLoaded();
        // 关键修复：清空 petId，确保新实例不会使用旧数据
        this.lastPetId = null;
        this.lastRobotData = null;
        this.initNumberDigits();
        this.initBattleBars();
    }

    /** 初始化伤害数字：取 Number 下唯一的精灵作为模板并隐藏 */
    private initNumberDigits(): void {
        const root = this.numberNode || this.node.getChildByName('Number') || null;
        if (!root) return;
        // 关键：Number 容器在 prefab 里默认 active=false。若父节点未激活，
        //   在其下运行时创建的 DamagePop 数字节点不会被渲染 → 战斗看不到伤害数字。
        root.active = true;
        this.numberNode = root;
        const template = root.getChildByName('Sprite') || root.children[0] || null;
        if (template) {
            this.digitTemplateNode = template;
            template.active = false; // 模板本体隐藏，仅用于 instantiate 复制
        }
    }

    /** 初始化战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel、CurrentHP、NumericalValue） */
    private initBattleBars(): void {
        const bars = [
            { key: 'HP', panel: 'HPpanel', cur: 'CurrentHP' },
            { key: 'MP', panel: 'MPpanel', cur: 'CurrentMP' },
        ];
        for (const item of bars) {
            const parent = this.node.getChildByName(item.key) || null;
            if (!parent) continue;
            const panel = parent.getChildByName(item.panel) || null;
            const barNode = panel?.getChildByName(item.cur) || null;
            const labelNode = panel?.getChildByName('NumericalValue') || null;
            const label = labelNode?.getComponent(Label) || null;
            if (barNode || label) this.battleBarMap.set(item.key, { bar: barNode || null, label });
        }
    }

    // ===== 对外接口 =====

    /**
     * 根据服务器返回的机甲数据更新展示
     * @param data robot_pet_info_response 的 data
     */
    public updateFromRobotData(data: any): void {
        if (!data) return;
        this.resetVisualState();

        // 关键修复：提取并保存 petId，用于验证数据是否匹配
        const rawPetId = data.pet_id ?? data.data?.pet_id;
        const petId = rawPetId !== undefined && rawPetId !== null ? String(rawPetId) : null;
        
        // 关键修复：如果 petId 发生变化，清空旧数据，避免显示错误的机甲
        if (this.lastPetId !== null && petId !== null && this.lastPetId !== petId) {
            Logger.debug(`⚠️ [RobotShow] petId 变化，清空旧数据 (旧: ${this.lastPetId}, 新: ${petId})`);
            this.lastRobotData = null;
        }

        // 如果当前已有有效的 petId，但本次数据缺失 petId，直接跳过，避免误覆盖
        if (this.lastPetId && !petId) {
            Logger.debug('⚠️ [RobotShow] 跳过更新：收到的数据缺少 petId，保持当前展示');
            return;
        }
        
        // 只有在提供了 petId 时才更新 lastPetId，避免被无效数据覆盖
        if (petId) {
            this.lastPetId = petId;
        }

        // 关键修复：缓存数据，即使资源未加载完成也保存
        this.lastRobotData = data;

        // 1. 播放机体动画（沿用 MechAttributeTEST 里的 AniID 逻辑）
        this.updateBodyAnimation(data);

        // 2. 更新装备图标（如果资源已加载）
        const equipment = data.equipment || data.data?.equipment || {};
        const aniId = data['AniID'] || '';
        this.updateEquipmentIcons(equipment, aniId);
        
        // 关键修复：如果资源还没加载完，设置重试检查，直到就绪（最多1秒）
        if (!this.areResourcesReady()) {
            Logger.debug(`⚠️ [RobotShow] 资源未加载完成，装备图标将在资源加载后更新 (pet_id: ${petId})`);
            this.scheduleApplyWhenReady(petId, 0);
        }
    }

    /** 恢复击破/渐变后的显示状态，避免连续多场战斗时机甲形象不可见 */
    public resetVisualState(): void {
        if (!this.node?.isValid) return;
        this.node.active = true;
        if (this.body?.isValid) this.body.active = true;
        const sprites = this.node.getComponentsInChildren(Sprite);
        sprites.forEach((s) => {
            if (!s?.node?.isValid) return;
            const c = s.color;
            s.color = new Color(c.r, c.g, c.b, 255);
        });
        // 技能特效按「默认隐藏」处理：新一场战斗开始时收掉上一场残留的 Skill 节点
        this.stopSkillEffect(true);
    }

    // ===== 战斗内：伤害数字 + 局内血条（仅战斗时显示） =====

    /** 数字存活时长（秒） */
    private static readonly DAMAGE_LIFE = 0.9;

    /**
     * 显示伤害/治疗数字（Arc 版）。
     * ------------------------------------------------------------------
     * 表现规则（用户口径 · 2026-09-28 更新）：
     *   - 每次调用**独立**生成一个数字容器，**不销毁**之前的数字 —— 支持「连续冒出」；
     *   - 数字从受击者身上**冒出**，然后沿**抛物线（弧形）**向受击者**身后**（被击退的方向）
     *     **倒退飞出**，一边飞一边淡出消失；
     *   - 攻击方在左 → 数字向右上抛出、向右下坠落（先上后下，弧线向右）；
     *     攻击方在右 → 数字向左上抛出、向左下坠落（弧线向左）。
     *   - 「自己方受击」同样适用：数字从自己身上向自己身后（远离攻击方）飞出。
     *
     * @param value      伤害/治疗值
     * @param isHeal     是否治疗（用 bloodreturning 图集）
     * @param dirX       水平方向（正=向右，负=向左；0=仅在原地弧线）
     * @param dirY       保留参数（弧形由重力自动生成，不再直接使用；兼容旧调用）
     * @param life       存活时长（秒，默认 0.9）
     */
    public showDamageNumber(value: number, isHeal: boolean = false,
                            dirX?: number, dirY?: number, life: number = RobotShow.DAMAGE_LIFE): void {
        // 整体 try/catch：伤害数字只是表现层，绝不能因为它抛异常而中断战斗结算链（会导致战斗卡死）
        try {
            this.showDamageNumberInternal(value, isHeal, dirX, dirY, life);
        } catch (e) {
            Logger.error('[RobotShow] showDamageNumber 异常（已吞掉，不影响战斗流程）:', e);
        }
    }

    private showDamageNumberInternal(value: number, isHeal: boolean,
                                     dirX?: number, dirY?: number, life: number = RobotShow.DAMAGE_LIFE): void {
        const parent = this.numberNode || this.node.getChildByName('Number');
        const template = this.digitTemplateNode;
        if (!parent || !template || !RobotShow.numberFramesLoaded) {
            Logger.warn(
                `[数字诊断] showDamageNumber 提前返回：parent=${!!parent} template=${!!template} framesLoaded=${RobotShow.numberFramesLoaded} value=${value}`
            );
            return;
        }
        // 双保险：确保容器激活（prefab 里 Number 默认 inactive）
        if (!parent.activeInHierarchy) parent.active = true;
        value = Math.max(0, Math.floor(value));
        const str = String(value);
        if (str.length === 0) return;

        // 每次攻击一个独立容器（不再复用单个节点，支持连续冒出）
        // 容器挂到 Number 自身：层级最简单最稳，避免跨层级坐标换算引入异常。
        //   Number 已由 initNumberDigits 保证存在且 active。
        const box = new Node('DamagePop');
        box.setParent(parent);
        // 起始点：Number 原点上方一点点（数字在受击者身上冒出）
        box.setPosition(0, 10, 0);
        box.setSiblingIndex(parent.children.length - 1); // 置顶
        const anchor = new Vec3(0, 10, 0);

        const prefix = isHeal ? 'bloodreturning-' : 'Damage-';
        const digitWidth = 24;
        const totalW = str.length * digitWidth;
        const digitStartX = -totalW / 2 + digitWidth / 2;

        const digits: Node[] = [];
        for (let i = 0; i < str.length; i++) {
            const d = str.charAt(i);
            const frame = RobotShow.numberFramesMap.get(prefix + d);
            if (!frame) continue;
            const clone = instantiate(template);
            clone.active = true;
            clone.setPosition(digitStartX + i * digitWidth, 0, 0);
            const sp = clone.getComponent(Sprite);
            if (sp) sp.spriteFrame = frame;
            const uiOpacity = clone.getComponent(UIOpacity) || clone.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
            box.addChild(clone);
            digits.push(clone);
        }
        if (digits.length === 0) {
            Logger.warn(`[数字诊断] showDamageNumber 无可用数字帧：value=${value} prefix=${prefix} mapSize=${RobotShow.numberFramesMap.size}`);
            box.destroy();
            return;
        }
        Logger.warn(`[数字诊断] 弹出数字 ${value} 位数=${digits.length} parentActive=${parent.activeInHierarchy} parentWorldPos=${parent.worldPosition.x.toFixed(0)},${parent.worldPosition.y.toFixed(0)}`);

        // 漂移方向：dirX 传「期望的屏幕方向」（+1=屏幕上向右，-1=向左）。
        //   数字节点挂在 Number 下，其局部 +x 方向在屏幕上可能被祖先的负 scale 翻转，
        //   这里用「Number 的世界矩阵 x 轴符号」把屏幕方向换算成局部方向，避免逐层猜 scale。
        const screenDir = (dirX === undefined || dirX === 0) ? -1 : (dirX > 0 ? 1 : -1);
        // 局部 +x 在屏幕上的朝向：>0 表示与屏幕同向，<0 表示反向
        const wm = parent.worldMatrix;
        const localXAxisOnScreen = (wm && wm.m00 < 0) ? -1 : 1;
        const sign = screenDir * localXAxisOnScreen;
        Logger.warn(`[方向诊断] 期望屏幕方向=${screenDir} 局部x轴屏幕朝向=${localXAxisOnScreen} → 局部sign=${sign}`);

        const dur = Math.max(0.25, life);
        // 效果：受击后数字从身上「向身后斜抛出去 → 到达最高点 → 自由下坠落地 → 消失」的小弧线。
        //   采用真抛物线：x(t)=vx·t（水平减速），y(t)=vy·t − ½g·t²（上抛后重力下坠）。
        const flightX = 46;   // 水平飞出总距离（像素，朝受击者身后）
        const arcH = 20;      // 弧线最高点相对起点的抬升（像素，小弧）
        const dropY = -14;    // 落点相对起点下沉（像素，负=向下）

        this.activeDamageNodes.push(box);
        Logger.warn(`[数字诊断] 创建数字节点 value=${value} 位数=${digits.length} 方向sign=${sign}`);

        // 单一代理 tween 驱动：水平位移 + 真抛物线弧线 + 淡出（避免多 tween 各自丢回调）
        const proxy = { p: 0 };
        const startX = anchor.x;
        const startY = anchor.y;
        let tw: Tween<any>;
        tw = tween(proxy)
            .to(dur, { p: 1 }, {
                easing: 'linear',
                onUpdate: () => {
                    if (!box.isValid) return;
                    const t = proxy.p;
                    // 水平：先快后慢（抛出感），缓出
                    const easeX = 1 - Math.pow(1 - t, 1.8);
                    const x = startX + sign * flightX * easeX;
                    // 垂直：抛物拱（最高点在 t=0.5）+ 整体下沉，形成「抛出→落底」弧线
                    //   arcH*4t(1-t) 为拱起项（两端 0，中间峰值）；t*dropY 让终点落地更低
                    const y = startY + arcH * 4 * t * (1 - t) + dropY * t;
                    box.setPosition(x, y, 0);
                    // 淡出：前半段全亮（看清数字），后半段淡出，落地即消失
                    const fade = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.5);
                    const opacity = Math.round(255 * fade);
                    digits.forEach((n) => {
                        if (!n.isValid) return;
                        const u = n.getComponent(UIOpacity);
                        if (u?.isValid) u.opacity = opacity;
                    });
                }
            })
            .call(() => {
                const idx = this.activeDamageNodes.indexOf(box);
                if (idx >= 0) this.activeDamageNodes.splice(idx, 1);
                if (box.isValid) box.destroy();
                if (this.damageTween === tw) this.damageTween = null;
                Logger.warn(`[数字诊断] 数字节点已销毁 value=${value}`);
            })
            .start();
        this.damageTween = tw;
    }

    /** 更新战斗血条与数值（与机甲属性面板一致）；仅当已显示血条时刷新 */
    public updateBattleBars(hp: number, maxHp: number, mp?: number, maxMp?: number): void {
        const BAR_MAX_WIDTH = 147;
        const setBar = (key: string, cur: number, max: number) => {
            const entry = this.battleBarMap.get(key);
            if (!entry) return;
            if (entry.label) entry.label.string = `${Math.max(0, Math.floor(cur))}/${Math.max(0, Math.floor(max))}`;
            if (entry.bar) {
                const percent = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
                const ui = entry.bar.getComponent(UITransform);
                if (ui) ui.setContentSize(Math.max(1, BAR_MAX_WIDTH * percent), ui.height);
            }
        };
        setBar('HP', hp, maxHp);
        if (mp !== undefined && maxMp !== undefined) setBar('MP', mp, maxMp);
    }

    /** 战斗时显示/隐藏局内血条（HP、MP 节点） */
    public setBattleBarsVisible(visible: boolean): void {
        const hpRoot = this.node.getChildByName('HP');
        const mpRoot = this.node.getChildByName('MP');
        if (hpRoot) hpRoot.active = visible;
        if (mpRoot) mpRoot.active = visible;
    }

    /**
     * 检查资源是否已加载完成
     */
    private areResourcesReady(): boolean {
        return RobotShow.weaponConfig.size > 0 && 
               RobotShow.gunConfig.size > 0 && 
               RobotShow.dunConfig.size > 0 && 
               RobotShow.wingConfig.size > 0 &&
               RobotShow.weaponFrames !== null &&
               RobotShow.gunFrames !== null &&
               RobotShow.dunFrames !== null &&
               RobotShow.wingFrames !== null;
    }

    /**
     * 应用缓存的数据（资源加载完成后调用）
     * @param expectedPetId 期望的机甲ID（可选，用于验证）
     */
    private applyCachedData(expectedPetId?: string | null): void {
        // 关键修复：验证 petId 是否匹配，防止显示错误的机甲
        if (expectedPetId !== undefined && expectedPetId !== null && this.lastPetId !== expectedPetId) {
            Logger.debug(`⚠️ [RobotShow] 跳过更新：petId 不匹配 (期望: ${expectedPetId}, 当前: ${this.lastPetId})`);
            return;
        }

        if (this.lastRobotData && this.areResourcesReady()) {
            Logger.debug(`✅ [RobotShow] 资源加载完成，重新应用缓存数据 (pet_id: ${this.lastPetId})`);
            const equipment = this.lastRobotData.equipment || this.lastRobotData.data?.equipment || {};
            const aniId = this.lastRobotData['AniID'] || '';
            this.updateEquipmentIcons(equipment, aniId);
        }
    }

    /**
     * 资源未就绪时，重复检查并应用缓存（最多重试5次，间隔递增）
     */
    private scheduleApplyWhenReady(expectedPetId: string | null, retry: number): void {
        if (retry >= 5) return; // 最多重试5次（~1秒）
        const handle = setTimeout(() => {
            const idx = this.applyReadyTimers.indexOf(handle);
            if (idx >= 0) this.applyReadyTimers.splice(idx, 1);
            if (!this.node?.isValid) return;
            // 再次确认petId匹配
            if (expectedPetId !== null && this.lastPetId !== expectedPetId) return;
            if (this.areResourcesReady()) {
                this.applyCachedData(expectedPetId);
            } else {
                // 递增延迟：100ms, 200ms, 300ms, 400ms, 500ms
                this.scheduleApplyWhenReady(expectedPetId, retry + 1);
            }
        }, 100 * (retry + 1));
        this.applyReadyTimers.push(handle);
    }

    // ===== 机体动画 =====

    private updateBodyAnimation(data: any): void {
        if (!this.body) return;
        const anim = this.body.getComponent(Animation);
        if (!anim) {
            return;
        }

        const clips: any[] = Array.isArray((anim as any).clips) ? (anim as any).clips : [];
        const aniID = data['AniID'] || '';

        if (aniID && typeof aniID === 'string') {
            const targetClip = clips.find((clip: any) => clip && clip.name === aniID);
            if (targetClip) {
                Logger.debug(`🎬 [RobotShow] 播放动画: ${aniID}`);
                anim.play(aniID);
                return;
            }
            // 预制体只静态挂了 Robot 的动画（如 bl_L2），怪物动画（如 kgml_L1 / tb_2_L3）
            // 不在其中 —— 必须运行时从 resources/Monster/ani 动态加载，
            // 否则会掉进下面的随机兜底，导致「每打一次换一个形象」。
            Logger.debug(`🔎 [RobotShow] 预制体无动画 ${aniID}，尝试动态加载`);
            this.loadAndPlayAnim(anim, aniID);
            return;
        }

        // 没有 AniID 时才随机兜底
        if (clips.length === 0) return;
        const idx = Math.floor(Math.random() * clips.length);
        const clip = clips[idx];
        if (clip && clip.name) {
            Logger.debug(`🎲 [RobotShow] 随机播放动画: ${clip.name}`);
            anim.play(clip.name);
        }
    }

    /** 已动态加载过的动画缓存：AniID -> AnimationClip */
    private static dynamicClipCache: Map<string, any> = new Map();
    /** 同一 AniID 的并发加载去重 */
    private static dynamicClipLoading: Map<string, ((clip: any) => void)[]> = new Map();

    /**
     * 运行时按 AniID 从 resources 加载 cc.AnimationClip 并挂到 Animation 组件上播放。
     * 资源来源：assets/resources/Monster/ani/{AniID}.anim（由 monster_port.py 双写生成）。
     */
    private loadAndPlayAnim(anim: Animation, aniID: string): void {
        const cached = RobotShow.dynamicClipCache.get(aniID);
        if (cached) {
            this.attachAndPlay(anim, aniID, cached);
            return;
        }

        const pending = RobotShow.dynamicClipLoading.get(aniID);
        if (pending) {
            pending.push((clip) => this.attachAndPlay(anim, aniID, clip));
            return;
        }
        RobotShow.dynamicClipLoading.set(aniID, [(clip) => this.attachAndPlay(anim, aniID, clip)]);

        const finish = (clip: any) => {
            const cbs = RobotShow.dynamicClipLoading.get(aniID) || [];
            RobotShow.dynamicClipLoading.delete(aniID);
            if (clip) RobotShow.dynamicClipCache.set(aniID, clip);
            cbs.forEach((cb) => cb && cb(clip));
        };

        ResourceManager.getInstance().loadAsset<AnimationClip>(
            `Monster/ani/${aniID}`,
            AnimationClip,
            (err, clip) => {
                if (err || !clip) {
                    Logger.warn(`⚠️ [RobotShow] 动态加载动画失败: ${aniID}`, err);
                    finish(null);
                    return;
                }
                Logger.debug(`✅ [RobotShow] 动态加载动画成功: ${aniID}`);
                finish(clip);
            }
        );
    }

    /** 把动态加载到的 clip 补进 Animation.clips 并播放 */
    private attachAndPlay(anim: Animation, aniID: string, clip: any): void {
        if (!anim || !anim.isValid || !clip) return;
        const clips: any[] = Array.isArray((anim as any).clips) ? (anim as any).clips : [];
        if (!clips.some((c: any) => c && c.name === aniID)) {
            clips.push(clip);
            (anim as any).clips = clips;
        }
        anim.play(aniID);
    }

    // ===== 技能特效（Skill 节点） =====

    /** Skill 节点的 Animation 组件缓存 */
    private _skillAnim: Animation | null = null;
    /** 本次技能播放的结束回调（注册在 Animation.EventType.FINISHED 上） */
    private _skillEndHandler: ((type: string, state: any) => void) | null = null;
    /** 兜底收尾调度：FINISHED 未触发时按时长强制隐藏，避免 Skill 节点一直显形 */
    private _skillFallback: (() => void) | null = null;

    /** 解析 Skill 节点：优先用属性绑定，其次按预制体固定节点名兜底 */
    private resolveSkillNode(): Node | null {
        if (this.skillNode && this.skillNode.isValid) return this.skillNode;
        const n = this.node?.getChildByName('Skill') || null;
        if (n) this.skillNode = n;
        return n;
    }

    /**
     * 播放技能特效：Skill 节点默认隐藏 → 播放时激活 → 播完自动隐藏。
     * ------------------------------------------------------------------
     * @param clipName  播放列表中的动画名（如 'quan01'），即 Image/Skill/ani/*.anim
     * @param playCount 播放遍数（普攻 quan01 传 2，即连播两遍）
     * @param onDone    特效播完回调（**纯表现层，不参与战斗结算**，省略亦可）
     *
     * 设计要点：整个方法 try/catch，任何异常都只记日志 —— 特效绝不能拖垮战斗结算链。
     */
    public playSkillEffect(clipName: string, playCount: number = 1, onDone?: () => void): void {
        try {
            const node = this.resolveSkillNode();
            if (!node) {
                Logger.warn('#[RobotShow] 未找到 Skill 技能节点，跳过技能特效');
                if (onDone) onDone();
                return;
            }

            const anim = (this._skillAnim && this._skillAnim.isValid)
                ? this._skillAnim
                : node.getComponent(Animation);
            if (!anim) {
                Logger.warn('[RobotShow] Skill 节点缺少 Animation 组件');
                if (onDone) onDone();
                return;
            }
            this._skillAnim = anim;

            // 关键顺序：Skill 节点默认 active=false，而 Animation 的 __preload 只有在节点被激活时
            // 才会为 _clips 逐个 createState —— 否则 getState() 返回 null，动画永远播不出来。
            // 因此必须先激活节点，再取 state。
            node.active = true;

            let state: any = (anim as any).getState ? (anim as any).getState(clipName) : null;
            if (!state) {
                // 兜底：状态尚未建立时，用 _clips 里的同名 clip 手动补建 state
                const clips: any[] = Array.isArray((anim as any).clips) ? (anim as any).clips : [];
                const clip = clips.find((c: any) => c && c.name === clipName);
                if (clip && typeof (anim as any).createState === 'function') {
                    state = (anim as any).createState(clip);
                }
            }
            if (!state) {
                Logger.warn(`[RobotShow] Skill 播放列表中没有动画「${clipName}」`);
                node.active = false;
                if (onDone) onDone();
                return;
            }

            // 连续触发（连击 / 攻守双方同帧各播一次）时先收掉上一次，避免状态串台
            this.stopSkillEffect(false);

            state.repeatCount = Math.max(1, Math.floor(playCount));
            state.speed = 1;

            let onFinished: (type: string, st: any) => void;
            const cleanup = () => {
                if (this._skillEndHandler === onFinished) {
                    anim.off(Animation.EventType.FINISHED, onFinished, this);
                    this._skillEndHandler = null;
                }
                if (this._skillFallback) {
                    this.unschedule(this._skillFallback);
                    this._skillFallback = null;
                }
            };
            onFinished = (_type: string, st: any) => {
                if (st && st !== state) return;   // 只认本次 state 的结束事件
                cleanup();
                if (node.isValid) node.active = false;
                if (onDone) onDone();
            };

            this._skillEndHandler = onFinished;
            anim.on(Animation.EventType.FINISHED, onFinished, this);

            // 兜底：引擎丢事件 / 节点中途被停用时，按时长强制收尾
            const once = Number(state.duration) > 0 ? Number(state.duration) : 0.5;
            const fallback = () => {
                this._skillFallback = null;
                cleanup();
                if (node.isValid) node.active = false;
                if (onDone) onDone();
            };
            this._skillFallback = fallback;
            this.scheduleOnce(fallback, once * state.repeatCount + 0.2);

            anim.play(clipName);
        } catch (e) {
            Logger.error('[RobotShow] playSkillEffect 异常（已吞掉，不影响战斗流程）:', e);
            if (onDone) onDone();
        }
    }

    /** 停止技能特效；hide=true 时顺带把 Skill 节点恢复为隐藏 */
    public stopSkillEffect(hide: boolean = true): void {
        try {
            if (this._skillAnim && this._skillAnim.isValid) {
                if (this._skillEndHandler) {
                    this._skillAnim.off(Animation.EventType.FINISHED, this._skillEndHandler, this);
                }
                this._skillAnim.stop();
            }
            this._skillEndHandler = null;
            if (this._skillFallback) {
                this.unschedule(this._skillFallback);
                this._skillFallback = null;
            }
            if (hide) {
                const n = this.resolveSkillNode();
                if (n) n.active = false;
            }
        } catch (e) {
            Logger.error('[RobotShow] stopSkillEffect 异常（已吞掉）:', e);
        }
    }

    // ===== 装备图标 =====

    private updateEquipmentIcons(equipment: any, aniId?: string): void {
        this.setSlotSprite('Weapon', this.weaponIcon, equipment?.Weapon, RobotShow.weaponConfig, RobotShow.weaponFrames, RobotShow.weaponFrameMap, aniId);
        this.setSlotSprite('Gun', this.gunIcon, equipment?.Gun, RobotShow.gunConfig, RobotShow.gunFrames, RobotShow.gunFrameMap, aniId);
        this.setSlotSprite('Dun', this.dunIcon, equipment?.Dun, RobotShow.dunConfig, RobotShow.dunFrames, RobotShow.dunFrameMap, aniId);
        this.setSlotSprite('Wing', this.wingIcon, equipment?.Wing, RobotShow.wingConfig, RobotShow.wingFrames, RobotShow.wingFrameMap, aniId);
    }

    private setSlotSprite(
        slotName: EquipSlot,
        iconNode: Node | null,
        equipData: any,
        configMap: Map<number, EquipConfig>,
        frames: SpriteFrame[] | null,
        frameMap: Map<number, SpriteFrame>,
        aniId?: string
    ): void {
        if (!iconNode) return;
        const sprite = iconNode.getComponent(Sprite);
        if (!sprite) return;

        if (!equipData || !equipData.item_id || (!frames && frameMap.size === 0) || configMap.size === 0) {
            // 没装备 / 资源没准备好：隐藏
            iconNode.active = false;
            return;
        }

        const itemId = Number(equipData.item_id);
        const cfg = configMap.get(itemId);
        if (!cfg || cfg.img === undefined || cfg.img === null) {
            iconNode.active = false;
            return;
        }

        const imgIndex = Number(cfg.img);

        // 先按 name->frame 映射找（防止 loadDir 顺序乱）
        let frame: SpriteFrame | undefined = frameMap.get(imgIndex);

        // 再按数组索引兜底
        if (!frame && frames && frames.length > 0) {
            frame = frames[imgIndex];
        }

        if (!frame) {
            iconNode.active = false;
            return;
        }

        sprite.spriteFrame = frame;
        iconNode.active = true;

        // 根据 AniID、装备图的 spriteIndex 和类型调整装备图标位置
        // 注意：直接使用配表中的绝对坐标，不做偏移；其他属性保持不变
        if (aniId && equipData && equipData.item_id) {
            // 关键修复：equip_position.json 的第二列对应的是图集索引(img)，不是装备 item_id
            // 例：["xm_L3","30",-4,118,"Wing"] 这里的 30 是 Wing 图集里的 sprite 索引
            const cfg = configMap.get(Number(equipData.item_id));
            const spriteIndex = cfg && cfg.img != null ? Number(cfg.img) : NaN;

            if (!isNaN(spriteIndex)) {
                const resolved = RobotShow.resolveEquipPosition(aniId, slotName, spriteIndex);

                if (resolved.pos) {
                    const currentZ = iconNode.position.z;
                    iconNode.setPosition(resolved.pos.x, resolved.pos.y, currentZ);
                    if (resolved.matchedAniId && resolved.matchedAniId !== aniId) {
                        Logger.debug(`📍 [RobotShow] 装备位置设置(兜底命中): ${slotName} spriteIndex:${spriteIndex} AniID:${aniId} -> 使用Key:${resolved.matchedAniId} 坐标(${resolved.pos.x}, ${resolved.pos.y})`);
                    } else {
                        Logger.debug(`📍 [RobotShow] 装备位置设置: ${slotName} spriteIndex:${spriteIndex} -> (${resolved.pos.x}, ${resolved.pos.y}) for AniID:${aniId}`);
                    }
                } else {
                    // 关键诊断：没命中就打印一次上下文，方便你核对 AniID / 图索引 / 类型
                    const hasAni = RobotShow.equipPositions.has(String(aniId).trim());
                    Logger.warn(
                        `⚠️ [RobotShow] 未命中装备坐标: AniID="${aniId}"(exists=${hasAni}) slot=${slotName} spriteIndex=${spriteIndex}. ` +
                        `请确认 equip_position.json 第二列与 Wing.json/Gun.json/Weapon.json 里的 img 字段一致（如 "30"）。`
                    );
                }
            } else {
                Logger.warn(`⚠️ [RobotShow] 未能获取装备图索引(img)，slot=${slotName} item_id=${equipData.item_id}`);
            }
        }
    }

    // ===== 静态初始化逻辑 =====

    /**
     * 预加载所有资源（可在场景加载时调用，减少延迟）
     */
    public static preloadResources(): void {
        this.ensureConfigsLoaded();
    }

    private static ensureConfigsLoaded(): void {
        if (this.configsLoaded) return;
        this.configsLoaded = true;

        const resourceMgr = ResourceManager.getInstance();
        const scheduleConfigStep = (fn: () => void, delayMs: number) => {
            const handle = setTimeout(() => {
                const i = this.configLoadTimers.indexOf(handle);
                if (i >= 0) this.configLoadTimers.splice(i, 1);
                fn();
            }, delayMs);
            this.configLoadTimers.push(handle);
        };

        // 使用陆续加载方式，避免一次性加载造成卡顿
        // 1. 先加载装备位置配表（单独处理，因为需要特殊解析）
        resourceMgr.loadAsset<JsonAsset>('json/equip_position', JsonAsset, (err, asset) => {
            if (!err && asset) {
                const positionData = asset.json as any[][];
                this.equipPositions.clear();

                positionData.forEach((entry: any[]) => {
                    const [aniId, equipIdStr, x, y, equipType] = entry;
                    const equipId = Number(equipIdStr);

                    if (!this.equipPositions.has(aniId)) {
                        this.equipPositions.set(aniId, new Map());
                    }

                    const aniMap = this.equipPositions.get(aniId)!;
                    if (!aniMap.has(equipType)) {
                        aniMap.set(equipType, new Map());
                    }

                    const typeMap = aniMap.get(equipType)!;
                    typeMap.set(equipId, { x: Number(x), y: Number(y) });
                });

                Logger.debug(`✅ [RobotShow] equip_position.json 加载完成，AniID 数量: ${this.equipPositions.size}`);
            } else if (err) {
                Logger.warn('⚠️ [RobotShow] 加载 equip_position.json 失败:', err);
            }
        });

        // 2. 陆续加载 JSON 配表（使用 preloadAssets 实现陆续加载）
        const jsonAssets = [
            { path: 'json/Weapon', type: JsonAsset, handler: (asset: JsonAsset) => {
                const arr = asset.json as any[];
                arr.forEach((item: any) => {
                    const id = Number(item.id);
                    if (!isNaN(id)) {
                        this.weaponConfig.set(id, item);
                    }
                });
                Logger.debug(`✅ [RobotShow] Weapon.json 加载完成，条目数: ${this.weaponConfig.size}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'json/Gun', type: JsonAsset, handler: (asset: JsonAsset) => {
                const arr = asset.json as any[];
                arr.forEach((item: any) => {
                    const id = Number(item.id);
                    if (!isNaN(id)) {
                        this.gunConfig.set(id, item);
                    }
                });
                Logger.debug(`✅ [RobotShow] Gun.json 加载完成，条目数: ${this.gunConfig.size}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'json/Dun', type: JsonAsset, handler: (asset: JsonAsset) => {
                const arr = asset.json as any[];
                arr.forEach((item: any) => {
                    const id = Number(item.id);
                    if (!isNaN(id)) {
                        this.dunConfig.set(id, item);
                    }
                });
                Logger.debug(`✅ [RobotShow] Dun.json 加载完成，条目数: ${this.dunConfig.size}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'json/Wing', type: JsonAsset, handler: (asset: JsonAsset) => {
                const arr = asset.json as any[];
                arr.forEach((item: any) => {
                    const id = Number(item.id);
                    if (!isNaN(id)) {
                        this.wingConfig.set(id, item);
                    }
                });
                Logger.debug(`✅ [RobotShow] Wing.json 加载完成，条目数: ${this.wingConfig.size}`);
                this.notifyAllInstancesToUpdate();
            }},
        ];

        // 陆续加载 JSON 配表（每次加载2个，每个完成后延迟50ms）
        let jsonIndex = 0;
        const loadNextJson = () => {
            if (jsonIndex >= jsonAssets.length) return;
            
            const { path, type, handler } = jsonAssets[jsonIndex];
            jsonIndex++;
            
            resourceMgr.loadAsset<JsonAsset>(path, type, (err, asset) => {
                if (!err && asset) {
                    handler(asset);
                } else {
                    Logger.warn(`⚠️ [RobotShow] 加载 ${path} 失败:`, err);
                }
                
                // 延迟后加载下一个（给主线程喘息时间）
                if (jsonIndex < jsonAssets.length) {
                    scheduleConfigStep(() => loadNextJson(), 50);
                }
            });
        };

        // 启动第一批加载（同时加载2个）
        const batchSize = 2;
        for (let i = 0; i < Math.min(batchSize, jsonAssets.length); i++) {
            scheduleConfigStep(() => loadNextJson(), i * 50); // 错开启动时间
        }

        // 3. 陆续加载图集目录（使用 preloadDirs 实现陆续加载）
        const spriteDirs = [
            { path: 'Weapon/Weapon', handler: (assets: SpriteFrame[]) => {
                this.weaponFrames = assets;
                this.weaponFrameMap.clear();
                assets.forEach(sf => {
                    const key = Number(sf.name);
                    if (!isNaN(key)) {
                        this.weaponFrameMap.set(key, sf);
                    }
                });
                Logger.debug(`✅ [RobotShow] Weapon 图集加载完成，数量: ${assets.length}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'Weapon/Gun', handler: (assets: SpriteFrame[]) => {
                this.gunFrames = assets;
                this.gunFrameMap.clear();
                assets.forEach(sf => {
                    const key = Number(sf.name);
                    if (!isNaN(key)) {
                        this.gunFrameMap.set(key, sf);
                    }
                });
                Logger.debug(`✅ [RobotShow] Gun 图集加载完成，数量: ${assets.length}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'Weapon/Dun', handler: (assets: SpriteFrame[]) => {
                this.dunFrames = assets;
                this.dunFrameMap.clear();
                assets.forEach(sf => {
                    const key = Number(sf.name);
                    if (!isNaN(key)) {
                        this.dunFrameMap.set(key, sf);
                    }
                });
                Logger.debug(`✅ [RobotShow] Dun 图集加载完成，数量: ${assets.length}`);
                this.notifyAllInstancesToUpdate();
            }},
            { path: 'Weapon/Wing', handler: (assets: SpriteFrame[]) => {
                this.wingFrames = assets;
                this.wingFrameMap.clear();
                assets.forEach(sf => {
                    const key = Number(sf.name);
                    if (!isNaN(key)) {
                        this.wingFrameMap.set(key, sf);
                    }
                });
                Logger.debug(`✅ [RobotShow] Wing 图集加载完成，数量: ${assets.length}`);
                this.notifyAllInstancesToUpdate();
            }},
        ];

        // 陆续加载图集目录（每次加载1个，因为图集比较大）
        let dirIndex = 0;
        const loadNextDir = () => {
            if (dirIndex >= spriteDirs.length) return;
            
            const { path, handler } = spriteDirs[dirIndex];
            dirIndex++;
            
            resourceMgr.loadDir<SpriteFrame>(path, SpriteFrame, (err, assets) => {
                if (!err && assets) {
                    handler(assets);
                } else {
                    Logger.warn(`⚠️ [RobotShow] 加载 ${path} 图集失败:`, err);
                }
                
                // 延迟后加载下一个（图集较大，延迟更久一些）
                if (dirIndex < spriteDirs.length) {
                    scheduleConfigStep(() => loadNextDir(), 100); // 图集较大，延迟100ms
                }
            });
        };

        // 延迟启动图集加载（等 JSON 配表加载一些后再开始）
        scheduleConfigStep(() => loadNextDir(), 200);

        // 4. 加载伤害/治疗数字图（resources/NumberIcon：Damage-0～9, bloodreturning-0～9，每张 24x32）
        resourceMgr.loadDir<SpriteFrame>('NumberIcon', SpriteFrame, (err, assets) => {
            if (err || !assets) {
                try { Logger.warn('⚠️ [RobotShow] 加载 NumberIcon 失败，伤害数字不可用:', err); } catch {}
                return;
            }
            this.numberFramesMap.clear();
            const allNames: string[] = [];
            assets.forEach((sf) => {
                const name = (sf as any).name || '';
                allNames.push(name);
                if (name.startsWith('Damage-') || name.startsWith('bloodreturning-')) {
                    this.numberFramesMap.set(name, sf);
                }
            });
            this.numberFramesLoaded = true;
            Logger.warn(`[数字诊断] NumberIcon 加载完成，总帧=${assets.length} 命中=${this.numberFramesMap.size} 名称样例=${allNames.slice(0, 12).join(',')}`);
        });
    }

    // 关键修复：跟踪所有实例，资源加载完成后通知它们更新
    private static instances: Set<RobotShow> = new Set();
    /** 静态预加载错峰定时器；不在实例 onDestroy 里清，避免打断全局加载 */
    private static configLoadTimers: ReturnType<typeof setTimeout>[] = [];

    onEnable() {
        RobotShow.instances.add(this);
        // 关键修复：不在 onEnable 时自动应用缓存数据，避免显示错误的机甲
        // 只在明确调用 updateFromRobotData 时才更新
    }

    onDisable() {
        RobotShow.instances.delete(this);
    }

    onDestroy() {
        for (const h of this.applyReadyTimers) {
            clearTimeout(h);
        }
        this.applyReadyTimers.length = 0;
        RobotShow.instances.delete(this);
    }

        // 关键修复：防止重复通知，只在所有资源都加载完成时通知一次
        private static allResourcesReadyNotified = false;

    /**
     * 通知所有实例重新应用缓存数据（资源加载完成后调用）
     * 关键修复：移除全局通知机制，改为每个实例在 updateFromRobotData 时自己检查资源
     */
    private static notifyAllInstancesToUpdate(): void {
        // 检查资源是否全部加载完成
        if (this.weaponConfig.size > 0 && 
            this.gunConfig.size > 0 && 
            this.dunConfig.size > 0 && 
            this.wingConfig.size > 0 &&
            this.weaponFrames !== null &&
            this.gunFrames !== null &&
            this.dunFrames !== null &&
            this.wingFrames !== null) {
            
            // 关键修复：资源加载完成后，按实例当前的petId安全地重新应用缓存
            if (!this.allResourcesReadyNotified) {
                this.allResourcesReadyNotified = true;
                Logger.debug('✅ [RobotShow] 所有资源加载完成，通知实例重新应用缓存');
                this.instances.forEach(instance => {
                    if (instance && instance.isValid) {
                        instance.applyCachedData(instance.lastPetId);
                    }
                });
            }
        }
    }
}

