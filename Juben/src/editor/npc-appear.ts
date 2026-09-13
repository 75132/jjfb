import type { GameMapDef, GameMapNpcDef, GraphData, NpcAppearConfig, ProjectData, Requirement } from "../types";
import { isBattleOnlyNpc, isBattleEnemyMapNpc } from "./battle-npc-utils";
import { editorRequirementToRuntime } from "./requirement-bridge";
import { collectNpcChainEventIds } from "./map-export";
import { findQuestForMapGraph } from "./quest-logic";

export type RuntimeNpcAppearRequirement = {
  type: string;
  taskId?: number;
  eventId?: string;
  varId?: string;
  value?: boolean | number | string;
};

export type RuntimeNpcAppear = {
  mode: "always" | "conditional";
  matchMode?: "ALL" | "ANY";
  requirements?: RuntimeNpcAppearRequirement[];
};

export function defaultNpcAppearConfig(): NpcAppearConfig {
  return { mode: "conditional", matchMode: "ALL", requirements: [] };
}

export function normalizeNpcAppear(npc: GameMapNpcDef): NpcAppearConfig {
  if (npc.appear?.mode) {
    return {
      mode: npc.appear.mode,
      matchMode: npc.appear.matchMode ?? "ALL",
      requirements: Array.isArray(npc.appear.requirements) ? [...npc.appear.requirements] : [],
    };
  }
  if (npc.initialHidden === false) {
    return { mode: "always", matchMode: "ALL", requirements: [] };
  }
  if (npc.initialHidden === true) {
    return { mode: "conditional", matchMode: "ALL", requirements: [] };
  }
  /** 旧工程未标记时保持可见，避免误隐藏 */
  return { mode: "always", matchMode: "ALL", requirements: [] };
}

export function ensureNpcAppear(npc: GameMapNpcDef): NpcAppearConfig {
  const next = normalizeNpcAppear(npc);
  npc.appear = next;
  if (npc.initialHidden !== undefined) delete npc.initialHidden;
  return next;
}

export function exportAppearRequirements(
  project: ProjectData,
  requirements: Requirement[] | undefined,
): RuntimeNpcAppearRequirement[] {
  const out: RuntimeNpcAppearRequirement[] = [];
  for (const r of requirements ?? []) {
    const req = editorRequirementToRuntime(project, r);
    if (req) out.push(req);
  }
  return out;
}

export function exportNpcAppear(npc: GameMapNpcDef, project: ProjectData): RuntimeNpcAppear {
  const appear = normalizeNpcAppear(npc);
  return {
    mode: appear.mode,
    matchMode: appear.matchMode ?? "ALL",
    requirements: exportAppearRequirements(project, appear.requirements),
  };
}

export function shouldExportInitialHidden(npc: GameMapNpcDef): boolean {
  const appear = normalizeNpcAppear(npc);
  return appear.mode === "conditional";
}

export type NpcAppearProvisionResult = {
  provisioned: number;
  warnings: string[];
};

function findPrevChainCompleteRequirement(
  project: ProjectData,
  gameMap: GameMapDef,
  index: number,
): Requirement | null {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return null;

  for (let i = index - 1; i >= 0; i--) {
    const prevNpc = gameMap.npcs[i]!;
    if (isBattleOnlyNpc(prevNpc, graph) || isBattleEnemyMapNpc(prevNpc)) continue;

    const eventIds = collectNpcChainEventIds(graph, prevNpc, project, gameMap);
    if (eventIds.length > 0) {
      return { kind: "eventDone", eventId: eventIds[eventIds.length - 1]! };
    }
  }

  const chapterQuest = findQuestForMapGraph(project, gameMap.graphId);
  if (chapterQuest?.id) {
    return { kind: "questStatus", questId: chapterQuest.id, status: "Completed" };
  }
  return null;
}

function requirementsEqual(a: Requirement, b: Requirement): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 任务束在列表中的期望出现条件（index 0 为 always，不返回） */
export function expectedAppearRequirementForBundle(
  project: ProjectData,
  gameMap: GameMapDef,
  index: number,
): Requirement | null {
  if (index <= 0) return null;
  return findPrevChainCompleteRequirement(project, gameMap, index);
}

export function isStaleChainedAppear(
  project: ProjectData,
  gameMap: GameMapDef,
  index: number,
): boolean {
  if (index <= 0) return false;
  const npc = gameMap.npcs[index];
  if (!npc) return false;
  const expected = expectedAppearRequirementForBundle(project, gameMap, index);
  if (!expected) return false;
  const appear = normalizeNpcAppear(npc);
  if (appear.mode !== "conditional") return true;
  const reqs = appear.requirements ?? [];
  if (reqs.length !== 1) return true;
  return !requirementsEqual(reqs[0]!, expected);
}

export function appearSummaryLabel(npc: GameMapNpcDef): string {
  const appear = normalizeNpcAppear(npc);
  if (appear.mode === "always") return "直接显示";
  if (!(appear.requirements?.length ?? 0)) return "隐藏";
  const r = appear.requirements![0]!;
  if (r.kind === "eventDone") return `前链完成 · ${r.eventId}`;
  if (r.kind === "questStatus") return "条件显示";
  return "条件显示";
}

