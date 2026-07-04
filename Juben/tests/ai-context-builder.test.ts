import { describe, expect, it } from "vitest";
import { buildStoryAiContext } from "../src/editor/ai/story-context-builder";
import { createGraph, createNode } from "../src/types";
import type { GameMapDef, ProjectData } from "../src/types";

describe("ai-context-builder", () => {
  it("includes npc chain summary for map mode", () => {
    const graph = createGraph({ id: "g1", kind: "map" });
    const entry = createNode({ id: "e1", kind: "npcEntry", mapId: "z1" });
    const exit = createNode({ id: "x1", kind: "npcExit", mapId: "z1" });
    graph.maps = [{ id: "z1", npcUid: "0_a_01", x: 0, y: 0, width: 200, height: 120 }];
    graph.nodes = [entry, exit];

    const gm: GameMapDef = {
      id: "gm",
      mapCode: "base",
      mapId: 0,
      mapName: "基地",
      graphId: "g1",
      tileSize: 48,
      npcs: [
        {
          npcUid: "0_a_01",
          npcName: "教官",
          x: 48,
          y: 48,
          zoneId: "z1",
          entryNodeId: "e1",
          exitNodeId: "x1",
        },
      ],
    };

    const project: ProjectData = {
      variables: [],
      quests: [],
      graphs: [graph],
      gameMaps: [gm],
    };

    const ctx = buildStoryAiContext(project, {
      target: { scope: "map", gameMapId: "gm", editMode: "append" },
    });
    expect(ctx.mapCode).toBe("base");
    expect(ctx.npcs).toHaveLength(1);
    expect(ctx.npcs![0]!.isEmptyChain).toBe(true);
    expect(ctx.npcs![0]!.x).toBe(48);
    expect(ctx.npcs![0]!.existingNodes).toHaveLength(0);
    expect(ctx.battleRefs?.length).toBeGreaterThan(0);
  });

  it("includes timeline portals and selected nodes", () => {
    const tl = createGraph({ id: "tl", kind: "timeline" });
    tl.nodes = [createNode({ id: "p1", kind: "mapPortal", title: "第一章" })];
    const project: ProjectData = {
      variables: [],
      quests: [],
      graphs: [tl],
      timelineGraphId: "tl",
      gameMaps: [],
    };

    const ctx = buildStoryAiContext(project, {
      target: { scope: "timeline" },
      selectedNodeIds: ["p1"],
    });
    expect(ctx.mode).toBe("timeline_outline");
    expect(ctx.timelinePortals).toHaveLength(1);
    expect(ctx.selectedNodeIds).toEqual(["p1"]);
  });
});
