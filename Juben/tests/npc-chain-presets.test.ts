import { describe, expect, it } from "vitest";
import type { ProjectData } from "../src/types";
import { createGraph } from "../src/types";
import { addNpcFromResource } from "../src/editor/game-map-logic";
import { exportGameMapToRuntime } from "../src/editor/map-export";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "../src/editor/map-slice-layout";

function minimalProject(extraNpc?: { id: string; name: string }): ProjectData {
  return {
    variables: [],
    quests: [
      { id: "q1", name: "主线", initialStatus: "NotStarted", graphId: "g_map", taskId: 100001, mainlineStep: 1 },
    ],
    characterAssets: [],
    graphs: [createGraph({ id: "g_map", kind: "map", nodes: [] })],
    gameMaps: [
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: "g_map",
        tileSize: 48,
        ...DEFAULT_COCOS_GAME_MAP_IMAGE,
        npcs: [],
      },
    ],
    resources: {
      npc: [
        { id: "giver_a", kind: "npc", name: "任务官", image: "prefabs/giver" },
        { id: "enemy_a", kind: "npc", name: "敌人A", image: "prefabs/enemy" },
        ...(extraNpc ? [{ id: extraNpc.id, kind: "npc" as const, name: extraNpc.name, image: "prefabs/x" }] : []),
      ],
    },
  };
}

describe("npc-chain-presets", () => {
  it("battleEncounter preset creates unified chain in single NPC zone", () => {
    const project = minimalProject();
    const gm = project.gameMaps![0]!;

    const result = addNpcFromResource(project, gm, "giver_a", {
      chainPreset: "battleEncounter",
      battleRef: "battle_1-50",
    });
    expect(result).toBeTruthy();
    expect(result!.giver.npcUid).toBe("giver_a");
    expect(result!.battleNpc).toBeUndefined();
    expect(gm.npcs).toHaveLength(1);

    const g = project.graphs[0]!;
    const zoneId = result!.giver.zoneId!;
    const battleInZone = g.nodes.filter((n) => n.kind === "battle" && n.mapId === zoneId);
    const enemySpawn = g.nodes.find((n) => n.kind === "action" && n.title === "敌人出现");
    const battlePrep = g.nodes.find((n) => n.kind === "choice" && n.title === "战前选择");
    const giverTurnIn = g.nodes.find(
      (n) => n.kind === "questUpdate" && n.mapId === zoneId && n.questStatus === "Completed",
    );
    const giverChoice = g.nodes.find((n) => n.kind === "choice" && n.title === "接取任务");

    expect(battleInZone).toHaveLength(1);
    expect(battleInZone[0]?.battleConfigId).toBe("battle_1-50");
    expect(enemySpawn?.actions?.[0]?.kind).toBe("spawnNpc");
    expect(battlePrep?.options.some((o) => o.forcedResult === "start_battle")).toBe(true);
    expect(battlePrep?.options.some((o) => o.forcedResult === "block")).toBe(true);
    expect(giverTurnIn?.requirements?.some((r) => r.kind === "eventDone")).toBe(true);
    expect(giverChoice?.options.some((o) => o.effectTaskAccept === 100001)).toBe(true);
    expect(result!.giver.appear?.mode).toBe("always");
  });

  it("exports unified battle chain with event_done on turn-in", () => {
    const project = minimalProject();
    const gm = project.gameMaps![0]!;
    addNpcFromResource(project, gm, "giver_a", {
      chainPreset: "battleEncounter",
      battleRef: "battle_1-50",
    });

    const cfg = exportGameMapToRuntime(gm, project.graphs[0]!, project);
    const giver = cfg.npcs.find((n) => n.npcUid === "giver_a");
    expect(giver?.events.some((e) => e.eventType === "battle")).toBe(false);
    expect(cfg.npcs.some((n) => n.npcUid.endsWith("_battle"))).toBe(false);

    const turnIn = giver?.events.find((e) =>
      e.server?.effects?.some((eff) => eff.action === "task_complete"),
    );
    const enemy = cfg.npcs.find((n) => n.npcUid.endsWith("_enemy"));
    expect(enemy?.events.some((e) => e.eventType === "battle")).toBe(true);
    expect(enemy?.appear?.requirements?.some((r) => r.type === "task_active")).toBe(true);
    expect(enemy?.hideWhenComplete).toBe(true);

    const battleEv = enemy?.events.find((e) => e.eventType === "battle");
    expect(turnIn?.server?.requirements?.some((r) => r.type === "event_done" && r.eventId === battleEv?.eventId)).toBe(
      true,
    );
  });

  it("empty preset only creates entry/exit skeleton", () => {
    const project = minimalProject();
    const gm = project.gameMaps![0]!;

    addNpcFromResource(project, gm, "giver_a", { chainPreset: "empty" });
    const kinds = project.graphs[0]!.nodes.map((n) => n.kind);
    expect(kinds).not.toContain("battle");
    expect(gm.npcs).toHaveLength(1);
  });

  it("multiple battleEncounter adds independent single-NPC chains", () => {
    const project = minimalProject();
    const gm = project.gameMaps![0]!;

    addNpcFromResource(project, gm, "giver_a", { chainPreset: "battleEncounter" });
    addNpcFromResource(project, gm, "giver_a", { chainPreset: "battleEncounter" });

    expect(gm.npcs.map((n) => n.npcUid)).toEqual(["giver_a", "giver_a_2"]);
    expect(gm.npcs.some((n) => n.npcUid.endsWith("_battle"))).toBe(false);
  });
});
