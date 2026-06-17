"""
装备进阶：强化、镶嵌
"""
import json
import os
from bson import ObjectId

from . import utils
from . import equipment_handler
from .equipment_handler import EquipmentExtension


def _load_enhance_config() -> dict:
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "enhance_config.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _enhance_cost(level: int, cfg: dict) -> int:
    base = int(cfg.get("gold_per_level_base", 100))
    step = int(cfg.get("gold_per_level_step", 50))
    return base + step * level


async def handle_equip_enhance(websocket, data, current_character_id):
    user = utils.get_user_by_id_or_token(token=data.get("token"))
    if not user:
        await utils.send_error_response(websocket, "equip_enhance", "未登录", code=401, request_data=data)
        return
    cid = data.get("character_id") or current_character_id
    pet_id = data.get("pet_id")
    slot_name = data.get("slot_name")
    if not pet_id or not slot_name:
        await utils.send_error_response(websocket, "equip_enhance", "缺少 pet_id 或 slot_name", code=400, request_data=data)
        return
    try:
        pet_oid = ObjectId(pet_id)
    except Exception:
        await utils.send_error_response(websocket, "equip_enhance", "无效 pet_id", code=400, request_data=data)
        return

    pet = await utils.async_mongo_operation(
        lambda: utils.robotpet_col.find_one({"_id": pet_oid, "user_id": user["_id"], "character_id": cid}),
        timeout=2.0,
    )
    if not pet:
        await utils.send_error_response(websocket, "equip_enhance", "机甲不存在", code=404, request_data=data)
        return

    equipment = pet.get("equipment") or {}
    slot_eq = equipment.get(slot_name)
    if not slot_eq or not slot_eq.get("item_id"):
        await utils.send_error_response(websocket, "equip_enhance", "槽位无装备", code=400, request_data=data)
        return

    cfg = _load_enhance_config()
    max_lv = int(cfg.get("max_level", 15))
    cur_lv = int(slot_eq.get("enhance_level", 0) or 0)
    if cur_lv >= max_lv:
        await utils.send_error_response(websocket, "equip_enhance", "已达最大强化等级", code=400, request_data=data)
        return

    cost = _enhance_cost(cur_lv + 1, cfg)
    player = await utils.async_mongo_operation(
        lambda: utils.players_col.find_one({"user_id": user["_id"], "character_id": cid}),
        timeout=2.0,
    )
    gold = int(player.get("gold", 0) or 0)
    if gold < cost:
        await utils.send_error_response(websocket, "equip_enhance", f"金币不足（需要 {cost}）", code=400, request_data=data)
        return

    new_lv = cur_lv + 1
    slot_eq["enhance_level"] = new_lv
    equipment[slot_name] = slot_eq
    await utils.async_mongo_operation(
        lambda: utils.robotpet_col.update_one({"_id": pet_oid}, {"$set": {"equipment": equipment}}),
        timeout=2.0,
    )
    await utils.async_mongo_operation(
        lambda: utils.players_col.update_one({"_id": player["_id"]}, {"$set": {"gold": gold - cost}}),
        timeout=2.0,
    )

    bonus = EquipmentExtension.calculate_enhancement_bonus(int(slot_eq["item_id"]), new_lv)
    await utils.send_success_response(
        websocket,
        "equip_enhance",
        data={
            "pet_id": pet_id,
            "slot_name": slot_name,
            "enhance_level": new_lv,
            "gold_spent": cost,
            "bonus": bonus.get("bonus_attributes", {}),
        },
        request_data=data,
    )


async def handle_equip_socket(websocket, data, current_character_id):
    from handlers import bag_handler

    user = utils.get_user_by_id_or_token(token=data.get("token"))
    if not user:
        await utils.send_error_response(websocket, "equip_socket", "未登录", code=401, request_data=data)
        return
    cid = data.get("character_id") or current_character_id
    pet_id = data.get("pet_id")
    slot_name = data.get("slot_name")
    gem_item_id = int(data.get("gem_item_id", 0))
    if not pet_id or not slot_name or gem_item_id <= 0:
        await utils.send_error_response(websocket, "equip_socket", "参数不完整", code=400, request_data=data)
        return
    try:
        pet_oid = ObjectId(pet_id)
    except Exception:
        await utils.send_error_response(websocket, "equip_socket", "无效 pet_id", code=400, request_data=data)
        return

    cfg = _load_enhance_config()
    max_socket = int(cfg.get("socket_max", 2))

    pet = await utils.async_mongo_operation(
        lambda: utils.robotpet_col.find_one({"_id": pet_oid, "user_id": user["_id"], "character_id": cid}),
        timeout=2.0,
    )
    if not pet:
        await utils.send_error_response(websocket, "equip_socket", "机甲不存在", code=404, request_data=data)
        return
    equipment = pet.get("equipment") or {}
    slot_eq = equipment.get(slot_name)
    if not slot_eq or not slot_eq.get("item_id"):
        await utils.send_error_response(websocket, "equip_socket", "槽位无装备", code=400, request_data=data)
        return

    sockets = slot_eq.get("socket_gems") or []
    if len(sockets) >= max_socket:
        await utils.send_error_response(websocket, "equip_socket", "镶嵌孔已满", code=400, request_data=data)
        return

    inv = await utils.async_mongo_operation(
        lambda: utils.inventory_col.find_one({"user_id": user["_id"], "character_id": cid}),
        timeout=2.0,
    )
    if not inv:
        await utils.send_error_response(websocket, "equip_socket", "背包为空", code=400, request_data=data)
        return

    items = bag_handler.merge_inventory_items(inv)
    found = next((it for it in items if int(it.get("item_id", 0)) == gem_item_id and int(it.get("quantity", 0)) > 0), None)
    if not found:
        await utils.send_error_response(websocket, "equip_socket", "背包无该宝石", code=400, request_data=data)
        return

    gem_key = f"gem_{['attack','defense','hp'][gem_item_id % 3]}"
    sockets.append({"gem_key": gem_key, "item_id": gem_item_id})
    slot_eq["socket_gems"] = sockets
    equipment[slot_name] = slot_eq
    await utils.async_mongo_operation(
        lambda: utils.robotpet_col.update_one({"_id": pet_oid}, {"$set": {"equipment": equipment}}),
        timeout=2.0,
    )
    consume = await bag_handler.consume_item_from_bag(user["_id"], cid, gem_item_id, 1)
    if not consume.get("success"):
        await utils.send_error_response(websocket, "equip_socket", consume.get("error", "扣除宝石失败"), code=400, request_data=data)
        return

    bonus = EquipmentExtension.calculate_socket_bonus(int(slot_eq["item_id"]), sockets)
    await utils.send_success_response(
        websocket,
        "equip_socket",
        data={"pet_id": pet_id, "slot_name": slot_name, "socket_gems": sockets, "bonus": bonus.get("bonus_attributes", {})},
        request_data=data,
    )
