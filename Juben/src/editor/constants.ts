/** Juben 编辑器全局常量与共享工具 */

export const TASK_ID_BASE = 100001;

/** 战斗分支节点 title（旧数据兼容；新建节点优先写 editorMeta.battleRole） */
export const BATTLE_TITLE_ENEMY_APPEAR = "敌人出现";
export const BATTLE_TITLE_BATTLE_PREP = "战前选择";
export const BATTLE_TITLE_BATTLE_RESULT = "战斗结果";

export type BattleRole = "enemyAppear" | "battlePrep" | "battle";

/** 从 questId 或纯数字字符串解析 numeric taskId */
export function parseNumericTaskId(questOrTaskId: string | undefined | null): number | null {
  if (!questOrTaskId) return null;
  const direct = parseInt(questOrTaskId, 10);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const digits = questOrTaskId.replace(/\D/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
