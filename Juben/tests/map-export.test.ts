import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { collectNpcEventChain, exportGameMapToRuntime, countIncomingEdgesToNode } from "../src/editor/map-export";
import { validateMapConfig } from "../src/editor/map-runtime";

describe("map-export", () => {
  const entryId = "entry_npc_a";
  const zoneId = "zone_npc_a";
  const graph = createGraph({
    id: "g_map_test",
    kind: "map",
    maps: [{ id: zoneId, name: "NPC A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({
        id: entryId,
        kind: "npcEntry",
        npcUid: "npc_a",
        mapId: zoneId,
        position: { x: 10, y: 10 },
      }),
      createNode({
        id: "dlg1",
        kind: "dialog",
        mapId: zoneId,
        speaker: "测试",
        dialogLines: [{ id: "l1", text: "你好" }],
        position: { x: 200, y: 10 },
      }),
      createNode({
        id: "ch1",
        kind: "choice",
        mapId: zoneId,
        title: "选择",
        options: [
          { id: "yes", text: "是", npcReply: "好" },
          { id: "no", text: "否", completesEvent: false, forcedResult: "block" },
        ],
        position: { x: 400, y: 10 },
      }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeId = "dlg1";
  graph.nodes[0]!.options[0]!.targetNodeIds = ["dlg1"];
  graph.nodes[1]!.options[0]!.targetNodeId = "ch1";
  graph.nodes[1]!.options[0]!.targetNodeIds = ["ch1"];

  it("collects event chain from npcEntry", () => {
    const chain = collectNpcEventChain(graph, entryId);
    expect(chain.map((n) => n.id)).toEqual(["dlg1", "ch1"]);
  });

  it("exports runtime map config", () => {
    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "npc_a",
            npcName: "NPC A",
            x: 192,
            y: 192,
            zoneId,
            entryNodeId: entryId,
          },
        ],
      },
      graph,
    );
    expect(cfg.mapCode).toBe("test");
    expect(cfg.npcs?.[0]?.events?.length).toBe(2);
    expect(cfg.npcs?.[0]?.events?.[0]?.eventType).toBe("dialog");
    expect(cfg.npcs?.[0]?.events?.[1]?.eventType).toBe("choice");
    expect(cfg.npcs?.[0]?.events?.[0]?.client?.endsSession).toBeUndefined();
    expect(cfg.npcs?.[0]?.events?.[1]?.client?.endsSession).toBe(true);
    const report = validateMapConfig(cfg);
    expect(report.ok).toBe(true);
  });

  it("exports chainContinuous false on successor breaks session early", () => {
    graph.nodes[2]!.chainContinuous = false;
    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "npc_a",
            npcName: "NPC A",
            x: 192,
            y: 192,
            zoneId,
            entryNodeId: entryId,
          },
        ],
      },
      graph,
    );
    const events = cfg.npcs?.[0]?.events ?? [];
    expect(events[0]?.client?.endsSession).toBe(true);
    expect(events[1]?.client?.endsSession).toBe(true);
    graph.nodes[2]!.chainContinuous = undefined;
  });

  it("exports chainContinuous: skip endsSession until chain break", () => {
    graph.nodes[2]!.chainContinuous = true;
    const cfg = exportGameMapToRuntime(
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "npc_a",
            npcName: "NPC A",
            x: 192,
            y: 192,
            zoneId,
            entryNodeId: entryId,
          },
        ],
      },
      graph,
    );
    const events = cfg.npcs?.[0]?.events ?? [];
    expect(events[0]?.client?.endsSession).toBeUndefined();
    expect(events[1]?.client?.endsSession).toBe(true);
    graph.nodes[2]!.chainContinuous = undefined;
  });

  it("counts incoming edges to entry from other graphs", () => {
    const main = createGraph({
      id: "g_main",
      kind: "mainline",
      nodes: [
        createNode({
          id: "n1",
          kind: "dialog",
          options: [{ id: "o1", text: "去", targetNodeId: entryId, targetNodeIds: [entryId] }],
        }),
      ],
    });
    expect(countIncomingEdgesToNode([main, graph], entryId)).toBe(1);
  });
});
