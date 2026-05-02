"""
连接管理 Handler - 处理握手、心跳等连接相关逻辑
参考 PomeloServer 的 handshake 命令
"""
from handlers import utils
import time


async def handle_handshake(websocket, data):
    """
    处理握手请求 - 参考 PomeloServer 的 handshake 命令
    
    请求格式：
    {
        "type": "handshake",
        "sys": {
            "type": "websocket",  // 客户端类型
            "version": "1.0.0"     // 客户端版本
        }
    }
    """
    from services.logger_service import get_logger
    logger = get_logger()
    
    sys_info = data.get('sys', {})
    client_type = sys_info.get('type', 'websocket')
    client_version = sys_info.get('version', '1.0.0')
    
    logger.info('收到握手请求', client_type=client_type, client_version=client_version)
    
    # 检查客户端版本（可选，暂时不启用）
    # MIN_CLIENT_VERSION = '1.0.0'
    # if compare_version(client_version, MIN_CLIENT_VERSION) < 0:
    #     await utils.send_error_response(websocket, 'handshake', 'Client version too old', code=501, request_data=data)
    #     return
    
    # 构建握手响应
    response_data = {
        'sys': {
            'heartbeat': 30,  # 心跳间隔（秒）
            'heartbeat_timeout': 60,  # 心跳超时（秒）
        }
    }
    
    # 如果启用字典，返回字典信息（暂时不依赖 dictionary_service，后续集成）
    try:
        from services.dictionary_service import dictionary_service
        dict_version = dictionary_service.get_version()
        client_dict_version = sys_info.get('dict_version', '')
        
        if dict_version:
            if client_dict_version != dict_version:
                # 客户端字典版本不一致，返回完整字典
                response_data['sys']['dict'] = dictionary_service.get_dict()
                response_data['sys']['code_to_route'] = dictionary_service.get_abbrs()
                response_data['sys']['dict_version'] = dict_version
                response_data['sys']['use_dict'] = True
                logger.info('返回完整字典', dict_version=dict_version)
            elif client_dict_version == dict_version:
                # 版本一致，只需标记使用字典
                response_data['sys']['dict_version'] = dict_version
                response_data['sys']['use_dict'] = True
                logger.info('字典版本一致', dict_version=dict_version)
    except ImportError:
        # Dictionary 服务未实现，跳过字典相关逻辑
        logger.debug('Dictionary 服务未实现，跳过字典同步')
        pass
    
    # 如果启用压缩，返回压缩配置
    response_data['sys']['use_compression'] = True  # 当前已启用 deflate
    
    # 使用直接发送格式（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'handshake_ack',
        'success': True,
        'code': 200,
        **response_data
    }, request_data=data)
    
    logger.info('握手响应已发送', client_type=client_type, client_version=client_version)


async def handle_connection_init(websocket, data):
    """兼容旧客户端的 connection_init 路由"""
    await utils.send_success_response(
        websocket,
        'connection_init',
        message='连接初始化成功',
        request_data=data
    )

