import { connectGraphOption, disconnectGraphOption } from "../adapters";
import { isBattleOnlyNpc } from "../battle-npc-utils";
import type { GameMapDef, GameMapNpcDef, GraphData, ProjectData, QuestDef, StoryNode } from "../../types";
import { createNode, getOptionTargets } from "../../types";
import { findQuestForMapGraph, normalizeGlobalQuests, resolveQuestNumericTaskId } from "../quest-logic";
import { looksDeclineChoiceText, normalizeAllChoiceDeferFlags } from "../choice-option-defer";

const SKIP_KINDS = new Set(["npcEntry", "npcExit", "taskEnd", "questEntry"]);

export type QuestProvisionResult = {
  fixedLinks: number;
  addedNodes: number;
  warnings: string[];
};

function isMiddleNode(node: StoryNode): boolean {
  return !SKIP_KINDS.has(node.kind);
}

function middleNodesInZone(graph: GraphData, zoneId: string): StoryNode[] {
  return graph.nodes.filter((n) => n.mapId === zoneId && isMiddleNode(n));
}

function allTargets(node: StoryNode): string[] {
  const out: string[] = [];
  for (const opt of node.options) {
    for (const tid of getOptionTargets(opt)) {
      if (!out.includes(tid)) out.push(tid);
    }
  }
  return out;
}

function ensureOption(node: StoryNode, optionIndex = 0) {
  while (node.options.length <= optionIndex) {
    node.options.push({
      id: `opt_${crypto.randomUUID()}`,
      text: node.options.length === 0 ? "继续" : `选项 ${node.options.length + 1}`,
    });
  }
  return node.options[optionIndex]!;
}

function disconnectTo(graph: GraphData, fromId: string, targetId: string) {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return;
  for (const opt of from.options) {
    if (getOptionTargets(opt).includes(targetId)) {
      disconnectGraphOption(graph, fromId, opt.id, targetId);
    }
  }
}

function connectOption(graph: GraphData, fromId: string, toId: string, optionIndex = 0): boolean {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return false;
  const opt = ensureOption(from, optionIndex);
  if (getOptionTargets(opt).includes(toId)) return false;
  connectGraphOption(graph, fromId, opt.id, toId);
  return true;
}

function looksDecline(text: string): boolean {
  return looksDeclineChoiceText(text);
}

function looksAccept(text: string): boolean {
  return /接受|同意|好的|愿意|出发|开始|继续|挑战|交任务|完成/.test(text);
}

/** 确保地图章节任务存在（与时间线 portal 同步） */
export function ensureMapChapterQuest(project: ProjectData, gameMap: GameMapDef): QuestDef | null {
  normalizeGlobalQuests(project);
  return findQuestForMapGraph(project, gameMap.graphId);
}

function findCompleteNode(graph: GraphData, zoneId: string, questId: string): StoryNode | undefined {
  return graph.nodes.find(
    (n) =>
      n.mapId === zoneId &&
      n.kind === "questUpdate" &&
      n.questId === questId &&
      n.questStatus === "Completed",
  );
}

function findInProgressNode(graph: GraphData, zoneId: string, questId: string): StoryNode | undefined {
  return graph.nodes.find(
    (n) =>
      n.mapId === zoneId &&
      n.kind === "questUpdate" &&
      n.questId === questId &&
      n.questStatus === "InProgress",
  );
}

function createQuestUpdateNode(
  graph: GraphData,
  npc: GameMapNpcDef,
  quest: QuestDef,
  status: "InProgress" | "Completed",
  position: { x: number; y: number },
): StoryNode {
  const title = status === "InProgress" ? "接取任务" : "完成任务";
  const node = createNode({
    kind: "questUpdate",
    title,
    mapId: npc.zoneId,
    npcUid: npc.npcUid,
    questId: quest.id,
    questStatus: status,
    chainContinuous: true,
    position,
  });
  graph.nodes.push(node);
  return node;
}

