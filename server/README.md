# 游戏服务器

## 目录结构

```
server/
├── ws_server.py          # 主服务器（WebSocket + HTTP 管理台）
├── router.py             # 路由系统（参考 Pomelo 设计）
├── middleware.py         # 中间件系统
├── requirements.txt      # Python 依赖
│
├── admin-ui/             # Vue 3 管理台（Vite + Element Plus）
│   ├── src/              # 前端源码
│   └── dist/             # 构建产物（python tools/build_admin_ui.py）
│
├── handlers/             # 业务处理器
├── docs/                 # 文档
├── data/                 # 数据文件（Items.json 等）
└── static/_legacy/       # 已归档的旧版 HTML 管理页
```

## 快速开始

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `server/.env.example` 为 `server/.env`（勿提交真实凭据）。  
配置由 `config.py` 统一读取：`WS_HOST` / `WS_PORT` / `ADMIN_HOST` / `ADMIN_PORT` / `MONGO_URL` / `ENCRYPTION_KEY` / `ENVIRONMENT`。

- `ENVIRONMENT=development`：未设置时默认连接本机 MongoDB；可临时生成 `ENCRYPTION_KEY`
- `ENVIRONMENT=production`：缺少 `MONGO_URL` 或 `ENCRYPTION_KEY` 时拒绝启动

首次或变更索引后请单独执行迁移（普通启动不会改索引/删文档）：

```bash
python tools/migrate_db.py --dry-run
python tools/migrate_db.py
```

### 3. 构建管理台（独立步骤）

管理台为 Vue SPA，需要 **Node.js 18+**。`ws_server` **不会**在启动时执行 npm 安装/构建：

```bash
python tools/build_admin_ui.py
# 或: cd admin-ui && npm ci && npm run build
```

### 4. 启动服务器

```bash
python ws_server.py
```

启动后访问（默认 `ADMIN_HOST:ADMIN_PORT`，通常 `127.0.0.1:8080`）：

| 页面 | URL |
|------|-----|
| 管理后台首页 | http://127.0.0.1:8080/ |
| 游戏控制 | http://127.0.0.1:8080/game-control |
| 服务器监控 | http://127.0.0.1:8080/server-monitor |
| 客户端模拟 | http://127.0.0.1:8080/client-simulator |
| 战斗房间 | http://127.0.0.1:8080/battle-rooms |
| 大乐透运维 | http://127.0.0.1:8080/daletou |
| 期货运维 | http://127.0.0.1:8080/minigame2 |

WebSocket 游戏端口：`ws://localhost:8001`

### 5. 仅开发前端（可选）

```bash
cd admin-ui
npm install
npm run dev    # Vite 开发服务器 :5173，代理 /api 到 8080
```

## 管理台架构

- **展示层**：Vue 3 SPA（`admin-ui/`），由 Python `ThreadingHTTPServer` 托管 `dist/`
- **游戏/GM 操作**：WebSocket `admin_*` 路由（端口 8001）
- **运维 REST**：`GET /api/battle-rooms`、`POST /api/daletou`、`POST /api/minigame2`

> HTTP 与多数 `admin_*` 接口**无鉴权**，仅绑定本机，**禁止暴露公网**。

## 核心功能

### 路由系统

参考 Pomelo 设计，使用字典映射替代 if-else 链：

- **路由定义**：在 `router.py` 中定义所有路由
- **自动分发**：根据消息类型自动路由到对应处理器
- **中间件支持**：自动执行认证、日志等中间件

## 技术栈

- **Python 3.7+**、WebSocket (websockets)、MongoDB (pymongo)、asyncio
- **Vue 3**、Vite、TypeScript、Element Plus、Chart.js（管理台）

## 注意事项

- 生产环境必须设置固定的 `ENCRYPTION_KEY` 与 `MONGO_URL`
- 端口占用时服务会报告 PID 并退出，不会强杀占用进程
- 日志文件保存在 `logs/` 目录
