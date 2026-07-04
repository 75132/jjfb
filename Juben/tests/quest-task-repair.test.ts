import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import { repairMapQuestTaskBindings, sanitizeNumericTaskId } from "../src/editor/quest-logic";
import { exportGameMapToRuntimeWithMeta } from "../src/editor/map-export";
import { validateMapConfig } from "../src/editor/map-runtime";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";

describe("quest-task-repair", () => {
  it("sanitizeNumericTaskId rejects NaN and invalid strings", () => {
    expect(sanitizeNumericTaskId(NaN)).toBeNull();
    expect(sanitizeNumericTaskId("NaN")).toBeNull();
    expect(sanitizeNumericTaskId(undefined)).toBeNull();
    expect(sanitizeNumericTaskId(100001)).toBe(100001);
  });

  it("repairMapQuestTaskBindings fixes invalid effectTaskAccept before export", () => {
    const zoneId = "zone_a";
    const graph = createGraph({
      id: "g1",
      kind: "map",
      maps: [{ id: zoneId, name: "A", npcUid: "task_1", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({ id: "entry_a", kind: "npcEntry", mapId: zoneId, position: { x: 0, y: 0 } }),
        createNode({ id: "exit_a", kind: "npcExit", mapId: zoneId, npcUid: "task_1", position: { x: 200, y: 0 } }),
      ],
    });
    graph.nodes[0]!.options[0]!.targetNodeIds = ["exit_a"];

    const badChoice = createNode({
      id: "accept_bad",
      kind: "choice",
      mapId: zoneId,
      options: [{ id: "yes", text: "接受", effectTaskAccept: NaN as unknown as number }],
    });
    graph.nodes.push(badChoice);
    graph.nodes[0]!.options[0]!.targetNodeIds = [badChoice.id];
    badChoice.options[0]!.targetNodeIds = ["exit_a"];

    const gameMap = {
      id: "gm1",
      mapCode: "world_test",
      mapId: 1,
      graphId: graph.id,
      tileSize: 48,
      ...DEFAULT_COCOS_GAME_MAP_IMAGE,
      npcs: [
        {
          npcUid: "task_1",
          npcName: "初次接触",
          zoneId,
          entryNodeId: "entry_a",
          exitNodeId: "exit_a",
          x: 192,
          y: 192,
        },
      ],
    };

    const project = {
      variables: [],
      quests: [{ id: "qp_p1", name: "Q", initialStatus: "NotStarted" as const, graphId: graph.id, taskId: 100001 }],
      graphs: [graph],
      gameMaps: [gameMap],
    };

    const fixed = repairMapQuestTaskBindings(project, graph, gameMap);
    expect(fixed).toBeGreaterThan(0);
    expect(badChoice.options[0]!.effectTaskAccept).toBe(100001);

    const { config } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
    const report = validateMapConfig(config);
    expect(report.issues.some((i) => i.message.includes("taskId=NaN"))).toBe(false);
  });
});
