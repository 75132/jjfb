import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  editorCheckToRuntime,
  editorRequirementToRuntime,
  runtimeRequirementToEditor,
} from "../src/editor/requirement-bridge";

describe("requirement-bridge", () => {
  const project = {
    variables: [],
    quests: [{ id: "q1", name: "任务1", initialStatus: "NotStarted" as const, graphId: "g1", taskId: 100001 }],
    graphs: [],
  };

  it("converts quest requirement to runtime", () => {
    const rt = editorRequirementToRuntime(project, {
      kind: "questStatus",
      questId: "q1",
      status: "Completed",
    });
    expect(rt).toEqual({ type: "task_completed", taskId: 100001 });
  });

  it("converts var requirement to runtime", () => {
    const rt = editorRequirementToRuntime(project, {
      kind: "varEquals",
      varId: "flag_a",
      value: true,
    });
    expect(rt).toEqual({ type: "story_var_equals", varId: "flag_a", value: true });
  });

  it("converts check to runtime", () => {
    const rt = editorCheckToRuntime(project, {
      kind: "bagSpaceAtLeast",
      slots: 3,
    });
    expect(rt?.type).toBe("bag_space_at_least");
  });

  it("round-trips task_completed to editor", () => {
    const ed = runtimeRequirementToEditor(project, { type: "task_completed", taskId: 100001 });
    expect(ed).toEqual({ kind: "questStatus", questId: "q1", status: "Completed" });
  });
});
