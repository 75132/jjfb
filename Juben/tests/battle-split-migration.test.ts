import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  mergeSplitBattleCompanion,
  migrateQuestBattlePatterns,
} from "../src/editor/battle-split-migration";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";

describe("battle-split-migration", () => {
  it("merges split _battle companion back into giver chain", () => {
    const zoneG = "zone_g";
    const zoneB = "zone_b";
    const graph = createGraph({
      id: "g_m",
      kind: "map",
      maps: [
        { id: zoneG, name: "G", npcUid: "npc_g", x: 0, y: 0, width: 400, height: 300 },
        { id: zoneB, name: "B", npcUid: "npc_g_battle", x: 0, y: 400, width: 400, height: 300 },
      ],
      nodes: [
        createNode({ id: "entry_g", kind: "npcEntry", mapId: zoneG, position: { x: 0, y: 0 } }),
        createNode({
          id: "turn_m",
          kind: "questUpdate",
          mapId: zoneG,
          questId: "q_m",
          questStatus: "Completed",
          position: { x: 160, y: 0 },
        }),
        createNode({ id: "exit_g", kind: "npcExit", mapId: zoneG, npcUid: "npc_g", position: { x: 240, y: 0 } }),
        createNode({ id: "entry_b", kind: "npcEntry", mapId: zoneB, position: { x: 0, y: 0 } }),
        createNode({
          id: "bat_m",
          kind: "battle",
          mapId: zoneB,
          battleConfigId: "battle_1-50",
          position: { x: 80, y: 0 },
        }),
        createNode({ id: "exit_b", kind: "npcExit", mapId: zoneB, npcUid: "npc_g_battle", position: { x: 160, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["turn_m"];
    graph.nodes[2]!.options = [{ id: "out", text: "结束", targetNodeIds: ["exit_g"], targetNodeId: "exit_g" }];
    graph.nodes[3]!.options[0]!.targetNodeIds = ["bat_m"];
    graph.nodes[4]!.options = [{ id: "next", text: "继续", targetNodeIds: ["exit_b"], targetNodeId: "exit_b" }];

    const gameMap = {
      id: "gm_m",
      mapCode: "test_m",
      mapId: 9,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "npc_g",
          npcName: "Giver",
          zoneId: zoneG,
          entryNodeId: "entry_g",
          exitNodeId: "exit_g",
          x: 192,
          y: 192,
        },
        {
          npcUid: "npc_g_battle",
          npcName: "Battle",
          zoneId: zoneB,
          entryNodeId: "entry_b",
          exitNodeId: "exit_b",
          x: 192,
          y: 672,
        },
      ],
    };

    const project = {
      variables: [],
      quests: [{ id: "q_m", name: "Quest", initialStatus: "NotStarted" as const, graphId: "g_m", taskId: 100002 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: { npc: [{ id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc_01" }] },
    };

    const ok = mergeSplitBattleCompanion(project, gameMap, "npc_g_battle");
    expect(ok).toBe(true);
    expect(gameMap.npcs.some((n) => n.npcUid === "npc_g_battle")).toBe(false);
    expect(graph.nodes.find((n) => n.id === "bat_m")?.mapId).toBe(zoneG);
  });

  it("migrateQuestBattlePatterns merges split companions without creating new splits", () => {
    const zoneG = "zone_g2";
    const zoneB = "zone_b2";
    const graph = createGraph({
      id: "g2",
      kind: "map",
      maps: [
        { id: zoneG, name: "G", npcUid: "npc_x", x: 0, y: 0, width: 400, height: 300 },
        { id: zoneB, name: "B", npcUid: "npc_x_battle", x: 0, y: 400, width: 400, height: 300 },
      ],
      nodes: [
        createNode({ id: "entry_x", kind: "npcEntry", mapId: zoneG, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_x", kind: "npcExit", mapId: zoneG, npcUid: "npc_x", position: { x: 100, y: 0 } }),
        createNode({ id: "entry_xb", kind: "npcEntry", mapId: zoneB, position: { x: 0, y: 0 } }),
        createNode({ id: "bat_x", kind: "battle", mapId: zoneB, battleConfigId: "battle_1-50", position: { x: 80, y: 0 } }),
        createNode({ id: "exit_xb", kind: "npcExit", mapId: zoneB, npcUid: "npc_x_battle", position: { x: 160, y: 0 } }),
      ],
    });
    graph.nodes[3]!.options[0]!.targetNodeIds = ["bat_x"];
    graph.nodes[4]!.options = [{ id: "n", text: "继续", targetNodeIds: ["exit_xb"] }];

    const gameMap = {
      id: "gm2",
      mapCode: "t",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        { npcUid: "npc_x", npcName: "X", zoneId: zoneG, entryNodeId: "entry_x", exitNodeId: "exit_x", x: 96, y: 96 },
        {
          npcUid: "npc_x_battle",
          npcName: "X Battle",
          zoneId: zoneB,
          entryNodeId: "entry_xb",
          exitNodeId: "exit_xb",
          x: 96,
          y: 576,
        },
      ],
    };
    const project = {
      variables: [],
      quests: [],
      graphs: [graph],
      gameMaps: [gameMap],
    };

    const report = migrateQuestBattlePatterns(project, gameMap);
    expect(report.migrated).toBe(1);
    expect(gameMap.npcs.some((n) => n.npcUid.endsWith("_battle"))).toBe(false);

    const report2 = migrateQuestBattlePatterns(project, gameMap);
    expect(report2.migrated).toBe(0);
  });
});
