# -*- coding: utf-8 -*-
"""
P3：持久化结算账本 / effect 幂等 / finished 房间 / bag_has_items。

跨重启测试：共用 FakeMongo 集合，reset_ledger_cols 仅清缓存并重新挂载（新 Service 语义）。
"""
import asyncio
import os
import sys
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_mongo import FakeMongoCollection, DuplicateKeyError
from tests.settlement_test_utils import install_fake_settlement_ledger, simulate_service_restart

MAP_CODE = "world_1783106205039"
EVENT_ID = "world_1783106205039_chain_2_enemy_e2"
BATTLE_REF = "battle_1-50"


def _player():
    return {"RobotName": "P", "MaxHP": 100, "CurrentHP": 100, "Melee": 50, "Armor": 0, "Initiative": 10}


def _enemy():
    return {"RobotName": "E", "MaxHP": 10, "CurrentHP": 10, "Melee": 1, "Armor": 0, "Initiative": 1}


class TestSettlementUniqueIndex(unittest.TestCase):
    def test_unique_index_character_event_room(self):
        col = FakeMongoCollection("s", unique_keys=[("character_id", "event_id", "room_id")])
        col.create_index(
            [("character_id", 1), ("event_id", 1), ("room_id", 1)],
            unique=True,
            name="character_event_room_unique",
        )
        self.assertIn("character_event_room_unique", col.indexes)
        col.insert_one({"character_id": "c", "event_id": "e", "room_id": "r", "status": "processing"})
        with self.assertRaises(DuplicateKeyError):
            col.insert_one({"character_id": "c", "event_id": "e", "room_id": "r", "status": "processing"})


