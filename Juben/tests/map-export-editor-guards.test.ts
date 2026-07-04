import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { wireUnifiedBattleEncounterChain } from "../src/editor/npc-chain-presets";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { auditProjectBattleExportBlockers, collectEditorExportGuards } from "../src/editor/map-export-editor-guards";
import { auditGameMapExportReadiness, auditProjectExportHealth, formatProjectExportHealthMessage } from "../src/editor/map-export-pipeline";
import { exportGameMapToRuntimeWithMeta } from "../src/editor/map-export";

function setupWithMisplacedBattleResult() {
  const zoneId = "zone_a";
  const graph = createGraph({
    id: "g1",
    kind: "map",
    maps: [{ id: zoneId, name: "A", npcUid: "task_2", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: "entry_a", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
      createNode({ id: "exit_a", kind: "npcExit", mapId: zoneId, npcUid: "task_2", position: { x: 200, y: 0 } }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_a"];

  const misplaced = createNode({
    id: "bad_choice",
    kind: "choice",
    title: "战斗结果",
    mapId: zoneId,
    options: [
      { id: "opt_win", text: "继续推进。", completesEvent: true },
      { id: "opt_lose", text: "重新挑战。", completesEvent: false, forcedResult: "block" },
    ],
    position: { x: 100, y: 100 },
  });
  graph.nodes.push(misplaced);
  graph.nodes[0]!.options[0]!.targetNodeIds = [misplaced.id];
  misplaced.options[0]!.targetNodeIds = ["exit_a"];

  const gameMap = {
    id: "gm1",
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

describe("map-export-editor-guards", () => {
  it("blocks export when giver chain has misplaced 战斗结果", () => {
    const { project, gameMap, graph } = setupWithMisplacedBattleResult();
    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    const guards = collectEditorExportGuards(project, gameMap, graph, config, foldWarnings);
    expect(guards.some((g) => g.level === "error" && g.message.includes("战斗结果"))).toBe(true);
    expect(auditProjectBattleExportBlockers(project).length).toBeGreaterThan(0);
  });

  it("blocks export when dialog slot has battle side chain", () => {
    const zoneId = "zone_dlg";
    const graph = createGraph({
      id: "g_dlg",
      kind: "map",
      maps: [{ id: zoneId, name: "D", npcUid: "dlg_1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_d", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_d", kind: "npcExit", mapId: zoneId, npcUid: "dlg_1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_d"];

    const gameMap = {
      id: "gm_dlg",
      mapCode: "dlg",
      mapId: 2,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "dlg_1",
          npcName: "纯对话",
          zoneId,
          entryNodeId: "entry_d",
          exitNodeId: "exit_d",
          chainSlotKind: "dialog" as const,
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
      resources: { npc: [{ id: "dlg_1", kind: "npc" as const, name: "G", image: "Npc_01" }] },
    };

    wireUnifiedBattleEncounterChain(project as any, gameMap as any, gameMap.npcs[0]!);

    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap as any, graph, project as any);
    const guards = collectEditorExportGuards(project as any, gameMap as any, graph, config, foldWarnings);
    expect(guards.some((g) => g.level === "error" && g.message.includes("对话页"))).toBe(true);
  });

  it("passes when battle branch exports enemy npc with battle event", () => {
    const zoneId = "zone_b";
    const graph = createGraph({
      id: "g2",
      kind: "map",
      maps: [{ id: zoneId, name: "B", npcUid: "task_2", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_b", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_b", kind: "npcExit", mapId: zoneId, npcUid: "task_2", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_b"];

    const gameMap = {
      id: "gm2",
      mapCode: "world_ok",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "task_2",
          npcName: "紧急出击",
          zoneId,
          entryNodeId: "entry_b",
          exitNodeId: "exit_b",
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
          { id: "task_2", kind: "npc" as const, name: "Giver", image: "Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc_02" },
        ],
      },
    };

    wireUnifiedBattleEncounterChain(project, gameMap, gameMap.npcs[0]!);
    const { config, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    const guards = collectEditorExportGuards(project, gameMap, graph, config, foldWarnings);
    const errors = guards.filter((g) => g.level === "error");
    expect(errors).toEqual([]);
    expect(config.npcs?.some((n) => n.npcUid === "task_2_enemy")).toBe(true);
    expect(config.npcs?.some((n) => (n.events ?? []).some((e) => e.eventType === "battle"))).toBe(true);
  });

  it("auditProjectExportHealth aggregates per-map audits", () => {
    const { project, gameMap, graph } = setupWithMisplacedBattleResult();
    const report = auditProjectExportHealth(project);
    expect(report.ok).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
    expect(report.mapAudits.some((m) => m.gameMapId === gameMap.id && !m.audit.ok)).toBe(true);
    expect(formatProjectExportHealthMessage(report)).toContain("未通过");
  });
});
