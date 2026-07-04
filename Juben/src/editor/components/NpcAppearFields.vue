<script setup lang="ts">
import { computed } from "vue";
import type { GameMapNpcDef, NpcAppearConfig, ProjectData, QuestDef, VariableDef } from "../../types";
import { defaultNpcAppearConfig, ensureNpcAppear, normalizeNpcAppear } from "../npc-appear";
import { questStatusLabel } from "../quest-logic";

const props = defineProps<{
  npc: GameMapNpcDef;
  project: ProjectData;
  quests?: QuestDef[];
  variables?: VariableDef[];
}>();

const emit = defineEmits<{
  (e: "patch", patch: Partial<NpcAppearConfig>): void;
}>();

const quests = computed(() => props.quests ?? props.project.quests ?? []);
const variables = computed(() => props.variables ?? props.project.variables ?? []);
const appear = computed(() => normalizeNpcAppear(props.npc));

const varById = computed(() => new Map(variables.value.map((v) => [v.id, v])));

function patch(patch: Partial<NpcAppearConfig>) {
  emit("patch", patch);
}

function addQuestRequirement() {
  const cur = ensureNpcAppear(props.npc);
  if (!cur.requirements) cur.requirements = [];
  const q = quests.value[0];
  cur.requirements.push({ kind: "questStatus", questId: q?.id ?? "", status: "Completed" });
  patch({ requirements: [...cur.requirements] });
}

function addVarRequirement() {
  const cur = ensureNpcAppear(props.npc);
  if (!cur.requirements) cur.requirements = [];
  const v = variables.value[0];
  cur.requirements.push({
    kind: "varEquals",
    varId: v?.id ?? "",
    value: v?.type === "number" ? 0 : v?.type === "string" ? "" : false,
  });
  patch({ requirements: [...cur.requirements] });
}

function removeRequirement(idx: number) {
  const next = [...(appear.value.requirements ?? [])];
  next.splice(idx, 1);
  patch({ requirements: next });
}

function requirementLabel(r: import("../../types").Requirement) {
  if (r.kind === "questStatus") {
    const q = quests.value.find((x) => x.id === r.questId);
    return `任务 ${q?.name ?? r.questId} = ${questStatusLabel(r.status)}`;
  }
  if (r.kind === "eventDone") {
    return `Self Switch · event_done · ${r.eventId}`;
  }
  const v = varById.value.get(r.varId);
  return `变量 ${v?.name ?? r.varId} = ${String(r.value)}`;
}
</script>

<template>
  <div class="npc-appear-fields">
    <label class="shell-lbl">页条件 · 出现方式</label>
    <p class="hint rm-hint">对标 RM MV Page Conditions：Switch / Variable / Self Switch（event_done）</p>
    <select
      class="shell-input"
      :value="appear.mode"
      @change="patch({ mode: ($event.target as HTMLSelectElement).value as 'always' | 'conditional' })"
    >
      <option value="conditional">满足条件后显示</option>
      <option value="always">直接显示</option>
    </select>

    <template v-if="appear.mode === 'conditional'">
      <label class="shell-lbl">条件组合（Page Conditions AND/OR）</label>
      <select
        class="shell-input"
        :value="appear.matchMode ?? 'ALL'"
        @change="patch({ matchMode: ($event.target as HTMLSelectElement).value as 'ALL' | 'ANY' })"
      >
        <option value="ALL">全部满足（AND）</option>
        <option value="ANY">任一满足（OR）</option>
      </select>
      <div v-if="!appear.requirements?.length" class="hint">未配置条件时保持隐藏。</div>
      <div v-for="(r, idx) in appear.requirements ?? []" :key="idx" class="req-row">
        <span class="req-text">{{ requirementLabel(r) }}</span>
        <button class="btn btn-del btn-mini" type="button" @click="removeRequirement(idx)">×</button>
      </div>
      <div class="row-actions">
        <button class="btn btn-sm" type="button" @click="addQuestRequirement">+ 任务条件</button>
        <button class="btn btn-sm" type="button" @click="addVarRequirement">+ 变量条件</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.npc-appear-fields {
  display: grid;
  gap: 2px;
}
.req-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface-2);
  font-size: 11px;
}
.req-text {
  flex: 1;
  min-width: 0;
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
</style>
