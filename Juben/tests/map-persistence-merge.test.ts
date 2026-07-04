import { describe, expect, it } from "vitest";
import { mergeWorkspaces, readLocalWorkspace, writeLocalWorkspace } from "../src/editor/persistence";

describe("mergeWorkspaces (explicit import/recovery only)", () => {
  it("prefers non-empty local when remote projects is empty", () => {
    const remote = {
      version: 1 as const,
      savedAt: 9999,
      currentProjectId: null,
      projects: [],
    };
    const local = {
      version: 1 as const,
      savedAt: 1000,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "本地项目",
          createdAt: 1,
          updatedAt: 5000,
          data: {
            variables: [],
            quests: [],
            graphs: [],
            resources: { npc: [{ id: "npc_a", kind: "npc" as const, name: "测试NPC", note: "" }] },
          },
        },
      ],
    };
    const merged = mergeWorkspaces(remote, local);
    expect(merged.projects.length).toBe(1);
    expect(merged.projects[0]?.data.resources?.npc?.[0]?.name).toBe("测试NPC");
  });

  it("merges projects by updatedAt per id", () => {
    const a = {
      version: 1 as const,
      savedAt: 100,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "旧",
          createdAt: 1,
          updatedAt: 100,
          data: { variables: [], quests: [], graphs: [], resources: {} },
        },
      ],
    };
    const b = {
      version: 1 as const,
      savedAt: 200,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "新",
          createdAt: 1,
          updatedAt: 500,
          data: {
            variables: [],
            quests: [],
            graphs: [],
            resources: { npc: [{ id: "n1", kind: "npc" as const, name: "韩诺", note: "" }] },
          },
        },
      ],
    };
    const merged = mergeWorkspaces(a, b);
    expect(merged.projects[0]?.name).toBe("新");
    expect(merged.projects[0]?.data.resources?.npc?.length).toBe(1);
  });

  it("keeps richer project when newer snapshot was wiped empty", () => {
    const rich = {
      version: 1 as const,
      savedAt: 100,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "有内容",
          createdAt: 1,
          updatedAt: 1000,
          data: {
            variables: [],
            quests: [],
            graphs: [{ id: "g1", name: "m", kind: "map" as const, nodes: [{ id: "n1" } as any], maps: [] }],
            gameMaps: [{ id: "gm1", mapCode: "x", mapId: 0, mapName: "x", graphId: "g1", tileSize: 48, npcs: [] }],
            resources: {},
          },
        },
      ],
    };
    const empty = {
      version: 1 as const,
      savedAt: 200,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "被清空",
          createdAt: 1,
          updatedAt: 5000,
          data: { variables: [], quests: [], graphs: [], gameMaps: [], resources: {} },
        },
      ],
    };
    const merged = mergeWorkspaces(rich, empty);
    expect(merged.projects[0]?.data.graphs[0]?.nodes.length).toBe(1);
  });

  it("writes and reads local workspace when localStorage is available", () => {
    if (typeof localStorage === "undefined") return;
    const ws = {
      version: 1 as const,
      savedAt: Date.now(),
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "t",
          createdAt: 1,
          updatedAt: 2,
          data: { variables: [], quests: [], graphs: [] },
        },
      ],
    };
    writeLocalWorkspace(ws);
    const again = readLocalWorkspace();
    expect(again?.projects[0]?.id).toBe("p1");
  });
});
