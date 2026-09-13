import type { ProjectData } from "../../types";
import type { RequirementsBrief } from "./types";
import { extractRequirementsBrief, isValidBrief } from "./story-stream-parser";
import { getTimelineGraph } from "../map-tree";
import { getOptionTargets } from "../../types";

export type ConsultPhase = "idle" | "discuss" | "briefReady" | "generating" | "done";

export function inferMode(isTimeline: boolean) {
  return isTimeline ? ("timeline_outline" as const) : ("map_npc_chain" as const);
}

export function parseBriefFromAssistantMessage(content: string): RequirementsBrief | null {
  return extractRequirementsBrief(content);
}

export function canStartGenerate(brief: RequirementsBrief | null): boolean {
  return isValidBrief(brief);
}

export function getInitialAssistantTrigger(
  isTimeline: boolean,
  focusNpcUid?: string | null,
  options?: { hasExistingChain?: boolean },
): string {
  if (isTimeline) {
    return "请根据章节大纲生成时间线 portal 结构。";
  }
  if (options?.hasExistingChain) {
    return focusNpcUid
      ? `NPC「${focusNpcUid}」已有剧情链。请保留现有节点，只润色对白与选项。`
      : "当前地图已有剧情链。请保留现有节点，只润色对白与衔接。";
  }
  return "请根据剧情蓝图润色对白与节点细节，不要提问，直接给建议。";
}

export function nextPhaseAfterDiscuss(content: string, current: ConsultPhase): ConsultPhase {
  if (current !== "discuss" && current !== "idle") return current;
  const brief = extractRequirementsBrief(content);
  if (isValidBrief(brief)) return "briefReady";
  return "discuss";
}

/** 时间线 portal 连线顺序（用于 addPortal after） */
export function getLastPortalNodeId(project: ProjectData): string | undefined {
  const timeline = getTimelineGraph(project);
  if (!timeline) return undefined;
  const portals = timeline.nodes.filter((n) => n.kind === "mapPortal");
  if (portals.length === 0) return undefined;
  for (const p of portals) {
    const targets = p.options.flatMap((o) => getOptionTargets(o));
    const isTail = !portals.some((other) => targets.includes(other.id));
    if (isTail) return p.id;
  }
  return portals[portals.length - 1]?.id;
}
