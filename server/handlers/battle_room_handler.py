"""
战斗房间相关 Handler（首版：单人 PVE）

- battle_room_create: 创建一场新的 PVE 战斗房间
- battle_room_action: 玩家提交指令（攻击/防御/逃跑），服务器结算一整个回合
- battle_room_resume: 客户端重连 / 重新打开战斗面板时，恢复当前房间状态

当前版本重点：一场战斗一个房间，可支持短时间断线恢复（房间状态常驻内存）。
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from bson import ObjectId

from . import utils
from services.battle_room_service import battle_room_service
from services.world_presence_service import world_presence_service


def _refresh_remaining_command_seconds(state: Dict[str, Any]) -> None:
    """按当前时间刷新 state 中的 remaining_command_seconds，供客户端倒计时与重连如实显示"""
    deadline = state.get("command_deadline_ts")
    if deadline is not None and isinstance(deadline, (int, float)):
        now_ms = int(time.time() * 1000)
        state["remaining_command_seconds"] = max(0.0, (deadline - now_ms) / 1000.0)


def _clean_objectid_for_json(obj: Any) -> Any:
    """
    递归清理数据中的 ObjectId，转换为字符串，确保可以 JSON 序列化
    与 battle_room_service 中的清理函数保持一致
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: _clean_objectid_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_objectid_for_json(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(_clean_objectid_for_json(item) for item in obj)
    else:
        return obj


async def _load_player_pet_snapshot(user: Any, character_id: Any) -> Optional[Dict[str, Any]]:
    """
    加载当前角色的“主战机甲”快照：
    - 优先使用 players.battle_team 第一只
    - 若首只无效或空队：回退为角色名下 slot_index 最小的一只
    """
    cid = str(character_id).strip()
    if not cid:
        return None

    # 1) 查 players 集合中的 battle_team
    player_doc = utils.safe_mongo_operation(
        lambda: utils.players_col.find_one({"user_id": user["_id"], "character_id": cid})
    )
    pet_id: Optional[str] = None
    if player_doc and isinstance(player_doc.get("battle_team"), list) and player_doc["battle_team"]:
        pet_id = str(player_doc["battle_team"][0])

    # 2) 没有 battle_team 时，从 robotpet_col 里取任意一只（按 slot_index 排序）
    query = {"user_id": user["_id"], "character_id": cid}
    if pet_id:
        from bson import ObjectId

        try:
            obj_id = ObjectId(pet_id)
            pet = utils.safe_mongo_operation(
                lambda: utils.robotpet_col.find_one({"_id": obj_id, **query})
            )
        except Exception:
            pet = None
    else:
        pet = utils.safe_mongo_operation(
            lambda: utils.robotpet_col.find_one(
                query,
                sort=[("slot_index", 1)],
            )
        )

    if not pet:
        # battle_team 首 ID 无效或查询失败：按 slot_index 回退第一只
        pet = utils.safe_mongo_operation(
            lambda: utils.robotpet_col.find_one(
                query,
                sort=[("slot_index", 1)],
            )
        )

    if not pet:
        return None
    return pet


def _build_attrs_from_pet(pet: Dict[str, Any]) -> Dict[str, Any]:
    """
    在保留原始字段的前提下，补齐战斗所需的关键数值字段：
    - MaxHP / CurrentHP
    - Melee / Shooting / Armor / Initiative 及其 Current* 版本
    这样 raw 结构尽量贴近现有 robot_pet_info_response，方便 RobotShow / 属性面板复用。
    """
    # 先复制一份原始文档，避免直接修改 Mongo 返回对象
    doc: Dict[str, Any] = dict(pet or {})

    name = doc.get("RobotName") or doc.get("name") or "玩家机甲"
    level = int(doc.get("Level", doc.get("level", 1)) or 1)

    max_hp = int(doc.get("MaxHP", doc.get("HP", 100)) or 100)
    hp = int(doc.get("CurrentHP", doc.get("current_hp", max_hp)) or max_hp)

    melee = int(doc.get("CurrentMelee", doc.get("Melee", 0)) or 0)
    shoot = int(doc.get("CurrentShooting", doc.get("Shooting", 0)) or 0)
    armor = int(doc.get("CurrentArmor", doc.get("Armor", 0)) or 0)
    initiative = int(doc.get("CurrentInitiative", doc.get("Initiative", 10)) or 10)

    # 回填标准字段
    doc["RobotName"] = name
    doc["Level"] = level
    doc["MaxHP"] = max_hp
    doc["CurrentHP"] = hp

    doc["Melee"] = doc.get("Melee", melee)
    doc["Shooting"] = doc.get("Shooting", shoot)
    doc["Armor"] = doc.get("Armor", armor)
    doc["Initiative"] = doc.get("Initiative", initiative)

    doc["CurrentMelee"] = melee
    doc["CurrentShooting"] = shoot
    doc["CurrentArmor"] = armor
    doc["CurrentInitiative"] = initiative

    # 统一 pet_id 字段，方便前端复用
    doc["pet_id"] = str(doc.get("pet_id") or doc.get("_id") or "")

    return doc


async def _generate_enemy_snapshot(user: Any, player_pet_id: Optional[str]) -> Dict[str, Any]:
    """
    生成一只敌方机甲快照：
    - 随机从 RobotBase 抽一只
    - 使用 robot_upgrade.calculate_attributes 计算属性
    - 随机装备（Weapon/Gun/Dun/Wing），遵循穿戴规则（equipment_handler.validate_equipment_restrictions）
    - 装备加成计入 Current* 字段
    - 不落库，只返回用于战斗的快照
    """
    from bson import ObjectId
    from .robot_upgrade import get_upgrade_manager
    from . import equipment_handler
    from .battle_handler import _build_equipment_for_pet, _apply_equipment_bonus_to_attrs

    base_level = 1
    if player_pet_id:
        try:
            pet_object_id = ObjectId(player_pet_id)
            player_pet = utils.safe_mongo_operation(
                lambda: utils.robotpet_col.find_one(
                    {"_id": pet_object_id, "user_id": user["_id"]}
                )
            )
            if player_pet:
                base_level = int(player_pet.get("Level", 1) or 1)
        except Exception:
            pass

    # 1) 随机抽一个 RobotBase
    sample = utils.safe_mongo_operation(
        lambda: list(utils.robotbase_col.aggregate([{"$sample": {"size": 1}}]))
    )
    if not sample:
        # 返回一个非常基础的占位敌人，避免整个流程失败
        return {
            "RobotName": "训练目标",
            "Level": base_level,
            "MaxHP": 100,
            "CurrentHP": 100,
            "Melee": 10,
            "Shooting": 10,
            "Armor": 5,
            "Initiative": 10,
        }

    base_robot = sample[0]

    # 2) 构建临时 pet，用于升级计算
    enemy_pet = {
        "RobotID": base_robot.get("RobotID", base_robot.get("id", 0)),
        "RobotName": base_robot.get("RobotName", base_robot.get("name", "敌方机甲")),
        "AniID": base_robot.get("AniID", ""),
        "Growth": base_robot.get("Growth", 50),
        "Comprehension": base_robot.get("Comprehension", 50),
        "StarLevel": base_robot.get("StarLevel", 1),
        "Form": base_robot.get("Form", 1),
        "Class": base_robot.get("Class", 1),
        "Level": max(1, base_level),
        "EXP": 0,
    }

    # 3) 升级计算基础属性
    upgrade_manager = get_upgrade_manager()
    base_attrs = upgrade_manager.calculate_attributes(
        enemy_pet, robot_id=str(enemy_pet.get("RobotID", ""))
    )
    if base_attrs:
        enemy_pet.update(base_attrs)

    # 4) 随机满装备（Weapon/Gun/Dun/Wing），遵循穿戴规则
    level = int(enemy_pet.get("Level", 1) or 1)
    equipment_slots = _build_equipment_for_pet(enemy_pet, level)
    enemy_pet["equipment"] = equipment_slots

    # 5) 装备加成计入 Current* 字段
    equip_list = equipment_handler.load_equipment_data()
    equip_cache = {int(e.get("id")): e for e in equip_list if e.get("id") is not None}
    enemy_pet.update(_apply_equipment_bonus_to_attrs(enemy_pet, equipment_slots, equip_cache))

    # 6) 输出战斗用快照（含 equipment，供 RobotShow 显示）
    return _build_attrs_from_pet(enemy_pet)


async def _ensure_battle_team_ready_for_combat(user: Any, character_id: Any) -> None:
    """
    开战前保证 players.battle_team 与客户端/列表一致（单机位）：
    - 空队：按 slot_index 自动选 1 只并持久化（与 get_battle_team 语义对齐）
    - 首只 ID 无效：回退为 slot 第一只并写回
    - 多于 1 只：截断为仅保留第一只（当前版本单机位）
    """
    cid = str(character_id).strip()
    if not cid:
        return
    uid = user["_id"]

    player = await utils.async_mongo_operation(
        lambda: utils.players_col.find_one({"user_id": uid, "character_id": cid}),
        timeout=3.0,
    )
    raw_team: list = []
    if player and isinstance(player.get("battle_team"), list):
        raw_team = [str(x) for x in player.get("battle_team", []) if x]

    async def _pick_first_slot_pet_id() -> Optional[str]:
        pets = await utils.async_mongo_operation(
            lambda: list(
                utils.robotpet_col.find(
                    {"user_id": uid, "character_id": cid, "slot_index": {"$exists": True, "$ne": None}},
                    {"_id": 1, "slot_index": 1},
                )
                .sort("slot_index", 1)
                .limit(1)
            ),
            timeout=3.0,
        )
        if not pets:
            return None
        return str(pets[0]["_id"])

    battle_team = raw_team[:1] if len(raw_team) > 1 else raw_team

    desired: list[str] = []
    if not battle_team:
        pid = await _pick_first_slot_pet_id()
        if pid:
            desired = [pid]
    else:
        first = battle_team[0]
        oid: Optional[ObjectId] = None
        try:
            oid = ObjectId(first)
        except Exception:
            oid = None
        found = None
        if oid is not None:
            found = await utils.async_mongo_operation(
                lambda: utils.robotpet_col.find_one(
                    {"_id": oid, "user_id": uid, "character_id": cid},
                    {"_id": 1},
                ),
                timeout=3.0,
            )
        if not found:
            pid = await _pick_first_slot_pet_id()
            if pid:
                desired = [pid]
        else:
            desired = [first]

    if not desired:
        return
    # 已与库中一致且单机位：跳过写库（多元素时需截断写回）
    if raw_team == desired and len(raw_team) <= 1:
        return

    object_ids: List[ObjectId] = []
    for pid in desired:
        try:
            object_ids.append(ObjectId(pid))
        except Exception:
            return

    await utils.async_mongo_operation(
        lambda: utils.players_col.update_one(
            {"user_id": uid, "character_id": cid},
            {"$set": {"battle_team": desired}},
            upsert=True,
        ),
        timeout=3.0,
    )
    await utils.async_mongo_operation(
        lambda: utils.robotpet_col.update_many(
            {"user_id": uid, "character_id": cid},
            {"$unset": {"is_in_battle_team": "", "battle_team_position": ""}},
        ),
        timeout=3.0,
    )
    for idx, pet_id_obj in enumerate(object_ids):
        pos = idx + 1
        await utils.async_mongo_operation(
            lambda p=pet_id_obj, po=pos: utils.robotpet_col.update_one(
                {"_id": p, "user_id": uid, "character_id": cid},
                {"$set": {"is_in_battle_team": True, "battle_team_position": po}},
            ),
            timeout=3.0,
        )


# ----------------------------------------------------------------------
# 对外 Handler
# ----------------------------------------------------------------------


async def handle_battle_room_create(websocket, data: Dict[str, Any], current_character_id: Any):
    """创建一场 PVE 战斗房间。"""
    token = data.get("token")
    user_id = data.get("user_id")
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket,
            "battle_room_create",
            "用户不存在或未登录",
            code=401,
            request_data=data,
        )
        return

    cid = data.get("character_id") or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(
            websocket,
            "battle_room_create",
            "未选择角色",
            code=400,
            request_data=data,
        )
        return

    # 进图时 world 可能标记「需有效碰撞」；本次开战请求直接清除该标记并继续创建房间，
    # 不再返回 409（避免首次触发必败、需第二次才成功）。
    world_presence_service.consume_fresh_collision_gate(str(cid))

    await _ensure_battle_team_ready_for_combat(user, cid)

    # 加载玩家主战机甲
    player_pet = await _load_player_pet_snapshot(user, cid)
    if not player_pet:
        await utils.send_error_response(
            websocket,
            "battle_room_create",
            "当前角色没有可用机甲",
            code=400,
            request_data=data,
        )
        return

    player_snapshot = _build_attrs_from_pet(player_pet)

    # 已有进行中房间：禁止再 create，由客户端走 BattleResumeController 恢复
    existing = battle_room_service.get_room_for_character(str(cid))
    if existing and existing.get("status") == "in_progress":
        await utils.send_error_response(
            websocket,
            "battle_room_create",
            "已有进行中的战斗房间，请先恢复",
            code=409,
            request_data=data,
            error_code="ACTIVE_BATTLE_ROOM",
        )
        return

    story_event_id = data.get("story_event_id")
    map_code = data.get("map_code") or "test_base"
    if story_event_id:
        from services.story_battle_shared import consume_or_validate_pending_battle

        _pending, enemy_obj, err = await consume_or_validate_pending_battle(
            user["_id"],
            str(cid),
            map_code,
            story_event_id,
            player_pet_id=data.get("player_pet_id"),
        )
        if err:
            await utils.send_error_response(
                websocket, "battle_room_create", err, code=400 if "未授权" in err else 500, request_data=data
            )
            return
        enemy_snapshot = _build_attrs_from_pet(enemy_obj)
    elif data.get("battle_ref"):
        # 本地验收：仅 battle_ref、不校验 pending（skipServerAuth）
        from services.story_battle_shared import generate_story_enemy

        enemy_obj, err = await generate_story_enemy(
            user["_id"], str(cid), str(data.get("battle_ref")), data.get("player_pet_id")
        )
        if err:
            await utils.send_error_response(
                websocket, "battle_room_create", err, code=500, request_data=data
            )
            return
        enemy_snapshot = _build_attrs_from_pet(enemy_obj)
    else:
        enemy_snapshot = await _generate_enemy_snapshot(
            user, player_snapshot.get("pet_id")
        )

    # 这里的 user_id 只用于标识归属，统一转成字符串，避免 ObjectId 不能 JSON 序列化的问题
    room = battle_room_service.create_pve_room(
        user_id=str(user["_id"]),
        character_id=str(cid),
        player_doc=player_snapshot,
        enemy_doc=enemy_snapshot,
    )

    # 确保返回的 room state 完全清理了 ObjectId（双重保险）
    cleaned_room = _clean_objectid_for_json(room)
    _refresh_remaining_command_seconds(cleaned_room)

    await utils.send_success_response(
        websocket,
        "battle_room_create",
        data={"room_id": cleaned_room["room_id"], "state": cleaned_room},
        request_data=data,
        immediate=True,
    )


