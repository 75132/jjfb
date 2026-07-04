/**
 * 统一 map JSON 导出管线：export → patch appear → merge shell → validate（含 manifest）
 */
import type { GameMapDef, GraphData, ProjectData } from "../types";
import { sanitizeBattlePseudoChoicesInRuntime } from "../../../assets/Script/Game/story-runtime-sanitize";
import { exportGameMapToRuntimeWithMeta, type MapExportFoldWarning } from "./map-export";
import { formatMapRuntimeReport, validateMapConfig, type MapRuntimeReport, type RuntimeMapConfig } from "./map-runtime";
import {
  getClientRuntimeManifest,
  isKnownBattleRef,
  isUnsupportedRequirementType,
  isWarnOnlyEffectAction,
  isWarnOnlyRequirementType,
} from "./client-runtime-manifest";
import { collectCocosExportMapImageIssues } from "./map-slice-layout";
import { getActiveGameMapsForExport } from "./timeline-logic";
import { collectEditorExportGuards, auditProjectBattleExportBlockers, type EditorExportGuard } from "./map-export-editor-guards";
import { normalizeProjectBattleChoices } from "./quest-battle-normalize";
import { normalizeAllChoiceDeferFlags } from "./choice-option-defer";

type RuntimeNpcRow = NonNullable<RuntimeMapConfig["npcs"]>[number];
type RuntimeEffect = { action?: string; taskId?: number };
type RuntimeChoiceOption = {
  id?: string;
  text?: string;
  forcedResult?: string;
  completesEvent?: boolean;
};
type RuntimeChoiceScript = { options?: RuntimeChoiceOption[] };

export type MapExportPipelineOptions = {
  /** 合并既有运行时 JSON 的 shell（bgm、scenePrefabKey、server 等） */
  mergeFrom?: Record<string, unknown> | RuntimeMapConfig | null;
  /** 为顺序 NPC 自动补 appear.requirements */
  patchAppear?: boolean;
  /** 是否执行 manifest 校验（battleRef、requirement type） */
  validateManifest?: boolean;
};

export type MapExportPipelineResult = {
  config: RuntimeMapConfig;
  report: MapRuntimeReport;
  manifestIssues: Array<{ level: "error" | "warn"; path: string; message: string }>;
  foldWarnings: MapExportFoldWarning[];
  editorGuards: EditorExportGuard[];
  ok: boolean;
};

export function patchSequentialNpcAppear(runtime: RuntimeMapConfig): void {
  const npcs = runtime.npcs ?? [];
  for (let i = 1; i < npcs.length; i++) {
    const row = npcs[i] as RuntimeNpcRow;
    const appear = row.appear;
    if (!appear || appear.mode !== "conditional") continue;
    if (appear.requirements?.length) continue;
    const prev = npcs[i - 1] as RuntimeNpcRow;
    const prevEvents = prev.events ?? [];
    let eventId: string | undefined;
    for (let ei = prevEvents.length - 1; ei >= 0; ei--) {
      const ev = prevEvents[ei]!;
      if (ev.eventType && ev.eventId) {
        eventId = ev.eventId;
        break;
      }
    }
    if (eventId) {
      appear.requirements = [{ type: "event_done", eventId } as { type: string; eventId: string }];
    }
  }
}

/** 预检导出时 patchSequentialNpcAppear 将补全的 appear（编辑器内可见，不静默） */
export function previewExportAppearPatches(runtime: RuntimeMapConfig): string[] {
  const clone: RuntimeMapConfig = JSON.parse(JSON.stringify(runtime));
  patchSequentialNpcAppear(clone);
  const warnings: string[] = [];
  for (let i = 0; i < (clone.npcs ?? []).length; i++) {
    const after = clone.npcs![i]!.appear;
    const orig = runtime.npcs?.[i]?.appear;
    if (JSON.stringify(after) !== JSON.stringify(orig)) {
      const uid = clone.npcs![i]!.npcUid ?? `#${i}`;
      warnings.push(`${uid} appear 将在导出时自动补 event_done 条件`);
    }
  }
  return warnings;
}

