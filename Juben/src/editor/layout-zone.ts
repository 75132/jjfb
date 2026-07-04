import type { GraphData } from "../types";

export type LayoutZoneResolveInput = {
  graph: GraphData;
  selectedMapId: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  focusedZoneId?: string | null;
};

/** 推断「整理本组」应作用的 NPC 区域 id */
export function resolveLayoutZoneId(input: LayoutZoneResolveInput): string | null {
  if (input.graph.kind !== "map") return null;

  if (input.selectedMapId) return input.selectedMapId;

  if (input.selectedNodeId) {
    const n = input.graph.nodes.find((x) => x.id === input.selectedNodeId);
    if (n?.mapId) return n.mapId;
  }

  if (input.selectedNodeIds.length > 0) {
    const zoneIds = new Set<string>();
    for (const id of input.selectedNodeIds) {
      const n = input.graph.nodes.find((x) => x.id === id);
      if (n?.mapId) zoneIds.add(n.mapId);
    }
    if (zoneIds.size === 1) return [...zoneIds][0]!;
  }

  if (input.focusedZoneId) return input.focusedZoneId;

  return null;
}
