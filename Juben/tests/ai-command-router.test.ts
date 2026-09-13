import { describe, expect, it } from "vitest";
import { buildBriefForCommand, routeAiCommand, shouldAutoExecuteCommand } from "../src/editor/ai/ai-command-router";

describe("ai-command-router", () => {
  it("routes patch for local edit on existing chain", () => {
    expect(
      routeAiCommand({
        text: "把韩诺第一段对白改轻松点",
        isTimeline: false,
        hasExistingChain: true,
        hasSelectedNodes: false,
      }),
    ).toBe("patch");
  });

  it("routes repair for chain fix keywords", () => {
    expect(
      routeAiCommand({
        text: "修复链条补连线",
        isTimeline: false,
        hasExistingChain: true,
        hasSelectedNodes: false,
      }),
    ).toBe("repair");
  });

  it("routes patch when nodes are selected", () => {
    expect(
      routeAiCommand({
        text: "语气再硬一点",
        isTimeline: false,
        hasExistingChain: false,
        hasSelectedNodes: true,
      }),
    ).toBe("patch");
  });

  it("buildBriefForCommand patch uses user hint as storyGoal", () => {
    const brief = buildBriefForCommand({
      text: "标题改成前哨清剿",
      kind: "patch",
      patchNodes: [{ id: "n1", kind: "dialog", title: "报到" }],
      selectedNodeIds: ["n1"],
    });
    expect(brief?.storyGoal).toBe("标题改成前哨清剿");
    expect(brief?.editMode).toBe("patch");
    expect(brief?.targetNodeIds).toEqual(["n1"]);
  });

  it("shouldAutoExecuteCommand for patch and repair", () => {
    expect(shouldAutoExecuteCommand("patch")).toBe(true);
    expect(shouldAutoExecuteCommand("chat")).toBe(false);
  });
});
