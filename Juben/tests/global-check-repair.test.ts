import { describe, expect, it } from "vitest";
import { buildRepairBriefFromIssues, issuesNeedAiRepair } from "../src/editor/ai/ai-repair-brief";
import {
  detectAllMapChainIssues,
  detectGlobalLinkageIssues,
  formatGlobalCheckReport,
  runGlobalCheckRepairLoop,
} from "../src/editor/global-check-repair";
import { detectMapChainIssues, repairMapChains } from "../src/editor/map-chain-repair";
import { wireMultiEnemyBattleChain } from "../src/editor/npc-chain-presets";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { createGameMap, createGraph, createNode, getOptionTargets } from "../src/types";
import type { ProjectData } from "../src/types";

function makeTwoMapProject(): ProjectData {
  const graphId = "g1";
  const graph = createGraph({ id: graphId, kind: "map", name: "大地图", nodes: [], maps: [] });
  graph.maps = [{ id: "z1", name: "Z1", npcUid: "npc1", x: 0, y: 0, width: 400, height: 300 }];

  const e1 = createNode({ id: "e1", kind: "npcEntry", mapId: "z1", npcUid: "npc1", title: "入1" });
  const x1 = createNode({ id: "x1", kind: "npcExit", mapId: "z1", npcUid: "npc1", title: "出1" });
  const d1 = createNode({ id: "d1", kind: "dialog", mapId: "z1", npcUid: "npc1", title: "对白" });
  graph.nodes = [e1, x1, d1];

  const gm1 = createGameMap({
    id: "gm1",
    graphId,
    mapCode: "world_a",
    mapName: "地图A",
    mapId: 1,
    npcs: [
      {
        npcUid: "npc1",
        npcName: "链1",
        x: 0,
        y: 0,
        zoneId: "z1",
        entryNodeId: "e1",
        exitNodeId: "x1",
        appear: { mode: "always", matchMode: "ALL", requirements: [] },
      },
    ],
  });

  const graphId2 = "g2";
  const graph2 = createGraph({ id: graphId2, kind: "map", name: "子图", nodes: [], maps: [] });
  graph2.maps = [{ id: "z2", name: "Z2", npcUid: "npc2", x: 0, y: 0, width: 400, height: 300 }];
  const e2 = createNode({ id: "e2", kind: "npcEntry", mapId: "z2", npcUid: "npc2", title: "入2" });
  const x2 = createNode({ id: "x2", kind: "npcExit", mapId: "z2", npcUid: "npc2", title: "出2" });
  graph2.nodes = [e2, x2];

  const gm2 = createGameMap({
    id: "gm2",
    graphId: graphId2,
    mapCode: "world_b",
    mapName: "地图B",
    mapId: 2,
    npcs: [
      {
        npcUid: "npc2",
        npcName: "链2",
        x: 0,
        y: 0,
        zoneId: "z2",
        entryNodeId: "e2",
        exitNodeId: "x2",
        appear: { mode: "conditional", matchMode: "ALL", requirements: [] },
      },
    ],
  });

  return {
    variables: [],
    quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId, taskId: 100001 }],
    graphs: [graph, graph2],
    gameMaps: [gm1, gm2],
  };
}

