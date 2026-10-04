# 剧情脚本目录 · 规范说明

> 目录：`assets/resources/Sample/剧情脚本/`
> 最后整理：2026-09-29

## 一、命名规范（强制）

```
map_{mapId}.json          # 唯一合法命名
map_{mapId}.json.meta     # Cocos 资源描述，uuid 不可随意改
```

- `mapId` 为**非负整数**，来源：Juben `workspace.json` → `gameMaps[].mapId`
- ❌ 禁止 `map_00.json`、`map_0_test_base_shared.json`、`map_world_xxx.json` 等变体
- 遗留命名由 `Juben/src/editor/map-runtime-paths.ts: listLegacyMapFilenames()` 列举，发布时会 warn / 可选清理

## 二、当前文件

| 文件 | mapId | mapCode | 内容 | 加载方式 |
|---|---|---|---|---|
| `map_0.json` | 0 | `world_1788102496297` | 图1（郊外 S-01~S-05，6 NPC） | `Game.scene` → StoryManager `mapConfig` |
| `map_2.json` | 2 | `world_map2` | 图2（返回一区传送点，1 NPC） | `MapManager.ts` 硬编码 `MAP2_STORY_PATH` |

## 三、图的加载机制（两套并存，勿混）

### 图1：场景拖拽 JsonAsset
- `Game.scene` 里 StoryManager 组件的 `mapConfig.__uuid__` 指向 `map_0.json.meta` 的 uuid（`5e7baf89-d1b0-4dd9-8ae6-2f20f14cf3d9`）
- 改剧本文件内容**不动 uuid**，所以换内容无需改场景
- ⚠️ 若重命名/删除 json，必须同步改 `Game.scene` 里的 `__uuid__`

### 图2：运行时 resources.load
- `GameArea/MapManager.ts` → `MAP2_STORY_PATH = 'Sample/剧情脚本/map_2'`
- 按 mapId=2 加载（`_storyConfigFor(mapId)`）
- 出生点：`DEFAULT_SPAWNS = { 1: (120,-24), 2: (72,-360) }`

## 四、导出流程（Juben → Cocos）

```bash
cd D:/jjfbol-cocos/Juben
node node_modules/tsx/dist/cli.mjs scripts/export-to-cocos-map.ts <mapId> <mapCode>
# 例：图1
node node_modules/tsx/dist/cli.mjs scripts/export-to-cocos-map.ts 0 world_1788102496297
```

- 目标路径由 `resolveCocosMapAbsolutePath(mapId)` 计算 → `assets/resources/Sample/剧情脚本/map_{mapId}.json`
- 经 junction `D:\jjfbol-cocos\assets` → `jjfbol-cocos\jjfb\assets` 落进 Cocos 工程
- 脚本会打印 `导出校验有警告` 或直接覆盖；**必须确认 `ok=true`**（见下）

### 导出后必查

```bash
# 校验无 error（issues 为空 → ok=true）
node node_modules/tsx/dist/cli.mjs -e "
import fs from 'node:fs';
import { exportProjectMapPipeline } from './src/editor/map-export-pipeline.ts';
import { buildMergeShellFromGameMap } from './src/editor/map-import.ts';
const ws=JSON.parse(fs.readFileSync('data/workspace.json','utf8'));
const p=ws.projects[0].data;
const gm=p.gameMaps.find(m=>m.mapCode==='world_1788102496297');
const r=exportProjectMapPipeline(gm, p.graphs.find(g=>g.id===gm.graphId), p, { mergeFrom: buildMergeShellFromGameMap(gm) });
console.log('ok =', r.ok, r.ok ? '' : JSON.stringify(r.report?.issues));
"
```

**常见 error**：`effects.task_complete 引用未知 taskId=XXXX`
→ 该 taskId 的 quest 没进导出文件 `tasks` 数组。
→ 原因：quest 未定义 / `questId` 不在 `project.quests` / **编辑器把 quests 数组顶掉了**（见第五节）。

## 五、⚠️ 编辑器覆盖陷阱（必修）

`workspace.json` 会被运行中的 Juben 编辑器**回写覆盖**：

1. 启动时 `resolveBootWorkspace(磁盘, localStorage)` 合并，判据为 `savedAt` + 内容分
2. `EditorRoot.vue` 保存前会**剔除 `graphId` 不在 `graphs[{kind:quest|side|map|timeline}]` 里的 quest**
3. 若编辑器内存里没有脚本新加的 quest，保存时就会**丢掉它们**

**脚本写 `workspace.json` 时必须**：
```python
now_ms = int(time.time() * 1000)
data["savedAt"] = now_ms
data["projects"][0]["updatedAt"] = now_ms
```
并让新 quest 的 `graphId` 指向真实存在的 graph。

**改完立即导出**，并提醒用户**刷新/关闭编辑器页**，否则会被顶回。

## 六、变更清单（2026-09-29 整理）

- ✅ `map_00.json`（旧版图1，非规范名）→ 删除
- ✅ `map_0.json`（原为废弃旧图 `world_1783159547543`）→ 覆盖为郊外段 `world_1788102496297`
- ✅ `Game.scene` 的 `mapConfig.__uuid__`：`8f11671d…` → `5e7baf89…`（切到规范名 `map_0`）
- ✅ Juben 图2 `mapId`：0 → 2（原先与图1 撞车，导出会互相覆盖）
- ✅ 移出 4 个调试用 `Game.scene.bak_*`（约 7MB）→ `JJFB机甲风暴_产出备份/_storydir_bak_20260929/scene_baks/`
- ⚠️ `map_2.json` 的 `mapCode` 仍为 `world_map2`，与 Juben 图2 的 `world_1790683289168` 不一致
  - 运行时 `StoryManager.ts:1817` 会按 JSON 自动更新 mapCode，**不报错**
  - 改它会变更本地剧情存档 key，暂**不动**；如需统一请另行确认

## 七、备份

| 内容 | 位置 |
|---|---|
| 整理前剧本 JSON + Game.scene | `JJFB机甲风暴_产出备份/_storydir_bak_20260929/` |
| 移出的场景 .bak | `JJFB机甲风暴_产出备份/_storydir_bak_20260929/scene_baks/` |
