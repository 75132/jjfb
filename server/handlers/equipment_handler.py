"""
装备系统处理器
处理：装备、卸下、验证、属性计算等
"""
import json
import os
import time
from typing import Optional
from bson import ObjectId
from . import utils
from .robot_upgrade import MELEE_ROBOT_IDS, ALL_ROUND_ROBOT_IDS, SHOOTING_ROBOT_IDS

# ========== 装备系统缓存（网游级优化）==========
# 装备配置缓存：item_id -> 完整装备数据
_equipment_config_cache = {}

# 所有物品数据缓存（包含Items和Equipment）
_all_items_data_cache = None

# ========== 装备限制相关定义 ==========
# 职业固定装备映射（Class -> 允许的 type 列表）
CLASS_EQUIPMENT_TYPES = {
    1: [14, 8, 11, 17, 20],  # 格斗：Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
    2: [15, 9, 12, 18, 21],  # 射击：Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
    3: [16, 10, 13, 19, 22], # 全能：Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
}

# ========== 装备槽位映射 ==========
# type字段到槽位名称的映射
EQUIPMENT_SLOT_MAPPING = {
    # Weapon槽位：type 1、2
    1: 'Weapon',
    2: 'Weapon',
    # Gun槽位：type 6（重型枪械）、7（轻型枪械）
    6: 'Gun',  # 重型枪械
    7: 'Gun',  # 轻型枪械
    # Dun槽位：type 3
    3: 'Dun',
    # Wing槽位：type 4
    4: 'Wing',
    # Xinpian槽位：type 5
    5: 'Xinpian',
    # Toukai槽位：type 14、15、16
    14: 'Toukai',
    15: 'Toukai',
    16: 'Toukai',
    # Jianjia槽位：type 8、9、10
    8: 'Jianjia',
    9: 'Jianjia',
    10: 'Jianjia',
    # Xiongkai槽位：type 11、12、13
    11: 'Xiongkai',
    12: 'Xiongkai',
    13: 'Xiongkai',
    # Tuikai槽位：type 17、18、19
    17: 'Tuikai',
    18: 'Tuikai',
    19: 'Tuikai',
    # Shoukai槽位：type 20、21、22
    20: 'Shoukai',
    21: 'Shoukai',
    22: 'Shoukai',
}

# ========== 装备系统性能监控（网游级）==========
_equipment_operation_stats = {
    'equip_count': 0,
    'unequip_count': 0,
    'equip_errors': 0,
    'unequip_errors': 0,
    'total_time': 0.0,
}

# ========== 装备数据加载 ==========
def load_equipment_data():
    """加载所有装备JSON文件（Weapon, Gun, Wing, Dun, Armor）"""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # server
    data_dir = os.path.join(base_dir, 'data')
    
    equipment_files = ['Weapon.json', 'Gun.json', 'Wing.json', 'Dun.json', 'Armor.json']
    all_equipment = []
    
    for filename in equipment_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    equipment = json.load(f)
                    all_equipment.extend(equipment)
                    print(f'✅ [EquipmentHandler] 已加载 {filename}: {len(equipment)} 个装备')
            except Exception as e:
                print(f'⚠️ [EquipmentHandler] 加载 {filename} 失败: {e}')
        else:
            print(f'⚠️ [EquipmentHandler] 文件不存在: {filepath}')
    
    return all_equipment

def load_all_item_ids_data():
    """
    加载所有物品和装备数据（Items + 所有装备）
    网游级优化：使用缓存，避免重复加载
    """
    global _all_items_data_cache
    
    # 如果缓存存在，直接返回
    if _all_items_data_cache is not None:
        return _all_items_data_cache
    
    # 加载数据（动态导入避免循环依赖）
    try:
        from . import bag_handler
        items_data = bag_handler.load_valid_item_ids_data()
    except ImportError:
        # 如果无法导入，尝试直接加载 Items.json
        items_data = _load_items_json_directly()
    
    equipment_data = load_equipment_data()
    _all_items_data_cache = items_data + equipment_data
    
    # 构建装备配置缓存（用于快速查找）
    for item in _all_items_data_cache:
        item_id = item.get('id')
        if item_id:
            _equipment_config_cache[item_id] = item
    
    print(f'✅ [EquipmentHandler] 已缓存 {len(_all_items_data_cache)} 个物品数据，其中 {len(_equipment_config_cache)} 个装备')
    
    return _all_items_data_cache

