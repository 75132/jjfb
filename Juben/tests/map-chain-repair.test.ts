import { describe, expect, it } from "vitest";
import { detectMapChainIssues, repairMapChains, provisionChainContinuousOnMiddleNodes } from "../src/editor/map-chain-repair";
import { repairQuestBattleIssues } from "../src/editor/quest-battle-normalize";
import { isStaleChainedAppear } from "../src/editor/npc-appear";
import { createGameMap, createGraph, createNode, getOptionTargets, setOptionTargets } from "../src/types";
import type { ProjectData } from "../src/types";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";

function makeProject(): ProjectData {
  const graphId = "graph_map_1";
  const graph = createGraph({ id: graphId, kind: "map", name: "测试地图", nodes: [], maps: [] });
  graph.maps = [{ id: "zone1", name: "Z", npcUid: "npc1", x: 0, y: 0, width: 400, height: 300 }];
  const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1", npcUid: "npc1", title: "入" });
  const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1", npcUid: "npc1", title: "出" });
  const dialog = createNode({ id: "d1", kind: "dialog", mapId: "zone1", title: "对白", npcUid: "npc1" });
  graph.nodes = [entry, exit, dialog];

  const gameMap = createGameMap({
    id: "gm1",
    graphId,
    mapCode: "test",
    mapId: 1,
    npcs: [
      {
        npcUid: "npc1",
        npcName: "测试NPC",
        x: 100,
        y: 100,
        zoneId: "zone1",
        entryNodeId: "entry",
        exitNodeId: "exit",
        appear: { mode: "conditional", matchMode: "ALL", requirements: [] },
      },
    ],
  });

  return {
    variables: [],
    quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId, taskId: 100001 }],
    graphs: [graph],
    gameMaps: [gameMap],
  };
}

describe("map-chain-repair", () => {
  it("detects entry without link and empty appear", () => {
    const project = makeProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const issues = detectMapChainIssues(project, graph, gm);
    expect(issues.some((i) => i.kind === "entry_no_link")).toBe(true);
    expect(issues.some((i) => i.kind === "appear_empty")).toBe(true);
  });

  it("repairMapChains connects entry and provisions appear", () => {
    const project = makeProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const entry = graph.nodes.find((n) => n.id === "entry")!;

    const result = repairMapChains(project, graph, gm);
    expect(result.fixedLinks).toBeGreaterThan(0);
    expect(getOptionTargets(entry.options[0]!)).toContain("d1");

    const after = detectMapChainIssues(project, graph, gm);
    expect(after.some((i) => i.kind === "entry_no_link")).toBe(false);
    expect(gm.npcs[0]!.appear?.mode).toBe("always");
  });

  it("provisionChainContinuousOnMiddleNodes marks middle nodes", () => {
    const project = makeProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const n = provisionChainContinuousOnMiddleNodes(graph, gm);
    expect(n).toBeGreaterThanOrEqual(0);
  });

  it("does not flag detached battle branch nodes as orphan_middle", () => {
    const zoneId = "zone_t1";
    const graph = createGraph({
      id: "g_battle",
      kind: "map",
      maps: [{ id: zoneId, name: "T1", npcUid: "task_1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_t1", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_t1", kind: "npcExit", mapId: zoneId, npcUid: "task_1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_t1"];

    const gameMap = createGameMap({
      id: "gm_battle",
      graphId: graph.id,
      mapCode: "world",
      mapId: 1,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "task_1",
          npcName: "初次接触",
          zoneId,
          entryNodeId: "entry_t1",
          exitNodeId: "exit_t1",
          x: 192,
          y: 192,
        },
      ],
    });

    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted", graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: { npc: [{ id: "task_1", kind: "npc", name: "Giver", image: "Npc_01" }] },
    };

    repairQuestBattleIssues(project, graph, gameMap);
    const issues = detectMapChainIssues(project, graph, gameMap);
    expect(issues.some((i) => i.kind === "orphan_middle" && i.message.includes("敌人出现"))).toBe(false);
  });

  it("repairMapChains refreshes appear after battle layout changes", () => {
    const graphId = "g_chain";
    const zones = ["z1", "z2"] as const;
    const graph = createGraph({
      id: graphId,
      kind: "map",
      maps: zones.map((z, i) => ({ id: z, name: `Z${i + 1}`, npcUid: `task_${i + 1}`, x: 0, y: 0, width: 400, height: 300 })),
      nodes: [],
    });

    for (const [i, zoneId] of zones.entries()) {
      const uid = `task_${i + 1}`;
      const entry = createNode({ id: `entry_${uid}`, kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } });
      const dlg = createNode({ id: `dlg_${uid}`, kind: "dialog", mapId: zoneId, title: "对白" });
      const exit = createNode({ id: `exit_${uid}`, kind: "npcExit", mapId: zoneId, npcUid: uid, position: { x: 200, y: 0 } });
      setOptionTargets(entry.options[0]!, [dlg.id]);
      setOptionTargets(dlg.options[0]!, [exit.id]);
      graph.nodes.push(entry, dlg, exit);
    }

    const gameMap = createGameMap({
      id: "gm_chain",
      graphId,
      mapCode: "world",
      mapId: 1,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: zones.map((z, i) => ({
        npcUid: `task_${i + 1}`,
        npcName: i === 0 ? "初次接触" : "紧急出击",
        zoneId: z,
        entryNodeId: `entry_task_${i + 1}`,
        exitNodeId: `exit_task_${i + 1}`,
        x: 192,
        y: 192,
        appear: {
          mode: "conditional" as const,
          matchMode: "ALL" as const,
          requirements:
            i === 0
              ? []
              : [{ kind: "questStatus" as const, questId: "q1", status: "Completed" as const }],
        },
      })),
    });

    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted", graphId, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: { npc: [{ id: "task_1", kind: "npc", name: "Giver", image: "Npc_01" }] },
    };

    expect(isStaleChainedAppear(project, gameMap, 1)).toBe(true);
    const result = repairMapChains(project, graph, gameMap);
    expect(result.provisionedAppear).toBeGreaterThan(0);
    expect(isStaleChainedAppear(project, gameMap, 1)).toBe(false);

    const after = detectMapChainIssues(project, graph, gameMap);
    expect(after.some((i) => i.kind === "appear_stale")).toBe(false);
    expect(after.some((i) => i.kind === "orphan_middle" && i.message.includes("敌人出现"))).toBe(false);
  });
});
