import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  applyRuntimeShellFromMergeJson,
  buildMergeShellFromGameMap,
  importRuntimeMapIntoProject,
} from "../src/editor/map-import";
import { exportGameMapToRuntime } from "../src/editor/map-export";

describe("map-import", () => {
  const zoneId = "zone_i";
  const entryId = "entry_i";
  const graph = createGraph({
    id: "g_imp",
    kind: "map",
    maps: [{ id: zoneId, name: "NPC", npcUid: "npc_i", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({ id: entryId, kind: "npcEntry", npcUid: "npc_i", mapId: zoneId, position: { x: 0, y: 0 } }),
      createNode({
        id: "dlg_i",
        kind: "dialog",
        mapId: zoneId,
        speaker: "old",
        dialogLines: [{ id: "l0", text: "old" }],
        position: { x: 100, y: 0 },
      }),
      createNode({
        id: "gain_i",
        kind: "gainItem",
        mapId: zoneId,
        itemId: "old_item",
        itemCount: 1,
        position: { x: 200, y: 0 },
      }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeIds = ["dlg_i"];
  graph.nodes[0]!.options[0]!.targetNodeId = "dlg_i";
  graph.nodes[1]!.options[0]!.targetNodeIds = ["gain_i"];
  graph.nodes[1]!.options[0]!.targetNodeId = "gain_i";

  const project = {
    variables: [],
    quests: [{ id: "q1", name: "任务", initialStatus: "NotStarted" as const, graphId: "g_imp", taskId: 100001 }],
    graphs: [graph],
    gameMaps: [
      {
        id: "gm_imp",
        mapCode: "imp",
        mapId: 9,
        graphId: graph.id,
        tileSize: 48,
        npcs: [
          {
            npcUid: "npc_i",
            npcName: "NPC",
            x: 100,
            y: 100,
            zoneId,
            entryNodeId: entryId,
            exitNodeId: "",
          },
        ],
      },
    ],
  };

  it("syncs dialog, gainItem and appear from runtime", () => {
    const runtime = exportGameMapToRuntime(project.gameMaps![0]!, graph, project);
    runtime.npcs![0]!.appear = {
      mode: "conditional",
      matchMode: "ALL",
      requirements: [{ type: "task_completed", taskId: 100001 }],
    };
    const dlgId = runtime.npcs![0]!.events?.[0]?.client?.dialogueScriptId;
    if (dlgId && runtime.client?.dialogueScripts?.[dlgId]) {
      runtime.client.dialogueScripts[dlgId].lines = ["imported line"];
      runtime.client.dialogueScripts[dlgId].speaker = "imported";
    }
    const gainEv = runtime.npcs![0]!.events?.find((e) => e.server?.effects?.some((x) => x.action === "give_item"));
    if (gainEv) {
      gainEv.server!.effects = [{ action: "give_item", itemId: "new_potion", count: 5 }];
    }

    const res = importRuntimeMapIntoProject(project, "gm_imp", runtime);
    expect(res.ok).toBe(true);
    const npc = project.gameMaps![0]!.npcs[0]! as import("../src/types").GameMapNpcDef;
    expect(npc.appear?.mode).toBe("conditional");
    expect(npc.appear?.requirements?.[0]?.kind).toBe("questStatus");
    const dlg = graph.nodes.find((n) => n.id === "dlg_i")!;
    expect(dlg.speaker).toBe("imported");
    const gain = graph.nodes.find((n) => n.id === "gain_i")!;
    expect(gain.itemId).toBe("new_potion");
    expect(gain.itemCount).toBe(5);
    expect(res.message).toContain("摆点坐标未回写");
  });

  it("applyRuntimeShellFromMergeJson round-trips via buildMergeShellFromGameMap", () => {
    const gm = project.gameMaps![0]!;
    const ok = applyRuntimeShellFromMergeJson(gm, {
      client: {
        bgm: "bgm_test",
        scenePrefabKey: "scene_a",
        markerPrefabs: { small: "m_small", elite: "m_elite", boss: "m_boss" },
      },
    });
    expect(ok).toBe(true);
    const shell = buildMergeShellFromGameMap(gm);
    expect(shell).toEqual({
      client: {
        bgm: "bgm_test",
        scenePrefabKey: "scene_a",
        markerPrefabs: { small: "m_small", elite: "m_elite", boss: "m_boss" },
      },
    });
  });
});
