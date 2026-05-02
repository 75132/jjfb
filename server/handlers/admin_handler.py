"""
管理员后台操作处理器
处理所有admin_开头的管理接口
"""
import json
import re
import time
import random
from . import utils

# 需要从ws_server导入的函数（通过参数传递）
_add_exp_to_player = None
_broadcast_to_user_async = None
_connected_clients = None
_current_connections = None
_MAX_CONNECTIONS = None
_performance_stats = None
_create_robot_pet = None

def init_admin_handler(add_exp_func, broadcast_func, connected_clients_set, current_conn, max_conn, perf_stats, create_robot_pet_func=None):
    """初始化管理员处理器需要的函数和变量"""
    global _add_exp_to_player, _broadcast_to_user_async
    global _connected_clients, _current_connections, _MAX_CONNECTIONS, _performance_stats, _create_robot_pet
    
    _add_exp_to_player = add_exp_func
    _broadcast_to_user_async = broadcast_func
    _connected_clients = connected_clients_set
    _current_connections = current_conn
    _MAX_CONNECTIONS = max_conn
    _performance_stats = perf_stats
    _create_robot_pet = create_robot_pet_func


async def handle_admin_search_account(websocket, data):
    """按账号搜索玩家"""
    account = data.get('account', '').strip()
    if not account:
        await websocket.send(json.dumps({
            'type': 'admin_search_response',
            'success': False,
            'message': '账号不能为空'
        }))
    else:
        try:
            user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'account': account}))
            if user:
                # 获取该用户的所有角色
                players = utils.safe_mongo_operation(lambda: list(utils.players_col.find({'user_id': user['_id']})))
                characters_data = []
                for player in players:
                    characters_data.append({
                        'user_id': str(user['_id']),
                        'account': user.get('account', ''),
                        'character_id': player.get('character_id'),
                        'role_name': player.get('role_name', ''),
                        'slot_index': player.get('slot_index'),
                        'level': player.get('level', 1),
                        'exp': player.get('exp', 0),
                        'gold': player.get('gold', 0),
                        'Sprite': player.get('Sprite', 0),
                        'class': player.get('class', 1)
                    })
                await websocket.send(json.dumps({
                    'type': 'admin_search_response',
                    'success': True,
                    'search_type': 'account',
                    'query': account,
                    'user_id': str(user['_id']),
                    'characters': characters_data
                }))
            else:
                await websocket.send(json.dumps({
                    'type': 'admin_search_response',
                    'success': False,
                    'message': '未找到该账号'
                }))
        except Exception as e:
            await websocket.send(json.dumps({
                'type': 'admin_search_response',
                'success': False,
                'message': f'搜索失败: {str(e)}'
            }))


async def handle_admin_search_character(websocket, data):
    """按角色名搜索玩家"""
    role_name = data.get('role_name', '').strip()
    if not role_name:
        await websocket.send(json.dumps({
            'type': 'admin_search_response',
            'success': False,
            'message': '角色名不能为空'
        }))
    else:
        try:
            # 使用正则表达式进行模糊搜索
            pattern = re.compile(role_name, re.IGNORECASE)
            players = utils.safe_mongo_operation(lambda: list(utils.players_col.find({'role_name': pattern})))
            
            if players:
                characters_data = []
                for player in players:
                    user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'_id': player.get('user_id')}))
                    characters_data.append({
                        'user_id': str(player.get('user_id', '')),
                        'account': user.get('account', '') if user else '',
                        'character_id': player.get('character_id'),
                        'role_name': player.get('role_name', ''),
                        'slot_index': player.get('slot_index'),
                        'level': player.get('level', 1),
                        'exp': player.get('exp', 0),
                        'gold': player.get('gold', 0),
                        'Sprite': player.get('Sprite', 0),
                        'class': player.get('class', 1)
                    })
                await websocket.send(json.dumps({
                    'type': 'admin_search_response',
                    'success': True,
                    'search_type': 'character',
                    'query': role_name,
                    'characters': characters_data
                }))
            else:
                await websocket.send(json.dumps({
                    'type': 'admin_search_response',
                    'success': False,
                    'message': '未找到该角色'
                }))
        except Exception as e:
            await websocket.send(json.dumps({
                'type': 'admin_search_response',
                'success': False,
                'message': f'搜索失败: {str(e)}'
            }))


async def handle_admin_get_player_by_id(websocket, data):
    """按角色ID获取玩家信息（管理接口，无需token）"""
    character_id = data.get('character_id', '').strip()
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_player_info',
            'success': False,
            'message': '角色ID不能为空'
        }))
    else:
        try:
            player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
            if player:
                user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'_id': player.get('user_id')}))
                # 计算等级
                total_exp = player.get('exp', 0)
                level = utils.calculate_level_from_exp(total_exp)
                
                # 从inventory_col获取背包物品（与客户端读取的集合一致）
                from .bag_handler import merge_inventory_items
                user_id = player.get('user_id')
                inventory_doc = utils.safe_mongo_operation(lambda: utils.inventory_col.find_one({
                    'user_id': user_id,
                    'character_id': character_id
                }))
                
                # 将数组格式转换为字典格式（用于控制台显示）
                items_dict = {}
                if inventory_doc:
                    items_list = merge_inventory_items(inventory_doc)
                    for item in items_list:
                        item_id = str(item.get('item_id', ''))
                        quantity = item.get('quantity', 0)
                        if item_id:
                            # 如果已有该物品，累加数量
                            if item_id in items_dict:
                                items_dict[item_id] += quantity
                            else:
                                items_dict[item_id] = quantity
                
                # 获取机甲数量
                robot_count = utils.compute_robot_count(user_id, character_id)
                
                await websocket.send(json.dumps({
                    'type': 'admin_player_info',
                    'success': True,
                    'user_id': str(user_id),
                    'account': user.get('account', '') if user else '',
                    'character_id': character_id,
                    'role_name': player.get('role_name', ''),
                    'slot_index': player.get('slot_index'),
                    'level': level,
                    'exp': total_exp,
                    'gold': player.get('gold', 0),
                    'Sprite': player.get('Sprite', 0),
                    'class': player.get('class', 1),
                    'items': items_dict,  # 转换为字典格式用于显示
                    'robotcount': robot_count,
                    'energy_blocks': utils.get_energy_blocks_for_response(player),
                    'alliance': player.get('alliance', ''),
                    'rank': player.get('rank', ''),
                    'friend_id': player.get('friend_id', '')
                }))
            else:
                await websocket.send(json.dumps({
                    'type': 'admin_player_info',
                    'success': False,
                    'message': '未找到该角色'
                }))
        except Exception as e:
            import traceback
            print(f'❌ [AdminHandler] 获取玩家信息失败: {e}\n{traceback.format_exc()}')
            await websocket.send(json.dumps({
                'type': 'admin_player_info',
                'success': False,
                'message': f'查询失败: {str(e)}'
            }))


