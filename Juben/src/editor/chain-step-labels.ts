import type { GraphData, StoryNode } from "../types";
import { getOptionTargets } from "../types";

const SKIP_KINDS = new Set(["npcEntry", "npcExit", "taskEnd", "questEntry"]);

export type StepLabelMap = Map<string, string>;

function isChainNode(node: StoryNode): boolean {
  return !SKIP_KINDS.has(node.kind);
}

function countOutgoingTargets(node: StoryNode): string[] {
  const out: string[] = [];
  for (const opt of node.options) {
    for (const tid of getOptionTargets(opt)) {
      if (!out.includes(tid)) out.push(tid);
    }
  }
  return out;
}

function kindShort(kind: string): string {
  const map: Record<string, string> = {
    dialog: "对话",
    choice: "选择",
    battle: "战斗",
    questUpdate: "任务",
    questCheck: "检任务",
    condition: "条件",
    action: "动作",
    gainItem: "获物",
    setVar: "变量",
    check: "检查",
    mapPortal: "传送",
  };
  return map[kind] ?? kind;
}

/** 从 npcEntry 出发计算层级标号：主路径 1,2,3；同级分支 2-1, 2-2 */
export function computeChainStepLabels(graph: GraphData, entryNodeId: string): StepLabelMap {
  const labels: StepLabelMap = new Map();
  const entry = graph.nodes.find((n) => n.id === entryNodeId);
  if (!entry || entry.kind !== "npcEntry") return labels;

  labels.set(entry.id, "入");
  const exitId = graph.nodes.find((n) => n.mapId === entry.mapId && n.kind === "npcExit")?.id;
  if (exitId) labels.set(exitId, "出");

  const visited = new Set<string>();
  let mainStep = 0;

  function assignFrom(nodeId: string, isBranchChild: boolean, branchParentMain?: string, branchIndex?: number) {
    if (visited.has(nodeId)) return;
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || !isChainNode(node)) return;
    visited.add(nodeId);

    let label: string;
    if (isBranchChild && branchParentMain != null && branchIndex != null) {
      label = `${branchParentMain}-${branchIndex}`;
    } else {
      mainStep += 1;
      label = String(mainStep);
    }
    labels.set(node.id, label);

    const targets = countOutgoingTargets(node).filter((t) => t !== exitId);
    if (targets.length <= 1) {
      for (const tid of targets) assignFrom(tid, false);
    } else {
      const parentMain = label.replace(/-\d+$/, "") || label;
      targets.forEach((tid, idx) => assignFrom(tid, true, parentMain, idx + 1));
    }
  }

  for (const tid of getOptionTargets(entry.options[0] ?? { id: "", text: "" })) {
    assignFrom(tid, false);
  }

  return labels;
}

/** 链摘要：1对话→2战斗→2-1失败→2-2胜利 */
export function formatChainSummary(graph: GraphData, entryNodeId: string): string {
  const labels = computeChainStepLabels(graph, entryNodeId);
  const ordered = [...labels.entries()]
    .filter(([id, step]) => step !== "入" && step !== "出")
    .sort((a, b) => {
      const pa = a[1].split("-").map(Number);
      const pb = b[1].split("-").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
      }
      return 0;
    });

  const parts: string[] = [];
  for (const [nodeId, step] of ordered) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || !isChainNode(node)) continue;
    const title = node.title?.trim();
    parts.push(`${step}${title ? title : kindShort(node.kind)}`);
  }
  return parts.join("→") || "（空链）";
}

/** 带标号节点列表（供 context 使用） */
export function labeledChainNodes(graph: GraphData, entryNodeId: string): Array<{ node: StoryNode; stepLabel: string }> {
  const labels = computeChainStepLabels(graph, entryNodeId);
  const ordered = [...labels.entries()]
    .filter(([_, step]) => step !== "入" && step !== "出")
    .sort((a, b) => {
      const pa = a[1].split("-").map(Number);
      const pb = b[1].split("-").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
      }
      return 0;
    });

  const out: Array<{ node: StoryNode; stepLabel: string }> = [];
  for (const [nodeId, stepLabel] of ordered) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (node && isChainNode(node)) out.push({ node, stepLabel });
  }
  return out;
}
