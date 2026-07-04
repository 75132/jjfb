import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_STORY_MAP_REL_DIR } from "../src/editor/map-runtime-paths";
import {
  getCocosMapTargetInfo as getCocosTarget,
  getServerMapTargetInfo as getServerTarget,
  publishMapDual,
  resolveCocosAssetAbsolutePath,
} from "./map-runtime-publish";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const jubenRoot = path.resolve(serverDir, "..");
export const repoRoot = path.resolve(jubenRoot, "..");

export { resolveCocosMapFilename } from "../src/editor/map-runtime-paths";

export function resolveCocosMapAbsolutePath(mapId: unknown): string {
  return resolveCocosAssetAbsolutePath(repoRoot, mapId);
}

export function getCocosMapTargetInfo(mapId: unknown) {
  return getCocosTarget(repoRoot, mapId);
}

export function getServerMapTargetInfo(mapId: unknown, mapCode: unknown) {
  return getServerTarget(repoRoot, mapId, mapCode);
}

export function publishCocosMapJson(
  mapId: unknown,
  content: unknown,
  overwrite: boolean,
): {
  ok: boolean;
  filename: string;
  relativePath: string;
  absolutePath: string;
  overwritten: boolean;
  code?: string;
  message?: string;
} {
  const result = publishMapDual(content, {
    repoRoot,
    overwrite,
    writeCocos: true,
    writeServer: false,
  });
  const target = getCocosTarget(repoRoot, mapId);
  if (!result.ok) {
    return {
      ok: false,
      filename: target.filename,
      relativePath: target.relativePath,
      absolutePath: target.absolutePath,
      overwritten: false,
      code: result.code ?? "PUBLISH_FAILED",
      message: result.message ?? "写入失败",
    };
  }
  return {
    ok: true,
    filename: target.filename,
    relativePath: target.relativePath,
    absolutePath: target.absolutePath,
    overwritten: result.cocos?.overwritten === true,
  };
}

export function publishRuntimeMapDual(
  content: unknown,
  overwrite: boolean,
  options?: { cleanupLegacy?: boolean },
) {
  return publishMapDual(content, {
    repoRoot,
    overwrite,
    writeCocos: true,
    writeServer: true,
    cleanupLegacy: options?.cleanupLegacy === true,
  });
}

/** server/data/story_maps 目录是否存在（用于 health / 发布前校验） */
export function serverStoryMapsDirExists(): boolean {
  const dir = path.resolve(repoRoot, SERVER_STORY_MAP_REL_DIR);
  return fs.existsSync(dir);
}

export function getServerStoryMapsDir(): string {
  return path.resolve(repoRoot, SERVER_STORY_MAP_REL_DIR);
}
