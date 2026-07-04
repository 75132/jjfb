/**
 * 任务链内战斗分支绑定：敌人出现(spawnNpc) + 战前选择 + 战斗节点。
 * 供左栏展示、地图摆点、Inspector 编辑。
 */
import type { ActionStep, GameMapDef, GraphData, ProjectData, StoryNode } from "../types";
import { createNode, getOptionTargets, setOptionTargets } from "../types";
import { collectNpcEventChain } from "./map-export";
import { defaultBattleRef } from "./client-runtime-manifest";
import { pickRandomBattleResourceId } from "./npc-chain-presets";
import {
  BATTLE_TITLE_BATTLE_PREP,
  BATTLE_TITLE_BATTLE_RESULT,
  BATTLE_TITLE_ENEMY_APPEAR,
  type BattleRole,
} from "./constants";

export type { BattleRole };

function battleRoleOf(node: StoryNode): BattleRole | null {
  const role = node.editorMeta?.battleRole;
  if (role === "enemyAppear" || role === "battlePrep" || role === "battle") return role;
  return null;
}

export function withBattleRole(node: StoryNode, role: BattleRole): StoryNode {
  node.editorMeta = { ...node.editorMeta, battleRole: role };
  return node;
}

function isEnemyAppearNode(node: StoryNode): boolean {
  if (battleRoleOf(node) === "enemyAppear") return true;
  if (node.kind === "action" && node.title === BATTLE_TITLE_ENEMY_APPEAR) return true;
  const step = findSpawnStep(node);
  if (step?.npcUid?.includes("_enemy")) return true;
  return false;
}

function isBattlePrepNode(node: StoryNode): boolean {
  if (battleRoleOf(node) === "battlePrep") return true;
  return node.kind === "choice" && (node.title === BATTLE_TITLE_BATTLE_PREP || node.title === BATTLE_TITLE_BATTLE_RESULT);
}

export type SpawnNpcStep = Extract<ActionStep, { kind: "spawnNpc" }>;

export type NpcBattleChainBind = {
  giverNpcUid: string;
  enemyAppearNodeId: string | null;
  battlePrepNodeId: string | null;
  battleNodeId: string | null;
  turnInNodeId: string | null;
  spawnStep: SpawnNpcStep | null;
  battleConfigId: string | null;
  enemyName: string;
};

function findSpawnStep(node: StoryNode | undefined): SpawnNpcStep | null {
  if (!node || node.kind !== "action") return null;
  const step = node.actions?.find((a): a is SpawnNpcStep => a.kind === "spawnNpc");
  return step ?? null;
}

export function resolveBattleEnemyNpcUid(giverNpcUid: string): string {
  return `${giverNpcUid}_enemy`;
}

/** 多敌人：index 0 → {giver}_enemy，1 → {giver}_enemy_2，2 → {giver}_enemy_3 … */
export function resolveBattleEnemyNpcUidForIndex(giverNpcUid: string, index: number): string {
  if (index <= 0) return resolveBattleEnemyNpcUid(giverNpcUid);
  return `${giverNpcUid}_enemy_${index + 1}`;
}

function isSpawnUidForGiver(spawnUid: string, giverNpcUid: string): boolean {
  if (spawnUid === resolveBattleEnemyNpcUid(giverNpcUid)) return true;
  const re = new RegExp(`^${giverNpcUid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_enemy_\\d+$`);
  return re.test(spawnUid);
}

function isBattleBranchNode(node: StoryNode): boolean {
  if (node.kind === "battle" || battleRoleOf(node) === "battle") return true;
  if (isEnemyAppearNode(node)) return true;
  if (isBattlePrepNode(node)) return true;
  return false;
}

function findEnemyAppearNode(
  graph: GraphData,
  giverNpcUid: string,
  zoneId: string | undefined,
): StoryNode | undefined {
  const expectedUid = resolveBattleEnemyNpcUid(giverNpcUid);
  return graph.nodes.find((n) => {
    if (zoneId && n.mapId !== zoneId) return false;
    if (n.kind !== "action") return false;
    const step = findSpawnStep(n);
    if (!step?.npcUid) return isEnemyAppearNode(n);
    return step.npcUid === expectedUid || step.npcUid.startsWith(`${expectedUid}_`);
  });
}

