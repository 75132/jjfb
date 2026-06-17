"""
登录相关操作处理器
处理：login, register, auth_request, logout, change_password, delete_account
"""
import json
import datetime
import math
from . import utils
from .decorators import handle_exceptions
from .password_util import hash_password, verify_password, needs_rehash
from services.session_service import session_service
from services.world_presence_service import world_presence_service
from services.logger_service import get_logger
import asyncio

# 安全阀：离线/未鉴权超过该阈值，禁止直接凭本地 token 自动 auth_request，
# 必须重新走 login 流程。
# 单位：秒。离线超过该时长就必须重登（10分钟策略）。
AUTH_INACTIVITY_RELOGIN_SECONDS = 10 * 60


@handle_exceptions('login')
async def handle_login(websocket, data, current_user_id):
    """处理登录请求（支持 Token 刷新机制）"""
    from services.token_service import token_service
    
    account = data.get('account')
    password = data.get('password')
    refresh_token = data.get('refresh_token')  # 支持通过 refresh_token 刷新
    client_ip = utils.get_client_ip(websocket)
    now_utc = datetime.datetime.utcnow()

    def _lock_msg(lock_until):
        if not lock_until:
            return '账号已锁定，请稍后重试'
        remain = max(1, math.ceil((lock_until - datetime.datetime.utcnow()).total_seconds()))
        return f'账号已锁定，{remain}秒后重试'
    
    # 如果提供了 refresh_token，尝试刷新 Token
    if refresh_token:
        # 查找拥有该 refresh_token 的用户
        user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({
            'refresh_token': refresh_token
        }))
        
        if user:
            # 检查 refresh_token 是否过期
            refresh_expires_at = user.get('refresh_token_expires_at', 0)
            if not token_service.is_token_expired(refresh_expires_at):
                # 检查 refresh_token 是否被撤销
                if not token_service.is_token_revoked(refresh_token):
                    # 生成新的 Token 对
                    access_token, new_refresh_token, access_expires_at, refresh_expires_at = \
                        token_service.generate_token_pair(str(user['_id']), account)
                    
                    # 更新用户 Token
                    utils.safe_mongo_operation(lambda: utils.users_col.update_one(
                        {'_id': user['_id']},
                        {'$set': {
                            'token': access_token,
                            'refresh_token': new_refresh_token,
                            'token_expires_at': access_expires_at,
                            'refresh_token_expires_at': refresh_expires_at,
                            'last_login': now_utc,
                            'last_auth_verified_at': now_utc
                        }}
                    ))
                    
                    current_user_id = user['_id']
                    utils.register_client_user(websocket, current_user_id)
                    
                    # Token刷新时也创建Session（会自动踢掉旧连接）
                    session_service.create_session(current_user_id, websocket, None, is_test_mode=False)
                    
                    logger = get_logger()
                    logger.info('Token刷新成功', user_id=str(current_user_id))
                    
                    # 返回新的 Token 对（使用直接发送格式，自动添加request_id）
                    await utils.send_direct_response(websocket, {
                        'type': 'login_response',
                        'success': True,
                        'message': 'Token刷新成功',
                        'token': access_token,
                        'refresh_token': new_refresh_token,
                        'token_expires_at': access_expires_at,
                        'refresh_token_expires_at': refresh_expires_at,
                        'user_id': str(current_user_id)
                    }, request_data=data)
                    return current_user_id
                else:
                    logger = get_logger()
                    logger.warning('Refresh Token已撤销', account=account)
                    await utils.send_error_response(websocket, 'login', 'Refresh Token已撤销', code=401, request_data=data)
                    return current_user_id
            else:
                logger = get_logger()
                logger.warning('Refresh Token已过期', account=account)
                await utils.send_error_response(websocket, 'login', 'Refresh Token已过期', code=401, request_data=data)
                return current_user_id
        else:
            logger = get_logger()
            logger.warning('无效的Refresh Token', account=account)
            await utils.send_error_response(websocket, 'login', '无效的Refresh Token', code=401, request_data=data)
            return current_user_id
    
    # 正常登录流程
    if not account or not password:
        await utils.send_error_response(websocket, 'login', '账号或密码不能为空', code=400, request_data=data)
        return current_user_id

    # 防恶意锁号：仅锁定“账号 + IP”，不锁全局账号
    is_locked, lock_until = utils.is_account_action_locked(account, client_ip, 'login')
    if is_locked:
        await utils.send_error_response(websocket, 'login', _lock_msg(lock_until), code=429, request_data=data)
        return current_user_id

    user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'account': account}))
    if user and verify_password(password, user.get('password', '')):
        if needs_rehash(user.get('password', '')):
            utils.safe_mongo_operation(lambda: utils.users_col.update_one(
                {'_id': user['_id']}, {'$set': {'password': hash_password(password)}}
            ))
        # 登录成功，清空该账号+IP的登录失败计数
        utils.clear_account_action_failures(account, client_ip, 'login')

        # 生成新的 Token 对（Access Token + Refresh Token）
        access_token, refresh_token, access_expires_at, refresh_expires_at = \
            token_service.generate_token_pair(str(user['_id']), account)
        
        # 撤销旧的 Token（如果存在）
        old_token = user.get('token')
        old_refresh_token = user.get('refresh_token')
        if old_token:
            token_service.revoke_token(old_token, user.get('token_expires_at'))
        if old_refresh_token:
            token_service.revoke_token(old_refresh_token, user.get('refresh_token_expires_at'))
        
        # 更新用户 Token 和最后登录时间
        utils.safe_mongo_operation(lambda: utils.users_col.update_one(
            {'_id': user['_id']},
            {'$set': {
                'token': access_token,
                'refresh_token': refresh_token,
                'token_expires_at': access_expires_at,
                'refresh_token_expires_at': refresh_expires_at,
                'last_login': now_utc,
                'last_auth_verified_at': now_utc
            }}
        ))
        
        current_user_id = user['_id']
        utils.register_client_user(websocket, current_user_id)
        
        # 创建 Session（如果用户已有Session，会自动踢掉旧连接）
        session_service.create_session(current_user_id, websocket, None, is_test_mode=False)
        
        logger = get_logger()
        logger.info('用户登录成功', account=account, user_id=str(current_user_id))
        
        # 保持向后兼容：将 token 和 user_id 直接放在响应根级别（自动添加request_id）
        await utils.send_direct_response(websocket, {
            'type': 'login_response',
            'success': True,
            'message': '登录成功',
            'token': access_token,
            'refresh_token': refresh_token,
            'token_expires_at': access_expires_at,
            'refresh_token_expires_at': refresh_expires_at,
            'user_id': str(current_user_id)
        }, request_data=data)
        return current_user_id
    else:
        _, lock_until = utils.record_account_action_failure(account, client_ip, 'login', max_fail=5, lock_minutes=5)
        logger = get_logger()
        logger.warning('登录失败：账号或密码错误', account=account, ip=client_ip)
        if lock_until:
            await utils.send_error_response(websocket, 'login', _lock_msg(lock_until), code=429, request_data=data)
        else:
            await utils.send_error_response(websocket, 'login', '账号或密码错误', code=401, request_data=data)
        return current_user_id


