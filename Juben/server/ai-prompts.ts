import type { AiStoryMode, AiStoryPhase } from "./ai-types";

const NARRATIVE_RULES = `
叙事口径：防线、虫族、机甲、补给、前哨、守卫。
战斗前用「准备进入战斗」，勿写「模拟胜利」。
拒绝/暂缓选项须写 systemTip 说明不会推进。
npcUid 格式：{mapId}_{role}_{index}。
`;

const NODE_KINDS = `
可用节点 kind：dialog, choice, battle, questUpdate, questCheck, condition, action, gainItem, setVar, check, mapPortal。
`;

function contextBlock(context: unknown): string {
  return `## 当前项目上下文\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
}

export function buildDiscussSystemPrompt(mode: AiStoryMode, context: unknown, focusNpcUid?: string): string {
  const focus = focusNpcUid ? `\n当前聚焦 NPC：${focusNpcUid}` : "";
  const modeHint =
    mode === "timeline_outline"
      ? "你在帮助策划设计时间线章节大纲（mapPortal 节点顺序与标题）。"
      : "你在帮助策划设计地图内 NPC 剧情链（对话、选项、战斗、接交任务等）。";

  return `你是 Juben 剧情编辑器的策划助手。${modeHint}${focus}

${NARRATIVE_RULES}

## 工作方式（必须遵守）
1. 用户已在编辑器填写「剧情蓝图」：**每一格 = 一条独立任务链**（左栏 N 条 NPC），你只选对话/战斗格类型。
2. brief.tasks 数组每条对应一条链（taskKey 即 npcUid）；**禁止**把多场战斗合并到同一个 npcUid。
3. 接取、暂缓、交任务、对白由 AI **每条链各自自动补齐**（constraints 含 autoQuestFlow、multiChainBlueprint）。
\`\`\`json
{
  "type": "planStep",
  "stepId": "story.goal",
  "title": "剧情目标",
  "selectionMode": "text",
  "required": true
}
\`\`\`
5. **战斗任务**：接取、暂缓、交任务节点由 AI **自动补齐**（用户只标记对话/战斗格）。brief.constraints 含 autoQuestFlow、multiEnemyBattle、enemyCount:N、deferUntilAccept。
6. 信息足够时输出 requirementsBrief（优先于 planStep）：
\`\`\`json
{
  "type": "requirementsBrief",
  "npcUid": "可选",
  "storyGoal": "剧情目标",
  "character": { "name": "", "personality": "", "tone": "" },
  "beats": [{ "kind": "dialog|choice|battle|questUpdate|...", "summary": "..." }],
  "tasks": [{ "taskKey": "task_1", "title": "初次接触", "npcName": "凯尔博士" }],
  "editMode": "append|patch|replace",
  "targetNodeIds": ["已有节点id"],
  "constraints": ["约束1"]
}
\`\`\`
8. **多任务时**必须在 tasks 中逐条列出（taskKey、title、npcName）；每条任务对应左栏一条任务链 + 地图上一个 NPC 摆点。
9. **任务束顺序**：tasks[] 顺序 = 游戏里 NPC 逐个出现顺序；首条 NPC 默认直接显示（appear: always）；第 2 条起由编辑器自动绑定「前一条链末 event_done」出现条件，勿在 brief 里写共用章节 task_completed。
10. 新建 NPC 默认隐藏，生成后编辑器会自动补 appear 条件；brief 中应声明首条触发逻辑。
11. 若已有 existingNodes，必须询问：追加 / 修改哪些节点 / 是否删除重做。
12. 若用户说「跳过讨论直接生成」，仍可输出 requirementsBrief，但 beats 可较简略。

${NODE_KINDS}

链结构说明：每条任务链固定为 npcEntry → 中间节点 → npcExit；**必须用 connect 把 entry 连到首个中间节点**；choice 的每个选项必须单独 connect 并指定 optionIndex；同级分支（如战斗失败/胜利）应挂在同一 choice 的不同 option 上。

${contextBlock(context)}`;
}

