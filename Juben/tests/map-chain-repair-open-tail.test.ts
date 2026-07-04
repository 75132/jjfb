import { describe, expect, it } from "vitest";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { detectMapChainIssues, repairMainChainOpenTails, repairMapChains } from "../src/editor/map-chain-repair";
import { wireMultiEnemyBattleChain } from "../src/editor/npc-chain-presets";
import { createGraph, createNode, getOptionTargets, setOptionTargets } from "../src/types";

describe("repairMainChainOpenTails", () => {
  it("fixes accept quest node open_tail when only battle side chain exists in zone", () => {
    const zoneId = "zone_ot";
    const graph = createGraph({
      id: "g_ot",
      kind: "map",
      maps: [{ id: zoneId, name: "M", npcUid: "chain_2", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_ot", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_ot", kind: "npcExit", mapId: zoneId, npcUid: "chain_2", position: { x: 400, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_ot"];

    const gameMap = {
      id: "gm_ot",
      mapCode: "ot",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "chain_2",
          npcName: "第2幕",
          zoneId,
          entryNodeId: "entry_ot",
          exitNodeId: "exit_ot",
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
          { id: "chain_2", kind: "npc" as const, name: "G", image: "Npc/Npc_01" },
          { id: "e1", kind: "npc" as const, name: "Enemy", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project as any, gameMap as any, gameMap.npcs[0]!, { enemyCount: 1 });

    const dialogHint = graph.nodes.find((n) => n.title === "任务提示");
    const accept = createNode({
      id: "accept_broken",
      kind: "questUpdate",
      title: "接取任务",
      mapId: zoneId,
      questId: "q1",
      questStatus: "InProgress",
      position: { x: 200, y: 80 },
    });
    graph.nodes.push(accept);
    const entry = graph.nodes.find((n) => n.id === "entry_ot")!;
    const firstDialog = graph.nodes.find((n) => n.title === "任务对话");
    if (firstDialog) {
      setOptionTargets(firstDialog.options[0] ?? { id: "x", text: "" }, [accept.id]);
    } else {
      setOptionTargets(entry.options[0]!, [accept.id]);
    }
    expect(dialogHint).toBeTruthy();

    const before = detectMapChainIssues(project as any, graph, gameMap as any);
    expect(before.some((i) => i.kind === "open_tail" && i.nodeId === accept.id)).toBe(true);

    const fixed = repairMainChainOpenTails(project as any, graph, gameMap as any);
    expect(fixed).toBeGreaterThan(0);

    const after = detectMapChainIssues(project as any, graph, gameMap as any);
    expect(after.some((i) => i.kind === "open_tail" && i.nodeId === accept.id)).toBe(false);
    expect(getOptionTargets(accept.options[0]!).length).toBeGreaterThan(0);
  });

  it("repairMapChains clears open_tail on battle slot chain", () => {
    const zoneId = "zone_rm";
    const graph = createGraph({
      id: "g_rm",
      kind: "map",
      maps: [{ id: zoneId, name: "M", npcUid: "chain_2", x: 0, y: 0, width: 800, height: 600 }],
      nodes: [
        createNode({ id: "entry_rm", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_rm", kind: "npcExit", mapId: zoneId, npcUid: "chain_2", position: { x: 400, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_rm"];

    const gameMap = {
      id: "gm_rm",
      mapCode: "rm",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "chain_2",
          npcName: "第2幕",
          zoneId,
          entryNodeId: "entry_rm",
          exitNodeId: "exit_rm",
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
          { id: "chain_2", kind: "npc" as const, name: "G", image: "Npc/Npc_01" },
          { id: "e1", kind: "npc" as const, name: "Enemy", image: "Npc/Npc_02" },
        ],
      },
    };

    wireMultiEnemyBattleChain(project as any, gameMap as any, gameMap.npcs[0]!, { enemyCount: 2 });
    const accept = graph.nodes.find((n) => n.title === "接取任务");
    expect(accept?.kind).toBe("choice");
    accept!.options[1]!.targetNodeIds = [];

    repairMapChains(project as any, graph, gameMap as any);
    const issues = detectMapChainIssues(project as any, graph, gameMap as any);
    expect(issues.some((i) => i.kind === "choice_empty_option" && i.nodeId === accept!.id)).toBe(false);
    expect(getOptionTargets(accept!.options[1]!)).toContain("exit_rm");
  });
});
