import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import type { ProjectData } from "../src/types";
import {
  buildRuntimeTasksFromQuests,
  migrateGameMapTasksToQuests,
  normalizeGlobalQuests,
  reorderQuests,
} from "../src/editor/quest-logic";
import { syncQuestsFromTimeline, migrateToTimeline } from "../src/editor/timeline-logic";

function minimalProject(overrides?: Partial<ProjectData>): ProjectData {
  return {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [],
    gameMaps: [],
    resources: {},
    ...overrides,
  };
}

describe("global quest list", () => {
  it("migrates gameMap.tasks into project.quests", () => {
    const questGraph = createGraph({
      id: "gq_report",
      kind: "quest",
      name: "任务：报到",
      nodes: [
        createNode({ kind: "questEntry", position: { x: 0, y: 0 } }),
        createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 200, y: 0 } }),
      ],
    });
    const data = minimalProject({
      graphs: [questGraph],
      gameMaps: [
        {
          id: "gm1",
          mapCode: "test",
          mapId: 1,
          graphId: "g_map",
          tileSize: 48,
          npcs: [],
          tasks: [{ taskId: 100001, taskName: "报到", mainlineStep: 1 }],
        },
      ],
    });
    migrateGameMapTasksToQuests(data);
    expect(data.quests.length).toBe(1);
    expect(data.quests[0]?.taskId).toBe(100001);
    expect(data.quests[0]?.name).toBe("报到");
    expect(data.quests[0]?.graphId).toBe("gq_report");
  });

  it("creates quest graph when migrating orphan gameMap.tasks", () => {
    const data = minimalProject({
      gameMaps: [
        {
          id: "gm1",
          mapCode: "test",
          mapId: 1,
          graphId: "g_map",
          tileSize: 48,
          npcs: [],
          tasks: [{ taskId: 100099, taskName: "孤立任务", mainlineStep: 1 }],
        },
      ],
    });
    migrateGameMapTasksToQuests(data);
    expect(data.graphs.some((g) => g.kind === "quest")).toBe(true);
    expect(data.quests.some((q) => q.taskId === 100099)).toBe(true);
  });

  it("normalizes sortOrder and mainlineStep", () => {
    const data = minimalProject({
      quests: [
        { id: "q1", name: "A", initialStatus: "NotStarted", graphId: "g1" },
        { id: "q2", name: "B", initialStatus: "NotStarted", graphId: "g2" },
      ],
      graphs: [
        createGraph({ id: "g1", kind: "quest", nodes: [] }),
        createGraph({ id: "g2", kind: "quest", nodes: [] }),
      ],
    });
    normalizeGlobalQuests(data);
    expect(data.quests[0]?.sortOrder).toBe(0);
    expect(data.quests[0]?.mainlineStep).toBe(1);
    expect(data.quests[0]?.taskId).toBe(100001);
    expect(data.quests[1]?.sortOrder).toBe(1);
    expect(data.quests[1]?.mainlineStep).toBe(2);
    expect(data.quests[1]?.taskId).toBe(100002);
  });

  it("reorderQuests updates mainlineStep after drag", () => {
    const data = minimalProject({
      quests: [
        {
          id: "q1",
          name: "A",
          initialStatus: "NotStarted",
          graphId: "g1",
          taskId: 100001,
          sortOrder: 0,
          mainlineStep: 1,
        },
        {
          id: "q2",
          name: "B",
          initialStatus: "NotStarted",
          graphId: "g2",
          taskId: 100002,
          sortOrder: 1,
          mainlineStep: 2,
        },
      ],
      graphs: [
        createGraph({ id: "g1", kind: "quest", nodes: [] }),
        createGraph({ id: "g2", kind: "quest", nodes: [] }),
      ],
    });
    reorderQuests(data, 1, 0);
    expect(data.quests[0]?.id).toBe("q2");
    expect(data.quests[0]?.mainlineStep).toBe(1);
    expect(data.quests[1]?.mainlineStep).toBe(2);
  });

  it("syncQuestsFromTimeline derives quests from mapPortal nodes", () => {
    const p = minimalProject({
      graphs: [
        createGraph({
          id: "g_tl",
          kind: "timeline",
          name: "时间线",
          nodes: [
            createNode({
              id: "p1",
              kind: "mapPortal",
              title: "报到",
              gameMapId: "gm1",
              portalTaskId: 100001,
              position: { x: 0, y: 0 },
            }),
          ],
        }),
        createGraph({ id: "g_map", kind: "map", nodes: [] }),
      ],
      timelineGraphId: "g_tl",
      gameMaps: [{ id: "gm1", mapCode: "a", mapId: 1, graphId: "g_map", tileSize: 48, npcs: [] }],
    });
    syncQuestsFromTimeline(p);
    expect(p.quests.length).toBe(1);
    expect(p.quests[0]?.taskId).toBe(100001);
    expect(buildRuntimeTasksFromQuests(p.quests)[0]?.taskName).toBe("报到");
  });
});
