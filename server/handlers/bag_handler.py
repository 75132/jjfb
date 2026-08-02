"""
背包相关操作处理器
处理：bag_write_random, bag_get, bag_use_item, bag_discard_item
"""
import json
import random
import os
from . import utils
import asyncio

# 导入背包缓存服务（可选优化）
try:
    from ..services.bag_mutation_idempotency import bag_mutation_idempotency
except ImportError:
    bag_mutation_idempotency = None  # type: ignore

try:
    from ..services.bag_cache_service import get_bag_cache
except ImportError:
    # 如果服务未初始化，返回None（向后兼容）
    def get_bag_cache():
        return None

# 广播函数（将在初始化时设置）
_broadcast_to_user_async = None

# 有效的物品ID列表（从 Items.json 加载）
_valid_item_ids = None

# 物品配置映射：item_id -> {"CanStack": bool, "StackLimit": int}
_item_config = None

# ========== 装备系统（已分离到 equipment_handler.py）==========
# 从装备系统模块导入相关函数
from .equipment_handler import (
    get_slot_name_by_type,
    get_equipment_config,
    validate_equipment_integrity,
    validate_equipment_restrictions,
    calculate_total_attributes,
    equip_item_to_pet,
    remove_equipment_attributes,
    strip_invalid_equipment_for_pet,
    load_all_item_ids_data,
    get_equipment_stats,
    reset_equipment_stats,
    update_unequip_stats,
    EquipmentExtension,
)

# ========== 分类到数据库字段名的映射 ==========
def get_field_name_by_category(category: int) -> str:
    """
    根据分类获取数据库字段名
    分类映射：1=Items -> 'items', 2=Weapon+Gun -> 'Weapon', 3=Wing+Dun+Armor -> 'Armor'
    """
    if category == 1:
        return 'items'
    elif category == 2:
        return 'Weapon'
    elif category == 3:
        return 'Armor'
    else:
        return 'items'  # 默认

def get_category_by_itype_id(itype_id: int) -> int:
    """
    根据itypeId获取分类
    itypeId映射：1=Items -> 1, 2/3=Weapon/Gun -> 2, 4/5/6=Wing/Dun/Armor -> 3
    """
    if itype_id == 1:
        return 1  # Items
    elif itype_id in [2, 3]:  # Weapon, Gun
        return 2  # 武器
    elif itype_id in [4, 5, 6]:  # Wing, Dun, Armor
        return 3  # 护甲
    else:
        return 1  # 默认Items

# 装备系统相关函数已移动到 equipment_handler.py

def merge_inventory_items(doc) -> list:
    """
    合并数据库中的三个字段（items, Weapon, Armor）为一个列表
    用于兼容旧代码和统一处理
    注意：需要创建item的副本，避免修改原始数据
    """
    all_items = []
    
    # 从items字段读取（分类1）
    items_1 = doc.get('items', [])
    for item in items_1:
        # 创建副本，避免修改原始数据
        item_copy = dict(item)
        item_copy['category'] = 1  # 确保分类正确
        all_items.append(item_copy)
    
    # 从Weapon字段读取（分类2）
    items_2 = doc.get('Weapon', [])
    for item in items_2:
        # 创建副本，避免修改原始数据
        item_copy = dict(item)
        item_copy['category'] = 2  # 确保分类正确
        all_items.append(item_copy)
    
    # 从Armor字段读取（分类3）
    items_3 = doc.get('Armor', [])
    for item in items_3:
        # 创建副本，避免修改原始数据
        item_copy = dict(item)
        item_copy['category'] = 3  # 确保分类正确
        all_items.append(item_copy)
    
    return all_items

def split_inventory_items(items: list) -> dict:
    """
    将物品列表按分类拆分到三个字段（items, Weapon, Armor）
    返回：{'items': [...], 'Weapon': [...], 'Armor': [...]}
    """
    result = {
        'items': [],
        'Weapon': [],
        'Armor': []
    }
    
    for item in items:
        category = int(item.get('category', 1))
        field_name = get_field_name_by_category(category)
        # 移除category字段（数据库不需要存储，因为字段名已经表示分类）
        item_copy = {k: v for k, v in item.items() if k != 'category'}
        result[field_name].append(item_copy)
    
    return result

def init_bag_handler(broadcast_func):
    """初始化背包处理器"""
    global _broadcast_to_user_async
    _broadcast_to_user_async = broadcast_func
    load_valid_item_ids()


def _stack_meta(item_id: int):
    """Items.json 堆叠规则（与 load_valid_item_ids 一致）。"""
    global _item_config
    if not _item_config:
        return True, 99
    cfg = _item_config.get(int(item_id), {})
    can_stack = bool(cfg.get('CanStack', True))
    limit = int(cfg.get('StackLimit', 99) or 99)
    if limit <= 0:
        limit = 99
    return can_stack, limit


def _audit_bag_write(user_id, character_id, action: str, **fields):
    """关键写操作摘要日志（可接入集中日志）。"""
    try:
        kv = ' '.join(f'{k}={v}' for k, v in fields.items() if v is not None)
        print(f'📋 [BagAudit] action={action} user_id={user_id} character_id={character_id} {kv}')
    except Exception:
        pass


async def _guard_bag_mutation_rate(websocket, route: str, data, user) -> bool:
    """短时高频背包写操作 429（与 THROTTLE 互补）。"""
    try:
        from ..services.bag_abuse_tracker import bag_abuse_tracker
        ok, code = bag_abuse_tracker.check_and_record(str(user['_id']))
        if not ok:
            await utils.send_error_response(
                websocket,
                route,
                '操作过于频繁，请稍后再试',
                code=429,
                request_data=data,
                error_code=code,
            )
            return False
    except Exception:
        pass
    return True


async def _push_bag_refresh(user_id_oid, character_id: str, reason: str, extra: dict = None):
    """广播背包变更：附带 bag_delta 提示客户端按版本刷新。"""
    try:
        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({'user_id': user_id_oid, 'character_id': character_id}),
            timeout=2.0
        )
        ver = int(doc.get('bag_version', 1)) if doc else 1
        update_msg = {
            'type': 'bag_items_update',
            'success': True,
            'character_id': character_id,
            'bag_delta': {'bag_version': ver, 'ops': [{'op': 'refetch', 'reason': reason}]},
        }
        if extra:
            update_msg.update(extra)
        if _broadcast_to_user_async:
            asyncio.create_task(_broadcast_to_user_async(user_id_oid, update_msg))
    except Exception:
        pass


def load_valid_item_ids():
    """加载 Items.json 和所有装备JSON中有效的物品 ID 列表和堆叠配置"""
    global _valid_item_ids, _item_config
    # 加载所有物品和装备数据
    all_items_data = load_all_item_ids_data()
    
    if all_items_data:
        _valid_item_ids = [item['id'] for item in all_items_data if 'id' in item]
        # 同时构建物品配置映射（是否可堆叠 + 上限）
        _item_config = {}
        for item in all_items_data:
            iid = item.get('id')
            if iid is None:
                continue
            can_stack = bool(item.get('CanStack', True))
            # 默认上限给一个较大的值，避免意外 0
            stack_limit = int(item.get('StackLimit', 99) or 99)
            if stack_limit <= 0:
                stack_limit = 99
            _item_config[iid] = {
                'CanStack': can_stack,
                'StackLimit': stack_limit,
            }
        print(f'✅ [BagHandler] 已加载 {len(_valid_item_ids)} 个有效物品ID（包含装备），{len(_item_config)} 条堆叠配置')
    else:
        # 如果找不到文件，使用默认范围（1-75）
        _valid_item_ids = list(range(1, 76))
        _item_config = {}
        print(f'⚠️ [BagHandler] 未找到Items.json，使用默认物品ID范围 1-75')

