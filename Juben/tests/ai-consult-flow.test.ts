import { describe, expect, it } from "vitest";
import {
  canStartGenerate,
  nextPhaseAfterDiscuss,
  parseBriefFromAssistantMessage,
} from "../src/editor/ai/consult-flow";

describe("ai-consult-flow", () => {
  it("does not allow generate without brief", () => {
    expect(canStartGenerate(null)).toBe(false);
  });

  it("moves to briefReady when brief present", () => {
    const content = `\`\`\`json
{"type":"requirementsBrief","storyGoal":"test","beats":[{"kind":"dialog","summary":"hi"}]}
\`\`\``;
    expect(nextPhaseAfterDiscuss(content, "discuss")).toBe("briefReady");
    expect(parseBriefFromAssistantMessage(content)?.storyGoal).toBe("test");
  });

  it("stays in discuss without brief", () => {
    expect(nextPhaseAfterDiscuss("还需要确认战斗吗？", "discuss")).toBe("discuss");
  });
});
