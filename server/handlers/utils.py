"""
共享工具函数和数据库连接
"""
import hashlib
import uuid
import datetime
import random
import time
import json
from collections import OrderedDict
from pymongo.errors import AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout

# 这些变量将在ws_server.py中初始化
_throttle_timers = {}
THROTTLE_CONFIG = {
    'get_robot_pets': 0.5,  # 0.5秒内只能请求一次
    'upgrade_robot': 0.3,    # 0.3秒内只能请求一次
    'skill_level_up': 0.3,   # 技能升级（写等级 + 扣技能书）
    'skill_list': 0.2,
    'get_character_info': 0.2,  # 200ms
    'get_player': 0.1,  # 100ms
    'bag_get': 0.1,  # 100ms
    'bag_has_items': 0.1,
    'bag_use_item': 0.25,
    'bag_discard_item': 0.25,
    'bag_move_item': 0.2,
    'bag_sort': 0.5,
    # 好友相关（防刷）
    'get_friend_list': 0.5,
    'get_friend_requests': 0.5,
    'search_friend': 0.5,
    'add_friend': 1.0,
    'approve_friend': 0.5,
    'reject_friend': 0.5,
    'delete_friend': 0.5,
    'equip_socket': 1.0,
    'story_get_state': 0.5,
    'story_interact': 0.5,
    'story_event_complete': 0.5,
    'story_battle_finalize': 0.5,
    'story_battle_start': 1.0,
    'mail_list': 0.5,
    'mail_claim': 0.5,
}
users_col = None
account_limits_col = None
players_col = None
characters_col = None
messages_col = None
robotbase_col = None
monsterbase_col = None
robotpet_col = None
inventory_col = None
user_clients = None
performance_stats = None
user_cache = None
ENCRYPTION_KEY = None
query_cache = None
QUERY_CACHE_TTL = 30
QUERY_CACHE_MAX = 2000
_query_lru = OrderedDict()
LEVEL_TOTAL_EXP = None
MAX_LEVEL = 60

def init_utils(users, account_limits, players, characters, messages, 
               robotbase, monsterbase, robotpet, inventory, clients,
               stats, cache, encryption_key, qcache=None, level_exp=None):
    """初始化工具函数使用的数据库连接"""
    global users_col, account_limits_col, players_col, characters_col, messages_col
    global robotbase_col, monsterbase_col, robotpet_col, inventory_col
    global user_clients, performance_stats, user_cache, ENCRYPTION_KEY
    global query_cache, LEVEL_TOTAL_EXP
    
    users_col = users
    account_limits_col = account_limits
    players_col = players
    characters_col = characters
    messages_col = messages
    robotbase_col = robotbase
    monsterbase_col = monsterbase
    robotpet_col = robotpet
    inventory_col = inventory
    user_clients = clients
    performance_stats = stats
    user_cache = cache
    ENCRYPTION_KEY = encryption_key
    query_cache = qcache if qcache is not None else {}
    LEVEL_TOTAL_EXP = level_exp
    _query_lru.clear()

def mongo_op_once(operation):
    """单次执行 Mongo 操作，不重试（供线程池 + async 层退避使用）。"""
    return operation()


# MongoDB操作包装函数（自动处理连接错误）
# 统一封装：仅此模块提供同步重试；ws_server 不再重复定义。
# time.sleep 仅允许出现在线程池工作线程中；事件循环内请用 async_mongo_operation*。
def safe_mongo_operation(operation, max_retries=5):
    """
    安全的MongoDB操作，自动重试连接错误（同步版本，用于线程池）
    修复：增加重试次数，处理 ConnectionResetError
    """
    import socket
    for attempt in range(max_retries):
        try:
            return operation()
        except (AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout) as e:
            # MongoDB连接错误，自动重试（包括NetworkTimeout）
            if attempt < max_retries - 1:
                # 使用 time.sleep 而不是 asyncio.sleep（因为在线程池中执行）
                delay = 1.0 * (attempt + 1)  # 递增延迟：1s, 2s, 3s, 4s（网络错误需要更长时间）
                print(f'⚠️ [MongoDB] 连接错误，{delay}秒后重试 ({attempt + 1}/{max_retries}): {type(e).__name__}')
                time.sleep(delay)
                continue
            else:
                print(f'❌ [MongoDB] 连接失败，已达到最大重试次数 ({max_retries}): {type(e).__name__}')
                raise
        except (ConnectionResetError, socket.error, OSError) as e:
            # 网络连接被重置（WinError 10054等），自动重试
            if attempt < max_retries - 1:
                delay = 1.0 * (attempt + 1)  # 网络错误延迟更长：1s, 2s, 3s, 4s
                print(f'⚠️ [MongoDB] 网络连接被重置，{delay}秒后重试 ({attempt + 1}/{max_retries}): {type(e).__name__}')
                time.sleep(delay)
                continue
            else:
                print(f'❌ [MongoDB] 网络连接失败，已达到最大重试次数 ({max_retries})')
                raise
        except Exception as e:
            # 其他错误直接抛出（不重试）
            raise


