<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GameMapDef, GameMapNpcDef, ProjectData } from "../../types";
import { DEFAULT_TILE_SIZE, logicalToImagePx, snapImageToLogical } from "../tilemap-coords";
import { appearSummaryLabel } from "../npc-appear";
import { resolveNpcPortraitPreviewUrl, npcPortraitPreviewUrl } from "../npc-portrait-catalog";
import { listNpcBattleChains, battleEnemySpawnCoords } from "../battle-enemy-bind";
import {
  isVerticallyStitchedMap,
  measureMapSourcesInBrowser,
  resolveMapSliceSources,
  stitchedMapMetricsFromSources,
} from "../map-slice-layout";
import {
  clearMapEditorViewState,
  getMapEditorViewState,
  setMapEditorViewState,
} from "../map-editor-view-state";
import { appConfirm } from "../useModal";

const props = defineProps<{
  project: ProjectData;
  gameMap: GameMapDef;
  selectedNpcUid: string | null;
  selectedBattleGiverUid?: string | null;
  selectedBattleSpawnUid?: string | null;
  incomingCountByEntry: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "select-npc", npcUid: string): void;
  (e: "select-battle-enemy", payload: { giverNpcUid: string; spawnUid?: string }): void;
  (e: "patch-battle-enemy", payload: { giverNpcUid: string; patch: { x: number; y: number; npcUid?: string } }): void;
  (e: "edit-npc-story", npcUid: string): void;
  (e: "patch-npc", payload: { npcUid: string; patch: Partial<GameMapNpcDef> }): void;
  (e: "add-npc"): void;
  (e: "enter-sub-map", gameMapId: string): void;
  (e: "delete-npc", npcUid: string): void;
}>();

async function onNpcContextMenu(npc: GameMapNpcDef, e: MouseEvent) {
  e.preventDefault();
  const ok = await appConfirm(`删除 NPC「${npc.npcName}」及其剧情链？`, "删除 NPC");
  if (ok) emit("delete-npc", npc.npcUid);
}

function onNpcDblClick(npc: GameMapNpcDef) {
  if (npc.subMapGameMapId) emit("enter-sub-map", npc.subMapGameMapId);
  else emit("edit-npc-story", npc.npcUid);
}

const viewportEl = ref<HTMLElement | null>(null);
const mapImageEl = ref<HTMLImageElement | null>(null);
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
/** 当前 mapKey 是否已完成首次 fit / 缓存恢复 */
const viewReadyForKey = ref("");
/** 用户已滚轮/按钮/平移调整过视口（防止异步量尺寸后覆盖） */
const userAdjustedView = ref(false);
const draggingNpc = ref<string | null>(null);
const draggingBattleGiverUid = ref<string | null>(null);
const draggingBattleSpawnUid = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const dragPreview = ref<{ kind: "npc" | "battle"; uid: string; spawnUid?: string; x: number; y: number } | null>(null);
const panning = ref(false);
const panStart = ref({ x: 0, y: 0, panX: 0, panY: 0 });

function clearDragState() {
  draggingNpc.value = null;
  draggingBattleGiverUid.value = null;
  draggingBattleSpawnUid.value = null;
  dragPreview.value = null;
  panning.value = false;
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerUp);
}

function commitDragPreview() {
  const preview = dragPreview.value;
  if (!preview) return;
  if (preview.kind === "battle") {
    emit("patch-battle-enemy", {
      giverNpcUid: preview.uid,
      patch: {
        x: preview.x,
        y: preview.y,
        ...(preview.spawnUid ? { npcUid: preview.spawnUid } : {}),
      },
    });
  } else {
    emit("patch-npc", { npcUid: preview.uid, patch: { x: preview.x, y: preview.y } });
  }
}

function endDrag() {
  if (!draggingNpc.value && !draggingBattleGiverUid.value && !dragPreview.value) return;
  commitDragPreview();
  clearDragState();
}

