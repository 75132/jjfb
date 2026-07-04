<script setup lang="ts">
import { computed } from "vue";
import {
  NPC_PORTRAIT_OPTIONS,
  normalizeNpcPortraitPath,
  npcPortraitPreviewUrl,
} from "../npc-portrait-catalog";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    allowEmpty?: boolean;
    emptyLabel?: string;
    compact?: boolean;
  }>(),
  {
    modelValue: "",
    label: "NPC 形象",
    allowEmpty: true,
    emptyLabel: "（未指定）",
    compact: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const normalized = computed(() => normalizeNpcPortraitPath(props.modelValue) ?? "");

const currentPreview = computed(() => npcPortraitPreviewUrl(normalized.value));

function select(path: string) {
  emit("update:modelValue", path);
}

function clearSelection() {
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="npc-portrait-picker" :class="{ compact }">
    <div v-if="label" class="picker-label">{{ label }}</div>
    <div v-if="currentPreview" class="current">
      <img :src="currentPreview" :alt="normalized" />
      <span class="path">{{ normalized }}</span>
      <button v-if="allowEmpty" type="button" class="btn-clear" @click="clearSelection">清除</button>
    </div>
    <div class="grid">
      <button
        v-for="opt in NPC_PORTRAIT_OPTIONS"
        :key="opt.id"
        type="button"
        class="tile"
        :class="{ active: normalized === opt.cocosPath }"
        :title="opt.label"
        @click="select(opt.cocosPath)"
      >
        <img :src="opt.previewUrl" :alt="opt.label" loading="lazy" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.npc-portrait-picker {
  display: grid;
  gap: 8px;
}
.picker-label {
  font-size: 12px;
  color: #cbd5e1;
}
.current {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.current img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid #334155;
}
.path {
  flex: 1;
  font-family: ui-monospace, monospace;
}
.btn-clear {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #475569;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 11px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}
.compact .grid {
  grid-template-columns: repeat(6, 1fr);
}
.tile {
  padding: 2px;
  border-radius: 6px;
  border: 2px solid transparent;
  background: rgba(2, 6, 23, 0.4);
  cursor: pointer;
}
.tile:hover {
  border-color: #475569;
}
.tile.active {
  border-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.15);
}
.tile img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}
</style>
