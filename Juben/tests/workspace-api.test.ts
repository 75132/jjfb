import fs from "fs/promises";
import os from "os";
import path from "path";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tempDir = path.join(os.tmpdir(), `juben-test-${Date.now()}`);
const workspaceFile = path.join(tempDir, "workspace.json");

const validProjectData = {
  variables: [],
  quests: [],
  graphs: [{ id: "g1", name: "main", kind: "mainline", nodes: [], maps: [] }],
  gameMaps: [],
  characterAssets: [],
  resources: {},
};

let app: Express;

beforeAll(async () => {
  process.env.WORKSPACE_FILE = workspaceFile;
  const mod = await import("../server/index");
  app = mod.app;
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("workspace api", () => {
  it("saves, loads and clears workspace", async () => {
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "测试项目",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: validProjectData,
        },
      ],
    };

    const putRes = await request(app).put("/api/workspace").send({ workspace: payload }).expect(200);
    expect(putRes.body.savedAt).toBeDefined();
    const loaded = await request(app).get("/api/workspace").expect(200);
    expect(loaded.body.workspace.currentProjectId).toBe("p1");

    await request(app).delete("/api/workspace").expect(200);
    const afterClear = await request(app).get("/api/workspace").expect(200);
    expect(afterClear.body.workspace).toBeNull();
  });

  it("rejects invalid project.data", async () => {
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "bad",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { variables: [], quests: [], graphs: [] },
        },
      ],
    };
    const res = await request(app).put("/api/workspace").send({ workspace: payload });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PROJECT_DATA");
  });

  it("returns 409 on savedAt conflict", async () => {
    const payload = {
      version: 1 as const,
      savedAt: 1000,
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "测试",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: validProjectData,
        },
      ],
    };
    await request(app).put("/api/workspace").send({ workspace: payload }).expect(200);
    const conflict = await request(app)
      .put("/api/workspace")
      .send({ workspace: { ...payload, savedAt: 2000 }, expectedSavedAt: 500 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CONFLICT");
  });

  it("health includes server story maps dir info", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body).toHaveProperty("serverStoryMapsDirExists");
    expect(res.body).toHaveProperty("aiConfigured");
  });
});
