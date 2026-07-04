/**
 * RM MV 式「编辑上下文禁令」：对话页 / 战斗页槽位内允许哪些节点与选项。
 */
import type { GameMapDef, GraphData, NodeKind, ProjectData, StoryNode, StoryOption } from "../types";
import { resolveNpcBattleChains } from "./battle-enemy-bind";
import {
  BATTLE_TITLE_BATTLE_PREP,
  BATTLE_TITLE_BATTLE_RESULT,
  BATTLE_TITLE_ENEMY_APPEAR,
} from "./constants";
import { isDialogOnlyTaskChain, resolveNpcChainSlotKind } from "./chain-slot-kind";
import type { NodeCatalogEntry } from "./node-catalog";

export type ChainSlotGuardResult =
  | { ok: true }
  | { ok: false; reason: string; hint?: string };

const COMBAT_NODE_KINDS = new Set<NodeKind>(["battle"]);

export function chainSlotKindLabel(kind: "dialog" | "battle" | undefined): string {
  if (kind === "dialog") return "对话页";
  if (kind === "battle") return "战斗页";
  return "未标记";
}

export function isBattleChoiceTitle(title?: string | null): boolean {
  if (!title) return false;
  const t = title.trim();
  return t === BATTLE_TITLE_BATTLE_PREP || t === BATTLE_TITLE_BATTLE_RESULT || t.includes("战斗结果");
}

export function isCombatActionNode(partial: Partial<StoryNode>): boolean {
  if (partial.kind !== "action") return false;
  if (partial.title === BATTLE_TITLE_ENEMY_APPEAR) return true;
  if (partial.editorMeta?.battleRole === "enemyAppear") return true;
  return (partial.actions ?? []).some(
    (a) => a.kind === "spawnNpc" && typeof a.npcUid === "string" && a.npcUid.includes("_enemy"),
  );
}

export function isCombatNodeKind(kind: NodeKind): boolean {
  return COMBAT_NODE_KINDS.has(kind);
}

function isDialogSlot(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): boolean {
  const marked = resolveNpcChainSlotKind(gameMap, npcUid);
  if (marked === "dialog") return true;
  if (marked === "battle") return false;
  return isDialogOnlyTaskChain(project, graph, gameMap, npcUid);
}

export function assertNodeKindAllowedForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | undefined,
  kind: NodeKind,
  partial?: Partial<StoryNode>,
): ChainSlotGuardResult {
  if (!gameMap || !npcUid) return { ok: true };
  if (!gameMap.npcs.some((n) => n.npcUid === npcUid)) return { ok: true };

  const partialNode: Partial<StoryNode> = { kind, ...partial };

  if (isCombatNodeKind(kind)) {
    return {
      ok: false,
      reason: "任务官主链不允许「战斗」节点。",
      hint: "对标 RM MV：Battle Processing 在独立 Map Event（左栏「+ 战斗分支」或蓝图选战斗页）。",
    };
  }

  if (isDialogSlot(project, graph, gameMap, npcUid)) {
    if (isCombatActionNode(partialNode)) {
      return {
        ok: false,
        reason: "对话页不允许「敌人出现 / 战斗 spawnNpc」。",
        hint: "请将该链页类型改为「战斗页」，或使用左栏「+ 战斗分支」。",
      };
    }
    if (kind === "choice" && isBattleChoiceTitle(partialNode.title)) {
      return {
        ok: false,
        reason: "对话页不允许「战前选择 / 战斗结果」选项节点。",
        hint: "开战与胜/负分支应在战斗敌人侧链，不在 Show Text 同一页。",
      };
    }
  } else if (isCombatActionNode(partialNode)) {
    return {
      ok: false,
      reason: "请勿在任务官主链手动添加敌人出现。",
      hint: "请用左栏「+ 战斗分支」创建敌人侧链。",
    };
  }

  return { ok: true };
}

export function assertChoiceNodeAllowedForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | undefined,
  node: Pick<StoryNode, "kind" | "title" | "npcUid">,
): ChainSlotGuardResult {
  if (node.kind !== "choice") return { ok: true };
  return assertNodeKindAllowedForNpc(project, graph, gameMap, npcUid ?? node.npcUid, "choice", {
    title: node.title,
  });
}

export function assertChoiceOptionAllowedForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | undefined,
  option: Pick<StoryOption, "forcedResult" | "text">,
): ChainSlotGuardResult {
  if (!gameMap || !npcUid) return { ok: true };
  if (!isDialogSlot(project, graph, gameMap, npcUid)) return { ok: true };

  if (option.forcedResult === "start_battle") {
    return {
      ok: false,
      reason: "对话页选项不允许「进入战斗」。",
      hint: "请改为战斗页并在敌人侧链开战（对标 RM Battle Processing）。",
    };
  }
  if (option.text?.includes("战斗结果") || option.text?.includes("重新挑战")) {
    return {
      ok: false,
      reason: "对话页选项文案不应含「战斗结果 / 重新挑战」。",
    };
  }
  return { ok: true };
}

export function assertQuestUpdateAllowedForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | undefined,
  node: Pick<StoryNode, "kind" | "questStatus" | "requirements" | "npcUid">,
): ChainSlotGuardResult {
  if (!gameMap || !npcUid || node.kind !== "questUpdate") return { ok: true };
  if (node.questStatus !== "Completed") return { ok: true };
  if (!isDialogSlot(project, graph, gameMap, npcUid)) return { ok: true };

  if (node.requirements?.some((r) => r.kind === "eventDone")) {
    return {
      ok: false,
      reason: "对话页交任务不应绑定战斗 event_done。",
      hint: "event_done 仅用于战斗页多敌人全灭后交任务。",
    };
  }
  return { ok: true };
}

export function isCatalogEntryDisabledForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | null | undefined,
  entry: NodeCatalogEntry,
): boolean {
  if (!gameMap || !npcUid) return false;
  if (entry.category !== "combat") return false;
  return isDialogSlot(project, graph, gameMap, npcUid);
}

export function catalogEntryDisabledReason(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | null | undefined,
  entry: NodeCatalogEntry,
): string | undefined {
  if (!isCatalogEntryDisabledForNpc(project, graph, gameMap, npcUid, entry)) return undefined;
  return "对话页不可用（对标 RM：Show Text 页不含 Battle Processing）";
}

export function detectDialogSlotBattleBind(
  project: ProjectData,
  gameMap: GameMapDef,
  graph: GraphData,
  npcUid: string,
): string | null {
  if (!isDialogSlot(project, graph, gameMap, npcUid)) return null;
  const binds = resolveNpcBattleChains(project, gameMap, npcUid, graph);
  if (binds.some((c) => c.battleNodeId || c.enemyAppearNodeId)) {
    return `「${gameMap.npcs.find((n) => n.npcUid === npcUid)?.npcName ?? npcUid}」为对话页，但挂了战斗侧链；请改页类型或全局修复剥离。`;
  }
  return null;
}
