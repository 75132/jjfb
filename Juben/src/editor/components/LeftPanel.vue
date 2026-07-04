<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { GameMapDef, GraphData, GraphKind, NodeKind, ProjectData, StoryMapRegion } from "../../types";
import { findGameMapForGraph, taskLabelForNpc } from "../game-map-logic";
import { appearSummaryLabel } from "../npc-appear";
import { MAP_IMAGE_PRESETS, isCocosStitchMapConfig, resolveMapPresetId } from "../map-slice-layout";
import { getMapAncestors, getMapChildren, getTimelineGraph } from "../map-tree";
import { questStatusLabel } from "../quest-logic";
import {
  advancedCatalogEntries,
  NODE_CATEGORY_LABEL,
  primaryCatalogEntries,
  quickCreateForGraph,
  type NodeCatalogEntry,
} from "../node-catalog";
import {
  catalogEntryDisabledReason,
  isCatalogEntryDisabledForNpc,
} from "../chain-slot-guards";
import { inferChainSlotKind } from "../chain-slot-kind";
import { formatChainSummary } from "../chain-step-labels";
import {
  resolveNpcBattleChain,
  resolveNpcBattleChains,
  resolveBattleEnemyNpcUidForIndex,
  type NpcBattleChainBind,
} from "../battle-enemy-bind";
import { npcPortraitPreviewUrl } from "../npc-portrait-catalog";
import {
  chainPortraitShortLabel,
  resolveChainPortraitPath,
  resolveChainPortraitPreviewUrl,
} from "../npc-chain-portrait";
import { appConfirm, appPrompt } from "../useModal";
import NpcAppearFields from "./NpcAppearFields.vue";
import NpcPortraitPicker from "./NpcPortraitPicker.vue";
import type { NpcAppearConfig } from "../../types";

const props = defineProps<{
  project: ProjectData;
  selectedGraphId: string;
  selectedMapId: string | null;
  selectedGameMapId?: string | null;
  focusedNpcUid?: string | null;
  /** 地图模式下选中战斗敌人（对应 giver npcUid） */
  selectedBattleGiverUid?: string | null;
  /** 多敌人时选中的 spawn npcUid（如 task_1_enemy_2） */
  selectedBattleSpawnUid?: string | null;
  editorViewMode?: "map" | "story";
}>();

const emit = defineEmits<{
  (e: "selectGraph", id: string): void;
  (e: "addGraph", kind: GraphKind): void;
  (e: "addNode", kind: NodeKind): void;
  (e: "deleteGraph", id: string): void;
  (e: "renameGraphName", payload: { id: string; name: string }): void;
  (e: "addMap"): void;
  (e: "selectMap", id: string | null): void;
  (e: "deleteMap", id: string): void;
  (e: "patchMap", payload: { id: string; patch: Partial<StoryMapRegion> }): void;
  (e: "renameMapId", payload: { oldId: string; newId: string }): void;
  (e: "fitMap", id: string): void;
  (e: "selectGameMap", id: string): void;
  (e: "addGameMap"): void;
  (e: "deleteGameMap", id: string): void;
  (e: "patchGameMap", payload: { id: string; patch: Record<string, unknown> }): void;
  (e: "linkGraphToMap", payload: { gameMapId: string; graphId: string }): void;
  (e: "unlinkGraphFromMap", payload: { gameMapId: string; graphId: string }): void;
  (e: "focusNpc", npcUid: string): void;
  (e: "selectNpc", npcUid: string): void;
  (e: "selectBattleEnemy", payload: { giverNpcUid: string; spawnUid?: string }): void;
  (e: "focusBattleNode", giverNpcUid: string): void;
  (e: "addBattleBranch", giverNpcUid: string): void;
  (e: "addMultiBattleBranch", payload: { giverNpcUid: string; enemyCount: number }): void;
  (e: "deleteBattleBranch", giverNpcUid: string): void;
  (e: "patchBattleEnemy", payload: { giverNpcUid: string; patch: Record<string, unknown> }): void;
  (e: "switchView", mode: "map" | "story"): void;
  (e: "addNpc"): void;
  (e: "deleteNpc", npcUid: string): void;
  (e: "patchNpc", payload: { npcUid: string; patch: Record<string, unknown> }): void;
  (e: "patchTaskEntry", payload: { npcUid: string; title: string }): void;
  (e: "openQuestDetail", questId: string): void;
  (e: "addGlobalQuest"): void;
  (e: "reorderGlobalQuest", payload: { fromIndex: number; toIndex: number }): void;
  (e: "addChildMap", parentGameMapId: string | null): void;
  (e: "navigateTimeline"): void;
  (e: "patchPortalNode", payload: { nodeId: string; title: string }): void;
  (e: "deletePortal", payload: { portalNodeId: string; deleteGameMap: boolean }): void;
}>();

const currentGraph = computed(() => props.project.graphs.find((g) => g.id === props.selectedGraphId) ?? null);
const isTimelineGraph = computed(() => currentGraph.value?.kind === "timeline");
const primaryNodes = computed(() => primaryCatalogEntries(currentGraph.value?.kind));
const advancedNodes = computed(() => advancedCatalogEntries(currentGraph.value?.kind));
const quickCreateNodes = computed(() => quickCreateForGraph(currentGraph.value?.kind));

const gameMaps = computed(() => props.project.gameMaps ?? []);
const currentGameMap = computed(() => {
  if (props.selectedGameMapId) {
    return gameMaps.value.find((m) => m.id === props.selectedGameMapId) ?? null;
  }
  return findGameMapForGraph(props.project, props.selectedGraphId);
});
const isMapGraph = computed(() => currentGraph.value?.kind === "map");

function taskLabel(npc: import("../../types").GameMapNpcDef, index: number): string {
  if (!currentGameMap.value) return `任务 ${index + 1}`;
  return taskLabelForNpc(props.project, currentGameMap.value, npc, index);
}

