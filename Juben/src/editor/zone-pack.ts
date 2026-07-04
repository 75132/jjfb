import type { GraphData, StoryMapRegion } from "../types";

export type ZonePackResult = {
  movedZoneIds: string[];
};

function zoneRect(zone: StoryMapRegion): { x: number; y: number; w: number; h: number } {
  return { x: zone.x, y: zone.y, w: zone.width, h: zone.height };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function translateZone(graph: GraphData, zoneId: string, dx: number, dy: number): void {
  const zone = graph.maps?.find((m) => m.id === zoneId);
  if (!zone || (dx === 0 && dy === 0)) return;
  zone.x += dx;
  zone.y += dy;
  for (const node of graph.nodes) {
    if (node.mapId === zoneId) {
      node.position.x += dx;
      node.position.y += dy;
    }
  }
}

/** 全图区域框避让：平移重叠区（区框 + 区内节点同 delta） */
export function packMapZonesWithoutOverlap(graph: GraphData, gap = 48): ZonePackResult {
  const result: ZonePackResult = { movedZoneIds: [] };
  const zones = graph.maps ?? [];
  if (zones.length < 2) return result;

  const sorted = [...zones].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: StoryMapRegion[] = [];

  for (const zone of sorted) {
    let rect = zoneRect(zone);
    let attempts = 0;
    const maxAttempts = zones.length * 4 + 8;

    while (attempts < maxAttempts) {
      const collider = placed.find((p) => rectsOverlap(rect, zoneRect(p), gap));
      if (!collider) break;

      const pRect = zoneRect(collider);
      const pushRight = pRect.x + pRect.w + gap - rect.x;
      const pushDown = pRect.y + pRect.h + gap - rect.y;

      if (pushRight <= pushDown) {
        translateZone(graph, zone.id, pushRight, 0);
        rect = zoneRect(zone);
      } else {
        translateZone(graph, zone.id, 0, pushDown);
        rect = zoneRect(zone);
      }

      if (!result.movedZoneIds.includes(zone.id)) {
        result.movedZoneIds.push(zone.id);
      }
      attempts += 1;
    }

    placed.push(zone);
  }

  return result;
}
