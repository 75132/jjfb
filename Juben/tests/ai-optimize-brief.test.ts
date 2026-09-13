import { describe, expect, it } from "vitest";
import { buildOptimizeBriefFromExisting } from "../src/editor/ai/ai-optimize-brief";

describe("buildOptimizeBriefFromExisting", () => {
  it("uses patch mode and lists existing nodes", () => {
    const brief = buildOptimizeBriefFromExisting(
      [
        { id: "n1", kind: "dialog", title: "报到" },
        { id: "n2", kind: "choice", title: "接取" },
      ],
      { focusNpcUid: "task_1", selectedNodeIds: ["n2"] },
    );
    expect(brief.editMode).toBe("patch");
    expect(brief.targetNodeIds).toEqual(["n2"]);
    expect(brief.constraints).toContain("optimizeExistingChain");
    expect(brief.constraints?.some((c) => c.startsWith("existing:n1:"))).toBe(true);
  });
});