async def handle_admin_get_server_stats(websocket, data):
    """获取服务器统计信息（包含路由统计）"""
    try:
        if _performance_stats is None:
            await websocket.send(json.dumps({
                'type': 'admin_server_stats',
                'success': False,
                'message': '性能统计未初始化'
            }))
            return
        
        # 导入路由统计服务
        from services.route_stats_service import route_stats_service
        
        uptime = time.time() - _performance_stats['start_time']
        cache_total = _performance_stats['cache_hits'] + _performance_stats['cache_misses']
        cache_hit_rate = (_performance_stats['cache_hits'] / cache_total * 100) if cache_total > 0 else 0
        
        # 统计在线玩家数（使用Session服务，只统计有选中角色的用户）
        from services.session_service import session_service
        online_count = 0
        for user_id in session_service.get_online_users():
            session = session_service.get_session(user_id)
            if session and session.character_id and session.is_online():
                online_count += 1
        
        # 统计总用户数
        total_users = utils.safe_mongo_operation(lambda: utils.users_col.count_documents({}))
        
        # 统计总角色数
        total_characters = utils.safe_mongo_operation(lambda: utils.players_col.count_documents({'character_id': {'$ne': None}}))
        
        # 获取路由统计信息
        route_total_stats = route_stats_service.get_total_stats()
        top_routes = route_stats_service.get_top_routes_by_count(limit=10)
        slow_routes = route_stats_service.get_slow_routes(threshold_ms=100.0, limit=10)
        error_routes = route_stats_service.get_error_routes(limit=10)
        
        await websocket.send(json.dumps({
            'type': 'admin_server_stats',
            'success': True,
            'stats': {
                'uptime': int(uptime),
                'current_connections': _current_connections if _current_connections is not None else 0,
                'max_connections': _MAX_CONNECTIONS,
                'online_players': online_count,
                'total_users': total_users,
                'total_characters': total_characters,
                'total_requests': _performance_stats['total_requests'],
                'total_messages': _performance_stats['total_messages_sent'],
                'total_broadcasts': _performance_stats['total_broadcasts'],
                'cache_hits': _performance_stats['cache_hits'],
                'cache_misses': _performance_stats['cache_misses'],
                'cache_hit_rate': round(cache_hit_rate, 2),
                'db_queries': _performance_stats['db_queries'],
                'qps': round(_performance_stats['total_requests'] / uptime, 2) if uptime > 0 else 0,
                # 路由统计信息
                'route_stats': {
                    'total_routes': route_total_stats.get('total_routes', 0),
                    'total_calls': route_total_stats.get('total_calls', 0),
                    'total_errors': route_total_stats.get('total_errors', 0),
                    'total_error_rate': route_total_stats.get('total_error_rate', 0),
                    'avg_time_per_call_ms': route_total_stats.get('avg_time_per_call', 0),
                    'top_routes_by_count': top_routes,
                    'slow_routes': slow_routes,
                    'error_routes': error_routes
                }
            }
        }))
    except Exception as e:
        await websocket.send(json.dumps({
            'type': 'admin_server_stats',
            'success': False,
            'message': f'获取统计信息失败: {str(e)}'
        }))


async def handle_admin_modify_gold(websocket, data):
    """修改金币（管理接口）"""
    character_id = data.get('character_id', '').strip()
    gold_amount = int(data.get('gold', 0))
    
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
    else:
        try:
            player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
            if not player:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_response',
                    'success': False,
                    'message': '角色不存在'
                }))
            else:
                result = utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                    {'character_id': character_id},
                    {'$set': {'gold': max(0, gold_amount)}}
                ))
                if result.matched_count > 0:
                    # 通知客户端更新数据
                    user_id = player.get('user_id')
                    if user_id and _broadcast_to_user_async:
                        # 获取更新后的完整玩家信息
                        updated_player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
                        if updated_player:
                            total_exp = updated_player.get('exp', 0)
                            level = utils.calculate_level_from_exp(total_exp)
                            await _broadcast_to_user_async(user_id, {
                                'type': 'player_info_update',
                                'success': True,
                                'character_id': character_id,
                                'gold': gold_amount,
                                'level': level,
                                'exp': total_exp,
                                'items': updated_player.get('items', {})
                            })
                    
                    await websocket.send(json.dumps({
                        'type': 'admin_modify_response',
                        'success': True,
                        'action': 'modify_gold',
                        'character_id': character_id,
                        'gold': gold_amount,
                        'message': f'金币已修改为 {gold_amount}'
                    }))
                else:
                    await websocket.send(json.dumps({
                        'type': 'admin_modify_response',
                        'success': False,
                        'message': '更新失败'
                    }))
        except Exception as e:
            await websocket.send(json.dumps({
                'type': 'admin_modify_response',
                'success': False,
                'message': f'修改失败: {str(e)}'
            }))


async def handle_admin_modify_level(websocket, data):
    """修改等级（管理接口）"""
    character_id = data.get('character_id', '').strip()
    level = int(data.get('level', 1))
    
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
    elif level < 1 or level > 60:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '等级必须在1-60之间'
        }))
    else:
        try:
            player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
            if not player:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_response',
                    'success': False,
                    'message': '角色不存在'
                }))
            else:
                # 计算该等级对应的经验值
                total_exp = utils.get_total_exp_for_level(level)
                result = utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                    {'character_id': character_id},
                    {'$set': {
                        'level': level,
                        'exp': total_exp
                    }}
                ))
                if result.matched_count > 0:
                    # 通知客户端更新数据
                    user_id = player.get('user_id')
                    if user_id and _broadcast_to_user_async:
                        # 获取更新后的完整玩家信息
                        updated_player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
                        if updated_player:
                            await _broadcast_to_user_async(user_id, {
                                'type': 'player_info_update',
                                'success': True,
                                'character_id': character_id,
                                'level': level,
                                'exp': total_exp,
                                'gold': updated_player.get('gold', 0),
                                'items': updated_player.get('items', {})
                            })
                    
                    await websocket.send(json.dumps({
                        'type': 'admin_modify_response',
                        'success': True,
                        'action': 'modify_level',
                        'character_id': character_id,
                        'level': level,
                        'exp': total_exp,
                        'message': f'等级已修改为 {level}，经验值已设置为 {total_exp}'
                    }))
                else:
                    await websocket.send(json.dumps({
                        'type': 'admin_modify_response',
                        'success': False,
                        'message': '更新失败'
                    }))
        except Exception as e:
            await websocket.send(json.dumps({
                'type': 'admin_modify_response',
                'success': False,
                'message': f'修改失败: {str(e)}'
            }))


async def handle_admin_get_online_players(websocket, data):
    """获取在线玩家列表（只统计当前选中的角色，不是所有角色）"""
    try:
        from services.session_service import session_service
        from bson import ObjectId
        
        online_players = []
        # 获取所有在线用户的Session
        online_users = session_service.get_online_users()
        
        for user_id in online_users:
            try:
                # 获取该用户的Session（可能有多个，取第一个有效的）
                session = session_service.get_session(user_id)
                if not session or not session.is_online():
                    continue
                
                # 只统计当前选中的角色
                character_id = session.character_id
                if not character_id:
                    # 如果没有选中角色，跳过
                    continue
                
                # 获取用户信息
                user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'_id': user_id}))
                if not user:
                    continue
                
                # 获取角色信息
                player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({
                    'character_id': character_id,
                    'user_id': user_id
                }))
                
                if player:
                    online_players.append({
                        'user_id': str(user_id),
                        'account': user.get('account', ''),
                        'character_id': str(character_id),
                        'role_name': player.get('role_name', ''),
                        'level': player.get('level', 1)
                    })
            except Exception as e:
                # 忽略转换错误，继续处理下一个
                print(f'[admin_handler] 处理在线玩家时出错: {e}')
                continue
        
        await websocket.send(json.dumps({
            'type': 'admin_online_players',
            'success': True,
            'count': len(online_players),
            'players': online_players
        }))
    except Exception as e:
        await websocket.send(json.dumps({
            'type': 'admin_online_players',
            'success': False,
            'message': f'获取在线玩家失败: {str(e)}'
        }))


