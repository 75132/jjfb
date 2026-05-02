"""
统一异常处理 - 参考游戏开发最佳实践
提供异常分类、日志记录和恢复机制
"""
import functools
import traceback
from typing import Callable, Any, Optional
from enum import Enum
from services.logger_service import get_logger


class ErrorType(Enum):
    """错误类型枚举"""
    NETWORK_ERROR = 'network_error'      # 网络错误（可重试）
    DATABASE_ERROR = 'database_error'    # 数据库错误（可重试）
    VALIDATION_ERROR = 'validation_error'  # 验证错误（不可重试）
    BUSINESS_ERROR = 'business_error'   # 业务错误（不可重试）
    AUTH_ERROR = 'auth_error'           # 认证错误（不可重试）
    SYSTEM_ERROR = 'system_error'        # 系统错误（可重试）
    UNKNOWN_ERROR = 'unknown_error'      # 未知错误


class GameException(Exception):
    """游戏业务异常基类"""
    def __init__(self, message: str, error_type: ErrorType = ErrorType.BUSINESS_ERROR,
                 code: int = 500, retryable: bool = False, context: dict = None):
        super().__init__(message)
        self.error_type = error_type
        self.code = code
        self.retryable = retryable
        self.context = context or {}


class NetworkException(GameException):
    """网络异常"""
    def __init__(self, message: str = "Network error", context: dict = None):
        super().__init__(message, ErrorType.NETWORK_ERROR, code=503, retryable=True, context=context)


class DatabaseException(GameException):
    """数据库异常"""
    def __init__(self, message: str = "Database error", context: dict = None):
        super().__init__(message, ErrorType.DATABASE_ERROR, code=500, retryable=True, context=context)


class ValidationException(GameException):
    """验证异常"""
    def __init__(self, message: str = "Validation error", context: dict = None):
        super().__init__(message, ErrorType.VALIDATION_ERROR, code=400, retryable=False, context=context)


class AuthException(GameException):
    """认证异常"""
    def __init__(self, message: str = "Authentication error", context: dict = None):
        super().__init__(message, ErrorType.AUTH_ERROR, code=401, retryable=False, context=context)


def classify_error(error: Exception) -> ErrorType:
    """分类错误类型"""
    if isinstance(error, GameException):
        return error.error_type
    
    error_str = str(error).lower()
    error_type = type(error).__name__
    
    # 网络相关错误
    if any(keyword in error_str for keyword in ['connection', 'timeout', 'network', 'socket']):
        return ErrorType.NETWORK_ERROR
    
    # 数据库相关错误
    if any(keyword in error_type for keyword in ['Mongo', 'Database', 'ConnectionFailure', 'AutoReconnect']):
        return ErrorType.NETWORK_ERROR
    
    # 验证相关错误
    if any(keyword in error_str for keyword in ['invalid', 'missing', 'required', 'validation']):
        return ErrorType.VALIDATION_ERROR
    
    # 认证相关错误
    if any(keyword in error_str for keyword in ['auth', 'unauthorized', 'forbidden', 'token']):
        return ErrorType.AUTH_ERROR
    
    return ErrorType.UNKNOWN_ERROR


def is_retryable(error: Exception) -> bool:
    """判断错误是否可重试"""
    if isinstance(error, GameException):
        return error.retryable
    
    error_type = classify_error(error)
    return error_type in [ErrorType.NETWORK_ERROR, ErrorType.DATABASE_ERROR, ErrorType.SYSTEM_ERROR]


def handle_exception(error: Exception, context: dict = None) -> dict:
    """
    统一异常处理
    
    Returns:
        错误响应字典
    """
    logger = get_logger()
    error_type = classify_error(error)
    retryable = is_retryable(error)
    
    # 构建错误信息
    error_info = {
        'success': False,
        'error_type': error_type.value,
        'message': str(error),
        'retryable': retryable,
        'code': getattr(error, 'code', 500)
    }
    
    # 添加上下文信息
    if context:
        error_info['context'] = context
    
    # 如果是 GameException，添加额外信息
    if isinstance(error, GameException) and error.context:
        error_info['context'] = {**(error_info.get('context', {})), **error.context}
    
    # 记录日志
    log_level = 'error' if error_type in [ErrorType.SYSTEM_ERROR, ErrorType.DATABASE_ERROR] else 'warning'
    log_data = {
        'error_type': error_type.value,
        'error': str(error),
        'retryable': retryable,
        'context': context or {}
    }
    
    if log_level == 'error':
        logger.error('异常处理', **log_data, stack_trace=traceback.format_exc())
    else:
        logger.warning('异常处理', **log_data)
    
    return error_info


def exception_handler(handler_func: Callable = None, 
                     log_error: bool = True,
                     reraise: bool = False) -> Callable:
    """
    异常处理装饰器
    
    Args:
        handler_func: 处理函数（装饰器参数）
        log_error: 是否记录错误日志
        reraise: 是否重新抛出异常（用于中间件）
    
    Usage:
        @exception_handler
        async def my_handler(websocket, data):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                # 构建上下文信息
                context = {
                    'function': func.__name__,
                    'args_count': len(args),
                    'kwargs_keys': list(kwargs.keys())
                }
                
                # 处理异常
                error_info = handle_exception(e, context)
                
                # 如果需要记录日志（默认记录）
                if log_error:
                    logger = get_logger()
                    logger.error('处理函数异常', function=func.__name__, error=str(e))
                
                # 如果需要重新抛出（用于中间件统一处理）
                if reraise:
                    raise
                
                # 返回错误响应（如果函数需要返回响应）
                return error_info
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                context = {
                    'function': func.__name__,
                    'args_count': len(args),
                    'kwargs_keys': list(kwargs.keys())
                }
                error_info = handle_exception(e, context)
                
                if log_error:
                    logger = get_logger()
                    logger.error('处理函数异常', function=func.__name__, error=str(e))
                
                if reraise:
                    raise
                
                return error_info
        
        # 判断是异步函数还是同步函数
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    # 支持 @exception_handler 和 @exception_handler() 两种用法
    if handler_func is None:
        return decorator
    else:
        return decorator(handler_func)


__all__ = [
    'ErrorType', 'GameException', 'NetworkException', 'DatabaseException',
    'ValidationException', 'AuthException', 'classify_error', 'is_retryable',
    'handle_exception', 'exception_handler'
]

