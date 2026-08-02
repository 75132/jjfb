# -*- coding: utf-8 -*-
"""PVE get_or_create 并发、幂等、异常回滚与剧情 pending 状态机。"""
import asyncio
import ast
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestGetOrCreatePveRoom(unittest.TestCase):
    def _fresh_service(self):
        from services.battle_room_service import BattleRoomService

        return BattleRoomService()

    def test_concurrent_create_only_one_room(self):
        async def run():
            svc = self._fresh_service()
            calls = {"n": 0}

            async def factory():
                calls["n"] += 1
                await asyncio.sleep(0.01)
                return {"RobotName": "E", "MaxHP": 100, "CurrentHP": 100}

            async def one(req):
                return await svc.get_or_create_pve_room(
                    user_id="u1",
                    character_id="cid-1",
                    player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100},
                    enemy_factory=factory,
                    request_id=req,
                )

            (r1, c1), (r2, c2) = await asyncio.gather(one("req-a"), one("req-b"))
            self.assertEqual(r1["room_id"], r2["room_id"])
            self.assertEqual(calls["n"], 1)
            self.assertEqual(sum(1 for x in (c1, c2) if x), 1)
            self.assertEqual(len(svc.rooms), 1)

        asyncio.run(run())

    def test_same_request_id_returns_same_room(self):
        async def run():
            svc = self._fresh_service()
            calls = {"n": 0}

            def factory():
                calls["n"] += 1
                return {"RobotName": "E", "MaxHP": 50, "CurrentHP": 50}

            r1, created1 = await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-1",
                player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100},
                enemy_factory=factory,
                request_id="same-req",
            )
            r2, created2 = await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-1",
                player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100},
                enemy_factory=factory,
                request_id="same-req",
            )
            self.assertTrue(created1)
            self.assertFalse(created2)
            self.assertEqual(r1["room_id"], r2["room_id"])
            self.assertEqual(calls["n"], 1)

        asyncio.run(run())

    def test_different_request_id_concurrent_at_most_one_active(self):
        async def run():
            svc = self._fresh_service()

            async def factory():
                await asyncio.sleep(0.005)
                return {"RobotName": "E", "MaxHP": 50, "CurrentHP": 50}

            results = await asyncio.gather(
                svc.get_or_create_pve_room(
                    user_id="u1",
                    character_id="cid-x",
                    player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100},
                    enemy_factory=factory,
                    request_id="r1",
                ),
                svc.get_or_create_pve_room(
                    user_id="u1",
                    character_id="cid-x",
                    player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100},
                    enemy_factory=factory,
                    request_id="r2",
                ),
            )
            rooms = {r["room_id"] for r, _ in results}
            self.assertEqual(len(rooms), 1)
            self.assertEqual(len([1 for _, c in results if c]), 1)

        asyncio.run(run())

    def test_enemy_factory_called_once(self):
        async def run():
            svc = self._fresh_service()
            n = {"c": 0}

            def factory():
                n["c"] += 1
                return {"RobotName": "E", "MaxHP": 10, "CurrentHP": 10}

            await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-1",
                player_doc={"RobotName": "P", "MaxHP": 10, "CurrentHP": 10},
                enemy_factory=factory,
                request_id="a",
            )
            await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-1",
                player_doc={"RobotName": "P", "MaxHP": 10, "CurrentHP": 10},
                enemy_factory=factory,
                request_id="b",
            )
            self.assertEqual(n["c"], 1)

        asyncio.run(run())

    def test_create_exception_leaves_no_room_or_index(self):
        async def run():
            svc = self._fresh_service()

            def factory():
                raise RuntimeError("boom")

            with self.assertRaises(RuntimeError):
                await svc.get_or_create_pve_room(
                    user_id="u1",
                    character_id="cid-boom",
                    player_doc={"RobotName": "P", "MaxHP": 10, "CurrentHP": 10},
                    enemy_factory=factory,
                    request_id="x",
                )
            self.assertEqual(len(svc.rooms), 0)
            self.assertIsNone(svc.char_room_index.get("cid-boom"))

        asyncio.run(run())

    def test_idempotency_cleared_after_room_finished(self):
        async def run():
            svc = self._fresh_service()

            def factory():
                return {"RobotName": "E", "MaxHP": 10, "CurrentHP": 10}

            room, _ = await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-1",
                player_doc={"RobotName": "P", "MaxHP": 10, "CurrentHP": 10},
                enemy_factory=factory,
                request_id="fin-req",
            )
            self.assertIn(("cid-1", "fin-req"), svc._pve_create_idempotency)
            room["player"]["hp"] = 0
            svc._end_if_needed(room)
            self.assertNotIn(("cid-1", "fin-req"), svc._pve_create_idempotency)

        asyncio.run(run())

    def test_character_lock_does_not_linger(self):
        async def run():
            svc = self._fresh_service()

            def factory():
                return {"RobotName": "E", "MaxHP": 10, "CurrentHP": 10}

            await svc.get_or_create_pve_room(
                user_id="u1",
                character_id="cid-lock",
                player_doc={"RobotName": "P", "MaxHP": 10, "CurrentHP": 10},
                enemy_factory=factory,
            )
            self.assertNotIn("cid-lock", svc._pve_create_locks)

        asyncio.run(run())