async def handle_admin_get_route_stats(websocket, data):
    """获取路由统计信息（所有路由的详细统计）"""
    try:
        from services.route_stats_service import route_stats_service
        
        # 获取所有路由的统计信息
        all_stats = route_stats_service.get_stats(None)  # None表示获取所有路由
        
        # 转换为前端需要的格式（注意：get_stats返回的是字典，值是RouteStats对象或字典）
        route_stats = {}
        for route_name, stats in all_stats.items():
            # stats可能是RouteStats对象或字典
            if hasattr(stats, 'get_stats_dict'):
                stats_dict = stats.get_stats_dict()
            elif isinstance(stats, dict):
                stats_dict = stats
            else:
                continue
            
            route_stats[route_name] = {
                'total_calls': stats_dict.get('call_count', 0),
                'qps': 0,  # QPS需要根据时间计算，这里先设为0
                'avg_time': stats_dict.get('avg_time', 0),  # 已经是毫秒
                'max_time': stats_dict.get('max_time', 0),  # 已经是毫秒
                'error_count': stats_dict.get('error_count', 0),
                'error_rate': stats_dict.get('error_rate', 0)  # 已经是百分比（0-100）
            }
        
        await websocket.send(json.dumps({
            'type': 'admin_route_stats',
            'success': True,
            'stats': route_stats
        }))
    except Exception as e:
        import traceback
        traceback.print_exc()
        await websocket.send(json.dumps({
            'type': 'admin_route_stats',
            'success': False,
            'message': f'获取路由统计失败: {str(e)}'
        }))


async def handle_admin_add_exp(websocket, data):
    """管理接口：添加经验（无需token）"""
    character_id = data.get('character_id', '').strip()
    exp_amount = int(data.get('exp', 0))
    
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
    elif exp_amount <= 0:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '经验值必须大于0'
        }))
    else:
        try:
            player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
            if not player:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_response',
                    'success': False,
                    'message': '角色不存在'
                }))
            else:
                if not _add_exp_to_player:
                    await websocket.send(json.dumps({
                        'type': 'admin_modify_response',
                        'success': False,
                        'message': '经验计算函数未初始化'
                    }))
                    return
                
                user_id = player.get('user_id')
                new_level, new_exp, level_up_count = _add_exp_to_player(player, exp_amount)
                utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                    {'character_id': character_id},
                    {'$set': {'level': new_level, 'exp': new_exp}}
                ))
                
                # 通知客户端更新数据
                if user_id and _broadcast_to_user_async:
                    # 获取更新后的完整玩家信息
                    updated_player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
                    if updated_player:
                        await _broadcast_to_user_async(user_id, {
                            'type': 'player_info_update',
                            'success': True,
                            'character_id': character_id,
                            'level': new_level,
                            'exp': new_exp,
                            'gold': updated_player.get('gold', 0),
                            'items': updated_player.get('items', {}),
                            'level_up_count': level_up_count
                        })
                
                await websocket.send(json.dumps({
                    'type': 'admin_modify_response',
                    'success': True,
                    'action': 'add_exp',
                    'character_id': character_id,
                    'level': new_level,
                    'exp': new_exp,
                    'level_up_count': level_up_count,
                    'message': f'成功添加 {exp_amount} 经验，等级提升到 {new_level}'
                }))
        except Exception as e:
            await websocket.send(json.dumps({
                'type': 'admin_modify_response',
                'success': False,
                'message': f'添加经验失败: {str(e)}'
            }))


async def handle_admin_add_item(websocket, data):
    """管理接口：添加物品（无需token）- 写入inventory_col，与背包系统一致"""
    character_id = data.get('character_id', '').strip()
    item_id = int(data.get('itemId', 0))
    quantity = int(data.get('quantity', 1))
    
    if not character_id or not item_id or item_id <= 0:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '角色ID和物品ID不能为空'
        }))
        return
    
    if quantity <= 0:
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': '数量必须大于0'
        }))
        return
    
    try:
        # 先查找角色，获取user_id
        player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
        if not player:
            await websocket.send(json.dumps({
                'type': 'admin_modify_response',
                'success': False,
                'message': '角色不存在'
            }))
            return
        
        user_id = player.get('user_id')
        if not user_id:
            await websocket.send(json.dumps({
                'type': 'admin_modify_response',
                'success': False,
                'message': '无法获取用户ID'
            }))
            return
        
        # 从inventory_col获取现有物品列表（与客户端读取的集合一致）
        from .bag_handler import merge_inventory_items, split_inventory_items
        doc = utils.safe_mongo_operation(lambda: utils.inventory_col.find_one({
            'user_id': user_id,
            'character_id': character_id
        }))
        items = merge_inventory_items(doc) if doc else []
        
        # 加载物品配置（用于堆叠规则）
        from .bag_handler import load_all_item_ids_data, _normalize_and_stack_items
        items_data = load_all_item_ids_data()
        item_config = {}
        for item in items_data:
            iid = item.get('id')
            if iid:
                item_config[iid] = {
                    'CanStack': bool(item.get('CanStack', True)),
                    'StackLimit': int(item.get('StackLimit', 99) or 99)
                }
        
        # 查找是否已有该物品，尝试堆叠
        remaining_quantity = quantity
        
        for item in items:
            if int(item.get('item_id', 0)) == item_id:
                # 检查是否可以堆叠
                config = item_config.get(item_id, {'CanStack': True, 'StackLimit': 99})
                can_stack = config.get('CanStack', True)
                stack_limit = config.get('StackLimit', 99)
                
                if can_stack:
                    # 可以堆叠
                    current_qty = item.get('quantity', 0)
                    # 计算可以添加的数量
                    can_add = min(remaining_quantity, stack_limit - current_qty)
                    if can_add > 0:
                        item['quantity'] = current_qty + can_add
                        remaining_quantity -= can_add
                        if remaining_quantity <= 0:
                            break
        
        # 根据物品的itypeId自动分配分类
        # 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲)
        def get_category_by_item_id(item_id):
            for item in items_data:
                if item.get('id') == item_id:
                    itype_id = item.get('itypeId', 1)
                    if itype_id == 1:
                        return 1  # Items
                    elif itype_id in [2, 3]:  # Weapon, Gun
                        return 2  # 武器
                    elif itype_id in [4, 5, 6]:  # Wing, Dun, Armor
                        return 3  # 护甲
            return 1  # 默认分类为Items
        
        # 如果还有剩余，添加新格子
        while remaining_quantity > 0:
            config = item_config.get(item_id, {'CanStack': True, 'StackLimit': 99})
            stack_limit = config.get('StackLimit', 99)
            add_qty = min(remaining_quantity, stack_limit)
            
            category = get_category_by_item_id(item_id)
            items.append({
                'item_id': item_id,
                'quantity': add_qty,
                'category': category
            })
            remaining_quantity -= add_qty
        
        # 规范化堆叠（确保符合堆叠规则）
        items = _normalize_and_stack_items(items)
        
        # 按分类拆分到三个字段
        inventory_data = split_inventory_items(items)
        inventory_data['user_id'] = user_id
        inventory_data['character_id'] = character_id
        
        # 更新inventory_col（与客户端读取的集合一致）
        utils.safe_mongo_operation(lambda: utils.inventory_col.replace_one(
            {'user_id': user_id, 'character_id': character_id},
            inventory_data,
            upsert=True
        ))
        
        # 通知客户端刷新背包数据
        if _broadcast_to_user_async:
            try:
                update_msg = {
                    'type': 'bag_items_update',
                    'success': True,
                    'character_id': character_id
                }
                await _broadcast_to_user_async(user_id, update_msg)
            except Exception as e:
                print(f'⚠️ [AdminHandler] 通知客户端更新背包失败: {e}')
        
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': True,
            'action': 'add_item',
            'character_id': character_id,
            'itemId': item_id,
            'quantity': quantity,
            'message': f'成功添加物品 {item_id} x{quantity}'
        }))
        
    except Exception as e:
        import traceback
        print(f'❌ [AdminHandler] 添加物品失败: {e}\n{traceback.format_exc()}')
        await websocket.send(json.dumps({
            'type': 'admin_modify_response',
            'success': False,
            'message': f'添加物品失败: {str(e)}'
        }))


