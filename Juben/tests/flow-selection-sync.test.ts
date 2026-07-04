import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { resolveLayoutZoneId } from "../src/editor/layout-zone";

describe("resolveLayoutZoneId", () => {
  const zoneId = "zone_a";
  const graph = createGraph({
    id: "g1",
    kind: "map",
    maps: [{ id: zoneId, name: "A", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: "n1", mapId: zoneId, position: { x: 10, y: 10 } }),
      createNode({ id: "n2", mapId: zoneId, position: { x: 10, y: 120 } }),
      createNode({ id: "n3", mapId: "zone_b", position: { x: 500, y: 10 } }),
    ],
  });

  it("prefers selectedMapId", () => {
    expect(
      resolveLayoutZoneId({
        graph,
        selectedMapId: zoneId,
        selectedNodeId: "n3",
        selectedNodeIds: ["n3"],
      }),
    ).toBe(zoneId);
  });

  it("infers from selectedNodeId mapId", () => {
    expect(
      resolveLayoutZoneId({
        graph,
        selectedMapId: null,
        selectedNodeId: "n1",
        selectedNodeIds: ["n1"],
      }),
    ).toBe(zoneId);
  });

  it("infers from selectedNodeIds in single zone", () => {
    expect(
      resolveLayoutZoneId({
        graph,
        selectedMapId: null,
        selectedNodeId: null,
        selectedNodeIds: ["n1", "n2"],
      }),
    ).toBe(zoneId);
  });

  it("returns null for cross-zone multi select", () => {
    expect(
      resolveLayoutZoneId({
        graph,
        selectedMapId: null,
        selectedNodeId: null,
        selectedNodeIds: ["n1", "n3"],
      }),
    ).toBeNull();
  });

  it("uses focusedZoneId as fallback", () => {
    expect(
      resolveLayoutZoneId({
        graph,
        selectedMapId: null,
        selectedNodeId: null,
        selectedNodeIds: [],
        focusedZoneId: zoneId,
      }),
    ).toBe(zoneId);
  });

  it("returns null on non-map graph", () => {
    const main = createGraph({ id: "g2", kind: "mainline", nodes: [] });
    expect(
      resolveLayoutZoneId({
        graph: main,
        selectedMapId: zoneId,
        selectedNodeId: null,
        selectedNodeIds: [],
      }),
    ).toBeNull();
  });
});
