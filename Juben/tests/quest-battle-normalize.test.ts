import { describe, expect, it } from "vitest";
import { createGraph, createNode, getOptionTargets } from "../src/types";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { ensureBattleEnemyBranch, resolveNpcBattleChains } from "../src/editor/battle-enemy-bind";
import { wireMultiEnemyBattleChain } from "../src/editor/npc-chain-presets";
import { exportGameMapToRuntimeWithMeta } from "../src/editor/map-export";
import { collectEditorExportGuards } from "../src/editor/map-export-editor-guards";
import {
  normalizeBattleChoiceOptions,
  normalizeTurnInEventDone,
  detectQuestBattleIssues,
  repairQuestBattleIssues,
  repairBattleExportReadiness,
  removeMisplacedBattleResultNodes,
} from "../src/editor/quest-battle-normalize";
import { detectMapChainIssues, repairMapChains } from "../src/editor/map-chain-repair";

describe("quest-battle-normalize", () => {
  it("sets start_battle on win option and block on lose", () => {
    const node = createNode({
      kind: "choice",
      options: [
        { id: "win", text: "胜利" },
        { id: "lose", text: "失败" },
      ],
    });
    const fixed = normalizeBattleChoiceOptions(node);
    expect(fixed).toBeGreaterThanOrEqual(1);
    expect(node.options[0]?.forcedResult).toBe("start_battle");
    expect(node.options[1]?.forcedResult).toBe("block");
    expect(node.options[1]?.completesEvent).toBe(false);
  });

  it("adds event_done on turn-in when battle is in same chain", () => {
    const zoneId = "zone_g";
    const graph = createGraph({
      id: "g1",
      kind: "map",
      maps: [{ id: zoneId, name: "G", npcUid: "npc_g", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_g", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({
          id: "bat_g",
          kind: "battle",
          mapId: zoneId,
          battleConfigId: "battle_1-50",
          position: { x: 50, y: 0 },
        }),
        createNode({
          id: "turn_in",
          kind: "questUpdate",
          mapId: zoneId,
          questId: "q1",
          questStatus: "Completed",
          position: { x: 100, y: 0 },
        }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["bat_g"];
    graph.nodes[1]!.options = [{ id: "next", text: "继续", targetNodeIds: ["turn_in"], targetNodeId: "turn_in" }];

    const gameMap = {
      id: "gm1",
      mapCode: "t",
      mapId: 1,
      graphId: graph.id,
      npcs: [{ npcUid: "npc_g", npcName: "G", zoneId, entryNodeId: "entry_g", exitNodeId: "exit_g" }],
    };

    const project = {
      variables: [],
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: "g1", taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
    };

    const fixed = normalizeTurnInEventDone(project, gameMap);
    expect(fixed).toBe(1);
    expect(graph.nodes.find((n) => n.id === "turn_in")?.requirements?.[0]).toEqual({
      kind: "eventDone",
      eventId: "npc_g_e1",
    });
  });

  it("detects legacy split battle companion", () => {
    const zoneId = "zone_x";
    const graph = createGraph({
      id: "g2",
      kind: "map",
      maps: [{ id: zoneId, name: "X", npcUid: "npc_x", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_x", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
      ],
    });

    const gameMap = {
      id: "gm2",
      mapCode: "t",
      mapId: 1,
      graphId: graph.id,
      npcs: [
        { npcUid: "npc_x", npcName: "X", zoneId, entryNodeId: "entry_x" },
        { npcUid: "npc_x_battle", npcName: "X Battle", zoneId: "zone_b", entryNodeId: "entry_b" },
      ],
    };
    const project = { variables: [], quests: [], graphs: [graph], gameMaps: [gameMap] };

    const issues = detectQuestBattleIssues(project, graph, gameMap);
    expect(issues.some((i) => i.kind === "legacy_split_battle")).toBe(true);
  });

  function setupMisplacedBattleResult() {
    const zoneId = "zone_a";
    const graph = createGraph({
      id: "g_mis",
      kind: "map",
      maps: [{ id: zoneId, name: "A", npcUid: "task_2", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_a", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_a", kind: "npcExit", mapId: zoneId, npcUid: "task_2", position: { x: 200, y: 0 } }),
      ],
    });
    const misplaced = createNode({
      id: "bad_choice",
      kind: "choice",
      title: "战斗结果",
      mapId: zoneId,
      options: [
        { id: "opt_win", text: "继续推进。", completesEvent: true, targetNodeIds: ["exit_a"], targetNodeId: "exit_a" },
        { id: "opt_lose", text: "重新挑战。", completesEvent: false, forcedResult: "block" },
      ],
      position: { x: 100, y: 100 },
    });
    graph.nodes.push(misplaced);
    graph.nodes[0]!.options[0]!.targetNodeIds = [misplaced.id];

    const gameMap = {
      id: "gm_mis",
      mapCode: "world_test",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "task_2",
          npcName: "紧急出击",
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
      resources: { npc: [{ id: "task_2", kind: "npc" as const, name: "Giver", image: "Npc_01" }] },
    };

    return { project, gameMap, graph };
  }

  it("removes misplaced 战斗结果 and provisions battle branch", () => {
    const { project, gameMap, graph } = setupMisplacedBattleResult();
    expect(detectQuestBattleIssues(project, graph, gameMap).some((i) => i.kind === "misplaced_battle_result_choice")).toBe(true);

    const report = repairQuestBattleIssues(project, graph, gameMap);
    expect(report.removedMisplacedResult).toBe(1);
    expect(report.battleBranchAdded).toBe(1);
    expect(graph.nodes.some((n) => n.id === "bad_choice")).toBe(false);
    expect(getOptionTargets(graph.nodes[0]!.options[0]!)).toContain("exit_a");

    const after = detectQuestBattleIssues(project, graph, gameMap);
    expect(after.some((i) => i.kind === "misplaced_battle_result_choice")).toBe(false);
    expect(after.some((i) => i.kind === "missing_battle_enemy_export")).toBe(false);
  });

  it("repairMapChains clears misplaced battle result via global repair path", () => {
    const { project, gameMap, graph } = setupMisplacedBattleResult();
    const result = repairMapChains(project, graph, gameMap);
    expect(result.battleLayoutRepaired).toBeGreaterThan(0);

    const chainIssues = detectMapChainIssues(project, graph, gameMap);
    expect(chainIssues.some((i) => i.kind === "misplaced_battle_result_choice")).toBe(false);

    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    const guards = collectEditorExportGuards(project, gameMap, graph, config, foldWarnings);
    expect(guards.filter((g) => g.level === "error")).toEqual([]);
    expect(config.npcs?.some((n) => n.npcUid === "task_2_enemy")).toBe(true);
  });

  it("removeMisplacedBattleResultNodes rewires to continue target", () => {
    const { gameMap, graph } = setupMisplacedBattleResult();
    const removed = removeMisplacedBattleResultNodes(graph, gameMap, "task_2");
    expect(removed).toBe(1);
    expect(getOptionTargets(graph.nodes[0]!.options[0]!)).toEqual(["exit_a"]);
  });

  it("does not add battle branch to pure dialog chain and strips orphan side branch", () => {
    const zoneId = "zone_d";
    const graph = createGraph({
      id: "gd",
      kind: "map",
      maps: [{ id: zoneId, name: "D", npcUid: "dlg_1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_d", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({
          id: "talk_d",
          kind: "dialog",
          mapId: zoneId,
          title: "寒暄",
          position: { x: 80, y: 0 },
        }),
        createNode({ id: "exit_d", kind: "npcExit", mapId: zoneId, npcUid: "dlg_1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["talk_d"];
    graph.nodes[1]!.options[0]!.targetNodeIds = ["exit_d"];

    const gameMap = {
      id: "gm_d",
      mapCode: "d",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "dlg_1",
          npcName: "教官",
          zoneId,
          entryNodeId: "entry_d",
          exitNodeId: "exit_d",
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
      resources: { npc: [{ id: "dlg_1", kind: "npc" as const, name: "教官", image: "Npc_01" }] },
    };

    ensureBattleEnemyBranch(project as any, gameMap as any, "dlg_1");
    expect(graph.nodes.some((n) => n.title === "敌人出现")).toBe(true);

    const report = repairQuestBattleIssues(project as any, graph, gameMap as any);
    expect(report.battleBranchDetached).toBeGreaterThanOrEqual(1);
    expect(report.battleBranchAdded).toBe(0);
    expect(graph.nodes.some((n) => n.title === "敌人出现")).toBe(false);
  });

  it("repairBattleExportReadiness syncs multi-enemy turn-in event_done", () => {
    const zoneId = "zone_m";
    const graph = createGraph({
      id: "gm",
      kind: "map",
      maps: [{ id: zoneId, name: "M", npcUid: "giver", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_m", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_m", kind: "npcExit", mapId: zoneId, npcUid: "giver", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_m"];

    const gameMap = {
      id: "gm_m",
      mapCode: "m",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "giver",
          npcName: "教官",
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
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: {
        npc: [
          { id: "giver", kind: "npc" as const, name: "Giver", image: "Npc/Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project as any, gameMap as any, gameMap.npcs[0]!, { enemyCount: 2 });

    const turnInBefore = graph.nodes.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
    turnInBefore!.requirements = [{ kind: "eventDone", eventId: "wrong_only_one" }];

    const fix = repairBattleExportReadiness(project as any, graph, gameMap as any);
    expect(fix.battleExportTurnInSynced).toBeGreaterThanOrEqual(1);
    expect(turnInBefore?.requirements?.filter((r) => r.kind === "eventDone")).toHaveLength(2);

    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap as any, graph, project as any);
    const guards = collectEditorExportGuards(project as any, gameMap as any, graph, config, foldWarnings);
    expect(guards.some((g) => g.message.includes("event_done") && g.level === "error")).toBe(false);
  });

  it("repairBattleExportReadiness fixes duplicate multi-enemy spawnUid and export guards", () => {
    const zoneId = "zone_dup";
    const graph = createGraph({
      id: "gm_dup",
      kind: "map",
      maps: [{ id: zoneId, name: "M", npcUid: "chain_2", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_d", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_d", kind: "npcExit", mapId: zoneId, npcUid: "chain_2", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_d"];

    const gameMap = {
      id: "gm_dup",
      mapCode: "dup",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "chain_2",
          npcName: "战斗链",
          zoneId,
          entryNodeId: "entry_d",
          exitNodeId: "exit_d",
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
          { id: "chain_2", kind: "npc" as const, name: "Giver", image: "Npc/Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project as any, gameMap as any, gameMap.npcs[0]!, { enemyCount: 2 });
    const chains = resolveNpcBattleChains(project as any, gameMap as any, "chain_2", graph);
    expect(chains.length).toBeGreaterThanOrEqual(2);
    for (const bind of chains) {
      const appear = graph.nodes.find((n) => n.id === bind.enemyAppearNodeId);
      const step = appear?.actions?.find((a) => a.kind === "spawnNpc");
      if (step && step.kind === "spawnNpc") step.npcUid = "chain_2_enemy";
    }

    const turnIn = graph.nodes.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
    turnIn!.requirements = [{ kind: "eventDone", eventId: "chain_2_enemy_e2" }];

    const fix = repairBattleExportReadiness(project as any, graph, gameMap as any);
    expect(fix.battleExportSpawnFixed + fix.battleExportTurnInSynced).toBeGreaterThan(0);
    expect(turnIn?.requirements?.filter((r) => r.kind === "eventDone")).toHaveLength(2);

    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap as any, graph, project as any);
    const guards = collectEditorExportGuards(project as any, gameMap as any, graph, config, foldWarnings);
    expect(guards.some((g) => g.message.includes("未导出到 runtime"))).toBe(false);
    expect(guards.some((g) => g.message.includes("event_done") && g.level === "error")).toBe(false);
  });
});