async def handle_admin_get_all_accounts(websocket, data):
    """获取所有账号列表（管理接口）"""
    try:
        # 获取所有账号，只返回账号名和基本信息
        users = utils.safe_mongo_operation(lambda: list(utils.users_col.find(
            {},
            {'account': 1, '_id': 1}  # 只查询账号和ID字段
        ).sort('account', 1)))  # 按账号名排序
        
        if not users:
            # 如果没有账号，返回空列表
            await websocket.send(json.dumps({
                'type': 'admin_all_accounts_response',
                'success': True,
                'accounts': [],
                'total': 0,
                'message': '暂无账号数据'
            }))
            return
        
        accounts_data = []
        for user in users:
            # 统计该账号下的角色数量
            character_count = utils.safe_mongo_operation(lambda: utils.players_col.count_documents({
                'user_id': user['_id'],
                'character_id': {'$ne': None}
            }))
            
            account_name = user.get('account', '')
            if account_name:  # 只添加有账号名的用户
                accounts_data.append({
                    'user_id': str(user['_id']),
                    'account': account_name,
                    'character_count': character_count
                })
        
        await websocket.send(json.dumps({
            'type': 'admin_all_accounts_response',
            'success': True,
            'accounts': accounts_data,
            'total': len(accounts_data)
        }))
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 获取账号列表失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_all_accounts_response',
            'success': False,
            'message': f'获取账号列表失败: {str(e)}'
        }))


async def handle_admin_get_robot_pets(websocket, data):
    """获取角色的宠物机甲列表（管理接口）"""
    character_id = data.get('character_id', '').strip()
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_robot_pets_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
        return
    
    try:
        # 先查找角色
        player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
        if not player:
            await websocket.send(json.dumps({
                'type': 'admin_robot_pets_response',
                'success': False,
                'message': '角色不存在'
            }))
            return
        
        user_id = player.get('user_id')
        
        # 获取该角色的所有宠物机甲
        pets = utils.safe_mongo_operation(lambda: list(utils.robotpet_col.find(
            {'user_id': user_id, 'character_id': character_id},
            {
                '_id': 1, 'RobotName': 1, 'RobotID': 1, 'Growth': 1, 'Comprehension': 1,
                'Level': 1, 'StarLevel': 1, 'Form': 1, 'Class': 1, 'AniID': 1,
                'EXP': 1, 'HP': 1, 'MaxHP': 1, 'CurrentHP': 1, 'MP': 1, 'MaxMP': 1, 'CurrentMP': 1,
                'Melee': 1, 'Accuracy': 1, 'Armor': 1, 'Corrosion': 1, 'Initiative': 1,
                'Block': 1, 'ParticleShield': 1, 'ArmorPenetration': 1, 'Shooting': 1,
                'Evasion': 1, 'Lethality': 1, 'Resistance': 1, 'Counterattack': 1, 'robot_base_id': 1
            }
        ).sort('Level', -1)))  # 按等级降序排列
        
        pets_data = []
        from .robot_upgrade import get_upgrade_manager
        upgrade_manager = get_upgrade_manager()
        
        for pet in pets:
            # 计算等级（根据经验）
            total_exp = pet.get('EXP', 0)
            calculated_level = upgrade_manager.calculate_level_from_exp(total_exp)
            db_level = pet.get('Level', 1)
            
            pets_data.append({
                'pet_id': str(pet['_id']),
                'robot_base_id': pet.get('robot_base_id', ''),
                'RobotID': pet.get('RobotID', ''),
                'RobotName': pet.get('RobotName', ''),
                'Growth': pet.get('Growth', 50),
                'Comprehension': pet.get('Comprehension', 50),
                'Level': calculated_level,  # 使用计算出的等级
                'db_level': db_level,  # 数据库中的等级（用于对比）
                'StarLevel': pet.get('StarLevel', 1),
                'Form': pet.get('Form', 1),
                'Class': pet.get('Class', 1),
                'AniID': pet.get('AniID', ''),
                'EXP': total_exp,
                'HP': pet.get('HP', 0),
                'MaxHP': pet.get('MaxHP', 0),
                'CurrentHP': pet.get('CurrentHP', 0),
                'MP': pet.get('MP', 0),
                'MaxMP': pet.get('MaxMP', 0),
                'CurrentMP': pet.get('CurrentMP', 0),
                'Melee': pet.get('Melee', 0),
                'Accuracy': pet.get('Accuracy', 0),
                'Armor': pet.get('Armor', 0),
                'Corrosion': pet.get('Corrosion', 0),
                'Initiative': pet.get('Initiative', 0),
                'Block': pet.get('Block', 0),
                'ParticleShield': pet.get('ParticleShield', 0),
                'ArmorPenetration': pet.get('ArmorPenetration', 0),
                'Shooting': pet.get('Shooting', 0),
                'Evasion': pet.get('Evasion', 0),
                'Lethality': pet.get('Lethality', 0),
                'Resistance': pet.get('Resistance', 0),
                'Counterattack': pet.get('Counterattack', 0)
            })
        
        await websocket.send(json.dumps({
            'type': 'admin_robot_pets_response',
            'success': True,
            'character_id': character_id,
            'pets': pets_data,
            'total': len(pets_data)
        }))
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 获取宠物机甲列表失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_robot_pets_response',
            'success': False,
            'message': f'获取宠物机甲列表失败: {str(e)}'
        }))