@handle_exceptions('auth_request')
async def handle_auth_request(websocket, data, current_user_id, current_character_id=None):
    """处理token验证请求（支持自动选择角色 + 测试模式：通过user_id直接验证）"""
    token = data.get('token')
    user_id_from_client = data.get('user_id')  # 测试模式：客户端提供的user_id
    character_id_from_client = data.get('character_id')  # 客户端提供的character_id
    
    user = None
    is_test_mode = False
    
    # 方案1：优先通过token验证
    if token:
        # 查找拥有该token的用户（使用缓存优化）
        user = utils.get_cached_user(token)
        if not user:
            user = utils.get_user_by_token(token)
            if user:
                utils.set_cached_user(token, user)
    
    if user:
        current_user_id = user['_id']
        utils.register_client_user(websocket, current_user_id)
        logger = get_logger()
        logger.info('验证成功', user_id=str(current_user_id), is_test_mode=is_test_mode)

        # ========== inactivity 安全阀（服务端裁决）==========
        # 从用户表取“最近一次成功鉴权/登录”时间戳，判断离线时长是否超过阈值。
        # - 超过阈值：拒绝 auth_request，返回 auth_response(success=false) 并提示必须重登
        # - 未超过阈值：允许继续，并在成功后刷新 last_auth_verified_at
        now_utc = datetime.datetime.utcnow()
        last_verified_at = user.get('last_auth_verified_at') or user.get('last_login')
        if isinstance(last_verified_at, datetime.datetime):
            idle_seconds = (now_utc - last_verified_at).total_seconds()
            if idle_seconds > AUTH_INACTIVITY_RELOGIN_SECONDS:
                logger.warning(
                    'auth_request: inactivity 超阈值，拒绝自动鉴权并要求重登',
                    user_id=str(current_user_id),
                    idle_seconds=idle_seconds,
                    threshold_seconds=AUTH_INACTIVITY_RELOGIN_SECONDS
                )
                await utils.send_direct_response(websocket, {
                    'type': 'auth_response',
                    'success': False,
                    'code': 401,
                    'message': '离线/未鉴权过久，请重新登录',
                    'user_id': str(current_user_id),
                    'character_id': None
                }, request_data=data)
                return current_user_id, None
        
        # 关键修复：如果客户端提供了 character_id，验证并自动选择角色
        # 断线重连容错：如果客户端没带 character_id，不要把会话角色覆盖成 None；
        # 先尝试从该用户已有 session 历史中恢复一个非空 character_id。
        character_id = character_id_from_client or data.get('character_id')
        if not character_id and current_user_id:
            try:
                existing_sessions = session_service.sessions.get(current_user_id, [])
                for s in reversed(existing_sessions):
                    if getattr(s, 'character_id', None):
                        character_id = s.character_id
                        logger.info(
                            'auth_request: 未传 character_id，已从历史 session 恢复',
                            user_id=str(current_user_id),
                            character_id=str(character_id)
                        )
                        break
            except Exception as e:
                logger.warning(
                    'auth_request: 从历史 session 恢复 character_id 失败',
                    error=str(e),
                    user_id=str(current_user_id)
                )
        if character_id:
            # 验证角色是否属于该用户
            player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({
                'character_id': character_id,
                'user_id': current_user_id
            }))
            if player:
                # 角色验证成功，自动设置 current_character_id
                current_character_id = character_id
                logger.info('自动选择角色', character_id=str(character_id), user_id=str(current_user_id))
            else:
                # 角色不存在或不属于该用户，不设置 character_id
                logger.warning('角色验证失败', character_id=str(character_id), user_id=str(current_user_id))
                character_id = None
        else:
            # 如果没有提供 character_id，但 current_character_id 参数有值，保持它
            if current_character_id:
                logger.debug('保持现有角色', character_id=str(current_character_id))
        
        # 创建或更新 Session（如果用户已有Session，会自动踢掉旧连接）
        session = session_service.create_session(current_user_id, websocket, current_character_id, is_test_mode=is_test_mode)
        # 更新活跃时间
        session.update_active()

        # auth_request 成功后刷新 last_auth_verified_at，让下一次重连窗口继续生效
        utils.safe_mongo_operation(lambda: utils.users_col.update_one(
            {'_id': current_user_id},
            {'$set': {'last_auth_verified_at': datetime.datetime.utcnow()}}
        ))
        
        # 保持向后兼容：将 user_id 和 character_id 直接放在响应根级别（自动添加request_id）
        # 这样客户端可以直接访问 data.user_id 和 data.character_id
        await utils.send_direct_response(websocket, {
            'type': 'auth_response',
            'success': True,
            'message': '验证成功',
            'user_id': str(current_user_id),
            'character_id': str(current_character_id) if current_character_id else None
        }, request_data=data)
        # 关键：返回 (user_id, character_id) 以便路由系统更新状态
        return current_user_id, current_character_id
    else:
        await utils.send_error_response(websocket, 'auth_request', '无效的token', code=401)
        return current_user_id, current_character_id


