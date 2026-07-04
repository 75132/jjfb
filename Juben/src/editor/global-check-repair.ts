import type { GameMapDef, GraphData, ProjectData } from "../types";
import { runAiChainRepairForNpc } from "./ai/ai-repair-runner";
import { issuesNeedAiRepair } from "./ai/ai-repair-brief";
import { ensureNpcZonesAndEntries, ensureProjectGameMaps } from "./game-map-logic";
import { layoutZoneNodes } from "./graph-auto-layout";
import { exportProjectMapPipeline, previewExportAppearPatches, type MapExportPipelineResult } from "./map-export-pipeline";
import {
  detectMapChainIssues,
  repairMapChains,
  type ChainIssue,
  type MapChainRepairResult,
} from "./map-chain-repair";
import { getTimelineGraph } from "./map-tree";
import { migrateQuestBattlePatterns } from "./battle-split-migration";
import { cleanupOrphanGameMaps, getActiveGameMapsForExport, reconcileTimelineData, syncQuestsFromTimeline } from "./timeline-logic";
import { normalizeGlobalQuests } from "./quest-logic";
import { repairBattleExportReadiness } from "./quest-battle-normalize";

function countPipelineErrors(result: MapExportPipelineResult): number {
  const runtimeErrors = result.report?.issues?.filter((i) => i.level === "error").length ?? 0;
  const manifestErrors = result.manifestIssues?.filter((i) => i.level === "error").length ?? 0;
  const editorErrors = result.editorGuards?.filter((i) => i.level === "error").length ?? 0;
  return runtimeErrors + manifestErrors + editorErrors;
}

const MAX_EXPORT_REPAIR_ATTEMPTS = 3;

function runExportRepairPass(
  project: ProjectData,
  graph: GraphData,
  gm: GameMapDef,
): { fixed: number; detail: string } {
  const exportFix = repairBattleExportReadiness(project, graph, gm);
  repairMapChains(project, graph, gm);
  const fixed =
    exportFix.battleExportSpawnFixed +
    exportFix.battleExportTurnInSynced +
    exportFix.coordsMaterialized +
    exportFix.battleBranchesCompleted +
    exportFix.multiEnemyBranchesAdded;
  const parts: string[] = [];
  if (exportFix.battleExportSpawnFixed) parts.push(`spawn+${exportFix.battleExportSpawnFixed}`);
  if (exportFix.battleExportTurnInSynced) parts.push(`turnIn+${exportFix.battleExportTurnInSynced}`);
  if (exportFix.coordsMaterialized) parts.push(`coords+${exportFix.coordsMaterialized}`);
  if (exportFix.battleBranchesCompleted) parts.push(`branch+${exportFix.battleBranchesCompleted}`);
  if (exportFix.multiEnemyBranchesAdded) parts.push(`multi+${exportFix.multiEnemyBranchesAdded}`);
  return { fixed, detail: parts.length ? parts.join(" ") : "已重跑修复管线" };
}

export type GlobalCheckPhase =
  | "prepare"
  | "detect"
  | "repair"
  | "layout"
  | "export_validate"
  | "ai_repair"
  | "done";

export type GlobalCheckProgress = {
  phase: GlobalCheckPhase;
  index: number;
  total: number;
  label: string;
  gameMapId?: string;
  npcUid?: string;
};

export type GlobalLinkageIssue = {
  kind: "timeline_orphan" | "quest_graph_missing" | "portal_map_missing" | "npc_bundle_gap";
  gameMapId?: string;
  message: string;
};

export type GlobalCheckIssue = ChainIssue & {
  gameMapId: string;
  gameMapName: string;
};

export type GlobalCheckStepLog = {
  phase: GlobalCheckPhase;
  label: string;
  ok: boolean;
  detail?: string;
};

export type GlobalCheckRepairOptions = {
  gameMapIds?: string[];
  syncTimeline?: boolean;
  ensureZones?: boolean;
  runRepair?: boolean;
  runLayout?: boolean;
  runExportValidate?: boolean;
  useAiForEmptyChains?: boolean;
  /** 每步之间的 UI 让步（毫秒）；浏览器内建议 ≥50 */
  yieldMs?: number;
  /** 进度回调节流（毫秒），避免 Vue 重绘卡死 */
  progressThrottleMs?: number;
  onProgress?: (p: GlobalCheckProgress) => void;
  onStep?: (step: GlobalCheckStepLog) => void;
  shouldAbort?: () => boolean;
};

