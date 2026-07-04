import { describe, expect, it } from "vitest";
import { normalizeEnemyTokenExpression } from "../src/editor/enemy-format";

describe("normalizeEnemyTokenExpression", () => {
  it("normalizes punctuation and removes invalid tokens", () => {
    const value = normalizeEnemyTokenExpression(" 1－5，foo , ???, 1-5, bar_1 ");
    expect(value).toBe("1-5,foo,bar_1");
  });

  it("accepts range/list mixed expression", () => {
    const value = normalizeEnemyTokenExpression("1-4,6,9,boss-1");
    expect(value).toBe("1-4,6,9,boss-1");
  });
});