async def async_mongo_operation_read(operation, max_retries=3, timeout=12.0):
    """
    只读路径：线程池内只做单次 operation()，连接类错误在 **async 层** 短退避重试，
    避免 safe_mongo_operation 在线程里 time.sleep 长时间占用 db_executor。
    """
    import asyncio
    import time as time_module
    from ws_server import db_executor

    if db_executor is None:
        return safe_mongo_operation(operation, max_retries=min(max_retries, 2))

    loop = asyncio.get_event_loop()
    deadline = time_module.monotonic() + timeout
    last_err = None

    for attempt in range(max_retries):
        remaining = deadline - time_module.monotonic()
        if remaining <= 0:
            break
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(db_executor, mongo_op_once, operation),
                timeout=max(remaining, 0.02),
            )
        except asyncio.TimeoutError as e:
            last_err = e
            if attempt < max_retries - 1:
                await asyncio.sleep(min(0.05 * (2 ** attempt), 0.25))
            continue
        except (AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout) as e:
            last_err = e
            if attempt < max_retries - 1:
                await asyncio.sleep(min(0.05 * (2 ** attempt), 0.25))
            continue
        except ConnectionResetError as e:
            last_err = e
            if attempt < max_retries - 1:
                await asyncio.sleep(min(0.05 * (2 ** attempt), 0.25))
            continue
        except Exception:
            raise

    if last_err:
        raise last_err
    raise TimeoutError(f'MongoDB 只读操作超时（{timeout}秒）')


# 异步版本的MongoDB操作（线程池只跑单次 operation，退避在 async 层）
async def async_mongo_operation(operation, max_retries=5, timeout=10.0):
    """
    写路径：线程池内只做单次 operation()，连接类错误在 async 层短退避重试。
    避免 safe_mongo_operation 的 time.sleep 占满 db_executor。
    重试次数仍为 max_retries；退避为 0.05/0.1/0.2/0.25 秒，失败由客户端重试。
    """
    import asyncio
    import socket
    import time as time_module
    from ws_server import db_executor

    if db_executor is None:
        return safe_mongo_operation(operation, max_retries=min(max_retries, 2))

    loop = asyncio.get_event_loop()
    deadline = time_module.monotonic() + timeout
    last_err = None
    retryable = (
        asyncio.TimeoutError,
        AutoReconnect,
        ConnectionFailure,
        ServerSelectionTimeoutError,
        NetworkTimeout,
        ConnectionResetError,
        socket.error,
        OSError,
    )

    for attempt in range(max_retries):
        remaining = deadline - time_module.monotonic()
        if remaining <= 0:
            break
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(db_executor, mongo_op_once, operation),
                timeout=max(remaining, 0.02),
            )
        except retryable as e:
            last_err = e
            if attempt < max_retries - 1:
                await asyncio.sleep(min(0.05 * (2 ** attempt), 0.25))
            continue
        except Exception as e:
            print(f'❌ [MongoDB] 异步操作失败: {type(e).__name__}: {e}')
            raise

    print(f'❌ [MongoDB] 写操作失败，已重试 {max_retries} 次: {type(last_err).__name__ if last_err else "timeout"}')
    if last_err:
        raise last_err
    raise TimeoutError(f'MongoDB 写操作超时（{timeout}秒）')

# 简单的加密函数（实际应用中应使用更安全的加密方式）
def encrypt(data):
    if ENCRYPTION_KEY is None:
        raise RuntimeError("ENCRYPTION_KEY not initialized. Call init_utils first.")
    return hashlib.sha256((data + ENCRYPTION_KEY).encode()).hexdigest()

# 生成唯一token
def generate_unique_token(account, password):
    # 根据账号密码生成唯一token
    return encrypt(f"{account}:{password}:{uuid.uuid4()}")

