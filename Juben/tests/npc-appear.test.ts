import { describe, expect, it } from "vitest";
import type { GameMapNpcDef, ProjectData } from "../src/types";
import {
  defaultNpcAppearConfig,
  exportNpcAppear,
  normalizeNpcAppear,
  provisionNpcAppearFromChainOrder,
  shouldExportInitialHidden,
} from "../src/editor/npc-appear";
import { createNode } from "../src/types";

describe("npc-appear", () => {
  const baseNpc = (partial?: Partial<GameMapNpcDef>): GameMapNpcDef => ({
    npcUid: "npc_a",
    npcName: "测试",
    x: 0,
    y: 0,
    zoneId: "zone_a",
    entryNodeId: "entry_a",
    exitNodeId: "exit_a",
    ...partial,
  });

  it("defaults new npc to conditional hidden", () => {
    expect(defaultNpcAppearConfig().mode).toBe("conditional");
  });

  it("migrates initialHidden to appear", () => {
    expect(normalizeNpcAppear(baseNpc({ initialHidden: true })).mode).toBe("conditional");
    expect(normalizeNpcAppear(baseNpc({ initialHidden: false })).mode).toBe("always");
  });

  it("exports appear requirements with task id", () => {
    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId: "g1", taskId: 100001 }],
      graphs: [],
      gameMaps: [],
    };
    const npc = baseNpc({
      appear: {
        mode: "conditional",
        matchMode: "ALL",
        requirements: [{ kind: "questStatus", questId: "q1", status: "Completed" }],
      },
    });
    const exported = exportNpcAppear(npc, project);
    expect(exported.requirements).toEqual([{ type: "task_completed", taskId: 100001 }]);
    expect(shouldExportInitialHidden(npc)).toBe(true);
  });

  it("provisionNpcAppearFromChainOrder uses eventDone for second bundle", () => {
    const graphId = "g1";
    const entry1 = createNode({ id: "e0", kind: "npcEntry", mapId: "z0", npcUid: "n0", title: "入" });
    const dlg1 = createNode({ id: "d0", kind: "dialog", mapId: "z0", title: "对白" });
    const exit1 = createNode({ id: "x0", kind: "npcExit", mapId: "z0", title: "出" });
    entry1.options[0]!.targetNodeIds = [dlg1.id];
    dlg1.options[0]!.targetNodeIds = [exit1.id];

    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId, taskId: 100001 }],
      graphs: [
        {
          id: graphId,
          kind: "map",
          name: "m",
          nodes: [entry1, dlg1, exit1],
          maps: [],
        },
      ],
      gameMaps: [
        {
          id: "gm",
          graphId,
          mapCode: "c",
          mapId: 1,
          npcs: [
            {
              npcUid: "n0",
              npcName: "首",
              x: 0,
              y: 0,
              zoneId: "z0",
              entryNodeId: "e0",
              exitNodeId: "x0",
              appear: { mode: "conditional", requirements: [] },
            },
            {
              npcUid: "n1",
              npcName: "次",
              x: 0,
              y: 0,
              zoneId: "z1",
              entryNodeId: "e1",
              exitNodeId: "x1",
              appear: { mode: "conditional", requirements: [] },
            },
          ],
        },
      ],
    };
    const gm = project.gameMaps![0]!;
    const r = provisionNpcAppearFromChainOrder(project, gm, { forceRewrite: true });
    expect(r.provisioned).toBeGreaterThanOrEqual(2);
    expect(gm.npcs[0]!.appear?.mode).toBe("always");
    expect(gm.npcs[1]!.appear?.requirements?.[0]).toMatchObject({ kind: "eventDone", eventId: "n0_e1" });
  });

  it("provisionNpcAppearFromChainOrder fills first and second bundle", () => {
    const graphId = "g1";
    const project: ProjectData = {
      variables: [],
      quests: [{ id: "q1", name: "章", initialStatus: "NotStarted", graphId, taskId: 100001 }],
      graphs: [
        {
          id: graphId,
          kind: "map",
          name: "m",
          nodes: [
            createNode({
              id: "qu",
              kind: "questUpdate",
              mapId: "z0",
              questId: "q1",
              questStatus: "Completed",
            }),
          ],
          maps: [],
        },
      ],
      gameMaps: [
        {
          id: "gm",
          graphId,
          mapCode: "c",
          mapId: 1,
          npcs: [
            {
              npcUid: "n0",
              npcName: "首",
              x: 0,
              y: 0,
              zoneId: "z0",
              entryNodeId: "e0",
              exitNodeId: "x0",
              appear: { mode: "conditional", requirements: [] },
            },
            {
              npcUid: "n1",
              npcName: "次",
              x: 0,
              y: 0,
              zoneId: "z1",
              entryNodeId: "e1",
              exitNodeId: "x1",
              appear: { mode: "conditional", requirements: [] },
            },
          ],
        },
      ],
    };
    const gm = project.gameMaps![0]!;
    const r = provisionNpcAppearFromChainOrder(project, gm);
    expect(r.provisioned).toBe(2);
    expect(gm.npcs[0]!.appear?.mode).toBe("always");
    expect(gm.npcs[0]!.appear?.requirements ?? []).toHaveLength(0);
    expect(gm.npcs[1]!.appear?.requirements?.[0]).toMatchObject({ kind: "questStatus", status: "Completed" });
  });
});