export function mergeRuntimeShell(
  base: Record<string, unknown>,
  exported: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...exported };
  for (const key of ["mapType", "coordinateSystem", "server"] as const) {
    if (base[key] != null) merged[key] = base[key];
  }
  const baseClient = (base.client ?? {}) as Record<string, unknown>;
  const expClient = (exported.client ?? {}) as Record<string, unknown>;
  merged.client = {
    ...baseClient,
    ...expClient,
    bgm: baseClient.bgm ?? expClient.bgm,
    scenePrefabKey: baseClient.scenePrefabKey ?? expClient.scenePrefabKey,
    markerPrefabs: baseClient.markerPrefabs ?? expClient.markerPrefabs,
    dialogueScripts: expClient.dialogueScripts,
    choiceScripts: expClient.choiceScripts,
  };
  const defaults = getClientRuntimeManifest().mapDefaults;
  if (!merged.configVersion) merged.configVersion = defaults.configVersion;
  if (!merged.coordinateSystem) merged.coordinateSystem = defaults.coordinateSystem;
  return merged;
}

function collectBattleContractIssues(cfg: RuntimeMapConfig): MapExportPipelineResult["manifestIssues"] {
  const issues: MapExportPipelineResult["manifestIssues"] = [];
  const choiceScripts = (cfg.client?.choiceScripts ?? {}) as Record<string, RuntimeChoiceScript>;
  const npcUids = new Set((cfg.npcs ?? []).map((n) => n.npcUid));

  for (let ni = 0; ni < (cfg.npcs ?? []).length; ni++) {
    const npc = cfg.npcs![ni]!;
    const npcPath = `npcs[${ni}]`;
    const isBattleNpc = String(npc.npcUid ?? "").endsWith("_battle");
    const hasSplitCompanion = npcUids.has(`${npc.npcUid}_battle`);

    const battleEventIds = new Set<string>();
    for (let ei = 0; ei < (npc.events ?? []).length; ei++) {
      const ev = npc.events![ei]!;
      const evPath = `${npcPath}.events[${ei}]`;

      if (ev.eventType === "choice" || ev.eventType === "teleport") {
        const scriptId = ev.client?.choiceScriptId;
        if (scriptId) {
          const script = choiceScripts[scriptId];
          const opts = script?.options ?? [];
          const allowed = ev.server?.allowedChoiceIds ?? [];
          for (const opt of opts) {
            if (
              (opt.completesEvent === false || opt.forcedResult === "block") &&
              opt.id &&
              allowed.includes(opt.id)
            ) {
              issues.push({
                level: "error",
                path: evPath,
                message: `allowedChoiceIds 含暂缓选项 ${opt.id}（${opt.text ?? ""}）`,
              });
            }
            if (opt.completesEvent !== false && opt.forcedResult !== "block" && allowed.includes(opt.id!)) {
              const text = String(opt.text ?? "");
              if (/暂缓|拒绝|稍后再|还没准备好|未准备好/.test(text)) {
                issues.push({
                  level: "error",
                  path: `${evPath}.choiceScripts.${scriptId}`,
                  message: `选项「${text}」文案像暂缓但未标记 completesEvent=false`,
                });
              }
            }
          }
        }
      }

      if (ev.eventType === "battle") {
        battleEventIds.add(String(ev.eventId ?? ""));
        if (!isBattleNpc && hasSplitCompanion) {
          issues.push({
            level: "error",
            path: evPath,
            message: "分离模式下任务 NPC 链不应含 battle 节点（请合并为单链或移除 _battle 摆点）",
          });
        }
        const scriptId = ev.client?.choiceScriptId;
        if (scriptId) {
          const script = choiceScripts[scriptId];
          const opts = script?.options ?? [];
          const needsStartBattle =
            opts.length > 1 ||
            opts.some((o) => /胜利|失败|挑战|开战|进入战斗/.test(String(o.text ?? "")));
          if (needsStartBattle) {
            const hasStart = opts.some((o) => o.forcedResult === "start_battle");
            if (!hasStart) {
              issues.push({
                level: "error",
                path: evPath,
                message: "战前选项缺少 forcedResult=start_battle",
              });
            }
          }
          const allowed = ev.server?.allowedChoiceIds ?? [];
          for (const opt of opts) {
            if (
              (opt.completesEvent === false || opt.forcedResult === "block") &&
              opt.id &&
              allowed.includes(opt.id)
            ) {
              issues.push({
                level: "error",
                path: evPath,
                message: `allowedChoiceIds 含暂缓选项 ${opt.id}`,
              });
            }
          }
        }
      }

      if (ev.eventType === "task") {
        const completes = (ev.server?.effects ?? []).some(
          (e) => (e as RuntimeEffect).action === "task_complete",
        );
        if (completes && battleEventIds.size > 0) {
          const reqs = ev.server?.requirements ?? [];
          const battleIds = [...battleEventIds].filter(Boolean);
          const ok = battleIds.some((bid) =>
            reqs.some((r) => (r as { type?: string; eventId?: string }).type === "event_done" && (r as { eventId?: string }).eventId === bid),
          );
          if (!ok && !isBattleNpc) {
            issues.push({
              level: "error",
              path: `${evPath}.server.requirements`,
              message: "交任务事件缺少对应 battle 的 event_done 条件",
            });
          }
        }
      }
    }
  }
  return issues;
}

