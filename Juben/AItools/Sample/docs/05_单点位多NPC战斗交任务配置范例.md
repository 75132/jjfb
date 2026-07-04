# 单点位多 NPC：战斗、交任务、传送与跨地图续接（Juben 配置范例）

本文对照运行时参考 [`map_0_test_base_shared.json`](../../../server/data/story_maps/map_0_test_base_shared.json)（测试基地：韩诺 → 博士 → 维塔 → 教官 → 传送法西城），说明在 Juben 中如何配置「同一点位多 NPC 顺序剧情」而无需手改 JSON。

## 核心概念

| 概念       | 编辑器                                      | 运行时 JSON                                    |
| ---------- | ------------------------------------------- | ---------------------------------------------- |
| 游戏地图   | 地图管理 · 每个 `GameMapDef`                | `mapCode` / `mapId`                            |
| NPC 摆点   | 资源库 NPC → 左栏「+」                      | `npcs[]` + 坐标                                |
| 顺序显现   | 左栏 NPC 列表顺序 `#1 #2 …`                 | `npcs[]` 数组顺序 + `sequentialStoryNpcReveal` |
| 初始隐藏   | NPC 行勾选「隐」                            | `initialHidden: true`                          |
| 剧情中显现 | 动作节点「+ 显现 NPC」                      | `server.effects` · `reveal_npc`                |
| 真动态生成 | 动作节点「+ 生成 NPC」                      | `server.effects` · `spawn_npc`                 |
| 每人一条链 | 每个 NPC 剧情区 · `npcEntry` 主链           | 每 NPC 独立 `events[]`                         |
| 接/交任务  | 选项「接任务/完成任务」或 questUpdate 节点  | `task_accept` / `task_complete`                |
| 战斗分离   | 左栏「+」→ 战斗遭遇（任务 NPC + 战斗 NPC） | 任务 NPC 接/交；战斗 NPC 仅 `battle` + `task_active` 显现 |
| 跨图传送   | 选项 `forcedResult=teleport` 或动作「传送」 | `eventType=teleport` + teleport effect         |
| 全局任务表 | 左栏「全局任务」（拖动排序）                | `tasks[]`（由 `project.quests` 导出）          |

## 推荐工作流（测试基地同款）

### 1. 创建地图与摆点

1. **地图管理** → 新建地图，设置 `mapCode`（如 `test_base`）、底图。
2. **摆点模式** → 从资源库添加 NPC：韩诺、博士、维塔、教官等。
3. 左栏 NPC 顺序即为运行时顺序显现优先级；先导 NPC 放 `#1`。

### 2. 隐藏后续 NPC（两种模式二选一或组合）

**模式 A · 顺序显现（已有）**  
不勾选「隐」，仅靠列表顺序；运行时每次只显示当前应推进的一名 NPC。

**模式 B · 初始隐藏 + 显现**  
对博士、维塔等勾选「隐」；在韩诺剧情链中插入 **动作** 节点 → **+ 显现 NPC** → 选择目标 `npcUid`。导出为：

```json
{ "action": "reveal_npc", "npcUid": "doctor_uid" }
```

### 3. 编剧情（每名 NPC 一块区）

**推荐：战斗遭遇预设（任务 NPC + 战斗 NPC 分离）**

1. 左栏 **+** → 选「战斗遭遇（任务 NPC + 战斗 NPC 分离）」→ 选 battleRef。
2. 编辑器自动创建 **两个摆点**：
   - **任务 NPC**：对话 → 接取 → 提示 → 交任务（`questUpdate` 带 `event_done` 指向战斗环）
   - **战斗 NPC**：仅战斗；`appear` 为 `task_active`；胜利后链尾隐藏
3. 战斗 NPC 形象默认从资源库随机选取（后续可在 Inspector 指定）。

手动编排时，对每个 NPC 从 `npcEntry` 拉线性链：

- **任务 NPC**：对话 → 选择（接任务）→ 对话（提示）→ questUpdate（Completed，requirements 填 `event_done` 战斗 eventId）
- **战斗 NPC**：仅 **战斗** 节点 → `npcExit`（勾选完成后隐藏）