async def handle_register(websocket, data, current_user_id):
    """处理注册请求"""
    account = data.get('account')
    password = data.get('password')
    if not account or not password:
        await utils.send_direct_response(websocket, {
            'type': 'register_response',
            'success': False,
            'message': '账号或密码不能为空'
        }, request_data=data)
        return current_user_id
    
    # 使用find_one_and_update实现原子性检查和创建
    try:
        # 尝试创建新用户，如果账号已存在则会失败
        initial_token = utils.generate_unique_token(account, password)
        result = utils.safe_mongo_operation(lambda: utils.users_col.find_one_and_update(
            {'account': account},  # 查询条件
            {'$setOnInsert': {
                'account': account,
                'password': hash_password(password),
                'token': initial_token,
                'created_at': datetime.datetime.utcnow(),
                'last_login': None
            }},
            upsert=True,  # 如果不存在则插入
            return_document=True  # 返回更新后的文档
        ))
        # 检查是否是新创建的用户
        is_new_user = result['created_at'] is not None and result['last_login'] is None
        if is_new_user:
            # 注册时不再创建宠物，改为在创建角色时随机生成
            print(f'✅ 新用户 {account} 注册成功，宠物将在创建角色时随机生成')
            
            await utils.send_direct_response(websocket, {
                'type': 'register_response',
                'success': True,
                'message': '注册成功',
                'token': initial_token,
                'user_id': str(result['_id'])
            }, request_data=data)
            print(f'成功注册新用户: {account}')
        else:
            await utils.send_direct_response(websocket, {
                'type': 'register_response',
                'success': False,
                'message': '账号已存在'
            }, request_data=data)
            print(f'注册失败，账号已存在: {account}')
    except Exception as e:
        print(f'注册过程中出错: {e}')
        await utils.send_direct_response(websocket, {
            'type': 'register_response',
            'success': False,
            'message': '注册失败，请稍后再试'
        }, request_data=data)
    
    return current_user_id