function collectManifestIssues(cfg: RuntimeMapConfig): MapExportPipelineResult["manifestIssues"] {
  const issues: MapExportPipelineResult["manifestIssues"] = [];
  const manifest = getClientRuntimeManifest();

  for (let ni = 0; ni < (cfg.npcs ?? []).length; ni++) {
    const npc = cfg.npcs![ni]!;
    const npcPath = `npcs[${ni}]`;
    for (const req of npc.appear?.requirements ?? []) {
      const t = String((req as { type?: string }).type ?? "");
      if (!t) continue;
      if (isUnsupportedRequirementType(t)) {
        issues.push({
          level: "error",
          path: `${npcPath}.appear`,
          message: `客户端不支持的 appear 条件 type=${t}（manifest 未列出）`,
        });
      } else if (isWarnOnlyRequirementType(t)) {
        issues.push({
          level: "warn",
          path: `${npcPath}.appear`,
          message: `CLIENT_WARN: appear 条件 type=${t} 客户端可能未实现`,
        });
      }
    }
    for (let ei = 0; ei < (npc.events ?? []).length; ei++) {
      const ev = npc.events![ei]!;
      const evPath = `${npcPath}.events[${ei}]`;
      const et = ev.eventType ?? "";
      if (et && !manifest.supportedEventTypes.includes(et)) {
        issues.push({ level: "warn", path: evPath, message: `eventType=${et} 不在 manifest 支持列表` });
      }
      if (et === "battle") {
        const ref = ev.server?.battleRef;
        if (!ref) {
          issues.push({ level: "error", path: evPath, message: "battle 事件缺少 battleRef" });
        } else if (!isKnownBattleRef(ref)) {
          issues.push({
            level: "error",
            path: evPath,
            message: `battleRef=${ref} 不在客户端 manifest（可用：${manifest.battleRefs.join(", ")}）`,
          });
        }
      }
      for (const req of ev.server?.requirements ?? []) {
        if (!req || typeof req !== "object") continue;
        const t = String((req as { type?: string }).type ?? "");
        if (!t) continue;
        if (isUnsupportedRequirementType(t)) {
          issues.push({
            level: "error",
            path: `${evPath}.server.requirements`,
            message: `客户端不支持的 requirement type=${t}`,
          });
        } else if (isWarnOnlyRequirementType(t)) {
          issues.push({
            level: "warn",
            path: `${evPath}.server.requirements`,
            message: `CLIENT_WARN: requirement type=${t} 客户端可能未实现`,
          });
        }
      }
      for (const eff of ev.server?.effects ?? []) {
        const action = String((eff as RuntimeEffect).action ?? "");
        if (action && isWarnOnlyEffectAction(action)) {
          issues.push({
            level: "warn",
            path: `${evPath}.server.effects`,
            message: `CLIENT_WARN: effect action=${action} 客户端可能未实现`,
          });
        }
      }
    }
  }
  issues.push(...collectBattleContractIssues(cfg));
  return issues;
}

