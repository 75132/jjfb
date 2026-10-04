/**
 * SkillData —— 技能战斗数据的客户端权威读取层（纯逻辑，无 cc 依赖，便于单测）
 *
 * 数据来源：RPG Maker MV 工程 `机甲风暴2`
 *   - `js/plugins/Z_GamePlay.js`   普攻三职业三公式（覆写 attackSkillId）
 *   - `js/plugins/Z_SkillLevel.js` 技能等级 Lv1-4 与升级条件
 *   - 目录数据：`assets/resources/json/Skills.json`（服务端同源副本 `server/data/Skills.json`）
 *
 * ⚠ 公式缩放口径（2026-09-30 用户拍板 = 方案 A，`Skills.json` v5）
 *   实际结算**只用 `formula_scaled`**：
 *     ① `a.atk` → `(a.atk / 3)`（原工程 HP/atk 数千量级，本工程小一个数量级）；
 *     ② 删除公式末尾的纯数字加项；`b.def` 不缩放。
 *   于是格斗普攻 `(a.atk/3)*3 - b.def ≡ 攻击 − 装甲`，与旧公式 `max(1, 攻击−装甲)` 逐点等价。
 *   `formula`（RPG 原式）仅作溯源，两端都不参与结算。
 *
 * 与服务端 `server/services/skill_service.py` **同口径、同函数名**，便于两端对拍。
 */

export type ClassLine = 'fighter' | 'shooter' | 'universal';

/** 职业线数值（与客户端 `data.Class` 一致：1 格斗 / 2 射击 / 3 全能） */
export const CLASS_NUM_TO_LINE: Readonly<Record<number, ClassLine>> = {
    1: 'fighter',
    2: 'shooter',
    3: 'universal',
};

/** 枪械类武器 id（来源 Z_GamePlay.js GUN_WEAPON_IDS，28–51） */
export const GUN_WEAPON_IDS: readonly number[] = [
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];

/** damage_type 字符串 ↔ RPG 数字（与 Skills.json / 服务端 DAMAGE_CODE 一致） */
export const DAMAGE_CODE: Readonly<Record<string, number>> = {
    none: 0,
    hp_damage: 1,
    mp_damage: 2,
    hp_drain: 3,
    mp_drain: 4,
    hp_recover: 5,
    mp_recover: 6,
};

export interface NormalAttackDef {
    classes: ClassLine;
    /** 中文名，仅用于日志/UI */
    name: string;
    /** 是否要求装备枪械才启用（格斗线不要求） */
    requiresGun: boolean;
    /** RPG Maker MV 原式，a=攻方 b=守方（**仅溯源，不参与结算**） */
    formula: string;
    /** 实际结算用式（口径 A 缩放后）；缺省时回落 `formula` */
    formulaScaled: string;
    /** 伤害浮动 %（RPG `damage.variance`），默认 20 */
    variance?: number;
    /** 是否可暴击，默认 true */
    critical?: boolean;
}

/**
 * 普通攻击三职业三公式（来源 Z_GamePlay.js 覆写 attackSkillId）
 *   格斗 → 默认普攻（不持枪也是它）
 *   射击 / 全能 → 仅在**装备枪械**时覆盖默认普攻
 *
 * ⚠ `formulaScaled` 与 `Skills.json` 的 `normal_attack.by_class[].formula_scaled` 保持一致；
 *   运行时若已注入目录（`setSkillCatalog`），则以目录为准（见 `resolveNormalAttack`）。
 */
export const NORMAL_ATTACK_BY_CLASS: Readonly<Record<ClassLine, NormalAttackDef>> = {
    fighter: {
        classes: 'fighter',
        name: '格斗·普通攻击',
        requiresGun: false,
        formula: 'a.atk * 3 - b.def * 1 + 1000',
        formulaScaled: '(a.atk / 3) * 3 - b.def * 1',
        variance: 20,
        critical: true,
    },
    shooter: {
        classes: 'shooter',
        name: '射击·普通攻击',
        requiresGun: true,
        formula: 'a.atk * 2.5 - b.def * 1 + 1000',
        formulaScaled: '(a.atk / 3) * 2.5 - b.def * 1',
        variance: 20,
        critical: true,
    },
    universal: {
        classes: 'universal',
        name: '全能·普通攻击',
        requiresGun: true,
        formula: 'a.atk * 3.5 - b.def * 1 + 1200',
        formulaScaled: '(a.atk / 3) * 3.5 - b.def * 1',
        variance: 20,
        critical: true,
    },
};

/** 技能等级（来源 Z_SkillLevel.js） */
export const SKILL_LEVEL_MAX = 4;
export const SKILL_LEVEL_MULTIPLIERS: readonly number[] = [1.0, 1.2, 1.3, 1.5];

/** 手动升级条件：目标等级 → 需要技能书数 / 需要机甲等级（来源 Z_SkillLevel.js） */
export const MANUAL_UPGRADE_REQ: Readonly<Record<number, { books: number; mechLevel: number }>> = {
    2: { books: 1, mechLevel: 25 },
    3: { books: 2, mechLevel: 40 },
    4: { books: 3, mechLevel: 50 },
};

