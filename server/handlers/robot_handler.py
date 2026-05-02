"""
机甲相关操作处理器
处理所有机甲相关的请求
"""
import json
import asyncio
import random
from bson import ObjectId
from pymongo import UpdateOne
from . import utils
from .robot_upgrade import get_upgrade_manager

# 需要从ws_server导入的函数和变量（通过参数传递）
_create_robot_pet = None
_upgrade_request_locks = None
_broadcast_to_user_async = None

def init_robot_handler(create_robot_pet_func, upgrade_locks_dict, broadcast_func=None):
    """初始化机甲处理器需要的函数和变量"""
    global _create_robot_pet, _upgrade_request_locks, _broadcast_to_user_async
    _create_robot_pet = create_robot_pet_func
    _upgrade_request_locks = upgrade_locks_dict
    _broadcast_to_user_async = broadcast_func


async def handle_get_battle_team(websocket, data, current_character_id):
    """获取出战队伍（服务器权威存储）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'get_battle_team', '用户不存在或未登录', code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(websocket, 'get_battle_team', '未选择角色', code=400, request_data=data)
        return

    try:
        # 从 players 集合按 user_id + character_id 查询，battle_team 存在于此文档并持久化到数据库
        player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'user_id': user['_id'], 'character_id': cid}),
            timeout=2.0
        )
        battle_team = []
        team_version = 0
        if player and isinstance(player.get('battle_team'), list):
            battle_team = [str(x) for x in player.get('battle_team', []) if x]
            team_version = int(player.get('battle_team_version', 0) or 0)
        
        # 关键优化：如果没有手动设置出战队伍，自动按 slot_index 选择前 1 个（当前版本单机位）
        if not battle_team or len(battle_team) == 0:
            try:
                auto_pets = await utils.async_mongo_operation(
                    lambda: list(utils.robotpet_col.find(
                        {'user_id': user['_id'], 'character_id': cid, 'slot_index': {'$exists': True, '$ne': None}},
                        {'_id': 1, 'slot_index': 1}
                    ).sort('slot_index', 1).limit(1)),
                    timeout=3.0
                )
                if auto_pets and len(auto_pets) > 0:
                    battle_team = [str(pet['_id']) for pet in auto_pets]
                    print(f'✅ [get_battle_team] 自动出战：按 slot_index 选择前 {len(battle_team)} 个机甲')
                    
                    # 关键修复：自动出战的结果需要持久化到数据库，避免每次 GET 都重新计算
                    # 同时更新机甲的出战状态字段，保持与 handle_set_battle_team 一致
                    from bson import ObjectId
                    object_ids = []
                    for pid in battle_team:
                        try:
                            object_ids.append(ObjectId(pid))
                        except Exception:
                            continue
                    
                    if object_ids:
                        # 持久化自动出战的队伍到数据库
                        await utils.async_mongo_operation(
                            lambda: utils.players_col.update_one(
                                {'user_id': user['_id'], 'character_id': cid},
                                {'$set': {'battle_team': battle_team}},
                                upsert=True
                            ),
                            timeout=3.0
                        )
                        
                        # 更新机甲的出战状态字段（与 handle_set_battle_team 保持一致）
                        # 先清除所有机甲的出战状态
                        await utils.async_mongo_operation(
                            lambda: utils.robotpet_col.update_many(
                                {'user_id': user['_id'], 'character_id': cid},
                                {'$unset': {'is_in_battle_team': '', 'battle_team_position': ''}}
                            ),
                            timeout=3.0
                        )
                        
                        # 然后设置出战机甲的出战状态
                        for idx, pet_id_obj in enumerate(object_ids):
                            position = idx + 1  # 1=主战，2=副战
                            await utils.async_mongo_operation(
                                lambda pid=pet_id_obj, pos=position: utils.robotpet_col.update_one(
                                    {'_id': pid, 'user_id': user['_id'], 'character_id': cid},
                                    {'$set': {'is_in_battle_team': True, 'battle_team_position': pos}}
                                ),
                                timeout=3.0
                            )
            except Exception as e:
                print(f'⚠️ [get_battle_team] 自动出战失败: {e}')

        await utils.send_success_response(
            websocket,
            'get_battle_team',
            data={'character_id': str(cid), 'battle_team': battle_team, 'team_version': team_version},
            request_data=data
        )
    except Exception as e:
        await utils.send_error_response(websocket, 'get_battle_team', f'获取出战队伍失败: {str(e)}', code=500, request_data=data)


async def handle_set_battle_team(websocket, data, current_character_id):
    """
    设置出战队伍（服务器权威存储）
    请求:
      { battle_team: [pet_id1, pet_id2], character_id?: ... }
    """
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'set_battle_team', '用户不存在或未登录', code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(websocket, 'set_battle_team', '未选择角色', code=400, request_data=data)
        return

    # 幂等：要求 request_id，重复请求返回相同结果
    try:
        from ..services.battle_team_idempotency import battle_team_idempotency
        proceed, idem_meta = await battle_team_idempotency.prepare(websocket, user['_id'], 'set_battle_team', data)
        if not proceed:
            return
        data['_team_idem'] = idem_meta
    except Exception:
        pass

    battle_team = data.get('battle_team')
    auto_battle_team = data.get('auto_battle_team', False)  # 新增：是否自动出战
    expected_version = data.get('team_version', None)
    
    # 关键优化：支持自动出战逻辑
    # 如果 battle_team 为空或未设置，且 auto_battle_team=true，则按 slot_index 自动选择前 1 个（单机位）
    if (battle_team is None or (isinstance(battle_team, list) and len(battle_team) == 0)) and auto_battle_team:
        # 自动出战：按 slot_index 排序，选择前 1 个
        try:
            all_pets = await utils.async_mongo_operation(
                lambda: list(utils.robotpet_col.find(
                    {'user_id': user['_id'], 'character_id': cid, 'slot_index': {'$exists': True, '$ne': None}},
                    {'_id': 1, 'slot_index': 1}
                ).sort('slot_index', 1).limit(1)),
                timeout=3.0
            )
            if all_pets and len(all_pets) > 0:
                normalized = [str(pet['_id']) for pet in all_pets]
                print(f'✅ [set_battle_team] 自动出战：按 slot_index 选择前 {len(normalized)} 个机甲')
            else:
                # 如果没有有编号的机甲，返回空数组
                normalized = []
        except Exception as e:
            print(f'⚠️ [set_battle_team] 自动出战失败: {e}')
            normalized = []
    else:
        # 手动设置出战队伍
        if battle_team is None:
            await utils.send_error_response(websocket, 'set_battle_team', '缺少 battle_team', code=400, request_data=data)
            return
        if not isinstance(battle_team, list):
            await utils.send_error_response(websocket, 'set_battle_team', 'battle_team 必须是数组', code=400, request_data=data)
            return

        # 规范化：去空、转字符串、去重（保持顺序）
        normalized = []
        seen = set()
        for x in battle_team:
            if x is None:
                continue
            s = str(x).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            normalized.append(s)

        if len(normalized) > 1:
            normalized = normalized[:1]

    # 校验：pet_id 必须属于该用户&该角色
    try:
        from bson import ObjectId
        object_ids = []
        for pid in normalized:
            try:
                object_ids.append(ObjectId(pid))
            except Exception:
                await utils.send_error_response(websocket, 'set_battle_team', f'无效的pet_id: {pid}', code=400, request_data=data)
                return

        if object_ids:
            count = await utils.async_mongo_operation(
                lambda: utils.robotpet_col.count_documents({'_id': {'$in': object_ids}, 'user_id': user['_id'], 'character_id': cid}),
                timeout=3.0
            )
            if count != len(object_ids):
                await utils.send_error_response(websocket, 'set_battle_team', '出战队伍包含不属于该角色的机甲', code=400, request_data=data)
                return

        # 版本号校验（乐观锁）：只要客户端带 team_version，就必须一致才允许写
        current_player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'user_id': user['_id'], 'character_id': cid}, {'battle_team_version': 1, 'battle_team': 1}),
            timeout=3.0
        )
        current_version = int((current_player or {}).get('battle_team_version', 0) or 0)
        if expected_version is not None:
            try:
                expected_v = int(expected_version)
            except Exception:
                expected_v = None
            if expected_v is None:
                await utils.send_error_response(websocket, 'set_battle_team', 'team_version 无效', code=400, request_data=data, error_code='TEAM_BAD_VERSION')
                return
            if expected_v != current_version:
                await utils.send_error_response(
                    websocket,
                    'set_battle_team',
                    f'队伍版本不一致（server={current_version}, client={expected_v}）',
                    code=409,
                    request_data=data,
                    error_code='TEAM_VERSION_MISMATCH'
                )
                return

        # 写入 players_col（不存在则 upsert），并自增 battle_team_version
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {'user_id': user['_id'], 'character_id': cid},
                {'$set': {'battle_team': normalized}, '$inc': {'battle_team_version': 1}},
                upsert=True
            ),
            timeout=3.0
        )

        # 读取新的版本号
        player_after = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'user_id': user['_id'], 'character_id': cid}, {'battle_team_version': 1}),
            timeout=3.0
        )
        new_version = int((player_after or {}).get('battle_team_version', current_version + 1) or (current_version + 1))
        
        # 关键优化：更新机甲的出战状态字段（is_in_battle_team 和 battle_team_position）
        # 先清除所有机甲的出战状态
        await utils.async_mongo_operation(
            lambda: utils.robotpet_col.update_many(
                {'user_id': user['_id'], 'character_id': cid},
                {'$unset': {'is_in_battle_team': '', 'battle_team_position': ''}}
            ),
            timeout=3.0
        )
        
        # 然后设置出战机甲的出战状态
        if object_ids and len(object_ids) > 0:
            for idx, pet_id_obj in enumerate(object_ids):
                position = idx + 1  # 1=主战，2=副战
                await utils.async_mongo_operation(
                    lambda pid=pet_id_obj, pos=position: utils.robotpet_col.update_one(
                        {'_id': pid, 'user_id': user['_id'], 'character_id': cid},
                        {'$set': {'is_in_battle_team': True, 'battle_team_position': pos}}
                    ),
                    timeout=3.0
                )

        # 响应
        await utils.send_success_response(
            websocket,
            'set_battle_team',
            data={'character_id': str(cid), 'battle_team': normalized, 'team_version': new_version},
            request_data=data
        )

        # 推送更新（Pomelo风格：状态变更主动推送，避免客户端用本地缓存）
        if _broadcast_to_user_async:
            import asyncio
            asyncio.create_task(_broadcast_to_user_async(user['_id'], {
                'type': 'battle_team_update',
                'success': True,
                'character_id': str(cid),
                'battle_team': normalized,
                'team_version': new_version
            }))
    except Exception as e:
        await utils.send_error_response(websocket, 'set_battle_team', f'设置出战队伍失败: {str(e)}', code=500, request_data=data)
    finally:
        try:
            from ..services.battle_team_idempotency import battle_team_idempotency
            battle_team_idempotency.abandon(data.get('_team_idem'))
        except Exception:
            pass


async def broadcast_robot_pets_after_change(user_id, character_id: str, battle_team: list, team_changed: bool):
    """放生/分解等删宠后推送机甲列表与出战队伍。"""
    if not _broadcast_to_user_async:
        return
    try:
        cid = str(character_id).strip()
        pets = await utils.async_mongo_operation(
            lambda: list(utils.robotpet_col.find(
                {'user_id': user_id, 'character_id': cid},
                {'_id': 1, 'RobotName': 1, 'RobotID': 1, 'Level': 1, 'StarLevel': 1, 'Form': 1, 'Class': 1, 'AniID': 1, 'slot_index': 1}
            ).sort('slot_index', 1)),
            timeout=6.0,
        )
        pets_list = []
        for p in pets or []:
            pets_list.append({
                'pet_id': str(p.get('_id')),
                'RobotID': p.get('RobotID', ''),
                'RobotName': p.get('RobotName', ''),
                'Level': p.get('Level', 1),
                'StarLevel': p.get('StarLevel', 1),
                'Form': p.get('Form', 1),
                'Class': p.get('Class', 1),
                'AniID': p.get('AniID', '') or '',
                'slot_index': p.get('slot_index'),
            })
        asyncio.create_task(_broadcast_to_user_async(user_id, {
            'type': 'robot_pets_update',
            'success': True,
            'character_id': cid,
            'pets': pets_list,
        }))
        if team_changed:
            asyncio.create_task(_broadcast_to_user_async(user_id, {
                'type': 'battle_team_update',
                'success': True,
                'character_id': cid,
                'battle_team': list(battle_team or []),
            }))
    except Exception:
        pass


async def remove_robot_pet_from_account(user_id, character_id: str, pet_id: str) -> dict:
    """从出战队伍移除并删除机甲文档；不负责卸下装备（调用方应先 strip）。"""
    cid = str(character_id).strip()
    pet_id = str(pet_id).strip()
    try:
        pet_object_id = ObjectId(pet_id)
    except Exception:
        return {'success': False, 'error': 'invalid_pet_id', 'battle_team': [], 'team_changed': False}

    player = await utils.async_mongo_operation(
        lambda: utils.players_col.find_one({'user_id': user_id, 'character_id': cid}),
        timeout=3.0,
    )
    battle_team = []
    team_changed = False
    if player and isinstance(player.get('battle_team'), list):
        battle_team = [str(x) for x in player.get('battle_team', []) if x]
    if pet_id in battle_team:
        battle_team = [x for x in battle_team if x != pet_id]
        team_changed = True

    if team_changed:
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {'user_id': user_id, 'character_id': cid},
                {'$set': {'battle_team': battle_team}},
                upsert=True,
            ),
            timeout=3.0,
        )
        await utils.async_mongo_operation(
            lambda: utils.robotpet_col.update_many(
                {'user_id': user_id, 'character_id': cid},
                {'$unset': {'is_in_battle_team': '', 'battle_team_position': ''}},
            ),
            timeout=3.0,
        )
        object_ids = []
        for idx, pid in enumerate(battle_team):
            try:
                object_ids.append((ObjectId(pid), idx + 1))
            except Exception:
                continue
        for pid_obj, pos in object_ids:
            await utils.async_mongo_operation(
                lambda pid=pid_obj, p=pos: utils.robotpet_col.update_one(
                    {'_id': pid, 'user_id': user_id, 'character_id': cid},
                    {'$set': {'is_in_battle_team': True, 'battle_team_position': p}},
                ),
                timeout=3.0,
            )

    result = await utils.async_mongo_operation(
        lambda: utils.robotpet_col.delete_one({'_id': pet_object_id, 'user_id': user_id, 'character_id': cid}),
        timeout=3.0,
    )
    if not result or getattr(result, 'deleted_count', 0) <= 0:
        return {'success': False, 'error': 'delete_failed', 'battle_team': battle_team, 'team_changed': team_changed}
    return {'success': True, 'battle_team': battle_team, 'team_changed': team_changed}


async def handle_robot_release_pet(websocket, data, current_character_id):
    """放生机甲（玩家接口）：校验归属；若在出战队伍中则先自动下场；再删除实例；最后推送更新。"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'robot_release_pet', '用户不存在或未登录', code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(websocket, 'robot_release_pet', '未选择角色', code=400, request_data=data)
        return

    pet_id = str(data.get('pet_id', '') or '').strip()
    if not pet_id:
        await utils.send_error_response(websocket, 'robot_release_pet', '缺少 pet_id', code=400, request_data=data)
        return

    try:
        pet_object_id = ObjectId(pet_id)

        # 归属校验：必须属于当前用户与角色
        pet = await utils.async_mongo_operation(
            lambda: utils.robotpet_col.find_one({'_id': pet_object_id, 'user_id': user['_id'], 'character_id': cid}),
            timeout=3.0,
        )
        if not pet:
            await utils.send_error_response(websocket, 'robot_release_pet', '机甲不存在或不属于该角色', code=404, request_data=data)
            return

        # 放生前先将所有装备卸下并放回背包，避免删宠导致装备丢失
        from . import bag_handler
        from .equipment_handler import strip_all_equipment_to_bag
        strip_res = await strip_all_equipment_to_bag(
            user['_id'], cid, pet_id, bag_handler._add_item_to_inventory
        )
        if not strip_res.get('success'):
            await utils.send_error_response(
                websocket,
                'robot_release_pet',
                strip_res.get('error', '卸装备失败'),
                code=500,
                request_data=data,
            )
            return

        rm = await remove_robot_pet_from_account(user['_id'], cid, pet_id)
        if not rm.get('success'):
            await utils.send_error_response(websocket, 'robot_release_pet', '放生失败', code=500, request_data=data)
            return

        battle_team = rm.get('battle_team') or []
        team_changed = bool(rm.get('team_changed'))

        await utils.send_success_response(
            websocket,
            'robot_release_pet',
            data={'character_id': str(cid), 'pet_id': pet_id, 'battle_team': battle_team},
            message='放生成功',
            request_data=data,
        )

        await broadcast_robot_pets_after_change(user['_id'], cid, battle_team, team_changed)
        try:
            await bag_handler._push_bag_refresh(user['_id'], cid, 'robot_release_strip')
        except Exception as _push_e:
            print(f'⚠️ [robot_release_pet] bag refresh push failed: {_push_e}')
    except Exception as e:
        await utils.send_error_response(websocket, 'robot_release_pet', f'放生失败: {str(e)}', code=500, request_data=data)