async def handle_logout(websocket, data, current_user_id):
    """处理登出请求（切换角色，不清除token）"""
    from services.token_service import token_service
    
    if current_user_id:
        # 注意：不清除token，因为这是切换角色，不是完全退出登录
        # 前端会清除characterId，但保留token和userId，以便返回角色选择场景
        # 如果用户想要完全退出登录，应该调用full_logout接口
        
        # 先离开大世界房间，再清理 Session（避免同图残留影分身）
        try:
            await world_presence_service.leave_websocket(websocket)
        except Exception:
            pass
        session_service.remove_session(websocket)
        
        await utils.send_success_response(websocket, 'logout', message='登出成功')
        current_user_id = None
        utils.unregister_client(websocket)
        
        logger = get_logger()
        logger.info('用户已登出（切换角色，保留token）')
    else:
        await utils.send_direct_response(websocket, {
            'type': 'logout_response',
            'success': False,
            'message': '未登录'
        }, request_data=data)
    
    return current_user_id


async def handle_full_logout(websocket, data, current_user_id):
    """处理完全登出请求（撤销所有Token）"""
    from services.token_service import token_service
    
    if current_user_id:
        # 获取用户信息
        user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'_id': current_user_id}))
        if user:
            # 撤销所有 Token
            tokens_to_revoke = {}
            if user.get('token'):
                tokens_to_revoke[user['token']] = user.get('token_expires_at', 0)
            if user.get('refresh_token'):
                tokens_to_revoke[user['refresh_token']] = user.get('refresh_token_expires_at', 0)
            
            if tokens_to_revoke:
                token_service.revoke_user_tokens(str(current_user_id), tokens_to_revoke)
            
            # 清除数据库中的 Token
            utils.safe_mongo_operation(lambda: utils.users_col.update_one(
                {'_id': current_user_id},
                {'$unset': {
                    'token': '',
                    'refresh_token': '',
                    'token_expires_at': '',
                    'refresh_token_expires_at': ''
                }}
            ))
        
        try:
            await world_presence_service.leave_websocket(websocket)
        except Exception:
            pass
        session_service.remove_session(websocket)
        
        await utils.send_success_response(websocket, 'full_logout', message='完全登出成功，所有Token已撤销')
        current_user_id = None
        utils.unregister_client(websocket)
        
        logger = get_logger()
        logger.info('用户完全登出，所有Token已撤销', user_id=str(current_user_id))
    else:
        await utils.send_error_response(websocket, 'full_logout', '未登录', code=401)
    
    return current_user_id


