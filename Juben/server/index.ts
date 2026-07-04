import express, { type Request, type Response } from "express";
import { streamDeepSeekToResponse } from "./ai-service";
import type { StoryStreamRequest } from "./ai-types";
import { clearWorkspace, getStorageInfo, readWorkspace, writeWorkspace } from "./workspace-store";
import { isWorkspacePayload } from "./workspace-schema";
import { validateWorkspaceProjects } from "./project-schema";
import {
  getCocosMapTargetInfo,
  getServerMapTargetInfo,
  publishCocosMapJson,
  publishRuntimeMapDual,
  serverStoryMapsDirExists,
  getServerStoryMapsDir,
} from "./cocos-map-publish";
import { isDeepSeekConfigured } from "./deepseek-config";
import { pathToFileURL } from "url";

export const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = Number(process.env.PORT ?? 8787);

function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

app.get("/api/health", (_req: Request, res: Response) => {
  const info = getStorageInfo();
  return res.json({
    ok: true,
    storage: info,
    aiConfigured: isDeepSeekConfigured(),
    serverStoryMapsDir: getServerStoryMapsDir(),
    serverStoryMapsDirExists: serverStoryMapsDirExists(),
  });
});

app.get("/api/workspace", async (_req: Request, res: Response) => {
  try {
    const parsed = await readWorkspace();
    return res.json({ workspace: parsed });
  } catch (e) {
    return sendError(res, 500, "READ_FAILED", String(e));
  }
});

app.put("/api/workspace", async (req: Request, res: Response) => {
  try {
    const workspace = req.body?.workspace;
    if (!workspace) return sendError(res, 400, "MISSING_WORKSPACE", "Request body.workspace is required.");
    if (!isWorkspacePayload(workspace)) {
      return sendError(res, 422, "INVALID_WORKSPACE", "workspace payload schema validation failed.");
    }
    const projectValidation = validateWorkspaceProjects(workspace);
    if (!projectValidation.ok) {
      return res.status(422).json({
        error: {
          code: "INVALID_PROJECT_DATA",
          message: "project.data 校验失败",
          details: projectValidation.errors.slice(0, 20),
        },
      });
    }
    const expectedSavedAt =
      typeof req.body?.expectedSavedAt === "number" ? req.body.expectedSavedAt : undefined;
    const result = await writeWorkspace(workspace, { expectedSavedAt });
    if (!result.ok) {
      return res.status(409).json({
        error: {
          code: result.code,
          message: result.message,
          diskSavedAt: result.diskSavedAt,
        },
      });
    }
    return res.json({ ok: true, savedAt: result.savedAt });
  } catch (e) {
    return sendError(res, 500, "WRITE_FAILED", String(e));
  }
});

app.delete("/api/workspace", async (_req: Request, res: Response) => {
  try {
    await clearWorkspace();
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, 500, "DELETE_FAILED", String(e));
  }
});

app.get("/api/cocos-map/target", (req: Request, res: Response) => {
  try {
    const mapId = req.query.mapId;
    if (mapId == null || mapId === "") {
      return sendError(res, 400, "MISSING_MAP_ID", "query.mapId is required");
    }
    return res.json(getCocosMapTargetInfo(mapId));
  } catch (e) {
    return sendError(res, 400, "INVALID_MAP_ID", String(e));
  }
});

app.get("/api/runtime-map/target", (req: Request, res: Response) => {
  try {
    const mapId = req.query.mapId;
    const mapCode = req.query.mapCode;
    if (mapId == null || mapId === "") {
      return sendError(res, 400, "MISSING_MAP_ID", "query.mapId is required");
    }
    const cocos = getCocosMapTargetInfo(mapId);
    const server =
      mapCode != null && String(mapCode).trim()
        ? getServerMapTargetInfo(mapId, mapCode)
        : null;
    return res.json({ cocos, server });
  } catch (e) {
    return sendError(res, 400, "INVALID_PARAMS", String(e));
  }
});

app.post("/api/runtime-map/publish", (req: Request, res: Response) => {
  try {
    const content = req.body?.content;
    const overwrite = req.body?.overwrite === true;
    const cleanupLegacy = req.body?.cleanupLegacy === true;
    if (content == null || typeof content !== "object") {
      return sendError(res, 400, "MISSING_CONTENT", "body.content must be a JSON object");
    }
    const result = publishRuntimeMapDual(content, overwrite, { cleanupLegacy });
    if (!result.ok) {
      return res.status(409).json({
        ok: false,
        error: { code: result.code ?? "PUBLISH_FAILED", message: result.message ?? "发布失败" },
        mapId: result.mapId,
        mapCode: result.mapCode,
        cocos: result.cocos,
        server: result.server,
      });
    }
    return res.json({
      ok: true,
      mapId: result.mapId,
      mapCode: result.mapCode,
      cocos: result.cocos,
      server: result.server,
      legacyWarnings: result.legacyWarnings,
      legacyRemoved: result.legacyRemoved,
    });
  } catch (e) {
    return sendError(res, 500, "PUBLISH_FAILED", String(e));
  }
});

app.post("/api/cocos-map/publish", (req: Request, res: Response) => {
  try {
    const mapId = req.body?.mapId;
    const content = req.body?.content;
    const overwrite = req.body?.overwrite === true;
    if (mapId == null || mapId === "") {
      return sendError(res, 400, "MISSING_MAP_ID", "body.mapId is required");
    }
    if (content == null || typeof content !== "object") {
      return sendError(res, 400, "MISSING_CONTENT", "body.content must be a JSON object");
    }
    const result = publishCocosMapJson(mapId, content, overwrite);
    if (!result.ok) {
      return res.status(409).json({
        ok: false,
        error: { code: result.code ?? "FILE_EXISTS", message: result.message ?? "文件已存在" },
        filename: result.filename,
        relativePath: result.relativePath,
        absolutePath: result.absolutePath,
      });
    }
    return res.json({
      ok: true,
      filename: result.filename,
      relativePath: result.relativePath,
      absolutePath: result.absolutePath,
      overwritten: result.overwritten,
    });
  } catch (e) {
    return sendError(res, 500, "PUBLISH_FAILED", String(e));
  }
});

app.post("/api/ai/story/stream", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<StoryStreamRequest>;
    if (!body.phase || (body.phase !== "discuss" && body.phase !== "generate")) {
      return sendError(res, 400, "INVALID_PHASE", "phase must be discuss or generate");
    }
    if (!body.mode || (body.mode !== "map_npc_chain" && body.mode !== "timeline_outline")) {
      return sendError(res, 400, "INVALID_MODE", "mode must be map_npc_chain or timeline_outline");
    }
    if (!Array.isArray(body.messages)) {
      return sendError(res, 400, "INVALID_MESSAGES", "messages must be an array");
    }
    await streamDeepSeekToResponse(body as StoryStreamRequest, res);
  } catch (e) {
    if (!res.headersSent) {
      return sendError(res, 500, "AI_STREAM_FAILED", String(e));
    }
    res.end();
  }
});

export function startServer() {
  return app.listen(PORT, () => {
    const info = getStorageInfo();
    // eslint-disable-next-line no-console
    console.log(`[storage] listening on http://localhost:${PORT} file=${info.workspaceFile}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