# 生成唯一六位好友ID
def generate_friend_id():
    for _ in range(100):
        fid = f"{random.randint(0, 999999):06d}"
        if players_col is not None and not players_col.find_one({'friend_id': fid}):
            return fid
    # 退化方案：基于时间戳取后六位
    return f"{int(datetime.datetime.utcnow().timestamp() * 1000) % 1000000:06d}"

# ========== 统一响应格式工具 - 参考 Pomelo 设计 ==========
# 消息协议版本（用于版本兼容性检查）
MESSAGE_PROTOCOL_VERSION = '1.0.0'

async def send_response(websocket, route: str, success: bool = True, 
                        data: dict = None, message: str = None, code: int = 200,
                        immediate: bool = False, request_id: str = None, 
                        request_data: dict = None, error_code: str = None):
    """
    发送统一格式的响应 - 参考 Pomelo 的响应格式
    使用推送调度器优化（批量发送，减少网络往返）
    
    Args:
        websocket: WebSocket 连接
        route: 路由名称（消息类型）
        success: 是否成功
        data: 响应数据
        message: 响应消息
        code: 状态码（200=成功, 400=客户端错误, 401=未认证, 500=服务器错误）
        immediate: 是否立即发送（不加入队列，用于错误响应等需要立即发送的情况）
        request_id: 请求ID（用于客户端匹配响应，如果提供则自动添加到响应中）
        request_data: 原始请求数据（如果提供，会自动从中提取 request_id）
    """
    # 确保route不为None，避免生成None_response
    if not route:
        route = 'unknown'
        print(f'⚠️ [Utils] send_response收到None route，使用默认值"unknown"')
    
    response = {
        'type': f'{route}_response',
        'success': success,
        'code': code,
        'timestamp': time.time(),
        'version': MESSAGE_PROTOCOL_VERSION  # 消息协议版本
    }
    
    # 自动提取 request_id（优先级：request_id 参数 > request_data 中的 request_id）
    if request_id is None and request_data:
        request_id = request_data.get('request_id')
    
    # 如果存在 request_id，添加到响应中（用于客户端精确匹配响应）
    if request_id:
        response['request_id'] = request_id
    
    if data:
        response['data'] = data
    if message:
        response['message'] = message
    if error_code:
        response['error_code'] = error_code
    
    # 验证响应格式（确保type字段存在）
    if 'type' not in response or not response['type']:
        print(f'❌ [Utils] 响应缺少type字段: {response}')
        response['type'] = f'{route}_response' if route else 'unknown_response'
    
    # 使用推送调度器发送消息（优化：批量发送）
    # 如果immediate为True，直接发送；否则使用推送调度器
    if immediate and websocket:
        # 立即发送，不使用推送调度器
        try:
            await websocket.send(json.dumps(response, default=str))
            try:
                meta = (request_data or {}).get('_bag_idem')
                if meta:
                    from services.bag_mutation_idempotency import bag_mutation_idempotency
                    bag_mutation_idempotency.complete_from_response(meta, response)
            except Exception:
                pass
            try:
                meta = (request_data or {}).get('_team_idem')
                if meta:
                    from services.battle_team_idempotency import battle_team_idempotency
                    battle_team_idempotency.complete_from_response(meta, response)
            except Exception:
                pass
            return
        except Exception as e:
            print(f'❌ [Utils] 立即发送消息失败: {e}')
            # 如果立即发送失败，尝试使用推送调度器
            pass
    
    # 使用推送调度器发送消息（批量发送优化）
    try:
        from services.push_scheduler import push_scheduler
        from services.session_service import session_service
        
        # 获取 session_id（user_id）
        session = None
        try:
            session = session_service.get_session_by_websocket(websocket)
        except Exception:
            pass  # 如果获取session失败，继续使用websocket直接发送
        
        session_id = str(session.user_id) if session and session.user_id else str(id(websocket))
        
        # 调度发送（如果immediate为True，推送调度器会立即发送）
        await push_scheduler.schedule(
            session_id=session_id,
            message=response,
            websocket=websocket,
            immediate=immediate
        )
        try:
            meta = (request_data or {}).get('_bag_idem')
            if meta:
                from services.bag_mutation_idempotency import bag_mutation_idempotency
                bag_mutation_idempotency.complete_from_response(meta, response)
        except Exception:
            pass
        try:
            meta = (request_data or {}).get('_team_idem')
            if meta:
                from services.battle_team_idempotency import battle_team_idempotency
                battle_team_idempotency.complete_from_response(meta, response)
        except Exception:
            pass
    except Exception as e:
        # 如果推送调度器不可用，回退到直接发送
        try:
            print(f'⚠️ [Utils] 推送调度器发送失败，回退到直接发送: {e}')
            await websocket.send(json.dumps(response, default=str))
            try:
                meta = (request_data or {}).get('_bag_idem')
                if meta:
                    from services.bag_mutation_idempotency import bag_mutation_idempotency
                    bag_mutation_idempotency.complete_from_response(meta, response)
            except Exception:
                pass
            try:
                meta = (request_data or {}).get('_team_idem')
                if meta:
                    from services.battle_team_idempotency import battle_team_idempotency
                    battle_team_idempotency.complete_from_response(meta, response)
            except Exception:
                pass
        except Exception as send_error:
            print(f'❌ [Utils] 直接发送消息也失败: {send_error}')
            pass  # 连接可能已断开


