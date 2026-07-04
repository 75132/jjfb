import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { exportGameMapToRuntimeWithMeta } from "../src/editor/map-export";
import { exportProjectMapPipeline } from "../src/editor/map-export-pipeline";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";

describe("map-export-nodes", () => {
  const zoneId = "zone_a";
  const entryId = "entry_a";
  const graph = createGraph({
    id: "g1",
    kind: "map",
    maps: [{ id: zoneId, name: "A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: entryId, kind: "npcEntry", npcUid: "npc_a", mapId: zoneId, position: { x: 0, y: 0 } }),
      createNode({
        id: "cond1",
        kind: "condition",
        mapId: zoneId,
        requirements: [{ kind: "questStatus", questId: "q1", status: "Completed" }],
        options: [{ id: "ok", text: "ok", targetNodeId: "dlg1", targetNodeIds: ["dlg1"] }],
        position: { x: 100, y: 0 },
      }),
      createNode({
        id: "dlg1",
        kind: "dialog",
        mapId: zoneId,
        dialogLines: [{ id: "l1", text: "hi" }],
        position: { x: 200, y: 0 },
      }),
      createNode({
        id: "gain1",
        kind: "gainItem",
        mapId: zoneId,
        itemId: "potion",
        itemCount: 2,
        options: [{ id: "ok", text: "ok", targetNodeId: "dlg2", targetNodeIds: ["dlg2"] }],
        position: { x: 300, y: 0 },
      }),
      createNode({
        id: "dlg2",
        kind: "dialog",
        mapId: zoneId,
        dialogLines: [{ id: "l2", text: "bye" }],
        position: { x: 400, y: 0 },
      }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeIds = ["cond1"];
  graph.nodes[0]!.options[0]!.targetNodeId = "cond1";
  graph.nodes[2]!.options = [{ id: "next", text: "next", targetNodeId: "gain1", targetNodeIds: ["gain1"] }];
  graph.nodes[3]!.options[0]!.targetNodeIds = ["dlg2"];
  graph.nodes[3]!.options[0]!.targetNodeId = "dlg2";

  const gameMap = {
    id: "gm1",
    mapCode: "test_nodes",
    mapId: 1,
    graphId: graph.id,
    tileSize: 48,
    ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    npcs: [{ npcUid: "npc_a", npcName: "A", x: 96, y: 96, zoneId, entryNodeId: entryId }],
  };

  const project = {
    variables: [],
    quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: "g1", taskId: 100001 }],
    graphs: [graph],
  };

  it("exports gainItem as task with give_item effect", () => {
    const { config } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    const events = config.npcs?.[0]?.events ?? [];
    const gainEv = events.find((e) => e.server?.effects?.some((x) => x.action === "give_item"));
    expect(gainEv?.eventType).toBe("task");
    expect(gainEv?.server?.effects).toContainEqual(
      expect.objectContaining({ action: "give_item", itemId: "potion", count: 2 }),
    );
  });

  it("folds condition requirements into next event", () => {
    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    expect(foldWarnings.some((w) => w.nodeKind === "condition")).toBe(true);
    const dlg = config.npcs?.[0]?.events?.find((e) => e.eventType === "dialog");
    const reqs = dlg?.server?.requirements ?? [];
    expect(reqs.some((r) => (r as { type?: string }).type === "task_completed")).toBe(true);
  });

  it("pipeline warns on give_item without blocking", () => {
    const result = exportProjectMapPipeline(gameMap, graph, project);
    expect(result.ok).toBe(true);
    expect(result.manifestIssues.some((i) => i.message.includes("give_item"))).toBe(true);
  });
});
