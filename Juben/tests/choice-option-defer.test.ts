import { describe, expect, it } from "vitest";
import { isDeferChoiceOption, normalizeChoiceOptionForExport } from "../src/editor/choice-option-defer";

describe("choice-option-defer", () => {
  it("detects defer by systemTip", () => {
    expect(
      isDeferChoiceOption({
        text: "现在不是时候。",
        systemTip: "暂缓不会推进任务，凯尔博士会等你准备好。",
        completesEvent: true,
      }),
    ).toBe(true);
  });

  it("does not treat battle retry as defer", () => {
    expect(
      isDeferChoiceOption({
        text: "重新挑战。",
        systemTip: "战斗失败，请重新尝试。",
        completesEvent: true,
      }),
    ).toBe(false);
  });

  it("exports defer with block", () => {
    const out = normalizeChoiceOptionForExport({
      id: "opt_x",
      text: "先等等。",
      systemTip: "暂缓不会推进任务，补给问题不会自行解决。",
      completesEvent: true,
    });
    expect(out.completesEvent).toBe(false);
    expect(out.forcedResult).toBe("block");
  });
});
