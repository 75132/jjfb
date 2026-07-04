import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { isDialogOnlyTaskChain, backfillChainSlotKinds, inferChainSlotKind } from "../src/editor/chain-slot-kind";
import { repairQuestBattleIssues } from "../src/editor/quest-battle-normalize";
import { provisionMapNpcQuestChains } from "../src/editor/ai/ai-quest-provision";

describe("chain-slot-kind dialog vs battle", () => {
  it("dialog chain with accept choice is still dialog-only when chainSlotKind=dialog", () => {
    const zoneId = "zone_slot";
    const graph = createGraph({
      id: "g_slot",
      kind: "map",
      maps: [{ id: zoneId, name: "Z", npcUid: "chain_1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({
          id: "accept",
          kind: "choice",
          mapId: zoneId,
          title: "接取任务",
          options: [
            { id: "yes", text: "接取任务", effectTaskAccept: 100001 },
            { id: "no", text: "暂缓" },
          ],
          position: { x: 100, y: 0 },
        }),
        createNode({ id: "exit", kind: "npcExit", mapId: zoneId, npcUid: "chain_1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["accept"];

    const gameMap = {
      id: "gm_slot",
      mapCode: "s",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "chain_1",
          npcName: "对话链",
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
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
      resources: { npc: [{ id: "chain_1", kind: "npc" as const, name: "N", image: "Npc_01" }] },
    };

    expect(isDialogOnlyTaskChain(project as any, graph, gameMap as any, "chain_1")).toBe(true);

    provisionMapNpcQuestChains(project as any, graph, gameMap as any);
    const report = repairQuestBattleIssues(project as any, graph, gameMap as any);

    expect(report.battleBranchAdded).toBe(0);
    expect(graph.nodes.some((n) => n.title === "敌人出现")).toBe(false);
    expect(graph.nodes.some((n) => n.kind === "battle")).toBe(false);
  });
});

describe("chain-slot-kind backfill", () => {
  it("infers dialog when main chain has no battle", () => {
    const zoneId = "zone_bf";
    const graph = createGraph({
      id: "g_bf",
      kind: "map",
      maps: [{ id: zoneId, name: "Z", npcUid: "c1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry", kind: "npcEntry", mapId: zoneId, npcUid: "c1", position: { x: 0, y: 0 } }),
        createNode({ id: "exit", kind: "npcExit", mapId: zoneId, npcUid: "c1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit"];
    const gameMap = {
      id: "gm_bf",
      mapCode: "b",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "c1",
          npcName: "无标记",
          zoneId,
          entryNodeId: "entry",
          exitNodeId: "exit",
          x: 192,
          y: 192,
        },
      ],
    };
    const project = { variables: [], quests: [], graphs: [graph], gameMaps: [gameMap], resources: {} } as any;
    expect(inferChainSlotKind(project, graph, gameMap as any, "c1")).toBe("dialog");
    expect(backfillChainSlotKinds(project, graph, gameMap as any)).toBe(1);
    expect(gameMap.npcs[0]!.chainSlotKind).toBe("dialog");
  });
});
