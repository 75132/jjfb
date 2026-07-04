import { addNpcToGameMap, ensureNpcZonesAndEntries } from "../game-map-logic";
import { provisionNpcAppearFromChainOrder } from "../npc-appear";
import { syncChainTaskConstraints } from "../chain-slot-kind";
import { parseMultiEnemyBattleFromBrief, wireMultiEnemyBattleChain } from "../npc-chain-presets";
import type { GameMapDef, ProjectData } from "../../types";
import type { RequirementsBrief, TaskBrief } from "./types";

const GRID_COLS = 4;
const GRID_BASE_X = 192;
const GRID_BASE_Y = 192;
const GRID_STEP_X = 160;
const GRID_STEP_Y = 128;

/** 默认 NPC 地图摆点网格坐标 */
export function defaultNpcGridPosition(gameMap: GameMapDef, slotIndex?: number): { x: number; y: number } {
  const idx = slotIndex ?? gameMap.npcs.length;
  const col = idx % GRID_COLS;
  const row = Math.floor(idx / GRID_COLS);
  return {
    x: GRID_BASE_X + col * GRID_STEP_X,
    y: GRID_BASE_Y + row * GRID_STEP_Y,
  };
}

export type CreateTaskChainParams = {
  npcUid: string;
  title: string;
  npcName?: string;
  npcResourceId?: string;
  x?: number;
  y?: number;
  chainSlotKind?: "dialog" | "battle";
};

/** 创建一条任务链（gameMap.npcs + zone + entry/exit） */
export function createTaskChain(project: ProjectData, gameMap: GameMapDef, params: CreateTaskChainParams) {
  const existing = gameMap.npcs.find((n) => n.npcUid === params.npcUid);
  if (existing) {
    const graph = project.graphs.find((g) => g.id === gameMap.graphId);
    const entry = graph?.nodes.find((n) => n.id === existing.entryNodeId);
    if (entry && params.title.trim()) entry.title = params.title.trim();
    if (params.npcName?.trim()) existing.npcName = params.npcName.trim();
    if (params.x != null) existing.x = params.x;
    if (params.y != null) existing.y = params.y;
    if (params.chainSlotKind) existing.chainSlotKind = params.chainSlotKind;
    ensureNpcZonesAndEntries(project, gameMap);
    provisionNpcAppearFromChainOrder(project, gameMap, { onlyEmpty: true, npcUid: existing.npcUid });
    return existing;
  }

  const pos =
    params.x != null && params.y != null ? { x: params.x, y: params.y } : defaultNpcGridPosition(gameMap);
  const title = params.title.trim() || params.npcUid;
  const npcName = params.npcName?.trim() || title;

  const def = addNpcToGameMap(project, gameMap, {
    npcUid: params.npcUid,
    npcName,
    npcResourceId: params.npcResourceId,
    x: pos.x,
    y: pos.y,
  });
  if (!def) return null;
  if (params.chainSlotKind) def.chainSlotKind = params.chainSlotKind;

  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const entry = graph?.nodes.find((n) => n.id === def.entryNodeId);
  if (entry) entry.title = title;
  ensureNpcZonesAndEntries(project, gameMap);
  provisionNpcAppearFromChainOrder(project, gameMap, { onlyEmpty: true, npcUid: def.npcUid });
  return def;
}

function taskToParams(task: TaskBrief): CreateTaskChainParams {
  return {
    npcUid: task.taskKey,
    title: task.title,
    npcName: task.npcName,
    npcResourceId: task.npcResourceId,
    x: task.x,
    y: task.y,
    chainSlotKind: task.slotKind,
  };
}

/** 从 requirementsBrief.tasks 批量创建尚未存在的任务链；并应用战斗预设 */
export function syncTaskChainsFromBrief(
  project: ProjectData,
  gameMap: GameMapDef,
  brief?: RequirementsBrief | null,
): string[] {
  const created: string[] = [];
  const tasks = brief?.tasks ?? [];
  for (const task of tasks) {
    if (!task.taskKey?.trim() || !task.title?.trim()) continue;
    const before = gameMap.npcs.some((n) => n.npcUid === task.taskKey);
    createTaskChain(project, gameMap, taskToParams(task));
    if (!before && gameMap.npcs.some((n) => n.npcUid === task.taskKey)) {
      created.push(task.taskKey);
    }
  }
  applyBattlePresetsFromBrief(project, gameMap, brief);
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (brief && graph) {
    brief.constraints = syncChainTaskConstraints(project, graph, gameMap, brief.constraints);
  }
  return created;
}

/** 蓝图/ brief 中的战斗预设：每条任务链各自 wiring，不合并到一条链 */
export function applyBattlePresetsFromBrief(
  project: ProjectData,
  gameMap: GameMapDef,
  brief?: RequirementsBrief | null,
): boolean {
  let applied = false;

  for (const task of brief?.tasks ?? []) {
    if (task.slotKind !== "battle") continue;
    const npc = gameMap.npcs.find((n) => n.npcUid === task.taskKey);
    if (!npc) continue;
    wireMultiEnemyBattleChain(project, gameMap, npc, {
      enemyCount: Math.max(1, task.enemyCount ?? 1),
    });
    applied = true;
  }

  if (applied) return true;

  const opts = parseMultiEnemyBattleFromBrief(brief?.constraints);
  if (!opts) return false;
  const battleTasks = brief?.tasks?.filter((t) => t.slotKind === "battle") ?? [];
  if (battleTasks.length > 0) return false;

  const npcUid = brief?.npcUid ?? gameMap.npcs[gameMap.npcs.length - 1]?.npcUid;
  if (!npcUid) return false;
  const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return false;

  wireMultiEnemyBattleChain(project, gameMap, npc, opts);
  return true;
}
