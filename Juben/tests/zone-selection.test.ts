import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  applyNodesDelta,
  applyZoneGroupDelta,
  expandSelectionToZoneGroup,
  findFlowNodeIdsInRect,
  inferZoneDragMode,
  selectionBoundsForNodeIds,
  selectionCoversZone,
  zoneBounds,
} from "../src/editor/zone-selection";
import { mapFlowNodeId } from "../src/editor/mapLogic";

function miniGraph() {
  const zoneId = "zone_1";
  const graph = createGraph({
    id: "g",
    kind: "map",
    maps: [{ id: zoneId, name: "Z", x: 100, y: 200, width: 400, height: 300 }],
    nodes: [
      createNode({ id: "n1", kind: "dialog", mapId: zoneId, position: { x: 120, y: 280 } }),
      createNode({ id: "n2", kind: "battle", mapId: zoneId, position: { x: 120, y: 420 } }),
      createNode({ id: "n3", kind: "dialog", mapId: zoneId, position: { x: 120, y: 560 } }),
    ],
  });
  return { graph, zoneId };
}

describe("zone-selection", () => {
  it("map frame in selection → zoneGroup", () => {
    const { graph, zoneId } = miniGraph();
    const r = inferZoneDragMode(graph, [mapFlowNodeId(zoneId), "n1"]);
    expect(r.mode).toBe("zoneGroup");
    expect(r.zoneId).toBe(zoneId);
  });

  it("applyZoneGroupDelta moves zone and all inner nodes", () => {
    const { graph, zoneId } = miniGraph();
    const zone = graph.maps![0]!;
    const before = graph.nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    applyZoneGroupDelta(graph, zoneId, 50, -30);
    expect(zone.x).toBe(150);
    expect(zone.y).toBe(170);
    for (const b of before) {
      const n = graph.nodes.find((x) => x.id === b.id)!;
      expect(n.position.x).toBe(b.x + 50);
      expect(n.position.y).toBe(b.y - 30);
    }
  });

  it("partial inner selection → innerPartial", () => {
    const { graph, zoneId } = miniGraph();
    const r = inferZoneDragMode(graph, ["n1", "n2"]);
    expect(r.mode).toBe("innerPartial");
    expect(r.zoneId).toBe(zoneId);

    applyNodesDelta(graph, ["n1", "n2"], 10, 0);
    expect(graph.nodes.find((n) => n.id === "n1")!.position.x).toBe(130);
    expect(graph.nodes.find((n) => n.id === "n2")!.position.x).toBe(130);
    expect(graph.nodes.find((n) => n.id === "n3")!.position.x).toBe(120);
  });

  it("selectionCoversZone at 80% → zoneGroup", () => {
    const { graph, zoneId } = miniGraph();
    const zr = zoneBounds(graph.maps![0]!);
    const rect = { x: zr.x - 5, y: zr.y - 5, width: zr.width + 10, height: zr.height + 10 };
    expect(selectionCoversZone(rect, zr)).toBe(true);
    const r = inferZoneDragMode(graph, ["n1"], rect);
    expect(r.mode).toBe("zoneGroup");
    expect(r.zoneId).toBe(zoneId);
  });

  it("expandSelectionToZoneGroup includes frame and all nodes", () => {
    const { graph, zoneId } = miniGraph();
    const ids = expandSelectionToZoneGroup(graph, zoneId);
    expect(ids).toContain(mapFlowNodeId(zoneId));
    expect(ids).toContain("n1");
    expect(ids).toContain("n2");
    expect(ids).toContain("n3");
  });

  it("all inner nodes selected → zoneGroup", () => {
    const { graph, zoneId } = miniGraph();
    const r = inferZoneDragMode(graph, ["n1", "n2", "n3"]);
    expect(r.mode).toBe("zoneGroup");
  });

  it("findFlowNodeIdsInRect hits map frame and inner nodes", () => {
    const { graph, zoneId } = miniGraph();
    const zr = zoneBounds(graph.maps![0]!);
    const flowNodes = [
      { id: mapFlowNodeId(zoneId), position: { x: zr.x, y: zr.y } },
      { id: "n1", position: { x: 120, y: 280 } },
      { id: "n2", position: { x: 120, y: 420 } },
      { id: "n3", position: { x: 120, y: 560 } },
    ];
    const hits = findFlowNodeIdsInRect(graph, flowNodes, zr);
    expect(hits).toContain(mapFlowNodeId(zoneId));
    expect(hits).toContain("n1");
    expect(hits).toContain("n2");
    expect(hits).not.toContain("n3");
  });

  it("partial box does not include map frame", () => {
    const { graph, zoneId } = miniGraph();
    const partial = { x: 115, y: 275, width: 150, height: 160 };
    const flowNodes = [
      { id: mapFlowNodeId(zoneId), position: { x: 100, y: 200 } },
      { id: "n1", position: { x: 120, y: 280 } },
      { id: "n2", position: { x: 120, y: 420 } },
    ];
    const hits = findFlowNodeIdsInRect(graph, flowNodes, partial);
    expect(hits).toContain("n1");
    expect(hits).not.toContain(mapFlowNodeId(zoneId));
  });

  it("selectionBoundsForNodeIds wraps selected nodes", () => {
    const { graph, zoneId } = miniGraph();
    const flowNodes = [
      { id: "n1", position: { x: 120, y: 280 } },
      { id: "n2", position: { x: 120, y: 420 } },
    ];
    const bounds = selectionBoundsForNodeIds(graph, flowNodes, ["n1", "n2"]);
    expect(bounds).toBeTruthy();
    expect(bounds!.x).toBeLessThanOrEqual(120);
    expect(bounds!.y).toBeLessThanOrEqual(280);
  });
});
