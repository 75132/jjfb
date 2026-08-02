# -*- coding: utf-8 -*-
"""剧情结算测试共用：注入 Fake Mongo 账本集合。"""
from __future__ import annotations

from tests.fake_mongo import FakeMongoCollection


def install_fake_settlement_ledger():
    """
    创建共享 Fake 集合并 init ledger。
    返回 (settlements_col, effects_col)；跨「重启」= 新进程逻辑但复用这两集合。
    """
    from services.story_settlement_ledger import reset_ledger_cols_for_tests

    settlements = FakeMongoCollection(
        "story_battle_settlements",
        unique_keys=[("character_id", "event_id", "room_id")],
    )
    settlements.create_index(
        [("character_id", 1), ("event_id", 1), ("room_id", 1)],
        unique=True,
        name="character_event_room_unique",
    )
    effects = FakeMongoCollection(
        "story_effect_idempotency",
        unique_keys=[("effect_key",)],
    )
    effects.create_index("effect_key", unique=True, name="effect_key_unique")
    reset_ledger_cols_for_tests(settlements, effects)
    return settlements, effects


def simulate_service_restart(settlements, effects):
    """清空内存缓存并重新挂载同一 Fake 集合，模拟服务重启。"""
    from services.story_settlement_ledger import reset_ledger_cols_for_tests

    reset_ledger_cols_for_tests(settlements, effects)