export function exportProjectMapPipeline(
  gameMap: GameMapDef,
  graph: GraphData,
  project: ProjectData | undefined,
  options: MapExportPipelineOptions = {},
): MapExportPipelineResult {
  const { mergeFrom = null, patchAppear = true, validateManifest = true } = options;

  if (project) {
    normalizeProjectBattleChoices(project);
    normalizeAllChoiceDeferFlags(project, graph, gameMap);
  }

  const { config: rawConfig, foldWarnings } = exportGameMapToRuntimeWithMeta(gameMap, graph, project);
  let exported = rawConfig;
  sanitizeBattlePseudoChoicesInRuntime(exported);
  if (patchAppear) patchSequentialNpcAppear(exported);

  let config: RuntimeMapConfig = exported;
  if (mergeFrom && typeof mergeFrom === "object") {
    config = mergeRuntimeShell(
      mergeFrom as Record<string, unknown>,
      exported as Record<string, unknown>,
    ) as RuntimeMapConfig;
  } else {
    const defaults = getClientRuntimeManifest().mapDefaults;
    if (!config.configVersion) config.configVersion = defaults.configVersion;
  }

  const report = validateMapConfig(config);
  const manifestIssues = validateManifest ? collectManifestIssues(config) : [];
  for (const msg of collectCocosExportMapImageIssues(gameMap)) {
    manifestIssues.push({ level: "error", path: "gameMap.imagePath", message: msg });
  }
  const editorGuards =
    project && graph
      ? collectEditorExportGuards(project, gameMap, graph, config, foldWarnings)
      : [];
  const manifestErrors = manifestIssues.filter((i) => i.level === "error").length;
  const editorErrors = editorGuards.filter((g) => g.level === "error").length;
  const ok = report.ok && manifestErrors === 0 && editorErrors === 0;

  return { config, report, manifestIssues, foldWarnings, editorGuards, ok };
}

export function formatPipelineReport(result: MapExportPipelineResult): string {
  const lines: string[] = [];
  lines.push(formatMapRuntimeReport(result.report));
  if (result.foldWarnings.length) {
    lines.push("--- 导出折叠 / 跳过 ---");
    for (const w of result.foldWarnings) {
      lines.push(`[${w.level.toUpperCase()}] ${w.npcUid ?? "?"} / ${w.nodeKind} (${w.nodeId}): ${w.message}`);
    }
  }
  for (const m of result.manifestIssues) {
    lines.push(`[${m.level.toUpperCase()}] ${m.path}: ${m.message}`);
  }
  if (result.editorGuards.length) {
    lines.push("--- 编辑器语义自检（导出阻断） ---");
    for (const g of result.editorGuards) {
      lines.push(`[${g.level.toUpperCase()}] ${g.path}: ${g.message}`);
    }
  }
  if (result.ok) lines.unshift("校验通过：可替换 Cocos JsonAsset 使用。");
  else {
    const mapImg = result.manifestIssues.find((i) => i.path === "gameMap.imagePath");
    if (mapImg) lines.unshift(`底图配置错误：${mapImg.message}`);
    else lines.unshift("校验未通过：请修复后再导出。");
  }
  return lines.join("\n");
}

export function validateRuntimeConfig(config: RuntimeMapConfig): MapExportPipelineResult {
  const report = validateMapConfig(config);
  const manifestIssues = collectManifestIssues(config);
  const manifestErrors = manifestIssues.filter((i) => i.level === "error").length;
  const ok = report.ok && manifestErrors === 0;
  return { config, report, manifestIssues, foldWarnings: [], editorGuards: [], ok };
}

export function findGameMapInProject(project: ProjectData, key: string): GameMapDef | null {
  const maps = project.gameMaps ?? [];
  return maps.find((m) => m.id === key || m.mapCode === key) ?? maps[0] ?? null;
}

export type GameMapExportAudit = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** AI 生成 / 修复后：模拟导出并收集阻断项（会规范化战前选项，不写出文件） */
export function auditGameMapExportReadiness(
  project: ProjectData,
  gameMap: GameMapDef,
  graph: GraphData,
): GameMapExportAudit {
  const result = exportProjectMapPipeline(gameMap, graph, project);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const g of result.editorGuards) {
    if (g.level === "error") errors.push(g.message);
    else warnings.push(g.message);
  }
  for (const issue of result.report.issues) {
    if (issue.level === "error") errors.push(issue.message);
    else if (issue.level === "warn") warnings.push(issue.message);
  }
  for (const m of result.manifestIssues) {
    if (m.level === "error") errors.push(`${m.path}: ${m.message}`);
    else warnings.push(`${m.path}: ${m.message}`);
  }
  for (const w of result.foldWarnings) {
    const line = `${w.npcUid ? `${w.npcUid}: ` : ""}${w.message}`;
    if (w.level === "warn") warnings.push(line);
  }

  return { ok: result.ok && errors.length === 0, errors, warnings };
}

