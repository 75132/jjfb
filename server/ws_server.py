import asyncio
import http.server
import threading
import os
from functools import partial
import websockets
import json
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout
from pymongo import monitoring
from bson import ObjectId
import hashlib
import uuid
import datetime
import random
import socket
import subprocess
import sys
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from handlers.robot_upgrade import get_upgrade_manager
from handlers import utils as handler_utils
from handlers import login_handler
from handlers import character_handler
from handlers import admin_handler
from handlers import robot_handler
from handlers import chat_handler
from handlers import bag_handler
from handlers import item_exp_handler
from handlers import player_handler
from services.session_service import session_service
from services.world_presence_service import world_presence_service
from services.logger_service import init_logger, get_logger
from services.channel_service import channel_service

# 加密密钥（用于服务器中间加密解密）
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY') or ''
if not ENCRYPTION_KEY:
    print('[安全提醒] 未设置 ENCRYPTION_KEY，使用临时随机密钥。请在生产环境通过环境变量提供固定密钥。')
    ENCRYPTION_KEY = uuid.uuid4().hex

# WebSocket 服务配置
WS_HOST = os.getenv('WS_HOST', '0.0.0.0')
WS_PORT = int(os.getenv('WS_PORT', '8001'))

# MongoDB事件监听器：捕获后台连接错误，避免未处理的异常
class MongoErrorLogger(monitoring.ServerHeartbeatListener):
    """监听MongoDB心跳事件，记录连接错误但不抛出异常"""
    def started(self, event):
        pass
    
    def succeeded(self, event):
        pass
    
    def failed(self, event):
        # 记录心跳失败，但不抛出异常（这是后台任务，不应该中断主程序）
        reply = getattr(event, 'reply', None)
        if isinstance(reply, Exception):
            error_type = type(reply).__name__
            event_addr = getattr(event, 'server_address', None) or getattr(event, 'connection_id', 'unknown')
            # 只记录警告，不抛出异常（避免影响主程序运行）
            try:
                logger = get_logger()
                if isinstance(reply, NetworkTimeout):
                    # 网络超时是常见情况，记录为警告级别
                    logger.warning(f'[MongoDB] 后台连接检查超时: {event_addr} - {error_type}')
                else:
                    logger.warning(f'[MongoDB] 后台连接检查失败: {event_addr} - {error_type}: {reply}')
            except Exception:
                # 如果logger未初始化，使用print（避免在初始化前出错）
                if isinstance(reply, NetworkTimeout):
                    print(f'⚠️ [MongoDB] 后台连接检查超时: {event_addr} - {error_type}')
                else:
                    print(f'⚠️ [MongoDB] 后台连接检查失败: {event_addr} - {error_type}: {reply}')

# 注册事件监听器（在创建MongoClient之前注册，捕获所有后台错误）
monitoring.register(MongoErrorLogger())

# 连接MongoDB（MMO级优化：使用连接池）
# 生产部署时建议通过环境变量提供，避免把主机/IP硬编码到代码里。
# - 如果宝塔与 MongoDB 在同一台机器：不设置 MONGO_URL，将默认连接到 localhost
# - 如果 MongoDB 在远端：设置 MONGO_URL 为你的真实连接串


# 生产部署时建议通过环境变量提供，避免把主机/IP硬编码到代码里。
# - 如果宝塔与 MongoDB 在同一台机器：不设置 MONGO_URL，将默认连接到 localhost
# - 如果 MongoDB 在远端：设置 MONGO_URL 为你的真实连接串



mongo_url = os.getenv(
    'MONGO_URL',
    #  这是部署到云服务器上的mongodb地址
    # 'mongodb://jifbol:jifbol13579@127.0.0.1:27017/?authSource=admin&authMechanism=SCRAM-SHA-256'
    "mongodb://jifbol:jifbol13579@8.140.236.16:27017/?authSource=admin&authMechanism=SCRAM-SHA-256"
)
# MMO级优化：配置连接池参数，支持高并发
# 注意：maxPoolSize 应该 >= MAX_CONNECTIONS，确保每个连接都能获得数据库连接
# 500并发用户建议至少 200-300 连接池，留有余量
# 优化：增加超时时间，减少心跳频率，提高网络不稳定环境下的稳定性
client = MongoClient(
    mongo_url,
    maxPoolSize=300,  # 最大连接池大小（支持500并发用户，建议300+）
    minPoolSize=20,   # 最小连接池大小（提高初始连接数）
    maxIdleTimeMS=60000,  # 连接空闲时间（增加到60秒，减少连接回收频率）
    connectTimeoutMS=30000,  # 连接超时（增加到30秒，适应网络延迟）
    serverSelectionTimeoutMS=30000,  # 服务器选择超时（增加到30秒）
    socketTimeoutMS=60000,  # Socket超时（增加到60秒，适应网络不稳定）
    waitQueueTimeoutMS=30000,  # 等待队列超时（增加到30秒）
    heartbeatFrequencyMS=30000,  # 心跳频率（30秒一次，减少后台检查频率）
    retryWrites=True,  # 自动重试写入
    retryReads=True    # 自动重试读取
)
db = client['jjfb']  # 数据库名
users_col = db['users']  # 集合名
account_limits_col = db['account_limits']  # 账号限制（账号+IP）
players_col = db['players']
characters_col = db['characters']
connected_clients = set()
messages_col = db['messages']
robotbase_col = db['RobotBase']
robotpet_col = db['RobotPet']
inventory_col = db['inventory']
daletou_draws_col = db['daletou_draws']
minigame2_rounds_col = db['minigame2_rounds']
minigame2_bets_col = db['minigame2_bets']
user_clients = {}

try:
    daletou_draws_col.create_index('day', unique=True)
except Exception as _e:
    print(f'[daletou_draws] create_index: {_e}')

# MiniGame2 索引
try:
    minigame2_rounds_col.create_index('issue_key', unique=True)
except Exception as _e:
    print(f'[minigame2_rounds] create_index: {_e}')

try:
    # 每个角色在同一期只能下注一次
    # MiniGame2：允许同一期对多个类目下注，因此唯一键必须包含 selected_key
    minigame2_bets_col.create_index([('issue_key', 1), ('character_id', 1), ('selected_key', 1)], unique=True)
except Exception as _e:
    print(f'[minigame2_bets] create_index: {_e}')

try:
    # 让查询“某玩家今天的回报历史”时按 close_time 范围筛轮次更快
    minigame2_rounds_col.create_index('close_time', unique=False)
except Exception as _e:
    print(f'[minigame2_rounds] create_index(close_time): {_e}')

try:
    # 辅助：bets 查询时用 character_id 固定，issue_key 做 $in
    minigame2_bets_col.create_index([('character_id', 1), ('issue_key', 1)], unique=False)
except Exception as _e:
    print(f'[minigame2_bets] create_index(character_id, issue_key): {_e}')

