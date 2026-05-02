"""
Session 管理服务 - 参考 PomeloServer 的 Session 设计
统一管理用户连接状态，支持测试模式、多设备登录、自动过期清理
"""
import asyncio
import time
from enum import Enum
from typing import Dict, Optional, Set, List
from bson import ObjectId


class PlayerStatus(Enum):
    """玩家状态枚举（状态机）"""
    OFFLINE = 'offline'      # 离线
    ONLINE = 'online'        # 在线（空闲）
    IN_BATTLE = 'in_battle'  # 战斗中
    # 预留状态，未来可以扩展
    # TRADING = 'trading'      # 交易中
    # MATCHING = 'matching'    # 匹配中
    # AFK = 'afk'              # 离开


class Session:
    """用户会话 - 参考 PomeloServer 的 Session 设计，添加状态机支持"""
    def __init__(self, user_id: ObjectId, websocket, character_id: Optional[ObjectId] = None,
                 created_at: float = None, last_active: float = None):
        self.user_id = user_id
        self.websocket = websocket
        self.character_id = character_id
        self.created_at = created_at or time.time()
        self.last_active = last_active or time.time()
        self.is_test_mode = False  # 标记是否为测试模式（通过 user_id 直接验证）
        # 状态机：玩家状态（默认在线）
        self.status: PlayerStatus = PlayerStatus.ONLINE
        # 状态变更时间戳
        self.status_changed_at: float = time.time()
    
    def update_active(self):
        """更新最后活跃时间"""
        self.last_active = time.time()
        # 如果处于离线状态，自动切换回在线状态
        if self.status == PlayerStatus.OFFLINE:
            self.set_status(PlayerStatus.ONLINE)
    
    def update_character(self, character_id: Optional[ObjectId]):
        """更新角色ID"""
        self.character_id = character_id
        self.update_active()
    
    def set_status(self, new_status: PlayerStatus):
        """设置玩家状态（状态机）"""
        if self.status != new_status:
            old_status = self.status
            self.status = new_status
            self.status_changed_at = time.time()
            print(f'[Session] 用户 {self.user_id} 状态变更: {old_status.value} -> {new_status.value}')
    
    def get_status(self) -> PlayerStatus:
        """获取当前状态"""
        return self.status
    
    def is_online(self) -> bool:
        """判断是否在线（状态不为离线）"""
        return self.status != PlayerStatus.OFFLINE


