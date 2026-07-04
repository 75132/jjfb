import fs from "node:fs";
import path from "node:path";
import {
  COCOS_STORY_MAP_REL_DIR,
  listLegacyMapFilenames,
  normalizeMapCode,
  normalizeMapId,
  resolveCocosMapFilename,
  resolveServerMapFilename,
  type MapPathTargetInfo,
  type PublishMapDualOptions,
  type PublishMapDualResult,
} from "../src/editor/map-runtime-paths";

export function resolveCocosAssetAbsolutePath(repoRoot: string, mapId: unknown): string {
  const filename = resolveCocosMapFilename(mapId);
  const dir = path.resolve(repoRoot, COCOS_STORY_MAP_REL_DIR);
  const full = path.resolve(dir, filename);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("非法 Cocos 路径");
  }
  return full;
}

export function resolveServerMapAbsolutePath(repoRoot: string, mapId: unknown, mapCode: unknown): string {
  const filename = resolveServerMapFilename(mapId, mapCode);
  const dir = path.resolve(repoRoot, "server", "data", "story_maps");
  const full = path.resolve(dir, filename);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("非法 Server 路径");
  }
  return full;
}

export function getCocosMapTargetInfo(repoRoot: string, mapId: unknown): MapPathTargetInfo {
  const filename = resolveCocosMapFilename(mapId);
  const absolutePath = resolveCocosAssetAbsolutePath(repoRoot, mapId);
  return {
    filename,
    relativePath: path.relative(repoRoot, absolutePath).split(path.sep).join("/"),
    absolutePath,
    exists: fs.existsSync(absolutePath),
  };
}

export function getServerMapTargetInfo(
  repoRoot: string,
  mapId: unknown,
  mapCode: unknown,
): MapPathTargetInfo {
  const filename = resolveServerMapFilename(mapId, mapCode);
  const absolutePath = resolveServerMapAbsolutePath(repoRoot, mapId, mapCode);
  return {
    filename,
    relativePath: path.relative(repoRoot, absolutePath).split(path.sep).join("/"),
    absolutePath,
    exists: fs.existsSync(absolutePath),
  };
}

export function findLegacyMapFiles(
  repoRoot: string,
  mapId: number,
  mapCode: string,
): Array<{ filename: string; absolutePath: string; relativePath: string }> {
  const dir = path.resolve(repoRoot, COCOS_STORY_MAP_REL_DIR);
  const out: Array<{ filename: string; absolutePath: string; relativePath: string }> = [];
  for (const filename of listLegacyMapFilenames(mapId, mapCode)) {
    const absolutePath = path.join(dir, filename);
    if (fs.existsSync(absolutePath)) {
      out.push({
        filename,
        absolutePath,
        relativePath: path.relative(repoRoot, absolutePath).split(path.sep).join("/"),
      });
    }
  }
  return out;
}

function writeJsonFile(filePath: string, content: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf-8");
}

function resolveIdsFromConfig(content: Record<string, unknown>): { mapId: number; mapCode: string } {
  return {
    mapId: normalizeMapId(content.mapId ?? 0),
    mapCode: normalizeMapCode(content.mapCode ?? content.map_code ?? "unknown"),
  };
}

/** 双写 Cocos assets + server story_maps */
export function publishMapDual(
  content: unknown,
  options: PublishMapDualOptions,
): PublishMapDualResult {
  if (content == null || typeof content !== "object") {
    return {
      ok: false,
      mapId: 0,
      mapCode: "",
      legacyWarnings: [],
      legacyRemoved: [],
      code: "INVALID_CONTENT",
      message: "content 须为 JSON 对象",
    };
  }

  const cfg = content as Record<string, unknown>;
  const { mapId, mapCode } = resolveIdsFromConfig(cfg);
  const overwrite = options.overwrite === true;
  const writeCocos = options.writeCocos !== false;
  const writeServer = options.writeServer !== false;
  const repoRoot = options.repoRoot;

  const cocosTarget = getCocosMapTargetInfo(repoRoot, mapId);
  const serverTarget = getServerMapTargetInfo(repoRoot, mapId, mapCode);

  if (writeCocos && cocosTarget.exists && !overwrite) {
    return {
      ok: false,
      mapId,
      mapCode,
      cocos: { ...cocosTarget, overwritten: false, written: false },
      server: { ...serverTarget, overwritten: false, written: false },
      legacyWarnings: [],
      legacyRemoved: [],
      code: "FILE_EXISTS",
      message: `Cocos 文件已存在：${cocosTarget.relativePath}`,
    };
  }

  if (writeServer && serverTarget.exists && !overwrite) {
    return {
      ok: false,
      mapId,
      mapCode,
      cocos: { ...cocosTarget, overwritten: false, written: false },
      server: { ...serverTarget, overwritten: false, written: false },
      legacyWarnings: [],
      legacyRemoved: [],
      code: "FILE_EXISTS",
      message: `Server 文件已存在：${serverTarget.relativePath}`,
    };
  }

  if (writeCocos) {
    writeJsonFile(cocosTarget.absolutePath, content);
  }
  if (writeServer && fs.existsSync(path.resolve(repoRoot, "server"))) {
    writeJsonFile(serverTarget.absolutePath, content);
  }

  const legacyWarnings: string[] = [];
  const legacyRemoved: string[] = [];
  for (const legacy of findLegacyMapFiles(repoRoot, mapId, mapCode)) {
    const msg = `检测到遗留 map 文件：${legacy.relativePath}`;
    if (options.cleanupLegacy) {
      try {
        fs.unlinkSync(legacy.absolutePath);
        legacyRemoved.push(legacy.relativePath);
      } catch {
        legacyWarnings.push(`${msg}（清理失败）`);
      }
    } else {
      legacyWarnings.push(msg);
    }
  }

  return {
    ok: true,
    mapId,
    mapCode,
    cocos: {
      ...cocosTarget,
      overwritten: writeCocos && cocosTarget.exists,
      written: writeCocos,
    },
    server: {
      ...serverTarget,
      overwritten: writeServer && serverTarget.exists,
      written: writeServer && fs.existsSync(path.resolve(repoRoot, "server")),
    },
    legacyWarnings,
    legacyRemoved,
  };
}