# MongoDB操作包装函数（自动处理连接错误）
def safe_mongo_operation(operation, max_retries=3):
    """安全的MongoDB操作，自动重试连接错误"""
    for attempt in range(max_retries):
        try:
            return operation()
        except (AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout) as e:
            # 处理所有MongoDB连接相关错误，包括NetworkTimeout
            if attempt < max_retries - 1:
                delay = 1.0 * (attempt + 1)  # 递增延迟：1s, 2s, 3s
                try:
                    logger = get_logger()
                    logger.warning(f'[MongoDB] 连接错误，{delay}秒后重试 ({attempt + 1}/{max_retries}): {type(e).__name__}')
                except Exception:
                    print(f'⚠️ [MongoDB] 连接错误，{delay}秒后重试 ({attempt + 1}/{max_retries}): {type(e).__name__}')
                time.sleep(delay)
                continue
            else:
                try:
                    logger = get_logger()
                    logger.error(f'[MongoDB] 连接失败，已重试{max_retries}次: {type(e).__name__}: {e}')
                except Exception:
                    print(f'❌ [MongoDB] 连接失败，已重试{max_retries}次: {type(e).__name__}: {e}')
                raise
        except Exception as e:
            # 其他错误直接抛出
            raise

# MMO级优化：连接数限制和资源管理
MAX_CONNECTIONS = 500  # 最大连接数（可根据服务器配置调整）
current_connections = 0  # 当前连接数
connection_lock = asyncio.Lock()  # 连接数锁

# MMO级优化：线程池执行器（用于执行阻塞的数据库操作，避免阻塞事件循环）
# 参考 PomeloServer：使用线程池处理阻塞操作
db_executor = None  # 将在 main() 中初始化
DB_THREAD_POOL_SIZE = 50  # 数据库操作线程池大小

# MMO级优化：性能监控
performance_stats = {
    'total_requests': 0,
    'total_messages_sent': 0,
    'total_broadcasts': 0,
    'cache_hits': 0,
    'cache_misses': 0,
    'db_queries': 0,
    'start_time': time.time()
}

# MMO级优化：消息广播优化（异步批量发送）
async def broadcast_message_async(clients, message, max_concurrent=50):
    """
    MMO级优化：异步批量广播消息，避免阻塞
    max_concurrent: 最大并发发送数，避免同时发送过多导致资源耗尽
    """
    if not clients:
        return
    
    message_str = json.dumps(message) if isinstance(message, dict) else message
    clients_list = list(clients)
    
    # 性能统计
    performance_stats['total_broadcasts'] += len(clients_list)
    performance_stats['total_messages_sent'] += len(clients_list)
    
    # 分批发送，避免同时发送过多
    for i in range(0, len(clients_list), max_concurrent):
        batch = clients_list[i:i + max_concurrent]
        # 并发发送这一批
        tasks = [send_to_client_safe(ws, message_str) for ws in batch]
        await asyncio.gather(*tasks, return_exceptions=True)

async def send_to_client_safe(websocket, message):
    """安全发送消息到客户端（带异常处理）"""
    try:
        await websocket.send(message)
    except Exception:
        # 连接已断开，忽略错误
        pass

async def broadcast_to_all_async(message, max_concurrent=50):
    """MMO级优化：异步广播给所有连接"""
    await broadcast_message_async(connected_clients, message, max_concurrent)

async def broadcast_to_user_async(user_id, message, max_concurrent=10):
    """MMO级优化：异步广播给特定用户的所有连接"""
    user_ws_set = user_clients.get(str(user_id), set())
    if user_ws_set:
        await broadcast_message_async(user_ws_set, message, max_concurrent)

# 升级请求锁：防止同一机甲同时处理多个升级请求（防抖机制）
upgrade_request_locks = {}  # {pet_id: asyncio.Lock()}

# 列表请求去重：防止短时间内重复请求（防抖机制）
robot_pets_request_times = {}  # {websocket_id: last_request_time}
ROBOT_PETS_REQUEST_COOLDOWN = 0.1  # 100ms冷却时间

# 心跳机制配置
HEARTBEAT_INTERVAL = 30  # 30秒发送一次心跳
HEARTBEAT_TIMEOUT = 60  # 60秒无响应则断开连接
client_last_pong = {}  # {websocket_id: last_pong_time}
client_last_ping = {}  # {websocket_id: last_ping_time} - 用于计算 RTT
connection_quality = {}  # {websocket_id: {'rtt': [], 'packet_loss': 0, 'last_update': time}}

# 消息大小限制（防止过大消息）
MAX_MESSAGE_SIZE = 10 * 1024 * 1024  # 10MB

# 用户数据缓存（减少数据库查询）
user_cache = {}  # {user_id: {data: user_data, timestamp: time}}
CACHE_TTL = 60  # 缓存60秒

# 网游级优化：查询结果缓存（减少重复查询）
query_cache = {}  # {cache_key: {data: result, timestamp: time}}
QUERY_CACHE_TTL = 30  # 查询缓存30秒

# 网游级优化：消息队列（批量处理玩家操作）
# 注意：message_queue 需要在事件循环中创建，所以在 main() 函数中初始化
message_queue = None  # 将在 main() 中初始化
BATCH_PROCESS_INTERVAL = 0.1  # 100ms批量处理一次
BATCH_SIZE = 10  # 每批处理10条消息

# 网游级优化：防抖节流配置
# THROTTLE_CONFIG 和 throttle_timers 已移至 handlers/utils.py

# 确保索引存在
users_col.create_index('account', unique=True)
# 创建token索引，忽略null值
try:
    users_col.create_index('token', unique=True, sparse=True)
except Exception as e:
    print(f"创建token索引时出错: {e}")
    # 如果索引已存在但不是sparse的，尝试删除并重新创建
    try:
        users_col.drop_index('token_1')
        users_col.create_index('token', unique=True, sparse=True)
        print("成功重新创建token索引")
    except Exception as e2:
        print(f"重新创建token索引失败: {e2}")

try:
    players_col.drop_index('user_id_1')
except Exception:
    pass
players_col.delete_many({'character_id': None})
players_col.delete_many({'character_id': {'$exists': False}})
try:
    players_col.drop_index('character_id_1')
except Exception:
    pass
players_col.create_index('character_id', unique=True, name='character_id_partial', partialFilterExpression={'character_id': {'$exists': True}})
players_col.create_index([('user_id', 1), ('slot_index', 1)], unique=True)
# 网游级优化：为角色查询添加索引
try:
    players_col.create_index([('user_id', 1), ('slot_index', 1), ('character_id', 1)])
except Exception:
    pass
messages_col.create_index([('type', 1), ('created_at', -1)])
try:
    robotbase_col.create_index('RobotID', unique=True, sparse=True)
except Exception:
    pass
try:
    robotpet_col.create_index([('user_id', 1), ('character_id', 1)])
    # 网游级优化：为常用查询字段添加复合索引
    robotpet_col.create_index([('user_id', 1), ('character_id', 1), ('Level', 1)])
    # 关键优化：为 slot_index 添加索引，优化排序查询
    robotpet_col.create_index([('user_id', 1), ('character_id', 1), ('slot_index', 1)])
except Exception:
    pass
try:
    robotpet_col.create_index('robot_base_id')
except Exception:
    pass
try:
    inventory_col.create_index([('user_id', 1), ('character_id', 1)], unique=True)
except Exception:
    pass
try:
    players_col.create_index('friend_id', unique=True, sparse=True)
except Exception:
    pass
try:
    # 防恶意锁号：按账号+IP唯一记录登录/改密失败计数与锁定时间
    account_limits_col.create_index([('username', 1), ('ip', 1)], unique=True, name='username_ip_unique')
    account_limits_col.create_index('update_time')
except Exception:
    pass

# 计算指定用户在指定角色下的机甲数量
def compute_robot_count(user_id, character_id):
    try:
        if not user_id or not character_id:
            return 0
        return robotpet_col.count_documents({'user_id': user_id, 'character_id': character_id})
    except Exception:
        return 0