/** 动作类型（与 `battle_room_service` 的 `ActionType` 一致） */
export type ActionType = 'ATTACK' | 'DEFEND' | 'ESCAPE' | 'SKILL' | 'ITEM';

/** 归一化后的动作结构（发给服务端的就是它） */
export interface NormalizedAction {
    type: ActionType;
    /** 仅 SKILL 有 */
    skill_key?: string | null;
}

// ---------------------------------------------------------------------------
// 职业线 / 持枪判定
// ---------------------------------------------------------------------------

/** 把数值职业（1/2/3）或字符串职业转成职业线；无法识别时按格斗处理 */
export function resolveClassLine(classValue: unknown): ClassLine {
    if (typeof classValue === 'string') {
        const s = classValue.trim().toLowerCase();
        if (s === 'shooter' || s === 'sheji' || s === '射击' || s === '射击型') return 'shooter';
        if (s === 'universal' || s === 'quanneng' || s === '全能' || s === '全能型') return 'universal';
        if (s === 'fighter' || s === 'gedou' || s === '格斗' || s === '格斗型') return 'fighter';
        const n = Number(s);
        if (!Number.isNaN(n) && CLASS_NUM_TO_LINE[n]) return CLASS_NUM_TO_LINE[n];
        return 'fighter';
    }
    const n = Number(classValue);
    return CLASS_NUM_TO_LINE[n] || 'fighter';
}

/** 单个物品 id 是否为枪械类武器 */
export function isGunItemId(itemId: unknown): boolean {
    const n = Number(itemId);
    return !Number.isNaN(n) && GUN_WEAPON_IDS.indexOf(n) >= 0;
}

/** 取槽位里的 item id（兼容 {item_id}/{itemId}/{id}/直接给值） */
function slotItemId(slot: any): number | null {
    if (slot === null || slot === undefined) return null;
    if (typeof slot === 'object') {
        const v = slot.item_id ?? slot.itemId ?? slot.id ?? slot.ItemID;
        return v === undefined || v === null ? null : Number(v);
    }
    const n = Number(slot);
    return Number.isNaN(n) ? null : n;
}

/**
 * 从装备数据里判断是否装备了枪械。与服务端 `has_gun_equipped` 同口径。
 * 兼容：{ Gun: { item_id } } / { gun: { itemId } } / 数组 / 直接给 id
 * ⚠ 兜底扫描**只认装备槽形态**（dict/list 值），绝不把 Level / Class 这类数值字段误判成武器。
 */
export function hasGunEquipped(equipment: any): boolean {
    if (!equipment) return false;
    if (Array.isArray(equipment)) {
        return equipment.some((it) => isGunItemId(slotItemId(it)));
    }
    if (typeof equipment !== 'object') {
        return isGunItemId(slotItemId(equipment));
    }
    const gunSlot = equipment.Gun || equipment.gun;
    if (gunSlot && isGunItemId(slotItemId(gunSlot))) return true;
    // 兜底：整份装备里任何槽位是枪械都算（只扫 dict/list 形态的槽位）
    for (const k of Object.keys(equipment)) {
        const slot = (equipment as any)[k];
        if (slot && typeof slot === 'object' && isGunItemId(slotItemId(slot))) return true;
    }
    return false;
}

/** 从角色文档里取装备（兼容 Equipment/equipment/Equip/equip） */
export function equipmentOf(doc: any): any {
    if (!doc || typeof doc !== 'object') return null;
    for (const k of ['Equipment', 'equipment', 'Equip', 'equip']) {
        const v = doc[k];
        if (v && typeof v === 'object') return v;
    }
    return null;
}

/** 取该单位实际使用的普攻定义（运行时若已注入目录，优先用目录里的 formula_scaled） */
export function resolveNormalAttack(classValue: unknown, gunEquipped: boolean): NormalAttackDef {
    const line = resolveClassLine(classValue);
    let def: NormalAttackDef = NORMAL_ATTACK_BY_CLASS[line];
    if (def.requiresGun && !gunEquipped) def = NORMAL_ATTACK_BY_CLASS.fighter;
    const override = catalogNormalAttackDef(def.classes);
    if (override && override.formulaScaled) {
        return { ...def, ...override, classes: def.classes, requiresGun: def.requiresGun };
    }
    return def;
}

/** 从已注入的目录里取某职业线的普攻定义（未注入返回 null） */
function catalogNormalAttackDef(line: ClassLine): NormalAttackDef | null {
    const na: any = _catalog && _catalog.normal_attack;
    if (!na || !Array.isArray(na.by_class)) return null;
    const hit = na.by_class.find((c: any) => c && c.classes === line);
    if (!hit) return null;
    return {
        classes: line,
        name: hit.name || NORMAL_ATTACK_BY_CLASS[line].name,
        requiresGun: !!hit.requires_gun,
        formula: hit.formula || NORMAL_ATTACK_BY_CLASS[line].formula,
        formulaScaled: hit.formula_scaled || hit.formula || NORMAL_ATTACK_BY_CLASS[line].formulaScaled,
        variance: na.variance,
        critical: na.critical,
    };
}

