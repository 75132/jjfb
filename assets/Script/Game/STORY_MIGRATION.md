# 剧情系统迁移说明（StoryManager）

## Canonical 路径（2026-03 起）

| 目标 | 路径 |
|------|------|
| Cocos JsonAsset | `assets/resources/Sample/剧情脚本/map_{mapId}.json` |
| Server 剧情 | `server/data/story_maps/map_{mapId}_{mapCode}.json` |

示例：`mapId=1`、`mapCode=world_1782661910893` → Cocos `map_1.json`，Server `map_1_world_1782661910893.json`。

**StoryManager.mapCode** 须与 JSON 内 `mapCode` 一致（运行时 JSON 优先覆盖场景默认值）。

## 发布流程（Juben → 游戏）

### 编辑器（推荐）

1. 启动 `cd Juben && npm run dev`
2. 打开地图 → Inspector「发布到游戏」
3. 一键双写 Cocos + Server（校验失败会提示，可强制继续）

### CLI

```bash
cd Juben
npm run publish:map -- world_1782661910893
npm run publish:map -- test_base --strict --cleanup-legacy
```

### 已有 JSON 对齐 canonical 路径

```bash
cd Juben
npx tsx scripts/align-published-maps.ts --cleanup-legacy
npm run audit:story-maps              # 审计 defer 契约
npm run audit:story-maps -- --fix --publish   # 修补并双写 Cocos + Server
```

## 离线测试与「暂缓」选项

本地验收时可在 **StoryManager** 勾选 `skipServerRequirements = true`，客户端以 JSON 内 `server.requirements` / `allowedChoiceIds` / 选项 `completesEvent` 自行判定。

**暂缓（defer）契约**（对标 RM MV「选项不改 Switch」）：

| 字段 | 暂缓选项 | 接取/推进选项 |
|------|----------|---------------|
| `completesEvent` | `false` | `true`（默认） |
| `forcedResult` | `block` | 无或 `start_battle` 等 |
| `allowedChoiceIds` | **不含** defer id | 含 id |
| `server.effects` | 无 `task_accept` | 可有接取/传送等 |

选「暂缓」后：任务 **不** 接取、事件 **不** `event_done`、再次靠近 NPC 可重开同一 choice。

Juben 导出 / 全局修复 / AI 流会自动写回 defer 标志；若 Cocos 里仍是旧 JSON，运行 `audit:story-maps --fix --publish` 或在 Juben「发布到游戏」重新导出。

加载 map 时 StoryManager 会在控制台 **warn** 检测到「defer 仍在 allowedChoiceIds」或「暂缓文案未 block」的配置错误。

## 战斗任务链（单 NPC + 分支）

接取、敌人出现、战前选择、战斗、交任务 **全在同一摆点 / 剧情链** 内管控：

```
对话 → 接取 → 提示 → 交任务(event_done 指向地图战斗敌人)
地图战斗敌人（独立 runtime NPC）：接任务后 task_active 显现 → 接触 → 战前选择 → 战斗 → 胜利后 hideWhenComplete
```

- **接取**：任务官处 `effectTaskAccept`
- **战斗敌人**：左栏「战斗敌人」行配置 **坐标 + 形象**（导出为 `{giverUid}_enemy` runtime NPC）
- **显现**：`appear.task_active`（接任务后在地图指定位置出现）
- **战斗**：玩家 **主动接触敌人 NPC** 触发战前选择与战斗（不在任务官处开战）
- **胜利**：敌人消失；任务官 `event_done` 满足后可交任务

Juben 启动 / 全局检查时会自动：

- 将旧式 `{uid}_battle` 分离摆点 **合并回** 任务链内分支
- 补战前选项 `forcedResult: start_battle` / 失败项 `block`
- 补交任务 `event_done`

### 验收清单

1. 地图上每个任务仅 **一个** NPC 摆点
2. 接任务后链内触发敌人 spawn / 战前选择
3. 未胜利时任务 NPC **无** 橙色 `?`
4. 战斗胜利 → 交任务节点可用（`event_done` 满足）→ 显示 `?` → 交任务成功
5. Cocos `map_{mapId}.json` 与 Server 文件内容一致

## Game 场景绑定

- JsonAsset：`map_1.json`（或当前地图 `map_{mapId}.json`）
- **StoryManager.mapCode**：与 JSON 一致（如 `world_1782661910893`）
- **PlayerGridMove.mapRoot**：绑定地图根节点（坐标与 Juben 48px 格心一致）

## 交互（RMV 对标，2026-07）

- **触发**：靠近 NPC 碰撞箱后按 **E / 回车 / 空格**，或 **点击 NPC**（须在范围内）
- **流程**：`story_interact` 授权成功后才开对白/选项；完成后 `story_event_complete`；同次接触内自动续链
- **暂缓**：选 defer 后有明确提示；再次靠近可重开
- **顺序显现**：`sequentialStoryNpcReveal=true` 时按 `mainline_step` + `appear` 条件只亮当前主线 NPC
- **纯逻辑模块**（可单测）：`story-event-flow.ts`、`story-requirements.ts`、`story-npc-visibility.ts`

### 手动验收清单（联网 map_1）

1. 靠近凯尔博士 → E 或点击 → 对白翻页流畅
2. 接取 / 暂缓 defer → 暂缓后可重开，接取后敌人按 `task_active` 显现
3. 接触敌人 → 战前选项 → 战斗 → **未胜利**时任务官无橙色 `?`
4. 战斗胜利 → 任务官显示 `?` → 交任务成功，有任务/奖励 Tips
5. 一次按键后 dialog→choice→task 链自动衔接（defer / requiresApproach 除外）
6. 任意 interact/complete 失败有 toast，无静默无反应

## 其他说明

- `StoryUIViewRefs.ts` 与 `CanvasRoot(UI).prefab` 的 UI 槽位绑定勿改。
- 战斗 `battleRef` 对齐 `server/data/battle_refs.json`（Juben manifest 校验）。
- 本地测试：`skipServerRequirements = true`；联网须 Server JSON 与 Cocos JsonAsset 同源发布。
