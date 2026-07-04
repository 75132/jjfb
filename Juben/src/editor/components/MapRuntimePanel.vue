<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ProjectData } from "../../types";
import { findGameMapById } from "../game-map-logic";
import { exportProjectMapPipeline, formatPipelineReport, validateRuntimeConfig, auditGameMapExportReadiness, formatGameMapExportAuditMessage } from "../map-export-pipeline";
import { summarizeExportedChoiceEvents } from "../choice-option-defer";
import { buildMergeShellFromGameMap, parseRuntimeMapJson } from "../map-import";
import type { RuntimeMapConfig } from "../map-runtime";
import { appAlert, appConfirm } from "../useModal";

const props = defineProps<{
  project?: ProjectData;
  gameMapId?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "importRuntime", payload: { gameMapId: string; raw: string }): void;
}>();

const jsonText = ref("");
const pipelineReport = ref("");
const pipelineOk = ref<boolean | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);
const mergeFileInputEl = ref<HTMLInputElement | null>(null);
const useManualEdit = ref(false);
const mergeFromJson = ref<Record<string, unknown> | null>(null);

const selectedGameMap = computed(() => {
  if (!props.project || !props.gameMapId) return null;
  return findGameMapById(props.project, props.gameMapId) ?? null;
});

function runPipelineFromEditor(): ReturnType<typeof exportProjectMapPipeline> | null {
  const gm = selectedGameMap.value;
  if (!gm || !props.project) return null;
  const graph = props.project.graphs.find((g) => g.id === gm.graphId);
  if (!graph) return null;
  const shell = mergeFromJson.value ?? buildMergeShellFromGameMap(gm);
  return exportProjectMapPipeline(gm, graph, props.project, { mergeFrom: shell });
}

function syncFromProject() {
  if (!selectedGameMap.value || useManualEdit.value) return;
  const result = runPipelineFromEditor();
  if (!result) return;
  jsonText.value = JSON.stringify(result.config, null, 2);
  pipelineReport.value = formatPipelineReport(result);
  pipelineOk.value = result.ok;
}

watch(
  () => [props.gameMapId, props.project, useManualEdit.value, mergeFromJson.value] as const,
  () => syncFromProject(),
  { immediate: true, deep: true },
);

const issueSummary = computed(() => {
  if (pipelineOk.value === null) return "未校验";
  return pipelineOk.value ? "校验通过 · 可替换 Cocos JsonAsset" : "校验未通过";
});

const choiceEventSummary = computed(() => {
  try {
    const raw = JSON.parse(jsonText.value || "{}") as RuntimeMapConfig;
    return summarizeExportedChoiceEvents(raw);
  } catch {
    return [];
  }
});

function triggerImport() {
  fileInputEl.value?.click();
}

function triggerMergeFile() {
  mergeFileInputEl.value?.click();
}

function onMergeFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      mergeFromJson.value = JSON.parse(String(reader.result ?? "{}")) as Record<string, unknown>;
      void appAlert("已加载 merge 壳，刷新预览中…");
      useManualEdit.value = false;
      syncFromProject();
    } catch {
      void appAlert("merge JSON 解析失败");
    }
  };
  reader.readAsText(file, "utf-8");
  (e.target as HTMLInputElement).value = "";
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    jsonText.value = String(reader.result ?? "");
    useManualEdit.value = true;
    runValidateOnly();
  };
  reader.readAsText(file, "utf-8");
  (e.target as HTMLInputElement).value = "";
}

function runValidateOnly() {
  try {
    const raw = JSON.parse(jsonText.value || "{}") as RuntimeMapConfig;
    const result = validateRuntimeConfig(raw);
    pipelineReport.value = formatPipelineReport(result);
    pipelineOk.value = result.ok;
  } catch {
    pipelineOk.value = false;
    pipelineReport.value = "JSON 解析失败";
  }
}

async function exportProduction(force = false) {
  const result = runPipelineFromEditor();
  if (!result) {
    await appAlert("请先选择有效游戏地图");
    return;
  }
  pipelineReport.value = formatPipelineReport(result);
  pipelineOk.value = result.ok;
  jsonText.value = JSON.stringify(result.config, null, 2);
  if (!result.ok && !force) {
    const go = await appConfirm(`${formatPipelineReport(result)}\n\n仍要下载？（不推荐）`);
    if (!go) return;
  }
  downloadJson(result.config, `map_${result.config.mapCode ?? "export"}.json`);
}