def register_client_user(ws, uid):
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
    try:
        for k in list(user_clients.keys()):
            s = user_clients.get(k)
            if s and ws in s:
                s.discard(ws)
    except Exception:
        pass

# 简单的加密函数（实际应用中应使用更安全的加密方式）
def encrypt(data):
    return hashlib.sha256((data + ENCRYPTION_KEY).encode()).hexdigest()

# 生成唯一token
def generate_unique_token(account, password):
    # 根据账号密码生成唯一token
    return encrypt(f"{account}:{password}:{uuid.uuid4()}")

# 生成唯一六位好友ID
def generate_friend_id():
    for _ in range(100):
        fid = f"{random.randint(0, 999999):06d}"
        if not players_col.find_one({'friend_id': fid}):
            return fid
    # 退化方案：基于时间戳取后六位
    return f"{int(datetime.datetime.utcnow().timestamp() * 1000) % 1000000:06d}"

# 1~60 级每级所需经验表（索引从 0 开始，对应等级 = index + 1）
# 注意：这是每级升级需要的经验，不是累计总经验
LEVEL_EXP_REQUIRED = [
    290,        # 1级需要290经验
    370,        # 2级需要370经验
    472,        # 3级需要472经验
    603,        # 4级需要603经验
    770,        # 5级需要770经验
    983,        # 6级需要983经验
    1256,       # 7级需要1256经验
    1604,       # 8级需要1604经验
    2048,       # 9级需要2048经验
    2614,       # 10级需要2614经验
    3338,       # 11级需要3338经验
    4262,       # 12级需要4262经验
    5442,       # 13级需要5442经验
    6948,       # 14级需要6948经验
    8872,       # 15级需要8872经验
    11328,      # 16级需要11328经验
    14463,      # 17级需要14463经验
    18466,      # 18级需要18466经验
    23577,      # 19级需要23577经验
    30103,      # 20级需要30103经验
    38436,      # 21级需要38436经验
    49074,      # 22级需要49074经验
    62657,      # 23级需要62657经验
    80000,      # 24级需要80000经验
    89608,      # 25级需要89608经验
    100371,     # 26级需要100371经验
    112427,     # 27级需要112427经验
    125931,     # 28级需要125931经验
    141057,     # 29级需要141057经验
    158000,     # 30级需要158000经验
    182364,     # 31级需要182364经验
    210485,     # 32级需要210485经验
    242942,     # 33级需要242942经验
    280404,     # 34级需要280404经验
    323644,     # 35级需要323644经验
    373550,     # 36级需要373550经验
    431153,     # 37级需要431153经验
    497638,     # 38级需要497638经验
    574375,     # 39级需要574375经验
    662945,     # 40级需要662945经验
    765174,     # 41级需要765174经验
    883165,     # 42级需要883165经验
    1019352,    # 43级需要1019352经验
    1176539,    # 44级需要1176539经验
    1357965,    # 45级需要1357965经验
    1567367,    # 46级需要1567367经验
    1809059,    # 47级需要1809059经验
    2088021,    # 48级需要2088021经验
    2410000,    # 49级需要2410000经验
    2580000,    # 50级需要2580000经验
    4696700,    # 51级需要4696700经验
    8550000,    # 52级需要8550000经验
    12220000,   # 53级需要12220000经验
    15890000,   # 54级需要15890000经验
    19560000,   # 55级需要19560000经验
    19877424,   # 56级需要19877424经验
    20200000,   # 57级需要20200000经验
    20448471,   # 58级需要20448471经验
    20700000,   # 59级需要20700000经验
    20950000,   # 60级需要20950000经验
]

# 为了兼容旧代码，保留 LEVEL_TOTAL_EXP 名称（但实际是每级所需经验）
LEVEL_TOTAL_EXP = LEVEL_EXP_REQUIRED

MAX_LEVEL = 60

def get_exp_required_for_level(level):
    """获取指定等级升级需要的经验（level 从 1 开始）"""
    if level < 1:
        return 0
    if level > MAX_LEVEL:
        return LEVEL_EXP_REQUIRED[-1]
    return LEVEL_EXP_REQUIRED[level - 1]

def get_total_exp_for_level(level):
    """获取指定等级的累计总经验（level 从 1 开始）
    通过累加前面所有等级的经验来计算累计总经验
    """
    if level < 1:
        return 0
    if level > MAX_LEVEL:
        # 如果超过最大等级，返回所有等级的经验总和
        return sum(LEVEL_EXP_REQUIRED)
    
    # 累加从1级到指定等级的所有经验
    total = 0
    for lvl in range(1, level + 1):
        total += LEVEL_EXP_REQUIRED[lvl - 1]
    return total

def calculate_level_from_exp(total_exp):
    """根据累计总经验计算等级（服务器权威计算）
    通过累加每级经验来判断总经验对应的等级
    """
    new_level = 1
    accumulated_exp = 0
    
    for lvl in range(1, MAX_LEVEL + 1):
        exp_required = LEVEL_EXP_REQUIRED[lvl - 1]
        accumulated_exp += exp_required
        
        if total_exp >= accumulated_exp:
            new_level = lvl
        else:
            break
    
    return min(new_level, MAX_LEVEL)

def add_exp_to_player(player, exp_amount):
    """给玩家增加经验并计算升级（服务器权威）"""
    current_exp = player.get('exp', 0)
    current_level = player.get('level', 1)
    
    # 如果已经满级，不增加经验
    if current_level >= MAX_LEVEL:
        return current_level, current_exp, 0
    
    # 增加经验
    new_exp = current_exp + exp_amount
    # 根据新经验计算等级
    new_level = calculate_level_from_exp(new_exp)
    level_up_count = new_level - current_level
    
    return new_level, new_exp, level_up_count

