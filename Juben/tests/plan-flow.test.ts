import { describe, expect, it } from "vitest";
import {
  applyPlanSelection,
  parseAssistantPlanOrBrief,
  synthesizeBriefFromPlanAnswers,
} from "../src/editor/ai/plan-flow";
import { extractPlanStep } from "../src/editor/ai/story-stream-parser";
import { getNextBattlePlanStep } from "../src/editor/ai/battle-plan-steps";

describe("plan-flow", () => {
  it("extractPlanStep parses fenced planStep JSON", () => {
    const text = `好的，先确认敌人数量：
\`\`\`json
{"type":"planStep","stepId":"battle.enemyCount","title":"敌人数量","selectionMode":"number","min":1,"max":10}
\`\`\``;
    const step = extractPlanStep(text);
    expect(step?.stepId).toBe("battle.enemyCount");
    expect(step?.selectionMode).toBe("number");
  });

  it("applyPlanSelection merges option patch", () => {
    const step = {
      type: "planStep" as const,
      stepId: "battle.enabled",
      title: "战斗",
      selectionMode: "single" as const,
      options: [{ id: "yes", label: "要", patch: { "battle.enabled": "yes" } }],
    };
    const next = applyPlanSelection({}, step, "yes");
    expect(next["battle.enabled"]).toBe("yes");
  });

  it("synthesizeBriefFromPlanAnswers builds multiEnemyBattle constraints", () => {
    const brief = synthesizeBriefFromPlanAnswers({
      "battle.enabled": "yes",
      "battle.enemyCount": 3,
      "story.goal": "清剿前哨",
      "battle.acceptLabel": "接取任务",
      "battle.deferLabel": "暂缓",
    });
    expect(brief?.constraints).toContain("multiEnemyBattle");
    expect(brief?.constraints).toContain("deferUntilAccept");
    expect(brief?.constraints).toContain("enemyCount:3");
    expect(brief?.storyGoal).toBe("清剿前哨");
  });

  it("getNextBattlePlanStep advances through battle wizard", () => {
    expect(getNextBattlePlanStep({})?.stepId).toBe("battle.enabled");
    expect(getNextBattlePlanStep({ "battle.enabled": "yes" })?.stepId).toBe("battle.enemyCount");
    expect(
      getNextBattlePlanStep({ "battle.enabled": "yes", "battle.enemyCount": 2 })?.stepId,
    ).toBe("story.goal");
  });

  it("parseAssistantPlanOrBrief prefers valid brief over planStep", () => {
    const content = `\`\`\`json
{"type":"requirementsBrief","storyGoal":"测试","character":{},"beats":[],"constraints":[]}
\`\`\``;
    const { planStep, brief } = parseAssistantPlanOrBrief(content);
    expect(planStep).toBeNull();
    expect(brief?.storyGoal).toBe("测试");
  });
});
