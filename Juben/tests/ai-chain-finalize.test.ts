import { describe, expect, it } from "vitest";
import { finalizeAiNpcZoneChain } from "../src/editor/ai/ai-chain-finalize";
import { createGraph, createNode, getOptionTargets } from "../src/types";

describe("ai-chain-finalize", () => {
  it("inserts orphan choice between dialog and exit", () => {
    const graph = createGraph({ id: "g", kind: "map", name: "m", nodes: [], maps: [] });
    graph.maps = [{ id: "zone1", name: "Z", npcUid: "npc1", x: 0, y: 0, width: 400, height: 600 }];
    const entry = createNode({
      id: "entry",
      kind: "npcEntry",
      mapId: "zone1",
      npcUid: "npc1",
      position: { x: 0, y: 100 },
    });
    entry.options = [{ id: "o0", text: "开始" }];
    const exit = createNode({ id: "exit", kind: "npcExit", mapId: "zone1", position: { x: 0, y: 500 } });
    const dialog = createNode({
      id: "d1",
      kind: "dialog",
      mapId: "zone1",
      npcUid: "npc1",
      title: "对白",
      position: { x: 0, y: 200 },
    });
    dialog.options = [{ id: "od", text: "继续", targetNodeId: "exit", targetNodeIds: ["exit"] }];
    const choice = createNode({
      id: "c1",
      kind: "choice",
      mapId: "zone1",
      npcUid: "npc1",
      title: "选择",
      position: { x: 0, y: 300 },
    });
    choice.options = [
      { id: "oc0", text: "接受" },
      { id: "oc1", text: "暂缓" },
    ];
    graph.nodes = [entry, exit, dialog, choice];
    entry.options[0]!.targetNodeId = dialog.id;
    entry.options[0]!.targetNodeIds = [dialog.id];

    const r = finalizeAiNpcZoneChain(graph, "entry", "exit");
    expect(r.fixedLinks).toBeGreaterThan(0);
    expect(getOptionTargets(dialog.options[0]!)).toContain("c1");
    expect(getOptionTargets(dialog.options[0]!)).not.toContain("exit");
    expect(getOptionTargets(choice.options[1]!)).toContain("exit");
  });
});

describe("NdjsonLineParser array", () => {
  it("parses JSON array of ops in one line", async () => {
    const { NdjsonLineParser } = await import("../src/editor/ai/story-stream-parser");
    const p = new NdjsonLineParser();
    const { ops } = p.push(
      '[{"op":"addNode","tempId":"a","kind":"dialog","title":"1"},{"op":"addNode","tempId":"b","kind":"battle","title":"2"}]',
    );
    expect(ops).toHaveLength(2);
    expect(ops[0]?.op).toBe("addNode");
    expect(ops[1]?.kind).toBe("battle");
  });
});
