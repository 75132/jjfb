"""
角色相关操作处理器
处理：get_all_characters, get_character_info, select_character, create_character, delete_character
"""
import json
import uuid
import datetime
import random
import asyncio
from . import utils

# 需要从ws_server导入的函数（通过参数传递）
_create_robot_pet = None
_broadcast_to_user_async = None

def init_character_handler(create_robot_pet_func, broadcast_func):
    """初始化角色处理器需要的函数"""
    global _create_robot_pet, _broadcast_to_user_async
    _create_robot_pet = create_robot_pet_func
    _broadcast_to_user_async = broadcast_func

def create_robot_pet(user_id, character_id, base_robot):
    """创建单个机甲宠物（从ws_server导入）"""
    if _create_robot_pet:
        return _create_robot_pet(user_id, character_id, base_robot)
    # 如果未初始化，使用utils中的实现（与ws_server.py保持一致）
    import random
    robot_base_id = str(base_robot.get('_id'))
    
    # 初始化星级、成长值和悟性值（参考RPG Maker机制）
    star_level = 1
    
    # 为每个机甲生成一个独特的成长值（5到15之间的随机值）
    unique_growth_value = random.uniform(5, 15)
    
    # 随机选择是否使用指定的数据组（5%概率使用特殊数据组，95%使用随机值）
    use_special_values = random.random() < 0.05
    
    if use_special_values:
        # 按概率选择特定的数据组
        special_case = random.random()
        if special_case < 0.35:
            growth = 100
            comprehension = 100
        elif special_case < 0.65:
            growth = 80
            comprehension = 100
        elif special_case < 0.75:
            growth = 60
            comprehension = 80
        else:
            growth = 100
            comprehension = 80
    else:
        # 95%的概率使用随机值（50-100）
        growth = random.randint(50, 100)
        comprehension = random.randint(50, 100)
    
    robot_pet = {}
    for key, value in base_robot.items():
        if key != '_id':
            robot_pet[key] = value
    robot_pet.update({
        'user_id': user_id,
        'character_id': character_id,
        'robot_base_id': robot_base_id,
        'Growth': growth,
        'Comprehension': comprehension,
        'Level': 1,
        'StarLevel': star_level,
        'UniqueGrowthValue': unique_growth_value,  # 独特的成长值
        'EXP': 0,
        'CurrentEXP': 0,
        'created_at': datetime.datetime.utcnow()
    })
    if 'CurrentHP' not in robot_pet or robot_pet.get('CurrentHP') is None:
        robot_pet['CurrentHP'] = robot_pet.get('MaxHP', robot_pet.get('HP', 1000))
    if 'CurrentMP' not in robot_pet or robot_pet.get('CurrentMP') is None:
        robot_pet['CurrentMP'] = robot_pet.get('MaxMP', robot_pet.get('MP', 300))
    current_field_mappings = {
        'CurrentMelee': 'Melee', 'CurrentArmor': 'Armor', 'CurrentAccuracy': 'Accuracy',
        'CurrentCorrosion': 'Corrosion', 'CurrentInitiative': 'Initiative', 'CurrentBlock': 'Block',
        'CurrentParticleShield': 'ParticleShield', 'CurrentArmorPenetration': 'ArmorPenetration',
        'CurrentShooting': 'Shooting', 'CurrentEvasion': 'Evasion', 'CurrentLethality': 'Lethality',
        'CurrentResistance': 'Resistance', 'CurrentCounterattack': 'Counterattack'
    }
    for current_key, base_key in current_field_mappings.items():
        if current_key not in robot_pet or robot_pet.get(current_key) is None:
            robot_pet[current_key] = robot_pet.get(base_key, 0)
    
    # 第五步：属性随机化（±2%到±5%），让每个机甲独一无二
    # 生成随机系数（0.95 到 1.05，即 ±5%）
    random_factor = random.uniform(0.95, 1.05)
    
    # 需要随机化的属性列表（所有战斗属性）
    randomize_attrs = [
        'HP', 'MaxHP', 'MP', 'MaxMP',
        'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
        'Lethality', 'Corrosion', 'Resistance', 'Initiative',
        'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
        'CurrentMelee', 'CurrentShooting', 'CurrentArmor', 'CurrentEvasion',
        'CurrentAccuracy', 'CurrentLethality', 'CurrentCorrosion', 'CurrentResistance',
        'CurrentInitiative', 'CurrentCounterattack', 'CurrentBlock',
        'CurrentArmorPenetration', 'CurrentParticleShield'
    ]
    
    # 应用随机化
    for attr in randomize_attrs:
        if attr in robot_pet and isinstance(robot_pet[attr], (int, float)) and robot_pet[attr] > 0:
            original_value = robot_pet[attr]
            randomized_value = int(original_value * random_factor)
            robot_pet[attr] = max(1, randomized_value)  # 确保至少为1
    
    # 确保CurrentHP和CurrentMP与MaxHP和MaxMP一致（随机化后）
    if 'MaxHP' in robot_pet:
        robot_pet['CurrentHP'] = robot_pet['MaxHP']
    if 'MaxMP' in robot_pet:
        robot_pet['CurrentMP'] = robot_pet['MaxMP']
    
    # 第六步：保存1级备份（RobotPet_backup）- 进入背包时的1级状态
    # 备份所有属性值（包括随机化后的值）
    robot_pet_backup = {}
    backup_fields = [
        'HP', 'MaxHP', 'CurrentHP', 'MP', 'MaxMP', 'CurrentMP',
        'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
        'Lethality', 'Corrosion', 'Resistance', 'Initiative',
        'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
        'CurrentMelee', 'CurrentShooting', 'CurrentArmor', 'CurrentEvasion',
        'CurrentAccuracy', 'CurrentLethality', 'CurrentCorrosion', 'CurrentResistance',
        'CurrentInitiative', 'CurrentCounterattack', 'CurrentBlock',
        'CurrentArmorPenetration', 'CurrentParticleShield',
        'Growth', 'Comprehension', 'StarLevel', 'Level', 'EXP',
        'RobotID', 'RobotName', 'Class', 'Form', 'AniID'
    ]
    
    for field in backup_fields:
        if field in robot_pet:
            robot_pet_backup[field] = robot_pet[field]
    
    robot_pet['RobotPet_backup'] = robot_pet_backup
    
    # 第七步：分配 slot_index（1-10，可空）
    # 关键优化：自动分配编号，便于排序和自动出战
    if character_id:  # 只有有角色ID的机甲才分配编号
        slot_index = utils.allocate_slot_index(user_id, character_id)
        if slot_index is not None:
            robot_pet['slot_index'] = slot_index
            print(f'✅ [create_robot_pet] 机甲 {robot_pet.get("RobotName", "")} 分配编号: {slot_index}')
        else:
            print(f'⚠️ [create_robot_pet] 机甲 {robot_pet.get("RobotName", "")} 编号已满（1-10），无法分配编号')
    
    utils.safe_mongo_operation(lambda: utils.robotpet_col.insert_one(robot_pet))
    return robot_pet


