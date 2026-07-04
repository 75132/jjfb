<script setup lang="ts">
import { ref, watch } from "vue";
import { closeModal, useModalState } from "../useModal";

const state = useModalState();
const inputValue = ref("");

watch(
  () => state.value.visible,
  (v) => {
    if (v) inputValue.value = state.value.defaultValue;
  },
);

function onOk() {
  if (state.value.kind === "prompt") {
    closeModal(inputValue.value);
    return;
  }
  if (state.value.kind === "confirm") {
    closeModal(true);
    return;
  }
  closeModal(null);
}

function onCancel() {
  if (state.value.kind === "confirm") closeModal(false);
  else if (state.value.kind === "prompt") closeModal(null);
  else closeModal(null);
}
</script>

<template>
  <div v-if="state.visible" class="modal-backdrop" @click.self="onCancel">
    <div class="modal-box" role="dialog" aria-modal="true">
      <h3 class="modal-title">{{ state.title }}</h3>
      <p class="modal-message">{{ state.message }}</p>
      <input v-if="state.kind === 'prompt'" v-model="inputValue" class="modal-input" @keydown.enter="onOk" />
      <div class="modal-actions">
        <button v-if="state.kind !== 'alert'" class="btn" type="button" @click="onCancel">取消</button>
        <button class="btn btn-primary" type="button" @click="onOk">
          {{ state.kind === "alert" ? "确定" : "确认" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(2, 6, 23, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-box {
  width: min(480px, 100%);
  background: var(--bg-surface-1, #1e293b);
  border: 1px solid var(--border-strong, #475569);
  border-radius: var(--radius-md, 10px);
  padding: 18px 20px;
  color: var(--fg-main, #e2e8f0);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}
.modal-title {
  margin: 0 0 10px;
  font-size: 16px;
}
.modal-message {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: #cbd5e1;
}
.modal-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14px;
  padding: 8px 10px;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--border-default, #475569);
  background: rgba(2, 6, 23, 0.45);
  color: var(--fg-main, #e2e8f0);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
