import { describe, expect, it } from "vitest";
import type { ProjectData } from "../src/types";
import { createGraph } from "../src/types";
import { addNpcFromResource, uniqueNpcUidForResource } from "../src/editor/game-map-logic";

function minimalProject(): ProjectData {
  return {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [createGraph({ id: "g_map", kind: "map", nodes: [] })],
    gameMaps: [
      {
        id: "gm1",
        mapCode: "test",
        mapId: 1,
        graphId: "g_map",
        tileSize: 48,
        npcs: [],
      },
    ],
    resources: {
      npc: [{ id: "doctor", kind: "npc", name: "凯尔博士", image: "prefabs/doctor" }],
    },
  };
}

describe("npc multi-instance", () => {
  it("uniqueNpcUidForResource appends suffix", () => {
    const gm = minimalProject().gameMaps![0]!;
    gm.npcs.push({
      npcUid: "doctor",
      npcName: "凯尔博士",
      npcResourceId: "doctor",
      x: 0,
      y: 0,
      zoneId: "z1",
      entryNodeId: "e1",
    });
    expect(uniqueNpcUidForResource(gm, "doctor")).toBe("doctor_2");
    gm.npcs.push({
      npcUid: "doctor_2",
      npcName: "凯尔博士",
      npcResourceId: "doctor",
      x: 10,
      y: 10,
      zoneId: "z2",
      entryNodeId: "e2",
    });
    expect(uniqueNpcUidForResource(gm, "doctor")).toBe("doctor_3");
  });

  it("addNpcFromResource allows same resource twice", () => {
    const project = minimalProject();
    const gm = project.gameMaps![0]!;
    const first = addNpcFromResource(project, gm, "doctor");
    const second = addNpcFromResource(project, gm, "doctor");
    expect(first?.giver.npcUid).toBe("doctor");
    expect(second?.giver.npcUid).toBe("doctor_2");
    expect(gm.npcs.length).toBe(2);
    expect(gm.npcs.every((n) => n.npcResourceId === "doctor")).toBe(true);
  });
});