function followBattleBranchFromAppear(
  graph: GraphData,
  enemyAppear: StoryNode | undefined,
): { battlePrep: StoryNode | undefined; battle: StoryNode | undefined } {
  if (!enemyAppear) return { battlePrep: undefined, battle: undefined };
  const prepId = getOptionTargets(enemyAppear.options[0] ?? { id: "", text: "" })[0];
  const battlePrep = prepId ? graph.nodes.find((n) => n.id === prepId) : undefined;
  const battleId = battlePrep
    ? getOptionTargets(battlePrep.options[0] ?? { id: "", text: "" })[0]
    : undefined;
  const battle = battleId ? graph.nodes.find((n) => n.id === battleId && n.kind === "battle") : undefined;
  return { battlePrep, battle };
}

function findAllEnemyAppearNodes(
  graph: GraphData,
  giverNpcUid: string,
  zoneId: string | undefined,
): StoryNode[] {
  return graph.nodes.filter((n) => {
    if (zoneId && n.mapId !== zoneId) return false;
    if (n.kind !== "action" && !isEnemyAppearNode(n)) return false;
    const step = findSpawnStep(n);
    if (step?.npcUid) return isSpawnUidForGiver(step.npcUid, giverNpcUid);
    return isEnemyAppearNode(n) && n.mapId === zoneId;
  });
}

function buildBindFromAppear(
  graph: GraphData,
  giverNpcUid: string,
  enemyAppear: StoryNode,
  turnInNodeId: string | null,
): NpcBattleChainBind {
  const { battlePrep, battle } = followBattleBranchFromAppear(graph, enemyAppear);
  const spawnStep = findSpawnStep(enemyAppear);
  const enemyName = spawnStep?.npcName ?? battle?.markerHint?.replace(/^与|对战$/g, "") ?? "战斗敌人";
  return {
    giverNpcUid,
    enemyAppearNodeId: enemyAppear.id,
    battlePrepNodeId: battlePrep?.id ?? null,
    battleNodeId: battle?.id ?? null,
    turnInNodeId,
    spawnStep,
    battleConfigId: battle?.battleConfigId ?? null,
    enemyName,
  };
}

export function resolveNpcBattleChains(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  giverNpcUid: string,
  graphOverride?: GraphData,
): NpcBattleChainBind[] {
  const graph = graphOverride ?? project?.graphs.find((g) => g.id === gameMap.graphId);
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!graph || !npc?.entryNodeId) return [];

  const giverChain = collectNpcEventChain(graph, npc.entryNodeId);
  const turnIn = giverChain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  const turnInNodeId = turnIn?.id ?? null;

  const appears = findAllEnemyAppearNodes(graph, giverNpcUid, npc.zoneId);
  if (appears.length > 0) {
    return appears
      .map((a) => buildBindFromAppear(graph, giverNpcUid, a, turnInNodeId))
      .filter((b) => b.battleNodeId || b.enemyAppearNodeId);
  }

  const single = resolveNpcBattleChainLegacy(project, gameMap, giverNpcUid, graph);
  return single ? [single] : [];
}

function resolveNpcBattleChainLegacy(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  giverNpcUid: string,
  graph: GraphData,
): NpcBattleChainBind | null {
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!npc?.entryNodeId) return null;

  const giverChain = collectNpcEventChain(graph, npc.entryNodeId);
  const turnIn = giverChain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");

  let enemyAppear = findEnemyAppearNode(graph, giverNpcUid, npc.zoneId);
  let { battlePrep, battle } = followBattleBranchFromAppear(graph, enemyAppear);

  if (!enemyAppear && !battle && !battlePrep) {
    enemyAppear = giverChain.find((n) => isEnemyAppearNode(n));
    battlePrep = giverChain.find((n) => isBattlePrepNode(n));
    battle = giverChain.find((n) => n.kind === "battle" || battleRoleOf(n) === "battle");
  }

  if (!enemyAppear && !battle && !battlePrep) return null;

  const spawnStep = findSpawnStep(enemyAppear);
  const enemyName = spawnStep?.npcName ?? battle?.markerHint?.replace(/^与|对战$/g, "") ?? "战斗敌人";

  return {
    giverNpcUid,
    enemyAppearNodeId: enemyAppear?.id ?? null,
    battlePrepNodeId: battlePrep?.id ?? null,
    battleNodeId: battle?.id ?? null,
    turnInNodeId: turnIn?.id ?? null,
    spawnStep,
    battleConfigId: battle?.battleConfigId ?? null,
    enemyName,
  };
}

