/**
 * 导出前编辑器语义自检：战斗分支 / 任务官链 / runtime 产物一致性。
 * 与 validateMapConfig（运行时结构）互补，避免「校验通过但游戏逻辑错误」。
 */
import type { GameMapDef, GraphData, ProjectData } from "../types";
import { resolveNpcBattleChains } from "./battle-enemy-bind";
import { detectMapChainIssues, type ChainIssueKind } from "./map-chain-repair";
import type { MapExportFoldWarning } from "./map-export";
import type { RuntimeMapConfig } from "./map-runtime";
import { detectDialogSlotBattleBind } from "./chain-slot-guards";
import { isDialogOnlyTaskChain } from "./chain-slot-kind";

export type EditorExportGuard = {
  level: "error" | "warn";
  path: string;
  message: string;
};

const BLOCKING_EDITOR_ISSUES = new Set<ChainIssueKind>([
  "misplaced_battle_result_choice",
  "missing_battle_enemy_export",
]);

function isBattleRelatedFoldWarning(w: MapExportFoldWarning): boolean {
  const msg = w.message;
  return (
    msg.includes("战斗结果") ||
    msg.includes("战斗敌人") ||
    msg.includes("战斗分支") ||
    msg.includes("spawnNpc")
  );
}

function countEditorBattleBinds(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  graph: GraphData,
): number {
  let total = 0;
  for (const n of gameMap.npcs) {
    const chains = resolveNpcBattleChains(project, gameMap, n.npcUid, graph);
    total += chains.filter((c) => Boolean(c.battleNodeId)).length;
  }
  return total;
}

function runtimeHasBattleEnemyNpc(runtime: RuntimeMapConfig, gameMap: GameMapDef): boolean {
  return (runtime.npcs ?? []).some((row) => {
    const uid = row.npcUid ?? "";
    return gameMap.npcs.some((g) => uid === `${g.npcUid}_enemy` || uid.startsWith(`${g.npcUid}_enemy_`));
  });
}

function runtimeHasBattleEvent(runtime: RuntimeMapConfig): boolean {
  return (runtime.npcs ?? []).some((row) => (row.events ?? []).some((ev) => ev.eventType === "battle"));
}

function runtimeGiverHasMisplacedBattleResult(runtime: RuntimeMapConfig, gameMap: GameMapDef): EditorExportGuard[] {
  const giverUids = new Set(gameMap.npcs.map((n) => n.npcUid));
  const out: EditorExportGuard[] = [];
  for (const row of runtime.npcs ?? []) {
    const uid = row.npcUid ?? "";
    if (!giverUids.has(uid)) continue;
    for (const ev of row.events ?? []) {
      const desc = String(ev.eventTypeDesc ?? "");
      if (!desc.includes("战斗结果")) continue;
      out.push({
        level: "error",
        path: `runtime.${uid}.${ev.eventId ?? "choice"}`,
        message: `「${row.npcName ?? uid}」导出链仍含「战斗结果」选项（应对话后去红色战斗敌人处开战，不应在任务官弹窗）`,
      });
    }
  }
  return out;
}

function runtimeMultiEnemyTurnInMismatch(
  project: ProjectData,
  gameMap: GameMapDef,
  graph: GraphData,
  runtime: RuntimeMapConfig,
): EditorExportGuard[] {
  const out: EditorExportGuard[] = [];
  for (const n of gameMap.npcs) {
    const chains = resolveNpcBattleChains(project, gameMap, n.npcUid, graph).filter((c) => c.battleNodeId);
    if (chains.length <= 1) continue;
    const giver = (runtime.npcs ?? []).find((r) => r.npcUid === n.npcUid);
    const turnInEv = giver?.events?.find((e) =>
      e.server?.effects?.some((eff) => eff.action === "task_complete"),
    );
    const eventDoneCount =
      turnInEv?.server?.requirements?.filter((r) => r.type === "event_done").length ?? 0;
    if (eventDoneCount !== chains.length) {
      out.push({
        level: "error",
        path: `runtime.${n.npcUid}.turnIn`,
        message: `「${n.npcName ?? n.npcUid}」配置了 ${chains.length} 个战斗敌人，交任务需 ${chains.length} 个 event_done，导出仅 ${eventDoneCount} 个`,
      });
    }
  }
  return out;
}

/** 导出管线：编辑器数据 + 导出产物 语义阻断项 */
export function collectEditorExportGuards(
  project: ProjectData | undefined,
  gameMap: GameMapDef,
  graph: GraphData,
  runtime: RuntimeMapConfig,
  foldWarnings: MapExportFoldWarning[],
): EditorExportGuard[] {
  const guards: EditorExportGuard[] = [];

  if (project) {
    for (const n of gameMap.npcs) {
      if (!isDialogOnlyTaskChain(project, graph, gameMap, n.npcUid)) continue;
      const msg = detectDialogSlotBattleBind(project, gameMap, graph, n.npcUid);
      if (msg) {
        guards.push({
          level: "error",
          path: `editor.${n.npcUid}.chainSlotKind`,
          message: msg,
        });
      }
    }
    for (const issue of detectMapChainIssues(project, graph, gameMap)) {
      if (!BLOCKING_EDITOR_ISSUES.has(issue.kind)) continue;
      guards.push({
        level: "error",
        path: `editor.${issue.npcUid}.${issue.nodeId ?? issue.kind}`,
        message: issue.message,
      });
    }
  }

  for (const w of foldWarnings) {
    if (!isBattleRelatedFoldWarning(w)) continue;
    guards.push({
      level: "error",
      path: `export.${w.npcUid ?? "map"}.${w.nodeId || w.nodeKind}`,
      message: w.message,
    });
  }

  guards.push(...runtimeGiverHasMisplacedBattleResult(runtime, gameMap));
  if (project) {
    guards.push(...runtimeMultiEnemyTurnInMismatch(project, gameMap, graph, runtime));
  }

  const editorBattleBinds = countEditorBattleBinds(project, gameMap, graph);
  const hasEnemyNpc = runtimeHasBattleEnemyNpc(runtime, gameMap);
  const hasBattleEvent = runtimeHasBattleEvent(runtime);

  if (editorBattleBinds > 0 && !hasEnemyNpc) {
    guards.push({
      level: "error",
      path: "runtime.npcs",
      message: `编辑器已配置 ${editorBattleBinds} 条战斗分支，但导出 JSON 中缺少战斗敌人 NPC（如 task_x_enemy）`,
    });
  }
  if (editorBattleBinds > 0 && !hasBattleEvent) {
    guards.push({
      level: "error",
      path: "runtime.events",
      message: "导出 JSON 缺少 eventType=battle，游戏中无法进入战斗",
    });
  }

  return guards;
}

/** 保存时轻量审计（不跑完整 export pipeline） */
export function auditProjectBattleExportBlockers(project: ProjectData): string[] {
  const lines: string[] = [];
  for (const gm of project.gameMaps ?? []) {
    const graph = project.graphs.find((g) => g.id === gm.graphId);
    if (!graph) continue;
    for (const issue of detectMapChainIssues(project, graph, gm)) {
      if (!BLOCKING_EDITOR_ISSUES.has(issue.kind)) continue;
      const mapLabel = gm.mapName || gm.mapCode || gm.id;
      lines.push(`[${mapLabel}] ${issue.message}`);
    }
  }
  return lines;
}
