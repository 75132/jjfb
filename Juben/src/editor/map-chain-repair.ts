import { finalizeAiMapChains } from "./ai/ai-chain-finalize";
import {
  provisionMapNpcQuestChains,
  wireOpenTailsThroughQuestComplete,
} from "./ai/ai-quest-provision";
import { repairNpcChainLinks } from "./chain-link-repair";
import { collectNpcEventChain } from "./map-export";
import { provisionNpcAppearFromChainOrder, normalizeNpcAppear, isStaleChainedAppear } from "./npc-appear";
import { getOptionTargets, setOptionTargets } from "../types";
import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../types";
import { isBattleOnlyNpc } from "./battle-npc-utils";
import { isBattleBranchEditorNode, listNpcBattleChains, battleChainNodeIds } from "./battle-enemy-bind";
import { detectQuestBattleIssues, repairQuestBattleIssues, questBattleRepairTotal } from "./quest-battle-normalize";
import { backfillChainSlotKinds } from "./chain-slot-kind";
import { normalizeAllChoiceDeferFlags } from "./choice-option-defer";
import { repairMapQuestTaskBindings } from "./quest-logic";

const SKIP_CHAIN_CONTINUOUS = new Set(["npcEntry", "npcExit", "taskEnd", "questEntry"]);

export type ChainIssueKind =
  | "entry_no_link"
  | "orphan_middle"
  | "open_tail"
  | "choice_empty_option"
  | "appear_empty"
  | "appear_stale"
  | "no_middle_nodes"
  | "legacy_unified_battle"
  | "legacy_split_battle"
  | "battle_turn_in_missing_event_done"
  | "choice_battle_missing_start_battle"
  | "misplaced_battle_result_choice"
  | "missing_battle_enemy_export";

export type ChainIssue = {
  kind: ChainIssueKind;
  npcUid: string;
  zoneId?: string;
  message: string;
  nodeId?: string;
};

export type MapChainRepairResult = {
  fixedLinks: number;
  addedNodes: number;
  provisionedAppear: number;
  provisionedChainContinuous: number;
  battleLayoutRepaired: number;
  questTaskRepaired: number;
  warnings: string[];
};

function hasIncomingInZone(graph: GraphData, nodeId: string, zoneId: string, entryId: string): boolean {
  for (const n of graph.nodes) {
    if (n.mapId !== zoneId && n.id !== entryId) continue;
    for (const opt of n.options) {
      if (getOptionTargets(opt).includes(nodeId)) return true;
    }
  }
  return false;
}

export function isBattleBranchGraphNode(
  project: ProjectData,
  gameMap: GameMapDef,
  graph: GraphData,
  nodeId: string,
): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (node && isBattleBranchEditorNode(node)) return true;
  for (const bind of listNpcBattleChains(project, gameMap)) {
    if (battleChainNodeIds(bind).includes(nodeId)) return true;
  }
  return false;
}

function allTargetsFromNode(graph: GraphData, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const out: string[] = [];
  for (const opt of node.options) {
    for (const tid of getOptionTargets(opt)) {
      if (!out.includes(tid)) out.push(tid);
    }
  }
  return out;
}

/** 主任务链节点（排除战斗侧链），与 detectMapChainIssues 判定一致 */
export function getMainChainNodes(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npc: GameMapDef["npcs"][number],
): StoryNode[] {
  if (!npc.entryNodeId) return [];
  return collectNpcEventChain(graph, npc.entryNodeId).filter(
    (n) => !isBattleBranchGraphNode(project, gameMap, graph, n.id),
  );
}

function looksDeclineOption(text: string): boolean {
  return /暂缓|拒绝|算了|稍后再|下次再说|不感兴趣|离开|不做|取消/.test(text);
}

function ensureNodeOption(node: StoryNode, optionIndex = 0) {
  while (node.options.length <= optionIndex) {
    node.options.push({
      id: `opt_${crypto.randomUUID()}`,
      text: node.options.length === 0 ? "继续" : `选项 ${node.options.length + 1}`,
    });
  }
  return node.options[optionIndex]!;
}

function connectNodeTo(graph: GraphData, fromId: string, toId: string, optionIndex = 0): boolean {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return false;
  const opt = ensureNodeOption(from, optionIndex);
  if (getOptionTargets(opt).includes(toId)) return false;
  setOptionTargets(opt, [...getOptionTargets(opt), toId]);
  return true;
}

