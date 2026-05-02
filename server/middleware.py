"""
中间件系统 - 参考 Pomelo 的中间件设计
提供认证、日志、限流等中间件功能
"""
from typing import Dict, Callable, Optional, Any
from collections import defaultdict
import time
import json
import asyncio
from handlers import utils
from services.session_service import session_service
from services.logger_service import get_logger


class MiddlewareContext:
    """中间件上下文"""
    def __init__(self, websocket, data: dict, current_user_id: Optional[Any], 
                 current_character_id: Optional[Any], route: str):
        self.websocket = websocket
        self.data = data
        self.current_user_id = current_user_id
        self.current_character_id = current_character_id
        self.route = route
        self.start_time = time.time()
        self.metadata = {}  # 用于中间件之间传递数据


# 中间件类型定义
MiddlewareFunc = Callable[[MiddlewareContext], Any]


class MiddlewareManager:
    """中间件管理器"""
    
    def __init__(self):
        self.middlewares: list[MiddlewareFunc] = []
    
    def use(self, middleware: MiddlewareFunc):
        """添加中间件"""
        self.middlewares.append(middleware)
        return self
    
    async def execute(self, context: MiddlewareContext, handler: Callable):
        """执行中间件链和处理器"""
        async def next_middleware(index: int):
            if index >= len(self.middlewares):
                # 所有中间件执行完毕，执行处理器
                return await handler(context)
            else:
                # 执行下一个中间件
                middleware = self.middlewares[index]
                if asyncio.iscoroutinefunction(middleware):
                    return await middleware(context, lambda: next_middleware(index + 1))
                else:
                    return middleware(context, lambda: next_middleware(index + 1))
        
        return await next_middleware(0)


# 全局中间件管理器
middleware_manager = MiddlewareManager()


# ========== 内置中间件 ==========

async def auth_middleware(context: MiddlewareContext, next_func: Callable):
    """认证中间件 - 检查用户是否已登录（支持测试模式：通过user_id自动认证）
    增强：检查Token过期和撤销状态
    """
    from router import ROUTES
    from services.token_service import token_service
    
    route_handler = ROUTES.get(context.route)
    
    # 心跳和不需要认证的路由直接通过
    if context.route == 'pong' or (route_handler and not route_handler.require_auth):
        return await next_func()
    
    # 需要认证的路由检查
    if route_handler and route_handler.require_auth:
        # 检查Token是否被撤销
        token = context.data.get('token')
        if token and token_service.is_token_revoked(token):
            logger = get_logger()
            logger.warning('Token已撤销', route=context.route, token=token[:8] + '...')
            await utils.send_error_response(
                context.websocket,
                context.route,
                'Token已撤销，请重新登录',
                code=401,
                request_data=context.data
            )
            return None
        
        # 检查Token是否过期（如果提供了token_expires_at）
        token_expires_at = context.data.get('token_expires_at')
        if token_expires_at and token_service.is_token_expired(token_expires_at):
            logger = get_logger()
            logger.warning('Token已过期', route=context.route, token=token[:8] + '...' if token else None)
            await utils.send_error_response(
                context.websocket,
                context.route,
                'Token已过期，请使用refresh_token刷新',
                code=401,
                request_data=context.data
            )
            return None
        # 禁止仅凭 user_id 自动认证，必须先完成 auth_request 会话建立。
        if not context.current_user_id:
            logger = get_logger()
            logger.warning('路由需要认证，但 current_user_id 为空', route=context.route)
            await utils.send_error_response(
                context.websocket, 
                context.route, 
                'Authentication required',
                code=401,
                request_data=context.data
            )
            return None
        else:
            # 从 Session 获取认证信息（如果存在）
            session = session_service.get_session_by_websocket(context.websocket)
            if session:
                context.current_user_id = session.user_id
                context.current_character_id = session.character_id
                session.update_active()
            
            logger = get_logger()
            logger.debug('路由认证通过', route=context.route, 
                        user_id=str(context.current_user_id) if context.current_user_id else None,
                        character_id=str(context.current_character_id) if context.current_character_id else None)
    
    return await next_func()


async def log_middleware(context: MiddlewareContext, next_func: Callable):
    """日志中间件 - 记录请求日志"""
    start_time = time.time()
    logger = get_logger()
    
    try:
        result = await next_func()
        elapsed = (time.time() - start_time) * 1000  # 毫秒
        logger.info('路由处理完成', route=context.route, 
                   user_id=str(context.current_user_id) if context.current_user_id else 'anonymous',
                   elapsed_ms=f'{elapsed:.2f}ms')
        return result
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        logger.error('路由处理失败', route=context.route,
                    user_id=str(context.current_user_id) if context.current_user_id else 'anonymous',
                    elapsed_ms=f'{elapsed:.2f}ms', error=str(e))
        raise


async def performance_middleware(context: MiddlewareContext, next_func: Callable):
    """
    性能监控中间件 - 记录每个路由的处理时间
    用于性能分析和问题诊断（慢请求检测）
    """
    # 执行下一个中间件或处理器
    try:
        result = await next_func()
        duration = time.time() - context.start_time
        
        # 将处理时间保存到上下文中，供其他中间件使用
        context.metadata['duration'] = duration
        context.metadata['success'] = True
        
        # 记录慢请求（超过100ms）
        if duration > 0.1:
            logger = get_logger()
            logger.warning(
                '慢请求检测',
                route=context.route,
                duration_ms=round(duration * 1000, 2),
                user_id=str(context.current_user_id) if context.current_user_id else None
            )
        
        return result
    except Exception as e:
        # 记录错误
        duration = time.time() - context.start_time
        context.metadata['duration'] = duration
        context.metadata['success'] = False
        context.metadata['error'] = str(e)
        raise