async def handle_admin_modify_robot_pet(websocket, data):
    """修改宠物机甲属性（管理接口，遵循升级和计算规则）"""
    pet_id = data.get('pet_id', '').strip()
    modify_type = data.get('modify_type', '').strip()
    
    if not pet_id:
        await websocket.send(json.dumps({
            'type': 'admin_modify_robot_pet_response',
            'success': False,
            'message': '宠物ID不能为空'
        }))
        return
    
    try:
        from bson import ObjectId
        pet_object_id = ObjectId(pet_id)
        
        # 查找宠物
        pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({'_id': pet_object_id}))
        if not pet:
            await websocket.send(json.dumps({
                'type': 'admin_modify_robot_pet_response',
                'success': False,
                'message': '宠物不存在'
            }))
            return
        
        from .robot_upgrade import get_upgrade_manager
        upgrade_manager = get_upgrade_manager()
        
        update_data = {}
        message_parts = []
        
        if modify_type == 'exp':
            # 添加经验（遵循升级规则）
            exp_amount = int(data.get('exp', 0))
            if exp_amount <= 0:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '经验值必须大于0'
                }))
                return
            
            # 使用升级管理器的原子操作添加经验
            user_id = pet.get('user_id')
            new_level, new_exp, level_up_count, updated_attrs = upgrade_manager.add_exp_to_robot_atomic(
                utils.robotpet_col, pet_object_id, user_id, exp_amount
            )
            
            if new_level is None:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '添加经验失败（机甲可能已满级或不存在）'
                }))
                return
            
            message_parts.append(f'成功添加 {exp_amount} 经验')
            if level_up_count > 0:
                message_parts.append(f'等级提升 {level_up_count} 级（{pet.get("Level", 1)} -> {new_level}）')
            
            # 重新获取更新后的宠物数据
            pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({'_id': pet_object_id}))
            
        elif modify_type == 'level':
            # 修改等级（需要重新计算经验和属性，使用备份数据作为基础）
            target_level = int(data.get('level', 1))
            if target_level < 1 or target_level > 60:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '等级必须在1-60之间'
                }))
                return
            
            # 获取备份数据
            backup = pet.get('RobotPet_backup', {})
            if not backup:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '该机甲没有备份数据，无法修改等级'
                }))
                return
            
            # 从备份恢复基础属性（用于计算）
            calc_pet = backup.copy()
            calc_pet['Level'] = 1  # 从1级开始计算
            calc_pet['Growth'] = pet.get('Growth', backup.get('Growth', 50))  # 使用当前的成长值
            calc_pet['Comprehension'] = pet.get('Comprehension', backup.get('Comprehension', 50))  # 使用当前的悟性值
            calc_pet['StarLevel'] = 1  # 从1星开始
            calc_pet['_star_bonus_rates'] = []  # 清空升星加成率，重新计算
            
            # 计算该等级对应的经验值
            target_exp = upgrade_manager.get_total_exp_for_level(target_level)
            
            # 从1级到目标等级，逐级计算升星
            level_up_count = target_level - 1
            if level_up_count > 0:
                for check_level in range(2, target_level + 1):
                    calc_pet['Level'] = check_level
                    # 检查升星逻辑（每个等级都检查）
                    if upgrade_manager.check_star_growth(calc_pet):
                        # 升星时生成并存储随机加成率（0.01 到 0.02 之间）
                        star_rates_key = '_star_bonus_rates'
                        if star_rates_key not in calc_pet:
                            calc_pet[star_rates_key] = []
                        rate = 0.02 - random.random() * 0.01
                        calc_pet[star_rates_key].append(rate)
                        print(f'[升星加成-管理] 机甲 {pet.get("RobotName", "未知")}: 等级 {check_level} 升星成功，生成随机加成率 {rate:.4f} ({rate*100:.2f}%)')
            
            # 更新到最终等级和经验
            calc_pet['Level'] = target_level
            calc_pet['EXP'] = target_exp
            
            # 重新计算属性（使用备份数据作为基础）
            robot_id = calc_pet.get('RobotID', '')
            updated_attrs = upgrade_manager.calculate_attributes(calc_pet, robot_id=robot_id)
            
            # 应用升星加成
            updated_attrs = upgrade_manager.add_star_bonus(calc_pet, updated_attrs)
            
            # 应用独特成长值
            updated_attrs = upgrade_manager.apply_unique_growth(calc_pet, updated_attrs)
            
            update_data = {
                'Level': target_level,
                'EXP': target_exp,
                'StarLevel': calc_pet.get('StarLevel', 1)  # 更新星级
            }
            # 保存升星加成率列表
            if '_star_bonus_rates' in calc_pet:
                update_data['_star_bonus_rates'] = calc_pet['_star_bonus_rates']
            update_data.update(updated_attrs)
            
            utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id},
                {'$set': update_data}
            ))
            
            message_parts.append(f'等级已修改为 {target_level}，经验值已设置为 {target_exp}，属性已基于备份数据重新计算')
            
        elif modify_type == 'growth':
            # 修改成长值（需要重新计算属性）
            growth = int(data.get('growth', 50))
            if growth < 0 or growth > 100:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '成长值必须在0-100之间'
                }))
                return
            
            pet['Growth'] = growth
            
            # 重新计算属性
            robot_id = pet.get('RobotID', '')
            updated_attrs = upgrade_manager.calculate_attributes(pet, robot_id=robot_id)
            updated_attrs = upgrade_manager.add_star_bonus(pet, updated_attrs)
            updated_attrs = upgrade_manager.apply_unique_growth(pet, updated_attrs)
            
            update_data = {'Growth': growth}
            # 保存升星加成率列表（如果存在）
            if '_star_bonus_rates' in pet:
                update_data['_star_bonus_rates'] = pet['_star_bonus_rates']
            update_data.update(updated_attrs)
            
            utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id},
                {'$set': update_data}
            ))
            
            message_parts.append(f'成长值已修改为 {growth}，属性已重新计算')
            
        elif modify_type == 'comprehension':
            # 修改悟性值（需要重新计算属性）
            comprehension = int(data.get('comprehension', 50))
            if comprehension < 0 or comprehension > 100:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '悟性值必须在0-100之间'
                }))
                return
            
            pet['Comprehension'] = comprehension
            
            # 重新计算属性
            robot_id = pet.get('RobotID', '')
            updated_attrs = upgrade_manager.calculate_attributes(pet, robot_id=robot_id)
            updated_attrs = upgrade_manager.add_star_bonus(pet, updated_attrs)
            updated_attrs = upgrade_manager.apply_unique_growth(pet, updated_attrs)
            
            update_data = {'Comprehension': comprehension}
            # 保存升星加成率列表（如果存在）
            if '_star_bonus_rates' in pet:
                update_data['_star_bonus_rates'] = pet['_star_bonus_rates']
            update_data.update(updated_attrs)
            
            utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id},
                {'$set': update_data}
            ))
            
            message_parts.append(f'悟性值已修改为 {comprehension}，属性已重新计算')
            
        elif modify_type == 'star_level':
            # 修改星级（需要重新计算属性，使用备份数据作为基础）
            star_level = int(data.get('star_level', 1))
            if star_level < 1:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '星级必须大于等于1'
                }))
                return
            
            # 获取备份数据
            backup = pet.get('RobotPet_backup', {})
            if not backup:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '该机甲没有备份数据，无法修改星级'
                }))
                return
            
            # 从备份恢复基础属性（用于计算）
            calc_pet = backup.copy()
            calc_pet['Level'] = pet.get('Level', backup.get('Level', 1))  # 使用当前等级
            calc_pet['Growth'] = pet.get('Growth', backup.get('Growth', 50))  # 使用当前的成长值
            calc_pet['Comprehension'] = pet.get('Comprehension', backup.get('Comprehension', 50))  # 使用当前的悟性值
            calc_pet['StarLevel'] = 1  # 从1星开始
            calc_pet['_star_bonus_rates'] = []  # 清空升星加成率，重新生成
            
            # 生成指定数量的升星加成率（从1星到目标星级）
            star_up_count = star_level - 1
            if star_up_count > 0:
                for _ in range(star_up_count):
                    rate = 0.02 - random.random() * 0.01
                    if '_star_bonus_rates' not in calc_pet:
                        calc_pet['_star_bonus_rates'] = []
                    calc_pet['_star_bonus_rates'].append(rate)
                calc_pet['StarLevel'] = star_level
            
            # 重新计算属性（使用备份数据作为基础）
            robot_id = calc_pet.get('RobotID', '')
            updated_attrs = upgrade_manager.calculate_attributes(calc_pet, robot_id=robot_id)
            
            # 应用升星加成
            updated_attrs = upgrade_manager.add_star_bonus(calc_pet, updated_attrs)
            
            # 应用独特成长值
            updated_attrs = upgrade_manager.apply_unique_growth(calc_pet, updated_attrs)
            
            update_data = {'StarLevel': star_level}
            # 保存升星加成率列表
            if '_star_bonus_rates' in calc_pet:
                update_data['_star_bonus_rates'] = calc_pet['_star_bonus_rates']
            update_data.update(updated_attrs)
            
            utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id},
                {'$set': update_data}
            ))
            
            message_parts.append(f'星级已修改为 {star_level}，属性已基于备份数据重新计算')
            
        elif modify_type == 'direct_attr':
            # 直接修改属性值（不触发计算）
            attr_name = data.get('attr_name', '').strip()
            attr_value = int(data.get('attr_value', 0))
            
            if not attr_name:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': '属性名称不能为空'
                }))
                return
            
            # 允许修改的属性列表
            allowed_attrs = [
                'HP', 'MaxHP', 'CurrentHP', 'MP', 'MaxMP', 'CurrentMP',
                'Melee', 'Shooting', 'Armor', 'Evasion', 'Accuracy',
                'Lethality', 'Corrosion', 'Resistance', 'Initiative',
                'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
                'CurrentMelee', 'CurrentShooting', 'CurrentArmor', 'CurrentEvasion',
                'CurrentAccuracy', 'CurrentLethality', 'CurrentCorrosion', 'CurrentResistance',
                'CurrentInitiative', 'CurrentCounterattack', 'CurrentBlock',
                'CurrentArmorPenetration', 'CurrentParticleShield'
            ]
            
            if attr_name not in allowed_attrs:
                await websocket.send(json.dumps({
                    'type': 'admin_modify_robot_pet_response',
                    'success': False,
                    'message': f'不允许修改的属性: {attr_name}'
                }))
                return
            
            # 直接更新属性值
            update_data = {attr_name: max(0, attr_value)}
            
            # 特殊处理：如果修改MaxHP，同时更新CurrentHP（如果CurrentHP大于新的MaxHP）
            if attr_name == 'MaxHP':
                update_data['CurrentHP'] = min(pet.get('CurrentHP', 0), attr_value)
            elif attr_name == 'MaxMP':
                update_data['CurrentMP'] = min(pet.get('CurrentMP', 0), attr_value)
            
            utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id},
                {'$set': update_data}
            ))
            
            message_parts.append(f'属性 {attr_name} 已修改为 {attr_value}')
            
        else:
            await websocket.send(json.dumps({
                'type': 'admin_modify_robot_pet_response',
                'success': False,
                'message': f'未知的修改类型: {modify_type}'
            }))
            return
        
        # 重新获取更新后的宠物数据
        updated_pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({'_id': pet_object_id}))
        
        await websocket.send(json.dumps({
            'type': 'admin_modify_robot_pet_response',
            'success': True,
            'pet_id': pet_id,
            'modify_type': modify_type,
            'message': '，'.join(message_parts),
            'pet': {
                'pet_id': pet_id,
                'RobotName': updated_pet.get('RobotName', ''),
                'Level': updated_pet.get('Level', 1),
                'EXP': updated_pet.get('EXP', 0),
                'Growth': updated_pet.get('Growth', 50),
                'Comprehension': updated_pet.get('Comprehension', 50),
                'StarLevel': updated_pet.get('StarLevel', 1)
            }
        }))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 修改宠物机甲失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_modify_robot_pet_response',
            'success': False,
            'message': f'修改失败: {str(e)}'
        }))