async def handle_get_random_robot(websocket, data):
    """获取随机机甲信息"""
    try:
        sample = utils.safe_mongo_operation(lambda: list(utils.robotbase_col.aggregate([{ '$sample': { 'size': 1 } }])))
        doc = sample[0] if sample else None
        if not doc:
            await websocket.send(json.dumps({'type': 'robot_info', 'success': False}))
        else:
            # 获取AniID（完整字符串，如"yl_L1"）
            ani_id = doc.get('AniID', '')
            if not ani_id:
                ani_id = ''
            
            # 计算机甲经验条数据
            total_exp = doc.get('EXP', 0)
            level, current_level_exp, next_level_total_exp = utils.calculate_robot_exp_bar(total_exp)
            
            resp = {
                'type': 'robot_info',
                'success': True,
                'RobotName': doc.get('RobotName', ''),
                'Form': doc.get('Form', 1),
                'Class': doc.get('Class', 1),
                'Level': level,  # 使用重新计算的等级
                'StarLevel': doc.get('StarLevel', 1),
                'AniID': ani_id,  # 返回完整的AniID字符串
                'HP': doc.get('HP', 1000),
                'CurrentHP': doc.get('CurrentHP', 800),
                'MaxHP': doc.get('MaxHP', 1000),
                'MP': doc.get('MP', 300),
                'CurrentMP': doc.get('CurrentMP', 200),
                'MaxMP': doc.get('MaxMP', 300),
                'EXP': total_exp,  # 累计总经验
                'total_exp': total_exp,  # 累计总经验（兼容字段）
                'CurrentEXP': current_level_exp,  # 当前等级内的经验
                'current_level_exp': current_level_exp,  # 当前等级内的经验（兼容字段）
                'MaxEXP': next_level_total_exp,  # 从当前等级升到下一级所需的总经验（固定值）
                'next_level_need_exp': next_level_total_exp,  # 从当前等级升到下一级所需的总经验（兼容字段）
                'Melee': doc.get('Melee', 120),
                'Accuracy': doc.get('Accuracy', 110),
                'Armor': doc.get('Armor', 95),
                'Corrosion': doc.get('Corrosion', 60),
                'Initiative': doc.get('Initiative', 80),
                'Block': doc.get('Block', 40),
                'ParticleShield': doc.get('ParticleShield', 35),
                'ArmorPenetration': doc.get('ArmorPenetration', 55),
                'Shooting': doc.get('Shooting', 0),
                'Evasion': doc.get('Evasion', 45),
                'Lethality': doc.get('Lethality', 50),
                'Resistance': doc.get('Resistance', 70),
                'Counterattack': doc.get('Counterattack', 30),
                'CurrentMelee': doc.get('CurrentMelee'),
                'CurrentArmor': doc.get('CurrentArmor'),
                'CurrentAccuracy': doc.get('CurrentAccuracy'),
                'CurrentCorrosion': doc.get('CurrentCorrosion'),
                'CurrentInitiative': doc.get('CurrentInitiative'),
                'CurrentBlock': doc.get('CurrentBlock'),
                'CurrentParticleShield': doc.get('CurrentParticleShield'),
                'CurrentArmorPenetration': doc.get('CurrentArmorPenetration'),
                'CurrentShooting': doc.get('CurrentShooting'),
                'CurrentEvasion': doc.get('CurrentEvasion'),
                'CurrentLethality': doc.get('CurrentLethality'),
                'CurrentResistance': doc.get('CurrentResistance'),
                'CurrentCounterattack': doc.get('CurrentCounterattack')
            }
        await websocket.send(json.dumps(resp))
    except Exception as e:
        await websocket.send(json.dumps({'type': 'robot_info', 'success': False}))


