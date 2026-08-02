"""
路由系统 - 参考 Pomelo 设计
提供基于字典的路由映射，替代 if-else 链
"""
from typing import Dict, Callable, Any, Optional, Tuple
import asyncio
import json
import time
import inspect
from bson import ObjectId
from handlers import login_handler, character_handler, player_handler, world_handler, chat_handler
from handlers import robot_handler, bag_handler, item_exp_handler, admin_handler, friend_handler
from handlers import battle_handler, battle_room_handler
from handlers import pvp_match_handler
from handlers import connection_handler
from handlers import daletou_handler
from handlers import minigame2_handler
from handlers import story_handler
from handlers import mail_handler
from handlers import equipment_advanced_handler


class RouteHandler:
    """路由处理器"""
    def __init__(self, handler_func: Callable, require_auth: bool = True, 
                 returns_user_ids: bool = False, description: str = ""):
        """
        Args:
            handler_func: 处理函数
            require_auth: 是否需要认证
            returns_user_ids: 是否返回 (user_id, character_id)
            description: 路由描述
        """
        self.handler_func = handler_func
        self.require_auth = require_auth
        self.returns_user_ids = returns_user_ids
        self.description = description


# 路由映射表 - 参考 Pomelo 的路由系统
ROUTES: Dict[str, RouteHandler] = {
    # ========== 连接相关（不需要认证） ==========
    'handshake': RouteHandler(
        connection_handler.handle_handshake,
        require_auth=False,
        returns_user_ids=False,
        description='握手协议'
    ),
    'connection_init': RouteHandler(
        connection_handler.handle_connection_init,
        require_auth=False,
        returns_user_ids=False,
        description='连接初始化'
    ),
    
    # ========== 登录相关（不需要认证） ==========
    'login': RouteHandler(
        login_handler.handle_login,
        require_auth=False,
        returns_user_ids=True,
        description='用户登录'
    ),
    'register': RouteHandler(
        login_handler.handle_register,
        require_auth=False,
        returns_user_ids=True,
        description='用户注册'
    ),
    'auth_request': RouteHandler(
        login_handler.handle_auth_request,
        require_auth=False,
        returns_user_ids=True,
        description='Token 验证'
    ),
    
    # ========== 登录相关（需要认证） ==========
    'logout': RouteHandler(
        login_handler.handle_logout,
        require_auth=True,
        returns_user_ids=True,
        description='用户登出（切换角色，保留token）'
    ),
    'full_logout': RouteHandler(
        login_handler.handle_full_logout,
        require_auth=True,
        returns_user_ids=True,
        description='完全登出（撤销所有Token）'
    ),
    'change_password': RouteHandler(
        login_handler.handle_change_password,
        require_auth=False,
        returns_user_ids=True,
        description='修改密码'
    ),
    'delete_account': RouteHandler(
        login_handler.handle_delete_account,
        require_auth=True,
        returns_user_ids=True,
        description='删除账号'
    ),
    
    # ========== 角色相关 ==========
    'get_all_characters': RouteHandler(
        character_handler.handle_get_all_characters,
        require_auth=True,
        returns_user_ids=True,
        description='获取所有角色'
    ),
    'get_character_info': RouteHandler(
        character_handler.handle_get_character_info,
        require_auth=True,
        returns_user_ids=True,
        description='获取角色信息'
    ),
    'select_character': RouteHandler(
        character_handler.handle_select_character,
        require_auth=True,
        returns_user_ids=True,
        description='选择角色'
    ),
    'create_character': RouteHandler(
        character_handler.handle_create_character,
        require_auth=True,
        returns_user_ids=True,
        description='创建角色'
    ),
    'delete_character': RouteHandler(
        character_handler.handle_delete_character,
        require_auth=True,
        returns_user_ids=True,
        description='删除角色'
    ),
    
    # ========== 玩家相关 ==========
    'get_player': RouteHandler(
        player_handler.handle_get_player,
        require_auth=True,
        returns_user_ids=False,
        description='获取玩家信息'
    ),
    'world_enter': RouteHandler(
        world_handler.handle_world_enter,
        require_auth=True,
        returns_user_ids=False,
        description='进入同图房间（多人在线）'
    ),
    'world_leave': RouteHandler(
        world_handler.handle_world_leave,
        require_auth=True,
        returns_user_ids=False,
        description='离开同图房间'
    ),
    'world_step': RouteHandler(
        world_handler.handle_world_step,
        require_auth=True,
        returns_user_ids=False,
        description='同步大世界一步移动'
    ),
    'daletou_sync': RouteHandler(
        daletou_handler.handle_daletou_sync,
        require_auth=True,
        returns_user_ids=True,
        description='每日大乐透：同步状态与在线时长'
    ),
    'daletou_claim': RouteHandler(
        daletou_handler.handle_daletou_claim,
        require_auth=True,
        returns_user_ids=True,
        description='每日大乐透：领取参与资格'
    ),

    # ========== 期货投资（MiniGame2） ==========
    'minigame2_sync': RouteHandler(
        minigame2_handler.handle_minigame2_sync,
        require_auth=True,
        returns_user_ids=True,
        description='期货投资：同步下注/倒计时/开奖结果'
    ),
    'minigame2_bet': RouteHandler(
        minigame2_handler.handle_minigame2_bet,
        require_auth=True,
        returns_user_ids=True,
        description='期货投资：下注（扣能量块，中奖后发放）'
    ),
    'minigame2_return_history_sync': RouteHandler(
        minigame2_handler.handle_minigame2_return_history_sync,
        require_auth=True,
        returns_user_ids=True,
        description='期货投资：今日总收益与历史回报'
    ),
    
    # ========== 好友相关 ==========
    'get_friend_list': RouteHandler(
        friend_handler.handle_get_friend_list,
        require_auth=True,
        returns_user_ids=True,
        description='获取好友列表'
    ),
    'get_friend_requests': RouteHandler(
        friend_handler.handle_get_friend_requests,
        require_auth=True,
        returns_user_ids=True,
        description='获取好友申请列表'
    ),
    'search_friend': RouteHandler(
        friend_handler.handle_search_friend,
        require_auth=True,
        returns_user_ids=True,
        description='搜索好友'
    ),
    'add_friend': RouteHandler(
        friend_handler.handle_add_friend,
        require_auth=True,
        returns_user_ids=True,
        description='发送好友申请'
    ),
    'approve_friend': RouteHandler(
        friend_handler.handle_approve_friend,
        require_auth=True,
        returns_user_ids=True,
        description='同意好友申请'
    ),
    'reject_friend': RouteHandler(
        friend_handler.handle_reject_friend,
        require_auth=True,
        returns_user_ids=True,
        description='拒绝好友申请'
    ),
    'delete_friend': RouteHandler(
        friend_handler.handle_delete_friend,
        require_auth=True,
        returns_user_ids=True,
        description='删除好友'
    ),
    
    # ========== 聊天相关 ==========
    'get_announcements_history': RouteHandler(
        chat_handler.handle_get_announcements_history,
        require_auth=True,
        returns_user_ids=False,
        description='获取公告历史'
    ),
    'post_announcement': RouteHandler(
        chat_handler.handle_post_announcement,
        require_auth=True,
        returns_user_ids=False,
        description='发布公告'
    ),
    'get_chat_history': RouteHandler(
        chat_handler.handle_get_chat_history,
        require_auth=True,
        returns_user_ids=False,
        description='获取聊天历史'
    ),
    'post_chat': RouteHandler(
        chat_handler.handle_post_chat,
        require_auth=True,
        returns_user_ids=False,
        description='发送聊天消息'
    ),
    
    # ========== 机器人相关 ==========
    'get_random_robot': RouteHandler(
        robot_handler.handle_get_random_robot,
        require_auth=True,
        returns_user_ids=False,
        description='获取随机机器人'
    ),
    'get_robot_pets': RouteHandler(
        robot_handler.handle_get_robot_pets,
        require_auth=True,
        returns_user_ids=False,
        description='获取机器人宠物列表'
    ),
    'get_robot_pet_info': RouteHandler(
        robot_handler.handle_get_robot_pet_info,
        require_auth=True,
        returns_user_ids=False,
        description='获取机器人宠物信息'
    ),
    'get_battle_team': RouteHandler(
        robot_handler.handle_get_battle_team,
        require_auth=True,
        returns_user_ids=False,
        description='获取出战队伍（服务器权威）'
    ),
    'set_battle_team': RouteHandler(
        robot_handler.handle_set_battle_team,
        require_auth=True,
        returns_user_ids=False,
        description='设置出战队伍（服务器权威）'
    ),
    'robot_release_pet': RouteHandler(
        robot_handler.handle_robot_release_pet,
        require_auth=True,
        returns_user_ids=False,
        description='放生机甲（玩家接口）'
    ),
    'battle_generate_enemy': RouteHandler(
        battle_handler.handle_battle_generate_enemy,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：生成敌方机甲（随机角色+满装备+最终属性）'
    ),
    'battle_room_create': RouteHandler(
        battle_room_handler.handle_battle_room_create,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：创建 PVE 房间'
    ),
    'battle_room_action': RouteHandler(
        battle_room_handler.handle_battle_room_action,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：在房间内提交指令并结算一回合'
    ),
    'battle_room_resume': RouteHandler(
        battle_room_handler.handle_battle_room_resume,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：重连/重新进入时恢复房间状态'
    ),
    'battle_result': RouteHandler(
        battle_room_handler.handle_battle_result,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：客户端结束上报（可选日志）'
    ),
    'pvp_flat_match': RouteHandler(
        pvp_match_handler.handle_pvp_flat_match,
        require_auth=True,
        returns_user_ids=False,
        description='战斗：PVP 平匹配（5秒超时）'
    ),
    'create_initial_pet': RouteHandler(
        robot_handler.handle_create_initial_pet,
        require_auth=True,
        returns_user_ids=False,
        description='创建初始宠物'
    ),
    'fix_robot_pet_form': RouteHandler(
        robot_handler.handle_fix_robot_pet_form,
        require_auth=True,
        returns_user_ids=False,
        description='修复机器人宠物形态'
    ),
    'upgrade_robot': RouteHandler(
        robot_handler.handle_upgrade_robot,
        require_auth=True,
        returns_user_ids=False,
        description='升级机器人'
    ),
    'upgrade_all_robots': RouteHandler(
        robot_handler.handle_upgrade_all_robots,
        require_auth=True,
        returns_user_ids=False,
        description='升级所有机器人'
    ),
    
    # ========== 背包相关 ==========
    'bag_write_random': RouteHandler(
        bag_handler.handle_bag_write_random,
        require_auth=True,
        returns_user_ids=False,
        description='随机写入背包'
    ),
    'bag_get': RouteHandler(
        bag_handler.handle_bag_get,
        require_auth=True,
        returns_user_ids=False,
        description='获取背包'
    ),
    'bag_use_item': RouteHandler(
        bag_handler.handle_bag_use_item,
        require_auth=True,
        returns_user_ids=False,
        description='使用物品'
    ),
    'bag_discard_item': RouteHandler(
        bag_handler.handle_bag_discard_item,
        require_auth=True,
        returns_user_ids=False,
        description='丢弃物品'
    ),
    'bag_move_item': RouteHandler(
        bag_handler.handle_bag_move_item,
        require_auth=True,
        returns_user_ids=False,
        description='背包内移动/交换格子'
    ),
    'bag_sort': RouteHandler(
        bag_handler.handle_bag_sort,
        require_auth=True,
        returns_user_ids=False,
        description='背包按分类整理'
    ),
    'unequip_item': RouteHandler(
        bag_handler.handle_unequip_item,
        require_auth=True,
        returns_user_ids=False,
        description='卸下装备'
    ),
    
    # ========== 物品经验相关 ==========
    'add': RouteHandler(
        item_exp_handler.handle_add_item,
        require_auth=True,
        returns_user_ids=False,
        description='添加物品'
    ),
    'add_exp': RouteHandler(
        item_exp_handler.handle_add_exp,
        require_auth=True,
        returns_user_ids=False,
        description='增加经验'
    ),

    # ========== 剧情/任务 ==========
    'story_get_state': RouteHandler(
        story_handler.handle_story_get_state,
        require_auth=True,
        returns_user_ids=True,
        description='获取剧情进度'
    ),
    'story_interact': RouteHandler(
        story_handler.handle_story_interact,
        require_auth=True,
        returns_user_ids=True,
        description='剧情交互预检'
    ),
    'story_event_complete': RouteHandler(
        story_handler.handle_story_event_complete,
        require_auth=True,
        returns_user_ids=True,
        description='剧情事件完成上报（战斗事件委托权威 finalize）'
    ),
    'story_battle_finalize': RouteHandler(
        story_handler.handle_story_battle_finalize,
        require_auth=True,
        returns_user_ids=True,
        description='权威剧情战斗结算（校验房间结果，不接受 battle_won）'
    ),
    'story_battle_start': RouteHandler(
        story_handler.handle_story_battle_start,
        require_auth=True,
        returns_user_ids=True,
        description='[DEPRECATED] 剧情战斗生成敌人；请用 story_interact → battle_room_create(story_event_id)'
    ),

    # ========== 邮件 ==========
    'mail_list': RouteHandler(
        mail_handler.handle_mail_list,
        require_auth=True,
        returns_user_ids=True,
        description='邮件列表'
    ),
    'mail_read': RouteHandler(
        mail_handler.handle_mail_read,
        require_auth=True,
        returns_user_ids=True,
        description='标记邮件已读'
    ),
    'mail_claim': RouteHandler(
        mail_handler.handle_mail_claim,
        require_auth=True,
        returns_user_ids=True,
        description='领取邮件附件'
    ),
    'mail_delete': RouteHandler(
        mail_handler.handle_mail_delete,
        require_auth=True,
        returns_user_ids=True,
        description='删除邮件'
    ),

    # ========== 装备进阶 ==========
    'equip_enhance': RouteHandler(
        equipment_advanced_handler.handle_equip_enhance,
        require_auth=True,
        returns_user_ids=False,
        description='装备强化'
    ),
    'equip_socket': RouteHandler(
        equipment_advanced_handler.handle_equip_socket,
        require_auth=True,
        returns_user_ids=False,
        description='装备镶嵌'
    ),

    # ========== Token 刷新 ==========
    'refresh_token': RouteHandler(
        login_handler.handle_refresh_token,
        require_auth=False,
        returns_user_ids=True,
        description='刷新访问令牌'
    ),
    
    # ========== 管理后台接口 ==========
    # 注意：管理后台接口不需要认证，允许直接访问（生产环境建议添加IP白名单或密码保护）
    'admin_search_account': RouteHandler(
        admin_handler.handle_admin_search_account,
        require_auth=False,
        returns_user_ids=False,
        description='管理员搜索账号'
    ),
    'admin_search_character': RouteHandler(
        admin_handler.handle_admin_search_character,
        require_auth=False,
        returns_user_ids=False,
        description='管理员搜索角色'
    ),
    'admin_get_player_by_id': RouteHandler(
        admin_handler.handle_admin_get_player_by_id,
        require_auth=False,
        returns_user_ids=False,
        description='管理员根据ID获取玩家'
    ),
    'admin_get_server_stats': RouteHandler(
        admin_handler.handle_admin_get_server_stats,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取服务器统计'
    ),
    'admin_modify_gold': RouteHandler(
        admin_handler.handle_admin_modify_gold,
        require_auth=False,
        returns_user_ids=False,
        description='管理员修改金币'
    ),
    'admin_modify_level': RouteHandler(
        admin_handler.handle_admin_modify_level,
        require_auth=False,
        returns_user_ids=False,
        description='管理员修改等级'
    ),
    'admin_get_online_players': RouteHandler(
        admin_handler.handle_admin_get_online_players,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取在线玩家'
    ),
    'admin_add_exp': RouteHandler(
        admin_handler.handle_admin_add_exp,
        require_auth=False,
        returns_user_ids=False,
        description='管理员增加经验'
    ),
    'admin_add_item': RouteHandler(
        admin_handler.handle_admin_add_item,
        require_auth=False,
        returns_user_ids=False,
        description='管理员添加物品'
    ),
    'admin_get_all_accounts': RouteHandler(
        admin_handler.handle_admin_get_all_accounts,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取所有账号列表'
    ),
    'admin_get_robot_pets': RouteHandler(
        admin_handler.handle_admin_get_robot_pets,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取角色的宠物机甲列表'
    ),
    'admin_modify_robot_pet': RouteHandler(
        admin_handler.handle_admin_modify_robot_pet,
        require_auth=False,
        returns_user_ids=False,
        description='管理员修改宠物机甲属性'
    ),
    'admin_reset_robot_pet': RouteHandler(
        admin_handler.handle_admin_reset_robot_pet,
        require_auth=False,
        returns_user_ids=False,
        description='管理员还原宠物机甲为1级'
    ),
    'admin_delete_robot_pet': RouteHandler(
        admin_handler.handle_admin_delete_robot_pet,
        require_auth=False,
        returns_user_ids=False,
        description='管理员删除单个宠物机甲'
    ),
    'admin_clear_all_robots': RouteHandler(
        admin_handler.handle_admin_clear_all_robots,
        require_auth=False,
        returns_user_ids=False,
        description='管理员清空角色的所有机甲'
    ),
    'admin_add_random_robots': RouteHandler(
        admin_handler.handle_admin_add_random_robots,
        require_auth=False,
        returns_user_ids=False,
        description='管理员为角色添加指定数量的随机机甲'
    ),
    'admin_register_admin_account': RouteHandler(
        admin_handler.handle_admin_register_admin_account,
        require_auth=False,
        returns_user_ids=False,
        description='管理员一键注册内部游戏账号'
    ),
    'admin_get_admin_accounts': RouteHandler(
        admin_handler.handle_admin_get_admin_accounts,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取所有管理员账号列表'
    ),
    'admin_delete_admin_account': RouteHandler(
        admin_handler.handle_admin_delete_admin_account,
        require_auth=False,
        returns_user_ids=False,
        description='管理员删除管理员账号'
    ),
    'admin_get_route_stats': RouteHandler(
        admin_handler.handle_admin_get_route_stats,
        require_auth=False,
        returns_user_ids=False,
        description='管理员获取路由统计信息'
    ),
    'admin_reset_story': RouteHandler(
        story_handler.handle_admin_reset_story,
        require_auth=False,
        returns_user_ids=False,
        description='管理员重置剧情进度'
    ),
    'admin_complete_story_task': RouteHandler(
        story_handler.handle_admin_complete_story_task,
        require_auth=False,
        returns_user_ids=False,
        description='管理员强制完成任务'
    ),
    'admin_send_mail': RouteHandler(
        mail_handler.handle_admin_send_mail,
        require_auth=False,
        returns_user_ids=False,
        description='管理员发送邮件'
    ),
}


