<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  clampFloatSize,
  defaultFloatSize,
  loadFloatPosition,
  loadFloatSize,
  saveFloatPosition,
  saveFloatSize,
} from "../ai/ai-target";
import type { AiPendingCommand } from "../editorInjection";
import AiAssistantPanel from "./AiAssistantPanel.vue";
import type { ProjectData } from "../../types";
import type { AiTarget, NavContext } from "../ai/ai-target";

const props = defineProps<{
  project: ProjectData;
  navContext: NavContext;
  selectedNodeIds: string[];
  visible: boolean;
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

const minimized = ref(false);
const pos = ref({ x: 0, y: 0 });
const size = ref(defaultFloatSize());

const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 });
const resizing = ref(false);
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 });

/** 窗口再大也要能拖：保证标题栏至少露出一截 */
function clampPosition(x: number, y: number) {
  const minVisibleX = 96;
  const minVisibleY = 40;
  const minX = minVisibleX - size.value.w;
  const maxX = window.innerWidth - minVisibleX;
  const minY = 56;
  const maxY = Math.max(minY, window.innerHeight - minVisibleY);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

onMounted(() => {
  const savedSize = loadFloatSize();
  if (savedSize) size.value = clampFloatSize(savedSize.w, savedSize.h);
  else size.value = defaultFloatSize();
  // 过大时先压回视口，避免「拖不动」
  size.value = clampFloatSize(size.value.w, size.value.h);
  const saved = loadFloatPosition();
  const defaultPos = {
    x: Math.max(16, window.innerWidth - size.value.w - 24),
    y: Math.max(72, window.innerHeight - size.value.h - 24),
  };
  pos.value = saved ? clampPosition(saved.x, saved.y) : clampPosition(defaultPos.x, defaultPos.y);
});

function onHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest("button")) return;
  e.preventDefault();
  dragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY, px: pos.value.x, py: pos.value.y };
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  const onMove = (ev: PointerEvent) => {
    if (!dragging.value) return;
    const dx = ev.clientX - dragStart.value.x;
    const dy = ev.clientY - dragStart.value.y;
    pos.value = clampPosition(dragStart.value.px + dx, dragStart.value.py + dy);
  };
  const onUp = () => {
    dragging.value = false;
    document.body.style.userSelect = prevUserSelect;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    saveFloatPosition(pos.value.x, pos.value.y);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  resizing.value = true;
  resizeStart.value = { x: e.clientX, y: e.clientY, w: size.value.w, h: size.value.h };
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  const onMove = (ev: PointerEvent) => {
    if (!resizing.value) return;
    const dx = ev.clientX - resizeStart.value.x;
    const dy = ev.clientY - resizeStart.value.y;
    size.value = clampFloatSize(resizeStart.value.w + dx, resizeStart.value.h + dy);
    pos.value = clampPosition(pos.value.x, pos.value.y);
  };
  const onUp = () => {
    resizing.value = false;
    document.body.style.userSelect = prevUserSelect;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    saveFloatSize(size.value.w, size.value.h);
    saveFloatPosition(pos.value.x, pos.value.y);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onUnmounted(() => {
  saveFloatPosition(pos.value.x, pos.value.y);
  saveFloatSize(size.value.w, size.value.h);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ai-float"
      :class="{ minimized, dragging, resizing }"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px`, width: `${size.w}px`, height: minimized ? 'auto' : `${size.h}px` }"
    >
      <header class="float-header" title="拖动标题栏可移动窗口" @pointerdown="onHeaderPointerDown">
        <span class="float-title">AI 剧情助手</span>
        <div class="float-actions">
          <button type="button" class="icon-btn" :title="minimized ? '展开' : '最小化'" @click="minimized = !minimized">
            {{ minimized ? "□" : "—" }}
          </button>
          <button type="button" class="icon-btn" title="关闭" @click="emit('close')">×</button>
        </div>
      </header>
      <div v-show="!minimized" class="float-body">
        <AiAssistantPanel
          :project="project"
          :nav-context="navContext"
          :selected-node-ids="selectedNodeIds"
          :pending-command="pendingCommand"
          @close="emit('close')"
          @rebuild="emit('rebuild')"
          @save="emit('save')"
          @pause-history="emit('pauseHistory')"
          @resume-history="emit('resumeHistory')"
          @suspend-autosave="emit('suspendAutosave')"
          @resume-autosave="emit('resumeAutosave')"
          @export-audit="emit('exportAudit', $event)"
          @focus-node="emit('focusNode', $event)"
          @navigate-to-target="emit('navigateToTarget', $event)"
        />
      </div>
      <div
        v-if="!minimized"
        class="resize-handle"
        title="拖拽调整大小"
        @pointerdown="onResizePointerDown"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.ai-float {
  position: fixed;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.97);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  backdrop-filter: blur(8px);
}
.ai-float.dragging,
.ai-float.resizing {
  user-select: none;
}
.ai-float.dragging .float-header {
  cursor: grabbing;
}
.float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(30, 41, 59, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  cursor: grab;
  flex-shrink: 0;
}
.float-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}
.float-actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.icon-btn:hover {
  background: rgba(148, 163, 184, 0.15);
  color: #e0e7ff;
}
.float-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(148, 163, 184, 0.45) 50%);
  border-bottom-right-radius: 12px;
}
</style>