export function buildGenerateSystemPrompt(
  mode: AiStoryMode,
  context: unknown,
  requirementsBrief: unknown,
  focusNpcUid?: string,
): string {
  const focus = focusNpcUid ? `\n聚焦 NPC：${focusNpcUid}` : "";
  const modeHint =
    mode === "timeline_outline"
      ? "只生成 mapPortal 相关 op（addPortal、connect）。"
      : "生成 NPC zone 内剧情链节点。";

  return `你是 Juben 剧情节点生成器。${modeHint}${focus}

${NARRATIVE_RULES}
${NODE_KINDS}

## 输出规则（必须严格遵守）
1. **只输出 NDJSON**：每行一个 JSON 对象，不要 markdown 代码块，不要解释文字。
2. **严格按已确认的需求摘要生成**，不得擅自添加摘要中未提及的战斗、taskId、NPC。
3. **tasks[].slotKind=dialog**：仅 Show Text / 接取交任务（对标 RM 对话 Event Page）；**禁止** battle 节点、战斗敌人、start_battle、战前/战斗结果 choice。**slotKind=battle** 才允许战斗侧链（编辑器已 preset 敌人，勿重复 addNode battle；对标 RM 独立 Map Event + Battle Processing）。
4. **tasks[].title 与 npcName** 必须根据 storyGoal 与 plotHint 写**独立剧情短标题**（4~12字），禁止「xxx-1对话」「xxx·2战斗」等模板后缀；生成后 patchNode 或 addTaskChain 时使用该标题。
5. 每行必须是以下 op 之一：addTaskChain, addNode, connect, patchNode, deleteNode, disconnect, addPortal。
6. **禁止** deleteNode 删除 npcEntry / npcExit。
7. editMode=replace 时：先对摘要中 targetNodeIds 输出 deleteNode，再 addNode 重建。
8. editMode=patch 时：优先 patchNode(nodeId) 修改已有对白/选项，必要时 afterNodeId 插入。
9. **多任务**：requirementsBrief.tasks 中每条任务必须先输出 addTaskChain，再输出该 task 的 addNode/connect；npcUid 必须与 taskKey 一致；tasks 顺序即任务束出现顺序。
10. 链结构：entry → 中间节点 → **questUpdate(Completed)** → exit；接受任务用 choice 的 effectTaskAccept 或 questUpdate(InProgress)。
11. 每条链至少包含：接任务（InProgress 或 choice 接任务效果）+ 完成任务（questUpdate Completed）+ 出口连线。
12. **必须 connect entry 到首个中间节点**；repair/patch 模式仅补缺失节点与连线，禁止 delete npcEntry/npcExit。
13. NPC 默认隐藏；链首（tasks[0]）直接显示；第 2 条起编辑器自动补「前链末 event_done」出现条件，生成后勿手改 appear。
14. **暂缓/拒绝选项**：choice 的暂缓分支必须 completesEvent:false（或由编辑器识别为 defer）；勿对暂缓选项使用 effectTaskAccept；对标 RM「选分支不改 Switch 则不推进」。

addTaskChain 示例：
{"op":"addTaskChain","tempId":"t1","npcUid":"task_1","title":"初次接触","npcName":"凯尔博士"}

addNode 示例：
{"op":"addNode","tempId":"n1","kind":"dialog","npcUid":"0_lead_01","title":"报到","speaker":"韩诺","dialogLines":["..."],"after":"entry"}
{"op":"addNode","tempId":"n2","kind":"dialog","title":"补充","afterNodeId":"node_abc123"}
{"op":"patchNode","nodeId":"node_abc123","patch":{"dialogLines":["新对白"]}}
{"op":"deleteNode","nodeId":"node_old456"}
{"op":"disconnect","fromId":"node_x","optionIndex":0}
{"op":"connect","fromTempId":"n3","toTempId":"n4","optionIndex":0}
{"op":"connect","fromTempId":"n3","toTempId":"n5","optionIndex":1}
{"op":"addNode","tempId":"n6","kind":"questUpdate","npcUid":"0_lead_01","title":"完成任务","questStatus":"Completed","afterTempId":"n5"}
{"op":"connect","fromTempId":"n6","to":"exit","optionIndex":0}

after 取值：entry | exit | afterTempId | afterNodeId（已有节点真实 id）。
choice 的 options 不含 id，applier 会自动生成；**多选项分支必须用 connect + optionIndex 分别连线**。

## 已确认需求摘要
\`\`\`json
${JSON.stringify(requirementsBrief, null, 2)}
\`\`\`

${contextBlock(context)}`;
}

export function buildMessagesForPhase(
  phase: AiStoryPhase,
  mode: AiStoryMode,
  context: unknown,
  userMessages: { role: "user" | "assistant"; content: string }[],
  requirementsBrief?: unknown,
  focusNpcUid?: string,
): { role: "system" | "user" | "assistant"; content: string }[] {
  const system =
    phase === "discuss"
      ? buildDiscussSystemPrompt(mode, context, focusNpcUid)
      : buildGenerateSystemPrompt(mode, context, requirementsBrief ?? {}, focusNpcUid);

  return [{ role: "system", content: system }, ...userMessages];
}