async def handle_change_password(websocket, data, current_user_id):
    """处理修改密码请求（支持未登录：账号+旧密码）"""
    from services.token_service import token_service

    account = data.get('account')
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    client_ip = utils.get_client_ip(websocket)

    def _lock_msg(lock_until):
        if not lock_until:
            return '账号已锁定，请稍后重试'
        remain = max(1, math.ceil((lock_until - datetime.datetime.utcnow()).total_seconds()))
        return f'账号已锁定，{remain}秒后重试'

    if not account or not old_password or not new_password:
        await utils.send_error_response(websocket, 'change_password', '账号、旧密码、新密码不能为空', code=400, request_data=data)
        return current_user_id

    if old_password == new_password:
        await utils.send_error_response(websocket, 'change_password', '新密码不能与旧密码相同', code=400, request_data=data)
        return current_user_id

    # 防恶意锁号：改密也按“账号 + IP”锁定
    is_locked, lock_until = utils.is_account_action_locked(account, client_ip, 'pwd')
    if is_locked:
        await utils.send_error_response(websocket, 'change_password', _lock_msg(lock_until), code=429, request_data=data)
        return current_user_id

    # 未登录场景：按账号查；已登录场景：优先用 current_user_id 兜底
    user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'account': account}))
    if (not user) and current_user_id:
        user = utils.safe_mongo_operation(lambda: utils.users_col.find_one({'_id': current_user_id}))

    if not user or not verify_password(old_password, user.get('password', '')):
        _, lock_until = utils.record_account_action_failure(account, client_ip, 'pwd', max_fail=5, lock_minutes=5)
        if lock_until:
            await utils.send_error_response(websocket, 'change_password', _lock_msg(lock_until), code=429, request_data=data)
        else:
            await utils.send_error_response(websocket, 'change_password', '原密码错误', code=400, request_data=data)
    else:
        user_id = user['_id']
        # 改密校验通过，清空该账号+IP的改密失败计数
        utils.clear_account_action_failures(account, client_ip, 'pwd')

        # 撤销所有旧的 Token
        tokens_to_revoke = {}
        if user.get('token'):
            tokens_to_revoke[user['token']] = user.get('token_expires_at', 0)
        if user.get('refresh_token'):
            tokens_to_revoke[user['refresh_token']] = user.get('refresh_token_expires_at', 0)
        
        if tokens_to_revoke:
            token_service.revoke_user_tokens(str(user_id), tokens_to_revoke)
        
        # 生成新的 Token 对
        access_token, refresh_token, access_expires_at, refresh_expires_at = \
            token_service.generate_token_pair(str(user_id), user['account'])
        
        # 更新密码和Token
        utils.safe_mongo_operation(lambda: utils.users_col.update_one(
            {'_id': user_id},
            {'$set': {
                'password': hash_password(new_password),
                'token': access_token,
                'refresh_token': refresh_token,
                'token_expires_at': access_expires_at,
                'refresh_token_expires_at': refresh_expires_at
            }}
        ))
        
        logger = get_logger()
        logger.info('密码修改成功，所有旧Token已撤销', user_id=str(user_id), account=account)
        
        await utils.send_direct_response(websocket, {
            'type': 'change_password_response',
            'success': True,
            'message': '密码修改成功，所有旧Token已撤销',
            'token': access_token,
            'refresh_token': refresh_token,
            'token_expires_at': access_expires_at,
            'refresh_token_expires_at': refresh_expires_at
        }, request_data=data)
    
    return current_user_id


