import type { PlanStepPayload } from "./types";
import type { PlanAnswers } from "./plan-flow";

/** 战斗 Plan 固定步骤（客户端可本地推进，AI 未返回 planStep 时兜底） */
export const BATTLE_PLAN_STEP_ORDER = [
  "battle.enabled",
  "battle.enemyCount",
  "story.goal",
  "battle.acceptLabel",
  "battle.deferLabel",
] as const;

export function buildBattlePlanStep(stepId: string): PlanStepPayload | null {
  switch (stepId) {
    case "battle.enabled":
      return {
        type: "planStep",
        stepId,
        title: "是否需要战斗？",
        prompt: "接取任务后，玩家需逐个击败地图上的敌人 NPC。",
        selectionMode: "single",
        options: [
          { id: "yes", label: "需要战斗（多敌人）", patch: { "battle.enabled": "yes" } },
          { id: "dialog_only", label: "只要对话，不要战斗", patch: { "battle.enabled": "no" } },
        ],
        allowCustom: false,
      };
    case "battle.enemyCount":
      return {
        type: "planStep",
        stepId,
        title: "需要击败几个敌人？",
        prompt: "每个敌人独立触发战斗，击败后从地图消失；全部击败后可交任务。",
        selectionMode: "number",
        min: 1,
        max: 10,
        required: true,
      };
    case "story.goal":
      return {
        type: "planStep",
        stepId,
        title: "剧情目标（可选）",
        prompt: "一句话描述这段任务要讲什么。",
        selectionMode: "text",
        required: false,
        customPlaceholder: "例如：清剿前哨附近的虫族小队",
      };
    case "battle.acceptLabel":
      return {
        type: "planStep",
        stepId,
        title: "接取按钮文案",
        selectionMode: "single",
        options: [
          { id: "accept", label: "接取任务" },
          { id: "start", label: "开始任务" },
          { id: "go", label: "出发" },
        ],
        allowCustom: true,
        customPlaceholder: "自定义接取文案",
        required: false,
      };
    case "battle.deferLabel":
      return {
        type: "planStep",
        stepId,
        title: "暂缓按钮文案",
        selectionMode: "single",
        options: [
          { id: "defer", label: "暂缓" },
          { id: "later", label: "稍后再说" },
          { id: "think", label: "再想想" },
        ],
        allowCustom: true,
        customPlaceholder: "自定义暂缓文案",
        required: false,
      };
    default:
      return null;
  }
}

export function getNextBattlePlanStep(answers: PlanAnswers): PlanStepPayload | null {
  if (answers["battle.enabled"] === "no" || answers["battle.enabled"] === false) {
    if (!answers["story.goal"]) {
      return buildBattlePlanStep("story.goal");
    }
    return null;
  }
  for (const stepId of BATTLE_PLAN_STEP_ORDER) {
    if (answers[stepId] === undefined || answers[stepId] === "") {
      if (stepId === "battle.enemyCount" && answers["battle.enabled"] === "no") continue;
      return buildBattlePlanStep(stepId);
    }
  }
  return null;
}

export function mapPlanLabelToAnswer(stepId: string, optionId: string): string | number | undefined {
  if (stepId === "battle.acceptLabel") {
    const map: Record<string, string> = { accept: "接取任务", start: "开始任务", go: "出发" };
    return map[optionId] ?? optionId;
  }
  if (stepId === "battle.deferLabel") {
    const map: Record<string, string> = { defer: "暂缓", later: "稍后再说", think: "再想想" };
    return map[optionId] ?? optionId;
  }
  return optionId;
}