// ---------------------------------------------------------------------------
// 公式求值（不 eval，只认标准形；认不出返回 null 由调用方兜底）
// ---------------------------------------------------------------------------

/** 口径 A：`(a.atk / D) * X [- b.def * Y] [+ Z]` */
const SCALED_RE = /^\s*\(\s*a\.atk\s*\/\s*([\d.]+)\s*\)\s*\*\s*([\d.]+)\s*(?:-\s*b\.def\s*\*\s*([\d.]+)\s*)?(?:\+\s*([\d.]+)\s*)?$/;
/** 旧形（未缩放）：`a.atk * X - b.def * Y [+ Z]`（保留兼容，避免历史数据回归） */
const LEGACY_RE = /^\s*a\.atk\s*\*\s*([\d.]+)\s*-\s*b\.def\s*\*\s*([\d.]+)\s*(?:\+\s*([\d.]+)\s*)?$/;
/** 纯数字固定值 */
const PLAIN_NUMBER_RE = /^\s*(-?[\d.]+)\s*$/;

/** 数值兜底：undefined/NaN → 0 */
function num(v: unknown): number {
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
}

/**
 * 求值 RPG 表达式（返回**未取整、未夹取**的原始值）。
 * 只支持本表出现的三种形态（其余一律返回 null，**绝不猜**）：
 *   1) `(a.atk / D) * X - b.def * Y + Z`（口径 A 缩放后，D/X/Y/Z 可省）
 *   2) `a.atk * X - b.def * Y + Z`（旧形，兼容）
 *   3) 纯数字固定值
 */
export function evalSkillFormula(formula: string | null | undefined, atk: number, def: number): number | null {
    if (formula === null || formula === undefined) return null;
    const text = String(formula).trim();
    if (!text) return null;

    const plain = PLAIN_NUMBER_RE.exec(text);
    if (plain) return Number(plain[1]);

    let m = SCALED_RE.exec(text);
    if (m) {
        const divisor = num(m[1]) || 1;
        const atkCoef = num(m[2]);
        const defCoef = num(m[3]);
        const tail = num(m[4]);
        return (atk / divisor) * atkCoef - defCoef * def + tail;
    }

    m = LEGACY_RE.exec(text);
    if (m) {
        return num(m[1]) * atk - num(m[2]) * def + num(m[3]);
    }
    return null;
}

/**
 * 计算普攻伤害（未含 variance / 暴击 / 减半等结算链）。
 * @returns damage 与命中的普攻定义；公式认不出时 damage = null
 */
export function calcNormalAttackDamage(
    classValue: unknown,
    gunEquipped: boolean,
    atk: number,
    def: number,
): { damage: number | null; def: NormalAttackDef } {
    const def_ = resolveNormalAttack(classValue, gunEquipped);
    const raw = evalSkillFormula(def_.formulaScaled || def_.formula, atk, def);
    if (raw === null) return { damage: null, def: def_ };
    return { damage: Math.max(1, Math.floor(raw)), def: def_ };
}

// ---------------------------------------------------------------------------
// 技能目录（注入式，保持本模块纯逻辑）
// ---------------------------------------------------------------------------

export interface SkillDef {
    key: string;
    name: string;
    book_id?: number | null;
    rpg_skill_id?: number | null;
    /** 中文职业：格斗/射击/全能/通用 */
    type?: string | null;
    category?: string | null;
    anim?: string | null;
    /** **技能图标图集帧名**（如 `skill_1`），图集见 `SKILL_ICON_ATLAS_PATH` */
    iconIndex?: string | null;
    /** **出招方式 / 距离口径**：melee 近身 / ranged 远程 / dynamic 条件判定 / none 不主动施放 */
    range?: SkillRange | string | null;
    /** `range === 'dynamic'` 时的判定规则（如 `{ rule: 'gun' }`） */
    range_rule?: SkillRangeRule | null;
    /** 职业线：fighter/shooter/universal/all */
    classes?: string | null;
    classes_desc?: string | null;
    scope: number;
    target?: string | null;
    side?: string | null;
    scope_desc?: string | null;
    damage_type: string;
    /** RPG 原式（仅溯源） */
    formula?: string | null;
    /** 实际结算式（口径 A） */
    formula_scaled?: string | null;
    variance?: number | null;
    critical?: boolean | null;
    repeats?: number | null;
    success_rate?: number | null;
    hit_type?: number | null;
    mp_cost_percent?: number | null;
    drain_ratio?: number | null;
    restore_ratio?: number | null;
    effects?: Array<Record<string, any>>;
    /** 自动触发时机（end_of_round 等）；有值即不可主动施放 */
    trigger?: string | null;
    innate?: boolean;
    /** 仅参考项（未实装），不可施放 */
    reference_only?: boolean;
    lv_auto?: boolean;
    lv_manual?: boolean;
    note?: string | null;
}

