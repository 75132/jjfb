import { describe, expect, it } from "vitest";
import {
  getClientRuntimeManifest,
  isKnownBattleRef,
  resetClientRuntimeManifest,
} from "../src/editor/client-runtime-manifest";

describe("client-runtime-manifest", () => {
  it("lists battle refs aligned with battle_refs.json", () => {
    const m = getClientRuntimeManifest();
    expect(m.battleRefs).toContain("battle_1-50");
    expect(m.battleRefs).toContain("battle_300001");
    expect(isKnownBattleRef("battle_1-50")).toBe(true);
    expect(isKnownBattleRef("battle_unknown")).toBe(false);
  });

  it("resets to default manifest", () => {
    resetClientRuntimeManifest();
    expect(getClientRuntimeManifest().manifestVersion).toBe("1.0.0");
  });
});