export type GlobalCheckRepairReport = {
  mapsChecked: number;
  linkageIssues: GlobalLinkageIssue[];
  issuesBefore: GlobalCheckIssue[];
  issuesAfter: GlobalCheckIssue[];
  repairTotals: MapChainRepairResult;
  exportOkCount: number;
  exportFailCount: number;
  /** appear 预检 diff（export_validate 阶段） */
  appearWarnings: string[];
  /** 导出校验失败摘要（gameMapId, npcUid?, message） */
  exportErrors: Array<{ gameMapId: string; gameMapName: string; npcUid?: string; message: string }>;
  aiAttempts: number;
  aiSuccess: number;
  steps: GlobalCheckStepLog[];
  aborted: boolean;
};

/** 让出主线程：rAF + setTimeout，避免长时间同步计算触发「页面无响应」；yieldMs=0 时 CLI 快路径 */
export function yieldToMainThread(minMs = 0): Promise<void> {
  if (minMs === 0 && typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    if (minMs === 0 && typeof requestAnimationFrame !== "function") {
      resolve();
      return;
    }
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (minMs <= 0) resolve();
        else setTimeout(resolve, minMs);
      });
    } else {
      setTimeout(resolve, Math.max(minMs, 4));
    }
  });
}

function emptyRepairTotals(): MapChainRepairResult {
  return {
    fixedLinks: 0,
    addedNodes: 0,
    provisionedAppear: 0,
    provisionedChainContinuous: 0,
    battleLayoutRepaired: 0,
    questTaskRepaired: 0,
    warnings: [],
  };
}

function mergeRepairTotals(a: MapChainRepairResult, b: MapChainRepairResult): MapChainRepairResult {
  return {
    fixedLinks: a.fixedLinks + b.fixedLinks,
    addedNodes: a.addedNodes + b.addedNodes,
    provisionedAppear: a.provisionedAppear + b.provisionedAppear,
    provisionedChainContinuous: a.provisionedChainContinuous + b.provisionedChainContinuous,
    battleLayoutRepaired: a.battleLayoutRepaired + b.battleLayoutRepaired,
    questTaskRepaired: a.questTaskRepaired + b.questTaskRepaired,
    warnings: [...a.warnings, ...b.warnings],
  };
}

function resolveTargetMaps(project: ProjectData, gameMapIds?: string[]): GameMapDef[] {
  const all = ensureProjectGameMaps(project);
  if (gameMapIds?.length) {
    const set = new Set(gameMapIds);
    return all.filter((m) => set.has(m.id));
  }
  return getActiveGameMapsForExport(project);
}

function graphForMap(project: ProjectData, gameMap: GameMapDef): GraphData | undefined {
  return project.graphs.find((g) => g.id === gameMap.graphId);
}

function createThrottledProgress(
  onProgress: GlobalCheckRepairOptions["onProgress"],
  throttleMs: number,
) {
  if (!onProgress) return (_p: GlobalCheckProgress) => {};
  let lastEmit = 0;
  let pending: GlobalCheckProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (pending) {
      onProgress(pending);
      pending = null;
    }
    timer = null;
  };
  return (p: GlobalCheckProgress) => {
    pending = p;
    const now = Date.now();
    if (now - lastEmit >= throttleMs) {
      lastEmit = now;
      flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(() => {
        lastEmit = Date.now();
        flush();
      }, Math.max(4, throttleMs - (now - lastEmit)));
    }
  };
}

function countWorkUnits(
  gameMaps: GameMapDef[],
  opts: Pick<
    GlobalCheckRepairOptions,
    "runRepair" | "runLayout" | "runExportValidate" | "useAiForEmptyChains"
  >,
): number {
  let n = 2;
  for (const gm of gameMaps) {
    n += 1;
    if (opts.runRepair) n += 1;
    if (opts.runLayout) n += Math.max(1, gm.npcs.length);
    if (opts.runExportValidate) n += 1;
  }
  n += 1;
  if (opts.useAiForEmptyChains) n += gameMaps.length;
  return n;
}

