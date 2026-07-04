import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let app: Express;
const originalFetch = global.fetch;

beforeAll(async () => {
  process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "test-key";
  const mod = await import("../server/index");
  app = mod.app;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("ai api", () => {
  it("rejects generate without brief", async () => {
    const res = await request(app)
      .post("/api/ai/story/stream")
      .send({
        phase: "generate",
        mode: "map_npc_chain",
        messages: [],
        context: {},
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_BRIEF");
  });

  it("rejects invalid phase", async () => {
    const res = await request(app)
      .post("/api/ai/story/stream")
      .send({
        phase: "invalid",
        mode: "map_npc_chain",
        messages: [],
        context: {},
      });
    expect(res.status).toBe(400);
  });

  it("returns 503 when DeepSeek API key is not configured", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    vi.resetModules();
    const mod = await import("../server/index");
    const res = await request(mod.app)
      .post("/api/ai/story/stream")
      .send({
        phase: "discuss",
        mode: "map_npc_chain",
        messages: [{ role: "user", content: "hi" }],
        context: { mapCode: "test" },
      });
    if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev;
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_NOT_CONFIGURED");
  });

  it("streams discuss response from mocked DeepSeek", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.resetModules();
    const mod = await import("../server/index");
    const sseBody =
      'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody));
          controller.close();
        },
      }),
    });

    const res = await request(mod.app)
      .post("/api/ai/story/stream")
      .send({
        phase: "discuss",
        mode: "map_npc_chain",
        messages: [{ role: "user", content: "hi" }],
        context: { mapCode: "test" },
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain("你好");
    expect(global.fetch).toHaveBeenCalled();
  });
});
