import type { GameMapDef, GameMapNpcDef, GraphData, ProjectData, StoryMapRegion, StoryNode } from "../types";
import { createGameMap, createGameMapNpc, createGraph, createNode } from "../types";
import { ensureGraphMaps } from "./mapLogic";
import { wireUnifiedBattleEncounterChain, type NpcChainPreset } from "./npc-chain-presets";
import { defaultBattleRef } from "./client-runtime-manifest";

export function ensureProjectGameMaps(project: ProjectData): GameMapDef[] {
  if (!Array.isArray(project.gameMaps)) project.gameMaps = [];
  return project.gameMaps;
}

export function findGameMapById(project: ProjectData, id: string): GameMapDef | undefined {
  return ensureProjectGameMaps(project).find((m) => m.id === id);
}

export function findGameMapForGraph(project: ProjectData, graphId: string): GameMapDef | undefined {
  return ensureProjectGameMaps(project).find((m) => m.graphId === graphId);
}

/** 创建游戏地图 + 对应 kind=map 的 graph */
export function createGameMapWithGraph(
  project: ProjectData,
  partial?: Partial<GameMapDef>,
): { gameMap: GameMapDef; graph: GraphData } {
  const graphId = partial?.graphId ?? `graph_map_${crypto.randomUUID()}`;
  const gameMap = createGameMap({
    ...partial,
    graphId,
    mapName: partial?.mapName ?? "新游戏地图",
    mapCode: partial?.mapCode ?? `map_${Date.now()}`,
  });
  const graph = createGraph({
    id: graphId,
    kind: "map",
    name: gameMap.mapName ?? gameMap.mapCode,
    nodes: [],
    maps: [],
  });
  project.graphs.push(graph);
  ensureProjectGameMaps(project).push(gameMap);
  return { gameMap, graph };
}

export function createNpcZone(npcUid: string, npcName: string, index: number): StoryMapRegion {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    id: `zone_${npcUid}`,
    name: npcName,
    npcUid,
    x: 40 + col * 520,
    y: 40 + row * 380,
    width: 480,
    height: 320,
  };
}

export function taskLabelForNpc(project: ProjectData, gameMap: GameMapDef, npc: GameMapNpcDef, index: number): string {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const entry = graph?.nodes.find((n) => n.id === npc.entryNodeId);
  return entry?.title?.trim() || `任务 ${index + 1}`;
}

/** 为 gameMap 中每个 NPC 确保 zone + npcEntry 节点存在 */
export function ensureNpcZonesAndEntries(project: ProjectData, gameMap: GameMapDef) {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || graph.kind !== "map") return;
  ensureGraphMaps(graph);

  gameMap.npcs.forEach((npc, index) => {
    const rid = npc.npcResourceId ?? npc.npcUid;
    const res = (project.resources?.npc ?? []).find((r) => r.id === rid);
    if (res && !npc.npcResourceId) npc.npcResourceId = res.id;

    const taskLabel = taskLabelForNpc(project, gameMap, npc, index);

    let zone = graph.maps!.find((m) => m.id === npc.zoneId);
    if (!zone) {
      zone = createNpcZone(npc.npcUid, taskLabel, index);
      npc.zoneId = zone.id;
      graph.maps!.push(zone);
    } else {
      zone.npcUid = npc.npcUid;
      zone.name = taskLabel;
    }

    if (!npc.exitNodeId) npc.exitNodeId = `exit_${npc.npcUid}`;

    let entry = graph.nodes.find((n) => n.id === npc.entryNodeId);
    if (!entry) {
      entry = createNode({
        id: npc.entryNodeId,
        kind: "npcEntry",
        title: `任务 ${index + 1}`,
        npcUid: npc.npcUid,
        mapId: zone.id,
        position: { x: zone.x + 24, y: zone.y + 80 },
      });
      graph.nodes.push(entry);
    } else {
      entry.kind = "npcEntry";
      entry.npcUid = npc.npcUid;
      entry.mapId = zone.id;
      if (!entry.title?.trim()) entry.title = `任务 ${index + 1}`;
      if (!entry.npcId && !entry.characterId && npc.npcResourceId) {
        entry.npcId = npc.npcResourceId;
      }
    }

    let exit = graph.nodes.find((n) => n.id === npc.exitNodeId);
    if (!exit) {
      exit = createNode({
        id: npc.exitNodeId,
        kind: "npcExit",
        title: `${taskLabel} · 结尾`,
        npcUid: npc.npcUid,
        mapId: zone.id,
        position: { x: zone.x + zone.width - 140, y: zone.y + 80 },
        hideNpcOnEnd: true,
      });
      graph.nodes.push(exit);
    } else {
      exit.kind = "npcExit";
      exit.npcUid = npc.npcUid;
      exit.mapId = zone.id;
      exit.title = `${taskLabel} · 结尾`;
      if (exit.hideNpcOnEnd == null) exit.hideNpcOnEnd = true;
    }
  });
}