export interface SkillCatalog {
    version?: number;
    formula_scale?: Record<string, any>;
    skill_level?: Record<string, any>;
    normal_attack?: Record<string, any>;
    /** 技能图标图集信息（path / frames / categories） */
    icon_atlas?: Record<string, any>;
    /** 出招方式 / 距离口径（values / rule_names / gun_weapon_ids / counts） */
    range?: Record<string, any>;
    skills: SkillDef[];
}

// ---------------------------------------------------------------------------
// 出招方式 / 距离口径（同 server/data/Skills.json 的 `range` 字段）
//   口径来源：tools/skill_range_todo.md（用户填表，2026-10-01 定稿）
//   melee   近身 —— 必须先位移贴到目标才能打
//   ranged  远程 —— 站在原地即可出招
//   dynamic 按 range_rule 判定（当前只有「急速攻击」：持枪 → 远程，否则近身）
//   none    不主动施放（自动触发被动），不涉及距离
//   ⚠ 战斗目前尚未接入位移逻辑，这里只提供口径读取，供后续「靠近 / 原地」实现复用。
// ---------------------------------------------------------------------------
export type SkillRange = 'melee' | 'ranged' | 'dynamic' | 'none';

export interface SkillRangeRule {
    /** 规则名（当前只有 `gun`） */
    rule: string;
    when_ranged?: string;
    when_melee?: string;
    desc?: string;
}

/** 距离判定的兜底值（与生成器 `range_for` 一致：未登记按远程处理） */
export const DEFAULT_SKILL_RANGE: SkillRange = 'ranged';

/** 取技能出招方式（未登记 → `ranged`）。 */
export function skillRangeOf(skill: SkillDef | null | undefined): SkillRange {
    const r = skill ? String(skill.range || '') : '';
    return (r === 'melee' || r === 'ranged' || r === 'dynamic' || r === 'none')
        ? (r as SkillRange)
        : DEFAULT_SKILL_RANGE;
}

/**
 * 解析「这次出招是不是远程」——`dynamic` 按规则求值。
 * `hasGun` = 是否装备枪械（武器 id ∈ `GUN_WEAPON_IDS`），与普攻同口径。
 * `none`（被动）返回 false：它不主动施放，不需要判定距离。
 *
 * ⚠ **读不到技能定义时（目录未加载 / 技能不在目录）一律按普攻口径兜底**：持枪=远程，否则近身。
 *   这里绝不能用 {@link skillRangeOf} 的 `ranged` 兜底 —— 一旦技能目录加载失败，
 *   所有近身技都会被误判成远程而**原地出招**（2026-10-01 实测事故，根因见 BattleScene `loadSkillCatalog`）。
 */
export function isRangedSkill(
    skill: SkillDef | null | undefined,
    hasGun: boolean = false,
): boolean {
    if (!skill) return !!hasGun;                 // 无定义 → 与普攻完全同一口径
    const r = String(skill.range || '');
    if (r === 'melee') return false;
    if (r === 'none') return false;              // 被动，不主动施放
    if (r === 'dynamic') {
        // 目前唯一的动态规则：持枪 → 远程，否则近身（= 普攻口径）
        const rule = skill.range_rule ? String(skill.range_rule.rule || '') : '';
        if (rule === 'gun') return !!hasGun;
        return !!hasGun;                         // 未知动态规则同样按普攻口径
    }
    return true;                                 // ranged / 未登记（数据侧保证已登记）
}

/**
 * 技能图标图集的 resources 加载路径（SpriteAtlas）。
 * ⚠ 资源已从 `assets/UI/Skill_icon/` 移入 `assets/resources/SkillIcon/`（2026-09-30），
 *   因此可以 `resources.load(SKILL_ICON_ATLAS_PATH, SpriteAtlas)`，**不需要在编辑器挂图集属性**。
 *   取帧：`atlas.getSpriteFrame(skill.iconIndex || DEFAULT_SKILL_ICON)`。
 */
export const SKILL_ICON_ATLAS_PATH = 'SkillIcon/SkillIcon';
/** 分类图标帧名（口径见 tools/skill_category_todo.md）：1 攻击 / 2 被动 / 3 自动触发 / 4 悟性攻击 / 5 悟性被动 */
export const SKILL_ICON_FRAMES: readonly string[] = ['skill_1', 'skill_2', 'skill_3', 'skill_4', 'skill_5'];
/** 缺省分类图标（未填分类时沿用 skill_1） */
export const DEFAULT_SKILL_ICON = 'skill_1';

