/** 浏览器端 Cocos map 发布 API 封装 */
import { resolveCocosMapFilename } from "./map-runtime-paths";

export { resolveCocosMapFilename as cocosMapJsonFilename };

export type CocosMapTargetInfo = {
  filename: string;
  relativePath: string;
  absolutePath: string;
  exists: boolean;
};

export type RuntimeMapTargetInfo = {
  cocos: CocosMapTargetInfo;
  server: CocosMapTargetInfo | null;
};

export type PublishCocosMapResult = {
  ok: boolean;
  filename?: string;
  relativePath?: string;
  absolutePath?: string;
  overwritten?: boolean;
  error?: { code: string; message: string; absolutePath?: string };
};

export type PublishRuntimeMapResult = {
  ok: boolean;
  mapId?: number;
  mapCode?: string;
  cocos?: CocosMapTargetInfo & { overwritten?: boolean; written?: boolean };
  server?: CocosMapTargetInfo & { overwritten?: boolean; written?: boolean };
  legacyWarnings?: string[];
  legacyRemoved?: string[];
  error?: { code: string; message: string };
};

export async function fetchCocosMapTarget(mapId: number): Promise<CocosMapTargetInfo> {
  const res = await fetch(`/api/cocos-map/target?mapId=${encodeURIComponent(String(mapId))}`);
  const data = (await res.json()) as CocosMapTargetInfo & { error?: { message: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `查询失败 (${res.status})`);
  }
  return data;
}

export async function fetchRuntimeMapTarget(mapId: number, mapCode: string): Promise<RuntimeMapTargetInfo> {
  const q = new URLSearchParams({ mapId: String(mapId), mapCode });
  const res = await fetch(`/api/runtime-map/target?${q}`);
  const data = (await res.json()) as RuntimeMapTargetInfo & { error?: { message: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `查询失败 (${res.status})`);
  }
  return data;
}

export async function publishMapJsonToCocos(
  mapId: number,
  config: unknown,
  options?: { overwrite?: boolean },
): Promise<PublishCocosMapResult> {
  const res = await fetch("/api/cocos-map/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mapId,
      content: config,
      overwrite: options?.overwrite === true,
    }),
  });
  const data = (await res.json()) as PublishCocosMapResult;
  return data;
}

/** 双写 Cocos assets + server story_maps */
export async function publishMapJsonToRuntime(
  config: unknown,
  options?: { overwrite?: boolean; cleanupLegacy?: boolean },
): Promise<PublishRuntimeMapResult> {
  const res = await fetch("/api/runtime-map/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: config,
      overwrite: options?.overwrite === true,
      cleanupLegacy: options?.cleanupLegacy === true,
    }),
  });
  const data = (await res.json()) as PublishRuntimeMapResult;
  return data;
}
