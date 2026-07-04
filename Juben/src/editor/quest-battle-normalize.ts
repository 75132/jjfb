import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../types";
import { getOptionTargets, setOptionTargets } from "../types";
import { isDeferChoiceOption } from "./choice-option-defer";
import { collectNpcEventChain, resolveNodeEventId } from "./map-export";
import {
  battleChainNodeIds,
  ensureBattleEnemyBranch,
  ensureSideChainBattleNodes,
  materializeAllBattleEnemySpawnCoords,
  materializeBattleEnemySpawnCoords,
  normalizeMultiEnemySpawnUids,
  patchBattleEnemySpawnAtChainIndex,
  removeBattleEnemyBranch,
  resolveBattleEnemyBattleEventIdForGiver,
  resolveBattleEnemyNpcUidForIndex,
  resolveNpcBattleChain,
  resolveNpcBattleChains,
  syncTurnInEventDoneForChains,
  isBattleBranchEditorNode,
} from "./battle-enemy-bind";
import { isBattleOnlyNpc, hasBattleCompanion } from "./battle-npc-utils";
import { isBattleSlotTaskChain, isDialogOnlyTaskChain } from "./chain-slot-kind";
import { wireMultiEnemyBattleChain } from "./npc-chain-presets";
import type { ChainIssue } from "./map-chain-repair";

const WIN_TEXT = /胜利|进入战斗|挑战|开战|接受挑战/;
const LOSE_TEXT = /失败|取消|离开|再想想|暂缓|拒绝|算了|稍后再|下次再说|重新挑战/;

export type QuestBattleNormalizeReport = {
  choiceOptionsFixed: number;
  turnInEventDoneFixed: number;
  battleAppearFixed: number;
};

export type QuestBattleRepairReport = {
  removedMisplacedResult: number;
  battleBranchAdded: number;
  battleBranchDetached: number;
  enemyAppearEnsured: number;
  coordsMaterialized: number;
  choiceOptionsFixed: number;
  turnInEventDoneFixed: number;
  battleExportSpawnFixed: number;
  battleExportTurnInSynced: number;
  battleBranchesCompleted: number;
  multiEnemyBranchesAdded: number;
};

export function questBattleRepairTotal(report: QuestBattleRepairReport): number {
  return (
    report.removedMisplacedResult +
    report.battleBranchAdded +
    report.battleBranchDetached +
    report.enemyAppearEnsured +
    report.coordsMaterialized +
    report.choiceOptionsFixed +
    report.turnInEventDoneFixed +
    report.battleExportSpawnFixed +
    report.battleExportTurnInSynced +
    report.battleBranchesCompleted +
    report.multiEnemyBranchesAdded
  );
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

function resolveContinueTargetAfterMisplaced(
  graph: GraphData,
  misplaced: StoryNode,
  npc: GameMapDef["npcs"][number],
): string | undefined {
  for (const opt of misplaced.options) {
    if (opt.completesEvent === false && opt.forcedResult === "block") continue;
    const targets = getOptionTargets(opt);
    if (targets[0]) return targets[0];
  }
  for (const opt of misplaced.options) {
    const targets = getOptionTargets(opt);
    if (targets[0]) return targets[0];
  }
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const idx = chain.findIndex((n) => n.id === misplaced.id);
  if (idx >= 0 && idx < chain.length - 1) return chain[idx + 1]!.id;
  return npc.exitNodeId;
}

/** 从任务官链删除误放的「战斗结果」节点并重连前后节点 */
export function removeMisplacedBattleResultNodes(
  graph: GraphData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): number {
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!npc?.entryNodeId) return 0;

  let removed = 0;
  for (;;) {
    const chain = collectNpcEventChain(graph, npc.entryNodeId);
    const misplaced = chain.find((n) => n.kind === "choice" && n.title === "战斗结果");
    if (!misplaced) break;

    const nextId = resolveContinueTargetAfterMisplaced(graph, misplaced, npc);
    for (const node of graph.nodes) {
      for (const opt of node.options) {
        const targets = getOptionTargets(opt);
        if (!targets.includes(misplaced.id)) continue;
        if (nextId) {
          setOptionTargets(
            opt,
            [...new Set(targets.map((t) => (t === misplaced.id ? nextId : t)))],
          );
        } else {
          setOptionTargets(
            opt,
            targets.filter((t) => t !== misplaced.id),
          );
        }
      }
    }
    graph.nodes = graph.nodes.filter((n) => n.id !== misplaced.id);
    removed += 1;
  }
  return removed;
}

