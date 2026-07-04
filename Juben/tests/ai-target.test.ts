import { describe, expect, it } from "vitest";
import {
  defaultManualTarget,
  flattenGameMapOptions,
  isTargetReady,
  resolveEffectiveTarget,
  resolveFollowNavTarget,
  targetLabel,
} from "../src/editor/ai/ai-target";
import { createGraph } from "../src/types";
import type { GameMapDef, ProjectData } from "../src/types";

function sampleProject(): ProjectData {
  const graph = createGraph({ id: "g1", kind: "map" });
  const gm: GameMapDef = {
    id: "gm1",
    mapCode: "base",
    mapId: 0,
    mapName: "基地",
    graphId: "g1",
    tileSize: 48,
    npcs: [],
  };
  return {
    variables: [],
    quests: [],
    graphs: [graph],
    gameMaps: [gm],
    timelineGraphId: "tl",
  };
}

describe("ai-target", () => {
  it("resolves follow nav for timeline and map", () => {
    expect(resolveFollowNavTarget({ isTimeline: true }).scope).toBe("timeline");
    const mapTarget = resolveFollowNavTarget({
      isTimeline: false,
      gameMapId: "gm1",
      focusNpcUid: "0_a_01",
    });
    expect(mapTarget.scope).toBe("map");
    if (mapTarget.scope === "map") {
      expect(mapTarget.gameMapId).toBe("gm1");
      expect(mapTarget.npcUid).toBe("0_a_01");
    }
  });

  it("uses manual target when source is manual", () => {
    const manual = { scope: "map" as const, gameMapId: "gm1", editMode: "patch" as const };
    const effective = resolveEffectiveTarget("manual", manual, { isTimeline: true });
    expect(effective.scope).toBe("map");
  });

  it("lists flat map options and labels target", () => {
    const project = sampleProject();
    const opts = flattenGameMapOptions(project);
    expect(opts.some((o) => o.id === "gm1")).toBe(true);
    expect(targetLabel(project, { scope: "timeline" })).toBe("时间线大纲");
    expect(isTargetReady({ scope: "map", gameMapId: "gm1", editMode: "append" })).toBe(true);
  });

  it("default manual picks first map when not on map", () => {
    const project = sampleProject();
    const t = defaultManualTarget(project, { isTimeline: true });
    expect(t.scope).toBe("map");
  });
});
