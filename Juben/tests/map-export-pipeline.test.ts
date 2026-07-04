import { describe, expect, it } from "vitest";
import { createGraph, createNode } from "../src/types";
import {
  exportProjectMapPipeline,
  formatPipelineReport,
  mergeRuntimeShell,
  patchSequentialNpcAppear,
  validateRuntimeConfig,
} from "../src/editor/map-export-pipeline";
import { isKnownBattleRef } from "../src/editor/client-runtime-manifest";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";
import { wireUnifiedBattleEncounterChain } from "../src/editor/npc-chain-presets";

describe("map-export-pipeline", () => {
  const entryId = "entry_npc_a";
  const zoneId = "zone_npc_a";
  const graph = createGraph({
    id: "g_map_test",
    kind: "map",
    maps: [{ id: zoneId, name: "NPC A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
    nodes: [
      createNode({
        id: entryId,
        kind: "npcEntry",
        npcUid: "npc_a",
        mapId: zoneId,
        position: { x: 10, y: 10 },
      }),
      createNode({
        id: "battle1",
        kind: "battle",
        mapId: zoneId,
        battleConfigId: "battle_1-50",
        position: { x: 200, y: 10 },
      }),
    ],
  });
  graph.nodes[0]!.options[0]!.targetNodeId = "battle1";
  graph.nodes[0]!.options[0]!.targetNodeIds = ["battle1"];
  graph.nodes[1]!.options = [];

  const gameMap = {
    id: "gm1",
    mapCode: "test_base",
    mapId: 1,
    graphId: graph.id,
    tileSize: 48,
    ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    npcs: [
      {
        npcUid: "npc_a",
        npcName: "NPC A",
        x: 192,
        y: 192,
        zoneId,
        entryNodeId: entryId,
        exitNodeId: "exit_missing",
      },
    ],
  };

  it("mergeRuntimeShell preserves bgm and scripts", () => {
    const base = {
      client: { bgm: "bgm_old", scenePrefabKey: "scene_old", dialogueScripts: { x: { speaker: "a", lines: [] } } },
      server: { authoritative: true },
    };
    const exported = {
      mapCode: "test_base",
      client: { dialogueScripts: { d1: { speaker: "b", lines: ["hi"] } }, choiceScripts: {} },
      npcs: [],
    };
    const merged = mergeRuntimeShell(base, exported) as Record<string, unknown>;
    const client = merged.client as Record<string, unknown>;
    expect(client.bgm).toBe("bgm_old");
    expect(client.scenePrefabKey).toBe("scene_old");
    expect((client.dialogueScripts as Record<string, unknown>).d1).toBeTruthy();
  });

  it("validateRuntimeConfig rejects unknown battleRef", () => {
    const cfg = {
      mapCode: "t",
      npcs: [
        {
          npcUid: "n1",
          events: [{ eventType: "battle", order: 1, server: { battleRef: "battle_NOT_REAL" } }],
        },
      ],
    };
    const result = validateRuntimeConfig(cfg);
    expect(result.ok).toBe(false);
    expect(isKnownBattleRef("battle_NOT_REAL")).toBe(false);
  });

  it("exportProjectMapPipeline passes manifest for valid battle branch export", () => {
    const g = createGraph({
      id: "g_map_battle",
      kind: "map",
      maps: [{ id: zoneId, name: "NPC A", npcUid: "npc_a", x: 0, y: 0, width: 400, height: 300 }],
      nodes: [
        createNode({
          id: entryId,
          kind: "npcEntry",
          npcUid: "npc_a",
          mapId: zoneId,
          position: { x: 10, y: 10 },
        }),
        createNode({
          id: "exit_a",
          kind: "npcExit",
          npcUid: "npc_a",
          mapId: zoneId,
          position: { x: 300, y: 10 },
        }),
      ],
    });
    g.nodes[0]!.options[0]!.targetNodeIds = ["exit_a"];
    const gm = {
      ...gameMap,
      graphId: g.id,
      npcs: [{ ...gameMap.npcs[0]!, entryNodeId: entryId, exitNodeId: "exit_a" }],
    };
    const project = {
      variables: [],
      quests: [{ id: "q1", name: "Q", initialStatus: "NotStarted" as const, graphId: g.id, taskId: 100001 }],
      graphs: [g],
      gameMaps: [gm],
      resources: {
        npc: [
          { id: "npc_a", kind: "npc" as const, name: "NPC A", image: "Npc_01" },
          { id: "enemy1", kind: "npc" as const, name: "Slime", image: "Npc_02" },
        ],
      },
    };
    wireUnifiedBattleEncounterChain(project, gm, gm.npcs[0]!, { battleRef: "battle_1-50" });
    const result = exportProjectMapPipeline(gm, g, project);
    const enemy = result.config.npcs?.find((n) => n.npcUid === "npc_a_enemy");
    expect(enemy?.events?.some((e) => e.server?.battleRef === "battle_1-50")).toBe(true);
    expect(result.editorGuards.filter((x) => x.level === "error")).toEqual([]);
    expect(result.report.ok, formatPipelineReport(result)).toBe(true);
    expect(result.ok, formatPipelineReport(result)).toBe(true);
  });

  it("patchSequentialNpcAppear adds event_done", () => {
    const runtime = {
      mapCode: "t",
      npcs: [
        {
          npcUid: "a",
          events: [{ eventType: "dialog", eventId: "a_e1", server: { effects: [] } }],
          appear: { mode: "always" as const },
        },
        {
          npcUid: "b",
          initialHidden: true,
          appear: { mode: "conditional" as const, requirements: [] as Array<{ type: string; eventId?: string }> },
          events: [],
        },
      ],
    };
    patchSequentialNpcAppear(runtime);
    expect(runtime.npcs[1]?.appear?.requirements?.[0]).toEqual({ type: "event_done", eventId: "a_e1" });
  });
});
