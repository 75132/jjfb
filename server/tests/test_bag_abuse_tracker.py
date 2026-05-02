"""背包写操作滑动窗口频控单测。"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.bag_abuse_tracker import BagAbuseTracker


class BagAbuseTrackerTests(unittest.TestCase):
    def test_window_blocks_after_max(self):
        t = BagAbuseTracker()
        for _ in range(40):
            ok, _ = t.check_and_record('user-a')
            self.assertTrue(ok)
        ok, code = t.check_and_record('user-a')
        self.assertFalse(ok)
        self.assertEqual(code, 'BAG_RATE_TOO_FAST')


if __name__ == '__main__':
    unittest.main()