/** 取技能图标帧名：优先 iconIndex，其次 category；须为 skill_1…skill_5，否则回退 skill_1。 */
export function skillIconOf(skill: SkillDef | null | undefined): string {
    const raw = skill ? skill.iconIndex || skill.category : null;
    const key = raw ? String(raw).trim() : '';
    if (key && (SKILL_ICON_FRAMES as readonly string[]).indexOf(key) >= 0) return key;
    return DEFAULT_SKILL_ICON;
}

let _catalog: SkillCatalog | null = null;

/** 注入技能目录（BattleScene 在 resources.load('json/Skills') 之后调用一次） */
export function setSkillCatalog(catalog: SkillCatalog | null): void {
    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.skills)) {
        _catalog = null;
        return;
    }
    _catalog = catalog;
}

export function getSkillCatalog(): SkillCatalog | null {
    return _catalog;
}

export function allSkillDefs(): SkillDef[] {
    return _catalog ? _catalog.skills.slice() : [];
}

/** 按 skill key 取技能；找不到返回 null */
export function getSkillDef(key: unknown): SkillDef | null {
    if (key === null || key === undefined) return null;
    const k = String(key).trim();
    if (!k) return null;
    const list = allSkillDefs();
    for (const s of list) if (s.key === k) return s;
    return null;
}

/**
 * 把「已学技能」里的任意一项归一成 skill key。
 * 支持：skill key / 中文名 / 技能书 id / RPG skill id。认不出返回 null（**绝不猜**）。
 */
export function resolveSkillRef(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
        const o = raw as any;
        for (const f of ['key', 'skill_key', 'SkillKey', 'id', 'name']) {
            if (o[f] !== undefined) {
                const hit = resolveSkillRef(o[f]);
                if (hit) return hit;
            }
        }
        return null;
    }
    const text = String(raw).trim();
    if (!text) return null;
    const list = allSkillDefs();
    for (const s of list) if (s.key === text) return s.key;
    for (const s of list) if (s.name === text) return s.key;
    if (/^\d+$/.test(text)) {
        const n = Number(text);
        for (const field of ['book_id', 'rpg_skill_id'] as const) {
            const hits = list.filter((s) => (s as any)[field] === n);
            if (hits.length === 1) return hits[0].key;
        }
    }
    return null;
}

/** 实际结算用式：优先 `formula_scaled`（口径 A），回落 `formula` */
export function formulaOf(skill: SkillDef | null | undefined): string | null {
    if (!skill) return null;
    const f = skill.formula_scaled !== undefined && skill.formula_scaled !== null
        ? skill.formula_scaled
        : skill.formula;
    return f === undefined || f === null ? null : String(f);
}

/** damage_type → RPG 数字 */
export function damageCodeOf(skill: SkillDef | null | undefined): number {
    if (!skill) return 0;
    return DAMAGE_CODE[String(skill.damage_type || 'none')] ?? 0;
}

/** 该技能是否与某职业线匹配（'all' / '通用' 视为全职业可用） */
export function skillMatchesClass(skill: SkillDef | null | undefined, classLine: ClassLine): boolean {
    if (!skill) return false;
    const c = String(skill.classes || '').trim().toLowerCase();
    if (!c || c === 'all' || c === '通用') return true;
    return c === classLine;
}

/** scope → 目标信息（与服务端 `resolve_scope` 同口径） */
export function resolveScope(scope: number): {
    scope: number;
    target: 'all' | 'single' | 'none';
    side: 'self' | 'ally' | 'enemy' | 'none';
    is_all: boolean;
    is_self: boolean;
    is_ally: boolean;
} {
    const s = Math.floor(num(scope));
    const isAll = s === 2 || s === 8 || s === 10;
    const isSelf = s === 11;
    const isAlly = s === 7 || s === 8 || s === 9 || s === 10;
    return {
        scope: s,
        target: isAll ? 'all' : (s === 0 ? 'none' : 'single'),
        side: isSelf ? 'self' : (isAlly ? 'ally' : (s ? 'enemy' : 'none')),
        is_all: isAll,
        is_self: isSelf,
        is_ally: isAlly,
    };
}

// ---------------------------------------------------------------------------
// 技能等级
// ---------------------------------------------------------------------------

/** 等级倍率（越界按 1 级处理） */
export function skillLevelMultiplier(level: number): number {
    const idx = Math.max(1, Math.floor(level || 1)) - 1;
    return SKILL_LEVEL_MULTIPLIERS[idx] ?? SKILL_LEVEL_MULTIPLIERS[0];
}

/** 按技能等级放大伤害：floor(基础伤害 × 倍率) */
export function applySkillLevel(baseDamage: number, level: number): number {
    return Math.floor(baseDamage * skillLevelMultiplier(level));
}

/** 归一化技能等级表：{任意写法 → 合法等级 1..MAX} */
export function normalizeSkillLevels(raw: any): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const k of Object.keys(raw)) {
        const key = resolveSkillRef(k);
        const n = Math.floor(num(raw[k]));
        if (key && n > 0) out[key] = Math.min(n, SKILL_LEVEL_MAX);
    }
    return out;
}

