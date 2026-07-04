import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import {
  assertChoiceOptionAllowedForNpc,
  assertNodeKindAllowedForNpc,
  isCatalogEntryDisabledForNpc,
} from "../src/editor/chain-slot-guards";
import { MAP_NODE_CATALOG } from "../src/editor/node-catalog";

function dialogFixture() {
  const zoneId = "zone_g";
  const graph = createGraph({
    id: "g_g",
    kind: "map",
    maps: [{ id: zoneId, name: "Z", npcUid: "chain_1", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: "entry", kind: "npcEntry", mapId: zoneId, npcUid: "chain_1", position: { x: 0, y: 0 } }),
      createNode({ id: "exit", kind: "npcExit", mapId: zoneId, npcUid: "chain_1", position: { x: 200, y: 0 } }),
    ],
  });
  const gameMap = {
    id: "gm_g",
    mapCode: "g",
    mapId: 1,
    graphId: graph.id,
    tileSize: 48,
    ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    npcs: [
      {
        npcUid: "chain_1",
        npcName: "对话",
        zoneId,
        entryNodeId: "entry",
        exitNodeId: "exit",
        chainSlotKind: "dialog" as const,
        x: 192,
        y: 192,
      },
    ],
  };
  const project = {
    variables: [],
    quests: [],
    graphs: [graph],
    gameMaps: [gameMap],
    resources: {},
  };
  return { project: project as any, graph, gameMap: gameMap as any };
}

describe("chain-slot-guards", () => {
  it("blocks battle node on dialog slot", () => {
    const { project, graph, gameMap } = dialogFixture();
    const r = assertNodeKindAllowedForNpc(project, graph, gameMap, "chain_1", "battle");
    expect(r.ok).toBe(false);
  });

  it("blocks start_battle option on dialog slot", () => {
    const { project, graph, gameMap } = dialogFixture();
    const r = assertChoiceOptionAllowedForNpc(project, graph, gameMap, "chain_1", {
      forcedResult: "start_battle",
      text: "开战",
    });
    expect(r.ok).toBe(false);
  });

  it("disables combat catalog on dialog slot", () => {
    const { project, graph, gameMap } = dialogFixture();
    const battleEntry = MAP_NODE_CATALOG.find((e) => e.kind === "battle")!;
    expect(isCatalogEntryDisabledForNpc(project, graph, gameMap, "chain_1", battleEntry)).toBe(true);
  });

  it("allows dialog node on dialog slot", () => {
    const { project, graph, gameMap } = dialogFixture();
    const r = assertNodeKindAllowedForNpc(project, graph, gameMap, "chain_1", "dialog");
    expect(r.ok).toBe(true);
  });
});
