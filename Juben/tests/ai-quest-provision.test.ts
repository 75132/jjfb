import { describe, expect, it } from "vitest";
import { provisionNpcChainQuestAndExit } from "../src/editor/ai/ai-quest-provision";
import { finalizeAiNpcZoneChain } from "../src/editor/ai/ai-chain-finalize";
import { createGraph, createNode, getOptionTargets } from "../src/types";
import type { GameMapDef, ProjectData } from "../src/types";

function sampleMapProject(): { project: ProjectData; graph: ReturnType<typeof createGraph>; gm: GameMapDef } {
  const graph = createGraph({ id: "g_map", kind: "map", name: "测试" });
  graph.maps = [{ id: "zone1", name: "任务1", npcUid: "npc1", x: 0, y: 0, width: 500, height: 600 }];
  const entry = createNode({
    id: "entry",
    kind: "npcEntry",
    mapId: "zone1",
    npcUid: "npc1",
    title: "任务1",
    position: { x: 20, y: 100 },
  });
  entry.options = [{ id: "oe", text: "开始" }];
  const exit = createNode({
    id: "exit",
    kind: "npcExit",
    mapId: "zone1",
    npcUid: "npc1",
    position: { x: 20, y: 500 },
  });
  const dialog = createNode({
    id: "d1",
    kind: "dialog",
    mapId: "zone1",
    npcUid: "npc1",
    title: "对白",
    position: { x: 20, y: 200 },
  });
  const choice = createNode({
    id: "c1",
    kind: "choice",
    mapId: "zone1",
    npcUid: "npc1",
    title: "接受或暂缓",
    position: { x: 20, y: 300 },
  });
  choice.options = [
    { id: "oc0", text: "接受考验" },
    { id: "oc1", text: "暂缓" },
  ];
  entry.options[0]!.targetNodeId = dialog.id;
  entry.options[0]!.targetNodeIds = [dialog.id];
  graph.nodes = [entry, exit, dialog, choice];

  const gm: GameMapDef = {
    id: "gm1",
    mapCode: "test",
    mapId: 0,
    graphId: "g_map",
    tileSize: 48,
    npcs: [
      {
        npcUid: "npc1",
        npcName: "任务1",
        x: 100,
        y: 100,
        zoneId: "zone1",
        entryNodeId: "entry",
        exitNodeId: "exit",
      },
    ],
  };

  const project: ProjectData = {
    variables: [],
    quests: [
      {
        id: "qp_portal_1",
        name: "测试章节",
        initialStatus: "NotStarted",
        graphId: "g_map",
        taskId: 100001,
        mainlineStep: 1,
      },
    ],
    graphs: [graph],
    gameMaps: [gm],
  };

  return { project, graph, gm };
}

describe("ai-quest-provision", () => {
  it("adds questUpdate complete before exit and wires success path", () => {
    const { project, graph, gm } = sampleMapProject();
    finalizeAiNpcZoneChain(graph, "entry", "exit");

    const r = provisionNpcChainQuestAndExit(project, graph, gm, gm.npcs[0]!);
    expect(r.addedNodes).toBeGreaterThan(0);

    const complete = graph.nodes.find(
      (n) => n.kind === "questUpdate" && n.questStatus === "Completed" && n.mapId === "zone1",
    );
    expect(complete).toBeTruthy();
    expect(getOptionTargets(complete!.options[0]!)).toContain("exit");

    const choice = graph.nodes.find((n) => n.id === "c1")!;
    expect(choice.options[0]!.effectTaskAccept).toBe(100001);
    expect(getOptionTargets(choice.options[0]!)).toContain(complete!.id);
    expect(getOptionTargets(choice.options[1]!)).toContain("exit");
  });
});
