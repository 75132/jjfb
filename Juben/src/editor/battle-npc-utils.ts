import type { GameMapDef, GameMapNpcDef, GraphData } from "../types";

/** 战斗专用 NPC（uid 后缀 _battle） */
export function isBattleOnlyNpc(npc: GameMapNpcDef, _graph?: GraphData): boolean {
  return npc.npcUid.endsWith("_battle");
}

export function hasBattleCompanion(gameMap: GameMapDef, giverUid: string): boolean {
  const base = `${giverUid}_battle`;
  return gameMap.npcs.some((n) => n.npcUid === base || n.npcUid.startsWith(`${base}_`));
}

export function battleCompanionUid(gameMap: GameMapDef, giverUid: string): string | null {
  const base = `${giverUid}_battle`;
  const hit = gameMap.npcs.find((n) => n.npcUid === base || n.npcUid.startsWith(`${base}_`));
  return hit?.npcUid ?? null;
}