/** 将内联在任务官链上的战斗分支节点从主链断开（保留为独立战斗敌人子图） */
export function detachInlineBattleBranchFromGiverChain(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  giverNpcUid: string,
): number {
  const npc = gameMap.npcs.find((n) => n.npcUid === giverNpcUid);
  if (!npc?.entryNodeId) return 0;

  const bind = resolveNpcBattleChain(project, gameMap, giverNpcUid);
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const branchIds = new Set(battleChainNodeIds(bind ?? {
    giverNpcUid,
    enemyAppearNodeId: null,
    battlePrepNodeId: null,
    battleNodeId: null,
    turnInNodeId: null,
    spawnStep: null,
    battleConfigId: null,
    enemyName: "",
  }));

  const inlineBranch = chain.filter((n) => isBattleBranchEditorNode(n) || branchIds.has(n.id));
  if (inlineBranch.length === 0) return 0;

  const firstId = inlineBranch[0]!.id;
  const lastId = inlineBranch[inlineBranch.length - 1]!.id;
  const lastOut = allTargetsFromNode(graph, lastId);
  const inlineIds = new Set(inlineBranch.map((n) => n.id));

  const exitTarget =
    (npc.exitNodeId && lastOut.includes(npc.exitNodeId) ? npc.exitNodeId : undefined) ??
    lastOut.find((t) => !inlineIds.has(t) && !branchIds.has(t)) ??
    bind?.turnInNodeId ??
    chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed")?.id ??
    npc.exitNodeId;

  if (!exitTarget) return 0;

  let rewired = 0;
  for (const node of graph.nodes) {
    if (inlineIds.has(node.id)) continue;
    for (const opt of node.options) {
      const targets = getOptionTargets(opt);
      if (!targets.includes(firstId)) continue;
      setOptionTargets(
        opt,
        [...new Set(targets.map((t) => (t === firstId ? exitTarget : t)).filter(Boolean))],
      );
      rewired += 1;
    }
  }
  return rewired > 0 ? 1 : 0;
}

/** 任务官主链是否「需要」战斗分支（纯对话链返回 false；接取任务 effectTaskAccept 不算战斗） */
export function giverChainExpectsBattleBranch(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
): boolean {
  if (isDialogOnlyTaskChain(project, graph, gameMap, npcUid)) return false;
  return isBattleSlotTaskChain(project, graph, gameMap, npcUid);
}

/**
 * 修复战斗导出阻断：补 spawnNpc、物化坐标、同步多敌人 event_done。
 * 供全局检查修复 / repairMapChains 在导出校验前调用。
 */
export function repairBattleExportReadiness(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): Pick<
  QuestBattleRepairReport,
  | "battleExportSpawnFixed"
  | "battleExportTurnInSynced"
  | "coordsMaterialized"
  | "battleBranchesCompleted"
  | "multiEnemyBranchesAdded"
