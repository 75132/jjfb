"""
剧情战斗共享：pending 校验与敌人生成（供 battle_room_create / story_battle_start 共用）
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

from bson import ObjectId

logger = logging.getLogger("game_server")


def validate_pending_story_battle(
    progress: Dict[str, Any],
    event_id: Optional[str],
    battle_ref: Optional[str] = None,
    *,
    require_battle_ref_match: bool = False,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    校验 progress.pending_battle 是否授权本次剧情战。

    Returns:
        (pending, error_message) — 成功时 error_message 为 None
    """
    if not event_id:
        return None, "缺少 event_id"
    pending = progress.get("pending_battle") or {}
    if not isinstance(pending, dict) or not pending:
        return None, "剧情战斗未授权，请先 story_interact"
    if pending.get("event_id") != event_id:
        return None, "剧情战斗未授权，请重新与 NPC 交互后再试"
    if require_battle_ref_match:
        if not battle_ref:
            return None, "缺少 battle_ref"
        if pending.get("battle_ref") != battle_ref:
            return None, "战斗未授权，请先 story_interact"
    return pending, None


async def generate_story_enemy(
    user_id,
    character_id: str,
    battle_ref: str,
    player_pet_id=None,
):
    """生成剧情敌方快照；唯一实现入口（委托 story_handler._generate_story_enemy）。"""
    from handlers import story_handler

    return await story_handler._generate_story_enemy(
        user_id, character_id, battle_ref, player_pet_id
    )


async def consume_or_validate_pending_battle(
    user_id,
    character_id: str,
    map_code: str,
    event_id: Optional[str],
    *,
    battle_ref: Optional[str] = None,
    require_battle_ref_match: bool = False,
    player_pet_id=None,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[str]]:
    """
    拉取进度、校验 pending，并生成敌方。

    Returns:
        (pending, enemy_obj, error_message)
    """
    from services.story_service import get_or_create_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending, err = validate_pending_story_battle(
        progress,
        event_id,
        battle_ref,
        require_battle_ref_match=require_battle_ref_match,
    )
    if err:
        logger.warning(
            "剧情战斗未授权 | cid=%s map=%s want_event=%s want_ref=%s pending=%s err=%s",
            character_id,
            map_code,
            event_id,
            battle_ref,
            progress.get("pending_battle"),
            err,
        )
        return None, None, err

    ref = battle_ref or (pending or {}).get("battle_ref")
    if not ref:
        return None, None, "缺少 battle_ref"

    enemy_obj, gen_err = await generate_story_enemy(
        user_id, str(character_id), str(ref), player_pet_id
    )
    if gen_err:
        return pending, None, gen_err
    return pending, enemy_obj, None