function onWindowPointerMove(e: PointerEvent) {
  if (draggingBattleGiverUid.value) {
    const img = clientToImage(e.clientX, e.clientY);
    const logical = snapImageToLogical(
      img.x - dragOffset.value.x,
      img.y - dragOffset.value.y,
      mapW.value,
      mapH.value,
      tileSize.value,
    );
    dragPreview.value = {
      kind: "battle",
      uid: draggingBattleGiverUid.value,
      spawnUid: draggingBattleSpawnUid.value ?? undefined,
      x: logical.x,
      y: logical.y,
    };
    return;
  }
  if (draggingNpc.value) {
    const img = clientToImage(e.clientX, e.clientY);
    const logical = snapImageToLogical(
      img.x - dragOffset.value.x,
      img.y - dragOffset.value.y,
      mapW.value,
      mapH.value,
      tileSize.value,
    );
    dragPreview.value = { kind: "npc", uid: draggingNpc.value, x: logical.x, y: logical.y };
  }
}

function onWindowPointerUp() {
  endDrag();
}

function bindWindowDrag() {
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerUp);
}

const tileSize = computed(() => props.gameMap.tileSize || DEFAULT_TILE_SIZE);
const sliceSources = computed(() => resolveMapSliceSources(props.gameMap));
const stitched = computed(() => isVerticallyStitchedMap(props.gameMap));
const singleImageSrc = computed(() => (stitched.value ? "" : sliceSources.value[0] || "/maps/1.png"));

function syncMapDimensionsFromSources() {
  const m = stitchedMapMetricsFromSources(sliceSources.value);
  mapW.value = m.width;
  mapH.value = m.height;
}

const mapW = ref(stitchedMapMetricsFromSources(resolveMapSliceSources(props.gameMap)).width);
const mapH = ref(stitchedMapMetricsFromSources(resolveMapSliceSources(props.gameMap)).height);

const stageStyle = computed(() => ({
  width: `${mapW.value}px`,
  height: `${mapH.value}px`,
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}));

const gridStyle = computed(() => ({
  backgroundSize: `${tileSize.value}px ${tileSize.value}px`,
}));

let metricsToken = 0;

function mapViewKey(): string {
  return [props.gameMap.id, props.gameMap.imagePath ?? "", props.gameMap.imageSlices?.join("|") ?? ""].join("|");
}

function persistViewState() {
  const key = mapViewKey();
  if (viewReadyForKey.value !== key) return;
  setMapEditorViewState(key, { zoom: zoom.value, panX: panX.value, panY: panY.value });
}

function restoreViewState(key: string): boolean {
  const cached = getMapEditorViewState(key);
  if (!cached) return false;
  zoom.value = cached.zoom;
  panX.value = cached.panX;
  panY.value = cached.panY;
  viewReadyForKey.value = key;
  return true;
}

function fitMapInView() {
  const el = viewportEl.value;
  if (!el || mapW.value <= 0 || mapH.value <= 0) return;
  const pad = 24;
  const zw = (el.clientWidth - pad * 2) / mapW.value;
  const zh = (el.clientHeight - pad * 2) / mapH.value;
  zoom.value = Math.max(0.15, Math.min(4, Math.min(zw, zh)));
  panX.value = (el.clientWidth - mapW.value * zoom.value) / 2;
  panY.value = (el.clientHeight - mapH.value * zoom.value) / 2;
}

function ensureViewForMapKey(key: string) {
  if (viewReadyForKey.value === key) return;
  if (restoreViewState(key)) return;
  if (userAdjustedView.value) {
    viewReadyForKey.value = key;
    persistViewState();
    return;
  }
  fitMapInView();
  viewReadyForKey.value = key;
  persistViewState();
}

async function refreshMapMetrics() {
  const token = ++metricsToken;
  const sources = sliceSources.value;
  syncMapDimensionsFromSources();
  try {
    const m = await measureMapSourcesInBrowser(sources);
    if (token !== metricsToken) return;
    if (m.width > 0 && m.height > 0) {
      mapW.value = m.width;
      mapH.value = m.height;
    }
  } catch {
    if (token !== metricsToken) return;
  }
  await nextTick();
  ensureViewForMapKey(mapViewKey());
}

