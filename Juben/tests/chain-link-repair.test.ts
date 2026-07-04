import { describe, expect, it } from "vitest";
import { repairNpcZoneLinks } from "../src/editor/chain-link-repair";
import { createGraph, createNode, getOptionTargets, setOptionTargets } from "../src/types";

describe("chain link repair", () => {
  it("connects entry to first orphan node", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "npc1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1", title: "入" });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1", title: "出" });
    const dialog = createNode({ id: "d1", kind: "dialog", mapId: "zone1", title: "对白", npcUid: "npc1" });
    graph.nodes = [entry, exit, dialog];

    const r = repairNpcZoneLinks(graph, "entry", "exit");
    expect(r.fixedLinks).toBeGreaterThan(0);
    expect(getOptionTargets(entry.options[0]!)).toContain("d1");
  });

  it("wires open tail to exit", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "npc1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1" });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1" });
    const battle = createNode({ id: "b1", kind: "battle", mapId: "zone1", title: "战斗" });
    entry.options = [{ id: "o0", text: "开始" }];
    setOptionTargets(entry.options[0]!, ["b1"]);
    graph.nodes = [entry, exit, battle];

    repairNpcZoneLinks(graph, "entry", "exit");
    expect(getOptionTargets(battle.options[0]!)).toContain("exit");
  });

  it("chains multiple orphans when entry already linked to wrong node", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "npc1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1", position: { x: 0, y: 0 } });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1" });
    const d1 = createNode({ id: "d1", kind: "dialog", mapId: "zone1", title: "一", position: { x: 0, y: 100 } });
    const d2 = createNode({ id: "d2", kind: "dialog", mapId: "zone1", title: "二", position: { x: 0, y: 200 } });
    entry.options = [{ id: "o0", text: "开始" }];
    setOptionTargets(entry.options[0]!, ["d2"]);
    graph.nodes = [entry, exit, d1, d2];

    const r = repairNpcZoneLinks(graph, "entry", "exit");
    expect(r.fixedLinks).toBeGreaterThan(0);
    expect(
      getOptionTargets(d2.options[0] ?? { id: "x", text: "" }).includes("d1") ||
        getOptionTargets(d1.options[0] ?? { id: "x", text: "" }).includes("d2") ||
        getOptionTargets(d2.options[0] ?? { id: "x", text: "" }).includes("exit"),
    ).toBe(true);
  });
});
