import type { PlanStepPayload, RequirementsBrief } from "./types";
import { extractPlanStep, extractRequirementsBrief, isValidBrief } from "./story-stream-parser";

export type PlanAnswerValue = string | number | boolean | string[];

export type PlanAnswers = Record<string, PlanAnswerValue>;

/** 合并 option.patch 到 planAnswers（stepId 为主键） */
export function applyPlanSelection(
  answers: PlanAnswers,
  step: PlanStepPayload,
  value: PlanAnswerValue,
): PlanAnswers {
  const next = { ...answers, [step.stepId]: value };
  if (step.selectionMode === "single" && typeof value === "string" && step.options) {
    const opt = step.options.find((o) => o.id === value);
    if (opt?.patch) {
      for (const [k, v] of Object.entries(opt.patch)) {
        next[k] = v as PlanAnswerValue;
      }
    }
  }
  return next;
}

export function formatPlanSelectionLabel(step: PlanStepPayload, value: PlanAnswerValue): string {
  if (step.selectionMode === "single" && typeof value === "string") {
    const opt = step.options?.find((o) => o.id === value);
    return opt?.label ?? value;
  }
  if (step.selectionMode === "multi" && Array.isArray(value)) {
    const labels = value.map((id) => step.options?.find((o) => o.id === id)?.label ?? id);
    return labels.join("、");
  }
  return String(value);
}

export function buildUserMessageForPlanSelection(step: PlanStepPayload, value: PlanAnswerValue): string {
  const label = formatPlanSelectionLabel(step, value);
  return `【Plan】${step.title}：${label}`;
}

/** 从 planAnswers 合成 requirementsBrief（减少 AI 幻觉） */
export function synthesizeBriefFromPlanAnswers(
  answers: PlanAnswers,
  partial?: RequirementsBrief | null,
): RequirementsBrief | null {
  const storyGoal =
    (typeof answers["story.goal"] === "string" ? answers["story.goal"] : undefined) ??
    partial?.storyGoal ??
    "";

  const constraints: string[] = [...(partial?.constraints ?? [])];
  const battleEnabled = answers["battle.enabled"];
  const isBattle =
    battleEnabled !== "no" &&
    battleEnabled !== false &&
    (battleEnabled === true ||
      battleEnabled === "yes" ||
      battleEnabled === "battle" ||
      answers["battle.enemyCount"] != null);

  if (isBattle) {
    if (!constraints.includes("multiEnemyBattle")) constraints.push("multiEnemyBattle");
    if (!constraints.includes("deferUntilAccept")) constraints.push("deferUntilAccept");
    const count = answers["battle.enemyCount"];
    if (typeof count === "number" && count >= 1) {
      constraints.push(`enemyCount:${count}`);
    }
    const acceptLabel = answers["battle.acceptLabel"];
    if (typeof acceptLabel === "string" && acceptLabel.trim()) {
      constraints.push(`acceptLabel:${acceptLabel.trim()}`);
    }
    const deferLabel = answers["battle.deferLabel"];
    if (typeof deferLabel === "string" && deferLabel.trim()) {
      constraints.push(`deferLabel:${deferLabel.trim()}`);
    }
  }

  const beats = partial?.beats?.length ? [...partial.beats] : [];
  if (isBattle && beats.length === 0) {
    const n = typeof answers["battle.enemyCount"] === "number" ? answers["battle.enemyCount"] : 2;
    beats.push(
      { kind: "dialog", summary: "任务官初次对话" },
      { kind: "choice", summary: "接取或暂缓（暂缓不显示敌人）" },
      { kind: "action", summary: `接取后显示 ${n} 个战斗敌人 NPC` },
      { kind: "battle", summary: `逐个击败 ${n} 个敌人，各战后该敌人消失` },
      { kind: "questUpdate", summary: "全部击败后回任务官交任务" },
    );
  }

  const brief: RequirementsBrief = {
    type: "requirementsBrief",
    npcUid: partial?.npcUid,
    storyGoal: storyGoal.trim() || (isBattle ? "多敌人战斗任务链" : ""),
    character: partial?.character ?? {},
    beats,
    tasks: partial?.tasks,
    constraints,
    editMode: partial?.editMode,
    targetNodeIds: partial?.targetNodeIds,
  };

  return isValidBrief(brief) ? brief : null;
}

export function parseAssistantPlanOrBrief(content: string): {
  planStep: PlanStepPayload | null;
  brief: RequirementsBrief | null;
} {
  const brief = extractRequirementsBrief(content);
  if (isValidBrief(brief)) {
    return { planStep: null, brief };
  }
  const planStep = extractPlanStep(content);
  return { planStep, brief: brief ?? null };
}

export function isPlanStepComplete(step: PlanStepPayload, answers: PlanAnswers): boolean {
  if (step.required === false) return true;
  const v = answers[step.stepId];
  if (v === undefined || v === null || v === "") return false;
  if (step.selectionMode === "multi" && Array.isArray(v) && v.length === 0) return false;
  if (step.selectionMode === "number" && typeof v === "number") {
    const min = step.min ?? 1;
    const max = step.max ?? 99;
    return v >= min && v <= max;
  }
  return true;
}