/** 该机甲对该技能的等级；未记录按 Lv1 */
export function resolveSkillLevel(levels: Record<string, number> | any, skillKey: unknown): number {
    const key = resolveSkillRef(skillKey);
    if (!key) return 1;
    const table = levels && typeof levels === 'object' ? levels : {};
    const lv = Math.floor(num(table[key]));
    return Math.max(1, Math.min(lv || 1, SKILL_LEVEL_MAX));
}

/** 自动升级概率 = 悟性 / 100 × 0.1 → 悟性 40~100 时 4%~10% */
export function autoUpgradeChance(comprehension: number): number {
    const c = Math.max(0, num(comprehension));
    return (c / 100) * 0.1;
}

/**
 * 自动升级判定（机甲升级时逐个已学技能调用）
 * @param rng 可注入随机源，便于测试；默认 Math.random
 */
export function rollAutoUpgrade(
    comprehension: number,
    currentLevel: number,
    rng: () => number = Math.random,
): boolean {
    if (currentLevel >= SKILL_LEVEL_MAX) return false;
    const chance = autoUpgradeChance(comprehension);
    if (chance <= 0) return false;
    return rng() < chance;
}

export interface ManualUpgradeCheck {
    ok: boolean;
    /** 不满足时的原因（直接可展示） */
    reason: string;
    /** 该次升级需要的技能书数量 */
    needBooks: number;
    /** 需要的机甲等级 */
    needMechLevel: number;
}

/**
 * 手动升级条件校验（花技能书 + 达到机甲等级）
 * @param hasBook 该技能是否有对应技能书（悟性技能无书 → 不可手动升）
 */
export function checkManualUpgrade(
    currentLevel: number,
    bookCount: number,
    mechLevel: number,
    hasBook: boolean,
): ManualUpgradeCheck {
    if (currentLevel >= SKILL_LEVEL_MAX) {
        return { ok: false, reason: '已达到最高等级', needBooks: 0, needMechLevel: 0 };
    }
    if (!hasBook) {
        return { ok: false, reason: '该技能不支持升级', needBooks: 0, needMechLevel: 0 };
    }
    const req = MANUAL_UPGRADE_REQ[currentLevel + 1];
    if (!req) {
        return { ok: false, reason: '该技能不支持升级', needBooks: 0, needMechLevel: 0 };
    }
    if (mechLevel < req.mechLevel) {
        return { ok: false, reason: `角色等级不足，需要等级${req.mechLevel}`, needBooks: req.books, needMechLevel: req.mechLevel };
    }
    if (bookCount < req.books) {
        return { ok: false, reason: `技能书数量不足，需要${req.books}个`, needBooks: req.books, needMechLevel: req.mechLevel };
    }
    return { ok: true, reason: '', needBooks: req.books, needMechLevel: req.mechLevel };
}

// ---------------------------------------------------------------------------
// 能量消耗 / 可施放判定（与服务端 skill_service 同口径）
// ---------------------------------------------------------------------------

/** 能量消耗 = 最大 MP × mp_cost_percent%（向下取整，至少 1；被动/无消耗为 0） */
export function mpCostOf(skill: SkillDef | null | undefined, maxMp: number): number {
    if (!skill) return 0;
    const pct = num(skill.mp_cost_percent);
    if (pct <= 0) return 0;
    const mm = Math.floor(num(maxMp));
    if (mm <= 0) return 0;
    return Math.max(1, Math.floor((mm * pct) / 100));
}

export interface CastContext {
    /** 当前 MP */
    mp: number;
    /** 最大 MP（算消耗用） */
    maxMp: number;
    /** 已学技能（key / 名称 / 技能书 id 任意写法）；不传则不校验「已学」 */
    learned?: any;
    /** 职业线（1/2/3 或 fighter/shooter/universal）；不传则不按职业线过滤 */
    classLine?: string | number | null;
}

export interface CastCheck {
    ok: boolean;
    reason: string;
    mp_cost: number;
}

/** 归一化「已学技能」为 key 集合 */
export function learnedSkillKeys(learned: any): Set<string> {
    const out = new Set<string>();
    if (learned === null || learned === undefined) return out;
    const list = Array.isArray(learned) ? learned : [learned];
    for (const item of list) {
        const key = resolveSkillRef(item);
        if (key) out.add(key);
    }
    return out;
}

/**
 * 是否可主动施放（已学 + 能量足够 + 是主动技）。返回 {ok, reason, mp_cost}。
 * reason 与 `listCastableSkills` 一致，可直接展示。
 */
