"""
剧情 WebSocket 处理器
"""
import random
from bson import ObjectId

from . import utils
from . import battle_handler
from .robot_upgrade import get_upgrade_manager
from . import equipment_handler
from services.story_service import (
    get_or_create_progress,
    load_map_config,
    interact,
    complete_event,
    build_state_payload,
    get_battle_ref_config,
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

    battle_won = data.get("battle_won", True)
    if isinstance(battle_won, str):
        battle_won = battle_won.lower() in ("1", "true", "yes")
    choice_id = data.get("choice_id")
    ok, msg, payload = await complete_event(uid, cid, map_code, event_id, battle_won=battle_won, choice_id=choice_id)
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


async def _generate_story_enemy(user_id, character_id: str, battle_ref: str, player_pet_id=None):
    ref_cfg = get_battle_ref_config(battle_ref) or {}
    base_level = 1
    if player_pet_id:
        try:
            pet = utils.safe_mongo_operation(
                lambda: utils.robotpet_col.find_one({"_id": ObjectId(player_pet_id), "user_id": user_id})
            )
            if pet:
                base_level = int(pet.get("Level", 1) or 1)
        except Exception:
            pass
    else:
        player = utils.safe_mongo_operation(
            lambda: utils.players_col.find_one({"user_id": user_id, "character_id": character_id})
        )
        if player:
            base_level = int(player.get("level", 1) or 1)

    fixed = ref_cfg.get("fixed_level")
    if ref_cfg.get("ignore_player_level"):
        lo = int(ref_cfg.get("level_min", 1) or 1)
        hi = int(ref_cfg.get("level_max", 10) or 10)
        if lo > hi:
            lo, hi = hi, lo
        level = random.randint(lo, hi)
    elif fixed is not None:
        level = int(fixed)
    else:
        offset = int(ref_cfg.get("level_offset", 0) or 0)
        level = max(1, base_level + offset)

    sample = utils.safe_mongo_operation(lambda: list(utils.robotbase_col.aggregate([{"$sample": {"size": 1}}])))
    if not sample:
        return None, "RobotBase集合为空"
    base_robot = sample[0]
    enemy_pet = {
        "RobotID": base_robot.get("RobotID", base_robot.get("id", 0)),
        "RobotName": ref_cfg.get("name") or base_robot.get("RobotName", "敌方机甲"),
        "AniID": base_robot.get("AniID", ""),
        "Growth": base_robot.get("Growth", 50),
        "Comprehension": base_robot.get("Comprehension", 50),
        "StarLevel": base_robot.get("StarLevel", 1),
        "Form": base_robot.get("Form", 1),
        "Class": base_robot.get("Class", 1),
        "Level": level,
        "EXP": 0,
    }
    upgrade_manager = get_upgrade_manager()
    base_attrs = upgrade_manager.calculate_attributes(enemy_pet, robot_id=str(enemy_pet.get("RobotID", "")))
    if base_attrs:
        enemy_pet.update(base_attrs)
    if ref_cfg.get("no_equipment"):
        equipment_slots = {slot: {} for slot in ("Weapon", "Gun", "Dun", "Wing")}
    else:
        equipment_slots = battle_handler._build_equipment_for_pet(enemy_pet, level)
    enemy_pet["equipment"] = equipment_slots
    if not ref_cfg.get("no_equipment"):
        equip_list = equipment_handler.load_equipment_data()
        equip_cache = {int(e.get("id")): e for e in equip_list if e.get("id") is not None}
        enemy_pet.update(battle_handler._apply_equipment_bonus_to_attrs(enemy_pet, equipment_slots, equip_cache))
    if ref_cfg.get("elite"):
        for key in list(enemy_pet.keys()):
            if key.startswith("Current") and isinstance(enemy_pet[key], (int, float)):
                enemy_pet[key] = int(enemy_pet[key] * 1.25)
    enemy = {
        "success": True,
        "pet_id": None,
        "robot_base_id": str(base_robot.get("_id", "")),
        "RobotID": enemy_pet.get("RobotID", ""),
        "RobotName": enemy_pet.get("RobotName", ""),
        "Growth": enemy_pet.get("Growth", 50),
        "Comprehension": enemy_pet.get("Comprehension", 50),
        "Level": enemy_pet.get("Level", 1),
        "StarLevel": enemy_pet.get("StarLevel", 1),
        "Form": enemy_pet.get("Form", 1),
        "Class": enemy_pet.get("Class", 1),
        "AniID": enemy_pet.get("AniID", ""),
        "equipment": equipment_slots,
        "CurrentHP": enemy_pet.get("CurrentHP", 0),
        "CurrentMP": enemy_pet.get("CurrentMP", 0),
        "MaxHP": enemy_pet.get("MaxHP", enemy_pet.get("CurrentHP", 0)),
        "MaxMP": enemy_pet.get("MaxMP", enemy_pet.get("CurrentMP", 0)),
        "battle_ref": battle_ref,
    }
    for attr in (
        "CurrentMelee",
        "CurrentShooting",
        "CurrentArmor",
        "CurrentAccuracy",
        "CurrentInitiative",
    ):
        if attr in enemy_pet:
            enemy[attr.replace("Current", "current_").lower()] = enemy_pet[attr]
            enemy[attr] = enemy_pet[attr]
    return enemy, None


async def handle_story_battle_start(websocket, data, current_user_id, current_character_id):
    """
    DEPRECATED: 客户端剧情战应走 story_interact → battle_room_create(story_event_id)。
    本路由保留兼容，内部使用 story_battle_shared 同一套 pending 校验与敌人生成。
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

    from services.story_battle_shared import consume_or_validate_pending_battle

    _pending, enemy, err = await consume_or_validate_pending_battle(
        uid,
        cid,
        map_code,
        event_id,
        battle_ref=battle_ref,
        require_battle_ref_match=True,
        player_pet_id=data.get("player_pet_id"),
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
