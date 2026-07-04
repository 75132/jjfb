import { describe, expect, it } from "vitest";
import { cocosMapJsonFilename } from "../src/editor/cocos-map-publish";
import { getCocosMapTargetInfo, resolveCocosMapFilename } from "../server/cocos-map-publish";

describe("cocos-map-publish", () => {
  it("builds filename from mapId", () => {
    expect(cocosMapJsonFilename(0)).toBe("map_0.json");
    expect(cocosMapJsonFilename(100001)).toBe("map_100001.json");
    expect(resolveCocosMapFilename(3)).toBe("map_3.json");
  });

  it("rejects invalid mapId", () => {
    expect(() => cocosMapJsonFilename(-1)).toThrow();
    expect(() => resolveCocosMapFilename("abc")).toThrow();
  });

  it("resolves target under Sample/剧情脚本", () => {
    const info = getCocosMapTargetInfo(100001);
    expect(info.filename).toBe("map_100001.json");
    expect(info.relativePath.replace(/\\/g, "/")).toContain("assets/resources/Sample/剧情脚本/map_100001.json");
  });
});