/** 为同一资源生成唯一 npcUid（允许同资源多摆点） */
export function uniqueNpcUidForResource(gameMap: GameMapDef, resourceId: string): string {
  if (!gameMap.npcs.some((n) => n.npcUid === resourceId)) return resourceId;
  let i = 2;
  while (gameMap.npcs.some((n) => n.npcUid === `${resourceId}_${i}`)) i++;
  return `${resourceId}_${i}`;
}

export type AddNpcFromResourceResult = {
  giver: GameMapNpcDef;
  battleNpc?: GameMapNpcDef;
};

/** 从资源库 NPC 添加到地图（摆点 + 剧情区 + npcEntry） */
export function addNpcFromResource(
  project: ProjectData,
  gameMap: GameMapDef,
  npcResourceId: string,
  options?: {
    prefabKey?: string;
    x?: number;
    y?: number;
    chainPreset?: NpcChainPreset;
    battleRef?: string;
  },
): AddNpcFromResourceResult | null {
  const res = (project.resources?.npc ?? []).find((r) => r.id === npcResourceId);
  if (!res) return null;
  const npcUid = uniqueNpcUidForResource(gameMap, npcResourceId);
  const taskIndex = gameMap.npcs.length + 1;
  const giver = addNpcToGameMap(project, gameMap, {
    npcUid,
    npcName: `任务 ${taskIndex}`,
    npcResourceId: npcResourceId,
    prefabKey: options?.prefabKey,
    x: options?.x,
    y: options?.y,
    chainPreset: "empty",
    battleRef: options?.battleRef,
  });
  if (!giver) return null;

  let battleNpc: GameMapNpcDef | undefined;
  if (options?.chainPreset === "battleEncounter") {
    const battleRef = options.battleRef ?? defaultBattleRef();
    const unified = wireUnifiedBattleEncounterChain(project, gameMap, giver, { battleRef });
    if (unified) {
      ensureNpcZonesAndEntries(project, gameMap);
    }
  }

  return { giver, battleNpc };
}

/** 向游戏地图添加 NPC（含 zone + entry） */
export function addNpcToGameMap(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: {
    npcUid: string;
    npcName: string;
    npcResourceId?: string;
    prefabKey?: string;
    x?: number;
    y?: number;
    chainPreset?: NpcChainPreset;
    battleRef?: string;
  },
) {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return null;

  const def = createGameMapNpc({
    npcUid: npc.npcUid,
    npcName: npc.npcName,
    npcResourceId: npc.npcResourceId ?? npc.npcUid,
    prefabKey: npc.prefabKey,
    x: npc.x ?? 192,
    y: npc.y ?? 192,
  });
  gameMap.npcs.push(def);
  ensureNpcZonesAndEntries(project, gameMap);
  return def;
}

export function deleteNpcFromGameMap(project: ProjectData, gameMap: GameMapDef, npcUid: string) {
  const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (graph) {
    graph.nodes = graph.nodes.filter((n) => n.id !== npc.entryNodeId && n.id !== npc.exitNodeId && n.npcUid !== npcUid);
    ensureGraphMaps(graph);
    graph.maps = graph.maps!.filter((m) => m.id !== npc.zoneId);
    for (const n of graph.nodes) {
      if (n.mapId === npc.zoneId) delete n.mapId;
    }
  }
  gameMap.npcs = gameMap.npcs.filter((n) => n.npcUid !== npcUid);
}

