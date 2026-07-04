import { describe, expect, it } from "vitest";
import { applyStreamOp, createApplierContext } from "../src/editor/ai/story-stream-applier";
import { createGraph, createNode } from "../src/types";
import type { GameMapDef, ProjectData } from "../src/types";

function sampleProject(): ProjectData {
  const graph = createGraph({ id: "g_map", kind: "map", name: "测试" });
  const entry = createNode({ id: "entry_1", kind: "npcEntry", mapId: "zone_npc1", title: "入口" });
  const exit = createNode({ id: "exit_1", kind: "npcExit", mapId: "zone_npc1", title: "出口" });
  graph.maps = [{ id: "zone_npc1", name: "NPC1", npcUid: "0_lead_01", x: 40, y: 40, width: 400, height: 200 }];
  graph.nodes = [entry, exit];

  const gameMap: GameMapDef = {
    id: "gm1",
    mapCode: "test",
    mapId: 0,
    graphId: "g_map",
    tileSize: 48,
    npcs: [
      {
        npcUid: "0_lead_01",
        npcName: "韩诺",
        x: 100,
        y: 100,
        zoneId: "zone_npc1",
        entryNodeId: "entry_1",
        exitNodeId: "exit_1",
      },
    ],
  };

  return {
    variables: [],
    quests: [{ id: "q1", name: "主线", initialStatus: "NotStarted", graphId: "g_map", taskId: 100001 }],
    graphs: [graph],
    gameMaps: [gameMap],
  };
}

describe("ai-stream-applier", () => {
  it("adds dialog and connects from entry", () => {
    const project = sampleProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const ctx = createApplierContext(project, graph, gm);

    const r = applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n1",
      kind: "dialog",
      npcUid: "0_lead_01",
      title: "报到",
      speaker: "韩诺",
      dialogLines: ["你好"],
      after: "entry",
    });

    expect(r.applied).toBe(1);
    expect(graph.nodes.some((n) => n.kind === "dialog" && n.title === "报到")).toBe(true);
    const entry = graph.nodes.find((n) => n.id === "entry_1");
    expect(entry?.options[0]?.targetNodeId ?? entry?.options[0]?.targetNodeIds?.[0]).toBeTruthy();
  });

  it("rejects battle addNode on giver main chain (RM guard)", () => {
    const project = sampleProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const ctx = createApplierContext(project, graph, gm);

    applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n1",
      kind: "dialog",
      npcUid: "0_lead_01",
      after: "entry",
    });
    const r = applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n2",
      kind: "battle",
      npcUid: "0_lead_01",
      battleConfigId: "battle_300001",
      afterTempId: "n1",
    });

    expect(r.applied).toBe(0);
    expect(r.warnings?.length).toBeGreaterThan(0);
    expect(graph.nodes.filter((n) => n.kind === "battle")).toHaveLength(0);
  });

  it("rejects battle addNode on dialog slot even when AI tries", () => {
    const project = sampleProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    gm.npcs[0]!.chainSlotKind = "dialog";
    const ctx = createApplierContext(project, graph, gm);

    const r = applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n_b",
      kind: "battle",
      npcUid: "0_lead_01",
      after: "entry",
    });

    expect(r.applied).toBe(0);
    expect(graph.nodes.some((n) => n.kind === "battle")).toBe(false);
  });

  it("deletes middle node and disconnects", () => {
    const project = sampleProject();
    const graph = project.graphs[0]!;
    const gm = project.gameMaps![0]!;
    const ctx = createApplierContext(project, graph, gm);

    applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n1",
      kind: "dialog",
      npcUid: "0_lead_01",
      after: "entry",
    });
    const nodeId = ctx.tempIdMap.get("n1")!;
    const del = applyStreamOp(ctx, { op: "deleteNode", nodeId });
    expect(del.applied).toBe(1);
    expect(graph.nodes.some((n) => n.id === nodeId)).toBe(false);

    applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n2",
      kind: "dialog",
      npcUid: "0_lead_01",
      after: "entry",
    });
    const n2 = ctx.tempIdMap.get("n2")!;
    applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n3",
      kind: "dialog",
      npcUid: "0_lead_01",
      afterTempId: "n2",
    });
    const n3 = ctx.tempIdMap.get("n3")!;
    const disc = applyStreamOp(ctx, { op: "disconnect", fromId: n2, optionIndex: 0, targetNodeId: n3 });
    expect(disc.applied).toBe(1);
  });

  it("addTaskChain op creates npc and zone", () => {
    const project = sampleProject();
    const graph = project.graphs[0]!;
    const gm = { ...project.gameMaps![0]!, npcs: [] };
    project.gameMaps = [gm];
    graph.nodes = [];
    graph.maps = [];
    const ctx = createApplierContext(project, graph, gm);

    const r = applyStreamOp(ctx, {
      op: "addTaskChain",
      npcUid: "task_new",
      title: "新任务",
    });

    expect(r.applied).toBe(1);
    expect(gm.npcs.some((n) => n.npcUid === "task_new")).toBe(true);
  });
});