/** 按 gameMap.npcs 顺序补全 appear.requirements（默认仅填空项） */
export function provisionNpcAppearFromChainOrder(
  project: ProjectData,
  gameMap: GameMapDef,
  options?: { onlyEmpty?: boolean; forceRewrite?: boolean; npcUid?: string },
): NpcAppearProvisionResult {
  const warnings: string[] = [];
  let provisioned = 0;
  const onlyEmpty = options?.onlyEmpty !== false;
  const forceRewrite = options?.forceRewrite === true;

  for (let i = 0; i < gameMap.npcs.length; i++) {
    const npc = gameMap.npcs[i]!;
    if (options?.npcUid && npc.npcUid !== options.npcUid) continue;

    const graph = project.graphs.find((g) => g.id === gameMap.graphId);
    if (isBattleOnlyNpc(npc, graph)) continue;

    const appear = ensureNpcAppear(npc);
    if (i > 0 && forceRewrite && isStaleChainedAppear(project, gameMap, i)) {
      // fall through to rewrite
    } else if (appear.mode !== "conditional") {
      continue;
    } else if (onlyEmpty && (appear.requirements?.length ?? 0) > 0) {
      continue;
    }

    let req: Requirement | null = null;
    if (i === 0) {
      /** 链首 NPC 必须默认可见，否则 task_active 类条件在接任务前永远无法满足 */
      npc.appear = { mode: "always", matchMode: "ALL", requirements: [] };
      provisioned += 1;
      continue;
    } else {
      req = findPrevChainCompleteRequirement(project, gameMap, i);
      if (!req) {
        warnings.push(`任务束 #${i + 1}「${npc.npcName}」：前序链无完成节点，无法自动补出现条件`);
        continue;
      }
    }

    npc.appear = {
      ...appear,
      mode: "conditional",
      matchMode: appear.matchMode ?? "ALL",
      requirements: [req],
    };
    provisioned += 1;
  }

  return { provisioned, warnings };
}

/** 本任务链完成后写入的 Self Switch（最后一节 eventId） */
export function resolveChainCompleteEventId(
  project: ProjectData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
): string | null {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || !npc.entryNodeId) return null;
  const ids = collectNpcChainEventIds(graph, npc, project, gameMap);
  return ids.length ? ids[ids.length - 1]! : null;
}

/** 当前因某 event_done 而可出现的任务链 npcUid 列表 */
export function listNpcUidsUnlockedByEvent(gameMap: GameMapDef, eventId: string): string[] {
  return gameMap.npcs
    .filter((npc) => {
      const appear = normalizeNpcAppear(npc);
      if (appear.mode !== "conditional") return false;
      return (appear.requirements ?? []).some((r) => r.kind === "eventDone" && r.eventId === eventId);
    })
    .map((n) => n.npcUid);
}

/**
 * 从「完成源任务链」视角配置：完成后开启哪些已有任务链（多选）。
 * 写入目标 NPC 的 appear.event_done，不改导出字段语义。
 */
export function setUnlockTargetsAfterChainComplete(
  project: ProjectData,
  gameMap: GameMapDef,
  sourceNpcUid: string,
  targetNpcUids: string[],
): { updated: number; eventId: string | null; error?: string } {
  const source = gameMap.npcs.find((n) => n.npcUid === sourceNpcUid);
  if (!source) return { updated: 0, eventId: null, error: "找不到当前任务链" };
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const eventId = resolveChainCompleteEventId(project, gameMap, source);
  if (!eventId) {
    return { updated: 0, eventId: null, error: "当前链尚无导出事件，请先添加对话/任务等步骤" };
  }

  const want = new Set(
    targetNpcUids.filter((uid) => {
      if (uid === sourceNpcUid) return false;
      const npc = gameMap.npcs.find((n) => n.npcUid === uid);
      if (!npc) return false;
      if (isBattleEnemyMapNpc(npc) || isBattleOnlyNpc(npc, graph)) return false;
      return true;
    }),
  );

  let updated = 0;
  for (const npc of gameMap.npcs) {
    if (npc.npcUid === sourceNpcUid) continue;
    if (isBattleEnemyMapNpc(npc) || isBattleOnlyNpc(npc, graph)) continue;

    const appear = ensureNpcAppear(npc);
    const reqs = [...(appear.requirements ?? [])];
    const has = reqs.some((r) => r.kind === "eventDone" && r.eventId === eventId);
    const should = want.has(npc.npcUid);

    if (should && !has) {
      const otherEventDones = reqs.filter((r) => r.kind === "eventDone");
      const nonEvent = reqs.filter((r) => r.kind !== "eventDone");
      const nextEventDones = [...otherEventDones, { kind: "eventDone" as const, eventId }];
      const useAny = nextEventDones.length > 1;
      npc.appear = {
        mode: "conditional",
        matchMode: useAny ? "ANY" : nonEvent.length ? (appear.matchMode ?? "ALL") : "ALL",
        requirements: [...nonEvent, ...nextEventDones],
      };
      updated += 1;
    } else if (!should && has) {
      const next = reqs.filter((r) => !(r.kind === "eventDone" && r.eventId === eventId));
      const remainingEvents = next.filter((r) => r.kind === "eventDone");
      if (next.length === 0) {
        npc.appear = { mode: "conditional", matchMode: "ALL", requirements: [] };
      } else {
        npc.appear = {
          mode: "conditional",
          matchMode: remainingEvents.length > 1 ? "ANY" : (appear.matchMode ?? "ALL"),
          requirements: next,
        };
      }
      updated += 1;
    }
  }

  return { updated, eventId };
}
