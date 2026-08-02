"""
剧情战斗共享：pending 校验与敌人生成（供 Service / 兼容层使用）。

不得从本模块 import 剧情 Handler。
敌人生成的唯一实现位于本模块；story_battle_service 编排状态机并调用本模块。
"""
from __future__ import annotations

import logging
import random
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("game_server")


def validate_pending_story_battle(
    progress: Dict[str, Any],
    event_id: Optional[str],
    battle_ref: Optional[str] = None,
    *,
    require_battle_ref_match: bool = False,
    allow_statuses: Optional[Tuple[str, ...]] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """委托 Service 校验，保持 import 路径兼容。"""
    from services.story_battle_service import validate_pending_story_battle as _validate

    return _validate(
        progress,
        event_id,
        battle_ref,
        require_battle_ref_match=require_battle_ref_match,
        allow_statuses=allow_statuses,
    )


async def generate_story_enemy(
    user_id,
    character_id: str,
    battle_ref: str,
    player_pet_id=None,
):
    """生成剧情敌方快照；完整实现（不委托 Handler）。"""
    from bson import ObjectId
    from handlers import utils
    from handlers import battle_handler
    from handlers import equipment_handler
    from handlers.robot_upgrade import get_upgrade_manager
    from services.story_service import get_battle_ref_config

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
    """委托 story_battle_service，保持旧签名兼容。"""
    from services.story_battle_service import consume_or_validate_pending_battle as _consume

    return await _consume(
        user_id,
        character_id,
        map_code,
        event_id,
        battle_ref=battle_ref,
        require_battle_ref_match=require_battle_ref_match,
        player_pet_id=player_pet_id,
        request_id=request_id,
        mark_creating=mark_creating,
    )
