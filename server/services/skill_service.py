# -*- coding: utf-8 -*-
"""技能目录 + 战斗结算辅助（服务端权威）

职责
----
1. 读取并缓存 `server/data/Skills.json`（权威数据，version 6）；
2. 把「已学技能」的多种写法（key / 中文名 / 技能书 id / RPG skill id）归一成 skill key；
3. 提供普攻定义解析（职业线 + 是否持枪）；
4. 提供技能等级倍率、能量消耗、可施放判定；
5. 把客户端动作归一成统一结构（ATTACK / DEFEND / ESCAPE / SKILL）。

伤害结算本身由 `battle_room_service._exec_action` 调用 `skill_formula.make_damage_value`
完成（复刻 rpg_objects.js 的 makeDamageValue 全链）。

⚠ 公式缩放口径（2026-09-30 用户拍板 = 方案 A）
   实际结算**只用 `formula_scaled`**（= `a.atk ÷ 3` 且去掉末尾纯数字加项），
   `formula` 是 RPG 原式，仅作溯源。两端（服务端 / 客户端）读同一字段，口径唯一。
"""
from __future__ import annotations

import io
import json
import os
import threading
from typing import Any, Dict, List, Optional

__all__ = [
    "SkillServiceError",
    "load_catalog",
    "reload_catalog",
    "catalog_meta",
    "all_skills",
    "get_skill",
    "resolve_skill_ref",
    "formula_of",
    "damage_code",
    "class_line_of",
    "has_gun_equipped",
    "normal_attack_def",
    "normal_attack_skill",
    "skill_level_of",
    "skill_level_max",
    "apply_skill_level",
    "mp_cost",
    "learned_skill_keys",
    "learned_skill_list",
    "LEARNED_FIELD",
    "can_cast_skill",
    "normalize_action",
    "action_type_of",
    "list_castable_skills",
    "DAMAGE_CODE",
    "SKILL_RANGE_MELEE",
    "SKILL_RANGE_RANGED",
    "SKILL_RANGE_DYNAMIC",
    "SKILL_RANGE_NONE",
    "skill_range_of",
    "is_ranged_skill",
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_PATH = os.path.join(ROOT, "data", "Skills.json")

# damage_type 字符串 ↔ RPG 数字（见 Skills.json notes）
DAMAGE_CODE: Dict[str, int] = {
    "none": 0,
    "hp_damage": 1,
    "mp_damage": 2,
    "hp_drain": 3,
    "mp_drain": 4,
    "hp_recover": 5,
    "mp_recover": 6,
}

# 职业线（1 格斗 / 2 射击 / 3 全能）
CLASS_NUM_TO_LINE = {1: "fighter", 2: "shooter", 3: "universal"}

# 机甲宠物文档里存「已学技能」的字段名（服务端 / 客户端同口径）。
# ⚠ 机甲**初始 / 获得时该字段为空**（甚至不存在），只有用技能书学会才会写入 ——
#   字段缺失时 `$set` 会自动创建，因此天然兼容旧玩家数据。
LEARNED_FIELD = "Skills"

# 装备槽位键（兜底扫描持枪时只认这些键，避免误判数值字段）
_SLOT_KEYS = (
    "Weapon", "Gun", "Wing", "Dun", "Armor", "Shield", "Item",
    "weapon", "gun", "wing", "dun", "armor", "shield", "item",
    "武器", "枪", "机翼", "盾", "装甲",
)

# effect code（RPG Maker MV）
EFFECT_ADD_STATE = 21
EFFECT_REMOVE_STATE = 22
EFFECT_ADD_BUFF = 31
EFFECT_REMOVE_BUFF = 32
EFFECT_HP_RECOVER_RATIO = 11
EFFECT_MP_RECOVER_RATIO = 12

# 出招方式 / 距离口径（Skills.json 每条技能的 `range` 字段）
#   口径来源 `tools/skill_range_todo.md`（用户填表，2026-10-01 定稿）；与客户端 SkillData.ts 同口径。
SKILL_RANGE_MELEE = "melee"        # 近身：必须先位移贴近目标
SKILL_RANGE_RANGED = "ranged"      # 远程：原地即可出招
SKILL_RANGE_DYNAMIC = "dynamic"    # 按 range_rule 条件判定（当前仅「急速攻击」= 持枪判定）
SKILL_RANGE_NONE = "none"          # 不主动施放（自动触发被动），不涉及距离
SKILL_RANGE_VALUES = (
    SKILL_RANGE_MELEE, SKILL_RANGE_RANGED, SKILL_RANGE_DYNAMIC, SKILL_RANGE_NONE,
)

_ACTION_TYPES = ("ATTACK", "DEFEND", "ESCAPE", "SKILL", "ITEM")


class SkillServiceError(ValueError):
    """技能解析 / 施放校验失败。"""


# ---------------------------------------------------------------------------
# 目录加载（缓存 + mtime 失效，便于测试与热改）
# ---------------------------------------------------------------------------
_lock = threading.RLock()
_cache: Dict[str, Any] = {"mtime": None, "data": None}


def load_catalog(force: bool = False) -> Dict[str, Any]:
    """读取 Skills.json（带缓存；文件 mtime 变化自动失效）。"""
    with _lock:
        try:
            mtime = os.path.getmtime(SKILLS_PATH)
        except OSError:
            mtime = None
        if not force and _cache["data"] is not None and _cache["mtime"] == mtime:
            return _cache["data"]
        with io.open(SKILLS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _cache["data"] = data
        _cache["mtime"] = mtime
        return data


def reload_catalog() -> Dict[str, Any]:
    return load_catalog(force=True)


def catalog_meta() -> Dict[str, Any]:
    d = load_catalog()
    return {
        "version": d.get("version"),
        "formula_scale": d.get("formula_scale") or {},
        "skill_level": d.get("skill_level") or {},
        "icon_atlas": d.get("icon_atlas") or {},
        "normal_attack_enabled": bool((d.get("normal_attack") or {}).get("enabled")),
    }


def all_skills() -> List[Dict[str, Any]]:
    return list(load_catalog().get("skills") or [])


def get_skill(key: Any) -> Optional[Dict[str, Any]]:
    """按 skill key 取技能；找不到返回 None。"""
    if key is None:
        return None
    k = str(key).strip()
    if not k:
        return None
    for s in all_skills():
        if s.get("key") == k:
            return s
    return None


def resolve_skill_ref(raw: Any) -> Optional[str]:
    """把「已学技能」数组里的任意一项归一成 skill key。

    支持：skill key / 中文名 / 技能书 item id（int 或 "76"）/ RPG skill id。
    认不出返回 None（**绝不猜**）。
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        for field in ("key", "skill_key", "SkillKey", "id", "name"):
            if field in raw:
                hit = resolve_skill_ref(raw.get(field))
                if hit:
                    return hit
        return None

    text = str(raw).strip()
    if not text:
        return None

    skills = all_skills()
    for s in skills:
        if s.get("key") == text:
            return s["key"]
    for s in skills:
        if s.get("name") == text:
            return s["key"]

    # 技能书 id / RPG skill id（只在能唯一命中时返回）
    if text.isdigit():
        n = int(text)
        for field in ("book_id", "rpg_skill_id"):
            hits = [s["key"] for s in skills if s.get(field) == n]
            if len(hits) == 1:
                return hits[0]
    return None


def formula_of(skill: Dict[str, Any]) -> Optional[str]:
    """实际结算用式：优先 formula_scaled（口径 A），回落 formula。"""
    if not skill:
        return None
    f = skill.get("formula_scaled")
    if f is None:
        f = skill.get("formula")
    return None if f is None else str(f)


def damage_code(skill: Dict[str, Any]) -> int:
    return DAMAGE_CODE.get(str(skill.get("damage_type") or "none"), 0)


# ---------------------------------------------------------------------------
# 职业线 / 持枪
# ---------------------------------------------------------------------------
def class_line_of(raw: Any) -> str:
    """把 Class 字段（1/2/3 或字符串）归一成职业线；认不出按格斗。"""
    if isinstance(raw, dict):
        raw = raw.get("Class", raw.get("class", raw.get("ClassLine")))
    if isinstance(raw, str):
        s = raw.strip().lower()
        if s in ("shooter", "sheji", "射击", "射击型"):
            return "shooter"
        if s in ("universal", "quanneng", "全能", "全能型"):
            return "universal"
        if s in ("fighter", "gedou", "格斗", "格斗型"):
            return "fighter"
        if s.isdigit():
            return CLASS_NUM_TO_LINE.get(int(s), "fighter")
        return "fighter"
    try:
        return CLASS_NUM_TO_LINE.get(int(raw), "fighter")
    except (TypeError, ValueError):
        return "fighter"


def _gun_ids() -> set:
    na = load_catalog().get("normal_attack") or {}
    ids = na.get("gun_weapon_ids")
    if not ids:
        ids = list(range(28, 52))
    out = set()
    for i in ids:
        try:
            out.add(int(i))
        except (TypeError, ValueError):
            continue
    return out


def _slot_item_id(slot: Any) -> Optional[int]:
    if slot is None:
        return None
    if isinstance(slot, dict):
        for k in ("item_id", "itemId", "id", "ItemID"):
            if k in slot:
                slot = slot[k]
                break
        else:
            return None
    try:
        return int(slot)
    except (TypeError, ValueError):
        return None


def has_gun_equipped(doc: Any) -> bool:
    """是否装备了枪械类武器（id 28–51）。与客户端 hasGunEquipped 同口径。

    ⚠ 兜底扫描只认「装备槽」形态（dict / list 值，或已知槽位键），
      **绝不把 Level / Class 这类数值字段误判成武器 id**（否则 Level=30 会被当成枪械）。
    """
    if not isinstance(doc, dict):
        return False
    guns = _gun_ids()

    equipment = None
    for k in ("Equipment", "equipment", "Equip", "equip"):
        if isinstance(doc.get(k), (dict, list)):
            equipment = doc[k]
            break

    if isinstance(equipment, list):
        return any((_slot_item_id(it) in guns) for it in equipment)
    if isinstance(equipment, dict):
        for slot in equipment.values():
            if _slot_item_id(slot) in guns:
                return True

    # 兜底：只看已知槽位键 + dict/list 形态的字段
    for k in _SLOT_KEYS:
        if k in doc and _slot_item_id(doc[k]) in guns:
            return True
    for k, v in doc.items():
        if isinstance(v, (dict, list)) and _slot_item_id(v) in guns:
            return True
    return False


def skill_range_of(skill: Any) -> str:
    """取技能出招方式：melee 近身 / ranged 远程 / dynamic 条件判定 / none 不主动施放。

    口径来源：`tools/skill_range_todo.md`（用户填表，2026-10-01 定稿）。
    ⚠ 与客户端 `SkillData.skillRangeOf` 同口径；未登记 / 非法值一律按 `ranged` 兜底。
    """
    if not isinstance(skill, dict):
        return SKILL_RANGE_RANGED
    r = str(skill.get("range") or "")
    return r if r in SKILL_RANGE_VALUES else SKILL_RANGE_RANGED


def is_ranged_skill(skill: Any, actor: Any = None, gun_equipped: Optional[bool] = None) -> bool:
    """解析「这次出招是不是远程」——`dynamic` 按 `range_rule` 求值。

    `actor` 传入机甲/角色文档（用于持枪判定）；也可直接给 `gun_equipped`。
    `none`（自动触发被动）返回 False：它不主动施放，不需要判定距离。

    ⚠ **读不到技能定义时按普攻口径兜底**（持枪=远程，否则近身），与客户端
      `SkillData.isRangedSkill` 完全同口径；绝不能兜底成远程，否则近身技会原地出招。
    """
    if not isinstance(skill, dict):
        if gun_equipped is None:
            gun_equipped = has_gun_equipped(actor if isinstance(actor, dict) else {})
        return bool(gun_equipped)
    r = str(skill.get("range") or "")
    if r == SKILL_RANGE_NONE:
        return False
    if r == SKILL_RANGE_MELEE:
        return False
    if r == SKILL_RANGE_RANGED:
        return True
    if r == SKILL_RANGE_DYNAMIC:
        rule = ""
        rr = skill.get("range_rule") if isinstance(skill, dict) else None
        if isinstance(rr, dict):
            rule = str(rr.get("rule") or "")
        # 目前唯一的动态规则：持枪（武器 id 28–51）→ 远程，否则近身（与普攻同口径）
        if rule == "gun":
            if gun_equipped is None:
                gun_equipped = has_gun_equipped(actor if isinstance(actor, dict) else {})
            return bool(gun_equipped)
        # 未知动态规则同样按普攻口径（与客户端一致），不兜底成远程
        if gun_equipped is None:
            gun_equipped = has_gun_equipped(actor if isinstance(actor, dict) else {})
        return bool(gun_equipped)
    return True       # ranged / 未登记（数据侧保证已登记）


def normal_attack_def(raw: Any, gun_equipped: Optional[bool] = None) -> Dict[str, Any]:
    """取该单位实际使用的普攻定义（职业线 + 是否持枪）。"""
    na = load_catalog().get("normal_attack") or {}
    by_class = {c.get("classes"): c for c in (na.get("by_class") or [])}
    line = class_line_of(raw)
    if gun_equipped is None:
        gun_equipped = has_gun_equipped(raw if isinstance(raw, dict) else {})
    d = by_class.get(line) or by_class.get("fighter") or {}
    if d.get("requires_gun") and not gun_equipped:
        d = by_class.get("fighter") or d
    return d


def normal_attack_skill(raw: Any, gun_equipped: Optional[bool] = None) -> Dict[str, Any]:
    """把普攻包装成一个「伪技能」，字段与 Skills.json 的条目同构，便于统一结算。"""
    na = load_catalog().get("normal_attack") or {}
    d = normal_attack_def(raw, gun_equipped)
    formula = d.get("formula_scaled") or d.get("formula")
    return {
        "key": "__normal_attack__",
        "name": d.get("name") or "普通攻击",
        "anim": None,
        "category": None,
        "classes": d.get("classes"),
        "scope": 1,
        "target": "single",
        "side": "enemy",
        "scope_desc": "单体敌人",
        "damage_type": "hp_damage",
        "formula": d.get("formula"),
        "formula_scaled": formula,
        "variance": na.get("variance", 20),
        "critical": bool(na.get("critical", True)),
        "repeats": 1,
        "mp_cost_percent": 0,
        "is_normal_attack": True,
    }


# ---------------------------------------------------------------------------
# 技能等级
# ---------------------------------------------------------------------------
def skill_level_max() -> int:
    return int((load_catalog().get("skill_level") or {}).get("max_level") or 4)


def _level_multipliers() -> List[float]:
    m = (load_catalog().get("skill_level") or {}).get("multipliers")
    if not m:
        m = [1.0, 1.2, 1.3, 1.5]
    return [float(x) for x in m]


def _skill_levels(actor: Any) -> Dict[str, int]:
    raw = (actor or {}).get("raw") if isinstance(actor, dict) else None
    src = None
    for holder in (actor if isinstance(actor, dict) else {}, raw or {}):
        if not isinstance(holder, dict):
            continue
        for k in ("SkillLevels", "skill_levels", "SkillLevelMap"):
            if isinstance(holder.get(k), dict):
                src = holder[k]
                break
        if src is not None:
            break
    out: Dict[str, int] = {}
    for k, v in (src or {}).items():
        key = resolve_skill_ref(k)
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if key and n > 0:
            out[key] = n
    return out


def skill_level_of(actor: Any, skill_key: Any) -> int:
    """该机甲对该技能的等级；未记录按 Lv1。升级功能未开放时恒为 1。"""
    try:
        from services import skill_level_service as skill_level_svc
        if not skill_level_svc.ENABLE_SKILL_LEVEL_PROGRESSION:
            return 1
    except Exception:  # noqa: BLE001
        pass
    key = resolve_skill_ref(skill_key)
    if not key:
        return 1
    lv = _skill_levels(actor).get(key, 1)
    return max(1, min(lv, skill_level_max()))


def apply_skill_level(value: float, level: int) -> int:
    """按技能等级放大：floor(值 × 倍率)。"""
    idx = max(1, int(level or 1)) - 1
    mults = _level_multipliers()
    mult = mults[idx] if 0 <= idx < len(mults) else mults[0]
    return int(float(value) * mult // 1)


# ---------------------------------------------------------------------------
# 能量消耗 / 可施放判定
# ---------------------------------------------------------------------------
def mp_cost(actor: Any, skill: Dict[str, Any]) -> int:
    """能量消耗 = 最大 MP × mp_cost_percent%（向下取整，至少 1；被动/无消耗为 0）。"""
    pct = skill.get("mp_cost_percent") or 0
    try:
        pct = float(pct)
    except (TypeError, ValueError):
        return 0
    if pct <= 0:
        return 0
    max_mp = 0
    if isinstance(actor, dict):
        try:
            max_mp = int(actor.get("max_mp") or 0)
        except (TypeError, ValueError):
            max_mp = 0
    if max_mp <= 0:
        return 0
    return max(1, int(max_mp * pct / 100.0))


def _learned_raw(holder: Any) -> Any:
    """取「已学技能」原始字段（兼容 `Skills` / `skills` / `LearnedSkills`）。

    `holder` 可以是机甲文档本体，也可以是 actor 视图 `{mp, max_mp, raw: 文档}`。
    **无该字段 → None**（= 一个技能都没学；机甲初始 / 获得时就是这种状态）。
    """
    if not isinstance(holder, dict):
        return None
    holders = [holder]
    raw = holder.get("raw")
    if isinstance(raw, dict):
        holders.append(raw)
    for h in holders:
        for k in (LEARNED_FIELD, "skills", "LearnedSkills"):
            if h.get(k) is not None:
                return h[k]
    return None


def learned_skill_keys(actor: Any) -> Optional[set]:
    """取该单位「已学技能」的 key 集合。

    ⚠ 返回 None 表示**该单位没有「已学技能」字段**（老数据 / 敌方怪物），
      调用方应据此**跳过**已学校验 —— 否则会给全部技能判「尚未学会」，把技能系统整个锁死。
    """
    src = _learned_raw(actor)
    if src is None:
        return None
    if isinstance(src, str):
        src = [src]
    if not isinstance(src, (list, tuple, set)):
        return None
    out = set()
    for item in src:
        key = resolve_skill_ref(item)
        if key:
            out.add(key)
    return out


def learned_skill_list(holder: Any) -> List[str]:
    """取「已学技能」的 **key 列表**（去重、保序）。无字段 → `[]`。

    ⚠ 这是**落库写回用**的形状：学会一个技能后，把它 append 进来再 `$set` 回
      `Skills` 字段 —— 字段不存在时 `$set` 会自动创建，因此天然兼容旧玩家数据。
    """
    src = _learned_raw(holder)
    if src is None:
        return []
    if isinstance(src, str):
        src = [src]
    if not isinstance(src, (list, tuple, set)):
        return []
    out: List[str] = []
    seen = set()
    for item in src:
        key = resolve_skill_ref(item)
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def can_cast_skill(actor: Any, skill: Dict[str, Any]) -> Dict[str, Any]:
    """是否可主动施放（已学 + 能量足够 + 是主动技）。返回 {ok, reason, mp_cost}。"""
    if not skill:
        return {"ok": False, "reason": "技能不存在", "mp_cost": 0}
    cost = mp_cost(actor, skill)
    if skill.get("trigger"):
        return {"ok": False, "reason": "该技能为自动触发技，不能主动施放", "mp_cost": cost}
    if skill.get("reference_only"):
        return {"ok": False, "reason": "该技能仅为参考项，未实装", "mp_cost": cost}

    # 已学校验（服务端权威）：客户端本可直接提交任意 skill_key，这里必须拦。
    # ⚠ 只在**能读到「已学技能」字段**时校验（learned 非 None 且非空）——
    #   老数据 / 敌方怪物没有该字段时一律放行，避免把技能系统整体锁死。
    learned = learned_skill_keys(actor)
    if learned and skill.get("key") not in learned:
        return {"ok": False, "reason": "尚未学会该技能", "mp_cost": cost}

    mp = 0
    if isinstance(actor, dict):
        try:
            mp = int(actor.get("mp") or 0)
        except (TypeError, ValueError):
            mp = 0
    if mp < cost:
        return {"ok": False, "reason": "能量不足", "mp_cost": cost}
    return {"ok": True, "reason": "", "mp_cost": cost}


# ---------------------------------------------------------------------------
# 动作归一化
# ---------------------------------------------------------------------------
def normalize_action(raw: Any) -> Optional[Dict[str, Any]]:
    """把客户端动作归一成统一结构。

    支持写法：
      "ATTACK" / "DEFEND" / "ESCAPE"
      {"type": "SKILL", "skill_key": "roubo"}
      {"action_type": "skill", "skill": "肉搏攻击"}
      {"skill_key": "roubo"}            → SKILL
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        if ":" in text:                      # "SKILL:roubo"
            head, _, tail = text.partition(":")
            act = {"type": head.strip().upper()}
            if tail.strip():
                act["skill_key"] = tail.strip()
            return act
        up = text.upper()
        if up in _ACTION_TYPES:
            return {"type": up}
        # 直接给了技能名/key
        key = resolve_skill_ref(text)
        return {"type": "SKILL", "skill_key": key} if key else {"type": up}

    if isinstance(raw, dict):
        t = raw.get("type") or raw.get("action_type") or raw.get("action") or raw.get("kind")
        skill_ref = raw.get("skill_key") or raw.get("skillKey") or raw.get("skill") or raw.get("skill_id")
        t_norm = str(t).strip().upper() if t else ""
        if not t_norm:
            t_norm = "SKILL" if skill_ref else ""
        if t_norm == "SKILL":
            key = resolve_skill_ref(skill_ref)
            return {"type": "SKILL", "skill_key": key}
        if t_norm in _ACTION_TYPES:
            return {"type": t_norm}
        return None
    return None


def action_type_of(action: Any) -> str:
    """取动作的字符串类型；兼容历史数据里直接存字符串的写法。"""
    if isinstance(action, str):
        return action.strip().upper()
    if isinstance(action, dict):
        return str(action.get("type") or "").strip().upper()
    return ""


# 自动触发技（生命恢复 / 能量恢复）：由**回合末被动结算**驱动，不进主动技能栏
#   —— 放进去玩家点了也放不出（can_cast_skill 会以「自动触发技」拒绝），只会让人困惑。
_AUTO_TRIGGER_CATEGORIES = ("skill_3",)


def list_castable_skills(
    actor: Any,
    learned_only: bool = True,
    class_line: Optional[str] = None,
    include_reference: bool = False,
) -> List[Dict[str, Any]]:
    """列出该单位可主动施放的技能（含等级 / 消耗 / 可用性），供技能面板接入。

    **默认 `learned_only=True` —— 只列「已学」技能。**
    机甲初始 / 获得时 `Skills` 为空（甚至没有该字段），只有用技能书学会才会写入，
    所以新机甲的技能面板**本来就是空的**（这是预期行为，不是 bug）。

    传 `learned_only=False` 则退化为「技能图鉴」模式：按职业线列出全部可施放技能。

    过滤口径（按顺序）
    ------------------
    1. `reference_only`（未实装的参考项）—— 默认剔除；`include_reference=True` 保留，
       但 `usable` 仍为 False，交给 UI 灰显。
    2. `category == skill_3`（生命/能量恢复）—— **恒剔除**（见 `_AUTO_TRIGGER_CATEGORIES`）：
       这两个由回合末被动结算驱动，放进主动技能栏点了也放不出。
    3. `learned_only=True` → **只保留已学**（读不到 `Skills` 字段 = 一个都没学 → 返回 `[]`）；
       `learned_only=False` → 改按**职业线**过滤（`classes == 本机职业线` 或 `all`；
       `class_line` 传 None 时从 `actor` 推断，**推断不出则不过滤**）。
    """
    learned = learned_skill_keys(actor) or set()   # 无字段 → 空集（机甲默认一个技能都没有）

    line = class_line
    if line is None:
        raw = (actor or {}).get("raw") if isinstance(actor, dict) else None
        holder = raw if isinstance(raw, dict) else (actor if isinstance(actor, dict) else {})
        cls_raw = None
        if isinstance(holder, dict):
            for k in ("Class", "class", "ClassLine"):
                if holder.get(k) is not None:
                    cls_raw = holder[k]
                    break
        line = class_line_of(cls_raw) if cls_raw is not None else None

    out = []
    for s in all_skills():
        if s.get("reference_only") and not include_reference:
            continue
        if s.get("category") in _AUTO_TRIGGER_CATEGORIES:
            continue
        key = s.get("key")
        if learned_only:
            # 只列已学：没学过就不显示（机甲默认空列表）
            if key not in learned:
                continue
        elif line:
            # 图鉴模式：按职业线列全量
            cls = str(s.get("classes") or "all")
            if cls != "all" and cls != line:
                continue
        chk = can_cast_skill(actor, s)
        out.append({
            "key": key,
            "name": s.get("name"),
            "anim": s.get("anim"),
            "iconIndex": s.get("iconIndex"),
            "category": s.get("category"),
            "classes": s.get("classes"),
            "type": s.get("type"),
            "scope": s.get("scope"),
            "scope_desc": s.get("scope_desc"),
            "target": s.get("target"),
            "side": s.get("side"),
            "damage_type": s.get("damage_type"),
            "mp_cost_percent": s.get("mp_cost_percent"),
            "mp_cost": chk["mp_cost"],
            "level": skill_level_of(actor, key),
            "max_level": skill_level_max(),
            "lv_manual": bool(s.get("lv_manual")),
            "book_id": s.get("book_id"),
            "usable": chk["ok"],
            "reason": chk["reason"],
            # 已学状态：无 Skills 字段 = 一个都没学（learned=False）
            "learned": key in learned,
            "reference_only": bool(s.get("reference_only")),
            # 出招方式 / 距离口径（口径见 tools/skill_range_todo.md，2026-10-01 定稿）
            "range": skill_range_of(s),
            "range_rule": s.get("range_rule"),
        })

    # 已学的排前面（图鉴模式下有意义；只列已学时是同组稳定排序，无副作用）
    out.sort(key=lambda x: 0 if x.get("learned") else 1)
    return out


def effects_of(skill: Dict[str, Any]) -> List[Dict[str, Any]]:
    return list(skill.get("effects") or [])
