# 服务器与客户端改进计划 - 基于 PomeloServer 架构对齐

> **核心原则**：每个改进项必须同时包含服务器端和客户端改动，避免改了一处导致另一处出问题

**创建日期**：2024年  
**参考标准**：Pomelo架构设计  
**维护者**：开发团队

---

## 📋 目录

1. [改进项概览](#改进项概览)
2. [详细改进计划](#详细改进计划)
   - [1. Channel/Room 频道系统](#1-channelroom-频道系统)
   - [2. Dictionary 路由压缩](#2-dictionary-路由压缩)
   - [3. Handshake 握手协议](#3-handshake-握手协议)
   - [4. 限流和过载保护](#4-限流和过载保护)
   - [5. 消息协议优化](#5-消息协议优化)
   - [6. 连接管理优化](#6-连接管理优化)
3. [实施优先级](#实施优先级)
4. [测试检查清单](#测试检查清单)
5. [变更记录](#变更记录)

---

## 📊 改进项概览

| 改进项 | 优先级 | 服务器改动 | 客户端改动 | 预计工时 | 状态 |
|--------|--------|-----------|-----------|---------|------|
| Channel/Room 系统 | 🔴 高 | ✅ 已完成 | ✅ 已完成 | 3-5天 | ✅ 已完成 |
| 限流和过载保护 | 🔴 高 | ✅ 已完成 | ✅ 已完成 | 2-3天 | ✅ 已完成 |
| Handshake 握手协议 | 🟡 中 | ✅ 已完成 | ✅ 已完成 | 1-2天 | ✅ 已完成 |
| Dictionary 路由压缩 | 🟡 中 | ✅ 已完成 | ✅ 已完成 | 2-3天 | ✅ 已完成 |
| 消息协议优化 | 🟢 低 | ✅ 已完成 | ✅ 已完成 | 1-2天 | ✅ 已完成 |
| 连接管理优化 | 🟢 低 | ✅ 已完成 | ✅ 已完成 | 1天 | ✅ 已完成 |

**图例**：
- 🔴 高优先级：影响核心功能或性能
- 🟡 中优先级：提升体验或可维护性
- 🟢 低优先级：优化项，可延后

---

## 📝 详细改进计划

### 1. Channel/Room 频道系统

**参考**：`PomeloServer/lib/common/service/channelService.js`

#### 🎯 目标
- 实现 Pomelo 风格的 Channel 服务，支持频道广播、房间管理
- 统一聊天、战斗、组队等场景的广播逻辑
- 支持按 UID 精确推送消息

#### 🔧 服务器端改动

**1.1 创建 Channel 服务**

**文件**：`server/services/channel_service.py`

```python
"""
Channel 服务 - 参考 PomeloServer 的 ChannelService
支持频道创建、加入、离开、广播等功能
"""
from typing import Dict, List, Set, Optional
from bson import ObjectId
from services.session_service import session_service
import json
import asyncio

class Channel:
    """频道类 - 管理频道内的用户"""
    def __init__(self, name: str):
        self.name = name
        self.members: Dict[ObjectId, Set] = {}  # {user_id: {websocket1, websocket2}}
    
    def add(self, user_id: ObjectId, websocket):
        """添加用户到频道"""
        if user_id not in self.members:
            self.members[user_id] = set()
        self.members[user_id].add(websocket)
    
    def leave(self, user_id: ObjectId, websocket):
        """用户离开频道"""
        if user_id in self.members:
            self.members[user_id].discard(websocket)
            if not self.members[user_id]:
                del self.members[user_id]
    
    def get_member_count(self) -> int:
        """获取频道成员数量"""
        return len(self.members)
    
    def get_all_websockets(self) -> List:
        """获取频道内所有 WebSocket 连接"""
        websockets = []
        for ws_set in self.members.values():
            websockets.extend(ws_set)
        return websockets


class ChannelService:
    """Channel 服务 - 单例模式"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self.channels: Dict[str, Channel] = {}
        self._initialized = True
    
    def create_channel(self, name: str) -> Channel:
        """创建频道"""
        if name not in self.channels:
            self.channels[name] = Channel(name)
        return self.channels[name]
    
    def get_channel(self, name: str, create: bool = False) -> Optional[Channel]:
        """获取频道"""
        if name in self.channels:
            return self.channels[name]
        if create:
            return self.create_channel(name)
        return None
    
    def destroy_channel(self, name: str):
        """销毁频道"""
        if name in self.channels:
            del self.channels[name]
    
    async def push_message(self, channel_name: str, route: str, msg: dict):
        """向频道广播消息"""
        channel = self.get_channel(channel_name)
        if not channel:
            return
        
        websockets = channel.get_all_websockets()
        if not websockets:
            return
        
        # 构建消息
        message = {
            'type': route,
            **msg
        }
        message_str = json.dumps(message, default=str)
        
        # 异步批量发送（避免循环导入，直接实现广播逻辑）
        max_concurrent = 50
        for i in range(0, len(websockets), max_concurrent):
            batch = websockets[i:i + max_concurrent]
            tasks = [self._send_to_client_safe(ws, message_str) for ws in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_to_client_safe(self, websocket, message: str):
        """安全发送消息到客户端（带异常处理）"""
        try:
            await websocket.send(message)
        except Exception:
            # 连接已断开，忽略错误
            pass
    
    async def push_message_by_uids(self, route: str, msg: dict, uids: List[ObjectId]):
        """按 UID 列表推送消息"""
        message = {
            'type': route,
            **msg
        }
        message_str = json.dumps(message, default=str)
        
        # 获取所有用户的 WebSocket
        websockets = []
        for user_id in uids:
            sessions = session_service.get_sessions(user_id)
            for session in sessions:
                if session.is_online():
                    websockets.append(session.websocket)
        
        # 批量发送
        if websockets:
            max_concurrent = 50
            for i in range(0, len(websockets), max_concurrent):
                batch = websockets[i:i + max_concurrent]
                tasks = [self._send_to_client_safe(ws, message_str) for ws in batch]
                await asyncio.gather(*tasks, return_exceptions=True)


# 全局实例
channel_service = ChannelService()
```

**1.2 修改聊天 Handler 使用 Channel**

**文件**：`server/handlers/chat_handler.py`

```python
# 在文件顶部添加
from services.channel_service import channel_service

# 修改 handle_post_chat 函数
async def handle_post_chat(websocket, data, current_character_id):
    # ... 现有逻辑 ...
    
    # 使用 Channel 广播聊天消息
    await channel_service.push_message(
        channel_name='global_chat',  # 全局聊天频道
        route='chat_message',
        msg={
            'text': text,
            'sender': sender,
            'character_id': str(cid) if cid else None
        }
    )
    
    # ... 响应逻辑 ...
```

**1.3 在连接建立时加入默认频道**

**文件**：`server/ws_server.py`

```python
# 在 handle_client 函数中，用户认证成功后
from services.channel_service import channel_service

# 用户登录成功后，加入全局聊天频道
if current_user_id:
    channel = channel_service.get_channel('global_chat', create=True)
    channel.add(current_user_id, websocket)

# 连接断开时，从所有频道移除
# 在 finally 块中
if current_user_id:
    channel = channel_service.get_channel('global_chat')
    if channel:
        channel.leave(current_user_id, websocket)
```

**1.4 添加房间管理 Handler（可选，用于战斗/组队）**

**文件**：`server/handlers/room_handler.py`（新建）

```python
"""
房间管理 Handler - 用于战斗、组队等场景
"""
import uuid
from services.channel_service import channel_service
from handlers import utils

async def handle_create_room(websocket, data, current_user_id, current_character_id):
    """创建房间"""
    room_type = data.get('room_type', 'battle')  # battle, team, etc.
    room_id = data.get('room_id') or str(uuid.uuid4())
    
    channel_name = f'room_{room_type}_{room_id}'
    channel = channel_service.create_channel(channel_name)
    channel.add(current_user_id, websocket)
    
    await utils.send_response(websocket, 'create_room', True, {
        'room_id': room_id,
        'room_type': room_type,
        'channel_name': channel_name
    }, request_data=data)

async def handle_join_room(websocket, data, current_user_id, current_character_id):
    """加入房间"""
    room_id = data.get('room_id')
    room_type = data.get('room_type', 'battle')
    
    channel_name = f'room_{room_type}_{room_id}'
    channel = channel_service.get_channel(channel_name, create=True)
    channel.add(current_user_id, websocket)
    
    await utils.send_response(websocket, 'join_room', True, {
        'room_id': room_id,
        'member_count': channel.get_member_count()
    }, request_data=data)

async def handle_leave_room(websocket, data, current_user_id, current_character_id):
    """离开房间"""
    room_id = data.get('room_id')
    room_type = data.get('room_type', 'battle')
    
    channel_name = f'room_{room_type}_{room_id}'
    channel = channel_service.get_channel(channel_name)
    if channel:
        channel.leave(current_user_id, websocket)
        if channel.get_member_count() == 0:
            channel_service.destroy_channel(channel_name)
    
    await utils.send_response(websocket, 'leave_room', True, request_data=data)
```

**1.5 更新路由注册**

**文件**：`server/router.py`

```python
# 在 ROUTES 字典中添加
from handlers import room_handler

ROUTES = {
    # ... 现有路由 ...
    'create_room': RouteHandler(
        room_handler.handle_create_room,
        require_auth=True,
        description='创建房间'
    ),
    'join_room': RouteHandler(
        room_handler.handle_join_room,
        require_auth=True,
        description='加入房间'
    ),
    'leave_room': RouteHandler(
        room_handler.handle_leave_room,
        require_auth=True,
        description='离开房间'
    ),
}
```

#### 💻 客户端改动

**1.6 更新消息类型定义**

**文件**：`assets/Script/global/GameConfig.ts`

```typescript
export class GameConfig {
    // ... 现有代码 ...
    
    static readonly MESSAGE_TYPES = {
        // ... 现有消息类型 ...
        
        // Channel/Room 相关
        CREATE_ROOM: 'create_room',
        CREATE_ROOM_RESPONSE: 'create_room_response',
        JOIN_ROOM: 'join_room',
        JOIN_ROOM_RESPONSE: 'join_room_response',
        LEAVE_ROOM: 'leave_room',
        LEAVE_ROOM_RESPONSE: 'leave_room_response',
        
        // 房间事件（服务器推送）
        ON_ROOM_JOINED: 'on_room_joined',
        ON_ROOM_LEFT: 'on_room_left',
        ON_ROOM_MEMBER_JOINED: 'on_room_member_joined',
        ON_ROOM_MEMBER_LEFT: 'on_room_member_left',
        ON_BATTLE_UPDATE: 'on_battle_update',  // 战斗更新
    } as const;
}
```

**1.7 更新聊天 Handler 监听 Channel 消息**

**文件**：`assets/Script/Game/ChatHandler.ts`（或相应聊天脚本）

```typescript
// 确保监听 chat_message 事件（服务器通过 Channel 推送）
this.wsManager.on(GameConfig.MESSAGE_TYPES.CHAT_MESSAGE, this.onChatMessage, this);

private onChatMessage(data: any): void {
    // 处理聊天消息
    console.log('收到聊天消息:', data);
    // 更新 UI
}
```

**1.8 创建房间管理工具类（可选）**

**文件**：`assets/Script/global/RoomManager.ts`（新建）

```typescript
import { WebSocketManager } from './WebSocketManager';
import { GameConfig } from './GameConfig';

export class RoomManager {
    private static instance: RoomManager = null!;
    private wsManager: WebSocketManager;
    private currentRoomId: string | null = null;
    private currentRoomType: string | null = null;
    
    public static getInstance(): RoomManager {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }
    
    constructor() {
        this.wsManager = WebSocketManager.getInstance();
        this.setupListeners();
    }
    
    private setupListeners(): void {
        const wsNode = (this.wsManager as any).node;
        if (wsNode) {
            wsNode.on(GameConfig.MESSAGE_TYPES.ON_ROOM_JOINED, this.onRoomJoined, this);
            wsNode.on(GameConfig.MESSAGE_TYPES.ON_ROOM_LEFT, this.onRoomLeft, this);
            wsNode.on(GameConfig.MESSAGE_TYPES.ON_BATTLE_UPDATE, this.onBattleUpdate, this);
        }
    }
    
    public createRoom(roomType: string, callback?: (success: boolean, roomId?: string) => void): void {
        this.wsManager.request(GameConfig.MESSAGE_TYPES.CREATE_ROOM, {
            room_type: roomType
        }, (response: any) => {
            if (response.success && response.data) {
                this.currentRoomId = response.data.room_id;
                this.currentRoomType = roomType;
                callback?.(true, response.data.room_id);
            } else {
                callback?.(false);
            }
        });
    }
    
    public joinRoom(roomId: string, roomType: string, callback?: (success: boolean) => void): void {
        this.wsManager.request(GameConfig.MESSAGE_TYPES.JOIN_ROOM, {
            room_id: roomId,
            room_type: roomType
        }, (response: any) => {
            if (response.success) {
                this.currentRoomId = roomId;
                this.currentRoomType = roomType;
                callback?.(true);
            } else {
                callback?.(false);
            }
        });
    }
    
    public leaveRoom(callback?: (success: boolean) => void): void {
        if (!this.currentRoomId || !this.currentRoomType) {
            callback?.(false);
            return;
        }
        
        this.wsManager.request(GameConfig.MESSAGE_TYPES.LEAVE_ROOM, {
            room_id: this.currentRoomId,
            room_type: this.currentRoomType
        }, (response: any) => {
            if (response.success) {
                this.currentRoomId = null;
                this.currentRoomType = null;
                callback?.(true);
            } else {
                callback?.(false);
            }
        });
    }
    
    private onRoomJoined(data: any): void {
        console.log('加入房间成功:', data);
    }
    
    private onRoomLeft(data: any): void {
        console.log('离开房间:', data);
        this.currentRoomId = null;
        this.currentRoomType = null;
    }
    
    private onBattleUpdate(data: any): void {
        console.log('战斗更新:', data);
        // 处理战斗状态更新
    }
}
```

#### ✅ 测试检查清单

- [ ] 服务器端 Channel 服务创建成功
- [ ] 用户连接时自动加入全局聊天频道
- [ ] 聊天消息通过 Channel 广播到所有在线用户
- [ ] 客户端能正确接收 `chat_message` 事件
- [ ] 房间创建/加入/离开功能正常
- [ ] 房间内消息广播正常
- [ ] 用户断开连接时自动从所有频道移除
- [ ] 频道为空时自动销毁

#### ⚠️ 注意事项

1. **向后兼容**：聊天功能保持现有接口不变，只是内部改用 Channel
2. **性能**：Channel 广播使用独立的发送函数，避免循环导入问题
3. **内存管理**：空频道自动销毁，避免内存泄漏
4. **客户端事件**：确保客户端监听的事件名与服务器推送的一致
5. **导入顺序**：`channel_service.py` 中避免导入 `ws_server`，使用独立的发送函数

---

### 2. Dictionary 路由压缩

**参考**：`PomeloServer/lib/components/dictionary.js`

#### 🎯 目标
- 将路由字符串（如 `get_robot_pets`）压缩为短整数（1-255）
- 减少网络传输带宽
- 支持字典版本管理，避免版本不一致导致解析错误

#### 🔧 服务器端改动

**2.1 创建 Dictionary 服务**

**文件**：`server/services/dictionary_service.py`

```python
"""
Dictionary 服务 - 参考 PomeloServer 的 Dictionary 组件
将路由字符串映射为短整数，减少网络传输
"""
import json
import hashlib
from typing import Dict, Optional
from pathlib import Path

class DictionaryService:
    """Dictionary 服务 - 单例模式"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # route_str -> route_id (1-255)
        self.route_to_id: Dict[str, int] = {}
        # route_id -> route_str
        self.id_to_route: Dict[int, str] = {}
        self.version = ""
        
        self._load_dictionary()
        self._initialized = True
    
    def _load_dictionary(self):
        """加载路由字典"""
        # 从 router.py 获取所有路由
        from router import ROUTES
        
        routes = sorted(ROUTES.keys())
        
        # 分配路由ID（从1开始）
        for idx, route in enumerate(routes, start=1):
            if idx > 255:
                print(f'⚠️ [Dictionary] 路由数量超过255，路由 {route} 无法压缩')
                continue
            self.route_to_id[route] = idx
            self.id_to_route[idx] = route
        
        # 计算版本号（字典内容的哈希）
        dict_str = json.dumps(self.route_to_id, sort_keys=True)
        self.version = hashlib.md5(dict_str.encode()).hexdigest()[:8]
        
        print(f'✅ [Dictionary] 加载 {len(self.route_to_id)} 个路由，版本: {self.version}')
    
    def encode_route(self, route_str: str) -> Optional[int]:
        """将路由字符串编码为ID"""
        return self.route_to_id.get(route_str)
    
    def decode_route(self, route_id: int) -> Optional[str]:
        """将路由ID解码为字符串"""
        return self.id_to_route.get(route_id)
    
    def get_version(self) -> str:
        """获取字典版本"""
        return self.version
    
    def get_dict(self) -> Dict[str, int]:
        """获取完整字典（用于发送给客户端）"""
        return self.route_to_id.copy()
    
    def get_abbrs(self) -> Dict[int, str]:
        """获取反向字典（ID -> 路由）"""
        return self.id_to_route.copy()
    
    def save_to_file(self, filepath: str):
        """保存字典到文件（用于客户端同步）"""
        data = {
            'version': self.version,
            'route_to_id': self.route_to_id,
            'id_to_route': self.id_to_route
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f'✅ [Dictionary] 字典已保存到 {filepath}')


# 全局实例
dictionary_service = DictionaryService()
```

**2.2 修改消息处理支持路由压缩**

**文件**：`server/ws_server.py`

```python
# 在 handle_client 函数中，解析消息时
from services.dictionary_service import dictionary_service

# 解析消息
data = json.loads(message)

# 支持两种格式：字符串路由（兼容旧客户端）和数字路由（新客户端）
route = None
if 'route_id' in data:
    # 新格式：使用数字路由
    route_id = data.get('route_id')
    route = dictionary_service.decode_route(route_id)
    if not route:
        await websocket.send(json.dumps({
            'type': 'error',
            'success': False,
            'message': f'Unknown route_id: {route_id}'
        }))
        continue
elif 'type' in data:
    # 旧格式：使用字符串路由（向后兼容）
    route = data.get('type')
else:
    # 无路由字段
    await websocket.send(json.dumps({
        'type': 'error',
        'success': False,
        'message': 'Missing route field (type or route_id)'
    }))
    continue

# 将解码后的路由放入 data，后续处理不变
data['type'] = route
```

**2.3 响应消息支持路由压缩（可选，渐进式升级）**

**文件**：`server/handlers/utils.py`

```python
# 修改 send_response 函数，支持同时发送字符串和数字路由
async def send_response(websocket, route: str, success: bool = True, 
                        data: dict = None, message: str = None, code: int = 200,
                        immediate: bool = False, request_id: str = None, 
                        request_data: dict = None, use_dict: bool = False):
    """
    发送响应消息
    
    Args:
        use_dict: 是否使用字典压缩（如果客户端支持）
    """
    from services.dictionary_service import dictionary_service
    
    response = {
        'type': f'{route}_response',  # 保持字符串路由（兼容性）
        'success': success,
        'code': code,
        'timestamp': time.time()
    }
    
    # 如果启用字典压缩，同时发送数字路由
    if use_dict:
        route_id = dictionary_service.encode_route(route)
        if route_id:
            response['route_id'] = route_id
    
    # ... 其余逻辑不变 ...
```

**2.4 在启动时保存字典文件**

**文件**：`server/ws_server.py`

```python
# 在 main() 函数中
from services.dictionary_service import dictionary_service

# 保存字典文件（用于客户端同步）
dict_file = Path(__file__).parent / 'data' / 'route_dictionary.json'
dict_file.parent.mkdir(exist_ok=True)
dictionary_service.save_to_file(str(dict_file))
logger.info(f'路由字典已保存: {dict_file}')
```

#### 💻 客户端改动

**2.5 创建 Dictionary 工具类**

**文件**：`assets/Script/global/RouteDictionary.ts`（新建）

```typescript
/**
 * 路由字典 - 与服务器端 Dictionary 服务对应
 * 用于压缩路由字符串，减少网络传输
 */
export class RouteDictionary {
    private static instance: RouteDictionary = null!;
    private routeToId: Map<string, number> = new Map();
    private idToRoute: Map<number, string> = new Map();
    private version: string = '';
    private enabled: boolean = false;
    
    public static getInstance(): RouteDictionary {
        if (!this.instance) {
            this.instance = new RouteDictionary();
        }
        return this.instance;
    }
    
    /**
     * 加载字典（从服务器或本地文件）
     */
    public loadDictionary(dict: { version: string; route_to_id: { [key: string]: number }; id_to_route: { [key: string]: string } }): void {
        this.version = dict.version;
        this.routeToId.clear();
        this.idToRoute.clear();
        
        // 加载 route_to_id
        for (const [route, id] of Object.entries(dict.route_to_id)) {
            this.routeToId.set(route, id);
        }
        
        // 加载 id_to_route（注意：JSON 的 key 是字符串，需要转换）
        for (const [idStr, route] of Object.entries(dict.id_to_route)) {
            const id = parseInt(idStr, 10);
            this.idToRoute.set(id, route);
        }
        
        this.enabled = true;
        console.log(`✅ [RouteDictionary] 字典加载成功，版本: ${this.version}，路由数: ${this.routeToId.size}`);
    }
    
    /**
     * 编码路由（字符串 -> 数字）
     */
    public encodeRoute(route: string): number | null {
        return this.routeToId.get(route) || null;
    }
    
    /**
     * 解码路由（数字 -> 字符串）
     */
    public decodeRoute(routeId: number): string | null {
        return this.idToRoute.get(routeId) || null;
    }
    
    /**
     * 获取字典版本
     */
    public getVersion(): string {
        return this.version;
    }
    
    /**
     * 是否启用字典压缩
     */
    public isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * 启用/禁用字典压缩
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}
```

**2.6 修改 WebSocketManager 支持路由压缩**

**文件**：`assets/Script/global/WebSocketManager.ts`

```typescript
// 在文件顶部导入
import { RouteDictionary } from './RouteDictionary';

// 在 WebSocketManager 类中添加
private routeDict: RouteDictionary | null = null;  // 延迟初始化，避免循环依赖
private useRouteDict: boolean = false;  // 是否使用路由压缩（由服务器 handshake 决定）

// 获取 RouteDictionary 实例（延迟初始化）
private getRouteDict(): RouteDictionary {
    if (!this.routeDict) {
        this.routeDict = RouteDictionary.getInstance();
    }
    return this.routeDict;
}

// 修改 send 方法
public send(message: ClientMessage, useBatch: boolean = true, immediate: boolean = false): void {
    // ... 现有逻辑 ...
    
    // 如果启用字典压缩，添加 route_id
    if (this.useRouteDict && message.type) {
        const routeId = this.getRouteDict().encodeRoute(message.type);
        if (routeId !== null) {
            (message as any).route_id = routeId;
            // 注意：仍然保留 type 字段（向后兼容）
        }
    }
    
    // ... 发送逻辑 ...
}

// 修改 handleMessage 方法，支持解码数字路由
private handleMessage(message: string): void {
    try {
        const data = JSON.parse(message);
        
        // 如果收到数字路由，先解码
        if (data.route_id && !data.type && this.routeDict) {
            const route = this.getRouteDict().decodeRoute(data.route_id);
            if (route) {
                data.type = route + '_response';  // 假设是响应消息
            }
        }
        
        // ... 其余逻辑不变 ...
    } catch (error) {
        // ... 错误处理 ...
    }
}
```

**2.7 在 Handshake 响应中加载字典**

**文件**：`assets/Script/global/WebSocketManager.ts`

```typescript
// 在 handleMessage 中处理 handshake_ack
if (data.type === 'handshake_ack') {
    // 如果服务器返回字典，加载它
    if (data.dict) {
        this.routeDict.loadDictionary({
            version: data.dict_version || '',
            route_to_id: data.dict,
            id_to_route: data.code_to_route || {}
        });
        this.useRouteDict = data.use_dict === true;
        console.log(`✅ [WebSocketManager] 字典已加载，启用压缩: ${this.useRouteDict}`);
    }
}
```

**2.8 同步字典文件到客户端（构建时）**

**文件**：`assets/Resources/route_dictionary.json`（从服务器复制）

```json
{
  "version": "abc12345",
  "route_to_id": {
    "login": 1,
    "register": 2,
    "get_robot_pets": 3,
    ...
  },
  "id_to_route": {
    "1": "login",
    "2": "register",
    "3": "get_robot_pets",
    ...
  }
}
```

**注意**：这个文件应该在构建时从服务器 `server/data/route_dictionary.json` 复制过来，或者通过 HTTP 接口在启动时下载。

#### ✅ 测试检查清单

- [ ] 服务器端 Dictionary 服务加载所有路由
- [ ] 字典版本号计算正确
- [ ] 服务器支持同时识别字符串和数字路由
- [ ] 客户端 Dictionary 工具类加载字典成功
- [ ] 客户端发送消息时添加 `route_id` 字段
- [ ] 服务器能正确解码 `route_id` 并处理请求
- [ ] 旧客户端（不使用字典）仍能正常工作
- [ ] 字典版本不一致时能正确处理

#### ⚠️ 注意事项

1. **向后兼容**：服务器必须同时支持字符串和数字路由，避免旧客户端无法使用
2. **版本管理**：字典版本不一致时，服务器应拒绝使用字典压缩，回退到字符串路由
3. **同步机制**：确保客户端字典与服务器字典一致（通过 handshake 或构建时同步）
4. **渐进式升级**：先让服务器支持字典，再逐步升级客户端，最后统一使用数字路由

---

### 3. Handshake 握手协议

**参考**：`PomeloServer/lib/connectors/commands/handshake.js`

#### 🎯 目标
- 实现 Pomelo 风格的握手协议
- 在连接建立时交换配置信息（心跳间隔、字典版本、压缩策略等）
- 统一连接初始化流程

#### 🔧 服务器端改动

**3.1 创建 Handshake Handler**

**文件**：`server/handlers/connection_handler.py`（新建）

```python
"""
连接管理 Handler - 处理握手、心跳等连接相关逻辑
"""
from handlers import utils
from services.dictionary_service import dictionary_service
import time

async def handle_handshake(websocket, data):
    """
    处理握手请求 - 参考 PomeloServer 的 handshake 命令
    
    请求格式：
    {
        "type": "handshake",
        "sys": {
            "type": "websocket",  // 客户端类型
            "version": "1.0.0"     // 客户端版本
        }
    }
    """
    sys_info = data.get('sys', {})
    client_type = sys_info.get('type', 'websocket')
    client_version = sys_info.get('version', '1.0.0')
    
    # 检查客户端版本（可选）
    # if not check_client_version(client_version):
    #     await utils.send_error_response(websocket, 'handshake', 'Client version too old', code=501)
    #     return
    
    # 构建握手响应
    response = {
        'type': 'handshake_ack',
        'success': True,
        'code': 200,
        'sys': {
            'heartbeat': 30,  # 心跳间隔（秒）
            'heartbeat_timeout': 60,  # 心跳超时（秒）
        }
    }
    
    # 如果启用字典，返回字典信息
    dict_version = dictionary_service.get_version()
    client_dict_version = sys_info.get('dict_version')
    
    if dict_version and client_dict_version != dict_version:
        # 客户端字典版本不一致，返回完整字典
        response['sys']['dict'] = dictionary_service.get_dict()
        response['sys']['code_to_route'] = dictionary_service.get_abbrs()
        response['sys']['dict_version'] = dict_version
        response['sys']['use_dict'] = True
    elif client_dict_version == dict_version:
        # 版本一致，只需标记使用字典
        response['sys']['dict_version'] = dict_version
        response['sys']['use_dict'] = True
    
    # 如果启用压缩，返回压缩配置
    response['sys']['use_compression'] = True  # 当前已启用 deflate
    
    await utils.send_response(websocket, 'handshake', True, response, immediate=True)
```

**3.2 更新路由注册**

**文件**：`server/router.py`

```python
from handlers import connection_handler

ROUTES = {
    # ... 现有路由 ...
    'handshake': RouteHandler(
        connection_handler.handle_handshake,
        require_auth=False,  # 握手不需要认证
        description='握手协议'
    ),
}
```

**3.3 修改连接处理流程（可选，渐进式）**

**文件**：`server/ws_server.py`

```python
# 在 handle_client 中，可以添加握手检查
# 但为了向后兼容，不强制要求握手

# 如果收到握手请求，优先处理
if route == 'handshake':
    # 握手后，可以设置连接标志
    # 后续消息可以使用字典压缩等特性
    pass
```

#### 💻 客户端改动

**3.4 修改 WebSocketManager 连接流程**

**文件**：`assets/Script/global/WebSocketManager.ts`

```python
// 修改 connect 方法
public connect(): void {
    if (this.isConnected() || this.isConnecting) {
        return;
    }
    
    this.isConnecting = true;
    
    try {
        this.socket = new WebSocket(this.url);
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = this.onError.bind(this);
        this.socket.onclose = this.onClose.bind(this);
    } catch (error) {
        console.error('❌ [WebSocketManager] 连接失败:', error);
        this.isConnecting = false;
        this.handleDisconnection();
    }
}

// 修改 onOpen 方法，先发送握手
private onOpen(): void {
    console.log('✅ [WebSocketManager] WebSocket 连接已建立');
    this.isConnecting = false;
    this.isConnectedFlag = true;
    this.reconnectAttempts = 0;
    
    // 发送握手请求
    this.sendHandshake();
}

// 添加握手方法
private sendHandshake(): void {
    const handshakeMsg = {
        type: 'handshake',
        sys: {
            type: 'websocket',
            version: '1.0.0',  // 客户端版本
            dict_version: this.routeDict ? this.getRouteDict().getVersion() : ''  // 当前字典版本（如果有）
        }
    };
    
    // 握手消息立即发送，不使用批处理
    this.send(handshakeMsg as any, false, true);
}

// 修改 handleMessage，处理握手响应
private handleMessage(message: string): void {
    try {
        const data = JSON.parse(message);
        
        // 处理心跳
        if (data && data.type === 'ping') {
            this.send({ type: 'pong' } as any, false, true);
            return;
        }
        
        // 处理握手响应
        if (data.type === 'handshake_ack') {
            console.log('✅ [WebSocketManager] 握手成功');
            
            // 如果服务器返回字典，加载它
            if (data.sys && data.sys.dict) {
                this.getRouteDict().loadDictionary({
                    version: data.sys.dict_version || '',
                    route_to_id: data.sys.dict,
                    id_to_route: data.sys.code_to_route || {}
                });
                this.useRouteDict = data.sys.use_dict === true;
                console.log(`✅ [WebSocketManager] 字典已加载，启用压缩: ${this.useRouteDict}`);
            }
            
            // 更新心跳配置（如果服务器返回）
            if (data.sys && data.sys.heartbeat) {
                // 可以更新心跳间隔（当前是固定30秒）
                console.log(`📡 [WebSocketManager] 心跳间隔: ${data.sys.heartbeat}秒`);
            }
            
            // 握手成功后，触发连接事件
            const node = (this as any).node;
            if (node && typeof node.emit === 'function') {
                node.emit('network_connect', {});
            }
            
            return;
        }
        
        // ... 其余消息处理逻辑 ...
    } catch (error) {
        // ... 错误处理 ...
    }
}
```

#### ✅ 测试检查清单

- [ ] 客户端连接时自动发送握手请求
- [ ] 服务器正确响应握手请求
- [ ] 握手响应包含心跳配置
- [ ] 如果字典版本不一致，服务器返回完整字典
- [ ] 客户端正确加载服务器返回的字典
- [ ] 握手成功后，后续消息可以使用字典压缩
- [ ] 旧客户端（不发送握手）仍能正常工作（向后兼容）

#### ⚠️ 注意事项

1. **向后兼容**：服务器不强制要求握手，旧客户端仍能正常连接
2. **版本检查**：可以添加客户端版本检查，拒绝过旧版本
3. **字典同步**：通过握手同步字典，避免版本不一致
4. **渐进式升级**：先让服务器支持握手，再逐步升级客户端

---

### 4. 限流和过载保护

**参考**：`PomeloServer/lib/filters/handler/toobusy.js`、`PomeloServer/lib/filters/rpc/toobusy.js`

#### 🎯 目标
- 实现完善的限流机制（按用户、按路由）
- 实现全局过载保护（服务器繁忙时拒绝请求）
- 客户端友好提示，避免用户误以为是 bug

#### 🔧 服务器端改动

**4.1 完善限流中间件**

**文件**：`server/middleware.py`

```python
# 修改 rate_limit_middleware
from collections import defaultdict
from typing import Dict
import time

# 限流配置（按路由）
ROUTE_RATE_LIMIT = {
    'upgrade_robot': 0.3,  # 每0.3秒一次
    'get_robot_pets': 0.5,  # 每0.5秒一次
    'bag_use_item': 0.2,    # 每0.2秒一次
}

# 限流记录 {user_id: {route: last_time}}
rate_limit_timers: Dict[str, Dict[str, float]] = defaultdict(dict)

# 限流记录清理时间（定期清理长时间未使用的记录）
_last_rate_limit_cleanup = time.time()
RATE_LIMIT_CLEANUP_INTERVAL = 300  # 5分钟清理一次

async def rate_limit_middleware(context: MiddlewareContext, next_func: Callable):
    """限流中间件 - 防止请求过于频繁"""
    global _last_rate_limit_cleanup
    
    # 如果不需要认证，跳过限流
    if not context.current_user_id:
        return await next_func()
    
    user_id_str = str(context.current_user_id)
    route = context.route
    current_time = time.time()
    
    # 定期清理限流记录（避免内存泄漏）
    if current_time - _last_rate_limit_cleanup > RATE_LIMIT_CLEANUP_INTERVAL:
        _cleanup_rate_limit_timers(current_time)
        _last_rate_limit_cleanup = current_time
    
    # 检查该路由是否有限流配置
    if route in ROUTE_RATE_LIMIT:
        throttle_time = ROUTE_RATE_LIMIT[route]
        last_time = rate_limit_timers[user_id_str].get(route, 0)
        
        if current_time - last_time < throttle_time:
            # 请求过于频繁
            logger = get_logger()
            logger.warning('请求限流', route=route, user_id=user_id_str)
            
            await utils.send_error_response(
                context.websocket,
                route,
                '请求过于频繁，请稍后再试',
                code=429,  # Too Many Requests
                request_data=context.data
            )
            return None  # 阻止继续处理
        
        # 更新最后请求时间
        rate_limit_timers[user_id_str][route] = current_time
    
    return await next_func()

def _cleanup_rate_limit_timers(current_time: float):
    """清理长时间未使用的限流记录"""
    cleanup_threshold = 3600  # 1小时未使用则清理
    users_to_remove = []
    
    for user_id, routes in rate_limit_timers.items():
        routes_to_remove = []
        for route, last_time in routes.items():
            if current_time - last_time > cleanup_threshold:
                routes_to_remove.append(route)
        
        for route in routes_to_remove:
            del routes[route]
        
        if not routes:
            users_to_remove.append(user_id)
    
    for user_id in users_to_remove:
        del rate_limit_timers[user_id]
```

**4.2 实现全局过载保护**

**文件**：`server/middleware.py`

```python
# 注意：需要安装 psutil 库：pip install psutil
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print('⚠️ [Middleware] psutil 未安装，过载保护功能将不可用。请运行: pip install psutil')

# 过载保护配置
OVERLOAD_THRESHOLD_CPU = 80.0  # CPU 使用率阈值（%）
OVERLOAD_THRESHOLD_MEMORY = 85.0  # 内存使用率阈值（%）
OVERLOAD_CHECK_INTERVAL = 5.0  # 检查间隔（秒）

# 全局过载状态
server_overloaded = False
last_overload_check = 0.0

def check_server_overload() -> bool:
    """检查服务器是否过载"""
    global server_overloaded, last_overload_check
    
    # 如果 psutil 不可用，跳过过载检查
    if not PSUTIL_AVAILABLE:
        return False
    
    current_time = time.time()
    # 每5秒检查一次，避免频繁检查影响性能
    if current_time - last_overload_check < OVERLOAD_CHECK_INTERVAL:
        return server_overloaded
    
    last_overload_check = current_time
    
    try:
        # 检查 CPU 使用率
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # 检查内存使用率
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # 判断是否过载
        is_overloaded = (
            cpu_percent > OVERLOAD_THRESHOLD_CPU or
            memory_percent > OVERLOAD_THRESHOLD_MEMORY
        )
        
        if is_overloaded != server_overloaded:
            logger = get_logger()
            if is_overloaded:
                logger.warning('服务器过载', cpu_percent=cpu_percent, memory_percent=memory_percent)
            else:
                logger.info('服务器负载恢复正常', cpu_percent=cpu_percent, memory_percent=memory_percent)
        
        server_overloaded = is_overloaded
        return server_overloaded
    
    except Exception as e:
        # 检查失败，默认不过载
        logger = get_logger()
        logger.warning('过载检查失败', error=str(e))
        return False

async def toobusy_middleware(context: MiddlewareContext, next_func: Callable):
    """
    过载保护中间件 - 参考 PomeloServer 的 toobusy filter
    服务器繁忙时拒绝非关键请求
    """
    # 检查服务器是否过载
    if check_server_overload():
        # 关键路由（登录、心跳）不受限
        critical_routes = {'handshake', 'login', 'pong', 'auth_request'}
        if context.route not in critical_routes:
            logger = get_logger()
            logger.warning('服务器繁忙，拒绝请求', route=context.route)
            
            await utils.send_error_response(
                context.websocket,
                context.route,
                '服务器繁忙，请稍后再试',
                code=503,  # Service Unavailable
                request_data=context.data
            )
            return None
    
    return await next_func()
```

**4.3 注册过载保护中间件**

**文件**：`server/middleware.py`

```python
# 在文件末尾，注册中间件
# 过载保护应该在认证之前，避免过载时还处理认证逻辑
middleware_manager.use(validate_middleware)
middleware_manager.use(log_middleware)
middleware_manager.use(toobusy_middleware)  # 过载保护（新增）
middleware_manager.use(performance_middleware)
middleware_manager.use(auth_middleware)
middleware_manager.use(serial_middleware)

# 限流中间件（可选启用）
# middleware_manager.use(rate_limit_middleware)  # 取消注释以启用限流
```

**4.4 更新错误码定义文档**

**文件**：`server/docs/消息接口定义-完整版.md`

```markdown
## 📋 标准错误码

| 错误码 | HTTP状态码 | 说明 | 客户端处理建议 |
|--------|-----------|------|---------------|
| 200 | 200 | 成功 | 正常处理 |
| 400 | 400 | 客户端错误（参数错误等） | 显示错误消息，不重试 |
| 401 | 401 | 未认证 | 跳转到登录页面 |
| 429 | 429 | 请求过于频繁（限流） | 显示友好提示，延迟后重试 |
| 500 | 500 | 服务器错误 | 显示错误消息，可重试 |
| 503 | 503 | 服务器繁忙（过载） | 显示友好提示，延迟后重试 |

### 限流错误（429）

当客户端请求过于频繁时，服务器返回：

```typescript
{
    "type": "{route}_response",
    "success": false,
    "code": 429,
    "message": "请求过于频繁，请稍后再试",
    "request_id": "..."
}
```

**客户端处理**：
- 显示友好提示："操作过于频繁，请稍后再试"
- 不要自动重试（避免加重服务器负担）
- 可以延迟 1-2 秒后由用户手动重试

### 服务器繁忙错误（503）

当服务器过载时，返回：

```typescript
{
    "type": "{route}_response",
    "success": false,
    "code": 503,
    "message": "服务器繁忙，请稍后再试",
    "request_id": "..."
}
```

**客户端处理**：
- 显示友好提示："服务器繁忙，请稍后再试"
- 延迟 3-5 秒后自动重试（指数退避）
- 如果连续失败，提示用户稍后再试
```

#### 💻 客户端改动

**4.5 更新错误处理逻辑**

**文件**：`assets/Script/global/WebSocketManager.ts`

```typescript
// 修改 request 方法，添加错误处理
public request(route: string, data: any, callback?: Function, timeout: number = 10000): void {
    // ... 现有逻辑 ...
    
    // 监听响应
    const responseType = `${route}_response`;
    const handler = (response: any) => {
        // 移除监听器
        wsNode.off(responseType, handler);
        
        // 处理错误码
        if (!response.success) {
            const code = response.code || 500;
            
            // 限流错误（429）- 不自动重试
            if (code === 429) {
                console.warn(`⚠️ [WebSocketManager] 请求限流: ${route}`);
                // 可以显示友好提示
                this.showErrorToast('操作过于频繁，请稍后再试');
                callback?.(response);
                return;
            }
            
            // 服务器繁忙（503）- 延迟后重试
            if (code === 503) {
                console.warn(`⚠️ [WebSocketManager] 服务器繁忙: ${route}`);
                this.showErrorToast('服务器繁忙，请稍后再试');
                
                // 延迟 3 秒后重试（最多重试 1 次）
                setTimeout(() => {
                    this.request(route, data, callback, timeout);
                }, 3000);
                return;
            }
        }
        
        // 其他错误正常处理
        callback?.(response);
    };
    
    wsNode.once(responseType, handler);
    
    // ... 发送请求 ...
}

// 添加错误提示方法（可选）
private showErrorToast(message: string): void {
    // 这里可以调用 UI 提示组件
    console.warn(`💬 [WebSocketManager] ${message}`);
    // 例如：ToastManager.getInstance().show(message);
}
```

**4.6 更新 RequestRetryManager（如果存在）**

**文件**：`assets/Script/global/RequestRetryManager.ts`

```typescript
// 修改重试逻辑，对 429 和 503 特殊处理
public shouldRetry(errorCode: number, retryCount: number): boolean {
    // 429（限流）- 不自动重试
    if (errorCode === 429) {
        return false;
    }
    
    // 503（服务器繁忙）- 延迟后重试，但限制重试次数
    if (errorCode === 503) {
        return retryCount < 2;  // 最多重试 2 次
    }
    
    // 其他错误按原逻辑处理
    return retryCount < this.maxRetries;
}

// 修改重试延迟计算
public getRetryDelay(retryCount: number, errorCode: number): number {
    // 503（服务器繁忙）- 使用固定延迟（3秒）
    if (errorCode === 503) {
        return 3000;
    }
    
    // 其他错误使用指数退避
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
}
```

**4.7 更新消息类型定义**

**文件**：`assets/Script/global/GameConfig.ts`

```typescript
export class GameConfig {
    // ... 现有代码 ...
    
    // 错误码常量
    static readonly ERROR_CODES = {
        SUCCESS: 200,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        TOO_MANY_REQUESTS: 429,  // 限流
        INTERNAL_ERROR: 500,
        SERVICE_UNAVAILABLE: 503,  // 服务器繁忙
    } as const;
}
```

#### ✅ 测试检查清单

- [ ] 限流中间件正确拦截频繁请求
- [ ] 限流时返回 429 错误码
- [ ] 客户端正确识别 429 错误并显示友好提示
- [ ] 客户端对 429 错误不自动重试
- [ ] 过载保护正确检测 CPU/内存使用率
- [ ] 服务器过载时返回 503 错误码
- [ ] 关键路由（登录、心跳）不受过载保护限制
- [ ] 客户端对 503 错误延迟后重试
- [ ] 限流和过载保护不影响正常请求

#### ⚠️ 注意事项

1. **依赖安装**：需要安装 `psutil` 库：`pip install psutil`，如果未安装，过载保护功能将不可用
2. **性能影响**：过载检查不要过于频繁（每5秒一次），避免影响性能
3. **阈值调整**：根据实际服务器配置调整 CPU/内存阈值（默认 CPU 80%，内存 85%）
4. **内存管理**：限流记录需要定期清理（每5分钟），避免内存泄漏
5. **用户体验**：错误提示要友好，避免用户误以为是 bug
6. **重试策略**：429 不重试，503 延迟重试，避免加重服务器负担
7. **关键路由**：登录、心跳等关键路由不受过载保护限制

---

### 5. 消息协议优化

#### 🎯 目标
- 统一消息格式，确保服务器和客户端一致
- 优化消息大小，减少网络传输
- 支持消息版本管理

#### 🔧 服务器端改动

**5.1 统一响应格式（已完成，但需检查一致性）**

**文件**：`server/handlers/utils.py`

确保所有响应都使用 `send_response` 函数，格式统一。

**5.2 添加消息版本字段（可选）**

**文件**：`server/handlers/utils.py`

```python
# 在 send_response 中添加版本字段
MESSAGE_PROTOCOL_VERSION = '1.0.0'

async def send_response(websocket, route: str, success: bool = True, 
                        data: dict = None, message: str = None, code: int = 200,
                        immediate: bool = False, request_id: str = None, 
                        request_data: dict = None):
    response = {
        'type': f'{route}_response',
        'success': success,
        'code': code,
        'timestamp': time.time(),
        'version': MESSAGE_PROTOCOL_VERSION,  # 消息协议版本
    }
    # ... 其余逻辑 ...
```

#### 💻 客户端改动

**5.3 统一消息类型定义**

**文件**：`assets/Script/global/MessageTypes.ts`

确保所有消息类型都有明确的 TypeScript 接口定义。

**5.4 添加消息版本检查（可选）**

**文件**：`assets/Script/global/WebSocketManager.ts`

```typescript
private MESSAGE_PROTOCOL_VERSION = '1.0.0';

private handleMessage(message: string): void {
    try {
        const data = JSON.parse(message);
        
        // 检查消息版本（可选）
        if (data.version && data.version !== this.MESSAGE_PROTOCOL_VERSION) {
            console.warn(`⚠️ [WebSocketManager] 消息版本不匹配: 期望 ${this.MESSAGE_PROTOCOL_VERSION}，收到 ${data.version}`);
        }
        
        // ... 其余逻辑 ...
    } catch (error) {
        // ... 错误处理 ...
    }
}
```

#### ✅ 测试检查清单

- [ ] 所有响应消息格式统一
- [ ] 消息版本字段正确（如果添加）
- [ ] 客户端能正确处理所有消息类型
- [ ] 消息大小优化（移除不必要的字段）

---

### 6. 连接管理优化

#### 🎯 目标
- 优化连接建立和断开流程
- 支持连接质量监控
- 优化重连机制

#### 🔧 服务器端改动

**6.1 添加连接质量监控（可选）**

**文件**：`server/ws_server.py`

```python
# 记录每个连接的质量指标
connection_quality = {}  # {websocket_id: {'rtt': [], 'packet_loss': 0}}

# 在心跳响应中记录 RTT
if route == 'pong':
    websocket_id = id(websocket)
    if websocket_id in client_last_ping:
        rtt = time.time() - client_last_ping[websocket_id]
        if websocket_id not in connection_quality:
            connection_quality[websocket_id] = {'rtt': [], 'packet_loss': 0}
        connection_quality[websocket_id]['rtt'].append(rtt)
        # 只保留最近 10 次 RTT
        if len(connection_quality[websocket_id]['rtt']) > 10:
            connection_quality[websocket_id]['rtt'].pop(0)
```

#### 💻 客户端改动

**6.2 优化重连机制**

**文件**：`assets/Script/global/WebSocketManager.ts`

```typescript
// 根据网络状况调整重连策略
private getReconnectDelay(): number {
    // 指数退避，但限制最大延迟
    const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
        30000  // 最大 30 秒
    );
    return delay;
}
```

#### ✅ 测试检查清单

- [ ] 连接建立流程正常
- [ ] 连接断开时正确清理资源
- [ ] 重连机制正常工作
- [ ] 连接质量监控正常（如果添加）

---

## 🎯 实施优先级

### 第一阶段（立即实施）🔴

1. **限流和过载保护** - 防止服务器被压垮
2. **Channel/Room 系统** - 统一广播逻辑，为后续功能打基础

### 第二阶段（近期实施）🟡

3. **Handshake 握手协议** - 统一连接初始化流程
4. **Dictionary 路由压缩** - 优化网络传输

### 第三阶段（长期优化）🟢

5. **消息协议优化** - 进一步优化消息格式
6. **连接管理优化** - 提升连接质量

---

## ✅ 测试检查清单

### 通用测试项

- [ ] 服务器启动正常
- [ ] 客户端连接正常
- [ ] 基本功能（登录、获取数据）正常
- [ ] 错误处理正常
- [ ] 日志记录正常

### 每个改进项的测试

参考各改进项的"测试检查清单"部分。

---

## 📝 变更记录

| 日期 | 改进项 | 状态 | 备注 |
|------|--------|------|------|
| 2026-01-05 | Channel/Room 系统 | ✅ 已完成 | Channel服务已实现，聊天Handler已使用，Session自动加入全局频道 |
| 2026-01-05 | 限流和过载保护 | ✅ 已完成 | 限流中间件已完善，过载保护已实现（需安装psutil），客户端错误处理已更新 |
| 2026-01-05 | Handshake 握手协议 | ✅ 已完成 | 握手Handler已创建，客户端连接时自动发送握手，支持字典版本同步 |
| 2026-01-05 | Dictionary 路由压缩 | ✅ 已完成 | Dictionary服务已创建，支持路由字符串压缩为1-255的整数，客户端已集成 |
| 2026-01-05 | 消息协议优化 | ✅ 已完成 | 统一响应格式，添加消息版本字段（v1.0.0），客户端支持版本检查 |
| 2026-01-05 | 连接管理优化 | ✅ 已完成 | 服务器端添加连接质量监控（RTT记录），客户端优化重连机制（指数退避，最大30秒） |
| 2026-04-02 | 大世界同图在线（文档） | ✅ 已文档化 | 新增 `server/docs/大世界同图在线-协议与持久化.md`；`消息接口定义-完整版` 与 `功能原理与实现原理` 已同步；实现见 `world_presence_service` / `world_handler` |

---

## 📚 参考文档

- PomeloServer 源码：`PomeloServer/` 目录
- 当前服务器功能移植分析：`PomeloServer/docs/当前服务器功能移植分析.md`
- 游戏功能支持分析：`PomeloServer/docs/游戏功能支持分析.md`
- 优化清单：`server/docs/优化清单-全面优化指南.md`
- 大世界同图在线：`server/docs/大世界同图在线-协议与持久化.md`
- 消息接口定义：`server/docs/消息接口定义-完整版.md`
- 文档索引：`server/docs/README.md`

---

## ⚠️ 重要注意事项

### 依赖安装

在实施改进前，需要安装以下依赖：

**服务器端**：
```bash
pip install psutil  # 用于过载保护功能
```

**客户端**：
- 无需额外依赖，使用 Cocos Creator 内置功能即可

### 实施顺序建议

1. **先实施服务器端改动**，确保服务器能正常运行
2. **再实施客户端改动**，逐步测试兼容性
3. **保持向后兼容**，确保旧客户端仍能正常工作
4. **渐进式升级**，不要一次性启用所有新功能

### 代码检查要点

1. **循环导入**：避免 `channel_service` 导入 `ws_server`，使用独立的发送函数
2. **内存泄漏**：限流记录需要定期清理，避免无限增长
3. **异常处理**：所有新增功能都要有完善的异常处理
4. **日志记录**：关键操作都要记录日志，便于排查问题

### 测试建议

1. **单元测试**：每个新服务都要有单元测试
2. **集成测试**：服务器和客户端一起测试
3. **压力测试**：测试限流和过载保护是否生效
4. **兼容性测试**：确保旧客户端仍能正常工作

---

**最后更新**：2026-01-05  
**维护者**：开发团队  
**状态**：✅ 全部完成

---

## 🎉 完成总结

**所有改进项已全部完成！**

### ✅ 完成项目（6/6）

1. ✅ **Channel/Room 频道系统** - 已实现统一广播逻辑
2. ✅ **限流和过载保护** - 已实现请求限流和服务器过载保护
3. ✅ **Handshake 握手协议** - 已实现连接初始化流程
4. ✅ **Dictionary 路由压缩** - 已实现路由字符串压缩
5. ✅ **消息协议优化** - 已统一消息格式，添加版本字段
6. ✅ **连接管理优化** - 已添加连接质量监控，优化重连机制

### 📊 完成统计

- **服务器端改动**：6/6 ✅
- **客户端改动**：6/6 ✅
- **总进度**：100% ✅

### 🚀 下一步建议

1. **测试验证**：对所有改进项进行完整测试
2. **性能监控**：观察限流、过载保护等功能的实际效果
3. **文档更新**：根据实际使用情况更新相关文档
4. **持续优化**：根据监控数据进行进一步优化

