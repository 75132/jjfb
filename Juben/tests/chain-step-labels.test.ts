import { describe, expect, it } from "vitest";
import { computeChainStepLabels, formatChainSummary } from "../src/editor/chain-step-labels";
import { createGraph, createNode, setOptionTargets } from "../src/types";

describe("chain step labels", () => {
  it("labels linear chain 1,2,3", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "n1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1" });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1" });
    const d1 = createNode({ id: "d1", kind: "dialog", mapId: "zone1", title: "A" });
    const d2 = createNode({ id: "d2", kind: "dialog", mapId: "zone1", title: "B" });
    entry.options = [{ id: "e0", text: "开始" }];
    d1.options = [{ id: "d1o", text: "继续" }];
    d2.options = [{ id: "d2o", text: "继续" }];
    setOptionTargets(entry.options[0]!, ["d1"]);
    setOptionTargets(d1.options[0]!, ["d2"]);
    setOptionTargets(d2.options[0]!, ["exit"]);
    graph.nodes = [entry, exit, d1, d2];

    const labels = computeChainStepLabels(graph, "entry");
    expect(labels.get("d1")).toBe("1");
    expect(labels.get("d2")).toBe("2");
  });

  it("labels sibling branches 2-1 and 2-2", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "n1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1" });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1" });
    const battle = createNode({ id: "b1", kind: "battle", mapId: "zone1", title: "战斗" });
    const choice = createNode({
      id: "c1",
      kind: "choice",
      mapId: "zone1",
      title: "结果",
      options: [
        { id: "o0", text: "失败" },
        { id: "o1", text: "胜利" },
      ],
    });
    const fail = createNode({ id: "f1", kind: "dialog", mapId: "zone1", title: "失败后续" });
    const win = createNode({ id: "w1", kind: "dialog", mapId: "zone1", title: "胜利后续" });
    entry.options = [{ id: "e0", text: "开始" }];
    battle.options = [{ id: "b0", text: "继续" }];
    fail.options = [{ id: "f0", text: "继续" }];
    win.options = [{ id: "w0", text: "继续" }];
    setOptionTargets(entry.options[0]!, ["b1"]);
    setOptionTargets(battle.options[0]!, ["c1"]);
    setOptionTargets(choice.options[0]!, ["f1"]);
    setOptionTargets(choice.options[1]!, ["w1"]);
    setOptionTargets(fail.options[0]!, ["exit"]);
    setOptionTargets(win.options[0]!, ["exit"]);
    graph.nodes = [entry, exit, battle, choice, fail, win];

    const labels = computeChainStepLabels(graph, "entry");
    expect(labels.get("b1")).toBe("1");
    expect(labels.get("c1")).toBe("2");
    expect(labels.get("f1")).toBe("2-1");
    expect(labels.get("w1")).toBe("2-2");
  });

  it("formatChainSummary includes step numbers", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "n1", x: 0, y: 0, width: 400, height: 300 }];
    const entry = createNode({ id: "entry", kind: "npcEntry", mapId: "zone1" });
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1" });
    const d1 = createNode({ id: "d1", kind: "dialog", mapId: "zone1", title: "报到" });
    entry.options = [{ id: "e0", text: "开始" }];
    d1.options = [{ id: "d0", text: "继续" }];
    setOptionTargets(entry.options[0]!, ["d1"]);
    setOptionTargets(d1.options[0]!, ["exit"]);
    graph.nodes = [entry, exit, d1];

    const summary = formatChainSummary(graph, "entry");
    expect(summary).toContain("1报到");
  });
});
