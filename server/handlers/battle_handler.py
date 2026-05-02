"""
战斗处理器（第一版：仅生成敌方机甲数据，用于客户端模拟战斗）

目标：
- 敌方机甲：随机角色（RobotBase 随机抽取）
- 敌方装备：满装备（Weapon/Gun/Dun/Wing），并遵循装备限制（equipment_handler.validate_equipment_restrictions）
- 敌方属性：遵循机甲升级/等级计算（robot_upgrade.calculate_attributes），并把装备加成计入 Current* 字段

注意：
- 本文件当前只负责“生成敌人数据”，不落库、不改玩家数据
- 后续可扩展为完整回合制战斗状态机（Pomelo 风格）
"""

import random
from bson import ObjectId

from . import utils
from .robot_upgrade import get_upgrade_manager
from . import equipment_handler


def _choose_level_around(base_level: int) -> int:
    # 敌人等级：围绕玩家等级上下浮动（可按需求再调）
    base_level = int(base_level or 1)
    delta = random.choice([-2, -1, 0, 1, 2])
    return max(1, base_level + delta)


def _build_equipment_for_pet(pet: dict, level: int) -> dict:
    """
    按槽位生成满装备，并通过 validate_equipment_restrictions 校验
    """
    all_equips = equipment_handler.load_equipment_data()
    # 仅考虑四个基础槽位：Weapon/Gun/Dun/Wing
    slots = ['Weapon', 'Gun', 'Dun', 'Wing']

    current_equipment = {}

    # 预过滤：requiredLevel <= level 且存在 type
    candidates = [e for e in all_equips if int(e.get('requiredLevel', 1) or 1) <= level and e.get('type') is not None]

    for slot in slots:
        type_list = equipment_handler.get_type_by_slot_name(slot)
        slot_candidates = [e for e in candidates if int(e.get('type', 0) or 0) in type_list]
        random.shuffle(slot_candidates)

        chosen = None
        for item in slot_candidates:
            item_type = int(item.get('type', 0) or 0)
            # 逐个验证装备限制（武器/枪械/盾牌联动等）
            v = equipment_handler.validate_equipment_restrictions(
                item_data=item,
                item_type=item_type,
                pet=pet,
                current_equipment=current_equipment
            )
            if v.get('success'):
                chosen = item
                break

        if chosen:
            current_equipment[slot] = {
                'item_id': int(chosen.get('id')),
                'name': chosen.get('name', ''),
                'type': int(chosen.get('type', 0) or 0),
            }
        else:
            # 找不到合法装备就留空（理论上不应频繁发生）
            current_equipment[slot] = {}

    return current_equipment


def _apply_equipment_bonus_to_attrs(base_attrs: dict, equipment_slots: dict, equip_config_cache: dict) -> dict:
    """
    将装备属性加成计入 Current* 字段（简化版，避免落库）
    - base_attrs：upgrade_manager.calculate_attributes 的结果（应包含基础属性字段）
    - equipment_slots：{'Weapon': {'item_id':..}, ...}
    - equip_config_cache：item_id -> item_data
    """
    # 基础 -> Current 映射（与现有字段对齐）
    mapping = {
        'Melee': 'melee',
        'Shooting': 'shoot',
        'Armor': 'armor',
        'Accuracy': 'accuracy',
        'Corrosion': 'corrosion',
        'Initiative': 'initiative',
        'Block': 'block',
        'ParticleShield': 'particleShield',
        'ArmorPenetration': 'armorPenetration',
        'Evasion': 'evasion',
        'Lethality': 'lethality',
        'Resistance': 'resistance',
        'Counterattack': 'counterattack',
        # HP/MP 在装备里一般为 0，但也支持
        'MaxHP': 'hp',
        'MaxMP': 'mp',
    }

    # 汇总装备加成
    bonus = {k: 0 for k in mapping.keys()}

    for slot, eq in (equipment_slots or {}).items():
        if not isinstance(eq, dict):
            continue
        item_id = eq.get('item_id')
        if not item_id:
            continue
        item = equip_config_cache.get(int(item_id))
        if not item:
            continue
        for base_key, item_key in mapping.items():
            try:
                bonus[base_key] += int(item.get(item_key, 0) or 0)
            except Exception:
                pass

    # 写入 Current* 字段（基础 + 加成），同时回填 MaxHP/MaxMP
    out = dict(base_attrs or {})

    for base_key in mapping.keys():
        base_val = int(out.get(base_key, 0) or 0)
        cur_val = base_val + int(bonus.get(base_key, 0) or 0)

        if base_key in ('MaxHP', 'MaxMP'):
            out[base_key] = cur_val
        else:
            out[f'Current{base_key}'] = cur_val

    # CurrentHP/CurrentMP 默认满
    out['CurrentHP'] = int(out.get('MaxHP', out.get('HP', 0) or 0) or 0)
    out['CurrentMP'] = int(out.get('MaxMP', out.get('MP', 0) or 0) or 0)
    return out