function onSingleImageLoad() {
  const img = mapImageEl.value;
  if (!img) return;
  mapW.value = img.naturalWidth || mapW.value;
  mapH.value = img.naturalHeight || mapH.value;
  nextTick(() => ensureViewForMapKey(mapViewKey()));
}

function applyZoomFactor(factor: number, anchorX?: number, anchorY?: number) {
  userAdjustedView.value = true;
  const el = viewportEl.value;
  const next = Math.min(4, Math.max(0.15, zoom.value * factor));
  if (el) {
    const rect = el.getBoundingClientRect();
    const mx = anchorX ?? rect.left + rect.width / 2;
    const my = anchorY ?? rect.top + rect.height / 2;
    const lx = mx - rect.left;
    const ly = my - rect.top;
    panX.value = lx - (lx - panX.value) * (next / zoom.value);
    panY.value = ly - (ly - panY.value) * (next / zoom.value);
  }
  zoom.value = next;
  persistViewState();
}

function zoomInCenter() {
  applyZoomFactor(1.15);
}

function zoomOutCenter() {
  applyZoomFactor(1 / 1.15);
}

function npcImagePos(npc: GameMapNpcDef) {
  return logicalToImagePx(npc.x, npc.y, mapH.value, tileSize.value);
}

function markerStyle(npc: GameMapNpcDef) {
  const preview =
    dragPreview.value?.kind === "npc" && dragPreview.value.uid === npc.npcUid ? dragPreview.value : null;
  const p = preview
    ? logicalToImagePx(preview.x, preview.y, mapH.value, tileSize.value)
    : npcImagePos(npc);
  return {
    left: `${p.x}px`,
    top: `${p.y}px`,
  };
}

function clientToImage(clientX: number, clientY: number) {
  const el = viewportEl.value;
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  const vx = clientX - rect.left - panX.value;
  const vy = clientY - rect.top - panY.value;
  return { x: vx / zoom.value, y: vy / zoom.value };
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  e.stopPropagation();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  applyZoomFactor(factor, e.clientX, e.clientY);
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest(".npc-marker, .battle-enemy-marker, .map-zoom-bar")) return;
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    userAdjustedView.value = true;
    panning.value = true;
    panStart.value = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
}

function onPointerMove(e: PointerEvent) {
  if (draggingBattleGiverUid.value || draggingNpc.value) return;
  if (panning.value) {
    panX.value = panStart.value.panX + (e.clientX - panStart.value.x);
    panY.value = panStart.value.panY + (e.clientY - panStart.value.y);
    persistViewState();
  }
}

function onPointerUp(e: PointerEvent) {
  if (draggingBattleGiverUid.value || draggingNpc.value || dragPreview.value) {
    endDrag();
  } else {
    panning.value = false;
  }
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
}

function startNpcDrag(e: PointerEvent, npc: GameMapNpcDef) {
  e.stopPropagation();
  e.preventDefault();
  draggingBattleGiverUid.value = null;
  const img = clientToImage(e.clientX, e.clientY);
  const pos = npcImagePos(npc);
  dragOffset.value = { x: img.x - pos.x, y: img.y - pos.y };
  draggingNpc.value = npc.npcUid;
  dragPreview.value = { kind: "npc", uid: npc.npcUid, x: npc.x, y: npc.y };
  bindWindowDrag();
}

function startBattleDrag(
  e: PointerEvent,
  marker: { giverNpcUid: string; spawnUid: string; x: number; y: number },
) {
  e.stopPropagation();
  e.preventDefault();
  draggingNpc.value = null;
  const img = clientToImage(e.clientX, e.clientY);
  const pos = battleMarkerImagePos(marker);
  dragOffset.value = { x: img.x - pos.x, y: img.y - pos.y };
  draggingBattleGiverUid.value = marker.giverNpcUid;
  draggingBattleSpawnUid.value = marker.spawnUid;
  dragPreview.value = {
    kind: "battle",
    uid: marker.giverNpcUid,
    spawnUid: marker.spawnUid,
    x: marker.x,
    y: marker.y,
  };
  bindWindowDrag();
}

