/**
 * 运行时 map JSON 路径约定（Cocos assets + server story_maps）
 * 纯路径函数，可在浏览器与 Node 共用。
 */

export const COCOS_STORY_MAP_REL_DIR = "assets/resources/Sample/剧情脚本";
export const SERVER_STORY_MAP_REL_DIR = "server/data/story_maps";

export function normalizeMapId(mapId: unknown): number {
  const id = Math.trunc(Number(mapId));
  if (!Number.isFinite(id) || id < 0) {
    throw new Error("地图 ID 须为非负整数");
  }
  return id;
}

export function normalizeMapCode(mapCode: unknown): string {
  const code = String(mapCode ?? "").trim();
  if (!code) throw new Error("mapCode 不能为空");
  return code;
}

/** Cocos JsonAsset：map_{mapId}.json */
export function resolveCocosMapFilename(mapId: unknown): string {
  return `map_${normalizeMapId(mapId)}.json`;
}

/** Server：map_{mapId}_{mapCode}.json */
export function resolveServerMapFilename(mapId: unknown, mapCode: unknown): string {
  return `map_${normalizeMapId(mapId)}_${normalizeMapCode(mapCode)}.json`;
}

export function joinPathSegments(...parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

export function resolveCocosAssetRelativePath(mapId: unknown): string {
  return joinPathSegments(COCOS_STORY_MAP_REL_DIR, resolveCocosMapFilename(mapId));
}

export function resolveServerMapRelativePath(mapId: unknown, mapCode: unknown): string {
  return joinPathSegments(SERVER_STORY_MAP_REL_DIR, resolveServerMapFilename(mapId, mapCode));
}

/** 遗留命名（发布时 warn / 可选清理） */
export function listLegacyMapFilenames(mapId: number, mapCode: string): string[] {
  const names = new Set<string>();
  if (mapCode === "test_base") {
    names.add("map_0_test_base_shared.json");
  }
  names.add(`map_${mapCode}.json`);
  names.add(`map_${mapId}_${mapCode}_shared.json`);
  names.add(`map_world_${mapCode}.json`);
  if (mapCode.startsWith("world_")) {
    names.add(`map_world_${mapCode.replace(/^world_/, "")}.json`);
  }
  names.delete(resolveCocosMapFilename(mapId));
  names.delete(resolveServerMapFilename(mapId, mapCode));
  return [...names];
}

export type MapPathTargetInfo = {
  filename: string;
  relativePath: string;
  absolutePath: string;
  exists: boolean;
};

export type PublishMapDualResult = {
  ok: boolean;
  mapId: number;
  mapCode: string;
  cocos?: MapPathTargetInfo & { overwritten: boolean; written: boolean };
  server?: MapPathTargetInfo & { overwritten: boolean; written: boolean };
  legacyWarnings: string[];
  legacyRemoved: string[];
  code?: string;
  message?: string;
};

export type PublishMapDualOptions = {
  overwrite?: boolean;
  writeCocos?: boolean;
  writeServer?: boolean;
  cleanupLegacy?: boolean;
  repoRoot: string;
};