export function canCastSkill(skill: SkillDef | null | undefined, ctx: CastContext): CastCheck {
    if (!skill) return { ok: false, reason: '技能不存在', mp_cost: 0 };
    const cost = mpCostOf(skill, ctx.maxMp);
    if (skill.trigger) return { ok: false, reason: '该技能为自动触发技，不能主动施放', mp_cost: cost };
    if (skill.reference_only) return { ok: false, reason: '该技能仅为参考项，未实装', mp_cost: cost };
    if (ctx.learned !== undefined && ctx.learned !== null) {
        const learned = learnedSkillKeys(ctx.learned);
        if (learned.size && !learned.has(skill.key)) {
            return { ok: false, reason: '尚未学会该技能', mp_cost: cost };
        }
    }
    if (num(ctx.mp) < cost) return { ok: false, reason: '能量不足', mp_cost: cost };
    return { ok: true, reason: '', mp_cost: cost };
}

export interface CastableSkill {
    key: string;
    name: string;
    anim: string | null;
    /** 图标图集帧名（`skill_1`…） */
    iconIndex: string;
    category: string | null;
    classes: string | null;
    type: string | null;
    scope: number;
    scope_desc: string | null;
    target: string | null;
    side: string | null;
    damage_type: string;
    mp_cost_percent: number;
    mp_cost: number;
    level: number;
    max_level: number;
    lv_manual: boolean;
    book_id: number | null;
    usable: boolean;
    reason: string;
    /** 是否已学（机甲默认没技能 → 无 `Skills` 字段时一律 false） */
    learned: boolean;
    /** 是否为未实装的参考项（`includeReference` 带出时才会出现） */
    reference_only: boolean;
    /** 出招方式：melee 近身 / ranged 远程 / dynamic 条件判定 / none 不主动施放 */
    range: SkillRange;
    /** `range === 'dynamic'` 时的判定规则 */
    range_rule: SkillRangeRule | null;
}

export interface ListCastableOptions {
    /**
     * 只列已学（**默认 true**）。
     * ⚠ 机甲初始 / 获得时 `Skills` 为空（甚至没有该字段），只有用技能书学会才会写入 ——
     *   所以新机甲的技能面板**本来就是空的**（预期行为）。
     *   传 `false` 切「技能图鉴」模式：按职业线列出全部可施放技能。
     */
    learnedOnly?: boolean;
    /** 已学技能原始写法 */
    learned?: any;
    /** 技能等级表 */
    levels?: Record<string, number> | any;
    /** 职业线（1/2/3 或 fighter/shooter/universal）；仅 `learnedOnly=false` 时用于过滤 */
    classLine?: string | number | null;
    /** 是否带出未实装的参考项（默认 false；带出时 usable 仍为 false，交给 UI 灰显） */
    includeReference?: boolean;
}

/** 列出该单位的技能（含等级 / 消耗 / 可用性），供 UI 接入。与服务端同口径。 */
export function listCastableSkills(
    ctx: CastContext,
    options: ListCastableOptions = {},
): CastableSkill[] {
    const learnedOnly = options.learnedOnly !== false;
    const includeReference = options.includeReference === true;
    const learnedRaw = options.learned !== undefined ? options.learned : ctx.learned;
    const hasLearnedField = learnedRaw !== undefined && learnedRaw !== null;
    const learned = learnedSkillKeys(learnedRaw);
    const lineRaw = options.classLine !== undefined ? options.classLine : ctx.classLine;
    const line = (lineRaw === undefined || lineRaw === null || lineRaw === '')
        ? null
        : resolveClassLine(lineRaw);
    const out: CastableSkill[] = [];
    for (const s of allSkillDefs()) {
        if (s.reference_only && !includeReference) continue;
        if (String(s.category || '') === 'skill_3') continue; // 自动触发技（生命/能量恢复）不进主动技能栏
        if (learnedOnly) {
            // 只列已学：机甲初始 / 获得时没学任何技能 → 空列表（预期行为）
            if (!learned.has(s.key)) continue;
        } else if (line) {
            // 图鉴模式：按职业线列全量。本线专属 + `all`（三线通用）
            const cls = String(s.classes || 'all');
            if (cls !== 'all' && cls !== line) continue;
        }
        const chk = canCastSkill(s, {
            mp: ctx.mp,
            maxMp: ctx.maxMp,
            learned: hasLearnedField ? learnedRaw : undefined,
        });
        const scope = resolveScope(s.scope);
        out.push({
            key: s.key,
            name: s.name,
            anim: s.anim ?? null,
            iconIndex: skillIconOf(s),
            category: s.category ?? null,
            classes: s.classes ?? null,
            type: s.type ?? null,
            scope: scope.scope,
            scope_desc: s.scope_desc ?? null,
            target: s.target ?? scope.target,
            side: s.side ?? scope.side,
            damage_type: s.damage_type,
            mp_cost_percent: num(s.mp_cost_percent),
            mp_cost: chk.mp_cost,
            level: resolveSkillLevel(options.levels, s.key),
            max_level: SKILL_LEVEL_MAX,
            lv_manual: !!s.lv_manual,
            book_id: s.book_id ?? null,
            usable: chk.ok,
            reason: chk.reason,
            learned: !hasLearnedField || learned.has(s.key),
            reference_only: !!s.reference_only,
            range: skillRangeOf(s),
            range_rule: s.range_rule ?? null,
        });
    }
    // 已学排最前（稳定排序：同组保持技能表原顺序），与服务端一致
    out.sort((a, b) => (a.learned === b.learned ? 0 : a.learned ? -1 : 1));
    return out;
}

