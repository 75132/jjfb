<script setup lang="ts">
import { computed, ref } from "vue";
import type { ProjectData } from "../../types";
import {
  formatGlobalCheckReport,
  runGlobalCheckRepairLoop,
  type GlobalCheckProgress,
  type GlobalCheckRepairReport,
  type GlobalCheckStepLog,
} from "../global-check-repair";

const props = defineProps<{
  open: boolean;
  project: ProjectData;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "done", report: GlobalCheckRepairReport): void;
  (e: "rebuild"): void;
  (e: "save"): void;
  (e: "navigate-npc", payload: { gameMapId: string; npcUid: string }): void;
}>();

const running = ref(false);
const aborted = ref(false);
const syncTimeline = ref(true);
const runRepair = ref(true);
/** ELK 布局较重，默认关闭，避免大项目卡死 */
const runLayout = ref(false);
const runExportValidate = ref(true);
const useAi = ref(false);

const progress = ref<GlobalCheckProgress | null>(null);
const stepLogs = ref<GlobalCheckStepLog[]>([]);
const report = ref<GlobalCheckRepairReport | null>(null);

const progressPct = computed(() => {
  if (!progress.value || progress.value.total <= 0) return 0;
  return Math.min(100, Math.round((progress.value.index / progress.value.total) * 100));
});

const summaryText = computed(() => (report.value ? formatGlobalCheckReport(report.value) : ""));

function requestAbort() {
  aborted.value = true;
}

async function startRun() {
  if (running.value) return;
  running.value = true;
  aborted.value = false;
  stepLogs.value = [];
  report.value = null;
  progress.value = { phase: "prepare", index: 0, total: 1, label: "启动…" };

  try {
    const result = await runGlobalCheckRepairLoop(props.project, {
      syncTimeline: syncTimeline.value,
      ensureZones: true,
      runRepair: runRepair.value,
      runLayout: runLayout.value,
      runExportValidate: runExportValidate.value,
      useAiForEmptyChains: useAi.value,
      yieldMs: 50,
      progressThrottleMs: 200,
      shouldAbort: () => aborted.value,
      onProgress: (p) => {
        progress.value = p;
      },
      onStep: (s) => {
        stepLogs.value = [...stepLogs.value, s].slice(-32);
      },
    });
    report.value = result;
    await new Promise<void>((r) => setTimeout(r, 0));
    emit("rebuild");
    emit("save");
    emit("done", result);
  } finally {
    running.value = false;
  }
}

function onClose() {
  if (running.value) {
    requestAbort();
    return;
  }
  emit("close");
}
</script>

