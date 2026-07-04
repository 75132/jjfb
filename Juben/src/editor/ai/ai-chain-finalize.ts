import { connectGraphOption, disconnectGraphOption } from "../adapters";
import type { GameMapDef, GraphData, StoryNode } from "../../types";
import { getOptionTargets, setOptionTargets } from "../../types";
import { wireOpenChainTailsToExit } from "./story-stream-applier";
import type { ProjectData } from "../../types";

const SKIP_KINDS = new Set(["npcEntry", "npcExit", "taskEnd", "questEntry"]);

export type AiChainFinalizeResult = {
  fixedLinks: number;
  warnings: string[];
};

function isMiddleNode(node: StoryNode): boolean {
  return !SKIP_KINDS.has(node.kind);
}

function middleNodesInZone(graph: GraphData, zoneId: string): StoryNode[] {
  return graph.nodes.filter((n) => n.mapId === zoneId && isMiddleNode(n));
}

function sortByLayout(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
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

function ensureOption(node: StoryNode, optionIndex: number) {
  while (node.options.length <= optionIndex) {
    const idx = node.options.length;
    node.options.push({
      id: `opt_${crypto.randomUUID()}`,
      text: idx === 0 ? "继续" : `选项 ${idx + 1}`,
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

function connectDefault(graph: GraphData, fromId: string, toId: string, optionIndex = 0) {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return false;
  const opt = ensureOption(from, optionIndex);
  const existing = getOptionTargets(opt);
  if (existing.includes(toId)) return false;
  connectGraphOption(graph, fromId, opt.id, toId);
  return true;
}

/**
 * AI 生成后按布局顺序串联 zone 内中间节点，修复「dialog 直跳 exit、choice 孤岛」等常见问题。
 */
export function finalizeAiNpcZoneChain(
  graph: GraphData,
  entryNodeId: string,
  exitNodeId?: string,
): AiChainFinalizeResult {
  const warnings: string[] = [];
  let fixedLinks = 0;

  const entry = graph.nodes.find((n) => n.id === entryNodeId);
  if (!entry?.mapId) {
    warnings.push(`finalize: 无效 entry ${entryNodeId}`);
    return { fixedLinks, warnings };
  }
  const zoneId = entry.mapId;
  const middles = sortByLayout(middleNodesInZone(graph, zoneId));
  if (middles.length === 0) return { fixedLinks, warnings };

  const middleIds = new Set(middles.map((n) => n.id));
  const first = middles[0]!;

  if (!allTargets(entry).some((id) => middleIds.has(id))) {
    if (connectDefault(graph, entry.id, first.id)) fixedLinks += 1;
  }

  for (let i = 0; i < middles.length; i++) {
    const cur = middles[i]!;
    const next = middles[i + 1];
    const outs = allTargets(cur);
    const toMiddle = outs.filter((id) => middleIds.has(id));

    if (cur.kind === "choice") {
      const opt0 = ensureOption(cur, 0);
      const t0 = getOptionTargets(opt0);
      if (t0.length === 0 && next) {
        connectGraphOption(graph, cur.id, opt0.id, next.id);
        fixedLinks += 1;
      }
      if (cur.options.length >= 2 && exitNodeId) {
        const opt1 = ensureOption(cur, 1);
        const t1 = getOptionTargets(opt1);
        if (t1.length === 0) {
          connectGraphOption(graph, cur.id, opt1.id, exitNodeId);
          fixedLinks += 1;
        }
      }
      continue;
    }

    if (next) {
      if (toMiddle.length === 0) {
        if (exitNodeId && outs.includes(exitNodeId)) {
          disconnectTo(graph, cur.id, exitNodeId);
        }
        if (connectDefault(graph, cur.id, next.id)) fixedLinks += 1;
      } else if (toMiddle.length === 1 && toMiddle[0] === exitNodeId && exitNodeId) {
        disconnectTo(graph, cur.id, exitNodeId);
        if (connectDefault(graph, cur.id, next.id)) fixedLinks += 1;
      }
    } else if (exitNodeId && toMiddle.length === 0 && !outs.includes(exitNodeId)) {
      if (connectDefault(graph, cur.id, exitNodeId)) fixedLinks += 1;
    }
  }

  const last = middles[middles.length - 1]!;
  if (exitNodeId && last.kind !== "choice") {
    const outs = allTargets(last);
    if (!outs.includes(exitNodeId) && !outs.some((id) => middleIds.has(id))) {
      if (connectDefault(graph, last.id, exitNodeId)) fixedLinks += 1;
    }
  }

  return { fixedLinks, warnings };
}

export function finalizeAiMapChains(
  graph: GraphData,
  npcs: Array<{ entryNodeId: string; exitNodeId?: string }>,
  options?: { project?: ProjectData; gameMap?: GameMapDef },
): AiChainFinalizeResult {
  let fixedLinks = 0;
  const warnings: string[] = [];
  for (const npc of npcs) {
    const r = finalizeAiNpcZoneChain(graph, npc.entryNodeId, npc.exitNodeId);
    fixedLinks += r.fixedLinks;
    warnings.push(...r.warnings);
  }
  if (options?.project && options.gameMap) {
    wireOpenChainTailsToExit({
      project: options.project,
      graph,
      gameMap: options.gameMap,
      tempIdMap: new Map(),
      layoutCursor: new Map(),
      lastNodeByNpc: new Map(),
      pendingConnects: [],
    });
  }
  return { fixedLinks, warnings };
}
