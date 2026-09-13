import { describe, expect, it } from "vitest";
import { clampStoryTitle, storyTitleTooLong, STORY_TITLE_MAX_LEN } from "../src/editor/story-title-limit";

describe("story-title-limit", () => {
  it("clamps long titles to 7 characters", () => {
    expect(STORY_TITLE_MAX_LEN).toBe(7);
    expect(clampStoryTitle("引导玩家称为机甲召唤师")).toBe("引导玩家称为机");
    expect(clampStoryTitle("  前哨遇袭  ")).toBe("前哨遇袭");
  });

  it("storyTitleTooLong detects overflow", () => {
    expect(storyTitleTooLong("七个字刚好")).toBe(false);
    expect(storyTitleTooLong("这标题有八个字啦")).toBe(true);
  });
});
