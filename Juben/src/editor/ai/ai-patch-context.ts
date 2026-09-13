import type { GraphData, ProjectData, StoryNode } from "../../types";
import { computeChainStepLabels } from "../chain-step-labels";
import { getGraphForTarget } from "./story-context-builder";
import type { AiTarget } from "./ai-target";
import type { ExistingNodeSummary, NpcChainSummary } from "./types";
import { getOptionTargets } from "../../types";

function summarizeNode(n: StoryNode, graph: GraphData, entryNodeId: string): ExistingNodeSummary {
  const labels = computeChainStepLabels(graph, entryNodeId);
  const outTargets = n.options
    .map((opt, optionIndex) => ({
      optionIndex,
      targetNodeId: getOptionTargets(opt)[0] ?? "",
    }))
    .filter((t) => t.targetNodeId);
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    speaker: n.speaker,
    dialogPreview: n.dialogLines?.[0]?.text?.slice(0, 80),
    optionTexts: n.options.map((o) => o.text).filter(Boolean),
    stepLabel: labels.get(n.id),
    outTargets: outTargets.length ? outTargets : undefined,
  };
}

function findEntryForNode(graph: GraphData, nodeId: string): string | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node?.npcUid) return undefined;
  const entry = graph.nodes.find((n) => n.kind === "npcEntry" && n.npcUid === node.npcUid);
  return entry?.id;
}

/** 收集 patch 目标节点：优先选中 → 聚焦 NPC 链 → 地图全部非空链 */
export function collectPatchNodeSummaries(
  project: ProjectData,
  target: AiTarget,
  options?: {
    selectedNodeIds?: string[];
    npcSummaries?: NpcChainSummary[];
  },
): ExistingNodeSummary[] {
  const graph = getGraphForTarget(project, target);
  if (!graph) return [];

  const selected = options?.selectedNodeIds?.filter(Boolean) ?? [];
  if (selected.length > 0) {
    const out: ExistingNodeSummary[] = [];
    for (const id of selected) {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node || node.kind === "npcEntry" || node.kind === "npcExit") continue;
      const entryId = findEntryForNode(graph, id) ?? id;
      out.push(summarizeNode(node, graph, entryId));
    }
    return out;
  }

  const focusNpc = target.scope === "map" ? target.npcUid : undefined;
  const npcs = options?.npcSummaries ?? [];
  if (focusNpc) {
    const chain = npcs.find((n) => n.npcUid === focusNpc);
    if (chain?.existingNodes.length) return chain.existingNodes;
  }

  const merged: ExistingNodeSummary[] = [];
  const seen = new Set<string>();
  for (const chain of npcs) {
    if (chain.isEmptyChain) continue;
    for (const n of chain.existingNodes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      merged.push(n);
    }
  }
  return merged;
}