export function resolveNpcBattleChain(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  giverNpcUid: string,
  graphOverride?: GraphData,
): NpcBattleChainBind | null {
  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graphOverride);
  return chains[0] ?? null;
}

export function listNpcBattleChains(project: ProjectData, gameMap: GameMapDef): NpcBattleChainBind[] {
  const all: NpcBattleChainBind[] = [];
  for (const n of gameMap.npcs) {
    all.push(...resolveNpcBattleChains(project, gameMap, n.npcUid));
  }
  return all;
}

/** 同步交任务节点的全部 event_done（多敌人 ALL 满足） */
export function syncTurnInEventDoneForChains(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): boolean {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return false;
  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  if (chains.length === 0) return false;
  const turnInId = chains[0]?.turnInNodeId;
  if (!turnInId) return false;
  const turnIn = graph.nodes.find((n) => n.id === turnInId);
  if (!turnIn) return false;
  const eventIds = chains
    .map((c, i) => {
      const uid = c.spawnStep?.npcUid ?? resolveBattleEnemyNpcUidForIndex(giverNpcUid, i);
      return c.battleNodeId ? resolveBattleEnemyBattleEventId(uid) : null;
    })
    .filter(Boolean) as string[];
  if (eventIds.length === 0) return false;
  const nextReqs = eventIds.map((eventId) => ({ kind: "eventDone" as const, eventId }));
  const prev = turnIn.requirements ?? [];
  const same =
    prev.length === nextReqs.length &&
    nextReqs.every((r, i) => prev[i]?.kind === "eventDone" && prev[i]?.eventId === r.eventId);
  if (same) return false;
  turnIn.requirements = nextReqs;
  return true;
}

export function battleEnemySpawnCoords(
  bind: NpcBattleChainBind,
  giver: GameMapDef["npcs"][number],
): { x: number; y: number } {
  const sx = bind.spawnStep?.x;
  const sy = bind.spawnStep?.y;
  if (Number.isFinite(sx) && Number.isFinite(sy)) {
    return { x: Math.round(sx!), y: Math.round(sy!) };
  }
  return { x: Math.round((giver.x ?? 192) + 96), y: Math.round(giver.y ?? 192) };
}

export type PatchBattleEnemySpawnResult = { ok: true } | { ok: false; reason: string };

function spawnCoordsMaterialized(bind: NpcBattleChainBind): boolean {
  const sx = bind.spawnStep?.x;
  const sy = bind.spawnStep?.y;
  return Number.isFinite(sx) && Number.isFinite(sy);
}

/** 将回退坐标写入 spawnStep，解耦任务官摆点与战斗敌人坐标 */
export function materializeBattleEnemySpawnCoords(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): boolean {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph).filter((c) => c.battleNodeId);
  if (chains.length === 0) {
    const bind = resolveNpcBattleChain(project, gameMap, giverNpcUid);
    if (!bind?.battleNodeId) return false;
    if (spawnCoordsMaterialized(bind)) return true;
    const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
    if (!npc) return false;
    const coords = battleEnemySpawnCoords(bind, npc);
    return patchBattleEnemySpawn(project, gameMap, giverNpcUid, { x: coords.x, y: coords.y }).ok;
  }
  if (chains.every((c) => spawnCoordsMaterialized(c))) return true;
  return materializeAllBattleEnemySpawnCoords(project, gameMap, giverNpcUid) > 0;
}

/** 多敌人：逐条战斗分支物化 spawn 坐标 */
export function materializeAllBattleEnemySpawnCoords(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): number {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!graph || !npc) return 0;

  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph).filter((c) => c.battleNodeId);
  let fixed = 0;
  for (let i = 0; i < chains.length; i++) {
    const bind = chains[i]!;
    if (spawnCoordsMaterialized(bind)) continue;
    const coords = battleEnemySpawnCoords(bind, npc);
    const spawnUid = bind.spawnStep?.npcUid ?? resolveBattleEnemyNpcUidForIndex(giverNpcUid, i);
    if (
      patchBattleEnemySpawn(project, gameMap, giverNpcUid, {
        x: coords.x,
        y: coords.y,
        npcUid: spawnUid,
      }).ok
    ) {
      fixed += 1;
    }
  }
  return fixed;
}