async def handle_delete_account(websocket, data, current_user_id):
    """处理删除账号请求"""
    token = data.get('token')
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'delete_account_response',
            'success': False,
            'message': '用户不存在或未登录'
        }, request_data=data)
        return current_user_id
    
    user_id = user['_id']
    account = user.get('account', '')
    
    # 收集所有character_id
    chars = user.get('characters', [None, None, None])
    character_ids = []
    for char in chars:
        if char and char.get('character_id'):
            character_ids.append(char.get('character_id'))
    
    deleted_count = {
        'users': 0,
        'players': 0,
        'robotpet': 0,
        'inventory': 0,
        'messages': 0,
        'character_ids': len(character_ids)
    }
    
    # 1. 删除所有players记录
    try:
        result = utils.safe_mongo_operation(lambda: utils.players_col.delete_many({'user_id': user_id}))
        deleted_count['players'] = result.deleted_count
        print(f'✅ 删除players数据: {result.deleted_count} 条')
    except Exception as e:
        print(f'❌ 删除players数据失败: {e}')
    
    # 2. 删除所有RobotPet
    try:
        result = utils.safe_mongo_operation(lambda: utils.robotpet_col.delete_many({'user_id': user_id}))
        deleted_count['robotpet'] = result.deleted_count
        print(f'✅ 删除RobotPet数据: {result.deleted_count} 条')
    except Exception as e:
        print(f'❌ 删除RobotPet数据失败: {e}')
    
    # 3. 删除所有inventory
    try:
        result = utils.safe_mongo_operation(lambda: utils.inventory_col.delete_many({'user_id': user_id}))
        deleted_count['inventory'] = result.deleted_count
        print(f'✅ 删除inventory数据: {result.deleted_count} 条')
    except Exception as e:
        print(f'❌ 删除inventory数据失败: {e}')
    
    # 4. 删除所有相关的messages（通过character_id）
    if character_ids:
        try:
            result = utils.safe_mongo_operation(lambda: utils.messages_col.delete_many({'character_id': {'$in': character_ids}}))
            deleted_count['messages'] = result.deleted_count
            print(f'✅ 删除messages数据: {result.deleted_count} 条')
        except Exception as e:
            print(f'❌ 删除messages数据失败: {e}')
    
    # 5. 最后删除users账号
    try:
        result = utils.safe_mongo_operation(lambda: utils.users_col.delete_one({'_id': user_id}))
        deleted_count['users'] = result.deleted_count
        print(f'✅ 删除users账号: {result.deleted_count} 条 (账号: {account})')
    except Exception as e:
        print(f'❌ 删除users账号失败: {e}')
    
    print(f'🗑️ 账号删除完成: users={deleted_count["users"]}, players={deleted_count["players"]}, robotpet={deleted_count["robotpet"]}, inventory={deleted_count["inventory"]}, messages={deleted_count["messages"]}, characters={deleted_count["character_ids"]}')
    
    try:
        await world_presence_service.leave_websocket(websocket)
    except Exception:
        pass
    session_service.remove_session(websocket)
    
    await utils.send_success_response(
        websocket,
        'delete_account',
        data={'deleted_count': deleted_count},
        message='账号删除成功'
    )
    
    # 登出用户
    current_user_id = None
    utils.unregister_client(websocket)
    
    return current_user_id


@handle_exceptions('refresh_token')
async def handle_refresh_token(websocket, data, current_user_id):
    """专用 refresh_token 路由（等价于 login 带 refresh_token）"""
    payload = dict(data or {})
    payload['type'] = 'login'
    if 'refresh_token' not in payload and payload.get('token'):
        payload['refresh_token'] = payload.get('token')
    return await handle_login(websocket, payload, current_user_id)


@handle_exceptions('refresh_token')
async def handle_refresh_token(websocket, data, current_user_id):
    """专用 refresh_token 路由（等价于 login 带 refresh_token）"""
    payload = dict(data or {})
    payload['type'] = 'login'
    if 'refresh_token' not in payload and payload.get('token'):
        payload['refresh_token'] = payload.get('token')
    return await handle_login(websocket, payload, current_user_id)