async def handle_route(route: str, websocket, data: dict, 
                      current_user_id: Optional[Any], 
                      current_character_id: Optional[Any]) -> Tuple[Optional[Any], Optional[Any]]:
    """
    处理路由请求 - 参考 Pomelo 的路由处理方式
    
    Args:
        route: 路由名称（消息类型）
        websocket: WebSocket 连接
        data: 消息数据
        current_user_id: 当前用户ID
        current_character_id: 当前角色ID
        
    Returns:
        (new_user_id, new_character_id) 元组
    """
    # 导入路由统计服务
    from services.route_stats_service import route_stats_service
    
    # 记录开始时间
    start_time = time.time()
    is_error = False
    
    # 查找路由
    route_handler = ROUTES.get(route)
    
    if not route_handler:
        # 未知路由
        from handlers import utils
        duration = time.time() - start_time
        route_stats_service.record_call(route or 'None', duration, is_error=True)
        # 如果route为None，使用'unknown'作为默认值
        error_route = route if route else 'unknown'
        await utils.send_error_response(websocket, error_route, f'Unknown route: {route}', request_data=data)
        return current_user_id, current_character_id
    
    # 调用处理器
    try:
        handler_func = route_handler.handler_func
        
        # 获取函数签名，智能传递参数
        sig = inspect.signature(handler_func)
        param_count = len(sig.parameters)
        param_names = list(sig.parameters.keys())
        
        # 根据函数签名动态构建参数
        if param_count == 2:
            # 只需要 websocket 和 data
            result = await handler_func(websocket, data)
        elif param_count == 3:
            # 需要 websocket, data, 和第三个参数
            param_name = param_names[2] if len(param_names) > 2 else None
            if param_name and 'character' in param_name.lower():
                # 第三个参数是 character_id
                result = await handler_func(websocket, data, current_character_id)
            else:
                # 第三个参数是 user_id（大多数情况）
                result = await handler_func(websocket, data, current_user_id)
        elif param_count == 4:
            # 需要 websocket, data, 和两个额外参数
            # 检查第三个参数名来判断参数类型
            param2_name = param_names[2] if len(param_names) > 2 else ''
            param3_name = param_names[3] if len(param_names) > 3 else ''
            
            # 特殊处理：handle_add_exp 的特殊情况
            if 'add_exp' in route or ('func' in param3_name.lower() or 'callback' in param3_name.lower()):
                # handle_add_exp: (websocket, data, current_character_id, add_exp_to_player_func)
                from ws_server import add_exp_to_player
                result = await handler_func(websocket, data, current_character_id, add_exp_to_player)
            elif 'character' in param2_name.lower() and 'character' in param3_name.lower():
                # 两个都是 character_id（不太可能，但处理一下）
                result = await handler_func(websocket, data, current_character_id, current_character_id)
            elif 'character' in param2_name.lower():
                # 第三个是 character_id，第四个可能是 user_id 或其他
                if 'user' in param3_name.lower():
                    result = await handler_func(websocket, data, current_character_id, current_user_id)
                else:
                    result = await handler_func(websocket, data, current_character_id, None)
            else:
                # 默认：user_id, character_id
                result = await handler_func(websocket, data, current_user_id, current_character_id)
        else:
            # 其他情况（5个参数以上），尝试传递常用参数
            # 对于特殊函数，需要手动处理
            if 'add_exp' in route:
                from ws_server import add_exp_to_player
                result = await handler_func(websocket, data, current_character_id, add_exp_to_player)
            else:
                # 默认尝试传递所有参数
                result = await handler_func(websocket, data, current_user_id, current_character_id)
        
        # 记录成功调用
        duration = time.time() - start_time
        route_stats_service.record_call(route, duration, is_error=False)
        # 关键路由慢请求可观测（与 ws_server 慢请求日志互补，便于对齐客户端超时）
        _SLOW_ROUTES_MS = {
            'get_robot_pets': 2500.0,
            'world_enter': 2000.0,
            'bag_write_random': 3000.0,
            'minigame2_sync': 2000.0,
            'bag_use_item': 3000.0,
        }
        thr = _SLOW_ROUTES_MS.get(route)
        if thr is not None and duration * 1000.0 >= thr:
            try:
                from services.logger_service import get_logger
                get_logger().warning(
                    '路由耗时偏高',
                    route=route,
                    duration_ms=round(duration * 1000.0, 2),
                    threshold_ms=thr,
                )
            except Exception:
                pass
        
        # 处理返回值
        if route_handler.returns_user_ids:
            # 应该返回 (user_id, character_id) 或只返回 user_id
            if isinstance(result, tuple) and len(result) == 2:
                # 返回了 (user_id, character_id)
                return result
            elif result is not None and (isinstance(result, (str, ObjectId)) or hasattr(result, '__class__')):
                # 只返回了 user_id（单个值），character_id 保持不变
                return result, current_character_id
            else:
                # 没有返回值或返回 None，保持原值
                return current_user_id, current_character_id
        else:
            # 不返回 user_id，保持原值
            return current_user_id, current_character_id
            
    except Exception as e:
        # 错误处理
        import traceback
        print(f'[路由错误] {route}: {e}')
        traceback.print_exc()
        duration = time.time() - start_time
        route_stats_service.record_call(route, duration, is_error=True)
        from handlers import utils
        await utils.send_error_response(websocket, route, f'Handler error: {str(e)}', request_data=data)
        return current_user_id, current_character_id


def get_route_info(route: str) -> Optional[Dict[str, Any]]:
    """获取路由信息"""
    route_handler = ROUTES.get(route)
    if route_handler:
        return {
            'route': route,
            'require_auth': route_handler.require_auth,
            'description': route_handler.description
        }
    return None


def list_all_routes() -> Dict[str, Dict[str, Any]]:
    """列出所有路由"""
    return {
        route: {
            'require_auth': handler.require_auth,
            'description': handler.description
        }
        for route, handler in ROUTES.items()
    }


def get_route_stats(route: Optional[str] = None) -> Dict:
    """获取路由统计信息"""
    from services.route_stats_service import route_stats_service
    return route_stats_service.get_stats(route)


def get_total_route_stats() -> Dict:
    """获取总体路由统计信息"""
    from services.route_stats_service import route_stats_service
    return route_stats_service.get_total_stats()