class TestStoryPendingFsm(unittest.TestCase):
    def test_create_exception_rolls_pending_to_authorized(self):
        async def run():
            from services import story_battle_service as sbs

            progress = {
                "pending_battle": sbs.make_authorized_pending(
                    event_id="evt-1", battle_ref="br1", map_code="m1"
                )
            }
            progress["pending_battle"]["status"] = sbs.STATUS_CREATING

            with patch(
                "services.story_service.get_or_create_progress",
                new=AsyncMock(return_value=progress),
            ), patch("services.story_service.save_progress", new=AsyncMock()) as save:
                await sbs.rollback_pending_to_authorized("uid", "cid", "m1", "evt-1")
                self.assertEqual(progress["pending_battle"]["status"], sbs.STATUS_AUTHORIZED)
                self.assertIsNone(progress["pending_battle"]["room_id"])
                save.assert_awaited()

        asyncio.run(run())

    def test_create_success_pending_in_room_binds_room_id(self):
        async def run():
            from services import story_battle_service as sbs

            progress = {
                "pending_battle": sbs.make_authorized_pending(
                    event_id="evt-1", battle_ref="br1", map_code="m1"
                )
            }
            progress["pending_battle"]["status"] = sbs.STATUS_CREATING

            with patch(
                "services.story_service.get_or_create_progress",
                new=AsyncMock(return_value=progress),
            ), patch("services.story_service.save_progress", new=AsyncMock()):
                await sbs.transition_pending_to_in_room("uid", "cid", "m1", "evt-1", "room-xyz")
                self.assertEqual(progress["pending_battle"]["status"], sbs.STATUS_IN_ROOM)
                self.assertEqual(progress["pending_battle"]["room_id"], "room-xyz")

        asyncio.run(run())


class TestStoryBattleServiceIsolation(unittest.TestCase):
    def test_service_does_not_import_handlers(self):
        path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "services",
            "story_battle_service.py",
        )
        with open(path, encoding="utf-8") as f:
            tree = ast.parse(f.read())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self.assertFalse(
                        alias.name == "handlers" or alias.name.startswith("handlers."),
                        f"forbidden import {alias.name}",
                    )
            if isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                self.assertFalse(
                    mod == "handlers" or mod.startswith("handlers."),
                    f"forbidden from {mod}",
                )

    def test_shared_does_not_import_story_handler(self):
        path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "services",
            "story_battle_shared.py",
        )
        with open(path, encoding="utf-8") as f:
            tree = ast.parse(f.read())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                self.assertNotEqual(mod, "handlers.story_handler")
                if mod == "handlers":
                    for alias in node.names:
                        self.assertNotEqual(alias.name, "story_handler")
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self.assertFalse(alias.name.endswith("story_handler"))

    def test_unauthorized_story_create_rejected(self):
        from services.story_battle_service import validate_pending_story_battle

        pending, err = validate_pending_story_battle({}, "evt-1")
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_event_id_mismatch_rejected(self):
        from services.story_battle_service import validate_pending_story_battle

        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "A", "battle_ref": "br", "status": "authorized"}},
            "B",
        )
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_battle_ref_mismatch_rejected(self):
        from services.story_battle_service import validate_pending_story_battle

        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "e1", "battle_ref": "br1", "status": "authorized"}},
            "e1",
            "br2",
            require_battle_ref_match=True,
        )
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_deprecated_and_create_use_same_service(self):
        async def run():
            from services.story_battle_service import consume_or_validate_pending_battle
            from services.story_battle_shared import consume_or_validate_pending_battle as shared_consume

            enemy = {"RobotName": "Same", "battle_ref": "br1"}
            with patch(
                "services.story_battle_service.prepare_story_battle",
                new=AsyncMock(
                    return_value=type(
                        "P",
                        (),
                        {
                            "pending": {"event_id": "evt-1"},
                            "enemy": enemy,
                            "event_id": "evt-1",
                            "battle_ref": "br1",
                            "map_code": "m1",
                        },
                    )()
                ),
            ):
                p1, e1, err1 = await consume_or_validate_pending_battle(
                    "u", "c", "m1", "evt-1", battle_ref="br1", mark_creating=False
                )
                p2, e2, err2 = await shared_consume(
                    "u", "c", "m1", "evt-1", battle_ref="br1", mark_creating=False
                )
            self.assertIsNone(err1)
            self.assertIsNone(err2)
            self.assertEqual(e1, e2)
            self.assertEqual(e1.get("RobotName"), "Same")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
