# -*- coding: utf-8 -*-
"""技能等级：存储结构 + 自动 / 手动升级（服务端权威）

数据落地
--------
每台机甲（角色）对**每个技能独立**记录等级，存在机甲宠物文档的
`SkillLevels` 字段：`{"roubo": 3, "xiuli": 1, ...}`（缺省 = Lv1）。

升级规则（来源 RPG Maker MV 插件 `Z_SkillLevel.js`，与 `Skills.json` 的
`skill_level` 段落完全同源）
------------------------------------------------------------------------
- 等级上限 Lv4；倍率 `[1.0, 1.2, 1.3, 1.5]`，作用于**伤害结果**（floor）。
- **自动升级**：机甲每升 1 级，对每个「已学 + 支持自动升级（`lv_auto`）」的技能
  判定一次，概率 = `悟性 / 100 × 0.1`（悟性 40~100 → 4%~10%），成功则 +1 级。
- **手动升级**：花技能书 + 达到机甲等级（Lv2 需 1 本/25 级、Lv3 需 2 本/40 级、
  Lv4 需 3 本/50 级）；仅 `lv_manual` 为真的技能可手动升。

本模块是**纯逻辑**（只读 Skills.json + 传入的文档快照，不碰数据库），
落库由调用方（`handlers/robot_upgrade.py` 升级链路 / `handle_skill_level_up`）负责。

⚠ 2026-10-02：技能升级 UI 尚未上线 —— `ENABLE_SKILL_LEVEL_PROGRESSION=False`，
  自动升级与手动升级一律关闭；读等级恒为 Lv1（忽略文档里残留的 SkillLevels）。
  做完升级面板后把开关改回 True，并视需要恢复 / 清理 DB 字段。
"""
from __future__ import annotations

import os
import random
from typing import Any, Dict, List, Optional, Tuple

from services import skill_service as skills_svc

__all__ = [
    "LEVELS_FIELD",
    "DEFAULT_COMPREHENSION",
    "MANUAL_UPGRADE_REQ",
    "ENABLE_SKILL_LEVEL_PROGRESSION",
    "level_max",
    "level_multipliers",
    "auto_upgrade_chance",
    "normalize_levels",
    "levels_of",
    "level_of",
    "class_matches",
    "is_learned",
    "manual_req",
    "can_manual_upgrade",
    "apply_manual_upgrade",
    "roll_auto_upgrade",
]

# 机甲宠物文档里存技能等级的字段名（服务端 / 客户端同口径）
LEVELS_FIELD = "SkillLevels"

# 悟性缺省值（与 admin_handler / battle_handler 的 `Comprehension': 50` 一致）
DEFAULT_COMPREHENSION = 50

# 技能升级总开关：升级 UI 未做完前关闭（自动 + 手动都拒）
# 可用环境变量 SKILL_LEVEL_PROGRESSION=1 临时打开联调
_ENV_FLAG = (os.environ.get("SKILL_LEVEL_PROGRESSION") or "").strip().lower()
ENABLE_SKILL_LEVEL_PROGRESSION = _ENV_FLAG in ("1", "true", "on", "yes")

# 手动升级条件：目标等级 → 需要技能书数 / 需要机甲等级
MANUAL_UPGRADE_REQ: Dict[int, Dict[str, int]] = {
    2: {"books": 1, "mech_level": 25},
    3: {"books": 2, "mech_level": 40},
    4: {"books": 3, "mech_level": 50},
}


# ---------------------------------------------------------------------------
# 目录读取
# ---------------------------------------------------------------------------
def level_max() -> int:
    """技能等级上限（默认 4）。"""
    return skills_svc.skill_level_max()


def level_multipliers() -> List[float]:
    m = (skills_svc.load_catalog().get("skill_level") or {}).get("multipliers")
    if not m:
        m = [1.0, 1.2, 1.3, 1.5]
    return [float(x) for x in m]


def auto_upgrade_chance(comprehension: Any) -> float:
    """自动升级概率 = 悟性 / 100 × 0.1。"""
    try:
        c = float(comprehension)
    except (TypeError, ValueError):
        c = float(DEFAULT_COMPREHENSION)
    if c <= 0:
        return 0.0
    return (c / 100.0) * 0.1


# ---------------------------------------------------------------------------
# 等级表读写
# ---------------------------------------------------------------------------
def normalize_levels(raw: Any) -> Dict[str, int]:
    """归一化等级表：值夹到 [1, level_max]，重复项取大。

    ⚠ 认不出的 key **保留原样**（不丢弃）—— 版本升级时技能表可能增删，
      静默丢字段会让玩家的等级凭空消失。
    """
    out: Dict[str, int] = {}
    if not isinstance(raw, dict):
        return out
    top = level_max()
    for k, v in raw.items():
        key = skills_svc.resolve_skill_ref(k) or str(k).strip()
        if not key:
            continue
        try:
            lv = int(v)
        except (TypeError, ValueError):
            continue
        if lv <= 0:
            continue
        lv = min(lv, top)
        out[key] = max(out.get(key, 1), lv)
    return out


