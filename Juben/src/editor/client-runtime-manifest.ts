/**
 * 客户端运行时能力清单 — 导出校验与 Inspector 白名单对齐 StoryManager / battle_refs.json
 * 权威数据源：data/client-runtime-manifest.json
 */
import bundledManifestJson from "../../data/client-runtime-manifest.json";
import type { ClientRuntimeManifest } from "./client-runtime-manifest-types";

export type { ClientRuntimeManifest, CapabilityTierLists } from "./client-runtime-manifest-types";

const BUNDLED_MANIFEST = bundledManifestJson as ClientRuntimeManifest;

let cached: ClientRuntimeManifest = { ...BUNDLED_MANIFEST };
let loadedFromUrl = false;

export type CapabilityKind = "requirements" | "effects";
export type CapabilityTier = "supported" | "serverOnly" | "planned" | "unknown";

export function getClientRuntimeManifest(): ClientRuntimeManifest {
  return cached;
}

export function isManifestLoadedFromUrl(): boolean {
  return loadedFromUrl;
}

export function setClientRuntimeManifest(m: ClientRuntimeManifest): void {
  cached = { ...BUNDLED_MANIFEST, ...m, capabilities: m.capabilities ?? BUNDLED_MANIFEST.capabilities };
}

export function resetClientRuntimeManifest(): void {
  cached = { ...BUNDLED_MANIFEST };
  loadedFromUrl = false;
}

export function getCapabilityTier(kind: CapabilityKind, id: string | undefined | null): CapabilityTier {
  if (!id) return "unknown";
  const caps = getClientRuntimeManifest().capabilities?.[kind];
  if (!caps) return "unknown";
  if (caps.planned.includes(id)) return "planned";
  if (caps.serverOnly.includes(id)) return "serverOnly";
  if (caps.supported.includes(id)) return "supported";
  return "unknown";
}

export function isKnownBattleRef(ref: string | undefined | null): boolean {
  if (!ref) return false;
  return getClientRuntimeManifest().battleRefs.includes(ref);
}

export function isPlannedRequirementType(type: string | undefined | null): boolean {
  return getCapabilityTier("requirements", type) === "planned";
}

export function isPlannedEffectAction(action: string | undefined | null): boolean {
  return getCapabilityTier("effects", action) === "planned";
}

export function isServerOnlyRequirementType(type: string | undefined | null): boolean {
  return getCapabilityTier("requirements", type) === "serverOnly";
}

export function isServerOnlyEffectAction(action: string | undefined | null): boolean {
  return getCapabilityTier("effects", action) === "serverOnly";
}

/** 客户端须实现求值（supported 档） */
export function isClientSupportedRequirementType(type: string | undefined | null): boolean {
  return getCapabilityTier("requirements", type) === "supported";
}

/** 导出允许：supported + serverOnly（服务端权威执行） */
export function isExportableRequirementType(type: string | undefined | null): boolean {
  const tier = getCapabilityTier("requirements", type);
  return tier === "supported" || tier === "serverOnly";
}

export function isExportableEffectAction(action: string | undefined | null): boolean {
  const tier = getCapabilityTier("effects", action);
  return tier === "supported" || tier === "serverOnly";
}

/** @deprecated 使用 isExportableRequirementType / isClientSupportedRequirementType */
export function isSupportedRequirementType(type: string | undefined | null): boolean {
  return isExportableRequirementType(type);
}

/** @deprecated 使用 isPlannedRequirementType */
export function isWarnOnlyRequirementType(type: string | undefined | null): boolean {
  return isPlannedRequirementType(type);
}

/** @deprecated 使用 isServerOnlyEffectAction */
export function isWarnOnlyEffectAction(action: string | undefined | null): boolean {
  return isServerOnlyEffectAction(action);
}

export function isUnsupportedRequirementType(type: string | undefined | null): boolean {
  if (!type) return false;
  return !isExportableRequirementType(type);
}

export function isUnsupportedEffectAction(action: string | undefined | null): boolean {
  if (!action) return false;
  return !isExportableEffectAction(action);
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
    if (data.manifestVersion && Array.isArray(data.battleRefs) && data.capabilities) {
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

export function listCapabilityIds(kind: CapabilityKind, tier: CapabilityTier): string[] {
  if (tier === "unknown") return [];
  const caps = getClientRuntimeManifest().capabilities[kind];
  return [...caps[tier]];
}
