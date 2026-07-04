/**
 * NPC 剧情链预设 — 战斗遭遇采用「单 NPC 任务链 + 分支节点」模式。
 * 接取 → 敌人出现(spawn) → 战前选择 → 战斗 → 交任务，全在同一剧情链/摆点内管控。
 */
import type { GameMapDef, GameMapNpcDef, ProjectData, StoryNode } from "../types";
import { createNode, getOptionTargets, setOptionTargets } from "../types";
import {
  resolveBattleEnemyBattleEventId,
  resolveBattleEnemyNpcUidForIndex,
  resolveNpcBattleChains,
  syncTurnInEventDoneForChains,
  withBattleRole,
} from "./battle-enemy-bind";
import { defaultBattleRef } from "./client-runtime-manifest";
import { resolveQuestNumericTaskId } from "./quest-logic";

export type NpcChainPreset = "empty" | "battleEncounter" | "multiEnemyBattle";

export type MultiEnemyBattleResult = {
  npc: GameMapNpcDef;
  enemySpawnUids: string[];
  battleEventIds: string[];
};

export type MultiEnemyBattleOptions = {
  enemyCount: number;
  battleRefs?: string[];
  questId?: string;
  acceptOptionText?: string;
  deferOptionText?: string;
};

export type UnifiedBattleEncounterResult = {
  npc: GameMapNpcDef;
  battleEventId: string;
  /** 运行时 spawn_npc 用，不单独占 gameMap 摆点 */
  enemySpawnUid: string;
};

/** @deprecated 分离模式遗留类型 */
export type SplitBattleEncounterResult = {
  giverNpc: GameMapNpcDef;
  battleNpc: GameMapNpcDef;
  battleEventId: string;
};

function connect(from: StoryNode, toId: string, optionIndex = 0) {
  while (from.options.length <= optionIndex) {
    from.options.push({ id: `opt_${crypto.randomUUID()}`, text: "继续" });
  }
  const opt = from.options[optionIndex]!;
  const targets = getOptionTargets(opt);
  if (!targets.includes(toId)) setOptionTargets(opt, [...targets, toId]);
}

/** 从资源库随机选一个战斗 NPC 资源（尽量与任务 NPC 不同） */
export function pickRandomBattleResourceId(project: ProjectData, excludeResourceId: string): string {
  const pool = (project.resources?.npc ?? []).filter((r) => r.id !== excludeResourceId);
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)]!.id;
  }
  return excludeResourceId;
}

function enemySpawnUid(giverUid: string): string {
  return `${giverUid}_enemy`;
}

/**
 * 单 NPC 统一战斗链：
 * 对话 → 接取 → 提示 → [分支]敌人出现 → [分支]战前选择 → 战斗 → 交任务
 */
