"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SKILL_ICON = exports.SKILL_ICON_FRAMES = exports.SKILL_ICON_ATLAS_PATH = exports.DEFAULT_SKILL_RANGE = exports.MANUAL_UPGRADE_REQ = exports.SKILL_LEVEL_MULTIPLIERS = exports.SKILL_LEVEL_MAX = exports.NORMAL_ATTACK_BY_CLASS = exports.DAMAGE_CODE = exports.GUN_WEAPON_IDS = exports.CLASS_NUM_TO_LINE = void 0;
exports.resolveClassLine = resolveClassLine;
exports.isGunItemId = isGunItemId;
exports.hasGunEquipped = hasGunEquipped;
exports.equipmentOf = equipmentOf;
exports.resolveNormalAttack = resolveNormalAttack;
exports.evalSkillFormula = evalSkillFormula;
exports.calcNormalAttackDamage = calcNormalAttackDamage;
exports.skillRangeOf = skillRangeOf;
exports.isRangedSkill = isRangedSkill;
exports.skillIconOf = skillIconOf;
exports.setSkillCatalog = setSkillCatalog;
exports.getSkillCatalog = getSkillCatalog;
exports.allSkillDefs = allSkillDefs;
exports.getSkillDef = getSkillDef;
exports.resolveSkillRef = resolveSkillRef;
exports.formulaOf = formulaOf;
exports.damageCodeOf = damageCodeOf;
exports.skillMatchesClass = skillMatchesClass;
exports.resolveScope = resolveScope;
exports.skillLevelMultiplier = skillLevelMultiplier;
exports.applySkillLevel = applySkillLevel;
exports.normalizeSkillLevels = normalizeSkillLevels;
exports.resolveSkillLevel = resolveSkillLevel;
exports.autoUpgradeChance = autoUpgradeChance;
exports.rollAutoUpgrade = rollAutoUpgrade;
exports.checkManualUpgrade = checkManualUpgrade;
exports.mpCostOf = mpCostOf;
exports.learnedSkillKeys = learnedSkillKeys;
exports.canCastSkill = canCastSkill;
exports.listCastableSkills = listCastableSkills;
exports.buildSkillAction = buildSkillAction;
exports.normalizeAction = normalizeAction;
exports.actionTypeOf = actionTypeOf;
exports.roundEventLabel = roundEventLabel;
/** 职业线数值（与客户端 `data.Class` 一致：1 格斗 / 2 射击 / 3 全能） */
exports.CLASS_NUM_TO_LINE = {
    1: 'fighter',
    2: 'shooter',
    3: 'universal',
};
/** 枪械类武器 id（来源 Z_GamePlay.js GUN_WEAPON_IDS，28–51） */
exports.GUN_WEAPON_IDS = [
    28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];
/** damage_type 字符串 ↔ RPG 数字（与 Skills.json / 服务端 DAMAGE_CODE 一致） */
exports.DAMAGE_CODE = {
    none: 0,
    hp_damage: 1,
    mp_damage: 2,
    hp_drain: 3,
    mp_drain: 4,
    hp_recover: 5,
    mp_recover: 6,
};
/**
 * 普通攻击三职业三公式（来源 Z_GamePlay.js 覆写 attackSkillId）
 *   格斗 → 默认普攻（不持枪也是它）
 *   射击 / 全能 → 仅在**装备枪械**时覆盖默认普攻
 *
 * ⚠ `formulaScaled` 与 `Skills.json` 的 `normal_attack.by_class[].formula_scaled` 保持一致；
 *   运行时若已注入目录（`setSkillCatalog`），则以目录为准（见 `resolveNormalAttack`）。
 */
