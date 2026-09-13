import { describe, expect, it } from "vitest";
import {
  getCapabilityTier,
  getClientRuntimeManifest,
  isClientSupportedRequirementType,
  isKnownBattleRef,
  isPlannedRequirementType,
  isServerOnlyEffectAction,
  resetClientRuntimeManifest,
} from "../src/editor/client-runtime-manifest";

describe("client-runtime-manifest", () => {
  it("manifest v2 lists battle refs aligned with battle_refs.json", () => {
    const m = getClientRuntimeManifest();
    expect(m.manifestVersion).toBe("2.0.0");
    expect(m.capabilities).toBeDefined();
    expect(m.battleRefs).toContain("battle_1-50");
    expect(isKnownBattleRef("battle_unknown")).toBe(false);
  });

  it("classifies requirement tiers", () => {
    expect(getCapabilityTier("requirements", "event_done")).toBe("supported");
    expect(getCapabilityTier("requirements", "level")).toBe("supported");
    expect(getCapabilityTier("requirements", "story_var_equals")).toBe("planned");
    expect(isPlannedRequirementType("has_pet")).toBe(true);
    expect(isClientSupportedRequirementType("item_owned")).toBe(true);
  });

  it("classifies effect tiers", () => {
    expect(getCapabilityTier("effects", "task_accept")).toBe("supported");
    expect(getCapabilityTier("effects", "give_item")).toBe("serverOnly");
    expect(getCapabilityTier("effects", "take_item")).toBe("planned");
    expect(isServerOnlyEffectAction("add_exp")).toBe(true);
  });

  it("resets to bundled manifest", () => {
    resetClientRuntimeManifest();
    expect(getClientRuntimeManifest().manifestVersion).toBe("2.0.0");
  });
});