function taskSubtitle(npc: import("../../types").GameMapNpcDef): string {
  const label = chainPortraitShortLabel(props.project, npc);
  if (label !== "未指定形象") return `形象 · ${label}`;
  const graph = props.project.graphs.find((g) => g.id === currentGameMap.value?.graphId);
  const entry = graph?.nodes.find((n) => n.id === npc.entryNodeId);
  if (entry?.characterId) {
    const asset = props.project.characterAssets?.find((a) => a.id === entry.characterId);
    if (asset?.name) return asset.name;
  }
  const npcResId = entry?.npcId ?? npc.npcResourceId ?? npc.npcUid;
  const res = props.project.resources?.npc?.find((r) => r.id === npcResId);
  if (res?.name) return res.name;
  return "未指定形象";
}

function giverPortrait(npc: import("../../types").GameMapNpcDef): string {
  return resolveChainPortraitPreviewUrl(props.project, npc) ?? "";
}

function npcEventChainSummary(npc: import("../../types").GameMapNpcDef): string {
  const graph = props.project.graphs.find((g) => g.id === currentGameMap.value?.graphId);
  if (!graph || !npc.entryNodeId) return "";
  return formatChainSummary(graph, npc.entryNodeId);
}
const globalGraphs = computed(() =>
  props.project.graphs.filter((g) => g.kind === "mainline" || g.kind === "side" || g.kind === "quest"),
);

const showGlobalGraphs = ref(false);
const showAdvancedNodes = ref(false);
const sectionOpen = ref({
  location: true,
  tasks: true,
  subareas: false,
  mapSettings: false,
  selectedNpc: true,
  nodeLib: true,
  legacy: false,
});
const dragQuestIndex = ref<number | null>(null);
const editingKey = ref<string | null>(null);
const editingValue = ref("");

const timelinePortals = computed(() => {
  const tl = getTimelineGraph(props.project);
  return tl?.nodes.filter((n) => n.kind === "mapPortal") ?? [];
});

const mapAncestors = computed(() => {
  if (!currentGameMap.value) return [];
  return getMapAncestors(props.project, currentGameMap.value.id);
});

const rootChapterMapId = computed(() => mapAncestors.value[0]?.id ?? currentGameMap.value?.id ?? null);

const childMaps = computed(() => {
  if (!currentGameMap.value) return [];
  return getMapChildren(props.project, currentGameMap.value.id);
});

function chapterIndexForMap(mapId: string | undefined | null): number {
  if (!mapId) return -1;
  return timelinePortals.value.findIndex((p) => p.gameMapId === mapId);
}

function mapDisplayName(gm: GameMapDef | null | undefined): string {
  if (!gm) return "未命名地图";
  return (gm.mapName || gm.mapCode || "未命名地图").trim();
}

function mapNameById(mapId: string | undefined | null): string {
  if (!mapId) return "未绑定地图";
  const gm = gameMaps.value.find((m) => m.id === mapId);
  return gm ? mapDisplayName(gm) : "未绑定地图";
}

function onQuestDragStart(idx: number) {
  dragQuestIndex.value = idx;
}

function onQuestDragOver(e: DragEvent) {
  e.preventDefault();
}

function onQuestDrop(toIdx: number) {
  const from = dragQuestIndex.value;
  if (from == null || from === toIdx) return;
  emit("reorderGlobalQuest", { fromIndex: from, toIndex: toIdx });
  dragQuestIndex.value = null;
}

function statusBadgeClass(status: string): string {
  if (status === "Completed") return "badge-done";
  if (status === "InProgress") return "badge-active";
  if (status === "Failed") return "badge-fail";
  return "badge-idle";
}

function graphsOf(kind: GraphKind): GraphData[] {
  return props.project.graphs.filter((g) => g.kind === kind);
}

function editKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

async function startInlineEdit(key: string, current: string) {
  editingKey.value = key;
  editingValue.value = current;
  await nextTick();
  const el = document.querySelector(".inline-edit-active") as HTMLInputElement | null;
  el?.focus();
  el?.select();
}

function cancelInlineEdit() {
  editingKey.value = null;
  editingValue.value = "";
}

function commitInlineEdit() {
  const key = editingKey.value;
  if (!key) return;
  const next = editingValue.value.trim();
  cancelInlineEdit();
  if (!next) return;

  const [kind, id] = key.split(":");
  if (kind === "map" || kind === "sub") {
    emit("patchGameMap", { id, patch: { mapName: next } });
    return;
  }
  if (kind === "npc") {
    emit("patchNpc", { npcUid: id, patch: { npcName: next } });
    return;
  }
  if (kind === "task") {
    emit("patchTaskEntry", { npcUid: id, title: next });
    return;
  }
  if (kind === "portal") {
    emit("patchPortalNode", { nodeId: id, title: next });
  }
}

async function renameGraphName(g: GraphData) {
  const current = (g.name ?? "").trim() || g.id;
  const next = (await appPrompt("请输入画布名称", current, "重命名画布"))?.trim();
  if (!next || next === g.name) return;
  emit("renameGraphName", { id: g.id, name: next });
}

async function onDeleteSubMap(childId: string) {
  const ok = await appConfirm(`确认删除子区域「${mapNameById(childId)}」？`, "删除子区域");
  if (!ok) return;
  emit("deleteGameMap", childId);
}

async function onDeleteGraph(id: string, name: string) {
  const ok = await appConfirm(`确认删除画布「${name}」？`, "删除画布");
  if (!ok) return;
  emit("deleteGraph", id);
}

function patchNpcAppear(npcUid: string, patch: Partial<NpcAppearConfig>) {
  const npc = currentGameMap.value?.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const cur = npc.appear ?? { mode: "always" as const, matchMode: "ALL" as const, requirements: [] };
  emit("patchNpc", { npcUid, patch: { appear: { ...cur, ...patch } } });
}

function onNpcRowClick(npcUid: string) {
  if (props.editorViewMode === "story") emit("focusNpc", npcUid);
  else emit("selectNpc", npcUid);
}

function isNpcRowActive(npcUid: string, zoneId: string) {
  if (props.selectedBattleGiverUid === npcUid) return true;
  if (props.selectedBattleGiverUid) return false;
  return props.focusedNpcUid === npcUid || props.selectedMapId === zoneId;
}

function battleBindsFor(npcUid: string): NpcBattleChainBind[] {
  if (!currentGameMap.value) return [];
  return resolveNpcBattleChains(props.project, currentGameMap.value, npcUid);
}

