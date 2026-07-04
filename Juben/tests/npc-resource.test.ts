import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { exportGameMapToRuntime, resolveNpcPrefabKey } from "../src/editor/map-export";

describe("resolveNpcPrefabKey", () => {
  it("uses map override then resource image", () => {
    const npc = {
      npcUid: "npc_a",
      npcName: "A",
      npcResourceId: "npc_a",
      prefabKey: "",
      x: 0,
      y: 0,
      zoneId: "z",
      entryNodeId: "e",
    };
    const project = {
      variables: [],
      quests: [],
      characterAssets: [],
      graphs: [],
      resources: { npc: [{ id: "npc_a", kind: "npc" as const, name: "A", image: "prefabs/from_lib" }] },
    };
    expect(resolveNpcPrefabKey(project, { ...npc, prefabKey: "override" })).toBe("override");
    expect(resolveNpcPrefabKey(project, npc)).toBe("prefabs/from_lib");
    expect(resolveNpcPrefabKey(project, { ...npc, prefabKey: "  " })).toBe("prefabs/from_lib");
    expect(resolveNpcPrefabKey(undefined, npc)).toBeUndefined();
  });

  it("exports resolved prefab in runtime config", () => {
    const graph = createGraph({ id: "g_map", kind: "map", nodes: [] });
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
            npcName: "A",
            npcResourceId: "npc_a",
            x: 1,
            y: 2,
            zoneId: "z",
            entryNodeId: "e",
          },
        ],
      },
      graph,
      {
        variables: [],
        quests: [],
        characterAssets: [],
        graphs: [graph],
        resources: { npc: [{ id: "npc_a", kind: "npc", name: "A", image: "lib_path" }] },
      },
    );
    expect(cfg.npcs?.[0]?.prefabKey).toBe("lib_path");
  });
});