/** 时间线 / 任务束顺序 / 跨链对接检测（只读） */
export function detectGlobalLinkageIssues(project: ProjectData): GlobalLinkageIssue[] {
  const issues: GlobalLinkageIssue[] = [];
  const maps = ensureProjectGameMaps(project);
  const graphById = new Map(project.graphs.map((g) => [g.id, g]));

  for (const q of project.quests ?? []) {
    if (q.graphId && !graphById.has(q.graphId)) {
      issues.push({
        kind: "quest_graph_missing",
        message: `任务「${q.name}」graphId=${q.graphId} 不存在`,
      });
    }
  }

  const timeline = getTimelineGraph(project);
  if (timeline) {
    for (const portal of timeline.nodes.filter((n) => n.kind === "mapPortal")) {
      if (portal.gameMapId && !maps.find((m) => m.id === portal.gameMapId)) {
        issues.push({
          kind: "portal_map_missing",
          message: `时间线 portal「${portal.title}」指向不存在的地图 ${portal.gameMapId}`,
        });
      }
      if (!portal.gameMapId) {
        issues.push({
          kind: "timeline_orphan",
          message: `时间线 portal「${portal.title}」未绑定 gameMap`,
        });
      }
    }
  }

  for (const gm of maps) {
    for (let i = 1; i < gm.npcs.length; i++) {
      const prev = gm.npcs[i - 1]!;
      const cur = gm.npcs[i]!;
      if (!prev.exitNodeId) {
        issues.push({
          kind: "npc_bundle_gap",
          gameMapId: gm.id,
          message: `「${gm.mapName}」任务束「${prev.npcName}」缺少 exit，后续「${cur.npcName}」无法对接`,
        });
      }
    }
  }

  return issues;
}

function detectMapIssuesSync(
  project: ProjectData,
  gm: GameMapDef,
): GlobalCheckIssue[] {
  const graph = graphForMap(project, gm);
  if (!graph) return [];
  return detectMapChainIssues(project, graph, gm).map((i) => ({
    ...i,
    gameMapId: gm.id,
    gameMapName: gm.mapName ?? gm.mapCode ?? "未命名地图",
  }));
}

/** 逐地图检测（每图后让步主线程） */
export async function detectAllMapChainIssues(
  project: ProjectData,
  gameMaps: GameMapDef[],
  yieldMs = 50,
  shouldAbort?: () => boolean,
): Promise<GlobalCheckIssue[]> {
  const all: GlobalCheckIssue[] = [];
  for (const gm of gameMaps) {
    if (shouldAbort?.()) break;
    await yieldToMainThread(yieldMs);
    all.push(...detectMapIssuesSync(project, gm));
  }
  return all;
}

/**
 * 全项目闭环（浏览器安全版：严格串行 + 分帧让步，不做主线程伪并发）
 */
