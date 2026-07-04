<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  blueprintSlotLabel,
  defaultBlueprintSlot,
  defaultStoryBlueprint,
  isBlueprintReady,
  resizeBlueprintNodes,
  totalBattleEnemyCount,
  type BlueprintSlotKind,
  type StoryBlueprint,
} from "../ai/story-blueprint";

const props = defineProps<{
  focusNpcUid?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", blueprint: StoryBlueprint): void;
}>();

const blueprint = ref<StoryBlueprint>(defaultStoryBlueprint(4));

const battleTotal = computed(() => totalBattleEnemyCount(blueprint.value.nodes));
const canConfirm = computed(() => isBlueprintReady(blueprint.value) && !props.disabled);

watch(
  () => blueprint.value.nodeCount,
  (n) => {
    blueprint.value = resizeBlueprintNodes(blueprint.value, n);
  },
);

function setKind(index: number, kind: BlueprintSlotKind) {
  const row = blueprint.value.nodes[index];
  if (!row) return;
  row.kind = kind;
  if (kind === "battle" && row.enemyCount < 1) row.enemyCount = 1;
}

function confirm() {
  if (!canConfirm.value) return;
  emit("confirm", {
    ...blueprint.value,
    nodes: blueprint.value.nodes.map((n) => ({ ...n })),
  });
}
</script>

<template>
  <div class="blueprint-form">
    <p v-if="focusNpcUid" class="focus-hint">目标 NPC：<code>{{ focusNpcUid }}</code></p>

    <label class="field-label">剧情大致内容</label>
    <textarea
      v-model="blueprint.storyGoal"
      class="field-textarea"
      rows="2"
      placeholder="例如：引导新玩家熟悉机甲，清剿前哨虫族"
      :disabled="disabled"
    />

    <div class="row-inline">
      <label class="field-label inline">节点数</label>
      <input
        v-model.number="blueprint.nodeCount"
        type="number"
        class="field-num"
        min="2"
        max="8"
        :disabled="disabled"
      />
    </div>

    <p class="field-hint">每一格 = 一条独立任务链（左栏会出现 N 条）。你只选对话/战斗；接取、交任务、对白由 AI 自动补。</p>

    <ul class="slot-list">
      <li v-for="(row, i) in blueprint.nodes" :key="i" class="slot-row">
        <span class="slot-idx">{{ i + 1 }}</span>
        <div class="kind-toggle">
          <button
            type="button"
            class="kind-btn"
            :class="{ active: row.kind === 'dialog' }"
            :disabled="disabled"
            @click="setKind(i, 'dialog')"
          >
            对话
          </button>
          <button
            type="button"
            class="kind-btn battle"
            :class="{ active: row.kind === 'battle' }"
            :disabled="disabled"
            @click="setKind(i, 'battle')"
          >
            战斗
          </button>
        </div>
        <div v-if="row.kind === 'battle'" class="enemy-pick">
          <span class="enemy-lbl">敌人</span>
          <input
            v-model.number="row.enemyCount"
            type="number"
            class="field-num sm"
            min="1"
            max="10"
            :disabled="disabled"
          />
        </div>
        <span v-else class="slot-kind-label">{{ blueprintSlotLabel(row.kind) }}</span>
      </li>
    </ul>

    <p v-if="battleTotal > 0" class="battle-summary">
      {{ blueprint.nodes.length }} 条任务链 · 战斗格合计 {{ battleTotal }} 个敌人 NPC
    </p>

    <button type="button" class="btn primary wide" :disabled="!canConfirm" @click="confirm">
      确认蓝图
    </button>
  </div>
</template>

<style scoped>
.blueprint-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #e2e8f0;
}
.focus-hint {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}
.focus-hint code {
  color: #c4b5fd;
}
.field-label {
  font-size: 11px;
  color: #cbd5e1;
  font-weight: 500;
}
.field-label.inline {
  margin-right: 4px;
}
.field-hint {
  margin: 0;
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.4;
}
.field-textarea,
.field-num {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #1e293b;
  color: #f1f5f9;
  font-size: 12px;
}
.field-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.field-num {
  width: 56px;
}
.field-num.sm {
  width: 48px;
  padding: 4px 6px;
}
.row-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.slot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1e293b;
  border: 1px solid rgba(148, 163, 184, 0.3);
}
.slot-idx {
  width: 20px;
  flex-shrink: 0;
  font-weight: 600;
  color: #94a3b8;
  text-align: center;
}
.kind-toggle {
  display: flex;
  gap: 4px;
  flex: 1;
}
.kind-btn {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}
.kind-btn.active {
  background: #334155;
  border-color: #60a5fa;
  color: #fff;
}
.kind-btn.battle.active {
  border-color: #f87171;
  background: rgba(248, 113, 113, 0.2);
}
.kind-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.enemy-pick {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.enemy-lbl {
  font-size: 11px;
  color: #94a3b8;
}
.slot-kind-label {
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}
.battle-summary {
  margin: 0;
  font-size: 11px;
  color: #86efac;
}
.btn.primary.wide {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: #6366f1;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.btn.primary.wide:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
