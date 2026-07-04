import type { GraphData, StoryMapRegion } from "../types";

/** 与 StoryNode.vue 中 .story-node 宽度一致 */
export const STORY_NODE_LAYOUT_W = 260;
/** 估算高度（节点内容可变，用于地图包含与自动扩展） */
export const STORY_NODE_LAYOUT_H = 140;

export function mapFlowNodeId(mapId: string): string {
  return `__map__${mapId}`;
}

export function parseMapFlowNodeId(flowNodeId: string): string | null {
  if (!flowNodeId.startsWith("__map__")) return null;
  return flowNodeId.slice(7);
}

export function ensureGraphMaps(graph: GraphData) {
  if (!Array.isArray(graph.maps)) graph.maps = [];
}

export function removeMapFromGraph(graph: GraphData, mapId: string) {
  ensureGraphMaps(graph);
  graph.maps = graph.maps!.filter((m) => m.id !== mapId);
  for (const n of graph.nodes) {
    if (n.mapId === mapId) delete n.mapId;
  }
}

/** 按节点中心点落入的地图分配 mapId；重叠时取面积最小的（更内层） */
export function assignNodeMapIdByPosition(
  graph: GraphData,
  nodeId: string,
  position: { x: number; y: number },
): string | undefined {
  ensureGraphMaps(graph);
  const maps = graph.maps!;
  const n = graph.nodes.find((x) => x.id === nodeId);
  if (!n) return undefined;

  if (maps.length === 0) {
    delete n.mapId;
    return undefined;
  }

  const cx = position.x + STORY_NODE_LAYOUT_W / 2;
  const cy = position.y + STORY_NODE_LAYOUT_H / 2;
  const hits = maps.filter((m) => cx >= m.x && cx <= m.x + m.width && cy >= m.y && cy <= m.y + m.height);
  if (hits.length === 0) {
    delete n.mapId;
    return undefined;
  }
  hits.sort((a, b) => a.width * a.height - b.width * b.height);
  const chosen = hits[0]!;
  n.mapId = chosen.id;
  return chosen.id;
}

/** 将地图外框扩展以包住该地图内全部节点（只增大不缩小） */
export function growMapToFitAssignedNodes(graph: GraphData, mapId: string, padding = 28) {
  ensureGraphMaps(graph);
  const m = graph.maps!.find((x) => x.id === mapId);
  if (!m) return;
  const assigned = graph.nodes.filter((n) => n.mapId === mapId);
  if (assigned.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of assigned) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + STORY_NODE_LAYOUT_W);
    maxY = Math.max(maxY, n.position.y + STORY_NODE_LAYOUT_H);
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const newX = Math.min(m.x, minX);
  const newY = Math.min(m.y, minY);
  const newR = Math.max(m.x + m.width, maxX);
  const newB = Math.max(m.y + m.height, maxY);
  m.x = newX;
  m.y = newY;
  m.width = Math.max(120, newR - newX);
  m.height = Math.max(100, newB - newY);
}

/** 地图框标题栏预留高度（与 graph-auto-layout ZONE_HEADER_RESERVE 一致） */
export const MAP_ZONE_HEADER_RESERVE = 56;

/** 紧裹当前地图内节点（可缩小） */
export function shrinkWrapMapToNodes(
  graph: GraphData,
  mapId: string,
  padding = 28,
  headerReserve = MAP_ZONE_HEADER_RESERVE,
) {
  ensureGraphMaps(graph);
  const m = graph.maps!.find((x) => x.id === mapId);
  if (!m) return;
  const assigned = graph.nodes.filter((n) => n.mapId === mapId);
  if (assigned.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of assigned) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + STORY_NODE_LAYOUT_W);
    maxY = Math.max(maxY, n.position.y + STORY_NODE_LAYOUT_H);
  }
  m.x = minX - padding;
  m.y = minY - padding - headerReserve;
  m.width = Math.max(120, maxX - minX + padding * 2);
  m.height = Math.max(100, maxY - minY + padding * 2 + headerReserve);
}

export function createDefaultMapRegion(): StoryMapRegion {
  return {
    id: `map_${crypto.randomUUID().slice(0, 8)}`,
    name: "新地图",
    x: 80,
    y: 80,
    width: 480,
    height: 320,
  };
}