async def send_error_response(websocket, route: str, error_message: str, code: int = 500,
                               request_id: str = None, request_data: dict = None,
                               error_code: str = None):
    """
    发送错误响应（立即发送，不加入队列）
    
    Args:
        websocket: WebSocket 连接
        route: 路由名称
        error_message: 错误消息
        code: 错误代码
        request_id: 请求ID（用于客户端匹配响应）
        request_data: 原始请求数据（如果提供，会自动从中提取 request_id）
    """
    await send_response(websocket, route, success=False, message=error_message, code=code, 
                       immediate=True, request_id=request_id, request_data=request_data,
                       error_code=error_code)


async def send_success_response(websocket, route: str, data: dict = None, message: str = None,
                                 request_id: str = None, request_data: dict = None,
                                 immediate: bool = False):
    """
    发送成功响应
    
    Args:
        websocket: WebSocket 连接
        route: 路由名称
        data: 响应数据
        message: 响应消息
        request_id: 请求ID（用于客户端匹配响应）
        request_data: 原始请求数据（如果提供，会自动从中提取 request_id）
        immediate: 为 True 时立即直发，不进入推送批队列（用于 world_enter 等需尽快到达的快照）
    """
    await send_response(websocket, route, success=True, data=data, message=message, code=200,
                       immediate=immediate, request_id=request_id, request_data=request_data)


async def send_direct_response(websocket, response_dict: dict, request_data: dict = None):
    """
    发送直接格式的响应（字段在根级别，不是标准格式）
    自动添加 request_id（如果请求中包含）和消息版本
    
    Args:
        websocket: WebSocket 连接
        response_dict: 响应字典（字段直接在根级别）
        request_data: 原始请求数据（如果提供，会自动从中提取 request_id）
    """
    # 自动提取 request_id
    request_id = None
    if request_data:
        request_id = request_data.get('request_id')
    
    # 如果存在 request_id，添加到响应中
    if request_id:
        response_dict['request_id'] = request_id
    
    # 添加消息版本（如果响应中还没有）
    if 'version' not in response_dict:
        response_dict['version'] = MESSAGE_PROTOCOL_VERSION
    
    # 直接发送（不使用推送调度器，保持原有行为）
    import json
    try:
        await websocket.send(json.dumps(response_dict, default=str))
        try:
            meta = (request_data or {}).get('_bag_idem')
            if meta:
                from services.bag_mutation_idempotency import bag_mutation_idempotency
                bag_mutation_idempotency.complete_from_response(meta, response_dict)
        except Exception:
            pass
        try:
            meta = (request_data or {}).get('_team_idem')
            if meta:
                from services.battle_team_idempotency import battle_team_idempotency
                battle_team_idempotency.complete_from_response(meta, response_dict)
        except Exception:
            pass
    except Exception:
        pass  # 连接可能已断开


def get_cached_user(user_id):
    """获取缓存的用户数据"""
    if user_cache is None or performance_stats is None:
        return None
    cache_entry = user_cache.get(user_id)
    if cache_entry and time.time() - cache_entry['timestamp'] < 60:  # CACHE_TTL = 60
        performance_stats['cache_hits'] += 1
        return cache_entry['data']
    performance_stats['cache_misses'] += 1
    return None

def set_cached_user(user_id, user_data):
    """设置用户数据缓存"""
    if user_cache is None:
        return
    user_cache[user_id] = {
        'data': user_data,
        'timestamp': time.time()
    }

def get_user_by_token(token):
    """通过token获取用户（带缓存）"""
    if not token or users_col is None:
        return None
    # 先查缓存
    cached = get_cached_user(token)
    if cached:
        return cached
    # 查数据库
    if performance_stats is not None:
        performance_stats['db_queries'] += 1
    user = safe_mongo_operation(lambda: users_col.find_one({'token': token}))
    if user:
        set_cached_user(token, user)
    return user