async def handle_admin_reset_robot_pet(websocket, data):
    """还原宠物机甲为1级状态（管理接口）"""
    pet_id = data.get('pet_id', '').strip()
    if not pet_id:
        await websocket.send(json.dumps({
            'type': 'admin_reset_robot_pet_response',
            'success': False,
            'message': '宠物ID不能为空'
        }))
        return
    
    try:
        from bson import ObjectId
        pet_object_id = ObjectId(pet_id)
        
        # 查找宠物
        pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({'_id': pet_object_id}))
        if not pet:
            await websocket.send(json.dumps({
                'type': 'admin_reset_robot_pet_response',
                'success': False,
                'message': '宠物不存在'
            }))
            return
        
        # 获取备份数据
        backup = pet.get('RobotPet_backup', {})
        if not backup:
            await websocket.send(json.dumps({
                'type': 'admin_reset_robot_pet_response',
                'success': False,
                'message': '该机甲没有备份数据，无法还原'
            }))
            return
        
        # 从备份恢复所有属性
        reset_data = {
            'Level': 1,
            'EXP': 0,
            'StarLevel': 1,
            '_star_bonus_rates': []  # 清空升星加成率列表
        }
        
        # 恢复备份中的所有属性
        for key, value in backup.items():
            if key not in ['user_id', 'character_id', 'robot_base_id', '_id', 'created_at']:
                reset_data[key] = value
        
        # 更新数据库
        utils.safe_mongo_operation(lambda: utils.robotpet_col.update_one(
            {'_id': pet_object_id},
            {'$set': reset_data}
        ))
        
        await websocket.send(json.dumps({
            'type': 'admin_reset_robot_pet_response',
            'success': True,
            'pet_id': pet_id,
            'message': '机甲已还原为1级状态'
        }))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 还原宠物机甲失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_reset_robot_pet_response',
            'success': False,
            'message': f'还原失败: {str(e)}'
        }))


