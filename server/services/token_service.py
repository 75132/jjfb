"""
Token 服务 - 实现 Token 刷新、撤销和过期时间管理
参考游戏开发最佳实践，提升认证安全性
"""
import time
import hashlib
import uuid
import json
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from collections import OrderedDict
from services.logger_service import get_logger


class TokenService:
    """
    Token 服务
    实现 Access Token + Refresh Token 机制
    """
    def __init__(self, 
                 access_token_ttl: int = 3600,      # Access Token 1小时过期
                 refresh_token_ttl: int = 604800,    # Refresh Token 7天过期
                 max_revoked_tokens: int = 10000):    # 最大撤销Token数量
        """
        Args:
            access_token_ttl: Access Token 生存时间（秒）
            refresh_token_ttl: Refresh Token 生存时间（秒）
            max_revoked_tokens: 最大撤销Token数量（LRU策略）
        """
        self.access_token_ttl = access_token_ttl
        self.refresh_token_ttl = refresh_token_ttl
        self.max_revoked_tokens = max_revoked_tokens
        self.revoked_tokens: OrderedDict = OrderedDict()  # {token: expiry_time}
        self.logger = get_logger()
    
    def generate_access_token(self, user_id: str, account: str) -> str:
        """
        生成 Access Token
        
        Args:
            user_id: 用户ID
            account: 账号
        
        Returns:
            Access Token
        """
        # 生成唯一Token（基于用户ID、账号和时间戳）
        timestamp = str(int(time.time()))
        key = f"{user_id}:{account}:{timestamp}:{uuid.uuid4().hex}"
        token = hashlib.sha256(key.encode()).hexdigest()
        return token
    
    def generate_refresh_token(self, user_id: str, account: str) -> str:
        """
        生成 Refresh Token
        
        Args:
            user_id: 用户ID
            account: 账号
        
        Returns:
            Refresh Token
        """
        # Refresh Token 使用更长的随机字符串
        timestamp = str(int(time.time()))
        key = f"{user_id}:{account}:{timestamp}:refresh:{uuid.uuid4().hex}"
        token = hashlib.sha256(key.encode()).hexdigest()
        return token
    
    def generate_token_pair(self, user_id: str, account: str) -> Tuple[str, str, int, int]:
        """
        生成 Token 对（Access Token + Refresh Token）
        
        Args:
            user_id: 用户ID
            account: 账号
        
        Returns:
            (access_token, refresh_token, access_expires_at, refresh_expires_at)
        """
        access_token = self.generate_access_token(user_id, account)
        refresh_token = self.generate_refresh_token(user_id, account)
        
        access_expires_at = int(time.time()) + self.access_token_ttl
        refresh_expires_at = int(time.time()) + self.refresh_token_ttl
        
        return access_token, refresh_token, access_expires_at, refresh_expires_at
    
    def is_token_revoked(self, token: str) -> bool:
        """
        检查 Token 是否已撤销
        
        Args:
            token: Token
        
        Returns:
            是否已撤销
        """
        if token not in self.revoked_tokens:
            return False
        
        # 检查是否过期
        expiry_time = self.revoked_tokens[token]
        if time.time() > expiry_time:
            # 已过期，移除
            self.revoked_tokens.pop(token, None)
            return False
        
        return True
    
    def revoke_token(self, token: str, expiry_time: Optional[int] = None):
        """
        撤销 Token
        
        Args:
            token: Token
            expiry_time: 过期时间（Unix时间戳），如果为None则使用默认过期时间
        """
        if expiry_time is None:
            # 使用 Refresh Token 的过期时间（更安全）
            expiry_time = int(time.time()) + self.refresh_token_ttl
        
        # 如果缓存已满，移除最旧的条目（LRU）
        if len(self.revoked_tokens) >= self.max_revoked_tokens:
            self.revoked_tokens.popitem(last=False)
        
        self.revoked_tokens[token] = expiry_time
        self.revoked_tokens.move_to_end(token)  # 移动到末尾（LRU）
        
        self.logger.info('Token已撤销', token=token[:8] + '...')
    
    def revoke_user_tokens(self, user_id: str, tokens: Dict[str, int]):
        """
        撤销用户的所有 Token（用于登出、修改密码等场景）
        
        Args:
            user_id: 用户ID
            tokens: {token: expiry_time} 字典
        """
        for token, expiry_time in tokens.items():
            self.revoke_token(token, expiry_time)
        
        self.logger.info('用户所有Token已撤销', user_id=user_id, count=len(tokens))
    
    def clear_expired_revoked_tokens(self):
        """清理过期的撤销Token"""
        current_time = time.time()
        expired_tokens = [
            token for token, expiry_time in self.revoked_tokens.items()
            if current_time > expiry_time
        ]
        for token in expired_tokens:
            self.revoked_tokens.pop(token, None)
        
        if expired_tokens:
            self.logger.debug('清理过期撤销Token', count=len(expired_tokens))
    
    def is_token_expired(self, expires_at: int) -> bool:
        """
        检查 Token 是否过期
        
        Args:
            expires_at: 过期时间（Unix时间戳）
        
        Returns:
            是否过期
        """
        return time.time() > expires_at
    
    def get_token_info(self, token: str) -> Optional[Dict]:
        """
        获取 Token 信息（用于调试）
        
        Args:
            token: Token
        
        Returns:
            Token 信息字典
        """
        # 这里可以扩展为从数据库或缓存中获取Token信息
        return {
            'token': token[:8] + '...',
            'is_revoked': self.is_token_revoked(token)
        }


# 全局 Token 服务实例
token_service = TokenService(
    access_token_ttl=3600,      # 1小时
    refresh_token_ttl=604800    # 7天
)

__all__ = ['TokenService', 'token_service']