export function deleteGameMap(project: ProjectData, gameMapId: string) {
  const gm = findGameMapById(project, gameMapId);
  if (!gm) return;
  project.graphs = project.graphs.filter((g) => g.id !== gm.graphId);
  project.gameMaps = ensureProjectGameMaps(project).filter((m) => m.id !== gameMapId);
}

/** 收集项目中所有入口节点（npcEntry / questEntry） */
export function collectAllEntryNodes(project: ProjectData): StoryNode[] {
  const out: StoryNode[] = [];
  for (const g of project.graphs) {
    for (const n of g.nodes) {
      if (n.kind === "npcEntry" || n.kind === "questEntry") out.push(n);
    }
  }
  return out;
}

/**
 * 跨画布镜像入口：仅展示与当前画布有关联的 entry，避免把整个项目的任务入口都堆到地图上。
 * - 地图画布：只镜像左栏「关联全局画布」里勾选的 graph 的 entry
 * - 主线/支线/任务画布：只镜像「关联了本 graph 的游戏地图」上的 npcEntry
 */
export function getGhostEntryNodesForGraph(project: ProjectData, graphId: string): StoryNode[] {
  const entries = collectAllEntryNodes(project);
  const entryOwnerGraphId = new Map<string, string>();
  for (const g of project.graphs) {
    for (const n of g.nodes) {
      if (n.kind === "npcEntry" || n.kind === "questEntry") entryOwnerGraphId.set(n.id, g.id);
    }
  }

  const currentGm = findGameMapForGraph(project, graphId);
  if (currentGm) {
    const linked = new Set(currentGm.linkedGraphIds ?? []);
    return entries.filter((e) => {
      const ownerId = entryOwnerGraphId.get(e.id);
      if (!ownerId || ownerId === graphId) return false;
      return linked.has(ownerId);
    });
  }

  const linkedMapGraphIds = ensureProjectGameMaps(project)
    .filter((gm) => (gm.linkedGraphIds ?? []).includes(graphId))
    .map((gm) => gm.graphId);

  return entries.filter((e) => {
    if (e.kind !== "npcEntry") return false;
    const ownerId = entryOwnerGraphId.get(e.id);
    if (!ownerId || ownerId === graphId) return false;
    return linkedMapGraphIds.includes(ownerId);
  });
}

export function isEntryNodeKind(kind: StoryNode["kind"]): boolean {
  return kind === "npcEntry" || kind === "questEntry";
}

export function isExitNodeKind(kind: StoryNode["kind"]): boolean {
  return kind === "taskEnd" || kind === "npcExit";
}

/** 从运行时 map JSON 同步 NPC 摆点（保留已有 entry/zone 与剧情节点） */
export function syncGameMapNpcsFromRuntime(
  project: ProjectData,
  gameMap: GameMapDef,
  runtimeNpcs: Array<{ npcUid?: string; npcName?: string; prefabKey?: string; x?: number; y?: number }>,
) {
  for (const row of runtimeNpcs) {
    const uid = String(row.npcUid ?? "").trim();
    if (!uid) continue;
    let npc = gameMap.npcs.find((n) => n.npcUid === uid);
    if (!npc) {
      npc = createGameMapNpc({
        npcUid: uid,
        npcName: row.npcName ?? uid,
        npcResourceId: uid,
        prefabKey: row.prefabKey,
        x: row.x ?? 192,
        y: row.y ?? 192,
      });
      gameMap.npcs.push(npc);
    } else {
      npc.npcName = row.npcName ?? npc.npcName;
      npc.prefabKey = row.prefabKey ?? npc.prefabKey;
      if (Number.isFinite(row.x)) npc.x = row.x!;
      if (Number.isFinite(row.y)) npc.y = row.y!;
    }
  }
  ensureNpcZonesAndEntries(project, gameMap);
}

/** 查找 option 目标是否为本项目内的 entry 节点 */
export function findEntryNodeById(project: ProjectData, nodeId: string): StoryNode | undefined {
  for (const g of project.graphs) {
    const n = g.nodes.find((x) => x.id === nodeId && isEntryNodeKind(x.kind));
    if (n) return n;
  }
  return undefined;
}