exports.NORMAL_ATTACK_BY_CLASS = {
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
exports.SKILL_LEVEL_MAX = 4;
exports.SKILL_LEVEL_MULTIPLIERS = [1.0, 1.2, 1.3, 1.5];
/** 手动升级条件：目标等级 → 需要技能书数 / 需要机甲等级（来源 Z_SkillLevel.js） */
exports.MANUAL_UPGRADE_REQ = {
    2: { books: 1, mechLevel: 25 },
    3: { books: 2, mechLevel: 40 },
    4: { books: 3, mechLevel: 50 },
};
// ---------------------------------------------------------------------------
// 职业线 / 持枪判定
// ---------------------------------------------------------------------------
/** 把数值职业（1/2/3）或字符串职业转成职业线；无法识别时按格斗处理 */
function resolveClassLine(classValue) {
    if (typeof classValue === 'string') {
        const s = classValue.trim().toLowerCase();
        if (s === 'shooter' || s === 'sheji' || s === '射击' || s === '射击型')
            return 'shooter';
        if (s === 'universal' || s === 'quanneng' || s === '全能' || s === '全能型')
            return 'universal';
        if (s === 'fighter' || s === 'gedou' || s === '格斗' || s === '格斗型')
            return 'fighter';
        const n = Number(s);
        if (!Number.isNaN(n) && exports.CLASS_NUM_TO_LINE[n])
            return exports.CLASS_NUM_TO_LINE[n];
        return 'fighter';
    }
    const n = Number(classValue);
    return exports.CLASS_NUM_TO_LINE[n] || 'fighter';
}
/** 单个物品 id 是否为枪械类武器 */
function isGunItemId(itemId) {
    const n = Number(itemId);
    return !Number.isNaN(n) && exports.GUN_WEAPON_IDS.indexOf(n) >= 0;
}
/** 取槽位里的 item id（兼容 {item_id}/{itemId}/{id}/直接给值） */
function slotItemId(slot) {
    var _a, _b, _c;
    if (slot === null || slot === undefined)
        return null;
    if (typeof slot === 'object') {
        const v = (_c = (_b = (_a = slot.item_id) !== null && _a !== void 0 ? _a : slot.itemId) !== null && _b !== void 0 ? _b : slot.id) !== null && _c !== void 0 ? _c : slot.ItemID;
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
function hasGunEquipped(equipment) {
    if (!equipment)
        return false;
    if (Array.isArray(equipment)) {
        return equipment.some((it) => isGunItemId(slotItemId(it)));
    }
    if (typeof equipment !== 'object') {
        return isGunItemId(slotItemId(equipment));
    }
    const gunSlot = equipment.Gun || equipment.gun;
    if (gunSlot && isGunItemId(slotItemId(gunSlot)))
        return true;
    // 兜底：整份装备里任何槽位是枪械都算（只扫 dict/list 形态的槽位）
    for (const k of Object.keys(equipment)) {
        const slot = equipment[k];
        if (slot && typeof slot === 'object' && isGunItemId(slotItemId(slot)))
            return true;
    }
    return false;
}
/** 从角色文档里取装备（兼容 Equipment/equipment/Equip/equip） */
function equipmentOf(doc) {
    if (!doc || typeof doc !== 'object')
        return null;
    for (const k of ['Equipment', 'equipment', 'Equip', 'equip']) {
        const v = doc[k];
        if (v && typeof v === 'object')
            return v;
    }
    return null;
}
/** 取该单位实际使用的普攻定义（运行时若已注入目录，优先用目录里的 formula_scaled） */
function resolveNormalAttack(classValue, gunEquipped) {
    const line = resolveClassLine(classValue);
    let def = exports.NORMAL_ATTACK_BY_CLASS[line];
    if (def.requiresGun && !gunEquipped)
        def = exports.NORMAL_ATTACK_BY_CLASS.fighter;
    const override = catalogNormalAttackDef(def.classes);
    if (override && override.formulaScaled) {
        return Object.assign(Object.assign(Object.assign({}, def), override), { classes: def.classes, requiresGun: def.requiresGun });
    }
    return def;
}
/** 从已注入的目录里取某职业线的普攻定义（未注入返回 null） */
function catalogNormalAttackDef(line) {
    const na = _catalog && _catalog.normal_attack;
    if (!na || !Array.isArray(na.by_class))
        return null;
    const hit = na.by_class.find((c) => c && c.classes === line);
    if (!hit)
        return null;
    return {
        classes: line,
        name: hit.name || exports.NORMAL_ATTACK_BY_CLASS[line].name,
        requiresGun: !!hit.requires_gun,
        formula: hit.formula || exports.NORMAL_ATTACK_BY_CLASS[line].formula,
        formulaScaled: hit.formula_scaled || hit.formula || exports.NORMAL_ATTACK_BY_CLASS[line].formulaScaled,
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
function num(v) {
    if (v === undefined || v === null || v === '')
        return 0;
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
function evalSkillFormula(formula, atk, def) {
    if (formula === null || formula === undefined)
        return null;
    const text = String(formula).trim();
    if (!text)
        return null;
    const plain = PLAIN_NUMBER_RE.exec(text);
    if (plain)
        return Number(plain[1]);
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
function calcNormalAttackDamage(classValue, gunEquipped, atk, def) {
    const def_ = resolveNormalAttack(classValue, gunEquipped);
    const raw = evalSkillFormula(def_.formulaScaled || def_.formula, atk, def);
    if (raw === null)
        return { damage: null, def: def_ };
    return { damage: Math.max(1, Math.floor(raw)), def: def_ };
}
/** 距离判定的兜底值（与生成器 `range_for` 一致：未登记按远程处理） */
exports.DEFAULT_SKILL_RANGE = 'ranged';
/** 取技能出招方式（未登记 → `ranged`）。 */
function skillRangeOf(skill) {
    const r = skill ? String(skill.range || '') : '';
    return (r === 'melee' || r === 'ranged' || r === 'dynamic' || r === 'none')
        ? r
        : exports.DEFAULT_SKILL_RANGE;
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
function isRangedSkill(skill, hasGun = false) {
    if (!skill)
        return !!hasGun; // 无定义 → 与普攻完全同一口径
    const r = String(skill.range || '');
    if (r === 'melee')
        return false;
    if (r === 'none')
        return false; // 被动，不主动施放
    if (r === 'dynamic') {
        // 目前唯一的动态规则：持枪 → 远程，否则近身（= 普攻口径）
        const rule = skill.range_rule ? String(skill.range_rule.rule || '') : '';
        if (rule === 'gun')
            return !!hasGun;
        return !!hasGun; // 未知动态规则同样按普攻口径
    }
    return true; // ranged / 未登记（数据侧保证已登记）
}
/**
 * 技能图标图集的 resources 加载路径（SpriteAtlas）。
 * ⚠ 资源已从 `assets/UI/Skill_icon/` 移入 `assets/resources/SkillIcon/`（2026-09-30），
 *   因此可以 `resources.load(SKILL_ICON_ATLAS_PATH, SpriteAtlas)`，**不需要在编辑器挂图集属性**。
 *   取帧：`atlas.getSpriteFrame(skill.iconIndex || DEFAULT_SKILL_ICON)`。
 */
exports.SKILL_ICON_ATLAS_PATH = 'SkillIcon/SkillIcon';
/** 分类图标帧名（口径见 tools/skill_category_todo.md）：1 攻击 / 2 被动 / 3 自动触发 / 4 悟性攻击 / 5 悟性被动 */
exports.SKILL_ICON_FRAMES = ['skill_1', 'skill_2', 'skill_3', 'skill_4', 'skill_5'];
/** 缺省分类图标（未填分类时沿用 skill_1） */
exports.DEFAULT_SKILL_ICON = 'skill_1';
/** 取技能图标帧名（缺省 `skill_1`）。 */
function skillIconOf(skill) {
    const i = skill ? skill.iconIndex : null;
    return i ? String(i) : exports.DEFAULT_SKILL_ICON;
}
let _catalog = null;
/** 注入技能目录（BattleScene 在 resources.load('json/Skills') 之后调用一次） */
function setSkillCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.skills)) {
        _catalog = null;
        return;
    }
    _catalog = catalog;
}
function getSkillCatalog() {
    return _catalog;
}
function allSkillDefs() {
    return _catalog ? _catalog.skills.slice() : [];
}
/** 按 skill key 取技能；找不到返回 null */
function getSkillDef(key) {
    if (key === null || key === undefined)
        return null;
    const k = String(key).trim();
    if (!k)
        return null;
    const list = allSkillDefs();
    for (const s of list)
        if (s.key === k)
            return s;
    return null;
}
/**
 * 把「已学技能」里的任意一项归一成 skill key。
 * 支持：skill key / 中文名 / 技能书 id / RPG skill id。认不出返回 null（**绝不猜**）。
 */
function resolveSkillRef(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw === 'object') {
        const o = raw;
        for (const f of ['key', 'skill_key', 'SkillKey', 'id', 'name']) {
            if (o[f] !== undefined) {
                const hit = resolveSkillRef(o[f]);
                if (hit)
                    return hit;
            }
        }
        return null;
    }
    const text = String(raw).trim();
    if (!text)
        return null;
    const list = allSkillDefs();
    for (const s of list)
        if (s.key === text)
            return s.key;
    for (const s of list)
        if (s.name === text)
            return s.key;
    if (/^\d+$/.test(text)) {
        const n = Number(text);
        for (const field of ['book_id', 'rpg_skill_id']) {
            const hits = list.filter((s) => s[field] === n);
            if (hits.length === 1)
                return hits[0].key;
        }
    }
    return null;
}
/** 实际结算用式：优先 `formula_scaled`（口径 A），回落 `formula` */
function formulaOf(skill) {
    if (!skill)
        return null;
    const f = skill.formula_scaled !== undefined && skill.formula_scaled !== null
        ? skill.formula_scaled
        : skill.formula;
    return f === undefined || f === null ? null : String(f);
}
/** damage_type → RPG 数字 */
function damageCodeOf(skill) {
    var _a;
    if (!skill)
        return 0;
    return (_a = exports.DAMAGE_CODE[String(skill.damage_type || 'none')]) !== null && _a !== void 0 ? _a : 0;
}
/** 该技能是否与某职业线匹配（'all' / '通用' 视为全职业可用） */
function skillMatchesClass(skill, classLine) {
    if (!skill)
        return false;
    const c = String(skill.classes || '').trim().toLowerCase();
    if (!c || c === 'all' || c === '通用')
        return true;
    return c === classLine;
}
/** scope → 目标信息（与服务端 `resolve_scope` 同口径） */
function resolveScope(scope) {
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
function skillLevelMultiplier(level) {
    var _a;
    const idx = Math.max(1, Math.floor(level || 1)) - 1;
    return (_a = exports.SKILL_LEVEL_MULTIPLIERS[idx]) !== null && _a !== void 0 ? _a : exports.SKILL_LEVEL_MULTIPLIERS[0];
}
/** 按技能等级放大伤害：floor(基础伤害 × 倍率) */
function applySkillLevel(baseDamage, level) {
    return Math.floor(baseDamage * skillLevelMultiplier(level));
}
/** 归一化技能等级表：{任意写法 → 合法等级 1..MAX} */
function normalizeSkillLevels(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object')
        return out;
    for (const k of Object.keys(raw)) {
        const key = resolveSkillRef(k);
        const n = Math.floor(num(raw[k]));
        if (key && n > 0)
            out[key] = Math.min(n, exports.SKILL_LEVEL_MAX);
    }
    return out;
}
/** 该机甲对该技能的等级；未记录按 Lv1 */
function resolveSkillLevel(levels, skillKey) {
    const key = resolveSkillRef(skillKey);
    if (!key)
        return 1;
    const table = levels && typeof levels === 'object' ? levels : {};
    const lv = Math.floor(num(table[key]));
    return Math.max(1, Math.min(lv || 1, exports.SKILL_LEVEL_MAX));
}
/** 自动升级概率 = 悟性 / 100 × 0.1 → 悟性 40~100 时 4%~10% */
function autoUpgradeChance(comprehension) {
    const c = Math.max(0, num(comprehension));
    return (c / 100) * 0.1;
}
/**
 * 自动升级判定（机甲升级时逐个已学技能调用）
 * @param rng 可注入随机源，便于测试；默认 Math.random
 */
function rollAutoUpgrade(comprehension, currentLevel, rng = Math.random) {
    if (currentLevel >= exports.SKILL_LEVEL_MAX)
        return false;
    const chance = autoUpgradeChance(comprehension);
    if (chance <= 0)
        return false;
    return rng() < chance;
}
/**
 * 手动升级条件校验（花技能书 + 达到机甲等级）
 * @param hasBook 该技能是否有对应技能书（悟性技能无书 → 不可手动升）
 */
function checkManualUpgrade(currentLevel, bookCount, mechLevel, hasBook) {
    if (currentLevel >= exports.SKILL_LEVEL_MAX) {
        return { ok: false, reason: '已达到最高等级', needBooks: 0, needMechLevel: 0 };
    }
    if (!hasBook) {
        return { ok: false, reason: '该技能不支持升级', needBooks: 0, needMechLevel: 0 };
    }
    const req = exports.MANUAL_UPGRADE_REQ[currentLevel + 1];
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
function mpCostOf(skill, maxMp) {
    if (!skill)
        return 0;
    const pct = num(skill.mp_cost_percent);
    if (pct <= 0)
        return 0;
    const mm = Math.floor(num(maxMp));
    if (mm <= 0)
        return 0;
    return Math.max(1, Math.floor((mm * pct) / 100));
}
/** 归一化「已学技能」为 key 集合 */
function learnedSkillKeys(learned) {
    const out = new Set();
    if (learned === null || learned === undefined)
        return out;
    const list = Array.isArray(learned) ? learned : [learned];
    for (const item of list) {
        const key = resolveSkillRef(item);
        if (key)
            out.add(key);
    }
    return out;
}
/**
 * 是否可主动施放（已学 + 能量足够 + 是主动技）。返回 {ok, reason, mp_cost}。
 * reason 与 `listCastableSkills` 一致，可直接展示。
 */
function canCastSkill(skill, ctx) {
    if (!skill)
        return { ok: false, reason: '技能不存在', mp_cost: 0 };
    const cost = mpCostOf(skill, ctx.maxMp);
    if (skill.trigger)
        return { ok: false, reason: '该技能为自动触发技，不能主动施放', mp_cost: cost };
    if (skill.reference_only)
        return { ok: false, reason: '该技能仅为参考项，未实装', mp_cost: cost };
    if (ctx.learned !== undefined && ctx.learned !== null) {
        const learned = learnedSkillKeys(ctx.learned);
        if (learned.size && !learned.has(skill.key)) {
            return { ok: false, reason: '尚未学会该技能', mp_cost: cost };
        }
    }
    if (num(ctx.mp) < cost)
        return { ok: false, reason: '能量不足', mp_cost: cost };
    return { ok: true, reason: '', mp_cost: cost };
}
/** 列出该单位的技能（含等级 / 消耗 / 可用性），供 UI 接入。与服务端同口径。 */
function listCastableSkills(ctx, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const learnedOnly = options.learnedOnly !== false;
    const includeReference = options.includeReference === true;
    const learnedRaw = options.learned !== undefined ? options.learned : ctx.learned;
    const hasLearnedField = learnedRaw !== undefined && learnedRaw !== null;
    const learned = learnedSkillKeys(learnedRaw);
    const lineRaw = options.classLine !== undefined ? options.classLine : ctx.classLine;
    const line = (lineRaw === undefined || lineRaw === null || lineRaw === '')
        ? null
        : resolveClassLine(lineRaw);
    const out = [];
    for (const s of allSkillDefs()) {
        if (s.reference_only && !includeReference)
            continue;
        if (String(s.category || '') === 'skill_3')
            continue; // 自动触发技（生命/能量恢复）不进主动技能栏
        if (learnedOnly) {
            // 只列已学：机甲初始 / 获得时没学任何技能 → 空列表（预期行为）
            if (!learned.has(s.key))
                continue;
        }
        else if (line) {
            // 图鉴模式：按职业线列全量。本线专属 + `all`（三线通用）
            const cls = String(s.classes || 'all');
            if (cls !== 'all' && cls !== line)
                continue;
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
            anim: (_a = s.anim) !== null && _a !== void 0 ? _a : null,
            iconIndex: skillIconOf(s),
            category: (_b = s.category) !== null && _b !== void 0 ? _b : null,
            classes: (_c = s.classes) !== null && _c !== void 0 ? _c : null,
            type: (_d = s.type) !== null && _d !== void 0 ? _d : null,
            scope: scope.scope,
            scope_desc: (_e = s.scope_desc) !== null && _e !== void 0 ? _e : null,
            target: (_f = s.target) !== null && _f !== void 0 ? _f : scope.target,
            side: (_g = s.side) !== null && _g !== void 0 ? _g : scope.side,
            damage_type: s.damage_type,
            mp_cost_percent: num(s.mp_cost_percent),
            mp_cost: chk.mp_cost,
            level: resolveSkillLevel(options.levels, s.key),
            max_level: exports.SKILL_LEVEL_MAX,
            lv_manual: !!s.lv_manual,
            book_id: (_h = s.book_id) !== null && _h !== void 0 ? _h : null,
            usable: chk.ok,
            reason: chk.reason,
            learned: !hasLearnedField || learned.has(s.key),
            reference_only: !!s.reference_only,
            range: skillRangeOf(s),
            range_rule: (_j = s.range_rule) !== null && _j !== void 0 ? _j : null,
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
function buildSkillAction(skillKey) {
    var _a;
    const key = (_a = resolveSkillRef(skillKey)) !== null && _a !== void 0 ? _a : (skillKey === null || skillKey === undefined ? null : String(skillKey));
    return { type: 'SKILL', skill_key: key };
}
/**
 * 把客户端动作归一成统一结构（与服务端 `normalize_action` 同口径）。
 * 支持：'ATTACK' / 'DEFEND' / 'ESCAPE' / 'SKILL:roubo' / {type,skill_key} / {skill_key}
 */
function normalizeAction(raw) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text)
            return null;
        if (text.indexOf(':') >= 0) {
            const i = text.indexOf(':');
            const head = text.slice(0, i).trim().toUpperCase();
            const tail = text.slice(i + 1).trim();
            const act = { type: head };
            if (tail)
                act.skill_key = (_a = resolveSkillRef(tail)) !== null && _a !== void 0 ? _a : tail;
            return act;
        }
        const up = text.toUpperCase();
        if (up === 'ATTACK' || up === 'DEFEND' || up === 'ESCAPE' || up === 'SKILL' || up === 'ITEM') {
            return { type: up };
        }
        const key = resolveSkillRef(text);
        return key ? { type: 'SKILL', skill_key: key } : (up ? { type: up } : null);
    }
    if (typeof raw === 'object') {
        const o = raw;
        let t = (_d = (_c = (_b = o.type) !== null && _b !== void 0 ? _b : o.action_type) !== null && _c !== void 0 ? _c : o.action) !== null && _d !== void 0 ? _d : o.kind;
        const skillRef = (_g = (_f = (_e = o.skill_key) !== null && _e !== void 0 ? _e : o.skillKey) !== null && _f !== void 0 ? _f : o.skill) !== null && _g !== void 0 ? _g : o.skill_id;
        let tNorm = t ? String(t).trim().toUpperCase() : '';
        if (!tNorm)
            tNorm = skillRef ? 'SKILL' : '';
        if (tNorm === 'SKILL') {
            return { type: 'SKILL', skill_key: resolveSkillRef(skillRef) };
        }
        if (tNorm === 'ATTACK' || tNorm === 'DEFEND' || tNorm === 'ESCAPE' || tNorm === 'ITEM') {
            return { type: tNorm };
        }
        return null;
    }
    return null;
}
/** 取动作的字符串类型；兼容历史数据里直接存字符串的写法 */
function actionTypeOf(action) {
    var _a;
    if (typeof action === 'string')
        return action.trim().toUpperCase();
    if (action && typeof action === 'object')
        return String((_a = action.type) !== null && _a !== void 0 ? _a : '').trim().toUpperCase();
    return '';
}
/** 取一条 round_event 的展示名（技能名优先，其次普攻/防御…） */
function roundEventLabel(ev) {
    var _a, _b;
    if (!ev)
        return '';
    if (ev.label)
        return String(ev.label);
    if (ev.skill_name)
        return String(ev.skill_name);
    const key = ev.skill_key ? resolveSkillRef(ev.skill_key) : null;
    const def = key ? getSkillDef(key) : null;
    if (def)
        return def.name;
    const t = String((_b = (_a = ev.action) !== null && _a !== void 0 ? _a : ev.type) !== null && _b !== void 0 ? _b : '').trim().toUpperCase();
    if (t === 'ATTACK')
        return '普通攻击';
    if (t === 'DEFEND')
        return '防御';
    if (t === 'ESCAPE')
        return '逃跑';
    if (t === 'SKILL')
        return '技能';
    return t;
}