def levels_of(pet: Any) -> Dict[str, int]:
    """取机甲文档里的技能等级表（兼容 SkillLevels / skill_levels / SkillLevelMap）。

    升级功能未开放时返回空表（调用方按缺省 Lv1 展示 / 结算）。
    """
    if not ENABLE_SKILL_LEVEL_PROGRESSION:
        return {}
    if not isinstance(pet, dict):
        return {}
    for k in (LEVELS_FIELD, "skill_levels", "SkillLevelMap"):
        raw = pet.get(k)
        if isinstance(raw, dict):
            return normalize_levels(raw)
    return {}


def level_of(pet: Any, skill_key: Any) -> int:
    """该机甲对该技能的等级；未记录按 Lv1。升级功能未开放时恒为 1。"""
    if not ENABLE_SKILL_LEVEL_PROGRESSION:
        return 1
    key = skills_svc.resolve_skill_ref(skill_key)
    if not key:
        return 1
    return max(1, min(levels_of(pet).get(key, 1), level_max()))


# ---------------------------------------------------------------------------
# 职业线匹配 / 已学判定（来源 Z_skill.js 与 Z_SkillLevel.onSkillUpgrade）
# ---------------------------------------------------------------------------
def class_matches(pet: Any, skill: Any) -> bool:
    """技能（及其技能书）的职业线是否与该机甲匹配。

    来源：`js/plugins/Z_skill.js`
      FIGHTER_BOOKS  = 36–40 (+55)   → 只能给格斗机甲
      SHOOTER_BOOKS  = 41–45 (+55)   → 只能给射击机甲
      UNIVERSAL_BOOKS= 46–51 (+55)   → 只能给全能机甲
      （55 三组都有 → 三线通用）
    不匹配时原工程弹「职业不匹配，无法使用该技能书！」。

    `classes` 为 `all` / `通用` / 空 → 视为三线通用（本工程 `Skills.json` 口径）。
    """
    if not skill:
        return False
    c = str(skill.get("classes") or "").strip().lower()
    if not c or c in ("all", "通用"):
        return True
    return c == skills_svc.class_line_of(pet)


def is_learned(pet: Any, skill_key: Any) -> bool:
    """该机甲是否已学该技能。

    ⚠ 本工程口径（2026-09-30 用户拍板）：**没有 `Skills` 字段 = 一个技能都没学** ——
      机甲初始 / 获得时技能为空，只有用技能书学会才会写入该字段。
      所以这里**不再返回「无法判定(None)」**：未学就是 False，用技能书即可学会。

    （注：`skill_service.can_cast_skill` 的**战斗施放校验**仍是「读不到字段就放行」，
      那是为了不把敌方怪物 / 老数据锁死，与「技能面板列已学」是两回事。）

    来源：`Z_SkillLevel.onSkillUpgrade` 从 `actor.skills()` 里选技能来升级，
      因此「升级」隐含「已学」这一前提。
    """
    key = skills_svc.resolve_skill_ref(skill_key)
    if not key:
        return False
    learned = skills_svc.learned_skill_keys(pet) or set()
    return key in learned


# ---------------------------------------------------------------------------
# 手动升级
# ---------------------------------------------------------------------------
def manual_req(to_level: int) -> Optional[Dict[str, int]]:
    return MANUAL_UPGRADE_REQ.get(int(to_level))