/** 拖任务官前：物化该 NPC 关联的战斗敌人坐标，避免敌人跟随 giver 回退 */
export function materializeBattleEnemiesForGiver(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): void {
  materializeBattleEnemySpawnCoords(project, gameMap, giverNpcUid);
}

function ensureEnemyAppearNode(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): NpcBattleChainBind | null {
  let bind = resolveNpcBattleChain(project, gameMap, giverNpcUid);
  if (!bind?.enemyAppearNodeId) {
    if (!bind) return null;
    const graph = project.graphs.find((g) => g.id === gameMap.graphId);
    const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
    if (!graph || !npc?.zoneId) return null;

    const targetId = bind.battlePrepNodeId ?? bind.battleNodeId;
    if (!targetId) return null;

    const pred = findPredecessor(graph, targetId);
    const coords = battleEnemySpawnCoords(bind, npc);
    const spawnUid = bind.spawnStep?.npcUid ?? resolveBattleEnemyNpcUid(giverNpcUid);
    const zone = graph.maps?.find((m) => m.id === npc.zoneId);
    const baseX = (zone?.x ?? 40) + 600;
    const baseY = (zone?.y ?? 40) + 80;

    const enemyAppear = createNode({
      kind: "action",
      title: "敌人出现",
      mapId: npc.zoneId,
      actions: [
        {
          kind: "spawnNpc",
          npcUid: spawnUid,
          npcName: bind.enemyName,
          prefabKey: bind.spawnStep?.prefabKey,
          x: coords.x,
          y: coords.y,
        },
      ],
      position: pred?.position
        ? { x: pred.position.x + 160, y: pred.position.y }
        : { x: baseX, y: baseY },
      chainContinuous: true,
    });

    graph.nodes.push(enemyAppear);

    if (pred) {
      for (const node of graph.nodes) {
        for (const opt of node.options) {
          const targets = getOptionTargets(opt);
          if (targets.includes(targetId)) {
            setOptionTargets(
              opt,
              targets.map((t) => (t === targetId ? enemyAppear.id : t)),
            );
          }
        }
      }
    }
    connect(enemyAppear, targetId);
    bind = resolveNpcBattleChain(project, gameMap, giverNpcUid);
  }
  return bind;
}

function connect(from: StoryNode, toId: string, optionIndex = 0) {
  while (from.options.length <= optionIndex) {
    from.options.push({ id: `opt_${crypto.randomUUID()}`, text: "继续" });
  }
  const opt = from.options[optionIndex]!;
  const targets = getOptionTargets(opt);
  if (!targets.includes(toId)) setOptionTargets(opt, [...targets, toId]);
}

function findPredecessor(graph: GraphData, targetId: string): StoryNode | null {
  for (const node of graph.nodes) {
    for (const opt of node.options) {
      if (getOptionTargets(opt).includes(targetId)) return node;
    }
  }
  return null;
}

function defaultInsertAnchor(graph: GraphData, npc: GameMapDef["npcs"][number]): StoryNode | null {
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const turnIn = chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  if (turnIn) return findPredecessor(graph, turnIn.id);
  const exit = graph.nodes.find((n) => n.id === npc.exitNodeId);
  if (exit) return findPredecessor(graph, exit.id);
  return chain[chain.length - 1] ?? graph.nodes.find((n) => n.id === npc.entryNodeId) ?? null;
}

