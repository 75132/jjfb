import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { exportGameMapToRuntime } from "../src/editor/map-export";

describe("map-export parity", () => {
  it("exports choice task effects and allowedChoiceIds", () => {
    const entryId = "entry_lead";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      maps: [{ id: "zone_lead", name: "引导", npcUid: "lead_01", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "lead_01",
          mapId: "zone_lead",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "开始", targetNodeId: "ch1" }],
        }),
        createNode({
          id: "ch1",
          kind: "choice",
          title: "是否加入",
          mapId: "zone_lead",
          position: { x: 100, y: 0 },
          options: [
            {
              id: "yes",
              text: "加入",
              completesEvent: true,
              effectTaskAccept: 100001,
              targetNodeId: "t1",
            },
            { id: "no", text: "拒绝", completesEvent: false, forcedResult: "block" },
          ],
        }),
        createNode({
          id: "t1",
          kind: "questUpdate",
          questId: "100001",
          questStatus: "Completed",
          mapId: "zone_lead",
          position: { x: 200, y: 0 },
          options: [],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["ch1"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "lead_01",
            npcName: "引导员",
            x: 100,
            y: 100,
            zoneId: "zone_lead",
            entryNodeId: entryId,
          },
        ],
        tasks: [{ taskId: 100001, taskName: "报到", mainlineStep: 1 }],
      },
      graph,
    );

    const choiceEv = cfg.npcs?.[0]?.events?.find((e) => e.eventType === "choice");
    expect(choiceEv?.server?.allowedChoiceIds).toEqual(["yes"]);
    expect(choiceEv?.server?.effects).toEqual(
      expect.arrayContaining([{ action: "task_accept", taskId: 100001, choiceId: "yes" }]),
    );
    const taskEv = cfg.npcs?.[0]?.events?.find((e) => e.eventType === "task");
    expect(taskEv?.server?.effects).toEqual(expect.arrayContaining([{ action: "task_complete", taskId: 100001 }]));
  });

  it("exports teleport event from choice option", () => {
    const entryId = "entry_g";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "gate",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "go", targetNodeId: "tp1" }],
        }),
        createNode({
          id: "tp1",
          kind: "choice",
          title: "传送",
          position: { x: 100, y: 0 },
          options: [
            {
              id: "go",
              text: "出发",
              forcedResult: "teleport",
              teleportToMapId: 2,
              teleportX: 96,
              teleportY: 144,
              effectTaskAccept: 100006,
              effectTaskComplete: 100006,
            },
          ],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["tp1"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "gate",
            npcName: "传送员",
            x: 0,
            y: 0,
            zoneId: "zone_gate",
            entryNodeId: entryId,
          },
        ],
        tasks: [{ taskId: 100006, taskName: "前往", mainlineStep: 6 }],
      },
      graph,
    );

    const tpEv = cfg.npcs?.[0]?.events?.find((e) => e.eventType === "teleport");
    expect(tpEv).toBeTruthy();
    expect(tpEv?.server?.effects).toEqual(
      expect.arrayContaining([{ action: "teleport", toMapId: 2, toX: 96, toY: 144, choiceId: "go" }]),
    );
  });

  it("exports reveal_npc from action node", () => {
    const entryId = "entry_a";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "a",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "go", targetNodeId: "act1" }],
        }),
        createNode({
          id: "act1",
          kind: "action",
          title: "显现博士",
          text: "博士出现了",
          position: { x: 80, y: 0 },
          actions: [{ kind: "revealNpc", npcUid: "doctor" }],
          options: [],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["act1"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "a",
            npcName: "A",
            x: 0,
            y: 0,
            zoneId: "z_a",
            entryNodeId: entryId,
          },
          {
            npcUid: "doctor",
            npcName: "博士",
            x: 100,
            y: 0,
            zoneId: "z_doc",
            entryNodeId: "entry_doc",
            initialHidden: true,
          },
        ],
      },
      graph,
    );

    const taskEv = cfg.npcs?.[0]?.events?.[0];
    expect(taskEv?.eventType).toBe("task");
    expect(taskEv?.server?.effects).toEqual(expect.arrayContaining([{ action: "reveal_npc", npcUid: "doctor" }]));
    expect(cfg.npcs?.[1]?.initialHidden).toBe(true);
  });

  it("exports spawn_npc from action node", () => {
    const entryId = "entry_a";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "a",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "go", targetNodeId: "act1" }],
        }),
        createNode({
          id: "act1",
          kind: "action",
          title: "召唤",
          position: { x: 80, y: 0 },
          actions: [{ kind: "spawnNpc", npcUid: "ghost", npcName: "幽灵", x: 200, y: 100 }],
          options: [],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["act1"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "a",
            npcName: "A",
            x: 0,
            y: 0,
            zoneId: "z_a",
            entryNodeId: entryId,
          },
        ],
      },
      graph,
    );

    const ev = cfg.npcs?.[0]?.events?.[0];
    expect(ev?.server?.effects).toEqual(
      expect.arrayContaining([{ action: "spawn_npc", npcUid: "ghost", npcName: "幽灵", x: 200, y: 100 }]),
    );
  });

  it("exports tasks[] for current map graph only", () => {
    const graph = createGraph({ id: "g_map", kind: "map", nodes: [] });
    const otherGraph = createGraph({ id: "g_other", kind: "map", nodes: [] });
    const project = {
      variables: [],
      quests: [
        {
          id: "q1",
          name: "报到",
          initialStatus: "NotStarted" as const,
          graphId: graph.id,
          taskId: 100001,
          sortOrder: 0,
          mainlineStep: 1,
        },
        {
          id: "q2",
          name: "博士战",
          initialStatus: "NotStarted" as const,
          graphId: otherGraph.id,
          taskId: 100002,
          sortOrder: 1,
          mainlineStep: 2,
        },
      ],
      characterAssets: [],
      graphs: [graph, otherGraph],
      gameMaps: [],
      resources: {},
    };
    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [],
        tasks: [{ taskId: 999999, taskName: "旧地图任务", mainlineStep: 99 }],
      },
      graph,
      project,
    );
    expect(cfg.tasks).toEqual([{ taskId: 100001, taskName: "报到", mainlineStep: 1 }]);
  });

  it("exports text-only defer phrase without explicit flags", () => {
    const entryId = "entry_d";
    const graph = createGraph({
      id: "g_map",
      kind: "map",
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "lead_02",
          position: { x: 0, y: 0 },
          options: [{ id: "o0", text: "开始", targetNodeId: "ch2" }],
        }),
        createNode({
          id: "ch2",
          kind: "choice",
          title: "是否出发",
          position: { x: 100, y: 0 },
          options: [
            { id: "go", text: "出发", effectTaskAccept: 100002 },
            { id: "wait", text: "稍后再说" },
          ],
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["ch2"];

    const cfg = exportGameMapToRuntime(
      {
        id: "gm2",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "lead_02",
            npcName: "引导员",
            x: 0,
            y: 0,
            zoneId: "zone_lead",
            entryNodeId: entryId,
          },
        ],
        tasks: [{ taskId: 100002, taskName: "出发", mainlineStep: 2 }],
      },
      graph,
    );

    const choiceEv = cfg.npcs?.[0]?.events?.find((e) => e.eventType === "choice");
    expect(choiceEv?.server?.allowedChoiceIds).toEqual(["go"]);
    const sid = choiceEv?.client?.choiceScriptId ?? "";
    const waitOpt = cfg.client?.choiceScripts?.[sid]?.options?.find((o) => o.id === "wait");
    expect(waitOpt?.completesEvent).toBe(false);
    expect(waitOpt?.forcedResult).toBe("block");
  });
});