def get_user_by_id_or_token(user_id=None, token=None):
    """通过user_id或token获取用户（测试模式支持）"""
    user = None
    
    # 优先通过token获取（正常流程）
    if token:
        user = get_user_by_token(token)
        if user:
            return user
    
    # 如果token无效，但提供了user_id（测试模式）
    if user_id:
        try:
            from bson import ObjectId
            user_id_obj = ObjectId(user_id) if isinstance(user_id, str) else user_id
            if performance_stats is not None:
                performance_stats['db_queries'] += 1
            user = safe_mongo_operation(lambda: users_col.find_one({'_id': user_id_obj}))
            if user and token:
                # 如果找到了用户，更新token缓存（使用数据库中的token）
                db_token = user.get('token')
                if db_token:
                    set_cached_user(db_token, user)
        except Exception as e:
            print(f'⚠️ [get_user_by_id_or_token] 通过user_id获取用户失败: {e}')
            user = None
    
    return user


def get_client_ip(websocket):
    """获取客户端真实IP（优先 X-Forwarded-For）"""
    try:
        headers = getattr(websocket, 'request_headers', None)
        if headers:
            xff = headers.get('X-Forwarded-For') or headers.get('x-forwarded-for')
            if xff:
                real_ip = str(xff).split(',')[0].strip()
                if real_ip:
                    return real_ip
    except Exception:
        pass

    try:
        remote = getattr(websocket, 'remote_address', None)
        if isinstance(remote, tuple) and len(remote) >= 1 and remote[0]:
            return str(remote[0])
        if isinstance(remote, str) and remote:
            return remote
    except Exception:
        pass

    return 'unknown'


def _get_limit_doc(username, ip):
    if account_limits_col is None:
        return None
    return safe_mongo_operation(lambda: account_limits_col.find_one({'username': username, 'ip': ip}))


def is_account_action_locked(username, ip, action):
    """
    检查账号+IP是否被锁定
    action: login | pwd
    """
    doc = _get_limit_doc(username, ip)
    if not doc:
        return False, None
    now = datetime.datetime.utcnow()
    login_lock_until = doc.get('login_lock_until')
    pwd_lock_until = doc.get('pwd_lock_until')

    active_locks = []
    if login_lock_until and login_lock_until > now:
        active_locks.append(login_lock_until)
    if pwd_lock_until and pwd_lock_until > now:
        active_locks.append(pwd_lock_until)

    # 互通锁：任一侧锁定，另一侧也视为锁定
    if active_locks:
        lock_until = max(active_locks)
        return True, lock_until
    return False, None


def clear_account_action_failures(username, ip, action):
    """清空账号+IP指定动作的错误计数与锁"""
    if account_limits_col is None:
        return
    now = datetime.datetime.utcnow()
    count_field = 'login_fail_count' if action == 'login' else 'pwd_fail_count'
    safe_mongo_operation(lambda: account_limits_col.update_one(
        {'username': username, 'ip': ip},
        {
            '$set': {
                count_field: 0,
                # 互通锁：任一入口成功后，两侧锁都清除
                'login_lock_until': None,
                'pwd_lock_until': None,
                'update_time': now
            },
            '$setOnInsert': {
                'username': username,
                'ip': ip
            }
        },
        upsert=True
    ))


def record_account_action_failure(username, ip, action, max_fail=5, lock_minutes=5):
    """
    记录失败次数；达到阈值后锁定，返回 (new_count, lock_until or None)
    """
    if account_limits_col is None:
        return 0, None
    now = datetime.datetime.utcnow()
    count_field = 'login_fail_count' if action == 'login' else 'pwd_fail_count'

    current = _get_limit_doc(username, ip) or {}
    current_count = int(current.get(count_field, 0) or 0)
    new_count = current_count + 1
    lock_until = now + datetime.timedelta(minutes=lock_minutes) if new_count >= max_fail else None

    set_fields = {
        count_field: new_count,
        'update_time': now
    }
    # 互通锁：触发锁定时，两侧同时锁住
    if lock_until is not None:
        set_fields['login_lock_until'] = lock_until
        set_fields['pwd_lock_until'] = lock_until

    safe_mongo_operation(lambda: account_limits_col.update_one(
        {'username': username, 'ip': ip},
        {
            '$set': set_fields,
            '$setOnInsert': {
                'username': username,
                'ip': ip
            }
        },
        upsert=True
    ))
    return new_count, lock_until

