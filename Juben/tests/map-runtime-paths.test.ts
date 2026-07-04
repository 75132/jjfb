import { describe, expect, it } from "vitest";
import {
  resolveCocosMapFilename,
  resolveServerMapFilename,
  resolveCocosAssetRelativePath,
  resolveServerMapRelativePath,
  listLegacyMapFilenames,
} from "../src/editor/map-runtime-paths";

describe("map-runtime-paths", () => {
  it("resolves canonical filenames", () => {
    expect(resolveCocosMapFilename(1)).toBe("map_1.json");
    expect(resolveServerMapFilename(1, "world_1782661910893")).toBe(
      "map_1_world_1782661910893.json",
    );
  });

  it("resolves relative paths", () => {
    expect(resolveCocosAssetRelativePath(1)).toBe("assets/resources/Sample/剧情脚本/map_1.json");
    expect(resolveServerMapRelativePath(1, "test_base")).toBe(
      "server/data/story_maps/map_1_test_base.json",
    );
  });

  it("lists legacy filenames excluding canonical", () => {
    const legacy = listLegacyMapFilenames(1, "test_base");
    expect(legacy).toContain("map_0_test_base_shared.json");
    expect(legacy).not.toContain("map_1.json");
    expect(legacy).not.toContain("map_1_test_base.json");
  });
});
