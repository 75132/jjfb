import { describe, expect, it } from "vitest";
import {
  buildBlueprintTasks,
  defaultStoryBlueprint,
  isBlueprintReady,
  synthesizeBriefFromBlueprint,
} from "../src/editor/ai/story-blueprint";

describe("story-blueprint", () => {
  it("buildBlueprintTasks uses story goal titles not dialog/battle suffix template", () => {
    const bp = defaultStoryBlueprint(3);
    bp.storyGoal = "完成机甲训练";
    const tasks = buildBlueprintTasks(bp, { mapCode: "world" });
    expect(tasks[0]?.title).toBe("完成机甲训练 · 第1幕");
    expect(tasks[0]?.title).not.toMatch(/对话$/);
    expect(tasks[0]?.plotHint).toContain("完成机甲训练");
  });

  it("synthesizeBriefFromBlueprint marks dialog and battle chains separately", () => {
    const bp = defaultStoryBlueprint(3);
    bp.storyGoal = "引导新玩家";
    bp.nodes = [
      { kind: "dialog", enemyCount: 0 },
      { kind: "battle", enemyCount: 2 },
      { kind: "dialog", enemyCount: 0 },
    ];
    const brief = synthesizeBriefFromBlueprint(bp, { mapCode: "m1" });
    expect(brief?.constraints).toContain("chainTask:m1_chain_1:dialog");
    expect(brief?.constraints).toContain("chainTask:m1_chain_2:battle:2");
    expect(brief?.constraints).toContain("chainTask:m1_chain_3:dialog");
    expect(brief?.tasks?.[1]?.slotKind).toBe("battle");
    expect(brief?.tasks?.[0]?.slotKind).toBe("dialog");
  });

  it("isBlueprintReady requires story goal", () => {
    expect(isBlueprintReady(defaultStoryBlueprint(4))).toBe(false);
    const bp = defaultStoryBlueprint(4);
    bp.storyGoal = "有目标了";
    expect(isBlueprintReady(bp)).toBe(true);
  });
});