export async function runGlobalCheckRepairLoop(
  project: ProjectData,
  options: GlobalCheckRepairOptions = {},
): Promise<GlobalCheckRepairReport> {
  const {
    syncTimeline = true,
    ensureZones = true,
    runRepair = true,
    runLayout = false,
    runExportValidate = true,
    useAiForEmptyChains = false,
    yieldMs = 50,
    progressThrottleMs = 150,
    onProgress,
    onStep,
    shouldAbort,
  } = options;

  const steps: GlobalCheckStepLog[] = [];
  const pushStep = (phase: GlobalCheckPhase, label: string, ok: boolean, detail?: string) => {
    const row: GlobalCheckStepLog = { phase, label, ok, detail };
    steps.push(row);
    onStep?.(row);
  };

  let repairTotals = emptyRepairTotals();
  let exportOkCount = 0;
  let exportFailCount = 0;
  const appearWarnings: string[] = [];
  const exportErrors: GlobalCheckRepairReport["exportErrors"] = [];
  let aiAttempts = 0;
  let aiSuccess = 0;
  let aborted = false;

  const gameMaps = resolveTargetMaps(project, options.gameMapIds);
  const totalSteps = countWorkUnits(gameMaps, {
    runRepair,
    runLayout,
    runExportValidate,
    useAiForEmptyChains,
  });
  let stepIndex = 0;
  const emit = createThrottledProgress(onProgress, progressThrottleMs);

  const tick = (phase: GlobalCheckPhase, label: string, extra?: Partial<GlobalCheckProgress>) => {
    stepIndex += 1;
    emit({
      phase,
      label,
      gameMapId: extra?.gameMapId,
      npcUid: extra?.npcUid,
      index: stepIndex,
      total: totalSteps,
    });
  };

  tick("prepare", "准备：解析目标地图");
  if (shouldAbort?.()) {
    return emptyReport(gameMaps.length, steps, true);
  }

  if (syncTimeline) {
    const reconcile = reconcileTimelineData(project);
    normalizeGlobalQuests(project);
    const orphanCleanup = cleanupOrphanGameMaps(project);
    const reconcileHint = [
      reconcile.removedDuplicatePortals ? `去重章节 ${reconcile.removedDuplicatePortals}` : "",
      reconcile.repairedTaskRefs ? `修复 taskId ${reconcile.repairedTaskRefs}` : "",
      orphanCleanup.removed.length ? `清理孤立地图 ${orphanCleanup.removed.length}` : "",
    ]
      .filter(Boolean)
      .join("，");
    pushStep(
      "prepare",
      "同步时间线任务",
      true,
      reconcileHint || undefined,
    );
  }

  const battleMigration = migrateQuestBattlePatterns(project);
  if (battleMigration.migrated > 0 || battleMigration.detected > 0) {
    pushStep(
      "prepare",
      "战斗链迁移",
      true,
      `检测 ${battleMigration.detected}，拆分 ${battleMigration.migrated}`,
    );
  }

  const linkageIssues = detectGlobalLinkageIssues(project);
  if (linkageIssues.length) {
    pushStep("detect", `跨链对接：${linkageIssues.length} 项待关注`, false);
  }

  if (ensureZones) {
    for (const gm of gameMaps) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      ensureNpcZonesAndEntries(project, gm);
      await yieldToMainThread(yieldMs);
    }
    if (!aborted) pushStep("prepare", "补全 NPC 区域与入口", true);
  }

  await yieldToMainThread(yieldMs);

  let issuesBefore: GlobalCheckIssue[] = [];
  if (!aborted) {
    for (const gm of gameMaps) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      tick("detect", `检测链：${gm.mapName}`, { gameMapId: gm.id });
      issuesBefore.push(...detectMapIssuesSync(project, gm));
      await yieldToMainThread(yieldMs);
    }
    pushStep("detect", `链检测完成：${issuesBefore.length} 项`, issuesBefore.length === 0);
  }

  if (!aborted && runRepair) {
    for (const gm of gameMaps) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      const graph = graphForMap(project, gm);
      if (!graph) {
        pushStep("repair", `跳过「${gm.mapName}」：无 graph`, false);
        continue;
      }
      tick("repair", `修复：${gm.mapName}`, { gameMapId: gm.id });
      await yieldToMainThread(yieldMs);
      const result = repairMapChains(project, graph, gm);
      repairTotals = mergeRepairTotals(repairTotals, result);
      pushStep(
        "repair",
        `「${gm.mapName}」连线+${result.fixedLinks} 节点+${result.addedNodes} 战斗链+${result.battleLayoutRepaired}`,
        true,
        result.warnings.slice(0, 2).join("; ") || undefined,
      );
      await yieldToMainThread(yieldMs);
    }
  }

  if (!aborted && runLayout) {
    for (const gm of gameMaps) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      const graph = graphForMap(project, gm);
      if (!graph) continue;
      for (const npc of gm.npcs) {
        if (shouldAbort?.()) {
          aborted = true;
          break;
        }
        if (!npc.zoneId) continue;
        tick("layout", `布局 ${gm.mapName} / ${npc.npcName}`, {
          gameMapId: gm.id,
          npcUid: npc.npcUid,
        });
        await yieldToMainThread(yieldMs);
        await layoutZoneNodes(graph, npc.zoneId);
        await yieldToMainThread(yieldMs);
      }
      if (!aborted) pushStep("layout", `「${gm.mapName}」区域已整理`, true);
    }
  }

  let issuesAfter: GlobalCheckIssue[] = [];
  if (!aborted) {
    tick("detect", "修复后复检");
    issuesAfter = await detectAllMapChainIssues(project, gameMaps, yieldMs, shouldAbort);
    await yieldToMainThread(yieldMs);
  }

  if (!aborted && runExportValidate) {
    for (const gm of gameMaps) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      tick("export_validate", `导出校验：${gm.mapName}`, { gameMapId: gm.id });
      await yieldToMainThread(yieldMs);
      const graph = graphForMap(project, gm);
      if (!graph) {
        exportFailCount += 1;
        pushStep("export_validate", `「${gm.mapName}」无 graph`, false);
        continue;
      }
      if (runRepair) {
        const pre = runExportRepairPass(project, graph, gm);
        if (pre.fixed > 0) {
          pushStep("repair", `「${gm.mapName}」导出预修复`, true, pre.detail);
        }
      }

      let pipeline = exportProjectMapPipeline(gm, graph, project, {
        patchAppear: true,
        validateManifest: true,
      });

      if (runRepair) {
        for (let attempt = 1; attempt < MAX_EXPORT_REPAIR_ATTEMPTS && !pipeline.ok; attempt++) {
          tick("repair", `导出修复：${gm.mapName}（第${attempt + 1}次）`, { gameMapId: gm.id });
          await yieldToMainThread(yieldMs);
          const { fixed, detail } = runExportRepairPass(project, graph, gm);
          pushStep("repair", `「${gm.mapName}」战斗导出修复`, true, fixed > 0 ? detail : detail);
          pipeline = exportProjectMapPipeline(gm, graph, project, {
            patchAppear: true,
            validateManifest: true,
          });
        }
      }
      const appearPreview = previewExportAppearPatches(pipeline.config);
      for (const line of appearPreview) {
        appearWarnings.push(`「${gm.mapName}」${line}`);
      }
      if (pipeline.ok) exportOkCount += 1;
      else {
        exportFailCount += 1;
        const errs = pipeline.report?.issues?.filter((i) => i.level === "error") ?? [];
        const manifestErrs = pipeline.manifestIssues?.filter((i) => i.level === "error") ?? [];
        const guardErrs = pipeline.editorGuards?.filter((i) => i.level === "error") ?? [];
        for (const e of errs.slice(0, 3)) {
          exportErrors.push({
            gameMapId: gm.id,
            gameMapName: gm.mapName ?? gm.id,
            npcUid: "npcUid" in e ? (e as { npcUid?: string }).npcUid : undefined,
            message: e.message,
          });
        }
        for (const m of manifestErrs.slice(0, 2)) {
          exportErrors.push({
            gameMapId: gm.id,
            gameMapName: gm.mapName ?? gm.id,
            message: `${m.path}: ${m.message}`,
          });
        }
        for (const g of guardErrs.slice(0, 2)) {
          exportErrors.push({
            gameMapId: gm.id,
            gameMapName: gm.mapName ?? gm.id,
            message: `${g.path}: ${g.message}`,
          });
        }
        if (errs.length === 0 && manifestErrs.length === 0 && guardErrs.length === 0) {
          exportErrors.push({
            gameMapId: gm.id,
            gameMapName: gm.mapName ?? gm.id,
            message: `校验失败（${countPipelineErrors(pipeline)} 个错误）`,
          });
        }
      }
      pushStep(
        "export_validate",
        `导出校验「${gm.mapName}」`,
        pipeline.ok,
        pipeline.ok
          ? appearPreview.length
            ? `appear预检: ${appearPreview.join("; ")}`
            : undefined
          : `errors=${countPipelineErrors(pipeline)}`,
      );
      await yieldToMainThread(yieldMs);
    }
  }

  if (!aborted && useAiForEmptyChains) {
    const aiTargets = new Map<string, { gm: GameMapDef; graph: GraphData; npcUid: string; issues: ChainIssue[] }>();
    for (const issue of issuesAfter) {
      if (!issuesNeedAiRepair([issue])) continue;
      const gm = gameMaps.find((m) => m.id === issue.gameMapId);
      const graph = gm ? graphForMap(project, gm) : undefined;
      if (!gm || !graph) continue;
      const key = `${gm.id}:${issue.npcUid}`;
      const row = aiTargets.get(key) ?? { gm, graph, npcUid: issue.npcUid, issues: [] };
      row.issues.push(issue);
      aiTargets.set(key, row);
    }

    for (const { gm, graph, npcUid, issues } of aiTargets.values()) {
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      aiAttempts += 1;
      tick("ai_repair", `AI 修复：${gm.mapName} / ${npcUid}`, { gameMapId: gm.id, npcUid });
      await yieldToMainThread(yieldMs);
      const aiResult = await runAiChainRepairForNpc(project, graph, gm, npcUid, issues);
      if (aiResult.ok) {
        aiSuccess += 1;
        repairMapChains(project, graph, gm);
      }
      pushStep("ai_repair", `AI ${npcUid}`, aiResult.ok, aiResult.error ?? `ops=${aiResult.appliedOps}`);
      await yieldToMainThread(yieldMs);
    }

    if (aiAttempts > 0 && !aborted) {
      issuesAfter = await detectAllMapChainIssues(project, gameMaps, yieldMs, shouldAbort);
    }
  }

  emit({ phase: "done", label: "完成", index: totalSteps, total: totalSteps });

  return {
    mapsChecked: gameMaps.length,
    linkageIssues,
    issuesBefore,
    issuesAfter,
    repairTotals,
    exportOkCount,
    exportFailCount,
    appearWarnings,
    exportErrors,
    aiAttempts,
    aiSuccess,
    steps,
    aborted,
  };
}

