import { describe, expect, it } from "vitest";
import { validateMapConfig } from "../src/editor/map-runtime";

describe("map-runtime-validation", () => {
  it("fails when mapCode missing", () => {
    const report = validateMapConfig({ npcs: [] });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.message.includes("mapCode"))).toBe(true);
  });

  it("fails on duplicate eventId", () => {
    const report = validateMapConfig({
      mapCode: "x",
      npcs: [
        {
          events: [
            { eventId: "a_e1", eventType: "dialog", client: { dialogueScriptId: "d1" } },
            { eventId: "a_e1", eventType: "dialog", client: { dialogueScriptId: "d2" } },
          ],
        },
      ],
      client: {
        dialogueScripts: {
          d1: { lines: ["a"] },
          d2: { lines: ["b"] },
        },
      },
    });
    expect(report.ok).toBe(false);
  });

  it("fails when dialog script missing", () => {
    const report = validateMapConfig({
      mapCode: "x",
      npcs: [{ events: [{ eventId: "a_e1", eventType: "dialog", client: { dialogueScriptId: "missing" } }] }],
      client: { dialogueScripts: {} },
    });
    expect(report.ok).toBe(false);
  });
});