function battleBindFor(npcUid: string): NpcBattleChainBind | null {
  return battleBindsFor(npcUid)[0] ?? null;
}

async function onAddMultiBattleBranch(giverNpcUid: string) {
  const raw = await appPrompt("输入需要击败的敌人数量（接取任务后显示，逐个触发战斗）", "2", "多敌人战斗");
  if (raw == null) return;
  const n = Math.max(1, Math.min(10, parseInt(raw, 10) || 2));
  emit("addMultiBattleBranch", { giverNpcUid, enemyCount: n });
}

function battleEnemySubtitle(bind: NpcBattleChainBind): string {
  const prefab = bind.spawnStep?.prefabKey;
  if (prefab) return prefab.split("/").pop() ?? prefab;
  return bind.enemyName || "战斗敌人";
}

function battleEnemyPortrait(bind: NpcBattleChainBind): string {
  return npcPortraitPreviewUrl(bind.spawnStep?.prefabKey) ?? "";
}

function onBattleRowClick(giverNpcUid: string, spawnUid?: string) {
  emit("selectBattleEnemy", { giverNpcUid, spawnUid });
}

function isBattleRowActive(giverNpcUid: string, spawnUid?: string) {
  if (props.selectedBattleGiverUid !== giverNpcUid) return false;
  if (!spawnUid || !props.selectedBattleSpawnUid) return true;
  return props.selectedBattleSpawnUid === spawnUid;
}

async function onDeleteBattleBranch(giverNpcUid: string) {
  const bind = battleBindFor(giverNpcUid);
  const label = bind?.enemyName ?? "战斗分支";
  const ok = await appConfirm(`删除「${label}」及链内战斗节点？接取/交任务保留。`, "删除战斗分支");
  if (ok) emit("deleteBattleBranch", giverNpcUid);
}

const selectedBattleBind = computed(() => {
  if (!props.selectedBattleGiverUid || !currentGameMap.value) return null;
  const chains = resolveNpcBattleChains(props.project, currentGameMap.value, props.selectedBattleGiverUid);
  if (props.selectedBattleSpawnUid) {
    return (
      chains.find((c) => c.spawnStep?.npcUid === props.selectedBattleSpawnUid) ??
      chains.find((_, i) => resolveBattleEnemyNpcUidForIndex(props.selectedBattleGiverUid!, i) === props.selectedBattleSpawnUid) ??
      chains[0] ??
      null
    );
  }
  return chains[0] ?? null;
});

function enterMap(mapId: string | undefined | null) {
  if (mapId) emit("selectGameMap", mapId);
}

const selectedNpcDef = computed(() => {
  if (!currentGameMap.value || !props.focusedNpcUid) return null;
  return currentGameMap.value.npcs.find((n) => n.npcUid === props.focusedNpcUid) ?? null;
});

const focusedGraph = computed(() => {
  if (!currentGameMap.value) return null;
  return props.project.graphs.find((g) => g.id === currentGameMap.value!.graphId) ?? null;
});

function npcSlotKind(npc: import("../../types").GameMapNpcDef): "dialog" | "battle" {
  if (npc.chainSlotKind) return npc.chainSlotKind;
  if (!focusedGraph.value || !currentGameMap.value) return "dialog";
  return inferChainSlotKind(props.project, focusedGraph.value, currentGameMap.value, npc.npcUid);
}

function npcSlotBadge(npc: import("../../types").GameMapNpcDef): string {
  const k = npcSlotKind(npc);
  return k === "battle" ? "[战斗]" : "[对话]";
}

function isNodeCatalogDisabled(entry: NodeCatalogEntry): boolean {
  if (!currentGameMap.value || !focusedGraph.value) return false;
  const uid = props.focusedNpcUid ?? selectedNpcDef.value?.npcUid ?? null;
  return isCatalogEntryDisabledForNpc(props.project, focusedGraph.value, currentGameMap.value, uid, entry);
}

function nodeCatalogDisabledTitle(entry: NodeCatalogEntry): string {
  if (!currentGameMap.value || !focusedGraph.value) return entry.summary;
  const uid = props.focusedNpcUid ?? selectedNpcDef.value?.npcUid ?? null;
  return catalogEntryDisabledReason(props.project, focusedGraph.value, currentGameMap.value, uid, entry) ?? entry.summary;
}

function canAddBattleBranch(npcUid: string): boolean {
  const npc = currentGameMap.value?.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return true;
  return npcSlotKind(npc) === "battle";
}

const childGameMapOptions = computed(() => {
  if (!currentGameMap.value) return [];
  return getMapChildren(props.project, currentGameMap.value.id);
});

const mapPresetId = computed(() =>
  currentGameMap.value ? resolveMapPresetId(currentGameMap.value) : "maps/1",
);

const needsCocosStitchWarning = computed(
  () => Boolean(isMapGraph.value && currentGameMap.value && !isCocosStitchMapConfig(currentGameMap.value)),
);

function onMapPresetChange(e: Event) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const id = (e.target as HTMLSelectElement).value;
  const preset = MAP_IMAGE_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  emit("patchGameMap", {
    id: gm.id,
    patch: {
      imagePath: preset.patch.imagePath,
      imageSlices: preset.patch.imageSlices ? [...preset.patch.imageSlices] : undefined,
    },
  });
}

async function onDeletePortal(portalId: string, gameMapId?: string) {
  const deleteGm = gameMapId ? await appConfirm(`同时删除关联地图「${mapNameById(gameMapId)}」？`, "删除章节") : false;
  emit("deletePortal", { portalNodeId: portalId, deleteGameMap: deleteGm });
}
</script>

