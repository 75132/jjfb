import { describe, expect, it } from "vitest";
import {
  evaluateRequirements,
  evaluateSingleRequirement,
  type StoryRequirementContext,
} from "../../assets/Script/Game/story-requirements";

function ctx(partial: Partial<StoryRequirementContext> = {}): StoryRequirementContext {
  return {
    completedEventIds: new Set(),
    battleClearedEventIds: new Set(),
    completedTaskIds: new Set(),
    acceptedTaskIds: new Set(),
    activeTaskIds: new Set(),
    mainlineStep: 0,
    playerLevel: 10,
    ownedItemIds: new Set([1001]),
    isEventQuestStepComplete: (id) => partial.completedEventIds?.has(id) ?? false,
    ...partial,
  };
}

describe("story-requirements", () => {
  it("evaluates event_done and task_active", () => {
    const c = ctx({
      completedEventIds: new Set(["e1"]),
      acceptedTaskIds: new Set([100001]),
      isEventQuestStepComplete: (id) => id === "e1",
    });
    expect(evaluateSingleRequirement({ type: "event_done", eventId: "e1" }, c)).toBe(true);
    expect(evaluateSingleRequirement({ type: "event_done", eventId: "e2" }, c)).toBe(false);
    expect(evaluateSingleRequirement({ type: "task_active", taskId: 100001 }, c)).toBe(true);
    expect(evaluateSingleRequirement({ type: "task_active", taskId: 999 }, c)).toBe(false);
  });

  it("evaluates level and item_owned", () => {
    const c = ctx({ playerLevel: 5, ownedItemIds: new Set([42]) });
    expect(evaluateSingleRequirement({ type: "level", value: 3 }, c)).toBe(true);
    expect(evaluateSingleRequirement({ type: "level", value: 8 }, c)).toBe(false);
    expect(evaluateSingleRequirement({ type: "item_owned", itemId: 42 }, c)).toBe(true);
    expect(evaluateSingleRequirement({ type: "item_owned", itemId: 1 }, c)).toBe(false);
  });

  it("unknown requirement types do not block chain", () => {
    const c = ctx();
    expect(evaluateRequirements([{ type: "story_var_equals", varId: 1, value: 0 }, { type: "mainline_step", value: 0 }], c)).toBe(
      true,
    );
  });

  it("mainline_step AND chain", () => {
    const c = ctx({ mainlineStep: 2 });
    expect(
      evaluateRequirements(
        [
          { type: "mainline_step", value: 1 },
          { type: "task_completed", taskId: 1 },
        ],
        { ...c, completedTaskIds: new Set([1]) },
      ),
    ).toBe(true);
    expect(evaluateRequirements([{ type: "mainline_step", value: 5 }], c)).toBe(false);
  });
});
