import { connectGraphOption } from "./adapters";
import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../types";
import { getOptionTargets, setOptionTargets } from "../types";

const SKIP_KINDS = new Set(["npcEntry", "npcExit", "taskEnd", "questEntry"]);

export type ChainRepairResult = {
  fixedLinks: number;
  warnings: string[];
};

function isChainNode(node: StoryNode): boolean {
  return !SKIP_KINDS.has(node.kind);
}

export function sortChainNodesByLayout(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

function zoneChainNodes(graph: GraphData, zoneId: string): StoryNode[] {
  return sortChainNodesByLayout(graph.nodes.filter((n) => n.mapId === zoneId && isChainNode(n)));
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
      text: node.options.length === 0 ? "开始" : `选项 ${node.options.length + 1}`,
    });
  }
  return node.options[optionIndex]!;
}

function hasIncomingFromZone(graph: GraphData, nodeId: string, zoneId: string, entryId: string): boolean {
  for (const n of graph.nodes) {
    if (n.mapId !== zoneId && n.id !== entryId) continue;
    for (const opt of n.options) {
      if (getOptionTargets(opt).includes(nodeId)) return true;
    }
  }
  return false;
}

function entryFirstTarget(entry: StoryNode): string | undefined {
  return getOptionTargets(entry.options[0] ?? { id: "", text: "" })[0];
}

function repairEntryLink(graph: GraphData, entry: StoryNode, zoneNodes: StoryNode[]): boolean {
  if (entryFirstTarget(entry)) return false;
  const first = zoneNodes[0];
  if (!first) return false;
  if (entry.options.length === 0) {
    entry.options.push({ id: `opt_${crypto.randomUUID()}`, text: "开始" });
  }
  setOptionTargets(entry.options[0]!, [first.id]);
  return true;
}

function repairOrphanNodes(
  graph: GraphData,
  entry: StoryNode,
  zoneId: string,
  zoneNodes: StoryNode[],
  exitNodeId?: string,
): number {
  const middleIds = new Set(zoneNodes.map((n) => n.id));
  const orphans = zoneNodes.filter((n) => !hasIncomingFromZone(graph, n.id, zoneId, entry.id));
  if (orphans.length === 0) return 0;

  let fixed = 0;
  const entryOpt = ensureOption(entry, 0);
  const entryTargets = getOptionTargets(entryOpt).filter((t) => middleIds.has(t));

  if (entryTargets.length === 0) {
    setOptionTargets(entryOpt, [orphans[0]!.id]);
    fixed += 1;
  }

  let chainTail: StoryNode | undefined = zoneNodes.find((n) => {
    const targets = allTargets(n).filter((t) => middleIds.has(t));
    return targets.length === 0 && hasIncomingFromZone(graph, n.id, zoneId, entry.id);
  });

  if (!chainTail && entryTargets.length > 0) {
    chainTail = zoneNodes.find((n) => n.id === entryTargets[0]);
  }

  for (const orphan of orphans) {
    if (hasIncomingFromZone(graph, orphan.id, zoneId, entry.id)) continue;
    if (chainTail && chainTail.id !== orphan.id) {
      const opt = ensureOption(chainTail, 0);
      const existing = getOptionTargets(opt);
      if (!existing.includes(orphan.id)) {
        if (exitNodeId && existing.includes(exitNodeId) && existing.length === 1) {
          setOptionTargets(opt, [orphan.id]);
        } else if (existing.length === 0) {
          connectGraphOption(graph, chainTail.id, opt.id, orphan.id);
        } else {
          connectGraphOption(graph, chainTail.id, opt.id, orphan.id);
        }
        fixed += 1;
      }
    }
    chainTail = orphan;
  }

  return fixed;
}

function wireOpenTailsToExit(graph: GraphData, zoneId: string, exitNodeId: string): number {
  const chainIds = new Set(zoneChainNodes(graph, zoneId).map((n) => n.id));
  let fixed = 0;
  for (const nid of chainIds) {
    const node = graph.nodes.find((n) => n.id === nid);
    if (!node) continue;
    const targets = node.options.flatMap((o) => getOptionTargets(o));
    const hasExit = targets.includes(exitNodeId);
    const hasInternal = targets.some((t) => chainIds.has(t));
    if (!hasExit && !hasInternal) {
      if (node.options.length === 0) {
        node.options.push({ id: `opt_${crypto.randomUUID()}`, text: "继续" });
      }
      connectGraphOption(graph, nid, node.options[0]!.id, exitNodeId);
      fixed += 1;
    }
  }
  return fixed;
}

function validateChoiceOptions(graph: GraphData, node: StoryNode, warnings: string[]): void {
  if (node.kind !== "choice") return;
  node.options.forEach((opt, idx) => {
    const targets = getOptionTargets(opt);
    if (targets.length === 0) {
      warnings.push(`choice 节点「${node.title || node.id}」选项 ${idx + 1} 无连线`);
    }
  });
}

/** 修复单条 NPC 任务链的 entry 首连、孤岛与链尾接 exit */
export function repairNpcZoneLinks(
  graph: GraphData,
  entryNodeId: string,
  exitNodeId?: string,
): ChainRepairResult {
  const warnings: string[] = [];
  let fixedLinks = 0;

  const entry = graph.nodes.find((n) => n.id === entryNodeId);
  if (!entry || entry.kind !== "npcEntry") {
    warnings.push(`找不到 entry: ${entryNodeId}`);
    return { fixedLinks, warnings };
  }
  const zoneId = entry.mapId;
  if (!zoneId) {
    warnings.push(`entry 无 mapId: ${entryNodeId}`);
    return { fixedLinks, warnings };
  }

  const zoneNodes = zoneChainNodes(graph, zoneId);
  if (repairEntryLink(graph, entry, zoneNodes)) fixedLinks += 1;
  fixedLinks += repairOrphanNodes(graph, entry, zoneId, zoneNodes, exitNodeId);

  for (const node of zoneNodes) {
    validateChoiceOptions(graph, node, warnings);
  }

  if (exitNodeId) {
    fixedLinks += wireOpenTailsToExit(graph, zoneId, exitNodeId);
  }

  return { fixedLinks, warnings };
}

/** 修复地图上所有 NPC 任务链连线 */
export function repairNpcChainLinks(
  _project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): ChainRepairResult {
  const warnings: string[] = [];
  let fixedLinks = 0;
  for (const npc of gameMap.npcs) {
    const r = repairNpcZoneLinks(graph, npc.entryNodeId, npc.exitNodeId);
    fixedLinks += r.fixedLinks;
    warnings.push(...r.warnings);
  }
  return { fixedLinks, warnings };
}
