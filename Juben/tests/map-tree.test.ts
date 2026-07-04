import { describe, expect, it } from "vitest";
import { createGraph } from "../src/types";
import type { ProjectData } from "../src/types";
import { buildGameMapTree, createChildGameMap, getMapChildren, getNextMapId } from "../src/editor/map-tree";

function baseProject(): ProjectData {
  return {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [createGraph({ id: "g1", kind: "map", name: "A", nodes: [] })],
    gameMaps: [{ id: "gm_a", mapCode: "a", mapId: 1, mapName: "A", graphId: "g1", tileSize: 48, npcs: [] }],
  };
}

describe("map-tree", () => {
  it("getNextMapId increments", () => {
    const p = baseProject();
    expect(getNextMapId(p)).toBe(2);
  });

  it("createChildGameMap nests under parent", () => {
    const p = baseProject();
    const { gameMap } = createChildGameMap(p, "gm_a", { mapName: "B" });
    expect(gameMap.parentGameMapId).toBe("gm_a");
    expect(getMapChildren(p, "gm_a").length).toBe(1);
  });

  it("buildGameMapTree supports unlimited depth", () => {
    const p = baseProject();
    const { gameMap: b } = createChildGameMap(p, "gm_a");
    const { gameMap: c } = createChildGameMap(p, b.id);
    const tree = buildGameMapTree(p, null);
    expect(tree.length).toBe(1);
    expect(tree[0]!.children[0]!.children[0]!.gameMap.id).toBe(c.id);
  });
});
