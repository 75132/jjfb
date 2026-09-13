import { STORY_TITLE_MAX_LEN } from "../story-title-limit";
import type { ExistingNodeSummary, RequirementsBrief } from "./types";

const RPG_QUALITY_CONSTRAINTS = [
  "rpgVoice:对白必须像角色在说话，禁止任务说明书/任务板口吻",
  "rpgVoice:禁止「去打倒敌人再回来交任务」「附近出现了敌人请击败」等模板句",
  "rpgVoice:每句只做一件事（情绪/信息差/逼表态/钩子），8～36字",
  "rpgVoice:选择项要是态度或代价分流，禁止「确定/取消」同义重复",
  "rpgVoice:战前用紧张或试探，禁止「模拟胜利」",
];

/** 在已有任务链上优化（润色/补全），不重写整条链 */
export function buildOptimizeBriefFromExisting(
  nodes: ExistingNodeSummary[],
  options?: {
    focusNpcUid?: string;
    selectedNodeIds?: string[];
    userHint?: string;
  },
): RequirementsBrief {
  const focusNpc = options?.focusNpcUid;
  const targetIds = options?.selectedNodeIds?.length
    ? options.selectedNodeIds
    : nodes.map((n) => n.id);
  const hint = options?.userHint?.trim();
  return {
    type: "requirementsBrief",
    npcUid: focusNpc,
    storyGoal:
      hint ||
      "在现有任务链上做 RPG 级润色：重写干瘪/任务板式对白为有人味的角色台词，选项改成态度分流；保留节点结构与任务进度，不删不重建",
    editMode: "patch",
    beats: nodes.length
      ? nodes.map((n) => ({
          kind: n.kind,
          summary: `润色「${n.title || n.id}」：对白/选项达到传统 RPG 水准，不删除该节点`,
        }))
      : [{ kind: "dialog", summary: "按用户说明优化选中节点" }],
    targetNodeIds: targetIds.length ? targetIds : undefined,
    constraints: [
      "optimizeExistingChain",
      "禁止 deleteNode / 禁止 replace 整条链",
      "优先 patchNode 改对白/选项；仅缺失处 addNode + connect",
      "保留 entry/exit 与已有 nodeId，勿重建任务链",
      `title/npcName ≤${STORY_TITLE_MAX_LEN} 字`,
      "可用 addTaskChain 同名 npcUid 更新 title/npcName",
      "用户要求插入/追加节点时，用 addNode + afterNodeId/connect，勿 delete 已有节点",
      ...RPG_QUALITY_CONSTRAINTS,
      ...nodes.slice(0, 12).map((n) => `existing:${n.id}:${n.kind}:${n.title ?? ""}`),
    ],
  };
}