async def handle_battle_room_action(websocket, data: Dict[str, Any], current_character_id: Any):
    """玩家在房间内提交指令（ATTACK/DEFEND/ESCAPE），服务器结算一整个回合。"""
    token = data.get("token")
    user_id = data.get("user_id")
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket,
            "battle_room_action",
            "用户不存在或未登录",
            code=401,
            request_data=data,
        )
        return

    cid = data.get("character_id") or current_character_id
    room_id = data.get("room_id")
    action_type = str(data.get("action_type") or "").upper()

    if not room_id:
        await utils.send_error_response(
            websocket,
            "battle_room_action",
            "缺少 room_id",
            code=400,
            request_data=data,
        )
        return

    if action_type not in ("ATTACK", "DEFEND", "ESCAPE"):
        await utils.send_error_response(
            websocket,
            "battle_room_action",
            "无效的 action_type",
            code=400,
            request_data=data,
        )
        return

    room = battle_room_service.get_room_by_id(room_id)
    if not room:
        await utils.send_error_response(
            websocket,
            "battle_room_action",
            "战斗房间不存在或已超时",
            code=404,
            request_data=data,
        )
        return

    # 简单校验角色是否属于该房间
    if cid:
        if room.get("mode") == "pvp":
            player_cid = str(room.get("player_character_id") or "")
            enemy_cid = str(room.get("enemy_character_id") or "")
            if str(cid) not in (player_cid, enemy_cid):
                await utils.send_error_response(
                    websocket,
                    "battle_room_action",
                    "角色不在该 PVP 战斗房间中",
                    code=403,
                    request_data=data,
                )
                return
        else:
            if str(room.get("character_id")) != str(cid):
                await utils.send_error_response(
                    websocket,
                    "battle_room_action",
                    "角色不在该战斗房间中",
                    code=403,
                    request_data=data,
                )
                return

    # PVE：submit_player_action；PVP：等待双方都提交动作后结算
    if room.get("mode") == "pvp":
        new_state = await battle_room_service.submit_pvp_action(room_id, str(cid), action_type) or room
    else:
        new_state = battle_room_service.submit_player_action(room_id, action_type) or room

    # 战斗结束后将玩家机甲 CurrentHP 回写数据库，保证“实打实”血量持久化（robotpet 表里 user_id 是 ObjectId）
    if new_state.get("status") == "finished":
        if new_state.get("mode") == "pvp":
            # PVP：回写双方
            for internal_side in ("player", "enemy"):
                actor = new_state.get(internal_side)
                if not actor or not isinstance(actor.get("raw"), dict) or utils.robotpet_col is None:
                    continue

                raw = actor["raw"]
                pet_id = raw.get("_id") or raw.get("pet_id")
                target_cid = str(new_state.get(f"{internal_side}_character_id") or "").strip()
                target_uid = new_state.get(f"{internal_side}_user_id")

                if pet_id and target_cid and target_uid:
                    try:
                        pid = ObjectId(pet_id) if isinstance(pet_id, str) else pet_id
                        hp = max(0, int(actor.get("hp", 0)))
                        res = utils.safe_mongo_operation(
                            lambda: utils.robotpet_col.update_one(
                                {"_id": pid, "character_id": target_cid, "user_id": target_uid},
                                {"$set": {"CurrentHP": hp}},
                            )
                        )
                        if res and res.modified_count:
                            print(
                                f"[battle_room_action][pvp] 已回写 {internal_side} 机甲 CurrentHP={hp} (pet_id={pet_id})"
                            )
                    except Exception as e:
                        import traceback
                        print(
                            f"[battle_room_action][pvp] 战斗结束后回写 CurrentHP 失败: {e}",
                            traceback.format_exc(),
                        )
        else:
            # PVE：回写当前玩家
            player = new_state.get("player")
            if player and isinstance(player.get("raw"), dict) and utils.robotpet_col is not None:
                raw = player["raw"]
                pet_id = raw.get("_id") or raw.get("pet_id")
                cid = str(new_state.get("character_id") or "").strip()
                if pet_id and cid:
                    try:
                        pid = ObjectId(pet_id) if isinstance(pet_id, str) else pet_id
                        hp = max(0, int(player.get("hp", 0)))
                        # 使用当前请求的 user["_id"]（ObjectId），与 robotpet 表一致
                        res = utils.safe_mongo_operation(
                            lambda: utils.robotpet_col.update_one(
                                {"_id": pid, "character_id": cid, "user_id": user["_id"]},
                                {"$set": {"CurrentHP": hp}},
                            )
                        )
                        if res and res.modified_count:
                            print(f"[battle_room_action] 已回写玩家机甲 CurrentHP={hp} (pet_id={pet_id})")
                    except Exception as e:
                        import traceback
                        print(f"[battle_room_action] 战斗结束后回写 CurrentHP 失败: {e}", traceback.format_exc())

    # 确保返回的 room state 完全清理了 ObjectId，并刷新指令阶段剩余秒数（服务器权威倒计时）
    view_state = new_state
    if new_state.get("mode") == "pvp":
        view_state = battle_room_service.build_pvp_room_view_for_character(new_state, str(cid))

    cleaned_state = _clean_objectid_for_json(view_state)
    _refresh_remaining_command_seconds(cleaned_state)

    await utils.send_success_response(
        websocket,
        "battle_room_action",
        data={"room_id": room_id, "state": cleaned_state},
        request_data=data,
    )


