"""
任务管理器 - 参考 PomeloServer 的 taskManager
用于请求序列化，确保同一用户的请求串行处理
"""
import asyncio
import time
from typing import Dict, Callable, Optional, Any
from collections import deque
from services.logger_service import get_logger


class Task:
    """任务对象"""
    def __init__(self, fn: Callable, ontimeout: Optional[Callable] = None, timeout: float = 3.0):
        self.fn = fn
        self.ontimeout = ontimeout
        self.timeout = timeout
        self.created_at = time.time()
        self.done = False
        self.result = None
        self.error = None
    
    def execute(self):
        """执行任务"""
        try:
            if asyncio.iscoroutinefunction(self.fn):
                return self.fn()
            else:
                return self.fn()
        except Exception as e:
            self.error = e
            raise
    
    def is_timeout(self) -> bool:
        """检查是否超时"""
        return time.time() - self.created_at > self.timeout
    
    def mark_done(self):
        """标记任务完成"""
        self.done = True


class TaskQueue:
    """任务队列 - 串行执行任务"""
    def __init__(self, default_timeout: float = 3.0):
        self.queue: deque = deque()
        self.processing = False
        self.default_timeout = default_timeout
        self.lock = asyncio.Lock()
    
    async def push(self, fn: Callable, ontimeout: Optional[Callable] = None, 
                   timeout: Optional[float] = None) -> Task:
        """
        添加任务到队列
        
        Args:
            fn: 任务函数（可以是协程或普通函数）
            ontimeout: 超时回调
            timeout: 超时时间（秒），默认使用队列的 default_timeout
        
        Returns:
            Task 对象
        """
        task_timeout = timeout if timeout is not None else self.default_timeout
        task = Task(fn, ontimeout, task_timeout)
        
        async with self.lock:
            self.queue.append(task)
        
        # 如果队列正在处理，任务会自动被处理
        # 如果队列未在处理，启动处理
        if not self.processing:
            asyncio.create_task(self._process_queue())
        
        return task
    
    async def _process_queue(self):
        """处理队列中的任务（串行执行）"""
        async with self.lock:
            if self.processing:
                return
            self.processing = True
        
        try:
            while True:
                async with self.lock:
                    if not self.queue:
                        self.processing = False
                        break
                    task = self.queue.popleft()
                
                # 检查任务是否已超时
                if task.is_timeout():
                    logger = get_logger()
                    logger.warning('任务超时', timeout=task.timeout)
                    if task.ontimeout:
                        try:
                            if asyncio.iscoroutinefunction(task.ontimeout):
                                await task.ontimeout()
                            else:
                                task.ontimeout()
                        except Exception as e:
                            logger.error('超时回调执行失败', error=str(e))
                    continue
                
                # 执行任务
                try:
                    if asyncio.iscoroutinefunction(task.fn):
                        task.result = await task.fn()
                    else:
                        task.result = task.fn()
                    task.mark_done()
                except Exception as e:
                    task.error = e
                    task.mark_done()
                    logger = get_logger()
                    logger.error('任务执行失败', error=str(e))
        finally:
            async with self.lock:
                self.processing = False
    
    def close(self, force: bool = False):
        """关闭队列"""
        if force:
            self.queue.clear()
        self.processing = False


class TaskManager:
    """任务管理器 - 参考 PomeloServer 的 taskManager"""
    def __init__(self, default_timeout: float = 3.0):
        self.queues: Dict[str, TaskQueue] = {}
        self.default_timeout = default_timeout
        self.lock = asyncio.Lock()
    
    async def add_task(self, key: str, fn: Callable, ontimeout: Optional[Callable] = None,
                      timeout: Optional[float] = None) -> Task:
        """
        添加任务到指定队列
        
        Args:
            key: 任务队列的键（通常是 user_id 或 session_id）
            fn: 任务函数
            ontimeout: 超时回调
            timeout: 超时时间（秒）
        
        Returns:
            Task 对象
        """
        async with self.lock:
            if key not in self.queues:
                self.queues[key] = TaskQueue(self.default_timeout)
        
        queue = self.queues[key]
        return await queue.push(fn, ontimeout, timeout)
    
    def close_queue(self, key: str, force: bool = False):
        """关闭指定队列"""
        async def _close():
            async with self.lock:
                if key in self.queues:
                    self.queues[key].close(force)
                    del self.queues[key]
        
        # 如果事件循环正在运行，使用 create_task，否则直接执行
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_close())
            else:
                loop.run_until_complete(_close())
        except RuntimeError:
            # 没有事件循环，直接同步执行
            if key in self.queues:
                self.queues[key].close(force)
                del self.queues[key]
    
    def get_queue_count(self) -> int:
        """获取队列数量"""
        return len(self.queues)
    
    def get_total_task_count(self) -> int:
        """获取所有队列中的任务总数"""
        total = 0
        for queue in self.queues.values():
            total += len(queue.queue)
        return total


# 全局任务管理器实例
task_manager = TaskManager(default_timeout=5.0)  # 默认5秒超时

__all__ = ['TaskManager', 'TaskQueue', 'Task', 'task_manager']

