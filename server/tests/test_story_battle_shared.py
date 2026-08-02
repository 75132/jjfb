# -*- coding: utf-8 -*-
"""剧情战斗共享函数单测（不依赖 Mongo）。"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.story_battle_shared import validate_pending_story_battle


class TestValidatePendingStoryBattle(unittest.TestCase):
    def test_reject_without_pending(self):
        pending, err = validate_pending_story_battle({}, "evt-1")
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_reject_event_mismatch(self):
        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "evt-A", "battle_ref": "br1"}},
            "evt-B",
        )
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_reject_battle_ref_mismatch_when_required(self):
        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "evt-1", "battle_ref": "br1"}},
            "evt-1",
            "br2",
            require_battle_ref_match=True,
        )
        self.assertIsNone(pending)
        self.assertIn("未授权", err)

    def test_accept_matching_pending(self):
        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "evt-1", "battle_ref": "br1"}},
            "evt-1",
        )
        self.assertIsNone(err)
        self.assertEqual(pending.get("battle_ref"), "br1")

    def test_accept_with_battle_ref_match(self):
        pending, err = validate_pending_story_battle(
            {"pending_battle": {"event_id": "evt-1", "battle_ref": "br1"}},
            "evt-1",
            "br1",
            require_battle_ref_match=True,
        )
        self.assertIsNone(err)
        self.assertEqual(pending.get("event_id"), "evt-1")


if __name__ == "__main__":
    unittest.main()