def create_robot_pet(user_id, character_id, base_robot):
    """创建单个机甲宠物（辅助函数）
    完整复制RobotBase的所有字段，确保不遗漏任何数据
    """
    robot_base_id = str(base_robot.get('_id'))
    
    # 初始化星级、成长值和悟性值
    # 参考 RPG Maker 机制：初始星级为1星
    star_level = 1
    
    # 为每个机甲生成一个独特的成长值（5到15之间的随机值）
    unique_growth_value = random.uniform(5, 15)
    
    # 随机选择是否使用指定的数据组（5%概率使用特殊数据组，95%使用随机值）
    use_special_values = random.random() < 0.05
    
    if use_special_values:
        # 按概率选择特定的数据组
        special_case = random.random()
        if special_case < 0.35:
            # 35%的概率使用(100, 100)的组合
            growth = 100
            comprehension = 100
        elif special_case < 0.65:
            # 30%的概率使用(80, 100)的组合
            growth = 80
            comprehension = 100
        elif special_case < 0.75:
            # 10%的概率使用(60, 80)的组合
            growth = 60
            comprehension = 80
        else:
            # 25%的概率使用(100, 80)的组合
            growth = 100
            comprehension = 80
    else:
        # 95%的概率使用随机值（50-100）
        growth = random.randint(50, 100)
        comprehension = random.randint(50, 100)
    
    # 第一步：复制RobotBase的所有字段（排除_id，其他字段直接复制，包括Form）
    robot_pet = {}
    for key, value in base_robot.items():
        if key == '_id':
            continue  # 跳过_id字段
        else:
            # 直接复制所有其他字段，包括Form、字符串、数字、Current前缀字段等
            robot_pet[key] = value
    
    # 第二步：覆盖或设置特定的字段
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
    
    # 第三步：确保CurrentHP和CurrentMP使用MaxHP和MaxMP的值（如果是新创建的）
    if 'CurrentHP' not in robot_pet or robot_pet.get('CurrentHP') is None:
        robot_pet['CurrentHP'] = robot_pet.get('MaxHP', robot_pet.get('HP', 1000))
    if 'CurrentMP' not in robot_pet or robot_pet.get('CurrentMP') is None:
        robot_pet['CurrentMP'] = robot_pet.get('MaxMP', robot_pet.get('MP', 300))
    
    # 第四步：确保所有Current前缀的字段都有值（如果没有则使用基础值）
    current_field_mappings = {
        'CurrentMelee': 'Melee',
        'CurrentArmor': 'Armor',
        'CurrentAccuracy': 'Accuracy',
        'CurrentCorrosion': 'Corrosion',
        'CurrentInitiative': 'Initiative',
        'CurrentBlock': 'Block',
        'CurrentParticleShield': 'ParticleShield',
        'CurrentArmorPenetration': 'ArmorPenetration',
        'CurrentShooting': 'Shooting',
        'CurrentEvasion': 'Evasion',
        'CurrentLethality': 'Lethality',
        'CurrentResistance': 'Resistance',
        'CurrentCounterattack': 'Counterattack'
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
        slot_index = handler_utils.allocate_slot_index(user_id, character_id)
        if slot_index is not None:
            robot_pet['slot_index'] = slot_index
            print(f'✅ [create_robot_pet] 机甲 {robot_pet.get("RobotName", "")} 分配编号: {slot_index}')
        else:
            print(f'⚠️ [create_robot_pet] 机甲 {robot_pet.get("RobotName", "")} 编号已满（1-10），无法分配编号')
    
    robotpet_col.insert_one(robot_pet)
    return robot_pet

async def handle_client(websocket):
    # MMO级优化：快速检查连接数限制（减少阻塞）
    global current_connections  # 必须在函数开始处声明
    
    # 快速检查，避免长时间持有锁
    async with connection_lock:
        if current_connections >= MAX_CONNECTIONS:
            # 连接数已达上限，快速拒绝
            try:
                await websocket.close(code=1008, reason='Server at capacity')
            except Exception:
                pass
            return
        current_connections += 1
    
    # 减少日志输出（仅在调试模式或连接数较少时）
    # logger = get_logger()
    # logger.info('客户端已连接', connections=f'{current_connections}/{MAX_CONNECTIONS}')
    current_user_id = None
    current_character_id = None
    connected_clients.add(websocket)
    websocket_id = id(websocket)
    client_last_pong[websocket_id] = time.time()
    
    # 启动心跳任务
    heartbeat_task = asyncio.create_task(heartbeat_loop(websocket, websocket_id))
    
    try:
        async for message in websocket:
            # 性能优化：减少日志输出（仅在调试模式）
            # print('收到消息:', message)
            try:
                # 检查消息大小
                if len(message) > MAX_MESSAGE_SIZE:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': f'消息过大，最大允许 {MAX_MESSAGE_SIZE / 1024 / 1024}MB'
                    }))
                    continue
                
                data = json.loads(message)
                route = data.get('type')
                
                # 支持路由压缩：优先检查 route_id（新格式），其次检查 type（旧格式，向后兼容）
                if 'route_id' in data:
                    # 新格式：使用数字路由
                    from services.dictionary_service import dictionary_service
                    route_id = data.get('route_id')
                    route = dictionary_service.decode_route(route_id)
                    if not route:
                        logger = get_logger()
                        logger.warning('收到未知的route_id', route_id=route_id, data=data)
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'success': False,
                            'message': f'Unknown route_id: {route_id}',
                            'request_id': data.get('request_id')
                        }))
                        continue
                    # 将解码后的路由放入 data，后续处理使用 type 字段
                    data['type'] = route
                    logger = get_logger()
                    logger.debug('路由压缩解码', route_id=route_id, route=route)
                elif 'type' in data:
                    # 旧格式：使用字符串路由（向后兼容）
                    route = data.get('type')
                else:
                    # 无路由字段
                    logger = get_logger()
                    logger.warning('收到无路由字段的消息', data=data)
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'success': False,
                        'message': 'Missing route field (type or route_id)',
                        'request_id': data.get('request_id')
                    }))
                    continue
                
                # 验证route是否存在
                if not route:
                    logger = get_logger()
                    logger.warning('收到无type字段的消息', data=data)
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'success': False,
                        'message': '消息缺少type字段'
                    }))
                    continue
                
                # 处理心跳响应（特殊处理，不需要路由系统）
                if route == 'pong':
                    current_time = time.time()
                    client_last_pong[websocket_id] = current_time
                    
                    # 记录 RTT（往返时延）- 连接质量监控
                    if websocket_id in client_last_ping:
                        rtt = current_time - client_last_ping[websocket_id]
                        if websocket_id not in connection_quality:
                            connection_quality[websocket_id] = {'rtt': [], 'packet_loss': 0, 'last_update': current_time}
                        connection_quality[websocket_id]['rtt'].append(rtt)
                        # 只保留最近 10 次 RTT
                        if len(connection_quality[websocket_id]['rtt']) > 10:
                            connection_quality[websocket_id]['rtt'].pop(0)
                        connection_quality[websocket_id]['last_update'] = current_time
                        # 清除 ping 时间戳
                        client_last_ping.pop(websocket_id, None)
                    continue
                
                # 使用路由系统处理消息 - 参考 Pomelo 设计
                from router import handle_route
                from middleware import middleware_manager, MiddlewareContext
                
                # 创建中间件上下文
                context = MiddlewareContext(
                    websocket=websocket,
                    data=data,
                    current_user_id=current_user_id,
                    current_character_id=current_character_id,
                    route=route
                )
                
                # 定义处理器（包装路由处理）
                async def route_handler(ctx: MiddlewareContext):
                    nonlocal current_user_id, current_character_id
                    # 关键修复：使用中间件更新后的认证状态（支持测试模式自动认证）
                    # 中间件可能已经通过 user_id 自动设置了认证状态
                    if ctx.current_user_id and ctx.current_user_id != current_user_id:
                        current_user_id = ctx.current_user_id
                    if ctx.current_character_id and ctx.current_character_id != current_character_id:
                        current_character_id = ctx.current_character_id

                    # 注意：频道加入逻辑已移至 Session 创建时（session_service.create_session）
                    # 这样可以确保所有已认证用户都会自动加入全局聊天频道
                    
                    # 调用路由处理器
                    new_user_id, new_character_id = await handle_route(
                        ctx.route,
                        ctx.websocket,
                        ctx.data,
                        ctx.current_user_id,  # 使用中间件更新后的状态
                        ctx.current_character_id
                    )
                    return new_user_id, new_character_id
                
                # 执行中间件链和路由处理（保持异步，但等待完成以更新状态）
                try:
                    result = await middleware_manager.execute(context, route_handler)
                    
                    # 关键修复：优先使用中间件更新后的认证状态（支持测试模式自动认证）
                    # 中间件可能已经通过 user_id 自动设置了认证状态
                    if context.current_user_id and context.current_user_id != current_user_id:
                        logger = get_logger()
                        logger.debug('中间件自动认证', old_user_id=str(current_user_id), new_user_id=str(context.current_user_id))
                        current_user_id = context.current_user_id
                    if context.current_character_id and context.current_character_id != current_character_id:
                        logger = get_logger()
                        logger.debug('中间件自动设置角色', old_character_id=str(current_character_id), new_character_id=str(context.current_character_id))
                        current_character_id = context.current_character_id
                    
                    # 然后使用路由处理器返回的状态（如果有）
                    if result:
                        new_user_id, new_character_id = result
                        if new_user_id != current_user_id or new_character_id != current_character_id:
                            logger = get_logger()
                            logger.debug('路由更新状态', old_user_id=str(current_user_id), new_user_id=str(new_user_id),
                                       old_character_id=str(current_character_id), new_character_id=str(new_character_id))

                            current_user_id = new_user_id
                            current_character_id = new_character_id
                            
                            # 更新 Session（仅管理会话，不再在这里处理频道）
                            if current_user_id:
                                session = session_service.get_session(current_user_id)
                                if not session:
                                    # 检查是否为测试模式（通过 user_id 直接验证）
                                    is_test_mode = context.metadata.get('is_test_mode', False)
                                    session_service.create_session(current_user_id, websocket, current_character_id, is_test_mode=is_test_mode)
                                else:
                                    if current_character_id:
                                        session_service.update_character(current_user_id, current_character_id)
                                    session.update_active()
                except Exception as e:
                    # 中间件或路由处理出错
                    logger = get_logger()
                    logger.error('处理路由时出错', route=route, error=str(e))
                    import traceback
                    traceback.print_exc()
                    # 发送错误响应
                    try:
                        await websocket.send(json.dumps({
                            'type': f'{route}_response',
                            'success': False,
                            'code': 500,
                            'message': f'服务器错误: {str(e)}'
                        }))
                    except Exception:
                        pass  # 忽略发送错误
            except Exception as e:
                logger = get_logger()
                logger.error('解析消息错误', error=str(e))
    except websockets.exceptions.ConnectionClosed:
        # 减少日志输出（正常断开不需要记录）
        pass
    except Exception as e:
        # 只记录严重错误
        logger = get_logger()
        if 'ConnectionClosed' not in str(type(e).__name__):
            logger.error('WebSocket错误', error=str(e), websocket_id=websocket_id)
    finally:
        # 取消心跳任务
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        
        # 清理 Session（必须在清理连接数之前）
        try:
            # 在移除 Session 之前，先从全局频道移除（Channel/Room 系统）
            try:
                if current_user_id:
                    channel_service.leave('global_chat', current_user_id, websocket)
            except Exception:
                # 频道移除失败不影响主流程
                pass

            try:
                await world_presence_service.leave_websocket(websocket)
            except Exception:
                pass
            session_service.remove_session(websocket)
            
            # 清理推送调度器的消息队列
            try:
                from services.push_scheduler import push_scheduler
                user_id = session_service.websocket_to_user.get(id(websocket))
                if user_id:
                    push_scheduler.on_session_close(str(user_id))
                    # 清理任务队列
                    try:
                        from services.task_manager import task_manager
                        task_manager.close_queue(str(user_id), force=True)
                    except Exception:
                        pass  # 忽略任务队列清理错误
            except Exception:
                pass  # 忽略清理错误
        except Exception:
            pass
        
        # 清理连接相关数据（已在函数开始处声明global）
        async with connection_lock:
            if current_connections > 0:
                current_connections -= 1
        
        try:
            connected_clients.discard(websocket)
        except Exception:
            pass
        try:
            unregister_client(websocket)
        except Exception:
            pass
        try:
            client_last_pong.pop(websocket_id, None)
        except Exception:
            pass
        try:
            client_last_ping.pop(websocket_id, None)
        except Exception:
            pass
        try:
            connection_quality.pop(websocket_id, None)
        except Exception:
            pass
        
        # 减少日志输出（仅在调试模式）
        # logger = get_logger()
        # logger.info('客户端已断开', connections=f'{current_connections}/{MAX_CONNECTIONS}')