**不要**在任务 NPC 链上直接接战斗节点（易混淆交互入口、逃跑后图标/交任务状态不一致）。

选项导出示例（接任务）：

```json
"effects": [{ "action": "task_accept", "taskId": 100005, "choiceId": "yes" }]
```

交任务导出示例（须先完成战斗 eventId）：

```json
"requirements": [{ "type": "event_done", "eventId": "npc_battle_100005_e1" }],
"effects": [{ "action": "task_complete", "taskId": 100005 }]
```

战斗 NPC 显现示例：

```json
"appear": {
  "mode": "conditional",
  "requirements": [{ "type": "task_active", "taskId": 100005 }]
}
```

测试基地参考：`npc_bda99300_2`（任务官）+ `npc_bda99300_2_battle`（战斗目标），见 [`map_0_test_base_shared.json`](../../../server/data/story_maps/map_0_test_base_shared.json)。

### 4. 全局任务 tasks[]

在左栏 **全局任务** 维护大任务列表（拖动排序、双击进详情画布）。每个大任务对应一张 `kind=quest` 详情画布，并自动分配 `taskId` / `mainlineStep`。导出后写入 JSON `tasks[]`，与选项/questUpdate 中的数字 taskId 对齐。

### 5. 末节点传送下一地图

在引导 NPC 或传送员处：

- **选择** 节点 → `forcedResult = teleport`
- 填写 `toMapId`、`toX`、`toY`
- 可同时填接/交任务 taskId（如法西城 `100006`）

导出 `eventType=teleport` 与 teleport effect。

### 6. 第二张地图 · 同角色复用

1. 新建 **游戏地图 B**（如法西城）。
2. 从 **同一资源库 NPC** 再摆一个点（左栏 NPC「+」可重复选同一资源），生成新 `npcUid`（如 `commander_faxi` 或 `commander_faxi_2`）。
3. 编新地图剧情链；资源 `image`/`prefabKey` 与主城共用，摆点与剧情独立。

## 同角色多摆点（单地图内隐藏/显现）

适用于「小任务结束 → 隐藏 NPC → 另一坐标出现」：

| 摆点       | 配置           | 说明                                                             |
| ---------- | -------------- | ---------------------------------------------------------------- |
| **摆点 A** | 正常显示       | `npcEntry → … → npcExit`，结尾勾选「完成后隐藏 NPC」             |
| **摆点 B** | 同资源再次摆点 | 左栏勾选「隐」；在 A 链末尾用 **动作 → 显现 NPC** 或依赖顺序显现 |

两实例各自独立剧情链，可绑定不同全局任务的 `taskId` 接/交任务。

## 导出与校验

- 工具栏 **「导出 map」** 或 **MapRuntimePanel → 导出运行时 map**：统一走 `map-export-pipeline`（merge 地图壳 + manifest 校验 battleRef）。
- **连续多场战斗**：左栏 **+** → 选「战斗遭遇（任务 NPC + 战斗 NPC 分离）」→ 重复添加；每对含任务 NPC + 战斗 NPC，战斗胜利后战斗 NPC 消失，回任务 NPC 交任务。
- 关键字段应自动出现：`allowedChoiceIds`、`battleRef`、`teleport`、`reveal_npc`，无需手改。
- 单元测试：`Juben/tests/map-export-pipeline.test.ts`、`npc-chain-presets.test.ts`。

## 验收清单

1. **未接取**：任务 NPC 显示橙色 !；战斗 NPC 不可见。
2. **接取后**：战斗 NPC 显现（灰色 ?）；任务 NPC 灰色 ?。
3. **与战斗 NPC 交互**：进入战斗；任务 NPC 不触发战斗。
4. **战斗胜利**：战斗 NPC 消失；任务 NPC 变橙色 ?。
5. **回任务 NPC 交任务**：`task_complete` 成功。
6. **战斗逃跑/未打**：战斗 NPC 仍在；任务 NPC 保持灰色 ?，不可交任务。
7. 连续多场：重复 1–6，再测传送至下一张地图。
8. Cocos `StoryManager` + 服务端 `story_service` 直接消费导出 JSON。