async def handle_admin_delete_robot_pet(websocket, data):
    """删除单个宠物机甲（管理接口）"""
    pet_id = data.get('pet_id', '').strip()
    if not pet_id:
        await websocket.send(json.dumps({
            'type': 'admin_delete_robot_pet_response',
            'success': False,
            'message': '宠物ID不能为空'
        }))
        return
    
    try:
        from bson import ObjectId
        pet_object_id = ObjectId(pet_id)
        
        # 查找宠物
        pet = utils.safe_mongo_operation(lambda: utils.robotpet_col.find_one({'_id': pet_object_id}))
        if not pet:
            await websocket.send(json.dumps({
                'type': 'admin_delete_robot_pet_response',
                'success': False,
                'message': '宠物不存在'
            }))
            return
        
        robot_name = pet.get('RobotName', '未知')
        user_id = pet.get('user_id')
        character_id = pet.get('character_id')
        
        # 关键优化：放生时清空 slot_index（不回收编号，简单可靠）
        # 注意：这里使用 delete_one，如果是放生操作，应该先清空 slot_index 再删除
        # 但为了保持兼容性，这里直接删除（完全删除，不是放生）
        # 如果是放生操作，应该在删除前调用 utils.clear_slot_index(pet_id)
        
        # 删除宠物（包括备份数据）
        result = utils.safe_mongo_operation(lambda: utils.robotpet_col.delete_one({'_id': pet_object_id}))
        
        if result.deleted_count > 0:
            # 更新机甲数量
            if user_id and character_id:
                # 如果该机甲在出战队伍中，移除（服务器权威）
                try:
                    utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                        {'user_id': user_id, 'character_id': character_id},
                        {'$pull': {'battle_team': str(pet_object_id)}}
                    ))
                except Exception:
                    pass

                rc = utils.compute_robot_count(user_id, character_id)
                utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                    {'user_id': user_id, 'character_id': character_id},
                    {'$set': {'robotcount': rc}}
                ))
                
                # 获取更新后的机甲列表
                pets = list(utils.safe_mongo_operation(lambda: utils.robotpet_col.find({
                    'user_id': user_id,
                    'character_id': character_id
                })))
                pets_list = []
                for p in pets:
                    ani_id = p.get('AniID', '') or ''
                    pets_list.append({
                        'pet_id': str(p['_id']),
                        'robot_base_id': p.get('robot_base_id', ''),
                        'RobotID': p.get('RobotID', ''),
                        'RobotName': p.get('RobotName', ''),
                        'Growth': p.get('Growth', 50),
                        'Comprehension': p.get('Comprehension', 50),
                        'Level': p.get('Level', 1),
                        'StarLevel': p.get('StarLevel', 1),
                        'Form': p.get('Form', 1),
                        'Class': p.get('Class', 1),
                        'AniID': ani_id
                    })
                
                # 广播更新消息给客户端
                if _broadcast_to_user_async:
                    import asyncio
                    update_msg = {
                        'type': 'robotcount_update',
                        'success': True,
                        'character_id': character_id,
                        'robotcount': rc
                    }
                    pets_msg = {
                        'type': 'robot_pets_update',
                        'success': True,
                        'character_id': character_id,
                        'pets': pets_list
                    }
                    asyncio.create_task(_broadcast_to_user_async(user_id, update_msg))
                    asyncio.create_task(_broadcast_to_user_async(user_id, pets_msg))
            
            await websocket.send(json.dumps({
                'type': 'admin_delete_robot_pet_response',
                'success': True,
                'pet_id': pet_id,
                'message': f'成功删除机甲: {robot_name}'
            }))
        else:
            await websocket.send(json.dumps({
                'type': 'admin_delete_robot_pet_response',
                'success': False,
                'message': '删除失败'
            }))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 删除宠物机甲失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_delete_robot_pet_response',
            'success': False,
            'message': f'删除失败: {str(e)}'
        }))


async def handle_admin_clear_all_robots(websocket, data):
    """清空某个角色的所有机甲（管理接口）"""
    character_id = data.get('character_id', '').strip()
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_clear_all_robots_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
        return
    
    try:
        # 先查找角色
        player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
        if not player:
            await websocket.send(json.dumps({
                'type': 'admin_clear_all_robots_response',
                'success': False,
                'message': '角色不存在'
            }))
            return
        
        user_id = player.get('user_id')
        
        # 删除该角色的所有机甲
        result = utils.safe_mongo_operation(lambda: utils.robotpet_col.delete_many({
            'user_id': user_id,
            'character_id': character_id
        }))
        
        await websocket.send(json.dumps({
            'type': 'admin_clear_all_robots_response',
            'success': True,
            'character_id': character_id,
            'deleted_count': result.deleted_count,
            'message': f'成功清空 {result.deleted_count} 个机甲'
        }))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 清空机甲失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_clear_all_robots_response',
            'success': False,
            'message': f'清空失败: {str(e)}'
        }))


async def handle_admin_add_random_robots(websocket, data):
    """为指定角色添加指定数量的随机机甲（管理接口）"""
    character_id = data.get('character_id', '').strip()
    count = int(data.get('count', 1))
    
    if not character_id:
        await websocket.send(json.dumps({
            'type': 'admin_add_random_robots_response',
            'success': False,
            'message': '角色ID不能为空'
        }))
        return
    
    if count < 1 or count > 100:
        await websocket.send(json.dumps({
            'type': 'admin_add_random_robots_response',
            'success': False,
            'message': '数量必须在1-100之间'
        }))
        return
    
    try:
        # 查找角色
        player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': character_id}))
        if not player:
            await websocket.send(json.dumps({
                'type': 'admin_add_random_robots_response',
                'success': False,
                'message': '角色不存在'
            }))
            return
        
        user_id = player.get('user_id')
        
        # 检查RobotBase是否有数据
        robotbase_count = utils.safe_mongo_operation(lambda: utils.robotbase_col.count_documents({}))
        if robotbase_count == 0:
            await websocket.send(json.dumps({
                'type': 'admin_add_random_robots_response',
                'success': False,
                'message': 'RobotBase集合为空，无法创建机甲'
            }))
            return
        
        # 使用初始化时传入的创建函数
        if not _create_robot_pet:
            await websocket.send(json.dumps({
                'type': 'admin_add_random_robots_response',
                'success': False,
                'message': '创建宠物函数未初始化'
            }))
            return
        
        created_pets = []
        failed_count = 0
        
        for i in range(count):
            try:
                # 随机从RobotBase选择一个机甲
                sample = utils.safe_mongo_operation(lambda: list(utils.robotbase_col.aggregate([{ '$sample': { 'size': 1 } }])))
                if sample:
                    base_robot = sample[0]
                    robot_pet = _create_robot_pet(user_id, character_id, base_robot)
                    created_pets.append(robot_pet.get('RobotName', ''))
                else:
                    failed_count += 1
            except Exception as e:
                print(f'创建第 {i+1} 个机甲失败: {e}')
                failed_count += 1
        
        # 更新机甲数量
        rc = utils.compute_robot_count(user_id, character_id)
        utils.safe_mongo_operation(lambda: utils.players_col.update_one(
            {'user_id': user_id, 'character_id': character_id},
            {'$set': {'robotcount': rc}}
        ))
        
        # 获取更新后的机甲列表
        pets = list(utils.safe_mongo_operation(lambda: utils.robotpet_col.find({
            'user_id': user_id,
            'character_id': character_id
        })))
        pets_list = []
        for p in pets:
            ani_id = p.get('AniID', '') or ''
            pets_list.append({
                'pet_id': str(p['_id']),
                'robot_base_id': p.get('robot_base_id', ''),
                'RobotID': p.get('RobotID', ''),
                'RobotName': p.get('RobotName', ''),
                'Growth': p.get('Growth', 50),
                'Comprehension': p.get('Comprehension', 50),
                'Level': p.get('Level', 1),
                'StarLevel': p.get('StarLevel', 1),
                'Form': p.get('Form', 1),
                'Class': p.get('Class', 1),
                'AniID': ani_id
            })
        
        # 广播更新消息给客户端
        if _broadcast_to_user_async:
            import asyncio
            update_msg = {
                'type': 'robotcount_update',
                'success': True,
                'character_id': character_id,
                'robotcount': rc
            }
            pets_msg = {
                'type': 'robot_pets_update',
                'success': True,
                'character_id': character_id,
                'pets': pets_list
            }
            asyncio.create_task(_broadcast_to_user_async(user_id, update_msg))
            asyncio.create_task(_broadcast_to_user_async(user_id, pets_msg))
        
        await websocket.send(json.dumps({
            'type': 'admin_add_random_robots_response',
            'success': True,
            'character_id': character_id,
            'requested_count': count,
            'created_count': len(created_pets),
            'failed_count': failed_count,
            'message': f'成功创建 {len(created_pets)} 个随机机甲'
        }))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 添加随机机甲失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_add_random_robots_response',
            'success': False,
            'message': f'添加失败: {str(e)}'
        }))