<template>
  <div v-if="open" class="gcr-overlay" @click.self="onClose">
    <div class="gcr-modal" role="dialog" aria-labelledby="gcr-title">
      <header class="gcr-header">
        <h2 id="gcr-title">全局检查修复</h2>
        <p class="gcr-sub">检查本地图每条任务链的交互、对接与任务束顺序；确定性修复后可选用 AI 补缺失节点。</p>
        <button class="gcr-close" type="button" :disabled="running" @click="onClose">×</button>
      </header>

      <section class="gcr-options">
        <label class="gcr-check"><input v-model="syncTimeline" type="checkbox" :disabled="running" /> 同步时间线任务</label>
        <label class="gcr-check"><input v-model="runRepair" type="checkbox" :disabled="running" /> 检测并修复链（连线/appear/quest）</label>
        <label class="gcr-check" title="ELK 自动排版，节点多时会较慢">
          <input v-model="runLayout" type="checkbox" :disabled="running" /> 整理各区域布局（较慢，可选）
        </label>
        <label class="gcr-check"><input v-model="runExportValidate" type="checkbox" :disabled="running" /> 导出校验</label>
        <label class="gcr-check gcr-check-ai">
          <input v-model="useAi" type="checkbox" :disabled="running" />
          AI 补全缺失链（需 DeepSeek /api/ai）
        </label>
      </section>

      <section v-if="running || progress" class="gcr-progress">
        <div class="gcr-progress-bar">
          <div class="gcr-progress-fill" :style="{ width: `${progressPct}%` }" />
        </div>
        <div class="gcr-progress-label">
          {{ progress?.label ?? "…" }}
          <span v-if="progress && progress.total > 0" class="muted">({{ progress.index }}/{{ progress.total }})</span>
        </div>
      </section>

      <section v-if="stepLogs.length" class="gcr-log">
        <div
          v-for="(s, idx) in stepLogs.slice(-24)"
          :key="idx"
          class="gcr-log-line"
          :class="{ ok: s.ok, fail: !s.ok }"
        >
          <span class="gcr-log-phase">{{ s.phase }}</span>
          {{ s.label }}
          <span v-if="s.detail" class="muted"> — {{ s.detail }}</span>
        </div>
      </section>

      <section v-if="report?.appearWarnings?.length && !running" class="gcr-warn-box">
        <h3 class="gcr-warn-title">appear 预检</h3>
        <ul class="gcr-warn-list">
          <li v-for="(w, i) in report.appearWarnings.slice(0, 8)" :key="'aw-' + i">{{ w }}</li>
        </ul>
      </section>

      <section v-if="report?.exportErrors?.length && !running" class="gcr-warn-box gcr-export-errors">
        <h3 class="gcr-warn-title">导出校验错误</h3>
        <ul class="gcr-warn-list">
          <li v-for="(e, i) in report.exportErrors.slice(0, 5)" :key="'ex-' + i">
            <span>{{ e.gameMapName }}{{ e.npcUid ? ` / ${e.npcUid}` : "" }}：{{ e.message }}</span>
            <button
              v-if="e.npcUid"
              type="button"
              class="gcr-link-btn"
              @click="emit('navigate-npc', { gameMapId: e.gameMapId, npcUid: e.npcUid! })"
            >
              跳转 NPC
            </button>
          </li>
        </ul>
      </section>

      <pre v-if="report && !running" class="gcr-summary">{{ summaryText }}</pre>

      <footer class="gcr-footer">
        <button v-if="running" class="btn btn-soft" type="button" @click="requestAbort">取消</button>
        <button v-else class="btn btn-soft" type="button" @click="emit('close')">关闭</button>
        <button class="btn btn-primary" type="button" :disabled="running" @click="startRun">
          {{ running ? "修复中…" : report ? "重新检查" : "开始检查修复" }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.gcr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.gcr-modal {
  width: min(640px, 100%);
  max-height: min(90vh, 820px);
  background: var(--panel-bg, #1e1e24);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.gcr-header {
  position: relative;
  padding: 16px 48px 8px 16px;
  border-bottom: 1px solid var(--border, #333);
}
.gcr-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.gcr-sub {
  margin: 0;
  font-size: 12px;
  color: var(--muted, #999);
  line-height: 1.45;
}
.gcr-close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 22px;
  cursor: pointer;
  width: 32px;
  height: 32px;
}
.gcr-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #333);
}
.gcr-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}
.gcr-check-ai {
  flex-basis: 100%;
}
.gcr-progress {
  padding: 12px 16px 8px;
}
.gcr-progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}
.gcr-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  transition: width 0.2s ease;
}
.gcr-progress-label {
  margin-top: 6px;
  font-size: 12px;
}
.gcr-log {
  flex: 1;
  overflow: auto;
  padding: 8px 16px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  max-height: 200px;
  border-top: 1px solid var(--border, #333);
}
.gcr-log-line {
  padding: 2px 0;
  color: var(--muted, #aaa);
}
.gcr-log-line.ok {
  color: #86efac;
}
.gcr-log-line.fail {
  color: #fca5a5;
}
.gcr-log-phase {
  display: inline-block;
  min-width: 88px;
  opacity: 0.7;
}
.gcr-summary {
  margin: 0;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  border-top: 1px solid var(--border, #333);
  max-height: 180px;
  overflow: auto;
}
.gcr-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border, #333);
}
.muted {
  color: var(--muted, #888);
}
.gcr-warn-box {
  margin: 0 16px;
  padding: 10px 12px;
  border: 1px solid #854d0e;
  border-radius: 8px;
  background: rgba(234, 179, 8, 0.08);
  font-size: 12px;
}
.gcr-warn-title {
  margin: 0 0 6px;
  font-size: 13px;
  color: #fbbf24;
}
.gcr-warn-list {
  margin: 0;
  padding-left: 18px;
}
.gcr-export-errors li {
  margin-bottom: 4px;
}
.gcr-link-btn {
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border, #555);
  background: transparent;
  color: #93c5fd;
  cursor: pointer;
}
</style>