async def heartbeat_loop(websocket, websocket_id):
    """心跳循环：定期发送ping并检查连接状态"""
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            
            # 检查是否超时
            last_pong = client_last_pong.get(websocket_id, time.time())
            if time.time() - last_pong > HEARTBEAT_TIMEOUT:
                logger = get_logger()
                logger.warning('客户端心跳超时，断开连接', websocket_id=websocket_id)
                try:
                    await websocket.close()
                except Exception:
                    pass
                break
            
            # 发送ping（记录时间戳用于计算 RTT）
            try:
                client_last_ping[websocket_id] = time.time()
                await websocket.send(json.dumps({'type': 'ping'}))
            except Exception as e:
                logger = get_logger()
                logger.error('发送心跳失败', error=str(e), websocket_id=websocket_id)
                # 如果发送失败，清除 ping 时间戳
                client_last_ping.pop(websocket_id, None)
                break
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f'心跳循环异常: {e}')

def get_cached_user(user_id):
    """获取缓存的用户数据"""
    cache_entry = user_cache.get(user_id)
    if cache_entry and time.time() - cache_entry['timestamp'] < CACHE_TTL:
        performance_stats['cache_hits'] += 1
        return cache_entry['data']
    performance_stats['cache_misses'] += 1
    return None

def set_cached_user(user_id, user_data):
    """设置用户数据缓存"""
    user_cache[user_id] = {
        'data': user_data,
        'timestamp': time.time()
    }

def get_user_by_token(token):
    """通过token获取用户（带缓存）"""
    if not token:
        return None
    # 先查缓存
    cached = get_cached_user(token)
    if cached:
        return cached
    # 查数据库
    performance_stats['db_queries'] += 1
    user = users_col.find_one({'token': token})
    if user:
        set_cached_user(token, user)
    return user

def check_and_free_port(port):
    """检查端口是否被占用，如果被占用则尝试关闭占用进程"""
    try:
        # 检查端口是否被占用
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        
        if result == 0:  # 端口被占用
            print(f'[警告] 端口 {port} 已被占用，正在尝试释放...')
            try:
                # Windows 系统：查找占用端口的进程并关闭
                if sys.platform == 'win32':
                    # 使用 netstat 查找占用端口的进程
                    result = subprocess.run(
                        ['netstat', '-ano'],
                        capture_output=True,
                        text=True,
                        encoding='gbk'
                    )
                    for line in result.stdout.split('\n'):
                        if f':{port}' in line and 'LISTENING' in line:
                            parts = line.split()
                            if len(parts) >= 5:
                                pid = parts[-1]
                                try:
                                    # 关闭占用端口的进程
                                    subprocess.run(
                                        ['taskkill', '/F', '/PID', pid],
                                        capture_output=True,
                                        check=False
                                    )
                                    print(f'[成功] 已关闭占用端口 {port} 的进程 (PID: {pid})')
                                    import time
                                    time.sleep(1)  # 等待端口释放
                                    return True
                                except Exception as e:
                                    print(f'[错误] 无法关闭进程 {pid}: {e}')
                                    return False
                else:
                    # Linux/Mac 系统
                    result = subprocess.run(
                        ['lsof', '-ti', f':{port}'],
                        capture_output=True,
                        text=True
                    )
                    if result.returncode == 0:
                        pid = result.stdout.strip()
                        subprocess.run(['kill', '-9', pid], check=False)
                        print(f'[成功] 已关闭占用端口 {port} 的进程 (PID: {pid})')
                        import time
                        time.sleep(1)
                        return True
            except Exception as e:
                print(f'[错误] 释放端口失败: {e}')
                return False
        return True
    except Exception as e:
        print(f'[警告] 检查端口时出错: {e}')
        return True  # 出错时继续尝试启动