def can_manual_upgrade(pet: Any, skill_key: Any, book_count: int) -> Dict[str, Any]:
    """手动升级条件校验（职业匹配 + 已学 + 花技能书 + 达到机甲等级）。

    判定顺序对齐原工程：
      `Z_skill.js`（职业匹配，最先拦）→ `Z_SkillLevel.onSkillUpgrade`
      （满级 → 不支持升级 → 机甲等级 → 技能书数量）。

    返回 `{ok, reason, key, from_level, to_level, need_books, need_mech_level, book_id}`
    —— `reason` 直接可展示给玩家。
    """
    key = skills_svc.resolve_skill_ref(skill_key)
    base = {
        "ok": False, "reason": "", "key": key,
        "from_level": 1, "to_level": 1,
        "need_books": 0, "need_mech_level": 0, "book_id": None,
    }
    if not ENABLE_SKILL_LEVEL_PROGRESSION:
        base["reason"] = "技能升级功能暂未开放"
        return base
    if not key:
        base["reason"] = "技能不存在"
        return base
    skill = skills_svc.get_skill(key)
    if not skill:
        base["reason"] = "技能不存在"
        return base

    base["book_id"] = skill.get("book_id")
    cur = level_of(pet, key)
    base["from_level"] = cur

    # ① 职业匹配（Z_skill.js）
    if not class_matches(pet, skill):
        base["reason"] = "职业不匹配，无法使用该技能书"
        return base
    # ② 满级
    if cur >= level_max():
        base["reason"] = "已达到最高等级"
        return base
    # ③ 是否支持手动升级（无对应技能书 / 未开放）
    if not skill.get("lv_manual"):
        base["reason"] = "该技能不支持升级"
        return base
    req = manual_req(cur + 1)
    if not req:
        base["reason"] = "该技能不支持升级"
        return base

    base["to_level"] = cur + 1
    base["need_books"] = req["books"]
    base["need_mech_level"] = req["mech_level"]

    # ④ 已学（RPG 从 actor.skills() 选技能升级 → 隐含已学；未学一律拒绝）
    if not is_learned(pet, key):
        base["reason"] = "尚未学会该技能"
        return base

    try:
        mech_level = int((pet or {}).get("Level") or 1)
    except (TypeError, ValueError):
        mech_level = 1
    if mech_level < req["mech_level"]:
        base["reason"] = "角色等级不足，需要等级%d" % req["mech_level"]
        return base

    try:
        books = int(book_count or 0)
    except (TypeError, ValueError):
        books = 0
    if books < req["books"]:
        base["reason"] = "技能书数量不足，需要%d个" % req["books"]
        return base

    base["ok"] = True
    return base


def apply_manual_upgrade(pet: Any, skill_key: Any) -> Tuple[Dict[str, int], int]:
    """把该技能等级 +1，返回 (新的完整等级表, 新等级)。**不落库、不扣书**。"""
    if not ENABLE_SKILL_LEVEL_PROGRESSION:
        return levels_of(pet), 1
    key = skills_svc.resolve_skill_ref(skill_key)
    levels = levels_of(pet)
    if not key:
        return levels, 1
    cur = max(1, min(levels.get(key, 1), level_max()))
    new_level = min(cur + 1, level_max())
    levels[key] = new_level
    return levels, new_level


# ---------------------------------------------------------------------------
# 自动升级
# ---------------------------------------------------------------------------
def roll_auto_upgrade(
    pet: Any,
    level_up_count: int = 1,
    rng: Optional[random.Random] = None,
) -> Tuple[Dict[str, int], List[Dict[str, Any]]]:
    """机甲升级时逐个「已学 + lv_auto」技能判定，返回 (等级表, 升级记录)。

    每升 1 级判定一次（跨越 N 级就判 N 次），概率 = 悟性/100×0.1，封顶 Lv4。

    返回:
        levels —— 归一化后的完整等级表（含本次变更）
        ups    —— 只含**本次真的升级**的记录 `{key, name, from_level, to_level}`
    """
    rnd = rng or random
    levels = levels_of(pet) if ENABLE_SKILL_LEVEL_PROGRESSION else normalize_levels(
        (pet or {}).get(LEVELS_FIELD) if isinstance(pet, dict) else None
    )
    ups: List[Dict[str, Any]] = []

    # 升级 UI / 玩法未开放：机甲升级不再带动技能自动涨级
    if not ENABLE_SKILL_LEVEL_PROGRESSION:
        return levels, ups

    tries = int(level_up_count or 0)
    if tries <= 0:
        return levels, ups

    learned = skills_svc.learned_skill_keys(pet)
    if not learned:
        # 没有「已学技能」字段（敌方怪物 / 老数据）→ 不升级、不报错
        return levels, ups

    try:
        comprehension = int((pet or {}).get("Comprehension", DEFAULT_COMPREHENSION))
    except (TypeError, ValueError):
        comprehension = DEFAULT_COMPREHENSION
    chance = auto_upgrade_chance(comprehension)
    if chance <= 0:
        return levels, ups

    top = level_max()
    for key in sorted(learned):
        skill = skills_svc.get_skill(key)
        if not skill or not skill.get("lv_auto"):
            continue
        cur = max(1, min(levels.get(key, 1), top))
        for _ in range(tries):
            if cur >= top:
                break
            if rnd.random() >= chance:
                continue
            cur += 1
            ups.append({
                "key": key,
                "name": skill.get("name"),
                "from_level": cur - 1,
                "to_level": cur,
            })
        levels[key] = cur

    return levels, ups