def _load_items_json_directly():
    """直接加载 Items.json（备用方案，避免循环依赖）"""
    try:
        base_dir = os.path.dirname(os.path.dirname(__file__))  # server
        possible_paths = [
            os.path.join(base_dir, 'data', 'Items.json'),
            os.path.join(os.path.dirname(__file__), 'json', 'Items.json'),
            os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        return []
    except Exception as e:
        print(f'❌ [EquipmentHandler] 加载Items.json失败: {e}')
        return []

def get_equipment_config(item_id: int):
    """
    获取装备配置（网游级优化：使用缓存）
    
    Args:
        item_id: 装备ID
    
    Returns:
        装备配置数据，如果不存在则返回None
    """
    # 确保缓存已加载
    if _all_items_data_cache is None:
        load_all_item_ids_data()
    
    return _equipment_config_cache.get(item_id)

def clear_equipment_cache():
    """清除装备缓存（用于热更新）"""
    global _equipment_config_cache, _all_items_data_cache
    _equipment_config_cache = {}
    _all_items_data_cache = None
    print('🔄 [EquipmentHandler] 装备缓存已清除')

# ========== 装备槽位相关函数 ==========
def get_slot_name_by_type(item_type: int) -> str:
    """
    根据装备的type字段获取槽位名称
    返回槽位名称，如果type不在映射中则返回None
    """
    return EQUIPMENT_SLOT_MAPPING.get(item_type)

def get_type_by_slot_name(slot_name: str) -> list:
    """
    根据槽位名称获取所有对应的type值列表
    例如：'Weapon' -> [1, 2]
    """
    result = []
    for type_val, slot in EQUIPMENT_SLOT_MAPPING.items():
        if slot == slot_name:
            result.append(type_val)
    return result

# ========== 装备验证函数 ==========
def validate_equipment_integrity(pet, equipment_slots: dict) -> dict:
    """
    验证装备数据完整性（网游级数据一致性检查）
    
    Args:
        pet: 机甲数据
        equipment_slots: 装备槽位数据
    
    Returns:
        {
            'valid': bool,
            'errors': list,  # 错误列表
            'warnings': list,  # 警告列表
            'fixed_slots': dict  # 修复后的槽位数据（如果有修复）
        }
    """
    errors = []
    warnings = []
    fixed_slots = equipment_slots.copy() if equipment_slots else {}
    
    if not isinstance(equipment_slots, dict):
        errors.append('装备槽位数据格式错误，应为字典类型')
        fixed_slots = {}
        return {'valid': False, 'errors': errors, 'warnings': warnings, 'fixed_slots': fixed_slots}
    
    # 验证每个槽位的装备数据
    valid_slot_names = ['Weapon', 'Gun', 'Dun', 'Wing', 'Xinpian', 
                        'Toukai', 'Jianjia', 'Xiongkai', 'Tuikai', 'Shoukai']
    
    for slot_name, equipped_item in equipment_slots.items():
        # 检查槽位名称是否有效
        if slot_name not in valid_slot_names:
            warnings.append(f'未知的槽位名称: {slot_name}')
            continue
        
        # 检查装备数据格式
        if not isinstance(equipped_item, dict):
            errors.append(f'{slot_name} 槽位装备数据格式错误')
            fixed_slots.pop(slot_name, None)
            continue
        
        item_id = equipped_item.get('item_id')
        if not item_id:
            errors.append(f'{slot_name} 槽位装备缺少item_id')
            fixed_slots.pop(slot_name, None)
            continue
        
        # 验证装备ID是否存在
        item_config = get_equipment_config(item_id)
        if not item_config:
            errors.append(f'{slot_name} 槽位装备 {item_id} 不存在')
            fixed_slots.pop(slot_name, None)
            continue
        
        # 验证装备类型是否匹配槽位
        item_type = item_config.get('type', 0)
        expected_slot = get_slot_name_by_type(item_type)
        if expected_slot != slot_name:
            errors.append(f'{slot_name} 槽位装备 {item_id} 类型不匹配（应为 {expected_slot}）')
            fixed_slots.pop(slot_name, None)
            continue
    
    is_valid = len(errors) == 0
    return {
        'valid': is_valid,
        'errors': errors,
        'warnings': warnings,
        'fixed_slots': fixed_slots
    }

def validate_equipment_restrictions(item_data: dict, item_type: int, pet: dict, current_equipment: dict, slot_name: str = None) -> dict:
    """
    验证装备限制（机甲类型、职业固定搭配、装备冲突等）
    
    Args:
        item_data: 装备配置数据
        item_type: 装备的 type 字段
        pet: 机甲数据
        current_equipment: 当前已装备的装备槽位数据
        slot_name: 目标槽位名称（可选，用于判断是否为替换操作）
    
    Returns:
        {'success': bool, 'error': str}
    """
    # 获取 RobotID（可能是字符串或整数，统一转换为整数）
    robot_id_raw = pet.get('RobotID', 0)
    robot_id = 0
    try:
        if isinstance(robot_id_raw, int):
            robot_id = robot_id_raw
        elif isinstance(robot_id_raw, str):
            if robot_id_raw.isdigit():
                robot_id = int(robot_id_raw)
    except (ValueError, TypeError, AttributeError):
        robot_id = 0
    
    robot_class = pet.get('Class', 1)

    # 0. 等级需求：requiredLevel > 0 时，机甲当前等级必须满足
    try:
        req_raw = item_data.get('requiredLevel', 0)
        req_lv = int(req_raw) if req_raw is not None and str(req_raw).strip() != '' else 0
    except (TypeError, ValueError):
        req_lv = 0
    pet_level = int(pet.get('Level', 1) or 1)
    if req_lv > 0 and pet_level < req_lv:
        return {'success': False, 'error': f'机甲等级不足，需要 {req_lv} 级才能装备'}
    
    # 1. 检查职业固定装备（type 8-22）
    if 8 <= item_type <= 22:
        allowed_types = CLASS_EQUIPMENT_TYPES.get(robot_class, [])
        if item_type not in allowed_types:
            class_names = {1: '格斗', 2: '射击', 3: '全能'}
            # 找到该装备对应的机甲类型（根据 type 判断）
            required_class = None
            for cls, types in CLASS_EQUIPMENT_TYPES.items():
                if item_type in types:
                    required_class = cls
                    break
            if required_class:
                return {
                    'success': False,
                    'error': f'该装备只能由{class_names.get(required_class, "未知")}型机甲装备'
                }
            else:
                return {
                    'success': False,
                    'error': f'该装备类型({item_type})不匹配当前机甲类型（{class_names.get(robot_class, "未知")}型）'
                }
    
    # 2. 检查机甲类型限制（武器/枪械：type 1、2、6、7）
    if item_type in [1, 2, 6, 7]:
        # 判断机甲类型
        is_melee = robot_id in MELEE_ROBOT_IDS
        is_shooting = robot_id in SHOOTING_ROBOT_IDS
        is_all_round = robot_id in ALL_ROUND_ROBOT_IDS
        
        if item_type in [6, 7]:  # 枪械
            if is_melee:
                return {'success': False, 'error': '格斗型机甲禁止装备枪械'}
            if is_all_round and item_type == 6:  # 全能型禁止重型枪械
                return {'success': False, 'error': '全能型机甲只能装备轻型枪械，禁止装备重型枪械'}
        
        if item_type in [1, 2]:  # 武器
            if is_shooting:
                return {'success': False, 'error': '射击型机甲禁止装备武器'}
            if is_all_round and item_type == 1:  # 全能型禁止重型武器
                return {'success': False, 'error': '全能型机甲只能装备轻型武器，禁止装备重型武器'}
        
        # 2.5. 检查武器和枪械互斥：武器和枪械共享同一个攻击武器位，不能同时装备
        # 注意：如果传入了 slot_name，说明是主动装备操作，会自动处理冲突（卸下冲突装备）
        # 只有在未传入 slot_name 时（如战斗生成敌人），才严格检查互斥
        if slot_name is None:
            # 未传入 slot_name：严格检查互斥（用于战斗生成等场景）
            if item_type in [1, 2]:  # 装备武器时
                gun_slot = current_equipment.get('Gun')
                if gun_slot:  # 如果已有枪械
                    gun_item_id = gun_slot.get('item_id')
                    gun_name = gun_slot.get('name', '枪械')
                    return {
                        'success': False,
                        'error': f'武器和枪械不能同时装备，当前已装备枪械：{gun_name}（ID: {gun_item_id}）'
                    }
            
            if item_type in [6, 7]:  # 装备枪械时
                weapon_slot = current_equipment.get('Weapon')
                if weapon_slot:  # 如果已有武器
                    weapon_item_id = weapon_slot.get('item_id')
                    weapon_name = weapon_slot.get('name', '武器')
                    return {
                        'success': False,
                        'error': f'武器和枪械不能同时装备，当前已装备武器：{weapon_name}（ID: {weapon_item_id}）'
                    }
        # 如果传入了 slot_name，允许通过（equip_item_to_pet 会自动处理冲突）
    
    # 3. 检查盾牌（type 3）限制：只能配轻型武器（type 2）和轻型枪械（type 7）
    if item_type == 3:  # 装备盾牌时
        # 检查是否已有重型武器（type 1）或重型枪械（type 6）
        weapon_slot = current_equipment.get('Weapon')
        gun_slot = current_equipment.get('Gun')
        
        if weapon_slot:
            weapon_type = weapon_slot.get('type', 0)
            if weapon_type == 1:  # 重型武器
                return {'success': False, 'error': '盾牌只能配轻型武器，当前已装备重型武器'}
        
        if gun_slot:
            gun_type = gun_slot.get('type', 0)
            if gun_type == 6:  # 重型枪械
                return {'success': False, 'error': '盾牌只能配轻型枪械，当前已装备重型枪械'}
    
    # 4. 检查装备武器/枪械时，如果已有盾牌，则限制
    if item_type in [1, 2, 6, 7]:  # 装备武器/枪械时
        dun_slot = current_equipment.get('Dun')
        if dun_slot:  # 如果已有盾牌
            if item_type == 1:  # 重型武器
                return {'success': False, 'error': '盾牌只能配轻型武器，不能装备重型武器'}
            if item_type == 6:  # 重型枪械
                return {'success': False, 'error': '盾牌只能配轻型枪械，不能装备重型枪械'}
    
    # 5. type 4（Wing）和 type 5（Xinpian）完全通用，无限制
    
    return {'success': True}

# ========== 装备属性计算 ==========
def calculate_total_attributes(pet, equipment_slots: dict) -> dict:
    """
    计算总属性（基础属性 + 装备属性加成）
    网游级实现：用于显示和验证
    
    Args:
        pet: 机甲数据
        equipment_slots: 装备槽位数据
    
    Returns:
        {
            'base_attributes': dict,  # 基础属性
            'equipment_bonus': dict,  # 装备加成
            'total_attributes': dict  # 总属性
        }
    """
    # 基础属性
    base_attributes = {
        'HP': int(pet.get('HP', 0) or 0),
        'MP': int(pet.get('MP', 0) or 0),
        'Melee': int(pet.get('Melee', 0) or 0),
        'Shooting': int(pet.get('Shooting', 0) or 0),
        'Armor': int(pet.get('Armor', 0) or 0),
        'Evasion': int(pet.get('Evasion', 0) or 0),
        'Accuracy': int(pet.get('Accuracy', 0) or 0),
        'Lethality': int(pet.get('Lethality', 0) or 0),
        'Corrosion': int(pet.get('Corrosion', 0) or 0),
        'Resistance': int(pet.get('Resistance', 0) or 0),
        'Initiative': int(pet.get('Initiative', 0) or 0),
        'Counterattack': int(pet.get('Counterattack', 0) or 0),
        'Block': int(pet.get('Block', 0) or 0),
        'ArmorPenetration': int(pet.get('ArmorPenetration', 0) or 0),
        'ParticleShield': int(pet.get('ParticleShield', 0) or 0),
        'EnergyRecovery': int(pet.get('EnergyRecovery', 0) or 0),
        'LifeRecovery': int(pet.get('LifeRecovery', 0) or 0),
        'AttackTimes': int(pet.get('AttackTimes', 0) or 0),
    }
    
    # 装备加成
    equipment_bonus = {
        'HP': 0, 'MP': 0, 'Melee': 0, 'Shooting': 0, 'Armor': 0,
        'Evasion': 0, 'Accuracy': 0, 'Lethality': 0, 'Corrosion': 0,
        'Resistance': 0, 'Initiative': 0, 'Counterattack': 0, 'Block': 0,
        'ArmorPenetration': 0, 'ParticleShield': 0, 'EnergyRecovery': 0,
        'LifeRecovery': 0, 'AttackTimes': 0,
    }
    
    # 属性映射
    attribute_mapping = {
        'hp': 'HP', 'mp': 'MP', 'melee': 'Melee', 'shoot': 'Shooting',
        'armor': 'Armor', 'evasion': 'Evasion', 'accuracy': 'Accuracy',
        'lethality': 'Lethality', 'corrosion': 'Corrosion',
        'resistance': 'Resistance', 'initiative': 'Initiative',
        'counterattack': 'Counterattack', 'block': 'Block',
        'armorPenetration': 'ArmorPenetration', 'particleShield': 'ParticleShield',
        'energyRecovery': 'EnergyRecovery', 'lifeRecovery': 'LifeRecovery',
        'attackTimes': 'AttackTimes'
    }
    
    # 计算所有装备的属性加成
    if equipment_slots:
        for slot_name, equipped_item in equipment_slots.items():
            item_id = equipped_item.get('item_id')
            if not item_id:
                continue
            
            item_config = get_equipment_config(item_id)
            if not item_config:
                continue
            
            # 累加装备属性
            for json_key, db_key in attribute_mapping.items():
                value = item_config.get(json_key, 0)
                if value:
                    equipment_bonus[db_key] += int(value)
    
    # 计算总属性
    total_attributes = {}
    for key in base_attributes:
        total_attributes[key] = base_attributes[key] + equipment_bonus[key]
    
    return {
        'base_attributes': base_attributes,
        'equipment_bonus': equipment_bonus,
        'total_attributes': total_attributes
    }

# ========== 装备操作函数 ==========
async def equip_item_to_pet(item_data: dict, item_id: int, slot_name: str, 
                             user_id, character_id, pet_id: str, effect_manager, add_item_to_inventory_func) -> dict:
    """
    装备物品到机甲的指定槽位（网游级实现：原子操作，确保数据一致性）
    
    策略说明（参考MMO最佳实践）：
    1. 先验证新装备可以装备（等级、属性等）
    2. 先应用新装备属性（如果失败，直接返回，不修改任何数据）
    3. 更新装备槽位（如果失败，回滚属性）
    4. 最后处理旧装备（移除属性、放回背包）
    
    这样确保：
    - 如果新装备失败，旧装备保持不变（避免装备丢失）
    - 如果新装备成功，旧装备会被正确处理
    - 数据一致性得到保证
    
    Args:
        item_data: 装备配置数据
        item_id: 物品ID
        slot_name: 槽位名称（Weapon, Gun, Dun等）
        user_id: 用户ID
        character_id: 角色ID
        pet_id: 机甲ID
        effect_manager: 效果管理器实例
        add_item_to_inventory_func: 添加物品到背包的函数（从bag_handler传入，避免循环依赖）
    
    Returns:
        {'success': bool, 'error': str, 'data': dict}
    """
    # 性能监控：记录开始时间
    start_time = time.time()
    
    try:
        pet_object_id = ObjectId(pet_id)
    except Exception:
        _equipment_operation_stats['equip_errors'] += 1
        return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
    
    # 获取机甲数据
    pet = utils.robotpet_col.find_one({
        '_id': pet_object_id,
        'user_id': user_id,
        'character_id': character_id
    })
    
    if not pet:
        _equipment_operation_stats['equip_errors'] += 1
        return {'success': False, 'error': '机甲不存在'}
    
    # 检查等级要求
    required_level = item_data.get('requiredLevel', 0)
    if required_level > 0:
        pet_level = int(pet.get('Level', 1) or 1)
        if pet_level < required_level:
            _equipment_operation_stats['equip_errors'] += 1
            return {
                'success': False,
                'error': f'机甲等级不足，需要等级 {required_level}，当前等级 {pet_level}'
            }
    
    # 检查装备限制（机甲类型、职业固定搭配、装备冲突等）
    item_type = item_data.get('type', 0)
    restriction_check = validate_equipment_restrictions(
        item_data=item_data,
        item_type=item_type,
        pet=pet,
        current_equipment=pet.get('equipment', {}),
        slot_name=slot_name  # 传入槽位名称，允许自动处理冲突
    )
    if not restriction_check.get('success'):
        _equipment_operation_stats['equip_errors'] += 1
        return {
            'success': False,
            'error': restriction_check.get('error', '装备限制检查失败')
        }
    
    # 数据一致性检查：验证当前装备数据
    current_equipment = pet.get('equipment', {})
    integrity_check = validate_equipment_integrity(pet, current_equipment)
    if not integrity_check['valid']:
        print(f'⚠️ [EquipmentHandler] 装备数据完整性检查失败: {integrity_check["errors"]}')
        # 如果数据损坏，尝试修复
        if integrity_check['fixed_slots'] != current_equipment:
            print(f'🔄 [EquipmentHandler] 自动修复装备数据')
            utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
                {'$set': {'equipment': integrity_check['fixed_slots']}}
            )
            current_equipment = integrity_check['fixed_slots']
    
    # 获取当前装备槽位数据（使用修复后的数据）
    equipment_slots = current_equipment if integrity_check['valid'] else integrity_check['fixed_slots']
    if not isinstance(equipment_slots, dict):
        equipment_slots = {}
    
    # 网游级最佳实践：先验证，再执行，确保原子性
    # 策略：先应用新装备属性，成功后再处理旧装备，避免装备丢失
    
    # 第一步：处理武器/枪械互斥（装备武器时自动卸下枪械，装备枪械时自动卸下武器）
    # 注意：限制检查已经阻止了同时装备，但为了确保数据一致性，这里主动处理互斥槽位
    conflicting_slot = None
    conflicting_equipment = None
    if slot_name == 'Weapon':
        # 装备武器时，检查Gun槽位是否有装备
        conflicting_slot = 'Gun'
        conflicting_equipment = equipment_slots.get('Gun')
    elif slot_name == 'Gun':
        # 装备枪械时，检查Weapon槽位是否有装备
        conflicting_slot = 'Weapon'
        conflicting_equipment = equipment_slots.get('Weapon')
    
    # 如果存在冲突槽位的装备，先处理它（移除属性、放回背包）
    if conflicting_slot and conflicting_equipment:
        conflicting_item_id = conflicting_equipment.get('item_id')
        conflicting_item_data = get_equipment_config(conflicting_item_id) if conflicting_item_id else None
        
        print(f'🔄 [EquipmentHandler] 检测到武器/枪械互斥：装备 {slot_name} 时，自动卸下 {conflicting_slot} 槽位的装备 {conflicting_item_id}')
        
        # 移除冲突装备的属性
        if conflicting_item_data:
            try:
                remove_result = await remove_equipment_attributes(
                    item_data=conflicting_item_data,
                    user_id=user_id,
                    character_id=character_id,
                    pet_id=pet_id,
                    effect_manager=effect_manager
                )
                if remove_result.get('success'):
                    print(f'✅ [EquipmentHandler] 冲突装备 {conflicting_item_id} 属性已移除')
                else:
                    print(f'⚠️ [EquipmentHandler] 移除冲突装备 {conflicting_item_id} 属性失败: {remove_result.get("error")}')
            except Exception as e:
                print(f'⚠️ [EquipmentHandler] 移除冲突装备属性时出错: {e}')
        
        # 将冲突装备放回背包
        if conflicting_item_id:
            try:
                add_result = await add_item_to_inventory_func(
                    user_id=user_id,
                    character_id=character_id,
                    item_id=conflicting_item_id,
                    quantity=1
                )
                if add_result and isinstance(add_result, dict) and add_result.get('success') and add_result.get('added'):
                    print(f'✅ [EquipmentHandler] 冲突装备 {conflicting_item_id} 已放回背包')
                else:
                    error_msg = add_result.get('error', '未知错误') if isinstance(add_result, dict) else '返回无效值'
                    print(f'❌ [EquipmentHandler] 将冲突装备 {conflicting_item_id} 放回背包失败: {error_msg}')
            except Exception as e:
                print(f'❌ [EquipmentHandler] 将冲突装备放回背包时出错: {e}')
        
        # 从装备槽位中移除冲突装备
        equipment_slots.pop(conflicting_slot, None)
    
    # 第二步：保存目标槽位的旧装备信息（用于后续处理）
    old_equipment = equipment_slots.get(slot_name)
    old_item_id = old_equipment.get('item_id') if old_equipment else None
    old_item_data = None
    
    # 第三步：如果有旧装备，加载旧装备数据（用于后续移除属性）
    # 网游级优化：使用缓存快速查找
    if old_item_id:
        old_item_data = get_equipment_config(old_item_id)
        if not old_item_data:
            print(f'⚠️ [EquipmentHandler] 警告：旧装备 {old_item_id} 数据不存在，但继续执行装备流程')
    
    # 第四步：先应用新装备的属性加成（关键：在修改槽位之前）
    # 如果这一步失败，直接返回，不修改任何数据（旧装备保持不变）
    apply_result = await effect_manager.apply_equipment_attributes(
        item_data=item_data,
        user_id=user_id,
        character_id=character_id,
        pet_id=pet_id,
        item_id=item_id
    )
    
    if not apply_result.get('success'):
        # 属性应用失败，直接返回，不修改任何数据
        _equipment_operation_stats['equip_errors'] += 1
        return {
            'success': False,
            'error': apply_result.get('error', '装备属性应用失败')
        }
    
    # 第五步：更新装备槽位（属性已应用成功，现在更新槽位）
    # 创建新的装备槽位数据（避免直接修改原字典）
    new_equipment_slots = equipment_slots.copy()
    # 确保冲突槽位被移除（如果存在）
    if conflicting_slot:
        new_equipment_slots.pop(conflicting_slot, None)
    # 更新目标槽位
    new_equipment_slots[slot_name] = {
        'item_id': item_id,
        'name': item_data.get('name', ''),
        'type': item_data.get('type', 0)
    }
    
    # 更新数据库：保存装备槽位数据
    update_result = utils.robotpet_col.update_one(
        {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
        {'$set': {'equipment': new_equipment_slots}}
    )
    
    if update_result.matched_count == 0:
        # 更新失败，需要回滚属性
        _equipment_operation_stats['equip_errors'] += 1
        print(f'❌ [EquipmentHandler] 更新装备槽位失败，回滚新装备属性')
        try:
            # 回滚新装备的属性
            await remove_equipment_attributes(
                item_data=item_data,
                user_id=user_id,
                character_id=character_id,
                pet_id=pet_id,
                effect_manager=effect_manager
            )
        except Exception as e:
            print(f'❌ [EquipmentHandler] 回滚属性失败: {e}')
        return {
            'success': False,
            'error': '更新装备槽位失败，已回滚属性'
        }
    
    # 第六步：处理旧装备（新装备已成功装备，现在处理旧装备）
    # 这一步即使失败，也不影响新装备的装备状态（因为新装备已经成功）
    # 关键修复：只要有 old_item_id，就必须放回背包，即使 old_item_data 获取失败
    if old_item_id:
        print(f'🔄 [EquipmentHandler] 开始处理旧装备 {old_item_id}（放回背包）')
        
        # 如果有旧装备数据，先移除属性
        if old_item_data:
            try:
                # 移除旧装备的属性加成
                remove_result = await remove_equipment_attributes(
                    item_data=old_item_data,
                    user_id=user_id,
                    character_id=character_id,
                    pet_id=pet_id,
                    effect_manager=effect_manager
                )
                if not remove_result.get('success'):
                    print(f'⚠️ [EquipmentHandler] 移除旧装备 {old_item_id} 属性失败: {remove_result.get("error")}')
                    # 继续执行，将旧装备放回背包
                else:
                    print(f'✅ [EquipmentHandler] 旧装备 {old_item_id} 属性已移除')
            except Exception as e:
                print(f'⚠️ [EquipmentHandler] 移除旧装备属性时出错: {e}，但继续放回背包')
        else:
            print(f'⚠️ [EquipmentHandler] 旧装备 {old_item_id} 数据不存在，跳过属性移除，直接放回背包')
        
        # 将旧装备放回背包（关键：无论属性移除是否成功，都必须放回背包）
        add_result = await add_item_to_inventory_func(
            user_id=user_id,
            character_id=character_id,
            item_id=old_item_id,
            quantity=1
        )
        
        # 关键修复：确保 add_result 不为 None
        if add_result and isinstance(add_result, dict):
            if add_result.get('success') and add_result.get('added'):
                print(f'✅ [EquipmentHandler] 旧装备 {old_item_id} 已成功放回背包')
            else:
                error_msg = add_result.get('error', '未知错误')
                print(f'❌ [EquipmentHandler] 将旧装备 {old_item_id} 放回背包失败: {error_msg}')
                import traceback
                traceback.print_exc()
                # 这是一个严重错误，但新装备已经装备成功
                # 记录错误，但不影响新装备的装备状态
        else:
            print(f'❌ [EquipmentHandler] 将旧装备 {old_item_id} 放回背包失败: add_item_to_inventory_func 返回了无效值')
            import traceback
            traceback.print_exc()
    else:
        print(f'ℹ️ [EquipmentHandler] 槽位 {slot_name} 之前没有装备，无需处理旧装备')
    
    # 性能监控：记录成功
    elapsed_time = time.time() - start_time
    _equipment_operation_stats['equip_count'] += 1
    _equipment_operation_stats['total_time'] += elapsed_time
    
    # 计算总属性（用于验证）
    total_attrs = calculate_total_attributes(pet, new_equipment_slots)
    
    return {
        'success': True,
        'message': f'装备成功：{item_data.get("name", "")} 已装备到 {slot_name} 槽位',
        'data': {
            'pet_id': pet_id,
            'slot_name': slot_name,
            'item_id': item_id,
            'item_name': item_data.get('name', ''),
            'old_equipment': old_equipment,
            'applied_attributes': apply_result.get('data', {}).get('applied_attributes', {}),
            'total_attributes': total_attrs['total_attributes'],  # 总属性（用于客户端显示）
            'performance': {
                'elapsed_time_ms': round(elapsed_time * 1000, 2)
            }
        }
    }

async def remove_equipment_attributes(item_data: dict, user_id, character_id, 
                                      pet_id: str, effect_manager) -> dict:
    """
    移除装备的属性加成（卸下装备时调用）
    
    Args:
        item_data: 装备配置数据
        user_id: 用户ID
        character_id: 角色ID
        pet_id: 机甲ID
        effect_manager: 效果管理器实例
    
    Returns:
        {'success': bool, 'error': str}
    """
    try:
        pet_object_id = ObjectId(pet_id)
    except Exception:
        return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}
    
    # 获取机甲数据
    pet = utils.robotpet_col.find_one({
        '_id': pet_object_id,
        'user_id': user_id,
        'character_id': character_id
    })
    
    if not pet:
        return {'success': False, 'error': '机甲不存在'}
    
    # 属性映射（与apply_equipment_attributes中的一致）
    attribute_mapping = {
        'hp': 'HP',
        'mp': 'MP',
        'melee': 'Melee',
        'shoot': 'Shooting',
        'armor': 'Armor',
        'evasion': 'Evasion',
        'accuracy': 'Accuracy',
        'lethality': 'Lethality',
        'corrosion': 'Corrosion',
        'resistance': 'Resistance',
        'initiative': 'Initiative',
        'counterattack': 'Counterattack',
        'block': 'Block',
        'armorPenetration': 'ArmorPenetration',
        'particleShield': 'ParticleShield',
        'energyRecovery': 'EnergyRecovery',
        'lifeRecovery': 'LifeRecovery',
        'attackTimes': 'AttackTimes'
    }
    
    # 收集需要移除的属性
    attribute_updates = {}
    removed_attrs = {}
    
    for json_key, db_key in attribute_mapping.items():
        value = item_data.get(json_key, 0)
        if value and int(value) > 0:
            # 获取当前值
            current_value = int(pet.get(db_key, 0) or 0)
            # 减去装备的属性值
            new_value = max(0, current_value - int(value))  # 确保不为负
            attribute_updates[db_key] = new_value
            removed_attrs[db_key] = int(value)
            
            # 同时更新Current前缀的字段（除了HP和MP）
            if json_key not in ['hp', 'mp']:
                current_field = f'Current{db_key}'
                current_current_value = int(pet.get(current_field, 0) or 0)
                attribute_updates[current_field] = max(0, current_current_value - int(value))
    
    # 特殊处理HP和MP
    if 'HP' in attribute_updates:
        max_hp = attribute_updates['HP']
        current_hp = int(pet.get('CurrentHP', max_hp) or max_hp)
        # 确保CurrentHP不超过MaxHP
        attribute_updates['CurrentHP'] = min(current_hp, max_hp)
        attribute_updates['MaxHP'] = max_hp
    
    if 'MP' in attribute_updates:
        max_mp = attribute_updates['MP']
        current_mp = int(pet.get('CurrentMP', max_mp) or max_mp)
        # 确保CurrentMP不超过MaxMP
        attribute_updates['CurrentMP'] = min(current_mp, max_mp)
        attribute_updates['MaxMP'] = max_mp
    
    if not attribute_updates:
        return {'success': True, 'message': '装备无属性加成，无需移除'}
    
    # 更新数据库
    utils.robotpet_col.update_one(
        {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
        {'$set': attribute_updates}
    )
    
    return {
        'success': True,
        'message': '装备属性已移除',
        'data': {
            'removed_attributes': removed_attrs,
            'updated_attributes': attribute_updates
        }
    }


# 卸下槽位时的推荐顺序（先卸配件再卸武器位，减少互斥中间态）
_STRIP_SLOT_ORDER = [
    'Toukai', 'Jianjia', 'Xiongkai', 'Tuikai', 'Shoukai', 'Xinpian', 'Wing', 'Dun', 'Gun', 'Weapon',
]


def list_invalid_equipment_slots(pet: dict) -> list:
    """
    列出当前机甲上「不应再保留」的槽位：等级不足、职业/体型限制不满足、
    配置缺失、槽位数据损坏、武器+枪械互斥双持等。
    """
    equipment_slots = pet.get('equipment') or {}
    if not isinstance(equipment_slots, dict) or not equipment_slots:
        return []
    pet_level = int(pet.get('Level', 1) or 1)
    invalid = set()
    # 武器与枪械互斥：优先标记卸下 Gun（保留 Weapon，避免一次卸两件）
    if equipment_slots.get('Weapon') and equipment_slots.get('Gun'):
        invalid.add('Gun')
    for slot_name, equipped_item in list(equipment_slots.items()):
        if not isinstance(equipped_item, dict):
            invalid.add(slot_name)
            continue
        item_id = equipped_item.get('item_id')
        if not item_id:
            invalid.add(slot_name)
            continue
        try:
            iid = int(item_id)
        except (TypeError, ValueError):
            invalid.add(slot_name)
            continue
        cfg = get_equipment_config(iid)
        if not cfg:
            invalid.add(slot_name)
            continue
        try:
            req_lv = int(cfg.get('requiredLevel', 0) or 0)
        except (TypeError, ValueError):
            req_lv = 0
        if req_lv > 0 and pet_level < req_lv:
            invalid.add(slot_name)
            continue
        try:
            item_type = int(cfg.get('type', 0) or 0)
        except (TypeError, ValueError):
            item_type = 0
        others = {k: v for k, v in equipment_slots.items() if k != slot_name}
        vr = validate_equipment_restrictions(cfg, item_type, pet, others, slot_name)
        if not vr.get('success'):
            invalid.add(slot_name)

    def _key(sn: str):
        try:
            return _STRIP_SLOT_ORDER.index(sn)
        except ValueError:
            return 99

    return sorted(invalid, key=_key)


def _equipment_item_id_raw(equipped_item: dict):
    """槽位内物品 ID（兼容 item_id / itemId）。"""
    if not isinstance(equipped_item, dict):
        return None
    rid = equipped_item.get('item_id')
    if rid is not None and rid != '':
        return rid
    return equipped_item.get('itemId')


def _slot_has_strip_candidate(v) -> bool:
    """槽位是否仍有可交给 unequip 处理的装备条目（非空 item_id / itemId 字符串）。"""
    if not isinstance(v, dict) or not v:
        return False
    rid = _equipment_item_id_raw(v)
    if rid is None:
        return False
    return str(rid).strip() != ''


def _prune_empty_equipment_slots(equipment_slots: dict) -> dict:
    """去掉空值、非 dict、无有效 item_id 的槽键，避免 strip_all 在同一幽灵键上死循环。"""
    if not isinstance(equipment_slots, dict) or not equipment_slots:
        return {}
    out = {}
    for slot_name, v in equipment_slots.items():
        if _slot_has_strip_candidate(v):
            out[slot_name] = v
    return out


def _pick_next_strip_slot(eq: dict) -> Optional[str]:
    """优先按卸下顺序选下一个仍有有效装备的槽位。"""
    if not isinstance(eq, dict) or not eq:
        return None
    for sn in _STRIP_SLOT_ORDER:
        if sn not in eq:
            continue
        v = eq[sn]
        if _slot_has_strip_candidate(v):
            return sn
    for k, v in eq.items():
        if k in _STRIP_SLOT_ORDER:
            continue
        if _slot_has_strip_candidate(v):
            return k
    # 仅剩无有效 item 的键：任取一键交给 unequip 做 DB 清理
    return next(iter(eq.keys()), None)


async def unequip_slot_to_bag(
    user_id,
    character_id: str,
    pet_id: str,
    slot_name: str,
    add_item_to_inventory_func,
) -> dict:
    """单槽卸下：移除属性、清空槽位、物品进背包（与 bag_handler.handle_unequip_item 一致的核心逻辑）。"""
    try:
        pet_object_id = ObjectId(pet_id)
    except Exception:
        return {'success': False, 'error': f'无效的机甲ID: {pet_id}'}

    pet = utils.robotpet_col.find_one({
        '_id': pet_object_id,
        'user_id': user_id,
        'character_id': character_id,
    })
    if not pet:
        return {'success': False, 'error': '机甲不存在'}

    equipment_slots = pet.get('equipment', {})
    if not isinstance(equipment_slots, dict):
        equipment_slots = {}
    equipped_item = equipment_slots.get(slot_name)
    if not equipped_item:
        if slot_name in equipment_slots:
            equipment_slots = dict(equipment_slots)
            equipment_slots.pop(slot_name, None)
            utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
                {'$set': {'equipment': equipment_slots}},
            )
        return {'success': True, 'skipped': True, 'message': '槽位为空'}

    if not isinstance(equipped_item, dict):
        equipment_slots = dict(equipment_slots)
        equipment_slots.pop(slot_name, None)
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': {'equipment': equipment_slots}},
        )
        return {'success': True, 'skipped': True, 'message': '槽位数据已清除'}

    item_id = _equipment_item_id_raw(equipped_item)
    if not item_id:
        equipment_slots.pop(slot_name, None)
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': {'equipment': equipment_slots}},
        )
        return {'success': True, 'message': '已清除无效槽位数据'}

    try:
        item_id_int = int(item_id)
    except (TypeError, ValueError):
        equipment_slots.pop(slot_name, None)
        utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
            {'$set': {'equipment': equipment_slots}},
        )
        return {'success': True, 'message': '已清除无效 item_id'}

    item_data = get_equipment_config(item_id_int)
    from .item_effect import get_effect_manager
    effect_manager = get_effect_manager()

    if item_data:
        remove_result = await remove_equipment_attributes(
            item_data=item_data,
            user_id=user_id,
            character_id=character_id,
            pet_id=pet_id,
            effect_manager=effect_manager,
        )
        if not remove_result.get('success'):
            return {'success': False, 'error': remove_result.get('error', '移除装备属性失败')}

    pet_after = utils.robotpet_col.find_one({
        '_id': pet_object_id,
        'user_id': user_id,
        'character_id': character_id,
    })
    eq2 = (pet_after or pet).get('equipment', {}) or {}
    if not isinstance(eq2, dict):
        eq2 = {}
    eq2 = dict(eq2)
    eq2.pop(slot_name, None)
    utils.robotpet_col.update_one(
        {'_id': pet_object_id, 'user_id': user_id, 'character_id': character_id},
        {'$set': {'equipment': eq2}},
    )

    add_result = await add_item_to_inventory_func(user_id, character_id, item_id_int, 1)
    if not add_result or not add_result.get('success'):
        err = (add_result or {}).get('error', '放回背包失败')
        print(f'❌ [EquipmentHandler] 卸下 {slot_name} 后物品 {item_id_int} 入包失败: {err}')
        return {'success': False, 'error': err}

    return {'success': True, 'slot_name': slot_name, 'item_id': item_id_int}


