# -*- coding: utf-8 -*-
"""技能书（消耗品）使用逻辑 —— 服务端权威

来源（RPG Maker 原工程，代码实证）
---------------------------------
- `js/plugins/Z_skill.js`
    技能书按**职业线**分组：格斗 36–40、射击 41–45、全能 46–51（+ **55 三组通用**）；
    职业不匹配 → 弹「职业不匹配，无法使用该技能书！」；
    匹配 → 弹「技能学习成功！」（⚠ **只弹提示、没写 `learnSkill` = 伪实现**）。
- `js/plugins/Z_SkillLevel.js` `Scene_Skill.onSkillUpgrade`
    技能等级升级顺序：满级(Lv4) 否决 → 不在 `SKILL_BOOK_MAP` 否决
    → 机甲等级 25/40/50 → 技能书 1/2/3 本 → `loseItem(book, needBooks)` → `setSkillLevel(+1)`；
    且它只从 `actor.skills()` 里选技能 → **升级隐含「已学」**。

本工程口径（一次「使用技能书」= 下列之一，按顺序判定）
------------------------------------------------------
  1. 职业不匹配                                        → 否决（不扣书）
  2. 技能仅为参考项（`reference_only`，如纳米侵蚀）     → 否决（不扣书）
  3. **已学该技能** → 否决：「已经学会，不能再学习了」   ← 2026-09-30 用户拍板
     （技能书**只用来「学会」**；升级走技能面板 UI 的 `skill_level_up`）
  4. **未学该技能** → 学会（Lv1，消耗 `LEARN_BOOK_COST` 本）
     ← 补全 `Z_skill.js` 的伪实现（原工程只弹「技能学习成功！」）。
       可用 `LEARN_WHEN_UNLEARNED = False` 关掉，关掉后未学直接否决。

⚠ 与原工程的差异：`Z_SkillLevel.onSkillUpgrade` 里「已学 → 花书升级」在本工程**不走技能书**，
  改由技能面板的 `skill_level_up`（GUI 升级，用户后续做 UI）承担 ——
  免得同一本技能书被两种语义抢用。

落库形状
--------
- 学会时**同时写** `Skills`（已学 key 数组）与 `SkillLevels`（等级表）；
- `Skills` **字段不存在时 `$set` 会自动创建** → 天然兼容旧玩家数据（用户明确要求）。

本模块是**纯决策 + 纯数据变换**（不碰数据库）：只读传入的机甲文档快照，
返回 `{ok, action, reason, skill_key, name, from_level, to_level, need_books, book_id,
       skills, levels}`。
**扣书与落库由调用方负责**（`handlers/bag_handler.py` / `handlers/skill_handler.py`）。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from services import skill_service as skills_svc
from services import skill_level_service as skill_level_svc

__all__ = [
    "LEARN_WHEN_UNLEARNED",
    "LEARN_BOOK_COST",
    "book_map",
    "skill_of_book",
    "is_skill_book",
    "plan_use_book",
    "apply_learn",
    "use_book",
]

# 未学该技能时，用技能书**学会**它（补全 Z_skill.js 的伪实现）
LEARN_WHEN_UNLEARNED = True
# 「学会」需要几本技能书（原工程是一次使用消耗 1 个道具）
LEARN_BOOK_COST = 1


# ---------------------------------------------------------------------------
# 技能书识别
# ---------------------------------------------------------------------------
def book_map() -> Dict[int, str]:
    """`物品 id → 技能 key`（由 Skills.json 各技能的 `book_id` 反推）。"""
    out: Dict[int, str] = {}
    for s in skills_svc.all_skills():
        b = s.get("book_id")
        if b is None:
            continue
        try:
            out[int(b)] = s.get("key")
        except (TypeError, ValueError):
            continue
    return out


def skill_of_book(item_id: Any) -> Optional[str]:
    """该物品 id 若是技能书，返回对应技能 key；否则 None。"""
    try:
        n = int(item_id)
    except (TypeError, ValueError):
        return None
    return book_map().get(n)


def is_skill_book(item_id: Any) -> bool:
    return skill_of_book(item_id) is not None


# ---------------------------------------------------------------------------
# 决策
# ---------------------------------------------------------------------------
def plan_use_book(pet: Any, item_id: Any, book_count: Any) -> Dict[str, Any]:
    """判定「使用一本技能书」的结果（不改任何数据）。

    返回 `{ok, action('learn'|'upgrade'|None), reason, skill_key, from_level, to_level,
           need_books, book_id}`；`ok=False` 时 `reason` 可直接展示给玩家。
    """
    out: Dict[str, Any] = {
        "ok": False, "action": None, "reason": "",
        "skill_key": None, "name": None,
        "from_level": 1, "to_level": 1,
        "need_books": 0, "book_id": None,
    }
    key = skill_of_book(item_id)
    if not key:
        out["reason"] = "该物品不是技能书"
        return out
    skill = skills_svc.get_skill(key) or {}
    out["skill_key"] = key
    out["name"] = skill.get("name")
    try:
        out["book_id"] = int(item_id)
    except (TypeError, ValueError):
        out["book_id"] = None

    cur = skill_level_svc.level_of(pet, key)
    out["from_level"] = cur

    try:
        books = int(book_count or 0)
    except (TypeError, ValueError):
        books = 0

    # ① 职业匹配（Z_skill.js，最先拦）
    if not skill_level_svc.class_matches(pet, skill):
        out["reason"] = "职业不匹配，无法使用该技能书"
        return out

    # ② 参考项（未实装）不可学不可升
    if skill.get("reference_only"):
        out["reason"] = "该技能仅为参考项，未实装"
        return out

    # ③ 已学 → 拒绝（技能书只能用来「学会」；升级走技能面板 UI）
    if skill_level_svc.is_learned(pet, key):
        out["reason"] = "该机甲已经学会「%s」，不能再学习了" % (skill.get("name") or "")
        return out

    # ④ 未学 → 学会（补全 Z_skill.js 的「技能学习成功！」）
    if not LEARN_WHEN_UNLEARNED:
        out["reason"] = "尚未学会该技能"
        return out
    if books < LEARN_BOOK_COST:
        out["reason"] = "技能书数量不足，需要%d个" % LEARN_BOOK_COST
        return out
    out["ok"] = True
    out["action"] = "learn"
    out["to_level"] = 1
    out["need_books"] = LEARN_BOOK_COST
    return out


# ---------------------------------------------------------------------------
# 应用（生成新的等级表，不落库）
# ---------------------------------------------------------------------------
def apply_learn(pet: Any, skill_key: Any) -> Tuple[List[str], Dict[str, int], int]:
    """把该技能记为「已学会」（Lv1）。

    返回 `(新的已学技能数组, 新的完整等级表, 等级)` —— **不落库、不扣书**。

    - `Skills` 数组用于 `$set` 回机甲文档（**字段不存在时会自动创建** → 兼容旧玩家数据）；
    - 已在该数组里则不重复 append（幂等）。
    """
    key = skills_svc.resolve_skill_ref(skill_key)
    learned = skills_svc.learned_skill_list(pet)
    levels = skill_level_svc.levels_of(pet)
    if not key:
        return learned, levels, 1
    if key not in learned:
        learned.append(key)
    lv = max(1, min(int(levels.get(key, 1) or 1), skill_level_svc.level_max()))
    levels[key] = lv
    return learned, levels, lv


def use_book(pet: Any, item_id: Any, book_count: Any) -> Dict[str, Any]:
    """判定 + 生成新的「已学技能数组 / 等级表」（一步到位，仍不落库）。

    返回 `plan_use_book` 的结果，并附：
      - `skills`：学会后的**完整已学数组**（落库用 → `Skills` 字段）
      - `levels`：学会后的**完整等级表**（落库用 → `SkillLevels` 字段）
      - `to_level` / `name`：给客户端提示
    `ok=False` 时**不含** `skills` / `levels`（调用方不要动数据）。
    """
    plan = plan_use_book(pet, item_id, book_count)
    if not plan["ok"]:
        return plan
    skills, levels, new_level = apply_learn(pet, plan["skill_key"])
    plan["skills"] = skills
    plan["levels"] = levels
    plan["to_level"] = new_level
    return plan
