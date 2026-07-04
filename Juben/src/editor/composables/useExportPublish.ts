/**
 * 地图导出 / 发布 composable
 */
import type { Ref } from "vue";
import type { GameMapDef, ProjectData } from "../../types";
import {
  exportProjectMapPipeline,
  formatPipelineReport,
  auditProjectExportHealth,
  formatProjectExportHealthMessage,
  flattenProjectExportBlockers,
} from "../map-export-pipeline";
import {
  applyRuntimeShellFromMergeJson,
  buildMergeShellFromGameMap,
  importRuntimeMapIntoProject,
  parseRuntimeMapJson,
} from "../map-import";
import { fetchRuntimeMapTarget, publishMapJsonToRuntime } from "../cocos-map-publish";
import { findGameMapById } from "../game-map-logic";
import { syncQuestsFromTimeline } from "../timeline-logic";
import type { RuntimeMapConfig } from "../map-runtime";
import { appAlert, appConfirm } from "../useModal";
import { showExportFailed, showPublishFailed } from "../feedback";

export type ExportPublishDeps = {
  project: Ref<ProjectData>;
  currentGameMap: Ref<GameMapDef | null | undefined>;
  projectExportBlockers: Ref<string[]>;
  projectExportHealthOk: Ref<boolean>;
  prepareProjectForExport: () => ProjectData;
  flushCurrentProjectSave: () => void;
  rebuildFlowFromGraph: () => void;
  openGlobalCheckRepair: () => void;
};

export function downloadRuntimeMapJson(cfg: RuntimeMapConfig, filename: string) {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function createExportPublishActions(deps: ExportPublishDeps) {
  function refreshProjectExportHealth(pd: ProjectData = deps.project.value) {
    const report = auditProjectExportHealth(pd);
    deps.projectExportBlockers.value = flattenProjectExportBlockers(report);
    deps.projectExportHealthOk.value = report.ok;
    return report;
  }

  async function runManualExportHealthCheck() {
    const pd = deps.prepareProjectForExport();
    const report = refreshProjectExportHealth(pd);
    const msg = formatProjectExportHealthMessage(report);
    if (report.ok) {
      await appAlert(msg, "导出自检通过");
      return;
    }
    const openRepair = await appConfirm(`${msg}\n\n是否打开「全局检查修复」？`, "导出自检未通过");
    if (openRepair) deps.openGlobalCheckRepair();
  }

  function exportRuntimeMapJson() {
    const gm = deps.currentGameMap.value;
    if (!gm) {
      void appAlert("请先进入游戏地图（时间线 → 双击章节）");
      return;
    }
    const pd = deps.prepareProjectForExport();
    const graph = pd.graphs.find((g) => g.id === gm.graphId);
    if (!graph) return;
    deps.flushCurrentProjectSave();
    const shell = buildMergeShellFromGameMap(gm);
    const result = exportProjectMapPipeline(gm, graph, pd, { mergeFrom: shell });
    if (!result.ok) {
      void appConfirm(`${formatPipelineReport(result)}\n\n仍要下载？（不推荐）`).then((go) => {
        if (go) downloadRuntimeMapJson(result.config, `map_${result.config.mapCode ?? gm.mapCode}.json`);
      });
      return;
    }
    downloadRuntimeMapJson(result.config, `map_${result.config.mapCode ?? gm.mapCode}.json`);
  }

  async function exportGameMapToCocos(gameMapId: string) {
    const gm = findGameMapById(deps.project.value, gameMapId);
    if (!gm) {
      await appAlert("未找到绑定的游戏地图");
      return;
    }
    const mapId = Math.trunc(Number(gm.mapId));
    if (!Number.isFinite(mapId) || mapId < 0) {
      await appAlert("请先在属性里设置有效的「地图 ID」（非负整数）");
      return;
    }
    const mapCode = String(gm.mapCode ?? "").trim();
    if (!mapCode) {
      await appAlert("请先在属性里设置 mapCode");
      return;
    }
    const pd = deps.prepareProjectForExport();
    const graphReady = pd.graphs.find((g) => g.id === gm.graphId);
    if (!graphReady) {
      await appAlert("地图缺少剧情 graph");
      return;
    }
    deps.flushCurrentProjectSave();
    const shell = buildMergeShellFromGameMap(gm);
    const result = exportProjectMapPipeline(gm, graphReady, pd, { mergeFrom: shell });
    if (!result.ok) {
      const go = await appConfirm(`${formatPipelineReport(result)}\n\n校验未通过，仍要发布到游戏？`, "发布校验");
      if (!go) {
        void showExportFailed(flattenProjectExportBlockers(auditProjectExportHealth(pd)));
        return;
      }
    }

    let target;
    try {
      target = await fetchRuntimeMapTarget(mapId, mapCode);
    } catch (e) {
      await showPublishFailed(String(e));
      return;
    }

    let overwrite = false;
    if (target.cocos.exists || target.server?.exists) {
      const paths = [target.cocos.relativePath, target.server?.relativePath].filter(Boolean).join("\n");
      const ok = await appConfirm(`目标文件已存在，将覆盖：\n${paths}\n\n确认继续？`, "覆盖确认");
      if (!ok) return;
      overwrite = true;
    }

    const pub = await publishMapJsonToRuntime(result.config, { overwrite });
    if (!pub.ok) {
      await showPublishFailed(pub.error?.message ?? "写入失败（请确认 storage 服务已启动）");
      return;
    }
    const lines = [
      pub.cocos?.relativePath ? `Cocos: ${pub.cocos.relativePath}` : "",
      pub.server?.relativePath ? `Server: ${pub.server.relativePath}` : "",
      ...(pub.legacyWarnings ?? []).map((w) => `⚠ ${w}`),
    ].filter(Boolean);
    await appAlert(`已发布到游戏：\n${lines.join("\n")}`, "发布到游戏");
  }

  function onExportMergeFileChange(file: File | undefined, gameMap: GameMapDef | null | undefined) {
    if (!file || !gameMap) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const merge = JSON.parse(String(reader.result ?? "{}")) as Record<string, unknown>;
        if (!applyRuntimeShellFromMergeJson(gameMap, merge)) {
          void appAlert("merge JSON 中未找到 client.bgm / scenePrefabKey / markerPrefabs 字段");
          return;
        }
        void appAlert("已写入地图属性（runtimeShell），刷新后仍会保留。");
        deps.flushCurrentProjectSave();
      } catch {
        void appAlert("merge JSON 解析失败");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function onImportRuntimeMap(payload: { gameMapId: string; raw: string }) {
    const runtime = parseRuntimeMapJson(payload.raw);
    if (!runtime) {
      void appAlert("不是有效的运行时 map JSON");
      return;
    }
    const res = importRuntimeMapIntoProject(deps.project.value, payload.gameMapId, runtime);
    if (!res.ok) {
      void appAlert(res.message);
      return;
    }
    syncQuestsFromTimeline(deps.project.value);
    deps.rebuildFlowFromGraph();
    deps.flushCurrentProjectSave();
    void appAlert(res.message);
  }

  return {
    refreshProjectExportHealth,
    runManualExportHealthCheck,
    exportRuntimeMapJson,
    exportGameMapToCocos,
    onExportMergeFileChange,
    onImportRuntimeMap,
  };
}