async def strip_all_equipment_to_bag(user_id, character_id: str, pet_id: str, add_item_to_inventory_func) -> dict:
    """卸下该机甲全部已装备物品并放入背包。"""
    try:
        _pet_oid = ObjectId(pet_id)
    except Exception:
        return {'success': False, 'error': '无效的机甲ID', 'stripped_slots': []}
    stripped_slots = []
    max_rounds = 32
    for _ in range(max_rounds):
        pet = utils.robotpet_col.find_one({
            '_id': _pet_oid,
            'user_id': user_id,
            'character_id': character_id,
        })
        if not pet:
            return {'success': False, 'error': '机甲不存在', 'stripped_slots': stripped_slots}
        eq_raw = pet.get('equipment') or {}
        if not isinstance(eq_raw, dict):
            eq_raw = {}
        pruned = _prune_empty_equipment_slots(eq_raw)
        if pruned != eq_raw:
            utils.robotpet_col.update_one(
                {'_id': _pet_oid, 'user_id': user_id, 'character_id': character_id},
                {'$set': {'equipment': pruned}},
            )
        eq = pruned
        if not eq:
            return {'success': True, 'stripped_slots': stripped_slots}
        slot_name = _pick_next_strip_slot(eq)
        if not slot_name:
            return {'success': True, 'stripped_slots': stripped_slots}
        r = await unequip_slot_to_bag(user_id, character_id, pet_id, slot_name, add_item_to_inventory_func)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', '卸下失败'), 'stripped_slots': stripped_slots}
        if not r.get('skipped'):
            stripped_slots.append(slot_name)
    return {'success': False, 'error': '卸下装备次数异常', 'stripped_slots': stripped_slots}


