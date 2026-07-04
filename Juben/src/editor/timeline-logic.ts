import type { GameMapDef, ProjectData, QuestDef, QuestStatus, StoryNode } from "../types";
import { createGraph, createNode, getOptionTargets } from "../types";
import { createChildGameMap, ensureTimelineGraph, getMapAncestors, getTimelineGraph } from "./map-tree";
import { createGameMapWithGraph, deleteGameMap, ensureProjectGameMaps } from "./game-map-logic";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "./map-slice-layout";
import { normalizeGlobalQuests } from "./quest-logic";
import { TASK_ID_BASE } from "./constants";

/** 从时间线 mapPortal 同步 project.quests（导出兼容层） */
export function syncQuestsFromTimeline(project: ProjectData): void {
  const timeline = getTimelineGraph(project);
  if (!timeline) {
    normalizeGlobalQuests(project);
    return;
  }

  const portals = timeline.nodes.filter((n) => n.kind === "mapPortal");
  const existingByPortal = new Map<string, QuestDef>();
  const existingByGameMap = new Map<string, QuestDef>();
  for (const q of project.quests ?? []) {
    if (q.id.startsWith("qp_")) existingByPortal.set(q.id.replace(/^qp_/, ""), q);
    const gm = ensureProjectGameMaps(project).find((m) => m.graphId === q.graphId);
    if (gm) existingByGameMap.set(gm.id, q);
  }

  let maxTaskId = TASK_ID_BASE - 1;
  for (const q of project.quests ?? []) {
    if (q.taskId != null && q.taskId > maxTaskId) maxTaskId = q.taskId;
  }

  const next: QuestDef[] = [];
  portals.forEach((portal, idx) => {
    const gm = portal.gameMapId ? ensureProjectGameMaps(project).find((m) => m.id === portal.gameMapId) : undefined;
    const questId = `qp_${portal.id}`;
    let q = existingByPortal.get(portal.id) ?? (gm ? existingByGameMap.get(gm.id) : undefined);
    if (!q) {
      q = {
        id: questId,
        name: portal.title || gm?.mapName || "大剧情",
        initialStatus: portal.initialQuestStatus ?? "NotStarted",
        graphId: gm?.graphId ?? "",
      };
    }
    q.id = questId;
    q.name = portal.title?.trim() || gm?.mapName || q.name || "大剧情";
    q.initialStatus = portal.initialQuestStatus ?? q.initialStatus ?? "NotStarted";
    if (gm) q.graphId = gm.graphId;
    q.sortOrder = idx;
    q.mainlineStep = idx + 1;
    if (portal.portalTaskId != null && portal.portalTaskId > 0) {
      q.taskId = portal.portalTaskId;
    } else if (q.taskId == null || q.taskId <= 0) {
      maxTaskId += 1;
      q.taskId = maxTaskId;
      portal.portalTaskId = maxTaskId;
    } else {
      portal.portalTaskId = q.taskId;
    }
    if (portal.portalTaskId == null) portal.portalTaskId = q.taskId;
    if (gm) gm.mapPortalNodeId = portal.id;
    next.push(q);
  });

  project.quests = next;
}

export function createMapPortalWithGameMap(
  project: ProjectData,
  options?: { title?: string; position?: { x: number; y: number }; parentGameMapId?: string | null },
): { portal: StoryNode; gameMap: import("../types").GameMapDef } {
  const timeline = ensureTimelineGraph(project);
  const { gameMap } = options?.parentGameMapId
    ? createChildGameMap(project, options.parentGameMapId, { mapName: options?.title ?? "新子地图" })
    : createGameMapWithGraph(project, {
        mapName: options?.title ?? "新大地图",
        mapCode: `world_${Date.now()}`,
        npcs: [],
        ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      });

  const portalId = `portal_${crypto.randomUUID().slice(0, 8)}`;
  const portal = createNode({
    id: portalId,
    kind: "mapPortal",
    title: options?.title ?? gameMap.mapName ?? "大剧情",
    gameMapId: gameMap.id,
    initialQuestStatus: "NotStarted",
    position: options?.position ?? { x: 120 + timeline.nodes.length * 280, y: 120 },
    options: [{ id: `opt_${crypto.randomUUID().slice(0, 6)}`, text: "下一剧情" }],
  });
  gameMap.mapPortalNodeId = portal.id;
  gameMap.parentGameMapId = options?.parentGameMapId ?? null;
  timeline.nodes.push(portal);
  syncQuestsFromTimeline(project);
  return { portal, gameMap };
}