> {
  const out = {
    battleExportSpawnFixed: 0,
    battleExportTurnInSynced: 0,
    coordsMaterialized: 0,
    battleBranchesCompleted: 0,
    multiEnemyBranchesAdded: 0,
  };

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;
    if (isDialogOnlyTaskChain(project, graph, gameMap, npc.npcUid)) continue;

    let chains = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph);
    const battleChains = chains.filter((c) => c.battleNodeId || c.enemyAppearNodeId);
    if (battleChains.length === 0) continue;

    out.battleExportSpawnFixed += normalizeMultiEnemySpawnUids(project, gameMap, npc.npcUid, graph);

    const giverChain = collectNpcEventChain(graph, npc.entryNodeId);
    const turnIn = giverChain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");
    const turnInEventDoneCount = turnIn?.requirements?.filter((r) => r.kind === "eventDone").length ?? 0;
    const expectedEnemyCount = Math.max(
      chains.filter((c) => c.battleNodeId).length,
      turnInEventDoneCount,
      chains.filter((c) => c.enemyAppearNodeId).length,
    );

    if (expectedEnemyCount > 1 && chains.filter((c) => c.battleNodeId).length < expectedEnemyCount) {
      const before = chains.filter((c) => c.battleNodeId).length;
      wireMultiEnemyBattleChain(project, gameMap, npc, { enemyCount: expectedEnemyCount });
      chains = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph);
      const after = chains.filter((c) => c.battleNodeId).length;
      if (after > before) out.multiEnemyBranchesAdded += after - before;
    }

    chains = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph).filter((c) => c.battleNodeId || c.enemyAppearNodeId);
    for (let i = 0; i < chains.length; i++) {
      const bind = chains[i]!;
      if (!bind.battleNodeId && bind.enemyAppearNodeId) {
        if (ensureSideChainBattleNodes(project, gameMap, npc.npcUid, i)) {
          out.battleBranchesCompleted += 1;
        }
      }
    }

    chains = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph).filter((c) => c.battleNodeId);
    if (chains.length === 0) continue;

    for (let i = 0; i < chains.length; i++) {
      const bind = chains[i]!;
      const spawnUid = bind.spawnStep?.npcUid ?? resolveBattleEnemyNpcUidForIndex(npc.npcUid, i);
      if (!bind.enemyAppearNodeId || !bind.spawnStep?.npcUid || bind.spawnStep.npcUid !== spawnUid) {
        if (patchBattleEnemySpawnAtChainIndex(project, gameMap, npc.npcUid, i, { npcUid: spawnUid }).ok) {
          out.battleExportSpawnFixed += 1;
        }
      }
    }

    out.coordsMaterialized += materializeAllBattleEnemySpawnCoords(project, gameMap, npc.npcUid);

    if (syncTurnInEventDoneForChains(project, gameMap, npc.npcUid)) {
      out.battleExportTurnInSynced += 1;
    }

    chains = resolveNpcBattleChains(project, gameMap, npc.npcUid, graph).filter((c) => c.battleNodeId);
    for (let i = 0; i < chains.length; i++) {
      const bind = chains[i]!;
      if (bind.battlePrepNodeId && bind.battleNodeId && bind.spawnStep?.npcUid) continue;
      const spawnUid = bind.spawnStep?.npcUid ?? resolveBattleEnemyNpcUidForIndex(npc.npcUid, i);
      if (!bind.battlePrepNodeId || !bind.battleNodeId) {
        if (ensureSideChainBattleNodes(project, gameMap, npc.npcUid, i)) {
          out.battleBranchesCompleted += 1;
        }
      }
      if (patchBattleEnemySpawnAtChainIndex(project, gameMap, npc.npcUid, i, { npcUid: spawnUid }).ok) {
        out.battleExportSpawnFixed += 1;
      }
    }

    syncTurnInEventDoneForChains(project, gameMap, npc.npcUid);
  }

  return out;
}

