"""
结构化日志服务
提供统一的日志接口，支持文件输出和控制台输出
"""
import logging
import logging.handlers
import os
from datetime import datetime
from typing import Optional, Dict, Any


class LoggerService:
    """结构化日志服务"""
    
    def __init__(self, log_dir: str = 'logs', level: int = logging.INFO):
        """
        初始化日志服务
        
        Args:
            log_dir: 日志文件目录
            level: 日志级别
        """
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        
        # 配置日志格式
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)
        
        # 文件处理器（按天轮转）
        file_handler = logging.handlers.TimedRotatingFileHandler(
            os.path.join(log_dir, 'server.log'),
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        
        # 错误日志文件
        error_handler = logging.handlers.TimedRotatingFileHandler(
            os.path.join(log_dir, 'error.log'),
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        error_handler.setFormatter(formatter)
        error_handler.setLevel(logging.ERROR)
        
        # 配置根日志器
        self.logger = logging.getLogger('game_server')
        self.logger.setLevel(level)
        
        # 避免重复添加处理器
        if not self.logger.handlers:
            self.logger.addHandler(console_handler)
            self.logger.addHandler(file_handler)
            self.logger.addHandler(error_handler)
    
    def info(self, message: str, **kwargs):
        """记录信息日志"""
        if kwargs:
            message = f"{message} | {self._format_kwargs(kwargs)}"
        self.logger.info(message)
    
    def error(self, message: str, **kwargs):
        """记录错误日志"""
        if kwargs:
            message = f"{message} | {self._format_kwargs(kwargs)}"
        self.logger.error(message)
    
    def warning(self, message: str, **kwargs):
        """记录警告日志"""
        if kwargs:
            message = f"{message} | {self._format_kwargs(kwargs)}"
        self.logger.warning(message)
    
    def debug(self, message: str, **kwargs):
        """记录调试日志"""
        if kwargs:
            message = f"{message} | {self._format_kwargs(kwargs)}"
        self.logger.debug(message)
    
    def _format_kwargs(self, kwargs: Dict[str, Any]) -> str:
        """格式化额外参数"""
        if not kwargs:
            return ''
        return ' | '.join(f'{k}={v}' for k, v in kwargs.items())


# 全局日志服务实例（延迟初始化，在 ws_server.py 中初始化）
_logger_service: Optional[LoggerService] = None


def get_logger() -> LoggerService:
    """获取日志服务实例（单例模式）"""
    global _logger_service
    if _logger_service is None:
        _logger_service = LoggerService()
    return _logger_service


def init_logger(log_dir: str = 'logs', level: int = logging.INFO):
    """初始化日志服务"""
    global _logger_service
    _logger_service = LoggerService(log_dir=log_dir, level=level)
    return _logger_service

