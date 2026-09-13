<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { ProjectData } from "../../types";
import {
  getGameMapForTarget,
  isTargetReady,
  isTimelineTarget,
  resolveEffectiveTarget,
  targetLabel,
  type AiEditMode,
  type AiTarget,
  type NavContext,
} from "../ai/ai-target";
import { streamStoryAi } from "../ai/deepseek-client";
import {
  canStartGenerate,
  nextPhaseAfterDiscuss,
  type ConsultPhase,
} from "../ai/consult-flow";
import { stripStructuredJsonBlocks } from "../ai/story-stream-parser";
import StoryBlueprintForm from "./StoryBlueprintForm.vue";
import { synthesizeBriefFromBlueprint, type StoryBlueprint } from "../ai/story-blueprint";
import type { ChatMessage, RequirementsBrief } from "../ai/types";
import { buildStoryAiContext, getGraphForTarget } from "../ai/story-context-builder";
import { NdjsonLineParser } from "../ai/story-stream-parser";
import { syncTaskChainsFromBrief } from "../ai/ai-task-chain-sync";
import { repairMapChains, detectMapChainIssues } from "../map-chain-repair";
import { ensureNpcZonesAndEntries } from "../game-map-logic";
import {
  auditGameMapExportReadiness,
  formatGameMapExportAuditMessage,
} from "../map-export-pipeline";
import { appAlert } from "../useModal";
import {
  applyStreamOp,
  createApplierContext,
  flushPendingConnects,
} from "../ai/story-stream-applier";
import { fetchStorageHealth } from "../persistence";
import type { AiPendingCommand } from "../editorInjection";
import { collectPatchNodeSummaries } from "../ai/ai-patch-context";
import {
  buildBriefForCommand,
  commandKindLabel,
  routeAiCommand,
  shouldAutoExecuteCommand,
  suggestQuickCommands,
  type AiCommandKind,
} from "../ai/ai-command-router";

const props = defineProps<{
  project: ProjectData;
  navContext: NavContext;
  selectedNodeIds: string[];
  pendingCommand?: AiPendingCommand | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "rebuild"): void;
  (e: "save"): void;
  (e: "pauseHistory"): void;
  (e: "resumeHistory"): void;
  (e: "suspendAutosave"): void;
  (e: "resumeAutosave"): void;
  (e: "exportAudit", payload: { gameMapId: string; ok: boolean; errors: string[]; warnings: string[] }): void;
  (e: "focusNode", nodeId: string): void;
  (e: "navigateToTarget", target: AiTarget): void;
}>();

const editMode = ref<AiEditMode>("append");
const messages = ref<ChatMessage[]>([]);
const commandText = ref("");
const phase = ref<ConsultPhase>("idle");
const brief = ref<RequirementsBrief | null>(null);
const streaming = ref(false);
const streamBuffer = ref("");
const errorMsg = ref("");
const appliedOps = ref(0);
const applyWarnings = ref<string[]>([]);
const abortCtrl = ref<AbortController | null>(null);
const chatScrollEl = ref<HTMLElement | null>(null);
const ndjsonParser = new NdjsonLineParser();
const showBlueprint = ref(false);
const showChat = ref(true);
const timelineGoal = ref("");
const lastCommandKind = ref<AiCommandKind | null>(null);

const effectiveTarget = computed(() => {
  const base = resolveEffectiveTarget("followNav", { scope: "timeline" }, props.navContext);
  if (base.scope === "map") {
    return { ...base, editMode: editMode.value };
  }
  return base;
});

const isTimeline = computed(() => isTimelineTarget(effectiveTarget.value));
const gameMap = computed(() => getGameMapForTarget(props.project, effectiveTarget.value));
const targetReady = computed(() => isTargetReady(effectiveTarget.value));

const aiContext = computed(() =>
  buildStoryAiContext(props.project, {
    target: effectiveTarget.value,
    selectedNodeIds: props.selectedNodeIds,
  }),
);

const mode = computed(() => (isTimeline.value ? "timeline_outline" : "map_npc_chain") as const);

const patchNodes = computed(() =>
  collectPatchNodeSummaries(props.project, effectiveTarget.value, {
    selectedNodeIds: props.selectedNodeIds,
    npcSummaries: aiContext.value.npcs,
  }),
);

