"""
Dictionary 服务 - 参考 PomeloServer 的 Dictionary 组件
将路由字符串映射为短整数，减少网络传输
"""
import json
import hashlib
from typing import Dict, Optional
from pathlib import Path


class DictionaryService:
    """Dictionary 服务 - 单例模式"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        
        # route_str -> route_id (1-255)
        self.route_to_id: Dict[str, int] = {}
        # route_id -> route_str
        self.id_to_route: Dict[int, str] = {}
        self.version = ""
        
        self._load_dictionary()
        self._initialized = True
    
    def _load_dictionary(self):
        """加载路由字典"""
        # 从 router.py 获取所有路由
        try:
            from router import ROUTES
        except ImportError:
            # 如果导入失败，使用空字典（避免循环导入）
            print('⚠️ [Dictionary] 无法导入 ROUTES，使用空字典')
            self.version = 'empty'
            return
        
        routes = sorted(ROUTES.keys())
        
        # 分配路由ID（从1开始）
        for idx, route in enumerate(routes, start=1):
            if idx > 255:
                print(f'⚠️ [Dictionary] 路由数量超过255，路由 {route} 无法压缩')
                continue
            self.route_to_id[route] = idx
            self.id_to_route[idx] = route
        
        # 计算版本号（字典内容的哈希）
        dict_str = json.dumps(self.route_to_id, sort_keys=True)
        self.version = hashlib.md5(dict_str.encode()).hexdigest()[:8]
        
        print(f'✅ [Dictionary] 加载 {len(self.route_to_id)} 个路由，版本: {self.version}')
    
    def encode_route(self, route_str: str) -> Optional[int]:
        """将路由字符串编码为ID"""
        return self.route_to_id.get(route_str)
    
    def decode_route(self, route_id: int) -> Optional[str]:
        """将路由ID解码为字符串"""
        return self.id_to_route.get(route_id)
    
    def get_version(self) -> str:
        """获取字典版本"""
        return self.version
    
    def get_dict(self) -> Dict[str, int]:
        """获取完整字典（用于发送给客户端）"""
        return self.route_to_id.copy()
    
    def get_abbrs(self) -> Dict[str, str]:
        """
        获取反向字典（ID -> 路由）
        注意：返回字典的键是字符串（JSON 序列化需要）
        """
        return {str(k): v for k, v in self.id_to_route.items()}
    
    def save_to_file(self, filepath: str):
        """保存字典到文件（用于客户端同步）"""
        file_path = Path(filepath)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 将 id_to_route 转换为字符串键（JSON 要求）
        id_to_route_str = {str(k): v for k, v in self.id_to_route.items()}
        
        data = {
            'version': self.version,
            'route_to_id': self.route_to_id,
            'id_to_route': id_to_route_str
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f'✅ [Dictionary] 字典已保存到 {filepath}')


# 全局实例
dictionary_service = DictionaryService()

