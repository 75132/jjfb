#!/usr/bin/env python3
"""
游戏服务器压力测试工具（完整版）
用于测试服务器在并发用户下的性能表现，模拟所有游戏功能

使用方法:
    python stress_test.py --host localhost --port 8001 --users 100 --duration 60
"""

import asyncio
import websockets
import json
import time
import argparse
import statistics
import os
from typing import Dict, List, Optional
from collections import defaultdict
from dataclasses import dataclass, field
import random


@dataclass
class RequestStats:
    """请求统计"""
    route: str
    count: int = 0
    success_count: int = 0
    error_count: int = 0
    response_times: List[float] = field(default_factory=list)
    total_time: float = 0.0
    
    def add_response(self, response_time: float, success: bool = True):
        """添加响应统计"""
        self.count += 1
        self.total_time += response_time
        self.response_times.append(response_time)
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
    
    def get_avg_time(self) -> float:
        """平均响应时间"""
        return self.total_time / self.count if self.count > 0 else 0.0
    
    def get_p95_time(self) -> float:
        """P95响应时间"""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(len(sorted_times) * 0.95)
        return sorted_times[min(index, len(sorted_times) - 1)]
    
    def get_p99_time(self) -> float:
        """P99响应时间"""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(len(sorted_times) * 0.99)
        return sorted_times[min(index, len(sorted_times) - 1)]
    
    def get_error_rate(self) -> float:
        """错误率"""
        return self.error_count / self.count if self.count > 0 else 0.0


@dataclass
class UserStats:
    """单个用户的统计"""
    user_id: str
    connected: bool = False
    login_success: bool = False
    character_selected: bool = False
    total_requests: int = 0
    total_errors: int = 0
    connect_time: Optional[float] = None
    login_time: Optional[float] = None
    first_request_time: Optional[float] = None
    last_request_time: Optional[float] = None