def load_valid_item_ids_data():
    """加载 Items.json 数据（返回完整数据，不修改全局变量）"""
    try:
        # 优先从 server/data/Items.json 加载（新位置）
        base_dir = os.path.dirname(os.path.dirname(__file__))  # server
        possible_paths = [
            os.path.join(base_dir, 'data', 'Items.json'),  # server/data/Items.json（新位置，优先）
            os.path.join(os.path.dirname(__file__), 'json', 'Items.json'),  # server/handlers/json/Items.json（旧位置，兼容）
            os.path.join(base_dir, 'assets', 'resources', 'json', 'Items.json'),
            os.path.join(os.path.dirname(__file__), '..', 'assets', 'resources', 'json', 'Items.json'),
            'assets/resources/json/Items.json',
            '../assets/resources/json/Items.json',
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        return []
    except Exception as e:
        print(f'❌ [BagHandler] 加载Items.json失败: {e}')
        return []

# 装备系统相关函数已移动到 equipment_handler.py
# _equip_item_to_pet 和 _remove_equipment_attributes 已移动到 equipment_handler.py

async def _add_item_to_inventory(user_id, character_id, item_id: int, quantity: int = 1):
    """
    添加物品到背包（内部函数，用于将卸下的装备放回背包）
    网游级实现：确保数据库更新成功，返回更新结果
    
    Args:
        user_id: 用户ID
        character_id: 角色ID
        item_id: 物品ID
        quantity: 数量
    
    Returns:
        {'success': bool, 'error': str, 'added': bool}  # added表示是否成功添加
    """
    try:
        # 直接操作数据库，避免循环依赖
        # 关键修复：使用 find_one_and_update 或确保原子操作
        # MMO级优化：异步数据库查询，避免阻塞事件循环
        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({
                'user_id': user_id,
                'character_id': character_id
            }),
            timeout=2.0
        )
        
        if not doc:
            # 如果背包不存在，创建新背包（添加版本号字段，默认为1）
            await utils.async_mongo_operation(
                lambda: utils.inventory_col.insert_one({
                    'user_id': user_id,
                    'character_id': character_id,
                    'bag_version': 1,  # 新增：版本号字段
                    'items': [],
                    'Weapon': [],
                    'Armor': []
                }),
                timeout=2.0
            )
            doc = await utils.async_mongo_operation(
                lambda: utils.inventory_col.find_one({
                    'user_id': user_id,
                    'character_id': character_id
                }),
                timeout=2.0
            )
        
        # 获取物品分类（网游级优化：使用缓存）
        item_data = get_equipment_config(item_id)
        
        if not item_data:
            # 如果缓存中没有，尝试从Items.json加载（可能是普通物品）
            all_items_data = load_all_item_ids_data()
            item_data = next((item for item in all_items_data if item.get('id') == item_id), None)
        
        if not item_data:
            print(f'⚠️ [BagHandler] 物品 {item_id} 不存在，无法添加到背包')
            return {'success': False, 'error': f'物品 {item_id} 不存在', 'added': False}
        
        # 确定分类
        itype_id = item_data.get('itypeId', 1)
        category = get_category_by_itype_id(itype_id)
        
        # 合并所有物品
        items = merge_inventory_items(doc)
        
        # 查找是否已有该物品
        found = False
        for item in items:
            if int(item.get('item_id', 0)) == item_id and int(item.get('category', 0)) == category:
                # 检查是否可以堆叠
                can_stack = bool(item_data.get('CanStack', True))
                stack_limit = int(item_data.get('StackLimit', 99) or 99)
                
                if can_stack:
                    current_qty = int(item.get('quantity', 0))
                    if current_qty < stack_limit:
                        # 可以堆叠，增加数量
                        item['quantity'] = min(current_qty + quantity, stack_limit)
                        found = True
                        print(f'✅ [BagHandler] 物品 {item_id} 堆叠到现有格子，数量: {current_qty} -> {item["quantity"]}')
                        break
        
        # 如果没找到或不能堆叠，添加新格子
        if not found:
            items.append({
                'item_id': item_id,
                'quantity': quantity,
                'category': category
            })
            print(f'✅ [BagHandler] 物品 {item_id} 添加新格子，数量: {quantity}')
        
        # 更新数据库（关键：确保更新成功，MMO级优化：异步操作）
        # 新增：添加版本号自增
        inventory_data = split_inventory_items(items)
        update_result = await utils.async_mongo_operation(
            lambda: utils.inventory_col.update_one(
                {'user_id': user_id, 'character_id': character_id},
                {
                    '$set': inventory_data,
                    '$inc': {'bag_version': 1}  # 新增：版本号自增
                }
            ),
            timeout=2.0
        )
        
        # 新增：使缓存失效
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user_id, character_id)
        
        # 验证更新是否成功
        if update_result.matched_count == 0:
            print(f'❌ [BagHandler] 警告：添加物品 {item_id} 到背包时，数据库更新失败（未找到记录）')
            return {'success': False, 'error': '数据库更新失败：未找到背包记录', 'added': False}
        
        if update_result.modified_count == 0:
            print(f'⚠️ [BagHandler] 警告：添加物品 {item_id} 到背包时，数据库未修改（可能数据相同）')
            # 即使未修改，也可能是数据已经存在，不算错误
        
        print(f'✅ [BagHandler] 物品 {item_id} x{quantity} 已成功添加到背包（matched: {update_result.matched_count}, modified: {update_result.modified_count}）')
        return {'success': True, 'error': None, 'added': True}
        
    except Exception as e:
        print(f'❌ [BagHandler] 添加物品 {item_id} 到背包失败: {e}')
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e), 'added': False}


def _normalize_and_stack_items(raw_items):
    """
    根据 Items.json 中的 CanStack / StackLimit 规则，将原始物品列表做 MMO 逻辑下的堆叠与分格子。

    raw_items: [{'item_id': int, 'quantity': int, 'category': int}, ...]
    返回：规范化后的物品列表（每格数量不超过 StackLimit，不可堆叠物品一格一个）。
    """
    global _item_config

    if not raw_items:
        return []

    if _item_config is None:
        # 兜底：如果还没加载过，尝试加载一次
        load_valid_item_ids()

    result = []

    for item in raw_items:
        try:
            item_id = int(item.get('item_id'))
            qty = int(item.get('quantity', 0))
            category = int(item.get('category', 1))
        except Exception:
            continue

        if qty <= 0:
            continue

        cfg = (_item_config or {}).get(item_id, {})
        can_stack = bool(cfg.get('CanStack', True))
        stack_limit = int(cfg.get('StackLimit', 99) or 99)
        if not can_stack:
            # 不可堆叠，强制一格一个
            stack_limit = 1
        if stack_limit <= 0:
            stack_limit = 99

        # 将数量拆成若干份，每份不超过 stack_limit，并尽量与已有格子合并
        while qty > 0:
            # 先尝试与现有同类格子合并（仅对可堆叠物品）
            merged = False
            if can_stack:
                for existing in result:
                    if (
                        existing.get('item_id') == item_id
                        and existing.get('category') == category
                    ):
                        exist_qty = int(existing.get('quantity', 0))
                        if exist_qty < stack_limit:
                            can_add = min(stack_limit - exist_qty, qty)
                            if can_add > 0:
                                existing['quantity'] = exist_qty + can_add
                                qty -= can_add
                                merged = True
                                if qty <= 0:
                                    break
                if merged:
                    continue

            # 无法再与已有格子合并，新开一个格子
            take = min(qty, stack_limit)
            result.append({
                'item_id': item_id,
                'quantity': take,
                'category': category,
            })
            qty -= take

    return result