async def batch_message_processor():
    """网游级优化：批量处理消息队列"""
    global message_queue
    
    # 等待队列初始化
    while message_queue is None:
        await asyncio.sleep(0.1)
    
    while True:
        try:
            batch = []
            # 收集一批消息
            while len(batch) < BATCH_SIZE:
                try:
                    message = await asyncio.wait_for(message_queue.get(), timeout=BATCH_PROCESS_INTERVAL)
                    batch.append(message)
                except asyncio.TimeoutError:
                    break
            
            if batch:
                # 批量处理消息（可以合并相同类型的操作）
                # 例如：多个升级请求可以合并为一个批量升级
                await process_batch_messages(batch)
        except asyncio.CancelledError:
            break
        except Exception as e:
            # 减少错误日志输出（避免刷屏）
            if 'different loop' not in str(e):
                print(f'批量消息处理错误: {e}')
            await asyncio.sleep(1)  # 出错后等待1秒再继续

async def process_batch_messages(batch):
    """处理批量消息（网游级优化：合并相同操作）"""
    # 按类型分组
    grouped = {}
    for msg in batch:
        msg_type = msg.get('type')
        if msg_type not in grouped:
            grouped[msg_type] = []
        grouped[msg_type].append(msg)
    
    # 批量处理相同类型的消息
    for msg_type, messages in grouped.items():
        if msg_type == 'upgrade_robot':
            # 可以合并多个升级请求
            await process_batch_upgrades(messages)
        # 其他类型可以类似处理

async def process_batch_upgrades(messages):
    """批量处理升级请求（网游级优化）"""
    # 这里可以实现批量升级逻辑
    # 暂时保持原有逻辑，但可以优化为批量数据库操作
    pass

def get_cached_query(cache_key):
    """获取缓存的查询结果"""
    cache_entry = query_cache.get(cache_key)
    if cache_entry and time.time() - cache_entry['timestamp'] < QUERY_CACHE_TTL:
        performance_stats['cache_hits'] += 1
        return cache_entry['data']
    performance_stats['cache_misses'] += 1
    return None

def set_cached_query(cache_key, result):
    """设置查询结果缓存"""
    query_cache[cache_key] = {
        'data': result,
        'timestamp': time.time()
    }