class TestPersistedSettlementRestart(unittest.TestCase):
    def setUp(self):
        self.settlements, self.effects = install_fake_settlement_ledger()

    def _make_room(self, brs, cid="cid-p3"):
        room = brs.create_pve_room(
            user_id="uid",
            character_id=cid,
            player_doc=_player(),
            enemy_doc=_enemy(),
            story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
        )
        room["status"] = "finished"
        room["result"] = {"winner": "player", "reason": "ko"}
        room["updated_at"] = time.time()
        brs._end_if_needed(room)
        return room

    def _progress(self, room_id, status="battle_finished"):
        return {
            "pending_battle": {
                "event_id": EVENT_ID,
                "status": status,
                "room_id": room_id,
                "battle_ref": BATTLE_REF,
                "map_code": MAP_CODE,
            },
            "completed_event_ids": [],
            "active_tasks": [],
            "completed_task_ids": [],
            "mainline_step": 0,
            "map_code": MAP_CODE,
        }

    def test_completed_idempotent_across_service_restart(self):
        async def run():
            from services.battle_room_service import BattleRoomService
            from services.story_battle_service import finalize_story_battle

            brs = BattleRoomService()
            room = self._make_room(brs)
            progress = self._progress(room["room_id"])
            apply_n = {"n": 0}

            async def _apply(*a, **k):
                apply_n["n"] += 1
                return [{"action": "give_item", "itemId": 1, "count": 1}]

            async def _save(p):
                snapshot = dict(p)
                progress.clear()
                progress.update(snapshot)

            patches = [
                patch("services.story_service.load_map_config", return_value={"npcs": []}),
                patch(
                    "services.story_service._find_event",
                    return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": [{}]}}, "n"),
                ),
                patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)),
                patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))),
                patch("services.story_service._choice_completes_event", return_value=(True, "")),
                patch("services.story_service.apply_effects", new=_apply),
                patch("services.story_service.save_progress", new=_save),
                patch(
                    "services.story_service.build_state_payload",
                    side_effect=lambda p, m: {"completed_event_ids": list(p.get("completed_event_ids") or [])},
                ),
                patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room),
            ]
            for p in patches:
                p.start()
            try:
                ok1, _, payload1 = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-p3",
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room["room_id"],
                    request_id="req-a",
                )
                self.assertTrue(ok1)
                self.assertEqual(apply_n["n"], 1)

                # 模拟重启：清缓存 + 新 BattleRoomService，权威仍在 FakeMongo
                simulate_service_restart(self.settlements, self.effects)
                ok2, msg2, payload2 = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-p3",
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room["room_id"],
                    request_id="req-b-different",
                )
                self.assertTrue(ok2, msg2)
                self.assertTrue(payload2.get("idempotent_replay"))
                self.assertEqual(apply_n["n"], 1)
                doc = self.settlements.find_one(
                    {"character_id": "cid-p3", "event_id": EVENT_ID, "room_id": room["room_id"]}
                )
                self.assertEqual(doc["status"], "completed")
            finally:
                for p in patches:
                    p.stop()

        asyncio.run(run())

    def test_different_request_id_no_double_reward_after_restart(self):
        # covered above with req-a / req-b-different
        self.test_completed_idempotent_across_service_restart()

    def test_processing_resume_after_restart(self):
        async def run():
            from services import story_settlement_ledger as ledger
            from services.battle_room_service import BattleRoomService
            from services.story_battle_service import finalize_story_battle

            brs = BattleRoomService()
            room = self._make_room(brs, cid="cid-proc")
            # 预先写入 processing 且已超时
            self.settlements.insert_one(
                {
                    "character_id": "cid-proc",
                    "event_id": EVENT_ID,
                    "room_id": room["room_id"],
                    "status": "processing",
                    "applied_effects": [],
                    "created_at": time.time() - 500,
                    "updated_at": time.time() - 500,
                    "completed_at": None,
                    "error": None,
                }
            )
            simulate_service_restart(self.settlements, self.effects)
            progress = self._progress(room["room_id"])
            apply_n = {"n": 0}

            async def _apply(*a, **k):
                apply_n["n"] += 1
                return [{"action": "add_exp", "value": 10}]

            async def _save(p):
                snapshot = dict(p)
                progress.clear()
                progress.update(snapshot)

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": [{}]}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
                 patch("services.story_service._choice_completes_event", return_value=(True, "")), \
                 patch("services.story_service.apply_effects", new=_apply), \
                 patch("services.story_service.save_progress", new=_save), \
                 patch("services.story_service.build_state_payload", side_effect=lambda p, m: {"completed_event_ids": p.get("completed_event_ids", [])}), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, payload = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-proc",
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room["room_id"],
                    request_id="resume-proc",
                )
            self.assertTrue(ok, msg)
            self.assertEqual(apply_n["n"], 1)
            self.assertFalse(payload.get("idempotent_replay"))

        asyncio.run(run())

    def test_effects_applied_resume_skips_rewards(self):
        async def run():
            from services.battle_room_service import BattleRoomService
            from services.story_battle_service import finalize_story_battle

            brs = BattleRoomService()
            room = self._make_room(brs, cid="cid-ea")
            self.settlements.insert_one(
                {
                    "character_id": "cid-ea",
                    "event_id": EVENT_ID,
                    "room_id": room["room_id"],
                    "status": "effects_applied",
                    "applied_effects": [{"action": "give_item", "itemId": 9, "count": 1}],
                    "created_at": time.time() - 10,
                    "updated_at": time.time() - 10,
                    "completed_at": None,
                    "error": None,
                }
            )
            simulate_service_restart(self.settlements, self.effects)
            progress = self._progress(room["room_id"], status="completing")
            apply_n = {"n": 0}

            async def _apply(*a, **k):
                apply_n["n"] += 1
                return [{"action": "should_not_run"}]

            async def _save(p):
                snapshot = dict(p)
                progress.clear()
                progress.update(snapshot)

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": [{}]}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
                 patch("services.story_service._choice_completes_event", return_value=(True, "")), \
                 patch("services.story_service.apply_effects", new=_apply), \
                 patch("services.story_service.save_progress", new=_save), \
                 patch("services.story_service.build_state_payload", side_effect=lambda p, m: {"completed_event_ids": p.get("completed_event_ids", [])}), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, payload = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-ea",
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room["room_id"],
                )
            self.assertTrue(ok, msg)
            self.assertEqual(apply_n["n"], 0)
            self.assertIn(EVENT_ID, progress.get("completed_event_ids") or [])
            self.assertIsNone(progress.get("pending_battle"))
            doc = self.settlements.find_one(
                {"character_id": "cid-ea", "event_id": EVENT_ID, "room_id": room["room_id"]}
            )
            self.assertEqual(doc["status"], "completed")

        asyncio.run(run())

    def test_partial_effect_crash_resume(self):
        async def run():
            from services.story_service import apply_effects
            from services.story_settlement_ledger import save_effect_record, make_effect_key

            cid, eid, rid = "cid-partial", EVENT_ID, "room-partial"
            # effect 0 已持久化
            await save_effect_record(
                make_effect_key(cid, eid, rid, 0),
                character_id=cid,
                event_id=eid,
                room_id=rid,
                effect_index=0,
                result={"action": "give_item", "itemId": 1, "count": 1},
            )
            simulate_service_restart(self.settlements, self.effects)

            calls = []

            async def fake_single(user_id, character_id, progress, map_cfg, eff, choice_id, task_defs):
                calls.append(eff.get("action"))
                return {"action": eff.get("action"), "ok": True}

            progress = {"active_tasks": [], "completed_task_ids": [], "mainline_step": 0}
            effects = [
                {"action": "give_item", "itemId": 1, "count": 1},
                {"action": "add_exp", "value": 5},
            ]
            with patch("services.story_service._apply_single_effect", new=fake_single), \
                 patch("services.story_service._task_defs", return_value={}):
                applied = await apply_effects(
                    "uid",
                    cid,
                    progress,
                    {},
                    effects,
                    effect_idempotency={"character_id": cid, "event_id": eid, "room_id": rid},
                )
            # effect 0 复用，不调用 _apply_single；effect 1 执行
            self.assertEqual(calls, ["add_exp"])
            self.assertEqual(len(applied), 2)
            self.assertEqual(applied[0]["action"], "give_item")
            self.assertEqual(applied[1]["action"], "add_exp")

        asyncio.run(run())


