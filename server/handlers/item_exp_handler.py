"""
物品和经验相关操作处理器
处理：add (添加物品), add_exp (增加经验)
"""
import json
import traceback
from . import utils

async def handle_add_item(websocket, data, current_character_id):
    """处理添加物品请求（添加到inventory_col，与背包系统一致）"""
    token = data.get('token')
    item_id = int(data.get('itemId', 0))
    quantity = int(data.get('quantity', 1))
    target_character_id = data.get('character_id') or current_character_id
    
    if not item_id or item_id <= 0:
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': '缺少或无效的itemId'
        }))
        return
    
    if quantity <= 0:
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': '数量必须大于0'
        }))
        return
    
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    if not target_character_id:
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': '未选择角色'
        }))
        return
    
    # 验证角色是否存在
    player = utils.players_col.find_one({
        'user_id': user['_id'],
        'character_id': target_character_id
    })
    if not player:
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': '角色不存在'
        }))
        return
    
    try:
        # 从inventory_col获取现有物品列表
        from .bag_handler import merge_inventory_items, split_inventory_items
        doc = utils.inventory_col.find_one({
            'user_id': user['_id'],
            'character_id': target_character_id
        })
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
        
        # 查找是否已有该物品
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
            # 从物品配置中查找itypeId
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
        inventory_data['user_id'] = user['_id']
        inventory_data['character_id'] = target_character_id
        
        # 更新inventory_col
        utils.inventory_col.replace_one(
            {'user_id': user['_id'], 'character_id': target_character_id},
            inventory_data,
            upsert=True
        )
        
        # 发送成功响应
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': True,
            'itemId': item_id,
            'quantity': quantity,
            'character_id': target_character_id
        }))
        
    except Exception as e:
        print(f'❌ [ItemExpHandler] 添加物品失败: {e}\n{traceback.format_exc()}')
        await websocket.send(json.dumps({
            'type': 'add_response',
            'success': False,
            'message': f'添加物品失败: {str(e)}'
        }))

async def handle_add_exp(websocket, data, current_character_id, add_exp_to_player_func):
    """
    处理增加经验请求（服务器权威计算）- 加强安全验证
    add_exp_to_player_func: 从ws_server传入的经验计算函数
    """
    token = data.get('token')
    exp_amount = int(data.get('exp', 0))
    target_character_id = data.get('character_id') or current_character_id
    client_user_id = data.get('user_id')  # 客户端传递的user_id（用于验证）
    
    # 1. 验证经验值
    if exp_amount <= 0:
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '经验值必须大于0'
        }))
        return
    
    # 2. 验证Token（必须）
    if not token:
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '缺少token'
        }))
        return
    
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '用户不存在或未登录'
        }))
        return
    
    # 3. 验证用户ID一致性（防止token被盗用）
    if client_user_id and str(user['_id']) != str(client_user_id):
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '用户ID验证失败'
        }))
        return
    
    # 4. 验证角色ID（必须）
    if not target_character_id:
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '未选择角色'
        }))
        return
    
    # 5. 验证角色是否属于该用户（关键安全验证）
    player = utils.players_col.find_one({
        'user_id': user['_id'],
        'character_id': target_character_id
    })
    if not player:
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': '角色不存在或不属于该用户'
        }))
        return
    
    try:
        # 6. 服务器权威计算：增加经验并计算升级
        new_level, new_exp, level_up_count = add_exp_to_player_func(player, exp_amount)
        
        # 7. 更新数据库（使用双重验证条件，确保安全）
        update_result = utils.players_col.update_one(
            {'user_id': user['_id'], 'character_id': target_character_id},  # 双重条件确保安全
            {'$set': {
                'level': new_level,
                'exp': new_exp
            }}
        )
        
        # 8. 验证更新是否成功
        if update_result.matched_count == 0:
            await websocket.send(json.dumps({
                'type': 'add_exp_response',
                'success': False,
                'message': '更新失败，角色可能已被删除'
            }))
            return
        
        # 发送成功响应
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': True,
            'level': new_level,
            'total_exp': new_exp,
            'level_up_count': level_up_count,
            'character_id': target_character_id
        }))
        
    except Exception as e:
        print(f'❌ [ItemExpHandler] 增加经验失败: {e}\n{traceback.format_exc()}')
        await websocket.send(json.dumps({
            'type': 'add_exp_response',
            'success': False,
            'message': f'增加经验失败: {str(e)}'
        }))