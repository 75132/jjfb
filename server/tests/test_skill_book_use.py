# -*- coding: utf-8 -*-
"""技能书使用落库集成测试（FakeMongo）。

验证的是**非纯逻辑**的部分，也就是最容易出错的地方：
  1. 成功：**先写 `Skills`+`SkillLevels` → 再扣技能书**（两边都真的落了）
  2. **旧玩家数据没有 `Skills` 字段 → 学会时 `$set` 自动创建**（用户明确要的兼容性）
  3. 扣书失败 → **技能状态必须回滚**；本次新建的 `Skills` 字段要 `$unset` 掉
     （绝不出现「扣了书没学会」，也绝不出现「没扣书却学会」）
  4. **已学该技能 → 拒绝「不能再学习了」**（技能书只用来学会；升级走 GUI）
  5. 判定失败（职业不匹配 / 非技能书 / 书不足 / 参考项 / 机甲不属于该用户）→ 两边都不动

口径出处见 server/services/skill_book_service.py。
"""
import asyncio
import os
import sys

import pytest                                   # noqa: F401
from bson import ObjectId
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from handlers import skill_handler, utils          # noqa: E402
from services import skill_service                 # noqa: E402
from tests.fake_mongo import FakeMongoCollection   # noqa: E402

PET_ID = "65f0000000000000000000aa"
UID = "uid-skillbook"
CID = "cid-skillbook"


async def _direct(op, **kwargs):
    """把 async_mongo_operation 变成「直接调用」——绕开 ws_server/db_executor。"""
    return op()


def _pet(**over):
    """格斗机甲，已学 roubo（书 36）。"""
    d = {
        "_id": ObjectId(PET_ID),
        "user_id": UID,
        "RobotName": "测试机",
        "Level": 50,
        "Class": 1,
        "Comprehension": 50,
        "Skills": ["roubo"],
        "SkillLevels": {},
    }
    d.update(over)
    return d


def _legacy_pet(**over):
    """旧玩家数据：**没有 Skills / SkillLevels 字段**。"""
    d = {
        "_id": ObjectId(PET_ID),
        "user_id": UID,
        "RobotName": "老机甲",
        "Level": 9,
        "Class": 1,
        "Comprehension": 50,
    }
    d.update(over)
    return d


def _inv(*books):
    """背包文档：books 传 (item_id, quantity)。"""
    items = [{"item_id": i, "quantity": q, "category": 1} for i, q in books]
    return {"user_id": UID, "character_id": CID, "items": items, "Weapon": [], "Armor": []}


