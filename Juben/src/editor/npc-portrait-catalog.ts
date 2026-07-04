/** Juben/Npc 与 Cocos assets/resources/Npc 共用的立绘清单（Npc_01 … Npc_16） */
import type { GameMapNpcDef, ProjectData } from "../types";
import { resolveNpcPrefabKey } from "./map-export";

export interface NpcPortraitOption {
  /** 文件名不含扩展名，如 Npc_01 */
  id: string;
  label: string;
  /** Cocos resources.load 路径（不含 resources 前缀），如 Npc/Npc_01 */
  cocosPath: string;
  /** Juben 编辑器预览 URL */
  previewUrl: string;
}

const PORTRAIT_COUNT = 16;

export const NPC_PORTRAIT_OPTIONS: NpcPortraitOption[] = Array.from({ length: PORTRAIT_COUNT }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const id = `Npc_${n}`;
  return {
    id,
    label: id,
    cocosPath: `Npc/${id}`,
    previewUrl: `/Npc/${id}.png`,
  };
});

const byCocosPath = new Map(NPC_PORTRAIT_OPTIONS.map((o) => [o.cocosPath, o] as const));
const byId = new Map(NPC_PORTRAIT_OPTIONS.map((o) => [o.id, o] as const));

/** 将资源库/摆点中的路径规范为 Cocos resources 路径 */
export function normalizeNpcPortraitPath(raw: string | undefined | null): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  if (s.startsWith("/Npc/")) {
    const id = s.replace(/^\/Npc\//, "").replace(/\.png$/i, "");
    return byId.get(id)?.cocosPath ?? `Npc/${id}`;
  }
  if (s.startsWith("Npc/")) return s.replace(/\/spriteFrame$/i, "").replace(/\.png$/i, "");
  const bare = s.replace(/\.png$/i, "");
  if (byId.has(bare)) return `Npc/${bare}`;
  return s;
}

export function npcPortraitPreviewUrl(cocosPath: string | undefined | null): string | undefined {
  const norm = normalizeNpcPortraitPath(cocosPath);
  if (!norm) return undefined;
  return byCocosPath.get(norm)?.previewUrl;
}

export function isKnownNpcPortraitPath(path: string | undefined | null): boolean {
  const norm = normalizeNpcPortraitPath(path);
  return !!norm && byCocosPath.has(norm);
}

/** 与导出 map JSON 一致：摆点 override > 资源库 image */
export function resolveNpcPortraitPreviewUrl(
  project: ProjectData | undefined,
  npc: GameMapNpcDef,
): string | undefined {
  return npcPortraitPreviewUrl(resolveNpcPrefabKey(project, npc));
}
