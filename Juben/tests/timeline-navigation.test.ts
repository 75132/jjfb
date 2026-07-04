import { describe, expect, it } from "vitest";
import { createGraph } from "../src/types";
import type { ProjectData } from "../src/types";
import { createMapPortalWithGameMap, migrateToTimeline, syncQuestsFromTimeline } from "../src/editor/timeline-logic";
import { getMapAncestors, getTimelineGraph } from "../src/editor/map-tree";
import { createChildGameMap } from "../src/editor/map-tree";

function emptyProject(): ProjectData {
  return {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [
      createGraph({
        id: "g_map",
        kind: "map",
        name: "根地图",
        nodes: [],
      }),
    ],
    gameMaps: [
      {
        id: "gm_root",
        mapCode: "root",
        mapId: 1,
        mapName: "根地图",
        graphId: "g_map",
        tileSize: 48,
        npcs: [],
      },
    ],
  };
}

describe("timeline navigation data", () => {
  it("migrateToTimeline creates mapPortal for existing gameMaps", () => {
    const p = emptyProject();
    migrateToTimeline(p);
    const tl = getTimelineGraph(p);
    expect(tl?.kind).toBe("timeline");
    expect(tl?.nodes.some((n) => n.kind === "mapPortal")).toBe(true);
    expect(p.timelineGraphId).toBeTruthy();
  });

  it("createMapPortalWithGameMap links quest metadata", () => {
    const p = emptyProject();
    migrateToTimeline(p);
    const { portal, gameMap } = createMapPortalWithGameMap(p, { title: "第二章" });
    expect(portal.kind).toBe("mapPortal");
    expect(portal.gameMapId).toBe(gameMap.id);
    syncQuestsFromTimeline(p);
    expect(p.quests.some((q) => q.name === "第二章")).toBe(true);
  });

  it("child maps build ancestor chain", () => {
    const p = emptyProject();
    migrateToTimeline(p);
    const { gameMap: child } = createChildGameMap(p, "gm_root", { mapName: "实验室" });
    const { gameMap: room } = createChildGameMap(p, child.id, { mapName: "小房间" });
    const chain = getMapAncestors(p, room.id);
    expect(chain.map((m) => m.id)).toEqual(["gm_root", child.id, room.id]);
  });
});
