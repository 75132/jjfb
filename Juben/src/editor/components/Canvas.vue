<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  VueFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeDragEvent,
  type NodeMouseEvent,
  type NodeChange,
  type EdgeChange,
  useVueFlow,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { MiniMap } from "@vue-flow/minimap";
import { Controls } from "@vue-flow/controls";

import { FLOW_NODE_TYPE_MAP, FLOW_NODE_TYPE_MAP_PORTAL, FLOW_NODE_TYPE_STORY } from "../adapters";
import { STORY_FLOW_ID } from "../flow-id";
import StoryNodeComp from "./StoryNode.vue";
import MapFrameNode from "./MapFrameNode.vue";
import MapPortalNode from "./MapPortalNode.vue";
import type { SelectionRect } from "../zone-selection";

defineProps<{
  nodes: Node[];
  edges: Edge[];
}>();

const emit = defineEmits<{
  (e: "update:nodes", nodes: Node[]): void;
  (e: "update:edges", edges: Edge[]): void;
  (e: "connect", c: Connection): void;
  (e: "nodeDragStart", e2: NodeDragEvent): void;
  (e: "nodeDrag", e2: NodeDragEvent): void;
  (e: "nodeDragStop", e2: NodeDragEvent): void;
  (e: "nodeClick", e2: NodeMouseEvent): void;
  (e: "edgeClick", edgeId: string): void;
  (e: "nodesChange", c: NodeChange[]): void;
  (e: "edgesChange", c: EdgeChange[]): void;
  (e: "selectionChange", payload: { nodeIds: string[]; edgeIds: string[] }): void;
  (e: "selectionBox", payload: { rect: SelectionRect; additive: boolean }): void;
  (e: "paneContextMenu", ev: MouseEvent): void;
  (e: "paneClick", ev: MouseEvent): void;
  (e: "ready"): void;
  (e: "unready"): void;
}>();

const { viewport, removeSelectedElements, addSelectedNodes, findNode, nodesSelectionActive, dimensions, updateNodeInternals } =
  useVueFlow(STORY_FLOW_ID);

const canvasEl = ref<HTMLElement | null>(null);
const flowMountReady = ref(false);
const mountSize = ref<{ width: number; height: number } | null>(null);
let layoutObserver: ResizeObserver | null = null;
let mountScheduled = false;

function readCanvasSize(): { width: number; height: number } {
  const el = canvasEl.value;
  if (!el) return { width: 0, height: 0 };
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function syncMountSize(): boolean {
  const { width, height } = readCanvasSize();
  if (width <= 0 || height <= 0) return false;
  mountSize.value = { width: Math.round(width), height: Math.round(height) };
  return true;
}

function scheduleFlowMount() {
  if (flowMountReady.value || mountScheduled) return;
  if (!syncMountSize()) return;
  mountScheduled = true;
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mountScheduled = false;
        if (flowMountReady.value) return;
        if (!syncMountSize()) return;
        flowMountReady.value = true;
      });
    });
  });
}

function onLayoutResize() {
  if (!syncMountSize()) return;
  if (!flowMountReady.value) {
    scheduleFlowMount();
    return;
  }
  refreshFlowDimensions();
}

function refreshFlowDimensions(): boolean {
  if (!syncMountSize()) return false;
  dimensions.value = { width: mountSize.value!.width, height: mountSize.value!.height };
  updateNodeInternals();
  window.dispatchEvent(new Event("resize"));
  return true;
}

function onPaneReady() {
  nextTick(() => {
    requestAnimationFrame(() => {
      refreshFlowDimensions();
      emit("ready");
    });
  });
}

const nodeTypes = markRaw({
  [FLOW_NODE_TYPE_STORY]: StoryNodeComp,
  [FLOW_NODE_TYPE_MAP]: MapFrameNode,
  [FLOW_NODE_TYPE_MAP_PORTAL]: MapPortalNode,
});

