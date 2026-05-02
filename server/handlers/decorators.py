"""
统一异常处理装饰器
为 Handler 提供统一的异常处理机制
"""
import functools
import traceback
from typing import Callable
from . import utils


def handle_exceptions(route_name: str):
    """
    统一异常处理装饰器
    
    Args:
        route_name: 路由名称（用于错误响应）
    
    Example:
        @handle_exceptions('login')
        async def handle_login(websocket, data, current_user_id):
            # ... 处理逻辑 ...
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(websocket, data, *args, **kwargs):
            try:
                return await func(websocket, data, *args, **kwargs)
            except Exception as e:
                # 记录错误日志
                try:
                    from services.logger_service import get_logger
                    logger = get_logger()
                    logger.error(
                        f'Handler错误: {route_name}',
                        error=str(e),
                        route=route_name
                    )
                except:
                    # 如果日志服务未初始化，使用 print
                    print(f'[错误] {route_name}: {e}')
                    traceback.print_exc()
                
                # 发送统一错误响应
                try:
                    await utils.send_error_response(
                        websocket,
                        route_name,
                        f'服务器错误: {str(e)}',
                        code=500
                    )
                except:
                    # 如果发送响应失败，记录但不抛出异常
                    pass
                
                # 返回 None 或原值，避免影响后续处理
                # 对于返回 (user_id, character_id) 的函数，返回 None, None
                if func.__name__.startswith('handle_'):
                    # 尝试从 args 中获取 current_user_id 和 current_character_id
                    if len(args) >= 1:
                        current_user_id = args[0] if len(args) > 0 else None
                        current_character_id = args[1] if len(args) > 1 else None
                        # 如果函数返回元组，返回 (None, None) 或保持原值
                        return current_user_id, current_character_id if current_character_id is not None else None
                    return None
                return None
        return wrapper
    return decorator

