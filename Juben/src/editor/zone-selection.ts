/**
 * NPC 区域框选 + 联动拖拽：整组（框+全部节点） vs 局部（仅选中内部节点）
 */
import type { GraphData } from "../types";
import { mapFlowNodeId, parseMapFlowNodeId, STORY_NODE_LAYOUT_H, STORY_NODE_LAYOUT_W } from "./mapLogic";

export type SelectionRect = { x: number; y: number; width: number; height: number };

export type ZoneDragMode = "zoneGroup" | "innerPartial" | "mixed" | "none";

export type ZoneDragInference = {
  mode: ZoneDragMode;
  zoneId?: string;
};

const ZONE_COVERAGE_THRESHOLD = 0.8;

function rectArea(r: SelectionRect): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function intersectionArea(a: SelectionRect, b: SelectionRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function zoneBounds(zone: { x: number; y: number; width: number; height: number }): SelectionRect {
  return { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
}

export function selectionCoversZone(selectionRect: SelectionRect | undefined, zoneRect: SelectionRect): boolean {
  if (!selectionRect || rectArea(selectionRect) <= 0) return false;
  const zoneArea = rectArea(zoneRect);
  if (zoneArea <= 0) return false;
  return intersectionArea(selectionRect, zoneRect) / zoneArea >= ZONE_COVERAGE_THRESHOLD;
}

function storyNodeIdsInZone(graph: GraphData, zoneId: string): string[] {
  return graph.nodes.filter((n) => n.mapId === zoneId).map((n) => n.id);
}

/** 整组选中应包含的 flow node id（区域框 + 全部内部 story 节点） */
export function expandSelectionToZoneGroup(graph: GraphData, zoneId: string): string[] {
  const ids = [mapFlowNodeId(zoneId), ...storyNodeIdsInZone(graph, zoneId)];
  return ids;
}

export function inferZoneDragMode(
  graph: GraphData,
  selectedFlowNodeIds: string[],
  selectionRect?: SelectionRect,
): ZoneDragInference {
  if (graph.kind !== "map" || selectedFlowNodeIds.length === 0) return { mode: "none" };

  const mapFrameIds = selectedFlowNodeIds.map((id) => parseMapFlowNodeId(id)).filter((id): id is string => !!id);

  if (mapFrameIds.length === 1) {
    return { mode: "zoneGroup", zoneId: mapFrameIds[0] };
  }
  if (mapFrameIds.length > 1) return { mode: "mixed" };

  const storyIds = selectedFlowNodeIds.filter((id) => !id.startsWith("__map__") && !id.startsWith("__ghost__"));
  if (storyIds.length === 0) return { mode: "none" };

  const zoneIds = new Set<string>();
  for (const id of storyIds) {
    const n = graph.nodes.find((x) => x.id === id);
    if (n?.mapId) zoneIds.add(n.mapId);
  }
  if (zoneIds.size !== 1) return { mode: "mixed" };

  const zoneId = [...zoneIds][0]!;
  const zone = graph.maps?.find((m) => m.id === zoneId);
  if (!zone) return { mode: "innerPartial", zoneId };

  const allInZone = storyNodeIdsInZone(graph, zoneId);
  if (storyIds.length > 0 && storyIds.length === allInZone.length && allInZone.length > 0) {
    return { mode: "zoneGroup", zoneId };
  }

  if (selectionCoversZone(selectionRect, zoneBounds(zone))) {
    return { mode: "zoneGroup", zoneId };
  }

  return { mode: "innerPartial", zoneId };
}

export function applyZoneGroupDelta(graph: GraphData, zoneId: string, dx: number, dy: number): string[] {
  const moved: string[] = [];
  const zone = graph.maps?.find((m) => m.id === zoneId);
  if (!zone) return moved;

  zone.x += dx;
  zone.y += dy;

  for (const node of graph.nodes) {
    if (node.mapId !== zoneId) continue;
    node.position.x += dx;
    node.position.y += dy;
    moved.push(node.id);
  }
  return moved;
}

export function applyNodesDelta(graph: GraphData, nodeIds: string[], dx: number, dy: number): string[] {
  const moved: string[] = [];
  const idSet = new Set(nodeIds);
  for (const node of graph.nodes) {
    if (!idSet.has(node.id)) continue;
    node.position.x += dx;
    node.position.y += dy;
    moved.push(node.id);
  }
  return moved;
}

export function nodeFlowBounds(node: { position: { x: number; y: number } }): SelectionRect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: STORY_NODE_LAYOUT_W,
    height: STORY_NODE_LAYOUT_H,
  };
}

export function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return intersectionArea(a, b) > 0;
}

/** 单个 flow 节点在画布上的选择包围盒（含地图框体） */
export function flowNodeSelectionBounds(
  graph: GraphData,
  flowNode: { id: string; position: { x: number; y: number } },
): SelectionRect {
  const mapId = parseMapFlowNodeId(flowNode.id);
  if (mapId) {
    const zone = graph.maps?.find((m) => m.id === mapId);
    if (zone) return zoneBounds(zone);
  }
  return nodeFlowBounds(flowNode);
}

/** 由当前选中节点 id 推算框选矩形（用于 Vue Flow 内置框选后的 zone 推断） */
export function selectionBoundsForNodeIds(
  graph: GraphData,
  flowNodes: Array<{ id: string; position: { x: number; y: number } }>,
  nodeIds: string[],
): SelectionRect | undefined {
  const idSet = new Set(nodeIds);
  const rects = flowNodes.filter((n) => idSet.has(n.id)).map((n) => flowNodeSelectionBounds(graph, n));
  if (rects.length === 0) return undefined;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width));
  const y2 = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

/** 框选矩形命中的 flow 节点 id（排除 ghost；地图框仅当框住 ≥80% 区域时命中） */
export function findFlowNodeIdsInRect(
  graph: GraphData,
  flowNodes: Array<{ id: string; position: { x: number; y: number } }>,
  rect: SelectionRect,
): string[] {
  return flowNodes
    .filter((n) => {
      if (n.id.startsWith("__ghost__")) return false;
      const mapId = parseMapFlowNodeId(n.id);
      if (mapId) {
        const zone = graph.maps?.find((m) => m.id === mapId);
        if (!zone) return false;
        return selectionCoversZone(rect, zoneBounds(zone));
      }
      return rectsIntersect(rect, flowNodeSelectionBounds(graph, n));
    })
    .map((n) => n.id);
}