/** 确定性修复：移除误放战斗结果、补战斗分支、物化敌人坐标、规范化选项与交任务 */
export function repairQuestBattleIssues(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): QuestBattleRepairReport {
  const report: QuestBattleRepairReport = {
    removedMisplacedResult: 0,
    battleBranchAdded: 0,
    battleBranchDetached: 0,
    enemyAppearEnsured: 0,
    coordsMaterialized: 0,
    choiceOptionsFixed: 0,
    turnInEventDoneFixed: 0,
    battleExportSpawnFixed: 0,
    battleExportTurnInSynced: 0,
    battleBranchesCompleted: 0,
    multiEnemyBranchesAdded: 0,
  };

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;

    if (isDialogOnlyTaskChain(project, graph, gameMap, npc.npcUid)) {
      if (removeBattleEnemyBranch(project, gameMap, npc.npcUid)) {
        report.battleBranchDetached += 1;
      }
      const chain = collectNpcEventChain(graph, npc.entryNodeId);
      for (const node of chain) {
        if (node.kind !== "questUpdate" || node.questStatus !== "Completed") continue;
        if (!node.requirements?.some((r) => r.kind === "eventDone")) continue;
        node.requirements = (node.requirements ?? []).filter((r) => r.kind !== "eventDone");
        report.turnInEventDoneFixed += 1;
      }
      continue;
    }

    let battleIntent = giverChainExpectsBattleBranch(project, graph, gameMap, npc.npcUid);

    const removedMisplaced = removeMisplacedBattleResultNodes(graph, gameMap, npc.npcUid);
    report.removedMisplacedResult += removedMisplaced;
    if (removedMisplaced > 0) battleIntent = true;

    let bind = resolveNpcBattleChain(project, gameMap, npc.npcUid);
    if (bind?.battleNodeId && !battleIntent) {
      removeBattleEnemyBranch(project, gameMap, npc.npcUid);
      report.battleBranchDetached += 1;
      bind = null;
    }

    if (bind?.battleNodeId && !bind.enemyAppearNodeId) {
      const before = bind.enemyAppearNodeId;
      const patched = patchBattleEnemySpawn(project, gameMap, npc.npcUid, {});
      if (patched.ok) {
        bind = resolveNpcBattleChain(project, gameMap, npc.npcUid);
        if (!before && bind?.enemyAppearNodeId) report.enemyAppearEnsured += 1;
      }
    }

    if (!bind?.battleNodeId && battleIntent) {
      const created = ensureBattleEnemyBranch(project, gameMap, npc.npcUid);
      if (created?.battleNodeId) {
        report.battleBranchAdded += 1;
        bind = created;
      }
    }

    report.battleBranchDetached += detachInlineBattleBranchFromGiverChain(
      project,
      graph,
      gameMap,
      npc.npcUid,
    );

    bind = resolveNpcBattleChain(project, gameMap, npc.npcUid);
    if (bind) {
      report.coordsMaterialized += materializeAllBattleEnemySpawnCoords(project, gameMap, npc.npcUid);
      for (const id of battleChainNodeIds(bind)) {
        const node = graph.nodes.find((n) => n.id === id);
        if (node) report.choiceOptionsFixed += normalizeBattleChoiceOptions(node);
      }
    }

    report.turnInEventDoneFixed += normalizeTurnInEventDoneForNpc(
      project,
      gameMap,
      graph,
      npc.npcUid,
    );
  }

  const exportFix = repairBattleExportReadiness(project, graph, gameMap);
  report.battleExportSpawnFixed += exportFix.battleExportSpawnFixed;
  report.battleExportTurnInSynced += exportFix.battleExportTurnInSynced;
  report.coordsMaterialized += exportFix.coordsMaterialized;
  report.battleBranchesCompleted += exportFix.battleBranchesCompleted;
  report.multiEnemyBranchesAdded += exportFix.multiEnemyBranchesAdded;

  return report;
}

function looksWinOption(text: string): boolean {
  return WIN_TEXT.test(text);
}

function looksLoseOption(text: string): boolean {
  return LOSE_TEXT.test(text);
}

/** 战前 / 战斗节点 choice 选项规范化 */
export function normalizeBattleChoiceOptions(node: StoryNode): number {
  if (node.kind !== "choice" && node.kind !== "battle") return 0;
  if (node.options.length === 0) return 0;

  let fixed = 0;
  for (const opt of node.options) {
    const text = opt.text ?? "";
    if (looksLoseOption(text) || isDeferChoiceOption(opt)) {
      let changed = false;
      if (opt.completesEvent !== false) {
        opt.completesEvent = false;
        changed = true;
      }
      if (opt.forcedResult !== "block") {
        opt.forcedResult = "block";
        changed = true;
      }
      if (changed) fixed += 1;
      continue;
    }
    if (looksWinOption(text) || (node.kind === "battle" && node.options.indexOf(opt) === 0)) {
      let changed = false;
      if (opt.forcedResult !== "start_battle") {
        opt.forcedResult = "start_battle";
        changed = true;
      }
      if (opt.completesEvent === false) {
        opt.completesEvent = true;
        changed = true;
      }
      if (changed) fixed += 1;
    }
  }
  return fixed;
}