const hasExistingChain = computed(() => {
  if (effectiveTarget.value.scope !== "map") return false;
  return (aiContext.value.npcs ?? []).some((n) => !n.isEmptyChain);
});

const hasSelectedNodes = computed(() => props.selectedNodeIds.length > 0);

const selectedNodeHint = computed(() => {
  if (!hasSelectedNodes.value) return "";
  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  if (!graph) return `${props.selectedNodeIds.length} 个节点`;
  const titles = props.selectedNodeIds
    .map((id) => graph.nodes.find((n) => n.id === id)?.title ?? id.slice(0, 8))
    .slice(0, 3);
  return titles.join("、");
});

const quickCommands = computed(() =>
  suggestQuickCommands({
    hasSelectedNodes: hasSelectedNodes.value,
    hasExistingChain: hasExistingChain.value,
    selectedTitle: selectedNodeHint.value.split("、")[0],
  }),
);

const aiConfigured = ref<boolean | null>(null);

const statusText = computed(() => {
  if (streaming.value && phase.value === "generating") {
    const label = lastCommandKind.value ? commandKindLabel(lastCommandKind.value) : "处理";
    return `${label}中… 已应用 ${appliedOps.value} 个操作`;
  }
  if (phase.value === "done" && lastCommandKind.value) {
    return `${commandKindLabel(lastCommandKind.value)}完成`;
  }
  return "";
});

watch(
  () => [hasExistingChain.value] as const,
  () => {
    if (!streaming.value) editMode.value = hasExistingChain.value ? "patch" : "append";
  },
  { immediate: true },
);

watch(
  () => props.pendingCommand?.id,
  (id) => {
    const text = props.pendingCommand?.text?.trim();
    if (!id || !text) return;
    commandText.value = text;
    void executeCommand(text);
  },
);

onMounted(async () => {
  try {
    const health = await fetchStorageHealth();
    aiConfigured.value = health?.aiConfigured ?? false;
    if (health && !health.aiConfigured) {
      errorMsg.value = "未配置 DEEPSEEK_API_KEY。在 Juben/.env 填入密钥后重启 npm run dev。";
    }
  } catch {
    aiConfigured.value = false;
    errorMsg.value = "无法连接 storage 服务，请先运行 npm run dev。";
  }
});

