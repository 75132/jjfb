import { describe, expect, it } from "vitest";
import { formatMapRuntimeReport, normalizeMapConfig, validateMapConfig } from "../src/editor/map-runtime";

const minimalValid = {
  configVersion: "1.0.1",
  mapCode: "test_base",
  tasks: [{ taskId: 100001, taskName: "志愿者报到", mainlineStep: 1 }],
  client: {
    dialogueScripts: {
      dlg_intro: { speaker: "韩诺", lines: ["你好"] },
    },
    choiceScripts: {
      choice_yes_no: {
        title: "加入？",
        options: [
          { id: "yes", text: "是", completesEvent: true },
          { id: "no", text: "否", completesEvent: false, forcedResult: "block" },
        ],
      },
    },
  },
  npcs: [
    {
      npcUid: "0_lead_01",
      events: [
        {
          eventId: "e1",
          eventType: "dialog",
          order: 1,
          client: { dialogueScriptId: "dlg_intro" },
        },
        {
          eventId: "e2",
          eventType: "choice",
          order: 2,
          server: { allowedChoiceIds: ["yes"], effects: [] },
          client: { choiceScriptId: "choice_yes_no" },
        },
      ],
    },
  ],
};

describe("map-runtime", () => {
  it("normalizes quests to tasks", () => {
    const cfg = normalizeMapConfig({
      mapCode: "x",
      quests: [{ taskId: 1, taskName: "a" }],
    });
    expect(cfg?.tasks?.[0]?.taskId).toBe(1);
    expect(cfg?.quests).toBeUndefined();
  });

  it("passes valid minimal config", () => {
    const report = validateMapConfig(minimalValid);
    expect(report.ok).toBe(true);
    expect(report.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("flags missing battleRef", () => {
    const report = validateMapConfig({
      ...minimalValid,
      npcs: [
        {
          npcUid: "n1",
          events: [{ eventId: "b1", eventType: "battle", order: 1, server: {} }],
        },
      ],
    });
    expect(report.ok).toBe(false);
    expect(formatMapRuntimeReport(report)).toContain("battleRef");
  });

  it("flags completesEvent=false in allowedChoiceIds", () => {
    const report = validateMapConfig({
      ...minimalValid,
      npcs: [
        {
          npcUid: "n1",
          events: [
            {
              eventId: "e2",
              eventType: "choice",
              order: 1,
              server: { allowedChoiceIds: ["no"] },
              client: { choiceScriptId: "choice_yes_no" },
            },
          ],
        },
      ],
    });
    expect(report.ok).toBe(false);
  });
});
