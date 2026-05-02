"""
背包写操作幂等单测（不依赖 Mongo）：重复 request_id 应命中缓存。
"""
import asyncio
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.bag_mutation_idempotency import BagMutationIdempotency


class _FakeWs:
    def __init__(self):
        self.sent = []

    async def send(self, raw: str):
        self.sent.append(raw)


class BagMutationIdempotencyTests(unittest.TestCase):
    def test_replay_returns_same_payload(self):
        async def run():
            svc = BagMutationIdempotency(ttl=60.0, max_entries=100)
            ws = _FakeWs()
            data = {'request_id': 'rid-1'}
            ok, meta = await svc.prepare(ws, 'u1', 'bag_discard_item', data)
            self.assertTrue(ok)
            data['_bag_idem'] = meta
            resp = {
                'type': 'bag_discard_item_response',
                'success': True,
                'code': 200,
                'request_id': 'rid-1',
                'data': {'item_id': 1},
            }
            svc.complete_from_response(meta, resp)
            ws2 = _FakeWs()
            data2 = {'request_id': 'rid-1'}
            ok2, _ = await svc.prepare(ws2, 'u1', 'bag_discard_item', data2)
            self.assertFalse(ok2)
            self.assertEqual(len(ws2.sent), 1)
            replay = json.loads(ws2.sent[0])
            self.assertEqual(replay['data']['item_id'], 1)

        asyncio.run(run())


if __name__ == '__main__':
    unittest.main()