def register_client_user(ws, uid):
    """注册客户端用户"""
    if user_clients is None:
        return
    try:
        key = str(uid)
        s = user_clients.get(key)
        if not s:
            s = set()
            user_clients[key] = s
        s.add(ws)
    except Exception:
        pass

def unregister_client(ws):
    """取消注册客户端"""
    if user_clients is None:
        return
    try:
        for k in list(user_clients.keys()):
            s = user_clients.get(k)
            if s and ws in s:
                s.discard(ws)
    except Exception:
        pass


async def push_to_user(user_id, route: str, data: dict = None, message: str = None) -> int:
    """
    向指定 user_id 的所有在线连接主动推送一条带 type 的消息（服务端发起，非请求响应）。

    客户端 WebSocketManager.handleMessage 会把任何带 type 的消息 emit 出去，
    因此这里直接把 type 设为 route 本身（不加 _response 后缀），客户端按 route 监听即可。

    Returns: 成功投递的连接数。
    """
    if user_clients is None:
        return 0
    payload = {
        'type': route,
        'success': True,
        'code': 200,
        'timestamp': time.time(),
        'version': MESSAGE_PROTOCOL_VERSION,
    }
    if data:
        payload['data'] = data
    if message:
        payload['message'] = message
    text = json.dumps(payload, default=str)
    delivered = 0
    ws_set = user_clients.get(str(user_id))
    if not ws_set:
        return 0
    for ws in list(ws_set):
        try:
            await ws.send(text)
            delivered += 1
        except Exception:
            # 单个连接发送失败不影响其它连接
            pass
    return delivered

def compute_robot_count(user_id, character_id):
    """计算指定用户在指定角色下的机甲数量"""
    try:
        if not user_id or not character_id or robotpet_col is None:
            return 0
        return robotpet_col.count_documents({'user_id': user_id, 'character_id': character_id})
    except Exception:
        return 0


def normalize_energy_blocks(value):
    """第二货币「能量块」规范为非负整数；兼容旧字段 points 的 str/int。"""
    if value is None or value == '':
        return 0
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def get_energy_blocks_for_response(doc):
    """
    从角色/玩家文档读取能量块：优先 energy_blocks，无则回退旧字段 points。
    """
    if not doc:
        return 0
    if 'energy_blocks' in doc:
        return normalize_energy_blocks(doc.get('energy_blocks'))
    return normalize_energy_blocks(doc.get('points'))


def allocate_slot_index(user_id, character_id):
    """
    为新的机甲分配 slot_index（1-10）
    找到最小未使用的编号，如果都满了返回 None
    
    MMO最佳实践：编号不回收，简单可靠，避免并发问题
    """
    if not user_id or not character_id or robotpet_col is None:
        return None
    
    try:
        # 查询该角色下所有已分配的 slot_index
        existing_pets = robotpet_col.find(
            {'user_id': user_id, 'character_id': character_id},
            {'slot_index': 1}
        )
        
        # 收集已使用的编号
        used_slots = set()
        for pet in existing_pets:
            slot = pet.get('slot_index')
            if slot is not None and isinstance(slot, int) and 1 <= slot <= 10:
                used_slots.add(slot)
        
        # 找到最小未使用的编号（1-10）
        for i in range(1, 11):
            if i not in used_slots:
                return i
        
        # 如果都满了，返回 None（表示无法分配）
        return None
    except Exception as e:
        print(f'⚠️ [utils] 分配 slot_index 失败: {e}')
        return None

