/**
 * 客户端运行时能力清单 — 导出校验与 Inspector 白名单对齐 StoryManager / battle_refs.json
 * 权威数据源：data/client-runtime-manifest.json
 */
import bundledManifestJson from "../../data/client-runtime-manifest.json";
import type { ClientRuntimeManifest } from "./client-runtime-manifest-types";

export type { ClientRuntimeManifest } from "./client-runtime-manifest-types";

const BUNDLED_MANIFEST = bundledManifestJson as ClientRuntimeManifest;

let cached: ClientRuntimeManifest = { ...BUNDLED_MANIFEST };
let loadedFromUrl = false;

export function getClientRuntimeManifest(): ClientRuntimeManifest {
  return cached;
}

export function isManifestLoadedFromUrl(): boolean {
  return loadedFromUrl;
}

export function setClientRuntimeManifest(m: ClientRuntimeManifest): void {
  cached = { ...BUNDLED_MANIFEST, ...m };
}

export function resetClientRuntimeManifest(): void {
  cached = { ...BUNDLED_MANIFEST };
  loadedFromUrl = false;
}

export function isKnownBattleRef(ref: string | undefined | null): boolean {
  if (!ref) return false;
  return getClientRuntimeManifest().battleRefs.includes(ref);
}

export function isSupportedRequirementType(type: string | undefined | null): boolean {
  if (!type) return false;
  const m = getClientRuntimeManifest();
  return m.supportedRequirementTypes.includes(type) || (m.warnOnlyRequirementTypes ?? []).includes(type);
}

export function isWarnOnlyRequirementType(type: string | undefined | null): boolean {
  if (!type) return false;
  return (getClientRuntimeManifest().warnOnlyRequirementTypes ?? []).includes(type);
}

export function isWarnOnlyEffectAction(action: string | undefined | null): boolean {
  if (!action) return false;
  return (getClientRuntimeManifest().warnOnlyEffectActions ?? []).includes(action);
}

export function isUnsupportedRequirementType(type: string | undefined | null): boolean {
  if (!type) return false;
  return !isSupportedRequirementType(type);
}

export function defaultBattleRef(): string {
  return getClientRuntimeManifest().defaultBattleRef;
}

export function battleRefOptions(): Array<{ id: string; label: string }> {
  return getClientRuntimeManifest().battleRefs.map((id) => ({ id, label: id }));
}

/** 浏览器环境加载 /data/client-runtime-manifest.json（开发时 Vite 静态服务） */
export async function loadClientRuntimeManifestFromUrl(url = "/data/client-runtime-manifest.json"): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[juben] manifest 加载失败 (${res.status})，使用 bundled manifest`);
      return false;
    }
    const data = (await res.json()) as ClientRuntimeManifest;
    if (data.manifestVersion && Array.isArray(data.battleRefs)) {
      setClientRuntimeManifest(data);
      loadedFromUrl = true;
      return true;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[juben] manifest 加载异常，使用 bundled manifest:", e);
  }
  return false;
}

/** bundled manifest 的 battleRefs（供测试与 Cocos battle_refs 对齐校验） */
export function getBundledManifestBattleRefs(): string[] {
  return [...BUNDLED_MANIFEST.battleRefs];
}