const battleEnemyMarkers = computed(() => {
  return listNpcBattleChains(props.project, props.gameMap).map((bind) => {
    const giver = props.gameMap.npcs.find((n) => n.npcUid === bind.giverNpcUid);
    if (!giver) return null;
    const coords = battleEnemySpawnCoords(bind, giver);
    const spawnUid = bind.spawnStep?.npcUid ?? `${bind.giverNpcUid}_enemy`;
    return {
      giverNpcUid: bind.giverNpcUid,
      spawnUid,
      name: bind.enemyName,
      prefabKey: bind.spawnStep?.prefabKey,
      x: coords.x,
      y: coords.y,
    };
  }).filter(Boolean) as Array<{
    giverNpcUid: string;
    spawnUid: string;
    name: string;
    prefabKey?: string;
    x: number;
    y: number;
  }>;
});

function battleMarkerImagePos(marker: { x: number; y: number }) {
  return logicalToImagePx(marker.x, marker.y, mapH.value, tileSize.value);
}

function battleMarkerStyle(marker: { giverNpcUid: string; spawnUid: string; x: number; y: number }) {
  const preview =
    dragPreview.value?.kind === "battle" &&
    dragPreview.value.uid === marker.giverNpcUid &&
    (dragPreview.value.spawnUid ?? marker.spawnUid) === marker.spawnUid
      ? dragPreview.value
      : null;
  const p = preview
    ? logicalToImagePx(preview.x, preview.y, mapH.value, tileSize.value)
    : battleMarkerImagePos(marker);
  return { left: `${p.x}px`, top: `${p.y}px` };
}

function battlePortraitFor(marker: { prefabKey?: string }) {
  return npcPortraitPreviewUrl(marker.prefabKey) ?? "";
}

function incomingCount(npc: GameMapNpcDef) {
  return props.incomingCountByEntry[npc.entryNodeId] ?? 0;
}

function npcPortraitFor(npc: GameMapNpcDef): string | undefined {
  return resolveNpcPortraitPreviewUrl(props.project, npc);
}

watch(
  () => mapViewKey(),
  () => {
    userAdjustedView.value = false;
    syncMapDimensionsFromSources();
    viewReadyForKey.value = "";
    void refreshMapMetrics();
  },
);

onMounted(() => {
  syncMapDimensionsFromSources();
  if (!stitched.value && mapImageEl.value?.complete) {
    onSingleImageLoad();
  } else {
    void refreshMapMetrics();
  }
});

onBeforeUnmount(() => {
  metricsToken++;
  persistViewState();
  endDrag();
});

defineExpose({
  fitMapInView: () => {
    const key = mapViewKey();
    clearMapEditorViewState(key);
    userAdjustedView.value = false;
    viewReadyForKey.value = "";
    fitMapInView();
    viewReadyForKey.value = key;
    persistViewState();
  },
});
</script>