async function scrollChatBottom() {
  await nextTick();
  const el = chatScrollEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function stopStream() {
  abortCtrl.value?.abort();
  abortCtrl.value = null;
  streaming.value = false;
  if (phase.value === "generating") {
    phase.value = brief.value ? "briefReady" : "idle";
    emit("resumeHistory");
    emit("resumeAutosave");
  }
}

function setBriefFromBlueprint(blueprint: StoryBlueprint) {
  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;
  const synthesized = synthesizeBriefFromBlueprint(blueprint, {
    npcUid: focusNpc,
    mapCode: gameMap.value?.mapCode,
    editMode: hasExistingChain.value ? "append" : "append",
  });
  if (!synthesized) {
    errorMsg.value = "请填写剧情目标";
    return null;
  }
  brief.value = synthesized;
  errorMsg.value = "";
  return synthesized;
}

async function onBlueprintGenerate(blueprint: StoryBlueprint) {
  const synthesized = setBriefFromBlueprint(blueprint);
  if (!synthesized) return;
  lastCommandKind.value = "blueprint";
  phase.value = "briefReady";
  await startGenerate({ skipAudit: false });
}

async function executeCommand(rawText?: string, options?: { skipChatLog?: boolean }) {
  const text = (rawText ?? commandText.value).trim();
  if (!text || streaming.value || !targetReady.value) return;

  const kind = routeAiCommand({
    text,
    isTimeline: isTimeline.value,
    hasExistingChain: hasExistingChain.value,
    hasSelectedNodes: hasSelectedNodes.value,
  });
  lastCommandKind.value = kind;

  if (kind === "chat") {
    if (!options?.skipChatLog) {
      messages.value.push({ role: "user", content: text });
      commandText.value = "";
    }
    await sendDiscuss(text);
    return;
  }

  if (!shouldAutoExecuteCommand(kind)) return;

  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  const issues =
    gameMap.value && graph ? detectMapChainIssues(props.project, graph, gameMap.value) : [];

  const synthesized = buildBriefForCommand({
    text,
    kind,
    focusNpcUid: effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined,
    selectedNodeIds: props.selectedNodeIds,
    patchNodes: patchNodes.value,
    chainIssues: issues,
    mapCode: gameMap.value?.mapCode,
    editMode: kind === "patch" ? "patch" : "append",
  });

  if (!synthesized) {
    errorMsg.value = "无法理解该指令";
    return;
  }

  editMode.value = synthesized.editMode ?? "patch";
  brief.value = synthesized;
  errorMsg.value = "";
  phase.value = "briefReady";

  if (!options?.skipChatLog) {
    messages.value.push({ role: "user", content: text });
    commandText.value = "";
    showChat.value = true;
  }

  await startGenerate({ skipAudit: kind === "patch" || kind === "repair" });
}

async function sendDiscuss(userText: string) {
  if (streaming.value || !targetReady.value) return;
  errorMsg.value = "";
  showChat.value = true;
  await scrollChatBottom();

  streaming.value = true;
  streamBuffer.value = "";
  let assistantContent = "";
  abortCtrl.value = new AbortController();

  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;

  await streamStoryAi(
    {
      phase: "discuss",
      mode: mode.value,
      messages: messages.value,
      context: aiContext.value,
      focusNpcUid: focusNpc,
      signal: abortCtrl.value.signal,
    },
    {
      onChunk: (t) => {
        assistantContent += t;
        streamBuffer.value = assistantContent;
        void scrollChatBottom();
      },
      onDone: () => {
        streaming.value = false;
        abortCtrl.value = null;
        streamBuffer.value = "";
        const displayContent = stripStructuredJsonBlocks(assistantContent) || assistantContent;
        messages.value.push({ role: "assistant", content: displayContent });
        phase.value = nextPhaseAfterDiscuss(assistantContent, "discuss");
        void scrollChatBottom();
      },
      onError: (msg) => {
        streaming.value = false;
        abortCtrl.value = null;
        errorMsg.value = msg;
      },
    },
  );
}

async function finalizeAfterGenerate(
  briefOut: RequirementsBrief,
  applierCtx: ReturnType<typeof createApplierContext>,
) {
  const gm = gameMap.value;
  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  if (gm && graph && graph.kind === "map") {
    flushPendingConnects(applierCtx);
    syncTaskChainsFromBrief(props.project, gm, briefOut);
    ensureNpcZonesAndEntries(props.project, gm);
    const repairResult = repairMapChains(props.project, graph, gm);
    if (repairResult.warnings.length) applyWarnings.value.push(...repairResult.warnings);
    // 剧情工作台已去掉无线画布：不再对每条链跑 ELK 布局（导出不依赖节点画布坐标）
    ensureNpcZonesAndEntries(props.project, gm);
  }
  pendingFocusNodeId = null;
  emit("rebuild");
  emit("save");
}

async function runPostGenerateExportAudit() {
  const gm = gameMap.value;
  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  if (!gm || !graph || graph.kind !== "map") return null;
  const audit = auditGameMapExportReadiness(props.project, gm, graph);
  emit("exportAudit", { gameMapId: gm.id, ok: audit.ok, errors: audit.errors, warnings: audit.warnings });
  const label = gm.mapName || gm.mapCode || "当前地图";
  await appAlert(formatGameMapExportAuditMessage(audit, label), audit.ok ? "导出自检通过" : "导出自检未通过");
  return audit;
}

async function startGenerate(options?: { skipAudit?: boolean }) {
  if (!canStartGenerate(brief.value) || streaming.value || !targetReady.value) return;
  errorMsg.value = "";
  phase.value = "generating";
  appliedOps.value = 0;
  applyWarnings.value = [];
  ndjsonParser.reset();
  emit("pauseHistory");
  emit("suspendAutosave");

  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  if (!graph) {
    errorMsg.value = "找不到目标画布";
    phase.value = "briefReady";
    emit("resumeHistory");
    emit("resumeAutosave");
    return;
  }

  const briefOut: RequirementsBrief = {
    ...(brief.value ?? { type: "requirementsBrief", beats: [], constraints: [] }),
    editMode: editMode.value,
    targetNodeIds: props.selectedNodeIds.length ? props.selectedNodeIds : brief.value?.targetNodeIds,
  };

  const applierCtx = createApplierContext(props.project, graph, gameMap.value);
  if (gameMap.value && graph.kind === "map") {
    syncTaskChainsFromBrief(props.project, gameMap.value, briefOut);
    applierCtx.gameMap = gameMap.value;
  }

  streaming.value = true;
  abortCtrl.value = new AbortController();

  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;

  await streamStoryAi(
    {
      phase: "generate",
      mode: mode.value,
      messages: messages.value,
      context: aiContext.value,
      requirementsBrief: briefOut,
      focusNpcUid: focusNpc ?? briefOut.npcUid,
      signal: abortCtrl.value.signal,
    },
    {
      onChunk: (t) => {
        const { ops, warnings } = ndjsonParser.push(t);
        if (warnings.length) applyWarnings.value.push(...warnings);
        applyOps(ops, applierCtx);
      },
      onDone: () => {
        const { ops, warnings } = ndjsonParser.flush();
        if (warnings.length) applyWarnings.value.push(...warnings);
        applyOps(ops, applierCtx);
        void finalizeAfterGenerate(briefOut, applierCtx).then(async () => {
          streaming.value = false;
          abortCtrl.value = null;
          phase.value = "done";
          emit("resumeHistory");
          emit("resumeAutosave");
          let auditNote = "";
          if (!options?.skipAudit) {
            const audit = await runPostGenerateExportAudit();
            auditNote = audit ? (audit.ok ? " · 导出自检通过" : " · 导出自检有问题") : "";
          }
          const warnNote = applyWarnings.value.length ? `（${applyWarnings.value.length} 条警告）` : "";
          messages.value.push({
            role: "assistant",
            content: `已应用 ${appliedOps.value} 个操作${warnNote}${auditNote}。`,
          });
          showChat.value = true;
          void scrollChatBottom();
        });
      },
      onError: (msg) => {
        streaming.value = false;
        abortCtrl.value = null;
        errorMsg.value = msg;
        phase.value = "briefReady";
        emit("resumeHistory");
        emit("resumeAutosave");
      },
    },
  );
}

/** 流式期间只写数据；不每 op 重建画布 / fitView。chunk 末或 finalize 再 rebuild 一次。 */
let pendingFocusNodeId: string | null = null;
let rebuildScheduled = false;

function scheduleStreamRebuild() {
  if (rebuildScheduled) return;
  rebuildScheduled = true;
  requestAnimationFrame(() => {
    rebuildScheduled = false;
    if (pendingFocusNodeId) {
      emit("focusNode", pendingFocusNodeId);
      pendingFocusNodeId = null;
    } else {
      emit("rebuild");
    }
  });
}

function applyOps(ops: import("../ai/types").StreamOp[], applierCtx: ReturnType<typeof createApplierContext>) {
  for (const op of ops) {
    const result = applyStreamOp(applierCtx, op);
    appliedOps.value += result.applied;
    if (result.warnings.length) applyWarnings.value.push(...result.warnings);
    if (result.lastNodeId) pendingFocusNodeId = result.lastNodeId;
  }
  if (ops.length) scheduleStreamRebuild();
}

function onCommandKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void executeCommand();
  }
}