/** 为尚无战斗分支的任务链插入：敌人出现 → 战前选择 → 战斗 */
export function ensureBattleEnemyBranch(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
  options?: { battleRef?: string; battleResourceId?: string },
): NpcBattleChainBind | null {
  if (resolveNpcBattleChain(project, gameMap, giverNpcUid)) {
    return resolveNpcBattleChain(project, gameMap, giverNpcUid);
  }

  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!graph || !npc?.zoneId) return null;

  const anchor = defaultInsertAnchor(graph, npc);
  if (!anchor) return null;

  const zone = graph.maps?.find((m) => m.id === npc.zoneId);
  const baseX = (zone?.x ?? 40) + 600;
  const baseY = (zone?.y ?? 40) + 80;
  const battleRef = options?.battleRef ?? defaultBattleRef();
  const giverResourceId = npc.npcResourceId ?? npc.npcUid;
  const battleResourceId =
    options?.battleResourceId ?? pickRandomBattleResourceId(project, giverResourceId);
  const battleRes = (project.resources?.npc ?? []).find((r) => r.id === battleResourceId);
  const battleName = battleRes?.name ?? "敌人";
  const spawnUid = `${npc.npcUid}_enemy`;
  const coords = battleEnemySpawnCoords(
    { giverNpcUid, enemyAppearNodeId: null, battlePrepNodeId: null, battleNodeId: null, turnInNodeId: null, spawnStep: null, battleConfigId: battleRef, enemyName: battleName },
    npc,
  );

  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const turnIn = chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  const questId = turnIn?.questId ?? project.quests[0]?.id;

  const enemyAppear = createNode({
    kind: "action",
    title: "敌人出现",
    mapId: npc.zoneId,
    actions: [
      {
        kind: "spawnNpc",
        npcUid: spawnUid,
        npcName: battleName,
        prefabKey: battleRes?.image,
        x: coords.x,
        y: coords.y,
      },
    ],
    position: { x: baseX, y: baseY },
    chainContinuous: true,
  });

  const battlePrep = createNode({
    kind: "choice",
    title: "战前选择",
    mapId: npc.zoneId,
    options: [
      { id: `opt_${crypto.randomUUID()}`, text: "进入战斗", forcedResult: "start_battle", completesEvent: true },
      { id: `opt_${crypto.randomUUID()}`, text: "稍后再来", completesEvent: false, forcedResult: "block" },
    ],
    position: { x: baseX + 160, y: baseY },
    chainContinuous: true,
  });

  const battle = createNode({
    kind: "battle",
    title: "战斗",
    mapId: npc.zoneId,
    battleConfigId: battleRef,
    markerHint: `与${battleName}对战`,
    requirements: questId ? [{ kind: "questStatus", questId, status: "InProgress" }] : [],
    position: { x: baseX + 320, y: baseY },
    chainContinuous: true,
  });

  graph.nodes.push(enemyAppear, battlePrep, battle);
  withBattleRole(enemyAppear, "enemyAppear");
  withBattleRole(battlePrep, "battlePrep");
  withBattleRole(battle, "battle");

  connect(enemyAppear, battlePrep.id);
  connect(battlePrep, battle.id, 0);

  if (turnIn) {
    turnIn.requirements = [{ kind: "eventDone", eventId: resolveBattleEnemyBattleEventId(spawnUid) }];
  }

  return resolveNpcBattleChain(project, gameMap, giverNpcUid);
}

export function patchBattleEnemySpawnAtChainIndex(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
  chainIndex: number,
  patch: Partial<Pick<SpawnNpcStep, "x" | "y" | "prefabKey" | "npcName" | "npcUid">>,
): PatchBattleEnemySpawnResult {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return { ok: false, reason: "未找到地图剧情画布" };

  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  const bind = chains[chainIndex] ?? null;
  if (!bind?.enemyAppearNodeId) {
    return patchBattleEnemySpawn(project, gameMap, giverNpcUid, patch);
  }

  const node = graph.nodes.find((n) => n.id === bind.enemyAppearNodeId);
  if (!node || node.kind !== "action") {
    return { ok: false, reason: "敌人出现节点无效" };
  }

  let step = findSpawnStep(node);
  if (!step) {
    const spawnUid = patch.npcUid ?? resolveBattleEnemyNpcUidForIndex(giverNpcUid, chainIndex);
    step = { kind: "spawnNpc", npcUid: spawnUid, npcName: bind.enemyName };
    node.actions = [...(node.actions ?? []), step];
  }

  if (patch.x !== undefined) step.x = patch.x;
  if (patch.y !== undefined) step.y = patch.y;
  if (patch.prefabKey !== undefined) step.prefabKey = patch.prefabKey;
  if (patch.npcName !== undefined) step.npcName = patch.npcName;
  if (patch.npcUid !== undefined) step.npcUid = patch.npcUid;

  const battle = bind.battleNodeId ? graph.nodes.find((n) => n.id === bind.battleNodeId) : null;
  if (battle?.kind === "battle" && patch.npcName) {
    battle.markerHint = `与${patch.npcName}对战`;
  }

  return { ok: true };
}

