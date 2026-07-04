import { describe, expect, it } from "vitest";
import type { GraphData } from "../src/types";
import { createGraph, createNode, setOptionTargets } from "../src/types";
import { layoutMapGraphNodes, layoutZoneNodes } from "../src/editor/graph-auto-layout";
import { STORY_NODE_LAYOUT_H, STORY_NODE_LAYOUT_W } from "../src/editor/mapLogic";

function connect(from: ReturnType<typeof createNode>, toId: string) {
  if (from.options.length === 0) from.options.push({ id: "opt", text: "继续" });
  setOptionTargets(from.options[0]!, [toId]);
}

function buildLinearZoneGraph(): { graph: GraphData; zoneId: string; entryId: string; exitId: string } {
  const zoneId = "zone_a";
  const entry = createNode({ id: "entry", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } });
  const d1 = createNode({ id: "d1", kind: "dialog", mapId: zoneId, position: { x: 400, y: 0 } });
  const battle = createNode({ id: "b1", kind: "battle", mapId: zoneId, position: { x: 800, y: 0 } });
  const exit = createNode({ id: "exit", kind: "npcExit", mapId: zoneId, position: { x: 1200, y: 0 } });
  connect(entry, d1.id);
  connect(d1, battle.id);
  connect(battle, exit.id);

  const graph = createGraph({
    id: "g1",
    kind: "map",
    maps: [{ id: zoneId, name: "A", x: 40, y: 40, width: 480, height: 360 }],
    nodes: [entry, d1, battle, exit],
  });
  return { graph, zoneId, entryId: entry.id, exitId: exit.id };
}

describe("graph-auto-layout", () => {
  it("linear chain: vertical layers with serpentine X (not one rigid column)", async () => {
    const { graph, zoneId } = buildLinearZoneGraph();
    await layoutZoneNodes(graph, zoneId);

    const nodes = graph.nodes.filter((n) => n.mapId === zoneId);
    const ys = nodes.map((n) => n.position.y).sort((a, b) => a - b);
    expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(80);

    const xs = nodes.map((n) => n.position.x);
    const uniqueX = new Set(xs.map((x) => Math.round(x / 8)));
    expect(uniqueX.size).toBeGreaterThan(1);

    const xSpread = Math.max(...xs) - Math.min(...xs);
    expect(xSpread).toBeGreaterThan(20);
    expect(xSpread).toBeLessThan(STORY_NODE_LAYOUT_W * 2);
  });

  it("choice branches: first option left of second, similar Y rank", async () => {
    const zoneId = "zone_b";
    const entry = createNode({ id: "e", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } });
    const choice = createNode({ id: "ch", kind: "choice", mapId: zoneId, position: { x: 0, y: 0 } });
    choice.options = [
      { id: "yes", text: "是", targetNodeId: "dy" },
      { id: "no", text: "否", targetNodeId: "dn" },
    ];
    const dy = createNode({ id: "dy", kind: "dialog", mapId: zoneId, position: { x: 0, y: 0 } });
    const dn = createNode({ id: "dn", kind: "dialog", mapId: zoneId, position: { x: 0, y: 0 } });
    const exit = createNode({ id: "x", kind: "npcExit", mapId: zoneId, position: { x: 0, y: 0 } });
    connect(entry, choice.id);
    connect(dy, exit.id);
    connect(dn, exit.id);

    const graph = createGraph({
      id: "g2",
      kind: "map",
      maps: [{ id: zoneId, x: 0, y: 0, width: 520, height: 400 }],
      nodes: [entry, choice, dy, dn, exit],
    });
    await layoutZoneNodes(graph, zoneId);

    expect(choice.position.y).toBeLessThan(dy.position.y);
    expect(choice.position.y).toBeLessThan(dn.position.y);
    expect(dy.position.x).toBeLessThan(dn.position.x);
    expect(Math.abs(dy.position.y - dn.position.y)).toBeLessThan(STORY_NODE_LAYOUT_H);
    expect(Math.abs(dy.position.x - dn.position.x)).toBeGreaterThan(40);
  });

  it("layoutMapGraphNodes skips skipAutoLayout zones", async () => {
    const { graph, zoneId } = buildLinearZoneGraph();
    const before = graph.nodes.map((n) => ({ id: n.id, ...n.position }));
    graph.maps![0]!.skipAutoLayout = true;

    const r = await layoutMapGraphNodes(graph);
    expect(r.skippedZoneIds).toContain(zoneId);
    for (const b of before) {
      const n = graph.nodes.find((x) => x.id === b.id)!;
      expect(n.position.x).toBe(b.x);
      expect(n.position.y).toBe(b.y);
    }
  });

  it("expands zone when layout exceeds bounds", async () => {
    const { graph, zoneId } = buildLinearZoneGraph();
    graph.maps![0]!.width = 200;
    graph.maps![0]!.height = 120;
    await layoutZoneNodes(graph, zoneId);
    const zone = graph.maps!.find((m) => m.id === zoneId)!;
    expect(zone.width).toBeGreaterThan(200);
    expect(zone.height).toBeGreaterThan(120);
  });
});
