# -*- coding: utf-8 -*-
"""两条收尾口径的回归（2026-09-30 用户拍板）：

1. **死亡后战斗结束 → 机甲保底 1 滴血**
   - `battle_room_handler._survive_hp_after_battle(hp)`：>0 原样；<=0（倒下）→ 1
   - 战斗收尾写回 DB 时走这个函数（PVE 玩家 + PVP 双方）→ 不会留下 0 血死尸

2. **升级必须加满血满蓝**
   - `RobotUpgradeManager.apply_level_up_full_restore(attrs)`：CurrentHP=MaxHP、CurrentMP=MaxMP
   - `add_exp_to_robot` / `add_exp_to_robot_atomic` 在**升级**时调用它（升星/成长/技能之后，用最终 Max）
   - 没升级 → 绝不动 CurrentHP/CurrentMP（残血不能被静默补满）

⚠ 关键点：判断「倒下」绝不能用 `or`（`0 or max_hp` 会变成满血）；升级补满只认 `level_up_count > 0`。
"""
import copy
import os
import sys

import pytest  # noqa: F401
from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# 1. 战斗收尾保底 1 滴血
# ---------------------------------------------------------------------------
def test_survive_hp_boundaries():
    from handlers import battle_room_handler as brh

    f = brh._survive_hp_after_battle
    assert f(0) == 1, "0 血（倒下）必须保底 1"
    assert f(-5) == 1, "负血必须保底 1"
    assert f(1) == 1
    assert f(123) == 123, ">0 原样"
    assert f("77") == 77, "字符串数字要能转"
    assert f(None) == 1, "取不到血量按倒下处理"
    assert f("") == 1
    assert f("abc") == 1
    assert brh.BATTLE_SURVIVE_HP == 1


def test_survive_hp_writeback_uses_helper():
    """战斗结束写回处必须调用保底函数，而不是 max(0, ...) 把 0 写进库。"""
    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "handlers",
        "battle_room_handler.py",
    )
    with open(path, encoding="utf-8") as f:
        src = f.read()
    # 两处写回（PVP 双方 + PVE 玩家）都要走保底函数
    assert src.count("_survive_hp_after_battle(") >= 3, (
        "应有 1 处定义 + 2 处调用（PVP / PVE）"
    )
    assert 'max(0, int(actor.get("hp", 0)))' not in src
    assert 'max(0, int(player.get("hp", 0)))' not in src


# ---------------------------------------------------------------------------
# 2. 升级加满血满蓝
# ---------------------------------------------------------------------------
def test_full_restore_basic():
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    out = mgr.apply_level_up_full_restore({"MaxHP": 5000, "MaxMP": 900, "CurrentHP": 3, "CurrentMP": 0})
    assert out["CurrentHP"] == 5000
    assert out["CurrentMP"] == 900
    # 不原地污染传入 dict（避免调用方共享引用）
    assert out is not None and out.get("MaxHP") == 5000


def test_full_restore_fallback_and_missing():
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    # HP 用兜底字段
    out = mgr.apply_level_up_full_restore({"HP": 800, "MP": 120})
    assert out["CurrentHP"] == 800
    assert out["CurrentMP"] == 120
    # 完全没有 Max 字段 → 不动（绝不凭空写满）
    out2 = mgr.apply_level_up_full_restore({"Melee": 10})
    assert "CurrentHP" not in out2 and "CurrentMP" not in out2


def test_full_restore_tolerates_garbage():
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    out = mgr.apply_level_up_full_restore({"MaxHP": "abc", "MaxMP": None})
    assert "CurrentHP" not in out  # 非法值不写
    assert "CurrentMP" not in out
    out2 = mgr.apply_level_up_full_restore(None)
    assert out2 == {}


# ---------------------------------------------------------------------------
# 3. 端到端：原子升级后库里就是满血满蓝
# ---------------------------------------------------------------------------
class _MiniCol:
    """只实现 add_exp_to_robot_atomic 用到的 find_one_and_update（$inc / $set）。"""

    def __init__(self, docs):
        self.docs = [copy.deepcopy(d) for d in docs]

    @staticmethod
    def _match(doc, filt):
        for k, v in filt.items():
            if k == "Level" and isinstance(v, dict) and "$lt" in v:
                if not isinstance(doc.get("Level"), int) or not doc["Level"] < v["$lt"]:
                    return False
                continue
            if doc.get(k) != v:
                return False
        return True

    def find_one_and_update(self, filt, update, return_document=None):
        for i, d in enumerate(self.docs):
            if self._match(d, filt):
                new = copy.deepcopy(d)
                for k, v in (update.get("$inc") or {}).items():
                    new[k] = (new.get(k) or 0) + v
                for k, v in (update.get("$set") or {}).items():
                    new[k] = v
                self.docs[i] = new
                return copy.deepcopy(new)
        return None


