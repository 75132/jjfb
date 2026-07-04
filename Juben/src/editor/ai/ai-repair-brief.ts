import type { ChainIssue } from "../map-chain-repair";
import type { RequirementsBrief } from "./types";

/** 根据链检测结果构建 AI patch 修复 brief（单 NPC / 单地图） */
export function buildRepairBriefFromIssues(
  issues: ChainIssue[],
  options?: {
    focusNpcUid?: string;
    fallbackTargetNodeIds?: string[];
    storyGoal?: string;
  },
): RequirementsBrief {
  const focusNpc = options?.focusNpcUid;
  const npcIssues = focusNpc ? issues.filter((i) => i.npcUid === focusNpc) : issues;
  const targetIds = npcIssues.map((i) => i.nodeId).filter((id): id is string => !!id);
  return {
    type: "requirementsBrief",
    npcUid: focusNpc,
    storyGoal: options?.storyGoal ?? "修复任务链：补全缺失连线与剧情节点",
    beats: [{ kind: "dialog", summary: "补写缺失的对白/选项/任务节点" }],
    editMode: "patch",
    targetNodeIds: targetIds.length ? targetIds : options?.fallbackTargetNodeIds,
    constraints: [
      "仅补缺失 dialog/choice/questUpdate，禁止 delete npcEntry/npcExit",
      "必须用 connect 把 entry 连到首个中间节点，链尾连 exit",
      "tasks 顺序即任务束出现顺序；后续 NPC 出现条件绑定前链 event_done",
      ...(focusNpc ? [`聚焦 NPC：${focusNpc}`] : []),
      ...npcIssues.slice(0, 10).map((i) => i.message),
    ],
  };
}

/** 是否建议走 AI 自动补链（确定性 repair 无法补中间节点） */
export function issuesNeedAiRepair(issues: ChainIssue[]): boolean {
  return issues.some((i) => i.kind === "no_middle_nodes" || i.kind === "choice_empty_option");
}
