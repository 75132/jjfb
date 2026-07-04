import type { Edge, Node } from "@vue-flow/core";
import type { GraphData, StoryMapRegion, StoryNode } from "../types";
import { addOptionTarget, getOptionTargets, removeOptionTarget, setOptionTargets } from "../types";
import { isEntryNodeKind } from "./game-map-logic";
import { mapFlowNodeId } from "./mapLogic";

export const FLOW_NODE_TYPE_STORY = "storyNode";
export const FLOW_NODE_TYPE_MAP = "mapFrame";
export const FLOW_NODE_TYPE_MAP_PORTAL = "mapPortalNode";
export const FLOW_TARGET_HANDLE_IN = "in";

export type StoryEdgeData = {
  optId: string;
};

export type StoryNodeData = {
  storyNode: StoryNode;
  entryLinked?: boolean;
  entryLinkCount?: number;
  /** 链内层级标号，如 1 / 2-1 */
  stepLabel?: string;
  /** NPC 聚焦模式下非当前 zone 的节点半透明 */
  dimmed?: boolean;
  /** 跨 graph 只读镜像节点 */
  ghost?: boolean;
  /** npcEntry：出现方式标签 */
  appearLabel?: string;
  /** 编辑器选中态（不依赖 Vue Flow 内部 store 时序） */
  editorSelected?: boolean;
};

export type MapFrameNodeData = {
  map: StoryMapRegion;
  assignedNodeTitles: string[];
  editorSelected?: boolean;
};

export type GraphToFlowOptions = {
  decorateNodeData?: (node: StoryNode) => Partial<StoryNodeData>;
  /** 全部 graph，用于跨画布连到 entry 节点 */
  allGraphs?: GraphData[];
  /** 需要镜像显示的 entry 节点（来自其它 graph） */
  ghostEntryNodes?: StoryNode[];
};

export function graphToFlow(
  graph: GraphData,
  options?: GraphToFlowOptions | ((node: StoryNode) => Partial<StoryNodeData>),
): { nodes: Node[]; edges: Edge<StoryEdgeData>[] } {
  const opts: GraphToFlowOptions = typeof options === "function" ? { decorateNodeData: options } : (options ?? {});
  const decorateNodeData = opts.decorateNodeData;
  const ghostEntries = opts.ghostEntryNodes ?? [];
  const mapNodes: Node<MapFrameNodeData>[] = (graph.maps ?? []).map((m) => ({
    id: mapFlowNodeId(m.id),
    type: FLOW_NODE_TYPE_MAP,
    position: { x: m.x, y: m.y },
    data: {
      map: m,
      assignedNodeTitles: graph.nodes.filter((n) => n.mapId === m.id).map((n) => n.title || n.id),
    },
    draggable: true,
    selectable: true,
    connectable: false,
    dragHandle: ".map-header, .select-strip",
    zIndex: -8,
  }));

  const storyNodes: Node<StoryNodeData>[] = graph.nodes
    .filter((n) => n.kind !== "mapPortal")
    .map((n) => ({
      id: n.id,
      type: FLOW_NODE_TYPE_STORY,
      position: { x: n.position.x, y: n.position.y },
      zIndex: 0,
      connectable: true,
      draggable: true,
      selectable: true,
      deletable: canDeleteStoryNode(graph, n.id),
      data: { storyNode: n, ...(decorateNodeData ? decorateNodeData(n) : {}) },
    }));

  const portalNodes: Node<StoryNodeData>[] = graph.nodes
    .filter((n) => n.kind === "mapPortal")
    .map((n) => ({
      id: n.id,
      type: FLOW_NODE_TYPE_MAP_PORTAL,
      position: { x: n.position.x, y: n.position.y },
      zIndex: 1,
      connectable: true,
      draggable: true,
      selectable: true,
      deletable: canDeleteStoryNode(graph, n.id),
      data: { storyNode: n, ...(decorateNodeData ? decorateNodeData(n) : {}) },
    }));

  const ghostNodes: Node<StoryNodeData>[] = ghostEntries.map((n, i) => ({
    id: `__ghost__${n.id}`,
    type: FLOW_NODE_TYPE_STORY,
    position: { x: 40 + (i % 4) * 280, y: 600 + Math.floor(i / 4) * 120 },
    draggable: false,
    selectable: true,
    connectable: true,
    deletable: false,
    zIndex: 0,
    data: { storyNode: n, ghost: true, ...(decorateNodeData ? decorateNodeData(n) : {}) },
  }));

  const nodes: Node[] = [...mapNodes, ...storyNodes, ...portalNodes, ...ghostNodes];

  const edges: Edge<StoryEdgeData>[] = [];
  for (const from of graph.nodes) {
    for (const opt of from.options) {
      for (const tid of getOptionTargets(opt)) {
        const targetInGraph = graph.nodes.some((n) => n.id === tid);
        const ghostId = ghostEntries.some((n) => n.id === tid) ? `__ghost__${tid}` : null;
        if (!targetInGraph && !ghostId) continue;
        const target = targetInGraph ? tid : ghostId!;
        edges.push({
          id: `${from.id}:${opt.id}->${target}`,
          source: from.id,
          target,
          sourceHandle: opt.id,
          targetHandle: FLOW_TARGET_HANDLE_IN,
          label: opt.text,
          data: { optId: opt.id },
          style: ghostId ? { strokeDasharray: "5 4" } : undefined,
        });
      }
    }
  }

  return { nodes, edges };
}