async def handle_bag_write_random(websocket, data, current_character_id):
    """处理随机写入背包请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await websocket.send(json.dumps({
            'type': 'bag_write_response',
            'success': False
        }))
        return
    
    cid = data.get('character_id') or current_character_id
    if not cid:
        await websocket.send(json.dumps({
            'type': 'bag_write_response',
            'success': False
        }))
        return
    
    try:
        # 读取客户端传来的随机数量（格子数），不传则使用原来的逻辑
        # count 表示「要随机生成多少个物品格子」（每格里再随机数量）
        count = data.get('count')
        try:
            count = int(count) if count is not None else None
        except (TypeError, ValueError):
            count = None

        # 确保有效物品ID列表已加载
        if _valid_item_ids is None:
            load_valid_item_ids()
        
        if not _valid_item_ids:
            await websocket.send(json.dumps({
                'type': 'bag_write_response',
                'success': False,
                'error': 'No valid item IDs loaded'
            }))
            return
        
        # 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲), 4=Other(暂时不用)
        categories = [1, 2, 3]
        
        # 加载所有物品和装备数据，用于按分类筛选
        all_items_data = load_all_item_ids_data()
        
        # 建立物品ID到itypeId的映射（用于验证物品是否存在）
        item_id_to_itype = {}
        for item in all_items_data:
            item_id = item.get('id')
            if item_id:
                item_id_to_itype[item_id] = item.get('itypeId', 1)
        
        # 按分类组织物品ID（合并分类）
        category_item_ids = {
            1: [],  # Items (itypeId=1)
            2: [],  # Weapon + Gun (itypeId=2,3) -> 武器
            3: [],  # Wing + Dun + Armor (itypeId=4,5,6) -> 护甲
        }
        
        for item in all_items_data:
            item_id = item.get('id')
            if not item_id:
                continue
            
            # 如果 itypeId 不存在，默认值为 1（Items）
            itype_id = item.get('itypeId', 1)
            
            # 分类映射
            if itype_id == 1:
                category_item_ids[1].append(item_id)  # Items
            elif itype_id in [2, 3]:  # Weapon, Gun -> 武器
                category_item_ids[2].append(item_id)
            elif itype_id in [4, 5, 6]:  # Wing, Dun, Armor -> 护甲
                category_item_ids[3].append(item_id)
            else:
                # 未知的 itypeId，默认归类为 Items
                category_item_ids[1].append(item_id)

        # ===== 测试模式：有 count 就严格生成 count 个格子 =====
        if count and count > 0:
            items = []
            attempts = 0
            max_attempts = count * 20  # 增加尝试次数，避免无限循环
            while len(items) < count and attempts < max_attempts:
                attempts += 1
                c = random.choice(categories)
                # 只从对应分类的真实物品ID中随机选择（不生成假ID）
                item_ids_for_category = category_item_ids.get(c, [])
                if not item_ids_for_category:
                    # 如果该分类没有物品，跳过
                    continue
                item_id = random.choice(item_ids_for_category)
                # 严格验证：物品ID必须在item_id_to_itype中，且必须在_item_config中
                if item_id not in item_id_to_itype:
                    print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在item_id_to_itype映射中，跳过')
                    continue
                if item_id not in _item_config:
                    print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在_item_config中，跳过')
                    continue
                # 验证物品是否在all_items_data中（最终验证）
                item_found = False
                for item in all_items_data:
                    if item.get('id') == item_id:
                        item_found = True
                        break
                if not item_found:
                    print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在all_items_data中，跳过')
                    continue
                # 数量：装备不可堆叠，物品可堆叠
                item_config = _item_config.get(item_id, {})
                can_stack = item_config.get('CanStack', True)
                if can_stack:
                    qty = random.randint(1, 99)
                else:
                    qty = 1  # 装备不可堆叠
                items.append({
                    'item_id': item_id,
                    'quantity': qty,
                    'category': c
                })
        else:
            # ===== 正常模式：按照堆叠规则生成，每个分类生成随机数量 =====
            raw_items = []
            for c in categories:
                item_ids_for_category = category_item_ids.get(c, [])
                if not item_ids_for_category:
                    continue
                cnt = random.randint(3, 6)
                for _ in range(cnt):
                    # 从对应分类的物品ID中随机选择
                    item_id = random.choice(item_ids_for_category)
                    # 严格验证：物品ID必须在item_id_to_itype中，且必须在_item_config中
                    if item_id not in item_id_to_itype:
                        print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在item_id_to_itype映射中，跳过')
                        continue
                    if item_id not in _item_config:
                        print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在_item_config中，跳过')
                        continue
                    # 验证物品是否在all_items_data中（最终验证）
                    item_found = False
                    for item in all_items_data:
                        if item.get('id') == item_id:
                            item_found = True
                            break
                    if not item_found:
                        print(f'⚠️ [BagHandler] 警告：物品ID {item_id} 不在all_items_data中，跳过')
                        continue
                    # 数量：装备不可堆叠，物品可堆叠
                    item_config = _item_config.get(item_id, {})
                    can_stack = item_config.get('CanStack', True)
                    if can_stack:
                        qty = random.randint(1, 99)
                    else:
                        qty = 1  # 装备不可堆叠
                    raw_items.append({
                        'item_id': item_id,
                        'quantity': qty,
                        'category': c
                    })
            # 按 CanStack / StackLimit 做规范化堆叠
            items = _normalize_and_stack_items(raw_items)
        
        # 按分类拆分到三个字段
        inventory_data = split_inventory_items(items)
        inventory_data['user_id'] = user['_id']
        inventory_data['character_id'] = cid
        
        # MMO级优化：异步数据库操作，避免阻塞事件循环
        # 新增：添加版本号字段（replace_one需要手动设置版本号）
        if 'bag_version' not in inventory_data:
            # 获取当前版本号（如果有）
            existing_doc = await utils.async_mongo_operation(
                lambda: utils.inventory_col.find_one({
                    'user_id': user['_id'],
                    'character_id': cid
                }),
                timeout=2.0
            )
            existing_version = existing_doc.get('bag_version', 1) if existing_doc else 1
            inventory_data['bag_version'] = existing_version + 1  # 版本号自增
        else:
            inventory_data['bag_version'] = inventory_data.get('bag_version', 1) + 1
        
        await utils.async_mongo_operation(
            lambda: utils.inventory_col.replace_one(
                {'user_id': user['_id'], 'character_id': cid},
                inventory_data,
                upsert=True
            ),
            timeout=2.0
        )
        
        # 新增：使缓存失效
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user['_id'], cid)
        
        try:
            ver_push = int(inventory_data.get('bag_version', 1))
            update_msg = {
                'type': 'bag_items_update',
                'success': True,
                'character_id': cid,
                'items': items,
                'bag_delta': {'bag_version': ver_push, 'ops': [{'op': 'refetch', 'reason': 'bag_write_random'}]},
            }
            if _broadcast_to_user_async:
                asyncio.create_task(_broadcast_to_user_async(user['_id'], update_msg))
        except Exception:
            pass
        
        await websocket.send(json.dumps({
            'type': 'bag_write_response',
            'success': True
        }))
    except Exception as e:
        print(f'❌ [BagHandler] 随机写入背包失败: {e}')
        import traceback
        traceback.print_exc()
        await websocket.send(json.dumps({
            'type': 'bag_write_response',
            'success': False,
            'error': str(e)
        }))

async def handle_bag_get(websocket, data, current_character_id):
    """处理获取背包物品请求（支持分页 + 分类过滤 + 测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式：支持通过user_id获取用户
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'bag_items',
            'success': False,
            'code': 401,
            'message': '用户不存在或未登录',
            'items': [],
        }, request_data=data)
        return
    
    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_direct_response(websocket, {
            'type': 'bag_items',
            'success': False,
            'code': 400,
            'message': '角色ID不能为空',
            'items': [],
        }, request_data=data)
        return
    
    try:
        # 分页与分类参数（来自客户端）
        page = data.get('page') or 1
        page_size = data.get('page_size') or 60  # 一页 60 个格子，和客户端保持一致
        category = data.get('category')  # 可以为 None，表示不过滤分类
        client_version = data.get('bag_version')  # 新增：客户端版本号

        try:
            page = max(1, int(page))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = max(1, int(page_size))
        except (TypeError, ValueError):
            page_size = 60
        try:
            category = int(category) if category is not None else None
        except (TypeError, ValueError):
            category = None
        try:
            client_version = int(client_version) if client_version is not None else None
        except (TypeError, ValueError):
            client_version = None

        # ========== 新增：版本号校验和缓存逻辑 ==========
        bag_cache = get_bag_cache()
        
        # 尝试从缓存获取
        cached_doc = None
        cached_version = None
        if bag_cache:
            cache_result = bag_cache.get(user['_id'], cid)
            if cache_result:
                cached_doc, cached_version = cache_result
        
        # 从数据库查询（优先从数据库获取最新数据，确保数据一致性）
        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({
                'user_id': user['_id'],
                'character_id': cid
            }),
            timeout=2.0
        )
        
        # 获取版本号（新增字段，兼容旧数据）
        server_version = doc.get('bag_version', 1) if doc else 1
        
        # 如果客户端版本号一致，且数据未变化，可以只返回版本号（进一步优化）
        # 关键修复：只有当客户端版本号 > 0 时才进行版本匹配（避免初始值0误匹配）
        # 注意：分类切换时不能使用版本匹配，因为不同分类的数据不同
        # 所以版本匹配只在分类不变的情况下才有效
        # 这里我们总是返回完整数据，让客户端自己判断是否使用缓存（基于分类）
        # 实际上，由于分类可能不同，我们不应该在服务器端做版本匹配优化
        # 版本匹配应该在客户端基于分类来判断
        
        # 更新缓存（如果启用了缓存）
        if bag_cache and doc:
            bag_cache.set(user['_id'], cid, doc, server_version)
        # ========== 版本号校验逻辑结束 ==========
        
        # 合并三个字段的物品列表
        items = merge_inventory_items(doc) if doc else []

        # 加载所有物品数据，用于验证和修正分类
        # 注意：Items.json 中的物品可能没有 itypeId 字段，默认值为 1（Items）
        all_items_data = load_all_item_ids_data()
        item_id_to_itype = {}
        for item in all_items_data:
            item_id = item.get('id')
            if item_id:
                # 如果 itypeId 不存在，默认值为 1（Items）
                item_id_to_itype[item_id] = item.get('itypeId', 1)
        
        # 验证并修正物品分类（确保分类正确）
        items_need_update = False
        for item in items:
            item_id = item.get('item_id')
            current_category = int(item.get('category', 1))
            
            # 根据itypeId计算正确的分类
            itype_id = item_id_to_itype.get(item_id, 1)
            correct_category = get_category_by_itype_id(itype_id)
            
            # 如果分类不正确，修正它
            if current_category != correct_category:
                item['category'] = correct_category
                items_need_update = True
                print(f'🔄 [BagHandler] 修正物品 {item_id} 的分类: {current_category} -> {correct_category}')
        
        # 如果修正了分类，更新数据库（按分类拆分到三个字段，MMO级优化：异步操作）
        # 新增：修正分类时也增加版本号（因为数据有变化）
        if items_need_update:
            inventory_data = split_inventory_items(items)
            await utils.async_mongo_operation(
                lambda: utils.inventory_col.update_one(
                    {'user_id': user['_id'], 'character_id': cid},
                    {
                        '$set': inventory_data,
                        '$inc': {'bag_version': 1}  # 新增：版本号自增
                    }
                ),
                timeout=2.0
            )
            # 新增：使缓存失效
            bag_cache = get_bag_cache()
            if bag_cache:
                bag_cache.invalidate(user['_id'], cid)
            # 重新获取文档以获取最新版本号
            doc = await utils.async_mongo_operation(
                lambda: utils.inventory_col.find_one({
                    'user_id': user['_id'],
                    'character_id': cid
                }),
                timeout=2.0
            )
            server_version = doc.get('bag_version', 1) if doc else 1

        # 分类过滤（如果指定了 category，则只返回该分类的数据）
        if category is not None:
            items = [it for it in items if int(it.get('category', 0)) == category]

        total_count = len(items)
        if total_count == 0:
            total_pages = 1
            page = 1
            page_items = []
        else:
            total_pages = (total_count + page_size - 1) // page_size
            # MMO最佳实践：如果请求的页码超出范围，调整到最后一页（而不是返回空数据）
            if page > total_pages:
                page = total_pages
            # 计算分页范围
            start = (page - 1) * page_size
            # 如果计算出的起始位置超出数据范围，说明当前页是空页，调整到前一页
            if start >= total_count and page > 1:
                page = page - 1
                start = (page - 1) * page_size
            end = start + page_size
            page_items = items[start:end]

        # 使用直接发送格式（客户端期望bag_items事件，字段在根级别）
        # 新增：返回版本号字段
        await utils.send_direct_response(websocket, {
            'type': 'bag_items',
            'success': True,
            'bag_version': server_version,  # 新增：返回版本号
            'items': page_items,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'total_count': total_count,
            'category': category,
        }, request_data=data)
    except Exception as e:
        print(f'❌ [BagHandler] 获取背包物品失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_direct_response(websocket, {
            'type': 'bag_items',
            'success': False,
            'code': 500,
            'message': f'获取背包物品失败: {str(e)}',
            'items': [],
        }, request_data=data)


