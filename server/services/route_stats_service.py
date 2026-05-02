"""
路由统计服务 - 记录路由调用次数、平均耗时、错误率
用于性能监控和问题诊断
"""
from typing import Dict, Optional
import time
from collections import defaultdict
import asyncio


class RouteStats:
    """单个路由的统计数据"""
    def __init__(self):
        self.call_count: int = 0  # 调用次数
        self.total_time: float = 0.0  # 总耗时（秒）
        self.error_count: int = 0  # 错误次数
        self.min_time: Optional[float] = None  # 最小耗时
        self.max_time: Optional[float] = None  # 最大耗时
        self.last_called: Optional[float] = None  # 最后调用时间
    
    @property
    def avg_time(self) -> float:
        """平均耗时（秒）"""
        if self.call_count == 0:
            return 0.0
        return self.total_time / self.call_count
    
    @property
    def error_rate(self) -> float:
        """错误率（0-1）"""
        if self.call_count == 0:
            return 0.0
        return self.error_count / self.call_count
    
    def record_call(self, duration: float, is_error: bool = False):
        """记录一次调用"""
        self.call_count += 1
        self.total_time += duration
        self.last_called = time.time()
        
        if is_error:
            self.error_count += 1
        
        # 更新最小/最大耗时
        if self.min_time is None or duration < self.min_time:
            self.min_time = duration
        if self.max_time is None or duration > self.max_time:
            self.max_time = duration
    
    def get_stats_dict(self) -> Dict:
        """获取统计数据的字典表示"""
        return {
            'call_count': self.call_count,
            'avg_time': round(self.avg_time * 1000, 2),  # 转换为毫秒
            'min_time': round(self.min_time * 1000, 2) if self.min_time is not None else None,
            'max_time': round(self.max_time * 1000, 2) if self.max_time is not None else None,
            'error_count': self.error_count,
            'error_rate': round(self.error_rate * 100, 2),  # 转换为百分比
            'last_called': self.last_called
        }


class RouteStatsService:
    """
    路由统计服务 - 单例模式
    记录所有路由的调用统计信息
    """
    _instance: Optional['RouteStatsService'] = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # {route: RouteStats}
        self.stats: Dict[str, RouteStats] = defaultdict(RouteStats)
        self._initialized = True
    
    def record_call(self, route: str, duration: float, is_error: bool = False):
        """
        记录一次路由调用
        
        Args:
            route: 路由名称
            duration: 处理耗时（秒）
            is_error: 是否出错
        """
        self.stats[route].record_call(duration, is_error)
    
    def get_stats(self, route: Optional[str] = None) -> Dict:
        """
        获取统计信息
        
        Args:
            route: 路由名称，如果为None则返回所有路由的统计
        
        Returns:
            统计信息字典
        """
        if route:
            if route in self.stats:
                return {route: self.stats[route].get_stats_dict()}
            return {}
        else:
            return {r: s.get_stats_dict() for r, s in self.stats.items()}
    
    def get_top_routes_by_count(self, limit: int = 10) -> Dict:
        """获取调用次数最多的路由"""
        sorted_routes = sorted(
            self.stats.items(),
            key=lambda x: x[1].call_count,
            reverse=True
        )[:limit]
        return {r: s.get_stats_dict() for r, s in sorted_routes}
    
    def get_slow_routes(self, threshold_ms: float = 100.0, limit: int = 10) -> Dict:
        """
        获取平均耗时最长的路由
        
        Args:
            threshold_ms: 阈值（毫秒），只返回平均耗时超过此值的路由
            limit: 最多返回的路由数量
        """
        threshold_s = threshold_ms / 1000.0
        slow_routes = [
            (r, s) for r, s in self.stats.items()
            if s.avg_time >= threshold_s and s.call_count > 0
        ]
        sorted_routes = sorted(
            slow_routes,
            key=lambda x: x[1].avg_time,
            reverse=True
        )[:limit]
        return {r: s.get_stats_dict() for r, s in sorted_routes}
    
    def get_error_routes(self, limit: int = 10) -> Dict:
        """获取错误率最高的路由"""
        error_routes = [
            (r, s) for r, s in self.stats.items()
            if s.error_count > 0
        ]
        sorted_routes = sorted(
            error_routes,
            key=lambda x: x[1].error_rate,
            reverse=True
        )[:limit]
        return {r: s.get_stats_dict() for r, s in sorted_routes}
    
    def reset_stats(self, route: Optional[str] = None):
        """
        重置统计信息
        
        Args:
            route: 路由名称，如果为None则重置所有路由
        """
        if route:
            if route in self.stats:
                self.stats[route] = RouteStats()
        else:
            self.stats.clear()
    
    def get_total_stats(self) -> Dict:
        """获取总体统计信息"""
        total_calls = sum(s.call_count for s in self.stats.values())
        total_errors = sum(s.error_count for s in self.stats.values())
        total_time = sum(s.total_time for s in self.stats.values())
        
        return {
            'total_routes': len(self.stats),
            'total_calls': total_calls,
            'total_errors': total_errors,
            'total_error_rate': round((total_errors / total_calls * 100) if total_calls > 0 else 0, 2),
            'total_time': round(total_time, 2),
            'avg_time_per_call': round((total_time / total_calls * 1000) if total_calls > 0 else 0, 2)
        }


# 全局路由统计服务实例
route_stats_service = RouteStatsService()