/** 解析 flow 节点 id（含 ghost）→ 真实 story node id */
export function resolveFlowNodeId(flowNodeId: string): string {
  if (flowNodeId.startsWith("__ghost__")) return flowNodeId.slice(9);
  return flowNodeId;
}

export function applyNodePositionToGraph(graph: GraphData, nodeId: string, position: { x: number; y: number }) {
  const n = graph.nodes.find((x) => x.id === nodeId);
  if (!n) return;
  n.position.x = position.x;
  n.position.y = position.y;
}

export function connectGraphOption(graph: GraphData, sourceNodeId: string, sourceOptId: string, targetNodeId: string) {
  const from = graph.nodes.find((n) => n.id === sourceNodeId);
  if (!from) return;
  const opt = from.options.find((o) => o.id === sourceOptId);
  if (!opt) return;
  addOptionTarget(opt, targetNodeId);
  opt.isEnd = false;
}

/** 不传 targetNodeId 时清空该出口的全部连线 */
export function disconnectGraphOption(
  graph: GraphData,
  sourceNodeId: string,
  sourceOptId: string,
  targetNodeId?: string,
) {
  const from = graph.nodes.find((n) => n.id === sourceNodeId);
  if (!from) return;
  const opt = from.options.find((o) => o.id === sourceOptId);
  if (!opt) return;
  if (targetNodeId) removeOptionTarget(opt, targetNodeId);
  else setOptionTargets(opt, []);
}

export type DeleteNodeResult = { ok: true } | { ok: false; reason: string };

/** 若不可删，返回原因；可删则返回 null */
export function getDeleteNodeBlockReason(graph: GraphData, nodeId: string): string | null {
  if (nodeId.startsWith("__ghost__")) return "跨画布镜像节点不能在此删除，请到源画布编辑";
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return "节点不存在或已删除";
  if (graph.kind === "map" && node.kind === "npcEntry") return "NPC 入口节点请从左栏删除对应 NPC";
  if (graph.kind === "map" && node.kind === "npcExit") return "NPC 结尾节点请从左栏删除对应 NPC";
  if ((graph.kind === "quest" || graph.kind === "side") && node.kind === "questEntry") return "任务入口节点不能删除";
  if ((graph.kind === "quest" || graph.kind === "side") && node.kind === "taskEnd") return "任务结束节点不能删除";
  return null;
}

export function canDeleteStoryNode(graph: GraphData, nodeId: string): boolean {
  return getDeleteNodeBlockReason(graph, nodeId) === null;
}

export function deleteNodeFromGraph(graph: GraphData, nodeId: string): DeleteNodeResult {
  const reason = getDeleteNodeBlockReason(graph, nodeId);
  if (reason) return { ok: false, reason };
  graph.nodes = graph.nodes.filter((n) => n.id !== nodeId);
  for (const n of graph.nodes) {
    n.options = n.options.map((o) => {
      const next = { ...o };
      setOptionTargets(
        next,
        getOptionTargets(o).filter((id) => id !== nodeId),
      );
      return next;
    });
  }
  return { ok: true };
}
