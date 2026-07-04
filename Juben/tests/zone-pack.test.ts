import { describe, expect, it } from "vitest";
import { packMapZonesWithoutOverlap } from "../src/editor/zone-pack";
import { createGraph, createNode } from "../src/types";

describe("zone-pack", () => {
  it("separates overlapping zones and moves nodes with zone", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [
      { id: "zone_a", name: "A", npcUid: "a", x: 0, y: 0, width: 400, height: 300 },
      { id: "zone_b", name: "B", npcUid: "b", x: 200, y: 0, width: 400, height: 300 },
    ];
    const n1 = createNode({ id: "n1", kind: "dialog", mapId: "zone_a", position: { x: 40, y: 80 } });
    const n2 = createNode({ id: "n2", kind: "dialog", mapId: "zone_b", position: { x: 240, y: 80 } });
    graph.nodes = [n1, n2];

    const relB = { nodeX: n2.position.x - graph.maps![1]!.x, nodeY: n2.position.y - graph.maps![1]!.y };
    const r = packMapZonesWithoutOverlap(graph, 48);
    expect(r.movedZoneIds).toContain("zone_b");

    const zoneB = graph.maps!.find((m) => m.id === "zone_b")!;
    expect(zoneB.x).toBeGreaterThanOrEqual(400 + 48);
    expect(n2.position.x - zoneB.x).toBe(relB.nodeX);
    expect(n2.position.y - zoneB.y).toBe(relB.nodeY);
  });

  it("reports no moves when zones already separated", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [
      { id: "z1", name: "1", x: 0, y: 0, width: 200, height: 200 },
      { id: "z2", name: "2", x: 300, y: 0, width: 200, height: 200 },
    ];
    const r = packMapZonesWithoutOverlap(graph);
    expect(r.movedZoneIds).toEqual([]);
  });
});
