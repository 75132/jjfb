import { describe, expect, it } from "vitest";
import {
  NPC_PORTRAIT_OPTIONS,
  isKnownNpcPortraitPath,
  normalizeNpcPortraitPath,
  npcPortraitPreviewUrl,
} from "../src/editor/npc-portrait-catalog";

describe("npc-portrait-catalog", () => {
  it("lists 16 portraits aligned with Juben/Npc and Cocos resources/Npc", () => {
    expect(NPC_PORTRAIT_OPTIONS).toHaveLength(16);
    expect(NPC_PORTRAIT_OPTIONS[0]).toMatchObject({
      id: "Npc_01",
      cocosPath: "Npc/Npc_01",
      previewUrl: "/Npc/Npc_01.png",
    });
    expect(NPC_PORTRAIT_OPTIONS[15]?.id).toBe("Npc_16");
  });

  it("normalizes editor and runtime path variants", () => {
    expect(normalizeNpcPortraitPath("Npc/Npc_03")).toBe("Npc/Npc_03");
    expect(normalizeNpcPortraitPath("/Npc/Npc_03.png")).toBe("Npc/Npc_03");
    expect(normalizeNpcPortraitPath("Npc_05")).toBe("Npc/Npc_05");
    expect(normalizeNpcPortraitPath("Npc/Npc_07/spriteFrame")).toBe("Npc/Npc_07");
    expect(normalizeNpcPortraitPath("")).toBeUndefined();
  });

  it("resolves preview URL for known paths", () => {
    expect(npcPortraitPreviewUrl("Npc/Npc_02")).toBe("/Npc/Npc_02.png");
    expect(isKnownNpcPortraitPath("Npc/Npc_02")).toBe(true);
    expect(isKnownNpcPortraitPath("prefabs/custom")).toBe(false);
  });
});
