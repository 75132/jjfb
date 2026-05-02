"""
Channel 服务 - 参考 PomeloServer 的 ChannelService

目标：
- 提供全局频道与房间频道能力（先用于全局聊天，后续可扩展到战斗/组队）
- 支持按 UID 精确推送消息（基于 SessionService）
- 与现有 ws_server / chat_handler 解耦，通过服务方式供各 Handler 调用
"""

from typing import Dict, List, Set, Optional

from bson import ObjectId

from services.session_service import session_service
from services.logger_service import get_logger

import json
import asyncio


class Channel:
    """频道类 - 管理频道内的用户及其 WebSocket 连接"""

    def __init__(self, name: str):
        self.name = name
        # {user_id: {websocket1, websocket2, ...}}
        self.members: Dict[ObjectId, Set] = {}

    def add(self, user_id: ObjectId, websocket) -> None:
        """添加用户到频道（支持多连接）"""
        if user_id is None or websocket is None:
            return
        if user_id not in self.members:
            self.members[user_id] = set()
        self.members[user_id].add(websocket)
        # 记录加入日志，便于排查频道成员问题
        try:
            logger = get_logger()
            logger.info('加入频道', channel=self.name, user_id=str(user_id), member_count=self.get_member_count())
        except Exception:
            pass

    def leave(self, user_id: ObjectId, websocket) -> None:
        """用户离开频道"""
        if user_id in self.members:
            ws_set = self.members[user_id]
            ws_set.discard(websocket)
            if not ws_set:
                # 该用户在此频道已无连接，移除
                del self.members[user_id]

    def get_member_count(self) -> int:
        """获取频道成员数量（按用户数统计）"""
        return len(self.members)

    def get_all_websockets(self) -> List:
        """获取频道内所有 WebSocket 连接"""
        websockets: List = []
        for ws_set in self.members.values():
            websockets.extend(list(ws_set))
        return websockets


class ChannelService:
    """
    Channel 服务 - 单例

    注意：
    - 仅依赖 SessionService，不直接依赖 ws_server，避免循环导入
    - 广播时内部做异常捕获，避免单个连接异常影响整体
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.channels: Dict[str, Channel] = {}
        self._initialized = True

    # ---------- 频道管理 ----------

    def create_channel(self, name: str) -> Channel:
        """创建频道（已存在则直接返回）"""
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

    def destroy_channel(self, name: str) -> None:
        """销毁频道"""
        if name in self.channels:
            del self.channels[name]

    # ---------- 加入 / 离开 ----------

    def add(self, channel_name: str, user_id: ObjectId, websocket) -> None:
        """将用户加入指定频道"""
        if user_id is None or websocket is None:
            return
        channel = self.get_channel(channel_name, create=True)
        channel.add(user_id, websocket)
    
    def is_in_channel(self, channel_name: str, user_id: ObjectId, websocket) -> bool:
        """检查用户是否在指定频道中"""
        if user_id is None or websocket is None:
            return False
        channel = self.get_channel(channel_name, create=False)
        if not channel:
            return False
        if user_id not in channel.members:
            return False
        return websocket in channel.members[user_id]

    def leave(self, channel_name: str, user_id: ObjectId, websocket) -> None:
        """将用户从指定频道移除"""
        channel = self.get_channel(channel_name, create=False)
        if not channel:
            return
        channel.leave(user_id, websocket)
        # 空频道自动销毁（防止内存泄漏）
        if channel.get_member_count() == 0:
            self.destroy_channel(channel_name)

    # ---------- 广播能力 ----------

    async def _send_to_client_safe(self, websocket, message_str: str) -> None:
        """安全发送消息到客户端（带异常处理）"""
        try:
            await websocket.send(message_str)
        except Exception:
            # 连接可能已断开，忽略错误
            pass

    async def push_message(self, channel_name: str, route: str, msg: dict, max_concurrent: int = 50) -> None:
        """
        向频道广播消息

        Args:
            channel_name: 频道名
            route: 消息路由（对应客户端的 type）
            msg: 业务数据（会展开到根级别）
            max_concurrent: 单批次最大并发发送数
        """
        channel = self.get_channel(channel_name)
        logger = None
        try:
            logger = get_logger()
        except Exception:
            logger = None

        if not channel:
            if logger:
                logger.warning('频道不存在', channel=channel_name)
            return

        websockets = channel.get_all_websockets()
        if not websockets:
            if logger:
                logger.warning('频道为空', channel=channel_name, member_count=channel.get_member_count())
            return

        if logger:
            logger.info('频道广播消息', channel=channel_name, route=route, receivers=len(websockets))

        # 构建消息
        message = {
            "type": route,
            **(msg or {}),
        }
        message_str = json.dumps(message, default=str)

        # 异步批量发送
        for i in range(0, len(websockets), max_concurrent):
            batch = websockets[i : i + max_concurrent]
            tasks = [self._send_to_client_safe(ws, message_str) for ws in batch]
            await asyncio.gather(*tasks, return_exceptions=True)

        if logger:
            logger.info('频道广播完成', channel=channel_name, route=route, receivers=len(websockets))

    async def push_message_by_uids(self, route: str, msg: dict, uids: List[ObjectId], max_concurrent: int = 50) -> None:
        """按 UID 列表推送消息（使用 SessionService 获取所有在线连接）"""
        if not uids:
            return

        message = {
            "type": route,
            **(msg or {}),
        }
        message_str = json.dumps(message, default=str)

        websockets = []
        for user_id in uids:
            sessions = session_service.get_sessions(user_id)
            for session in sessions:
                if session.is_online():
                    websockets.append(session.websocket)

        if not websockets:
            return

        for i in range(0, len(websockets), max_concurrent):
            batch = websockets[i : i + max_concurrent]
            tasks = [self._send_to_client_safe(ws, message_str) for ws in batch]
            await asyncio.gather(*tasks, return_exceptions=True)


# 全局实例
channel_service = ChannelService()


