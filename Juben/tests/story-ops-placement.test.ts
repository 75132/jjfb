import { describe, expect, it } from "vitest";
import { applyStorySettingsToPlacement } from "../src/editor/apply-story-placement";
import { insertNodeAfter, deleteNodeRewire } from "../src/editor/chain-ops";
import { createGraph, createNode, getOptionTargets } from "../src/types";
import type { GameMapDef, ProjectData } from "../src/types";

describe("chain-ops", () => {
  it("inserts node after and rewires primary option", () => {
    const a = createNode({ kind: "dialog", id: "a", title: "A" });
    const b = createNode({ kind: "dialog", id: "b", title: "B" });
    a.options[0] && (a.options[0].targetNodeId = "b");
    const graph = createGraph({ kind: "map", nodes: [a, b] });
    const mid = insertNodeAfter(graph, "a", "choice");
    expect(mid).toBeTruthy();
    expect(getOptionTargets(a.options[0]!)).toEqual([mid!.id]);
    expect(getOptionTargets(mid!.options[0]!)).toEqual(["b"]);
  });

  it("deleteNodeRewire bridges predecessor to successor", () => {
    const a = createNode({ kind: "dialog", id: "a", title: "A" });
    const mid = createNode({ kind: "dialog", id: "mid", title: "M" });
    const b = createNode({ kind: "dialog", id: "b", title: "B" });
    a.options[0] && (a.options[0].targetNodeId = "mid");
    mid.options[0] && (mid.options[0].targetNodeId = "b");
    const graph = createGraph({ kind: "map", nodes: [a, mid, b] });
    const result = deleteNodeRewire(graph, "mid");
    expect(result.ok).toBe(true);
    expect(graph.nodes.find((n) => n.id === "mid")).toBeUndefined();
    expect(getOptionTargets(a.options[0]!)).toEqual(["b"]);
  });
});

describe("applyStorySettingsToPlacement", () => {
  it("fills missing coords and prefab without touching chain nodes", () => {
    const entry = createNode({ kind: "npcEntry", id: "entry", title: "入口" });
    const dialog = createNode({ kind: "dialog", id: "d1", title: "对白", text: "hello" });
    entry.options[0] && (entry.options[0].targetNodeId = "d1");
    const graph = createGraph({ kind: "map", id: "g1", nodes: [entry, dialog] });
    const gameMap: GameMapDef = {
      id: "m1",
      mapCode: "m1",
      mapId: 1,
      mapName: "测试",
      graphId: "g1",
      tileSize: 32,
      npcs: [
        {
          npcUid: "npc_1",
          npcName: "卫兵",
          x: Number.NaN,
          y: Number.NaN,
          entryNodeId: "entry",
          zoneId: "zone_1",
          prefabKey: undefined,
        },
      ],
    };
    const project = {
      id: "p1",
      name: "p",
      graphs: [graph],
      gameMaps: [gameMap],
      quests: [],
      variables: [],
      resources: {},
    } as unknown as ProjectData;

    const beforeText = dialog.text;
    const result = applyStorySettingsToPlacement(project, gameMap);
    expect(result.coordsFilled).toBe(1);
    expect(Number.isFinite(gameMap.npcs[0]!.x)).toBe(true);
    expect(Number.isFinite(gameMap.npcs[0]!.y)).toBe(true);
    expect(dialog.text).toBe(beforeText);
  });
});

describe("setUnlockTargetsAfterChainComplete", () => {
  it("writes event_done appear onto selected target npcs", async () => {
    const { setUnlockTargetsAfterChainComplete, listNpcUidsUnlockedByEvent, resolveChainCompleteEventId } =
      await import("../src/editor/npc-appear");
    const e1 = createNode({ kind: "npcEntry", id: "e1", title: "入口1", npcUid: "npc_1" });
    const d1 = createNode({ kind: "dialog", id: "d1", title: "对白1", text: "a", npcUid: "npc_1" });
    const q1 = createNode({
      kind: "questUpdate",
      id: "q1",
      title: "完成",
      questStatus: "Completed",
      npcUid: "npc_1",
    });
    e1.options[0] && (e1.options[0].targetNodeId = "d1");
    d1.options[0] && (d1.options[0].targetNodeId = "q1");
    const e2 = createNode({ kind: "npcEntry", id: "e2", title: "入口2", npcUid: "npc_2" });
    const graph = createGraph({ kind: "map", id: "g1", nodes: [e1, d1, q1, e2] });
    const gameMap: GameMapDef = {
      id: "m1",
      mapCode: "m1",
      mapId: 1,
      mapName: "测试",
      graphId: "g1",
      tileSize: 32,
      npcs: [
        { npcUid: "npc_1", npcName: "一", x: 0, y: 0, entryNodeId: "e1", zoneId: "z1" },
        { npcUid: "npc_2", npcName: "二", x: 0, y: 0, entryNodeId: "e2", zoneId: "z2" },
      ],
    };
    const project = {
      id: "p1",
      name: "p",
      graphs: [graph],
      gameMaps: [gameMap],
      quests: [],
      variables: [],
      resources: {},
    } as unknown as ProjectData;

    const eventId = resolveChainCompleteEventId(project, gameMap, gameMap.npcs[0]!);
    expect(eventId).toBeTruthy();
    const result = setUnlockTargetsAfterChainComplete(project, gameMap, "npc_1", ["npc_2"]);
    expect(result.updated).toBe(1);
    expect(listNpcUidsUnlockedByEvent(gameMap, eventId!)).toEqual(["npc_2"]);
    expect(gameMap.npcs[1]!.appear?.mode).toBe("conditional");
    expect(gameMap.npcs[1]!.appear?.requirements?.[0]).toEqual({ kind: "eventDone", eventId });
  });
});
