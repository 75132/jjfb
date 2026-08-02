# -*- coding: utf-8 -*-
"""权威剧情战斗结算 finalize / pending 状态机 / 防重复奖励。"""
import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.settlement_test_utils import install_fake_settlement_ledger


def _player_doc():
    return {"RobotName": "P", "MaxHP": 100, "CurrentHP": 100, "Melee": 20, "Armor": 0, "Initiative": 10}


def _enemy_doc():
    return {"RobotName": "E", "MaxHP": 10, "CurrentHP": 10, "Melee": 1, "Armor": 0, "Initiative": 1}


class TestStoryBattleFinalize(unittest.TestCase):
    def setUp(self):
        from services.story_battle_service import clear_settlement_ledger_for_tests
        from services.battle_room_service import BattleRoomService

        self._settlements, self._effects = install_fake_settlement_ledger()
        clear_settlement_ledger_for_tests()
        self.svc = BattleRoomService()

    def _make_story_room(self, *, winner="player", reason="ko", character_id="cid-1"):
        room = self.svc.create_pve_room(
            user_id="uid-1",
            character_id=character_id,
            player_doc=_player_doc(),
            enemy_doc=_enemy_doc(),
            story_context={
                "event_id": "evt-battle-1",
                "map_code": "world_1783106205039",
                "battle_ref": "battle_1-50",
            },
        )
        self.assertIn("story_context", room)
        room["status"] = "finished"
        room["result"] = {"winner": winner, "reason": reason}
        self.svc._end_if_needed(room)
        return room

    def test_finalize_rejects_without_room(self):
        async def run():
            from services.story_battle_service import finalize_story_battle

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value={
                     "pending_battle": {
                         "event_id": "evt-battle-1",
                         "status": "battle_finished",
                         "room_id": "missing-room",
                         "battle_ref": "battle_1-50",
                         "map_code": "m1",
                     },
                     "completed_event_ids": [],
                 })):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="m1",
                    event_id="evt-battle-1",
                    room_id="missing-room",
                )
            self.assertFalse(ok)
            self.assertIn("找不到", msg)

        asyncio.run(run())

    def test_room_id_mismatch_rejected(self):
        room = self._make_story_room()
        async def run():
            from services.story_battle_service import finalize_story_battle, record_story_battle_result

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": []}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id="wrong-room",
                )
            self.assertFalse(ok)
            self.assertIn("room_id", msg)

        asyncio.run(run())

    def test_character_mismatch_rejected(self):
        room = self._make_story_room()
        async def run():
            from services.story_battle_service import finalize_story_battle

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="other-cid",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)
            self.assertTrue("不匹配" in msg or "角色" in msg)

        asyncio.run(run())

    def test_event_id_mismatch_rejected(self):
        room = self._make_story_room()
        async def run():
            from services.story_battle_service import finalize_story_battle

            progress = {
                "pending_battle": {
                    "event_id": "evt-OTHER",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)

        asyncio.run(run())

    def test_battle_ref_mismatch_rejected(self):
        room = self._make_story_room()
        async def run():
            from services.story_battle_service import finalize_story_battle

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_OTHER",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)
            self.assertIn("battle_ref", msg)

        asyncio.run(run())

    def test_in_progress_room_rejected(self):
        room = self._make_story_room()
        room["status"] = "in_progress"
        room["result"] = None

        async def run():
            from services.story_battle_service import finalize_story_battle

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)
            self.assertIn("尚未结束", msg)

        asyncio.run(run())

    def test_winner_enemy_rejected(self):
        room = self._make_story_room(winner="enemy", reason="ko")

        async def run():
            from services.story_battle_service import finalize_story_battle

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_failed",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)

        asyncio.run(run())

    def test_winner_player_finalize_success_once(self):
        room = self._make_story_room(winner="player")
        apply_calls = {"n": 0}

        async def run():
            from services.story_battle_service import finalize_story_battle, clear_settlement_ledger_for_tests

            clear_settlement_ledger_for_tests()
            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
                "active_tasks": [],
                "completed_task_ids": [],
                "mainline_step": 0,
                "map_code": "world_1783106205039",
            }

            async def _apply(*a, **k):
                apply_calls["n"] += 1
                return [{"action": "grant_exp", "amount": 1}]

            async def _save(p):
                snapshot = dict(p)
                progress.clear()
                progress.update(snapshot)

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": [{"action": "x"}]}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
                 patch("services.story_service._choice_completes_event", return_value=(True, "")), \
                 patch("services.story_service.apply_effects", new=_apply), \
                 patch("services.story_service.save_progress", new=_save), \
                 patch("services.story_service.build_state_payload", side_effect=lambda p, m: {"completed_event_ids": p.get("completed_event_ids", [])}), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok1, msg1, payload1 = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                    request_id="fin-1",
                )
                ok2, msg2, payload2 = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                    request_id="fin-1",
                )
                ok3, msg3, payload3 = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                    request_id="fin-2",
                )
            self.assertTrue(ok1)
            self.assertEqual(apply_calls["n"], 1)
            self.assertFalse(payload1.get("idempotent_replay"))
            self.assertTrue(ok2)
            self.assertTrue(payload2.get("idempotent_replay"))
            self.assertTrue(ok3)
            self.assertTrue(payload3.get("idempotent_replay"))
            self.assertEqual(apply_calls["n"], 1)

        asyncio.run(run())

    def test_record_story_battle_result_sets_battle_finished(self):
        room = self._make_story_room(winner="player")
        # reset to in_room then record
        async def run():
            from services.story_battle_service import record_story_battle_result, STATUS_BATTLE_FINISHED

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "in_room",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                }
            }
            with patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.story_service.save_progress", new=AsyncMock()):
                await record_story_battle_result(character_id="cid-1", room=room, user_id="uid")
            self.assertEqual(progress["pending_battle"]["status"], STATUS_BATTLE_FINISHED)
            self.assertEqual(progress["pending_battle"]["battle_result"]["winner"], "player")

        asyncio.run(run())

    def test_normal_pve_finish_does_not_touch_pending(self):
        async def run():
            from services.story_battle_service import record_story_battle_result

            room = self.svc.create_pve_room(
                user_id="u",
                character_id="cid-pve",
                player_doc=_player_doc(),
                enemy_doc=_enemy_doc(),
            )
            room["status"] = "finished"
            room["result"] = {"winner": "player", "reason": "ko"}
            progress = {"pending_battle": {"event_id": "x", "status": "authorized"}}
            with patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)) as g, \
                 patch("services.story_service.save_progress", new=AsyncMock()) as s:
                await record_story_battle_result(character_id="cid-pve", room=room, user_id="u")
            g.assert_not_called()
            s.assert_not_called()

        asyncio.run(run())

    def test_forged_battle_won_cannot_complete(self):
        """伪造 battle_won=true 无法完成未胜利剧情战。"""
        room = self._make_story_room(winner="enemy")

        async def run():
            from services.story_service import complete_event

            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_failed",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
            }
            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.story_service._event_completed", return_value=False), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await complete_event(
                    "uid",
                    "cid-1",
                    "world_1783106205039",
                    "evt-battle-1",
                    battle_won=True,  # forged
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)

        asyncio.run(run())

    def test_finished_room_not_in_resume(self):
        room = self._make_story_room(winner="player")
        # char index cleared
        self.assertIsNone(self.svc.get_room_for_character("cid-1"))
        # still findable by id for finalize
        self.assertIsNotNone(self.svc.get_room_by_id(room["room_id"]))

    def test_pending_settlement_hint(self):
        from services.story_battle_service import build_pending_story_settlement

        hint = build_pending_story_settlement({
            "pending_battle": {
                "status": "battle_finished",
                "room_id": "r1",
                "event_id": "e1",
            }
        })
        self.assertTrue(hint["required"])
        self.assertEqual(hint["room_id"], "r1")

    def test_failed_battle_can_reauthorize(self):
        async def run():
            from services.story_battle_service import reauthorize_failed_battle, STATUS_BATTLE_FAILED

            progress = {
                "pending_battle": {
                    "event_id": "evt-1",
                    "status": STATUS_BATTLE_FAILED,
                    "room_id": "old-room",
                }
            }
            with patch("services.story_service.get_or_create_progress", new=AsyncMock(return_value=progress)), \
                 patch("services.story_service.save_progress", new=AsyncMock()):
                await reauthorize_failed_battle("uid", "cid", "m1", "evt-1")
            self.assertIsNone(progress["pending_battle"])

        asyncio.run(run())

    def test_reward_failure_rolls_back_to_battle_finished(self):
        room = self._make_story_room(winner="player")

        async def run():
            from services.story_battle_service import (
                finalize_story_battle,
                clear_settlement_ledger_for_tests,
                STATUS_BATTLE_FINISHED,
            )

            clear_settlement_ledger_for_tests()
            progress = {
                "pending_battle": {
                    "event_id": "evt-battle-1",
                    "status": "battle_finished",
                    "room_id": room["room_id"],
                    "battle_ref": "battle_1-50",
                    "map_code": "world_1783106205039",
                },
                "completed_event_ids": [],
                "map_code": "world_1783106205039",
            }

            async def _boom(*a, **k):
                raise RuntimeError("reward write failed")

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=({"npcUid": "n"}, {"eventType": "battle", "server": {"effects": [{}]}}, "n")), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
                 patch("services.story_service._choice_completes_event", return_value=(True, "")), \
                 patch("services.story_service.apply_effects", new=_boom), \
                 patch("services.story_service.save_progress", new=AsyncMock()), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, _ = await finalize_story_battle(
                    user_id="uid",
                    character_id="cid-1",
                    map_code="world_1783106205039",
                    event_id="evt-battle-1",
                    room_id=room["room_id"],
                )
            self.assertFalse(ok)
            self.assertEqual(progress["pending_battle"]["status"], STATUS_BATTLE_FINISHED)

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
