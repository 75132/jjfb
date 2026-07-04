/**
 * 地图 NPC / 战斗摆点编辑 composable
 */
import type { Ref } from "vue";
import type { GameMapDef, GameMapNpcDef, ProjectData } from "../../types";
import { materializeBattleEnemiesForGiver, patchBattleEnemySpawn } from "../battle-enemy-bind";
import { materializeBattleEnemySpawnCoords } from "../battle-enemy-bind";
import { appAlert } from "../useModal";

export type MapEditingDeps = {
  project: Ref<ProjectData>;
  currentGameMap: Ref<GameMapDef | null | undefined>;
  scheduleCurrentProjectSave: () => void;
  rebuildFlowFromGraph: () => void;
  ensureNpcZonesAndEntries: (project: ProjectData, gm: GameMapDef) => void;
};

export function createMapEditingActions(deps: MapEditingDeps) {
  function patchGameMapNpc(npcUid: string, patch: Partial<GameMapNpcDef>) {
    const gm = deps.currentGameMap.value;
    if (!gm) return;
    const npc = gm.npcs.find((n) => n.npcUid === npcUid);
    if (!npc) return;
    if (patch.appear !== undefined) {
      npc.appear = patch.appear as GameMapNpcDef["appear"];
      if (npc.initialHidden !== undefined) delete npc.initialHidden;
    }
    if (patch.npcName !== undefined) {
      Object.assign(npc, { npcName: patch.npcName });
      deps.ensureNpcZonesAndEntries(deps.project.value, gm);
      deps.rebuildFlowFromGraph();
      return;
    }
    const movesCoords = patch.x !== undefined || patch.y !== undefined;
    if (movesCoords) {
      materializeBattleEnemiesForGiver(deps.project.value, gm, npcUid);
    }
    Object.assign(npc, patch);
    if (movesCoords) {
      deps.scheduleCurrentProjectSave();
    }
  }

  function onPatchBattleEnemy(payload: {
    giverNpcUid: string;
    patch: { x?: number; y?: number; prefabKey?: string; npcName?: string };
  }) {
    const gm = deps.currentGameMap.value;
    if (!gm) return;
    materializeBattleEnemySpawnCoords(deps.project.value, gm, payload.giverNpcUid);
    const result = patchBattleEnemySpawn(deps.project.value, gm, payload.giverNpcUid, payload.patch);
    if (!result.ok) {
      void appAlert(result.reason, "战斗摆点保存失败");
      return;
    }
    deps.scheduleCurrentProjectSave();
  }

  return { patchGameMapNpc, onPatchBattleEnemy };
}