async def handle_battle_generate_enemy(websocket, data, current_character_id=None):
    """
    生成敌方机甲（带满装备与最终属性）

    请求：
    {
      type: 'battle_generate_enemy',
      player_pet_id?: string
    }

    响应：
    { type: 'battle_generate_enemy_response', success: true, enemy: <robot_pet_info_like> }
    """
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    player_pet_id = data.get('player_pet_id')

    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'battle_generate_enemy', '用户不存在或未登录', code=401, request_data=data)
        return

    # 玩家等级基准（默认 1）
    base_level = 1
    if player_pet_id:
        try:
            pet_object_id = ObjectId(player_pet_id)
            player_pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({
                '_id': pet_object_id,
                'user_id': user['_id']
            }))
            if player_pet:
                base_level = int(player_pet.get('Level', 1) or 1)
        except Exception:
            pass

    try:
        # 1) 随机抽一个 RobotBase
        sample = utils.safe_mongo_operation(lambda: list(utils.robotbase_col.aggregate([{ '$sample': { 'size': 1 } }])))
        if not sample:
            await utils.send_error_response(websocket, 'battle_generate_enemy', 'RobotBase集合为空', code=500, request_data=data)
            return
        base_robot = sample[0]

        # 2) 构建临时 pet（复用已有创建逻辑，确保字段齐全）
        #    不落库，仅用于生成敌人数据
        enemy_pet = {
            'RobotID': base_robot.get('RobotID', base_robot.get('id', 0)),
            'RobotName': base_robot.get('RobotName', base_robot.get('name', '敌方机甲')),
            'AniID': base_robot.get('AniID', ''),
            'Growth': base_robot.get('Growth', 50),
            'Comprehension': base_robot.get('Comprehension', 50),
            'StarLevel': base_robot.get('StarLevel', 1),
            'Form': base_robot.get('Form', 1),
            'Class': base_robot.get('Class', 1),
            'Level': 1,
            'EXP': 0,
        }

        # 3) 等级与属性（遵循升级计算）
        level = _choose_level_around(base_level)
        enemy_pet['Level'] = level

        upgrade_manager = get_upgrade_manager()
        base_attrs = upgrade_manager.calculate_attributes(enemy_pet, robot_id=str(enemy_pet.get('RobotID', '')))
        if base_attrs:
            enemy_pet.update(base_attrs)

        # 4) 随机满装备（遵循限制）
        equipment_slots = _build_equipment_for_pet(enemy_pet, level)
        enemy_pet['equipment'] = equipment_slots

        # 5) 装备加成计入 Current* 字段（简化版，不落库）
        equip_list = equipment_handler.load_equipment_data()
        equip_cache = {int(e.get('id')): e for e in equip_list if e.get('id') is not None}
        enemy_pet.update(_apply_equipment_bonus_to_attrs(enemy_pet, equipment_slots, equip_cache))

        # 6) 响应（格式对齐 robot_pet_info_response 关键字段）
        resp = {
            'type': 'battle_generate_enemy_response',
            'success': True,
            'enemy': {
                'success': True,
                'pet_id': None,
                'robot_base_id': str(base_robot.get('_id', '')),
                'RobotID': enemy_pet.get('RobotID', ''),
                'RobotName': enemy_pet.get('RobotName', ''),
                'Growth': enemy_pet.get('Growth', 50),
                'Comprehension': enemy_pet.get('Comprehension', 50),
                'Level': enemy_pet.get('Level', 1),
                'StarLevel': enemy_pet.get('StarLevel', 1),
                'Form': enemy_pet.get('Form', 1),
                'Class': enemy_pet.get('Class', 1),
                'AniID': enemy_pet.get('AniID', ''),
                'MaxHP': enemy_pet.get('MaxHP', enemy_pet.get('HP', 1000)),
                'CurrentHP': enemy_pet.get('CurrentHP', enemy_pet.get('MaxHP', 1000)),
                'MaxMP': enemy_pet.get('MaxMP', enemy_pet.get('MP', 300)),
                'CurrentMP': enemy_pet.get('CurrentMP', enemy_pet.get('MaxMP', 300)),
                'EXP': enemy_pet.get('EXP', 0),
                'Melee': enemy_pet.get('Melee', 0),
                'Armor': enemy_pet.get('Armor', 0),
                'Shooting': enemy_pet.get('Shooting', 0),
                'Accuracy': enemy_pet.get('Accuracy', 0),
                'Corrosion': enemy_pet.get('Corrosion', 0),
                'Initiative': enemy_pet.get('Initiative', 0),
                'Block': enemy_pet.get('Block', 0),
                'ParticleShield': enemy_pet.get('ParticleShield', 0),
                'ArmorPenetration': enemy_pet.get('ArmorPenetration', 0),
                'Evasion': enemy_pet.get('Evasion', 0),
                'Lethality': enemy_pet.get('Lethality', 0),
                'Resistance': enemy_pet.get('Resistance', 0),
                'Counterattack': enemy_pet.get('Counterattack', 0),
                # Current*
                'CurrentMelee': enemy_pet.get('CurrentMelee', enemy_pet.get('Melee', 0)),
                'CurrentArmor': enemy_pet.get('CurrentArmor', enemy_pet.get('Armor', 0)),
                'CurrentShooting': enemy_pet.get('CurrentShooting', enemy_pet.get('Shooting', 0)),
                'CurrentAccuracy': enemy_pet.get('CurrentAccuracy', enemy_pet.get('Accuracy', 0)),
                'CurrentCorrosion': enemy_pet.get('CurrentCorrosion', enemy_pet.get('Corrosion', 0)),
                'CurrentInitiative': enemy_pet.get('CurrentInitiative', enemy_pet.get('Initiative', 0)),
                'CurrentBlock': enemy_pet.get('CurrentBlock', enemy_pet.get('Block', 0)),
                'CurrentParticleShield': enemy_pet.get('CurrentParticleShield', enemy_pet.get('ParticleShield', 0)),
                'CurrentArmorPenetration': enemy_pet.get('CurrentArmorPenetration', enemy_pet.get('ArmorPenetration', 0)),
                'CurrentEvasion': enemy_pet.get('CurrentEvasion', enemy_pet.get('Evasion', 0)),
                'CurrentLethality': enemy_pet.get('CurrentLethality', enemy_pet.get('Lethality', 0)),
                'CurrentResistance': enemy_pet.get('CurrentResistance', enemy_pet.get('Resistance', 0)),
                'CurrentCounterattack': enemy_pet.get('CurrentCounterattack', enemy_pet.get('Counterattack', 0)),
                'equipment': equipment_slots,
            }
        }
        await utils.send_direct_response(websocket, resp, request_data=data)
    except Exception as e:
        await utils.send_error_response(websocket, 'battle_generate_enemy', f'生成敌人失败: {str(e)}', code=500, request_data=data)

