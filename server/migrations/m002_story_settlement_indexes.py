"""
m002: 剧情战斗结算账本与 effect 幂等索引。
"""
from __future__ import annotations

from typing import Any, List

from .m001_core_indexes import _ensure_index


def run(db: Any, dry_run: bool = False) -> List[str]:
    lines: List[str] = []
    settlements = db["story_battle_settlements"]
    effects = db["story_effect_idempotency"]

    lines.extend(
        _ensure_index(
            settlements,
            [("character_id", 1), ("event_id", 1), ("room_id", 1)],
            dry_run,
            "story_battle_settlements.uk",
            unique=True,
            name="character_event_room_unique",
        )
    )
    lines.extend(
        _ensure_index(
            settlements,
            [("character_id", 1), ("status", 1)],
            dry_run,
            "story_battle_settlements.character_status",
        )
    )
    lines.extend(
        _ensure_index(
            effects,
            "effect_key",
            dry_run,
            "story_effect_idempotency.effect_key",
            unique=True,
            name="effect_key_unique",
        )
    )
    lines.extend(
        _ensure_index(
            effects,
            [("character_id", 1), ("event_id", 1), ("room_id", 1)],
            dry_run,
            "story_effect_idempotency.settlement",
        )
    )
    return lines
