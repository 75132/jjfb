import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { addNpcToGameMap, createGameMapWithGraph, ensureNpcZonesAndEntries, taskLabelForNpc } from "../src/editor/game-map-logic";
import { ensureTimelineGraph } from "../src/editor/map-tree";

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

describe("task rename persistence", () => {
  it("keeps custom entry title through ensureNpcZonesAndEntries", () => {
    const project = emptyProject();
    const { gameMap } = createGameMapWithGraph(project, { mapName: "测试图", mapCode: "test", npcs: [] });
    const npc = addNpcToGameMap(project, gameMap, { npcUid: "npc_a", npcName: "任务 1" });
    expect(npc).toBeTruthy();

    const graph = project.graphs.find((g) => g.id === gameMap.graphId)!;
    const entry = graph.nodes.find((n) => n.id === npc!.entryNodeId)!;
    entry.title = "韩诺的委托";

    ensureNpcZonesAndEntries(project, gameMap);

    expect(taskLabelForNpc(project, gameMap, npc!, 0)).toBe("韩诺的委托");
    const exit = graph.nodes.find((n) => n.id === npc!.exitNodeId);
    expect(exit?.title).toBe("韩诺的委托 · 结尾");
    const zone = graph.maps!.find((m) => m.id === npc!.zoneId);
    expect(zone?.name).toBe("韩诺的委托");
  });

  it("does not overwrite existing custom title with default", () => {
    const graph = createGraph({ id: "g_map", kind: "map", name: "图", nodes: [], maps: [] });
    const project = {
      variables: [],
      quests: [],
      graphs: [graph],
      gameMaps: [
        {
          id: "gm1",
          mapCode: "c",
          mapId: 0,
          mapName: "图",
          graphId: "g_map",
          tileSize: 48,
          npcs: [
            {
              npcUid: "npc_a",
              npcName: "任务 1",
              zoneId: "zone_npc_a",
              entryNodeId: "entry_npc_a",
              exitNodeId: "exit_npc_a",
              x: 0,
              y: 0,
            },
          ],
        },
      ],
      resources: { npc: [{ id: "npc_a", kind: "npc" as const, name: "资源库名", note: "" }] },
    };
    graph.nodes.push(
      createNode({ id: "entry_npc_a", kind: "npcEntry", title: "自定义任务名", npcUid: "npc_a", mapId: "zone_npc_a" }),
      createNode({ id: "exit_npc_a", kind: "npcExit", title: "旧结尾", npcUid: "npc_a", mapId: "zone_npc_a" }),
    );
    graph.maps = [{ id: "zone_npc_a", name: "旧区", x: 0, y: 0, width: 400, height: 300, npcUid: "npc_a" }];

    ensureNpcZonesAndEntries(project, project.gameMaps[0]!);

    expect(graph.nodes.find((n) => n.id === "entry_npc_a")?.title).toBe("自定义任务名");
    expect(taskLabelForNpc(project, project.gameMaps[0]!, project.gameMaps[0]!.npcs[0]!, 0)).toBe("自定义任务名");
  });
});
