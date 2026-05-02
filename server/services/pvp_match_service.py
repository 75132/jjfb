from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque, Optional

from bson import ObjectId


@dataclass
class FlatMatchTicket:
    user: Any
    character_id: str
    created_at: float
    # 等待另一方完成配对后触发
    event: asyncio.Event
    # 配对成功后由“第二个进入的人”写入（包含 room_id 与 view state）
    matched_result: Optional[dict] = None


class PvpMatchService:
    """
    PVP 匹配服务（平匹配模式）：
    - 玩家点击“平匹配”进入队列
    - 两个玩家都在队列中（且当前都还未超时）则直接配对
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._flat_queue: Deque[FlatMatchTicket] = deque()

    async def enqueue_or_get_opponent(
        self, ticket: FlatMatchTicket
    ) -> Optional[FlatMatchTicket]:
        async with self._lock:
            if self._flat_queue:
                return self._flat_queue.popleft()
            self._flat_queue.append(ticket)
            return None

    async def remove_ticket(self, ticket: FlatMatchTicket) -> None:
        async with self._lock:
            try:
                self._flat_queue.remove(ticket)
            except ValueError:
                # 已被配对弹出
                pass


pvp_match_service = PvpMatchService()