async def handle_get_robot_pets(websocket, data, current_character_id):
    """获取机甲宠物列表（支持分页）"""
    # 关键修复：移除节流限制，允许频繁请求，确保用户体验
    # 原因：机甲列表是查询操作，应该允许用户频繁打开查看，不应该被拒绝
    # 为了确保数据实时性，不缓存查询结果，总是查询数据库获取最新数据
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式：支持通过user_id获取用户
    
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'robot_pets_response', 
            'success': False, 
            'pets': [],
            'message': '用户不存在或未登录'
        }, request_data=data)
        return
    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_direct_response(websocket, {'type': 'robot_pets_response', 'success': False, 'pets': []}, request_data=data)
        return
    
    # 支持分批加载（网游级优化）
    page = int(data.get('page', 0))  # 页码，从0开始
    page_size = int(data.get('page_size', 50))  # 每页数量，默认50
    skip = page * page_size
    
    try:
        # 单一数据源：附带 battle_team + team_version（客户端可不再强依赖 get_battle_team）
        player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'user_id': user['_id'], 'character_id': cid}, {'battle_team': 1, 'battle_team_version': 1}),
            timeout=3.0
        )
        battle_team = []
        team_version = 0
        if player and isinstance(player.get('battle_team'), list):
            battle_team = [str(x) for x in player.get('battle_team', []) if x]
            team_version = int(player.get('battle_team_version', 0) or 0)
        # 性能优化：只查询需要的字段，减少数据传输量（MMO级优化：异步查询，避免阻塞事件循环）
        # 关键优化：按 slot_index 排序，确保出战队伍在前，顺序统一
        # 使用skip和limit实现分批加载
        # 修复：增加超时时间，考虑重试延迟（5次重试，每次延迟1-4秒，总共可能需要20秒）
        pets_query = await utils.async_mongo_operation(
            lambda: list(utils.robotpet_col.find(
                {'user_id': user['_id'], 'character_id': cid},
                {
                    '_id': 1, 'RobotName': 1, 'RobotID': 1, 'Growth': 1, 'Comprehension': 1,
                    'Level': 1, 'StarLevel': 1, 'Form': 1, 'Class': 1, 'AniID': 1,
                    'EXP': 1, 'HP': 1, 'MaxHP': 1, 'CurrentHP': 1, 'MP': 1, 'MaxMP': 1, 'CurrentMP': 1,
                    'Melee': 1, 'Accuracy': 1, 'Armor': 1, 'Corrosion': 1, 'Initiative': 1,
                    'Block': 1, 'ParticleShield': 1, 'ArmorPenetration': 1, 'Shooting': 1,
                    'Evasion': 1, 'Lethality': 1, 'Resistance': 1, 'Counterattack': 1, 'robot_base_id': 1,
                    'slot_index': 1  # 新增：包含 slot_index 字段
                }
            ).sort('slot_index', 1).skip(skip).limit(page_size)),  # 关键优化：按 slot_index 排序
            timeout=15.0  # 增加超时时间到15秒，考虑重试延迟
        )
        
        pets = pets_query if pets_query else []
        
        # 获取总数（用于分页，MMO级优化：异步查询）
        total_count = await utils.async_mongo_operation(
            lambda: utils.robotpet_col.count_documents({'user_id': user['_id'], 'character_id': cid}),
            timeout=15.0  # 增加超时时间到15秒
        )
        has_more = (skip + len(pets)) < total_count
        pets_list = []
        upgrade_manager = get_upgrade_manager()
        # 收集需要修正等级的机甲（先返回数据，后台批量更新，避免阻塞）
        pets_to_fix = []
        
        # 性能优化：批量处理，减少函数调用开销
        for pet in pets:
            total_exp = pet.get('EXP', 0)
            db_level = pet.get('Level', 1)
            
            # 性能优化：如果数据库等级看起来可信，先使用它，只在必要时重新计算
            # 计算机甲经验条数据（传入数据库等级进行快速验证）
            level, current_level_exp, next_level_total_exp = utils.calculate_robot_exp_bar(total_exp, db_level)
            
            # 检查等级是否需要修正（先不更新，收集起来批量处理）
            if level != db_level:
                # 收集需要修正的机甲信息，稍后批量更新
                pets_to_fix.append({
                    'pet_id': pet['_id'],
                    'pet_name': pet.get('RobotName', '未知'),
                    'old_level': db_level,
                    'new_level': level,
                    'total_exp': total_exp,
                    'robot_id': pet.get('RobotID', ''),
                    'pet_data': pet  # 保存完整的pet数据用于计算属性
                })
            
            # 性能优化：使用字典字面量直接构造，减少方法调用
            ani_id = pet.get('AniID') or ''
            
            # 直接构造字典，减少重复的get调用
            pet_dict = {
                'pet_id': str(pet['_id']),
                'RobotID': pet.get('RobotID', ''),
                'RobotName': pet.get('RobotName', ''),
                'Level': level,  # 使用计算后的等级
                'StarLevel': pet.get('StarLevel', 1),
                'Form': pet.get('Form', 1),
                'Class': pet.get('Class', 1),
                'AniID': ani_id,
                'EXP': total_exp,
                'total_exp': total_exp,
                'MaxEXP': next_level_total_exp,
                'CurrentEXP': current_level_exp,
                'current_level_exp': current_level_exp,
                'next_level_need_exp': next_level_total_exp,
            }
            
            # 可选字段（如果存在才添加，减少数据量）
            if 'robot_base_id' in pet:
                pet_dict['robot_base_id'] = pet['robot_base_id']
            if 'Growth' in pet:
                pet_dict['Growth'] = pet['Growth']
            if 'Comprehension' in pet:
                pet_dict['Comprehension'] = pet['Comprehension']
            # 新增：slot_index 字段（用于排序和自动出战）
            if 'slot_index' in pet:
                pet_dict['slot_index'] = pet['slot_index']
            
            # 属性字段（使用默认值或实际值）
            pet_dict.update({
                'HP': pet.get('HP', 1000),
                'MaxHP': pet.get('MaxHP', 1000),
                'CurrentHP': pet.get('CurrentHP', 1000),
                'MP': pet.get('MP', 300),
                'MaxMP': pet.get('MaxMP', 300),
                'CurrentMP': pet.get('CurrentMP', 300),
                'Melee': pet.get('Melee', 120),
                'Accuracy': pet.get('Accuracy', 110),
                'Armor': pet.get('Armor', 95),
                'Corrosion': pet.get('Corrosion', 60),
                'Initiative': pet.get('Initiative', 80),
                'Block': pet.get('Block', 40),
                'ParticleShield': pet.get('ParticleShield', 35),
                'ArmorPenetration': pet.get('ArmorPenetration', 55),
                'Shooting': pet.get('Shooting', 0),
                'Evasion': pet.get('Evasion', 0),
                'Lethality': pet.get('Lethality', 50),
                'Resistance': pet.get('Resistance', 70),
                'Counterattack': pet.get('Counterattack', 30)
            })
            
            pets_list.append(pet_dict)
        
        # 先返回数据，然后再批量修正等级（不阻塞响应）
        # 返回分页信息（网游级优化）
        response_data = {
            'type': 'robot_pets_response', 
            'success': True, 
            'pets': pets_list,
            'battle_team': battle_team,
            'team_version': team_version,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total_count,
                'has_more': has_more
            }
        }
        
        # 关键修复：移除缓存机制，确保总是返回最新数据
        # 原因：机甲数据可能频繁更新（升级、装备、创建、删除等），缓存会导致数据不一致
        # 如果未来需要缓存，应该在更新操作时调用 invalidate_cached_query 使缓存失效
        # 暂时不缓存，确保数据实时性
        
        # 使用直接发送格式（自动添加request_id）
        await utils.send_direct_response(websocket, response_data, request_data=data)
        
        # 后台批量修正需要更新的机甲等级（异步执行，不阻塞响应）
        # 使用 asyncio.create_task 创建后台任务，避免阻塞
        if pets_to_fix:
            async def fix_pets_levels_async():
                for fix_info in pets_to_fix:
                    try:
                        pet_id = fix_info['pet_id']
                        old_level = fix_info['old_level']
                        new_level = fix_info['new_level']
                        pet_name = fix_info['pet_name']
                        total_exp = fix_info['total_exp']
                        
                        print(f'[等级修正-批量] 机甲 {pet_name}: 数据库等级 {old_level}, 计算等级 {new_level}, 经验 {total_exp}')
                        
                        # 更新等级
                        update_data = {'Level': new_level}
                        
                        # 如果升级了，需要重新计算属性
                        if new_level > old_level:
                            robot_id = fix_info['robot_id']
                            pet_data = fix_info['pet_data'].copy()
                            pet_data['Level'] = new_level  # 更新等级以便计算属性
                            updated_attrs = upgrade_manager.calculate_attributes(pet_data, robot_id=robot_id)
                            if updated_attrs:
                                update_data.update(updated_attrs)
                        
                        # 批量更新（MMO级优化：异步操作）
                        await utils.async_mongo_operation(
                            lambda: utils.robotpet_col.update_one(
                                {'_id': pet_id},
                                {'$set': update_data}
                            ),
                            timeout=2.0
                        )
                    except Exception as e:
                        print(f'[等级修正失败] 机甲 {fix_info.get("pet_name", "未知")}: {e}')
            
            # 创建后台任务，不等待完成（避免阻塞响应）
            try:
                asyncio.create_task(fix_pets_levels_async())
            except Exception as e:
                print(f'[创建后台任务失败] {e}')
                # 如果创建任务失败，直接执行（同步方式，但至少能完成修正）
                loop = asyncio.get_event_loop()
                loop.create_task(fix_pets_levels_async())
    except Exception as e:
        # 改进错误处理：区分连接错误和其他错误
        error_type = type(e).__name__
        if 'Connection' in error_type or 'Timeout' in error_type or 'AutoReconnect' in error_type:
            error_message = '数据库连接失败，请稍后重试'
            print(f'❌ [RobotHandler] 数据库连接错误: {error_type}: {e}')
        else:
            error_message = f'获取机甲列表失败: {str(e)}'
            print(f'❌ [RobotHandler] 获取机甲列表错误: {error_type}: {e}')
        
        await utils.send_direct_response(websocket, {
            'type': 'robot_pets_response', 
            'success': False, 
            'pets': [], 
            'message': error_message
        }, request_data=data)


