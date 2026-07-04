import { describe, expect, it } from "vitest";
import {
  addOptionTarget,
  getOptionTargets,
  removeOptionTarget,
  setOptionTargets,
  type StoryOption,
} from "../src/types";

describe("story option target helpers", () => {
  it("reads both legacy and array fields", () => {
    const opt: StoryOption = { id: "o1", text: "继续", targetNodeId: "n1", targetNodeIds: ["n1", "n2"] };
    expect(getOptionTargets(opt)).toEqual(["n1", "n2"]);
  });

  it("deduplicates and writes normalized targets", () => {
    const opt: StoryOption = { id: "o2", text: "继续" };
    setOptionTargets(opt, ["n1", "n1", "n2"]);
    expect(opt.targetNodeIds).toEqual(["n1", "n2"]);
    expect(opt.targetNodeId).toBeUndefined();
  });

  it("supports add/remove target", () => {
    const opt: StoryOption = { id: "o3", text: "继续" };
    addOptionTarget(opt, "n1");
    addOptionTarget(opt, "n2");
    removeOptionTarget(opt, "n1");
    expect(getOptionTargets(opt)).toEqual(["n2"]);
  });
});
