# Juben Story Editor

A node-based story editor for branching narratives, quest checks, variables, and multi-canvas project management.

## Highlights

- Multi-project workspace with home screen, search, rename, delete, and autosave.
- Separate canvases per project (mainline, side, quest) with data isolation.
- Parallel edge support from a single option handle.
- **Runtime map JSON panel**：校验 / 导出 Cocos `map_*.json`（与 StoryManager、story_service 字段对齐）
- Local Node storage API (`/api/workspace`) writing to disk (`data/workspace.json` by default).
- JSON import/export with integrity sanitization and validation report.

## Tech Stack

- Vue 3 + TypeScript + Vite
- Vue Flow
- Express (local storage service)
- Vitest + Supertest

## Quick Start

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). **`npm run dev` 默认同时启动 Vite 与 storage 服务**（等同于 `dev:full`）。

## Scripts

- `npm run dev` - storage + web（推荐，数据实时写入 `data/workspace.json`）
- `npm run dev:web` - Vite dev server only（**不会**写入磁盘，仅浏览器 localStorage）
- `npm run dev:storage` - Node storage service only
- `npm run dev:full` - alias of `npm run dev`
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run format` - Prettier write
- `npm run format:check` - Prettier check
- `npm run typecheck` - TypeScript checks (frontend + server)
- `npm run test` - run tests
- `npm run check` - lint + format check + typecheck + tests

## 本地测试工作流（导入即用）

1. `npm run dev`（或 `python dev_gui.py`）启动编辑器，编辑自动保存到 `data/workspace.json`。
2. 时间线 → 双击章节进入地图 → 编剧情 / 摆点 → **检测修复链**（自动补前链 `event_done` 出现条件）。
3. 工具栏 **「导出 map」** 或 JSON 面板 **「导出运行时 map」**：
   - 自动 merge 地图属性壳（BGM、scenePrefabKey，见左栏「地图属性」）
   - 校验 `battleRef` 必须在 [`data/client-runtime-manifest.json`](./data/client-runtime-manifest.json) 白名单内
4. **一键发布**（从 workspace 写出 Cocos + server，需先 `npm run dev` 保存）：

```bash
npm run publish:map -- world_1782661910893
```

5. 将下载的 `map_{mapCode}.json` **覆盖** Cocos 资源（手动导出时）：
   - `assets/resources/Sample/剧情脚本/map_*.json`
5. 在 **Game.scene** 中确认 `StoryManager.mapConfig` 指向该 JsonAsset，`mapCode` 与 JSON 一致。
6. **本地纯客户端试跑**：`StoryManager.skipServerRequirements = true`（无需 ws_server 即可推进剧情/战斗）。
7. **持续触发**：勾选表示与上一环同一次接触（下一步无需再靠近），但每一步仍须按 E/确定才会推进；链断后须再次接触。

CLI（可选）：

```bash
npm run export:map -- ../assets/resources/Sample/剧情脚本/story_project_xxx.json test_base
```

加 `--strict` 可在校验失败时不写出文件。

## Client Runtime Manifest

[`data/client-runtime-manifest.json`](./data/client-runtime-manifest.json) 与 Cocos `StoryManager` / `battle_refs.json` 对齐。编辑器战斗节点只能从 manifest 中的 `battleRef` 选择；导出时未知 battleRef 会报错。

## Storage

**权威数据源**：storage 服务在线时，`data/workspace.json` 是唯一权威；浏览器 `localStorage`（键 `juben_workspace_v1`）仅作离线降级缓存。

The storage service writes workspace data to:

- default: `./data/workspace.json`
- configurable via env:
  - `DATA_DIR` (directory)
  - `WORKSPACE_FILE` (full file path, overrides `DATA_DIR`)

### 如何确认已写入文件

1. 终端应出现：`[storage] listening on http://localhost:8787 file=.../workspace.json`
2. 工具栏保存状态应显示 **「已同步 workspace.json」**（离线时为黄色 **「仅浏览器缓存」** + 顶部黄条警告）
3. 编辑后 1 秒内打开 `data/workspace.json`，`savedAt` 与项目内容应已更新
4. Cursor / Agent 直接读该文件应与编辑器内数据一致

### 自检清单

| 现象 | 可能原因 |
|------|----------|
| 重启后变旧数据 | 用了 `npm run dev:web` 而非 `npm run dev`；或关页前 PUT 未完成 |
| Agent 看到旧 JSON | 文件未更新；确认 storage 8787 端口在跑 |
| 工具栏「仅浏览器缓存」 | storage 未连接，运行 `npm run dev` |

启动时 **不再自动 merge** 磁盘与 localStorage，避免旧文件覆盖新编辑。`mergeWorkspaces` 仅用于显式导入/恢复场景。

Example:

```bash
set DATA_DIR=D:\\JubenData
npm run dev:storage
```

### AI 配置（可选）

复制 [`.env.example`](./.env.example) 为 `.env` 并填入 `DEEPSEEK_API_KEY`。未配置时编辑器 AI 助手会收到 `503 AI_NOT_CONFIGURED`，其余功能不受影响。

```bash
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY=sk-...
npm run dev
```

## Optional Windows GUI Launcher

**推荐**：仓库根目录统一控制台（Juben + ws_server + 文件夹快捷）：

```bash
# 在 jjfb 根目录
python -m tools.dev_launcher
```

Juben 目录内的 `dev_gui.py` 仍可用于仅启动 Juben（一键启停 + 端口清理）：

```bash
python dev_gui.py
```

This is optional. CLI scripts above are the primary cross-platform workflow.

## Project Structure

- `src/` - editor UI and client logic
- `server/` - local storage API and persistence modules
- `tests/` - unit/integration tests
- `.github/` - CI and templates

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT - see [LICENSE](./LICENSE).