async def handle_admin_register_admin_account(websocket, data):
    """一键注册管理员内部游戏账号（包含账号注册和角色创建）"""
    try:
        import uuid
        import datetime
        
        # 生成带特殊标识的账号名（admin_test_时间戳_随机数）
        timestamp = int(datetime.datetime.utcnow().timestamp() * 1000)
        random_suffix = random.randint(1000, 9999)
        account = f'admin_test_{timestamp}_{random_suffix}'
        password = f'admin{random.randint(100000, 999999)}'  # 随机密码
        
        # 随机生成角色名（中文名）
        surnames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫',
                   '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张']
        name_words = ['伟', '刚', '勇', '毅', '俊', '峰', '强', '军', '平', '保', '东', '文',
                     '辉', '力', '明', '永', '健', '世', '广', '志', '义', '兴', '良', '海']
        surname = random.choice(surnames)
        name_len = random.choice([1, 2])
        name = ''.join(random.choices(name_words, k=name_len))
        role_name = f'{surname}{name}'
        
        # 随机选择职业（1-3）和外观（0-5）
        player_class = random.randint(1, 3)
        character_index = random.randint(0, 5)
        slot_index = 0  # 默认使用第一个槽位
        
        # 1. 注册账号
        initial_token = utils.generate_unique_token(account, password)
        result = utils.safe_mongo_operation(lambda: utils.users_col.find_one_and_update(
            {'account': account},
            {'$setOnInsert': {
                'account': account,
                'password': password,
                'token': initial_token,
                'created_at': datetime.datetime.utcnow(),
                'last_login': None,
                'is_admin_account': True,  # 标记为管理员账号
                'admin_account_created_at': datetime.datetime.utcnow()  # 记录创建时间
            }},
            upsert=True,
            return_document=True
        ))
        
        # 检查是否是新创建的用户
        is_new_user = result.get('created_at') is not None and result.get('last_login') is None
        if not is_new_user:
            await websocket.send(json.dumps({
                'type': 'admin_register_admin_account_response',
                'success': False,
                'message': '账号已存在（理论上不应该出现）'
            }))
            return
        
        user_id = result['_id']
        
        # 2. 创建角色
        character_id = str(uuid.uuid4())
        friend_id = utils.generate_friend_id()
        
        # 更新users表的characters数组
        chars = [None, None, None]
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
        utils.users_col.update_one({'_id': user_id}, {'$set': {'characters': chars}})
        
        # 3. 在players_col中创建玩家数据
        try:
            utils.safe_mongo_operation(lambda: utils.players_col.update_one(
                {'user_id': user_id, 'slot_index': slot_index},
                {'$setOnInsert': {
                    'user_id': user_id,
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
                    'friend_id': friend_id
                }},
                upsert=True
            ))
        except Exception as e:
            print(f'初始化玩家角色数据失败: {e}')
        
        # 4. 更新机甲数量
        try:
            rc = utils.compute_robot_count(user_id, character_id)
            utils.players_col.update_one(
                {'user_id': user_id, 'slot_index': slot_index},
                {'$set': {'robotcount': rc}}
            )
        except Exception:
            pass
        
        await websocket.send(json.dumps({
            'type': 'admin_register_admin_account_response',
            'success': True,
            'message': '管理员账号注册成功',
            'account': account,
            'password': password,
            'user_id': str(user_id),
            'character_id': character_id,
            'role_name': role_name,
            'class': player_class,
            'character_index': character_index,
            'token': initial_token
        }))
        
        print(f'✅ 成功注册管理员账号: {account}, 角色: {role_name}')
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 注册管理员账号失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_register_admin_account_response',
            'success': False,
            'message': f'注册失败: {str(e)}'
        }))


async def handle_admin_get_admin_accounts(websocket, data):
    """获取所有管理员账号列表（管理接口）"""
    try:
        # 查找所有标记为管理员账号的用户（包含密码字段）
        users = utils.safe_mongo_operation(lambda: list(utils.users_col.find(
            {'is_admin_account': True},
            {'account': 1, 'password': 1, '_id': 1, 'created_at': 1, 'admin_account_created_at': 1, 'last_login': 1}
        ).sort('admin_account_created_at', -1)))  # 按创建时间倒序
        
        accounts_data = []
        for user in users:
            user_id = user['_id']
            # 统计该账号下的角色数量
            character_count = utils.safe_mongo_operation(lambda: utils.players_col.count_documents({
                'user_id': user_id,
                'character_id': {'$ne': None}
            }))
            
            # 获取第一个角色信息
            first_character = utils.safe_mongo_operation(lambda: utils.players_col.find_one(
                {'user_id': user_id, 'slot_index': 0},
                {'character_id': 1, 'role_name': 1, 'level': 1}
            ))
            
            # 处理datetime对象，转换为ISO格式字符串
            created_at = user.get('admin_account_created_at') or user.get('created_at')
            last_login = user.get('last_login')
            
            account_info = {
                'user_id': str(user_id),
                'account': user.get('account', ''),
                'password': user.get('password', ''),  # 包含密码用于客户端模拟登录
                'character_count': character_count,
                'created_at': created_at.isoformat() if created_at and hasattr(created_at, 'isoformat') else (str(created_at) if created_at else None),
                'last_login': last_login.isoformat() if last_login and hasattr(last_login, 'isoformat') else (str(last_login) if last_login else None)
            }
            
            if first_character:
                account_info['first_character'] = {
                    'character_id': first_character.get('character_id', ''),
                    'role_name': first_character.get('role_name', ''),
                    'level': first_character.get('level', 1)
                }
            
            accounts_data.append(account_info)
        
        # 使用default参数处理datetime对象
        await websocket.send(json.dumps({
            'type': 'admin_get_admin_accounts_response',
            'success': True,
            'accounts': accounts_data,
            'total': len(accounts_data)
        }, default=str))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 获取管理员账号列表失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_get_admin_accounts_response',
            'success': False,
            'message': f'获取管理员账号列表失败: {str(e)}'
        }))


async def handle_admin_delete_admin_account(websocket, data):
    """删除管理员账号（管理接口）"""
    try:
        account = data.get('account', '').strip()
        if not account:
            await websocket.send(json.dumps({
                'type': 'admin_delete_admin_account_response',
                'success': False,
                'message': '账号不能为空'
            }))
            return
        
        # 查找用户
        user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'account': account, 'is_admin_account': True}))
        if not user:
            await websocket.send(json.dumps({
                'type': 'admin_delete_admin_account_response',
                'success': False,
                'message': '管理员账号不存在'
            }))
            return
        
        user_id = user['_id']
        
        # 删除该账号的所有角色数据
        utils.safe_mongo_operation(lambda: utils.players_col.delete_many({'user_id': user_id}))
        
        # 删除该账号的所有机甲数据
        utils.safe_mongo_operation(lambda: utils.robotpet_col.delete_many({'user_id': user_id}))
        
        # 删除账号
        utils.safe_mongo_operation(lambda: utils.users_col.delete_one({'_id': user_id}))
        
        await websocket.send(json.dumps({
            'type': 'admin_delete_admin_account_response',
            'success': True,
            'message': f'成功删除管理员账号: {account}'
        }))
        
        print(f'✅ 成功删除管理员账号: {account}')
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f'[错误] 删除管理员账号失败: {e}\n{error_detail}')
        await websocket.send(json.dumps({
            'type': 'admin_delete_admin_account_response',
            'success': False,
            'message': f'删除失败: {str(e)}'
        }))
