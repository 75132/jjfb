# 游戏服务器

## 目录结构

```
server/
├── ws_server.py          # 主服务器文件（WebSocket 服务器）
├── start_server.py        # 服务器启动脚本
├── router.py              # 路由系统（参考 Pomelo 设计）
├── middleware.py          # 中间件系统（认证、日志等）
├── requirements.txt       # Python 依赖包
├── .gitignore            # Git 忽略配置
│
├── handlers/             # 业务处理器
│   ├── login_handler.py      # 登录相关
│   ├── character_handler.py  # 角色相关
│   ├── player_handler.py     # 玩家相关
│   ├── bag_handler.py        # 背包相关
│   ├── chat_handler.py      # 聊天相关
│   ├── robot_handler.py      # 机器人相关
│   ├── item_exp_handler.py   # 物品经验相关
│   ├── admin_handler.py      # 管理后台
│   ├── robot_upgrade.py       # 机器人升级
│   ├── utils.py              # 工具函数
│   └── json/
│       └── Items.json         # 物品数据
│
├── docs/                  # 文档目录
│   ├── README.md             # 文档主索引
│   ├── 优化说明.md
│   ├── 技术选型建议.md
│   ├── Python到Pomelo迁移对比.md
│   ├── Cursor提示词.txt
│   ├── 目录说明.md
│   └── 文件整理说明.md
│
├── data/                  # 数据文件
│   ├── Items.json         # 物品数据
│   └── Classes.json       # 职业数据
│
└── static/                # 静态文件
    └── console.html       # 管理后台页面
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务器

```bash
python start_server.py
```

或者直接运行：

```bash
python ws_server.py
```

## 核心功能

### 路由系统

参考 Pomelo 设计，使用字典映射替代 if-else 链：

- **路由定义**：在 `router.py` 中定义所有路由
- **自动分发**：根据消息类型自动路由到对应处理器
- **中间件支持**：自动执行认证、日志等中间件

### 中间件系统

- **认证中间件**：自动检查用户登录状态
- **日志中间件**：自动记录请求日志和耗时
- **验证中间件**：验证消息格式

### 统一响应格式

- `send_response()`: 统一响应格式
- `send_error_response()`: 统一错误响应
- `send_success_response()`: 快速成功响应

## 开发指南

### 添加新路由

在 `router.py` 中添加：

```python
ROUTES['new_route'] = RouteHandler(
    new_handler.handle_new_route,
    require_auth=True,
    returns_user_ids=False,
    description='新路由描述'
)
```

### 使用统一响应

```python
from handlers import utils

# 成功响应
await utils.send_success_response(
    websocket, 
    'route_name', 
    data={'key': 'value'},
    message='操作成功'
)

# 错误响应
await utils.send_error_response(
    websocket,
    'route_name',
    '错误消息',
    code=400
)
```

## 文档

详细文档请查看 `docs/` 目录：

- `优化说明.md` - 优化说明和使用示例
- `技术选型建议.md` - 技术选型分析
- `Python到Pomelo迁移对比.md` - 迁移对比文档
- `文件整理说明.md` - 文件整理说明

## 技术栈

- **Python 3.7+**
- **WebSocket** (websockets)
- **MongoDB** (pymongo)
- **异步编程** (asyncio)

## 性能优化

- ✅ 连接池管理（支持 500 并发）
- ✅ 消息批处理
- ✅ 查询缓存
- ✅ 用户数据缓存
- ✅ 请求限流

## 注意事项

- 生产环境请设置 `ENCRYPTION_KEY` 环境变量
- MongoDB 连接信息在 `ws_server.py` 中配置
- 日志文件保存在 `logs/` 目录（如果存在）

