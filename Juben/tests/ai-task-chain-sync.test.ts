import { describe, expect, it } from "vitest";
import { syncTaskChainsFromBrief, createTaskChain, defaultNpcGridPosition } from "../src/editor/ai/ai-task-chain-sync";
import { applyStreamOp, createApplierContext } from "../src/editor/ai/story-stream-applier";
import { ensureTimelineGraph } from "../src/editor/map-tree";
import { createGraph } from "../src/types";

function emptyProject() {
  const p = {
    variables: [],
    quests: [],
    graphs: [] as ReturnType<typeof createGraph>[],
    gameMaps: [],
    resources: {},
  };
  ensureTimelineGraph(p as any);
  return p as any;
}

describe("ai task chain sync", () => {
  it("creates task chains from brief.tasks", () => {
    const project = emptyProject();
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    project.graphs.push(graph);
    const gameMap = {
      id: "gm1",
      mapCode: "test",
      mapId: 0,
      mapName: "图",
      graphId: "g_map",
      tileSize: 48,
      npcs: [],
    };
    project.gameMaps.push(gameMap);

    const created = syncTaskChainsFromBrief(project, gameMap, {
      type: "requirementsBrief",
      tasks: [
        { taskKey: "task_1", title: "初次接触", npcName: "凯尔" },
        { taskKey: "task_2", title: "机甲回收", npcName: "凯尔" },
      ],
    });

    expect(created).toEqual(["task_1", "task_2"]);
    expect(gameMap.npcs).toHaveLength(2);
    expect(gameMap.npcs[0]?.x).toBe(192);
    expect(gameMap.npcs[1]?.x).toBe(352);
    const entry = graph.nodes.find((n) => n.id === gameMap.npcs[0]!.entryNodeId);
    expect(entry?.title).toBe("初次接触");
  });

  it("syncTaskChainsFromBrief creates separate chains for blueprint tasks", () => {
    const project = emptyProject();
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    project.graphs.push(graph);
    project.quests.push({ id: "q1", name: "Q", initialStatus: "NotStarted", graphId: "g_map", taskId: 100001 });
    const gameMap = {
      id: "gm1",
      mapCode: "test",
      mapId: 0,
      mapName: "图",
      graphId: "g_map",
      tileSize: 48,
      npcs: [],
    };
    project.gameMaps.push(gameMap);

    syncTaskChainsFromBrief(project, gameMap, {
      type: "requirementsBrief",
      storyGoal: "多链",
      constraints: ["multiChainBlueprint"],
      tasks: [
        { taskKey: "c_1", title: "对话1", slotKind: "dialog", slotIndex: 1 },
        { taskKey: "c_2", title: "战斗2", slotKind: "battle", enemyCount: 2, slotIndex: 2 },
        { taskKey: "c_3", title: "战斗3", slotKind: "battle", enemyCount: 1, slotIndex: 3 },
      ],
    });

    expect(gameMap.npcs.map((n) => n.npcUid)).toEqual(["c_1", "c_2", "c_3"]);
  });

  it("addTaskChain op creates npc and zone", () => {
    const project = emptyProject();
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    project.graphs.push(graph);
    const gameMap = {
      id: "gm1",
      mapCode: "test",
      mapId: 0,
      mapName: "图",
      graphId: "g_map",
      tileSize: 48,
      npcs: [],
    };
    project.gameMaps.push(gameMap);
    const ctx = createApplierContext(project, graph, gameMap);

    const r = applyStreamOp(ctx, {
      op: "addTaskChain",
      npcUid: "task_1",
      title: "任务一",
      npcName: "博士",
    });

    expect(r.applied).toBe(1);
    expect(gameMap.npcs).toHaveLength(1);
    expect(graph.maps?.some((m) => m.npcUid === "task_1")).toBe(true);
  });

  it("auto-provisions unknown npcUid on addNode", () => {
    const project = emptyProject();
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    project.graphs.push(graph);
    const gameMap = {
      id: "gm1",
      mapCode: "test",
      mapId: 0,
      mapName: "图",
      graphId: "g_map",
      tileSize: 48,
      npcs: [],
    };
    project.gameMaps.push(gameMap);
    const ctx = createApplierContext(project, graph, gameMap);

    applyStreamOp(ctx, {
      op: "addNode",
      tempId: "n1",
      kind: "dialog",
      npcUid: "task_auto",
      title: "自动任务",
      after: "entry",
    });

    expect(gameMap.npcs.some((n) => n.npcUid === "task_auto")).toBe(true);
  });

  it("defaultNpcGridPosition spaces npcs on grid", () => {
    const gm = { npcs: [{}, {}, {}, {}] } as any;
    const p = defaultNpcGridPosition(gm);
    expect(p.x).toBe(192);
    expect(p.y).toBe(320);
  });

  it("createTaskChain updates existing entry title", () => {
    const project = emptyProject();
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    project.graphs.push(graph);
    const gameMap = {
      id: "gm1",
      mapCode: "test",
      mapId: 0,
      mapName: "图",
      graphId: "g_map",
      tileSize: 48,
      npcs: [],
    };
    project.gameMaps.push(gameMap);
    createTaskChain(project, gameMap, { npcUid: "t1", title: "旧名", npcName: "旧" });
    createTaskChain(project, gameMap, { npcUid: "t1", title: "新名", npcName: "新" });
    const entry = graph.nodes.find((n) => n.kind === "npcEntry");
    expect(entry?.title).toBe("新名");
    expect(gameMap.npcs).toHaveLength(1);
  });
});