const spaceDown = ref(false);
/** 相对 .canvas 的像素坐标，用于选框 overlay */
const boxStartLocal = ref<{ x: number; y: number } | null>(null);
const boxCurrentLocal = ref<{ x: number; y: number } | null>(null);
/** flow 坐标，用于命中节点 */
const boxStartFlow = ref<{ x: number; y: number } | null>(null);
const boxCurrentFlow = ref<{ x: number; y: number } | null>(null);
const boxAdditive = ref(false);

function applyEditorSelection(nodeIds: string[]) {
  const idSet = new Set(nodeIds);
  removeSelectedElements();
  nodesSelectionActive.value = false;
  if (idSet.size === 0) return;
  // 多选时不把地图框送入 VF，避免整区巨型 selection 矩形；单选地图框时仍保留
  const vfIds = idSet.size > 1 ? [...idSet].filter((id) => !id.startsWith("__map__")) : [...idSet];
  const toSelect = vfIds.map((id) => findNode(id)).filter((n): n is Node => !!n);
  if (toSelect.length > 0) addSelectedNodes(toSelect);
}

defineExpose({ applyEditorSelection, refreshFlowDimensions });

function onKeyDown(e: KeyboardEvent) {
  if (e.code !== "Space") return;
  spaceDown.value = true;
  e.preventDefault();
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code !== "Space") return;
  spaceDown.value = false;
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): SelectionRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

function isBoxTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest(".vue-flow__pane")) return false;
  if (el.closest(".vue-flow__node")) return false;
  if (el.closest(".vue-flow__controls")) return false;
  if (el.closest(".vue-flow__minimap")) return false;
  return true;
}

/** 指针 → 相对 canvas 容器左上角的像素坐标（与 overlay 同一坐标系） */
function pointerToLocal(e: PointerEvent): { x: number; y: number } {
  const root = canvasEl.value;
  if (!root) return { x: 0, y: 0 };
  const rect = root.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** 指针 → flow 坐标（与 Vue Flow 节点位置同一坐标系） */
function pointerToFlow(e: PointerEvent): { x: number; y: number } {
  const viewportEl = canvasEl.value?.querySelector(".vue-flow__viewport") as HTMLElement | null;
  if (!viewportEl) return { x: 0, y: 0 };
  const bounds = viewportEl.getBoundingClientRect();
  const pane = canvasEl.value?.querySelector(".vue-flow__transformationpane") as HTMLElement | null;
  let vx = viewport.value.x;
  let vy = viewport.value.y;
  let zoom = viewport.value.zoom || 1;
  if (pane) {
    const m = new DOMMatrixReadOnly(window.getComputedStyle(pane).transform);
    vx = m.m41;
    vy = m.m42;
    zoom = m.a || 1;
  }
  return {
    x: (e.clientX - bounds.left - vx) / zoom,
    y: (e.clientY - bounds.top - vy) / zoom,
  };
}

function onWindowPointerDown(e: PointerEvent) {
  if (e.button !== 0 || spaceDown.value) return;
  if (!isBoxTarget(e.target)) return;
  boxStartLocal.value = pointerToLocal(e);
  boxCurrentLocal.value = boxStartLocal.value;
  boxStartFlow.value = pointerToFlow(e);
  boxCurrentFlow.value = boxStartFlow.value;
  boxAdditive.value = e.shiftKey || e.ctrlKey || e.metaKey;
}

function onWindowPointerMove(e: PointerEvent) {
  if (!boxStartLocal.value) return;
  boxCurrentLocal.value = pointerToLocal(e);
  boxCurrentFlow.value = pointerToFlow(e);
}

function onWindowPointerUp(e: PointerEvent) {
  if (!boxStartFlow.value || !boxCurrentFlow.value) return;
  const rect = normalizeRect(boxStartFlow.value, boxCurrentFlow.value);
  boxStartLocal.value = null;
  boxCurrentLocal.value = null;
  boxStartFlow.value = null;
  boxCurrentFlow.value = null;
  if (rect.width > 6 && rect.height > 6) {
    emit("selectionBox", { rect, additive: boxAdditive.value || e.shiftKey || e.ctrlKey || e.metaKey });
  }
  boxAdditive.value = false;
}

const boxOverlayStyle = computed(() => {
  if (!boxStartLocal.value || !boxCurrentLocal.value) return null;
  const x = Math.min(boxStartLocal.value.x, boxCurrentLocal.value.x);
  const y = Math.min(boxStartLocal.value.y, boxCurrentLocal.value.y);
  const w = Math.abs(boxCurrentLocal.value.x - boxStartLocal.value.x);
  const h = Math.abs(boxCurrentLocal.value.y - boxStartLocal.value.y);
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
});

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", onWindowPointerDown, true);
  window.addEventListener("pointermove", onWindowPointerMove, true);
  window.addEventListener("pointerup", onWindowPointerUp, true);
  scheduleFlowMount();
  if (typeof ResizeObserver !== "undefined") {
    layoutObserver = new ResizeObserver(() => onLayoutResize());
    if (canvasEl.value) layoutObserver.observe(canvasEl.value);
  }
});
onBeforeUnmount(() => {
  layoutObserver?.disconnect();
  layoutObserver = null;
  mountScheduled = false;
  flowMountReady.value = false;
  mountSize.value = null;
  emit("unready");
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("pointerdown", onWindowPointerDown, true);
  window.removeEventListener("pointermove", onWindowPointerMove, true);
  window.removeEventListener("pointerup", onWindowPointerUp, true);
});
</script>