async def handle_get_all_characters(websocket, data, current_user_id, current_character_id):
    """处理获取所有角色信息请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'all_characters_response',
            'success': False,
            'message': '用户不存在或未登录'
        }, request_data=data)
        return current_user_id, current_character_id
    
    # 一次性查询所有3个槽位的角色数据（性能优化：一次查询获取所有数据，MMO级优化：异步查询）
    # 使用字段投影，只查询需要的字段，减少数据传输量
    all_docs = await utils.async_mongo_operation(
        lambda: list(utils.players_col.find(
            {'user_id': user['_id'], 'slot_index': {'$in': [0, 1, 2]}},
            {
                'slot_index': 1, 'character_id': 1, 'role_name': 1, 'Sprite': 1,
                'gold': 1, 'level': 1, 'exp': 1, 'energy_blocks': 1, 'points': 1, 'alliance': 1,
                'record': 1, 'robotcount': 1, 'position': 1, 'rank': 1, 'friend_id': 1
            }
        )),
        timeout=2.0
    ) or []
    characters_data = {}
    
    # 批量收集所有需要计算robotcount的character_id（性能优化：减少数据库查询）
    character_ids_to_count = []
    docs_to_update = []
    
    # 处理每个槽位
    for slot_index in range(3):
        doc = next((d for d in all_docs if d.get('slot_index') == slot_index), None)
        
        if not doc:
            # 兼容旧数据：从users.characters迁移
            chars = user.get('characters', [None, None, None])
            while len(chars) < 3:
                chars.append(None)
            ch = chars[slot_index] if 0 <= slot_index < len(chars) else None
            if ch:
                try:
                    await utils.async_mongo_operation(
                        lambda: utils.players_col.update_one(
                            {'user_id': user['_id'], 'slot_index': slot_index},
                            {'$setOnInsert': {
                                'user_id': user['_id'],
                                'slot_index': slot_index,
                                'character_id': ch.get('character_id'),
                                'role_name': ch.get('role_name', ''),
                                'class': ch.get('class', 1),
                                'Sprite': ch.get('Sprite', 0),
                                'gold': ch.get('gold', 0),
                                'level': ch.get('level', 1),
                                'exp': ch.get('exp', 0),
                                'energy_blocks': utils.normalize_energy_blocks(ch.get('energy_blocks', ch.get('points', 0))),
                                'alliance': ch.get('alliance', ''),
                                'record': ch.get('record', ''),
                                'robotcount': ch.get('robotcount', 0),
                                'position': ch.get('position', {}),
                                'rank': ch.get('rank', ''),
                                'items': {}
                            }},
                            upsert=True
                        ),
                        timeout=2.0
                    )
                    doc = await utils.async_mongo_operation(
                        lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}),
                        timeout=2.0
                    )
                except Exception as e:
                    print(f'迁移旧角色数据失败 (slot {slot_index}):', e)
        
        if not doc:
            characters_data[slot_index] = {
                'slot_index': slot_index,
                'role_name': '',
                'Sprite': 0
            }
        else:
            # 检查数据完整性
            incomplete = (not doc.get('character_id')) or (not doc.get('role_name')) or (doc.get('Sprite', 0) in [0, '0'])
            if incomplete:
                chars = user.get('characters', [None, None, None])
                while len(chars) < 3:
                    chars.append(None)
                ch = chars[slot_index] if 0 <= slot_index < len(chars) else None
                if ch:
                    try:
                        utils.players_col.update_one(
                            {'user_id': user['_id'], 'slot_index': slot_index},
                            {'$set': {
                                'character_id': ch.get('character_id'),
                                'role_name': ch.get('role_name', ''),
                                'class': ch.get('class', 1),
                                'Sprite': ch.get('Sprite', 0),
                                'gold': ch.get('gold', 0),
                                'level': ch.get('level', 1),
                                'exp': ch.get('exp', 0),
                                'energy_blocks': utils.normalize_energy_blocks(ch.get('energy_blocks', ch.get('points', 0))),
                                'alliance': ch.get('alliance', ''),
                                'record': ch.get('record', ''),
                                'robotcount': ch.get('robotcount', 0),
                                'position': ch.get('position', {}),
                                'rank': ch.get('rank', ''),
                                'friend_id': doc.get('friend_id') or utils.generate_friend_id()
                            }}
                        )
                        doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}))
                    except Exception as e:
                        print(f'补齐玩家角色数据失败 (slot {slot_index}):', e)
            
            if doc:
                current_character_id = doc.get('character_id')
                if current_character_id:
                    character_ids_to_count.append((slot_index, doc['_id'], current_character_id))
                
                # 先使用数据库中的robotcount，稍后批量更新
                characters_data[slot_index] = {
                    'slot_index': slot_index,
                    'role_name': doc.get('role_name', ''),
                    'Sprite': doc.get('Sprite', 0),
                    'gold': doc.get('gold', 0),
                    'level': doc.get('level', 1),
                    'energy_blocks': utils.get_energy_blocks_for_response(doc),
                    'alliance': doc.get('alliance', ''),
                    'record': doc.get('record', ''),
                    'robotcount': doc.get('robotcount', 0),  # 先使用旧值
                    'position': doc.get('position', {}),
                    'rank': doc.get('rank', ''),
                    'user_id': str(user['_id']),
                    'character_id': current_character_id,
                    'friend_id': doc.get('friend_id')
                }
            else:
                characters_data[slot_index] = {
                    'slot_index': slot_index,
                    'role_name': '',
                    'Sprite': 0
                }
    
    # 网游级优化：批量计算所有角色的robotcount（减少数据库查询次数）
    if character_ids_to_count:
        # 批量查询所有角色的机甲数量
        character_ids_list = [cid for _, _, cid in character_ids_to_count]
        
        # 检查缓存（网游级优化）
        cache_key = f"robot_counts_{user['_id']}_{','.join(character_ids_list)}"
        cached_counts = utils.get_cached_query(cache_key)
        
        if cached_counts:
            robot_counts = cached_counts
        else:
            robot_counts = {}
            try:
                # 使用聚合查询批量统计每个角色的机甲数量
                pipeline = [
                    {'$match': {'user_id': user['_id'], 'character_id': {'$in': character_ids_list}}},
                    {'$group': {'_id': '$character_id', 'count': {'$sum': 1}}}
                ]
                robot_counts_result = await utils.async_mongo_operation(
                    lambda: list(utils.robotpet_col.aggregate(pipeline)),
                    timeout=2.0
                ) or []
                for item in robot_counts_result:
                    robot_counts[item['_id']] = item['count']
                
                # 缓存结果（网游级优化）
                utils.set_cached_query(cache_key, robot_counts)
            except Exception as e:
                print(f'批量计算机甲数量失败: {e}')
        
        # 更新robotcount并准备批量更新数据库
        for slot_index, doc_id, character_id in character_ids_to_count:
            dynamic_robot_count = robot_counts.get(character_id, 0)
            characters_data[slot_index]['robotcount'] = dynamic_robot_count
            # 收集需要更新的文档
            docs_to_update.append((doc_id, dynamic_robot_count))
        
        # 批量更新数据库（性能优化：减少数据库操作次数）
        if docs_to_update:
            try:
                from pymongo import UpdateOne
                bulk_ops = [UpdateOne({'_id': doc_id}, {'$set': {'robotcount': count}}) 
                           for doc_id, count in docs_to_update]
                if bulk_ops:
                    await utils.async_mongo_operation(
                        lambda: utils.players_col.bulk_write(bulk_ops),
                        timeout=2.0
                    )
            except Exception as e:
                print(f'批量更新robotcount失败: {e}')
    
    # 一次性返回所有角色数据（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'all_characters_response',
        'success': True,
        'characters': characters_data
    }, request_data=data)
    print(f'批量发送角色信息响应: 用户 {user["_id"]}, 槽位数量: {len(characters_data)}')
    
    return current_user_id, current_character_id


async def handle_get_character_info(websocket, data, current_user_id, current_character_id):
    """处理获取单个角色信息请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    slot_index = int(data.get('slot_index', 0))
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        # 使用统一的响应函数，自动包含 request_id（优化：请求-响应关联）
        await utils.send_error_response(
            websocket,
            'character_info',
            '用户不存在或未登录',
            code=401,
            request_data=data  # 自动从请求数据中提取 request_id 并添加到响应
        )
        return current_user_id, current_character_id
    
    doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}))
    if not doc:
        # 兼容旧数据：从users.characters迁移一份到players
        chars = user.get('characters', [None, None, None])
        while len(chars) < 3:
            chars.append(None)
        ch = chars[slot_index] if 0 <= slot_index < len(chars) else None
        if ch:
            try:
                utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                    {'user_id': user['_id'], 'slot_index': slot_index},
                    {'$setOnInsert': {
                        'user_id': user['_id'],
                        'slot_index': slot_index,
                        'character_id': ch.get('character_id'),
                        'role_name': ch.get('role_name', ''),
                        'class': ch.get('class', 1),
                        'Sprite': ch.get('Sprite', 0),
                        'gold': ch.get('gold', 0),
                        'level': ch.get('level', 1),
                        'exp': ch.get('exp', 0),
                        'energy_blocks': utils.normalize_energy_blocks(ch.get('energy_blocks', ch.get('points', 0))),
                        'alliance': ch.get('alliance', ''),
                        'record': ch.get('record', ''),
                        'robotcount': ch.get('robotcount', 0),
                        'position': ch.get('position', {}),
                        'rank': ch.get('rank', ''),
                        'items': {}
                    }},
                    upsert=True
                ))
            except Exception as e:
                print('迁移旧角色数据失败:', e)
            doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}))
    else:
        # 若players文档存在但字段不完整，则尝试从users.characters补齐
        incomplete = (not doc.get('character_id')) or (not doc.get('role_name')) or (doc.get('Sprite', 0) in [0, '0'])
        if incomplete:
            chars = user.get('characters', [None, None, None])
            while len(chars) < 3:
                chars.append(None)
            ch = chars[slot_index] if 0 <= slot_index < len(chars) else None
            if ch:
                try:
                    utils.players_col.update_one(
                        {'user_id': user['_id'], 'slot_index': slot_index},
                        {'$set': {
                            'character_id': ch.get('character_id'),
                            'role_name': ch.get('role_name', ''),
                            'class': ch.get('class', 1),
                            'Sprite': ch.get('Sprite', 0),
                            'gold': ch.get('gold', 0),
                            'level': ch.get('level', 1),
                            'exp': ch.get('exp', 0),
                            'energy_blocks': utils.normalize_energy_blocks(ch.get('energy_blocks', ch.get('points', 0))),
                            'alliance': ch.get('alliance', ''),
                            'record': ch.get('record', ''),
                            'robotcount': ch.get('robotcount', 0),
                            'position': ch.get('position', {}),
                            'rank': ch.get('rank', ''),
                            'friend_id': doc.get('friend_id') or utils.generate_friend_id()
                        }}
                    )
                    doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}))
                except Exception as e:
                    print('补齐玩家角色数据失败:', e)
    
    if not doc:
        response_data = {
            'slot_index': slot_index,
            'role_name': '',
            'Sprite': 0
        }
    else:
        current_character_id = doc.get('character_id')
        dynamic_robot_count = utils.compute_robot_count(user['_id'], current_character_id)
        try:
            utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                {'_id': doc['_id']},
                {'$set': {'robotcount': dynamic_robot_count}}
            ))
        except Exception:
            pass
        response_data = {
            'slot_index': slot_index,
            'role_name': doc.get('role_name', ''),
            'Sprite': doc.get('Sprite', 0),
            'gold': doc.get('gold', 0),
            'level': doc.get('level', 1),
            'energy_blocks': utils.get_energy_blocks_for_response(doc),
            'alliance': doc.get('alliance', ''),
            'record': doc.get('record', ''),
            'robotcount': dynamic_robot_count,
            'position': doc.get('position', {}),
            'rank': doc.get('rank', ''),
            'user_id': str(user['_id']),
            'character_id': current_character_id,
            'friend_id': doc.get('friend_id')
        }
    
    request_id = data.get('request_id')  # 用于日志
    print(f'发送角色信息响应: slot_index={slot_index}, request_id={request_id}, role_name={response_data.get("role_name", "")}')
    
    # 使用统一的响应函数，自动包含 request_id（优化：请求-响应关联）
    await utils.send_success_response(
        websocket,
        'character_info',
        data=response_data,
        request_data=data  # 自动从请求数据中提取 request_id 并添加到响应
    )
    
    return current_user_id, current_character_id