function emptyReport(
  mapsChecked: number,
  steps: GlobalCheckStepLog[],
  aborted: boolean,
): GlobalCheckRepairReport {
  return {
    mapsChecked,
    linkageIssues: [],
    issuesBefore: [],
    issuesAfter: [],
    repairTotals: emptyRepairTotals(),
    exportOkCount: 0,
    exportFailCount: 0,
    appearWarnings: [],
    exportErrors: [],
    aiAttempts: 0,
    aiSuccess: 0,
    steps,
    aborted,
  };
}

export function formatGlobalCheckReport(report: GlobalCheckRepairReport): string {
  const lines: string[] = [];
  lines.push(`已检查 ${report.mapsChecked} 张地图`);
  if (report.linkageIssues.length) {
    lines.push(`跨链对接 ${report.linkageIssues.length} 项：`);
    for (const li of report.linkageIssues.slice(0, 6)) lines.push(`  · ${li.message}`);
  }
  lines.push(`链问题 ${report.issuesBefore.length} → ${report.issuesAfter.length}`);
  lines.push(
    `修复：连线 ${report.repairTotals.fixedLinks}，节点 ${report.repairTotals.addedNodes}，appear ${report.repairTotals.provisionedAppear}，战斗链 ${report.repairTotals.battleLayoutRepaired}，任务ID ${report.repairTotals.questTaskRepaired}`,
  );
  if (report.exportOkCount + report.exportFailCount > 0) {
    lines.push(`导出校验：通过 ${report.exportOkCount}，未通过 ${report.exportFailCount}`);
  }
  if (report.appearWarnings.length) {
    lines.push("", "appear 预检（导出时将自动 patch）：");
    for (const w of report.appearWarnings.slice(0, 8)) lines.push(`  ⚠ ${w}`);
  }
  if (report.exportErrors.length) {
    lines.push("", "导出错误（前几条）：");
    for (const e of report.exportErrors.slice(0, 5)) {
      const npc = e.npcUid ? ` / ${e.npcUid}` : "";
      lines.push(`  ✗ ${e.gameMapName}${npc}: ${e.message}`);
    }
  }
  if (report.aiAttempts > 0) {
    lines.push(`AI 修复：${report.aiSuccess}/${report.aiAttempts} 成功`);
  }
  if (report.issuesAfter.length) {
    lines.push("", "仍待处理：");
    for (const i of report.issuesAfter.slice(0, 12)) {
      lines.push(`  [${i.kind}] ${i.gameMapName} / ${i.npcUid}: ${i.message}`);
    }
    if (report.issuesAfter.length > 12) lines.push(`  …另有 ${report.issuesAfter.length - 12} 项`);
  } else {
    lines.push("", "全部任务链已对接，可导出运行时 map。");
  }
  if (report.aborted) lines.unshift("（已取消）");
  return lines.join("\n");
}
