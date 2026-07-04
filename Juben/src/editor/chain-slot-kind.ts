/**
 * 蓝图「对话 / 战斗」槽位判定：纯对话链可有接取/交任务，但不得挂战斗侧链。
 */
import type { GameMapDef, GraphData, ProjectData } from "../types";
import { collectNpcEventChain } from "./map-export";
import { resolveNpcBattleChains } from "./battle-enemy-bind";

export function resolveNpcChainSlotKind(
  gameMap: GameMapDef,
  npcUid: string,
): "dialog" | "battle" | undefined {
  return gameMap.npcs.find((n) => n.npcUid === npcUid)?.chainSlotKind;
}

/** 主任务链（entry→exit）是否纯对话：不含 battle / 战前 / 交任务 event_done */
export function isMainChainDialogOnly(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): boolean {
  const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
  if (!npc?.entryNodeId) return false;

  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  if (chain.some((n) => n.kind === "battle")) return false;
  if (chain.some((n) => n.kind === "choice" && (n.title?.includes("战斗结果") || n.title === "战前选择"))) {
    return false;
  }

  const turnIn = chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  if (turnIn?.requirements?.some((r) => r.kind === "eventDone")) return false;

  return true;
}

export function isDialogOnlyTaskChain(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): boolean {
  const marked = resolveNpcChainSlotKind(gameMap, npcUid);
  if (marked === "dialog") return true;
  if (marked === "battle") return false;
  return isMainChainDialogOnly(project, graph, gameMap, npcUid);
}

export function isBattleSlotTaskChain(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): boolean {
  if (resolveNpcChainSlotKind(gameMap, npcUid) === "battle") return true;
  if (resolveNpcChainSlotKind(gameMap, npcUid) === "dialog") return false;

  const sideBattle = resolveNpcBattleChains(project, gameMap, npcUid, graph).some(
    (c) => c.battleNodeId || c.enemyAppearNodeId,
  );
  if (sideBattle) return true;

  return !isMainChainDialogOnly(project, graph, gameMap, npcUid);
}

/** 推断槽位类型（旧工程 backfill / 全局检查） */
export function inferChainSlotKind(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): "dialog" | "battle" {
  const marked = resolveNpcChainSlotKind(gameMap, npcUid);
  if (marked === "dialog" || marked === "battle") return marked;

  const sideBattle = resolveNpcBattleChains(project, gameMap, npcUid, graph).some(
    (c) => c.battleNodeId || c.enemyAppearNodeId,
  );
  if (sideBattle) return "battle";
  if (isMainChainDialogOnly(project, graph, gameMap, npcUid)) return "dialog";
  return "battle";
}

/** 为缺失 chainSlotKind 的 NPC 写回推断值 */
export function backfillChainSlotKinds(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): number {
  let count = 0;
  for (const npc of gameMap.npcs) {
    if (npc.chainSlotKind) continue;
    npc.chainSlotKind = inferChainSlotKind(project, graph, gameMap, npc.npcUid);
    count += 1;
  }
  return count;
}

/** 同步 brief constraints 中的 chainTask:*:dialog|battle 标记 */
export function syncChainTaskConstraints(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  constraints: string[] | undefined,
): string[] {
  const base = (constraints ?? []).filter((c) => !c.startsWith("chainTask:"));
  for (const npc of gameMap.npcs) {
    const kind = npc.chainSlotKind ?? inferChainSlotKind(project, graph, gameMap, npc.npcUid);
    if (kind === "battle") {
      const binds = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph).filter(
        (c) => c.battleNodeId || c.enemyAppearNodeId,
      );
      const count = Math.max(1, binds.length || 1);
      base.push(`chainTask:${npc.npcUid}:${kind}:${count}`);
    } else {
      base.push(`chainTask:${npc.npcUid}:${kind}`);
    }
  }
  return base;
}
