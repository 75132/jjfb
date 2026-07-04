<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { ProjectData } from "../../types";
import {
  defaultManualTarget,
  flattenGameMapOptions,
  getGameMapForTarget,
  isTargetReady,
  isTimelineTarget,
  resolveEffectiveTarget,
  targetLabel,
  targetsEqual,
  type AiEditMode,
  type AiTarget,
  type AiTargetSource,
  type NavContext,
} from "../ai/ai-target";
import { streamStoryAi } from "../ai/deepseek-client";
import {
  canStartGenerate,
  getInitialAssistantTrigger,
  nextPhaseAfterDiscuss,
  parseBriefFromAssistantMessage,
  type ConsultPhase,
} from "../ai/consult-flow";
import {
  applyPlanSelection,
  buildUserMessageForPlanSelection,
  parseAssistantPlanOrBrief,
  synthesizeBriefFromPlanAnswers,
  type PlanAnswerValue,
  type PlanAnswers,
} from "../ai/plan-flow";
import { mapPlanLabelToAnswer } from "../ai/battle-plan-steps";
import { stripStructuredJsonBlocks } from "../ai/story-stream-parser";
import PlanStepCard from "./PlanStepCard.vue";
import StoryBlueprintForm from "./StoryBlueprintForm.vue";
import { synthesizeBriefFromBlueprint, type StoryBlueprint } from "../ai/story-blueprint";
import type { ChatMessage, ExistingNodeSummary, PlanStepPayload, RequirementsBrief } from "../ai/types";
import { buildStoryAiContext, getGraphForTarget } from "../ai/story-context-builder";
import { NdjsonLineParser } from "../ai/story-stream-parser";
import { syncTaskChainsFromBrief } from "../ai/ai-task-chain-sync";
import { repairMapChains } from "../map-chain-repair";
import { ensureNpcZonesAndEntries } from "../game-map-logic";
import { layoutZoneNodes } from "../graph-auto-layout";
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
import { buildRepairBriefFromIssues } from "../ai/ai-repair-brief";
import { detectMapChainIssues } from "../map-chain-repair";