export function normalizeProjectBattleChoices(project: ProjectData): number {
  let fixed = 0;
  for (const graph of project.graphs) {
    if (graph.kind !== "map") continue;
    for (const node of graph.nodes) {
      if (node.kind === "choice" || node.kind === "battle") {
        fixed += normalizeBattleChoiceOptions(node);
      }
    }
  }
  return fixed;
}

function turnInNeedsBattleEventDone(turnIn: StoryNode, battleEventId: string): boolean {
  const reqs = turnIn.requirements ?? [];
  return !reqs.some((r) => r.kind === "eventDone" && r.eventId === battleEventId);
}

function resolveBattleEventIdForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npc: GameMapDef["npcs"][number],
): string | null {
  const enemyEventId = resolveBattleEnemyBattleEventIdForGiver(project, gameMap, npc.npcUid);
  if (enemyEventId) return enemyEventId;

  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const battleNode = chain.find((n) => n.kind === "battle");
  if (!battleNode) return null;
  return resolveNodeEventId(graph, npc, battleNode.id, project);
}

/** 为任务链上交任务节点补 event_done（指向同链 battle 环） */
export function normalizeTurnInEventDoneForNpc(
  project: ProjectData,
  gameMap: GameMapDef,
  graph: GraphData,
  npcUid: string,
): number {
  const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
  if (!npc || isBattleOnlyNpc(npc, graph)) return 0;

  if (isDialogOnlyTaskChain(project, graph, gameMap, npcUid)) {
    const chain = collectNpcEventChain(graph, npc.entryNodeId);
    let fixed = 0;
    for (const node of chain) {
      if (node.kind !== "questUpdate" || node.questStatus !== "Completed") continue;
      const had = node.requirements?.some((r) => r.kind === "eventDone");
      if (!had) continue;
      node.requirements = (node.requirements ?? []).filter((r) => r.kind !== "eventDone");
      fixed += 1;
    }
    return fixed;
  }

  const chains = resolveNpcBattleChains(project, gameMap, npcUid, graph);
  if (chains.length > 1) {
    return syncTurnInEventDoneForChains(project, gameMap, npcUid) ? 1 : 0;
  }

  const battleEventId = resolveBattleEventIdForNpc(project, graph, gameMap, npc);
  if (!battleEventId) return 0;

  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  let fixed = 0;

  for (const node of chain) {
    if (node.kind !== "questUpdate" || node.questStatus !== "Completed") continue;
    if (!turnInNeedsBattleEventDone(node, battleEventId)) continue;
    node.requirements = [{ kind: "eventDone", eventId: battleEventId }];
    fixed += 1;
  }
  return fixed;
}

export function normalizeTurnInEventDone(project: ProjectData, gameMap: GameMapDef): number {
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) return 0;
  let fixed = 0;
  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;
    fixed += normalizeTurnInEventDoneForNpc(project, gameMap, graph, npc.npcUid);
  }
  return fixed;
}

export function normalizeQuestBattlePatterns(
  project: ProjectData,
  gameMap?: GameMapDef,
): QuestBattleNormalizeReport {
  const choiceOptionsFixed = normalizeProjectBattleChoices(project);
  let turnInEventDoneFixed = 0;

  const maps = gameMap ? [gameMap] : (project.gameMaps ?? []);
  for (const gm of maps) {
    turnInEventDoneFixed += normalizeTurnInEventDone(project, gm);
  }

  return { choiceOptionsFixed, turnInEventDoneFixed, battleAppearFixed: 0 };
}

