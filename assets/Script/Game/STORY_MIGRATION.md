# 剧情系统迁移说明（StoryManager）

## 已完成（本仓库 Game 场景）

- `CanvasRoot(UI)` 已挂载 **StoryManager**，并绑定 `map_0_test_base_shared` 对应的 JsonAsset。
- NPC 节点上的旧 **MapNpcInteract** 已移除；`BattleTriggerOnContact` 仍保留，StoryManager 默认会将其 `enabled=false`（与旧行为一致）。

## 其他场景 / 预制体若仍用旧脚本

1. 删除 NPC（或任意节点）上的 **MapNpcInteract**。
2. 在 **CanvasRoot(UI)**（与 **StoryUIViewRefs** 同节点）添加 **StoryManager**。
3. 将 **mapConfig** 拖为与地图一致的 JsonAsset（含 `npcs`、`client.dialogueScripts`、`client.choiceScripts`）。
4. NPC **零挂载**：任选其一绑定逻辑与场景节点  
   - 推荐：在 JSON 的 `npcs[]` 项中增加 `"nodePath": "父节点名/子节点名/..."`（从场景根 `cc.Scene` 的子节点起算名称链）。  
   - 或将 NPC 节点**重命名为**与 `npcUid` 一致（如 `0_lead_01`）。  
   - 否则使用 JSON 的 `x,y` + `tileSize` 做像素格推算，在场景内寻找带 **BoxCollider2D** 且距离最近的节点（见 `coordMatchMaxPx`）。

## 保留不变的资源

- `StoryUIViewRefs.ts` 与 `CanvasRoot(UI).prefab` 的 UI 槽位绑定勿改。
- 地图 JSON 结构无需变更。

## 脚本 UUID 说明

- 原 `MapNpcInteract` 的 `.meta` UUID 已迁移至 **StoryManager.ts.meta**，以便旧场景中的 `__type__` 序列化仍指向同一脚本资源。若编辑器报 Missing Script，请执行 **刷新资源 / 重新编译脚本**。

## 若「完全没效果」（已修一版常见根因）

- **`PlayerGridMove.mapRoot` 未在编辑器里绑定** 时，无法按 JSON 的 `x,y` 做格子换算，且场景里 NPC 节点名往往不是 `npcUid`（例如仍叫 `NPC`），会导致 **一个 NPC 都解析不到**。
- 当前 **StoryManager** 已增加兜底：从 **`Canvas/GameArea/WorldRoot/NPC`** 解析，并在 `WorldRoot` 下收集 `BoxCollider2D` 做补充匹配；同一物理节点只会绑定 **第一条** 未占用的配置（其余 `npcUid` 会打 `[Story] warn`，属正常，直到你在场景里补全对应节点或写 `nodePath`）。
- 推荐长期做法：在编辑器给 **PlayerGridMove** 绑定 **mapRoot**，或在 `map_*.json` 的 `npcs[]` 里为每条加 **`nodePath`**（从场景根起的名称链，如 `Canvas/GameArea/WorldRoot/你的节点名`）。
