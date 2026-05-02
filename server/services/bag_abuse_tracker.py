"""
背包写操作简易频控：滑动窗口内超过阈值则拒绝（429）。
"""
from __future__ import annotations

import time
from collections import deque
from typing import Deque, Dict, Tuple

_WINDOW_SEC = 10.0
_MAX_OPS = 40  # 每窗口每用户最多写操作次数


class BagAbuseTracker:
    def __init__(self):
        self._by_user: Dict[str, Deque[float]] = {}

    def check_and_record(self, user_key: str) -> Tuple[bool, str]:
        now = time.time()
        q = self._by_user.setdefault(user_key, deque())
        while q and now - q[0] > _WINDOW_SEC:
            q.popleft()
        if len(q) >= _MAX_OPS:
            return False, 'BAG_RATE_TOO_FAST'
        q.append(now)
        return True, ''


bag_abuse_tracker = BagAbuseTracker()