/** 战斗链相关检测 */
export function detectQuestBattleIssues(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): ChainIssue[] {
  const issues: ChainIssue[] = [];

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) {
      const giverUid = npc.npcUid.replace(/_battle(_\d+)?$/, "");
      if (gameMap.npcs.some((n) => n.npcUid === giverUid)) {
        issues.push({
          kind: "legacy_split_battle",
          npcUid: npc.npcUid,
          zoneId: npc.zoneId,
          message: `分离式战斗摆点「${npc.npcName}」建议合并回任务链分支（启动时将自动合并）`,
        });
      }
      continue;
    }

    if (hasBattleCompanion(gameMap, npc.npcUid)) {
      issues.push({
        kind: "legacy_split_battle",
        npcUid: npc.npcUid,
        zoneId: npc.zoneId,
        message: `「${npc.npcName}」存在独立战斗摆点，建议合并为单链分支模式`,
      });
    }

    const chain = collectNpcEventChain(graph, npc.entryNodeId);
    const bind = resolveNpcBattleChain(project, gameMap, npc.npcUid);
    const misplacedResult = chain.find((n) => n.kind === "choice" && n.title === "战斗结果");
    if (misplacedResult) {
      issues.push({
        kind: "misplaced_battle_result_choice",
        npcUid: npc.npcUid,
        zoneId: npc.zoneId,
        nodeId: misplacedResult.id,
        message: `「${npc.npcName}」任务官链内误含「战斗结果」选项（应对话后去红色战斗敌人处开战，不应在任务官处弹出）`,
      });
    }

    if (bind?.battleNodeId && !bind.spawnStep?.npcUid) {
      issues.push({
        kind: "missing_battle_enemy_export",
        npcUid: npc.npcUid,
        zoneId: npc.zoneId,
        message: `「${npc.npcName}」战斗分支缺少敌人出现(spawnNpc)，导出后游戏中不会出现战斗 NPC`,
      });
    } else if (bind?.battleNodeId && bind.enemyAppearNodeId) {
      const sx = bind.spawnStep?.x;
      const sy = bind.spawnStep?.y;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
        issues.push({
          kind: "missing_battle_enemy_export",
          npcUid: npc.npcUid,
          zoneId: npc.zoneId,
          message: `「${npc.npcName}」战斗敌人坐标未物化，请先在地图摆点模式拖拽红色标记`,
        });
      }
    }

    const battleNode = bind?.battleNodeId
      ? graph.nodes.find((n) => n.id === bind.battleNodeId)
      : chain.find((n) => n.kind === "battle");
    const turnIn = bind?.turnInNodeId
      ? graph.nodes.find((n) => n.id === bind.turnInNodeId)
      : chain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");

    const battleBranchNodes = [
      bind?.battlePrepNodeId ? graph.nodes.find((n) => n.id === bind.battlePrepNodeId) : null,
      battleNode ?? null,
    ].filter(Boolean) as StoryNode[];

    for (const node of battleBranchNodes.length > 0 ? battleBranchNodes : chain) {
      if (node.kind !== "battle" && node.kind !== "choice") continue;
      if (battleBranchNodes.length === 0 && isBattleBranchEditorNode(node)) continue;
      if (node.kind === "choice" && node.title !== "战前选择") {
        const leadsToBattle = node.options.some((o) => {
          const targets = getOptionTargets(o);
          return targets.some((tid) => graph.nodes.find((x) => x.id === tid)?.kind === "battle");
        });
        if (!leadsToBattle && node.title !== "战前选择") continue;
      }
      const choiceNode =
        node.kind === "choice"
          ? node
          : node.options.length > 0
            ? node
            : chain.find(
                (n) =>
                  n.kind === "choice" &&
                  n.options.some((o) => getOptionTargets(o).includes(node.id)),
              );
      if (!choiceNode || choiceNode.kind !== "choice") continue;
      const hasStart = choiceNode.options.some((o) => o.forcedResult === "start_battle");
      if (!hasStart && (node.kind === "battle" || choiceNode.title === "战前选择")) {
        issues.push({
          kind: "choice_battle_missing_start_battle",
          npcUid: npc.npcUid,
          zoneId: npc.zoneId,
          nodeId: choiceNode.id,
          message: `「${npc.npcName}」战前选项缺少 forcedResult=start_battle`,
        });
      }
    }

    if (turnIn && battleNode) {
      const battleEventId = resolveBattleEventIdForNpc(project, graph, gameMap, npc);
      if (battleEventId && turnInNeedsBattleEventDone(turnIn, battleEventId)) {
        issues.push({
          kind: "battle_turn_in_missing_event_done",
          npcUid: npc.npcUid,
          zoneId: npc.zoneId,
          nodeId: turnIn.id,
          message: `「${npc.npcName}」交任务未绑定战斗 event_done（${battleEventId}）`,
        });
      }
    }
  }

  return issues;
}
