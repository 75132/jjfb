"""
剧情 WebSocket 处理器
"""
from . import utils
from services.story_service import (
    get_or_create_progress,
    load_map_config,
    interact,
    complete_event,
    build_state_payload,
    reset_progress,
    clear_story_progress_for_character,
)
from services.idempotency_service import idempotency_service


async def _resolve_user_character(websocket, data, current_user_id, current_character_id):
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=data.get("token"))
    if not user:
        await utils.send_error_response(websocket, data.get("type", "story"), "未登录", code=401, request_data=data)
        return None, None, None
    cid = data.get("character_id") or current_character_id
    if not cid:
        await utils.send_error_response(websocket, data.get("type", "story"), "未选择角色", code=400, request_data=data)
        return None, None, None
    return user, user["_id"], cid


async def handle_story_get_state(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve_user_character(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    map_code = data.get("map_code") or "test_base"
    progress = await get_or_create_progress(uid, cid, map_code)
    map_cfg = load_map_config(map_code) or {}
    payload = build_state_payload(progress, map_cfg)
    await utils.send_success_response(websocket, "story_get_state", data=payload, request_data=data)
    return current_user_id, current_character_id


async def handle_story_interact(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve_user_character(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    map_code = data.get("map_code") or "test_base"
    event_id = data.get("event_id")
    if not event_id:
        await utils.send_error_response(websocket, "story_interact", "缺少 event_id", code=400, request_data=data)
        return current_user_id, current_character_id
    choice_id = data.get("choice_id")
    ok, msg, payload = await interact(uid, cid, map_code, event_id, choice_id=choice_id)
    if not ok:
        await utils.send_error_response(websocket, "story_interact", msg, code=400, request_data=data)
        return current_user_id, current_character_id
    await utils.send_success_response(websocket, "story_interact", data=payload, request_data=data)
    return current_user_id, current_character_id


async def handle_story_event_complete(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve_user_character(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    map_code = data.get("map_code") or "test_base"
    event_id = data.get("event_id")
    if not event_id:
        await utils.send_error_response(websocket, "story_event_complete", "缺少 event_id", code=400, request_data=data)
        return current_user_id, current_character_id

    request_id = data.get("request_id")
    if request_id:
        cached = idempotency_service.get_result(str(request_id))
        if cached:
            await utils.send_direct_response(websocket, cached, request_data=data)
            return current_user_id, current_character_id

    # DEPRECATED: battle_won 无权威意义，仅兼容旧客户端；战斗事件委托 finalize 校验房间结果
    battle_won = data.get("battle_won", True)
    if isinstance(battle_won, str):
        battle_won = battle_won.lower() in ("1", "true", "yes")
    choice_id = data.get("choice_id")
    room_id = data.get("room_id")
    ok, msg, payload = await complete_event(
        uid,
        cid,
        map_code,
        event_id,
        battle_won=battle_won,
        choice_id=choice_id,
        room_id=room_id,
    )
    if not ok:
        await utils.send_error_response(websocket, "story_event_complete", msg, code=400, request_data=data)
        return current_user_id, current_character_id

    response = {
        "type": "story_event_complete_response",
        "success": True,
        "data": payload,
    }
    if msg:
        response["message"] = msg
    if request_id:
        idempotency_service.mark_processed(str(request_id), response)
    await utils.send_direct_response(websocket, response, request_data=data)
    return current_user_id, current_character_id


async def handle_story_battle_finalize(websocket, data, current_user_id, current_character_id):
    """权威剧情战斗结算：不接受客户端 battle_won。"""
    user, uid, cid = await _resolve_user_character(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    map_code = data.get("map_code") or "test_base"
    event_id = data.get("event_id")
    room_id = data.get("room_id")
    if not event_id:
        await utils.send_error_response(websocket, "story_battle_finalize", "缺少 event_id", code=400, request_data=data)
        return current_user_id, current_character_id
    if not room_id:
        await utils.send_error_response(websocket, "story_battle_finalize", "缺少 room_id", code=400, request_data=data)
        return current_user_id, current_character_id

    request_id = data.get("request_id")
    if request_id:
        cached = idempotency_service.get_result(str(request_id))
        if cached:
            await utils.send_direct_response(websocket, cached, request_data=data)
            return current_user_id, current_character_id

    from services.story_battle_service import finalize_story_battle

    ok, msg, payload = await finalize_story_battle(
        user_id=uid,
        character_id=str(cid),
        map_code=map_code,
        event_id=str(event_id),
        room_id=str(room_id),
        request_id=str(request_id) if request_id else None,
        choice_id=data.get("choice_id"),
        trace_id=str(data.get("trace_id") or request_id or ""),
    )
    if not ok:
        await utils.send_error_response(websocket, "story_battle_finalize", msg, code=400, request_data=data)
        return current_user_id, current_character_id

    response = {
        "type": "story_battle_finalize_response",
        "success": True,
        "data": payload,
    }
    if msg:
        response["message"] = msg
    if request_id:
        idempotency_service.mark_processed(str(request_id), response)
    await utils.send_direct_response(websocket, response, request_data=data)
    return current_user_id, current_character_id


async def _generate_story_enemy(user_id, character_id: str, battle_ref: str, player_pet_id=None):
    """兼容旧调用；实现已迁至 story_battle_shared.generate_story_enemy。"""
    from services.story_battle_shared import generate_story_enemy

    return await generate_story_enemy(user_id, character_id, battle_ref, player_pet_id)


async def handle_story_battle_start(websocket, data, current_user_id, current_character_id):
    """
    DEPRECATED: 客户端剧情战应走 story_interact → battle_room_create(story_event_id)。
    本路由保留兼容，内部使用 story_battle_service 同一套 pending 校验与敌人生成。
    """
    import logging
    logging.getLogger("game_server").warning(
        "[DEPRECATED] story_battle_start called; prefer battle_room_create with story_event_id"
    )

    user, uid, cid = await _resolve_user_character(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    map_code = data.get("map_code") or "test_base"
    event_id = data.get("event_id")
    battle_ref = data.get("battle_ref")
    if not event_id or not battle_ref:
        await utils.send_error_response(websocket, "story_battle_start", "缺少 event_id 或 battle_ref", code=400, request_data=data)
        return current_user_id, current_character_id

    from services.story_battle_service import consume_or_validate_pending_battle

    _pending, enemy, err = await consume_or_validate_pending_battle(
        uid,
        cid,
        map_code,
        event_id,
        battle_ref=battle_ref,
        require_battle_ref_match=True,
        player_pet_id=data.get("player_pet_id"),
        mark_creating=False,
    )
    if err:
        code = 400 if ("未授权" in err or "缺少" in err) else 500
        await utils.send_error_response(websocket, "story_battle_start", err, code=code, request_data=data)
        return current_user_id, current_character_id

    await utils.send_success_response(
        websocket,
        "story_battle_start",
        data={"enemy": enemy, "event_id": event_id, "battle_ref": battle_ref, "deprecated": True},
        request_data=data,
    )
    return current_user_id, current_character_id


async def handle_admin_reset_story(websocket, data):
    character_id = data.get("character_id")
    map_code = data.get("map_code") or "test_base"
    if not character_id:
        await utils.send_error_response(websocket, "admin_reset_story", "缺少 character_id", code=400, request_data=data)
        return
    ok = await reset_progress(character_id, map_code)
    await utils.send_success_response(
        websocket,
        "admin_reset_story",
        data={"reset": ok, "character_id": character_id, "map_code": map_code},
        request_data=data,
    )


async def handle_admin_complete_story_task(websocket, data):
    from services.story_service import save_progress, load_map_config, apply_effects

    character_id = data.get("character_id")
    map_code = data.get("map_code") or "test_base"
    task_id = data.get("task_id")
    if not character_id or task_id is None:
        await utils.send_error_response(websocket, "admin_complete_story_task", "缺少参数", code=400, request_data=data)
        return
    player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({"character_id": character_id}))
    if not player:
        await utils.send_error_response(websocket, "admin_complete_story_task", "角色不存在", code=404, request_data=data)
        return
    uid = player["user_id"]
    progress = await get_or_create_progress(uid, character_id, map_code)
    map_cfg = load_map_config(map_code) or {}
    applied = await apply_effects(
        uid,
        character_id,
        progress,
        map_cfg,
        [{"action": "task_complete", "taskId": int(task_id)}],
    )
    await save_progress(progress)
    await utils.send_success_response(
        websocket,
        "admin_complete_story_task",
        data={"applied": applied, "state": build_state_payload(progress, map_cfg)},
        request_data=data,
    )
