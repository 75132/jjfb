"""
玩家信息相关操作处理器
处理：get_player (获取玩家信息)
"""
import datetime
from . import utils
import math

def get_total_exp_for_level(level):
    """获取指定等级的累计总经验（level 从 1 开始）"""
    if utils.LEVEL_TOTAL_EXP is None:
        return 0
    if level < 1:
        return 0
    if level > utils.MAX_LEVEL:
        return utils.LEVEL_TOTAL_EXP[-1]
    return utils.LEVEL_TOTAL_EXP[level - 1]

def calculate_level_from_exp(total_exp):
    """根据累计总经验计算等级（服务器权威计算）"""
    if utils.LEVEL_TOTAL_EXP is None:
        return 1
    new_level = 1
    for lvl in range(1, utils.MAX_LEVEL + 1):
        need_total = get_total_exp_for_level(lvl)
        if total_exp >= need_total:
            new_level = lvl
        else:
            break
    return min(new_level, utils.MAX_LEVEL)


_MAP_DEFAULT_SPAWNS = {
    1: (120.0, -24.0),  # 地图1出生点（需求指定）
    # 预留：后续地图可继续在此扩展
    # 2: (x, y),
}



def _get_default_spawn(map_id):
    p = _MAP_DEFAULT_SPAWNS.get(int(map_id))
    if p:
        return float(p[0]), float(p[1])
    # 未配置地图回退到 map_id=1 的出生点
    p1 = _MAP_DEFAULT_SPAWNS.get(1, (120.0, -24.0))
    return float(p1[0]), float(p1[1])


def _is_valid_position_doc(raw):
    """判断 position 是否为可用坐标结构。"""
    if not isinstance(raw, dict):
        return False
    try:
        map_id = int(raw.get('map_id', 1))
        x = float(raw.get('x'))
        y = float(raw.get('y'))
    except Exception:
        return False
    if not math.isfinite(x) or not math.isfinite(y):
        return False
    if map_id <= 0:
        return False
    if abs(x) > 200000 or abs(y) > 200000:
        return False
    return True


def _normalize_position(raw):
    """统一位置结构：默认 map_id=1，默认出生像素坐标(120,-24)。"""
    if not isinstance(raw, dict):
        raw = {}
    try:
        map_id = int(raw.get('map_id', 1))
    except Exception:
        map_id = 1
    if map_id <= 0:
        map_id = 1
    default_x, default_y = _get_default_spawn(map_id)
    try:
        x = float(raw.get('x', default_x))
    except Exception:
        x = default_x
    try:
        y = float(raw.get('y', default_y))
    except Exception:
        y = default_y
    if not math.isfinite(x) or not math.isfinite(y) or abs(x) > 200000 or abs(y) > 200000:
        x, y = default_x, default_y
    return {
        'map_id': map_id,
        'x': x,
        'y': y,
    }


def _should_force_map1_spawn(raw, normalized) -> bool:
    """地图1位置脏数据判定：只在异常/缺失时强制回到出生点。"""
    try:
        map_id = int(normalized.get('map_id', 1))
    except Exception:
        map_id = 1
    if map_id != 1:
        return False
    if not isinstance(raw, dict):
        return True
    if raw.get('x') is None or raw.get('y') is None:
        return True
    try:
        x = float(raw.get('x'))
        y = float(raw.get('y'))
    except Exception:
        return True
    if not math.isfinite(x) or not math.isfinite(y):
        return True
    if abs(x) > 200000 or abs(y) > 200000:
        return True
    # (0,0) 多为未初始化/进图竞态脏数据，地图1 应回到出生点
    if abs(x) < 0.5 and abs(y) < 0.5:
        return True
    return False


