"""
同图多人在线：地图房间（内存态）+ 断开/登出/顶号时强制离场。
设计参考 Pomelo Channel：按 map_id 分桶，character_id 唯一；websocket 断开即广播 world_player_leave。

坐标持久化（players.position: map_id, x, y, updated_at）：
- world_enter：进房即写入（节流，与 move 共用 2s 窗口）
- world_step：每步成功后节流写入
- 断线 / world_leave：离场前立即写入最后一次内存坐标（不受节流）
"""
from __future__ import annotations

import asyncio
import json
import math
import time
from typing import Any, Dict, List, Optional, Tuple

_MAX_STEP_PX = 66.0


class WorldPresenceService:
    def __init__(self) -> None:
        self._lock: Optional[asyncio.Lock] = None
        self._rooms: Dict[int, Dict[str, dict]] = {}
        self._ws_index: Dict[int, Tuple[int, str]] = {}
        self._last_db_save: Dict[str, float] = {}
        # 角色重新进图后，要求“至少发生一次有效移动”才允许再次触发战斗（避免重连即原地再触发）
        self._need_fresh_collision: set[str] = set()

    def _ensure_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def leave_websocket(self, websocket) -> None:
        if websocket is None:
            return
        wid = id(websocket)
        map_id: Optional[int] = None
        cid: Optional[str] = None
        snap: Optional[Tuple[int, float, float]] = None
        async with self._ensure_lock():
            pair = self._ws_index.pop(wid, None)
            if not pair:
                return
            map_id, cid = pair
            room = self._rooms.get(map_id)
            st = room.get(cid) if room else None
            if st:
                snap = (int(st.get('map_id', map_id)), float(st['x']), float(st['y']))
            self._remove_character_from_map_locked(map_id, cid)
        if map_id is not None and cid:
            await self._broadcast_to_map(map_id, websocket, {'type': 'world_player_leave', 'character_id': cid, 'reason': 'offline'})
        if snap and cid:
            mid, sx, sy = snap
            self._save_position_immediate(cid, mid, sx, sy)

    def _remove_character_from_map_locked(self, map_id: int, cid: str) -> None:
        room = self._rooms.get(map_id)
        if room and cid in room:
            del room[cid]
        if room is not None and len(room) == 0:
            del self._rooms[map_id]

    async def _purge_character_globally_locked(self, cid: str, except_ws=None) -> None:
        for mid in list(self._rooms.keys()):
            room = self._rooms.get(mid)
            if not room or cid not in room:
                continue
            st = room.pop(cid)
            ws_old = st.get('websocket')
            if ws_old is not None and (except_ws is None or id(ws_old) != id(except_ws)):
                self._ws_index.pop(id(ws_old), None)
            if len(room) == 0:
                del self._rooms[mid]

    async def _broadcast_to_map(self, map_id: int, exclude_ws, payload: dict) -> None:
        raw = json.dumps(payload, default=str)
        async with self._ensure_lock():
            room = self._rooms.get(map_id, {})
            targets: List[Any] = []
            seen = set()
            for st in room.values():
                ws = st.get('websocket')
                if ws is None or (exclude_ws is not None and id(ws) == id(exclude_ws)):
                    continue
                i = id(ws)
                if i in seen:
                    continue
                seen.add(i)
                targets.append(ws)

        async def _send_one(ws):
            try:
                await ws.send(raw)
            except Exception:
                pass

        if targets:
            await asyncio.gather(*(_send_one(ws) for ws in targets), return_exceptions=True)

    async def enter(
        self,
        websocket,
        user_id: str,
        character_id: str,
        map_id: int,
        x: float,
        y: float,
        facing: str,
        role_name: str,
        sprite: int,
    ) -> List[dict]:
        async with self._ensure_lock():
            await self._purge_character_globally_locked(character_id, except_ws=websocket)
            old = self._ws_index.pop(id(websocket), None)
            if old:
                omid, ocid = old
                self._remove_character_from_map_locked(omid, ocid)

            state = {
                'user_id': user_id,
                'character_id': character_id,
                'map_id': map_id,
                'role_name': role_name or '',
                'Sprite': int(sprite) if sprite else 0,
                'x': float(x),
                'y': float(y),
                'facing': facing or 'down',
                'moving': False,
                'websocket': websocket,
                'updated_at': time.time(),
            }
            self._rooms.setdefault(map_id, {})[character_id] = state
            self._ws_index[id(websocket)] = (map_id, character_id)
            # 进入地图后，先标记为“需要下一次碰撞”，直到发生一次有效 world_step 才解除
            self._need_fresh_collision.add(character_id)

            others: List[dict] = []
            room = self._rooms.get(map_id, {})
            for oc_id, st in room.items():
                if oc_id == character_id:
                    continue
                others.append(self._public_view(st))

        join_msg = {
            'type': 'world_player_join',
            'player': {
                'character_id': character_id,
                'user_id': user_id,
                'role_name': role_name or '',
                'Sprite': int(sprite) if sprite else 0,
                'position': {'x': float(x), 'y': float(y), 'map_id': map_id},
                'facing': facing or 'down',
                'moving': False,
            },
        }
        await self._broadcast_to_map(map_id, websocket, join_msg)
        # 进图即落库（站着不动也应有最新坐标；与 move 共用节流避免狂写）
        self._maybe_schedule_db_save(character_id, map_id, float(x), float(y))
        return others

    async def move_step(
        self,
        websocket,
        character_id: str,
        map_id: int,
        x: float,
        y: float,
        facing: str,
        moving: bool,
    ) -> Tuple[bool, str]:
        async with self._ensure_lock():
            pair = self._ws_index.get(id(websocket))
            if not pair or pair[1] != character_id:
                return False, 'not_in_world'
            mid, cid = pair
            if mid != map_id:
                return False, 'map_mismatch'
            room = self._rooms.get(mid)
            if not room or cid not in room:
                return False, 'not_in_room'
            st = room[cid]
            ox, oy = float(st['x']), float(st['y'])
            move_distance = math.hypot(float(x) - ox, float(y) - oy)
            if move_distance > _MAX_STEP_PX:
                return False, 'step_too_far'
            st['x'] = float(x)
            st['y'] = float(y)
            st['facing'] = facing or st.get('facing', 'down')
            st['moving'] = bool(moving)
            st['updated_at'] = time.time()
            sp_out = int(st.get('Sprite', 0))
            rn_out = str(st.get('role_name', '') or '')

        msg = {
            'type': 'world_player_move',
            'character_id': character_id,
            'map_id': map_id,
            'position': {'x': float(x), 'y': float(y)},
            'facing': facing or 'down',
            'moving': bool(moving),
            # 供客户端「只收到 move、未收到 join」时懒创建形象
            'Sprite': sp_out,
            'role_name': rn_out,
        }
        await self._broadcast_to_map(map_id, websocket, msg)
        self._maybe_schedule_db_save(character_id, map_id, float(x), float(y))
        return True, 'ok'

    def requires_fresh_collision(self, character_id: str) -> bool:
        """当前角色是否仍处于“需下一次碰撞后才可触发战斗”的门禁状态。"""
        if not character_id:
            return False
        return str(character_id) in self._need_fresh_collision

    def consume_fresh_collision_gate(self, character_id: str) -> bool:
        """
        消耗“需再次碰撞”门禁：
        - True: 本次碰撞应被拦截（并已清除门禁，下一次真实碰撞可触发战斗）
        - False: 当前无门禁，可正常触发
        """
        if not character_id:
            return False
        cid = str(character_id)
        if cid in self._need_fresh_collision:
            self._need_fresh_collision.discard(cid)
            return True
        return False

    async def leave_map(self, websocket, character_id: str, map_id: int) -> None:
        snap: Optional[Tuple[int, float, float]] = None
        cid_out: Optional[str] = None
        async with self._ensure_lock():
            pair = self._ws_index.get(id(websocket))
            if not pair:
                return
            mid, cid = pair
            if cid != character_id or mid != map_id:
                return
            room = self._rooms.get(mid)
            st = room.get(cid) if room else None
            if st:
                snap = (int(st.get('map_id', mid)), float(st['x']), float(st['y']))
            cid_out = cid
            self._ws_index.pop(id(websocket), None)
            self._remove_character_from_map_locked(mid, cid)
        await self._broadcast_to_map(map_id, websocket, {'type': 'world_player_leave', 'character_id': character_id, 'reason': 'leave'})
        if snap and cid_out:
            smid, sx, sy = snap
            self._save_position_immediate(cid_out, smid, sx, sy)

    def _public_view(self, st: dict) -> dict:
        mid = int(st.get('map_id', 1))
        return {
            'character_id': st['character_id'],
            'user_id': st.get('user_id', ''),
            'role_name': st.get('role_name', ''),
            'Sprite': int(st.get('Sprite', 0)),
            'position': {'x': float(st['x']), 'y': float(st['y']), 'map_id': mid},
            'facing': st.get('facing', 'down'),
            'moving': bool(st.get('moving', False)),
        }

    def _save_position_immediate(self, character_id: str, map_id: int, x: float, y: float) -> None:
        """离场/断线：立即写库，避免只靠节流导致最后一次坐标丢失。"""
        try:
            asyncio.create_task(self._save_position_task(character_id, map_id, x, y))
        except Exception:
            pass

    def _maybe_schedule_db_save(self, character_id: str, map_id: int, x: float, y: float) -> None:
        now = time.time()
        last = self._last_db_save.get(character_id, 0)
        if now - last < 2.0:
            return
        self._last_db_save[character_id] = now
        try:
            asyncio.create_task(self._save_position_task(character_id, map_id, x, y))
        except Exception:
            pass

    async def _save_position_task(self, character_id: str, map_id: int, x: float, y: float) -> None:
        try:
            import datetime
            from handlers import utils

            mid = int(map_id)
            sx = float(x)
            sy = float(y)
            if mid == 1 and abs(sx) < 0.5 and abs(sy) < 0.5:
                sx, sy = 120.0, -24.0

            pos = {
                'map_id': mid,
                'x': sx,
                'y': sy,
                'updated_at': datetime.datetime.utcnow(),
            }

            def _op():
                return utils.players_col.update_one({'character_id': character_id}, {'$set': {'position': pos}})

            await utils.async_mongo_operation(_op, timeout=2.0)
        except Exception as e:
            print(f'[world_presence] DB save position failed: {e}')


world_presence_service = WorldPresenceService()
