import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { chainPortraitShortLabel, resolveChainPortraitPath } from "../src/editor/npc-chain-portrait";

describe("npc-chain-portrait", () => {
  it("uses gameMap prefabKey as chain portrait", () => {
    const project = {
      graphs: [createGraph({ id: "g1", kind: "map", nodes: [] })],
      quests: [],
      gameMaps: [
        {
          id: "gm1",
          mapCode: "t",
          mapId: 0,
          graphId: "g1",
          tileSize: 48,
          npcs: [
            {
              npcUid: "task_1",
              npcName: "博士",
              x: 0,
              y: 0,
              zoneId: "z1",
              entryNodeId: "e1",
              prefabKey: "Npc/Npc_05",
            },
          ],
        },
      ],
      variables: [],
      characterAssets: [],
      resources: { npc: [{ id: "task_1", kind: "npc" as const, name: "博士", image: "Npc/Npc_01" }] },
    };
    const npc = project.gameMaps[0]!.npcs[0]!;
    expect(resolveChainPortraitPath(project, npc)).toBe("Npc/Npc_05");
    expect(chainPortraitShortLabel(project, npc)).toBe("Npc_05");
  });
});