def clear_slot_index(pet_id):
    """
    清空机甲的 slot_index（放生时调用）
    不回收编号，避免并发问题和复杂度
    """
    if not pet_id or robotpet_col is None:
        return False
    
    try:
        from bson import ObjectId
        pet_object_id = ObjectId(pet_id)
        result = robotpet_col.update_one(
            {'_id': pet_object_id},
            {'$unset': {'slot_index': '', 'is_in_battle_team': '', 'battle_team_position': ''}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f'⚠️ [utils] 清空 slot_index 失败: {e}')
        return False

def get_exp_required_for_level(level):
    """获取指定等级升级需要的经验（level 从 1 开始）"""
    if LEVEL_TOTAL_EXP is None:
        return 0
    if level < 1:
        return 0
    if level > MAX_LEVEL:
        return LEVEL_TOTAL_EXP[-1]
    return LEVEL_TOTAL_EXP[level - 1]

def get_total_exp_for_level(level):
    """获取指定等级的累计总经验（level 从 1 开始）
    通过累加前面所有等级的经验来计算累计总经验
    """
    if LEVEL_TOTAL_EXP is None:
        return 0
    if level < 1:
        return 0
    if level > MAX_LEVEL:
        # 如果超过最大等级，返回所有等级的经验总和
        return sum(LEVEL_TOTAL_EXP)
    
    # 累加从1级到指定等级的所有经验
    total = 0
    for lvl in range(1, level + 1):
        total += LEVEL_TOTAL_EXP[lvl - 1]
    return total

def calculate_level_from_exp(total_exp):
    """根据累计总经验计算等级（服务器权威计算）
    通过累加每级经验来判断总经验对应的等级
    """
    if LEVEL_TOTAL_EXP is None:
        return 1
    new_level = 1
    accumulated_exp = 0
    
    for lvl in range(1, MAX_LEVEL + 1):
        exp_required = LEVEL_TOTAL_EXP[lvl - 1]  # 每级需要的经验
        accumulated_exp += exp_required
        
        if total_exp >= accumulated_exp:
            new_level = lvl
        else:
            break
    
    return min(new_level, MAX_LEVEL)

def _query_bucket(cache_key) -> str:
    """失效前缀对应的桶。robot_pets 按角色分桶，其余按键名前缀。"""
    key = str(cache_key)
    if key.startswith('robot_pets:'):
        parts = key.split(':')
        if len(parts) >= 3:
            return f'robot_pets:{parts[1]}:{parts[2]}:'
        return 'robot_pets:'
    for name in ('friend_list_', 'friend_requests_', 'robot_counts_'):
        if key.startswith(name):
            return name
    return ''


def _pop_query_key(cache_key) -> bool:
    bucket = _query_lru.pop(cache_key, None)
    if bucket is None or query_cache is None:
        return False
    entries = query_cache.get(bucket)
    if isinstance(entries, dict):
        entries.pop(cache_key, None)
        if not entries:
            query_cache.pop(bucket, None)
    return True


def purge_expired_query_cache(now=None) -> int:
    """删掉已超过 QUERY_CACHE_TTL 的项。返回删除条数。"""
    if query_cache is None:
        return 0
    current = time.time() if now is None else now
    removed = 0
    for cache_key in list(_query_lru.keys()):
        bucket = _query_lru.get(cache_key)
        entry = (query_cache.get(bucket) or {}).get(cache_key) if bucket is not None else None
        if not entry or current - entry.get('timestamp', 0) >= QUERY_CACHE_TTL:
            _pop_query_key(cache_key)
            removed += 1
    return removed


def get_cached_query(cache_key):
    """获取缓存的查询结果"""
    if query_cache is None or performance_stats is None:
        return None
    bucket = _query_lru.get(cache_key)
    cache_entry = (query_cache.get(bucket) or {}).get(cache_key) if bucket is not None else None
    if cache_entry and time.time() - cache_entry['timestamp'] < QUERY_CACHE_TTL:
        _query_lru.move_to_end(cache_key)
        performance_stats['cache_hits'] += 1
        return cache_entry['data']
    if cache_entry:
        _pop_query_key(cache_key)
    performance_stats['cache_misses'] += 1
    return None

def set_cached_query(cache_key, result):
    """设置查询结果缓存"""
    if query_cache is None:
        return
    if cache_key not in _query_lru and len(_query_lru) >= QUERY_CACHE_MAX:
        purge_expired_query_cache()
    while cache_key not in _query_lru and len(_query_lru) >= QUERY_CACHE_MAX:
        _pop_query_key(next(iter(_query_lru)))
    bucket = _query_bucket(cache_key)
    old_bucket = _query_lru.get(cache_key)
    if old_bucket is not None and old_bucket != bucket:
        _pop_query_key(cache_key)
    entries = query_cache.setdefault(bucket, {})
    entries[cache_key] = {
        'data': result,
        'timestamp': time.time()
    }
    _query_lru[cache_key] = bucket
    _query_lru.move_to_end(cache_key)

def invalidate_cached_query(cache_key):
    """使查询结果缓存失效（用于数据更新时）"""
    if query_cache is None:
        return
    _pop_query_key(cache_key)

def invalidate_cached_query_prefix(prefix: str) -> None:
    """按前缀失效查询缓存（如 robot_pets:{uid}:{cid}:）。只扫命中的桶。"""
    if query_cache is None or not prefix:
        return
    prefix = str(prefix)
    drop_buckets = [b for b in list(query_cache.keys()) if b and str(b).startswith(prefix)]
    for bucket in drop_buckets:
        entries = query_cache.get(bucket) or {}
        for cache_key in list(entries.keys()):
            _pop_query_key(cache_key)
    for bucket in list(query_cache.keys()):
        if bucket in drop_buckets:
            continue
        if bucket and not prefix.startswith(bucket):
            continue
        entries = query_cache.get(bucket) or {}
        for cache_key in [k for k in entries.keys() if str(k).startswith(prefix)]:
            _pop_query_key(cache_key)


def invalidate_robot_pets_cache(user_id, character_id=None) -> None:
    """机甲列表短缓存失效。character_id 为空则清该用户全部分页。"""
    if user_id is None:
        invalidate_cached_query_prefix('robot_pets:')
        return
    uid = str(user_id)
    if character_id:
        invalidate_cached_query_prefix(f'robot_pets:{uid}:{character_id}:')
    else:
        invalidate_cached_query_prefix(f'robot_pets:{uid}:')

def throttle_check(websocket_id, action):
    """节流检查（网游级优化：防止频繁请求）"""
    if action not in THROTTLE_CONFIG:
        return True
    
    throttle_time = THROTTLE_CONFIG[action]
    if websocket_id not in _throttle_timers:
        _throttle_timers[websocket_id] = {}
    
    last_time = _throttle_timers[websocket_id].get(action, 0)
    current_time = time.time()
    
    if current_time - last_time < throttle_time:
        return False  # 请求太频繁，拒绝
    
    _throttle_timers[websocket_id][action] = current_time
    return True

def get_throttle_timers():
    """获取节流计时器字典（用于清理）"""
    return _throttle_timers

def calculate_robot_exp_bar(total_exp, level=None):
    """
    计算机甲经验条数据（与人物经验计算方式一致）
    :param total_exp: 累计总经验
    :param level: 当前等级（如果提供且可信，则使用它，否则重新计算）
    :return: (level, current_level_exp, next_level_need_exp)
    next_level_need_exp: 从当前等级升到下一级所需的经验（直接取下一级需要的经验值）
    """
    from .robot_upgrade import get_upgrade_manager
    upgrade_manager = get_upgrade_manager()
    
    # 性能优化：如果提供了level参数，先验证它是否准确，不准确才重新计算
    if level is not None:
        # 验证提供的等级是否准确（快速验证）
        level_min_exp = upgrade_manager.get_total_exp_for_level(level)
        level_max_exp = upgrade_manager.get_total_exp_for_level(level + 1) if level < 60 else upgrade_manager.get_total_exp_for_level(60)
        
        # 如果经验值在这个等级的范围内，使用提供的等级
        if level_min_exp <= total_exp < level_max_exp:
            # 等级准确，直接使用
            prev_total = level_min_exp
        else:
            # 等级不准确，重新计算
            level = upgrade_manager.calculate_level_from_exp(total_exp)
            prev_total = upgrade_manager.get_total_exp_for_level(level)
    else:
        # 没有提供等级，必须计算
        level = upgrade_manager.calculate_level_from_exp(total_exp)
        prev_total = upgrade_manager.get_total_exp_for_level(level)
    
    # 当前等级内的经验（从当前等级起点开始计算）
    current_level_exp = max(0, total_exp - prev_total)
    
    # 从当前等级升到下一级所需的经验（直接取下一级需要的经验值，不需要相减）
    if level < 60:
        # 获取下一级需要的经验（直接使用表中的值）
        next_level_need_exp = upgrade_manager.get_exp_required_for_level(level + 1)
    else:
        next_level_need_exp = 0
    
    # 关键修复：如果当前等级内经验已经超过升到下一级需要的经验，说明应该升级了
    # 这种情况下，重新计算等级确保准确（防止经验溢出但等级不更新）
    if level < 60 and current_level_exp > 0 and next_level_need_exp > 0 and current_level_exp >= next_level_need_exp:
        # 经验已经足够升级，重新计算等级
        recalculated_level = upgrade_manager.calculate_level_from_exp(total_exp)
        if recalculated_level > level:
            # 等级计算有误，使用重新计算的等级
            level = recalculated_level
            prev_total = upgrade_manager.get_total_exp_for_level(level)
            current_level_exp = max(0, total_exp - prev_total)
            if level < 60:
                next_level_need_exp = upgrade_manager.get_exp_required_for_level(level + 1)
            else:
                next_level_need_exp = 0
    
    return level, current_level_exp, next_level_need_exp