describe("global-check-repair", () => {
  it("detectAllMapChainIssues aggregates per map", async () => {
    const project = makeTwoMapProject();
    const issues = await detectAllMapChainIssues(project, project.gameMaps!, 0);
    expect(issues.some((i) => i.gameMapId === "gm1")).toBe(true);
    expect(issues.some((i) => i.gameMapId === "gm2")).toBe(true);
  });

  it("runGlobalCheckRepairLoop reduces issues and reports progress", async () => {
    const project = makeTwoMapProject();
    const progressLabels: string[] = [];
    const report = await runGlobalCheckRepairLoop(project, {
      syncTimeline: false,
      runLayout: false,
      runExportValidate: false,
      useAiForEmptyChains: false,
      yieldMs: 0,
      progressThrottleMs: 0,
      onProgress: (p) => progressLabels.push(p.label),
    });

    expect(report.mapsChecked).toBe(2);
    expect(report.issuesBefore.length).toBeGreaterThan(0);
    expect(report.issuesAfter.length).toBeLessThanOrEqual(report.issuesBefore.length);
    expect(report.repairTotals.fixedLinks).toBeGreaterThan(0);
    expect(progressLabels.length).toBeGreaterThan(2);
    expect(formatGlobalCheckReport(report)).toContain("已检查 2 张地图");

    const gm1 = project.gameMaps!.find((m) => m.id === "gm1")!;
    const g1 = project.graphs.find((g) => g.id === gm1.graphId)!;
    const entry = g1.nodes.find((n) => n.id === "e1")!;
    expect(getOptionTargets(entry.options[0]!)).toContain("d1");
  });

  it("issuesNeedAiRepair flags no_middle_nodes", () => {
    expect(issuesNeedAiRepair([{ kind: "no_middle_nodes", npcUid: "a", message: "x" }])).toBe(true);
    expect(issuesNeedAiRepair([{ kind: "entry_no_link", npcUid: "a", message: "x" }])).toBe(false);
  });

  it("buildRepairBriefFromIssues sets completesEvent constraints", () => {
    const brief = buildRepairBriefFromIssues(
      [{ kind: "open_tail", npcUid: "npc1", message: "链尾未接" }],
      { focusNpcUid: "npc1" },
    );
    expect(brief.npcUid).toBe("npc1");
    expect(brief.constraints?.some((c) => c.includes("链尾未接"))).toBe(true);
  });

  it("detectGlobalLinkageIssues finds missing exit on bundle", () => {
    const project = makeTwoMapProject();
    const gm = project.gameMaps![0]!;
    gm.npcs.push({
      npcUid: "npc3",
      npcName: "链3",
      x: 0,
      y: 0,
      zoneId: "z1",
      entryNodeId: "e1",
      appear: { mode: "conditional", matchMode: "ALL", requirements: [] },
    });
    gm.npcs[0]!.exitNodeId = undefined;
    const linkage = detectGlobalLinkageIssues(project);
    expect(linkage.some((l) => l.kind === "npc_bundle_gap")).toBe(true);
  });

  it("runGlobalCheckRepairLoop repairs multi-enemy export errors", async () => {
    const zoneId = "z_battle";
    const graph = createGraph({ id: "g_b", kind: "map", name: "战斗图", nodes: [], maps: [] });
    graph.maps = [{ id: zoneId, name: "Z", npcUid: "chain_2", x: 0, y: 0, width: 800, height: 600 }];
    const entry = createNode({ id: "e_b", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } });
    const exit = createNode({ id: "x_b", kind: "npcExit", mapId: zoneId, npcUid: "chain_2", position: { x: 200, y: 0 } });
    graph.nodes = [entry, exit];
    entry.options[0]!.targetNodeIds = [exit.id];

    const gm = createGameMap({
      id: "gm_battle",
      graphId: graph.id,
      mapCode: "battle_map",
      mapName: "战斗地图",
      mapId: 9,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "chain_2",
          npcName: "战斗链",
          x: 192,
          y: 192,
          zoneId,
          entryNodeId: entry.id,
          exitNodeId: exit.id,
          appear: { mode: "always", matchMode: "ALL", requirements: [] },
        },
      ],
    });
    Object.assign(gm, DEFAULT_COCOS_GAME_MAP_IMAGE);

    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gm],
      resources: {
        npc: [
          { id: "chain_2", kind: "npc", name: "G", image: "Npc/Npc_01" },
          { id: "e1", kind: "npc", name: "Enemy", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project, gm, gm.npcs[0]!, { enemyCount: 2 });
    const turnIn = graph.nodes.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
    turnIn!.requirements = [{ kind: "eventDone", eventId: "chain_2_enemy_e2" }];

    const report = await runGlobalCheckRepairLoop(project, {
      syncTimeline: false,
      runLayout: false,
      runExportValidate: true,
      runRepair: true,
      useAiForEmptyChains: false,
      yieldMs: 0,
      progressThrottleMs: 0,
    });

    expect(report.exportFailCount).toBe(0);
    expect(report.exportErrors.length).toBe(0);
    expect(turnIn?.requirements?.filter((r) => r.kind === "eventDone").length).toBe(2);
  });
});

describe("global-check-repair single map parity", () => {
  it("matches detectMapChainIssues before repair", async () => {
    const project = makeTwoMapProject();
    const gm = project.gameMaps![0]!;
    const graph = project.graphs[0]!;
    const local = detectMapChainIssues(project, graph, gm);
    const global = await detectAllMapChainIssues(project, [gm], 0);
    expect(global.length).toBe(local.length);
  });
});