<template>
  <section class="panel" @wheel.stop>
    <!-- 时间线：章节列表 -->
    <div v-if="isTimelineGraph" class="block">
      <div class="block-title row-head">
        <span>剧情章节</span>
        <button class="btn btn-mini btn-accent" type="button" title="新建章节" @click="emit('addGlobalQuest')">
          +
        </button>
      </div>
      <p class="hint">从上到下是主线顺序。拖拽调整章节，点击进入地图编辑 NPC 与摆点。</p>
      <div v-if="timelinePortals.length === 0" class="empty-card">
        <div class="empty-title">还没有章节</div>
        <div class="empty-desc">点击右上角 + 创建第一个大剧情章节</div>
        <button class="btn btn-primary empty-btn" type="button" @click="emit('addGlobalQuest')">+ 创建第一章</button>
      </div>
      <div
        v-for="(portal, idx) in timelinePortals"
        :key="portal.id"
        class="chapter-card"
        :class="{ active: portal.gameMapId === selectedGameMapId }"
        draggable="true"
        @dragstart="onQuestDragStart(idx)"
        @dragover="onQuestDragOver"
        @drop="onQuestDrop(idx)"
      >
        <div class="chapter-head">
          <span class="chapter-num">第 {{ idx + 1 }} 章</span>
          <span class="quest-badge" :class="statusBadgeClass(portal.initialQuestStatus ?? 'NotStarted')">
            {{ questStatusLabel(portal.initialQuestStatus ?? "NotStarted") }}
          </span>
        </div>
        <div
          class="chapter-title"
          title="双击改名"
          @dblclick.stop="startInlineEdit(editKey('portal', portal.id), portal.title || '未命名章节')"
        >
          <input
            v-if="editingKey === editKey('portal', portal.id)"
            v-model="editingValue"
            class="inline-edit inline-edit-active"
            @keydown.enter="commitInlineEdit"
            @keydown.esc="cancelInlineEdit"
            @blur="commitInlineEdit"
            @click.stop
          />
          <span v-else>{{ portal.title || "未命名章节" }}</span>
        </div>
        <div class="chapter-foot">
          <span class="chapter-meta">{{ mapNameById(portal.gameMapId) }}</span>
          <div class="chapter-actions">
            <button class="btn-enter" type="button" @click="enterMap(portal.gameMapId)">进入</button>
            <button
              class="btn btn-del btn-mini"
              type="button"
              title="删除章节"
              @click.stop="onDeletePortal(portal.id, portal.gameMapId)"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 地图内：位置导航 -->
    <div v-if="!isTimelineGraph && currentGameMap" class="panel-section">
      <div class="panel-section-head" @click="sectionOpen.location = !sectionOpen.location">
        <span>当前位置</span>
        <span class="muted-small">{{ sectionOpen.location ? "▾" : "▸" }}</span>
      </div>
      <div v-show="sectionOpen.location" class="panel-section-body nav-block">
        <div class="loc-path">
          <div
            v-for="(gm, idx) in mapAncestors"
            :key="gm.id"
            class="loc-crumb"
            :class="{ active: gm.id === selectedGameMapId, last: idx === mapAncestors.length - 1 }"
            title="单击进入 · 双击改名"
            @click="emit('selectGameMap', gm.id)"
            @dblclick.stop="startInlineEdit(editKey('map', gm.id), mapDisplayName(gm))"
          >
            <span v-if="idx > 0" class="loc-sep">›</span>
            <input
              v-if="editingKey === editKey('map', gm.id)"
              v-model="editingValue"
              class="inline-edit inline-edit-active inline-edit-crumb"
              @keydown.enter="commitInlineEdit"
              @keydown.esc="cancelInlineEdit"
              @blur="commitInlineEdit"
              @click.stop
            />
            <span v-else>{{ mapDisplayName(gm) }}</span>
          </div>
        </div>
        <div v-if="chapterIndexForMap(rootChapterMapId) >= 0 && mapAncestors.length > 1" class="hint chapter-hint">
          所属章节：第 {{ chapterIndexForMap(rootChapterMapId) + 1 }} 章
        </div>
        <div class="mode-row">
          <button
            class="btn mode-btn"
            :class="{ active: editorViewMode === 'map' }"
            type="button"
            title="地图摆点：拖拽任务官与红色战斗敌人"
            @click="emit('switchView', 'map')"
          >
            摆点
          </button>
          <button
            class="btn mode-btn"
            :class="{ active: editorViewMode === 'story' }"
            type="button"
            @click="emit('switchView', 'story')"
          >
            编剧情
          </button>
        </div>
      </div>
    </div>

    <!-- 地图内：子区域（仅当前层下级） -->
    <div v-if="!isTimelineGraph && currentGameMap" class="panel-section">
      <div class="panel-section-head" @click="sectionOpen.subareas = !sectionOpen.subareas">
        <span>子区域</span>
        <span class="muted-small">{{ sectionOpen.subareas ? "▾" : "▸" }}</span>
      </div>
      <div v-show="sectionOpen.subareas" class="panel-section-body">
        <div class="row-head" style="margin-bottom: 6px">
          <button
            class="btn btn-mini btn-accent"
            type="button"
            title="在当前地图下新建子区域"
            @click="emit('addChildMap', currentGameMap.id)"
          >
            + 新建
          </button>
        </div>
        <p class="hint">子区域用于房间、副本层等嵌套地图。在摆点模式给 NPC 绑「子地图入口」也可跳转。</p>
        <div v-if="childMaps.length === 0" class="empty-inline">当前地图下暂无子区域</div>
        <div v-for="child in childMaps" :key="child.id" class="sub-area-card">
          <div class="sub-area-icon">📁</div>
          <div
            class="sub-area-body"
            title="双击改名"
            @dblclick.stop="startInlineEdit(editKey('sub', child.id), mapDisplayName(child))"
          >
            <input
              v-if="editingKey === editKey('sub', child.id)"
              v-model="editingValue"
              class="inline-edit inline-edit-active"
              @keydown.enter="commitInlineEdit"
              @keydown.esc="cancelInlineEdit"
              @blur="commitInlineEdit"
              @click.stop
            />
            <div v-else class="sub-area-name">{{ mapDisplayName(child) }}</div>
            <div class="sub-area-meta">{{ child.npcs.length }} 个 NPC</div>
          </div>
          <button
            class="btn-enter"
            type="button"
            :class="{ active: child.id === selectedGameMapId }"
            @click="emit('selectGameMap', child.id)"
          >
            进入
          </button>
          <button class="btn btn-del" type="button" title="删除子区域" @click="onDeleteSubMap(child.id)">×</button>
        </div>
      </div>
    </div>

    <!-- 当前地图：任务列表 -->
    <template v-if="currentGameMap && !isTimelineGraph">
      <div class="panel-section">
        <div class="panel-section-head" @click="sectionOpen.tasks = !sectionOpen.tasks">
          <span>任务链 · {{ currentGameMap.npcs.length }}</span>
          <span class="muted-small">{{ sectionOpen.tasks ? "▾" : "▸" }}</span>
        </div>
        <div v-show="sectionOpen.tasks" class="panel-section-body">
          <div class="row-head" style="margin-bottom: 6px">
            <button class="btn btn-mini btn-accent" type="button" title="新建任务链" @click="emit('addNpc')">
              + 新建
            </button>
          </div>
            <p class="hint">
            列表顺序 = 游戏里逐个出现。点任务官摆点；点下方红色「战斗敌人」进入摆点模式拖拽敌人位置。
          </p>
          <div v-if="currentGameMap.npcs.length === 0" class="empty-inline">暂无任务，点击 + 添加</div>
          <div
            v-for="(npc, idx) in currentGameMap.npcs"
            :key="npc.npcUid"
            class="npc-card"
            :class="{ active: isNpcRowActive(npc.npcUid, npc.zoneId) }"
          >
            <span class="npc-order">#{{ idx + 1 }}</span>
            <div class="npc-card-stack">
              <div class="npc-row">
                <button
                  class="btn item npc-name-btn task-name-btn"
                  type="button"
                  title="任务链入口 · 双击改任务名"
                  @click="onNpcRowClick(npc.npcUid)"
                  @dblclick.stop="startInlineEdit(editKey('task', npc.npcUid), taskLabel(npc, idx))"
                >
                  <input
                    v-if="editingKey === editKey('task', npc.npcUid)"
                    v-model="editingValue"
                    class="inline-edit inline-edit-active inline-edit-btn"
                    @keydown.enter="commitInlineEdit"
                    @keydown.esc="cancelInlineEdit"
                    @blur="commitInlineEdit"
                    @click.stop
                  />
                  <span v-else-if="editingKey !== editKey('task', npc.npcUid)" class="task-name-line">
                    <img v-if="giverPortrait(npc)" class="giver-thumb" :src="giverPortrait(npc)" alt="" />
                    <span v-else class="giver-dot" />
                    <span class="task-name-inner">{{ taskLabel(npc, idx) }} <span class="slot-badge">{{ npcSlotBadge(npc) }}</span></span>
                  </span>
                  <span v-if="editingKey !== editKey('task', npc.npcUid)" class="task-sub">入口节点 · {{ taskSubtitle(npc) }}</span>
                  <span v-if="editingKey !== editKey('task', npc.npcUid)" class="task-chain">{{
                    npcEventChainSummary(npc)
                  }}</span>
                  <span v-if="editingKey !== editKey('task', npc.npcUid)" class="task-appear muted-small">{{
                    appearSummaryLabel(npc)
                  }}</span>
                </button>
                <button class="btn btn-del" type="button" title="删除任务链" @click="emit('deleteNpc', npc.npcUid)">
                  ×
                </button>
              </div>
              <div v-for="(bind, bi) in battleBindsFor(npc.npcUid)" :key="bind.spawnStep?.npcUid ?? bi" class="npc-row battle-row">
                <button
                  class="btn item npc-name-btn task-name-btn battle-name-btn"
                  type="button"
                  :class="{ 'battle-active': isBattleRowActive(npc.npcUid, bind.spawnStep?.npcUid) }"
                  title="战斗敌人 · 地图模式可拖拽摆点 · 剧情模式跳转战斗节点"
                  @click="onBattleRowClick(npc.npcUid, bind.spawnStep?.npcUid)"
                >
                  <span class="task-name battle-title">
                    <img
                      v-if="battleEnemyPortrait(bind)"
                      class="battle-thumb"
                      :src="battleEnemyPortrait(bind)"
                      alt=""
                    />
                    <span v-else class="battle-dot" />
                    战斗敌人 · {{ bind.enemyName }}
                  </span>
                  <span class="task-sub">{{ battleEnemySubtitle(bind) }}</span>
                  <span v-if="bind.battleConfigId" class="task-chain muted-small">
                    {{ bind.battleConfigId }}
                  </span>
                </button>
                <button
                  v-if="bi === 0"
                  class="btn btn-del"
                  type="button"
                  title="删除全部战斗分支"
                  @click.stop="onDeleteBattleBranch(npc.npcUid)"
                >
                  ×
                </button>
              </div>
              <div v-if="canAddBattleBranch(npc.npcUid) && battleBindsFor(npc.npcUid).length === 0" class="battle-add-row">
                <button
                  class="btn btn-mini battle-add-btn"
                  type="button"
                  title="单敌人：敌人出现 → 战前选择 → 战斗"
                  @click="emit('addBattleBranch', npc.npcUid)"
                >
                  + 战斗分支
                </button>
                <button
                  class="btn btn-mini battle-add-btn"
                  type="button"
                  title="多敌人：接取后显示 N 个敌人，逐个击败后交任务"
                  @click="onAddMultiBattleBranch(npc.npcUid)"
                >
                  + 多敌人战斗
                </button>
              </div>
              <button
                v-else-if="canAddBattleBranch(npc.npcUid) && battleBindsFor(npc.npcUid).length === 1"
                class="btn btn-mini battle-add-btn"
                type="button"
                title="升级为多敌人战斗链"
                @click="onAddMultiBattleBranch(npc.npcUid)"
              >
                + 多敌人战斗
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="isMapGraph" class="panel-section">
        <div class="panel-section-head" @click="sectionOpen.mapSettings = !sectionOpen.mapSettings">
          <span>地图设置</span>
          <span class="muted-small">{{ sectionOpen.mapSettings ? "▾" : "▸" }}</span>
        </div>
        <div v-show="sectionOpen.mapSettings" class="panel-section-body map-shell-block">
          <label class="shell-lbl">底图</label>
          <select class="shell-input" :value="mapPresetId" @change="onMapPresetChange">
            <option v-for="p in MAP_IMAGE_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
            <option v-if="mapPresetId.startsWith('custom/')" value="custom/" disabled>当前为自定义底图</option>
          </select>
          <p v-if="needsCocosStitchWarning" class="shell-note shell-warn">
            当前底图与 Cocos Game 竖拼地图不一致，NPC 坐标导出后会错位。请切换「Cocos 拼接 1-1 → 1-2 → 1-3」并重新摆点。
          </p>
          <p v-else-if="currentGameMap.imageSlices?.length" class="muted-small shell-note">
            竖向拼接 {{ currentGameMap.imageSlices.length }} 张 · 1584×1728
          </p>
          <label class="shell-lbl">BGM</label>
          <input
            class="shell-input"
            :value="currentGameMap.runtimeShell?.bgm ?? ''"
            placeholder="如 bgm_test_base"
            @change="
              emit('patchGameMap', {
                id: currentGameMap.id,
                patch: {
                  runtimeShell: { ...currentGameMap.runtimeShell, bgm: ($event.target as HTMLInputElement).value },
                },
              })
            "
          />
          <label class="shell-lbl">场景预制体</label>
          <input
            class="shell-input"
            :value="currentGameMap.runtimeShell?.scenePrefabKey ?? ''"
            @change="
              emit('patchGameMap', {
                id: currentGameMap.id,
                patch: {
                  runtimeShell: {
                    ...currentGameMap.runtimeShell,
                    scenePrefabKey: ($event.target as HTMLInputElement).value,
                  },
                },
              })
            "
          />
          <label class="shell-lbl">小地图标记（小）</label>
          <input
            class="shell-input"
            :value="currentGameMap.runtimeShell?.markerPrefabs?.small ?? ''"
            placeholder="小地图标记预制体"
            @change="
              emit('patchGameMap', {
                id: currentGameMap.id,
                patch: {
                  runtimeShell: {
                    ...currentGameMap.runtimeShell,
                    markerPrefabs: {
                      ...currentGameMap.runtimeShell?.markerPrefabs,
                      small: ($event.target as HTMLInputElement).value,
                    },
                  },
                },
              })
            "
          />
          <label class="shell-lbl">小地图标记（精英）</label>
          <input
            class="shell-input"
            :value="currentGameMap.runtimeShell?.markerPrefabs?.elite ?? ''"
            @change="
              emit('patchGameMap', {
                id: currentGameMap.id,
                patch: {
                  runtimeShell: {
                    ...currentGameMap.runtimeShell,
                    markerPrefabs: {
                      ...currentGameMap.runtimeShell?.markerPrefabs,
                      elite: ($event.target as HTMLInputElement).value,
                    },
                  },
                },
              })
            "
          />
          <label class="shell-lbl">小地图标记（Boss）</label>
          <input
            class="shell-input"
            :value="currentGameMap.runtimeShell?.markerPrefabs?.boss ?? ''"
            @change="
              emit('patchGameMap', {
                id: currentGameMap.id,
                patch: {
                  runtimeShell: {
                    ...currentGameMap.runtimeShell,
                    markerPrefabs: {
                      ...currentGameMap.runtimeShell?.markerPrefabs,
                      boss: ($event.target as HTMLInputElement).value,
                    },
                  },
                },
              })
            "
          />
        </div>
      </div>
      <div v-if="isMapGraph && (selectedNpcDef || selectedBattleBind)" class="panel-section">
        <div class="panel-section-head" @click="sectionOpen.selectedNpc = !sectionOpen.selectedNpc">
          <span>{{ selectedBattleBind ? "选中 · 战斗敌人" : "选中 NPC" }}</span>
          <span class="muted-small">{{ sectionOpen.selectedNpc ? "▾" : "▸" }}</span>
        </div>
        <div v-show="sectionOpen.selectedNpc" class="panel-section-body npc-placement-block">
          <template v-if="selectedBattleBind && selectedBattleGiverUid">
            <div class="hint">
              任务 #{{ (currentGameMap?.npcs.findIndex((n) => n.npcUid === selectedBattleGiverUid) ?? -1) + 1 }}
              · {{ selectedBattleBind.enemyName }}（spawn: {{ selectedBattleBind.spawnStep?.npcUid }}）
            </div>
            <NpcPortraitPicker
              :model-value="selectedBattleBind.spawnStep?.prefabKey ?? ''"
              label="战斗敌人形象（仅本召唤单位）"
              compact
              @update:model-value="
                emit('patchBattleEnemy', {
                  giverNpcUid: selectedBattleGiverUid,
                  patch: {
                    prefabKey: $event,
                    npcUid: selectedBattleBind?.spawnStep?.npcUid ?? selectedBattleSpawnUid ?? undefined,
                  },
                })
              "
            />
            <p class="hint">与任务官形象独立；多敌人时逐条指定。地图红色标记 = 本敌人摆点。</p>
          </template>
          <template v-else-if="selectedNpcDef">
            <div class="hint">{{ selectedNpcDef.npcName }}（{{ selectedNpcDef.npcUid }}）</div>
            <NpcPortraitPicker
              :model-value="resolveChainPortraitPath(project, selectedNpcDef)"
              label="任务链形象（全链统一）"
              compact
              @update:model-value="
                emit('patchNpc', {
                  npcUid: selectedNpcDef.npcUid,
                  patch: { prefabKey: $event || undefined },
                })
              "
            />
            <p class="hint">对话节点 / 地图蓝点 / 导出 JSON 共用此形象；仅战斗召唤敌人可单独指定。</p>
            <label class="shell-lbl">子地图入口</label>
            <select
              class="shell-input"
              :value="selectedNpcDef.subMapGameMapId ?? ''"
              @change="
                emit('patchNpc', {
                  npcUid: selectedNpcDef.npcUid,
                  patch: {
                    subMapGameMapId: ($event.target as HTMLSelectElement).value || undefined,
                  },
                })
              "
            >
              <option value="">（无）</option>
              <option v-for="cm in childGameMapOptions" :key="cm.id" :value="cm.id">
                {{ mapDisplayName(cm) }}
              </option>
            </select>
            <NpcAppearFields
              :npc="selectedNpcDef"
              :project="project"
              @patch="patchNpcAppear(selectedNpcDef.npcUid, $event)"
            />
          </template>
        </div>
      </div>
    </template>

    <!-- 节点库 -->
    <div v-if="isTimelineGraph || !currentGameMap || editorViewMode === 'story' || !isMapGraph" class="block">
      <div class="quick-actions">
        <button
          v-for="item in quickCreateNodes"
          :key="item.kind"
          class="btn quick-btn"
          :class="{ 'btn-primary': item.kind === 'dialog' || item.kind === 'mapPortal' }"
          type="button"
          :disabled="isMapGraph && item.kind === 'battle' && selectedNpcDef && npcSlotKind(selectedNpcDef) === 'dialog'"
          :title="isMapGraph && item.kind === 'battle' && selectedNpcDef && npcSlotKind(selectedNpcDef) === 'dialog' ? '对话页不可添加战斗节点' : undefined"
          @click="item.kind === 'mapPortal' ? emit('addGlobalQuest') : emit('addNode', item.kind)"
        >
          + {{ item.label }}
        </button>
      </div>
      <div class="block-title">{{ isTimelineGraph ? "时间线节点" : "节点库" }}</div>
      <p v-if="isTimelineGraph" class="hint">编排章节顺序与解锁条件，双击大剧情进入地图。</p>
      <p v-else class="hint">常用节点按类分组；任务进度代替选项里接/完成任务。</p>

      <template v-for="cat in ['story', 'combat', 'reward', 'logic', 'timeline'] as const" :key="cat">
        <template v-if="primaryNodes.some((n) => n.category === cat)">
          <div class="palette-cat">{{ NODE_CATEGORY_LABEL[cat] }}</div>
          <div class="palette">
            <button
              v-for="item in primaryNodes.filter((n) => n.category === cat)"
              :key="item.kind"
              class="palette-item"
              type="button"
              :disabled="isNodeCatalogDisabled(item)"
              :title="nodeCatalogDisabledTitle(item)"
              @click="item.kind === 'mapPortal' ? emit('addGlobalQuest') : emit('addNode', item.kind)"
            >
              <span class="palette-label">{{ item.label }}</span>
              <span class="palette-desc">{{ item.summary }}</span>
            </button>
          </div>
        </template>
      </template>

      <button
        v-if="advancedNodes.length > 0"
        class="link-btn section-toggle"
        type="button"
        @click="showAdvancedNodes = !showAdvancedNodes"
      >
        {{ showAdvancedNodes ? "收起高级节点" : "高级节点（少用）…" }}
      </button>
      <div v-if="showAdvancedNodes && advancedNodes.length" class="palette palette-advanced">
        <button
          v-for="item in advancedNodes"
          :key="item.kind"
          class="palette-item"
          type="button"
          :title="item.summary"
          @click="emit('addNode', item.kind)"
        >
          <span class="palette-label">{{ item.label }}</span>
          <span class="palette-desc">{{ item.summary }}</span>
        </button>
      </div>
    </div>

    <!-- 旧版全局画布（仅迁移用，新流程请用时间线） -->
    <div v-if="!isTimelineGraph" class="panel-section panel-section-legacy">
      <div class="panel-section-head" @click="sectionOpen.legacy = !sectionOpen.legacy">
        <span>迁移工具 · 全局画布</span>
        <span class="muted-small">{{ sectionOpen.legacy ? "▾" : "▸" }}</span>
      </div>
      <div v-show="sectionOpen.legacy" class="panel-section-body">
        <template v-if="sectionOpen.legacy">
          <div class="block">
            <div class="row">
              <button class="btn" @click="emit('addGraph', 'mainline')">+ 主线</button>
              <button class="btn" @click="emit('addGraph', 'side')">+ 支线</button>
              <button class="btn" @click="emit('addGraph', 'quest')">+ 任务</button>
            </div>
            <div class="sub-title">主线</div>
            <div v-for="g in graphsOf('mainline')" :key="g.id" class="item-row">
              <button class="btn item" :class="{ active: g.id === selectedGraphId }" @click="emit('selectGraph', g.id)">
                {{ g.name }}
              </button>
              <button class="btn btn-mini" title="改名" @click="renameGraphName(g)">✎</button>
              <button class="btn btn-del" @click="onDeleteGraph(g.id, g.name)">×</button>
            </div>
            <div class="sub-title">支线</div>
            <div v-for="g in graphsOf('side')" :key="g.id" class="item-row">
              <button class="btn item" :class="{ active: g.id === selectedGraphId }" @click="emit('selectGraph', g.id)">
                {{ g.name }}
              </button>
              <button class="btn btn-mini" @click="renameGraphName(g)">✎</button>
              <button class="btn btn-del" @click="onDeleteGraph(g.id, g.name)">×</button>
            </div>
            <div class="sub-title">任务</div>
            <div v-for="g in graphsOf('quest')" :key="g.id" class="item-row">
              <button class="btn item" :class="{ active: g.id === selectedGraphId }" @click="emit('selectGraph', g.id)">
                {{ g.name }}
              </button>
              <button class="btn btn-mini" @click="renameGraphName(g)">✎</button>
              <button class="btn btn-del" @click="onDeleteGraph(g.id, g.name)">×</button>
            </div>
          </div>

          <div v-if="!isMapGraph && currentGraph?.maps?.length" class="block">
            <div class="block-title row-head">
              <span>逻辑分区</span>
              <button class="btn btn-mini" type="button" @click="emit('addMap')">+</button>
            </div>
            <div v-for="m in currentGraph!.maps!" :key="m.id" class="item-row">
              <button class="btn item" :class="{ active: m.id === selectedMapId }" @click="emit('selectMap', m.id)">
                {{ m.name || m.id }}
              </button>
              <button class="btn btn-del" type="button" @click="emit('deleteMap', m.id)">×</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  border-right: 1px solid var(--border-strong);
  padding: 10px;
  background: var(--bg-app);
  overflow: auto;
  overscroll-behavior: contain;
}
.block {
  margin-bottom: 14px;
}
.block-title {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 6px;
}
.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-block {
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.nav-back {
  width: 100%;
  margin-bottom: 8px;
  text-align: left;
  color: #94a3b8;
}
.nav-back:hover {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.4);
}
.loc-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-bottom: 8px;
}
.loc-crumb {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 0;
}
.loc-crumb:hover {
  color: #38bdf8;
}
.loc-crumb.active.last {
  color: #e2e8f0;
  font-weight: 600;
}
.chapter-hint {
  margin-bottom: 8px;
}
.mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 0;
}
.loc-sep {
  margin: 0 4px;
  color: #475569;
}
.inline-edit {
  width: 100%;
  min-width: 60px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: rgba(2, 6, 23, 0.9);
  color: #f1f5f9;
  font-size: inherit;
  font-weight: inherit;
}
.inline-edit-crumb {
  width: auto;
  min-width: 48px;
  max-width: 120px;
}
.inline-edit-btn {
  width: 100%;
  text-align: left;
}
.npc-card {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  align-items: flex-start;
  padding: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
}
.npc-card-stack {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.npc-row {
  display: flex;
  gap: 4px;
  align-items: center;
  width: 100%;
}
.battle-row {
  padding-left: 8px;
  border-left: 2px solid rgba(239, 68, 68, 0.45);
}
.battle-name-btn.battle-active,
.battle-name-btn.battle-active .task-name {
  color: #fca5a5;
}
.battle-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.battle-thumb {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
  border: 1px solid rgba(248, 113, 113, 0.6);
}
.battle-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  flex-shrink: 0;
}
.task-name-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.giver-thumb {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 3px;
  border: 1px solid rgba(14, 165, 233, 0.55);
  flex-shrink: 0;
}
.giver-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f59e0b;
  flex-shrink: 0;
}
.battle-add-btn {
  margin-left: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.npc-card:hover {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(2, 6, 23, 0.25);
}
.npc-card.active {
  border-color: var(--accent);
  background: rgba(14, 165, 233, 0.1);
}
.npc-name-btn {
  flex: 1;
  min-width: 0;
}
.task-name-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}
.task-name {
  font-size: 13px;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.slot-badge {
  font-size: 10px;
  color: #93c5fd;
  margin-left: 4px;
}
.palette-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.task-sub {
  font-size: 11px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.task-chain {
  font-size: 10px;
  color: #64748b;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.block-action {
  width: 100%;
  margin-bottom: 8px;
}
.map-shell-block .shell-lbl {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin: 6px 0 2px;
}
.map-shell-block .shell-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
}
.map-shell-block .shell-warn {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: #fbbf24;
}
.empty-card {
  padding: 16px 12px;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(148, 163, 184, 0.3);
  background: rgba(2, 6, 23, 0.35);
  text-align: center;
  margin-bottom: 8px;
}
.empty-title {
  font-size: 13px;
  color: #e2e8f0;
  margin-bottom: 4px;
}
.empty-desc {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 10px;
}
.empty-btn {
  width: 100%;
}
.empty-inline {
  font-size: 11px;
  color: #64748b;
  padding: 6px 0;
}
.chapter-card {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.4);
  cursor: grab;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.chapter-card:hover {
  border-color: rgba(56, 189, 248, 0.35);
}
.chapter-card.active {
  border-color: var(--accent);
  background: rgba(14, 165, 233, 0.1);
}
.chapter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.chapter-num {
  font-size: 11px;
  color: #38bdf8;
  font-weight: 600;
}
.chapter-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 8px;
  line-height: 1.35;
}
.chapter-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.chapter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.chapter-meta {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-enter {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(14, 165, 233, 0.12);
  color: #38bdf8;
  font-size: 11px;
  cursor: pointer;
}
.btn-enter:hover {
  background: rgba(14, 165, 233, 0.22);
}
.btn-enter.active {
  border-color: var(--accent);
  background: rgba(14, 165, 233, 0.25);
}
.sub-area-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.3);
}
.sub-area-card:hover {
  border-color: rgba(148, 163, 184, 0.35);
}
.sub-area-icon {
  font-size: 16px;
  line-height: 1;
}
.sub-area-body {
  flex: 1;
  min-width: 0;
}
.sub-area-name {
  font-size: 13px;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-area-meta {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}
.mode-btn.active {
  border-color: var(--accent);
  background: rgba(14, 165, 233, 0.2);
}
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}
.sub-title {
  font-size: 11px;
  color: var(--fg-tertiary);
  margin: 8px 0 4px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  margin-bottom: 6px;
}
.btn {
  padding: 5px 7px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.2);
  color: var(--fg-main);
  font-size: 12px;
  cursor: pointer;
}
.btn-primary {
  border-color: var(--accent-strong);
  background: rgba(14, 165, 233, 0.18);
}
.btn-accent {
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}
.item {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.item-row {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
  align-items: center;
}
.npc-order {
  font-size: 10px;
  color: var(--fg-tertiary);
  min-width: 22px;
}
.npc-hidden {
  font-size: 10px;
  color: var(--fg-tertiary);
  display: flex;
  align-items: center;
  gap: 2px;
}
.quest-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge-idle {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}
.badge-active {
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
}
.badge-done {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}
.badge-fail {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.item.active {
  border-color: var(--accent);
}
.btn-del,
.btn-mini {
  width: 22px;
  min-width: 22px;
  padding: 0;
  text-align: center;
  flex-shrink: 0;
}
.palette {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.palette-cat {
  font-size: 10px;
  color: #64748b;
  margin: 6px 0 4px;
  letter-spacing: 0.3px;
}
.palette-advanced {
  margin-top: 4px;
}
.palette-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  border: 1px dashed #334155;
  background: rgba(2, 6, 23, 0.25);
  color: var(--fg-main);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.palette-item:hover {
  border-color: rgba(56, 189, 248, 0.35);
  background: rgba(14, 165, 233, 0.08);
}
.palette-label {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}
.palette-desc {
  font-size: 10px;
  color: #64748b;
  line-height: 1.35;
}
.hint {
  font-size: 11px;
  color: var(--fg-tertiary);
  line-height: 1.45;
  margin: 0 0 8px;
}
.link-btn {
  width: 100%;
  margin: 4px 0 8px;
  padding: 5px;
  background: transparent;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: var(--radius-sm);
  color: var(--fg-secondary);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}
.section-toggle:hover {
  border-color: var(--accent);
  color: #cbd5e1;
}
</style>