async def handle_select_character(websocket, data, current_user_id, current_character_id):
    """处理选择角色请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    # 支持通过 character_id 或 slot_index 选择角色（与文档保持一致）
    character_id = data.get('character_id')
    slot_index = data.get('slot_index')
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {'type': 'select_character_response', 'success': False, 'message': '用户不存在或未登录'}, request_data=data)
        return current_user_id, current_character_id
    
    # 如果未提供 character_id，但提供了 slot_index，则根据槽位查找
    if not character_id and slot_index is not None:
        try:
            slot_index = int(slot_index)
        except Exception:
            slot_index = None
        if slot_index is not None:
            doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'slot_index': slot_index}))
            if doc:
                character_id = doc.get('character_id')
    
    ch = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id, 'user_id': user['_id']}))
    if not ch:
        await utils.send_direct_response(websocket, {'type': 'select_character_response', 'success': False, 'message': '角色不存在'}, request_data=data)
    else:
        current_character_id = character_id
        # 同连接换角：先清大世界占用，避免旧角色残留在同图（客户端随后 world_enter 新角）
        try:
            from services.world_presence_service import world_presence_service

            await world_presence_service.leave_websocket(websocket)
        except Exception:
            pass
        await utils.send_direct_response(websocket, {'type': 'select_character_response', 'success': True, 'character_id': character_id}, request_data=data)
    
    return current_user_id, current_character_id


async def handle_create_character(websocket, data, current_user_id, current_character_id):
    """处理创建角色请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    slot_index = int(data.get('slot_index', 0))
    # 兼容文档字段：name 与 role_name
    role_name = data.get('role_name') or data.get('name')
    player_class = int(data.get('class', 1))
    # 兼容文档字段：sprite 与 character_index（原逻辑保留 character_index）
    character_index = int(data.get('character_index', data.get('sprite', 1)))
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'create_character_response',
            'success': False,
            'message': '用户不存在或未登录'
        }, request_data=data)
        return current_user_id, current_character_id
    
    chars = user.get('characters', [None, None, None])
    while len(chars) < 3:
        chars.append(None)
    if slot_index < 0 or slot_index >= 3:
        await utils.send_direct_response(websocket, {
            'type': 'create_character_response',
            'success': False,
            'message': '无效槽位',
            'slot_index': slot_index
        }, request_data=data)
        return current_user_id, current_character_id
    
    # 修复：同时检查users.characters和players_col，确保数据一致性
    # 检查users.characters
    if chars[slot_index]:
        await utils.send_direct_response(websocket, {
            'type': 'create_character_response',
            'success': False,
            'message': '槽位已占用',
            'slot_index': slot_index
        }, request_data=data)
        return current_user_id, current_character_id
    
    # 检查players_col中是否已有该槽位的角色
    existing_player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({
        'user_id': user['_id'],
        'slot_index': slot_index
    }))
    
    if existing_player:
        # 检查是否真的有角色数据（不是空文档）
        has_character = existing_player.get('character_id') and existing_player.get('role_name') and existing_player.get('role_name') not in ['', '0', 0] and existing_player.get('Sprite', 0) not in [0, '0']
        if has_character:
            await utils.send_direct_response(websocket, {
                'type': 'create_character_response',
                'success': False,
                'message': '槽位已占用',
                'slot_index': slot_index
        }, request_data=data)
        return current_user_id, current_character_id
    
    character_id = str(uuid.uuid4())
    friend_id = utils.generate_friend_id()
    ch = {
        'character_id': character_id,
        'role_name': role_name,
        'class': player_class,
        'Sprite': character_index + 1,
        'gold': 0,
        'level': 1,
        'exp': 0,
        'energy_blocks': 0,
        'alliance': '',
        'record': '',
        'robotcount': 0,
        'position': {'map_id': 1, 'x': 120, 'y': -24},
        'rank': '',
        'friend_id': friend_id
    }
    chars[slot_index] = ch
    utils.users_col.update_one({'_id': user['_id']}, {'$set': {'characters': chars}})
    try:
        # 修复：使用$set而不是$setOnInsert，确保即使文档已存在也能更新
        utils.safe_mongo_operation(lambda: utils.players_col.update_one(
            {'user_id': user['_id'], 'slot_index': slot_index},
            {'$set': {
                'user_id': user['_id'],
                'slot_index': slot_index,
                'character_id': character_id,
                'role_name': role_name,
                'class': player_class,
                'Sprite': character_index + 1,
                'gold': 0,
                'level': 1,
                'exp': 0,
                'energy_blocks': 0,
                'alliance': '',
                'record': '',
                'robotcount': 0,
                'position': {'map_id': 1, 'x': 120, 'y': -24},
                'rank': '',
                'items': {},
                'friend_id': friend_id,
                'battle_team': []  # 出战队伍，与 set_battle_team 持久化结构一致，避免首次 get 为空
            }},
            upsert=True
        ))
    except Exception as e:
        print('初始化玩家角色数据失败:', e)
    
    # 【已取消】为新角色随机赠送机甲宠物
    # 保留结构，避免以后需要恢复功能时难以追踪
    try:
        # 如果以后需要恢复赠送机甲功能，可以在这里实现
        print(f'ℹ️ 已跳过为角色 {character_id} 随机创建机甲宠物（功能已关闭）')
    except Exception:
        # 这里理论上不会抛异常，仅做兼容
        pass
    
    # 更新该角色的机甲数量并通知客户端
    try:
        rc = utils.compute_robot_count(user['_id'], character_id)
        utils.players_col.update_one(
            {'user_id': user['_id'], 'slot_index': slot_index},
            {'$set': {'robotcount': rc}}
        )
        pets = list(utils.robotpet_col.find({'user_id': user['_id'], 'character_id': character_id}))
        pets_list = []
        for pet in pets:
            ani_id = pet.get('AniID', '') or ''
            pets_list.append({
                'pet_id': str(pet['_id']),
                'robot_base_id': pet.get('robot_base_id', ''),
                'RobotID': pet.get('RobotID', ''),
                'RobotName': pet.get('RobotName', ''),
                'Growth': pet.get('Growth', 50),
                'Comprehension': pet.get('Comprehension', 50),
                'Level': pet.get('Level', 1),
                'StarLevel': pet.get('StarLevel', 1),
                'Form': pet.get('Form', 1),
                'Class': pet.get('Class', 1),
                'AniID': ani_id
            })
        # MMO级优化：异步广播，不阻塞
        if _broadcast_to_user_async:
            update_msg = {
                'type': 'robotcount_update',
                'success': True,
                'slot_index': slot_index,
                'character_id': character_id,
                'robotcount': rc
            }
            pets_msg = {'type': 'robot_pets_update', 'success': True, 'character_id': character_id, 'pets': pets_list}
            asyncio.create_task(_broadcast_to_user_async(user['_id'], update_msg))
            asyncio.create_task(_broadcast_to_user_async(user['_id'], pets_msg))
    except Exception as e:
        print(f'更新机甲数量或推送失败: {e}')
    
    await utils.send_direct_response(websocket, {
        'type': 'create_character_response',
        'success': True,
        'slot_index': slot_index,
        'character_id': character_id
    }, request_data=data)
    
    return current_user_id, current_character_id


