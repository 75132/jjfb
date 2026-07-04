# RM MV 对照：对话页 vs 战斗页

本文说明 Juben 任务链如何对标 RPG Maker MV 的 Event Page 模型，以及验收清单。

## 概念对照

| RM MV | Juben |
|-------|-------|
| Event Page（页 = 形态 + 条件 + 触发 + Contents） | `chainSlotKind` + `npc.appear` + 玩家交互 + entry→exit 节点链 |
| Page Conditions | `npc.appear.requirements`（页条件） |
| Action Button | 默认：走近 NPC 交互 |
| Autorun（一次性） | `npcEntry.chainContinuous` + 交任务/exit 防循环 |
| Show Text / Show Choices | `dialog` / `choice` 节点 |
| Battle Processing → Troop | 独立 `{giver}_enemy` 侧链：`spawn → 战前 → battle` |
| Self Switch A | 链末 `event_done`（交任务或战斗胜利） |
| Switch / Variable | `questUpdate` / `setVar` / 任务状态 |

**重要**：Juben **不**采用 RM 单页「Show Text 后直接 Battle Processing」混写。对话页与战斗页必须分离（两个 Map Event + event_done 串联）。

## 标准对话页 Contents

```
entry → dialog → choice(接取/暂缓) → questUpdate(Completed) → exit
```

- 允许：接取（`effectTaskAccept`）、暂缓（`completesEvent=false` + block）
- 禁止：battle 节点、敌人出现、战前/战斗结果 choice、`start_battle`、交任务绑 `event_done`

## 标准战斗页 Contents

**任务官主链（giver）**

```
entry → dialog → choice(接取) → … → questUpdate(Completed) → exit
```

**独立战斗 Event（enemy 侧链）**

```
敌人出现 → 战前选择 → battle（When Win / When Lose）→ event_done → 回 giver 交任务
```

## 手动验收清单

1. **全对话蓝图**：左栏节点库「战斗」类灰显；全局修复不增 enemy；导出无 battle Event。
2. **含战斗蓝图**：仅 `[战斗]` 槽出现红色敌人；接取后 `task_active` 显现敌人。
3. **暂缓**：选项 `completesEvent=false` + block，不推进任务（对标 RM 选项不改 Switch）。
4. **多敌人**：全部 `event_done` 后才可交任务（ALL 条件）。
5. **页类型切换**：Inspector 改「对话页」自动剥离战斗侧链；改「战斗页」可补战斗分支。
6. **编辑禁令**：对话页手动加 battle 节点 → 弹窗拒绝。

## Cocos 离线验收清单（7 项）

在 `StoryManager.skipServerRequirements = true` 下逐图验收：

1. **接取推进**：选「接受/接取」→ 任务变为进行中，NPC 指示器与链内后续节点可用。
2. **暂缓不推进**：选「暂缓/拒绝/稍后再说」→ 任务 **未** 接取、`event_done` **未** 写入；控制台无报错；再次交互仍显示同一 choice。
3. **暂缓提示**：无 `npcReply`/`systemTip` 时显示「已暂缓，任务未推进…」Toast。
4. **战斗分离**：对话页不接战；接取后 `{giver}_enemy` 在地图显现，接触敌人才开战。
5. **战斗胜利链**：全部战斗 `event_done` 后任务官才出现交任务 `?`。
6. **JSON 自检**：启动地图时无 `StoryManager: defer 选项仍在 allowedChoiceIds` 警告（旧 JSON 需 `npm run audit:story-maps -- --fix --publish`）。
7. **Juben 预览**：MapRuntimePanel「选项推进摘要」中暂缓行显示为「暂缓 · …」，且不在 allowed 列表。

## 相关代码

- `chain-slot-guards.ts` — 编辑期硬禁令
- `chain-slot-kind.ts` — 槽位判定与 backfill
- `quest-battle-normalize.ts` — 修复层 strip/ensure
- `map-export-editor-guards.ts` — 导出阻断