async def handle_get_player(websocket, data, current_character_id):
    """处理获取玩家信息请求（支持测试模式：通过user_id获取用户）
    支持查看自己的信息或好友的信息（通过 character_id 或 friend_id）"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式：支持通过user_id获取用户
    character_id = data.get('character_id')
    friend_id = data.get('friend_id')  # 支持通过好友ID查找
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    
    if not user:
        await utils.send_error_response(websocket, 'player_info', '用户不存在或未登录', code=401, request_data=data)
        return
    
    # 确定要查询的角色ID
    # 优先使用客户端提供的 character_id
    cid = character_id
    player = None
    query_source = 'unknown'

    # 1. 如果提供了 friend_id，优先使用 friend_id 直接查询（性能优化：一次查询）
    # 只要提供了 friend_id，就认为是"好友入口"或"搜索入口"，直接查该好友
    if friend_id:
        print(f'[player_handler] 使用 friend_id 直接查询: {friend_id}')
        # MMO级优化：异步数据库查询，避免阻塞事件循环
        player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'friend_id': friend_id}),
            timeout=2.0
        )
        query_source = 'friend_id_direct'
        if player:
            cid = player.get('character_id')
        else:
            await utils.send_error_response(websocket, 'player_info', '找不到该好友', code=404, request_data=data)
            return

    # 2. 如果没有 friend_id 但有 character_id，则按 character_id 查询
    elif cid:
        print(f'[player_handler] 使用 character_id 查询: {cid}')
        # MMO级优化：异步数据库查询，避免阻塞事件循环
        player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'character_id': cid}),
            timeout=2.0
        )
        query_source = 'character_id_standard'
    
    # 3. 如果都没有，回退到自己
    else:
        print(f'[player_handler] 未提供ID，回退到当前用户 {current_character_id}')
        cid = current_character_id
        # MMO级优化：异步数据库查询，避免阻塞事件循环
        player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({'character_id': cid}),
            timeout=2.0
        )
        query_source = 'self_fallback'

    # 检查查询结果
    if not player:
        await utils.send_error_response(websocket, 'player_info', '角色不存在', code=404, request_data=data)
        return

    print(f'[player_handler] 查询成功 ({query_source}), 角色: {player.get("role_name")}, ID: {cid}')
    
    # 判断是否是查看自己的信息
    is_self = (player.get('user_id') == user['_id'])
    
    # 判断是否是好友
    is_friend = False
    if not is_self and current_character_id:
        # 获取当前玩家的好友列表
        current_player_doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': current_character_id}))
        if current_player_doc:
            friends = current_player_doc.get('friends', [])
            target_friend_id = player.get('friend_id')
            if target_friend_id and target_friend_id in friends:
                is_friend = True
    
    # 判断在线状态（只有查看他人时才需要判断，使用状态机）
    is_online = False
    player_status = 'offline'
    if not is_self:
        # 通过 session_service 状态机判断用户状态
        from services.session_service import session_service, PlayerStatus
        from bson import ObjectId
        target_user_id = player.get('user_id')
        if target_user_id:
            try:
                user_id_obj = ObjectId(target_user_id) if isinstance(target_user_id, str) else target_user_id
                # 使用状态机获取状态
                status = session_service.get_player_status(user_id_obj)
                player_status = status.value
                # 只有状态不是OFFLINE时才认为在线
                is_online = status != PlayerStatus.OFFLINE
            except Exception as e:
                print(f'[player_handler] 判断在线状态失败: {e}')
                is_online = False
                player_status = 'offline'
    
    total_exp = player.get('exp', 0)
    level = player.get('level', 1)
    level = calculate_level_from_exp(total_exp)
    
    # 计算累计总经验：累加从1级到当前等级的所有经验
    prev_total = get_total_exp_for_level(level)
    
    # 当前等级内的经验 = 总经验 - 前面所有等级的累计经验
    current_level_exp = max(0, total_exp - prev_total)
    
    # 从当前等级升到下一级所需的经验（直接取下一级需要的经验值，不需要相减）
    if level < 60:
        # 获取下一级需要的经验（直接使用表中的值）
        # level是当前等级（1-59），索引level对应下一级
        # 注意：LEVEL_TOTAL_EXP 现在存储的是每级需要的经验，不是累计总经验
        next_level_need_exp = utils.LEVEL_TOTAL_EXP[level]  # 例如：level=56，索引56对应57级
    else:
        next_level_need_exp = 0
    
    # 调试日志：输出56级升57级的计算详情
    if level == 56:
        print(f'[DEBUG] 56级升57级计算详情:')
        print(f'  - 总经验: {total_exp}')
        print(f'  - 56级累计总经验: {prev_total}')
        print(f'  - 当前等级内经验: {current_level_exp}')
        print(f'  - 57级需要的经验: {next_level_need_exp}')
        print(f'  - 56级需要的经验: {utils.LEVEL_TOTAL_EXP[55]}')
        print(f'  - 57级需要的经验: {utils.LEVEL_TOTAL_EXP[56]}')
    
    # 计算机甲数量（使用目标角色的 user_id）
    target_user_id = player.get('user_id')
    robot_count = utils.compute_robot_count(target_user_id, cid)
    
    # 坐标兜底：缺失/异常时使用地图默认出生点，并回写数据库（刷新即自愈）
    raw_pos = player.get('position', {})
    normalized_pos = _normalize_position(raw_pos)
    need_fix_pos = (not _is_valid_position_doc(raw_pos)) or _should_force_map1_spawn(raw_pos, normalized_pos)
    if need_fix_pos:
        if int(normalized_pos.get('map_id', 1)) == 1:
            normalized_pos['x'] = 120.0
            normalized_pos['y'] = -24.0
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {'user_id': player.get('user_id'), 'character_id': cid},
                {'$set': {'position': {
                    'map_id': int(normalized_pos.get('map_id', 1)),
                    'x': float(normalized_pos.get('x', 120.0)),
                    'y': float(normalized_pos.get('y', -24.0)),
                    'updated_at': datetime.datetime.utcnow(),
                }}}
            ),
            timeout=2.0
        )
        player['position'] = normalized_pos

    # 构建响应数据（使用统一的响应函数，自动包含 request_id）
    # ✅ 补全所有字段，确保好友界面数据展示完整
    response_data = {
        'is_self': is_self,  # 标识是否是查看自己的信息（关键：GameCommonData 只处理 is_self=True 的响应）
        'is_friend': is_friend, # 标识是否是好友
        'role_name': player.get('role_name', ''),
        'level': level,
        'exp': total_exp,
        'total_exp': total_exp,
        'current_level_exp': current_level_exp,
        'next_level_need_exp': next_level_need_exp,
        'friend_id': player.get('friend_id', ''),
        'Sprite': player.get('Sprite', 0),
        'class': player.get('class', 1),
        'robotcount': robot_count,
        # ✅ 补全缺失的字段
        'gold': player.get('gold', 0),
        'energy_blocks': utils.get_energy_blocks_for_response(player),
        'alliance': player.get('alliance', ''),  # 联盟
        'record': player.get('record', ''),  # 战绩
        'rank': player.get('rank', ''),  # 排名
        'position': normalized_pos,  # 位置信息
        'character_id': str(cid),  # 角色ID
        'user_id': str(player.get('user_id', '')),  # 用户ID
    }
    
    # 只有查看他人时才返回在线状态和状态机状态
    if not is_self:
        response_data['online'] = is_online
        response_data['status'] = player_status  # 状态机状态（'online', 'offline', 'in_battle'等）
    
    # 只有查看自己的信息时才返回物品（隐私保护）
    # 修改：应用户要求，暂时全部真实显示
    if is_self:
        response_data['items'] = player.get('items', {})
    
    # 注意：以下字段在数据库中可能不存在，暂时设为默认值
    # 如果后续需要，可以在数据库中补充这些字段
    # 'vip': player.get('vip', 0),  # VIP等级（如果数据库中有）
    # 'marriage_status': player.get('marriage_status', ''),  # 婚姻状况（如果数据库中有）
    # 'spouse': player.get('spouse', ''),  # 配偶（如果数据库中有）
    
    # 使用统一的响应函数，自动包含 request_id（优化：请求-响应关联）
    await utils.send_success_response(
        websocket, 
        'player_info',  # route 名称
        data=response_data,
        request_data=data  # 自动从请求数据中提取 request_id 并添加到响应
    )


async def handle_update_player_position(websocket, data, current_user_id, current_character_id):
    """旧接口：已下线（保留兼容响应，避免客户端旧版本报错）。"""
    await utils.send_error_response(
        websocket,
        'update_player_position',
        'update_player_position 已下线',
        code=410,
        request_data=data
    )
    return
    token = data.get('token')
    user_id = data.get('user_id')
    character_id = data.get('character_id') or current_character_id
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)

    if not user:
        await utils.send_error_response(websocket, 'update_player_position', '用户不存在或未登录', code=401, request_data=data)
        return
    if not character_id:
        await utils.send_error_response(websocket, 'update_player_position', 'character_id 不能为空', code=400, request_data=data)
        return

    # map_id 当前先固定为 1（按需求），但保留字段以便后续多地图扩展
    map_id = int(data.get('map_id', 1))
    x = data.get('x')
    y = data.get('y')
    if x is None or y is None:
        await utils.send_error_response(websocket, 'update_player_position', 'x/y 不能为空', code=400, request_data=data)
        return
    try:
        x = float(x)
        y = float(y)
    except Exception:
        await utils.send_error_response(websocket, 'update_player_position', 'x/y 必须是数字', code=400, request_data=data)
        return

    # 简单防异常值（避免脏数据进入数据库）
    if abs(x) > 200000 or abs(y) > 200000:
        await utils.send_error_response(websocket, 'update_player_position', 'x/y 超出允许范围', code=400, request_data=data)
        return

    pos = {
        'map_id': map_id,
        'x': x,
        'y': y,
        'updated_at': datetime.datetime.utcnow(),
    }
    result = await utils.async_mongo_operation(
        lambda: utils.players_col.update_one(
            {'user_id': user['_id'], 'character_id': character_id},
            {'$set': {'position': pos}}
        ),
        timeout=2.0
    )
    if not result or result.matched_count <= 0:
        await utils.send_error_response(websocket, 'update_player_position', '角色不存在或不属于当前用户', code=404, request_data=data)
        return

    await utils.send_success_response(
        websocket,
        'update_player_position',
        data={
            'character_id': character_id,
            'position': {'map_id': map_id, 'x': x, 'y': y},
        },
        request_data=data
    )
