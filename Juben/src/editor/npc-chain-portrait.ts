import type { GameMapDef, GameMapNpcDef, ProjectData } from "../types";
import { resolveNpcPrefabKey } from "./map-export";
import { npcPortraitPreviewUrl, normalizeNpcPortraitPath } from "./npc-portrait-catalog";

/** 任务链统一形象（GameMapNpc.prefabKey > 资源库） */
export function resolveChainPortraitPath(project: ProjectData | undefined, npc: GameMapNpcDef): string {
  return normalizeNpcPortraitPath(resolveNpcPrefabKey(project, npc)) ?? "";
}

export function resolveChainPortraitPreviewUrl(
  project: ProjectData | undefined,
  npc: GameMapNpcDef,
): string | undefined {
  return npcPortraitPreviewUrl(resolveChainPortraitPath(project, npc) || undefined);
}

/** 左栏/Inspector 短标签：Npc_03 */
export function chainPortraitShortLabel(project: ProjectData | undefined, npc: GameMapNpcDef): string {
  const path = resolveChainPortraitPath(project, npc);
  if (path) return path.split("/").pop() ?? path;
  const rid = npc.npcResourceId ?? npc.npcUid;
  const res = project?.resources?.npc?.find((r) => r.id === rid);
  if (res?.name) return `${res.name}（默认）`;
  return "未指定形象";
}

export function findGameMapNpc(
  project: ProjectData,
  gameMap: GameMapDef | null | undefined,
  npcUid: string | undefined | null,
): GameMapNpcDef | null {
  if (!gameMap || !npcUid) return null;
  return gameMap.npcs.find((n) => n.npcUid === npcUid) ?? null;
}
