import type { ProjectData } from "../../types";
import type { RequirementsBrief } from "./types";
import { extractPlanStep, extractRequirementsBrief, isValidBrief } from "./story-stream-parser";
import { synthesizeBriefFromPlanAnswers, type PlanAnswers } from "./plan-flow";
import { getTimelineGraph } from "../map-tree";
import { getOptionTargets } from "../../types";

export type ConsultPhase = "discuss" | "plan" | "planReady" | "briefReady" | "generating" | "done";

export function inferMode(isTimeline: boolean) {
  return isTimeline ? ("timeline_outline" as const) : ("map_npc_chain" as const);
}

export function parseBriefFromAssistantMessage(content: string): RequirementsBrief | null {
  return extractRequirementsBrief(content);
}

export function canStartGenerate(brief: RequirementsBrief | null): boolean {
  return isValidBrief(brief);
}

export function getInitialAssistantTrigger(isTimeline: boolean, focusNpcUid?: string | null): string {
  if (isTimeline) {
    return "请根据我提供的章节大纲帮我细化时间线 portal 结构。";
  }
  if (focusNpcUid) {
    return `请根据右侧「剧情蓝图」摘要，为 NPC「${focusNpcUid}」润色对白与节点细节（不要逐步提问，直接按蓝图生成）。`;
  }
  return "请根据右侧「剧情蓝图」摘要润色对白与节点细节（不要逐步提问，直接按蓝图生成）。";
}

export function nextPhaseAfterDiscuss(
  content: string,
  current: ConsultPhase,
  planAnswers?: PlanAnswers,
): ConsultPhase {
  if (current !== "discuss" && current !== "plan") return current;
  const brief = extractRequirementsBrief(content);
  if (isValidBrief(brief)) return "briefReady";
  const planStep = extractPlanStep(content);
  if (planStep) return "plan";
  if (planAnswers && Object.keys(planAnswers).length > 0) {
    const synthesized = synthesizeBriefFromPlanAnswers(planAnswers, brief);
    if (synthesized) return "briefReady";
  }
  return current === "plan" ? "plan" : "discuss";
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