export function formatGameMapExportAuditMessage(audit: GameMapExportAudit, mapLabel: string): string {
  if (audit.ok) {
    if (audit.warnings.length === 0) {
      return `「${mapLabel}」导出自检通过，可发布到游戏。`;
    }
    const lines = [`「${mapLabel}」导出自检通过，但有 ${audit.warnings.length} 条警告：`];
    for (const w of audit.warnings.slice(0, 4)) lines.push(`• ${w}`);
    if (audit.warnings.length > 4) lines.push(`…另有 ${audit.warnings.length - 4} 条`);
    return lines.join("\n");
  }
  const lines = [`「${mapLabel}」导出自检未通过，发布到游戏前请先修复：`];
  for (const e of audit.errors.slice(0, 6)) lines.push(`• ${e}`);
  if (audit.errors.length > 6) lines.push(`…另有 ${audit.errors.length - 6} 项`);
  if (audit.warnings.length > 0) {
    lines.push("", `另有 ${audit.warnings.length} 条警告（见运行时 JSON 面板）`);
  }
  lines.push("", "建议：点顶栏「全局检查修复」，或为相关任务添加「+ 战斗分支」后重新摆红色敌人。");
  return lines.join("\n");
}

export type ProjectMapExportAudit = {
  gameMapId: string;
  mapLabel: string;
  audit: GameMapExportAudit;
};

export type ProjectExportHealthReport = {
  ok: boolean;
  blockers: string[];
  mapAudits: ProjectMapExportAudit[];
};

/** 全项目导出自检（启动 / 手动 / 保存后刷新顶栏） */
export function auditProjectExportHealth(project: ProjectData): ProjectExportHealthReport {
  const blockers = auditProjectBattleExportBlockers(project);
  const mapAudits: ProjectMapExportAudit[] = [];
  const referenced = getActiveGameMapsForExport(project);
  for (const gm of referenced) {
    const graph = project.graphs.find((g) => g.id === gm.graphId);
    if (!graph || graph.kind !== "map") continue;
    const audit = auditGameMapExportReadiness(project, gm, graph);
    mapAudits.push({
      gameMapId: gm.id,
      mapLabel: gm.mapName || gm.mapCode || gm.id,
      audit,
    });
  }
  const ok = blockers.length === 0 && mapAudits.every((m) => m.audit.ok);
  return { ok, blockers, mapAudits };
}

export function formatProjectExportHealthMessage(report: ProjectExportHealthReport): string {
  if (report.ok) {
    const warnCount = report.mapAudits.reduce((n, m) => n + m.audit.warnings.length, 0);
    if (warnCount === 0) return "全项目导出自检通过，可发布到游戏。";
    return `全项目导出自检通过，但有 ${warnCount} 条警告（见各地图运行时 JSON 面板）。`;
  }
  const lines: string[] = ["全项目导出自检未通过，发布前请先修复："];
  for (const b of report.blockers.slice(0, 6)) lines.push(`• ${b}`);
  if (report.blockers.length > 6) lines.push(`…另有 ${report.blockers.length - 6} 项编辑器问题`);
  for (const row of report.mapAudits) {
    if (row.audit.ok) continue;
    lines.push("", `【${row.mapLabel}】`);
    for (const e of row.audit.errors.slice(0, 4)) lines.push(`  • ${e}`);
    if (row.audit.errors.length > 4) lines.push(`  …另有 ${row.audit.errors.length - 4} 项`);
  }
  lines.push("", "可点「全局检查修复」自动处理链路/appear；战斗分支问题请补「+ 战斗分支」并摆红色敌人。");
  return lines.join("\n");
}

export function flattenProjectExportBlockers(report: ProjectExportHealthReport): string[] {
  const lines = [...report.blockers];
  for (const row of report.mapAudits) {
    if (row.audit.ok) continue;
    const label = row.mapLabel;
    for (const e of row.audit.errors) {
      const line = `[${label}] ${e}`;
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines;
}