async def handle_get_robot_pet_info(websocket, data):
    """获取单个机甲宠物详细信息（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    pet_id = data.get('pet_id')
    print(f'🔍 收到获取机甲详情请求: pet_id={pet_id}, token={token[:20] if token else None}...')
    
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        # 测试模式下不打印错误（因为可能通过user_id自动认证）
        if not user_id:
            print(f'❌ 无效的token且未提供user_id')
        await utils.send_error_response(websocket, 'robot_pet_info', '用户不存在或未登录', code=401, request_data=data)
        return
    
    if not pet_id:
        print(f'❌ 缺少pet_id')
        await utils.send_error_response(websocket, 'robot_pet_info', '缺少pet_id', code=400, request_data=data)
        return
    
    try:
        # 尝试转换ObjectId
        try:
            pet_object_id = ObjectId(pet_id)
            print(f'✅ pet_id 转换为 ObjectId: {pet_object_id}')
        except Exception as oid_error:
            print(f'❌ ObjectId转换失败: {oid_error}, pet_id: {pet_id}')
            await utils.send_error_response(websocket, 'robot_pet_info', f'无效的pet_id格式: {str(oid_error)}', code=400, request_data=data)
            return
        
        # 查找机甲宠物（验证是否属于该用户）
        print(f'🔍 查找机甲: _id={pet_object_id}, user_id={user["_id"]}')
        pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({
            '_id': pet_object_id,
            'user_id': user['_id']
        }))
        
        if not pet:
            print(f'❌ 机甲不存在或不属于该用户: pet_id={pet_id}')
            await utils.send_error_response(websocket, 'robot_pet_info', '机甲不存在或不属于该用户', code=404, request_data=data)
            return
        
        print(f'✅ 找到机甲: {pet.get("RobotName", "未知")} (pet_id: {pet_id})')

        cid_on_pet = pet.get('character_id')
        if cid_on_pet is not None and str(cid_on_pet).strip() != '':
            try:
                from . import bag_handler
                from .equipment_handler import strip_invalid_equipment_for_pet
                inv = await strip_invalid_equipment_for_pet(
                    user['_id'], str(cid_on_pet).strip(), str(pet['_id']), bag_handler._add_item_to_inventory
                )
                if inv.get('stripped_slots'):
                    pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({
                        '_id': pet_object_id,
                        'user_id': user['_id'],
                    }))
                    if not pet:
                        await utils.send_error_response(websocket, 'robot_pet_info', '机甲不存在或不属于该用户', code=404, request_data=data)
                        return
            except Exception as e:
                print(f'⚠️ [RobotHandler] get_robot_pet_info 自动卸下违规装备失败: {e}')
        
        # 获取AniID（完整字符串，如"yl_L1"）
        ani_id = pet.get('AniID', '') or ''
        print(f'📹 机甲动画ID: {ani_id}')
        
        # 计算机甲经验条数据（与人物经验计算方式一致）
        total_exp = pet.get('EXP', 0)
        level, current_level_exp, next_level_total_exp = utils.calculate_robot_exp_bar(total_exp)
        
        # 检查等级是否需要修正（先返回数据，后台更新，避免阻塞）
        db_level = pet.get('Level', 1)
        need_fix_level = (level != db_level)
        
        # 返回完整的机甲信息（与robot_info格式保持一致）
        resp = {
            'type': 'robot_info',
            'success': True,
            'pet_id': str(pet['_id']),
            'robot_base_id': pet.get('robot_base_id', ''),
            'RobotID': pet.get('RobotID', ''),
            'RobotName': pet.get('RobotName', ''),
            'Growth': pet.get('Growth', 50),
            'Comprehension': pet.get('Comprehension', 50),
            'Level': level,
            'StarLevel': pet.get('StarLevel', 1),
            'Form': pet.get('Form', 1),
            'Class': pet.get('Class', 1),
            'AniID': ani_id,
            'HP': pet.get('HP', 1000),
            'MaxHP': pet.get('MaxHP', 1000),
            'CurrentHP': pet.get('CurrentHP') if pet.get('CurrentHP') is not None else pet.get('MaxHP', 1000),
            'MP': pet.get('MP', 300),
            'MaxMP': pet.get('MaxMP', 300),
            'CurrentMP': pet.get('CurrentMP') if pet.get('CurrentMP') is not None else pet.get('MaxMP', 300),
            'EXP': total_exp,
            'total_exp': total_exp,
            'MaxEXP': next_level_total_exp,
            'CurrentEXP': current_level_exp,
            'current_level_exp': current_level_exp,
            'next_level_need_exp': next_level_total_exp,
            'Melee': pet.get('Melee', 120),
            'Accuracy': pet.get('Accuracy', 110),
            'Armor': pet.get('Armor', 95),
            'Corrosion': pet.get('Corrosion', 60),
            'Initiative': pet.get('Initiative', 80),
            'Block': pet.get('Block', 40),
            'ParticleShield': pet.get('ParticleShield', 35),
            'ArmorPenetration': pet.get('ArmorPenetration', 55),
            'Shooting': pet.get('Shooting', 0),
            'Evasion': pet.get('Evasion', 0),
            'Lethality': pet.get('Lethality', 0),
            'Resistance': pet.get('Resistance', 0),
            'Counterattack': pet.get('Counterattack', 0),
            'CurrentMelee': pet.get('CurrentMelee') if pet.get('CurrentMelee') is not None else pet.get('Melee', 0),
            'CurrentArmor': pet.get('CurrentArmor') if pet.get('CurrentArmor') is not None else pet.get('Armor', 0),
            'CurrentAccuracy': pet.get('CurrentAccuracy') if pet.get('CurrentAccuracy') is not None else pet.get('Accuracy', 0),
            'CurrentCorrosion': pet.get('CurrentCorrosion') if pet.get('CurrentCorrosion') is not None else pet.get('Corrosion', 0),
            'CurrentInitiative': pet.get('CurrentInitiative') if pet.get('CurrentInitiative') is not None else pet.get('Initiative', 0),
            'CurrentBlock': pet.get('CurrentBlock') if pet.get('CurrentBlock') is not None else pet.get('Block', 0),
            'CurrentParticleShield': pet.get('CurrentParticleShield') if pet.get('CurrentParticleShield') is not None else pet.get('ParticleShield', 0),
            'CurrentArmorPenetration': pet.get('CurrentArmorPenetration') if pet.get('CurrentArmorPenetration') is not None else pet.get('ArmorPenetration', 0),
            'CurrentShooting': pet.get('CurrentShooting') if pet.get('CurrentShooting') is not None else pet.get('Shooting', 0),
            'CurrentEvasion': pet.get('CurrentEvasion') if pet.get('CurrentEvasion') is not None else pet.get('Evasion', 45),
            'CurrentLethality': pet.get('CurrentLethality') if pet.get('CurrentLethality') is not None else pet.get('Lethality', 50),
            'CurrentResistance': pet.get('CurrentResistance') if pet.get('CurrentResistance') is not None else pet.get('Resistance', 70),
            'CurrentCounterattack': pet.get('CurrentCounterattack') if pet.get('CurrentCounterattack') is not None else pet.get('Counterattack', 30),
            # 装备槽位信息
            'equipment': pet.get('equipment', {})
        }
        # 先返回数据，然后再修正等级（不阻塞响应）
        # 使用直接发送格式（自动添加request_id），注意类型改为robot_pet_info_response
        resp['type'] = 'robot_pet_info_response'  # 确保类型正确
        await utils.send_direct_response(websocket, resp, request_data=data)
        print(f'✅ 返回机甲详情: {pet.get("RobotName", "")} (pet_id: {pet_id}, type: robot_pet_info_response)')
        
        # 后台修正等级（异步执行，不阻塞响应）
        if need_fix_level:
            try:
                print(f'[等级修正-异步] 机甲 {pet.get("RobotName", "未知")}: 数据库等级 {db_level}, 计算等级 {level}, 经验 {total_exp}')
                # 更新数据库中的等级
                update_data = {'Level': level}
                
                # 如果升级了，需要重新计算属性
                if level > db_level:
                    upgrade_manager = get_upgrade_manager()
                    robot_id = pet.get('RobotID', '')
                    pet_copy = pet.copy()
                    pet_copy['Level'] = level
                    updated_attrs = upgrade_manager.calculate_attributes(pet_copy, robot_id=robot_id)
                    if updated_attrs:
                        update_data.update(updated_attrs)
                
                utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                    {'_id': pet['_id']},
                    {'$set': update_data}
                ))
            except Exception as e:
                print(f'[等级修正失败] 机甲 {pet.get("RobotName", "未知")}: {e}')
    except Exception as e:
        import traceback
        print(f'❌ 获取机甲详情失败: {e}')
        print(f'详细错误: {traceback.format_exc()}')
        await utils.send_error_response(websocket, 'robot_pet_info', f'获取机甲详情失败: {str(e)}', code=500, request_data=data)


async def handle_create_initial_pet(websocket, data):
    """为已有用户创建初始宠物（管理接口，支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'create_initial_pet_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    # 检查用户是否已有宠物
    existing_pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({
        'user_id': user['_id'],
        'character_id': None
    }))
    if existing_pet:
        await websocket.send(json.dumps({
            'type': 'create_initial_pet_response',
            'success': False,
            'message': '用户已有未关联角色的宠物'
        }))
        return
    
    # 从RobotBase随机选择一个机甲作为基础
    try:
        sample = utils.safe_mongo_operation(lambda: list(utils.robotbase_col.aggregate([{ '$sample': { 'size': 1 } }])))
        if not sample:
            await websocket.send(json.dumps({
                'type': 'create_initial_pet_response',
                'success': False,
                'message': 'RobotBase集合为空，无法创建宠物'
            }))
            return
        
        base_robot = sample[0]
        # 使用统一的create_robot_pet函数创建宠物，确保完整复制所有字段
        # character_id设为None，表示暂时不关联角色
        if not _create_robot_pet:
            await websocket.send(json.dumps({
                'type': 'create_initial_pet_response',
                'success': False,
                'message': '创建宠物函数未初始化'
            }))
            return
        
        robot_pet = _create_robot_pet(user['_id'], None, base_robot)
        await websocket.send(json.dumps({
            'type': 'create_initial_pet_response',
            'success': True,
            'message': f'成功创建初始宠物: {base_robot.get("RobotName", "")}',
            'pet_name': base_robot.get('RobotName', ''),
            'growth': robot_pet.get('Growth', 0),
            'comprehension': robot_pet.get('Comprehension', 0)
        }))
        print(f'为用户 {user.get("account", "")} 创建初始机甲宠物: {base_robot.get("RobotName", "")}')
    except Exception as e:
        print(f'创建初始机甲宠物失败: {e}')
        await websocket.send(json.dumps({
            'type': 'create_initial_pet_response',
            'success': False,
            'message': f'创建宠物失败: {str(e)}'
        }))


