<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from "vue";
import { useVueFlow } from "@vue-flow/core";
import type { MapFrameNodeData } from "../adapters";
import { STORY_FLOW_ID } from "../flow-id";
import { MAP_FRAME_EDITOR_KEY } from "../mapInjection";

const props = defineProps<{
  id: string;
  data: MapFrameNodeData;
  selected?: boolean;
}>();

const map = computed(() => props.data.map);
const ctx = inject(MAP_FRAME_EDITOR_KEY, null);
const { viewport } = useVueFlow(STORY_FLOW_ID);

const resizing = ref(false);
let lastClientX = 0;
let lastClientY = 0;

function onResizePointerDown(e: PointerEvent) {
  if (!ctx) return;
  e.stopPropagation();
  e.preventDefault();
  resizing.value = true;
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);

  const onMove = (ev: PointerEvent) => {
    if (!resizing.value || !ctx) return;
    const z = viewport.value.zoom || 1;
    const dw = (ev.clientX - lastClientX) / z;
    const dh = (ev.clientY - lastClientY) / z;
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    ctx.commitResizeDelta(map.value.id, dw, dh);
  };

  const onUp = (ev: PointerEvent) => {
    resizing.value = false;
    try {
      (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

onBeforeUnmount(() => {
  resizing.value = false;
});
</script>

<template>
  <div
    class="map-frame"
    :class="{ selected: !!selected || !!data.editorSelected, resizing }"
    :style="{ width: `${map.width}px`, height: `${map.height}px` }"
  >
    <div class="map-header">
      <span class="map-id">{{ map.name || map.id }}</span>
      <span class="map-count">{{ data.assignedNodeTitles.length }} 节点</span>
    </div>
    <div v-if="data.assignedNodeTitles.length" class="map-nodes">
      <span v-for="name in data.assignedNodeTitles.slice(0, 3)" :key="name" class="map-node-chip">{{ name }}</span>
      <span v-if="data.assignedNodeTitles.length > 3" class="map-node-chip">
        +{{ data.assignedNodeTitles.length - 3 }}
      </span>
    </div>
    <div v-else class="map-hint">拖入节点</div>
    <div class="select-strip select-strip-top" />
    <div class="select-strip select-strip-right" />
    <div class="select-strip select-strip-bottom" />
    <div class="select-strip select-strip-left" />
    <div class="resize-handle" title="拖动调整大小" @pointerdown="onResizePointerDown" />
  </div>
</template>

<style scoped>
.map-frame {
  position: relative;
  box-sizing: border-box;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(14, 165, 233, 0.45);
  background: rgba(14, 165, 233, 0.06);
  color: var(--fg-secondary);
  /* 框体仅作背景，点击穿透到上层剧情节点；标题栏/缩放手柄可交互 */
  pointer-events: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}
.map-frame.selected {
  border-color: rgba(14, 165, 233, 0.95);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.35);
  background: rgba(14, 165, 233, 0.1);
}
.map-frame:hover {
  border-color: rgba(56, 189, 248, 0.65);
  background: rgba(14, 165, 233, 0.09);
}
.map-frame.resizing {
  user-select: none;
}
.map-header {
  position: absolute;
  top: 8px;
  left: 10px;
  right: 22px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  pointer-events: auto;
  cursor: grab;
}
.map-frame.selected .map-header {
  cursor: grabbing;
}
.map-id {
  font-size: 11px;
  font-weight: 600;
  color: #7dd3fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.map-count {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--fg-tertiary);
}
.map-hint {
  position: absolute;
  bottom: 10px;
  left: 10px;
  font-size: 10px;
  color: var(--fg-tertiary);
  opacity: 0.85;
  pointer-events: none;
}
.map-nodes {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  pointer-events: none;
}
.map-node-chip {
  font-size: 10px;
  color: #bae6fd;
  border: 1px solid rgba(125, 211, 252, 0.35);
  background: rgba(2, 132, 199, 0.15);
  padding: 1px 6px;
  border-radius: 999px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-strip {
  position: absolute;
  pointer-events: auto;
  background: transparent;
}
.select-strip-top {
  top: 0;
  left: 0;
  right: 0;
  height: 14px;
}
.select-strip-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 14px;
}
.select-strip-left {
  top: 0;
  bottom: 0;
  left: 0;
  width: 12px;
}
.select-strip-right {
  top: 0;
  bottom: 0;
  right: 0;
  width: 12px;
}
.resize-handle {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: rgba(14, 165, 233, 0.35);
  border: 1px solid rgba(125, 211, 252, 0.6);
  cursor: nwse-resize;
  pointer-events: auto;
}
.resize-handle:hover {
  background: rgba(14, 165, 233, 0.55);
}
</style>