class StressTestClient:
    """压力测试客户端 - 模拟真实玩家行为，包含所有游戏功能"""
    
    def __init__(self, user_id: str, host: str, port: int, test_duration: float, 
                 high_frequency: bool = False, test_mode: bool = True):
        self.user_id = user_id
        self.host = host
        self.port = port
        self.test_duration = test_duration
        self.high_frequency = high_frequency
        self.test_mode = test_mode  # 测试模式：最高权限，可以随机生成数据
        self.ws = None
        self.stats = UserStats(user_id=user_id)
        self.token = None
        self.user_id_obj = None
        self.character_id = None
        self.running = True
        self.start_time = time.time()
        self.message_queue = asyncio.Queue()
        self.message_receiver_task = None
        
        # 游戏状态缓存
        self.bag_items = []
        self.robot_pets = []
        self.characters = {}  # 角色列表缓存
        self.friends = []  # 好友列表缓存
        self.friend_requests = []  # 好友申请列表缓存
        self.current_bag_page = 1
        self.current_bag_category = 0
        self.searched_friend_id = None
        
        # 随机种子和延迟（优化：减少初始延迟，加快连接）
        self.random_seed = hash(user_id) % 10000
        random.seed(self.random_seed)
        # 减少初始延迟范围，从0-5秒改为0-2秒，加快连接建立
        self.initial_delay = random.uniform(0, 2.0)
        
        # 操作间隔（优化：提高操作频率，增加QPS）
        if high_frequency:
            self.operation_interval = (0.05, 0.3)  # 高频模式：50-300ms
        else:
            self.operation_interval = (0.3, 3.0)  # 正常模式：300ms-3s（减少最大间隔）
        
        # 完整的游戏操作列表（包含所有功能）
        self.game_operations = self._build_game_operations()
        
        # 重置随机种子
        random.seed()
    
    def _build_game_operations(self) -> List[tuple]:
        """构建游戏操作列表（包含所有功能）"""
        if self.high_frequency:
            # 高频模式：更频繁的操作
            return [
                # 认证相关（低频，但必须包含）
                ('register', 0.001),           # 0.1% - 注册（很少，因为通常已注册）
                ('change_password', 0.0005),    # 0.05% - 修改密码
                
                # 角色相关
                ('get_character_info', 0.10),  # 10% - 角色信息
                ('get_all_characters', 0.03),  # 3% - 获取所有角色
                ('create_character', 0.01),    # 1% - 创建角色
                ('delete_character', 0.005),   # 0.5% - 删除角色
                ('select_character', 0.01),     # 1% - 选择角色
                
                # 玩家信息
                ('get_player', 0.08),          # 8% - 玩家信息
                
                # 背包相关（高频）
                ('bag_get', 0.15),             # 15% - 背包查询
                ('bag_use_item', 0.08),        # 8% - 使用物品
                ('bag_discard_item', 0.03),    # 3% - 丢弃物品
                ('bag_write_random', 0.03),    # 3% - 随机写入背包（测试模式，慢操作，减少频率）
                ('unequip_item', 0.02),        # 2% - 卸下装备
                
                # 机甲相关（高频）
                ('get_robot_pets', 0.15),      # 15% - 机甲列表
                ('get_robot_pet_info', 0.08),  # 8% - 机甲详情
                ('upgrade_robot', 0.08),       # 8% - 升级机甲
                ('upgrade_all_robots', 0.01),   # 1% - 升级所有机甲（慢操作，减少频率）
                ('create_initial_pet', 0.01),    # 1% - 创建初始宠物（慢操作，减少频率）
                ('fix_robot_pet_form', 0.001),   # 0.1% - 修复机甲形态（慢操作，减少频率）
                ('get_random_robot', 0.02),    # 2% - 获取随机机器人
                
                # 好友相关
                ('get_friend_list', 0.05),     # 5% - 获取好友列表
                ('get_friend_requests', 0.03), # 3% - 获取好友申请
                ('search_friend', 0.02),       # 2% - 搜索好友
                ('add_friend', 0.02),         # 2% - 添加好友
                ('approve_friend', 0.015),     # 1.5% - 同意好友申请
                ('reject_friend', 0.01),       # 1% - 拒绝好友申请
                ('delete_friend', 0.01),       # 1% - 删除好友
                
                # 聊天相关
                ('get_chat_history', 0.04),   # 4% - 获取聊天历史
                ('post_chat', 0.03),          # 3% - 发送聊天消息
                ('get_announcements_history', 0.02),  # 2% - 获取公告历史
                ('post_announcement', 0.01),   # 1% - 发布公告
                
                # 物品和经验
                ('add', 0.02),                # 2% - 添加物品（测试模式）
                ('add_exp', 0.01),            # 1% - 增加经验
            ]
        else:
            # 正常模式：更真实的玩家行为
            return [
                # 认证相关（低频）
                ('register', 0.0005),
                ('change_password', 0.0002),
                
                # 角色相关
                ('get_character_info', 0.12),
                ('get_all_characters', 0.03),
                ('create_character', 0.005),
                ('delete_character', 0.002),
                ('select_character', 0.005),
                
                # 玩家信息
                ('get_player', 0.08),
                
                # 背包相关
                ('bag_get', 0.20),
                ('bag_use_item', 0.08),
                ('bag_discard_item', 0.03),
                ('bag_write_random', 0.01),    # 1% - 随机写入背包（慢操作，减少频率）
                ('unequip_item', 0.01),
                
                # 机甲相关
                ('get_robot_pets', 0.18),
                ('get_robot_pet_info', 0.10),
                ('upgrade_robot', 0.06),
                ('upgrade_all_robots', 0.005),  # 0.5% - 升级所有机甲（慢操作，减少频率）
                ('create_initial_pet', 0.005),   # 0.5% - 创建初始宠物（慢操作，减少频率）
                ('fix_robot_pet_form', 0.001),   # 0.1% - 修复机甲形态（慢操作，减少频率）
                ('get_random_robot', 0.01),
                
                # 好友相关
                ('get_friend_list', 0.04),
                ('get_friend_requests', 0.02),
                ('search_friend', 0.01),
                ('add_friend', 0.01),
                ('approve_friend', 0.008),
                ('reject_friend', 0.005),
                ('delete_friend', 0.005),
                
                # 聊天相关
                ('get_chat_history', 0.03),
                ('post_chat', 0.02),
                ('get_announcements_history', 0.01),
                ('post_announcement', 0.005),
                
                # 物品和经验
                ('add', 0.01),
                ('add_exp', 0.01),
            ]
    
    async def connect(self) -> bool:
        """连接服务器（优化版：提高连接成功率）"""
        max_retries = 5  # 增加重试次数
        base_delay = 0.5  # 减少基础延迟，加快重试
        
        for attempt in range(max_retries):
            try:
                uri = f"ws://{self.host}:{self.port}"
                self.stats.connect_time = time.time()
                
                # 优化连接参数：增加超时时间，使用更宽松的设置
                self.ws = await asyncio.wait_for(
                    websockets.connect(
                        uri, 
                        ping_interval=None, 
                        close_timeout=10,
                        max_size=2**20,  # 1MB
                        max_queue=32,
                        read_limit=2**16,  # 64KB
                        write_limit=2**16  # 64KB
                    ),
                    timeout=10.0  # 增加超时时间到10秒
                )
                
                # 简化连接验证：不发送ping，直接认为连接成功（ping会增加延迟）
                # 连接成功后会通过实际消息交互验证连接有效性
                self.stats.connected = True
                return True
                
            except asyncio.TimeoutError:
                # 连接超时
                if attempt < max_retries - 1:
                    delay = base_delay * (1.5 ** attempt) + random.uniform(0, 0.5)
                    await asyncio.sleep(delay)
                    continue
                else:
                    return False
                    
            except (ConnectionRefusedError, OSError, websockets.exceptions.InvalidURI) as e:
                # 连接被拒绝或网络错误
                if attempt < max_retries - 1:
                    # 对于连接被拒绝，使用更长的延迟
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1.0)
                    await asyncio.sleep(delay)
                    continue
                else:
                    return False
                    
            except websockets.exceptions.WebSocketException as e:
                # WebSocket特定错误
                if attempt < max_retries - 1:
                    delay = base_delay * (1.5 ** attempt) + random.uniform(0, 0.5)
                    await asyncio.sleep(delay)
                    continue
                else:
                    return False
                    
            except Exception as e:
                # 其他异常
                if attempt < max_retries - 1:
                    delay = base_delay * (1.5 ** attempt) + random.uniform(0, 0.5)
                    await asyncio.sleep(delay)
                    continue
                else:
                    return False
        
        return False
    
    async def register(self) -> bool:
        """注册账号"""
        try:
            register_msg = {
                'type': 'register',
                'account': f'test_{self.user_id}',
                'password': 'test123456'
            }
            await self.send_message(register_msg)
            response = await self.receive_message(timeout=10.0, expected_type='register_response')
            
            if response and response.get('success'):
                self.token = response.get('token')
                self.user_id_obj = response.get('user_id')
                return True
            return False
        except Exception as e:
            return False
    
    async def login(self) -> bool:
        """登录（先尝试注册，如果失败则登录）"""
        try:
            # 先尝试注册
            if await self.register():
                self.stats.login_success = True
                self.stats.login_time = time.time()
                return True
            
            # 注册失败（可能已存在），尝试登录
            login_msg = {
                'type': 'login',
                'account': f'test_{self.user_id}',
                'password': 'test123456'
            }
            await self.send_message(login_msg)
            response = await self.receive_message(timeout=10.0, expected_type='login_response')
            
            if response and response.get('success'):
                self.token = response.get('token')
                self.user_id_obj = response.get('user_id')
                self.stats.login_success = True
                self.stats.login_time = time.time()
                return True
            
            return False
        except Exception as e:
            return False
    
    async def select_character(self) -> bool:
        """选择角色"""
        try:
            # 先获取所有角色
            get_chars_msg = {'type': 'get_all_characters'}
            await self.send_message(get_chars_msg)
            response = await self.receive_message(timeout=10.0, expected_type='all_characters_response')
            
            if response and response.get('success'):
                characters_dict = response.get('characters', {})
                
                # 查找第一个有 character_id 的角色
                character_id = None
                for slot_index in [0, 1, 2]:
                    char = characters_dict.get(str(slot_index)) or characters_dict.get(slot_index)
                    if char and char.get('character_id'):
                        character_id = char.get('character_id')
                        break
                
                if character_id:
                    self.character_id = str(character_id)
                    select_msg = {
                        'type': 'select_character',
                        'character_id': self.character_id
                    }
                    await self.send_message(select_msg)
                    response = await self.receive_message(timeout=10.0, expected_type='select_character_response')
                    
                    if response and response.get('success'):
                        if response.get('character_id'):
                            self.character_id = str(response.get('character_id'))
                        self.stats.character_selected = True
                        return True
                    else:
                        return await self.create_character()
                else:
                    return await self.create_character()
            else:
                return await self.create_character()
        except Exception as e:
            return False
    
    async def create_character(self) -> bool:
        """创建角色"""
        try:
            create_msg = {
                'type': 'create_character',
                'name': f'角色_{self.user_id}',
                'class': random.randint(1, 3),
                'sprite': random.randint(0, 5),
                'slot_index': 0
            }
            await self.send_message(create_msg)
            response = await self.receive_message(timeout=10.0, expected_type='create_character_response')
            
            if response and response.get('success'):
                character_id = response.get('character_id')
                if character_id:
                    self.character_id = str(character_id)
                    self.stats.character_selected = True
                    return True
            return False
        except Exception as e:
            return False
    
    async def send_message(self, message: dict):
        """发送消息（自动添加 token 和 character_id）"""
        if not self.ws:
            return
        
        route = message.get('type')
        if route and route not in ['login', 'register', 'pong', 'handshake']:
            if self.token and 'token' not in message:
                message['token'] = self.token
            if self.user_id_obj and 'user_id' not in message and self.test_mode:
                message['user_id'] = self.user_id_obj
            if self.character_id:
                routes_need_character = [
                    'bag_get', 'bag_use_item', 'bag_discard_item', 'bag_write_random', 'unequip_item',
                    'get_robot_pets', 'get_robot_pet_info', 'upgrade_robot', 'upgrade_all_robots',
                    'get_character_info', 'get_player', 'get_friend_list', 'get_friend_requests',
                    'search_friend', 'add_friend', 'approve_friend', 'reject_friend', 'delete_friend',
                    'post_chat', 'post_announcement', 'add', 'add_exp', 'create_initial_pet',
                    'fix_robot_pet_form', 'delete_character', 'select_character'
                ]
                if route in routes_need_character and 'character_id' not in message:
                    message['character_id'] = self.character_id
        
        try:
            await self.ws.send(json.dumps(message))
        except Exception as e:
            raise
    
    async def start_message_receiver(self):
        """启动消息接收器"""
        if self.message_receiver_task and not self.message_receiver_task.done():
            return
        
        async def receiver_loop():
            while self.running and self.ws:
                try:
                    message_str = await self.ws.recv()
                    try:
                        message = json.loads(message_str)
                        
                        if message.get('type') == 'ping':
                            await self.send_message({'type': 'pong'})
                            continue
                        
                        if message.get('type') == 'pong':
                            continue
                        
                        await self.message_queue.put(message)
                    except json.JSONDecodeError:
                        continue
                except websockets.exceptions.ConnectionClosed:
                    break
                except Exception as e:
                    break
        
        self.message_receiver_task = asyncio.create_task(receiver_loop())
    
    async def receive_message(self, timeout: float = 15.0, expected_type: Optional[str] = None) -> Optional[dict]:
        """从消息队列接收消息"""
        if not self.ws or not self.message_receiver_task:
            return None
        
        start_time = time.time()
        while (time.time() - start_time) < timeout:
            try:
                remaining_time = timeout - (time.time() - start_time)
                if remaining_time <= 0:
                    break
                
                try:
                    # 优化：减少轮询间隔，提高响应速度
                    message = await asyncio.wait_for(
                        self.message_queue.get(),
                        timeout=min(remaining_time, 0.5)  # 从1.0秒减少到0.5秒
                    )
                except asyncio.TimeoutError:
                    continue
                
                # 处理推送消息
                if message.get('type') == 'bag_items_update':
                    self.bag_items = []
                    if not expected_type:
                        continue
                
                # 匹配响应类型
                if expected_type:
                    msg_type = message.get('type', '')
                    if msg_type == expected_type:
                        return message
                    
                    # 响应类型映射
                    response_type_map = {
                        'login': 'login_response',
                        'register': 'register_response',
                        'get_all_characters': 'all_characters_response',
                        'select_character': 'select_character_response',
                        'create_character': 'create_character_response',
                        'get_character_info': 'character_info_response',
                        'bag_get': 'bag_items',
                        'bag_use_item': 'bag_use_item_response',
                        'bag_discard_item': 'bag_discard_item_response',
                        'get_robot_pets': 'robot_pets_response',
                        'get_robot_pet_info': 'robot_pet_info_response',
                        'upgrade_robot': 'upgrade_robot_response',
                        'upgrade_all_robots': 'upgrade_all_robots_response',
                        'get_friend_list': 'get_friend_list_response',
                        'get_friend_requests': 'get_friend_requests_response',
                        'search_friend': 'search_friend_response',
                        'add_friend': 'add_friend_response',
                        'approve_friend': 'approve_friend_response',
                        'reject_friend': 'reject_friend_response',
                        'delete_friend': 'delete_friend_response',
                        'get_chat_history': 'chat_history_response',
                        'post_chat': 'post_chat_response',
                        'get_announcements_history': 'announcements_history_response',
                        'post_announcement': 'post_announcement_response',
                        'get_player': 'player_info_response',
                        'unequip_item': 'unequip_item_response',
                        'add': 'add_response',
                        'add_exp': 'add_exp_response',
                        'change_password': 'change_password_response',
                        'delete_character': 'delete_character_response',
                        'create_initial_pet': 'create_initial_pet_response',
                        'fix_robot_pet_form': 'fix_robot_pet_form_response',
                        'get_random_robot': 'robot_info',
                    }
                    
                    if expected_type in response_type_map:
                        if msg_type == response_type_map[expected_type]:
                            return message
                    
                    continue
                
                # 如果没有指定期望类型，返回第一个非心跳/非推送消息
                msg_type = message.get('type', '')
                if msg_type not in ['pong', 'ping', 'announcement', 'chat_message', 'bag_items_update', 'robot_pets_update']:
                    return message
                
            except Exception as e:
                return None
        
        return None
    
    async def _async_refresh_bag(self, global_stats: Dict[str, RequestStats]):
        """异步刷新背包（不阻塞主流程）"""
        try:
            # 检查连接状态
            if not self.ws or not self.running:
                return
            await asyncio.sleep(random.uniform(0.1, 0.3))
            # 再次检查连接状态（可能在等待期间断开）
            if self.ws and self.running:
                await self.execute_operation('bag_get', global_stats)
        except Exception:
            pass  # 静默失败，不影响主流程
    
    async def initialize_game_data(self, global_stats: Dict[str, RequestStats]):
        """初始化游戏数据（优化：减少初始化操作，加快启动）"""
        try:
            init_delay = random.uniform(0.05, 0.2)  # 减少初始化延迟
            
            # 只获取必要的基础数据，其他数据按需加载
            # 获取角色信息
            await self.execute_operation('get_character_info', global_stats)
            await asyncio.sleep(init_delay)
            
            # 获取背包（异步，不阻塞）
            if self.ws and self.running:
                asyncio.create_task(self._async_get_bag(global_stats))
            
            # 获取机甲列表（异步，不阻塞）
            if self.ws and self.running:
                asyncio.create_task(self._async_get_robots(global_stats))
            
        except:
            pass
    
    async def _async_get_bag(self, global_stats: Dict[str, RequestStats]):
        """异步获取背包"""
        try:
            # 检查连接状态
            if not self.ws or not self.running:
                return
            await asyncio.sleep(random.uniform(0.1, 0.3))
            # 再次检查连接状态
            if self.ws and self.running:
                await self.execute_operation('bag_get', global_stats)
        except Exception:
            pass
    
    async def _async_get_robots(self, global_stats: Dict[str, RequestStats]):
        """异步获取机甲列表"""
        try:
            # 检查连接状态
            if not self.ws or not self.running:
                return
            await asyncio.sleep(random.uniform(0.1, 0.3))
            # 再次检查连接状态
            if self.ws and self.running:
                await self.execute_operation('get_robot_pets', global_stats)
        except Exception:
            pass
    
    async def execute_operation(self, operation: str, global_stats: Dict[str, RequestStats]) -> bool:
        """执行单个操作"""
        # 检查连接状态
        if not self.ws or not self.running:
            return False
        
        start_time = time.time()
        request_msg = {'type': operation}
        
        try:
            # 根据操作类型构建请求
            if operation == 'bag_get':
                request_msg.update({
                    'category': self.current_bag_category,
                    'page': self.current_bag_page,
                    'page_size': 60
                })
            
            elif operation == 'bag_use_item':
                if not self.bag_items:
                    bag_msg = {'type': 'bag_get', 'category': 0, 'page': 1, 'page_size': 60}
                    await self.send_message(bag_msg)
                    bag_response = await self.receive_message(timeout=10.0, expected_type='bag_items')
                    if bag_response and bag_response.get('success'):
                        items = bag_response.get('items', [])
                        if items:
                            self.bag_items = items
                        else:
                            return False
                    else:
                        return False
                
                if self.bag_items:
                    item = self.bag_items[0]
                    # 判断是装备还是消耗品
                    item_type = item.get('itype_id', 1)
                    if item_type in [2, 3, 4, 5, 6] or item.get('category') in [2, 3]:
                        # 装备物品，需要有机甲
                        if not self.robot_pets:
                            await self.execute_operation('get_robot_pets', global_stats)
                        if self.robot_pets:
                            robot = self.robot_pets[0]
                            robot_id = robot.get('pet_id') or robot.get('_id') or robot.get('robot_id') or robot.get('id')
                            request_msg.update({
                                'item_id': int(item.get('item_id', 0)),
                                'quantity': 1,
                                'target_type': 'Pet',
                                'pet_id': str(robot_id),
                                'category': item.get('category'),
                                'slot_index': item.get('slot_index'),
                            })
                        else:
                            return False
                    else:
                        # 消耗品
                        request_msg.update({
                            'item_id': int(item.get('item_id', 0)),
                            'quantity': 1,
                            'target_type': 'Player',
                            'category': item.get('category'),
                            'slot_index': item.get('slot_index'),
                        })
                else:
                    return False
            
            elif operation == 'bag_discard_item':
                if not self.bag_items:
                    return False
                item = self.bag_items[0]
                request_msg.update({
                    'item_id': int(item.get('item_id', 0)),
                    'quantity': 1,
                    'category': item.get('category'),
                    'slot_index': item.get('slot_index'),
                })
            
            elif operation == 'bag_write_random':
                # 测试模式：随机生成背包物品
                request_msg['count'] = random.randint(5, 20)
            
            elif operation == 'get_robot_pet_info':
                if not self.robot_pets:
                    list_msg = {'type': 'get_robot_pets'}
                    await self.send_message(list_msg)
                    list_response = await self.receive_message(timeout=10.0, expected_type='robot_pets_response')
                    if list_response and list_response.get('success'):
                        robots = list_response.get('pets', [])
                        if robots:
                            self.robot_pets = robots
                        else:
                            return False
                    else:
                        return False
                
                if self.robot_pets:
                    robot = self.robot_pets[0]
                    robot_id = robot.get('pet_id') or robot.get('_id') or robot.get('robot_id') or robot.get('id')
                    if robot_id:
                        request_msg['pet_id'] = str(robot_id)
                    else:
                        return False
            
            elif operation == 'upgrade_robot':
                if not self.robot_pets:
                    list_msg = {'type': 'get_robot_pets'}
                    await self.send_message(list_msg)
                    list_response = await self.receive_message(timeout=10.0, expected_type='robot_pets_response')
                    if list_response and list_response.get('success'):
                        robots = list_response.get('pets', [])
                        if robots:
                            self.robot_pets = robots
                        else:
                            return False
                    else:
                        return False
                
                if self.robot_pets:
                    robot = self.robot_pets[0]
                    robot_id = robot.get('pet_id') or robot.get('_id') or robot.get('robot_id') or robot.get('id')
                    if robot_id:
                        request_msg['pet_id'] = str(robot_id)
                        request_msg['exp'] = random.randint(100, 1000)
                    else:
                        return False
            
            elif operation == 'upgrade_all_robots':
                request_msg['exp'] = random.randint(100, 1000)
            
            elif operation == 'unequip_item':
                if not self.robot_pets:
                    return False
                robot = self.robot_pets[0]
                robot_id = robot.get('pet_id') or robot.get('_id') or robot.get('robot_id') or robot.get('id')
                if robot_id:
                    # 随机选择一个槽位
                    slots = ['Weapon', 'Gun', 'Dun', 'Wing', 'Xinpian', 'Toukai', 'Jianjia', 'Xiongkai', 'Tuikai', 'Shoukai']
                    request_msg['pet_id'] = str(robot_id)
                    request_msg['slot_name'] = random.choice(slots)
                else:
                    return False
            
            elif operation == 'search_friend':
                request_msg['friend_id'] = f'{random.randint(0, 999999):06d}'
            
            elif operation == 'add_friend':
                if hasattr(self, 'searched_friend_id') and self.searched_friend_id:
                    request_msg['target_friend_id'] = self.searched_friend_id
                else:
                    request_msg['target_friend_id'] = f'{random.randint(0, 999999):06d}'
            
            elif operation == 'approve_friend' or operation == 'reject_friend':
                if not self.friend_requests:
                    # 先获取好友申请列表
                    req_msg = {'type': 'get_friend_requests'}
                    await self.send_message(req_msg)
                    req_response = await self.receive_message(timeout=10.0, expected_type='get_friend_requests_response')
                    if req_response and req_response.get('success'):
                        data = req_response.get('data', {})
                        requests_list = data.get('list', [])
                        if requests_list:
                            self.friend_requests = requests_list
                        else:
                            return False
                    else:
                        return False
                
                if self.friend_requests:
                    friend_req = self.friend_requests[0]
                    request_msg['friend_id'] = friend_req.get('friend_id')
                else:
                    return False
            
            elif operation == 'delete_friend':
                if not self.friends:
                    # 先获取好友列表
                    friend_msg = {'type': 'get_friend_list'}
                    await self.send_message(friend_msg)
                    friend_response = await self.receive_message(timeout=10.0, expected_type='get_friend_list_response')
                    if friend_response and friend_response.get('success'):
                        data = friend_response.get('data', {})
                        friends_list = data.get('list', [])
                        if friends_list:
                            self.friends = friends_list
                        else:
                            return False
                    else:
                        return False
                
                if self.friends:
                    friend = self.friends[0]
                    request_msg['friend_id'] = friend.get('friend_id')
                else:
                    return False
            
            elif operation == 'get_chat_history':
                request_msg['limit'] = random.randint(10, 50)
            
            elif operation == 'post_chat':
                request_msg['text'] = f'测试消息_{random.randint(1000, 9999)}'
            
            elif operation == 'get_announcements_history':
                request_msg['limit'] = random.randint(5, 20)
            
            elif operation == 'post_announcement':
                request_msg['text'] = f'测试公告_{random.randint(1000, 9999)}'
            
            elif operation == 'add':
                # 测试模式：添加随机物品
                request_msg['item_id'] = random.randint(1001, 2000)  # 假设物品ID范围
                request_msg['quantity'] = random.randint(1, 10)
            
            elif operation == 'add_exp':
                request_msg['exp_amount'] = random.randint(100, 1000)
            
            elif operation == 'change_password':
                request_msg['old_password'] = 'test123456'
                request_msg['new_password'] = 'test123456'
            
            elif operation == 'delete_character':
                # 先获取所有角色
                if not self.characters:
                    chars_msg = {'type': 'get_all_characters'}
                    await self.send_message(chars_msg)
                    chars_response = await self.receive_message(timeout=10.0, expected_type='all_characters_response')
                    if chars_response and chars_response.get('success'):
                        chars_dict = chars_response.get('characters', {})
                        # 找一个不是当前角色的角色删除
                        for slot_index in [0, 1, 2]:
                            char = chars_dict.get(str(slot_index)) or chars_dict.get(slot_index)
                            if char and char.get('character_id') and str(char.get('character_id')) != self.character_id:
                                request_msg['character_id'] = str(char.get('character_id'))
                                break
                        if 'character_id' not in request_msg:
                            return False  # 没有其他角色可删除
                    else:
                        return False
                else:
                    # 使用缓存的角色
                    for char in self.characters.values():
                        if char.get('character_id') and str(char.get('character_id')) != self.character_id:
                            request_msg['character_id'] = str(char.get('character_id'))
                            break
                    if 'character_id' not in request_msg:
                        return False
            
            elif operation == 'create_character':
                request_msg.update({
                    'name': f'角色_{self.user_id}_{random.randint(1000, 9999)}',
                    'class': random.randint(1, 3),
                    'sprite': random.randint(0, 5),
                    'slot_index': random.randint(0, 2)
                })
            
            elif operation == 'select_character':
                if not self.characters:
                    chars_msg = {'type': 'get_all_characters'}
                    await self.send_message(chars_msg)
                    chars_response = await self.receive_message(timeout=10.0, expected_type='all_characters_response')
                    if chars_response and chars_response.get('success'):
                        self.characters = chars_response.get('characters', {})
                
                if self.characters:
                    # 选择一个不同的角色
                    for slot_index in [0, 1, 2]:
                        char = self.characters.get(str(slot_index)) or self.characters.get(slot_index)
                        if char and char.get('character_id') and str(char.get('character_id')) != self.character_id:
                            request_msg['character_id'] = str(char.get('character_id'))
                            break
                    if 'character_id' not in request_msg:
                        return False  # 没有其他角色可选择
            
            # 发送请求
            await self.send_message(request_msg)
            
            # 确定期望的响应类型
            response_type_map = {
                'bag_get': 'bag_items',
                'bag_use_item': 'bag_use_item_response',
                'bag_discard_item': 'bag_discard_item_response',
                'get_robot_pets': 'robot_pets_response',
                'get_robot_pet_info': 'robot_pet_info_response',
                'upgrade_robot': 'upgrade_robot_response',
                'upgrade_all_robots': 'upgrade_all_robots_response',
                'create_initial_pet': 'create_initial_pet_response',
                'get_character_info': 'character_info_response',
                'get_all_characters': 'all_characters_response',
                'get_player': 'player_info_response',
                'get_friend_list': 'get_friend_list_response',
                'get_friend_requests': 'get_friend_requests_response',
                'search_friend': 'search_friend_response',
                'add_friend': 'add_friend_response',
                'approve_friend': 'approve_friend_response',
                'reject_friend': 'reject_friend_response',
                'delete_friend': 'delete_friend_response',
                'get_chat_history': 'chat_history_response',
                'post_chat': 'post_chat_response',
                'get_announcements_history': 'announcements_history_response',
                'post_announcement': 'post_announcement_response',
                'unequip_item': 'unequip_item_response',
                'add': 'add_response',
                'add_exp': 'add_exp_response',
                'change_password': 'change_password_response',
                'delete_character': 'delete_character_response',
                'create_character': 'create_character_response',
                'select_character': 'select_character_response',
                'fix_robot_pet_form': 'fix_robot_pet_form_response',
                'get_random_robot': 'robot_info',
            }
            expected_response_type = response_type_map.get(operation)
            
            response = await self.receive_message(timeout=15.0, expected_type=expected_response_type)
            response_time = time.time() - start_time
            
            # 更新统计
            if operation not in global_stats:
                global_stats[operation] = RequestStats(route=operation)
            
            success = response is not None and response.get('success', False)
            global_stats[operation].add_response(response_time, success)
            
            self.stats.total_requests += 1
            if not success:
                self.stats.total_errors += 1
            
            # 更新缓存
            if success and response:
                if operation == 'bag_get':
                    self.bag_items = response.get('items', [])
                elif operation == 'get_robot_pets':
                    self.robot_pets = response.get('pets', [])
                elif operation == 'search_friend':
                    friend_data = response.get('data', {}).get('friend') if response.get('data') else response.get('friend')
                    if friend_data and friend_data.get('friend_id'):
                        self.searched_friend_id = str(friend_data.get('friend_id'))
                elif operation == 'get_friend_list':
                    data = response.get('data', {})
                    self.friends = data.get('list', [])
                elif operation == 'get_friend_requests':
                    data = response.get('data', {})
                    self.friend_requests = data.get('list', [])
                elif operation == 'get_all_characters':
                    self.characters = response.get('characters', {})
            
            return success
            
        except Exception as e:
            self.stats.total_errors += 1
            # 如果是连接错误，标记为断开
            if 'Connection' in str(type(e).__name__) or 'closed' in str(e).lower():
                self.running = False
            return False
    
    async def run_game_operations(self, global_stats: Dict[str, RequestStats]):
        """运行游戏操作 - 模拟真实玩家行为"""
        await self.start_message_receiver()
        
        try:
            if self.initial_delay > 0:
                await asyncio.sleep(self.initial_delay)
            
            # 初始化游戏数据
            await self.initialize_game_data(global_stats)
            
            random.seed(self.random_seed + int(time.time() * 1000) % 10000)
            
            while self.running and (time.time() - self.start_time) < self.test_duration:
                # 随机选择操作
                rand = random.random()
                cumulative = 0.0
                selected_operation = None
                
                for operation, probability in self.game_operations:
                    cumulative += probability
                    if rand <= cumulative:
                        selected_operation = operation
                        break
                
                if not selected_operation:
                    selected_operation = 'bag_get'
                
                # 执行操作
                try:
                    success = await self.execute_operation(selected_operation, global_stats)
                    
                    if not self.stats.first_request_time:
                        self.stats.first_request_time = time.time()
                    self.stats.last_request_time = time.time()
                    
                    # 写操作后自动刷新（优化：减少延迟，但只在成功时刷新）
                    if success and selected_operation in ['bag_use_item', 'bag_discard_item', 'bag_write_random', 'unequip_item']:
                        # 异步刷新，不阻塞主流程（检查连接状态）
                        if self.ws and self.running:
                            asyncio.create_task(self._async_refresh_bag(global_stats))
                    
                    # 随机等待（优化：根据操作类型动态调整等待时间）
                    min_wait, max_wait = self.operation_interval
                    
                    # 慢操作（如fix_robot_pet_form, upgrade_all_robots）后等待更长时间
                    slow_operations = ['fix_robot_pet_form', 'upgrade_all_robots', 'create_initial_pet', 'bag_write_random']
                    if selected_operation in slow_operations:
                        # 慢操作后等待更长时间，给服务器处理时间
                        wait_time = random.uniform(max_wait * 1.5, max_wait * 2.5)
                    else:
                        # 普通操作使用正常等待时间
                        wait_multiplier = random.uniform(0.9, 1.1)
                        wait_time = random.uniform(min_wait, max_wait) * wait_multiplier
                    
                    await asyncio.sleep(wait_time)
                    
                except Exception as e:
                    self.stats.total_errors += 1
                    # 错误后等待时间根据错误类型调整
                    if 'timeout' in str(e).lower() or 'Timeout' in str(e):
                        # 超时错误，等待更长时间
                        await asyncio.sleep(random.uniform(1.0, 2.0))
                    else:
                        # 其他错误，正常等待
                        await asyncio.sleep(random.uniform(0.3, 1.0))
        finally:
            if self.message_receiver_task and not self.message_receiver_task.done():
                self.message_receiver_task.cancel()
                try:
                    await self.message_receiver_task
                except asyncio.CancelledError:
                    pass
    
    async def run(self, global_stats: Dict[str, RequestStats]):
        """运行测试（优化：增加连接重试和错误处理）"""
        try:
            # 连接服务器（带重试）
            connect_success = False
            for retry in range(3):  # 最多重试3次整个流程
                if await self.connect():
                    connect_success = True
                    break
                else:
                    if retry < 2:
                        # 等待后重试
                        await asyncio.sleep(random.uniform(1.0, 3.0))
            
            if not connect_success:
                self.stats.total_errors += 1
                return
            
            # 启动消息接收器（连接成功后立即启动）
            await self.start_message_receiver()
            
            # 等待一小段时间，确保连接稳定
            await asyncio.sleep(0.1)
            
            # 登录（带重试）
            login_success = False
            for retry in range(3):
                if await self.login():
                    login_success = True
                    break
                else:
                    if retry < 2:
                        await asyncio.sleep(random.uniform(0.5, 1.5))
            
            if not login_success:
                return
            
            # 选择角色（带重试）
            for retry in range(2):
                if await self.select_character():
                    break
                else:
                    if retry < 1:
                        await asyncio.sleep(random.uniform(0.5, 1.0))
            
            # 运行游戏操作
            await self.run_game_operations(global_stats)
            
        except Exception as e:
            # 记录错误但不中断其他用户
            self.stats.total_errors += 1
        finally:
            await self.close()
    
    async def close(self):
        """关闭连接"""
        self.running = False
        
        if self.message_receiver_task and not self.message_receiver_task.done():
            self.message_receiver_task.cancel()
            try:
                await self.message_receiver_task
            except (asyncio.CancelledError, Exception):
                pass
        
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass


