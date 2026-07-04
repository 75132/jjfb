import { describe, expect, it } from "vitest";
import {
  COCOS_WORLD_MAP_SLICES,
  MAP_IMAGE_PRESETS,
  collectCocosExportMapImageIssues,
  isCocosStitchMapConfig,
  resolveMapPresetId,
  resolveMapSliceSources,
  stitchedMapMetricsFromSources,
} from "../src/editor/map-slice-layout";

describe("map-slice-layout", () => {
  it("resolves vertical stitch sources", () => {
    const sources = resolveMapSliceSources({
      imagePath: "/Map/1-1.png",
      imageSlices: [...COCOS_WORLD_MAP_SLICES],
    });
    expect(sources).toEqual(["/Map/1-1.png", "/Map/1-2.png", "/Map/1-3.png"]);
  });

  it("computes stitched metrics 1584x1728", () => {
    const m = stitchedMapMetricsFromSources([...COCOS_WORLD_MAP_SLICES]);
    expect(m).toEqual({ width: 1584, height: 1728 });
  });

  it("detects cocos stitch preset", () => {
    const id = resolveMapPresetId({
      imagePath: "/Map/1-1.png",
      imageSlices: [...COCOS_WORLD_MAP_SLICES],
    });
    expect(id).toBe("map/cocos-stitch");
    expect(MAP_IMAGE_PRESETS.some((p) => p.id === id)).toBe(true);
    expect(isCocosStitchMapConfig({ imagePath: "/Map/1-1.png", imageSlices: [...COCOS_WORLD_MAP_SLICES] })).toBe(
      true,
    );
  });

  it("flags wrong export image for single /maps/1.png", () => {
    const issues = collectCocosExportMapImageIssues({ imagePath: "/maps/1.png" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("Cocos 拼接");
  });

  it("passes cocos stitch export validation", () => {
    const issues = collectCocosExportMapImageIssues({
      imagePath: "/Map/1-1.png",
      imageSlices: [...COCOS_WORLD_MAP_SLICES],
    });
    expect(issues).toEqual([]);
  });
});
