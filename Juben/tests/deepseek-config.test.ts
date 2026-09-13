import { describe, expect, it } from "vitest";
import { deepSeekChatCompletionsUrl, resolveDeepSeekModel } from "../server/deepseek-config";

describe("resolveDeepSeekModel", () => {
  it("maps v4.1 flash aliases to deepseek-flash", () => {
    expect(resolveDeepSeekModel("deepseek-flash")).toBe("deepseek-flash");
    expect(resolveDeepSeekModel("deepseek-v4.1flash")).toBe("deepseek-flash");
    expect(resolveDeepSeekModel("deepseek-v4.1-flash")).toBe("deepseek-flash");
    expect(resolveDeepSeekModel("deepseek-v4-flash")).toBe("deepseek-flash");
    expect(resolveDeepSeekModel("flash")).toBe("deepseek-flash");
  });
});

describe("deepSeekChatCompletionsUrl", () => {
  it("uses official /chat/completions path", () => {
    expect(deepSeekChatCompletionsUrl("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    expect(deepSeekChatCompletionsUrl("https://api.deepseek.com/")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    expect(deepSeekChatCompletionsUrl("https://api.deepseek.com/v1")).toBe(
      "https://api.deepseek.com/v1/chat/completions",
    );
  });
});
