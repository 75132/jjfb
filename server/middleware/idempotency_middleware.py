"""
幂等性中间件 - 确保相同请求只执行一次
"""
import json
from typing import Callable
from middleware import MiddlewareContext
from services.idempotency_service import idempotency_service
from services.logger_service import get_logger
from handlers import utils


# 定义幂等性路由（这些路由可以安全地重复执行）
IDEMPOTENT_ROUTES = {
    'get_player',           # 查询操作都是幂等的
    'get_character_info',
    'get_all_characters',
    'get_robot_pets',
    'get_robot_pet_info',
    'bag_get',
    'get_chat_history',
    'get_announcements_history',
    'get_friend_list',
    'get_friend_requests',
    'search_friend',
}

# 定义非幂等性路由（这些路由不能重复执行）
NON_IDEMPOTENT_ROUTES = {
    'upgrade_robot',        # 修改操作通常不是幂等的
    'upgrade_all_robots',
    'bag_use_item',
    'bag_discard_item',
    'bag_move_item',
    'bag_sort',
    'add_exp',
    'add',
    'create_character',
    'delete_character',
    'add_friend',
    'approve_friend',
    'reject_friend',
    'delete_friend',
    'post_chat',
    'post_announcement',
    'change_password',
    'delete_account',
}


async def idempotency_middleware(context: MiddlewareContext, next_func: Callable):
    """
    幂等性中间件
    检查请求是否已处理，如果是则返回缓存结果
    """
    # 如果不需要认证或没有用户ID，跳过幂等性检查
    if not context.current_user_id:
        return await next_func()
    
    route = context.route
    
    # 检查路由是否需要幂等性检查
    # 查询操作通常是幂等的，修改操作通常不是幂等的
    is_idempotent_route = (
        route in IDEMPOTENT_ROUTES or
        route.startswith('get_') or
        route.startswith('search_')
    )
    
    # 如果路由明确标记为非幂等，跳过检查
    if route in NON_IDEMPOTENT_ROUTES:
        return await next_func()
    
    # 获取请求ID（如果客户端提供了）
    request_id = context.data.get('request_id')
    
    # 如果没有提供 request_id，且是幂等性路由，生成一个
    if not request_id and is_idempotent_route:
        request_id = idempotency_service.generate_request_id(
            str(context.current_user_id),
            route,
            context.data
        )
        # 将 request_id 添加到上下文中，以便后续使用
        context.metadata['generated_request_id'] = request_id
    
    # 如果有 request_id，检查是否已处理
    if request_id:
        cached_result = idempotency_service.get_result(request_id)
        if cached_result is not None:
            logger = get_logger()
            logger.debug('返回幂等性缓存结果', route=route, request_id=request_id[:8])
            
            # 返回缓存的结果
            # 注意：这里需要根据实际的响应格式来构建响应
            # 假设缓存的结果是完整的响应数据
            if isinstance(cached_result, dict):
                # 如果缓存的是响应数据，直接发送
                # 确保 request_id 包含在响应中
                await utils.send_response(
                    context.websocket,
                    route,
                    success=cached_result.get('success', True),
                    data=cached_result.get('data'),
                    message=cached_result.get('message'),
                    code=cached_result.get('code', 200),
                    request_id=request_id,  # 确保 request_id 包含在响应中
                    request_data=context.data
                )
            return cached_result
    
    # 执行请求处理
    result = await next_func()
    
    # 如果请求成功且有 request_id，缓存结果
    if request_id and result is not None:
        # 尝试从结果中提取响应数据
        if isinstance(result, dict):
            idempotency_service.mark_processed(request_id, result)
        elif hasattr(result, '__dict__'):
            # 如果是对象，转换为字典
            idempotency_service.mark_processed(request_id, result.__dict__)
    
    return result

