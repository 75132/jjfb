import { describe, expect, it } from "vitest";
import { exportGameMapToRuntime } from "../src/editor/map-export";
import { wireUnifiedBattleEncounterChain, wireMultiEnemyBattleChain } from "../src/editor/npc-chain-presets";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { createGraph, createNode } from "../src/types";

describe("map-export battle enemy", () => {
  it("exports map-interactable battle enemy NPC separate from giver", () => {
    const zoneId = "zone_a";
    const graph = createGraph({
      id: "g1",
      kind: "map",
      maps: [{ id: zoneId, name: "A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_a", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_a", kind: "npcExit", mapId: zoneId, npcUid: "npc_a", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_a"];

    const gameMap = {
      id: "gm1",
      mapCode: "t",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "npc_a",
          npcName: "任务官",
          zoneId,
          entryNodeId: "entry_a",
          exitNodeId: "exit_a",
          x: 192,
          y: 192,
        },
      ],
    };

    const project = {
      variables: [],
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: {
        npc: [
          { id: "npc_a", kind: "npc" as const, name: "Giver", image: "Npc/Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc/Npc_02" },
        ],
      },
    };

    wireUnifiedBattleEncounterChain(project, gameMap, gameMap.npcs[0]!, { battleRef: "battle_1-50" });
    const cfg = exportGameMapToRuntime(gameMap, graph, project);

    const giver = cfg.npcs.find((n) => n.npcUid === "npc_a");
    const enemy = cfg.npcs.find((n) => n.npcUid === "npc_a_enemy");
    expect(giver?.events.some((e) => e.eventType === "battle")).toBe(false);
    expect(enemy).toBeTruthy();
    expect(enemy?.x).toBeGreaterThan(0);
    expect(enemy?.prefabKey).toBeTruthy();
    expect(enemy?.appear?.requirements?.some((r) => r.type === "task_active" && r.taskId === 100001)).toBe(true);
    expect(enemy?.hideWhenComplete).toBe(true);
    expect(enemy?.events.some((e) => e.eventType === "battle")).toBe(true);

    const battleEv = enemy?.events.find((e) => e.eventType === "battle");
    expect(battleEv?.client?.choiceScriptId).toBeUndefined();
    expect(battleEv?.server?.allowedChoiceIds).toBeUndefined();
    expect(battleEv?.server?.battleRef).toBeTruthy();
    const turnIn = giver?.events.find((e) => e.server?.effects?.some((eff) => eff.action === "task_complete"));
    expect(turnIn?.server?.requirements?.some((r) => r.type === "event_done" && r.eventId === battleEv?.eventId)).toBe(
      true,
    );
  });

  it("exports N enemy NPCs with N event_done on turn-in for multi-enemy chain", () => {
    const zoneId = "zone_m";
    const graph = createGraph({
      id: "g_multi",
      kind: "map",
      maps: [{ id: zoneId, name: "M", npcUid: "npc_m", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_m", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_m", kind: "npcExit", mapId: zoneId, npcUid: "npc_m", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_m"];

    const gameMap = {
      id: "gm_multi",
      mapCode: "multi",
      mapId: 2,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "npc_m",
          npcName: "指挥官",
          zoneId,
          entryNodeId: "entry_m",
          exitNodeId: "exit_m",
          x: 192,
          y: 192,
        },
      ],
    };

    const project = {
      variables: [],
      quests: [{ id: "q_multi", name: "Multi", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 200001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: {
        npc: [
          { id: "npc_m", kind: "npc" as const, name: "Giver", image: "Npc/Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project, gameMap, gameMap.npcs[0]!, { enemyCount: 3 });
    const cfg = exportGameMapToRuntime(gameMap, graph, project);

    const enemies = (cfg.npcs ?? []).filter((n) => n.npcUid?.startsWith("npc_m_enemy"));
    expect(enemies).toHaveLength(3);
    for (const enemy of enemies) {
      expect(enemy.events?.some((e) => e.eventType === "battle")).toBe(true);
      expect(enemy.appear?.requirements?.some((r) => r.type === "task_active" && r.taskId === 200001)).toBe(true);
    }

    const giver = cfg.npcs.find((n) => n.npcUid === "npc_m");
    const turnIn = giver?.events.find((e) => e.server?.effects?.some((eff) => eff.action === "task_complete"));
    const eventDoneReqs = turnIn?.server?.requirements?.filter((r) => r.type === "event_done") ?? [];
    expect(eventDoneReqs).toHaveLength(3);
    const battleEventIds = enemies.flatMap((e) => e.events?.filter((ev) => ev.eventType === "battle").map((ev) => ev.eventId) ?? []);
    for (const req of eventDoneReqs) {
      expect(battleEventIds).toContain(req.eventId);
    }
  });

  it("uses giver chained appear (not task_active alone) for battle enemy on act 2+", () => {
    const zoneId = "zone_chain";
    const graph = createGraph({
      id: "g_chain",
      kind: "map",
      maps: [{ id: zoneId, name: "C", npcUid: "npc_c1", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_c1", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_c1", kind: "npcExit", mapId: zoneId, npcUid: "npc_c1", position: { x: 200, y: 0 } }),
        createNode({ id: "entry_c2", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 100 } }),
        createNode({ id: "exit_c2", kind: "npcExit", mapId: zoneId, npcUid: "npc_c2", position: { x: 200, y: 100 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_c1"];
    graph.nodes[2]!.options[0]!.targetNodeIds = ["exit_c2"];

    const gameMap = {
      id: "gm_chain",
      mapCode: "chain_map",
      mapId: 3,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "npc_c1",
          npcName: "第1幕",
          zoneId,
          entryNodeId: "entry_c1",
          exitNodeId: "exit_c1",
          x: 192,
          y: 192,
        },
        {
          npcUid: "npc_c2",
          npcName: "第2幕",
          zoneId,
          entryNodeId: "entry_c2",
          exitNodeId: "exit_c2",
          x: 192,
          y: 288,
          appear: {
            mode: "conditional" as const,
            matchMode: "ALL" as const,
            requirements: [{ kind: "eventDone" as const, eventId: "npc_c1_e1" }],
          },
        },
      ],
    };

    const project = {
      variables: [],
      quests: [{ id: "q_chain", name: "Chain", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 300001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: {
        npc: [
          { id: "npc_c1", kind: "npc" as const, name: "Giver1", image: "Npc/Npc_01" },
          { id: "npc_c2", kind: "npc" as const, name: "Giver2", image: "Npc/Npc_02" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc/Npc_10" },
        ],
      },
    };

    wireUnifiedBattleEncounterChain(project, gameMap, gameMap.npcs[1]!, { battleRef: "battle_1-50" });
    gameMap.npcs[1]!.appear = {
      mode: "conditional",
      matchMode: "ALL",
      requirements: [{ kind: "eventDone", eventId: "npc_c1_e1" }],
    };
    const cfg = exportGameMapToRuntime(gameMap, graph, project);

    const enemy = cfg.npcs.find((n) => n.npcUid === "npc_c2_enemy");
    expect(enemy).toBeTruthy();
    expect(enemy?.appear?.requirements).toEqual([{ type: "event_done", eventId: "npc_c1_e1" }]);
    const giverIdx = cfg.npcs.findIndex((n) => n.npcUid === "npc_c2");
    const enemyIdx = cfg.npcs.findIndex((n) => n.npcUid === "npc_c2_enemy");
    expect(enemyIdx).toBe(giverIdx + 1);
  });
});
