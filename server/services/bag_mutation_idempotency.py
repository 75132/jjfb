"""
背包写操作幂等：复合键 user_id + request_id，缓存完整响应体供重放。
与 utils.send_response 协作：request_data['_bag_idem'] 存在时在完成发送前写入缓存。
"""
from __future__ import annotations

import os
import time
import asyncio
from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

DEFAULT_TTL = float(os.getenv('BAG_MUTATION_IDEMPOTENCY_TTL', '3600'))
MAX_ENTRIES = int(os.getenv('BAG_MUTATION_IDEMPOTENCY_MAX', '20000'))


def _make_key(user_id: Any, request_id: str) -> str:
    return f"{user_id}:{request_id}"


class BagMutationIdempotency:
    def __init__(self, ttl: float = DEFAULT_TTL, max_entries: int = MAX_ENTRIES):
        self.ttl = ttl
        self.max_entries = max_entries
        # key -> (response_dict, ts)
        self._done: OrderedDict[str, Tuple[Dict[str, Any], float]] = OrderedDict()
        self._inflight: set[str] = set()
        self._locks: Dict[str, asyncio.Lock] = {}

    def _trim(self) -> None:
        now = time.time()
        # expire
        dead = [k for k, (_, ts) in self._done.items() if now - ts > self.ttl]
        for k in dead:
            self._done.pop(k, None)
        while len(self._done) > self.max_entries:
            self._done.popitem(last=False)

    def _lock_for(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def prepare(
        self,
        websocket,
        user_id: Any,
        route: str,
        data: Dict[str, Any],
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Returns:
            (False, None) — 已处理完（重放或错误），handler 应 return
            (True, meta) — 可继续执行业务；meta 需挂到 request_data['_bag_idem']
        """
        request_id = data.get('request_id')
        if not request_id:
            from handlers import utils
            await utils.send_error_response(
                websocket,
                route,
                '缺少 request_id',
                code=400,
                request_data=data,
                error_code='BAG_MISSING_REQUEST_ID',
            )
            return False, None

        key = _make_key(user_id, str(request_id))
        self._trim()

        async with self._lock_for(key):
            now = time.time()
            if key in self._done:
                payload, ts = self._done[key]
                if now - ts <= self.ttl:
                    self._done.move_to_end(key)
                    try:
                        import json
                        await websocket.send(json.dumps(payload, default=str))
                    except Exception:
                        pass
                    return False, None
                self._done.pop(key, None)

            if key in self._inflight:
                try:
                    import json
                    busy = {
                        'type': f'{route}_response',
                        'success': False,
                        'code': 425,
                        'message': '请求处理中，请稍后重试',
                        'error_code': 'BAG_MUTATION_IN_FLIGHT',
                        'request_id': request_id,
                    }
                    await websocket.send(json.dumps(busy, default=str))
                except Exception:
                    pass
                return False, None

            self._inflight.add(key)

        meta = {'key': key, 'request_id': str(request_id)}
        return True, meta

    def abandon(self, meta: Optional[Dict[str, Any]]) -> None:
        if not meta or 'key' not in meta:
            return
        key = meta['key']
        self._inflight.discard(key)

    def complete_from_response(self, meta: Optional[Dict[str, Any]], response: Dict[str, Any]) -> None:
        if not meta or 'key' not in meta:
            return
        key = meta['key']
        self._inflight.discard(key)
        # 深拷贝避免后续修改
        import copy
        self._done[key] = (copy.deepcopy(response), time.time())
        self._done.move_to_end(key)
        self._trim()


bag_mutation_idempotency = BagMutationIdempotency()