export function wireUnifiedBattleEncounterChain(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
  options?: { battleRef?: string; questId?: string; battleResourceId?: string },
): UnifiedBattleEncounterResult | null {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || graph.kind !== "map") return null;

  const questId = options?.questId ?? project.quests[0]?.id;
  if (!questId) return null;

  const entry = graph.nodes.find((n) => n.id === npc.entryNodeId);
  const exit = graph.nodes.find((n) => n.id === npc.exitNodeId);
  if (!entry || !exit || !npc.zoneId) return null;

  npc.appear = { mode: "always", matchMode: "ALL", requirements: [] };

  const zone = graph.maps?.find((m) => m.id === npc.zoneId);
  const baseX = zone?.x ?? 40;
  const baseY = zone?.y ?? 40;
  const name = npc.npcName || entry.title || "NPC";
  const taskId = resolveQuestNumericTaskId(project, questId);

  const battleRef = options?.battleRef ?? defaultBattleRef();
  const giverResourceId = npc.npcResourceId ?? npc.npcUid;
  const battleResourceId =
    options?.battleResourceId ?? pickRandomBattleResourceId(project, giverResourceId);
  const battleRes = (project.resources?.npc ?? []).find((r) => r.id === battleResourceId);
  const battleName = battleRes?.name ?? "敌人";
  const spawnUid = enemySpawnUid(npc.npcUid);

  const dialogOpen = createNode({
    kind: "dialog",
    title: "任务对话",
    speaker: name,
    mapId: npc.zoneId,
    dialogLines: [{ id: `line_${crypto.randomUUID()}`, text: `${name}：有件事需要你帮忙。` }],
    position: { x: baseX + 120, y: baseY + 80 },
  });

  const deferOptId = `opt_${crypto.randomUUID()}`;
  const choiceAccept = createNode({
    kind: "choice",
    title: "接取任务",
    mapId: npc.zoneId,
    options: [
      {
        id: `opt_${crypto.randomUUID()}`,
        text: "接受任务",
        ...(taskId ? { effectTaskAccept: taskId } : {}),
      },
      {
        id: deferOptId,
        text: "再想想",
        completesEvent: false,
        forcedResult: "block",
      },
    ],
    position: { x: baseX + 280, y: baseY + 80 },
    chainContinuous: true,
  });

  const dialogHint = createNode({
    kind: "dialog",
    title: "任务提示",
    speaker: name,
    mapId: npc.zoneId,
    dialogLines: [
      {
        id: `line_${crypto.randomUUID()}`,
        text: `${name}：敌人已在附近出现，找到并击败后再来找我交任务。`,
      },
    ],
    position: { x: baseX + 440, y: baseY + 80 },
    chainContinuous: true,
  });

  /** 编辑器元数据：摆点坐标/形象（导出为独立地图战斗 NPC，不在此链触发战斗） */
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
        x: Math.round((npc.x ?? 192) + 96),
        y: Math.round(npc.y ?? 192),
      },
    ],
    position: { x: baseX + 600, y: baseY + 80 },
    chainContinuous: true,
  });

  /** 地图战斗敌人交互链：接触 → 战前选择 → 战斗（导出到独立 runtime NPC） */
  const battlePrep = createNode({
    kind: "choice",
    title: "战前选择",
    mapId: npc.zoneId,
    options: [
      {
        id: `opt_${crypto.randomUUID()}`,
        text: "进入战斗",
        forcedResult: "start_battle",
        completesEvent: true,
      },
      {
        id: `opt_${crypto.randomUUID()}`,
        text: "稍后再来",
        completesEvent: false,
        forcedResult: "block",
      },
    ],
    position: { x: baseX + 760, y: baseY + 160 },
    chainContinuous: true,
  });

  const battle = createNode({
    kind: "battle",
    title: "战斗",
    mapId: npc.zoneId,
    battleConfigId: battleRef,
    markerHint: `与${battleName}对战`,
    requirements: [{ kind: "questStatus", questId, status: "InProgress" }],
    position: { x: baseX + 920, y: baseY + 160 },
    chainContinuous: true,
  });

  const turnIn = createNode({
    kind: "questUpdate",
    title: "交任务",
    mapId: npc.zoneId,
    questId,
    questStatus: "Completed",
    position: { x: baseX + 1080, y: baseY + 80 },
    chainContinuous: true,
  });

  graph.nodes.push(dialogOpen, choiceAccept, dialogHint, enemyAppear, battlePrep, battle, turnIn);
  withBattleRole(enemyAppear, "enemyAppear");
  withBattleRole(battlePrep, "battlePrep");
  withBattleRole(battle, "battle");
  connect(entry, dialogOpen.id);
  connect(dialogOpen, choiceAccept.id);
  connect(choiceAccept, dialogHint.id, 0);
  connect(choiceAccept, exit.id, 1);
  connect(dialogHint, turnIn.id);
  connect(turnIn, exit.id);
  connect(enemyAppear, battlePrep.id);
  connect(battlePrep, battle.id, 0);
  if (exit.hideNpcOnEnd == null) exit.hideNpcOnEnd = true;

  const battleEventId = resolveBattleEnemyBattleEventId(spawnUid);
  turnIn.requirements = [{ kind: "eventDone", eventId: battleEventId }];

  return { npc, battleEventId, enemySpawnUid: spawnUid };
}

/** 兼容旧名：现为统一链，不再创建 _battle 摆点 */
export function wireSplitBattleEncounter(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpc: GameMapNpcDef,
  options?: { battleRef?: string; questId?: string; battleResourceId?: string },
): SplitBattleEncounterResult | null {
  const hit = wireUnifiedBattleEncounterChain(project, gameMap, giverNpc, options);
  if (!hit) return null;
  return {
    giverNpc: hit.npc,
    battleNpc: hit.npc,
    battleEventId: hit.battleEventId,
  };
}

/** @deprecated */
export function wireQuestGiverChain(
  project: ProjectData,
  gameMap: GameMapDef,
  giverNpc: GameMapNpcDef,
  options: { questId: string; battleEventId: string },
): boolean {
  return wireUnifiedBattleEncounterChain(project, gameMap, giverNpc, {
    questId: options.questId,
  }) != null;
}

