import { _decorator, Component, Node, Sprite, SpriteFrame, Animation, Label, UITransform, tween, Tween, UIOpacity, JsonAsset, instantiate, Vec3 } from 'cc';
import { ResourceManager } from './ResourceManager';

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
    /** 当前弹出的数字克隆节点，用于渐变后销毁 */
    private digitCloneNodes: Node[] = [];
    /** 当前伤害数字的 tween，用于下次弹出时先停止 */
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
        const template = root.getChildByName('Sprite') || root.children[0] || null;
        if (template) {
            this.digitTemplateNode = template;
            template.active = false;
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

        // 关键修复：提取并保存 petId，用于验证数据是否匹配
        const rawPetId = data.pet_id ?? data.data?.pet_id;
        const petId = rawPetId !== undefined && rawPetId !== null ? String(rawPetId) : null;
        
        // 关键修复：如果 petId 发生变化，清空旧数据，避免显示错误的机甲
        if (this.lastPetId !== null && petId !== null && this.lastPetId !== petId) {
            console.log(`⚠️ [RobotShow] petId 变化，清空旧数据 (旧: ${this.lastPetId}, 新: ${petId})`);
            this.lastRobotData = null;
        }

        // 如果当前已有有效的 petId，但本次数据缺失 petId，直接跳过，避免误覆盖
        if (this.lastPetId && !petId) {
            console.log('⚠️ [RobotShow] 跳过更新：收到的数据缺少 petId，保持当前展示');
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
            console.log(`⚠️ [RobotShow] 资源未加载完成，装备图标将在资源加载后更新 (pet_id: ${petId})`);
            this.scheduleApplyWhenReady(petId, 0);
        }
    }

    // ===== 战斗内：伤害数字 + 局内血条（仅战斗时显示） =====

    /** 掉落偏移（左下方向）：X 负为左，Y 负为下，单位像素 */
    private static readonly DAMAGE_DROP_OFFSET = { x: -32, y: -48 };

    /** 显示伤害或治疗数字：按位数复制模板精灵，居中对齐，先停顿再往左下掉落并渐变消失 */
    public showDamageNumber(value: number, isHeal: boolean = false): void {
        const root = this.numberNode || this.node.getChildByName('Number');
        const template = this.digitTemplateNode;
        if (!root || !template || !RobotShow.numberFramesLoaded) return;
        value = Math.max(0, Math.floor(value));
        const str = String(value);
        if (str.length === 0) return;

        if (this.damageTween) this.damageTween.stop();
        this.digitCloneNodes.forEach((n) => { n.destroy(); });
        this.digitCloneNodes = [];

        const prefix = isHeal ? 'bloodreturning-' : 'Damage-';
        const digitWidth = 24;
        const totalW = str.length * digitWidth;
        const startX = -totalW / 2 + digitWidth / 2;

        for (let i = 0; i < str.length; i++) {
            const d = str.charAt(i);
            const frame = RobotShow.numberFramesMap.get(prefix + d);
            if (!frame) continue;
            const clone = instantiate(template);
            clone.active = true;
            clone.setPosition(startX + i * digitWidth, 0, 0);
            const sp = clone.getComponent(Sprite);
            if (sp) sp.spriteFrame = frame;
            const uiOpacity = clone.getComponent(UIOpacity) || clone.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
            root.addChild(clone);
            this.digitCloneNodes.push(clone);
        }

        root.active = true;
        const startPos = root.position.clone();
        const drop = RobotShow.DAMAGE_DROP_OFFSET;
        const proxy = { t: 0 };
        this.damageTween = tween(proxy)
            .delay(0.25)
            .to(1, { t: 1 }, {
                onUpdate: () => {
                    const t = proxy.t;
                    root.setPosition(
                        startPos.x + drop.x * t,
                        startPos.y + drop.y * t,
                        startPos.z
                    );
                    const opacity = Math.max(0, Math.round(255 * (1 - t)));
                    this.digitCloneNodes.forEach((n) => {
                        const u = n.getComponent(UIOpacity);
                        if (u) u.opacity = opacity;
                    });
                }
            })
            .call(() => {
                this.digitCloneNodes.forEach((n) => n.destroy());
                this.digitCloneNodes = [];
                root.setPosition(startPos);
                root.active = false;
                this.damageTween = null;
            })
            .start();
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
            console.log(`⚠️ [RobotShow] 跳过更新：petId 不匹配 (期望: ${expectedPetId}, 当前: ${this.lastPetId})`);
            return;
        }

        if (this.lastRobotData && this.areResourcesReady()) {
            console.log(`✅ [RobotShow] 资源加载完成，重新应用缓存数据 (pet_id: ${this.lastPetId})`);
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
        setTimeout(() => {
            // 再次确认petId匹配
            if (expectedPetId !== null && this.lastPetId !== expectedPetId) return;
            if (this.areResourcesReady()) {
                this.applyCachedData(expectedPetId);
            } else {
                // 递增延迟：100ms, 200ms, 300ms, 400ms, 500ms
                this.scheduleApplyWhenReady(expectedPetId, retry + 1);
            }
        }, 100 * (retry + 1));
    }

    // ===== 机体动画 =====

    private updateBodyAnimation(data: any): void {
        if (!this.body) return;
        const anim = this.body.getComponent(Animation);
        if (!anim || !Array.isArray((anim as any).clips) || (anim as any).clips.length === 0) {
            return;
        }

        const clips: any[] = (anim as any).clips;
        const aniID = data['AniID'] || '';

        if (aniID && typeof aniID === 'string') {
            const targetClip = clips.find((clip: any) => clip && clip.name === aniID);
            if (targetClip) {
                console.log(`🎬 [RobotShow] 播放动画: ${aniID}`);
                anim.play(aniID);
                return;
            } else {
                console.warn(`⚠️ [RobotShow] 未找到动画片段: ${aniID}，可用的动画:`, clips.map((c: any) => c?.name).join(', '));
            }
        }

        // 找不到指定动画或没有 AniID，随机播放一个
        const idx = Math.floor(Math.random() * clips.length);
        const clip = clips[idx];
        if (clip && clip.name) {
            console.log(`🎲 [RobotShow] 随机播放动画: ${clip.name}`);
            anim.play(clip.name);
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
                        console.log(`📍 [RobotShow] 装备位置设置(兜底命中): ${slotName} spriteIndex:${spriteIndex} AniID:${aniId} -> 使用Key:${resolved.matchedAniId} 坐标(${resolved.pos.x}, ${resolved.pos.y})`);
                    } else {
                        console.log(`📍 [RobotShow] 装备位置设置: ${slotName} spriteIndex:${spriteIndex} -> (${resolved.pos.x}, ${resolved.pos.y}) for AniID:${aniId}`);
                    }
                } else {
                    // 关键诊断：没命中就打印一次上下文，方便你核对 AniID / 图索引 / 类型
                    const hasAni = RobotShow.equipPositions.has(String(aniId).trim());
                    console.warn(
                        `⚠️ [RobotShow] 未命中装备坐标: AniID="${aniId}"(exists=${hasAni}) slot=${slotName} spriteIndex=${spriteIndex}. ` +
                        `请确认 equip_position.json 第二列与 Wing.json/Gun.json/Weapon.json 里的 img 字段一致（如 "30"）。`
                    );
                }
            } else {
                console.warn(`⚠️ [RobotShow] 未能获取装备图索引(img)，slot=${slotName} item_id=${equipData.item_id}`);
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

                console.log(`✅ [RobotShow] equip_position.json 加载完成，AniID 数量: ${this.equipPositions.size}`);
            } else if (err) {
                console.warn('⚠️ [RobotShow] 加载 equip_position.json 失败:', err);
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
                console.log(`✅ [RobotShow] Weapon.json 加载完成，条目数: ${this.weaponConfig.size}`);
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
                console.log(`✅ [RobotShow] Gun.json 加载完成，条目数: ${this.gunConfig.size}`);
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
                console.log(`✅ [RobotShow] Dun.json 加载完成，条目数: ${this.dunConfig.size}`);
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
                console.log(`✅ [RobotShow] Wing.json 加载完成，条目数: ${this.wingConfig.size}`);
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
                    console.warn(`⚠️ [RobotShow] 加载 ${path} 失败:`, err);
                }
                
                // 延迟后加载下一个（给主线程喘息时间）
                if (jsonIndex < jsonAssets.length) {
                    setTimeout(() => {
                        loadNextJson();
                    }, 50);
                }
            });
        };

        // 启动第一批加载（同时加载2个）
        const batchSize = 2;
        for (let i = 0; i < Math.min(batchSize, jsonAssets.length); i++) {
            setTimeout(() => {
                loadNextJson();
            }, i * 50); // 错开启动时间
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
                console.log(`✅ [RobotShow] Weapon 图集加载完成，数量: ${assets.length}`);
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
                console.log(`✅ [RobotShow] Gun 图集加载完成，数量: ${assets.length}`);
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
                console.log(`✅ [RobotShow] Dun 图集加载完成，数量: ${assets.length}`);
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
                console.log(`✅ [RobotShow] Wing 图集加载完成，数量: ${assets.length}`);
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
                    console.warn(`⚠️ [RobotShow] 加载 ${path} 图集失败:`, err);
                }
                
                // 延迟后加载下一个（图集较大，延迟更久一些）
                if (dirIndex < spriteDirs.length) {
                    setTimeout(() => {
                        loadNextDir();
                    }, 100); // 图集较大，延迟100ms
                }
            });
        };

        // 延迟启动图集加载（等 JSON 配表加载一些后再开始）
        setTimeout(() => {
            loadNextDir();
        }, 200);

        // 4. 加载伤害/治疗数字图（resources/NumberIcon：Damage-0～9, bloodreturning-0～9，每张 24x32）
        resourceMgr.loadDir<SpriteFrame>('NumberIcon', SpriteFrame, (err, assets) => {
            if (err || !assets) {
                try { console.warn('⚠️ [RobotShow] 加载 NumberIcon 失败，伤害数字不可用:', err); } catch {}
                return;
            }
            this.numberFramesMap.clear();
            assets.forEach((sf) => {
                const name = (sf as any).name || '';
                if (name.startsWith('Damage-') || name.startsWith('bloodreturning-')) {
                    this.numberFramesMap.set(name, sf);
                }
            });
            this.numberFramesLoaded = true;
            try { console.log(`✅ [RobotShow] NumberIcon 加载完成，数量: ${this.numberFramesMap.size}`); } catch {}
        });
    }

    // 关键修复：跟踪所有实例，资源加载完成后通知它们更新
    private static instances: Set<RobotShow> = new Set();

    onEnable() {
        RobotShow.instances.add(this);
        // 关键修复：不在 onEnable 时自动应用缓存数据，避免显示错误的机甲
        // 只在明确调用 updateFromRobotData 时才更新
    }

    onDisable() {
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
                console.log('✅ [RobotShow] 所有资源加载完成，通知实例重新应用缓存');
                this.instances.forEach(instance => {
                    if (instance && instance.isValid) {
                        instance.applyCachedData(instance.lastPetId);
                    }
                });
            }
        }
    }
}

