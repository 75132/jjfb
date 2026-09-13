import { describe, expect, it } from "vitest";
import {
  blueprintTaskPlaceholderTitle,
  buildBlueprintTasks,
  defaultStoryBlueprint,
  isBlueprintReady,
  synthesizeBriefFromBlueprint,
} from "../src/editor/ai/story-blueprint";

describe("story-blueprint", () => {
  it("buildBlueprintTasks uses short act titles for multi-chain blueprints", () => {
    const bp = defaultStoryBlueprint(3);
    bp.storyGoal = "完成机甲训练";
    const tasks = buildBlueprintTasks(bp, { mapCode: "world" });
    expect(tasks[0]?.title).toBe("第1幕");
    expect(tasks[1]?.title).toBe("第2幕");
    expect(tasks[0]?.title).not.toMatch(/对话$/);
    expect(tasks[0]?.plotHint).toContain("完成机甲训练");
  });

  it("single-chain placeholder clamps story goal to seven chars", () => {
    expect(blueprintTaskPlaceholderTitle("引导玩家成为机甲召唤师", 0, 1)).toBe("引导玩家成为机");
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
    expect(brief?.constraints).toContain("titleMaxLen:7");
    expect(brief?.tasks?.[1]?.slotKind).toBe("battle");
    expect(brief?.tasks?.[0]?.slotKind).toBe("dialog");
  });

  it("buildBlueprintTasks uses user title when provided", () => {
    const bp = defaultStoryBlueprint(2);
    bp.storyGoal = "完成机甲训练";
    bp.nodes[0]!.title = "新兵报到";
    bp.nodes[1]!.title = "前哨清剿";
    const tasks = buildBlueprintTasks(bp, { mapCode: "world" });
    expect(tasks[0]?.title).toBe("新兵报到");
    expect(tasks[1]?.title).toBe("前哨清剿");
  });

  it("isBlueprintReady requires story goal", () => {
    expect(isBlueprintReady(defaultStoryBlueprint(4))).toBe(false);
    const bp = defaultStoryBlueprint(4);
    bp.storyGoal = "有目标了";
    expect(isBlueprintReady(bp)).toBe(true);
  });
});