async def handle_delete_character(websocket, data, current_user_id, current_character_id):
    """处理删除角色请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    slot_index = int(data.get('slot_index', 0))
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'delete_character_response',
            'success': False,
            'message': '用户不存在或未登录'
        }, request_data=data)
        return current_user_id, current_character_id
    
    chars = user.get('characters', [None, None, None])
    while len(chars) < 3:
        chars.append(None)
    if slot_index < 0 or slot_index >= 3 or not chars[slot_index]:
        await utils.send_direct_response(websocket, {
            'type': 'delete_character_response',
            'success': False,
            'message': '槽位为空或无效'
        }, request_data=data)
        return current_user_id, current_character_id
    
    # 获取character_id
    character_id = chars[slot_index].get('character_id') if chars[slot_index] else None
    
    # 清空users集合中的character槽位
    chars[slot_index] = None
    utils.safe_mongo_operation(lambda: utils.users_col.update_one({'_id': user['_id']}, {'$set': {'characters': chars}}))
    
    # 删除所有关联数据（保留聊天记录）
    deleted_count = {
        'players': 0,
        'robotpet': 0,
        'inventory': 0,
        'messages': 0  # 不再删除聊天记录
    }
    
    try:
        # 1. 删除players集合中的角色数据
        result = utils.players_col.delete_one({'user_id': user['_id'], 'slot_index': slot_index})
        deleted_count['players'] = result.deleted_count
        print(f'✅ 删除players数据: {result.deleted_count} 条')
    except Exception as e:
        print(f'❌ 删除players数据失败: {e}')
    
    # 2. 删除RobotPet（机甲宠物）- 通过character_id和user_id删除
    if character_id:
        try:
            result = utils.safe_mongo_operation(lambda: utils.robotpet_col.delete_many({
                'user_id': user['_id'],
                'character_id': character_id
            }))
            deleted_count['robotpet'] = result.deleted_count
            print(f'✅ 删除RobotPet数据: {result.deleted_count} 条 (character_id: {character_id})')
        except Exception as e:
            print(f'❌ 删除RobotPet数据失败: {e}')
        
        # 3. 删除inventory（背包物品）
        try:
            result = utils.inventory_col.delete_many({
                'user_id': user['_id'],
                'character_id': character_id
            })
            deleted_count['inventory'] = result.deleted_count
            print(f'✅ 删除inventory数据: {result.deleted_count} 条 (character_id: {character_id})')
        except Exception as e:
            print(f'❌ 删除inventory数据失败: {e}')
        
        try:
            # MMO级优化：异步广播，不阻塞
            if _broadcast_to_user_async:
                pets_msg = {'type': 'robot_pets_update', 'success': True, 'character_id': character_id, 'pets': []}
                bag_msg = {'type': 'bag_items_update', 'success': True, 'character_id': character_id, 'items': []}
                asyncio.create_task(_broadcast_to_user_async(user['_id'], pets_msg))
                asyncio.create_task(_broadcast_to_user_async(user['_id'], bag_msg))
        except Exception:
            pass
        
        # 4. 不再删除messages中的聊天记录（保留历史聊天记录）
        # 聊天记录作为历史数据保留，即使角色被删除
        deleted_count['messages'] = 0
    
    print(f'🗑️ 角色删除完成: players={deleted_count["players"]}, robotpet={deleted_count["robotpet"]}, inventory={deleted_count["inventory"]}, messages={deleted_count["messages"]} (聊天记录已保留)')
    
    await utils.send_direct_response(websocket, {
        'type': 'delete_character_response',
        'success': True,
        'slot_index': slot_index,
        'deleted_count': deleted_count
    }, request_data=data)
    
    return current_user_id, current_character_id