class TestFinishedRoomPersistence(unittest.TestCase):
    def setUp(self):
        self.settlements, self.effects = install_fake_settlement_ledger()

    def test_finished_room_readable_across_restart_with_story_context(self):
        from services.battle_room_service import BattleRoomService

        store = FakeMongoCollection("battle_rooms", unique_keys=[("room_id",)])
        svc1 = BattleRoomService()
        svc1.init_persistence(store)
        room = svc1.create_pve_room(
            user_id="u",
            character_id="cid-fin",
            player_doc=_player(),
            enemy_doc=_enemy(),
            story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
        )
        room["enemy"]["hp"] = 0
        svc1._end_if_needed(room)
        rid = room["room_id"]
        self.assertEqual(room["status"], "finished")
        self.assertIn("story_context", store.find_one({"room_id": rid}))

        # 重启：新实例，内存空，从 DB 回读
        svc2 = BattleRoomService()
        svc2.init_persistence(store)
        loaded = svc2.get_room_by_id(rid)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["status"], "finished")
        self.assertEqual(loaded["story_context"]["event_id"], EVENT_ID)
        # finished 不进 resume / char_room_index
        self.assertIsNone(svc2.get_room_for_character("cid-fin"))
        self.assertNotIn("cid-fin", svc2.char_room_index)

    def test_finished_room_not_idle_purged_within_retention(self):
        from services.battle_room_service import BattleRoomService

        store = FakeMongoCollection("battle_rooms", unique_keys=[("room_id",)])
        svc = BattleRoomService()
        svc.init_persistence(store)
        room = svc.create_pve_room(
            user_id="u",
            character_id="cid-ret",
            player_doc=_player(),
            enemy_doc=_enemy(),
            story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
        )
        room["status"] = "finished"
        room["result"] = {"winner": "player", "reason": "ko"}
        room["updated_at"] = time.time() - 30 * 60  # 30 分钟前结束（>10min 空闲）
        room["last_action_ts"] = room["updated_at"]
        svc._persist_room(room)
        svc.rooms.clear()
        svc.char_room_index.clear()
        loaded = svc.get_room_by_id(room["room_id"])
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["status"], "finished")


class TestPlainPveNoSettlement(unittest.TestCase):
    def setUp(self):
        self.settlements, self.effects = install_fake_settlement_ledger()

    def test_plain_pve_does_not_create_settlement(self):
        async def run():
            from services.battle_room_service import BattleRoomService
            from services.story_battle_service import record_story_battle_result

            brs = BattleRoomService()
            room = brs.create_pve_room(
                user_id="u",
                character_id="cid-pve",
                player_doc=_player(),
                enemy_doc=_enemy(),
                story_context=None,
            )
            room["status"] = "finished"
            room["result"] = {"winner": "player", "reason": "ko"}
            with patch("services.story_service.get_or_create_progress", new=AsyncMock()) as gop, \
                 patch("services.story_service.save_progress", new=AsyncMock()):
                await record_story_battle_result(character_id="cid-pve", room=room, user_id="u")
                gop.assert_not_called()
            self.assertEqual(self.settlements.count_documents({}), 0)

        asyncio.run(run())


class TestBagHasItems(unittest.TestCase):
    def test_count_beyond_200_and_stack_sum(self):
        async def run():
            from services.story_service import count_items_by_ids

            # 模拟 merge_inventory_items 结果：201+ 条中含目标物品，且同 id 多堆叠
            items = [{"item_id": 1000 + i, "quantity": 1, "category": 1} for i in range(200)]
            items.append({"item_id": 9001, "quantity": 2, "category": 1})
            items.append({"item_id": 9001, "quantity": 3, "category": 1})
            items.append({"item_id": 9002, "quantity": 1, "category": 1})

            inv_doc = {"items": items, "Weapon": [], "Armor": []}

            with patch("handlers.utils.inventory_col") as col, \
                 patch("handlers.utils.async_mongo_operation", new=AsyncMock(side_effect=lambda op, **k: op())):
                col.find_one = MagicMock(return_value=inv_doc)
                # patch merge to use our list
                with patch("handlers.bag_handler.merge_inventory_items", return_value=items):
                    qty = await count_items_by_ids("uid", "cid", [9001, 9002, 9999])
            self.assertEqual(qty["9001"], 5)
            self.assertEqual(qty["9002"], 1)
            self.assertEqual(qty["9999"], 0)

        asyncio.run(run())


class TestMigrateM002(unittest.TestCase):
    def test_m002_in_migrations(self):
        from migrations import list_migrations, run_all
        from tests.test_migrate_dry_run import FakeDB

        ids = [m[0] for m in list_migrations()]
        self.assertIn("m002_story_settlement_indexes", ids)
        db = FakeDB()
        lines = run_all(db, dry_run=True)
        joined = "\n".join(lines)
        self.assertIn("m002_story_settlement_indexes", joined)
        self.assertIn("story_battle_settlements", joined)


if __name__ == "__main__":
    unittest.main()