async def _pet_owned_by_character(user, character_id, pet_id) -> bool:
    """校验机甲属于当前登录用户与角色（防越权 pet_id）。"""
    if pet_id is None:
        return False
    try:
        from bson import ObjectId

        oid = ObjectId(str(pet_id).strip())
    except Exception:
        return False
    cid = str(character_id or "").strip()
    if not cid:
        return False
    doc = await utils.async_mongo_operation(
        lambda: utils.robotpet_col.find_one(
            {"_id": oid, "user_id": user["_id"], "character_id": cid},
            {"_id": 1},
        ),
        timeout=2.0,
    )
    return bool(doc)


async def handle_bag_use_item(websocket, data, current_character_id):
    """处理使用物品请求（支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'bag_use_item', '未登录', code=401, request_data=data)
        return
    
    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_error_response(websocket, 'bag_use_item', '角色ID无效', code=400, request_data=data)
        return

    if not await _guard_bag_mutation_rate(websocket, 'bag_use_item', data, user):
        return

    if bag_mutation_idempotency:
        proceed, idem_meta = await bag_mutation_idempotency.prepare(websocket, user['_id'], 'bag_use_item', data)
        if not proceed:
            return
        data['_bag_idem'] = idem_meta

    try:
        item_id = int(data.get('item_id', 0))
        target_type = data.get('target_type', 'Player')  # 'Player' 或 'Pet'
        pet_id = data.get('pet_id')  # 如果是 Pet 类型，需要机甲ID

        if item_id <= 0:
            await utils.send_error_response(websocket, 'bag_use_item', '物品ID无效', code=400, request_data=data)
            return

        # 从数据库获取背包数据（MMO级优化：异步查询，避免阻塞事件循环）
        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({
                'user_id': user['_id'],
                'character_id': cid
            }),
            timeout=2.0
        )
        
        if not doc:
            await utils.send_error_response(websocket, 'bag_use_item', '背包不存在', code=404, request_data=data)
            return

        # 合并三个字段的物品列表
        items = merge_inventory_items(doc)
        
        # MMO最佳实践：使用slot_index精确定位物品（在指定分类中的全局索引）
        category = data.get('category')  # 客户端发送的分类
        client_slot_index = data.get('slot_index')  # 客户端发送的slot索引（在当前分类中的全局索引）
        
        item_slot = None
        slot_index = -1
        
        # 如果指定了分类和slot_index，精确定位
        if category is not None and client_slot_index is not None:
            try:
                category = int(category)
                client_slot_index = int(client_slot_index)
                
                # 先过滤出指定分类的物品
                category_items = [(idx, item) for idx, item in enumerate(items) if int(item.get('category', 0)) == category]
                
                # 验证slot_index是否有效
                if 0 <= client_slot_index < len(category_items):
                    slot_index_in_category = category_items[client_slot_index][0]  # 原始items中的索引
                    item_slot = category_items[client_slot_index][1]  # 物品数据
                    slot_index = slot_index_in_category
                    
                    # 验证item_id是否匹配（安全检查）
                    actual_item_id = int(item_slot.get('item_id', 0))
                    if actual_item_id != item_id:
                        item_slot = None
                        slot_index = -1
                        print(f'⚠️ [BagHandler] slot_index {client_slot_index} 处的物品ID ({actual_item_id}) 与请求的item_id ({item_id}) 不匹配')
            except (TypeError, ValueError) as e:
                print(f'⚠️ [BagHandler] slot_index或category格式错误: {e}')
                item_slot = None
                slot_index = -1
        
        # 如果精确定位失败，回退到旧逻辑（兼容性）
        if not item_slot:
            # 在指定分类中查找第一个匹配的item_id
            if category is not None:
                try:
                    category = int(category)
                    category_items = [(idx, item) for idx, item in enumerate(items) if int(item.get('category', 0)) == category]
                    for idx, item in category_items:
                        if int(item.get('item_id', 0)) == item_id:
                            item_slot = item
                            slot_index = idx
                            break
                except (TypeError, ValueError):
                    pass
            
            # 如果仍然没找到，在所有物品中查找（兼容旧逻辑）
            if not item_slot:
                for idx, item in enumerate(items):
                    if int(item.get('item_id', 0)) == item_id:
                        item_slot = item
                        slot_index = idx
                        break

        if not item_slot:
            await utils.send_error_response(websocket, 'bag_use_item', f'物品 {item_id} 不在背包中', code=404, request_data=data)
            return

        current_qty = int(item_slot.get('quantity', 0))
        if current_qty <= 0:
            await utils.send_error_response(websocket, 'bag_use_item', f'物品 {item_id} 数量不足', code=400, request_data=data)
            return

        target_norm = str(target_type or "Player").strip().lower()
        if target_norm == "pet":
            if pet_id is None or str(pet_id).strip() == "":
                await utils.send_error_response(
                    websocket,
                    "bag_use_item",
                    "对机甲使用物品时必须指定 pet_id",
                    code=400,
                    request_data=data,
                    error_code="PET_ID_REQUIRED",
                )
                return
            if not await _pet_owned_by_character(user, cid, pet_id):
                await utils.send_error_response(
                    websocket,
                    "bag_use_item",
                    "机甲不存在或不属于当前角色",
                    code=403,
                    request_data=data,
                    error_code="PET_NOT_OWNED",
                )
                return

        # ========== 应用物品效果（在消耗物品之前）==========
        effect_result = None
        item_data = None
        
        # 加载物品配置（网游级优化：使用缓存）
        try:
            item_data = get_equipment_config(item_id)
            # 如果缓存中没有，尝试从完整列表加载（可能是普通物品）
            if not item_data:
                all_items_data = load_all_item_ids_data()
                item_data = next((item for item in all_items_data if item.get('id') == item_id), None)
        except Exception as e:
            print(f'⚠️ [BagHandler] 加载物品配置失败: {e}')
        
        # 如果找到物品配置，处理效果和装备属性
        if item_data:
            from .item_effect import get_effect_manager
            effect_manager = get_effect_manager()
            
            # 检查是否是装备（itypeId >= 2）
            itype_id = item_data.get('itypeId', 1)
            is_equipment = itype_id >= 2
            
            # 如果是装备且目标是Pet，执行装备逻辑
            if is_equipment and target_type == 'Pet' and pet_id:
                # 获取装备的type字段，确定槽位
                item_type = item_data.get('type', 0)
                slot_name = get_slot_name_by_type(item_type)
                
                if not slot_name:
                    await utils.send_error_response(websocket, 'bag_use_item', f'装备类型 {item_type} 无效，无法确定槽位', code=400, request_data=data)
                    return
                
                # 执行装备逻辑（检查槽位、替换旧装备、应用属性）
                equip_result = await equip_item_to_pet(
                    item_data=item_data,
                    item_id=item_id,
                    slot_name=slot_name,
                    user_id=user['_id'],
                    character_id=cid,
                    pet_id=pet_id,
                    effect_manager=effect_manager,
                    add_item_to_inventory_func=_add_item_to_inventory
                )
                
                if not equip_result.get('success'):
                    await utils.send_error_response(
                        websocket, 
                        'bag_use_item', 
                        equip_result.get('error', '装备失败'), 
                        code=400, 
                        request_data=data
                    )
                    return
                
                # 装备成功，从背包中移除物品（装备不消耗，只是从背包移到装备槽位）
                # 注意：装备物品不消耗数量，只是从背包移除，卸下时会放回背包
                effect_result = equip_result
                print(f'✅ [BagHandler] 装备 {item_id} 已装备到机甲 {pet_id} 的 {slot_name} 槽位')
                
                # 关键修复：重新读取背包数据，确保包含旧装备（如果旧装备被放回背包）
                # 因为 _equip_item_to_pet 内部可能已经将旧装备放回背包（MMO级优化：异步查询）
                doc = await utils.async_mongo_operation(
                    lambda: utils.inventory_col.find_one({
                        'user_id': user['_id'],
                        'character_id': cid
                    }),
                    timeout=2.0
                )
                if doc:
                    items = merge_inventory_items(doc)
                    # 重新查找当前物品的位置（因为背包可能已经更新）
                    slot_index = -1
                    for idx, item in enumerate(items):
                        if int(item.get('item_id', 0)) == item_id:
                            slot_index = idx
                            break
                
                # 从背包中移除装备（装备物品不消耗，只是转移）
                # 如果数量为1，删除格子；否则减少数量
                if slot_index >= 0:
                    if current_qty <= 1:
                        items.pop(slot_index)
                        print(f'✅ [BagHandler] 装备 {item_id} 已从背包移除（数量为1）')
                    else:
                        items[slot_index]['quantity'] = current_qty - 1
                        print(f'✅ [BagHandler] 装备 {item_id} 数量减少: {current_qty} -> {current_qty - 1}')
                else:
                    print(f'⚠️ [BagHandler] 警告：装备 {item_id} 在背包中未找到，可能已被移除')
                
                # 更新背包数据库（包含旧装备，如果已添加，MMO级优化：异步操作）
                # 新增：添加版本号自增
                inventory_data = split_inventory_items(items)
                await utils.async_mongo_operation(
                    lambda: utils.inventory_col.update_one(
                        {'user_id': user['_id'], 'character_id': cid},
                        {
                            '$set': inventory_data,
                            '$inc': {'bag_version': 1}  # 新增：版本号自增
                        }
                    ),
                    timeout=2.0
                )
                # 新增：使缓存失效
                bag_cache = get_bag_cache()
                if bag_cache:
                    bag_cache.invalidate(user['_id'], cid)
                
                # 构建响应数据（标准格式：数据在data字段中）
                response_data = {
                    'item_id': item_id,
                    'target_type': target_type,
                    'pet_id': pet_id,
                    'equipped': True,
                    'slot_name': slot_name,
                    'remaining_quantity': current_qty - 1 if current_qty > 1 else 0,
                    'effect_result': effect_result
                }
                
                await utils.send_success_response(
                    websocket,
                    'bag_use_item',
                    data=response_data,
                    message=f'装备成功：{item_data.get("name", "")} 已装备到 {slot_name} 槽位',
                    request_data=data
                )
                
                await _push_bag_refresh(user['_id'], cid, 'equip')

                try:
                    inv_strip = await strip_invalid_equipment_for_pet(
                        user['_id'], cid, pet_id, _add_item_to_inventory
                    )
                    if inv_strip.get('stripped_slots'):
                        print(f'ℹ️ [BagHandler] 装备后自动卸下不匹配槽位: {inv_strip.get("stripped_slots")}')
                        await _push_bag_refresh(user['_id'], cid, 'equip_strip')
                except Exception as _e:
                    print(f'⚠️ [BagHandler] 装备后校验卸下失败（已忽略）: {_e}')
                
                return  # 装备逻辑完成，直接返回
            elif is_equipment:
                # 装备物品但目标不是Pet，返回错误
                await utils.send_error_response(websocket, 'bag_use_item', '装备物品只能对机甲使用，请选择机甲后使用', code=400, request_data=data)
                return
            else:
                # 普通物品（itypeId == 1）：解析effect字符串作为效果
                # 注意：装备物品的effect字段是属性描述（如"格斗+1913"），不是效果字符串，不应该解析
                if item_data.get('effect'):
                    effect_result = await effect_manager.apply(
                        effect_str=item_data.get('effect'),
                        user_id=user['_id'],
                        character_id=cid,
                        target_type=target_type,
                        pet_id=pet_id,
                        item_id=item_id,
                        item_data=item_data  # 传递物品配置，用于智能转换
                    )
                    
                    # 如果效果应用失败，不消耗物品，直接返回错误
                    if not effect_result.get('success'):
                        await utils.send_error_response(
                            websocket, 
                            'bag_use_item', 
                            effect_result.get('error', '效果应用失败'), 
                            code=400, 
                            request_data=data
                        )
                        return
        
        # 效果应用成功，消耗物品
        new_qty = current_qty - 1
        
        # 如果数量为0，删除这个格子
        if new_qty <= 0:
            items.pop(slot_index)
            print(f'✅ [BagHandler] 角色 {cid} 使用物品 {item_id}，已消耗完，删除格子')
        else:
            items[slot_index]['quantity'] = new_qty
            print(f'✅ [BagHandler] 角色 {cid} 使用物品 {item_id}，剩余数量: {new_qty}')

        # 更新数据库（按分类拆分到三个字段，MMO级优化：异步操作）
        # 新增：添加版本号自增
        inventory_data = split_inventory_items(items)
        result = await utils.async_mongo_operation(
            lambda: utils.inventory_col.update_one(
                {'user_id': user['_id'], 'character_id': cid},
                {
                    '$set': inventory_data,
                    '$inc': {'bag_version': 1}  # 新增：版本号自增
                }
            ),
            timeout=2.0
        )
        
        # 新增：使缓存失效
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user['_id'], cid)
        
        # MMO最佳实践：确保数据库写入完成，避免返回旧数据
        # 验证更新是否成功
        if result and result.modified_count == 0 and result.matched_count == 0:
            print(f'⚠️ [BagHandler] 警告：物品使用后数据库更新可能失败')
        # 构建响应数据（标准格式：数据在data字段中）
        response_data = {
            'item_id': item_id,
            'target_type': target_type,
            'remaining_quantity': new_qty if new_qty > 0 else 0,
        }

        # 如果是 Pet 类型，添加机甲信息
        if target_type == 'Pet' and pet_id:
            response_data['pet_id'] = pet_id
            print(f'✅ [BagHandler] 对机甲 {pet_id} 使用物品 {item_id}')
        
        # 添加效果结果到响应
        if effect_result:
            response_data['effect_result'] = effect_result
            print(f'✅ [BagHandler] 物品 {item_id} 效果应用成功: {effect_result.get("message", "")}')

        # 使用标准格式响应（数据在data字段中）
        await utils.send_success_response(
            websocket,
            'bag_use_item',
            data=response_data,
            message='物品使用成功',
            request_data=data
        )

        await _push_bag_refresh(user['_id'], cid, 'use_item')

    except Exception as e:
        print(f'❌ [BagHandler] 使用物品失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_error_response(websocket, 'bag_use_item', f'使用物品失败: {str(e)}', code=500, request_data=data)
    finally:
        if bag_mutation_idempotency:
            bag_mutation_idempotency.abandon(data.get('_bag_idem'))

async def handle_bag_discard_item(websocket, data, current_character_id):
    """处理丢弃物品请求（删除整个格子，支持测试模式）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(websocket, 'bag_discard_item', '未登录', code=401, request_data=data)
        return
    
    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_error_response(websocket, 'bag_discard_item', '角色ID无效', code=400, request_data=data)
        return

    if not await _guard_bag_mutation_rate(websocket, 'bag_discard_item', data, user):
        return

    if bag_mutation_idempotency:
        proceed, idem_meta = await bag_mutation_idempotency.prepare(websocket, user['_id'], 'bag_discard_item', data)
        if not proceed:
            return
        data['_bag_idem'] = idem_meta

    try:
        item_id = int(data.get('item_id', 0))
        slot_index = data.get('slot_index')  # 可选：指定格子索引

        if item_id <= 0:
            await utils.send_error_response(websocket, 'bag_discard_item', '物品ID无效', code=400, request_data=data)
            return

        # 从数据库获取背包数据（MMO级优化：异步查询，避免阻塞事件循环）
        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({
                'user_id': user['_id'],
                'character_id': cid
            }),
            timeout=2.0
        )
        
        if not doc:
            await utils.send_error_response(websocket, 'bag_discard_item', '背包不存在', code=404, request_data=data)
            return

        # 合并三个字段的物品列表
        items = merge_inventory_items(doc)
        
        # MMO最佳实践：使用slot_index精确定位物品（在指定分类中的全局索引）
        category = data.get('category')  # 客户端发送的分类
        client_slot_index = data.get('slot_index')  # 客户端发送的slot索引（在当前分类中的全局索引）
        
        item_slot = None
        found_index = -1
        
        # 如果指定了分类和slot_index，精确定位
        if category is not None and client_slot_index is not None:
            try:
                category = int(category)
                client_slot_index = int(client_slot_index)
                
                # 先过滤出指定分类的物品
                category_items = [(idx, item) for idx, item in enumerate(items) if int(item.get('category', 0)) == category]
                
                # 验证slot_index是否有效
                if 0 <= client_slot_index < len(category_items):
                    found_index_in_category = category_items[client_slot_index][0]  # 原始items中的索引
                    item_slot = category_items[client_slot_index][1]  # 物品数据
                    found_index = found_index_in_category
                    
                    # 验证item_id是否匹配（安全检查）
                    actual_item_id = int(item_slot.get('item_id', 0))
                    if actual_item_id != item_id:
                        item_slot = None
                        found_index = -1
                        print(f'⚠️ [BagHandler] slot_index {client_slot_index} 处的物品ID ({actual_item_id}) 与请求的item_id ({item_id}) 不匹配')
            except (TypeError, ValueError) as e:
                print(f'⚠️ [BagHandler] slot_index或category格式错误: {e}')
                item_slot = None
                found_index = -1
        
        # 如果精确定位失败，回退到旧逻辑（兼容性）
        if found_index < 0:
            # 在指定分类中查找第一个匹配的item_id
            if category is not None:
                try:
                    category = int(category)
                    category_items = [(idx, item) for idx, item in enumerate(items) if int(item.get('category', 0)) == category]
                    for idx, item in category_items:
                        if int(item.get('item_id', 0)) == item_id:
                            item_slot = item
                            found_index = idx
                            break
                except (TypeError, ValueError):
                    pass
            
            # 如果仍然没找到，在所有物品中查找（兼容旧逻辑）
            if found_index < 0:
                for idx, item in enumerate(items):
                    if int(item.get('item_id', 0)) == item_id:
                        item_slot = item
                        found_index = idx
                        break

        if not item_slot:
            await utils.send_error_response(websocket, 'bag_discard_item', f'物品 {item_id} 不在背包中', code=404, request_data=data)
            return

        discarded_qty = int(item_slot.get('quantity', 0))
        
        # 删除整个格子
        items.pop(found_index)
        
        print(f'✅ [BagHandler] 角色 {cid} 丢弃物品 {item_id}，删除整个格子（数量: {discarded_qty}）')

        # 更新数据库（按分类拆分到三个字段，MMO级优化：异步操作）
        # 新增：添加版本号自增
        inventory_data = split_inventory_items(items)
        result = await utils.async_mongo_operation(
            lambda: utils.inventory_col.update_one(
                {'user_id': user['_id'], 'character_id': cid},
                {
                    '$set': inventory_data,
                    '$inc': {'bag_version': 1}  # 新增：版本号自增
                }
            ),
            timeout=2.0
        )
        
        # 新增：使缓存失效
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user['_id'], cid)
        
        # MMO最佳实践：确保数据库写入完成，避免返回旧数据
        # 验证更新是否成功
        if result and result.modified_count == 0 and result.matched_count == 0:
            print(f'⚠️ [BagHandler] 警告：物品丢弃后数据库更新可能失败')

        # 使用标准格式响应（数据在data字段中）
        await utils.send_success_response(
            websocket,
            'bag_discard_item',
            data={
                'item_id': item_id,
                'discarded_quantity': discarded_qty,
            },
            message='物品丢弃成功',
            request_data=data
        )

        _audit_bag_write(user['_id'], cid, 'discard', item_id=item_id, quantity=discarded_qty, category=data.get('category'))
        await _push_bag_refresh(user['_id'], cid, 'discard')

    except Exception as e:
        print(f'❌ [BagHandler] 丢弃物品失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_error_response(websocket, 'bag_discard_item', f'丢弃物品失败: {str(e)}', code=500, request_data=data)
    finally:
        if bag_mutation_idempotency:
            bag_mutation_idempotency.abandon(data.get('_bag_idem'))


async def handle_bag_move_item(websocket, data, current_character_id):
    """同分类内交换两个格子（服务端权威）。请求：category, from_slot, to_slot（分类内 0-based 索引）。"""
    token = data.get('token')
    user = utils.get_user_by_id_or_token(user_id=data.get('user_id'), token=token)
    if not user:
        await utils.send_error_response(websocket, 'bag_move_item', '未登录', code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_error_response(websocket, 'bag_move_item', '角色ID无效', code=400, request_data=data)
        return

    if not await _guard_bag_mutation_rate(websocket, 'bag_move_item', data, user):
        return

    if bag_mutation_idempotency:
        proceed, idem_meta = await bag_mutation_idempotency.prepare(websocket, user['_id'], 'bag_move_item', data)
        if not proceed:
            return
        data['_bag_idem'] = idem_meta

    try:
        category = int(data.get('category', 0))
        from_slot = int(data.get('from_slot', -1))
        to_slot = int(data.get('to_slot', -1))
        if category not in (1, 2, 3) or from_slot < 0 or to_slot < 0:
            await utils.send_error_response(
                websocket, 'bag_move_item', '参数无效', code=400, request_data=data, error_code='BAG_MOVE_BAD_ARGS',
            )
            return

        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({'user_id': user['_id'], 'character_id': cid}),
            timeout=2.0,
        )
        if not doc:
            await utils.send_error_response(websocket, 'bag_move_item', '背包不存在', code=404, request_data=data)
            return

        items = merge_inventory_items(doc)
        cat_entries = [(i, it) for i, it in enumerate(items) if int(it.get('category', 0)) == category]
        if from_slot >= len(cat_entries) or to_slot >= len(cat_entries):
            await utils.send_error_response(
                websocket, 'bag_move_item', '格子索引无效', code=400, request_data=data, error_code='BAG_MOVE_BAD_SLOT',
            )
            return

        g_from = cat_entries[from_slot][0]
        g_to = cat_entries[to_slot][0]
        if from_slot == to_slot:
            await utils.send_error_response(
                websocket, 'bag_move_item', '源与目标相同', code=400, request_data=data, error_code='BAG_MOVE_SAME_SLOT',
            )
            return

        slot_a = items[g_from]
        slot_b = items[g_to]
        iid_a = int(slot_a.get('item_id', 0))
        iid_b = int(slot_b.get('item_id', 0))
        qa = int(slot_a.get('quantity', 0))
        qb = int(slot_b.get('quantity', 0))
        can_stack, limit = _stack_meta(iid_a)

        if iid_a == iid_b and can_stack and iid_a > 0:
            if qb >= limit:
                items[g_from], items[g_to] = items[g_to], items[g_from]
            elif qa + qb <= limit:
                items[g_to]['quantity'] = qa + qb
                items.pop(g_from)
            else:
                room = limit - qb
                items[g_to]['quantity'] = limit
                new_q = qa - room
                if new_q <= 0:
                    items.pop(g_from)
                else:
                    items[g_from]['quantity'] = new_q
        else:
            items[g_from], items[g_to] = items[g_to], items[g_from]

        inventory_data = split_inventory_items(items)
        await utils.async_mongo_operation(
            lambda: utils.inventory_col.update_one(
                {'user_id': user['_id'], 'character_id': cid},
                {'$set': inventory_data, '$inc': {'bag_version': 1}},
            ),
            timeout=2.0,
        )
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user['_id'], cid)

        await utils.send_success_response(
            websocket,
            'bag_move_item',
            data={'category': category, 'from_slot': from_slot, 'to_slot': to_slot},
            message='移动成功',
            request_data=data,
        )
        _audit_bag_write(user['_id'], cid, 'move_item', category=category, from_slot=from_slot, to_slot=to_slot)
        await _push_bag_refresh(user['_id'], cid, 'move_item')
    except Exception as e:
        print(f'❌ [BagHandler] 移动物品失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_error_response(websocket, 'bag_move_item', f'移动失败: {str(e)}', code=500, request_data=data)
    finally:
        if bag_mutation_idempotency:
            bag_mutation_idempotency.abandon(data.get('_bag_idem'))


async def handle_bag_sort(websocket, data, current_character_id):
    """按分类整理：该分类内按 itypeId、item_id 排序后写回。"""
    token = data.get('token')
    user = utils.get_user_by_id_or_token(user_id=data.get('user_id'), token=token)
    if not user:
        await utils.send_error_response(websocket, 'bag_sort', '未登录', code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_error_response(websocket, 'bag_sort', '角色ID无效', code=400, request_data=data)
        return

    if not await _guard_bag_mutation_rate(websocket, 'bag_sort', data, user):
        return

    if bag_mutation_idempotency:
        proceed, idem_meta = await bag_mutation_idempotency.prepare(websocket, user['_id'], 'bag_sort', data)
        if not proceed:
            return
        data['_bag_idem'] = idem_meta

    try:
        category = data.get('category')
        if category is None:
            await utils.send_error_response(
                websocket, 'bag_sort', '缺少 category', code=400, request_data=data, error_code='BAG_SORT_NEED_CATEGORY',
            )
            return
        category = int(category)
        if category not in (1, 2, 3):
            await utils.send_error_response(websocket, 'bag_sort', '分类无效', code=400, request_data=data)
            return

        doc = await utils.async_mongo_operation(
            lambda: utils.inventory_col.find_one({'user_id': user['_id'], 'character_id': cid}),
            timeout=2.0,
        )
        if not doc:
            await utils.send_error_response(websocket, 'bag_sort', '背包不存在', code=404, request_data=data)
            return

        items = merge_inventory_items(doc)
        all_items_data = load_all_item_ids_data()
        id_map = {int(x['id']): x for x in all_items_data if x.get('id') is not None}

        buckets = {1: [], 2: [], 3: []}
        for it in items:
            c = int(it.get('category', 1))
            if c not in buckets:
                c = 1
            buckets[c].append(dict(it))

        def sort_key(entry: dict):
            iid = int(entry.get('item_id', 0))
            d = id_map.get(iid, {})
            return (int(d.get('itypeId', 1)), iid)

        buckets[category].sort(key=sort_key)
        new_items = buckets[1] + buckets[2] + buckets[3]

        inventory_data = split_inventory_items(new_items)
        await utils.async_mongo_operation(
            lambda: utils.inventory_col.update_one(
                {'user_id': user['_id'], 'character_id': cid},
                {'$set': inventory_data, '$inc': {'bag_version': 1}},
            ),
            timeout=2.0,
        )
        bag_cache = get_bag_cache()
        if bag_cache:
            bag_cache.invalidate(user['_id'], cid)

        await utils.send_success_response(
            websocket,
            'bag_sort',
            data={'category': category},
            message='整理完成',
            request_data=data,
        )
        _audit_bag_write(user['_id'], cid, 'sort', category=category)
        await _push_bag_refresh(user['_id'], cid, 'sort')
    except Exception as e:
        print(f'❌ [BagHandler] 整理背包失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_error_response(websocket, 'bag_sort', f'整理失败: {str(e)}', code=500, request_data=data)
    finally:
        if bag_mutation_idempotency:
            bag_mutation_idempotency.abandon(data.get('_bag_idem'))


async def handle_unequip_item(websocket, data, current_character_id):
    """
    处理卸下装备请求（从机甲槽位卸下装备，放回背包）
    网游级实现：原子操作，性能监控
    
    请求格式：
    {
        'token': str,
        'character_id': str,
        'pet_id': str,
        'slot_name': str  # Weapon, Gun, Dun, Wing, Xinpian, Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
    }
    """
    import time
    start_time = time.time()
    print(f'📥 [BagHandler] 收到卸下装备请求: {data}')
    
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        print(f'❌ [BagHandler] 卸下装备失败: 未登录')
        await utils.send_error_response(websocket, 'unequip_item', '未登录', code=401, request_data=data)
        return
    
    cid = data.get('character_id') or current_character_id
    if not cid:
        await utils.send_error_response(websocket, 'unequip_item', '角色ID无效', code=400, request_data=data)
        return
    
    pet_id = data.get('pet_id')
    slot_name = data.get('slot_name')
    
    if not pet_id:
        await utils.send_error_response(websocket, 'unequip_item', '缺少pet_id', code=400, request_data=data)
        return
    
    if not slot_name:
        await utils.send_error_response(websocket, 'unequip_item', '缺少slot_name', code=400, request_data=data)
        return
    
    try:
        from bson import ObjectId
        
        try:
            pet_object_id = ObjectId(pet_id)
        except Exception:
            await utils.send_error_response(websocket, 'unequip_item', f'无效的pet_id: {pet_id}', code=400, request_data=data)
            return
        
        # 获取机甲数据（MMO级优化：异步查询，避免阻塞事件循环）
        pet = await utils.async_mongo_operation(
            lambda: utils.robotpet_col.find_one({
                '_id': pet_object_id,
                'user_id': user['_id'],
                'character_id': cid
            }),
            timeout=2.0
        )
        
        if not pet:
            await utils.send_error_response(websocket, 'unequip_item', '机甲不存在', code=404, request_data=data)
            return
        
        # 获取装备槽位数据
        equipment_slots = pet.get('equipment', {})
        if not isinstance(equipment_slots, dict):
            equipment_slots = {}
        
        # 检查槽位是否有装备
        equipped_item = equipment_slots.get(slot_name)
        if not equipped_item:
            await utils.send_error_response(websocket, 'unequip_item', f'{slot_name} 槽位没有装备', code=404, request_data=data)
            return
        
        item_id = equipped_item.get('item_id')
        if not item_id:
            await utils.send_error_response(websocket, 'unequip_item', f'{slot_name} 槽位装备数据无效', code=400, request_data=data)
            return
        
        # 加载装备数据，用于移除属性（网游级优化：使用缓存）
        item_data = get_equipment_config(item_id)
        
        if not item_data:
            await utils.send_error_response(websocket, 'unequip_item', f'装备 {item_id} 数据不存在', code=404, request_data=data)
            return
        
        # 移除装备的属性加成
        from .item_effect import get_effect_manager
        effect_manager = get_effect_manager()
        
        remove_result = await remove_equipment_attributes(
            item_data=item_data,
            user_id=user['_id'],
            character_id=cid,
            pet_id=pet_id,
            effect_manager=effect_manager
        )
        
        if not remove_result.get('success'):
            await utils.send_error_response(websocket, 'unequip_item', 
                                          f'移除装备属性失败: {remove_result.get("error")}', 
                                          code=500, request_data=data)
            return
        
        # 从槽位中移除装备
        equipment_slots.pop(slot_name, None)
        
        # 更新数据库：保存装备槽位数据（MMO级优化：异步操作）
        await utils.async_mongo_operation(
            lambda: utils.robotpet_col.update_one(
                {'_id': pet_object_id, 'user_id': user['_id'], 'character_id': cid},
                {'$set': {'equipment': equipment_slots}}
            ),
            timeout=2.0
        )
        
        # 将装备放回背包
        await _add_item_to_inventory(
            user_id=user['_id'],
            character_id=cid,
            item_id=item_id,
            quantity=1
        )
        
        # 性能监控：记录成功
        elapsed_time = time.time() - start_time
        update_unequip_stats(elapsed_time, is_error=False)
        
        # 计算总属性（卸下后的总属性）
        total_attrs = calculate_total_attributes(pet, equipment_slots)
        
        print(f'✅ [BagHandler] 角色 {cid} 卸下机甲 {pet_id} 的 {slot_name} 槽位装备 {item_id} (耗时: {elapsed_time*1000:.2f}ms)')
        
        # 构建响应
        response_data = {
            'pet_id': pet_id,
            'slot_name': slot_name,
            'item_id': item_id,
            'item_name': item_data.get('name', ''),
            'removed_attributes': remove_result.get('data', {}).get('removed_attributes', {}),
            'total_attributes': total_attrs['total_attributes'],  # 总属性（用于客户端显示）
            'performance': {
                'elapsed_time_ms': round(elapsed_time * 1000, 2)
            }
        }
        
        await utils.send_success_response(
            websocket,
            'unequip_item',
            data=response_data,
            message=f'卸下成功：{item_data.get("name", "")} 已从 {slot_name} 槽位移除并放回背包',
            request_data=data
        )
        
        await _push_bag_refresh(user['_id'], cid, 'unequip')
        
    except Exception as e:
        # 性能监控：记录错误
        update_unequip_stats(is_error=True)
        print(f'❌ [BagHandler] 卸下装备失败: {e}')
        import traceback
        traceback.print_exc()
        await utils.send_error_response(websocket, 'unequip_item', f'卸下装备失败: {str(e)}', code=500, request_data=data)


async def add_item_to_bag(user_id, character_id, item_id: int, quantity: int = 1) -> dict:
    """公开接口：向背包添加物品（剧情/邮件等系统调用）"""
    return await _add_item_to_inventory(user_id, character_id, item_id, quantity)


async def consume_item_from_bag(user_id, character_id, item_id: int, quantity: int = 1) -> dict:
    """从背包扣除物品（数量不足则失败）"""
    doc = await utils.async_mongo_operation(
        lambda: utils.inventory_col.find_one({'user_id': user_id, 'character_id': character_id}),
        timeout=2.0,
    )
    if not doc:
        return {'success': False, 'error': '背包不存在'}
    items = merge_inventory_items(doc)
    total = sum(int(it.get('quantity', 0) or 0) for it in items if int(it.get('item_id', 0)) == item_id)
    if total < quantity:
        return {'success': False, 'error': '数量不足'}
    remaining = quantity
    for it in items:
        if remaining <= 0:
            break
        if int(it.get('item_id', 0)) != item_id:
            continue
        q = int(it.get('quantity', 0) or 0)
        take = min(q, remaining)
        it['quantity'] = q - take
        remaining -= take
    # 写回分类数组（简化：重建 Weapon/Armor/items）
    new_items = [it for it in items if int(it.get('quantity', 0) or 0) > 0]
    weapon, armor, misc = [], [], []
    for it in new_items:
        cat = int(it.get('category', 1))
        if cat == 2:
            weapon.append(it)
        elif cat == 3:
            armor.append(it)
        else:
            misc.append(it)
    await utils.async_mongo_operation(
        lambda: utils.inventory_col.update_one(
            {'user_id': user_id, 'character_id': character_id},
            {'$set': {'items': misc, 'Weapon': weapon, 'Armor': armor}, '$inc': {'bag_version': 1}},
        ),
        timeout=2.0,
    )
    return {'success': True, 'consumed': quantity}
