import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { wireUnifiedBattleEncounterChain } from "../src/editor/npc-chain-presets";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import {
  battleEnemySpawnCoords,
  materializeBattleEnemiesForGiver,
  materializeBattleEnemySpawnCoords,
  resolveNpcBattleChain,
} from "../src/editor/battle-enemy-bind";

function dragScenario() {
  const zoneId = "zone_drag";
  const graph = createGraph({
    id: "g_drag",
    kind: "map",
    maps: [{ id: zoneId, name: "A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: "entry_a", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
      createNode({ id: "exit_a", kind: "npcExit", mapId: zoneId, npcUid: "npc_a", position: { x: 200, y: 0 } }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_a"];

  const gameMap = {
    id: "gm_drag",
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
        x: 100,
        y: 100,
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
        { id: "npc_a", kind: "npc" as const, name: "Giver", image: "Npc_01" },
        { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc_02" },
      ],
    },
  };

  wireUnifiedBattleEncounterChain(project, gameMap, gameMap.npcs[0]!);
  return { project, gameMap, npc: gameMap.npcs[0]! };
}

/** 模拟 patchGameMapNpc 拖 NPC 前的物化 + 坐标写入 */
function simulatePatchGameMapNpc(
  project: ReturnType<typeof dragScenario>["project"],
  gameMap: ReturnType<typeof dragScenario>["gameMap"],
  npcUid: string,
  patch: { x?: number; y?: number },
) {
  const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  if (patch.x !== undefined || patch.y !== undefined) {
    materializeBattleEnemiesForGiver(project, gameMap, npcUid);
  }
  Object.assign(npc, patch);
}

describe("map-editor-drag sequence", () => {
  it("materialize + patchGameMapNpc keeps enemy coords stable", () => {
    const { project, gameMap, npc } = dragScenario();
    const bind0 = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    const enemy0 = battleEnemySpawnCoords(bind0, npc);

    simulatePatchGameMapNpc(project, gameMap, "npc_a", { x: 300, y: 300 });

    const bind1 = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    expect(battleEnemySpawnCoords(bind1, npc)).toEqual(enemy0);
    expect(bind1.spawnStep?.x).toBe(enemy0.x);
    expect(bind1.spawnStep?.y).toBe(enemy0.y);
  });

  it("materialize alone persists fallback coords for later drag", () => {
    const { project, gameMap, npc } = dragScenario();
    const bind0 = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    const enemy0 = battleEnemySpawnCoords(bind0, npc);

    expect(materializeBattleEnemySpawnCoords(project, gameMap, "npc_a")).toBe(true);
    npc.x = 500;
    npc.y = 500;

    const bind1 = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    expect(battleEnemySpawnCoords(bind1, npc)).toEqual(enemy0);
  });
});