<template>
  <div class="map-editor">
    <div
      ref="viewportEl"
      class="viewport"
      @wheel.prevent.stop="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="map-zoom-bar">
        <button type="button" title="放大" @click.stop="zoomInCenter">+</button>
        <span class="zoom-pct">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" title="缩小" @click.stop="zoomOutCenter">−</button>
      </div>
      <div class="stage" :style="stageStyle">
        <div v-if="stitched" class="map-stack">
          <img
            v-for="src in sliceSources"
            :key="src"
            class="map-slice"
            :src="src"
            alt=""
            draggable="false"
          />
        </div>
        <img
          v-else
          ref="mapImageEl"
          class="map-img"
          :src="singleImageSrc"
          alt="map"
          draggable="false"
          @load="onSingleImageLoad"
        />
        <div class="grid" :style="gridStyle" />
        <div
          v-for="npc in gameMap.npcs"
          :key="npc.npcUid"
          class="npc-marker task-npc-marker"
          :class="{
            selected: selectedNpcUid === npc.npcUid && selectedBattleGiverUid !== npc.npcUid,
            linked: incomingCount(npc) > 0,
            submap: !!npc.subMapGameMapId,
          }"
          :style="markerStyle(npc)"
          @pointerdown="startNpcDrag($event, npc)"
          @click.stop="emit('select-npc', npc.npcUid)"
          @dblclick.stop="onNpcDblClick(npc)"
          @contextmenu.prevent="onNpcContextMenu(npc, $event)"
        >
          <img v-if="npcPortraitFor(npc)" class="portrait" :src="npcPortraitFor(npc)" alt="" />
          <span v-else class="dot" />
          <span class="label">{{ npc.npcName }}</span>
          <span class="appear-tag">{{ appearSummaryLabel(npc) }}</span>
        </div>
        <div
          v-for="marker in battleEnemyMarkers"
          :key="`battle_${marker.spawnUid}`"
          class="npc-marker battle-enemy-marker"
          :class="{
            selected:
              selectedBattleGiverUid === marker.giverNpcUid &&
              (!selectedBattleSpawnUid || selectedBattleSpawnUid === marker.spawnUid),
          }"
          :style="battleMarkerStyle(marker)"
          @pointerdown="startBattleDrag($event, marker)"
          @click.stop="emit('select-battle-enemy', { giverNpcUid: marker.giverNpcUid, spawnUid: marker.spawnUid })"
        >
          <img v-if="battlePortraitFor(marker)" class="portrait battle-portrait" :src="battlePortraitFor(marker)" alt="" />
          <span v-else class="dot battle-dot-marker" />
          <span class="label">{{ marker.name }}</span>
          <span class="appear-tag battle-tag">战斗敌人 · 拖拽摆点</span>
        </div>
      </div>
    </div>
    <p class="hint">
      底图 {{ mapW }}×{{ mapH }}{{ stitched ? "（竖向拼接）" : "" }} · 双击 NPC 编剧情 · 右键删除 · 拖拽摆点 ·
      <strong>红色=战斗敌人</strong> · Alt+拖拽平移 · 滚轮缩放
      <span v-if="battleEnemyMarkers.length === 0" class="warn-inline">
        · 暂无战斗敌人标记，请点左栏任务下方「+ 战斗分支」
      </span>
    </p>
  </div>
</template>

<style scoped>
.map-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #020617;
}
.viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: default;
}
.map-zoom-bar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid #334155;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
.map-zoom-bar button {
  width: 28px;
  height: 28px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.map-zoom-bar button:hover {
  background: #334155;
}
.zoom-pct {
  min-width: 42px;
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
}
.stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
.map-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.map-img,
.map-slice {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
  user-select: none;
  pointer-events: none;
}
.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px);
}
.npc-marker {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: grab;
  user-select: none;
  transform: translate(-50%, -50%);
  touch-action: none;
}
.npc-marker:active {
  cursor: grabbing;
}
.battle-enemy-marker {
  z-index: 4;
  pointer-events: auto;
}
.task-npc-marker {
  z-index: 2;
}
.npc-marker .portrait {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 4px;
  border: 2px solid #fff;
  background: rgba(15, 23, 42, 0.85);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
}
.npc-marker.selected .portrait {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 2px #0ea5e9;
}
.npc-marker .dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #f59e0b;
  border: 2px solid #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
}
.npc-marker.submap .dot {
  background: #6366f1;
}
.npc-marker.selected .dot {
  background: #0ea5e9;
  box-shadow: 0 0 0 2px #0ea5e9;
}
.battle-enemy-marker .portrait {
  border-color: #f87171;
}
.battle-enemy-marker .dot.battle-dot-marker {
  background: #ef4444;
  border-color: #fff;
}
.battle-enemy-marker.selected .portrait {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #ef4444;
}
.battle-enemy-marker.selected .dot.battle-dot-marker {
  box-shadow: 0 0 0 2px #ef4444;
}
.battle-tag {
  color: #fca5a5 !important;
}
.npc-marker.linked .dot {
  background: #22c55e;
}
.label {
  font-size: 10px;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.9);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.appear-tag {
  font-size: 9px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.75);
  padding: 0 4px;
  border-radius: 3px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--fg-tertiary);
  border-top: 1px solid var(--border-strong);
  margin: 0;
}
.warn-inline {
  color: #fbbf24;
}
</style>