function applyQuickCommand(text: string) {
  commandText.value = text;
  void executeCommand(text);
}

async function onTimelineGenerate() {
  timelineGoal.value = commandText.value.trim() || timelineGoal.value;
  const text = timelineGoal.value.trim();
  if (!text) {
    errorMsg.value = "请填写章节大纲";
    return;
  }
  commandText.value = text;
  await executeCommand(text);
}
</script>

<template>
  <div class="ai-panel">
    <header class="panel-header">
      <div class="target-line">{{ targetLabel(project, effectiveTarget) }}</div>
      <p v-if="hasSelectedNodes" class="ctx-hint">已选中：{{ selectedNodeHint }}</p>
      <p v-if="!targetReady" class="warn">请先在左侧进入目标地图</p>
      <p v-else-if="statusText" class="status">{{ statusText }}</p>
    </header>

    <div class="ai-body">
      <!-- 大白话指令（主入口） -->
      <section class="command-section">
        <label class="section-label">大白话指令</label>
        <textarea
          v-model="commandText"
          class="command-input"
          rows="3"
          :placeholder="
            isTimeline
              ? '例如：新手村 → 前哨战 → 主城（回车执行）'
              : '例如：用 RPG 对白重写第2幕 / 把接取改成嘴硬试探 / 选项改成态度分流'
          "
          :disabled="streaming || !targetReady"
          @keydown="onCommandKeydown"
        />
        <div class="command-actions">
          <button
            class="btn primary"
            type="button"
            :disabled="streaming || !targetReady || !commandText.trim()"
            @click="executeCommand()"
          >
            执行
          </button>
          <button v-if="streaming" class="btn" type="button" @click="stopStream">停止</button>
        </div>
        <div v-if="quickCommands.length" class="chips">
          <button
            v-for="chip in quickCommands"
            :key="chip"
            type="button"
            class="chip"
            :disabled="streaming || !targetReady"
            @click="applyQuickCommand(chip)"
          >
            {{ chip }}
          </button>
        </div>
        <p class="hint muted">局部修改会自动应用，无需再点「生成剧情」。选中节点后指令只改选中部分。</p>
      </section>

      <!-- 对话记录 -->
      <section v-if="showChat && messages.length" class="chat-section">
        <div ref="chatScrollEl" class="chat-thread">
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div class="msg-role">{{ m.role === "user" ? "你" : "助手" }}</div>
            <div class="msg-text">{{ m.content }}</div>
          </div>
          <div v-if="streaming && streamBuffer" class="msg assistant streaming">
            <div class="msg-role">助手</div>
            <div class="msg-text">{{ stripStructuredJsonBlocks(streamBuffer) || streamBuffer }}▌</div>
          </div>
        </div>
      </section>

      <!-- 蓝图（折叠，用于新建整条） -->
      <section v-if="!isTimeline" class="blueprint-section">
        <button type="button" class="collapse-toggle" @click="showBlueprint = !showBlueprint">
          {{ showBlueprint ? "▾" : "▸" }} 新建整条剧情（蓝图）
        </button>
        <StoryBlueprintForm
          v-if="showBlueprint"
          :focus-npc-uid="effectiveTarget.scope === 'map' ? effectiveTarget.npcUid : undefined"
          :disabled="streaming || !targetReady"
          @generate="onBlueprintGenerate"
        />
      </section>

      <section v-else-if="isTimeline" class="timeline-hint muted">
        时间线模式：在上方输入章节顺序后回车或点执行。
      </section>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <p v-if="aiConfigured === false && !errorMsg" class="muted footer-hint">AI 未配置时无法执行，手动编辑仍可用。</p>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: #e2e8f0;
  font-size: 12px;
}
.panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(2, 6, 23, 0.35);
  flex-shrink: 0;
}
.target-line {
  font-size: 12px;
  color: #93c5fd;
  font-weight: 500;
}
.ctx-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #a5b4fc;
}
.status {
  margin: 4px 0 0;
  font-size: 11px;
  color: #94a3b8;
}
.warn {
  margin: 4px 0 0;
  font-size: 11px;
  color: #fbbf24;
}
.ai-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
  gap: 10px;
}
.section-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}
.command-section {
  flex-shrink: 0;
}
.command-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.45);
  background: #1e293b;
  color: #f1f5f9;
  font-size: 12px;
  resize: vertical;
  line-height: 1.45;
}
.command-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.chip {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.6);
  color: #cbd5e1;
  cursor: pointer;
}
.chip:hover:not(:disabled) {
  border-color: #818cf8;
  color: #e2e8f0;
}
.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hint {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.4;
}
.chat-section {
  flex-shrink: 0;
}
.chat-thread {
  max-height: 140px;
  overflow: auto;
  padding: 6px;
  background: rgba(2, 6, 23, 0.35);
  border-radius: 8px;
}
.msg {
  margin-bottom: 8px;
}
.msg.user .msg-text {
  background: rgba(59, 130, 246, 0.15);
}
.msg.assistant .msg-text {
  background: rgba(148, 163, 184, 0.08);
}
.msg-role {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 2px;
}
.msg-text {
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.4;
  padding: 6px 8px;
  border-radius: 6px;
}
.blueprint-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 8px;
}
.collapse-toggle {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  padding: 0 0 8px;
}
.collapse-toggle:hover {
  color: #e2e8f0;
}
.timeline-hint {
  font-size: 11px;
}
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.3);
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.primary {
  background: rgba(99, 102, 241, 0.35);
  border-color: rgba(99, 102, 241, 0.6);
  font-weight: 600;
}
.muted {
  color: #64748b;
}
.footer-hint {
  margin: 0;
  font-size: 10px;
}
.error {
  color: #f87171;
  margin: 0;
}
</style>
