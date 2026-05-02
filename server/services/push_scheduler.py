"""
消息推送调度器 - 参考 PomeloServer 的 buffer scheduler
为每个会话维护消息队列，定时批量发送，减少网络往返
"""
import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from collections import deque
from services.logger_service import get_logger
from services.session_service import session_service


class BufferPushScheduler:
    """
    缓冲推送调度器 - 参考 PomeloServer/lib/pushSchedulers/buffer.js
    为每个会话维护消息队列，定时批量发送
    """
    def __init__(self, flush_interval: float = 0.02):
        """
        Args:
            flush_interval: 刷新间隔（秒），默认20ms
        """
        self.flush_interval = flush_interval
        self.sessions: Dict[str, deque] = {}  # {session_id: message_queue}
        self.timer_task: Optional[asyncio.Task] = None
        self.running = False
        self.lock = asyncio.Lock()
        self.logger = get_logger()
    
    def start(self):
        """启动调度器"""
        if self.running:
            return
        
        self.running = True
        self.timer_task = asyncio.create_task(self._flush_loop())
        self.logger.info('消息推送调度器已启动', flush_interval=self.flush_interval)
    
    def stop(self, force: bool = False):
        """停止调度器"""
        self.running = False
        
        if self.timer_task:
            self.timer_task.cancel()
            self.timer_task = None
        
        # 如果强制停止，立即发送所有待发送消息
        if force:
            asyncio.create_task(self._flush_all())
        
        self.logger.info('消息推送调度器已停止', force=force)
    
    async def schedule(self, session_id: str, message: dict, 
                      websocket=None, immediate: bool = False):
        """
        调度消息发送
        
        Args:
            session_id: 会话ID（通常是 user_id 的字符串形式）
            message: 要发送的消息
            websocket: WebSocket 连接（可选，如果提供则立即发送）
            immediate: 是否立即发送（不加入队列）
        """
        # 如果立即发送，直接发送
        if immediate and websocket:
            try:
                # 修复：添加 default=str 处理 ObjectId 等不可序列化类型
                message_str = json.dumps(message, default=str) if isinstance(message, dict) else message
                await websocket.send(message_str)
                return
            except Exception as e:
                self.logger.warning('立即发送消息失败', session_id=session_id, error=str(e))
        
        # 加入队列
        async with self.lock:
            if session_id not in self.sessions:
                self.sessions[session_id] = deque()
            
            self.sessions[session_id].append({
                'message': message,
                'websocket': websocket,
                'timestamp': time.time()
            })
    
    async def schedule_batch(self, session_id: str, messages: List[dict],
                            websocket=None, immediate: bool = False):
        """
        批量调度消息发送
        
        Args:
            session_id: 会话ID
            messages: 消息列表
            websocket: WebSocket 连接
            immediate: 是否立即发送
        """
        if immediate and websocket:
            # 立即发送：合并为数组发送
            try:
                batch_message = messages if len(messages) > 1 else messages[0]
                # 修复：添加 default=str 处理 ObjectId 等不可序列化类型
                message_str = json.dumps(batch_message, default=str) if isinstance(batch_message, dict) else json.dumps(messages, default=str)
                await websocket.send(message_str)
                return
            except Exception as e:
                self.logger.warning('立即批量发送消息失败', session_id=session_id, error=str(e))
        
        # 加入队列
        async with self.lock:
            if session_id not in self.sessions:
                self.sessions[session_id] = deque()
            
            for message in messages:
                self.sessions[session_id].append({
                    'message': message,
                    'websocket': websocket,
                    'timestamp': time.time()
                })
    
    async def _flush_loop(self):
        """定时刷新循环"""
        while self.running:
            try:
                await asyncio.sleep(self.flush_interval)
                await self._flush_all()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error('刷新消息队列失败', error=str(e))
    
    async def _flush_all(self):
        """刷新所有会话的消息队列"""
        async with self.lock:
            sessions_to_flush = list(self.sessions.keys())
        
        for session_id in sessions_to_flush:
            await self._flush_session(session_id)
    
    async def _flush_session(self, session_id: str):
        """刷新指定会话的消息队列"""
        async with self.lock:
            if session_id not in self.sessions or len(self.sessions[session_id]) == 0:
                return
            
            queue = self.sessions[session_id]
            messages_to_send = []
            websocket = None
            
            # 取出队列中的所有消息
            while queue:
                item = queue.popleft()
                messages_to_send.append(item['message'])
                if item['websocket'] and not websocket:
                    websocket = item['websocket']
            
            # 如果没有消息，直接返回
            if not messages_to_send:
                return
        
        # 获取 WebSocket 连接
        if not websocket:
            # 尝试从 session_service 获取
            try:
                user_id = session_id
                if not isinstance(user_id, str):
                    user_id = str(user_id)
                
                # 从 session_service 获取 session
                from bson import ObjectId
                session = session_service.get_session(ObjectId(user_id))
                if session and session.websocket:
                    websocket = session.websocket
            except Exception as e:
                self.logger.warning('获取 WebSocket 连接失败', session_id=session_id, error=str(e))
        
        # 发送消息
        if websocket and messages_to_send:
            try:
                # 如果只有一条消息，直接发送
                # 修复：添加 default=str 处理 ObjectId 等不可序列化类型
                if len(messages_to_send) == 1:
                    message_str = json.dumps(messages_to_send[0], default=str)
                else:
                    # 多条消息合并为数组发送
                    message_str = json.dumps(messages_to_send, default=str)
                
                await websocket.send(message_str)
                
                # 清理已发送的会话（如果队列为空）
                async with self.lock:
                    if session_id in self.sessions and len(self.sessions[session_id]) == 0:
                        del self.sessions[session_id]
            
            except Exception as e:
                self.logger.warning('发送消息失败', session_id=session_id, 
                                  message_count=len(messages_to_send), error=str(e))
                # 连接可能已断开，清理会话
                async with self.lock:
                    if session_id in self.sessions:
                        del self.sessions[session_id]
    
    def on_session_close(self, session_id: str):
        """会话关闭时清理队列"""
        async def _cleanup():
            async with self.lock:
                if session_id in self.sessions:
                    del self.sessions[session_id]
        
        asyncio.create_task(_cleanup())
    
    def get_queue_size(self, session_id: str) -> int:
        """获取指定会话的队列大小"""
        if session_id in self.sessions:
            return len(self.sessions[session_id])
        return 0
    
    def get_total_queue_size(self) -> int:
        """获取所有会话的总队列大小"""
        total = 0
        for queue in self.sessions.values():
            total += len(queue)
        return total
    
    def get_session_count(self) -> int:
        """获取有消息队列的会话数量"""
        return len(self.sessions)


# 全局推送调度器实例
push_scheduler = BufferPushScheduler(flush_interval=0.02)  # 20ms刷新间隔

__all__ = ['BufferPushScheduler', 'push_scheduler']

