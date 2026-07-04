import type { GameMapDef, ProjectData } from "../types";
import { createGameMapWithGraph, ensureProjectGameMaps, findGameMapById } from "./game-map-logic";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "./map-slice-layout";

export type GameMapTreeNode = {
  gameMap: GameMapDef;
  children: GameMapTreeNode[];
};

export function getMapChildren(project: ProjectData, parentId: string | null): GameMapDef[] {
  const maps = ensureProjectGameMaps(project);
  return maps
    .filter((m) => (m.parentGameMapId ?? null) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
}

export function getRootGameMaps(project: ProjectData): GameMapDef[] {
  const maps = ensureProjectGameMaps(project);
  const portalIds = new Set(maps.filter((m) => m.mapPortalNodeId).map((m) => m.id));
  return maps
    .filter((m) => (!m.parentGameMapId && portalIds.has(m.id)) || (!m.parentGameMapId && !m.mapPortalNodeId))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
}

/** 时间线门户绑定的顶层地图 */
export function getTimelineRootMaps(project: ProjectData): GameMapDef[] {
  const timeline = getTimelineGraph(project);
  if (!timeline) return getRootGameMaps(project);
  const portalMapIds = timeline.nodes.filter((n) => n.kind === "mapPortal" && n.gameMapId).map((n) => n.gameMapId!);
  const seen = new Set<string>();
  const out: GameMapDef[] = [];
  for (const id of portalMapIds) {
    if (seen.has(id)) continue;
    const gm = findGameMapById(project, id);
    if (gm) {
      seen.add(id);
      out.push(gm);
    }
  }
  return out;
}

export function buildGameMapTree(project: ProjectData, rootParentId: string | null = null): GameMapTreeNode[] {
  return getMapChildren(project, rootParentId).map((gameMap) => ({
    gameMap,
    children: buildGameMapTree(project, gameMap.id),
  }));
}

export function getMapAncestors(project: ProjectData, gameMapId: string): GameMapDef[] {
  const out: GameMapDef[] = [];
  let cur = findGameMapById(project, gameMapId);
  while (cur) {
    out.unshift(cur);
    if (!cur.parentGameMapId) break;
    cur = findGameMapById(project, cur.parentGameMapId);
  }
  return out;
}

export function getNextMapId(project: ProjectData): number {
  const maps = ensureProjectGameMaps(project);
  let max = 0;
  for (const m of maps) {
    if (m.mapId > max) max = m.mapId;
  }
  return max + 1;
}

export function createChildGameMap(
  project: ProjectData,
  parentGameMapId: string | null,
  partial?: { mapName?: string; mapCode?: string },
): { gameMap: GameMapDef; graph: import("../types").GraphData } {
  const siblings = getMapChildren(project, parentGameMapId);
  const nextSort = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder ?? 0)) + 1 : 0;
  const mapId = getNextMapId(project);
  const code = partial?.mapCode ?? `map_${mapId}`;
  const { gameMap, graph } = createGameMapWithGraph(project, {
    mapCode: code,
    mapName: partial?.mapName ?? `子地图 ${mapId}`,
    mapId,
    parentGameMapId: parentGameMapId ?? undefined,
    sortOrder: nextSort,
    ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    npcs: [],
  });
  return { gameMap, graph };
}

export function getTimelineGraph(project: ProjectData) {
  const id = project.timelineGraphId;
  if (!id) return project.graphs.find((g) => g.kind === "timeline");
  return project.graphs.find((g) => g.id === id);
}

export function ensureTimelineGraph(project: ProjectData) {
  let g = getTimelineGraph(project);
  if (!g) {
    g = {
      id: `g_timeline_${crypto.randomUUID().slice(0, 8)}`,
      name: "游戏时间线",
      kind: "timeline",
      nodes: [],
      maps: [],
    };
    project.graphs.unshift(g);
    project.timelineGraphId = g.id;
  } else if (!project.timelineGraphId) {
    project.timelineGraphId = g.id;
  }
  return g;
}

export function countChildMaps(project: ProjectData, gameMapId: string): number {
  return getMapChildren(project, gameMapId).length;
}