class TestApplySkillBook:
    def setup_method(self):
        self.pets = FakeMongoCollection("robotpet")
        self.inv = FakeMongoCollection("inventory")
        self._patchers = [
            patch.object(utils, "robotpet_col", self.pets),
            patch.object(utils, "inventory_col", self.inv),
            patch.object(utils, "async_mongo_operation", side_effect=_direct),
            patch.object(utils, "async_mongo_operation_read", side_effect=_direct),
            patch.object(utils, "invalidate_robot_pets_cache", lambda *a, **k: None),
        ]
        for p in self._patchers:
            p.start()

    def teardown_method(self):
        for p in self._patchers:
            p.stop()

    # ---------- 工具 ----------
    def doc(self):
        return self.pets.find_one({"_id": ObjectId(PET_ID)}) or {}

    def levels(self):
        return self.doc().get("SkillLevels")

    def skills(self):
        return self.doc().get("Skills")

    def book_qty(self, item_id):
        d = self.inv.find_one({"user_id": UID, "character_id": CID}) or {}
        return sum(int(it.get("quantity", 0) or 0)
                   for it in d.get("items", [])
                   if int(it.get("item_id", 0) or 0) == int(item_id))

    def use(self, item_id):
        return asyncio.run(
            skill_handler.apply_skill_book(UID, CID, PET_ID, item_id))

    # ---------- 学会（唯一成功路径） ----------
    def test_learn_writes_skills_and_levels_and_consumes_book(self):
        self.pets.insert_one(_pet(Skills=["roubo"]))
        self.inv.insert_one(_inv((37, 1)))          # 书37=光刃斩，未学
        res = self.use(37)
        assert res["ok"] is True and res["action"] == "learn", res
        assert res["to_level"] == 1
        assert res["books_consumed"] == 1
        assert self.skills() == ["roubo", "guangrenzhan"]   # ★已学数组真的落库
        assert self.levels()["guangrenzhan"] == 1           # ★等级也落库
        assert self.book_qty(37) == 0                       # 书真的扣了

    def test_learn_appends_keeps_existing_order(self):
        self.pets.insert_one(_pet(Skills=["roubo", "xiuli"]))
        self.inv.insert_one(_inv((37, 1)))
        self.use(37)
        assert self.skills() == ["roubo", "xiuli", "guangrenzhan"], self.skills()

    def test_learn_on_legacy_pet_creates_skills_field(self):
        """★旧玩家数据没有字段 → 学会时 `$set` 自动创建（用户明确要的兼容性）。"""
        legacy = _legacy_pet()
        assert "Skills" not in legacy and "SkillLevels" not in legacy
        self.pets.insert_one(legacy)
        self.inv.insert_one(_inv((36, 2)))
        res = self.use(36)
        assert res["ok"] and res["action"] == "learn", res
        assert self.skills() == ["roubo"], self.skills()          # 字段被创建
        assert self.levels() == {"roubo": 1}
        assert self.book_qty(36) == 1

    def test_learn_response_carries_skills_and_pet_name(self):
        self.pets.insert_one(_pet(Skills=[]))
        self.inv.insert_one(_inv((37, 1)))
        res = self.use(37)
        assert res["skills"] == ["guangrenzhan"], res.get("skills")
        assert res["pet_name"] == "测试机"
        assert res["name"] == "光刃斩"

    # ---------- 已学 → 拒绝 ----------
    def test_already_learned_rejected(self):
        self.pets.insert_one(_pet(Skills=["roubo"]))
        self.inv.insert_one(_inv((36, 5)))
        res = self.use(36)
        assert res["ok"] is False and "不能再学习了" in res["reason"], res
        assert self.book_qty(36) == 5
        assert self.skills() == ["roubo"]      # 一点没动
        assert self.levels() == {}

    def test_already_learned_via_book_id_alias(self):
        """已学状态由 key 判定，与传入的是书 id 还是技能名无关。"""
        self.pets.insert_one(_pet(Skills=["roubo"], SkillLevels={"roubo": 3}))
        self.inv.insert_one(_inv((36, 9)))
        res = self.use(36)
        assert res["ok"] is False and "不能再学习了" in res["reason"], res

    # ---------- 扣书失败 → 回滚 ----------
    def test_rollback_levels_when_consume_fails(self):
        """判定通过但扣书失败 → 技能状态必须回滚（「绝不吞玩家道具」的另一半）。"""
        self.pets.insert_one(_pet(Skills=["roubo"]))
        self.inv.insert_one(_inv((37, 1)))
        with patch.object(skill_handler, "consume_item_from_bag",
                          new=AsyncMock(return_value={"success": False, "error": "数量不足"})):
            res = self.use(37)
        assert res["ok"] is False and "数量不足" in res["reason"], res
        assert self.skills() == ["roubo"]      # 没白送技能
        assert self.levels() == {}
        assert self.book_qty(37) == 1          # 书也没少

    def test_rollback_unsets_newly_created_skills_field(self):
        """★旧数据扣书失败 → 本次新建的 `Skills` 字段要 `$unset` 掉，回到「没学过」原状。"""
        self.pets.insert_one(_legacy_pet())
        self.inv.insert_one(_inv((36, 1)))
        with patch.object(skill_handler, "consume_item_from_bag",
                          new=AsyncMock(return_value={"success": False, "error": "数量不足"})):
            res = self.use(36)
        assert res["ok"] is False, res
        assert "Skills" not in self.doc(), self.skills()
        assert self.levels() == {}
        assert self.book_qty(36) == 1

    # ---------- 各类否决：两边都不动 ----------
    def test_class_mismatch_no_write(self):
        self.pets.insert_one(_pet(Class=1, Skills=[]))     # 格斗机甲
        self.inv.insert_one(_inv((41, 5)))                 # 书41=雷霆冲击（射击）
        res = self.use(41)
        assert res["ok"] is False and "职业不匹配" in res["reason"], res
        assert self.book_qty(41) == 5
        assert self.skills() == []

    def test_not_a_skill_book_no_write(self):
        self.pets.insert_one(_pet())
        self.inv.insert_one(_inv((1, 3)))                  # 初级修理包
        res = self.use(1)
        assert res["ok"] is False and "不是技能书" in res["reason"], res
        assert self.book_qty(1) == 3

    def test_book_short_no_write(self):
        self.pets.insert_one(_pet(Skills=[]))
        self.inv.insert_one(_inv((37, 0)))                 # 未学但一本都没有
        res = self.use(37)
        assert res["ok"] is False and "数量不足" in res["reason"], res
        assert self.skills() == []

    def test_reference_only_no_write(self):
        """`reference_only` 分支仍保留 —— 当前已无此类技能，用**假技能**验证不落库、不扣书。"""
        self.pets.insert_one(_pet(Class=2, Skills=[]))
        self.inv.insert_one(_inv((56, 5)))
        _real = skill_service.get_skill
        skill_service.get_skill = lambda k: (
            {"key": k, "name": "假参考技", "classes": "all", "reference_only": True}
            if k == "nami_qinshi" else _real(k))
        try:
            res = self.use(56)
        finally:
            skill_service.get_skill = _real
        assert res["ok"] is False and "参考项" in res["reason"], res
        assert self.book_qty(56) == 5
        assert self.skills() == []

    def test_nami_open_to_all_classes(self):
        """★2026-10-01：纳米侵蚀（书 56）开放所有职业可学 —— 三职业都能学会且扣 1 本。"""
        for cls in (1, 2, 3):
            self.pets.delete_many({})
            self.inv.delete_many({})
            self.pets.insert_one(_pet(Class=cls, Skills=[]))
            self.inv.insert_one(_inv((56, 3)))
            res = self.use(56)
            assert res["ok"] is True, res
            assert self.skills() == ["nami_qinshi"], self.skills()
            assert res["levels"].get("nami_qinshi") == 1, res
            assert self.book_qty(56) == 2

    def test_nami_already_learned_no_write(self):
        self.pets.insert_one(_pet(Class=1, Skills=["nami_qinshi"]))
        self.inv.insert_one(_inv((56, 5)))
        res = self.use(56)
        assert res["ok"] is False and "不能再学习了" in res["reason"], res
        assert self.book_qty(56) == 5

    def test_pet_not_owned_no_write(self):
        self.pets.insert_one(_pet(user_id="someone-else", Skills=[]))
        self.inv.insert_one(_inv((36, 9)))
        res = self.use(36)
        assert res["ok"] is False, res
        assert self.book_qty(36) == 9

    def test_invalid_pet_id(self):
        res = asyncio.run(
            skill_handler.apply_skill_book(UID, CID, "not-an-object-id", 36))
        assert res["ok"] is False and "无效" in res["reason"], res
