import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { wireUnifiedBattleEncounterChain } from "../src/editor/npc-chain-presets";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import {
  battleEnemySpawnCoords,
  ensureBattleEnemyBranch,
  materializeBattleEnemySpawnCoords,
  patchBattleEnemySpawn,
  removeBattleEnemyBranch,
  resolveNpcBattleChain,
} from "../src/editor/battle-enemy-bind";

function minimalSetup() {
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
        { id: "npc_a", kind: "npc" as const, name: "Giver", image: "Npc_01" },
        { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc_02" },
      ],
    },
  };

  return { project, gameMap, graph, npc: gameMap.npcs[0]! };
}

describe("battle-enemy-bind", () => {
  it("resolves battle chain from unified preset", () => {
    const { project, gameMap, npc } = minimalSetup();
    wireUnifiedBattleEncounterChain(project, gameMap, npc, { battleRef: "battle_1-50" });

    const bind = resolveNpcBattleChain(project, gameMap, "npc_a");
    expect(bind?.battleNodeId).toBeTruthy();
    expect(bind?.enemyAppearNodeId).toBeTruthy();
    expect(bind?.spawnStep?.kind).toBe("spawnNpc");
    expect(bind?.enemyName).toBeTruthy();
  });

  it("patches spawn coordinates", () => {
    const { project, gameMap, npc } = minimalSetup();
    wireUnifiedBattleEncounterChain(project, gameMap, npc);
    expect(patchBattleEnemySpawn(project, gameMap, "npc_a", { x: 300, y: 400 })).toEqual({ ok: true });
    const bind = resolveNpcBattleChain(project, gameMap, "npc_a");
    expect(bind?.spawnStep?.x).toBe(300);
    expect(bind?.spawnStep?.y).toBe(400);
  });

  it("ensureBattleEnemyBranch inserts branch for plain chain", () => {
    const { project, gameMap } = minimalSetup();
    const bind = ensureBattleEnemyBranch(project, gameMap, "npc_a");
    expect(bind?.battleNodeId).toBeTruthy();
    expect(bind?.enemyAppearNodeId).toBeTruthy();
  });

  it("removeBattleEnemyBranch strips battle nodes but keeps entry", () => {
    const { project, gameMap, npc, graph } = minimalSetup();
    wireUnifiedBattleEncounterChain(project, gameMap, npc);
    expect(removeBattleEnemyBranch(project, gameMap, "npc_a")).toBe(true);
    expect(resolveNpcBattleChain(project, gameMap, "npc_a")).toBeNull();
    expect(graph.nodes.some((n) => n.kind === "battle")).toBe(false);
    expect(graph.nodes.some((n) => n.id === "entry_a")).toBe(true);
  });

  it("materialize decouples enemy coords from giver movement", () => {
    const { project, gameMap, npc } = minimalSetup();
    wireUnifiedBattleEncounterChain(project, gameMap, npc);
    const bindBefore = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    const enemyBefore = battleEnemySpawnCoords(bindBefore, npc);

    expect(materializeBattleEnemySpawnCoords(project, gameMap, "npc_a")).toBe(true);
    npc.x = 400;
    npc.y = 400;

    const bindAfter = resolveNpcBattleChain(project, gameMap, "npc_a")!;
    expect(bindAfter.spawnStep?.x).toBe(enemyBefore.x);
    expect(bindAfter.spawnStep?.y).toBe(enemyBefore.y);
    expect(battleEnemySpawnCoords(bindAfter, npc)).toEqual(enemyBefore);
  });

  it("patches spawn when enemy appear node is missing but battle chain exists", () => {
    const { project, gameMap, graph, npc } = minimalSetup();
    const zoneId = npc.zoneId!;
    const battlePrep = createNode({
      id: "prep_only",
      kind: "choice",
      title: "战前选择",
      mapId: zoneId,
      options: [{ id: "opt_prep", text: "战斗" }],
      position: { x: 100, y: 100 },
    });
    const battle = createNode({
      id: "battle_only",
      kind: "battle",
      title: "战斗",
      mapId: zoneId,
      battleConfigId: "battle_1-50",
      position: { x: 200, y: 100 },
    });
    graph.nodes.push(battlePrep, battle);
    battlePrep.options[0]!.targetNodeIds = [battle.id];
    graph.nodes[0]!.options[0]!.targetNodeIds = ["prep_only"];

    const bind = resolveNpcBattleChain(project, gameMap, "npc_a");
    expect(bind?.enemyAppearNodeId).toBeNull();
    expect(bind?.battleNodeId).toBe("battle_only");

    const result = patchBattleEnemySpawn(project, gameMap, "npc_a", { x: 250, y: 350 });
    expect(result).toEqual({ ok: true });

    const after = resolveNpcBattleChain(project, gameMap, "npc_a");
    expect(after?.enemyAppearNodeId).toBeTruthy();
    expect(after?.spawnStep?.x).toBe(250);
    expect(after?.spawnStep?.y).toBe(350);
  });
});
