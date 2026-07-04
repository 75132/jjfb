<script setup lang="ts">
import type { GameMapDef } from "../../types";

const props = defineProps<{
  items: Array<{ label: string; id: string; level: "timeline" | "map" }>;
}>();

const emit = defineEmits<{
  (e: "navigate", id: string, level: "timeline" | "map"): void;
}>();
</script>

<template>
  <nav class="breadcrumb" aria-label="导航">
    <button
      v-for="(item, idx) in items"
      :key="`${item.level}-${item.id}`"
      class="crumb"
      type="button"
      :class="{ active: idx === items.length - 1 }"
      @click="emit('navigate', item.id, item.level)"
    >
      <span v-if="idx > 0" class="sep">/</span>
      {{ item.label }}
    </button>
  </nav>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  font-size: 13px;
}
.crumb {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
}
.crumb:hover {
  color: #38bdf8;
}
.crumb.active {
  color: #e2e8f0;
  font-weight: 600;
  cursor: default;
}
.sep {
  margin-right: 6px;
  color: #475569;
}
</style>
