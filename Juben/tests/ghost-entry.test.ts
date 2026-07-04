import { describe, expect, it } from "vitest";
import { getGhostEntryNodesForGraph } from "../src/editor/game-map-logic";
import { createGraph, createNode } from "../src/types";
import type { ProjectData } from "../src/types";

function miniProject(): ProjectData {
  return {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [
      createGraph({
        id: "g_main",
        kind: "mainline",
        name: "主线",
        nodes: [createNode({ id: "n1", kind: "dialog", title: "hi" })],
      }),
      createGraph({
        id: "g_q1",
        kind: "quest",
        name: "任务A",
        nodes: [createNode({ id: "qe1", kind: "questEntry", title: "入口" })],
      }),
      createGraph({
        id: "g_map",
        kind: "map",
        name: "测试基地",
        nodes: [createNode({ id: "ne1", kind: "npcEntry", title: "NPC入口", npcUid: "npc1" })],
        maps: [],
      }),
    ],
    gameMaps: [
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        tileSize: 48,
        graphId: "g_map",
        npcs: [],
        linkedGraphIds: ["g_main"],
      },
    ],
  };
}

describe("getGhostEntryNodesForGraph", () => {
  it("map canvas only mirrors linked global graphs, not all quest entries", () => {
    const p = miniProject();
    const ghosts = getGhostEntryNodesForGraph(p, "g_map");
    expect(ghosts.map((n) => n.id)).toEqual([]);
  });

  it("mainline canvas mirrors npcEntry from maps that link to it", () => {
    const p = miniProject();
    const ghosts = getGhostEntryNodesForGraph(p, "g_main");
    expect(ghosts.map((n) => n.id)).toEqual(["ne1"]);
  });
});