function resolveOpenTailTarget(
  graph: GraphData,
  node: StoryNode,
  chainNodes: StoryNode[],
  exitNodeId: string,
): string {
  const sorted = [...chainNodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const idx = sorted.findIndex((n) => n.id === node.id);
  const next = idx >= 0 ? sorted[idx + 1] : undefined;
  if (next && next.id !== node.id) return next.id;

  const turnIn = chainNodes.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
  if (turnIn && turnIn.id !== node.id) return turnIn.id;

  return exitNodeId;
}

/**
 * 修复主链 open_tail / choice 空选项（不把战斗侧链算作「已有后续」）。
 * 与 detectMapChainIssues 的 open_tail 检测对齐。
 */
export function repairMainChainOpenTails(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): number {
  let fixed = 0;

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;
    if (!npc.exitNodeId) continue;

    const chainNodes = getMainChainNodes(project, graph, gameMap, npc);
    const chainIds = new Set(chainNodes.map((n) => n.id));
    if (chainNodes.length === 0) continue;

    for (const node of chainNodes) {
      if (node.kind === "choice") {
        node.options.forEach((opt, idx) => {
          if (getOptionTargets(opt).length > 0) return;
          const text = opt.text ?? "";
          const target = looksDeclineOption(text)
            ? npc.exitNodeId!
            : resolveOpenTailTarget(graph, node, chainNodes, npc.exitNodeId!);
          if (connectNodeTo(graph, node.id, target, idx)) fixed += 1;
        });
        continue;
      }

      const targets = allTargetsFromNode(graph, node.id);
      const hasChainOut = targets.some((t) => chainIds.has(t));
      const hasExit = targets.includes(npc.exitNodeId);
      if (hasChainOut || hasExit) continue;

      const target = resolveOpenTailTarget(graph, node, chainNodes, npc.exitNodeId);
      if (connectNodeTo(graph, node.id, target)) fixed += 1;
    }
  }

  return fixed;
}

/** 检测地图上所有 NPC 任务链问题（不修改数据） */
export function detectMapChainIssues(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): ChainIssue[] {
  const issues: ChainIssue[] = [];

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;

    const entry = graph.nodes.find((n) => n.id === npc.entryNodeId);
    const zoneId = npc.zoneId ?? entry?.mapId;
    if (!entry || !zoneId) {
      issues.push({
        kind: "entry_no_link",
        npcUid: npc.npcUid,
        message: `找不到入口节点：${npc.entryNodeId}`,
      });
      continue;
    }

    const giverChain = collectNpcEventChain(graph, npc.entryNodeId);
    const chainNodes = giverChain.filter((n) => !isBattleBranchGraphNode(project, gameMap, graph, n.id));
    const chainIds = new Set(chainNodes.map((n) => n.id));
    const zoneStoryMiddles = graph.nodes.filter(
      (n) =>
        n.mapId === zoneId &&
        n.kind !== "npcEntry" &&
        n.kind !== "npcExit" &&
        n.kind !== "taskEnd" &&
        n.kind !== "questEntry" &&
        !isBattleBranchGraphNode(project, gameMap, graph, n.id),
    );

    if (chainNodes.length === 0) {
      issues.push({
        kind: "no_middle_nodes",
        npcUid: npc.npcUid,
        zoneId,
        message: `「${npc.npcName}」链内无中间剧情节点`,
      });
    }

    const entryTargets = allTargetsFromNode(graph, entry.id);
    const entryToChain = entryTargets.filter((t) => chainIds.has(t));
    if (entryToChain.length === 0 && (chainNodes.length > 0 || zoneStoryMiddles.length > 0)) {
      issues.push({
        kind: "entry_no_link",
        npcUid: npc.npcUid,
        zoneId,
        nodeId: entry.id,
        message: `「${npc.npcName}」入口未连到首个剧情节点`,
      });
    }

    for (const node of chainNodes) {
      if (!hasIncomingInZone(graph, node.id, zoneId, entry.id)) {
        issues.push({
          kind: "orphan_middle",
          npcUid: npc.npcUid,
          zoneId,
          nodeId: node.id,
          message: `「${npc.npcName}」节点「${node.title || node.id}」无入边（孤岛）`,
        });
      }

      if (node.kind === "choice") {
        node.options.forEach((opt, idx) => {
          if (getOptionTargets(opt).length === 0) {
            issues.push({
              kind: "choice_empty_option",
              npcUid: npc.npcUid,
              zoneId,
              nodeId: node.id,
              message: `「${npc.npcName}」choice「${node.title || node.id}」选项 ${idx + 1} 无连线`,
            });
          }
        });
      }

      const targets = allTargetsFromNode(graph, node.id);
      const hasChainOut = targets.some((t) => chainIds.has(t));
      const hasExit = npc.exitNodeId ? targets.includes(npc.exitNodeId) : false;
      if (node.kind !== "choice" && !hasChainOut && !hasExit) {
        issues.push({
          kind: "open_tail",
          npcUid: npc.npcUid,
          zoneId,
          nodeId: node.id,
          message: `「${npc.npcName}」节点「${node.title || node.id}」链尾未接出口`,
        });
      }
    }

    const appear = normalizeNpcAppear(npc);
    if (appear.mode === "conditional" && !(appear.requirements?.length ?? 0)) {
      issues.push({
        kind: "appear_empty",
        npcUid: npc.npcUid,
        zoneId,
        message: `「${npc.npcName}」未配置出现条件（地图上默认隐藏）`,
      });
    }

    const bundleIndex = gameMap.npcs.indexOf(npc);
    if (bundleIndex > 0 && isStaleChainedAppear(project, gameMap, bundleIndex)) {
      issues.push({
        kind: "appear_stale",
        npcUid: npc.npcUid,
        zoneId,
        message: `「${npc.npcName}」出现条件未绑定前链末事件（可能共用章节 task_completed）`,
      });
    }
  }

  issues.push(...detectQuestBattleIssues(project, graph, gameMap));

  return issues;
}