const props = defineProps<{
  project: ProjectData;
  navContext: NavContext;
  selectedNodeIds: string[];
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

const targetSource = ref<AiTargetSource>("followNav");
const manualTarget = ref<AiTarget>(defaultManualTarget(props.project, props.navContext));
const editMode = ref<AiEditMode>("append");
const repairChainMode = ref(false);
const discussStarted = ref(false);
const messages = ref<ChatMessage[]>([]);
const inputText = ref("");
const phase = ref<ConsultPhase>("discuss");
const brief = ref<RequirementsBrief | null>(null);
const streaming = ref(false);
const streamBuffer = ref("");
const errorMsg = ref("");
const appliedOps = ref(0);
const appliedNodes = ref(0);
const applyWarnings = ref<string[]>([]);
const lastNodeKind = ref("");
const abortCtrl = ref<AbortController | null>(null);
const chatScrollEl = ref<HTMLElement | null>(null);
const ndjsonParser = new NdjsonLineParser();
const showChainPreview = ref(true);
const planAnswers = ref<PlanAnswers>({});
const planSelections = ref<Record<string, PlanAnswerValue>>({});
const activePlanStep = ref<PlanStepPayload | null>(null);

const effectiveTarget = computed(() => {
  const base = resolveEffectiveTarget(targetSource.value, manualTarget.value, props.navContext);
  if (base.scope === "map") {
    return { ...base, editMode: editMode.value };
  }
  return base;
});

const isTimeline = computed(() => isTimelineTarget(effectiveTarget.value));
const gameMap = computed(() => getGameMapForTarget(props.project, effectiveTarget.value));
const mapOptions = computed(() => flattenGameMapOptions(props.project));
const npcOptions = computed(() => gameMap.value?.npcs ?? []);

const aiContext = computed(() =>
  buildStoryAiContext(props.project, {
    target: effectiveTarget.value,
    selectedNodeIds: props.selectedNodeIds,
  }),
);

const mode = computed(() => (isTimeline.value ? "timeline_outline" : "map_npc_chain") as const);

const canGenerate = computed(() => canStartGenerate(brief.value) && !streaming.value && isTargetReady(effectiveTarget.value));

const targetReady = computed(() => isTargetReady(effectiveTarget.value));

const quickChips = [
  "要战斗",
  "只要对话",
  "追加不重写",
  "只改对白",
  "删除中间节点",
  "在选中节点后插入",
  "需要接任务",
  "拒绝选项 block",
];

const existingNodesForNpc = computed((): ExistingNodeSummary[] => {
  if (effectiveTarget.value.scope !== "map" || !effectiveTarget.value.npcUid) return [];
  const npc = aiContext.value.npcs?.find((n) => n.npcUid === effectiveTarget.value.npcUid);
  return npc?.existingNodes ?? [];
});

const selectedNodeHint = computed(() => {
  if (!props.selectedNodeIds.length) return null;
  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  if (!graph) return null;
  const titles = props.selectedNodeIds
    .map((id) => graph.nodes.find((n) => n.id === id)?.title ?? id)
    .slice(0, 3);
  return titles.join("、");
});

watch(
  () => props.navContext,
  () => {
    if (targetSource.value === "followNav") syncManualFromNav();
  },
  { deep: true },
);

function syncManualFromNav() {
  manualTarget.value = defaultManualTarget(props.project, props.navContext);
}

function onScopeChange(scope: "timeline" | "map") {
  if (scope === "timeline") {
    applyTargetChange({ scope: "timeline" });
    return;
  }
  const first = mapOptions.value[0];
  applyTargetChange({
    scope: "map",
    gameMapId: manualTarget.value.scope === "map" ? manualTarget.value.gameMapId : (first?.id ?? ""),
    npcUid: undefined,
    editMode: editMode.value,
  });
}

function onMapChange(gameMapId: string) {
  if (manualTarget.value.scope !== "map") return;
  applyTargetChange({ ...manualTarget.value, gameMapId, npcUid: undefined });
}

function onNpcChange(npcUid: string | null) {
  if (manualTarget.value.scope !== "map") return;
  applyTargetChange({ ...manualTarget.value, npcUid: npcUid ?? undefined });
}

function applyTargetChange(next: AiTarget) {
  if (messages.value.length > 0 && !targetsEqual(effectiveTarget.value, next)) {
    if (!window.confirm("切换目标将清空当前讨论，是否继续？")) return;
    resetConversation();
  }
  targetSource.value = "manual";
  manualTarget.value = next;
}

function resetConversation() {
  messages.value = [];
  brief.value = null;
  phase.value = "discuss";
  discussStarted.value = false;
  errorMsg.value = "";
  planAnswers.value = {};
  planSelections.value = {};
  activePlanStep.value = null;
}

function onBlueprintConfirm(blueprint: StoryBlueprint) {
  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;
  const synthesized = synthesizeBriefFromBlueprint(blueprint, {
    npcUid: focusNpc,
    mapCode: gameMap.value?.mapCode,
    editMode: editMode.value,
  });
  if (!synthesized) {
    errorMsg.value = "请填写剧情目标";
    return;
  }
  brief.value = synthesized;
  phase.value = "briefReady";
  activePlanStep.value = null;
  errorMsg.value = "";
}

function tryFinalizePlanBrief() {
  const synthesized = synthesizeBriefFromPlanAnswers(planAnswers.value, brief.value);
  if (synthesized) {
    brief.value = { ...synthesized, editMode: editMode.value };
    phase.value = "briefReady";
    activePlanStep.value = null;
    return true;
  }
  return false;
}

function normalizePlanSubmitValue(step: PlanStepPayload, value: PlanAnswerValue): PlanAnswerValue {
  if (step.stepId === "battle.acceptLabel" && typeof value === "string") {
    return mapPlanLabelToAnswer(step.stepId, value) as string;
  }
  if (step.stepId === "battle.deferLabel" && typeof value === "string") {
    return mapPlanLabelToAnswer(step.stepId, value) as string;
  }
  return value;
}

function onPlanSubmit(step: PlanStepPayload, rawValue: PlanAnswerValue) {
  const value = normalizePlanSubmitValue(step, rawValue);
  planAnswers.value = applyPlanSelection(planAnswers.value, step, value);
  planSelections.value = { ...planSelections.value, [step.stepId]: value };

  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;
  if (step.stepId === "battle.acceptLabel" && typeof value === "string") {
    planAnswers.value["battle.acceptLabel"] = value;
  }
  if (step.stepId === "battle.deferLabel" && typeof value === "string") {
    planAnswers.value["battle.deferLabel"] = value;
  }

  const lastIdx = messages.value.length - 1;
  if (lastIdx >= 0 && messages.value[lastIdx]?.role === "assistant") {
    messages.value[lastIdx] = {
      ...messages.value[lastIdx]!,
      planSelectionSummary: formatPlanSelectionSummary(step, value),
    };
  }

  if (tryFinalizePlanBrief()) return;

  void sendDiscuss(buildUserMessageForPlanSelection(step, value));
}

function formatPlanSelectionSummary(step: PlanStepPayload, value: PlanAnswerValue): string {
  if (typeof value === "number") return `${step.title}：${value}`;
  return `${step.title}：${String(value)}`;
}

function assistantDisplayText(msg: ChatMessage): string {
  if (msg.planStep) return msg.planStep.prompt ?? msg.planStep.title;
  if (msg.planSelectionSummary) return msg.planSelectionSummary;
  return stripStructuredJsonBlocks(msg.content) || msg.content;
}

function isPlanStepAnswered(stepId: string): boolean {
  return planSelections.value[stepId] !== undefined;
}

function setTargetSource(source: AiTargetSource) {
  if (source === targetSource.value) return;
  if (messages.value.length > 0) {
    if (!window.confirm("切换来源将清空当前讨论，是否继续？")) return;
    resetConversation();
  }
  targetSource.value = source;
  if (source === "followNav") syncManualFromNav();
}

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
    phase.value = brief.value ? "briefReady" : "discuss";
    emit("resumeHistory");
    emit("resumeAutosave");
  }
}

