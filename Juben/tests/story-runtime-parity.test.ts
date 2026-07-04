import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  fixRuntimeMapDeferContracts,
  shouldRuntimeCompleteChoice,
  summarizeExportedChoiceEvents,
} from "../src/editor/choice-option-defer";
import { exportGameMapToRuntime } from "../src/editor/map-export";
import type { RuntimeMapConfig } from "../src/editor/map-runtime";

describe("story-runtime-parity", () => {
  it("shouldRuntimeCompleteChoice mirrors defer contract", () => {
    expect(shouldRuntimeCompleteChoice({ id: "a", completesEvent: false }, ["a"])).toBe(false);
    expect(shouldRuntimeCompleteChoice({ id: "a", forcedResult: "block" }, ["a"])).toBe(false);
    expect(shouldRuntimeCompleteChoice({ id: "a", completesEvent: true }, ["b"])).toBe(false);
    expect(shouldRuntimeCompleteChoice({ id: "a", completesEvent: true }, ["a"])).toBe(true);
  });

  it("exports text-only 暂缓 as block and excludes from allowedChoiceIds", () => {
    const entryId = "entry_q";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "npc_q",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "go", targetNodeId: "ch_defer" }],
        }),
        createNode({
          id: "ch_defer",
          kind: "choice",
          title: "接取",
          position: { x: 100, y: 0 },
          options: [
            { id: "yes", text: "接受任务", effectTaskAccept: 100001 },
            { id: "no", text: "暂缓，我还没准备好" },
          ],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["ch_defer"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 0,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "npc_q",
            npcName: "任务官",
            x: 0,
            y: 0,
            zoneId: "z_q",
            entryNodeId: entryId,
          },
        ],
        tasks: [{ taskId: 100001, taskName: "测试", mainlineStep: 1 }],
      },
      graph,
    );

    const choiceEv = cfg.npcs?.[0]?.events?.find((e) => e.eventType === "choice");
    expect(choiceEv?.server?.allowedChoiceIds).toEqual(["yes"]);
    const sid = choiceEv?.client?.choiceScriptId ?? "";
    const noOpt = cfg.client?.choiceScripts?.[sid]?.options?.find((o) => o.id === "no");
    expect(noOpt?.completesEvent).toBe(false);
    expect(noOpt?.forcedResult).toBe("block");
    expect(choiceEv?.server?.effects?.some((e) => e.choiceId === "no")).toBe(false);
  });

  it("fixRuntimeMapDeferContracts patches defer detected by systemTip", () => {
    const stale: RuntimeMapConfig = {
      mapId: 1,
      mapCode: "stale_tip",
      client: {
        choiceScripts: {
          ch_tip: {
            options: [
              { id: "yes", text: "接受", completesEvent: true },
              {
                id: "no",
                text: "现在不是时候。",
                systemTip: "任务不会推进。",
                completesEvent: true,
              },
            ],
          },
        },
      },
      npcs: [
        {
          npcUid: "giver",
          events: [
            {
              eventType: "choice",
              eventId: 1,
              client: { choiceScriptId: "ch_tip" },
              server: {
                allowedChoiceIds: ["yes", "no"],
                effects: [{ action: "task_accept", taskId: 100001, choiceId: "no" }],
              },
            },
          ],
        },
      ],
    };
    fixRuntimeMapDeferContracts(stale);
    expect(stale.npcs?.[0]?.events?.[0]?.server?.allowedChoiceIds).toEqual(["yes"]);
    expect(stale.client?.choiceScripts?.ch_tip?.options?.[1]?.completesEvent).toBe(false);
  });

  it("fixRuntimeMapDeferContracts patches stale published JSON", () => {
    const stale: RuntimeMapConfig = {
      mapId: 0,
      mapCode: "stale",
      client: {
        choiceScripts: {
          ch1: {
            options: [
              { id: "yes", text: "接受", completesEvent: true },
              { id: "no", text: "暂缓", completesEvent: true },
            ],
          },
        },
      },
      npcs: [
        {
          npcUid: "giver",
          events: [
            {
              eventType: "choice",
              eventId: 1,
              client: { choiceScriptId: "ch1" },
              server: {
                allowedChoiceIds: ["yes", "no"],
                effects: [
                  { action: "task_accept", taskId: 100001, choiceId: "yes" },
                  { action: "task_accept", taskId: 100001, choiceId: "no" },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = fixRuntimeMapDeferContracts(stale);
    expect(result.optionsFixed).toBeGreaterThan(0);
    expect(stale.npcs?.[0]?.events?.[0]?.server?.allowedChoiceIds).toEqual(["yes"]);
    const noOpt = stale.client?.choiceScripts?.ch1?.options?.[1];
    expect(noOpt?.completesEvent).toBe(false);
    expect(noOpt?.forcedResult).toBe("block");
    expect(stale.npcs?.[0]?.events?.[0]?.server?.effects?.some((e) => e.choiceId === "no")).toBe(false);

    const summary = summarizeExportedChoiceEvents(stale);
    expect(summary[0]?.options.some((l) => l.startsWith("暂缓"))).toBe(true);
  });
});
