import { createNode, getOptionTargets, setOptionTargets, type GraphData, type NodeKind, type StoryNode } from "../types";
import { deleteNodeFromGraph, getDeleteNodeBlockReason, type DeleteNodeResult } from "./adapters";

/** 在 afterNodeId 主出口后插入新节点，并接到原后继 */
export function insertNodeAfter(
  graph: GraphData,
  afterNodeId: string,
  kind: NodeKind,
  extras?: Partial<StoryNode>,
): StoryNode | null {
  const after = graph.nodes.find((n) => n.id === afterNodeId);
  if (!after) return null;
  const opt = after.options[0];
  const oldTargets = opt ? getOptionTargets(opt) : [];
  const node = createNode({
    kind,
    title: extras?.title ?? kindLabel(kind),
    position: {
      x: (after.position?.x ?? 120) + 40,
      y: (after.position?.y ?? 120) + 80,
    },
    mapId: extras?.mapId ?? after.mapId,
    npcUid: extras?.npcUid ?? after.npcUid,
    ...extras,
  });
  if (opt) {
    setOptionTargets(opt, [node.id]);
    opt.isEnd = false;
  }
  if (node.options[0]) {
    setOptionTargets(node.options[0], oldTargets);
    if (oldTargets.length) node.options[0].isEnd = false;
  }
  graph.nodes.push(node);
  return node;
}

/** 删除节点并把入边接到其主出口后继（尽量不断链） */
export function deleteNodeRewire(graph: GraphData, nodeId: string): DeleteNodeResult {
  const reason = getDeleteNodeBlockReason(graph, nodeId);
  if (reason) return { ok: false, reason };
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "节点不存在或已删除" };
  const forward = node.options[0] ? getOptionTargets(node.options[0]) : [];
  const replacement = forward[0];
  for (const n of graph.nodes) {
    if (n.id === nodeId) continue;
    for (const opt of n.options) {
      const targets = getOptionTargets(opt);
      if (!targets.includes(nodeId)) continue;
      setOptionTargets(
        opt,
        targets.flatMap((t) => {
          if (t !== nodeId) return [t];
          return replacement && replacement !== n.id ? [replacement] : [];
        }),
      );
    }
  }
  return deleteNodeFromGraph(graph, nodeId);
}

function kindLabel(kind: NodeKind): string {
  const map: Partial<Record<NodeKind, string>> = {
    dialog: "对话",
    choice: "选择",
    battle: "战斗",
    questUpdate: "任务进度",
    gainItem: "获得物品",
    loseItem: "失去物品",
    condition: "条件",
    mapPortal: "大剧情",
  };
  return map[kind] ?? "新节点";
}
