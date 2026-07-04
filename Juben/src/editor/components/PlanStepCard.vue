<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlanStepPayload } from "../ai/types";
import type { PlanAnswerValue } from "../ai/plan-flow";

const props = defineProps<{
  step: PlanStepPayload;
  disabled?: boolean;
  answered?: boolean;
  selectedValue?: PlanAnswerValue;
}>();

const emit = defineEmits<{
  (e: "submit", value: PlanAnswerValue): void;
}>();

const customText = ref("");
const numberValue = ref<number>(props.step.min ?? 2);
const textValue = ref("");
const multiSelected = ref<string[]>([]);

const displayPrompt = computed(() => props.step.prompt ?? props.step.title);

function submitSingle(optionId: string) {
  if (props.disabled || props.answered) return;
  emit("submit", optionId);
}

function submitCustom() {
  if (props.disabled || props.answered || !customText.value.trim()) return;
  emit("submit", customText.value.trim());
}

function submitNumber() {
  if (props.disabled || props.answered) return;
  const min = props.step.min ?? 1;
  const max = props.step.max ?? 99;
  const n = Math.min(max, Math.max(min, numberValue.value));
  emit("submit", n);
}

function submitText() {
  if (props.disabled || props.answered || !textValue.value.trim()) return;
  emit("submit", textValue.value.trim());
}

function toggleMulti(id: string) {
  if (props.disabled || props.answered) return;
  const set = new Set(multiSelected.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  multiSelected.value = [...set];
}

function submitMulti() {
  if (props.disabled || props.answered || multiSelected.value.length === 0) return;
  emit("submit", [...multiSelected.value]);
}
</script>

<template>
  <div class="plan-card" :class="{ answered: answered }">
    <div class="plan-title">{{ step.title }}</div>
    <p v-if="displayPrompt && displayPrompt !== step.title" class="plan-prompt">{{ displayPrompt }}</p>

    <template v-if="answered && selectedValue !== undefined">
      <div class="plan-done">已选：{{ String(selectedValue) }}</div>
    </template>

    <template v-else-if="step.selectionMode === 'single'">
      <div class="plan-options">
        <button
          v-for="opt in step.options ?? []"
          :key="opt.id"
          type="button"
          class="plan-opt"
          :disabled="disabled"
          @click="submitSingle(opt.id)"
        >
          <span class="opt-label">{{ opt.label }}</span>
          <span v-if="opt.description" class="opt-desc">{{ opt.description }}</span>
        </button>
      </div>
      <div v-if="step.allowCustom" class="plan-custom">
        <input
          v-model="customText"
          type="text"
          class="plan-input"
          :placeholder="step.customPlaceholder ?? '其它…'"
          :disabled="disabled"
          @keydown.enter="submitCustom"
        />
        <button type="button" class="plan-btn" :disabled="disabled || !customText.trim()" @click="submitCustom">
          确认
        </button>
      </div>
    </template>

    <template v-else-if="step.selectionMode === 'multi'">
      <div class="plan-checks">
        <label v-for="opt in step.options ?? []" :key="opt.id" class="plan-check">
          <input
            type="checkbox"
            :checked="multiSelected.includes(opt.id)"
            :disabled="disabled"
            @change="toggleMulti(opt.id)"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <button type="button" class="plan-btn primary" :disabled="disabled || multiSelected.length === 0" @click="submitMulti">
        确认选择
      </button>
    </template>

    <template v-else-if="step.selectionMode === 'number'">
      <div class="plan-number">
        <input
          v-model.number="numberValue"
          type="number"
          class="plan-input num"
          :min="step.min ?? 1"
          :max="step.max ?? 99"
          :disabled="disabled"
        />
        <button type="button" class="plan-btn primary" :disabled="disabled" @click="submitNumber">确认</button>
      </div>
    </template>

    <template v-else-if="step.selectionMode === 'text'">
      <textarea
        v-model="textValue"
        class="plan-textarea"
        rows="3"
        :placeholder="step.customPlaceholder ?? '输入…'"
        :disabled="disabled"
      />
      <button type="button" class="plan-btn primary" :disabled="disabled || !textValue.trim()" @click="submitText">
        确认
      </button>
    </template>
  </div>
</template>

<style scoped>
.plan-card {
  margin-top: 8px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.plan-card.answered {
  opacity: 0.75;
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.06);
}
.plan-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}
.plan-prompt {
  font-size: 12px;
  color: var(--muted, #94a3b8);
  margin: 0 0 10px;
}
.plan-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plan-opt {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.5);
  cursor: pointer;
  color: inherit;
}
.plan-opt:hover:not(:disabled) {
  border-color: rgba(99, 102, 241, 0.6);
  background: rgba(99, 102, 241, 0.12);
}
.plan-opt:disabled {
  cursor: default;
  opacity: 0.6;
}
.opt-label {
  display: block;
  font-size: 13px;
}
.opt-desc {
  display: block;
  font-size: 11px;
  color: var(--muted, #94a3b8);
  margin-top: 2px;
}
.plan-custom {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.plan-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.6);
  color: inherit;
}
.plan-input.num {
  max-width: 100px;
}
.plan-textarea {
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.6);
  color: inherit;
  resize: vertical;
}
.plan-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.8);
  cursor: pointer;
  color: inherit;
  font-size: 12px;
}
.plan-btn.primary {
  margin-top: 8px;
  background: rgba(99, 102, 241, 0.35);
  border-color: rgba(99, 102, 241, 0.5);
}
.plan-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.plan-checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plan-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}
.plan-number {
  display: flex;
  align-items: center;
  gap: 8px;
}
.plan-done {
  font-size: 12px;
  color: #86efac;
}
</style>