// ---------------------------------------------------------------------------
// 动作构造 / 归一化（发给服务端的就是它）
// ---------------------------------------------------------------------------

/** 构造技能指令（服务端 `normalize_action` 可直接吃） */
export function buildSkillAction(skillKey: unknown): NormalizedAction {
    const key = resolveSkillRef(skillKey) ?? (skillKey === null || skillKey === undefined ? null : String(skillKey));
    return { type: 'SKILL', skill_key: key };
}

/**
 * 把客户端动作归一成统一结构（与服务端 `normalize_action` 同口径）。
 * 支持：'ATTACK' / 'DEFEND' / 'ESCAPE' / 'SKILL:roubo' / {type,skill_key} / {skill_key}
 */
export function normalizeAction(raw: any): NormalizedAction | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text) return null;
        if (text.indexOf(':') >= 0) {
            const i = text.indexOf(':');
            const head = text.slice(0, i).trim().toUpperCase();
            const tail = text.slice(i + 1).trim();
            const act: NormalizedAction = { type: head as ActionType };
            if (tail) act.skill_key = resolveSkillRef(tail) ?? tail;
            return act;
        }
        const up = text.toUpperCase();
        if (up === 'ATTACK' || up === 'DEFEND' || up === 'ESCAPE' || up === 'SKILL' || up === 'ITEM') {
            return { type: up as ActionType };
        }
        const key = resolveSkillRef(text);
        return key ? { type: 'SKILL', skill_key: key } : (up ? { type: up as ActionType } : null);
    }
    if (typeof raw === 'object') {
        const o = raw as any;
        let t = o.type ?? o.action_type ?? o.action ?? o.kind;
        const skillRef = o.skill_key ?? o.skillKey ?? o.skill ?? o.skill_id;
        let tNorm = t ? String(t).trim().toUpperCase() : '';
        if (!tNorm) tNorm = skillRef ? 'SKILL' : '';
        if (tNorm === 'SKILL') {
            return { type: 'SKILL', skill_key: resolveSkillRef(skillRef) };
        }
        if (tNorm === 'ATTACK' || tNorm === 'DEFEND' || tNorm === 'ESCAPE' || tNorm === 'ITEM') {
            return { type: tNorm as ActionType };
        }
        return null;
    }
    return null;
}

/** 取动作的字符串类型；兼容历史数据里直接存字符串的写法 */
export function actionTypeOf(action: any): string {
    if (typeof action === 'string') return action.trim().toUpperCase();
    if (action && typeof action === 'object') return String(action.type ?? '').trim().toUpperCase();
    return '';
}

// ---------------------------------------------------------------------------
// 结算结果读取（服务端 round_events → 客户端表现层）
// ---------------------------------------------------------------------------

export interface RoundEvent {
    /** 'player' | 'enemy' */
    side: string;
    /** 动作类型：'ATTACK' | 'SKILL' | 'DEFEND'（服务端字段名就是 action） */
    action?: string;
    /** 兼容旧字段名（部分历史数据写成 type） */
    type?: string;
    /** SKILL 时给出 */
    skill_key?: string | null;
    skill_name?: string | null;
    /** 要播的技能特效名（Skill 节点播放列表内的动画名） */
    anim?: string | null;
    /** 技能等级 */
    level?: number;
    /** 多段次数 */
    repeats?: number;
    /** 能量消耗 / 结算后剩余能量 */
    mp_cost?: number;
    mp_after?: number;
    /** 被作用方明细 */
    targets?: Array<Record<string, any>>;
    /** 治疗 / 吸血 / 回蓝明细 */
    heals?: Array<Record<string, any>>;
    /** 已生效效果 */
    effects?: Array<Record<string, any>>;
    /** 待口径的额外效果（buff / 状态） */
    pending_effects?: Array<Record<string, any>>;
    /** 施放失败原因（技能不存在 / 能量不足 / 尚未学会…） */
    failed?: string | null;
    /** 事件标签（展示用） */
    label?: string;
    [k: string]: any;
}

/** 取一条 round_event 的展示名（技能名优先，其次普攻/防御…） */
export function roundEventLabel(ev: RoundEvent | null | undefined): string {
    if (!ev) return '';
    if (ev.label) return String(ev.label);
    if (ev.skill_name) return String(ev.skill_name);
    const key = ev.skill_key ? resolveSkillRef(ev.skill_key) : null;
    const def = key ? getSkillDef(key) : null;
    if (def) return def.name;
    const t = String(ev.action ?? ev.type ?? '').trim().toUpperCase();
    if (t === 'ATTACK') return '普通攻击';
    if (t === 'DEFEND') return '防御';
    if (t === 'ESCAPE') return '逃跑';
    if (t === 'SKILL') return '技能';
    return t;
}