/** 多敌人：按链序修正 spawnUid，避免多条分支共用同一 _enemy */
export function normalizeMultiEnemySpawnUids(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
  graphOverride?: GraphData,
): number {
  const graph = graphOverride ?? project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return 0;

  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  if (chains.length <= 1) return 0;

  let fixed = 0;
  for (let i = 0; i < chains.length; i++) {
    const expected = resolveBattleEnemyNpcUidForIndex(giverNpcUid, i);
    const bind = chains[i]!;
    if (bind.spawnStep?.npcUid === expected) continue;
    if (patchBattleEnemySpawnAtChainIndex(project, gameMap, giverNpcUid, i, { npcUid: expected }).ok) {
      fixed += 1;
    }
  }
  return fixed;
}

/** 补全侧链上缺失的战前/战斗节点（敌人出现节点已存在） */
export function ensureSideChainBattleNodes(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
  chainIndex: number,
): boolean {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!graph || !npc?.zoneId) return false;

  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  const bind = chains[chainIndex];
  if (!bind?.enemyAppearNodeId) return false;
  if (bind.battlePrepNodeId && bind.battleNodeId) return false;

  const enemyAppear = graph.nodes.find((n) => n.id === bind.enemyAppearNodeId);
  if (!enemyAppear) return false;

  const zone = graph.maps?.find((m) => m.id === npc.zoneId);
  const baseX = enemyAppear.position?.x ?? (zone?.x ?? 40) + 600;
  const baseY = enemyAppear.position?.y ?? (zone?.y ?? 40) + 80 + chainIndex * 120;
  const battleRef = bind.battleConfigId ?? defaultBattleRef();
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const turnIn = chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  const questId = turnIn?.questId ?? project.quests[0]?.id;

  let battlePrep = bind.battlePrepNodeId ? graph.nodes.find((n) => n.id === bind.battlePrepNodeId) : undefined;
  let battle = bind.battleNodeId ? graph.nodes.find((n) => n.id === bind.battleNodeId) : undefined;

  if (!battlePrep) {
    battlePrep = createNode({
      kind: "choice",
      title: BATTLE_TITLE_BATTLE_PREP,
      mapId: npc.zoneId,
      options: [
        { id: `opt_${crypto.randomUUID()}`, text: "进入战斗", forcedResult: "start_battle", completesEvent: true },
        { id: `opt_${crypto.randomUUID()}`, text: "稍后再来", completesEvent: false, forcedResult: "block" },
      ],
      position: { x: baseX + 160, y: baseY },
      chainContinuous: true,
    });
    graph.nodes.push(battlePrep);
    withBattleRole(battlePrep, "battlePrep");
    connect(enemyAppear, battlePrep.id);
  }

  if (!battle) {
    battle = createNode({
      kind: "battle",
      title: "战斗",
      mapId: npc.zoneId,
      battleConfigId: battleRef,
      markerHint: `与${bind.enemyName}对战`,
      requirements: questId ? [{ kind: "questStatus", questId, status: "InProgress" }] : [],
      position: { x: baseX + 320, y: baseY },
      chainContinuous: true,
    });
    graph.nodes.push(battle);
    withBattleRole(battle, "battle");
    connect(battlePrep, battle.id, 0);
  }

  return true;
}