function downloadJson(data: RuntimeMapConfig, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importIntoEditor() {
  const gm = selectedGameMap.value;
  if (!gm) {
    await appAlert("请先选择游戏地图");
    return;
  }
  emit("importRuntime", { gameMapId: gm.id, raw: jsonText.value });
}

function refreshFromEditor() {
  useManualEdit.value = false;
  syncFromProject();
}

async function runExportHealthCheck() {
  const result = runPipelineFromEditor();
  if (!result || !props.project || !selectedGameMap.value) {
    await appAlert("请先选择有效游戏地图");
    return;
  }
  const graph = props.project.graphs.find((g) => g.id === selectedGameMap.value!.graphId);
  if (!graph) {
    await appAlert("地图缺少剧情 graph");
    return;
  }
  const audit = auditGameMapExportReadiness(props.project, selectedGameMap.value, graph);
  const label = selectedGameMap.value.mapName || selectedGameMap.value.mapCode || "当前地图";
  pipelineReport.value = formatPipelineReport(result);
  pipelineOk.value = result.ok;
  await appAlert(formatGameMapExportAuditMessage(audit, label), audit.ok ? "导出自检通过" : "导出自检未通过");
}
</script>

<template>
  <section class="panel">
    <header class="head">
      <div>
        <h2>运行时 JSON</h2>
        <p class="sub">
          预览 merge 后的客户端 map；校验 battleRef / manifest
          <span v-if="selectedGameMap"> · {{ selectedGameMap.mapName || selectedGameMap.mapCode }}</span>
          <span v-if="mergeFromJson"> · 已加载 merge 文件</span>
        </p>
      </div>
      <button class="btn" type="button" @click="emit('close')">关闭</button>
    </header>

    <div class="toolbar">
      <button v-if="selectedGameMap" class="btn btn-soft" type="button" @click="refreshFromEditor">从编辑器刷新</button>
      <button class="btn btn-soft" type="button" @click="triggerMergeFile">加载 merge 壳</button>
      <button class="btn btn-soft" type="button" @click="triggerImport">导入文件</button>
      <button class="btn btn-soft" type="button" @click="runValidateOnly">校验</button>
      <button v-if="selectedGameMap" class="btn btn-soft" type="button" @click="runExportHealthCheck">导出自检</button>
      <button class="btn btn-accent" type="button" @click="exportProduction(false)">下载 JSON</button>
      <button v-if="selectedGameMap" class="btn btn-soft" type="button" @click="importIntoEditor">
        导入到当前地图
      </button>
      <input ref="fileInputEl" type="file" accept="application/json" style="display: none" @change="onFileChange" />
      <input
        ref="mergeFileInputEl"
        type="file"
        accept="application/json"
        style="display: none"
        @change="onMergeFileChange"
      />
    </div>

    <div class="grid">
      <div class="col">
        <label class="lbl">JSON 内容</label>
        <textarea
          v-model="jsonText"
          class="json-area"
          spellcheck="false"
          placeholder="粘贴 map_*.json…"
          @input="useManualEdit = true"
        />
      </div>
      <div class="col">
        <label class="lbl">
          校验报告
          <span v-if="pipelineOk !== null" class="badge" :class="{ ok: pipelineOk }">{{ issueSummary }}</span>
        </label>
        <pre class="report">{{ pipelineReport || "点击「从编辑器刷新」或「校验」" }}</pre>
        <div v-if="choiceEventSummary.length" class="choice-summary">
          <div class="choice-summary-title">选项推进摘要（镜像 Cocos StoryManager）</div>
          <ul class="choice-summary-list">
            <li v-for="row in choiceEventSummary" :key="`${row.npcUid}-${row.eventId}`">
              <span class="choice-npc">{{ row.npcUid }}</span>
              <span class="choice-ev">#{{ row.eventId }}</span>
              <ul>
                <li v-for="(line, idx) in row.options" :key="idx" :class="{ defer: line.startsWith('暂缓') }">
                  {{ line }}
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <div class="hint">
          本地测试：下载后覆盖<br />
          assets/resources/Sample/剧情脚本/map_*.json<br />
          StoryManager.mapConfig 指向同文件即可。
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px;
  box-sizing: border-box;
  background: #0f172a;
  color: #e2e8f0;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.head h2 {
  margin: 0;
  font-size: 18px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.lbl {
  font-size: 12px;
  margin-bottom: 6px;
  color: #cbd5e1;
}
.json-area {
  flex: 1;
  min-height: 280px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #020617;
  color: #e2e8f0;
  resize: none;
}
.report {
  flex: 1;
  min-height: 200px;
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #020617;
  font-size: 12px;
  white-space: pre-wrap;
  overflow: auto;
}
.choice-summary {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  font-size: 11px;
  max-height: 160px;
  overflow: auto;
}
.choice-summary-title {
  color: #94a3b8;
  margin-bottom: 6px;
}
.choice-summary-list {
  margin: 0;
  padding-left: 16px;
}
.choice-summary-list ul {
  margin: 2px 0 6px;
  padding-left: 14px;
}
.choice-npc {
  color: #7dd3fc;
  margin-right: 6px;
}
.choice-ev {
  color: #64748b;
}
.choice-summary-list li.defer {
  color: #fcd34d;
}
.hint {
  margin-top: 8px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}
.badge {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #7f1d1d;
  color: #fecaca;
  font-size: 11px;
}
.badge.ok {
  background: #14532d;
  color: #bbf7d0;
}
.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
}
.btn-soft {
  background: #0f172a;
}
.btn-accent {
  background: #1d4ed8;
  border-color: #2563eb;
}
</style>
