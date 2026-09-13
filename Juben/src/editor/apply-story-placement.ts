import { defaultNpcGridPosition } from "./ai/ai-task-chain-sync";
import { materializeBattleEnemySpawnCoords, resolveNpcBattleChain } from "./battle-enemy-bind";
import { resolveNpcPrefabKey } from "./map-export";
import type { GameMapDef, ProjectData } from "../types";

export type ApplyStoryPlacementResult = {
  coordsFilled: number;
  prefabsFilled: number;
  enemiesMaterialized: number;
};

/**
 * 把剧情侧已有任务链套到摆点：补缺省坐标 / prefab，物化战斗敌人坐标。
 * 不改 event 链正文。
 */
export function applyStorySettingsToPlacement(
  project: ProjectData,
  gameMap: GameMapDef,
): ApplyStoryPlacementResult {
  let coordsFilled = 0;
  let prefabsFilled = 0;
  let enemiesMaterialized = 0;

  gameMap.npcs.forEach((npc, idx) => {
    if (!Number.isFinite(npc.x) || !Number.isFinite(npc.y)) {
      const pos = defaultNpcGridPosition(gameMap, idx);
      npc.x = pos.x;
      npc.y = pos.y;
      coordsFilled++;
    }

    if (!npc.prefabKey) {
      const key = resolveNpcPrefabKey(project, npc);
      if (key) {
        npc.prefabKey = key;
        prefabsFilled++;
      }
    }

    const bind = resolveNpcBattleChain(project, gameMap, npc.npcUid);
    if (bind?.battleNodeId || bind?.enemyAppearNodeId) {
      if (materializeBattleEnemySpawnCoords(project, gameMap, npc.npcUid)) {
        enemiesMaterialized++;
      }
    }
  });

  return { coordsFilled, prefabsFilled, enemiesMaterialized };
}