async def handle_fix_robot_pet_form(websocket, data):
    """修复所有RobotPet的Form字段（从RobotBase中获取正确的Form值，支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'fix_robot_pet_form_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    try:
        fixed_count = 0
        error_count = 0
        
        # 查找所有RobotPet记录
        pets = utils.safe_mongo_operation(lambda: list(utils.robotpet_col.find({})))
        for pet in pets:
            robot_base_id = pet.get('robot_base_id')
            if not robot_base_id:
                error_count += 1
                continue
            
            # 从RobotBase获取正确的Form值
            try:
                base_robot = utils.safe_mongo_operation(lambda: utils.robotbase_col.find_one({'_id': ObjectId(robot_base_id)}))
                if base_robot:
                    correct_form = base_robot.get('Form', 1)
                    current_form = pet.get('Form', 1)
                    
                    # 如果Form值不正确，则更新
                    if current_form != correct_form:
                        utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                            {'_id': pet['_id']},
                            {'$set': {'Form': correct_form}}
                        ))
                        fixed_count += 1
                        print(f'修复机甲 {pet.get("RobotName", "未知")}: Form {current_form} -> {correct_form}')
                else:
                    error_count += 1
                    print(f'警告: 找不到RobotBase记录 {robot_base_id}')
            except Exception as e:
                error_count += 1
                print(f'修复机甲 {pet.get("RobotName", "未知")} 失败: {e}')
        
        await websocket.send(json.dumps({
            'type': 'fix_robot_pet_form_response',
            'success': True,
            'message': f'修复完成: {fixed_count} 个机甲已修复, {error_count} 个失败'
        }))
        print(f'Form字段修复完成: {fixed_count} 个已修复, {error_count} 个失败')
    except Exception as e:
        print(f'修复Form字段失败: {e}')
        await websocket.send(json.dumps({
            'type': 'fix_robot_pet_form_response',
            'success': False,
            'message': f'修复失败: {str(e)}'
        }))


async def handle_upgrade_robot(websocket, data):
    """升级单个机甲"""
    token = data.get('token')
    pet_id = data.get('pet_id')
    exp_amount = int(data.get('exp', 0))
    
    # 验证经验值
    if exp_amount <= 0:
        await websocket.send(json.dumps({
            'type': 'upgrade_robot_response',
            'success': False,
            'message': '经验值必须大于0'
        }))
        return
    
    # 验证Token
    if not token:
        await websocket.send(json.dumps({
            'type': 'upgrade_robot_response',
            'success': False,
            'message': '缺少token'
        }))
        return
    
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'upgrade_robot_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    # 验证pet_id
    if not pet_id:
        await websocket.send(json.dumps({
            'type': 'upgrade_robot_response',
            'success': False,
            'message': '缺少pet_id'
        }))
        return
    
    try:
        # 转换ObjectId
        pet_object_id = ObjectId(pet_id)
        
        # 关键修复：使用请求锁防止同一机甲同时处理多个升级请求（防抖机制）
        # 获取或创建该机甲的升级锁
        if _upgrade_request_locks is None:
            await websocket.send(json.dumps({
                'type': 'upgrade_robot_response',
                'success': False,
                'message': '升级锁未初始化'
            }))
            return
        
        if pet_id not in _upgrade_request_locks:
            _upgrade_request_locks[pet_id] = asyncio.Lock()
        
        upgrade_lock = _upgrade_request_locks[pet_id]
        
        # 尝试获取锁，如果正在处理中则返回提示
        if upgrade_lock.locked():
            await websocket.send(json.dumps({
                'type': 'upgrade_robot_response',
                'success': False,
                'message': '该机甲正在升级中，请稍后再试'
            }))
            return
        
        # 使用锁保护升级操作
        async with upgrade_lock:
            # 使用原子更新操作避免并发问题
            upgrade_manager = get_upgrade_manager()
            result = upgrade_manager.add_exp_to_robot_atomic(
                utils.robotpet_col, pet_object_id, user['_id'], exp_amount
            )
        
            if result[0] is None:  # 更新失败
                await websocket.send(json.dumps({
                    'type': 'upgrade_robot_response',
                    'success': False,
                    'message': '机甲不存在或不属于该用户，或已满级'
                }))
                return
            
            new_level, new_exp, level_up_count, updated_attrs = result
            
            # 关键修复：重新读取更新后的机甲数据，返回完整的机甲信息给客户端
            pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({
                '_id': pet_object_id,
                'user_id': user['_id']
            }))
            
            if not pet:
                # 如果读取失败，至少返回升级结果
                _, current_level_exp, next_level_total_exp = utils.calculate_robot_exp_bar(new_exp, new_level)
                await websocket.send(json.dumps({
                    'type': 'upgrade_robot_response',
                    'success': True,
                    'pet_id': pet_id,
                    'level': new_level,
                    'total_exp': new_exp,
                    'exp': new_exp,
                    'current_level_exp': current_level_exp,
                    'next_level_need_exp': next_level_total_exp,
                    'CurrentEXP': current_level_exp,
                    'MaxEXP': next_level_total_exp,
                    'level_up_count': level_up_count,
                    'updated_attrs': updated_attrs
                }))
                print(f'⚠️ 升级成功但读取机甲数据失败: pet_id: {pet_id}')
                return
            
            # 计算机甲经验条数据（使用原子操作返回的新等级和新经验）
            _, current_level_exp, next_level_total_exp = utils.calculate_robot_exp_bar(new_exp, new_level)
            
            # 获取AniID
            ani_id = pet.get('AniID', '') or ''
            
            # 构造完整的机甲信息响应（兼容robot_info格式，方便客户端直接更新显示）
            upgrade_response = {
                'type': 'upgrade_robot_response',
                'success': True,
                'pet_id': pet_id,
                'robot_base_id': pet.get('robot_base_id', ''),
                'RobotID': pet.get('RobotID', ''),
                'RobotName': pet.get('RobotName', ''),
                'Growth': pet.get('Growth', 50),
                'Comprehension': pet.get('Comprehension', 50),
                'Level': new_level,  # 使用新等级
                'StarLevel': pet.get('StarLevel', 1),
                'Form': pet.get('Form', 1),
                'Class': pet.get('Class', 1),
                'AniID': ani_id,
                'HP': pet.get('HP', 1000),
                'MaxHP': pet.get('MaxHP', 1000),
                'CurrentHP': pet.get('CurrentHP') if pet.get('CurrentHP') is not None else pet.get('MaxHP', 1000),
                'MP': pet.get('MP', 300),
                'MaxMP': pet.get('MaxMP', 300),
                'CurrentMP': pet.get('CurrentMP') if pet.get('CurrentMP') is not None else pet.get('MaxMP', 300),
                'EXP': new_exp,  # 累计总经验（使用新经验）
                'total_exp': new_exp,
                'MaxEXP': next_level_total_exp,
                'CurrentEXP': current_level_exp,
                'current_level_exp': current_level_exp,
                'next_level_need_exp': next_level_total_exp,
                'Melee': pet.get('Melee', 120),
                'Accuracy': pet.get('Accuracy', 110),
                'Armor': pet.get('Armor', 95),
                'Corrosion': pet.get('Corrosion', 60),
                'Initiative': pet.get('Initiative', 80),
                'Block': pet.get('Block', 40),
                'ParticleShield': pet.get('ParticleShield', 35),
                'ArmorPenetration': pet.get('ArmorPenetration', 55),
                'Shooting': pet.get('Shooting', 0),
                'Evasion': pet.get('Evasion', 0),
                'Lethality': pet.get('Lethality', 0),
                'Resistance': pet.get('Resistance', 0),
                'Counterattack': pet.get('Counterattack', 0),
                'CurrentMelee': pet.get('CurrentMelee') if pet.get('CurrentMelee') is not None else pet.get('Melee', 0),
                'CurrentArmor': pet.get('CurrentArmor') if pet.get('CurrentArmor') is not None else pet.get('Armor', 0),
                'CurrentAccuracy': pet.get('CurrentAccuracy') if pet.get('CurrentAccuracy') is not None else pet.get('Accuracy', 0),
                'CurrentCorrosion': pet.get('CurrentCorrosion') if pet.get('CurrentCorrosion') is not None else pet.get('Corrosion', 0),
                'CurrentInitiative': pet.get('CurrentInitiative') if pet.get('CurrentInitiative') is not None else pet.get('Initiative', 0),
                'CurrentBlock': pet.get('CurrentBlock') if pet.get('CurrentBlock') is not None else pet.get('Block', 0),
                'CurrentParticleShield': pet.get('CurrentParticleShield') if pet.get('CurrentParticleShield') is not None else pet.get('ParticleShield', 0),
                'CurrentArmorPenetration': pet.get('CurrentArmorPenetration') if pet.get('CurrentArmorPenetration') is not None else pet.get('ArmorPenetration', 0),
                'CurrentShooting': pet.get('CurrentShooting') if pet.get('CurrentShooting') is not None else pet.get('Shooting', 0),
                'CurrentEvasion': pet.get('CurrentEvasion') if pet.get('CurrentEvasion') is not None else pet.get('Evasion', 45),
                'CurrentLethality': pet.get('CurrentLethality') if pet.get('CurrentLethality') is not None else pet.get('Lethality', 50),
                'CurrentResistance': pet.get('CurrentResistance') if pet.get('CurrentResistance') is not None else pet.get('Resistance', 70),
                'CurrentCounterattack': pet.get('CurrentCounterattack') if pet.get('CurrentCounterattack') is not None else pet.get('Counterattack', 30),
                'level_up_count': level_up_count,
                'updated_attrs': updated_attrs
            }
            
            # 如果升级了，使用updated_attrs覆盖属性值
            if updated_attrs:
                for key, value in updated_attrs.items():
                    upgrade_response[key] = value
            
            await websocket.send(json.dumps(upgrade_response))
            
            print(f'✅ 机甲升级成功: pet_id: {pet_id}, level: {new_level}, exp: {new_exp}, level_up: {level_up_count}')
    except Exception as e:
        import traceback
        print(f'❌ 机甲升级失败: {e}')
        print(f'详细错误: {traceback.format_exc()}')
        await websocket.send(json.dumps({
            'type': 'upgrade_robot_response',
            'success': False,
            'message': f'升级失败: {str(e)}'
        }))


async def handle_upgrade_all_robots(websocket, data, current_character_id):
    """机甲升级：给所有机甲加经验"""
    token = data.get('token')
    exp_amount = int(data.get('exp', 0))
    target_character_id = data.get('character_id') or current_character_id
    
    # 验证经验值
    if exp_amount <= 0:
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': '经验值必须大于0'
        }))
        return
    
    # 验证Token
    if not token:
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': '缺少token'
        }))
        return
    
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    # 验证角色ID
    if not target_character_id:
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': '未选择角色'
        }))
        return
    
    # 验证角色是否属于该用户
    player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'user_id': user['_id'], 'character_id': target_character_id}))
    if not player:
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': '角色不存在或不属于该用户'
        }))
        return
    
    try:
        # 网游级优化：使用字段投影，只查询需要的字段
        pets = utils.safe_mongo_operation(lambda: list(utils.robotpet_col.find(
            {
                'user_id': user['_id'],
                'character_id': target_character_id
            },
            {
                '_id': 1, 'EXP': 1, 'Level': 1, 'RobotID': 1, 'RobotName': 1,
                'Growth': 1, 'Comprehension': 1, 'StarLevel': 1, 'Form': 1, 'Class': 1,
                'HP': 1, 'MaxHP': 1, 'MP': 1, 'MaxMP': 1,
                'Melee': 1, 'Accuracy': 1, 'Armor': 1, 'Corrosion': 1, 'Initiative': 1,
                'Block': 1, 'ParticleShield': 1, 'ArmorPenetration': 1, 'Shooting': 1,
                'Evasion': 1, 'Lethality': 1, 'Resistance': 1, 'Counterattack': 1
            }
        )))
        
        if not pets:
            await websocket.send(json.dumps({
                'type': 'upgrade_all_robots_response',
                'success': False,
                'message': '该角色没有机甲'
            }))
            return
        
        # MMO级优化：快速批量升级（先计算，再批量更新，先返回响应）
        upgrade_manager = get_upgrade_manager()
        upgrade_results = []
        total_level_ups = 0
        
        # 收集批量更新操作（MMO级优化：减少数据库操作次数）
        bulk_updates = []
        
        # MMO级优化：在内存中计算所有升级结果，避免逐个查询数据库
        for pet in pets:
            pet_id = str(pet['_id'])
            old_level = pet.get('Level', 1)
            current_exp = pet.get('EXP', 0)
            
            # 如果已经满级，跳过
            if old_level >= 60:
                upgrade_results.append({
                    'pet_id': pet_id,
                    'robot_name': pet.get('RobotName', ''),
                    'old_level': old_level,
                    'new_level': old_level,
                    'total_exp': current_exp,
                    'level_up_count': 0
                })
                continue
            
            # MMO级优化：在内存中计算新经验和等级（不查询数据库）
            new_exp = current_exp + exp_amount
            new_level = upgrade_manager.calculate_level_from_exp(new_exp)
            level_up_count = new_level - old_level
            
            # 初始化 pet_data（用于属性计算和升星检查）
            pet_data = pet.copy()
            pet_data['Level'] = new_level
            
            # 如果升级了，计算新属性
            updated_attrs = {}
            if level_up_count > 0:
                robot_id = pet.get('RobotID', '')
                updated_attrs = upgrade_manager.calculate_attributes(
                    pet_data, 
                    robot_id=robot_id
                )
                
                # 关键修复：对每个等级都检查升星（如果一次升级跨越多个等级）
                current_check_level = old_level
                for _ in range(level_up_count):
                    current_check_level += 1
                    # 临时设置等级以便检查升星
                    pet_data['Level'] = current_check_level
                    
                    # 检查升星逻辑（每个等级都检查）
                    if upgrade_manager.check_star_growth(pet_data):
                        # 升星时生成并存储随机加成率（0.01 到 0.02 之间）
                        star_rates_key = '_star_bonus_rates'
                        if star_rates_key not in pet_data:
                            pet_data[star_rates_key] = []
                        rate = 0.02 - random.random() * 0.01
                        pet_data[star_rates_key].append(rate)
                        print(f'[升星加成-批量] 机甲 {pet.get("RobotName", "未知")}: 等级 {current_check_level} 升星成功，生成随机加成率 {rate:.4f} ({rate*100:.2f}%)')
                
                # 设置到最终等级
                pet_data['Level'] = new_level
                
                # 重新计算属性（因为星级可能变化）
                updated_attrs = upgrade_manager.calculate_attributes(
                    pet_data, 
                    robot_id=robot_id
                )
                # 应用升星加成（累计所有升星的加成）
                updated_attrs = upgrade_manager.add_star_bonus(pet_data, updated_attrs)
                
                # 应用独特成长值
                updated_attrs = upgrade_manager.apply_unique_growth(pet_data, updated_attrs)
            
            # 收集批量更新
            update_data = {
                'Level': new_level,
                'EXP': new_exp,
                'StarLevel': pet_data.get('StarLevel', pet.get('StarLevel', 1))  # 更新星级
            }
            # 保存升星加成率列表（必须保存，确保每次升星的随机加成率都被记录）
            if '_star_bonus_rates' in pet_data:
                update_data['_star_bonus_rates'] = pet_data['_star_bonus_rates']
            if updated_attrs:
                update_data.update(updated_attrs)
            
            bulk_updates.append(UpdateOne(
                {'_id': pet['_id'], 'user_id': user['_id']},  # 双重验证确保安全
                {'$set': update_data}
            ))
            
            # 不需要重新读取，使用已有数据
            upgrade_results.append({
                'pet_id': pet_id,
                'robot_name': pet.get('RobotName', ''),
                'old_level': old_level,
                'new_level': new_level,
                'total_exp': new_exp,
                'level_up_count': level_up_count
            })
            
            total_level_ups += level_up_count
        
        # MMO级优化：先返回响应，后台批量更新（提升响应速度）
        response_data = {
            'type': 'upgrade_all_robots_response',
            'success': True,
            'character_id': target_character_id,
            'exp_amount': exp_amount,
            'total_robots': len(pets),
            'total_level_ups': total_level_ups,
            'results': upgrade_results
        }
        
        # 立即返回响应，不等待数据库更新
        await websocket.send(json.dumps(response_data))
        
        # 后台批量更新数据库（异步执行，不阻塞）
        if bulk_updates:
            async def update_database_async():
                try:
                    utils.safe_mongo_operation(lambda: utils.robotpet_col.bulk_write(bulk_updates, ordered=False))
                    print(f'✅ 批量更新 {len(bulk_updates)} 个机甲属性（后台完成）')
                except Exception as e:
                    print(f'⚠️ 批量更新部分失败: {e}')
            
            # 创建后台任务，不等待完成
            asyncio.create_task(update_database_async())
        
        print(f'✅ 批量升级完成: 角色 {target_character_id} 的 {len(pets)} 个机甲各增加 {exp_amount} 经验，共升级 {total_level_ups} 次（已立即返回响应）')
    except Exception as e:
        import traceback
        print(f'❌ 批量升级失败: {e}')
        print(f'详细错误: {traceback.format_exc()}')
        await websocket.send(json.dumps({
            'type': 'upgrade_all_robots_response',
            'success': False,
            'message': f'批量升级失败: {str(e)}'
        }))