export function getMapPortalNodes(project: ProjectData): StoryNode[] {
  const timeline = getTimelineGraph(project);
  if (!timeline) return [];
  return timeline.nodes.filter((n) => n.kind === "mapPortal");
}

export function linkPortalsInOrder(project: ProjectData) {
  const timeline = getTimelineGraph(project);
  if (!timeline) return;
  const portals = timeline.nodes.filter((n) => n.kind === "mapPortal");
  for (let i = 0; i < portals.length - 1; i++) {
    const cur = portals[i]!;
    const next = portals[i + 1]!;
    const opt = cur.options[0];
    if (opt) {
      opt.targetNodeId = next.id;
      opt.targetNodeIds = [next.id];
    }
  }
}

export function migrateToTimeline(project: ProjectData): void {
  const timeline = ensureTimelineGraph(project);
  const hasPortals = timeline.nodes.some((n) => n.kind === "mapPortal");
  if (!hasPortals) {
    const rootMaps = ensureProjectGameMaps(project).filter((m) => !m.parentGameMapId);
    const sorted = [...rootMaps].sort((a, b) => {
      const qa = project.quests.find((q) => q.graphId === a.graphId);
      const qb = project.quests.find((q) => q.graphId === b.graphId);
      return (qa?.sortOrder ?? qa?.mainlineStep ?? 0) - (qb?.sortOrder ?? qb?.mainlineStep ?? 0);
    });
    const legacyNoTimeline = sorted.every((gm) => !gm.mapPortalNodeId);
    let x = 120;
    for (const gm of sorted.length > 0 ? sorted : rootMaps) {
      if (!legacyNoTimeline && !gm.mapPortalNodeId) continue;
      const portalId = gm.mapPortalNodeId ?? `portal_${gm.id}`;
      if (timeline.nodes.some((n) => n.kind === "mapPortal" && n.gameMapId === gm.id)) continue;
      if (!timeline.nodes.some((n) => n.id === portalId)) {
        const q = project.quests.find((qu) => qu.graphId === gm.graphId);
        timeline.nodes.push(
          createNode({
            id: portalId,
            kind: "mapPortal",
            title: gm.mapName ?? gm.mapCode,
            gameMapId: gm.id,
            initialQuestStatus: (q?.initialStatus as QuestStatus) ?? "NotStarted",
            portalTaskId: q?.taskId,
            position: { x, y: 120 },
            options: [{ id: `opt_${crypto.randomUUID().slice(0, 6)}`, text: "下一剧情" }],
          }),
        );
        gm.mapPortalNodeId = portalId;
        x += 280;
      }
    }
  }

  for (const q of project.quests ?? []) {
    const questGraph = project.graphs.find((g) => g.id === q.graphId && g.kind === "quest");
    if (!questGraph) continue;
    const existingGm = ensureProjectGameMaps(project).find((m) => m.graphId === questGraph.id);
    if (existingGm) continue;
    const linkedGm = ensureProjectGameMaps(project).find(
      (m) => m.mapPortalNodeId && timeline.nodes.some((n) => n.id === m.mapPortalNodeId && n.gameMapId === m.id),
    );
    if (linkedGm) continue;

    const { gameMap, graph } = createGameMapWithGraph(project, {
      mapName: q.name,
      mapCode: `quest_${q.taskId ?? q.id}`,
      npcs: [],
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    });
    q.graphId = graph.id;
    const portalId = `portal_${q.id}`;
    if (!timeline.nodes.some((n) => n.id === portalId)) {
      timeline.nodes.push(
        createNode({
          id: portalId,
          kind: "mapPortal",
          title: q.name,
          gameMapId: gameMap.id,
          initialQuestStatus: q.initialStatus,
          portalTaskId: q.taskId,
          position: { x: 120 + timeline.nodes.length * 280, y: 240 },
          options: [{ id: `opt_${crypto.randomUUID().slice(0, 6)}`, text: "下一剧情" }],
        }),
      );
      gameMap.mapPortalNodeId = portalId;
    }
  }

  reconcileTimelineData(project);
}

