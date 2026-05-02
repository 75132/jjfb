"""
背包缓存服务 - 轻量级内存缓存
只缓存频繁访问的背包，使用LRU策略自动淘汰
"""
import time
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple
from bson import ObjectId


class BagCacheService:
    """
    背包数据缓存服务
    使用LRU策略，只缓存最近访问的背包数据
    """
    def __init__(self, max_size: int = 500, ttl: float = 300.0):
        """
        Args:
            max_size: 最大缓存数量（默认500个背包）
            ttl: 缓存过期时间（秒，默认5分钟）
        """
        # {(user_id, character_id): {data: doc, version: int, timestamp: float}}
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self.ttl = ttl
    
    def get_cache_key(self, user_id: ObjectId, character_id: ObjectId) -> Tuple:
        """生成缓存键"""
        return (user_id, character_id)
    
    def get(self, user_id: ObjectId, character_id: ObjectId) -> Optional[Tuple[Dict[str, Any], int]]:
        """
        获取缓存的背包数据
        
        Returns:
            (doc, version) 如果命中，None 如果未命中或过期
        """
        cache_key = self.get_cache_key(user_id, character_id)
        
        if cache_key not in self.cache:
            return None
        
        cache_entry = self.cache[cache_key]
        # 检查是否过期
        if time.time() - cache_entry['timestamp'] > self.ttl:
            self.cache.pop(cache_key, None)
            return None
        
        # 移动到末尾（LRU）
        self.cache.move_to_end(cache_key)
        
        return cache_entry['data'], cache_entry['version']
    
    def set(self, user_id: ObjectId, character_id: ObjectId, doc: Dict[str, Any], version: int):
        """
        设置缓存
        """
        cache_key = self.get_cache_key(user_id, character_id)
        
        # 如果缓存已满，移除最旧的条目
        if len(self.cache) >= self.max_size and cache_key not in self.cache:
            self.cache.popitem(last=False)  # 移除最旧的
        
        # 添加或更新缓存
        self.cache[cache_key] = {
            'data': doc,
            'version': version,
            'timestamp': time.time()
        }
        # 移动到末尾（LRU）
        self.cache.move_to_end(cache_key)
    
    def invalidate(self, user_id: ObjectId, character_id: ObjectId):
        """使缓存失效（背包数据更新时调用）"""
        cache_key = self.get_cache_key(user_id, character_id)
        self.cache.pop(cache_key, None)
    
    def clear(self):
        """清空所有缓存"""
        self.cache.clear()
    
    def get_size(self) -> int:
        """获取当前缓存数量"""
        return len(self.cache)


# 全局实例（可选，如果不需要缓存可以不启用）
_bag_cache: Optional[BagCacheService] = None


def init_bag_cache(max_size: int = 500, ttl: float = 300.0, enable: bool = True):
    """初始化背包缓存服务"""
    global _bag_cache
    if enable:
        _bag_cache = BagCacheService(max_size=max_size, ttl=ttl)
        print(f'✅ [BagCache] 背包缓存服务已启用（最大{max_size}个，TTL {ttl}秒）')
    else:
        _bag_cache = None
        print('ℹ️ [BagCache] 背包缓存服务已禁用')


def get_bag_cache() -> Optional[BagCacheService]:
    """获取背包缓存服务实例"""
    return _bag_cache