async def strip_invalid_equipment_for_pet(user_id, character_id: str, pet_id: str, add_item_to_inventory_func) -> dict:
    """仅卸下不再满足等级/职业/规则或损坏的槽位；每卸一件后重新校验直至无违规。"""
    try:
        ObjectId(pet_id)
    except Exception:
        return {'success': False, 'error': '无效的机甲ID', 'stripped_slots': []}
    stripped = []
    for _ in range(32):
        pet = utils.robotpet_col.find_one({
            '_id': ObjectId(pet_id),
            'user_id': user_id,
            'character_id': character_id,
        })
        if not pet:
            return {'success': False, 'error': '机甲不存在', 'stripped_slots': stripped}
        invalid = list_invalid_equipment_slots(pet)
        if not invalid:
            return {'success': True, 'stripped_slots': stripped}
        slot_name = invalid[0]
        r = await unequip_slot_to_bag(user_id, character_id, pet_id, slot_name, add_item_to_inventory_func)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error', '卸下失败'), 'stripped_slots': stripped}
        if not r.get('skipped'):
            stripped.append(slot_name)
    return {'success': False, 'error': '卸下违规装备次数过多', 'stripped_slots': stripped}


# ========== 装备系统扩展接口（预留）==========
class EquipmentExtension:
    """装备系统扩展接口（套装、强化、镶嵌等）"""
    
    @staticmethod
    def calculate_set_bonus(equipment_slots: dict) -> dict:
        """
        计算套装效果（预留接口）
        
        Args:
            equipment_slots: 装备槽位数据
        
        Returns:
            {
                'set_name': str,  # 套装名称
                'set_count': int,  # 套装件数
                'bonus_attributes': dict  # 套装加成属性
            }
        """
        # TODO: 实现套装效果计算
        return {
            'set_name': None,
            'set_count': 0,
            'bonus_attributes': {}
        }
    
    @staticmethod
    def calculate_enhancement_bonus(item_id: int, enhancement_level: int) -> dict:
        """
        计算强化加成（预留接口）
        
        Args:
            item_id: 装备ID
            enhancement_level: 强化等级
        
        Returns:
            {
                'enhancement_level': int,
                'bonus_attributes': dict  # 强化加成属性
            }
        """
        # TODO: 实现强化加成计算
        return {
            'enhancement_level': enhancement_level,
            'bonus_attributes': {}
        }
    
    @staticmethod
    def calculate_socket_bonus(item_id: int, socket_items: list) -> dict:
        """
        计算镶嵌加成（预留接口）
        
        Args:
            item_id: 装备ID
            socket_items: 镶嵌物品列表
        
        Returns:
            {
                'socket_count': int,
                'bonus_attributes': dict  # 镶嵌加成属性
            }
        """
        # TODO: 实现镶嵌加成计算
        return {
            'socket_count': len(socket_items) if socket_items else 0,
            'bonus_attributes': {}
        }

# ========== 性能统计 ==========
def get_equipment_stats() -> dict:
    """获取装备系统性能统计"""
    return _equipment_operation_stats.copy()

def reset_equipment_stats():
    """重置性能统计"""
    global _equipment_operation_stats
    _equipment_operation_stats = {
        'equip_count': 0,
        'unequip_count': 0,
        'equip_errors': 0,
        'unequip_errors': 0,
        'total_time': 0.0,
    }

def update_unequip_stats(elapsed_time: float = 0.0, is_error: bool = False):
    """更新卸下装备统计"""
    global _equipment_operation_stats
    if is_error:
        _equipment_operation_stats['unequip_errors'] += 1
    else:
        _equipment_operation_stats['unequip_count'] += 1
        _equipment_operation_stats['total_time'] += elapsed_time

