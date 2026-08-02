"""
剧情战斗业务 Service：pending 校验、状态机、编排敌人生成。

本文件不得依赖任何 Handler 模块。
敌人生成实现见 story_battle_shared.generate_story_enemy。
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("game_server")

# pending_battle.status
STATUS_AUTHORIZED = "authorized"
STATUS_CREATING = "creating"
STATUS_IN_ROOM = "in_room"
STATUS_COMPLETED = "completed"
STATUS_CANCELLED = "cancelled"


@dataclass
class StoryBattlePreparation:
    pending: dict
    enemy: dict
    event_id: str
    battle_ref: str
    map_code: str


class StoryBattleError(Exception):
    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code


def validate_pending_story_battle(
    progress: Dict[str, Any],
    event_id: Optional[str],
    battle_ref: Optional[str] = None,
    *,
    require_battle_ref_match: bool = False,
    allow_statuses: Optional[Tuple[str, ...]] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """校验 progress.pending_battle 是否授权本次剧情战。"""
    if not event_id:
        return None, "缺少 event_id"
    pending = progress.get("pending_battle") or {}
    if not isinstance(pending, dict) or not pending:
        return None, "剧情战斗未授权，请先 story_interact"
    if pending.get("event_id") != event_id:
        return None, "剧情战斗未授权，请重新与 NPC 交互后再试"
    status = pending.get("status") or STATUS_AUTHORIZED
    allowed = allow_statuses or (STATUS_AUTHORIZED, STATUS_CREATING, STATUS_IN_ROOM)
    if status not in allowed:
        return None, f"剧情战斗状态不可用: {status}"
    if require_battle_ref_match:
        if not battle_ref:
            return None, "缺少 battle_ref"
        if pending.get("battle_ref") != battle_ref:
            return None, "战斗未授权，请先 story_interact"
    return pending, None


def make_authorized_pending(
    *,
    event_id: str,
    battle_ref: str,
    map_code: str,
    npc_uid: Any = None,
) -> Dict[str, Any]:
    return {
        "event_id": event_id,
        "battle_ref": battle_ref,
        "map_code": map_code,
        "status": STATUS_AUTHORIZED,
        "room_id": None,
        "request_id": None,
        "npc_uid": npc_uid,
        "updated_at": time.time(),
    }


async def transition_pending_to_creating(
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
    request_id: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    authorized → creating（角色锁内调用）。
    TODO(db-atomic): 升级为 Mongo find_one_and_update 条件更新，跨进程安全。
    """
    from services.story_service import get_or_create_progress, save_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending, err = validate_pending_story_battle(
        progress, event_id, allow_statuses=(STATUS_AUTHORIZED, STATUS_CREATING)
    )
    if err:
        return None, err
    assert pending is not None
    if pending.get("status") == STATUS_CREATING:
        if request_id and pending.get("request_id") and pending.get("request_id") != request_id:
            return None, "剧情战斗创建中，请勿重复请求"
        return pending, None
    pending["status"] = STATUS_CREATING
    pending["request_id"] = request_id
    pending["updated_at"] = time.time()
    if not pending.get("map_code"):
        pending["map_code"] = map_code
    progress["pending_battle"] = pending
    await save_progress(progress)
    return pending, None


async def transition_pending_to_in_room(
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
    room_id: str,
) -> None:
    from services.story_service import get_or_create_progress, save_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending = progress.get("pending_battle") or {}
    if pending.get("event_id") != event_id:
        return
    pending["status"] = STATUS_IN_ROOM
    pending["room_id"] = room_id
    pending["updated_at"] = time.time()
    progress["pending_battle"] = pending
    await save_progress(progress)


async def rollback_pending_to_authorized(
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
) -> None:
    """creating → authorized（创建异常回滚）"""
    from services.story_service import get_or_create_progress, save_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending = progress.get("pending_battle") or {}
    if pending.get("event_id") != event_id:
        return
    if pending.get("status") != STATUS_CREATING:
        return
    pending["status"] = STATUS_AUTHORIZED
    pending["room_id"] = None
    pending["request_id"] = None
    pending["updated_at"] = time.time()
    progress["pending_battle"] = pending
    await save_progress(progress)


async def mark_pending_completed_or_clear(
    user_id,
    character_id: str,
    map_code: str,
    event_id: Optional[str] = None,
    *,
    clear: bool = True,
) -> None:
    from services.story_service import get_or_create_progress, save_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending = progress.get("pending_battle") or {}
    if event_id and pending.get("event_id") != event_id:
        return
    if clear:
        progress["pending_battle"] = None
    else:
        pending["status"] = STATUS_COMPLETED
        pending["updated_at"] = time.time()
        progress["pending_battle"] = pending
    await save_progress(progress)


async def prepare_story_battle(
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
    battle_ref: str | None,
    player_pet_id: str | None,
    *,
    require_battle_ref_match: bool = False,
    request_id: str | None = None,
    mark_creating: bool = True,
) -> StoryBattlePreparation:
    """
    读取并校验 pending、校验 event/battle_ref、生成敌人快照。
    成功且 mark_creating 时将 pending 置为 creating。
    """
    from services.story_service import get_or_create_progress
    from services.story_battle_shared import generate_story_enemy

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending, err = validate_pending_story_battle(
        progress,
        event_id,
        battle_ref,
        require_battle_ref_match=require_battle_ref_match,
        allow_statuses=(STATUS_AUTHORIZED, STATUS_CREATING),
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
        raise StoryBattleError(err, code=400)

    ref = battle_ref or (pending or {}).get("battle_ref")
    if not ref:
        raise StoryBattleError("缺少 battle_ref", code=400)

    if mark_creating:
        pending, terr = await transition_pending_to_creating(
            user_id, str(character_id), map_code, event_id, request_id=request_id
        )
        if terr:
            raise StoryBattleError(terr, code=400)

    enemy_obj, gen_err = await generate_story_enemy(
        user_id, str(character_id), str(ref), player_pet_id
    )
    if gen_err:
        if mark_creating:
            await rollback_pending_to_authorized(user_id, str(character_id), map_code, event_id)
        raise StoryBattleError(gen_err, code=500)

    return StoryBattlePreparation(
        pending=pending or {},
        enemy=enemy_obj,
        event_id=str(event_id),
        battle_ref=str(ref),
        map_code=map_code or "test_base",
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
    request_id: Optional[str] = None,
    mark_creating: bool = True,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[str]]:
    """兼容旧调用约定：(pending, enemy, error_message)"""
    if not event_id:
        return None, None, "缺少 event_id"
    try:
        prep = await prepare_story_battle(
            user_id,
            str(character_id),
            map_code or "test_base",
            str(event_id),
            battle_ref,
            player_pet_id,
            require_battle_ref_match=require_battle_ref_match,
            request_id=request_id,
            mark_creating=mark_creating,
        )
        return prep.pending, prep.enemy, None
    except StoryBattleError as e:
        return None, None, e.message
