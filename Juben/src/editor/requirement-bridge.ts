/**
 * 编辑器 Requirement / CheckCondition ↔ 运行时 server.requirements 转换
 */
import type { CheckCondition, ProjectData, QuestStatus, Requirement } from "../types";
import { resolveQuestNumericTaskId } from "./quest-logic";
import { parseNumericTaskId } from "./constants";

export type RuntimeRequirement = {
  type: string;
  taskId?: number;
  eventId?: string;
  varId?: string;
  value?: boolean | number | string;
  key?: string;
  [key: string]: unknown;
};

export function questStatusToRuntimeRequirement(
  project: ProjectData | undefined,
  questId: string,
  status: QuestStatus,
): RuntimeRequirement | null {
  const taskId = project ? resolveQuestNumericTaskId(project, questId) : parseNumericTaskId(questId);
  if (!taskId) return null;
  if (status === "Completed") return { type: "task_completed", taskId };
  if (status === "InProgress") return { type: "task_active", taskId };
  if (status === "NotStarted") return { type: "task_not_started", taskId };
  if (status === "Failed") return { type: "task_failed", taskId };
  return null;
}

export function editorRequirementToRuntime(
  project: ProjectData | undefined,
  req: Requirement,
): RuntimeRequirement | null {
  if (req.kind === "questStatus") {
    return questStatusToRuntimeRequirement(project, req.questId, req.status);
  }
  if (req.kind === "varEquals") {
    return { type: "story_var_equals", varId: req.varId, value: req.value };
  }
  if (req.kind === "eventDone") {
    return { type: "event_done", eventId: req.eventId };
  }
  return null;
}

export function editorCheckToRuntime(
  project: ProjectData | undefined,
  check: CheckCondition,
): RuntimeRequirement | null {
  if (check.kind === "questStatus") {
    return questStatusToRuntimeRequirement(project, check.questId, check.status);
  }
  if (check.kind === "varEquals") {
    return { type: "story_var_equals", varId: check.varId, value: check.value };
  }
  if (check.kind === "serverVarEquals") {
    return { type: "server_var_equals", key: check.key, value: check.value };
  }
  if (check.kind === "hasPet") {
    return { type: "has_pet", petId: check.petId };
  }
  if (check.kind === "bagSpaceAtLeast") {
    return { type: "bag_space_at_least", slots: check.slots };
  }
  if (check.kind === "activitySwitchOn") {
    return { type: "activity_switch_on", key: check.key };
  }
  return null;
}

export function mergeRuntimeRequirements(
  base: RuntimeRequirement[] | undefined,
  extra: RuntimeRequirement[],
): RuntimeRequirement[] {
  const out = [...(base ?? [])];
  for (const r of extra) {
    const key = JSON.stringify(r);
    if (!out.some((x) => JSON.stringify(x) === key)) out.push(r);
  }
  return out;
}

/** 运行时 requirement → 编辑器 Requirement（appear / condition 回写） */
export function runtimeRequirementToEditor(
  project: ProjectData | undefined,
  req: RuntimeRequirement,
): Requirement | null {
  const type = req.type;
  if (type === "story_var_equals" && req.varId != null) {
    return { kind: "varEquals", varId: String(req.varId), value: req.value as boolean | number | string };
  }
  if (type === "event_done" && req.eventId) {
    return { kind: "eventDone", eventId: String(req.eventId) };
  }
  if (req.taskId != null) {
    const questId = findQuestIdByTaskId(project, Number(req.taskId));
    if (!questId) return null;
    if (type === "task_completed") return { kind: "questStatus", questId, status: "Completed" };
    if (type === "task_active") return { kind: "questStatus", questId, status: "InProgress" };
    if (type === "task_not_started") return { kind: "questStatus", questId, status: "NotStarted" };
    if (type === "task_failed") return { kind: "questStatus", questId, status: "Failed" };
  }
  return null;
}

function findQuestIdByTaskId(project: ProjectData | undefined, taskId: number): string | null {
  if (!project) return null;
  const q = project.quests.find((x) => x.taskId === taskId || resolveQuestNumericTaskId(project, x.id) === taskId);
  return q?.id ?? null;
}