/** 时间线引用的 gameMap id（含子地图祖先链） */
export function getReferencedGameMapIds(project: ProjectData): Set<string> {
  const ids = new Set<string>();
  const timeline = getTimelineGraph(project);
  for (const portal of timeline?.nodes ?? []) {
    if (!portal.gameMapId) continue;
    ids.add(portal.gameMapId);
    for (const anc of getMapAncestors(project, portal.gameMapId)) ids.add(anc.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of ensureProjectGameMaps(project)) {
      if (m.parentGameMapId && ids.has(m.parentGameMapId) && !ids.has(m.id)) {
        ids.add(m.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** 导出/全局校验应覆盖的 gameMap：有时间线章节时仅含被引用的地图，否则保留全部（兼容无时间线项目） */
export function getActiveGameMapsForExport(project: ProjectData): GameMapDef[] {
  const all = ensureProjectGameMaps(project);
  const timeline = getTimelineGraph(project);
  const hasTimelinePortals = (timeline?.nodes ?? []).some((n) => n.kind === "mapPortal" && n.gameMapId);
  if (!hasTimelinePortals) return all;
  const referenced = getReferencedGameMapIds(project);
  return all.filter((m) => referenced.has(m.id));
}

/** 移除未被时间线章节引用的孤立 gameMap 及其 graph */
export function cleanupOrphanGameMaps(project: ProjectData): { removed: string[]; warnings: string[] } {
  const refs = getReferencedGameMapIds(project);
  const warnings: string[] = [];
  const removed: string[] = [];
  const orphans = ensureProjectGameMaps(project).filter((m) => !refs.has(m.id));
  for (const m of orphans) {
    if ((m.npcs?.length ?? 0) > 0) {
      warnings.push(`孤立地图 ${m.mapName || m.mapCode} 仍含 ${m.npcs.length} 个 NPC，已跳过删除`);
      continue;
    }
    deleteGameMap(project, m.id);
    removed.push(m.id);
  }
  return { removed, warnings };
}

/** 从时间线移除指向某 gameMap 的全部章节节点 */
export function unlinkGameMapFromTimeline(project: ProjectData, gameMapId: string): number {
  const timeline = getTimelineGraph(project);
  if (!timeline) return 0;
  const before = timeline.nodes.length;
  timeline.nodes = timeline.nodes.filter((n) => !(n.kind === "mapPortal" && n.gameMapId === gameMapId));
  const gm = ensureProjectGameMaps(project).find((m) => m.id === gameMapId);
  if (gm && gm.mapPortalNodeId) delete gm.mapPortalNodeId;
  return before - timeline.nodes.length;
}

/** 去重：同一 gameMap 只保留第一个 mapPortal */
export function dedupeTimelinePortals(project: ProjectData): number {
  const timeline = getTimelineGraph(project);
  if (!timeline) return 0;
  const seen = new Set<string>();
  const removeIds = new Set<string>();
  for (const portal of timeline.nodes) {
    if (portal.kind !== "mapPortal") continue;
    const gmId = portal.gameMapId;
    if (!gmId || !ensureProjectGameMaps(project).some((m) => m.id === gmId)) {
      removeIds.add(portal.id);
      continue;
    }
    if (seen.has(gmId)) {
      removeIds.add(portal.id);
      continue;
    }
    seen.add(gmId);
  }
  if (removeIds.size === 0) return 0;
  timeline.nodes = timeline.nodes.filter((n) => !removeIds.has(n.id));
  return removeIds.size;
}

/** 将剧情图中失效的 taskId 引用改绑到当前章节 quest.taskId */
export function repairStaleTaskIdReferences(project: ProjectData): number {
  const valid = new Set<number>();
  for (const q of project.quests ?? []) {
    if (q.taskId != null && q.taskId > 0) valid.add(q.taskId);
  }
  const fallbackByGraph = new Map<string, number>();
  for (const q of project.quests ?? []) {
    if (q.graphId && q.taskId != null && q.taskId > 0) fallbackByGraph.set(q.graphId, q.taskId);
  }

  let fixed = 0;
  for (const gm of ensureProjectGameMaps(project)) {
    const fallback = fallbackByGraph.get(gm.graphId);
    const graph = project.graphs.find((g) => g.id === gm.graphId);
    if (!graph) continue;
    for (const node of graph.nodes) {
      for (const opt of node.options) {
        if (opt.effectTaskAccept != null && !valid.has(opt.effectTaskAccept)) {
          if (fallback != null) opt.effectTaskAccept = fallback;
          else delete opt.effectTaskAccept;
          fixed += 1;
        }
        if (opt.effectTaskComplete != null && !valid.has(opt.effectTaskComplete)) {
          if (fallback != null) opt.effectTaskComplete = fallback;
          else delete opt.effectTaskComplete;
          fixed += 1;
        }
      }
    }
  }
  return fixed;
}

export type TimelineReconcileReport = {
  removedDuplicatePortals: number;
  clearedStalePortalRefs: number;
  repairedTaskRefs: number;
};

/** 时间线 / gameMap / quest 三方对齐（删章节后防重复、清 stale taskId） */
export function reconcileTimelineData(project: ProjectData): TimelineReconcileReport {
  const report: TimelineReconcileReport = {
    removedDuplicatePortals: 0,
    clearedStalePortalRefs: 0,
    repairedTaskRefs: 0,
  };

  report.removedDuplicatePortals = dedupeTimelinePortals(project);

  const timeline = getTimelineGraph(project);
  if (timeline) {
    const portalIds = new Set(timeline.nodes.filter((n) => n.kind === "mapPortal").map((n) => n.id));
    for (const gm of ensureProjectGameMaps(project)) {
      if (gm.mapPortalNodeId && !portalIds.has(gm.mapPortalNodeId)) {
        delete gm.mapPortalNodeId;
        report.clearedStalePortalRefs += 1;
      }
    }
  }

  syncQuestsFromTimeline(project);
  report.repairedTaskRefs = repairStaleTaskIdReferences(project);
  linkPortalsInOrder(project);
  return report;
}

/** 删除时间线章节（mapPortal），可选删除关联 gameMap */
export function deleteMapPortal(
  project: ProjectData,
  portalNodeId: string,
  options?: { deleteGameMap?: boolean },
): boolean {
  const timeline = getTimelineGraph(project);
  if (!timeline) return false;
  const portal = timeline.nodes.find((n) => n.id === portalNodeId && n.kind === "mapPortal");
  if (!portal) return false;
  timeline.nodes = timeline.nodes.filter((n) => n.id !== portalNodeId);
  if (options?.deleteGameMap && portal.gameMapId) {
    deleteGameMap(project, portal.gameMapId);
  } else if (portal.gameMapId) {
    const gm = ensureProjectGameMaps(project).find((m) => m.id === portal.gameMapId);
    if (gm?.mapPortalNodeId === portalNodeId) delete gm.mapPortalNodeId;
  }
  reconcileTimelineData(project);
  return true;
}