export function patchBattleEnemySpawn(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
  patch: Partial<Pick<SpawnNpcStep, "x" | "y" | "prefabKey" | "npcName" | "npcUid">>,
): PatchBattleEnemySpawnResult {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return { ok: false, reason: "未找到地图剧情画布" };

  const targetSpawnUid = patch.npcUid;
  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  let bind =
    (targetSpawnUid
      ? chains.find(
          (c, i) =>
            c.spawnStep?.npcUid === targetSpawnUid ||
            (targetSpawnUid === resolveBattleEnemyNpcUidForIndex(giverNpcUid, i) && c.enemyAppearNodeId),
        )
      : null) ??
    chains[0] ??
    null;

  if (!bind?.enemyAppearNodeId) {
    bind = ensureEnemyAppearNode(project, gameMap, giverNpcUid);
  }
  if (!bind?.enemyAppearNodeId) {
    return { ok: false, reason: "未找到战斗分支，请先添加「+ 战斗分支」" };
  }

  const node = graph.nodes.find((n) => n.id === bind.enemyAppearNodeId);
  if (!node || node.kind !== "action") {
    return { ok: false, reason: "敌人出现节点无效" };
  }

  let step = findSpawnStep(node);
  if (!step) {
    step = { kind: "spawnNpc", npcUid: `${giverNpcUid}_enemy`, npcName: bind.enemyName };
    node.actions = [...(node.actions ?? []), step];
  }

  if (patch.x !== undefined) step.x = patch.x;
  if (patch.y !== undefined) step.y = patch.y;
  if (patch.prefabKey !== undefined) step.prefabKey = patch.prefabKey;
  if (patch.npcName !== undefined) step.npcName = patch.npcName;
  if (patch.npcUid !== undefined) step.npcUid = patch.npcUid;

  const battle = bind.battleNodeId ? graph.nodes.find((n) => n.id === bind.battleNodeId) : null;
  if (battle?.kind === "battle" && patch.npcName) {
    battle.markerHint = `与${patch.npcName}对战`;
  }

  return { ok: true };
}

function rewireAroundRemoved(graph: GraphData, removedIds: Set<string>, giverNpc: GameMapDef["npcs"][number]) {
  const exit = giverNpc.exitNodeId ? graph.nodes.find((n) => n.id === giverNpc.exitNodeId) : null;
  for (const node of graph.nodes) {
    for (const opt of node.options) {
      const targets = getOptionTargets(opt);
      const filtered = targets.filter((t) => !removedIds.has(t));
      if (filtered.length !== targets.length) {
        const fallback = exit?.id ?? filtered[0];
        setOptionTargets(opt, filtered.length ? filtered : fallback ? [fallback] : []);
      }
    }
  }
}

/** 删除任务链内全部战斗分支（敌人出现 / 战前 / 战斗），保留接取与交任务 */
export function removeBattleEnemyBranch(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): boolean {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  const chains = resolveNpcBattleChains(project, gameMap, giverNpcUid, graph);
  if (!graph || !npc || chains.length === 0) return false;

  const removeIds = new Set<string>();
  for (const bind of chains) {
    for (const id of battleChainNodeIds(bind)) removeIds.add(id);
  }
  if (removeIds.size === 0) return false;

  const turnInId = chains[0]?.turnInNodeId;
  const turnIn = turnInId ? graph.nodes.find((n) => n.id === turnInId) : null;
  if (turnIn) {
    turnIn.requirements = (turnIn.requirements ?? []).filter((r) => r.kind !== "eventDone");
  }

  rewireAroundRemoved(graph, removeIds, npc);
  graph.nodes = graph.nodes.filter((n) => !removeIds.has(n.id));
  return true;
}

export function battleChainNodeIds(bind: NpcBattleChainBind): string[] {
  return [bind.enemyAppearNodeId, bind.battlePrepNodeId, bind.battleNodeId].filter(Boolean) as string[];
}

/** 战斗敌人独立 runtime NPC 上 battle 环的 eventId（战前选择=e1，战斗=e2） */
export function resolveBattleEnemyBattleEventId(spawnUid: string): string {
  return `${spawnUid}_e2`;
}

/** 导出任务官链时跳过：这些节点属于地图战斗敌人，不应在任务官处触发 */
export function isBattleBranchEditorNode(node: StoryNode): boolean {
  if (node.kind === "battle" || battleRoleOf(node) === "battle") return true;
  if (isBattlePrepNode(node)) return true;
  if (isEnemyAppearNode(node)) return true;
  const spawn = findSpawnStep(node);
  if (spawn?.npcUid?.includes("_enemy")) return true;
  return false;
}

export function resolveBattleEnemyBattleEventIdForGiver(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  giverNpcUid: string,
  graphOverride?: GraphData,
): string | null {
  const bind = resolveNpcBattleChain(project, gameMap, giverNpcUid, graphOverride);
  if (!bind?.battleNodeId || !bind.enemyAppearNodeId) return null;
  const spawnUid = bind.spawnStep?.npcUid ?? resolveBattleEnemyNpcUid(giverNpcUid);
  return resolveBattleEnemyBattleEventId(spawnUid);
}