<template>
  <div ref="canvasEl" class="canvas" @wheel.stop>
    <div
      v-if="flowMountReady && mountSize"
      class="flow-host"
      :style="{ width: `${mountSize.width}px`, height: `${mountSize.height}px` }"
    >
      <VueFlow
        :id="STORY_FLOW_ID"
        :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :fit-view-on-init="true"
      :min-zoom="0.15"
      :max-zoom="2.5"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      :selection-on-drag="false"
      :select-nodes-on-drag="false"
      :nodes-selectable="true"
      :edges-selectable="true"
      :elevate-nodes-on-select="true"
      :pan-on-drag="spaceDown ? true : [1]"
      :multi-selection-key-code="['Shift', 'Control', 'Meta']"
      @update:nodes="emit('update:nodes', $event)"
      @update:edges="emit('update:edges', $event)"
      @connect="emit('connect', $event)"
      @nodes-change="emit('nodesChange', $event)"
      @edges-change="emit('edgesChange', $event)"
      @node-drag-start="emit('nodeDragStart', $event)"
      @node-drag="emit('nodeDrag', $event)"
      @node-drag-stop="emit('nodeDragStop', $event)"
      @node-click="emit('nodeClick', $event)"
      @edge-click="emit('edgeClick', $event.edge.id)"
      @selection-change="
        emit('selectionChange', { nodeIds: $event.nodes.map((n) => n.id), edgeIds: $event.edges.map((e) => e.id) })
      "
      @pane-context-menu="emit('paneContextMenu', $event)"
      @pane-click="emit('paneClick', $event)"
      @pane-ready="onPaneReady"
    >
      <Background :gap="18" pattern-color="rgba(148,163,184,0.15)" />
      <MiniMap
        position="bottom-left"
        :pannable="true"
        :zoomable="true"
        node-color="#475569"
        mask-color="rgba(2, 6, 23, 0.72)"
      />
      <Controls position="top-right" />
      </VueFlow>
    </div>
    <div v-if="boxOverlayStyle" class="selection-box" :style="boxOverlayStyle" />
  </div>
</template>

<style scoped>
.canvas {
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #020617;
  overflow: hidden;
  overscroll-behavior: contain;
}
.flow-host {
  position: relative;
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
}
.flow-host :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
.flow-host :deep(.vue-flow__viewport) {
  width: 100%;
  height: 100%;
}
.selection-box {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  border: 1px solid rgba(56, 189, 248, 0.85);
  background: rgba(14, 165, 233, 0.12);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.25);
}
</style>
