# -*- coding: utf-8 -*-
"""battle_room_create 活动房间冲突与剧情分支（轻量 mock）。"""
import asyncio
import json
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class _FakeWs:
    def __init__(self):
        self.sent = []

    async def send(self, raw: str):
        self.sent.append(json.loads(raw) if isinstance(raw, str) else raw)


class TestBattleRoomCreateConflict(unittest.TestCase):
    def test_active_room_returns_409(self):
        async def run():
            from handlers import battle_room_handler
            from handlers import utils as handler_utils

            ws = _FakeWs()
            data = {"token": "t", "character_id": "cid-1", "user_id": "u1"}
            user = {"_id": "uid-obj"}
            existing = {"room_id": "r1", "status": "in_progress"}

            with patch.object(handler_utils, "get_user_by_id_or_token", return_value=user), \
                 patch.object(battle_room_handler.world_presence_service, "consume_fresh_collision_gate"), \
                 patch.object(battle_room_handler, "_ensure_battle_team_ready_for_combat", new=AsyncMock()), \
                 patch.object(battle_room_handler, "_load_player_pet_snapshot", new=AsyncMock(return_value={"pet_id": "p1", "Level": 1})), \
                 patch.object(battle_room_handler, "_build_attrs_from_pet", return_value={"pet_id": "p1"}), \
                 patch.object(battle_room_handler.battle_room_service, "get_room_for_character", return_value=existing):
                await battle_room_handler.handle_battle_room_create(ws, data, "cid-1")

            self.assertTrue(ws.sent, "should send error response")
            resp = ws.sent[-1]
            self.assertFalse(resp.get("success", True))
            self.assertEqual(resp.get("code"), 409)
            self.assertEqual(resp.get("error_code"), "ACTIVE_BATTLE_ROOM")

        asyncio.run(run())

    def test_story_create_rejects_unauthorized(self):
        async def run():
            from handlers import battle_room_handler
            from handlers import utils as handler_utils

            ws = _FakeWs()
            data = {
                "token": "t",
                "character_id": "cid-1",
                "user_id": "u1",
                "story_event_id": "evt-x",
                "map_code": "test_base",
            }
            user = {"_id": "uid-obj"}

            with patch.object(handler_utils, "get_user_by_id_or_token", return_value=user), \
                 patch.object(battle_room_handler.world_presence_service, "consume_fresh_collision_gate"), \
                 patch.object(battle_room_handler, "_ensure_battle_team_ready_for_combat", new=AsyncMock()), \
                 patch.object(battle_room_handler, "_load_player_pet_snapshot", new=AsyncMock(return_value={"pet_id": "p1"})), \
                 patch.object(battle_room_handler, "_build_attrs_from_pet", return_value={"pet_id": "p1"}), \
                 patch.object(battle_room_handler.battle_room_service, "get_room_for_character", return_value=None), \
                 patch(
                     "services.story_battle_shared.consume_or_validate_pending_battle",
                     new=AsyncMock(return_value=(None, None, "剧情战斗未授权，请先 story_interact")),
                 ):
                await battle_room_handler.handle_battle_room_create(ws, data, "cid-1")

            self.assertTrue(ws.sent)
            resp = ws.sent[-1]
            self.assertFalse(resp.get("success", True))
            self.assertIn("未授权", resp.get("message", ""))

        asyncio.run(run())


class TestStoryBattleStartDeprecated(unittest.TestCase):
    def test_deprecated_uses_shared_and_flags_response(self):
        async def run():
            from handlers import story_handler
            from handlers import utils as handler_utils

            data = {
                "token": "t",
                "character_id": "cid-1",
                "event_id": "evt-1",
                "battle_ref": "br1",
                "map_code": "test_base",
            }
            user = {"_id": "uid"}
            enemy = {"RobotName": "E", "battle_ref": "br1"}
            captured = {}

            async def _capture_success(websocket, route, data=None, message=None, request_id=None, request_data=None, immediate=False):
                captured["route"] = route
                captured["data"] = data

            with patch.object(
                story_handler,
                "_resolve_user_character",
                new=AsyncMock(return_value=(user, "uid", "cid-1")),
            ), patch(
                "services.story_battle_shared.consume_or_validate_pending_battle",
                new=AsyncMock(return_value=({"event_id": "evt-1"}, enemy, None)),
            ), patch.object(handler_utils, "send_success_response", new=_capture_success):
                await story_handler.handle_story_battle_start(_FakeWs(), data, "uid", "cid-1")

            self.assertEqual(captured.get("route"), "story_battle_start")
            self.assertTrue(captured.get("data", {}).get("deprecated") is True)
            self.assertEqual(captured.get("data", {}).get("enemy"), enemy)

        asyncio.run(run())

    def test_generate_story_enemy_shared_entry(self):
        from services import story_battle_shared
        from handlers import story_handler

        self.assertTrue(callable(story_battle_shared.generate_story_enemy))
        self.assertTrue(callable(story_handler._generate_story_enemy))
        # generate_story_enemy 委托唯一实现 _generate_story_enemy
        with open(story_battle_shared.__file__, encoding="utf-8") as f:
            src = f.read()
        self.assertIn("_generate_story_enemy", src)


if __name__ == "__main__":
    unittest.main()