/** 为单条 NPC 链补齐任务状态节点、接任务效果，并确保成功路径接到出口 */
export function provisionNpcChainQuestAndExit(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npc: GameMapNpcDef,
): QuestProvisionResult {
  const warnings: string[] = [];
  let fixedLinks = 0;
  let addedNodes = 0;

  const quest = ensureMapChapterQuest(project, gameMap);
  if (!quest?.id || !npc.zoneId || !npc.exitNodeId) {
    if (!quest) warnings.push(`NPC ${npc.npcUid}：未找到地图章节任务，跳过任务状态`);
    return { fixedLinks, addedNodes, warnings };
  }

  const taskId = resolveQuestNumericTaskId(project, quest.id);
  const zoneId = npc.zoneId;
  const exitId = npc.exitNodeId;
  const exit = graph.nodes.find((n) => n.id === exitId);
  const zone = graph.maps?.find((m) => m.id === zoneId);
  const middleIds = new Set(middleNodesInZone(graph, zoneId).map((n) => n.id));

  let completeNode = findCompleteNode(graph, zoneId, quest.id);
  if (!completeNode) {
    const pos = {
      x: (exit?.position.x ?? zone?.x ?? 0) - 100,
      y: exit?.position.y ?? zone?.y ?? 0,
    };
    completeNode = createQuestUpdateNode(graph, npc, quest, "Completed", pos);
    addedNodes += 1;
  }

  if (connectOption(graph, completeNode.id, exitId)) fixedLinks += 1;

  if (taskId) {
    for (const node of graph.nodes) {
      if (node.mapId !== zoneId || node.kind !== "choice") continue;
      for (let i = 0; i < node.options.length; i++) {
        const opt = node.options[i]!;
        const text = opt.text ?? "";
        const isDeclineOpt = looksDecline(text) || (i > 0 && looksDecline(text));
        if (!isDeclineOpt && (looksAccept(text) || i === 0) && !opt.effectTaskAccept) {
          opt.effectTaskAccept = taskId;
        }
        if (!isDeclineOpt && !opt.effectTaskComplete && looksAccept(text) && /完成|交任务/.test(text)) {
          opt.effectTaskComplete = taskId;
        }
      }
    }
  }

  const hasAcceptEffect = graph.nodes.some(
    (n) => n.mapId === zoneId && n.options.some((o) => o.effectTaskAccept != null),
  );
  if (!hasAcceptEffect && !findInProgressNode(graph, zoneId, quest.id)) {
    const entry = graph.nodes.find((n) => n.id === npc.entryNodeId);
    const firstMiddle = middleNodesInZone(graph, zoneId).sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
    )[0];
    const pos = {
      x: (entry?.position.x ?? zone?.x ?? 0) + 140,
      y: entry?.position.y ?? zone?.y ?? 0,
    };
    const acceptNode = createQuestUpdateNode(graph, npc, quest, "InProgress", pos);
    addedNodes += 1;
    if (entry && firstMiddle) {
      disconnectTo(graph, entry.id, firstMiddle.id);
      if (connectOption(graph, entry.id, acceptNode.id)) fixedLinks += 1;
      if (connectOption(graph, acceptNode.id, firstMiddle.id)) fixedLinks += 1;
    } else if (entry) {
      if (connectOption(graph, entry.id, acceptNode.id)) fixedLinks += 1;
    }
  }

  for (const node of graph.nodes) {
    if (node.mapId !== zoneId || !middleIds.has(node.id)) continue;

    if (node.kind === "choice") {
      node.options.forEach((opt, idx) => {
        const targets = getOptionTargets(opt);
        if (targets.length > 0) return;
        const text = opt.text ?? "";
        if (looksDecline(text) || idx > 0 && looksDecline(text)) {
          if (connectOption(graph, node.id, exitId, idx)) fixedLinks += 1;
        } else if (connectOption(graph, node.id, completeNode!.id, idx)) {
          fixedLinks += 1;
        }
      });
      continue;
    }

    const outs = allTargets(node);
    const toMiddle = outs.filter((id) => middleIds.has(id));
    const toExit = outs.includes(exitId);
    const toComplete = outs.includes(completeNode.id);

    if (toExit && !toComplete && node.id !== completeNode.id) {
      disconnectTo(graph, node.id, exitId);
      if (connectOption(graph, node.id, completeNode.id)) fixedLinks += 1;
    }

    if (toMiddle.length === 0 && !toComplete && !toExit) {
      if (connectOption(graph, node.id, completeNode.id)) fixedLinks += 1;
    }
  }

  if (exit && exit.hideNpcOnEnd == null) exit.hideNpcOnEnd = true;

  return { fixedLinks, addedNodes, warnings };
}

export function provisionMapNpcQuestChains(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): QuestProvisionResult {
  let fixedLinks = 0;
  let addedNodes = 0;
  const warnings: string[] = [];
  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;
    const r = provisionNpcChainQuestAndExit(project, graph, gameMap, npc);
    fixedLinks += r.fixedLinks;
    addedNodes += r.addedNodes;
    warnings.push(...r.warnings);
  }
  const deferNorm = normalizeAllChoiceDeferFlags(project, graph, gameMap);
  if (deferNorm.optionsFixed > 0) {
    warnings.push(`暂缓选项已写回 defer 标志 ×${deferNorm.optionsFixed}`);
  }
  return { fixedLinks, addedNodes, warnings };
}

/** 将所有无后续中间节点接到 complete → exit（供 stream applier 收尾） */
export function wireOpenTailsThroughQuestComplete(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): number {
  let fixed = 0;
  const quest = ensureMapChapterQuest(project, gameMap);
  if (!quest) return 0;

  for (const npc of gameMap.npcs) {
    if (isBattleOnlyNpc(npc, graph)) continue;
    if (!npc.zoneId || !npc.exitNodeId) continue;
    const complete = findCompleteNode(graph, npc.zoneId, quest.id);
    if (!complete) continue;
    if (connectOption(graph, complete.id, npc.exitNodeId)) fixed += 1;

    const middleIds = new Set(middleNodesInZone(graph, npc.zoneId).map((n) => n.id));
    for (const nid of middleIds) {
      const node = graph.nodes.find((n) => n.id === nid);
      if (!node || node.kind === "choice") continue;
      const targets = allTargets(node);
      const hasMiddle = targets.some((t) => middleIds.has(t));
      const hasComplete = targets.includes(complete.id);
      const hasExit = targets.includes(npc.exitNodeId);
      if (!hasMiddle && !hasComplete && !hasExit) {
        if (connectOption(graph, node.id, complete.id)) fixed += 1;
      }
    }
  }
  return fixed;
}
