import { describe, expect, it } from "vitest";
import { extractRequirementsBrief, isValidBrief, NdjsonLineParser } from "../src/editor/ai/story-stream-parser";

describe("ai-stream-parser", () => {
  it("extracts requirementsBrief from fenced json", () => {
    const text = `好的，信息够了：

\`\`\`json
{
  "type": "requirementsBrief",
  "storyGoal": "新手报到",
  "beats": [{ "kind": "dialog", "summary": "问候" }]
}
\`\`\``;
    const brief = extractRequirementsBrief(text);
    expect(brief?.type).toBe("requirementsBrief");
    expect(brief?.storyGoal).toBe("新手报到");
    expect(brief?.beats).toHaveLength(1);
  });

  it("validates brief", () => {
    expect(isValidBrief(null)).toBe(false);
    expect(isValidBrief({ type: "requirementsBrief", beats: [] })).toBe(false);
    expect(
      isValidBrief({
        type: "requirementsBrief",
        storyGoal: "x",
        beats: [],
      }),
    ).toBe(true);
  });

  it("parses NDJSON lines incrementally", () => {
    const parser = new NdjsonLineParser();
    const r1 = parser.push('{"op":"addNode","tempId":"n1","kind":"dialog"}\n');
    expect(r1.ops).toHaveLength(1);
    expect(r1.ops[0]?.op).toBe("addNode");

    const r2 = parser.push('{"op":"connect","fromTempId":"n1","to":"exit"}\n');
    expect(r2.ops).toHaveLength(1);
    expect(r2.ops[0]?.op).toBe("connect");
  });
});
