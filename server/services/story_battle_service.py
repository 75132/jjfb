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
STATUS_BATTLE_FINISHED = "battle_finished"
STATUS_BATTLE_FAILED = "battle_failed"
STATUS_COMPLETING = "completing"
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
        "battle_result": None,
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


def _settlement_key(character_id: str, event_id: str, room_id: str) -> Tuple[str, str, str]:
    return (str(character_id), str(event_id), str(room_id))


def get_settlement_ledger_entry(character_id: str, event_id: str, room_id: str) -> Optional[Dict[str, Any]]:
    """同步读短时缓存；权威读取请用 story_settlement_ledger.find_settlement。"""
    from services.story_settlement_ledger import _cache_get

    return _cache_get(str(character_id), str(event_id), str(room_id))


def clear_settlement_ledger_for_tests() -> None:
    """兼容旧测试名：仅清内存缓存。权威 FakeCollection 由测试自行重置。"""
    from services.story_settlement_ledger import clear_settlement_cache_for_tests

    clear_settlement_cache_for_tests()


def build_pending_story_settlement(progress: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """供 story_get_state：战斗已胜但尚未 finalize 时提示客户端自动结算。"""
    pending = progress.get("pending_battle") or {}
    if not isinstance(pending, dict):
        return None
    status = pending.get("status")
    if status in (STATUS_BATTLE_FINISHED, STATUS_COMPLETING):
        room_id = pending.get("room_id")
        event_id = pending.get("event_id")
        if room_id and event_id:
            return {
                "required": True,
                "room_id": str(room_id),
                "event_id": str(event_id),
                "status": status,
            }
    return None


async def record_story_battle_result(
    *,
    character_id: str,
    room: dict,
    user_id=None,
) -> None:
    """
    战斗房间变为 finished 时由服务端更新 pending（不依赖客户端 battle_result）。
    幂等：已为 battle_finished/battle_failed/completing/completed 且同 room 时不改结果。
    """
    if not room or room.get("mode") == "pvp":
        return
    ctx = room.get("story_context")
    if not isinstance(ctx, dict) or not ctx.get("event_id"):
        return  # 普通 PVE

    from services.story_service import get_or_create_progress, save_progress

    map_code = str(ctx.get("map_code") or "test_base")
    event_id = str(ctx["event_id"])
    battle_ref = str(ctx.get("battle_ref") or "")
    room_id = str(room.get("room_id") or "")
    cid = str(character_id)
    uid = user_id or room.get("user_id")

    progress = await get_or_create_progress(uid, cid, map_code)
    pending = progress.get("pending_battle") or {}
    if not isinstance(pending, dict) or pending.get("event_id") != event_id:
        logger.warning(
            "record_story_battle_result skip: pending mismatch | cid=%s event=%s pending=%s",
            cid,
            event_id,
            pending,
        )
        return

    # 幂等：已记录同房间结果则不改写
    existing_status = pending.get("status")
    if existing_status in (
        STATUS_BATTLE_FINISHED,
        STATUS_BATTLE_FAILED,
        STATUS_COMPLETING,
        STATUS_COMPLETED,
    ):
        if str(pending.get("room_id") or "") == room_id:
            return

    result = room.get("result") or {}
    winner = result.get("winner")
    reason = result.get("reason") or "ko"
    finished_at = time.time()
    battle_result = {"winner": winner, "reason": reason, "finished_at": finished_at}

    if winner == "player":
        pending["status"] = STATUS_BATTLE_FINISHED
    else:
        pending["status"] = STATUS_BATTLE_FAILED

    pending["room_id"] = room_id
    pending["battle_result"] = battle_result
    pending["battle_ref"] = pending.get("battle_ref") or battle_ref
    pending["map_code"] = pending.get("map_code") or map_code
    pending["updated_at"] = finished_at
    progress["pending_battle"] = pending
    await save_progress(progress)
    logger.info(
        "record_story_battle_result | cid=%s room=%s status=%s winner=%s",
        cid,
        room_id,
        pending["status"],
        winner,
    )


async def reauthorize_failed_battle(
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
) -> None:
    """失败后允许再次 story_interact：将 battle_failed 清掉以便重新 authorized。"""
    from services.story_service import get_or_create_progress, save_progress

    progress = await get_or_create_progress(user_id, str(character_id), map_code or "test_base")
    pending = progress.get("pending_battle") or {}
    if pending.get("event_id") == event_id and pending.get("status") == STATUS_BATTLE_FAILED:
        progress["pending_battle"] = None
        await save_progress(progress)


async def finalize_story_battle(
    *,
    user_id,
    character_id: str,
    map_code: str,
    event_id: str,
    room_id: str,
    request_id: Optional[str] = None,
    choice_id: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> Tuple[bool, str, dict]:
    """
    权威剧情战斗结算（MongoDB 账本）。

    顺序：
      验证 room/pending
      → 原子创建或读取 settlement
      → processing
      → 逐条带幂等键的 effects
      → effects_applied
      → completed_event_ids + 清 pending + save_progress
      → completed
    """
    from services.battle_room_service import battle_room_service
    from services.story_service import (
        _choice_completes_event,
        _event_completed,
        _find_event,
        apply_effects,
        build_state_payload,
        check_requirements,
        get_or_create_progress,
        load_map_config,
        save_progress,
    )
    from services import story_settlement_ledger as ledger

    cid = str(character_id)
    map_code = map_code or "test_base"
    event_id = str(event_id)
    room_id = str(room_id)
    tid = str(trace_id or request_id or f"finalize:{cid}:{event_id}:{room_id}")

    def _log(msg: str, **extra):
        logger.info(
            "story_battle_finalize | %s | trace=%s req=%s cid=%s map=%s event=%s room=%s %s",
            msg,
            tid,
            request_id,
            cid,
            map_code,
            event_id,
            room_id,
            " ".join(f"{k}={v}" for k, v in extra.items()),
        )

    map_cfg = load_map_config(map_code)
    if not map_cfg:
        return False, f"未知地图 {map_code}", {}
    found = _find_event(map_cfg, event_id)
    if not found:
        return False, f"未知事件 {event_id}", {}
    _npc, ev, npc_uid = found
    if ev.get("eventType") != "battle":
        return False, "非战斗事件请使用 story_event_complete", {}

    # 已有 completed 账本：幂等回放（跨重启）
    existing = await ledger.find_settlement(cid, event_id, room_id)
    if existing and existing.get("status") == ledger.STATUS_COMPLETED:
        progress = await get_or_create_progress(user_id, cid, map_code)
        _log("idempotent_replay", settlement_status="completed", idempotent_replay=True)
        payload = {
            **build_state_payload(progress, map_cfg),
            "applied_effects": list(existing.get("applied_effects") or []),
            "authoritative_battle_verified": True,
            "room_id": room_id,
            "idempotent_replay": True,
            "settlement_status": ledger.STATUS_COMPLETED,
            "trace_id": tid,
        }
        return True, "idempotent_replay", payload

    progress = await get_or_create_progress(user_id, cid, map_code)
    if _event_completed(progress, event_id):
        # 进度已完成但账本可能未写 completed：尽量补齐
        if existing and existing.get("status") == ledger.STATUS_EFFECTS_APPLIED:
            await ledger.mark_completed(
                cid, event_id, room_id, existing.get("applied_effects") or []
            )
        payload = {
            **build_state_payload(progress, map_cfg),
            "authoritative_battle_verified": True,
            "room_id": room_id,
            "idempotent_replay": True,
            "settlement_status": (existing or {}).get("status") or "already_completed",
            "trace_id": tid,
        }
        return True, "already_completed", payload

    pending = progress.get("pending_battle") or {}
    if not isinstance(pending, dict) or not pending:
        return False, "剧情战斗未授权或已失效", {}
    if pending.get("event_id") != event_id:
        return False, "event_id 与 pending 不匹配", {}
    if str(pending.get("room_id") or "") != room_id:
        return False, "room_id 与 pending 不匹配", {}

    status = pending.get("status")
    if status not in (STATUS_BATTLE_FINISHED, STATUS_COMPLETING, STATUS_COMPLETED):
        if status == STATUS_BATTLE_FAILED:
            return False, "战斗失败，不可结算奖励", {}
        return False, f"pending 状态不可结算: {status}", {}

    battle_ref = pending.get("battle_ref") or ""
    room = battle_room_service.get_room_by_id(room_id)
    if not room:
        return False, "找不到战斗房间", {}
    if str(room.get("character_id") or "") != cid:
        return False, "角色与房间不匹配", {}
    if room.get("status") != "finished":
        return False, "战斗尚未结束", {}
    result = room.get("result") or {}
    if result.get("winner") != "player":
        return False, "仅胜利方可结算剧情奖励", {}

    ctx = room.get("story_context") or {}
    if not isinstance(ctx, dict):
        return False, "房间缺少 story_context", {}
    if str(ctx.get("map_code") or "") != str(map_code):
        return False, "map_code 与房间不一致", {}
    if str(ctx.get("event_id") or "") != event_id:
        return False, "event_id 与房间不一致", {}
    if pending.get("battle_ref") and ctx.get("battle_ref") and str(pending.get("battle_ref")) != str(ctx.get("battle_ref")):
        return False, "battle_ref 与房间不一致", {}
    battle_ref = battle_ref or ctx.get("battle_ref") or ""

    # battle_finished → completing
    if pending.get("status") == STATUS_BATTLE_FINISHED:
        pending["status"] = STATUS_COMPLETING
        pending["updated_at"] = time.time()
        if request_id:
            pending["request_id"] = request_id
        progress["pending_battle"] = pending
        await save_progress(progress)

    server = ev.get("server") or {}
    # 先做可重复的前置校验，避免 choice_blocked 留下 processing 账本
    existing_for_skip = await ledger.find_settlement(cid, event_id, room_id)
    already_effects = existing_for_skip and existing_for_skip.get("status") in (
        ledger.STATUS_EFFECTS_APPLIED,
        ledger.STATUS_COMPLETED,
    )
    if not already_effects:
        ok, msg = await check_requirements(
            user_id, cid, progress, server.get("requirements") or []
        )
        if not ok:
            # 回滚 completing
            try:
                progress = await get_or_create_progress(user_id, cid, map_code)
                pending = progress.get("pending_battle") or {}
                if isinstance(pending, dict) and pending.get("status") == STATUS_COMPLETING:
                    pending["status"] = STATUS_BATTLE_FINISHED
                    pending["updated_at"] = time.time()
                    progress["pending_battle"] = pending
                    await save_progress(progress)
            except Exception:
                pass
            return False, msg, {}

        can_complete, choice_msg = _choice_completes_event(map_cfg, ev, choice_id)
        if not can_complete:
            pending["status"] = STATUS_BATTLE_FINISHED
            pending["updated_at"] = time.time()
            progress["pending_battle"] = pending
            await save_progress(progress)
            if choice_msg:
                return False, choice_msg, {}
            return True, "choice_blocked", {
                **build_state_payload(progress, map_cfg),
                "trace_id": tid,
            }

    settlement, action = await ledger.claim_or_get_settlement(
        character_id=cid,
        event_id=event_id,
        room_id=room_id,
        map_code=map_code,
        request_id=request_id,
        trace_id=tid,
    )
    _log(
        "settlement_claim",
        settlement_status=settlement.get("status"),
        action=action,
        battle_ref=battle_ref,
    )

    if action == "replay_completed":
        progress = await get_or_create_progress(user_id, cid, map_code)
        payload = {
            **build_state_payload(progress, map_cfg),
            "applied_effects": list(settlement.get("applied_effects") or []),
            "authoritative_battle_verified": True,
            "room_id": room_id,
            "idempotent_replay": True,
            "settlement_status": ledger.STATUS_COMPLETED,
            "trace_id": tid,
        }
        return True, "idempotent_replay", payload

    if action == "processing_in_flight":
        return False, "结算处理中，请稍候重试", {
            "settlement_status": ledger.STATUS_PROCESSING,
            "room_id": room_id,
            "trace_id": tid,
        }

    skip_effects = action == "resume_effects_applied" or settlement.get("status") == ledger.STATUS_EFFECTS_APPLIED
    applied: list = list(settlement.get("applied_effects") or [])

    try:
        if not skip_effects:
            applied = await apply_effects(
                user_id,
                cid,
                progress,
                map_cfg,
                server.get("effects") or [],
                choice_id=choice_id,
                effect_idempotency={
                    "character_id": cid,
                    "event_id": event_id,
                    "room_id": room_id,
                },
            )
            await ledger.mark_effects_applied(cid, event_id, room_id, applied)
            settlement = await ledger.find_settlement(cid, event_id, room_id) or settlement
            _log("effects_applied", effects=len(applied), idempotent_replay=False)
        else:
            # effects 已执行：复用结果，不再 apply
            if not applied:
                applied = await ledger.list_applied_effects_for_settlement(cid, event_id, room_id)
            _log("skip_effects_resume", effects=len(applied), settlement_status="effects_applied")

        # 写 completed_event_ids + 清 pending + 保存剧情进度
        progress = await get_or_create_progress(user_id, cid, map_code)
        completed = list(progress.get("completed_event_ids") or [])
        if event_id not in completed:
            completed.append(event_id)
        progress["completed_event_ids"] = completed
        progress["pending_battle"] = None

        await save_progress(progress)
        await ledger.mark_completed(cid, event_id, room_id, applied)
        _log("completed", effects=len(applied), idempotent_replay=False)

        payload = {
            **build_state_payload(progress, map_cfg),
            "applied_effects": applied,
            "npc_uid": npc_uid,
            "choice_id": choice_id,
            "authoritative_battle_verified": True,
            "room_id": room_id,
            "idempotent_replay": False,
            "settlement_status": ledger.STATUS_COMPLETED,
            "trace_id": tid,
        }
        return True, "", payload
    except Exception as e:
        logger.exception(
            "finalize_story_battle failed | trace=%s cid=%s room=%s err=%s",
            tid,
            cid,
            room_id,
            e,
        )
        entry = await ledger.find_settlement(cid, event_id, room_id)
        if entry and entry.get("status") == ledger.STATUS_COMPLETED:
            progress2 = await get_or_create_progress(user_id, cid, map_code)
            progress2["pending_battle"] = None
            try:
                await save_progress(progress2)
            except Exception:
                pass
            return True, "idempotent_replay", {
                **build_state_payload(progress2, map_cfg),
                "applied_effects": list(entry.get("applied_effects") or []),
                "authoritative_battle_verified": True,
                "room_id": room_id,
                "idempotent_replay": True,
                "settlement_status": ledger.STATUS_COMPLETED,
                "trace_id": tid,
            }
        if entry and entry.get("status") == ledger.STATUS_EFFECTS_APPLIED:
            # 进度保存失败：保持 effects_applied，不回滚奖励
            msg = e.message if isinstance(e, StoryBattleError) else str(e) or "剧情进度保存失败"
            return False, msg, {
                "settlement_status": ledger.STATUS_EFFECTS_APPLIED,
                "room_id": room_id,
                "trace_id": tid,
            }
        # processing 中失败：记录 error，不删除账本；回滚 pending 允许重试
        try:
            await ledger.mark_failed(
                cid, event_id, room_id, e.message if isinstance(e, StoryBattleError) else str(e)
            )
        except Exception:
            pass
        try:
            progress = await get_or_create_progress(user_id, cid, map_code)
            pending = progress.get("pending_battle") or {}
            if isinstance(pending, dict) and pending.get("status") == STATUS_COMPLETING:
                pending["status"] = STATUS_BATTLE_FINISHED
                pending["updated_at"] = time.time()
                progress["pending_battle"] = pending
                await save_progress(progress)
        except Exception:
            logger.exception("finalize rollback pending failed | cid=%s room=%s", cid, room_id)
        msg = e.message if isinstance(e, StoryBattleError) else str(e) or "剧情结算失败"
        return False, msg, {"settlement_status": (entry or {}).get("status"), "trace_id": tid}
