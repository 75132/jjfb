import type { GameMapDef, ProjectData } from "../../types";
import { findGameMapById } from "../game-map-logic";
import { buildGameMapTree, getTimelineGraph, type GameMapTreeNode } from "../map-tree";

export type AiEditMode = "append" | "patch" | "replace";

export type AiTarget =
  | { scope: "timeline" }
  | { scope: "map"; gameMapId: string; npcUid?: string; editMode: AiEditMode };

export type AiTargetSource = "followNav" | "manual";

export type NavContext = {
  isTimeline: boolean;
  gameMapId?: string | null;
  focusNpcUid?: string | null;
};

export type FlatMapOption = {
  id: string;
  label: string;
  depth: number;
  mapCode: string;
};

const POS_KEY = "juben_ai_float_pos";
const SIZE_KEY = "juben_ai_float_size";

const FLOAT_MIN_W = 360;
const FLOAT_MIN_H = 420;
const FLOAT_DEFAULT_W = 520;
const FLOAT_DEFAULT_H = 680;

export function resolveFollowNavTarget(nav: NavContext): AiTarget {
  if (nav.isTimeline) return { scope: "timeline" };
  if (nav.gameMapId) {
    return {
      scope: "map",
      gameMapId: nav.gameMapId,
      npcUid: nav.focusNpcUid ?? undefined,
      editMode: "append",
    };
  }
  return { scope: "timeline" };
}

export function resolveEffectiveTarget(source: AiTargetSource, manual: AiTarget, nav: NavContext): AiTarget {
  if (source === "followNav") return resolveFollowNavTarget(nav);
  return manual;
}

export function getGameMapForTarget(project: ProjectData, target: AiTarget): GameMapDef | null {
  if (target.scope !== "map") return null;
  return findGameMapById(project, target.gameMapId) ?? null;
}

export function isTimelineTarget(target: AiTarget): boolean {
  return target.scope === "timeline";
}

export function targetLabel(project: ProjectData, target: AiTarget): string {
  if (target.scope === "timeline") return "时间线大纲";
  const gm = getGameMapForTarget(project, target);
  const mapName = gm?.mapName ?? gm?.mapCode ?? target.gameMapId;
  if (target.npcUid) {
    const npc = gm?.npcs.find((n) => n.npcUid === target.npcUid);
    return `${mapName} / ${npc?.npcName ?? target.npcUid}`;
  }
  return mapName;
}

export function isTargetReady(target: AiTarget): boolean {
  if (target.scope === "timeline") return true;
  return !!target.gameMapId;
}

export function flattenGameMapOptions(project: ProjectData): FlatMapOption[] {
  const roots = buildGameMapTree(project, null);
  const out: FlatMapOption[] = [];
  function walk(nodes: GameMapTreeNode[], depth: number) {
    for (const node of nodes) {
      const gm = node.gameMap;
      out.push({
        id: gm.id,
        label: gm.mapName ?? gm.mapCode,
        depth,
        mapCode: gm.mapCode,
      });
      walk(node.children, depth + 1);
    }
  }
  walk(roots, 0);
  const maps = project.gameMaps ?? [];
  for (const gm of maps) {
    if (!out.some((o) => o.id === gm.id)) {
      out.push({ id: gm.id, label: gm.mapName ?? gm.mapCode, depth: 0, mapCode: gm.mapCode });
    }
  }
  return out;
}

export function defaultManualTarget(project: ProjectData, nav: NavContext): AiTarget {
  const follow = resolveFollowNavTarget(nav);
  if (follow.scope === "map") return follow;
  const maps = flattenGameMapOptions(project);
  if (maps.length > 0) {
    return { scope: "map", gameMapId: maps[0]!.id, editMode: "append" };
  }
  return { scope: "timeline" };
}

export function targetsEqual(a: AiTarget, b: AiTarget): boolean {
  if (a.scope !== b.scope) return false;
  if (a.scope === "timeline" && b.scope === "timeline") return true;
  if (a.scope === "map" && b.scope === "map") {
    return a.gameMapId === b.gameMapId && (a.npcUid ?? "") === (b.npcUid ?? "") && a.editMode === b.editMode;
  }
  return false;
}

export function loadFloatPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
  } catch {
    /* ignore */
  }
  return null;
}

export function saveFloatPosition(x: number, y: number) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
  } catch {
    /* ignore */
  }
}

export function loadFloatSize(): { w: number; h: number } | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { w?: number; h?: number };
    if (typeof p.w === "number" && typeof p.h === "number") return { w: p.w, h: p.h };
  } catch {
    /* ignore */
  }
  return null;
}

export function saveFloatSize(w: number, h: number) {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ w, h }));
  } catch {
    /* ignore */
  }
}

export function clampFloatSize(w: number, h: number): { w: number; h: number } {
  const maxW = Math.floor(window.innerWidth * 0.9);
  const maxH = Math.floor(window.innerHeight * 0.85);
  return {
    w: Math.max(FLOAT_MIN_W, Math.min(maxW, w)),
    h: Math.max(FLOAT_MIN_H, Math.min(maxH, h)),
  };
}

export function defaultFloatSize(): { w: number; h: number } {
  return clampFloatSize(FLOAT_DEFAULT_W, Math.min(Math.round(window.innerHeight * 0.7), FLOAT_DEFAULT_H));
}

export function allGameMapsSummary(project: ProjectData) {
  return (project.gameMaps ?? []).map((m) => ({
    id: m.id,
    mapName: m.mapName,
    mapCode: m.mapCode,
    mapId: m.mapId,
    npcCount: m.npcs.length,
  }));
}

export function getTimelineGraphId(project: ProjectData): string | undefined {
  return getTimelineGraph(project)?.id;
}