/** 为 NPC 链中间节点默认补 chainContinuous（导出时默认同次接触续链） */
export function provisionChainContinuousOnMiddleNodes(graph: GraphData, gameMap: GameMapDef): number {
  let provisioned = 0;
  for (const npc of gameMap.npcs) {
    const chain = collectNpcEventChain(graph, npc.entryNodeId);
    for (let i = 0; i < chain.length - 1; i++) {
      const node = chain[i]!;
      if (SKIP_CHAIN_CONTINUOUS.has(node.kind)) continue;
      if (node.chainContinuous === false) continue;
      if (node.chainContinuous === true) continue;
      node.chainContinuous = true;
      provisioned += 1;
    }
  }
  return provisioned;
}

/** 统一修复：串联 → 任务节点 → 链修复 → appear 补全 */
export function repairMapChains(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): MapChainRepairResult {
  let fixedLinks = 0;
  let addedNodes = 0;
  const warnings: string[] = [];

  const backfilled = backfillChainSlotKinds(project, graph, gameMap);
  if (backfilled > 0) {
    warnings.push(`已推断并写回 ${backfilled} 条任务链的页类型（chainSlotKind）`);
  }

  const deferNorm = normalizeAllChoiceDeferFlags(project, graph, gameMap);
  if (deferNorm.optionsFixed > 0) {
    warnings.push(`已规范化 ${deferNorm.optionsFixed} 个暂缓选项（completesEvent=false / block）`);
  }

  const finalizeResult = finalizeAiMapChains(
    graph,
    gameMap.npcs.map((n) => ({ entryNodeId: n.entryNodeId, exitNodeId: n.exitNodeId })),
    { project, gameMap },
  );
  fixedLinks += finalizeResult.fixedLinks;
  warnings.push(...finalizeResult.warnings);

  const questResult = provisionMapNpcQuestChains(project, graph, gameMap);
  fixedLinks += questResult.fixedLinks;
  addedNodes += questResult.addedNodes;
  warnings.push(...questResult.warnings);

  fixedLinks += wireOpenTailsThroughQuestComplete(project, graph, gameMap);

  const repairResult = repairNpcChainLinks(project, graph, gameMap);
  fixedLinks += repairResult.fixedLinks;
  warnings.push(...repairResult.warnings);

  fixedLinks += repairMainChainOpenTails(project, graph, gameMap);

  const questTaskRepaired = repairMapQuestTaskBindings(project, graph, gameMap);

  const battleRepair = repairQuestBattleIssues(project, graph, gameMap);
  const battleLayoutRepaired = questBattleRepairTotal(battleRepair);
  addedNodes += battleRepair.battleBranchAdded * 3 + battleRepair.enemyAppearEnsured;

  const provisionedChainContinuous = provisionChainContinuousOnMiddleNodes(graph, gameMap);

  const appearResult = provisionNpcAppearFromChainOrder(project, gameMap, { forceRewrite: true });
  warnings.push(...appearResult.warnings);

  return {
    fixedLinks,
    addedNodes,
    provisionedAppear: appearResult.provisioned,
    provisionedChainContinuous,
    battleLayoutRepaired,
    questTaskRepaired,
    warnings,
  };
}
