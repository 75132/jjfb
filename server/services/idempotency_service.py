"""
幂等性服务 - 确保相同请求只执行一次
参考游戏开发最佳实践，防止重复请求导致的数据不一致
"""
import time
import hashlib
import json
from typing import Dict, Optional, Any
from collections import OrderedDict
from services.logger_service import get_logger


class IdempotencyService:
    """
    幂等性服务
    使用内存缓存记录已处理的请求（生产环境建议使用 Redis）
    """
    def __init__(self, max_size: int = 10000, ttl: float = 300.0):
        """
        Args:
            max_size: 最大缓存条目数（LRU 策略）
            ttl: 请求ID的生存时间（秒），默认5分钟
        """
        self.cache: OrderedDict = OrderedDict()  # {request_id: (result, timestamp)}
        self.max_size = max_size
        self.ttl = ttl
        self.logger = get_logger()
    
    def generate_request_id(self, user_id: str, route: str, data: dict) -> str:
        """
        生成请求ID（基于用户ID、路由和数据）
        
        Args:
            user_id: 用户ID
            route: 路由名称
            data: 请求数据
        
        Returns:
            请求ID（SHA256哈希）
        """
        # 构建唯一标识符
        key_data = {
            'user_id': str(user_id),
            'route': route,
            'data': data
        }
        key_str = json.dumps(key_data, sort_keys=True)
        request_id = hashlib.sha256(key_str.encode()).hexdigest()[:16]  # 使用前16位
        return request_id
    
    def is_processed(self, request_id: str) -> bool:
        """
        检查请求是否已处理
        
        Args:
            request_id: 请求ID
        
        Returns:
            是否已处理
        """
        if request_id not in self.cache:
            return False
        
        # 检查是否过期
        _, timestamp = self.cache[request_id]
        if time.time() - timestamp > self.ttl:
            # 过期，移除
            self.cache.pop(request_id, None)
            return False
        
        return True
    
    def get_result(self, request_id: str) -> Optional[Any]:
        """
        获取已处理请求的结果
        
        Args:
            request_id: 请求ID
        
        Returns:
            缓存的结果，如果不存在或已过期则返回 None
        """
        if not self.is_processed(request_id):
            return None
        
        result, _ = self.cache[request_id]
        return result
    
    def mark_processed(self, request_id: str, result: Any):
        """
        标记请求已处理并缓存结果
        
        Args:
            request_id: 请求ID
            result: 处理结果
        """
        # 如果缓存已满，移除最旧的条目（LRU）
        if len(self.cache) >= self.max_size:
            self.cache.popitem(last=False)  # 移除最旧的
        
        # 添加新条目
        self.cache[request_id] = (result, time.time())
        # 移动到末尾（LRU）
        self.cache.move_to_end(request_id)
    
    def clear_expired(self):
        """清理过期的请求ID"""
        current_time = time.time()
        expired_ids = [
            request_id for request_id, (_, timestamp) in self.cache.items()
            if current_time - timestamp > self.ttl
        ]
        for request_id in expired_ids:
            self.cache.pop(request_id, None)
        
        if expired_ids:
            self.logger.debug('清理过期请求ID', count=len(expired_ids))
    
    def clear_user_requests(self, user_id: str):
        """清理指定用户的所有请求ID（用于登出等场景）"""
        # 注意：由于我们使用哈希，无法直接按用户ID查找
        # 这里只是示例，实际实现可能需要维护用户ID到请求ID的映射
        pass
    
    def get_cache_size(self) -> int:
        """获取当前缓存大小"""
        return len(self.cache)


# 全局幂等性服务实例
idempotency_service = IdempotencyService(max_size=10000, ttl=300.0)

__all__ = ['IdempotencyService', 'idempotency_service']