async def performance_middleware(context: MiddlewareContext, next_func: Callable):
    """
    性能监控中间件 - 记录每个路由的处理时间
    用于性能分析和问题诊断（慢请求检测）
    """
    # 执行下一个中间件或处理器
    try:
        result = await next_func()
        duration = time.time() - context.start_time
        
        # 将处理时间保存到上下文中，供其他中间件使用
        context.metadata['duration'] = duration
        context.metadata['success'] = True
        
        # 记录慢请求（超过100ms）
        if duration > 0.1:
            logger = get_logger()
            logger.warning(
                '慢请求检测',
                route=context.route,
                duration_ms=round(duration * 1000, 2),
                user_id=str(context.current_user_id) if context.current_user_id else None
            )
        
        return result
    except Exception as e:
        # 记录错误
        duration = time.time() - context.start_time
        context.metadata['duration'] = duration
        context.metadata['success'] = False
        context.metadata['error'] = str(e)
        raise


async def serial_middleware(context: MiddlewareContext, next_func: Callable):
    """
    请求序列化中间件 - 参考 PomeloServer 的 serial filter
    确保同一用户的请求串行处理，避免并发导致的状态不一致
    """
    from services.task_manager import task_manager
    
    # 如果不需要认证或没有用户ID，直接通过（不需要序列化）
    if not context.current_user_id:
        return await next_func()
    
    # 使用 user_id 作为队列键，确保同一用户的请求串行处理
    user_id_str = str(context.current_user_id)
    
    # 创建事件来等待任务完成
    task_done = asyncio.Event()
    task_result = None
    task_error = None
    
    # 定义任务函数（异步包装）
    async def task_fn():
        nonlocal task_result, task_error
        try:
            task_result = await next_func()
        except Exception as e:
            task_error = e
            raise
        finally:
            task_done.set()
    
    # 定义超时回调
    def ontimeout():
        logger = get_logger()
        logger.warning('请求序列化超时', route=context.route, user_id=user_id_str)
        task_done.set()  # 超时也要设置事件，避免永久等待
    
    # 将请求添加到任务队列（串行执行）
    task = await task_manager.add_task(
        key=user_id_str,
        fn=task_fn,
        ontimeout=ontimeout,
        timeout=10.0  # 10秒超时
    )
    
    # 等待任务完成
    await task_done.wait()
    
    # 如果任务有错误，抛出异常
    if task_error:
        raise task_error
    
    return task_result


# 限流配置（按路由）
ROUTE_RATE_LIMIT = {
    'upgrade_robot': 0.3,  # 每0.3秒一次
    'get_robot_pets': 0.35,  # 客户端单飞后略放宽，仍防撞库
    'bag_use_item': 0.2,    # 每0.2秒一次
    'get_robot_pet_info': 0.3,  # 每0.3秒一次
    'daletou_sync': 0.5,
    'daletou_claim': 1.0,
}

# 限流记录 {user_id: {route: last_time}}
rate_limit_timers: Dict[str, Dict[str, float]] = defaultdict(dict)

# 限流记录清理时间（定期清理长时间未使用的记录）
_last_rate_limit_cleanup = time.time()
RATE_LIMIT_CLEANUP_INTERVAL = 300  # 5分钟清理一次

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

async def rate_limit_middleware(context: MiddlewareContext, next_func: Callable):
    """
    限流中间件 - 防止请求过于频繁
    参考 PomeloServer 的限流机制，按用户、按路由进行限流
    """
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


async def validate_middleware(context: MiddlewareContext, next_func: Callable):
    """验证中间件 - 验证消息格式"""
    # 检查必要字段
    if 'type' not in context.data:
        await utils.send_error_response(
            context.websocket,
            context.route,
            'Missing required field: type',
            code=400,
            request_data=context.data
        )
        return None
    
    return await next_func()


# 过载保护中间件（需要安装 psutil）
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
        # 关键路由：避免在开发/预览阶段触发过载误杀
        # 包含登录/握手 + 角色选择/背包/机器人宠物等高并发直连接口
        critical_routes = {
            'handshake', 'login', 'pong', 'auth_request', 'register',
            'get_character_info', 'get_all_characters',
            'bag_get',
            'bag_move_item',
            'bag_sort',
            'get_robot_pets',
            # 游戏关键：恢复战斗态/拉取面板数据（避免 503 导致 UI 空数据）
            'battle_room_resume',
            'get_chat_history',
            'get_announcements_history',
            'get_player'
        }
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

# 注册中间件（按执行顺序）
# 注意：过载保护应该在认证之前，避免过载时还处理认证逻辑
middleware_manager.use(validate_middleware)
middleware_manager.use(log_middleware)
middleware_manager.use(toobusy_middleware)  # 过载保护（新增）
middleware_manager.use(performance_middleware)
middleware_manager.use(auth_middleware)
middleware_manager.use(serial_middleware)

# 可选中间件
try:
    from middleware.idempotency_middleware import idempotency_middleware
    # middleware_manager.use(idempotency_middleware)  # 可选：启用幂等性检查
except ImportError:
    pass  # 如果模块不存在，跳过

# 限流中间件
middleware_manager.use(rate_limit_middleware)