async def handle_battle_room_resume(websocket, data: Dict[str, Any], current_character_id: Any):
    """客户端重连 / 重新打开战斗 UI 时，尝试恢复当前进行中的战斗房间。"""
    token = data.get("token")
    user_id = data.get("user_id")
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket,
            "battle_room_resume",
            "用户不存在或未登录",
            code=401,
            request_data=data,
        )
        return

    cid = data.get("character_id") or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(
            websocket,
            "battle_room_resume",
            "未选择角色",
            code=400,
            request_data=data,
        )
        return

    room = battle_room_service.get_room_for_character(str(cid))
    if not room:
        # 没有进行中的战斗并不算错误，返回 has_room=false 让客户端自行决定是否创建新房间
        await utils.send_success_response(
            websocket,
            "battle_room_resume",
            data={"has_room": False},
            request_data=data,
        )
        return

    # 确保返回的 room state 完全清理了 ObjectId，并刷新指令阶段剩余秒数（重连时如实恢复服务器倒计时）
    view_room = room
    if room.get("mode") == "pvp":
        view_room = battle_room_service.build_pvp_room_view_for_character(room, str(cid))

    cleaned_room = _clean_objectid_for_json(view_room)
    _refresh_remaining_command_seconds(cleaned_room)

    await utils.send_success_response(
        websocket,
        "battle_room_resume",
        data={"has_room": True, "room_id": cleaned_room["room_id"], "state": cleaned_room},
        request_data=data,
    )


async def handle_battle_result(websocket, data: Dict[str, Any], current_character_id: Any) -> None:
    """客户端战斗结束上报（日志/占位）；不改变权威状态。"""
    token = data.get("token")
    user_id = data.get("user_id")
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket,
            "battle_result",
            "用户不存在或未登录",
            code=401,
            request_data=data,
        )
        return
    try:
        print(
            f"[battle_result] user={user.get('_id')} winner={data.get('winner')} "
            f"reason={data.get('reason')} character_id={data.get('character_id') or current_character_id}"
        )
    except Exception:
        pass
    await utils.send_success_response(
        websocket,
        "battle_result",
        data={"ok": True},
        request_data=data,
    )