class StressTestRunner:
    """压力测试运行器"""
    
    def __init__(self, host: str, port: int, num_users: int, duration: float, 
                 ramp_up: float = 10.0, high_frequency: bool = False, test_mode: bool = True):
        self.host = host
        self.port = port
        self.num_users = num_users
        self.duration = duration
        self.ramp_up = ramp_up
        self.high_frequency = high_frequency
        self.test_mode = test_mode
        self.clients: List[StressTestClient] = []
        self.global_stats: Dict[str, RequestStats] = {}
        self.start_time = None
        self.end_time = None
    
    async def run(self):
        """运行压力测试"""
        print(f"\n{'='*60}")
        print(f"开始压力测试（完整功能版）")
        print(f"{'='*60}")
        print(f"服务器: {self.host}:{self.port}")
        print(f"并发用户数: {self.num_users}")
        print(f"测试时长: {self.duration} 秒")
        print(f"逐步增加时间: {self.ramp_up} 秒")
        print(f"高频模式: {'启用' if self.high_frequency else '禁用'}")
        print(f"测试模式: {'启用（最高权限）' if self.test_mode else '禁用'}")
        print(f"{'='*60}\n")
        
        self.start_time = time.time()
        
        # 优化连接策略：分批连接，避免同时连接过多
        # 计算合理的连接间隔（根据用户数动态调整）
        if self.num_users > 1:
            # 对于100用户，ramp_up=10秒，间隔应该是0.1秒
            # 但为了更稳定，我们增加间隔，并分批连接
            connect_interval = max(self.ramp_up / self.num_users, 0.1)  # 最小间隔0.1秒
            # 如果用户数很多，进一步增加间隔
            if self.num_users > 50:
                connect_interval = max(connect_interval, 0.15)
            if self.num_users > 100:
                connect_interval = max(connect_interval, 0.2)
        else:
            connect_interval = 0
        
        tasks = []
        
        print(f"开始连接用户（间隔: {connect_interval:.3f}秒，分批连接）...")
        
        # 分批连接：每批20个用户，批次之间有额外延迟
        batch_size = 20
        batch_delay = 0.5  # 批次之间的额外延迟
        
        for i in range(self.num_users):
            user_id = f"user_{i:04d}"
            client = StressTestClient(
                user_id, self.host, self.port, self.duration,
                high_frequency=self.high_frequency,
                test_mode=self.test_mode
            )
            self.clients.append(client)
            
            task = asyncio.create_task(client.run(self.global_stats))
            tasks.append(task)
            
            if (i + 1) % 10 == 0 or i == 0:
                print(f"  已启动 {i + 1}/{self.num_users} 个用户连接...")
            
            # 批次之间的额外延迟
            if (i + 1) % batch_size == 0 and i < self.num_users - 1:
                await asyncio.sleep(batch_delay)
            
            if i < self.num_users - 1:
                await asyncio.sleep(connect_interval)
        
        print(f"所有用户连接任务已启动，等待连接建立...")
        
        # 优化等待时间：根据用户数动态调整，给更多时间让连接建立
        base_wait_time = max(10.0, self.num_users * 0.2)  # 至少10秒，每用户0.2秒
        wait_time = min(30.0, base_wait_time)  # 最多30秒
        print(f"等待 {wait_time:.1f} 秒让连接建立（分批检查）...")
        
        # 更频繁的检查点，及时发现连接状态
        check_points = [2.0, 5.0, 8.0, 12.0, wait_time]
        last_check = 0.0
        last_connected = 0
        
        for check_time in check_points:
            await asyncio.sleep(check_time - last_check)
            last_check = check_time
            connected_count = sum(1 for c in self.clients if c.stats.connected)
            login_count = sum(1 for c in self.clients if c.stats.login_success)
            
            if connected_count > last_connected:
                print(f"  ✓ [{check_time:.1f}s] 已连接: {connected_count}/{self.num_users} (已登录: {login_count})")
                last_connected = connected_count
            elif connected_count > 0:
                print(f"  ⏳ [{check_time:.1f}s] 已连接: {connected_count}/{self.num_users} (已登录: {login_count})")
        
        # 最终统计
        connected_count = sum(1 for c in self.clients if c.stats.connected)
        login_count = sum(1 for c in self.clients if c.stats.login_success)
        failed_count = self.num_users - connected_count
        
        print(f"\n连接建立完成:")
        print(f"  ✓ 成功连接: {connected_count}/{self.num_users} ({connected_count/self.num_users*100:.1f}%)")
        print(f"  ✓ 成功登录: {login_count}/{self.num_users} ({login_count/self.num_users*100:.1f}%)")
        
        if connected_count == 0:
            print(f"\n❌ 所有连接都失败了！")
            print(f"   可能的原因：")
            print(f"   1. 服务器连接数达到上限（当前限制: 500）")
            print(f"   2. 服务器未运行或端口错误")
            print(f"   3. 网络问题或防火墙阻止")
            print(f"   建议：减少并发用户数或检查服务器状态")
        elif failed_count > 0:
            fail_rate = failed_count / self.num_users * 100
            if fail_rate > 30:
                print(f"\n⚠️  警告: 连接失败率较高 ({fail_rate:.1f}%)")
                print(f"   建议：")
                print(f"   1. 增加 ramp_up 时间（当前: {self.ramp_up}秒）")
                print(f"   2. 检查服务器连接数限制")
                print(f"   3. 检查服务器性能（CPU、内存、网络）")
            else:
                print(f"\n⚠️  连接状态: {connected_count} 成功, {failed_count} 失败 ({fail_rate:.1f}%)")
        
        # 等待所有任务完成
        await asyncio.gather(*tasks, return_exceptions=True)
        
        self.end_time = time.time()
        
        # 打印结果
        self.print_results()
    
    def print_results(self):
        """打印测试结果"""
        total_time = self.end_time - self.start_time
        
        connected_users = sum(1 for c in self.clients if c.stats.connected)
        login_users = sum(1 for c in self.clients if c.stats.login_success)
        active_users = sum(1 for c in self.clients if c.stats.total_requests > 0)
        
        total_requests = sum(s.count for s in self.global_stats.values())
        total_errors = sum(s.error_count for s in self.global_stats.values())
        total_success = sum(s.success_count for s in self.global_stats.values())
        
        print(f"\n{'='*60}")
        print(f"压力测试结果")
        print(f"{'='*60}")
        print(f"测试时长: {total_time:.2f} 秒")
        print(f"\n用户统计:")
        print(f"  总用户数: {self.num_users}")
        print(f"  成功连接: {connected_users} ({connected_users/self.num_users*100:.1f}%)")
        print(f"  成功登录: {login_users} ({login_users/self.num_users*100:.1f}%)")
        print(f"  活跃用户: {active_users} ({active_users/self.num_users*100:.1f}%)")
        print(f"\n请求统计:")
        print(f"  总请求数: {total_requests}")
        print(f"  成功请求: {total_success} ({total_success/total_requests*100:.1f}%)" if total_requests > 0 else "  成功请求: 0")
        print(f"  失败请求: {total_errors} ({total_errors/total_requests*100:.1f}%)" if total_requests > 0 else "  失败请求: 0")
        print(f"  平均QPS: {total_requests/total_time:.2f}" if total_time > 0 else "  平均QPS: 0")
        
        # 按路由统计
        print(f"\n按路由统计:")
        print(f"{'路由':<30} {'请求数':<10} {'成功率':<10} {'平均(ms)':<12} {'P95(ms)':<12} {'P99(ms)':<12}")
        print(f"{'-'*90}")
        
        for route, stats in sorted(self.global_stats.items(), key=lambda x: x[1].count, reverse=True):
            success_rate = (stats.success_count / stats.count * 100) if stats.count > 0 else 0
            avg_time = stats.get_avg_time() * 1000
            p95_time = stats.get_p95_time() * 1000
            p99_time = stats.get_p99_time() * 1000
            
            print(f"{route:<30} {stats.count:<10} {success_rate:<9.1f}% {avg_time:<11.2f} {p95_time:<11.2f} {p99_time:<11.2f}")
        
        # 响应时间分布
        all_response_times = []
        for stats in self.global_stats.values():
            all_response_times.extend(stats.response_times)
        
        if all_response_times:
            print(f"\n总体响应时间:")
            print(f"  平均: {statistics.mean(all_response_times)*1000:.2f} ms")
            print(f"  中位数: {statistics.median(all_response_times)*1000:.2f} ms")
            sorted_times = sorted(all_response_times)
            p95_index = int(len(sorted_times) * 0.95)
            p99_index = int(len(sorted_times) * 0.99)
            print(f"  P95: {sorted_times[min(p95_index, len(sorted_times)-1)]*1000:.2f} ms")
            print(f"  P99: {sorted_times[min(p99_index, len(sorted_times)-1)]*1000:.2f} ms")
            print(f"  最小: {min(all_response_times)*1000:.2f} ms")
            print(f"  最大: {max(all_response_times)*1000:.2f} ms")
        
        print(f"\n{'='*60}\n")


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='游戏服务器压力测试工具（完整功能版）')
    parser.add_argument('--host', type=str, default=None, help='服务器地址 (默认: localhost)')
    parser.add_argument('--port', type=int, default=None, help='服务器端口 (默认: 8001)')
    parser.add_argument('--users', type=int, default=None, help='并发用户数')
    parser.add_argument('--duration', type=float, default=None, help='测试时长（秒）')
    parser.add_argument('--ramp-up', type=float, default=None, help='逐步增加用户的时间（秒）')
    parser.add_argument('--high-frequency', action='store_true', help='启用高频模式')
    parser.add_argument('--test-mode', action='store_true', default=True, help='启用测试模式（最高权限，可随机生成数据）')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("游戏服务器压力测试工具（完整功能版）")
    print("=" * 60)
    print()
    
    # 输入参数
    if args.users is None:
        users_input = input("请输入并发玩家数（直接回车使用默认100）: ").strip()
        num_users = int(users_input) if users_input else 100
    else:
        num_users = args.users
    
    if args.duration is None:
        duration_input = input("请输入测试时长（秒，直接回车使用默认60）: ").strip()
        duration = float(duration_input) if duration_input else 60.0
    else:
        duration = args.duration
    
    host = args.host if args.host is not None else input("请输入服务器地址（直接回车使用默认localhost）: ").strip() or 'localhost'
    
    if args.port is None:
        port_input = input("请输入服务器端口（直接回车使用默认8001）: ").strip()
        port = int(port_input) if port_input else 8001
    else:
        port = args.port
    
    # 测试服务器连接
    print(f"\n正在测试服务器连接 {host}:{port}...")
    server_running = False
    try:
        import socket
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_socket.settimeout(3)
        result = test_socket.connect_ex((host, port))
        test_socket.close()
        if result == 0:
            print(f"✓ 服务器端口 {port} 可达，服务器正在运行")
            server_running = True
        else:
            print(f"\n❌ 无法连接到服务器 {host}:{port}")
            confirm = input("   是否继续测试？(y/n): ").strip().lower()
            if confirm not in ['y', 'yes', '是']:
                return
    except Exception as e:
        print(f"\n⚠️  连接测试失败: {e}")
        confirm = input("   是否继续测试？(y/n): ").strip().lower()
        if confirm not in ['y', 'yes', '是']:
            return
    
    if args.ramp_up is None:
        ramp_up_input = input("请输入逐步增加用户的时间（秒，直接回车使用默认10）: ").strip()
        ramp_up = float(ramp_up_input) if ramp_up_input else 10.0
    else:
        ramp_up = args.ramp_up
    
    if not args.high_frequency:
        mode_input = input("是否启用高频模式？(y/n，直接回车使用默认n): ").strip().lower()
        high_frequency = mode_input in ['y', 'yes', '是']
    else:
        high_frequency = True
    
    test_mode = args.test_mode if args.test_mode else True
    
    print()
    print("=" * 60)
    print("测试配置确认")
    print("=" * 60)
    print(f"服务器地址: {host}")
    print(f"服务器端口: {port}")
    print(f"并发玩家数: {num_users}")
    print(f"测试时长: {duration} 秒")
    print(f"逐步增加时间: {ramp_up} 秒")
    print(f"高频模式: {'启用' if high_frequency else '禁用'}")
    print(f"测试模式: {'启用（最高权限）' if test_mode else '禁用'}")
    print("=" * 60)
    print()
    
    confirm = input("确认开始测试？(y/n，直接回车开始): ").strip().lower()
    if confirm and confirm not in ['y', 'yes', '是', '']:
        print("测试已取消")
        return
    
    runner = StressTestRunner(
        host=host,
        port=port,
        num_users=num_users,
        duration=duration,
        ramp_up=ramp_up,
        high_frequency=high_frequency,
        test_mode=test_mode
    )
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
    except Exception as e:
        print(f"\n\n测试出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    asyncio.run(main())