def test_atomic_level_up_restores_full_hp_mp():
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    pid = ObjectId("65f0000000000000000000bb")
    uid = "uid-restore"

    # 1 级、残血 1、空蓝 0，经验差一点点就升 2 级
    need = mgr.get_total_exp_for_level(2)
    pet = {
        "_id": pid,
        "user_id": uid,
        "RobotName": "残血机",
        "RobotID": 1,
        "Level": 1,
        "EXP": need - 30,
        "Class": 1,
        "StarLevel": 1,
        "Growth": 0,          # 不升星，避免随机干扰
        "Comprehension": 0,   # 技能不自动升（且本来也没学技能）
        "MaxHP": 1000,
        "CurrentHP": 1,
        "MaxMP": 300,
        "CurrentMP": 0,
    }
    col = _MiniCol([pet])

    new_level, new_exp, level_up_count, attrs = mgr.add_exp_to_robot_atomic(
        col, pid, uid, 100
    )
    assert level_up_count > 0, f"应升级，实际 {level_up_count}（exp {new_exp}）"
    assert attrs.get("CurrentHP") == attrs.get("MaxHP"), f"升级后应满血: {attrs}"
    assert attrs.get("CurrentMP") == attrs.get("MaxMP"), f"升级后应满蓝: {attrs}"

    saved = col.docs[0]
    assert saved["CurrentHP"] == saved["MaxHP"], f"库里应满血: {saved.get('CurrentHP')}/{saved.get('MaxHP')}"
    assert saved["CurrentMP"] == saved["MaxMP"], f"库里应满蓝: {saved.get('CurrentMP')}/{saved.get('MaxMP')}"
    assert saved["Level"] == new_level


def test_atomic_no_level_up_keeps_current_hp():
    """没升级 → 残血原样保留（升级补满不能误伤非升级的经验获取）。"""
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    pid = ObjectId("65f0000000000000000000cc")
    uid = "uid-nolevel"

    # 30 级，经验离下一级很远，只加 1 点
    need30 = mgr.get_total_exp_for_level(30)
    need31 = mgr.get_total_exp_for_level(31)
    pet = {
        "_id": pid,
        "user_id": uid,
        "RobotName": "残血不升",
        "RobotID": 1,
        "Level": 30,
        "EXP": need30,
        "Class": 1,
        "StarLevel": 1,
        "Growth": 0,
        "Comprehension": 0,
        "MaxHP": 2000,
        "CurrentHP": 7,
        "MaxMP": 500,
        "CurrentMP": 3,
    }
    col = _MiniCol([pet])

    new_level, _new_exp, level_up_count, attrs = mgr.add_exp_to_robot_atomic(col, pid, uid, 1)
    assert level_up_count == 0
    assert attrs == {}, f"未升级不该写任何属性: {attrs}"
    saved = col.docs[0]
    assert saved["CurrentHP"] == 7 and saved["CurrentMP"] == 3, "未升级不能被补满"
    assert saved["Level"] == 30
    assert need31 > need30  # 表本身自检


def test_non_atomic_level_up_restores_full_hp_mp():
    """非原子版（内部逻辑路径）同样要满血满蓝。"""
    from handlers.robot_upgrade import RobotUpgradeManager

    mgr = RobotUpgradeManager()
    need = mgr.get_total_exp_for_level(2)
    pet = {
        "RobotName": "残血机2",
        "RobotID": 1,
        "Level": 1,
        "EXP": need - 10,
        "Class": 1,
        "StarLevel": 1,
        "Growth": 0,
        "Comprehension": 0,
        "MaxHP": 900,
        "CurrentHP": 2,
        "MaxMP": 200,
        "CurrentMP": 0,
    }
    new_level, _exp, level_up_count, attrs = mgr.add_exp_to_robot(pet, 50)
    assert level_up_count > 0
    assert attrs.get("CurrentHP") == attrs.get("MaxHP")
    assert attrs.get("CurrentMP") == attrs.get("MaxMP")


def test_all_level_up_paths_call_full_restore():
    """所有走「等级提升」的落库路径都必须调用补满函数（防回归、防漏改）。"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    up = open(os.path.join(root, "handlers", "robot_upgrade.py"), encoding="utf-8").read()
    # 1 处定义 + add_exp_to_robot / add_exp_to_robot_atomic 各 1 处调用
    assert up.count("apply_level_up_full_restore(") >= 3, up.count("apply_level_up_full_restore(")

    rh = open(os.path.join(root, "handlers", "robot_handler.py"), encoding="utf-8").read()
    assert "apply_level_up_full_restore(" in rh, "批量升级/等级修正路径漏了补满"

    ie = open(os.path.join(root, "handlers", "item_effect.py"), encoding="utf-8").read()
    assert "add_exp_to_robot_atomic(" in ie, "经验道具走原子升级 → 已自动补满"

