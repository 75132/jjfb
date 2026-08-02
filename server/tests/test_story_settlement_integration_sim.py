# -*- coding: utf-8 -*-
"""
真实地图联调路径仿真（不依赖在线 Mongo/WS）：
map_code = world_1783106205039
event_id = world_1783106205039_chain_2_enemy_e2
battle_ref = battle_1-50

覆盖：create → finish → pending battle_finished → finalize → settlement 清除
以及断线窗口：判胜后未 finalize → get_state 提示 pending_settlement → finalize 幂等。
"""
import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MAP_CODE = "world_1783106205039"
EVENT_ID = "world_1783106205039_chain_2_enemy_e2"
BATTLE_REF = "battle_1-50"
CHARACTER_ID = "cid-integration-1"


class TestRealMapSettlementSimulation(unittest.TestCase):
    def test_full_win_finalize_and_reconnect_settlement(self):
        async def run():
            from services.battle_room_service import BattleRoomService
            from services.story_battle_service import (
                STATUS_BATTLE_FINISHED,
                build_pending_story_settlement,
                clear_settlement_ledger_for_tests,
                finalize_story_battle,
                record_story_battle_result,
            )

            clear_settlement_ledger_for_tests()
            brs = BattleRoomService()
            room = brs.create_pve_room(
                user_id="uid-int",
                character_id=CHARACTER_ID,
                player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100, "Melee": 50, "Armor": 0, "Initiative": 10},
                enemy_doc={"RobotName": "E", "MaxHP": 10, "CurrentHP": 10, "Melee": 1, "Armor": 0, "Initiative": 1},
                story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
            )
            room_id = room["room_id"]
            self.assertEqual(room["story_context"]["event_id"], EVENT_ID)

            # 服务端判胜
            room["enemy"]["hp"] = 0
            brs._end_if_needed(room)
            self.assertEqual(room["status"], "finished")
            self.assertEqual(room["result"]["winner"], "player")
            # finished 不进 resume
            self.assertIsNone(brs.get_room_for_character(CHARACTER_ID))

            progress = {
                "pending_battle": {
                    "event_id": EVENT_ID,
                    "battle_ref": BATTLE_REF,
                    "map_code": MAP_CODE,
                    "status": "in_room",
                    "room_id": room_id,
                    "battle_result": None,
                },
                "completed_event_ids": [],
                "active_tasks": [],
                "completed_task_ids": [],
                "mainline_step": 0,
                "map_code": MAP_CODE,
            }

            with patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.save_progress", new=AsyncMock()):
                await record_story_battle_result(character_id=CHARACTER_ID, room=room, user_id="uid-int")

            self.assertEqual(progress["pending_battle"]["status"], STATUS_BATTLE_FINISHED)
            before_pending = dict(progress["pending_battle"])

            # 断线窗口：get_state 应提示 settlement
            hint = build_pending_story_settlement(progress)
            self.assertTrue(hint["required"])
            self.assertEqual(hint["room_id"], room_id)
            self.assertEqual(hint["event_id"], EVENT_ID)

            apply_n = {"n": 0}

            async def _apply(*a, **k):
                apply_n["n"] += 1
                return [{"action": "noop"}]

            async def _save(p):
                snapshot = dict(p)
                progress.clear()
                progress.update(snapshot)

            with patch("services.story_service.load_map_config", return_value={"npcs": []}), \
                 patch("services.story_service._find_event", return_value=(
                     {"npcUid": "world_1783106205039_chain_2_enemy"},
                     {"eventType": "battle", "server": {"effects": [], "battleRef": BATTLE_REF}},
                     "world_1783106205039_chain_2_enemy",
                 )), \
                 patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=lambda *a, **k: progress)), \
                 patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
                 patch("services.story_service._choice_completes_event", return_value=(True, "")), \
                 patch("services.story_service.apply_effects", new=_apply), \
                 patch("services.story_service.save_progress", new=_save), \
                 patch("services.story_service.build_state_payload", side_effect=lambda p, m: {
                     "completed_event_ids": list(p.get("completed_event_ids") or []),
                     "pending_battle": p.get("pending_battle"),
                 }), \
                 patch("services.battle_room_service.battle_room_service.get_room_by_id", return_value=room):
                ok, msg, payload = await finalize_story_battle(
                    user_id="uid-int",
                    character_id=CHARACTER_ID,
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room_id,
                    request_id="finalize-req-1",
                )
                ok2, msg2, payload2 = await finalize_story_battle(
                    user_id="uid-int",
                    character_id=CHARACTER_ID,
                    map_code=MAP_CODE,
                    event_id=EVENT_ID,
                    room_id=room_id,
                    request_id="finalize-req-2",
                )

            self.assertTrue(ok, msg=f"finalize failed: {msg} payload={payload}")
            self.assertEqual(apply_n["n"], 1, msg=f"progress={progress}")
            self.assertIn(EVENT_ID, progress.get("completed_event_ids") or [], msg=f"progress={progress} payload={payload}")
            self.assertIsNone(progress.get("pending_battle"))
            self.assertFalse(payload.get("idempotent_replay"))
            self.assertTrue(ok2)
            self.assertTrue(payload2.get("idempotent_replay"))
            self.assertEqual(apply_n["n"], 1)

            # 证据字段（报告用）
            self.assertEqual(before_pending["status"], STATUS_BATTLE_FINISHED)
            self.assertEqual(before_pending["room_id"], room_id)
            print("INTEGRATION_EVIDENCE", {
                "map_code": MAP_CODE,
                "event_id": EVENT_ID,
                "battle_ref": BATTLE_REF,
                "character_id": CHARACTER_ID,
                "room_id": room_id,
                "finalize_request_id": "finalize-req-1",
                "pending_before": before_pending["status"],
                "pending_after": progress.get("pending_battle"),
                "completed_event_ids": progress.get("completed_event_ids"),
                "idempotent_replay_second": payload2.get("idempotent_replay"),
            })

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
