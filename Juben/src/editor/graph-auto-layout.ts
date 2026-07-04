/**
 * NPC 区域剧情节点自动布局（ELK Layered：树形居中 + 选择分支扇出）
 */
import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";
import type { GraphData, StoryNode } from "../types";
import { getOptionTargets } from "../types";
import { shrinkWrapMapToNodes, STORY_NODE_LAYOUT_H, STORY_NODE_LAYOUT_W, MAP_ZONE_HEADER_RESERVE } from "./mapLogic";
import { packMapZonesWithoutOverlap } from "./zone-pack";

const ZONE_PADDING = 28;
const ZONE_HEADER_RESERVE = MAP_ZONE_HEADER_RESERVE;
const SERPENTINE_OFFSET = 36;

const elk = new ELK();

export type LayoutResult = {
  movedNodeIds: string[];
  expandedZoneIds: string[];
  skippedZoneIds: string[];
  packedZoneIds: string[];
};

function portId(nodeId: string, optId: string): string {
  return `${nodeId}__port__${optId}`;
}

function elkLayoutOptions(): Record<string, string> {
  return {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
    "elk.spacing.nodeNode": "48",
    "elk.layered.spacing.nodeNodeBetweenLayers": "64",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "elk.padding": `[top=${ZONE_HEADER_RESERVE + ZONE_PADDING},left=${ZONE_PADDING},bottom=${ZONE_PADDING},right=${ZONE_PADDING}]`,
  };
}

function collectZoneNodeIds(graph: GraphData, zoneId: string): string[] {
  return graph.nodes.filter((n) => n.mapId === zoneId).map((n) => n.id);
}

function buildChoicePorts(node: StoryNode): ElkPort[] {
  const opts = node.options.filter((o) => getOptionTargets(o).length > 0);
  if (opts.length === 0) return [];
  return opts.map((opt, i) => ({
    id: portId(node.id, opt.id),
    width: 8,
    height: 8,
    x: Math.round((STORY_NODE_LAYOUT_W / (opts.length + 1)) * (i + 1) - 4),
    y: STORY_NODE_LAYOUT_H - 6,
    layoutOptions: { "port.side": "SOUTH" },
  }));
}

function buildElkGraph(graph: GraphData, zoneId: string): ElkNode {
  const zoneNodeIdSet = new Set(collectZoneNodeIds(graph, zoneId));
  const storyNodes = graph.nodes.filter((n) => zoneNodeIdSet.has(n.id));

  const children: ElkNode[] = storyNodes.map((node) => {
    const elkNode: ElkNode = {
      id: node.id,
      width: STORY_NODE_LAYOUT_W,
      height: STORY_NODE_LAYOUT_H,
    };
    if (node.kind === "choice" && node.options.length > 0) {
      elkNode.layoutOptions = { "org.eclipse.elk.portConstraints": "FIXED_ORDER" };
      const ports = buildChoicePorts(node);
      if (ports.length > 0) elkNode.ports = ports;
    }
    return elkNode;
  });

  const edges: ElkExtendedEdge[] = [];
  for (const node of storyNodes) {
    for (const opt of node.options) {
      for (const tid of getOptionTargets(opt)) {
        if (!zoneNodeIdSet.has(tid)) continue;
        const source = node.kind === "choice" && node.options.length > 0 ? portId(node.id, opt.id) : node.id;
        edges.push({
          id: `e_${source}_${tid}`,
          sources: [source],
          targets: [tid],
        });
      }
    }
  }

  return {
    id: `elk_${zoneId}`,
    layoutOptions: elkLayoutOptions(),
    children,
    edges,
  };
}

function zoneHasBranching(graph: GraphData, zoneId: string): boolean {
  for (const node of graph.nodes) {
    if (node.mapId !== zoneId) continue;
    let out = 0;
    for (const opt of node.options) {
      out += getOptionTargets(opt).filter((t) => {
        const target = graph.nodes.find((n) => n.id === t);
        return target?.mapId === zoneId;
      }).length;
    }
    if (out > 1) return true;
  }
  return false;
}

/** 纯线性链：轻微之字形，避免 4 节点同一 X 的「竖线」观感 */
function applySerpentineIfLinear(graph: GraphData, zoneId: string) {
  if (zoneHasBranching(graph, zoneId)) return;
  const nodes = graph.nodes.filter((n) => n.mapId === zoneId);
  if (nodes.length < 2) return;
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  sorted.forEach((n, i) => {
    n.position.x += (i % 2 === 0 ? -1 : 1) * SERPENTINE_OFFSET;
  });
}

/** 对单个 NPC 区域内部节点做 ELK 布局（区域框 x/y 不变） */
export async function layoutZoneNodes(graph: GraphData, zoneId: string): Promise<LayoutResult> {
  const result: LayoutResult = { movedNodeIds: [], expandedZoneIds: [], skippedZoneIds: [], packedZoneIds: [] };
  const zone = graph.maps?.find((m) => m.id === zoneId);
  if (!zone) return result;

  const nodeIds = collectZoneNodeIds(graph, zoneId);
  if (nodeIds.length === 0) return result;

  const elkGraph = buildElkGraph(graph, zoneId);
  let laid: ElkNode;
  try {
    laid = await elk.layout(elkGraph);
  } catch (err) {
    console.error("[layoutZoneNodes] ELK failed", zoneId, err);
    throw err;
  }

  const children = laid.children ?? [];
  if (children.length === 0) return result;

  let minX = Infinity;
  let minY = Infinity;
  for (const child of children) {
    minX = Math.min(minX, child.x ?? 0);
    minY = Math.min(minY, child.y ?? 0);
  }
  if (!Number.isFinite(minX)) return result;

  const offsetX = ZONE_PADDING - minX;
  const offsetY = ZONE_PADDING + ZONE_HEADER_RESERVE - minY;

  for (const child of children) {
    const node = graph.nodes.find((n) => n.id === child.id);
    if (!node) continue;
    node.position.x = zone.x + (child.x ?? 0) + offsetX;
    node.position.y = zone.y + (child.y ?? 0) + offsetY;
    result.movedNodeIds.push(node.id);
  }

  applySerpentineIfLinear(graph, zoneId);

  shrinkWrapMapToNodes(graph, zoneId, ZONE_PADDING, ZONE_HEADER_RESERVE);
  result.expandedZoneIds.push(zoneId);

  return result;
}

/** 全图整理：逐区 ELK 布局后跨区避让重叠 */
export async function layoutMapGraphNodes(
  graph: GraphData,
  options?: { skipZoneIds?: Set<string> },
): Promise<LayoutResult> {
  const merged: LayoutResult = { movedNodeIds: [], expandedZoneIds: [], skippedZoneIds: [], packedZoneIds: [] };
  if (graph.kind !== "map") return merged;

  for (const zone of graph.maps ?? []) {
    if (zone.skipAutoLayout || options?.skipZoneIds?.has(zone.id)) {
      merged.skippedZoneIds.push(zone.id);
      continue;
    }
    const r = await layoutZoneNodes(graph, zone.id);
    merged.movedNodeIds.push(...r.movedNodeIds);
    merged.expandedZoneIds.push(...r.expandedZoneIds);
  }

  const pack = packMapZonesWithoutOverlap(graph);
  merged.packedZoneIds.push(...pack.movedZoneIds);

  return merged;
}