class SessionService:
    """
    Session 管理服务 - 参考 PomeloServer 的 Session 设计
    支持多设备登录、自动过期清理
    """
    
    def __init__(self, session_timeout: float = 3600.0, kick_old_sessions: bool = True):
        """
        初始化Session服务
        
        Args:
            session_timeout: Session过期时间（秒），默认1小时（3600秒）
            kick_old_sessions: 是否在新登录时踢掉旧连接（禁止挤号），默认True
        """
        # {user_id: List[Session]} - 支持多设备登录，一个用户可以有多个Session
        self.sessions: Dict[ObjectId, List[Session]] = {}
        # {websocket_id: user_id} - WebSocket到用户ID的映射
        self.websocket_to_user: Dict[int, ObjectId] = {}
        # Session过期时间（秒）
        self.session_timeout = session_timeout
        # 是否在新登录时踢掉旧连接（禁止挤号）
        self.kick_old_sessions = kick_old_sessions
        self.lock = asyncio.Lock()
    
    def create_session(self, user_id: ObjectId, websocket, character_id: Optional[ObjectId] = None,
                      is_test_mode: bool = False, kick_old: bool = None) -> Session:
        """
        创建或添加 Session（支持多设备登录，可配置是否踢掉旧连接）
        
        Args:
            user_id: 用户ID
            websocket: WebSocket 连接
            character_id: 角色ID（可选）
            is_test_mode: 是否为测试模式（通过 user_id 直接验证）
            kick_old: 是否踢掉旧连接（None时使用默认配置self.kick_old_sessions）
        
        Returns:
            创建的Session对象
        """
        websocket_id = id(websocket)
        should_kick_old = kick_old if kick_old is not None else self.kick_old_sessions
        
        # 检查该websocket是否已有Session（避免重复添加）
        if websocket_id in self.websocket_to_user:
            existing_user_id = self.websocket_to_user[websocket_id]
            if existing_user_id == user_id:
                # 找到对应的Session并更新
                sessions = self.sessions.get(user_id, [])
                for session in sessions:
                    if id(session.websocket) == websocket_id:
                        session.websocket = websocket  # 更新websocket引用（可能重新连接）
                        session.character_id = character_id
                        session.update_active()
                        session.set_status(PlayerStatus.ONLINE)
                        session.is_test_mode = is_test_mode
                        return session
        
        # 如果用户已有Session且需要踢掉旧连接，先关闭旧连接
        if should_kick_old and user_id in self.sessions:
            old_sessions = self.sessions[user_id].copy()  # 复制列表避免修改时出错
            if old_sessions:
                # 异步关闭所有旧连接（不阻塞当前流程）
                asyncio.create_task(self._kick_old_sessions(old_sessions))
        
        # 创建新Session
        session = Session(
            user_id=user_id,
            websocket=websocket,
            character_id=character_id,
            created_at=time.time(),
            last_active=time.time()
        )
        session.is_test_mode = is_test_mode
        session.set_status(PlayerStatus.ONLINE)
        
        # 添加到用户Session列表（清空旧列表，因为已经踢掉了）
        if should_kick_old:
            self.sessions[user_id] = [session]
        else:
            if user_id not in self.sessions:
                self.sessions[user_id] = []
            self.sessions[user_id].append(session)
        
        self.websocket_to_user[websocket_id] = user_id
        
        # 关键修复：Session 创建时自动加入全局聊天频道（Channel/Room 系统）
        # 确保所有已认证用户都能接收聊天消息
        try:
            from services.channel_service import channel_service
            channel_service.add('global_chat', user_id, websocket)
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f'用户加入全局聊天频道: user_id={user_id}, websocket_id={websocket_id}')
        except Exception as e:
            # 频道加入失败不影响 Session 创建，但记录错误
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f'加入全局聊天频道失败: user_id={user_id}, error={e}')
        
        return session
    
    async def _kick_old_sessions(self, old_sessions: List[Session]):
        """
        异步关闭旧的Session连接（内部方法）
        
        Args:
            old_sessions: 要关闭的Session列表
        """
        for old_session in old_sessions:
            try:
                websocket = old_session.websocket
                websocket_id = id(websocket)
                
                # 设置状态为离线
                old_session.set_status(PlayerStatus.OFFLINE)
                
                # 清理websocket映射
                self.websocket_to_user.pop(websocket_id, None)
                
                # 关闭WebSocket连接
                if self._is_websocket_open(websocket):
                    try:
                        await websocket.close(code=1008, reason='Kicked by new login')
                    except Exception as e:
                        # 连接可能已关闭，忽略错误
                        pass
                
                # 清理推送调度器和任务队列
                try:
                    from services.push_scheduler import push_scheduler
                    from services.task_manager import task_manager
                    
                    user_id_str = str(old_session.user_id)
                    push_scheduler.on_session_close(user_id_str)
                    task_manager.close_queue(user_id_str, force=True)
                except Exception:
                    pass  # 忽略清理错误
                    
            except Exception as e:
                # 忽略单个Session关闭的错误，继续处理其他Session
                print(f'[Session] 关闭旧Session失败: {e}')
    
    def get_session(self, user_id: ObjectId) -> Optional[Session]:
        """
        获取用户的第一个有效Session（向后兼容）
        推荐使用 get_sessions() 获取所有Session
        
        Args:
            user_id: 用户ID
        
        Returns:
            第一个有效的Session，如果没有则返回None
        """
        sessions = self.sessions.get(user_id, [])
        # 过滤掉已关闭的连接
        valid_sessions = [s for s in sessions if self._is_websocket_open(s.websocket)]
        if valid_sessions:
            return valid_sessions[0]  # 返回第一个有效的Session
        return None
    
    def get_sessions(self, user_id: ObjectId) -> List[Session]:
        """
        获取用户的所有有效Session（支持多设备）
        
        Args:
            user_id: 用户ID
        
        Returns:
            该用户的所有有效Session列表
        """
        sessions = self.sessions.get(user_id, [])
        # 过滤掉已关闭的连接
        return [s for s in sessions if self._is_websocket_open(s.websocket)]
    
    def get_session_by_websocket(self, websocket) -> Optional[Session]:
        """通过 WebSocket 获取 Session"""
        user_id = self.websocket_to_user.get(id(websocket))
        if user_id:
            sessions = self.sessions.get(user_id, [])
            # 查找匹配的Session
            for session in sessions:
                if id(session.websocket) == id(websocket):
                    return session
        return None
    
    def _is_websocket_open(self, websocket) -> bool:
        """检查WebSocket连接是否打开"""
        try:
            # websockets库的连接对象有closed属性
            if hasattr(websocket, 'closed'):
                return not websocket.closed
            # 如果无法判断，默认认为连接有效
            return True
        except Exception:
            return False
    
    def remove_session(self, websocket):
        """
        移除指定的Session（断开连接时调用）
        支持多设备：只移除对应的Session，不影响其他设备
        """
        websocket_id = id(websocket)
        user_id = self.websocket_to_user.pop(websocket_id, None)
        if user_id:
            sessions = self.sessions.get(user_id, [])
            # 找到并移除对应的Session
            for i, session in enumerate(sessions):
                if id(session.websocket) == websocket_id:
                    # 设置状态为离线
                    session.set_status(PlayerStatus.OFFLINE)
                    # 从列表中移除
                    sessions.pop(i)
                    break
            
            # 如果该用户没有Session了，清理键
            if not sessions:
                self.sessions.pop(user_id, None)
    
    def update_character(self, user_id: ObjectId, character_id: Optional[ObjectId], websocket=None):
        """
        更新 Session 的角色ID
        
        Args:
            user_id: 用户ID
            character_id: 角色ID
            websocket: 如果指定，只更新该websocket对应的Session；否则更新所有Session
        """
        sessions = self.sessions.get(user_id, [])
        if websocket:
            # 只更新指定的Session
            websocket_id = id(websocket)
            for session in sessions:
                if id(session.websocket) == websocket_id:
                    session.update_character(character_id)
                    # 确保该连接在全局聊天频道中（如果不在则加入）
                    try:
                        from services.channel_service import channel_service
                        if not channel_service.is_in_channel('global_chat', user_id, websocket):
                            channel_service.add('global_chat', user_id, websocket)
                            import logging
                            logger = logging.getLogger(__name__)
                            logger.info(f'更新角色时加入全局聊天频道: user_id={user_id}, websocket_id={websocket_id}')
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f'更新角色时加入频道失败: user_id={user_id}, error={e}')
                    break
        else:
            # 更新所有Session
            for session in sessions:
                session.update_character(character_id)
    
    def get_online_users(self) -> Set[ObjectId]:
        """获取所有在线用户ID（至少有一个有效Session的用户）"""
        return {user_id for user_id, sessions in self.sessions.items() 
                if any(self._is_websocket_open(s.websocket) for s in sessions)}
    
    def get_online_count(self) -> int:
        """获取在线用户数（至少有一个有效Session的用户数）"""
        return len(self.get_online_users())
    
    def get_total_session_count(self) -> int:
        """获取所有有效Session总数（支持多设备统计）"""
        total = 0
        for sessions in self.sessions.values():
            total += sum(1 for s in sessions if self._is_websocket_open(s.websocket))
        return total
    
    def get_player_status(self, user_id: ObjectId) -> PlayerStatus:
        """
        获取玩家状态（状态机）
        如果用户有多个Session，返回第一个有效Session的状态
        """
        session = self.get_session(user_id)
        if session:
            return session.get_status()
        return PlayerStatus.OFFLINE
    
    def set_player_status(self, user_id: ObjectId, status: PlayerStatus, websocket=None):
        """
        设置玩家状态（状态机）
        
        Args:
            user_id: 用户ID
            status: 状态
            websocket: 如果指定，只设置该websocket对应的Session；否则设置所有Session
        """
        sessions = self.sessions.get(user_id, [])
        if websocket:
            # 只更新指定的Session
            websocket_id = id(websocket)
            for session in sessions:
                if id(session.websocket) == websocket_id:
                    session.set_status(status)
                    break
        else:
            # 更新所有Session
            for session in sessions:
                session.set_status(status)
    
    def is_player_online(self, user_id: ObjectId) -> bool:
        """判断玩家是否在线（根据状态机，至少有一个Session在线）"""
        sessions = self.sessions.get(user_id, [])
        # 检查是否有至少一个有效的在线Session
        for session in sessions:
            if self._is_websocket_open(session.websocket) and session.is_online():
                return True
        return False
    
    def get_session_info(self, user_id: ObjectId) -> Optional[dict]:
        """获取 Session 信息（用于调试，返回第一个Session的信息）"""
        session = self.get_session(user_id)
        if session:
            return {
                'user_id': str(session.user_id),
                'character_id': str(session.character_id) if session.character_id else None,
                'is_test_mode': session.is_test_mode,
                'status': session.status.value,
                'created_at': session.created_at,
                'last_active': session.last_active,
                'status_changed_at': session.status_changed_at,
                'online_duration': time.time() - session.created_at,
                'device_count': len(self.get_sessions(user_id))  # 设备数量
            }
        return None
    
    def cleanup_expired_sessions(self) -> int:
        """
        清理过期的Session（长时间未活动的Session）
        
        Returns:
            清理的Session数量
        """
        current_time = time.time()
        expired_count = 0
        
        users_to_remove = []
        for user_id, sessions in self.sessions.items():
            valid_sessions = []
            for session in sessions:
                # 检查是否过期（超过指定时间未活动）
                if current_time - session.last_active > self.session_timeout:
                    # Session过期，清理
                    expired_count += 1
                    websocket_id = id(session.websocket)
                    self.websocket_to_user.pop(websocket_id, None)
                    session.set_status(PlayerStatus.OFFLINE)
                elif self._is_websocket_open(session.websocket):
                    # Session仍然有效
                    valid_sessions.append(session)
                else:
                    # WebSocket已关闭，清理
                    expired_count += 1
                    websocket_id = id(session.websocket)
                    self.websocket_to_user.pop(websocket_id, None)
                    session.set_status(PlayerStatus.OFFLINE)
            
            if valid_sessions:
                # 更新为有效的Session列表
                self.sessions[user_id] = valid_sessions
            else:
                # 没有有效的Session，标记为删除
                users_to_remove.append(user_id)
        
        # 删除没有有效Session的用户
        for user_id in users_to_remove:
            self.sessions.pop(user_id, None)
        
        return expired_count


# 全局 Session 服务实例（默认Session过期时间1小时，默认踢掉旧连接禁止挤号）
session_service = SessionService(session_timeout=3600.0, kick_old_sessions=True)

# 导出 PlayerStatus 供其他模块使用
__all__ = ['Session', 'SessionService', 'PlayerStatus', 'session_service']