async def main():
    # 初始化日志服务
    init_logger(log_dir='logs', level=logging.INFO)
    logger = get_logger()
    logger.info('=' * 60)
    logger.info('🎮 MMO游戏服务器启动')
    logger.info('=' * 60)
    
    # 检查并释放端口
    if not check_and_free_port(WS_PORT):
        logger.error(f'无法释放端口 {WS_PORT}，请手动关闭占用该端口的进程')
        logger.info(f'可以使用命令: netstat -ano | findstr :{WS_PORT}')
        return
    
    # 启动缓存清理任务（定期清理过期缓存）
    async def cache_cleanup_task():
        while True:
            await asyncio.sleep(300)  # 每5分钟清理一次
            current_time = time.time()
            
            # 清理用户缓存
            expired_keys = [
                key for key, value in user_cache.items()
                if current_time - value['timestamp'] > CACHE_TTL
            ]
            for key in expired_keys:
                user_cache.pop(key, None)
            
            # 清理查询缓存
            expired_query_keys = [
                key for key, value in query_cache.items()
                if current_time - value['timestamp'] > QUERY_CACHE_TTL
            ]
            for key in expired_query_keys:
                query_cache.pop(key, None)
            
            # 清理节流计时器（清理超过1分钟未使用的）
            expired_throttles = []
            throttle_timers = handler_utils.get_throttle_timers()
            for ws_id, timers in list(throttle_timers.items()):
                if all(current_time - last_time > 60 for last_time in timers.values()):
                    expired_throttles.append(ws_id)
            for ws_id in expired_throttles:
                throttle_timers.pop(ws_id, None)
            
            if expired_keys or expired_query_keys or expired_throttles:
                print(f'清理缓存: 用户缓存 {len(expired_keys)} 个, 查询缓存 {len(expired_query_keys)} 个, 节流计时器 {len(expired_throttles)} 个')
    
    # 启动Session过期清理任务（定期清理过期Session）
    async def session_cleanup_task():
        while True:
            await asyncio.sleep(300)  # 每5分钟清理一次
            try:
                from services.session_service import session_service
                expired_count = session_service.cleanup_expired_sessions()
                if expired_count > 0:
                    logger.info('清理过期Session', expired_count=expired_count)
            except Exception as e:
                logger.error('Session清理任务错误', error=str(e))
            
            # MMO级优化：定期输出性能统计
            uptime = time.time() - performance_stats['start_time']
            if uptime > 0:
                print(f'📊 性能统计 (运行 {int(uptime)}秒):')
                print(f'  当前连接数: {current_connections}/{MAX_CONNECTIONS}')
                print(f'  总请求数: {performance_stats["total_requests"]}')
                print(f'  总消息数: {performance_stats["total_messages_sent"]}')
                print(f'  总广播数: {performance_stats["total_broadcasts"]}')
                print(f'  缓存命中: {performance_stats["cache_hits"]}, 未命中: {performance_stats["cache_misses"]}')
                if performance_stats['cache_hits'] + performance_stats['cache_misses'] > 0:
                    hit_rate = performance_stats['cache_hits'] / (performance_stats['cache_hits'] + performance_stats['cache_misses']) * 100
                    print(f'  缓存命中率: {hit_rate:.1f}%')
                print(f'  数据库查询: {performance_stats["db_queries"]}')
                print(f'  平均QPS: {performance_stats["total_requests"] / uptime:.1f} 请求/秒')
    
    # 初始化消息队列（必须在事件循环中创建）
    global message_queue, db_executor
    message_queue = asyncio.Queue()
    
    # 初始化数据库操作线程池（MMO级优化：避免阻塞事件循环）
    db_executor = ThreadPoolExecutor(max_workers=DB_THREAD_POOL_SIZE, thread_name_prefix="db_worker")
    logger.info(f'✅ 已启用数据库操作线程池（{DB_THREAD_POOL_SIZE} 个工作线程）')
    
    # 初始化推送调度器（高优先级优化）
    from services.push_scheduler import push_scheduler
    push_scheduler.start()
    logger.info('✅ 已启用消息推送调度器（Buffer Scheduler）')
    
    # 初始化幂等性服务（高优先级优化）
    from services.idempotency_service import idempotency_service
    logger.info('✅ 已启用幂等性服务（Idempotency Service）')
    
    # 启动幂等性服务清理任务（定期清理过期请求ID）
    async def idempotency_cleanup_task():
        while True:
            await asyncio.sleep(60)  # 每分钟清理一次
            idempotency_service.clear_expired()
    
    asyncio.create_task(idempotency_cleanup_task())
    
    # 初始化Token服务（高优先级优化）
    from services.token_service import token_service
    logger.info('✅ 已启用Token服务（Token Service）- 支持刷新和撤销')
    
    # 启动Token服务清理任务（定期清理过期撤销Token）
    async def token_cleanup_task():
        while True:
            await asyncio.sleep(300)  # 每5分钟清理一次
            token_service.clear_expired_revoked_tokens()
    
    asyncio.create_task(token_cleanup_task())
    
    # 初始化handlers模块
    handler_utils.init_utils(
        users_col, account_limits_col, players_col, characters_col, messages_col,
        robotbase_col, robotpet_col, inventory_col, user_clients,
        performance_stats, user_cache, ENCRYPTION_KEY,
        query_cache, LEVEL_TOTAL_EXP
    )
    from services.daletou_service import init_daletou_service
    init_daletou_service(daletou_draws_col)
    from services.minigame2_service import init_minigame2_service
    init_minigame2_service(minigame2_rounds_col, minigame2_bets_col, players_col)
    character_handler.init_character_handler(create_robot_pet, broadcast_to_user_async)
    admin_handler.init_admin_handler(
        add_exp_to_player, broadcast_to_user_async,
        connected_clients, current_connections, MAX_CONNECTIONS, performance_stats,
        create_robot_pet_func=create_robot_pet
    )
    robot_handler.init_robot_handler(create_robot_pet, upgrade_request_locks, broadcast_to_user_async)
    chat_handler.init_chat_handler(broadcast_to_all_async)
    bag_handler.init_bag_handler(broadcast_to_user_async)
    
    # 初始化背包缓存服务（可选优化，根据实际需求启用）
    try:
        from services.bag_cache_service import init_bag_cache
        # 参数：max_size=500（最大缓存500个背包），ttl=300（5分钟过期），enable=True（启用）
        init_bag_cache(max_size=500, ttl=300.0, enable=True)
        logger.info('✅ 已启用背包缓存服务（最大500个，TTL 300秒）')
    except Exception as e:
        logger.warning(f'初始化背包缓存服务失败: {e}（继续运行，但不使用缓存）')
    
    # 保存路由字典文件（用于客户端同步）
    try:
        from services.dictionary_service import dictionary_service
        dict_file = Path(__file__).parent / 'data' / 'route_dictionary.json'
        dictionary_service.save_to_file(str(dict_file))
        logger.info(f'✅ 路由字典已保存: {dict_file}')
    except Exception as e:
        logger.warning(f'保存路由字典失败: {e}')
    
    # 启动后台任务
    asyncio.create_task(cache_cleanup_task())
    asyncio.create_task(session_cleanup_task())
    asyncio.create_task(batch_message_processor())
    
    logger.info(f'WebSocket服务器运行在 ws://localhost:{WS_PORT}')
    logger.info(f'最大连接数: {MAX_CONNECTIONS} (支持 {MAX_CONNECTIONS} 人同时在线)')
    logger.info(f'MongoDB连接池: 最大 {client.max_pool_size}, 最小 {client.min_pool_size}')
    logger.info(f'心跳间隔: {HEARTBEAT_INTERVAL}秒, 超时: {HEARTBEAT_TIMEOUT}秒')
    logger.info(f'消息大小限制: {MAX_MESSAGE_SIZE / 1024 / 1024}MB')
    logger.info(f'用户缓存TTL: {CACHE_TTL}秒')
    logger.info(f'查询缓存TTL: {QUERY_CACHE_TTL}秒')
    logger.info(f'批量处理间隔: {BATCH_PROCESS_INTERVAL}秒, 批量大小: {BATCH_SIZE}')
    logger.info(f'广播并发数: 全局50, 用户10 (避免阻塞)')
    logger.info('✅ 已启用消息压缩（deflate）')
    logger.info('✅ 已启用异步消息广播（不阻塞主线程）')
    logger.info('✅ 已启用连接池和资源管理')
    logger.info('✅ 已启用性能监控和统计')
    logger.info('✅ 已启用 Session 管理服务')
    logger.info('✅ 已启用结构化日志服务')
    logger.info('=' * 60)
    logger.info('💡 提示: 服务器已优化支持100+人同时在线')
    logger.info('=' * 60)
    
    def start_console_server():
        base_dir = os.path.dirname(__file__)
        static_dir = os.path.join(base_dir, 'static')  # server/static
        data_dir = os.path.join(base_dir, 'data')  # server/data
        
        # 自定义处理器，支持从 static 目录提供 HTML 文件，从 data 目录提供 JSON 文件
        class ConsoleHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=base_dir, **kwargs)

            def do_GET(self):
                # 战斗房间监控 API：返回当前所有战斗房间的实时数据（供 battle-rooms.html 轮询）
                if self.path.startswith('/api/battle-rooms') or self.path == '/api/battle-rooms':
                    try:
                        from services.battle_room_service import battle_room_service
                        rooms = battle_room_service.get_all_rooms()
                    except Exception as e:
                        rooms = []
                        try:
                            get_logger().warning('api/battle-rooms 获取房间列表失败: %s', e)
                        except Exception:
                            pass
                    def _json_default(o):
                        if hasattr(o, 'isoformat'):
                            return o.isoformat()
                        if isinstance(o, ObjectId):
                            return str(o)
                        raise TypeError('Object of type %s is not JSON serializable' % type(o).__name__)
                    body = json.dumps(rooms, ensure_ascii=False, default=_json_default).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Content-Length', len(body))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                super().do_GET()

            def do_OPTIONS(self):
                self.send_response(204)
                self.end_headers()

            def _send_json(self, code: int, obj: dict):
                body = json.dumps(obj, ensure_ascii=False, default=str).encode('utf-8')
                self.send_response(code)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                if self.path.startswith('/api/daletou'):
                    try:
                        length = int(self.headers.get('Content-Length', 0))
                        raw = self.rfile.read(length).decode('utf-8')
                        data = json.loads(raw) if raw else {}
                    except Exception as e:
                        self._send_json(400, {'success': False, 'message': str(e)})
                        return
                    action = data.get('action', '')
                    try:
                        from services import daletou_service as ds
                        pc = handler_utils.players_col
                        if action == 'list':
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            items = ds.admin_list_participants(pc, day)
                            self._send_json(200, {
                                'success': True,
                                'day': day,
                                'issue': ds.issue_key_from_day(day),
                                'participants': items,
                            })
                        elif action == 'list_players':
                            lim = int(data.get('limit', 500))
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            only_day = bool(
                                data.get('only_this_day')
                                or data.get('only_this_issue')
                                or data.get('filter_by_issue')
                            )
                            fd = day if only_day else None
                            players = ds.admin_list_all_players(pc, lim, for_day=fd)
                            self._send_json(200, {
                                'success': True,
                                'day': day,
                                'issue': ds.issue_key_from_day(day),
                                'only_this_day': bool(fd),
                                'players': players,
                                'count': len(players),
                            })
                        elif action == 'set_online':
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            ok = ds.admin_set_online_seconds(
                                pc,
                                str(data.get('character_id', '')),
                                day,
                                int(data.get('online_seconds', 0)),
                            )
                            self._send_json(200, {
                                'success': ok,
                                'day': day,
                                'issue': ds.issue_key_from_day(day),
                            })
                        elif action == 'draw':
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            immediate = bool(data.get('immediate', True))
                            winner_character_id = data.get('winner_character_id') or data.get('winnerCid') or data.get('winner_cid')
                            doc = ds.admin_run_draw(pc, day, immediate, winner_character_id=winner_character_id)
                            status = ds.admin_draw_status(pc, day)
                            self._send_json(200, {
                                'success': True,
                                'day': day,
                                'issue': ds.issue_key_from_day(day),
                                'draw': doc,
                                'status': status,
                            })
                        elif action == 'meta':
                            qday = data.get('day') or data.get('issue') or data.get('issue_num') or data.get('period')
                            meta_day = ds.normalize_to_day_key(qday) if qday else None
                            meta = ds.admin_meta(pc, meta_day)
                            self._send_json(200, {'success': True, **meta})
                        elif action == 'list_draws':
                            lim = int(data.get('limit', 20))
                            draws = ds.admin_list_recent_draws(lim)
                            self._send_json(200, {'success': True, 'draws': draws})
                        elif action == 'set_claimed':
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            ok = ds.admin_set_claimed(
                                pc,
                                str(data.get('character_id', '')),
                                day,
                                bool(data.get('claimed', True)),
                            )
                            self._send_json(200, {
                                'success': ok,
                                'day': day,
                                'issue': ds.issue_key_from_day(day),
                            })
                        elif action == 'reset_draw':
                            day = ds.resolve_admin_day_from_request(data, ds.today_key())
                            r = ds.admin_delete_draw_record(day)
                            self._send_json(200, {'success': True, 'day': day, 'issue': ds.issue_key_from_day(day), **r})
                        else:
                            self._send_json(400, {'success': False, 'message': 'unknown action'})
                    except Exception as e:
                        try:
                            get_logger().error('api/daletou POST failed: %s', e)
                        except Exception:
                            pass
                        self._send_json(500, {'success': False, 'message': str(e)})
                    return
                self.send_error(404, 'Not Found')

            def translate_path(self, path):
                # 规范化路径：移除开头的斜杠和查询参数
                clean_path = path.split('?')[0].split('#')[0]
                clean_path = clean_path.lstrip('/')
                
                # 处理静态文件请求
                # 根路径重定向到 index.html
                if path == '/' or path == '' or clean_path == '':
                    return os.path.join(static_dir, 'index.html')
                elif clean_path == 'index.html' or path.startswith('/index.html'):
                    return os.path.join(static_dir, 'index.html')
                elif clean_path == 'console.html' or path.startswith('/console.html'):
                    # 兼容旧链接，重定向到 index.html
                    return os.path.join(static_dir, 'index.html')
                elif clean_path == 'admin-client.html' or path.startswith('/admin-client.html'):
                    # 兼容旧链接，重定向到 client-simulator.html
                    return os.path.join(static_dir, 'client-simulator.html')
                elif clean_path == 'client-simulator.html' or path.startswith('/client-simulator.html'):
                    return os.path.join(static_dir, 'client-simulator.html')
                elif clean_path == 'game-control.html' or path.startswith('/game-control.html'):
                    return os.path.join(static_dir, 'game-control.html')
                elif clean_path == 'server-control.html' or path.startswith('/server-control.html'):
                    return os.path.join(static_dir, 'server-control.html')
                elif clean_path == 'battle-rooms.html' or path.startswith('/battle-rooms.html'):
                    return os.path.join(static_dir, 'battle-rooms.html')
                elif clean_path == 'daletou-test.html' or path.startswith('/daletou-test.html'):
                    return os.path.join(static_dir, 'daletou-test.html')
                # 处理静态资源文件（CSS、JS等）
                elif clean_path.startswith('css/') or clean_path.startswith('js/'):
                    # 直接返回 static 目录下的文件
                    file_path = os.path.join(static_dir, clean_path)
                    # 规范化路径（处理 .. 等）
                    file_path = os.path.normpath(file_path)
                    # 确保路径在 static_dir 内（安全检查）
                    if not file_path.startswith(os.path.abspath(static_dir)):
                        return super().translate_path(path)
                    if os.path.exists(file_path):
                        return file_path
                    # 如果文件不存在，返回路径让浏览器显示404
                    return file_path
                # 处理 Items.json 请求
                elif clean_path == 'Items.json' or path.startswith('/Items.json') or path.endswith('/Items.json'):
                    # 尝试多个可能的路径
                    possible_paths = [
                        os.path.join(data_dir, 'Items.json'),
                        os.path.join(base_dir, 'handlers', 'json', 'Items.json'),
                    ]
                    for json_path in possible_paths:
                        if os.path.exists(json_path):
                            return json_path
                    # 如果都不存在，返回data目录下的路径（可能文件不存在，但至少路径正确）
                    return os.path.join(data_dir, 'Items.json')
                # 其他路径，尝试从 static 目录查找
                else:
                    # 尝试从 static 目录查找文件
                    static_file_path = os.path.join(static_dir, clean_path)
                    static_file_path = os.path.normpath(static_file_path)
                    # 确保路径在 static_dir 内（安全检查）
                    if static_file_path.startswith(os.path.abspath(static_dir)) and os.path.exists(static_file_path):
                        return static_file_path
                    # 如果不存在，使用默认处理
                return super().translate_path(path)
            
            def end_headers(self):
                # 允许跨域访问（用于开发环境）
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                super().end_headers()
        
        handler = ConsoleHandler
        
        # 尝试常用端口
        for host, port in [("127.0.0.1", 8080), ("127.0.0.1", 8081)]:
            try:
                httpd = http.server.ThreadingHTTPServer((host, port), handler)
                t = threading.Thread(target=httpd.serve_forever, daemon=True)
                t.start()
                print(f'管理后台运行在 http://{host}:{port}/index.html')
                print(f'游戏控制: http://{host}:{port}/game-control.html')
                print(f'服务器控制: http://{host}:{port}/server-control.html')
                print(f'客户端模拟: http://{host}:{port}/client-simulator.html')
                print(f'战斗房间监控: http://{host}:{port}/battle-rooms.html')
                print(f'大乐透测试: http://{host}:{port}/daletou-test.html')
                return
            except Exception:
                # 端口占用，尝试下一个
                pass
        
        # 如果常用端口都被占用，尝试随机端口
        try:
            httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            host, port = httpd.socket.getsockname()
            t = threading.Thread(target=httpd.serve_forever, daemon=True)
            t.start()
            print(f'管理后台运行在 http://{host}:{port}/index.html')
            print(f'大乐透测试: http://{host}:{port}/daletou-test.html')
            return
        except Exception as e:
            print(f'启动控制台失败: {e}')
            
        print('控制台未启动')

    start_console_server()
    try:
        # 网游级优化：启用消息压缩（perMessageDeflate）
        # 参考 PomeloServer：优化连接处理，提高并发能力
        async with websockets.serve(
            handle_client, 
            WS_HOST, 
            WS_PORT,
            compression="deflate",  # 启用消息压缩
            max_size=MAX_MESSAGE_SIZE,  # 限制消息大小
            ping_interval=HEARTBEAT_INTERVAL,  # 自动心跳
            ping_timeout=HEARTBEAT_TIMEOUT,
            # MMO级优化：提高连接处理能力
            max_queue=1000,  # 增加连接队列大小
            read_limit=2**20,  # 1MB读取限制
            write_limit=2**20  # 1MB写入限制
        ):
            await asyncio.Future()
    except OSError as e:
        if e.errno == 10048 or 'Address already in use' in str(e):
            print(f'[错误] 端口 {WS_PORT} 仍被占用，请手动关闭占用该端口的进程')
            print(f'   错误详情: {e}')
        else:
            raise

if __name__ == '__main__':
    asyncio.run(main())
