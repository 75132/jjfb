import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import type { ProjectData } from "../src/types";
import {
  createMapPortalWithGameMap,
  dedupeTimelinePortals,
  deleteMapPortal,
  migrateToTimeline,
  reconcileTimelineData,
  repairStaleTaskIdReferences,
} from "../src/editor/timeline-logic";
import { getTimelineGraph } from "../src/editor/map-tree";

function baseProject(): ProjectData {
  return {
    variables: [],
    quests: [],
    graphs: [
      createGraph({
        id: "g_map_a",
        kind: "map",
        name: "A",
        nodes: [],
      }),
    ],
    gameMaps: [
      {
        id: "gm_a",
        mapCode: "world_a",
        mapId: 1,
        mapName: "新大地图",
        graphId: "g_map_a",
        tileSize: 48,
        npcs: [],
      },
    ],
  };
}

describe("timeline reconcile", () => {
  it("dedupeTimelinePortals removes duplicate chapters for same gameMap", () => {
    const p = baseProject();
    migrateToTimeline(p);
    const tl = getTimelineGraph(p)!;
    const first = tl.nodes.find((n) => n.kind === "mapPortal")!;
    tl.nodes.push(
      createNode({
        id: "portal_dup",
        kind: "mapPortal",
        title: "重复章节",
        gameMapId: "gm_a",
        position: { x: 400, y: 120 },
      }),
    );
    expect(dedupeTimelinePortals(p)).toBe(1);
    expect(tl.nodes.filter((n) => n.kind === "mapPortal" && n.gameMapId === "gm_a")).toHaveLength(1);
    expect(tl.nodes.some((n) => n.id === first.id)).toBe(true);
  });

  it("deleteMapPortal without gameMap does not resurrect duplicate on migrate", () => {
    const p = baseProject();
    migrateToTimeline(p);
    const { portal, gameMap } = createMapPortalWithGameMap(p, { title: "第二章" });
    expect(getTimelineGraph(p)!.nodes.filter((n) => n.kind === "mapPortal")).toHaveLength(2);

    deleteMapPortal(p, portal.id, { deleteGameMap: false });
    expect(getTimelineGraph(p)!.nodes.filter((n) => n.kind === "mapPortal")).toHaveLength(1);
    expect(gameMap.mapPortalNodeId).toBeUndefined();

    migrateToTimeline(p);
    expect(getTimelineGraph(p)!.nodes.filter((n) => n.kind === "mapPortal")).toHaveLength(1);
  });

  it("repairStaleTaskIdReferences rewires deleted quest taskId", () => {
    const p = baseProject();
    migrateToTimeline(p);
    const graph = p.graphs.find((g) => g.id === "g_map_a")!;
    const choice = createNode({
      id: "accept",
      kind: "choice",
      mapId: "zone",
      title: "接取任务",
      options: [{ id: "yes", text: "接取", effectTaskAccept: 99999 }],
    });
    graph.nodes.push(choice);
    p.quests = [{ id: "qp_x", name: "章", initialStatus: "NotStarted", graphId: graph.id, taskId: 100002 }];

    expect(repairStaleTaskIdReferences(p)).toBeGreaterThan(0);
    expect(choice.options[0]!.effectTaskAccept).toBe(100002);
  });

  it("reconcileTimelineData fixes duplicate portals and stale task refs", () => {
    const p = baseProject();
    migrateToTimeline(p);
    const tl = getTimelineGraph(p)!;
    tl.nodes.push(
      createNode({
        id: "portal_dup2",
        kind: "mapPortal",
        title: "新大地图",
        gameMapId: "gm_a",
        position: { x: 500, y: 120 },
      }),
    );
    const graph = p.graphs.find((g) => g.id === "g_map_a")!;
    graph.nodes.push(
      createNode({
        id: "c1",
        kind: "choice",
        options: [{ id: "o1", text: "接", effectTaskAccept: 99999 }],
      }),
    );
    p.quests = [{ id: "qp_x", name: "章", initialStatus: "NotStarted", graphId: graph.id, taskId: 100002 }];

    const report = reconcileTimelineData(p);
    expect(report.removedDuplicatePortals).toBeGreaterThan(0);
    expect(report.repairedTaskRefs).toBeGreaterThan(0);
    expect(tl.nodes.filter((n) => n.kind === "mapPortal" && n.gameMapId === "gm_a")).toHaveLength(1);
  });
});