/** @deprecated 分离模式遗留；统一链内 battle 节点已包含战前 choice */
export function wireBattleTargetChain(
  _project: ProjectData,
  _gameMap: GameMapDef,
  _battleNpc: GameMapNpcDef,
  _options: { battleRef: string; battleName: string },
): boolean {
  return false;
}

export function wireBattleEncounterChain(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
  options?: { battleRef?: string; questId?: string },
): boolean {
  return wireUnifiedBattleEncounterChain(project, gameMap, npc, options) != null;
}

function appendEnemyBranchSideChain(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
  index: number,
  options: { battleRef: string; battleResourceId: string; battleName: string; questId: string },
): string | null {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || !npc.zoneId) return null;

  const zone = graph.maps?.find((m) => m.id === npc.zoneId);
  const baseX = (zone?.x ?? 40) + 600;
  const baseY = (zone?.y ?? 40) + 80 + index * 120;
  const spawnUid = resolveBattleEnemyNpcUidForIndex(npc.npcUid, index);
  const battleRes = (project.resources?.npc ?? []).find((r) => r.id === options.battleResourceId);

  const enemyAppear = createNode({
    kind: "action",
    title: "敌人出现",
    mapId: npc.zoneId,
    actions: [
      {
        kind: "spawnNpc",
        npcUid: spawnUid,
        npcName: `${options.battleName}${index > 0 ? index + 1 : ""}`,
        prefabKey: battleRes?.image,
        x: Math.round((npc.x ?? 192) + 96 + index * 80),
        y: Math.round((npc.y ?? 192) + index * 48),
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
    battleConfigId: options.battleRef,
    markerHint: `与${options.battleName}对战`,
    requirements: [{ kind: "questStatus", questId: options.questId, status: "InProgress" }],
    position: { x: baseX + 320, y: baseY },
    chainContinuous: true,
  });

  graph.nodes.push(enemyAppear, battlePrep, battle);
  withBattleRole(enemyAppear, "enemyAppear");
  withBattleRole(battlePrep, "battlePrep");
  withBattleRole(battle, "battle");
  connect(enemyAppear, battlePrep.id);
  connect(battlePrep, battle.id, 0);
  return spawnUid;
}

/**
 * 多敌人战斗链：接取后 task_active 显现 N 个敌人；各敌人独立战斗；全部击败后可交任务；暂缓不显示敌人。
 */
export function wireMultiEnemyBattleChain(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
  options: MultiEnemyBattleOptions,
): MultiEnemyBattleResult | null {
  const count = Math.max(1, Math.min(99, Math.floor(options.enemyCount)));
  const acceptText = options.acceptOptionText?.trim() || "接取任务";
  const deferText = options.deferOptionText?.trim() || "暂缓";

  if (count === 1) {
    const hit = wireUnifiedBattleEncounterChain(project, gameMap, npc, {
      questId: options.questId,
      battleRef: options.battleRefs?.[0],
    });
    if (!hit) return null;
    return {
      npc: hit.npc,
      enemySpawnUids: [hit.enemySpawnUid],
      battleEventIds: [hit.battleEventId],
    };
  }

  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || graph.kind !== "map") return null;
  const questId = options.questId ?? project.quests[0]?.id;
  if (!questId) return null;

  const entry = graph.nodes.find((n) => n.id === npc.entryNodeId);
  const exit = graph.nodes.find((n) => n.id === npc.exitNodeId);
  if (!entry || !exit || !npc.zoneId) return null;

  const existingChain = graph.nodes.some(
    (n) => n.kind === "questUpdate" && n.questStatus === "Completed" && n.mapId === npc.zoneId,
  );

  if (!existingChain) {
    npc.appear = { mode: "always", matchMode: "ALL", requirements: [] };
    const zone = graph.maps?.find((m) => m.id === npc.zoneId);
    const baseX = zone?.x ?? 40;
    const baseY = zone?.y ?? 40;
    const name = npc.npcName || entry.title || "NPC";
    const taskId = resolveQuestNumericTaskId(project, questId);
    const battleRef = options.battleRefs?.[0] ?? defaultBattleRef();
    const giverResourceId = npc.npcResourceId ?? npc.npcUid;
    const battleResourceId = pickRandomBattleResourceId(project, giverResourceId);
    const battleRes = (project.resources?.npc ?? []).find((r) => r.id === battleResourceId);
    const battleName = battleRes?.name ?? "敌人";

    const dialogOpen = createNode({
      kind: "dialog",
      title: "任务对话",
      speaker: name,
      mapId: npc.zoneId,
      dialogLines: [{ id: `line_${crypto.randomUUID()}`, text: `${name}：有件事需要你帮忙。` }],
      position: { x: baseX + 120, y: baseY + 80 },
    });

    const choiceAccept = createNode({
      kind: "choice",
      title: "接取任务",
      mapId: npc.zoneId,
      options: [
        {
          id: `opt_${crypto.randomUUID()}`,
          text: acceptText,
          ...(taskId ? { effectTaskAccept: taskId } : {}),
        },
        {
          id: `opt_${crypto.randomUUID()}`,
          text: deferText,
          completesEvent: false,
          forcedResult: "block",
        },
      ],
      position: { x: baseX + 280, y: baseY + 80 },
      chainContinuous: true,
    });

    const dialogHint = createNode({
      kind: "dialog",
      title: "任务提示",
      speaker: name,
      mapId: npc.zoneId,
      dialogLines: [
        {
          id: `line_${crypto.randomUUID()}`,
          text: `${name}：附近出现了 ${count} 个敌人，逐个击败后再来找我交任务。`,
        },
      ],
      position: { x: baseX + 440, y: baseY + 80 },
      chainContinuous: true,
    });

    const turnIn = createNode({
      kind: "questUpdate",
      title: "交任务",
      mapId: npc.zoneId,
      questId,
      questStatus: "Completed",
      position: { x: baseX + 1080, y: baseY + 80 },
      chainContinuous: true,
    });

    graph.nodes.push(dialogOpen, choiceAccept, dialogHint, turnIn);
    connect(entry, dialogOpen.id);
    connect(dialogOpen, choiceAccept.id);
    connect(choiceAccept, dialogHint.id, 0);
    connect(choiceAccept, exit.id, 1);
    connect(dialogHint, turnIn.id);
    connect(turnIn, exit.id);
    if (exit.hideNpcOnEnd == null) exit.hideNpcOnEnd = true;

    for (let i = 0; i < count; i++) {
      const ref = options.battleRefs?.[i] ?? options.battleRefs?.[0] ?? battleRef;
      appendEnemyBranchSideChain(project, gameMap, npc, i, {
        battleRef: ref,
        battleResourceId,
        battleName,
        questId,
      });
    }
  } else {
    const existing = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph).length;
    const battleRef = options.battleRefs?.[0] ?? defaultBattleRef();
    const giverResourceId = npc.npcResourceId ?? npc.npcUid;
    const battleResourceId = pickRandomBattleResourceId(project, giverResourceId);
    const battleRes = (project.resources?.npc ?? []).find((r) => r.id === battleResourceId);
    const battleName = battleRes?.name ?? "敌人";
    for (let i = existing; i < count; i++) {
      const ref = options.battleRefs?.[i] ?? battleRef;
      appendEnemyBranchSideChain(project, gameMap, npc, i, {
        battleRef: ref,
        battleResourceId,
        battleName,
        questId,
      });
    }
  }

  syncTurnInEventDoneForChains(project, gameMap, npc.npcUid);
  const spawnUids: string[] = [];
  const eventIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const uid = resolveBattleEnemyNpcUidForIndex(npc.npcUid, i);
    spawnUids.push(uid);
    eventIds.push(resolveBattleEnemyBattleEventId(uid));
  }
  return { npc, enemySpawnUids: spawnUids, battleEventIds: eventIds };
}

/** 从 brief.constraints 解析 multiEnemyBattle 参数 */
export function parseMultiEnemyBattleFromBrief(constraints: string[] | undefined): MultiEnemyBattleOptions | null {
  if (!constraints?.some((c) => c === "multiEnemyBattle" || c.startsWith("multiEnemyBattle"))) return null;
  let enemyCount = 2;
  let acceptOptionText: string | undefined;
  let deferOptionText: string | undefined;
  for (const c of constraints) {
    const countM = c.match(/^enemyCount:(\d+)$/);
    if (countM) enemyCount = Math.max(1, parseInt(countM[1]!, 10));
    const acceptM = c.match(/^acceptLabel:(.+)$/);
    if (acceptM) acceptOptionText = acceptM[1];
    const deferM = c.match(/^deferLabel:(.+)$/);
    if (deferM) deferOptionText = deferM[1];
  }
  return { enemyCount, acceptOptionText, deferOptionText };
}