async function sendDiscuss(userText: string) {
  if (streaming.value || !targetReady.value) return;
  errorMsg.value = "";
  const userMsg: ChatMessage = { role: "user", content: userText };
  messages.value.push(userMsg);
  inputText.value = "";
  discussStarted.value = true;
  await scrollChatBottom();

  streaming.value = true;
  streamBuffer.value = "";
  let assistantContent = "";
  abortCtrl.value = new AbortController();

  const focusNpc =
    effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;

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
        const { planStep, brief: parsedBrief } = parseAssistantPlanOrBrief(assistantContent);
        const displayContent = stripStructuredJsonBlocks(assistantContent) || assistantContent;
        if (planStep) {
          activePlanStep.value = planStep;
          messages.value.push({
            role: "assistant",
            content: displayContent,
            planStep,
          });
          phase.value = "plan";
        } else {
          messages.value.push({ role: "assistant", content: displayContent });
          if (parsedBrief) {
            brief.value = { ...parsedBrief, editMode: editMode.value };
          } else {
            const synthesized = synthesizeBriefFromPlanAnswers(planAnswers.value, parsedBrief);
            if (synthesized) {
              brief.value = { ...synthesized, editMode: editMode.value };
            }
          }
          phase.value = nextPhaseAfterDiscuss(assistantContent, phase.value, planAnswers.value);
        }
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

function startDiscuss() {
  if (!targetReady.value) {
    errorMsg.value = isTimeline.value ? "" : "请先选择目标地图";
    return;
  }
  const npcUid = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : null;
  let trigger = getInitialAssistantTrigger(isTimeline.value, npcUid);
  if (brief.value) {
    const beatLines = (brief.value.beats ?? []).map((b, i) => `${i + 1}. [${b.kind}] ${b.summary}`).join("\n");
    trigger += `\n\n【已确认蓝图】\n目标：${brief.value.storyGoal}\n节点：\n${beatLines}`;
    if (brief.value.constraints?.length) {
      trigger += `\n约束：${brief.value.constraints.join("; ")}`;
    }
  }
  void sendDiscuss(trigger);
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
    if (repairResult.addedNodes > 0) appliedNodes.value += repairResult.addedNodes;
    for (const npc of gm.npcs) {
      if (npc.zoneId) await layoutZoneNodes(graph, npc.zoneId);
    }
    ensureNpcZonesAndEntries(props.project, gm);
  }
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

function buildRepairChainBrief(): RequirementsBrief {
  const gm = gameMap.value;
  const graph = getGraphForTarget(props.project, effectiveTarget.value);
  const issues = gm && graph ? detectMapChainIssues(props.project, graph, gm) : [];
  const focusNpc = effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined;
  return buildRepairBriefFromIssues(issues, {
    focusNpcUid: focusNpc,
    fallbackTargetNodeIds: props.selectedNodeIds,
    storyGoal: "修复当前任务链：补全缺失连线与剧情节点",
  });
}

async function startRepairChainGenerate() {
  if (!targetReady.value || streaming.value) return;
  repairChainMode.value = true;
  editMode.value = "patch";
  brief.value = buildRepairChainBrief();
  phase.value = "briefReady";
  await startGenerate();
  repairChainMode.value = false;
}

async function startGenerate() {
  if (!canGenerate.value) return;
  errorMsg.value = "";
  phase.value = "generating";
  appliedOps.value = 0;
  appliedNodes.value = 0;
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
        const nodeCount =
          graph.kind === "map"
            ? graph.nodes.filter((n) => n.kind !== "npcEntry" && n.kind !== "npcExit" && n.kind !== "mapPortal")
                .length
            : graph.nodes.length;
        void finalizeAfterGenerate(briefOut, applierCtx).then(async () => {
          streaming.value = false;
          abortCtrl.value = null;
          phase.value = "done";
          emit("resumeHistory");
          emit("resumeAutosave");
          const audit = await runPostGenerateExportAudit();
          const warnNote =
            applyWarnings.value.length > 0 ? `（${applyWarnings.value.length} 条解析/连线警告）` : "";
          const auditNote = audit
            ? audit.ok
              ? " · 导出自检通过"
              : ` · 导出自检 ${audit.errors.length} 项未通过（已弹窗说明）`
            : "";
          messages.value.push({
            role: "assistant",
            content: `已在画布应用 ${appliedOps.value} 个操作，当前地图共 ${nodeCount} 个剧情节点${warnNote}${auditNote}。若节点仍不完整，请检查 AI 输出是否为每行一条 NDJSON。`,
          });
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

function applyOps(ops: import("../ai/types").StreamOp[], applierCtx: ReturnType<typeof createApplierContext>) {
  for (const op of ops) {
    const before = applierCtx.graph.nodes.length;
    const result = applyStreamOp(applierCtx, op);
    appliedOps.value += result.applied;
    if (result.applied > 0 && op.op === "addNode") appliedNodes.value += 1;
    if (result.warnings.length) applyWarnings.value.push(...result.warnings);
    if (applierCtx.graph.nodes.length > before && op.op !== "addNode") appliedNodes.value += 1;
    if (result.lastNodeKind) lastNodeKind.value = result.lastNodeKind;
    if (result.lastNodeId) emit("focusNode", result.lastNodeId);
    emit("rebuild");
  }
}

function onSend() {
  const t = inputText.value.trim();
  if (!t) return;
  if (!discussStarted.value) {
    discussStarted.value = true;
  }
  void sendDiscuss(t);
}

function onChip(chip: string) {
  inputText.value = chip;
}

function skipToGenerate() {
  if (!brief.value) {
    brief.value = {
      type: "requirementsBrief",
      storyGoal: inputText.value.trim() || "按用户描述生成",
      npcUid: effectiveTarget.value.scope === "map" ? effectiveTarget.value.npcUid : undefined,
      editMode: editMode.value,
      beats: [],
      constraints: [],
    };
  }
  phase.value = "briefReady";
}

function updateBriefField(field: "storyGoal", value: string) {
  if (!brief.value) {
    brief.value = { type: "requirementsBrief", beats: [], constraints: [] };
  }
  brief.value[field] = value;
}

function navigateToTarget() {
  emit("navigateToTarget", effectiveTarget.value);
}
</script>

<template>
  <div class="ai-panel">
    <section class="target-bar">
      <div class="target-row">
        <label class="lbl">来源</label>
        <select :value="targetSource" @change="setTargetSource(($event.target as HTMLSelectElement).value as AiTargetSource)">
          <option value="followNav">跟随当前</option>
          <option value="manual">手动指定</option>
        </select>
      </div>
      <div class="target-row">
        <label class="lbl">范围</label>
        <select
          :value="isTimeline ? 'timeline' : 'map'"
          :disabled="targetSource === 'followNav'"
          @change="onScopeChange(($event.target as HTMLSelectElement).value as 'timeline' | 'map')"
        >
          <option value="timeline">时间线大纲</option>
          <option value="map">地图剧情</option>
        </select>
      </div>
      <div v-if="!isTimeline" class="target-row">
        <label class="lbl">地图</label>
        <select
          :value="effectiveTarget.scope === 'map' ? effectiveTarget.gameMapId : ''"
          :disabled="targetSource === 'followNav'"
          @change="onMapChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in mapOptions" :key="m.id" :value="m.id">{{ "　".repeat(m.depth) }}{{ m.label }}</option>
        </select>
      </div>
      <div v-if="!isTimeline && npcOptions.length" class="target-row">
        <label class="lbl">NPC</label>
        <select
          :value="effectiveTarget.scope === 'map' ? (effectiveTarget.npcUid ?? '') : ''"
          :disabled="targetSource === 'followNav'"
          @change="onNpcChange(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">（整张地图）</option>
          <option v-for="n in npcOptions" :key="n.npcUid" :value="n.npcUid">
            {{ n.npcName }} @ {{ n.x }},{{ n.y }}
          </option>
        </select>
      </div>
      <div v-if="!isTimeline" class="edit-mode-row">
        <span class="lbl">编辑</span>
        <button
          v-for="m in (['append', 'patch', 'replace'] as AiEditMode[])"
          :key="m"
          type="button"
          class="chip"
          :class="{ active: editMode === m }"
          @click="editMode = m"
        >
          {{ m === "append" ? "追加" : m === "patch" ? "改已有" : "重写链" }}
        </button>
      </div>
      <div class="target-actions">
        <span class="target-label">{{ targetLabel(project, effectiveTarget) }}</span>
        <button type="button" class="btn sm" @click="navigateToTarget">在画布中打开</button>
      </div>
      <p v-if="selectedNodeHint" class="selection-hint">画布选中：{{ selectedNodeHint }}</p>
    </section>

    <div class="ai-body">
      <section v-if="!isTimeline" class="blueprint-section">
        <h3 class="section-title">剧情蓝图</h3>
        <StoryBlueprintForm
          :focus-npc-uid="effectiveTarget.scope === 'map' ? effectiveTarget.npcUid : undefined"
          :disabled="streaming || phase === 'generating'"
          @confirm="onBlueprintConfirm"
        />
      </section>

      <section class="action-section">
        <h3 class="section-title">需求摘要</h3>
        <template v-if="brief">
          <p class="brief-goal">{{ brief.storyGoal }}</p>
          <ul v-if="brief.beats?.length" class="beats compact">
            <li v-for="(b, i) in brief.beats" :key="i">
              <span class="beat-kind">{{ b.kind }}</span> {{ b.summary }}
            </li>
          </ul>
        </template>
        <p v-else class="muted">填写上方蓝图并点「确认蓝图」。</p>

        <button
          v-if="!isTimeline && gameMap"
          class="btn wide"
          type="button"
          :disabled="streaming || !targetReady"
          @click="startRepairChainGenerate"
        >
          修复当前链（AI 补缺失剧情）
        </button>

        <button class="btn primary wide" type="button" :disabled="!canGenerate" @click="startGenerate">
          确认，开始上图
        </button>
        <div v-if="phase === 'generating'" class="gen-status">
          已应用 {{ appliedOps }} 个操作 · {{ appliedNodes }} 个新节点
        </div>
        <p class="hint muted">接取/交任务/对白由 AI 自动生成，无需手动搭链。</p>
      </section>

      <section class="chat-col">
        <div v-if="!discussStarted" class="start-block">
          <button type="button" class="btn sm" :disabled="!targetReady || streaming || !brief" @click="startDiscuss">
            与 AI 微调对白（可选）
          </button>
        </div>

        <div v-else ref="chatScrollEl" class="chat-thread">
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div class="msg-role">{{ m.role === "user" ? "你" : "助手" }}</div>
            <div class="msg-text">{{ m.role === "user" ? m.content : assistantDisplayText(m) }}</div>
            <PlanStepCard
              v-if="m.role === 'assistant' && m.planStep"
              :step="m.planStep"
              :disabled="streaming || i !== messages.length - 1"
              :answered="isPlanStepAnswered(m.planStep.stepId)"
              :selected-value="planSelections[m.planStep.stepId]"
              @submit="onPlanSubmit(m.planStep!, $event)"
            />
          </div>
          <div v-if="streaming && streamBuffer" class="msg assistant streaming">
            <div class="msg-role">助手</div>
            <div class="msg-text">{{ stripStructuredJsonBlocks(streamBuffer) || streamBuffer }}▌</div>
          </div>
        </div>

        <div v-if="discussStarted" class="chips">
          <button v-for="c in quickChips" :key="c" class="chip" type="button" @click="onChip(c)">{{ c }}</button>
        </div>

        <div v-if="discussStarted" class="input-row">
          <textarea
            v-model="inputText"
            rows="2"
            placeholder="回答 AI 的提问…"
            @keydown.enter.exact.prevent="onSend"
          />
          <div class="input-actions">
            <button class="btn primary" type="button" :disabled="streaming || !inputText.trim()" @click="onSend">
              发送
            </button>
            <button v-if="streaming" class="btn" type="button" @click="stopStream">停止</button>
            <button class="btn" type="button" :disabled="streaming" @click="skipToGenerate">跳过讨论</button>
          </div>
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </section>
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
.target-bar {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(2, 6, 23, 0.35);
  flex-shrink: 0;
}
.target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.lbl {
  width: 36px;
  flex-shrink: 0;
  color: #94a3b8;
}
.target-row select {
  flex: 1;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.8);
  color: inherit;
  font-size: 12px;
}
.edit-mode-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.target-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}
.target-label {
  color: #93c5fd;
  font-size: 11px;
}
.selection-hint {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 11px;
}
.ai-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}
.section-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: #e2e8f0;
}
.blueprint-section {
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.5);
}
.action-section {
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}
.brief-goal {
  margin: 0 0 8px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.4;
}
.beats.compact {
  margin: 0 0 10px;
  padding-left: 14px;
  font-size: 10px;
  color: #94a3b8;
  max-height: 100px;
  overflow: auto;
}
.beat-kind {
  display: inline-block;
  min-width: 52px;
  color: #93c5fd;
}
.chat-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 80px;
  padding: 8px 12px;
}
.start-block {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.chat-thread {
  flex: 1;
  overflow: auto;
  margin-bottom: 8px;
  padding: 6px;
  background: rgba(2, 6, 23, 0.35);
  border-radius: 8px;
}
.msg {
  margin-bottom: 10px;
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.chip {
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.chip.active {
  border-color: #60a5fa;
  background: rgba(59, 130, 246, 0.2);
}
.chip:hover {
  border-color: #60a5fa;
}
.input-row textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.35);
  color: inherit;
  resize: none;
  font-family: inherit;
  font-size: 12px;
}
.input-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.brief-col {
  padding: 8px;
  overflow: auto;
}
.brief-col h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.brief-divider {
  border: none;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  margin: 12px 0;
}
.brief-col textarea {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.35);
  color: inherit;
  font-size: 11px;
}
.beats {
  margin: 0 0 8px;
  padding-left: 16px;
  font-size: 11px;
  color: #94a3b8;
}
.kv {
  font-size: 11px;
  margin-bottom: 6px;
  color: #93c5fd;
}
.chain-preview {
  margin: 8px 0;
  border-top: 1px dashed rgba(148, 163, 184, 0.2);
  padding-top: 6px;
}
.collapse-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.node-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}
.node-link {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}
.node-link:hover {
  color: #60a5fa;
}
.preview {
  display: block;
  color: #64748b;
  font-size: 10px;
}
.gen-status {
  font-size: 11px;
  margin: 8px 0;
  color: #94a3b8;
}
.btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.3);
  color: inherit;
  cursor: pointer;
  font-size: 11px;
}
.btn.sm {
  padding: 3px 8px;
  font-size: 10px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.primary {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}
.btn.wide {
  width: 100%;
  padding: 8px;
}
.muted {
  color: #64748b;
}
.hint {
  margin-top: 6px;
  font-size: 10px;
}
.error {
  color: #f87171;
  margin-top: 6px;
}
</style>
