<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, provide, ref, watch } from "vue";
import type { Connection, Edge, Node, NodeDragEvent, NodeMouseEvent, EdgeChange, NodeChange } from "@vue-flow/core";
import { applyEdgeChanges, applyNodeChanges, useVueFlow } from "@vue-flow/core";
import { useRefHistory } from "@vueuse/core";

import type {
  CharacterAsset,
  GameMapDef,
  GameMapNpcDef,
  GraphData,
  GraphKind,
  NodeKind,
  ProjectData,
  QuestDef,
  ResourceEntry,
  ResourceKind,
  StoryMapRegion,
  StoryNode,
  VarType,
  VariableDef,
} from "../types";
import { createGraph, createNode, getOptionTargets, setOptionTargets } from "../types";
import {
  applyNodePositionToGraph,
  canDeleteStoryNode,
  connectGraphOption,
  deleteNodeFromGraph,
  disconnectGraphOption,
  getDeleteNodeBlockReason,
  graphToFlow,
  resolveFlowNodeId,
} from "./adapters";
import {
  assignNodeMapIdByPosition,
  createDefaultMapRegion,
  ensureGraphMaps,
  growMapToFitAssignedNodes,
  mapFlowNodeId,
  parseMapFlowNodeId,
  removeMapFromGraph,
  shrinkWrapMapToNodes,
} from "./mapLogic";
import { layoutMapGraphNodes, layoutZoneNodes } from "./graph-auto-layout";
import { detectMapChainIssues, repairMapChains } from "./map-chain-repair";
import { computeChainStepLabels } from "./chain-step-labels";
import { resolveLayoutZoneId } from "./layout-zone";
import { STORY_FLOW_ID } from "./flow-id";
import {
  expandSelectionToZoneGroup,
  inferZoneDragMode,
  findFlowNodeIdsInRect,
  selectionBoundsForNodeIds,
  type SelectionRect,
  type ZoneDragMode,
} from "./zone-selection";
import { MAP_FRAME_EDITOR_KEY } from "./mapInjection";
import { STORY_EDITOR_ACTIONS_KEY } from "./editorInjection";
import {
  clearStorage,
  loadFromStorage,
  saveToStorage,
  saveToStorageKeepalive,
  setLastKnownRemoteSavedAt,
  writeLocalWorkspace,
  type PersistedWorkspace,
} from "./persistence";
import type { PersistedWorkspaceProject } from "./persistence";
import { exportProjectMapPipeline, formatPipelineReport, auditProjectExportHealth, formatProjectExportHealthMessage, flattenProjectExportBlockers } from "./map-export-pipeline";
import {
  applyRuntimeShellFromMergeJson,
  buildMergeShellFromGameMap,
  importRuntimeMapIntoProject,
  parseRuntimeMapJson,
} from "./map-import";
import { fetchRuntimeMapTarget, publishMapJsonToRuntime } from "./cocos-map-publish";
import { DEFAULT_COCOS_GAME_MAP_IMAGE } from "./map-slice-layout";
import type { RuntimeMapConfig } from "./map-runtime";

import LeftPanel from "./components/LeftPanel.vue";
import Canvas from "./components/Canvas.vue";
import Inspector from "./components/Inspector.vue";
import ResourceLibrary from "./components/ResourceLibrary.vue";
import MapRuntimePanel from "./components/MapRuntimePanel.vue";
import AiAssistantFloating from "./components/AiAssistantFloating.vue";
import MapEditorView from "./components/MapEditorView.vue";
import AddNpcDialog from "./components/AddNpcDialog.vue";
import GlobalCheckRepairModal from "./components/GlobalCheckRepairModal.vue";
import { useGlobalRepair } from "./composables/useGlobalRepair";
import { createExportPublishActions } from "./composables/useExportPublish";
import { createMapEditingActions } from "./composables/useMapEditing";
import { useWorkspacePersistence } from "./composables/useWorkspace";
import { useGraphEditingStub } from "./composables/useGraphEditing";
useGraphEditingStub();
import {
  addNpcFromResource,
  createGameMapWithGraph,
  deleteGameMap,
  deleteNpcFromGameMap,
  ensureNpcZonesAndEntries,
  ensureProjectGameMaps,
  findEntryNodeById,
  findGameMapById,
  findGameMapForGraph,
  getGhostEntryNodesForGraph,
  isEntryNodeKind,
  taskLabelForNpc,
} from "./game-map-logic";
import { countIncomingEdgesToNode } from "./map-export";
import { migrateQuestBattlePatterns } from "./battle-split-migration";
import { wireMultiEnemyBattleChain } from "./npc-chain-presets";
import {
  ensureBattleEnemyBranch,
  materializeBattleEnemiesForGiver,
  materializeBattleEnemySpawnCoords,
  patchBattleEnemySpawn,
  removeBattleEnemyBranch,
  resolveNpcBattleChain,
} from "./battle-enemy-bind";
import { migrateGameMapTasksToQuests } from "./quest-logic";
import type { AiTarget } from "./ai/ai-target";
import { createChildGameMap, getMapAncestors, getTimelineGraph, ensureTimelineGraph } from "./map-tree";
import {
  createMapPortalWithGameMap,
  cleanupOrphanGameMaps,
  deleteMapPortal,
  migrateToTimeline,
  reconcileTimelineData,
  syncQuestsFromTimeline,
  unlinkGameMapFromTimeline,
} from "./timeline-logic";
import { quickCreateForGraph } from "./node-catalog";
import { assertNodeKindAllowedForNpc } from "./chain-slot-guards";
import { backfillChainSlotKinds } from "./chain-slot-kind";
import { repairQuestBattleIssues } from "./quest-battle-normalize";
import { ensureNpcAppear, normalizeNpcAppear } from "./npc-appear";
import NavBreadcrumb from "./components/NavBreadcrumb.vue";
import AppModal from "./components/AppModal.vue";
import { appAlert, appConfirm, appPrompt } from "./useModal";

function emptyProject(): ProjectData {
  const p: ProjectData = {
    variables: [],
    quests: [],
    characterAssets: [],
    graphs: [],
    gameMaps: [],
    resources: {},
  };
  ensureTimelineGraph(p);
  return p;
}

const project = ref<ProjectData>(emptyProject());
const projects = ref<PersistedWorkspaceProject[]>([]);
const currentProjectId = ref<string | null>(null);
const isHome = ref(true);
const isResourceLibraryOpen = ref(false);
const isMapRuntimeOpen = ref(false);
const isAiAssistantOpen = ref(false);
type EditorNavFrame = { level: "timeline" } | { level: "map"; gameMapId: string; viewMode: "map" | "story" };

const navigationStack = ref<EditorNavFrame[]>([{ level: "timeline" }]);
const editorViewMode = ref<"map" | "story">("story");

const currentNavFrame = computed(
  () => navigationStack.value[navigationStack.value.length - 1] ?? { level: "timeline" as const },
);
const isTimelineView = computed(() => currentNavFrame.value.level === "timeline");

const breadcrumbItems = computed(() => {
  const items: Array<{ label: string; id: string; level: "timeline" | "map" }> = [
    { label: "时间线", id: "timeline", level: "timeline" },
  ];
  const frame = currentNavFrame.value;
  if (frame.level === "map") {
    const ancestors = getMapAncestors(project.value, frame.gameMapId);
    for (const gm of ancestors) {
      items.push({ label: gm.mapName || gm.mapCode, id: gm.id, level: "map" });
    }
  }
  return items;
});

function navigateToTimeline() {
  navigationStack.value = [{ level: "timeline" }];
  const tl = getTimelineGraph(project.value);
  selectedGraphId.value = tl?.id ?? project.value.graphs[0]?.id ?? "";
  selectedGameMapId.value = null;
  editorViewMode.value = "story";
  clearNpcFocus();
  rebuildFlowFromGraph();
}

function drillDownToMap(gameMapId: string, viewMode: "map" | "story" = "map") {
  const gm = findGameMapById(project.value, gameMapId);
  if (!gm) return;
  const parentIdx = navigationStack.value.findIndex((f) => f.level === "map" && f.gameMapId === gameMapId);
  if (parentIdx >= 0) {
    navigationStack.value = navigationStack.value.slice(0, parentIdx + 1);
    const frame = navigationStack.value[parentIdx] as EditorNavFrame & { level: "map" };
    frame.viewMode = viewMode;
  } else {
    navigationStack.value.push({ level: "map", gameMapId, viewMode });
  }
  selectedGameMapId.value = gameMapId;
  selectedGraphId.value = gm.graphId;
  editorViewMode.value = viewMode;
  if (viewMode === "story") rebuildFlowFromGraph();
}

function onBreadcrumbNavigate(id: string, level: "timeline" | "map") {
  if (level === "timeline") navigateToTimeline();
  else drillDownToMap(id, editorViewMode.value);
}

function drillDownMapPortal(flowNodeId: string) {
  const tl = getTimelineGraph(project.value);
  const node = tl?.nodes.find((n) => n.id === flowNodeId);
  if (!node?.gameMapId) return;
  drillDownToMap(node.gameMapId, "map");
}

const selectedGameMapId = ref<string | null>(null);
const focusedNpcUid = ref<string | null>(null);
const selectedBattleGiverUid = ref<string | null>(null);
const selectedBattleSpawnUid = ref<string | null>(null);
const projectSearchKeyword = ref("");
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
const autosaveSuspended = ref(false);
/** 持久化进行中：抑制 project 深监听触发连环保存 */
let persistAutosaveSuppress = 0;
let dirtyWhilePersisting = false;
/** 上次成功写入磁盘的项目内容摘要（避免 sanitize 假修复导致无限保存） */
let lastPersistedProjectDigest = "";
const FLUSH_THROTTLE_MS = 150;
let saveChain: Promise<void> = Promise.resolve();
const saveStatus = ref<"idle" | "saving" | "synced" | "local-only" | "error">("idle");
const saveStatusDetail = ref("");
const projectExportBlockers = ref<string[]>([]);
const projectExportHealthOk = ref(true);
const storageOnline = ref(false);
const workspaceFilePath = ref("");
const bootRecoveryMessage = ref("");
const storageOfflineBanner = computed(() => workspaceHydrated.value && !storageOnline.value);
const bootRecoveryBanner = computed(() => workspaceHydrated.value && !!bootRecoveryMessage.value);
const exportBlockerBanner = computed(() => projectExportBlockers.value.length > 0);

const saveStatusLabel = computed(() => {
  if (saveStatus.value === "saving") return "保存中…";
  if (saveStatus.value === "error") return "保存失败";
  if (saveStatus.value === "local-only") return "仅浏览器缓存";
  if (saveStatus.value === "synced") {
    const short = workspaceFilePath.value ? workspaceFilePath.value.replace(/^.*[\\/]/, "") : "workspace.json";
    return `已同步 ${short}`;
  }
  if (storageOnline.value) return "已连接 storage";
  return "storage 未连接";
});
/** 未完成从本地/服务端恢复前，禁止自动保存（避免默认样例覆盖用户数据） */
const workspaceHydrated = ref(false);
const EDITOR_LAYOUT_PREFS_KEY = "story-editor:layout-prefs:v1";
const LEFT_PANEL_MIN = 220;
const LEFT_PANEL_MAX = 460;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 560;
const CENTER_MIN = 420;

const layoutEl = ref<HTMLElement | null>(null);
const leftPanelWidth = ref(280);
const rightPanelWidth = ref(340);
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);
const exportMenuOpen = ref(false);
const importMenuOpen = ref(false);
const moreMenuOpen = ref(false);
const mapEditorViewRef = ref<InstanceType<typeof MapEditorView> | null>(null);
const canvasRef = ref<InstanceType<typeof Canvas> | null>(null);

function closeToolbarMenus() {
  exportMenuOpen.value = false;
  importMenuOpen.value = false;
  moreMenuOpen.value = false;
}

function toggleToolbarMenu(menu: "export" | "import" | "more") {
  const next = menu === "export" ? exportMenuOpen : menu === "import" ? importMenuOpen : moreMenuOpen;
  closeToolbarMenus();
  next.value = !next.value;
}

function onFitView() {
  if (editorViewMode.value === "map" && isMapGraphActive.value) {
    mapEditorViewRef.value?.fitMapInView?.();
    return;
  }
  fitView({ padding: 0.2 });
}
const focusMode = ref(false);

function cloneProject(data: ProjectData): ProjectData {
  return JSON.parse(JSON.stringify(data)) as ProjectData;
}

type IntegrityReport = {
  fixedGraphIds: number;
  fixedNodeIds: number;
  fixedOptionIds: number;
  clearedInvalidLinks: number;
  removedDuplicateQuests: number;
  removedInvalidQuestRefs: number;
  removedInvalidCallTargets: number;
  fixedMapIds: number;
  clearedInvalidMapRefs: number;
  battleSplitMigrated: number;
  questBattleNormalized: number;
};

function createIntegrityReport(): IntegrityReport {
  return {
    fixedGraphIds: 0,
    fixedNodeIds: 0,
    fixedOptionIds: 0,
    clearedInvalidLinks: 0,
    removedDuplicateQuests: 0,
    removedInvalidQuestRefs: 0,
    removedInvalidCallTargets: 0,
    fixedMapIds: 0,
    clearedInvalidMapRefs: 0,
    battleSplitMigrated: 0,
    questBattleNormalized: 0,
  };
}

function sumIntegrityReport(r: IntegrityReport): number {
  return (
    r.fixedGraphIds +
    r.fixedNodeIds +
    r.fixedOptionIds +
    r.clearedInvalidLinks +
    r.removedDuplicateQuests +
    r.removedInvalidQuestRefs +
    r.removedInvalidCallTargets +
    r.fixedMapIds +
    r.clearedInvalidMapRefs +
    r.battleSplitMigrated +
    r.questBattleNormalized
  );
}

function sanitizeProjectData(input: ProjectData, report?: IntegrityReport): ProjectData {
  const data = cloneProject(input);
  data.variables = Array.isArray(data.variables) ? data.variables : [];
  data.quests = Array.isArray(data.quests) ? data.quests : [];
  data.graphs = Array.isArray(data.graphs) ? data.graphs : [];
  data.characterAssets = Array.isArray(data.characterAssets) ? data.characterAssets : [];
  data.resources = data.resources && typeof data.resources === "object" ? data.resources : {};
  data.gameMaps = Array.isArray(data.gameMaps) ? data.gameMaps : [];

  const allEntryNodeIds = new Set<string>();
  for (const g of data.graphs) {
    for (const n of g.nodes) {
      if (isEntryNodeKind(n.kind)) allEntryNodeIds.add(n.id);
    }
  }

  const assetIdSet = new Set<string>();
  data.characterAssets = data.characterAssets
    .map((a) => {
      const id = String(a?.id ?? "").trim() || `char_${crypto.randomUUID().slice(0, 8)}`;
      const name = String(a?.name ?? "").trim() || id;
      const image = typeof a?.image === "string" ? a.image.trim() : "";
      return { id, name, image };
    })
    .filter((a) => {
      if (assetIdSet.has(a.id)) return false;
      assetIdSet.add(a.id);
      return true;
    });

  const resourceKinds: ResourceKind[] = ["npc", "pet", "skill", "item", "dropTable", "battleConfig", "area"];
  const resourceIdSetByKind = new Map<ResourceKind, Set<string>>();
  for (const kind of resourceKinds) resourceIdSetByKind.set(kind, new Set<string>());

  for (const kind of resourceKinds) {
    const rawList = (data.resources as any)?.[kind];
    const list = Array.isArray(rawList) ? (rawList as any[]) : [];
    const seen = resourceIdSetByKind.get(kind)!;
    (data.resources as any)[kind] = list
      .map((r) => {
        const id = String(r?.id ?? "").trim() || `${kind}_${crypto.randomUUID().slice(0, 8)}`;
        const name = String(r?.name ?? "").trim() || id;
        const note = typeof r?.note === "string" ? r.note : "";
        const image = typeof r?.image === "string" ? r.image : "";
        const tileSizeRaw = r?.tileSize;
        const tileSize = Number.isFinite(Number(tileSizeRaw)) ? Number(tileSizeRaw) : undefined;
        const entry: ResourceEntry = { id, kind, name, note, image: image || undefined, tileSize };
        return entry;
      })
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
  }

  const graphIdSet = new Set<string>();
  for (const g of data.graphs) {
    let gid = (g.id ?? "").trim();
    if (!gid || graphIdSet.has(gid)) {
      gid = `g_${crypto.randomUUID()}`;
      if (report) report.fixedGraphIds += 1;
    }
    g.id = gid;
    graphIdSet.add(gid);
    g.name = (g.name ?? "").trim() || "新画布";
    g.nodes = Array.isArray(g.nodes) ? g.nodes : [];

    const nodeIdSet = new Set<string>();
    for (const n of g.nodes) {
      let nid = (n.id ?? "").trim();
      if (!nid || nodeIdSet.has(nid)) {
        nid = `node_${crypto.randomUUID()}`;
        if (report) report.fixedNodeIds += 1;
      }
      n.id = nid;
      nodeIdSet.add(nid);
      n.options = Array.isArray(n.options) ? n.options : [];

      const optIdSet = new Set<string>();
      for (const o of n.options) {
        let oid = (o.id ?? "").trim();
        if (!oid || optIdSet.has(oid)) {
          oid = `opt_${crypto.randomUUID()}`;
          if (report) report.fixedOptionIds += 1;
        }
        o.id = oid;
        optIdSet.add(oid);
      }
      if (g.kind === "timeline" && n.options.length === 0 && n.kind) {
        n.options = createNode({ kind: n.kind }).options;
        if (report) report.fixedOptionIds += n.options.length;
      }
    }

    const validNodeIds = new Set(g.nodes.map((n) => n.id));
    for (const n of g.nodes) {
      n.options = n.options.map((o) => {
        const before = getOptionTargets(o);
        const ids = before.filter((id) => validNodeIds.has(id));
        const removed = before.length - ids.length;
        if (removed && report) report.clearedInvalidLinks += removed;
        const next = { ...o };
        setOptionTargets(next, ids);
        return next;
      });
    }

    ensureGraphMaps(g);
    const mapIdSet = new Set<string>();
    const mapsArr = g.maps ?? [];
    for (const m of mapsArr) {
      let mid = String(m?.id ?? "").trim();
      if (!mid || mapIdSet.has(mid)) {
        mid = `map_${crypto.randomUUID().slice(0, 8)}`;
        if (report) report.fixedMapIds += 1;
      }
      m.id = mid;
      mapIdSet.add(mid);
      if (typeof m.name !== "string") m.name = "";
      m.x = Number.isFinite(m.x) ? m.x : 0;
      m.y = Number.isFinite(m.y) ? m.y : 0;
      m.width = Math.max(80, Number.isFinite(m.width) ? m.width : 400);
      m.height = Math.max(60, Number.isFinite(m.height) ? m.height : 300);
    }
    g.maps = mapsArr;

    for (const n of g.nodes) {
      if (n.mapId && !mapIdSet.has(n.mapId)) {
        delete n.mapId;
        if (report) report.clearedInvalidMapRefs += 1;
      }
      if (n.characterId && !assetIdSet.has(n.characterId)) {
        delete n.characterId;
      }
      if (n.npcId && !resourceIdSetByKind.get("npc")!.has(n.npcId)) delete n.npcId;
      if (n.petId && !resourceIdSetByKind.get("pet")!.has(n.petId)) delete n.petId;
      if (n.skillId && !resourceIdSetByKind.get("skill")!.has(n.skillId)) delete n.skillId;
      if (n.dropTableId && !resourceIdSetByKind.get("dropTable")!.has(n.dropTableId)) delete n.dropTableId;
      if (n.battleConfigId && !resourceIdSetByKind.get("battleConfig")!.has(n.battleConfigId)) delete n.battleConfigId;
      if (n.areaId && !resourceIdSetByKind.get("area")!.has(n.areaId)) delete n.areaId;
      if (!Number.isFinite(n.characterX as number)) delete n.characterX;
      if (!Number.isFinite(n.characterY as number)) delete n.characterY;
    }

    for (const n of g.nodes) {
      const sm = n.mapId;
      n.options = n.options.map((o) => {
        const before = getOptionTargets(o);
        const ids = before.filter((tid) => {
          if (allEntryNodeIds.has(tid)) return true;
          const tn = g.nodes.find((x) => x.id === tid);
          if (!tn) return false;
          return tn.mapId === sm;
        });
        const removed = before.length - ids.length;
        if (removed && report) report.clearedInvalidLinks += removed;
        const next = { ...o };
        setOptionTargets(next, ids);
        return next;
      });
    }
  }

  const questGraphIdSet = new Set(
    data.graphs
      .filter((g) => g.kind === "quest" || g.kind === "side" || g.kind === "map" || g.kind === "timeline")
      .map((g) => g.id),
  );
  const questIdSet = new Set<string>();
  data.quests = data.quests
    .filter((q) => q && typeof q.id === "string")
    .filter((q) => {
      if (questIdSet.has(q.id)) {
        if (report) report.removedDuplicateQuests += 1;
        return false;
      }
      questIdSet.add(q.id);
      return true;
    })
    .filter((q) => {
      const ok = questGraphIdSet.has(q.graphId);
      if (!ok && report) report.removedInvalidQuestRefs += 1;
      return ok;
    });

  migrateGameMapTasksToQuests(data);
  migrateToTimeline(data);

  const battleReport = migrateQuestBattlePatterns(data);
  if (report) {
    report.battleSplitMigrated += battleReport.migrated;
    report.questBattleNormalized +=
      battleReport.choiceOptionsFixed +
      battleReport.turnInEventDoneFixed +
      battleReport.battleAppearFixed;
  }

  for (const g of data.graphs) {
    for (const n of g.nodes) {
      if (n.kind === "callQuest" && Array.isArray(n.callQuestTargets)) {
        const before = n.callQuestTargets.length;
        n.callQuestTargets = n.callQuestTargets.filter((t) => {
          const [kind, id] = String(t).split(":");
          return (kind === "side" && graphIdSet.has(id)) || (kind === "quest" && questIdSet.has(id));
        });
        if (report) report.removedInvalidCallTargets += before - n.callQuestTargets.length;
      }
    }
  }

  for (const gm of data.gameMaps) {
    if (!gm.id) gm.id = `gm_${crypto.randomUUID().slice(0, 8)}`;
    if (!gm.graphId || !graphIdSet.has(gm.graphId)) {
      const g = data.graphs.find((x) => x.kind === "map" && x.id === gm.graphId);
      if (!g) {
        const ng = createGraph({
          id: gm.graphId || `graph_map_${crypto.randomUUID()}`,
          kind: "map",
          name: gm.mapName ?? gm.mapCode,
        });
        data.graphs.push(ng);
        gm.graphId = ng.id;
      }
    }
    gm.npcs = Array.isArray(gm.npcs) ? gm.npcs : [];
    gm.tileSize = Number.isFinite(gm.tileSize) ? gm.tileSize : 48;
    if (!Array.isArray(gm.linkedGraphIds)) gm.linkedGraphIds = [];
    else gm.linkedGraphIds = gm.linkedGraphIds.filter((id) => graphIdSet.has(id));
  }
  for (const gm of data.gameMaps) {
    const graph = data.graphs.find((g) => g.id === gm.graphId);
    if (graph) {
      for (const npc of gm.npcs) {
        if (!npc.zoneId) npc.zoneId = `zone_${npc.npcUid}`;
        if (!npc.entryNodeId) npc.entryNodeId = `entry_${npc.npcUid}`;
        if (!npc.exitNodeId) npc.exitNodeId = `exit_${npc.npcUid}`;
        ensureNpcAppear(npc);
      }
    }
  }

  const npcResList = ((data.resources as any)?.npc ?? []) as ResourceEntry[];
  const npcResIdSet = new Set(npcResList.map((r) => r.id));
  for (const gm of data.gameMaps) {
    const graph = data.graphs.find((g) => g.id === gm.graphId);
    for (const npc of gm.npcs) {
      if (!npc.npcResourceId && npcResIdSet.has(npc.npcUid)) npc.npcResourceId = npc.npcUid;
      const rid = npc.npcResourceId ?? npc.npcUid;
      const res = npcResList.find((r) => r.id === rid);
      const entry = graph?.nodes.find((n) => n.id === npc.entryNodeId);
      const entryTitle = entry?.title?.trim();
      const hasCustomTaskTitle = !!entryTitle && !/^任务 \d+$/.test(entryTitle);
      if (res && !hasCustomTaskTitle) npc.npcName = res.name;
      else if (hasCustomTaskTitle && entryTitle) npc.npcName = entryTitle;
    }
  }

  // Backward-compatible auto-fill for items referenced by nodes/actions.
  // This keeps "itemId" usable even if resources.item is empty.
  const itemSet = resourceIdSetByKind.get("item")!;
  const itemList = (data.resources as any)["item"] as ResourceEntry[];
  const addItemIfMissing = (id: string | undefined) => {
    const x = String(id ?? "").trim();
    if (!x) return;
    if (itemSet.has(x)) return;
    itemSet.add(x);
    itemList.push({ id: x, kind: "item", name: x, note: "" });
  };
  for (const g of data.graphs) {
    for (const n of g.nodes) {
      addItemIfMissing(n.itemId);
      for (const a of n.actions ?? []) {
        if (a.kind === "giveItem" || a.kind === "takeItem") addItemIfMissing(a.itemId);
      }
    }
  }

  for (const gm of data.gameMaps) {
    for (const npc of gm.npcs) {
      materializeBattleEnemySpawnCoords(data, gm, npc.npcUid);
    }
  }

  return data;
}

function buildWorkspacePayload() {
  return {
    version: 1 as const,
    savedAt: Date.now(),
    currentProjectId: currentProjectId.value,
    projects: projects.value,
  };
}

function projectContentDigest(data: ProjectData): string {
  return JSON.stringify(data);
}

function prepareCurrentProjectForSave(): PersistedWorkspace | null {
  if (!currentProjectId.value) return null;
  const idx = projects.value.findIndex((p) => p.id === currentProjectId.value);
  if (idx < 0) return null;
  const beforeDigest = projectContentDigest(project.value);
  const report = createIntegrityReport();
  const safeProject = sanitizeProjectData(project.value, report);
  const afterDigest = projectContentDigest(safeProject);
  if (afterDigest !== beforeDigest) {
    project.value = safeProject;
  }
  refreshProjectExportHealth(safeProject);
  projects.value[idx] = {
    ...projects.value[idx],
    updatedAt: Date.now(),
    data: cloneProject(safeProject),
  };
  return buildWorkspacePayload();
}

function beginPersistAutosaveSuppress(): void {
  persistAutosaveSuppress += 1;
}

function endPersistAutosaveSuppress(): void {
  persistAutosaveSuppress = Math.max(0, persistAutosaveSuppress - 1);
  if (persistAutosaveSuppress === 0 && dirtyWhilePersisting) {
    dirtyWhilePersisting = false;
    const digest = projectContentDigest(project.value);
    if (digest !== lastPersistedProjectDigest) {
      scheduleCurrentProjectSave();
    }
  }
}

function applyLoadedWorkspace(restoredWorkspace: PersistedWorkspace, _source?: string) {
  projects.value = restoredWorkspace.projects.map((p) => ({
    ...p,
    createdAt: p.createdAt ?? p.updatedAt,
    data: sanitizeProjectData(p.data),
  }));
  const targetId =
    restoredWorkspace.currentProjectId && projects.value.some((p) => p.id === restoredWorkspace.currentProjectId)
      ? restoredWorkspace.currentProjectId
      : projects.value[0]?.id;
  if (targetId) activateProjectById(targetId);
  setLastKnownRemoteSavedAt(restoredWorkspace.savedAt ?? 0);
  lastPersistedProjectDigest = projectContentDigest(project.value);
  resetEditorHistory();
  refreshProjectExportHealth(project.value);
  refreshFlowDimensions();
}

async function persistWorkspaceAsync(forceOverwrite = false): Promise<void> {
  if (!workspaceHydrated.value) return;
  beginPersistAutosaveSuppress();
  try {
    const payload = prepareCurrentProjectForSave();
    if (!payload) return;
    const active = payload.projects.find((p) => p.id === payload.currentProjectId);
    const digest = active?.data ? projectContentDigest(active.data) : "";
    if (!forceOverwrite && digest && digest === lastPersistedProjectDigest) {
      saveStatus.value = storageOnline.value ? "synced" : "local-only";
      return;
    }
    saveStatus.value = "saving";
    try {
      const result = await saveToStorage(payload, { forceOverwrite });
      if (result.local) {
        lastPersistedProjectDigest = digest;
      }
      if (result.remote) {
        storageOnline.value = true;
        saveStatus.value = "synced";
        saveStatusDetail.value = workspaceFilePath.value || "Juben/data/workspace.json";
        bootRecoveryMessage.value = "";
      } else if (result.errorCode === "CONFLICT") {
        if (!forceOverwrite) {
          if (result.diskSavedAt != null) setLastKnownRemoteSavedAt(result.diskSavedAt);
          await persistWorkspaceAsync(true);
          return;
        }
        saveStatus.value = "error";
        saveStatusDetail.value = "远端 workspace 已更新（双标签页冲突）";
        const reload = await appConfirm(
          `磁盘 workspace 已被其他标签页更新（savedAt=${result.diskSavedAt ?? "?"}）。\n\n重新加载远端数据？（取消则强制覆盖）`,
          "保存冲突",
        );
        if (reload) {
          const loaded = await loadFromStorage();
          if (loaded.workspace) {
            applyLoadedWorkspace(loaded.workspace, loaded.source);
            setLastKnownRemoteSavedAt(loaded.workspace.savedAt ?? 0);
          }
          saveStatus.value = "synced";
          saveStatusDetail.value = "已从远端重新加载";
        } else {
          await persistWorkspaceAsync(true);
        }
      } else if (result.errorCode === "VALIDATION") {
        saveStatus.value = "error";
        const details = (result.validationDetails ?? []).slice(0, 5).map((d) => `· ${d.path}: ${d.message}`);
        saveStatusDetail.value = result.error ?? "project.data 校验失败";
        void appAlert(
          `workspace 校验失败，未写入磁盘：\n${result.error ?? ""}${details.length ? "\n\n" + details.join("\n") : ""}`,
          "保存失败",
        );
      } else if (!storageOnline.value) {
        saveStatus.value = "local-only";
        saveStatusDetail.value = result.error || "请运行 npm run dev 以写入 workspace.json";
      } else {
        saveStatus.value = "error";
        saveStatusDetail.value = result.error || "写入 workspace.json 失败";
      }
    } catch (e) {
      saveStatus.value = "error";
      saveStatusDetail.value = e instanceof Error ? e.message : String(e);
    }
  } finally {
    endPersistAutosaveSuppress();
  }
}

function persistWorkspace() {
  saveChain = saveChain.then(() => persistWorkspaceAsync());
}

function flushCurrentProjectSave() {
  persistWorkspace();
}

function retrySave() {
  if (saveStatus.value === "error" || saveStatus.value === "local-only") {
    flushCurrentProjectSave();
  }
}

function flushToDiskKeepalive() {
  const payload = prepareCurrentProjectForSave();
  if (!payload) return;
  writeLocalWorkspace(payload);
  if (storageOnline.value) {
    saveToStorageKeepalive(payload);
  }
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    flushToDiskKeepalive();
  } else if (document.visibilityState === "visible" && workspaceHydrated.value) {
    flushCurrentProjectSave();
  }
}

function scheduleCurrentProjectSave() {
  if (!workspaceHydrated.value || !currentProjectId.value || autosaveSuspended.value) return;
  if (persistAutosaveSuppress > 0) {
    dirtyWhilePersisting = true;
    return;
  }
  const digest = projectContentDigest(project.value);
  if (digest === lastPersistedProjectDigest) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    flushCurrentProjectSave();
  }, FLUSH_THROTTLE_MS);
}

function onAiSuspendAutosave() {
  autosaveSuspended.value = true;
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

function onAiResumeAutosave() {
  autosaveSuspended.value = false;
  flushCurrentProjectSave();
}

function onAiExportAudit(_payload: { gameMapId: string; ok: boolean; errors: string[]; warnings: string[] }) {
  refreshProjectExportHealth(project.value);
}

function scheduleResourceSave() {
  scheduleCurrentProjectSave();
}

function activateProjectById(id: string) {
  const item = projects.value.find((p) => p.id === id);
  if (!item) return;
  if (currentProjectId.value && currentProjectId.value !== id) {
    flushCurrentProjectSave();
  }
  currentProjectId.value = id;
  project.value = sanitizeProjectData(item.data);
  lastPersistedProjectDigest = projectContentDigest(project.value);
  project.value.graphs.forEach(ensureGraphBoundaryNodes);
  syncQuestsFromTimeline(project.value);
  navigationStack.value = [{ level: "timeline" }];
  const tl = getTimelineGraph(project.value);
  selectedGraphId.value = tl?.id ?? project.value.graphs[0]?.id ?? "";
  selectedGameMapId.value = null;
  editorViewMode.value = "story";
  focusedNpcUid.value = null;
  selectedNodeId.value = tl?.nodes[0]?.id ?? project.value.graphs[0]?.nodes[0]?.id ?? null;
  selectedEdgeId.value = null;
  isResourceLibraryOpen.value = false;
  isMapRuntimeOpen.value = false;
  isAiAssistantOpen.value = false;
  isHome.value = false;
  rebuildFlowDeferred();
  resetEditorHistory();
  refreshProjectExportHealth(project.value);
  persistWorkspace();
}

function createNewProject() {
  const id = `proj_${crypto.randomUUID()}`;
  const now = Date.now();
  projects.value.unshift({
    id,
    name: nextUntitledName(),
    createdAt: now,
    updatedAt: now,
    data: emptyProject(),
  });
  activateProjectById(id);
  isResourceLibraryOpen.value = false;
  isMapRuntimeOpen.value = false;
  isAiAssistantOpen.value = false;
}

function goHome() {
  flushCurrentProjectSave();
  isResourceLibraryOpen.value = false;
  isMapRuntimeOpen.value = false;
  isAiAssistantOpen.value = false;
  isHome.value = true;
}

async function renameProject(id: string) {
  const item = projects.value.find((p) => p.id === id);
  if (!item) return;
  const nextName = (await appPrompt("请输入项目名称", item.name, "重命名项目"))?.trim();
  if (!nextName) return;
  item.name = nextName;
  item.updatedAt = Date.now();
  persistWorkspace();
}

async function deleteProjectEntry(id: string) {
  const item = projects.value.find((p) => p.id === id);
  if (!item) return;
  const ok = await appConfirm(`确认删除项目「${item.name}」吗？此操作不可撤销。`, "删除项目");
  if (!ok) return;
  projects.value = projects.value.filter((p) => p.id !== id);
  if (currentProjectId.value === id) {
    currentProjectId.value = null;
    isHome.value = true;
  }
  if (projects.value.length === 0) {
    createNewProject();
  } else {
    persistWorkspace();
  }
}

function nextUntitledName(): string {
  const used = new Set<number>();
  for (const p of projects.value) {
    const match = p.name.trim().match(/^未命名(?:\s+(\d+))?$/);
    if (!match) continue;
    const index = match[1] ? Number(match[1]) : 1;
    if (Number.isFinite(index) && index >= 1) used.add(index);
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return next === 1 ? "未命名" : `未命名 ${next}`;
}
const selectedGraphId = ref<string>(project.value.graphs[0]?.id ?? "");
const selectedMapId = ref<string | null>(null);
const selectedNodeId = ref<string | null>(project.value.graphs[0]?.nodes[0]?.id ?? null);
const selectedEdgeId = ref<string | null>(null);
const selectedNodeIds = ref<string[]>([]);
const selectedEdgeIds = ref<string[]>([]);
const lastSelectionRect = ref<SelectionRect | null>(null);
const ignoreNextPaneClick = ref(false);
const currentDragMode = ref<ZoneDragMode>("none");
const dragSnapshot = ref<{
  mode: ZoneDragMode;
  zoneId?: string;
  zoneStart?: { x: number; y: number };
  nodeStarts: Record<string, { x: number; y: number }>;
  primaryFlowId: string;
} | null>(null);
const layoutInProgress = ref(false);
const flowReady = ref(false);

const { fitView, zoomIn, zoomOut, screenToFlowCoordinate, setNodes, setEdges, updateNodeInternals } =
  useVueFlow(STORY_FLOW_ID);

const suppressSelectionChange = ref(false);
const canvasPaneEl = ref<HTMLElement | null>(null);
const contextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  flowX: number;
  flowY: number;
}>({
  open: false,
  x: 0,
  y: 0,
  flowX: 0,
  flowY: 0,
});
const nodeContextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  flowNodeId: string;
}>({
  open: false,
  x: 0,
  y: 0,
  flowNodeId: "",
});
const suppressNextContextMenu = ref(false);
const quickCreateKinds = computed(() => quickCreateForGraph(currentGraph.value?.kind));
const layoutStyle = computed(() => ({
  "--left-panel-width": `${leftPanelWidth.value}px`,
  "--right-panel-width": `${rightPanelWidth.value}px`,
}));
const currentGraph = computed<GraphData>(() => {
  const frame = currentNavFrame.value;
  if (frame.level === "timeline") {
    const tl = getTimelineGraph(project.value);
    if (tl) return tl;
  }
  if (frame.level === "map") {
    const gm = findGameMapById(project.value, frame.gameMapId);
    if (gm) {
      return project.value.graphs.find((g) => g.id === gm.graphId) ?? project.value.graphs[0];
    }
  }
  return getTimelineGraph(project.value) ?? project.value.graphs[0];
});
const selectionSummary = computed(() => {
  const ids = selectedNodeIds.value;
  if (ids.length > 1) {
    const inference = inferDragMode(ids);
    if (inference.mode === "zoneGroup" && inference.zoneId) {
      const inner = currentGraph.value.nodes.filter((n) => n.mapId === inference.zoneId).length;
      return `整组选中 · ${inner} 个节点`;
    }
    if (inference.mode === "innerPartial") return `局部选中 · ${ids.length} 个节点`;
    if (inference.mode === "mixed") return `已选 ${ids.length} 个节点（跨区）`;
    return `已选 ${ids.length} 个节点`;
  }
  if (selectedEdgeIds.value.length > 1) return `已选 ${selectedEdgeIds.value.length} 条连线`;
  if (selectedMapId.value) {
    const m = currentGraph.value.maps?.find((x) => x.id === selectedMapId.value);
    return `NPC 区域：${m?.name || m?.id || selectedMapId.value}`;
  }
  if (selectedNodeId.value) {
    const n = currentGraph.value.nodes.find((x) => x.id === selectedNodeId.value);
    return `节点：${n?.title || selectedNodeId.value}`;
  }
  if (selectedEdgeId.value) return "已选中连线";
  return "未选中对象";
});

const currentGameMap = computed(() => {
  if (selectedGameMapId.value) return findGameMapById(project.value, selectedGameMapId.value) ?? null;
  return findGameMapForGraph(project.value, currentGraph.value?.id ?? "") ?? null;
});
const focusedNpcZoneId = computed(() => {
  if (!focusedNpcUid.value || !currentGameMap.value) return null;
  const npc = currentGameMap.value.npcs.find((n) => n.npcUid === focusedNpcUid.value);
  return npc?.zoneId ?? null;
});
const focusedTaskLabel = computed(() => {
  const gm = currentGameMap.value;
  const uid = focusedNpcUid.value;
  if (!gm || !uid) return "";
  const idx = gm.npcs.findIndex((n) => n.npcUid === uid);
  const npc = gm.npcs[idx];
  if (!npc) return "";
  return taskLabelForNpc(project.value, gm, npc, idx);
});
const layoutZoneId = computed(() =>
  resolveLayoutZoneId({
    graph: currentGraph.value,
    selectedMapId: selectedMapId.value,
    selectedNodeId: selectedNodeId.value,
    selectedNodeIds: selectedNodeIds.value,
    focusedZoneId: focusedNpcZoneId.value,
  }),
);
const isMapGraphActive = computed(() => currentGraph.value?.kind === "map" && !!currentGameMap.value);
const incomingCountByEntry = computed(() => {
  const out: Record<string, number> = {};
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.kind === "npcEntry") {
        out[n.id] = countIncomingEdgesToNode(project.value.graphs, n.id);
      }
    }
  }
  return out;
});
const currentProjectMeta = computed(() => projects.value.find((p) => p.id === currentProjectId.value) ?? null);

provide(MAP_FRAME_EDITOR_KEY, {
  commitResizeDelta(mapId: string, dw: number, dh: number) {
    const g = currentGraph.value;
    ensureGraphMaps(g);
    const m = g.maps!.find((x) => x.id === mapId);
    if (!m) return;
    m.width = Math.max(80, m.width + dw);
    m.height = Math.max(60, m.height + dh);
    reassignAllNodeMapIdsForCurrentGraph();
  },
});

function canDeleteFlowNode(flowNodeId: string): boolean {
  if (flowNodeId.startsWith("__ghost__")) return false;
  const mapOnly = parseMapFlowNodeId(flowNodeId);
  if (mapOnly) return true;
  return canDeleteStoryNode(currentGraph.value, flowNodeId);
}

function collectSelectedFlowNodeIds(): string[] {
  if (selectedNodeIds.value.length) return [...selectedNodeIds.value];
  if (selectedNodeId.value) return [selectedNodeId.value];
  if (selectedMapId.value) return [mapFlowNodeId(selectedMapId.value)];
  return [];
}

function collectSelectedFlowEdgeIds(): string[] {
  if (selectedEdgeIds.value.length) return [...selectedEdgeIds.value];
  if (selectedEdgeId.value) return [selectedEdgeId.value];
  return [];
}

function notifyDeleteSkipped(reasons: string[]) {
  const unique = [...new Set(reasons.filter(Boolean))];
  if (unique.length === 0) return;
  void appAlert(unique.join("\n"));
}

function deleteFlowElements(nodeIds: string[], edgeIds: string[]) {
  closeContextMenu();
  closeNodeContextMenu();

  for (const id of edgeIds) {
    const edge = edges.value.find((x) => x.id === id);
    if (edge?.source && edge.sourceHandle && edge.target) {
      disconnectGraphOption(currentGraph.value, edge.source, edge.sourceHandle, edge.target);
    }
  }

  const skipped: string[] = [];
  let deletedNodes = 0;
  for (const id of nodeIds) {
    const mapOnly = parseMapFlowNodeId(id);
    if (mapOnly) {
      removeMapFromGraph(currentGraph.value, mapOnly);
      if (selectedMapId.value === mapOnly) selectedMapId.value = null;
      deletedNodes++;
      continue;
    }
    const result = deleteNodeFromGraph(currentGraph.value, id);
    if (result.ok) deletedNodes++;
    else skipped.push(result.reason);
  }

  if (edgeIds.length || deletedNodes) {
    selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
    selectedEdgeId.value = null;
    selectedNodeIds.value = [];
    selectedEdgeIds.value = [];
    rebuildFlowFromGraph();
  }

  notifyDeleteSkipped(skipped);
}

provide("storyProject", project);

provide(STORY_EDITOR_ACTIONS_KEY, {
  canDeleteFlowNode,
  requestDeleteNodes(flowNodeIds: string[]) {
    deleteFlowElements(flowNodeIds, []);
  },
  openNodeContextMenu(payload: { x: number; y: number; flowNodeId: string }) {
    closeContextMenu();
    const pane = canvasPaneEl.value;
    const rect = pane?.getBoundingClientRect();
    nodeContextMenu.value = {
      open: true,
      x: rect ? payload.x - rect.left : payload.x,
      y: rect ? payload.y - rect.top : payload.y,
      flowNodeId: payload.flowNodeId,
    };
  },
  drillDownMapPortal,
});

const hasDeletableSelection = computed(() => {
  if (selectedEdgeIds.value.length || selectedEdgeId.value) return true;
  const nodeIds = collectSelectedFlowNodeIds();
  if (nodeIds.length === 0) return !!selectedMapId.value;
  return nodeIds.some((id) => canDeleteFlowNode(id));
});
const filteredProjects = computed(() => {
  const keyword = projectSearchKeyword.value.trim().toLowerCase();
  return projects.value
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((item) => (keyword ? item.name.toLowerCase().includes(keyword) : true));
});

// Flow state for current graph
const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);

function ensureGraphBoundaryNodes(g: GraphData) {
  if (g.kind === "timeline") return;
  if (g.kind !== "quest" && g.kind !== "side") return;
  const hasEntry = g.nodes.some((n) => n.kind === "questEntry");
  const hasEnd = g.nodes.some((n) => n.kind === "taskEnd");
  if (!hasEntry) g.nodes.unshift(createNode({ kind: "questEntry", position: { x: 140, y: 140 } }));
  if (!hasEnd) g.nodes.push(createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 140 } }));
}

function ensureMapGraphNpcEntries() {
  for (const gm of ensureProjectGameMaps(project.value)) {
    ensureNpcZonesAndEntries(project.value, gm);
  }
}

function getIncomingEntryCount(nodeId: string): number {
  return countIncomingEdgesToNode(project.value.graphs, nodeId);
}

function resolveCallQuestTargetGraphIds(node: StoryNode): string[] {
  if (node.kind !== "callQuest") return [];
  const out: string[] = [];
  for (const t of node.callQuestTargets ?? []) {
    const [kind, id] = t.split(":");
    if (kind === "side") out.push(id);
    if (kind === "quest") {
      const q = project.value.quests.find((x) => x.id === id);
      if (q?.graphId) out.push(q.graphId);
    }
  }
  return out;
}

function getIncomingCallQuestCount(graphId: string): number {
  let count = 0;
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.kind !== "callQuest") continue;
      if (resolveCallQuestTargetGraphIds(n).includes(graphId)) count++;
    }
  }
  return count;
}

function rebuildFlowFromGraph() {
  ensureMapGraphNpcEntries();
  ensureGraphBoundaryNodes(currentGraph.value);
  const incomingQuestCount = getIncomingCallQuestCount(currentGraph.value.id);
  const ghostEntries = getGhostEntryNodesForGraph(project.value, currentGraph.value.id);
  const focusZone = focusedNpcZoneId.value;
  const stepLabels = new Map<string, string>();
  if (currentGraph.value.kind === "map" && currentGameMap.value) {
    for (const npc of currentGameMap.value.npcs) {
      const labels = computeChainStepLabels(currentGraph.value, npc.entryNodeId);
      labels.forEach((v, k) => stepLabels.set(k, v));
    }
  }

  const { nodes: n, edges: e } = graphToFlow(currentGraph.value, {
    allGraphs: project.value.graphs,
    ghostEntryNodes: ghostEntries,
    decorateNodeData: (node) => {
      const stepLabel = stepLabels.get(node.id);
      if (node.kind === "questEntry") {
        return {
          stepLabel,
          entryLinked: incomingQuestCount > 0,
          entryLinkCount: incomingQuestCount,
        };
      }
      if (node.kind === "npcEntry") {
        const c = getIncomingEntryCount(node.id);
        let appearLabel = "";
        if (currentGameMap.value && node.npcUid) {
          const npcDef = currentGameMap.value.npcs.find((n) => n.npcUid === node.npcUid);
          if (npcDef) {
            const appear = normalizeNpcAppear(npcDef);
            if (appear.mode === "always") appearLabel = "直接显示";
            else if (!(appear.requirements?.length ?? 0)) appearLabel = "隐藏";
            else appearLabel = "条件显示";
          }
        }
        return { stepLabel, entryLinked: c > 0, entryLinkCount: c, appearLabel };
      }
      if (node.kind === "npcExit") {
        const c = getIncomingEntryCount(node.id);
        return { stepLabel, entryLinked: c > 0, entryLinkCount: c };
      }
      if (focusZone && currentGraph.value.kind === "map") {
        const inZone = node.mapId === focusZone || (node.kind === "npcEntry" && node.mapId === focusZone);
        return { stepLabel, dimmed: !inZone };
      }
      return stepLabel ? { stepLabel } : {};
    },
  });
  const selectedIds = new Set([
    ...selectedNodeIds.value,
    ...(selectedNodeId.value ? [selectedNodeId.value] : []),
    ...(selectedMapId.value ? [mapFlowNodeId(selectedMapId.value)] : []),
  ]);
  const nextNodes = stampEditorSelection(n, selectedIds);
  nodes.value = nextNodes;
  edges.value = e;
  if (flowReady.value) {
    setNodes(nextNodes);
    setEdges(e);
  }
}

function rebuildFlowDeferred() {
  nextTick(() => {
    requestAnimationFrame(() => {
      rebuildFlowFromGraph();
      refreshFlowDimensions();
    });
  });
}

function refreshFlowDimensions() {
  if (!flowReady.value) return;
  nextTick(() => {
    requestAnimationFrame(() => {
      canvasRef.value?.refreshFlowDimensions?.();
    });
  });
}

let flowResizeObserver: ResizeObserver | null = null;

watch(canvasPaneEl, (el) => {
  flowResizeObserver?.disconnect();
  flowResizeObserver = null;
  if (!el || typeof ResizeObserver === "undefined") return;
  flowResizeObserver = new ResizeObserver(() => refreshFlowDimensions());
  flowResizeObserver.observe(el);
});

watch(selectedGraphId, () => {
  selectedMapId.value = null;
  selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
  selectedEdgeId.value = null;
  if (flowReady.value) rebuildFlowDeferred();
  else rebuildFlowFromGraph();
});

// initial
rebuildFlowFromGraph();

watch(
  project,
  () => {
    // 资源库/模拟器/JSON 面板中编辑项目元数据时，不要重建画布（会触发重渲染导致输入框回滚）
    if (persistAutosaveSuppress > 0) return;
    if (isResourceLibraryOpen.value || isMapRuntimeOpen.value) return;
    if (flowReady.value) rebuildFlowDeferred();
    else rebuildFlowFromGraph();
  },
  { deep: true },
);

// Undo/Redo on project data (deep)
const history = useRefHistory(project, { deep: true, capacity: 60 });

function countProjectContent(data: ProjectData): number {
  let total = 0;
  for (const g of data.graphs ?? []) total += g.nodes?.length ?? 0;
  for (const gm of data.gameMaps ?? []) total += gm.npcs?.length ?? 0;
  return total;
}

function performUndo() {
  if (!history.canUndo.value) return;
  const before = countProjectContent(project.value);
  history.undo();
  const after = countProjectContent(project.value);
  if (before >= 1 && after === 0) {
    history.redo();
    void appAlert("本次撤销会清空当前项目内容，已自动取消。若刚才误点了撤销，可再试一次或按 Ctrl+Shift+Z 重做。");
    return;
  }
  rebuildFlowFromGraph();
}

function performRedo() {
  if (!history.canRedo.value) return;
  history.redo();
  rebuildFlowFromGraph();
}

function resetEditorHistory() {
  history.pause();
  history.clear();
  history.resume(false);
}

function addGraph(kind: GraphKind) {
  const graphId = `g_${kind}_${crypto.randomUUID()}`;
  const defaultName =
    kind === "mainline"
      ? "主线：新画布"
      : kind === "side"
        ? "支线：新画布"
        : kind === "map"
          ? "地图：新地图"
          : "任务：新任务";
  const g = createGraph({
    id: graphId,
    kind,
    name: defaultName,
    nodes: [],
  });
  if (kind === "quest") {
    g.nodes = [
      createNode({ kind: "questEntry", position: { x: 160, y: 120 } }),
      createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 120 } }),
    ];
  }
  if (kind === "side") {
    g.nodes = [
      createNode({ kind: "questEntry", position: { x: 160, y: 120 } }),
      createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 120 } }),
    ];
  }
  project.value.graphs.push(g);
  if (kind === "quest" || kind === "side") {
    const qid = `q_${crypto.randomUUID()}`;
    project.value.quests.push({
      id: qid,
      name: g.name.replace(/^任务：/, "") || "新任务",
      initialStatus: "NotStarted",
      graphId: g.id,
    });
  }
  syncQuestDefsWithGraphs();
  selectedGraphId.value = g.id;
}

function deleteGraph(graphId: string) {
  const g = project.value.graphs.find((x) => x.id === graphId);
  if (!g) return;
  if (g.kind === "mainline" && project.value.graphs.filter((x) => x.kind === "mainline").length <= 1) return;

  project.value.graphs = project.value.graphs.filter((x) => x.id !== graphId);
  if (g.kind === "quest") {
    project.value.quests = project.value.quests.filter((q) => q.graphId !== graphId);
  }
  for (const gr of project.value.graphs) {
    for (const n of gr.nodes) {
      if (n.kind === "callQuest" && n.startGraphId === graphId) {
        n.startGraphId = undefined;
        n.questId = undefined;
      }
      if (n.kind === "callQuest" && n.callQuestTargets?.length) {
        n.callQuestTargets = n.callQuestTargets.filter((t) => {
          const [kind, id] = t.split(":");
          return (
            !(kind === "side" && id === graphId) &&
            !(kind === "quest" && project.value.quests.find((q) => q.id === id)?.graphId === graphId)
          );
        });
      }
      n.options = n.options.map((o) => {
        const validInGraph = new Set(gr.nodes.map((x) => x.id));
        const kept = getOptionTargets(o).filter((id) => validInGraph.has(id));
        const next = { ...o };
        setOptionTargets(next, kept);
        return next;
      });
    }
  }
  syncQuestDefsWithGraphs();
  if (selectedGraphId.value === graphId) {
    selectedGraphId.value = project.value.graphs[0]?.id ?? "";
  }
  rebuildFlowFromGraph();
}

function renameGraphName(graphId: string, name: string) {
  const next = name.trim();
  if (!next) return;
  const graph = project.value.graphs.find((x) => x.id === graphId);
  if (!graph || graph.name === next) return;
  graph.name = next;
  if (graph.kind === "quest" || graph.kind === "side") {
    const quest = project.value.quests.find((q) => q.graphId === graph.id);
    if (quest) {
      const questName = next.replace(/^任务[:：]\s*/, "").trim() || next;
      quest.name = questName;
    }
  }
}

function syncQuestDefsWithGraphs() {
  syncQuestsFromTimeline(project.value);
}

function addGlobalQuest() {
  const { portal } = createMapPortalWithGameMap(project.value);
  selectedNodeId.value = portal.id;
  rebuildFlowFromGraph();
}

function openQuestDetail(questId: string) {
  const q = project.value.quests.find((x) => x.id === questId);
  const gm = q ? ensureProjectGameMaps(project.value).find((m) => m.graphId === q.graphId) : undefined;
  if (gm) drillDownToMap(gm.id, "story");
}

function selectGraph(id: string) {
  selectedGraphId.value = id;
  const gm = findGameMapForGraph(project.value, id);
  if (gm) selectedGameMapId.value = gm.id;
  const g = project.value.graphs.find((x) => x.id === id);
  if (g?.kind === "map") {
    editorViewMode.value = editorViewMode.value === "story" ? "story" : "map";
  } else {
    editorViewMode.value = "story";
  }
  isResourceLibraryOpen.value = false;
}

function openResourceLibrary() {
  isMapRuntimeOpen.value = false;
  isAiAssistantOpen.value = false;
  isResourceLibraryOpen.value = true;
}

function closeResourceLibrary() {
  flushCurrentProjectSave();
  isResourceLibraryOpen.value = false;
  rebuildFlowFromGraph();
}

function openMapRuntime() {
  isResourceLibraryOpen.value = false;
  isAiAssistantOpen.value = false;
  isMapRuntimeOpen.value = true;
}

function closeMapRuntime() {
  isMapRuntimeOpen.value = false;
}

function openAiAssistant() {
  isResourceLibraryOpen.value = false;
  isMapRuntimeOpen.value = false;
  isAiAssistantOpen.value = true;
}

function closeAiAssistant() {
  isAiAssistantOpen.value = false;
}

function onGlobalCheckRepairDone() {
  refreshProjectExportHealth(project.value);
  flushCurrentProjectSave();
  setTimeout(() => {
    rebuildFlowFromGraph();
    void nextTick().then(() => updateNodeInternals());
  }, 0);
}

function onGlobalCheckNavigateNpc(payload: { gameMapId: string; npcUid: string }) {
  drillDownToMap(payload.gameMapId, "map");
  onMapNpcSelect(payload.npcUid);
  globalCheckRepairOpen.value = false;
}

function onAiRebuild() {
  rebuildFlowFromGraph();
}

function onAiPauseHistory() {
  history.pause();
}

function onAiResumeHistory() {
  history.resume();
}

const aiNavContext = computed(() => ({
  isTimeline: isTimelineView.value,
  gameMapId: selectedGameMapId.value ?? currentGameMap.value?.id ?? null,
  focusNpcUid: focusedNpcUid.value,
}));

const aiSelectedNodeIds = computed(() => {
  if (selectedNodeIds.value.length) return [...selectedNodeIds.value];
  if (selectedNodeId.value) return [selectedNodeId.value];
  return [];
});

function navigateToAiTarget(target: AiTarget) {
  if (target.scope === "timeline") {
    navigateToTimeline();
    return;
  }
  drillDownToMap(target.gameMapId, "story");
  if (target.npcUid) {
    focusNpcStory(target.npcUid);
  }
}

function onAiFocusNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  selectedNodeIds.value = [nodeId];
  rebuildFlowFromGraph();
  void nextTick(() => {
    fitView({ nodes: [nodeId], padding: 0.4, duration: 200 });
  });
}

function switchEditorViewMode(mode: "map" | "story") {
  editorViewMode.value = mode;
  if (mode === "map") {
    if (!selectedGameMapId.value) {
      const first = ensureProjectGameMaps(project.value)[0];
      if (first) selectGameMap(first.id);
    }
  }
}

function onLeftPanelSwitchView(mode: "map" | "story") {
  const frame = currentNavFrame.value;
  if (frame.level !== "map") return;
  frame.viewMode = mode;
  editorViewMode.value = mode;
  if (mode === "story") {
    if (focusedNpcUid.value) {
      focusNpcStory(focusedNpcUid.value);
      return;
    }
    if (currentGameMap.value?.npcs[0]) {
      focusNpcStory(currentGameMap.value.npcs[0]!.npcUid);
      return;
    }
    rebuildFlowFromGraph();
  }
}

function selectGameMap(id: string) {
  drillDownToMap(id, editorViewMode.value === "story" ? "story" : "map");
}

function patchGameMap(gameMapId: string, patch: Partial<GameMapDef>) {
  const gm = findGameMapById(project.value, gameMapId);
  if (!gm) return;
  if (patch.mapName !== undefined) gm.mapName = patch.mapName;
  if (patch.mapCode !== undefined) gm.mapCode = patch.mapCode;
  if (patch.mapId !== undefined) gm.mapId = patch.mapId;
  if (patch.imagePath !== undefined) gm.imagePath = patch.imagePath;
  if ("imageSlices" in patch) {
    if (patch.imageSlices?.length) gm.imageSlices = [...patch.imageSlices];
    else delete gm.imageSlices;
  }
  if (patch.tileSize !== undefined) gm.tileSize = patch.tileSize;
  if (patch.tasks !== undefined) gm.tasks = patch.tasks;
  const g = project.value.graphs.find((x) => x.id === gm.graphId);
  if (g && patch.mapName) g.name = patch.mapName;
}

function linkGraphToMap(gameMapId: string, graphId: string) {
  const gm = findGameMapById(project.value, gameMapId);
  if (!gm || !project.value.graphs.some((g) => g.id === graphId)) return;
  if (!gm.linkedGraphIds) gm.linkedGraphIds = [];
  if (!gm.linkedGraphIds.includes(graphId)) gm.linkedGraphIds.push(graphId);
}

function unlinkGraphFromMap(gameMapId: string, graphId: string) {
  const gm = findGameMapById(project.value, gameMapId);
  if (!gm?.linkedGraphIds) return;
  gm.linkedGraphIds = gm.linkedGraphIds.filter((id) => id !== graphId);
}

function addGameMapEntry() {
  const { gameMap } = createGameMapWithGraph(project.value, {
    mapName: "新游戏地图",
    mapCode: `map_${Date.now()}`,
    mapId: ensureProjectGameMaps(project.value).length + 1,
    ...DEFAULT_COCOS_GAME_MAP_IMAGE,
    linkedGraphIds: [],
  });
  selectedGameMapId.value = gameMap.id;
  selectedGraphId.value = gameMap.graphId;
  editorViewMode.value = "map";
}

async function deleteGameMapEntry(id: string) {
  const gm = findGameMapById(project.value, id);
  if (!gm) return;
  const ok = await appConfirm(`确认删除地图「${gm.mapName || gm.mapCode}」？`, "删除地图");
  if (!ok) return;
  unlinkGameMapFromTimeline(project.value, id);
  deleteGameMap(project.value, id);
  reconcileTimelineData(project.value);
  if (selectedGameMapId.value === id) {
    selectedGameMapId.value = ensureProjectGameMaps(project.value)[0]?.id ?? null;
    if (selectedGameMapId.value) selectGameMap(selectedGameMapId.value);
  }
  rebuildFlowFromGraph();
}

const { globalCheckRepairOpen, openGlobalCheckRepair, closeGlobalCheckRepair } = useGlobalRepair();
const addNpcDialogOpen = ref(false);

const npcResources = computed(() => project.value.resources?.npc ?? []);
const placedNpcCountByResourceId = computed(() => {
  const gm = currentGameMap.value;
  const counts: Record<string, number> = {};
  if (!gm) return counts;
  for (const n of gm.npcs) {
    const rid = n.npcResourceId ?? n.npcUid;
    counts[rid] = (counts[rid] ?? 0) + 1;
  }
  return counts;
});

function openAddNpcDialog() {
  if (npcResources.value.length === 0) {
    void appAlert("请先在「资源 → NPC」中添加 NPC 资源，再摆点到地图。");
    return;
  }
  addNpcDialogOpen.value = true;
}

function onAddNpcFromResource(payload: {
  resourceId: string;
  prefabKey?: string;
  chainPreset: import("./npc-chain-presets").NpcChainPreset;
  battleRef?: string;
}) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const result = addNpcFromResource(project.value, gm, payload.resourceId, {
    prefabKey: payload.prefabKey,
    chainPreset: payload.chainPreset,
    battleRef: payload.battleRef,
  });
  if (!result) {
    void appAlert("添加失败：资源不存在。");
    return;
  }
  addNpcDialogOpen.value = false;
  if (payload.chainPreset === "battleEncounter") {
    focusNpcStory(result.giver.npcUid);
    if (result.giver.zoneId) {
      selectedMapId.value = result.giver.zoneId;
    }
  }
  rebuildFlowFromGraph();
}

function promptAddGameMapNpc() {
  openAddNpcDialog();
}

async function deleteGameMapNpcEntry(npcUid: string) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const npc = gm.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const idx = gm.npcs.indexOf(npc);
  const label = taskLabelForNpc(project.value, gm, npc, idx);
  const ok = await appConfirm(`删除任务「${label}」及其剧情链、入口节点？`, "删除任务");
  if (!ok) return;
  deleteNpcFromGameMap(project.value, gm, npcUid);
  if (focusedNpcUid.value === npcUid) clearNpcFocus();
  if (selectedMapId.value === npc.zoneId) selectedMapId.value = null;
  rebuildFlowFromGraph();
}

function patchTaskEntryTitle(npcUid: string, title: string) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const npc = gm.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const trimmed = title.trim();
  if (!trimmed) return;
  const graph = project.value.graphs.find((g) => g.id === gm.graphId);
  const entry = graph?.nodes.find((n) => n.id === npc.entryNodeId);
  if (entry) entry.title = trimmed;
  npc.npcName = trimmed;
  ensureNpcZonesAndEntries(project.value, gm);
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function patchGameMapNpc(npcUid: string, patch: Partial<GameMapNpcDef>) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const npc = gm.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const prevSlotKind = npc.chainSlotKind;
  if (patch.appear !== undefined) {
    npc.appear = patch.appear as GameMapNpcDef["appear"];
    if (npc.initialHidden !== undefined) delete npc.initialHidden;
  }
  if (patch.npcName !== undefined) {
    Object.assign(npc, { npcName: patch.npcName });
    ensureNpcZonesAndEntries(project.value, gm);
    rebuildFlowFromGraph();
    return;
  }
  const movesCoords = patch.x !== undefined || patch.y !== undefined;
  if (movesCoords) {
    materializeBattleEnemiesForGiver(project.value, gm, npcUid);
  }
  Object.assign(npc, patch);
  if (patch.chainSlotKind && patch.chainSlotKind !== prevSlotKind) {
    const graph = currentGraph.value;
    if (graph?.kind === "map") {
      repairQuestBattleIssues(project.value, graph, gm);
      rebuildFlowFromGraph();
    }
  }
  if (movesCoords) {
    scheduleCurrentProjectSave();
  }
}

function patchTimelinePortalNode(nodeId: string, title: string) {
  const tl = getTimelineGraph(project.value);
  const node = tl?.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const trimmed = title.trim();
  if (!trimmed) return;
  node.title = trimmed;
  if (node.gameMapId) {
    const gm = ensureProjectGameMaps(project.value).find((m) => m.id === node.gameMapId);
    if (gm) {
      gm.mapName = trimmed;
      const mapGraph = project.value.graphs.find((g) => g.id === gm.graphId);
      if (mapGraph) mapGraph.name = trimmed;
    }
  }
  syncQuestsFromTimeline(project.value);
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function onReorderGlobalQuest(payload: { fromIndex: number; toIndex: number }) {
  const tl = getTimelineGraph(project.value);
  if (!tl) return;
  const portals = tl.nodes.filter((n) => n.kind === "mapPortal");
  const from = payload.fromIndex;
  const to = payload.toIndex;
  if (from < 0 || from >= portals.length || to < 0 || to >= portals.length) return;
  const [item] = portals.splice(from, 1);
  portals.splice(to, 0, item);
  const others = tl.nodes.filter((n) => n.kind !== "mapPortal");
  tl.nodes = [...portals, ...others];
  syncQuestsFromTimeline(project.value);
  rebuildFlowFromGraph();
}

function addChildGameMapEntry(parentGameMapId: string | null) {
  const { gameMap } = createChildGameMap(project.value, parentGameMapId);
  drillDownToMap(gameMap.id, "map");
}

function focusNpcStory(npcUid: string) {
  focusedNpcUid.value = npcUid;
  selectedBattleGiverUid.value = null;
  selectedBattleSpawnUid.value = null;
  const gm = currentGameMap.value;
  if (gm) {
    const npc = gm.npcs.find((n) => n.npcUid === npcUid);
    if (npc) selectedMapId.value = npc.zoneId;
  }
  editorViewMode.value = "story";
  rebuildFlowFromGraph();
  nextTick(() => {
    const zone = currentGraph.value.maps?.find((m) => m.npcUid === npcUid);
    if (zone) fitView({ nodes: [`__map__${zone.id}`], padding: 0.3, duration: 200 });
  });
}

function clearNpcFocus() {
  focusedNpcUid.value = null;
  selectedBattleGiverUid.value = null;
  selectedBattleSpawnUid.value = null;
  selectedMapId.value = null;
  rebuildFlowFromGraph();
}

function onSelectBattleEnemy(payload: string | { giverNpcUid: string; spawnUid?: string }) {
  const giverNpcUid = typeof payload === "string" ? payload : payload.giverNpcUid;
  const spawnUid = typeof payload === "string" ? undefined : payload.spawnUid;
  const gm = currentGameMap.value;
  if (gm && !resolveNpcBattleChain(project.value, gm, giverNpcUid)) {
    ensureBattleEnemyBranch(project.value, gm, giverNpcUid);
    rebuildFlowFromGraph();
  }
  focusedNpcUid.value = giverNpcUid;
  selectedBattleGiverUid.value = giverNpcUid;
  selectedBattleSpawnUid.value = spawnUid ?? null;
  const npc = gm?.npcs.find((n) => n.npcUid === giverNpcUid);
  if (npc) selectedMapId.value = npc.zoneId;
  if (editorViewMode.value !== "map") {
    editorViewMode.value = "map";
  }
}

function onFocusBattleNode(giverNpcUid: string) {
  focusNpcStory(giverNpcUid);
  const gm = currentGameMap.value;
  if (!gm) return;
  const bind = resolveNpcBattleChain(project.value, gm, giverNpcUid);
  const focusId = bind?.battleNodeId ?? bind?.enemyAppearNodeId;
  if (focusId) {
    selectedNodeIds.value = [focusId];
    syncFlowNodeSelection([focusId]);
  }
  selectedBattleGiverUid.value = giverNpcUid;
}

function onAddBattleBranch(giverNpcUid: string) {
  const gm = currentGameMap.value;
  if (!gm) return;
  ensureBattleEnemyBranch(project.value, gm, giverNpcUid);
  onSelectBattleEnemy(giverNpcUid);
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function onAddMultiBattleBranch(payload: { giverNpcUid: string; enemyCount: number }) {
  const gm = currentGameMap.value;
  if (!gm) return;
  const npc = gm.npcs.find((n) => n.npcUid === payload.giverNpcUid);
  if (!npc) return;
  wireMultiEnemyBattleChain(project.value, gm, npc, { enemyCount: payload.enemyCount });
  onSelectBattleEnemy(payload.giverNpcUid);
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function onDeleteBattleBranch(giverNpcUid: string) {
  const gm = currentGameMap.value;
  if (!gm) return;
  removeBattleEnemyBranch(project.value, gm, giverNpcUid);
  if (selectedBattleGiverUid.value === giverNpcUid) {
    selectedBattleGiverUid.value = null;
  }
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function onPatchBattleEnemy(payload: {
  giverNpcUid: string;
  patch: { x?: number; y?: number; prefabKey?: string; npcName?: string; npcUid?: string };
}) {
  const gm = currentGameMap.value;
  if (!gm) return;
  materializeBattleEnemySpawnCoords(project.value, gm, payload.giverNpcUid);
  const spawnUid = payload.patch.npcUid ?? selectedBattleSpawnUid.value ?? undefined;
  const result = patchBattleEnemySpawn(project.value, gm, payload.giverNpcUid, {
    ...payload.patch,
    npcUid: spawnUid,
  });
  if (!result.ok) {
    void appAlert(result.reason, "战斗摆点保存失败");
    return;
  }
  scheduleCurrentProjectSave();
}

function onMapNpcSelect(npcUid: string) {
  focusedNpcUid.value = npcUid;
  selectedBattleGiverUid.value = null;
  selectedBattleSpawnUid.value = null;
  const gm = currentGameMap.value;
  const npc = gm?.npcs.find((n) => n.npcUid === npcUid);
  if (npc) selectedMapId.value = npc.zoneId;
}

function addMapRegion() {
  const g = currentGraph.value;
  ensureGraphMaps(g);
  const reg = createDefaultMapRegion();
  g.maps!.push(reg);
  selectedMapId.value = reg.id;
}

function deleteMapRegion(id: string) {
  removeMapFromGraph(currentGraph.value, id);
  if (selectedMapId.value === id) selectedMapId.value = null;
}

function patchMapRegion(id: string, patch: Partial<StoryMapRegion>) {
  const g = currentGraph.value;
  ensureGraphMaps(g);
  const m = g.maps!.find((x) => x.id === id);
  if (!m) return;
  if (patch.name !== undefined) m.name = patch.name;
  if (patch.x !== undefined) {
    const v = Number(patch.x);
    if (Number.isFinite(v)) m.x = v;
  }
  if (patch.y !== undefined) {
    const v = Number(patch.y);
    if (Number.isFinite(v)) m.y = v;
  }
  if (patch.width !== undefined) {
    const v = Number(patch.width);
    if (Number.isFinite(v)) m.width = Math.max(80, v);
  }
  if (patch.height !== undefined) {
    const v = Number(patch.height);
    if (Number.isFinite(v)) m.height = Math.max(60, v);
  }
}

function renameMapRegionId(oldId: string, newId: string) {
  const trimmed = newId.trim();
  if (!trimmed || trimmed === oldId) return;
  const g = currentGraph.value;
  ensureGraphMaps(g);
  if (g.maps!.some((x) => x.id === trimmed)) {
    void appAlert("地图 ID 已存在");
    return;
  }
  const m = g.maps!.find((x) => x.id === oldId);
  if (!m) return;
  m.id = trimmed;
  for (const n of g.nodes) {
    if (n.mapId === oldId) n.mapId = trimmed;
  }
  if (selectedMapId.value === oldId) selectedMapId.value = trimmed;
  rebuildFlowFromGraph();
}

function fitMapRegion(id: string) {
  shrinkWrapMapToNodes(currentGraph.value, id);
  rebuildFlowFromGraph();
}

function selectMapId(id: string | null) {
  selectedMapId.value = id;
  if (id) {
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
    selectedNodeIds.value = [mapFlowNodeId(id)];
    selectedEdgeIds.value = [];
    syncFlowNodeSelection([mapFlowNodeId(id)]);
    return;
  }
  selectedNodeId.value = null;
  selectedEdgeId.value = null;
  selectedNodeIds.value = [];
  selectedEdgeIds.value = [];
  syncFlowNodeSelection([]);
}

function addCharacterAsset() {
  const list = (project.value.characterAssets ??= []);
  const id = `char_${crypto.randomUUID().slice(0, 8)}`;
  list.push({ id, name: "新角色", image: "" });
  scheduleResourceSave();
}

function deleteCharacterAsset(id: string) {
  project.value.characterAssets = (project.value.characterAssets ?? []).filter((x) => x.id !== id);
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.characterId === id) delete n.characterId;
    }
  }
  scheduleResourceSave();
}

function patchCharacterAsset(id: string, patch: Partial<CharacterAsset>) {
  const list = (project.value.characterAssets ??= []);
  const item = list.find((x) => x.id === id);
  if (!item) return;
  if (patch.name !== undefined) item.name = patch.name;
  if (patch.image !== undefined) item.image = patch.image;
  scheduleResourceSave();
}

function renameCharacterAssetId(oldId: string, newId: string) {
  const next = newId.trim();
  if (!next || next === oldId) return;
  const list = (project.value.characterAssets ??= []);
  if (list.some((x) => x.id === next)) {
    void appAlert("角色 ID 已存在");
    return;
  }
  const item = list.find((x) => x.id === oldId);
  if (!item) return;
  item.id = next;
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.characterId === oldId) n.characterId = next;
    }
  }
  scheduleResourceSave();
}

function addVariable() {
  const used = new Set(project.value.variables.map((v) => v.id));
  let next = 1;
  while (used.has(`var_${next}`)) next += 1;
  const id = `var_${next}`;
  project.value.variables.push({
    id,
    name: `变量${next}`,
    type: "bool",
    initialValue: false,
  });
  scheduleResourceSave();
}

function patchVariable(id: string, patch: Partial<VariableDef>) {
  const item = project.value.variables.find((v) => v.id === id);
  if (!item) return;
  if (patch.name !== undefined) item.name = patch.name;
  if (patch.type !== undefined) item.type = patch.type as VarType;
  if (patch.initialValue !== undefined) {
    if (item.type === "bool") item.initialValue = Boolean(patch.initialValue);
    else if (item.type === "number") item.initialValue = Number(patch.initialValue || 0);
    else item.initialValue = String(patch.initialValue ?? "");
  }
  scheduleResourceSave();
}

function renameVariableId(oldId: string, newId: string) {
  const next = newId.trim();
  if (!next || next === oldId) return;
  if (project.value.variables.some((v) => v.id === next)) {
    void appAlert("变量 ID 已存在");
    return;
  }
  const item = project.value.variables.find((v) => v.id === oldId);
  if (!item) return;
  item.id = next;
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.varId === oldId) n.varId = next;
      if (n.kind === "condition" || n.kind === "questCheck") {
        for (const r of n.requirements ?? []) {
          if (r.kind === "varEquals" && r.varId === oldId) r.varId = next;
        }
      }
    }
  }
  scheduleResourceSave();
}

function deleteVariable(id: string) {
  project.value.variables = project.value.variables.filter((v) => v.id !== id);
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.varId === id) delete n.varId;
      if (n.kind === "condition" || n.kind === "questCheck") {
        n.requirements = (n.requirements ?? []).filter((r) => !(r.kind === "varEquals" && r.varId === id));
      }
    }
  }
  scheduleResourceSave();
}

function renameItemId(oldId: string, newId: string) {
  const oldTrim = oldId.trim();
  const next = newId.trim();
  if (!oldTrim || !next || oldTrim === next) return;
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (n.itemId === oldTrim) n.itemId = next;
    }
  }
}

function ensureResourceList(kind: ResourceKind): ResourceEntry[] {
  const dict = (project.value.resources ??= {});
  const key = kind as unknown as keyof typeof dict;
  const list = (dict as any)[key];
  if (Array.isArray(list)) return list as ResourceEntry[];
  (dict as any)[key] = [];
  return (dict as any)[key] as ResourceEntry[];
}

function addResource(kind: ResourceKind) {
  const list = ensureResourceList(kind);
  const id = `${kind}_${crypto.randomUUID().slice(0, 8)}`;
  list.push({ id, kind, name: `新资源(${kind})`, note: "" });
  scheduleResourceSave();
}

function patchResource(kind: ResourceKind, id: string, patch: Partial<ResourceEntry>) {
  const list = ensureResourceList(kind);
  const item = list.find((x) => x.id === id);
  if (!item) return;
  if (patch.name !== undefined) item.name = String(patch.name);
  if (patch.note !== undefined) item.note = String(patch.note);
  if (patch.image !== undefined) {
    const v = String(patch.image).trim();
    item.image = v || undefined;
  }
  if (patch.tileSize !== undefined) {
    const v = Number(patch.tileSize);
    item.tileSize = Number.isFinite(v) && v > 0 ? v : undefined;
  }
  scheduleResourceSave();
}

function clearResourceRefs(kind: ResourceKind, id: string) {
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (kind === "npc" && n.npcId === id) delete n.npcId;
      if (kind === "pet" && n.petId === id) delete n.petId;
      if (kind === "skill" && n.skillId === id) delete n.skillId;
      if (kind === "item" && n.itemId === id) delete n.itemId;
      if (kind === "dropTable" && n.dropTableId === id) delete n.dropTableId;
      if (kind === "battleConfig" && n.battleConfigId === id) delete n.battleConfigId;
      if (kind === "area" && n.areaId === id) delete n.areaId;

      if (kind === "item") {
        for (const a of n.actions ?? []) {
          if ((a.kind === "giveItem" || a.kind === "takeItem") && a.itemId === id) a.itemId = "";
        }
      }
      if (kind === "pet") {
        for (const a of n.actions ?? []) {
          if (a.kind === "givePet" && a.petId === id) a.petId = "";
        }
        for (const c of n.checks ?? []) {
          if (c.kind === "hasPet" && c.petId === id) c.petId = "";
        }
      }
      if (kind === "battleConfig") {
        for (const a of n.actions ?? []) {
          if (a.kind === "triggerBattle" && a.battleConfigId === id) a.battleConfigId = "";
        }
      }
      if (kind === "area") {
        for (const a of n.actions ?? []) {
          if (a.kind === "teleport" && a.areaId === id) a.areaId = "";
        }
      }
    }
  }
}

function deleteResource(kind: ResourceKind, id: string) {
  const list = ensureResourceList(kind);
  project.value.resources = {
    ...(project.value.resources ?? {}),
    [kind]: list.filter((x) => x.id !== id),
  } as any;
  clearResourceRefs(kind, id);
  if (kind === "npc") {
    for (const gm of ensureProjectGameMaps(project.value)) {
      const npc = gm.npcs.find((n) => n.npcResourceId === id || n.npcUid === id);
      if (npc) deleteNpcFromGameMap(project.value, gm, npc.npcUid);
    }
  }
  scheduleResourceSave();
}

function renameResourceId(kind: ResourceKind, oldId: string, newId: string) {
  const next = newId.trim();
  if (!next || next === oldId) return;
  const list = ensureResourceList(kind);
  if (list.some((x) => x.id === next)) {
    void appAlert("资源 ID 已存在");
    return;
  }
  const item = list.find((x) => x.id === oldId);
  if (!item) return;
  item.id = next;
  for (const g of project.value.graphs) {
    for (const n of g.nodes) {
      if (kind === "npc" && n.npcId === oldId) n.npcId = next;
      if (kind === "pet" && n.petId === oldId) n.petId = next;
      if (kind === "skill" && n.skillId === oldId) n.skillId = next;
      if (kind === "item" && n.itemId === oldId) n.itemId = next;
      if (kind === "dropTable" && n.dropTableId === oldId) n.dropTableId = next;
      if (kind === "battleConfig" && n.battleConfigId === oldId) n.battleConfigId = next;
      if (kind === "area" && n.areaId === oldId) n.areaId = next;
      if (kind === "item") {
        for (const a of n.actions ?? []) {
          if ((a.kind === "giveItem" || a.kind === "takeItem") && a.itemId === oldId) a.itemId = next;
        }
      }
      if (kind === "pet") {
        for (const a of n.actions ?? []) {
          if (a.kind === "givePet" && a.petId === oldId) a.petId = next;
        }
        for (const c of n.checks ?? []) {
          if (c.kind === "hasPet" && c.petId === oldId) c.petId = next;
        }
      }
      if (kind === "battleConfig") {
        for (const a of n.actions ?? []) {
          if (a.kind === "triggerBattle" && a.battleConfigId === oldId) a.battleConfigId = next;
        }
      }
      if (kind === "area") {
        for (const a of n.actions ?? []) {
          if (a.kind === "teleport" && a.areaId === oldId) a.areaId = next;
        }
      }
    }
  }
  scheduleResourceSave();
}

function patchQuest(id: string, patch: Partial<QuestDef>) {
  const q = project.value.quests.find((x) => x.id === id);
  if (!q) return;
  if (patch.name !== undefined) q.name = patch.name;
  if (patch.initialStatus !== undefined) q.initialStatus = patch.initialStatus;
  scheduleResourceSave();
}

function getViewportCenterFlowPoint() {
  const pane = canvasPaneEl.value;
  if (pane) {
    const rect = pane.getBoundingClientRect();
    return screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }
  return { x: 220, y: 220 };
}

function addNode(kind: NodeKind, customPos?: { x: number; y: number }) {
  const center = customPos ?? getViewportCenterFlowPoint();
  if (kind === "mapPortal" && currentGraph.value.kind === "timeline") {
    const { portal } = createMapPortalWithGameMap(project.value, { position: center });
    selectedNodeId.value = portal.id;
    rebuildFlowFromGraph();
    return;
  }
  let gid = selectedMapId.value;
  if (!gid && focusedNpcZoneId.value) gid = focusedNpcZoneId.value;
  const validMap = !!(gid && currentGraph.value.maps?.some((m) => m.id === gid));
  const zoneNpcUid = currentGraph.value.maps?.find((m) => m.id === gid)?.npcUid;
  const guardNpcUid = zoneNpcUid ?? focusedNpcUid.value ?? undefined;
  const guard = assertNodeKindAllowedForNpc(
    project.value,
    currentGraph.value,
    currentGameMap.value,
    guardNpcUid,
    kind,
  );
  if (!guard.ok) {
    void appAlert(guard.hint ? `${guard.reason}\n\n${guard.hint}` : guard.reason, "无法添加节点");
    return;
  }
  const n = createNode({
    kind,
    position: { x: center.x, y: center.y },
    ...(validMap ? { mapId: gid!, npcUid: zoneNpcUid } : {}),
  });
  if (kind === "questUpdate" && currentGraph.value.kind === "map") {
    const q = project.value.quests.find((x) => x.graphId === currentGraph.value.id);
    if (q) {
      n.questId = q.id;
      if (!n.questStatus) n.questStatus = "Completed";
    }
  }
  currentGraph.value.nodes.push(n);
  selectedNodeId.value = n.id;
  rebuildFlowFromGraph();
}

function closeContextMenu() {
  contextMenu.value.open = false;
}

function closeNodeContextMenu() {
  nodeContextMenu.value.open = false;
}

function deleteSelection() {
  deleteFlowElements(collectSelectedFlowNodeIds(), collectSelectedFlowEdgeIds());
}

function deleteNodeContextMenuTarget() {
  const id = nodeContextMenu.value.flowNodeId;
  closeNodeContextMenu();
  if (!id) return;
  deleteFlowElements([id], []);
}

function deleteSelectedNodeFromInspector(nodeId: string) {
  deleteFlowElements([nodeId], []);
}

function onPaneClick(e: MouseEvent) {
  if (contextMenu.value.open || nodeContextMenu.value.open) {
    e.preventDefault();
    closeContextMenu();
    closeNodeContextMenu();
    return;
  }
  if (ignoreNextPaneClick.value) {
    ignoreNextPaneClick.value = false;
    return;
  }
  lastSelectionRect.value = null;
  applySelectionState([], []);
}

function onCanvasContextMenu(e: MouseEvent) {
  e.preventDefault();
  if (suppressNextContextMenu.value) {
    suppressNextContextMenu.value = false;
    return;
  }
  const target = e.target as HTMLElement | null;
  if (target?.closest(".context-menu")) return;
  if (selectedMapId.value) {
    selectMapId(null);
    closeContextMenu();
    return;
  }
  if (contextMenu.value.open) {
    closeContextMenu();
    return;
  }
  if (nodeContextMenu.value.open) {
    closeNodeContextMenu();
    return;
  }
  const pane = canvasPaneEl.value;
  const rect = pane?.getBoundingClientRect();
  const flowPoint = screenToFlowCoordinate({ x: e.clientX, y: e.clientY });
  contextMenu.value = {
    open: true,
    x: rect ? e.clientX - rect.left : e.clientX,
    y: rect ? e.clientY - rect.top : e.clientY,
    flowX: flowPoint.x,
    flowY: flowPoint.y,
  };
}

function onCanvasPointerDownCapture(e: PointerEvent) {
  if (e.button !== 2) return;
  if (!selectedMapId.value) return;
  e.preventDefault();
  e.stopPropagation();
  suppressNextContextMenu.value = true;
  selectMapId(null);
  closeContextMenu();
}

function createNodeFromContextMenu(kind: NodeKind) {
  addNode(kind, { x: contextMenu.value.flowX, y: contextMenu.value.flowY });
  closeContextMenu();
}

function onConnect(c: Connection) {
  if (!c.source || !c.target || !c.sourceHandle) return;
  if (c.source === c.target) return;
  const realTarget = resolveFlowNodeId(c.target);

  if (currentGraph.value.kind === "timeline") {
    connectGraphOption(currentGraph.value, c.source, c.sourceHandle, realTarget);
    rebuildFlowFromGraph();
    return;
  }

  const sa = currentGraph.value.nodes.find((n) => n.id === c.source)?.mapId;
  const taLocal = currentGraph.value.nodes.find((n) => n.id === realTarget)?.mapId;
  const entryTarget = findEntryNodeById(project.value, realTarget);

  if (entryTarget) {
    connectGraphOption(currentGraph.value, c.source, c.sourceHandle, realTarget);
    rebuildFlowFromGraph();
    return;
  }

  if (sa !== taLocal) {
    void appAlert("只能在同一地图（或同为画布层未分区）的节点之间连线。跨画布请连到 NPC/任务入口节点。");
    return;
  }
  connectGraphOption(currentGraph.value, c.source, c.sourceHandle, realTarget);
  rebuildFlowFromGraph();
}

function selectedFlowNodeIdSet(): Set<string> {
  const ids = new Set(selectedNodeIds.value);
  if (selectedMapId.value) ids.add(mapFlowNodeId(selectedMapId.value));
  return ids;
}

function stampEditorSelection(nextNodes: Node[], selectedIds: Set<string>): Node[] {
  return nextNodes.map((node) => {
    const sel = selectedIds.has(node.id);
    return {
      ...node,
      selected: sel,
      data: {
        ...(node.data as Record<string, unknown>),
        editorSelected: sel,
      },
    };
  });
}

function graphFlowPositions(): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  for (const gn of currentGraph.value.nodes) {
    pos.set(gn.id, gn.position);
  }
  for (const m of currentGraph.value.maps ?? []) {
    pos.set(mapFlowNodeId(m.id), { x: m.x, y: m.y });
  }
  return pos;
}

function mergeFlowNodeSelection(next: Node[]): Node[] {
  return stampEditorSelection(next, selectedFlowNodeIdSet());
}

function syncFlowNodeSelection(nodeIds: string[]) {
  const idSet = new Set(nodeIds);
  nodes.value = stampEditorSelection(nodes.value, idSet);
  suppressSelectionChange.value = true;
  canvasRef.value?.applyEditorSelection(nodeIds);
  nextTick(() => {
    suppressSelectionChange.value = false;
  });
}

function effectiveSelectionRect(nodeIds: string[]): SelectionRect | undefined {
  if (lastSelectionRect.value) return lastSelectionRect.value;
  return selectionBoundsForNodeIds(currentGraph.value, nodes.value, nodeIds);
}

function inferDragMode(nodeIds: string[]) {
  return inferZoneDragMode(currentGraph.value, nodeIds, effectiveSelectionRect(nodeIds));
}

async function autoLayoutCurrentZone() {
  const zoneId = layoutZoneId.value;
  if (!currentGraph.value || !zoneId || currentGraph.value.kind !== "map") return;
  if (layoutInProgress.value) return;
  layoutInProgress.value = true;
  try {
    const r = await layoutZoneNodes(currentGraph.value, zoneId);
    rebuildFlowFromGraph();
    await nextTick();
    updateNodeInternals();
    flushCurrentProjectSave();
    fitView({ padding: 0.15 });
    if (r.movedNodeIds.length === 0) {
      void appAlert("本区域无可整理节点，或该区域已标记为跳过整理。");
    }
  } catch {
    void appAlert("整理本组失败，请检查区域内连线是否有效。");
  } finally {
    layoutInProgress.value = false;
  }
}

async function autoLayoutWholeMap() {
  if (!currentGraph.value || currentGraph.value.kind !== "map") return;
  if (layoutInProgress.value) return;
  layoutInProgress.value = true;
  try {
    const gm = currentGameMap.value;
    if (gm) {
      repairMapChains(project.value, currentGraph.value, gm);
    }
    const r = await layoutMapGraphNodes(currentGraph.value);
    rebuildFlowFromGraph();
    await nextTick();
    updateNodeInternals();
    flushCurrentProjectSave();
    fitView({ padding: 0.12 });
    const totalZones = currentGraph.value.maps?.length ?? 0;
    if (r.movedNodeIds.length === 0 && r.packedZoneIds.length === 0) {
      if (r.skippedZoneIds.length >= totalZones && totalZones > 0) {
        void appAlert("所有区域均被跳过或无节点可整理。");
      } else {
        void appAlert("未移动任何节点，请检查各区域是否有可整理节点。");
      }
    } else {
      const parts: string[] = [];
      if (r.movedNodeIds.length > 0) {
        parts.push(`已整理 ${totalZones - r.skippedZoneIds.length} 个区域`);
      }
      if (r.skippedZoneIds.length > 0) {
        parts.push(`跳过 ${r.skippedZoneIds.length} 个`);
      }
      if (r.packedZoneIds.length > 0) {
        parts.push(`避让重叠 ${r.packedZoneIds.length} 个区域`);
      }
      if (parts.length > 0) void appAlert(parts.join("，") + "。");
    }
  } catch {
    void appAlert("整理全图失败，请检查各区域连线是否有效。");
  } finally {
    layoutInProgress.value = false;
  }
}

async function detectAndRepairMapChains() {
  if (!currentGraph.value || currentGraph.value.kind !== "map") return;
  const gm = currentGameMap.value;
  if (!gm) {
    void appAlert("请先进入游戏地图。");
    return;
  }
  if (layoutInProgress.value) return;
  layoutInProgress.value = true;
  try {
    const before = detectMapChainIssues(project.value, currentGraph.value, gm);
    const result = repairMapChains(project.value, currentGraph.value, gm);
    rebuildFlowFromGraph();
    await nextTick();
    updateNodeInternals();
    flushCurrentProjectSave();
    const after = detectMapChainIssues(project.value, currentGraph.value, gm);
    const lines: string[] = [];
    lines.push(`修复连线 ${result.fixedLinks} 处`);
    if (result.addedNodes > 0) lines.push(`新增节点 ${result.addedNodes} 个`);
    if (result.provisionedAppear > 0) lines.push(`补全出现条件 ${result.provisionedAppear} 条`);
    if (result.provisionedChainContinuous > 0) lines.push(`补全持续触发 ${result.provisionedChainContinuous} 个节点`);
    if (before.length > 0) lines.push(`检测问题 ${before.length} 项 → 剩余 ${after.length} 项`);
    if (after.some((i) => i.kind === "no_middle_nodes")) {
      lines.push("仍有链缺少剧情节点，可用 AI 助手「修复当前链」补写。");
    }
    if (result.warnings.length) {
      lines.push("", ...result.warnings.slice(0, 6));
      if (result.warnings.length > 6) lines.push(`…另有 ${result.warnings.length - 6} 条警告`);
    }
    void appAlert(lines.join("\n"), "检测修复链");
  } catch {
    void appAlert("检测修复失败，请检查各区域结构。");
  } finally {
    layoutInProgress.value = false;
  }
}

function onSelectionBox(rect: SelectionRect, additive = false) {
  lastSelectionRect.value = rect;
  ignoreNextPaneClick.value = true;
  const hits = findFlowNodeIdsInRect(currentGraph.value, nodes.value, rect);
  if (hits.length === 0) {
    if (!additive) {
      applySelectionState([], [], { expandZone: false });
    }
    return;
  }
  const merged = additive ? [...new Set([...selectedNodeIds.value, ...hits])] : hits;
  applySelectionState(merged, [], { expandZone: false });
}

function applySelectionState(nodeIds: string[], edgeIds: string[], opts?: { expandZone?: boolean }) {
  const expandZone = opts?.expandZone !== false;
  selectedNodeIds.value = nodeIds;
  selectedEdgeIds.value = edgeIds;
  if (nodeIds.length === 0 && edgeIds.length === 0) {
    syncFlowNodeSelection([]);
    selectedMapId.value = null;
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
    currentDragMode.value = "none";
    return;
  }
  if (nodeIds.length > 0 && currentGraph.value.kind === "map") {
    const inference = inferDragMode(nodeIds);
    currentDragMode.value = inference.mode;
    if (expandZone && inference.mode === "zoneGroup" && inference.zoneId) {
      const groupIds = expandSelectionToZoneGroup(currentGraph.value, inference.zoneId);
      if (groupIds.length !== nodeIds.length || !groupIds.every((id) => nodeIds.includes(id))) {
        nodeIds = groupIds;
        selectedNodeIds.value = groupIds;
      }
      syncFlowNodeSelection(nodeIds);
      selectedMapId.value = inference.zoneId;
      selectedNodeId.value = null;
      selectedEdgeId.value = null;
      return;
    }
  }
  syncFlowNodeSelection(nodeIds);
  if (nodeIds.length > 0) {
    const first = nodeIds[0]!;
    const mapOnly = parseMapFlowNodeId(first);
    if (mapOnly) {
      selectedMapId.value = mapOnly;
      selectedNodeId.value = null;
      selectedEdgeId.value = null;
    } else {
      selectedMapId.value = null;
      selectedNodeId.value = first;
      selectedEdgeId.value = null;
    }
  } else if (edgeIds.length > 0) {
    selectedMapId.value = null;
    selectedNodeId.value = null;
    selectedEdgeId.value = edgeIds[0];
  }
}

function onNodeDragStart(e: NodeDragEvent) {
  if (!e.node?.id) return;
  const selected = collectSelectedFlowNodeIds();
  const inference = inferDragMode(selected);
  currentDragMode.value = inference.mode;

  if (inference.mode === "zoneGroup" && inference.zoneId) {
    const zoneId = inference.zoneId;
    const zone = currentGraph.value.maps?.find((m) => m.id === zoneId);
    if (!zone) return;
    const groupIds = expandSelectionToZoneGroup(currentGraph.value, zoneId);
    syncFlowNodeSelection(groupIds);

    const nodeStarts: Record<string, { x: number; y: number }> = {};
    for (const n of currentGraph.value.nodes) {
      if (n.mapId === zoneId) nodeStarts[n.id] = { ...n.position };
    }
    nodeStarts[mapFlowNodeId(zoneId)] = { x: zone.x, y: zone.y };

    dragSnapshot.value = {
      mode: "zoneGroup",
      zoneId,
      zoneStart: { x: zone.x, y: zone.y },
      nodeStarts,
      primaryFlowId: e.node.id,
    };
    return;
  }

  const nodeStarts: Record<string, { x: number; y: number }> = {};
  for (const id of selected.length > 0 ? selected : [e.node.id]) {
    const mapOnly = parseMapFlowNodeId(id);
    if (mapOnly) {
      const z = currentGraph.value.maps?.find((m) => m.id === mapOnly);
      if (z) nodeStarts[id] = { x: z.x, y: z.y };
      continue;
    }
    const sn = currentGraph.value.nodes.find((n) => n.id === id);
    if (sn) nodeStarts[id] = { ...sn.position };
  }
  dragSnapshot.value = {
    mode: inference.mode,
    zoneId: inference.zoneId,
    nodeStarts,
    primaryFlowId: e.node.id,
  };
}

function onNodeDrag(e: NodeDragEvent) {
  const snap = dragSnapshot.value;
  if (!snap || !e.node?.id) return;

  if (snap.mode === "zoneGroup" && snap.zoneId && snap.zoneStart) {
    const start = snap.nodeStarts[e.node.id] ?? (parseMapFlowNodeId(e.node.id) ? snap.zoneStart : undefined);
    if (!start) return;
    const dx = e.node.position.x - start.x;
    const dy = e.node.position.y - start.y;

    const zone = currentGraph.value.maps?.find((m) => m.id === snap.zoneId);
    if (!zone) return;
    zone.x = snap.zoneStart.x + dx;
    zone.y = snap.zoneStart.y + dy;

    for (const n of currentGraph.value.nodes) {
      if (n.mapId !== snap.zoneId) continue;
      const ns = snap.nodeStarts[n.id];
      if (!ns) continue;
      n.position.x = ns.x + dx;
      n.position.y = ns.y + dy;
      const flowN = nodes.value.find((fn) => fn.id === n.id);
      if (flowN) {
        flowN.position.x = n.position.x;
        flowN.position.y = n.position.y;
      }
    }

    const mapFlowId = mapFlowNodeId(snap.zoneId);
    const mapFlow = nodes.value.find((fn) => fn.id === mapFlowId);
    if (mapFlow) {
      mapFlow.position.x = zone.x;
      mapFlow.position.y = zone.y;
    }
    return;
  }

  const refStart = snap.nodeStarts[e.node.id];
  if (!refStart) return;
  const dx = e.node.position.x - refStart.x;
  const dy = e.node.position.y - refStart.y;
  if (dx === 0 && dy === 0) return;

  for (const [id, start] of Object.entries(snap.nodeStarts)) {
    if (id === e.node.id) continue;
    const mapOnly = parseMapFlowNodeId(id);
    if (mapOnly) {
      const zone = currentGraph.value.maps?.find((m) => m.id === mapOnly);
      const flowN = nodes.value.find((fn) => fn.id === id);
      if (zone && flowN) {
        zone.x = start.x + dx;
        zone.y = start.y + dy;
        flowN.position.x = zone.x;
        flowN.position.y = zone.y;
      }
      continue;
    }
    const flowN = nodes.value.find((fn) => fn.id === id);
    if (!flowN) continue;
    flowN.position.x = start.x + dx;
    flowN.position.y = start.y + dy;
  }
}

function persistDraggedNodePositions() {
  const snap = dragSnapshot.value;
  const selected = collectSelectedFlowNodeIds();

  if (snap?.mode === "zoneGroup" && snap.zoneId) {
    reassignAllNodeMapIdsForCurrentGraph();
    dragSnapshot.value = null;
    currentDragMode.value = "none";
    return;
  }

  const idsToPersist =
    selected.length > 0
      ? selected.filter((id) => !id.startsWith("__ghost__"))
      : snap?.primaryFlowId
        ? [snap.primaryFlowId]
        : [];

  for (const flowId of idsToPersist) {
    const mapOnly = parseMapFlowNodeId(flowId);
    if (mapOnly) {
      ensureGraphMaps(currentGraph.value);
      const m = currentGraph.value.maps!.find((x) => x.id === mapOnly);
      const flowN = nodes.value.find((n) => n.id === flowId);
      if (m && flowN) {
        m.x = flowN.position.x;
        m.y = flowN.position.y;
        reassignAllNodeMapIdsForCurrentGraph();
      }
      continue;
    }
    const flowN = nodes.value.find((n) => n.id === flowId);
    if (!flowN) continue;
    applyNodePositionToGraph(currentGraph.value, flowId, flowN.position);
    const assigned = assignNodeMapIdByPosition(currentGraph.value, flowId, flowN.position);
    if (assigned) growMapToFitAssignedNodes(currentGraph.value, assigned);
  }

  dragSnapshot.value = null;
  currentDragMode.value = "none";
}

function onNodeDragStop(e: NodeDragEvent) {
  if (!e.node?.id) return;
  if (!dragSnapshot.value) {
    const flowId = e.node.id;
    const mapOnly = parseMapFlowNodeId(flowId);
    if (mapOnly) {
      ensureGraphMaps(currentGraph.value);
      const m = currentGraph.value.maps!.find((x) => x.id === mapOnly);
      if (m) {
        m.x = e.node.position.x;
        m.y = e.node.position.y;
        reassignAllNodeMapIdsForCurrentGraph();
      }
      return;
    }
    applyNodePositionToGraph(currentGraph.value, flowId, e.node.position);
    const assigned = assignNodeMapIdByPosition(currentGraph.value, flowId, e.node.position);
    if (assigned) growMapToFitAssignedNodes(currentGraph.value, assigned);
    return;
  }
  persistDraggedNodePositions();
  flushCurrentProjectSave();
}

function reassignAllNodeMapIdsForCurrentGraph() {
  const g = currentGraph.value;
  for (const n of g.nodes) {
    assignNodeMapIdByPosition(g, n.id, n.position);
  }
}

function onNodesChange(changes: NodeChange[]) {
  const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
  nodes.value = applyNodeChanges(changes, nodes.value);
  for (const id of removed) {
    const mapOnly = parseMapFlowNodeId(id);
    if (mapOnly) {
      removeMapFromGraph(currentGraph.value, mapOnly);
      if (selectedMapId.value === mapOnly) selectedMapId.value = null;
      continue;
    }
    deleteNodeFromGraph(currentGraph.value, id);
    if (selectedNodeId.value === id) selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
  }
}

function onEdgesChange(changes: EdgeChange[]) {
  const prevById = new Map(edges.value.map((e) => [e.id, e] as const));
  const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
  edges.value = applyEdgeChanges(changes, edges.value);
  for (const id of removed) {
    const edge = prevById.get(id);
    if (edge?.source && edge.sourceHandle && edge.target) {
      disconnectGraphOption(currentGraph.value, edge.source, edge.sourceHandle, edge.target);
    }
    if (selectedEdgeId.value === id) selectedEdgeId.value = null;
  }
}

function onKeyDown(ev: KeyboardEvent) {
  const active = document.activeElement as HTMLElement | null;
  const tag = active?.tagName?.toLowerCase();
  const isTyping = !!active?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";

  if (!isTyping && ev.code === "BracketLeft") {
    ev.preventDefault();
    toggleLeftPanel();
    return;
  }
  if (!isTyping && ev.code === "BracketRight") {
    ev.preventDefault();
    toggleRightPanel();
    return;
  }
  if (!isTyping && (ev.ctrlKey || ev.metaKey) && ev.code === "Backslash") {
    ev.preventDefault();
    focusMode.value = !focusMode.value;
    return;
  }

  if (!isTyping && (ev.code === "Delete" || ev.code === "Backspace")) {
    ev.preventDefault();
    deleteSelection();
    return;
  }

  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyS") {
    ev.preventDefault();
    flushCurrentProjectSave();
    return;
  }

  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.code === "KeyZ") {
    ev.preventDefault();
    performUndo();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && (ev.shiftKey ? ev.code === "KeyZ" : ev.code === "KeyY")) {
    ev.preventDefault();
    performRedo();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.code === "KeyF") {
    ev.preventDefault();
    fitView({ padding: 0.2 });
    return;
  }
  if (!isTyping && (ev.ctrlKey || ev.metaKey) && ev.code === "KeyL") {
    ev.preventDefault();
    isResourceLibraryOpen.value = !isResourceLibraryOpen.value;
    return;
  }
}

function saveLayoutPrefs() {
  try {
    localStorage.setItem(
      EDITOR_LAYOUT_PREFS_KEY,
      JSON.stringify({
        leftPanelWidth: leftPanelWidth.value,
        rightPanelWidth: rightPanelWidth.value,
        leftPanelOpen: leftPanelOpen.value,
        rightPanelOpen: rightPanelOpen.value,
        focusMode: focusMode.value,
      }),
    );
  } catch {
    // ignore
  }
}

function loadLayoutPrefs() {
  try {
    const raw = localStorage.getItem(EDITOR_LAYOUT_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<{
      leftPanelWidth: number;
      rightPanelWidth: number;
      leftPanelOpen: boolean;
      rightPanelOpen: boolean;
      focusMode: boolean;
    }>;
    if (Number.isFinite(parsed.leftPanelWidth)) leftPanelWidth.value = Number(parsed.leftPanelWidth);
    if (Number.isFinite(parsed.rightPanelWidth)) rightPanelWidth.value = Number(parsed.rightPanelWidth);
    if (typeof parsed.leftPanelOpen === "boolean") leftPanelOpen.value = parsed.leftPanelOpen;
    if (typeof parsed.rightPanelOpen === "boolean") rightPanelOpen.value = parsed.rightPanelOpen;
    if (typeof parsed.focusMode === "boolean") focusMode.value = parsed.focusMode;
  } catch {
    // ignore
  }
}

function clampPanelWidth(raw: number, min: number, max: number) {
  return Math.max(min, Math.min(max, raw));
}

function getLayoutWidth() {
  return layoutEl.value?.clientWidth ?? window.innerWidth;
}

function getLeftPanelMax() {
  const total = getLayoutWidth();
  const right = !focusMode.value && rightPanelOpen.value ? rightPanelWidth.value : 0;
  return Math.max(LEFT_PANEL_MIN, total - CENTER_MIN - right - 16);
}

function getRightPanelMax() {
  const total = getLayoutWidth();
  const left = !focusMode.value && leftPanelOpen.value ? leftPanelWidth.value : 0;
  return Math.max(RIGHT_PANEL_MIN, total - CENTER_MIN - left - 16);
}

function normalizePanelWidths() {
  leftPanelWidth.value = clampPanelWidth(
    leftPanelWidth.value,
    LEFT_PANEL_MIN,
    Math.min(LEFT_PANEL_MAX, getLeftPanelMax()),
  );
  rightPanelWidth.value = clampPanelWidth(
    rightPanelWidth.value,
    RIGHT_PANEL_MIN,
    Math.min(RIGHT_PANEL_MAX, getRightPanelMax()),
  );
}

function toggleLeftPanel() {
  leftPanelOpen.value = !leftPanelOpen.value;
}

function toggleRightPanel() {
  rightPanelOpen.value = !rightPanelOpen.value;
}

function startResize(side: "left" | "right", e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  const total = getLayoutWidth();
  const startX = e.clientX;
  const startLeft = leftPanelWidth.value;
  const startRight = rightPanelWidth.value;
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (side === "left") {
      const raw = startLeft + dx;
      const right = !focusMode.value && rightPanelOpen.value ? rightPanelWidth.value : 0;
      const max = Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, total - CENTER_MIN - right - 16));
      leftPanelWidth.value = clampPanelWidth(raw, LEFT_PANEL_MIN, max);
      return;
    }
    const raw = startRight - dx;
    const left = !focusMode.value && leftPanelOpen.value ? leftPanelWidth.value : 0;
    const max = Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, total - CENTER_MIN - left - 16));
    rightPanelWidth.value = clampPanelWidth(raw, RIGHT_PANEL_MIN, max);
  };
  const onUp = () => {
    document.body.style.userSelect = prevUserSelect;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    saveLayoutPrefs();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onMounted(() => {
  loadLayoutPrefs();
  normalizePanelWidths();
  history.pause();
  (async () => {
    workspaceHydrated.value = false;
    bootRecoveryMessage.value = "";
    const loadResult = await loadFromStorage();
    storageOnline.value = loadResult.storageOnline;
    workspaceFilePath.value = loadResult.workspaceFile ?? "";
    const restoredWorkspace = loadResult.workspace;
    if (restoredWorkspace?.projects?.length) {
      applyLoadedWorkspace(restoredWorkspace, loadResult.source);
      if (loadResult.recoveredFromLocal) {
        bootRecoveryMessage.value =
          loadResult.source === "merged"
            ? "已从浏览器缓存与 workspace.json 合并恢复数据，正在回写磁盘…"
            : "workspace.json 为空或落后，已从浏览器缓存恢复数据，正在回写磁盘…";
      }
    } else {
      createNewProject();
    }
    if (loadResult.storageOnline) {
      saveStatus.value = loadResult.shouldSyncDisk ? "saving" : "synced";
      saveStatusDetail.value = workspaceFilePath.value || "Juben/data/workspace.json";
    } else {
      saveStatus.value = "local-only";
      saveStatusDetail.value = "storage 未连接，改动仅保存在浏览器。请运行 npm run dev";
    }
    resetEditorHistory();
    workspaceHydrated.value = true;
    refreshProjectExportHealth(project.value);
    refreshFlowDimensions();
    if (loadResult.shouldSyncDisk) {
      flushCurrentProjectSave();
    }
  })();
  window.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("resize", normalizePanelWidths);
  window.addEventListener("beforeunload", () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    flushToDiskKeepalive();
  });
  window.addEventListener("pagehide", () => {
    flushToDiskKeepalive();
  });
});

onBeforeUnmount(() => {
  flowResizeObserver?.disconnect();
  window.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", normalizePanelWidths);
  if (autosaveTimer) clearTimeout(autosaveTimer);
  flushCurrentProjectSave();
});

// autosave
watch(
  project,
  () => {
    if (!workspaceHydrated.value || autosaveSuspended.value) return;
    if (persistAutosaveSuppress > 0) {
      dirtyWhilePersisting = true;
      return;
    }
    scheduleCurrentProjectSave();
  },
  { deep: true },
);
watch([leftPanelWidth, rightPanelWidth, leftPanelOpen, rightPanelOpen, focusMode], () => {
  normalizePanelWidths();
  saveLayoutPrefs();
  refreshFlowDimensions();
});

function prepareProjectForExport(): ProjectData {
  const report = createIntegrityReport();
  const safe = sanitizeProjectData(project.value, report);
  project.value = safe;
  refreshProjectExportHealth(safe);
  return safe;
}

const exportPublish = createExportPublishActions({
  project,
  currentGameMap,
  projectExportBlockers,
  projectExportHealthOk,
  prepareProjectForExport,
  flushCurrentProjectSave,
  rebuildFlowFromGraph,
  openGlobalCheckRepair,
});

function refreshProjectExportHealth(pd: ProjectData = project.value) {
  return exportPublish.refreshProjectExportHealth(pd);
}

const runManualExportHealthCheck = exportPublish.runManualExportHealthCheck;
const exportRuntimeMapJson = exportPublish.exportRuntimeMapJson;
const exportGameMapToCocos = exportPublish.exportGameMapToCocos;
const onImportRuntimeMap = exportPublish.onImportRuntimeMap;

function triggerExportMergeFile() {
  exportMergeFileInputEl.value?.click();
}

function onExportMergeFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  exportPublish.onExportMergeFileChange(file ?? undefined, currentGameMap.value);
  (e.target as HTMLInputElement).value = "";
}

function onDeletePortal(payload: { portalNodeId: string; deleteGameMap: boolean }) {
  deleteMapPortal(project.value, payload.portalNodeId, { deleteGameMap: payload.deleteGameMap });
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

async function onCleanupOrphanData() {
  const reconcile = reconcileTimelineData(project.value);
  const { removed, warnings } = cleanupOrphanGameMaps(project.value);
  const lines = [
    reconcile.removedDuplicatePortals ? `去重章节 ${reconcile.removedDuplicatePortals} 个` : "",
    reconcile.repairedTaskRefs ? `修复失效 taskId ${reconcile.repairedTaskRefs} 处` : "",
    `已清理 ${removed.length} 个孤立地图`,
  ].filter(Boolean);
  if (warnings.length) lines.push(...warnings);
  await appAlert(lines.join("\n"), "数据清理");
  rebuildFlowFromGraph();
  flushCurrentProjectSave();
}

function exportJson() {
  const report = createIntegrityReport();
  const safeProject = sanitizeProjectData(project.value, report);
  project.value = safeProject;
  flushCurrentProjectSave();
  // 导出裁剪：地图仅保留 id，避免将编辑态几何信息写入导出文件。
  const exportPayload = {
    ...safeProject,
    graphs: safeProject.graphs.map((g) => ({
      ...g,
      // 地图数据只保留地图 ID；x/y/width/height/name 等字段不导出。
      maps: (g.maps ?? []).map((m) => ({ id: m.id })),
    })),
  };
  const json = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `story_project_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const totalFixes = sumIntegrityReport(report);
  if (totalFixes > 0) {
    void appAlert(
      `导出前已完成数据校验与修复：\n` +
        `- 修复画布ID：${report.fixedGraphIds}\n` +
        `- 修复节点ID：${report.fixedNodeIds}\n` +
        `- 修复选项ID：${report.fixedOptionIds}\n` +
        `- 清理无效连线：${report.clearedInvalidLinks}\n` +
        `- 清理重复任务：${report.removedDuplicateQuests}\n` +
        `- 清理无效任务引用：${report.removedInvalidQuestRefs}\n` +
        `- 清理无效开始目标：${report.removedInvalidCallTargets}\n` +
        `- 修复地图 ID：${report.fixedMapIds}\n` +
        `- 清理无效地图归属：${report.clearedInvalidMapRefs}`,
    );
  }
}

function tryParseProject(raw: string): ProjectData | null {
  try {
    const obj = JSON.parse(raw) as Partial<ProjectData>;
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.graphs) || !Array.isArray(obj.variables) || !Array.isArray(obj.quests)) return null;
    return obj as ProjectData;
  } catch {
    return null;
  }
}

const fileInputEl = ref<HTMLInputElement | null>(null);
const exportMergeFileInputEl = ref<HTMLInputElement | null>(null);
function triggerImport() {
  fileInputEl.value?.click();
}
const runtimeMapInputEl = ref<HTMLInputElement | null>(null);
function triggerRuntimeMapImport() {
  runtimeMapInputEl.value?.click();
}
function onRuntimeMapFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const gm = currentGameMap.value;
  if (!gm) {
    void appAlert("请先进入游戏地图");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    onImportRuntimeMap({ gameMapId: gm.id, raw: String(reader.result ?? "") });
    input.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function onImportFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const raw = String(reader.result ?? "");
    const parsed = tryParseProject(raw);
    const runtime = parseRuntimeMapJson(raw);
    if (parsed) {
      const mode = await appPrompt("输入 1=覆盖当前项目，2=另存为新项目", "2", "导入 story_project");
      if (mode === "1") {
        project.value = sanitizeProjectData(parsed);
        project.value.graphs.forEach(ensureGraphBoundaryNodes);
        syncQuestDefsWithGraphs();
        selectedGraphId.value = project.value.graphs[0]?.id ?? "";
        selectedMapId.value = null;
        selectedNodeId.value = project.value.graphs[0]?.nodes[0]?.id ?? null;
        rebuildFlowFromGraph();
        flushCurrentProjectSave();
      } else if (mode === "2") {
        const id = `proj_${crypto.randomUUID()}`;
        const now = Date.now();
        projects.value.unshift({
          id,
          name: parsed.quests?.[0]?.name ? `导入：${parsed.quests[0].name}` : `导入 ${new Date().toLocaleString()}`,
          createdAt: now,
          updatedAt: now,
          data: sanitizeProjectData(parsed),
        });
        activateProjectById(id);
      }
    } else if (runtime && currentGameMap.value) {
      onImportRuntimeMap({ gameMapId: currentGameMap.value.id, raw });
    } else {
      void appAlert("无法识别 JSON：需为 story_project 或运行时 map JSON");
    }
    input.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function clearDraft() {
  void appConfirm("确认清空全部本地项目草稿吗？此操作不可撤销。").then((ok) => {
    if (!ok) return;
    void clearStorage();
    projects.value = [];
    currentProjectId.value = null;
    createNewProject();
    isHome.value = true;
  });
}

function onNodeClick(e: NodeMouseEvent) {
  closeContextMenu();
  const id = ((e as any)?.node?.id ?? (e as any)?.id) as string | undefined;
  if (typeof id !== "string") {
    applySelectionState([], []);
    return;
  }
  lastSelectionRect.value = null;
  applySelectionState([id], []);
}

function onEdgeClick(edgeId: string) {
  closeContextMenu();
  lastSelectionRect.value = null;
  applySelectionState([], [edgeId]);
}

function onSelectionChange(p: { nodeIds: string[]; edgeIds: string[] }) {
  if (suppressSelectionChange.value) return;
  if (p.nodeIds.length > 0 || p.edgeIds.length > 0) closeContextMenu();
  if (p.nodeIds.length === 0 && p.edgeIds.length === 0) {
    if (selectedNodeIds.value.length > 0 || selectedEdgeIds.value.length > 0) {
      syncFlowNodeSelection(selectedNodeIds.value);
      return;
    }
    applySelectionState([], []);
    return;
  }
  if (p.nodeIds.length > 0 && !lastSelectionRect.value) {
    lastSelectionRect.value = selectionBoundsForNodeIds(currentGraph.value, nodes.value, p.nodeIds) ?? null;
  }
  const expandZone = !lastSelectionRect.value;
  applySelectionState(p.nodeIds, p.edgeIds, { expandZone });
}

function onNodesUpdated(incoming: Node[]) {
  if (dragSnapshot.value) {
    nodes.value = mergeFlowNodeSelection(incoming);
    return;
  }
  const authoritative = graphFlowPositions();
  const aligned = incoming.map((node) => {
    const gp = authoritative.get(node.id);
    if (!gp) return node;
    if (node.position.x === gp.x && node.position.y === gp.y) return node;
    return { ...node, position: { x: gp.x, y: gp.y } };
  });
  nodes.value = mergeFlowNodeSelection(aligned);
}
function onEdgesUpdated(e: Edge[]) {
  const ids = new Set(selectedEdgeIds.value);
  edges.value = e.map((edge) => ({ ...edge, selected: ids.has(edge.id) }));
}
function onCanvasReady() {
  flowReady.value = true;
  rebuildFlowDeferred();
  refreshFlowDimensions();
}
function onCanvasUnready() {
  flowReady.value = false;
}
</script>

<template>
  <div class="root" :class="{ 'home-mode': isHome }">
    <div v-if="bootRecoveryBanner" class="storage-offline-banner recovery-banner">
      {{ bootRecoveryMessage }}
    </div>
    <div v-if="exportBlockerBanner" class="storage-offline-banner export-blocker-banner">
      导出自检 {{ projectExportBlockers.length }} 项未通过（战斗分支/任务官链）：
      {{ projectExportBlockers[0] }}
      <button type="button" class="link-btn" @click="openGlobalCheckRepair">全局检查修复</button>
      <button type="button" class="link-btn" @click="runManualExportHealthCheck">导出自检</button>
    </div>
    <div v-if="storageOfflineBanner" class="storage-offline-banner">
      存储服务未连接，改动仅保存在浏览器。请运行 <code>npm run dev</code> 以实时写入 workspace.json
      <span v-if="saveStatusDetail" class="banner-detail">（{{ saveStatusDetail }}）</span>
    </div>
    <header v-if="!isHome" class="toolbar">
      <div class="left toolbar-main">
        <div class="brand">{{ currentProjectMeta?.name ?? "剧情项目" }}</div>
        <NavBreadcrumb :items="breadcrumbItems" @navigate="onBreadcrumbNavigate" />
        <div class="subtitle muted-small">
          <template v-if="isTimelineView">游戏时间线 · 双击大剧情进入地图</template>
          <template v-else-if="isMapGraphActive">
            <template v-if="focusedNpcUid && editorViewMode === 'story'">
              正在编辑任务：{{ focusedTaskLabel }}
            </template>
            <template v-else-if="editorViewMode === 'map'">地图摆点</template>
            <template v-else>地图剧情</template>
          </template>
          <template v-else>
            {{ currentGraph.name }}
            <span class="muted"
              >（{{
                currentGraph.kind === "timeline"
                  ? "时间线"
                  : currentGraph.kind === "map"
                    ? "地图剧情"
                    : currentGraph.kind
              }}）</span
            >
          </template>
        </div>
      </div>
      <div class="right toolbar-main">
        <span
          v-if="saveStatusLabel"
          class="save-chip"
          :class="saveStatus"
          :title="saveStatusDetail"
          :role="saveStatus === 'error' || saveStatus === 'local-only' ? 'button' : undefined"
          @click="retrySave"
          >{{ saveStatusLabel }}</span
        >
        <button
          v-if="isMapGraphActive && focusedNpcUid && editorViewMode === 'story'"
          class="btn btn-soft"
          @click="clearNpcFocus"
        >
          显示全部任务链
        </button>
        <button class="btn" @click="goHome">返回</button>
        <button class="btn btn-soft" @click="openResourceLibrary">资源</button>
        <button
          class="btn btn-soft"
          title="检查全项目任务链对接并自动修复"
          @click="openGlobalCheckRepair"
        >
          全局检查修复
        </button>
        <button
          class="btn btn-soft"
          :class="{ 'btn-warn': !projectExportHealthOk }"
          title="模拟导出并检查战斗分支/任务官链是否与 runtime JSON 一致"
          @click="runManualExportHealthCheck"
        >
          导出自检{{ projectExportBlockers.length ? ` (${projectExportBlockers.length})` : "" }}
        </button>
        <button class="btn btn-soft" @click="openAiAssistant">AI 助手</button>

        <div class="toolbar-dropdown">
          <button class="btn btn-soft" type="button" @click="toggleToolbarMenu('export')">导出 ▾</button>
          <div v-if="exportMenuOpen" class="toolbar-dropdown-menu">
            <button
              v-if="isMapGraphActive && currentGameMap"
              class="btn btn-soft"
              type="button"
              @click="(exportRuntimeMapJson(), closeToolbarMenus())"
            >
              导出运行时 map
            </button>
            <button class="btn btn-soft" type="button" @click="(exportJson(), closeToolbarMenus())">导出项目</button>
            <button class="btn btn-soft" type="button" @click="(triggerExportMergeFile(), closeToolbarMenus())">
              加载 merge 壳
            </button>
          </div>
        </div>

        <div class="toolbar-dropdown">
          <button class="btn btn-soft" type="button" @click="toggleToolbarMenu('import')">导入 ▾</button>
          <div v-if="importMenuOpen" class="toolbar-dropdown-menu">
            <button class="btn btn-soft" type="button" @click="(triggerImport(), closeToolbarMenus())">导入项目</button>
            <button
              v-if="currentGameMap"
              class="btn btn-soft"
              type="button"
              @click="(triggerRuntimeMapImport(), closeToolbarMenus())"
            >
              导入 map
            </button>
          </div>
        </div>

        <button class="btn btn-soft" type="button" @click="onFitView">适配</button>

        <div class="toolbar-dropdown">
          <button class="btn btn-soft" type="button" @click="toggleToolbarMenu('more')">更多 ▾</button>
          <div v-if="moreMenuOpen" class="toolbar-dropdown-menu">
            <button
              class="btn btn-soft"
              type="button"
              :disabled="!history.canUndo.value"
              @click="(performUndo(), closeToolbarMenus())"
            >
              撤销
            </button>
            <button
              class="btn btn-soft"
              type="button"
              :disabled="!history.canRedo.value"
              @click="(performRedo(), closeToolbarMenus())"
            >
              重做
            </button>
            <button class="btn btn-soft" type="button" @click="(onCleanupOrphanData(), closeToolbarMenus())">
              清理孤立数据
            </button>
            <button class="btn btn-soft" type="button" @click="(openMapRuntime(), closeToolbarMenus())">
              运行时 JSON
            </button>
          </div>
        </div>

        <input
          ref="fileInputEl"
          type="file"
          accept="application/json"
          style="display: none"
          @change="onImportFileChange"
        />
        <input
          ref="runtimeMapInputEl"
          type="file"
          accept="application/json"
          style="display: none"
          @change="onRuntimeMapFileChange"
        />
        <input
          ref="exportMergeFileInputEl"
          type="file"
          accept="application/json"
          style="display: none"
          @change="onExportMergeFileChange"
        />
      </div>
      <div v-if="editorViewMode === 'story' || !isMapGraphActive || editorViewMode === 'map'" class="toolbar-subline">
        <span class="status-chip">{{ selectionSummary }}</span>
        <template v-if="isMapGraphActive && editorViewMode === 'map'">
          <button class="btn btn-soft btn-sm" type="button" @click="onFitView">适应地图</button>
          <button class="btn btn-accent btn-sm" type="button" @click="openAddNpcDialog">+ NPC</button>
        </template>
        <template v-else-if="isMapGraphActive && editorViewMode === 'story'">
          <button
            class="btn btn-soft btn-sm"
            type="button"
            :disabled="layoutInProgress"
            title="检测并修复任务链连线、任务节点与出现条件"
            @click="detectAndRepairMapChains"
          >
            {{ layoutInProgress ? "修复中…" : "检测修复链" }}
          </button>
          <button
            class="btn btn-soft btn-sm"
            type="button"
            :disabled="layoutInProgress || !layoutZoneId"
            title="整理当前 NPC 区域内部节点"
            @click="autoLayoutCurrentZone"
          >
            {{ layoutInProgress ? "整理中…" : "整理本组" }}
          </button>
          <button
            class="btn btn-soft btn-sm"
            type="button"
            :disabled="layoutInProgress"
            title="整理全图各区域内部节点"
            @click="autoLayoutWholeMap"
          >
            {{ layoutInProgress ? "整理中…" : "整理全图" }}
          </button>
        </template>
        <button v-if="hasDeletableSelection" class="btn btn-danger btn-sm" type="button" @click="deleteSelection">
          删除
        </button>
        <span class="muted toolbar-hint">Del / Backspace · 框选整区=整组移动</span>
      </div>
    </header>

    <main v-if="!isHome && isMapRuntimeOpen" class="library-layout">
      <MapRuntimePanel
        :project="project"
        :game-map-id="selectedGameMapId ?? currentGameMap?.id ?? null"
        @close="closeMapRuntime"
        @import-runtime="onImportRuntimeMap"
      />
    </main>

    <main v-if="!isHome && isResourceLibraryOpen" class="library-layout">
      <ResourceLibrary
        :project="project"
        :selected-graph-id="selectedGraphId"
        @close="closeResourceLibrary"
        @add-character-asset="addCharacterAsset"
        @delete-character-asset="deleteCharacterAsset"
        @patch-character-asset="patchCharacterAsset($event.id, $event.patch)"
        @rename-character-asset-id="renameCharacterAssetId($event.oldId, $event.newId)"
        @add-variable="addVariable"
        @delete-variable="deleteVariable"
        @patch-variable="patchVariable($event.id, $event.patch)"
        @rename-variable-id="renameVariableId($event.oldId, $event.newId)"
        @rename-item-id="renameItemId($event.oldId, $event.newId)"
        @create-quest-graph="addGraph('quest')"
        @patch-quest="patchQuest($event.id, $event.patch)"
        @select-graph="selectGraph"
        @add-resource="addResource($event.kind)"
        @delete-resource="deleteResource($event.kind, $event.id)"
        @patch-resource="patchResource($event.kind, $event.id, $event.patch)"
        @rename-resource-id="renameResourceId($event.kind, $event.oldId, $event.newId)"
      />
    </main>

    <main v-if="!isHome && editorViewMode === 'map' && currentGameMap" ref="layoutEl" class="layout map-layout">
      <aside v-if="!focusMode && leftPanelOpen" class="pane pane-left">
        <LeftPanel
          :project="project"
          :selected-graph-id="selectedGraphId"
          :selected-map-id="selectedMapId"
          :selected-game-map-id="selectedGameMapId"
          :focused-npc-uid="focusedNpcUid"
          :selected-battle-giver-uid="selectedBattleGiverUid"
          :selected-battle-spawn-uid="selectedBattleSpawnUid"
          :editor-view-mode="editorViewMode"
          @select-graph="selectGraph"
          @add-graph="addGraph"
          @add-node="addNode"
          @delete-graph="deleteGraph"
          @rename-graph-name="renameGraphName($event.id, $event.name)"
          @add-map="addMapRegion"
          @select-map="selectMapId"
          @delete-map="deleteMapRegion"
          @patch-map="patchMapRegion($event.id, $event.patch)"
          @rename-map-id="renameMapRegionId($event.oldId, $event.newId)"
          @fit-map="fitMapRegion"
          @select-game-map="selectGameMap"
          @add-game-map="addGameMapEntry"
          @delete-game-map="deleteGameMapEntry"
          @focus-npc="focusNpcStory"
          @select-npc="onMapNpcSelect"
          @select-battle-enemy="onSelectBattleEnemy"
          @focus-battle-node="onFocusBattleNode"
          @add-battle-branch="onAddBattleBranch"
          @add-multi-battle-branch="onAddMultiBattleBranch"
          @delete-battle-branch="onDeleteBattleBranch"
          @patch-battle-enemy="onPatchBattleEnemy"
          @switch-view="onLeftPanelSwitchView"
          @add-npc="promptAddGameMapNpc"
          @delete-npc="deleteGameMapNpcEntry"
          @patch-npc="patchGameMapNpc($event.npcUid, $event.patch as Partial<GameMapNpcDef>)"
          @patch-task-entry="patchTaskEntryTitle($event.npcUid, $event.title)"
          @patch-game-map="patchGameMap($event.id, $event.patch as Partial<GameMapDef>)"
          @link-graph-to-map="linkGraphToMap($event.gameMapId, $event.graphId)"
          @unlink-graph-from-map="unlinkGraphFromMap($event.gameMapId, $event.graphId)"
          @open-quest-detail="openQuestDetail"
          @add-global-quest="addGlobalQuest"
          @reorder-global-quest="onReorderGlobalQuest"
          @add-child-map="addChildGameMapEntry"
          @navigate-timeline="navigateToTimeline"
          @patch-portal-node="patchTimelinePortalNode($event.nodeId, $event.title)"
          @delete-portal="onDeletePortal"
        />
      </aside>
      <section class="pane-canvas map-pane">
        <MapEditorView
          ref="mapEditorViewRef"
          :project="project"
          :game-map="currentGameMap"
          :selected-npc-uid="focusedNpcUid"
          :selected-battle-giver-uid="selectedBattleGiverUid"
          :selected-battle-spawn-uid="selectedBattleSpawnUid"
          :incoming-count-by-entry="incomingCountByEntry"
          @select-npc="onMapNpcSelect"
          @select-battle-enemy="onSelectBattleEnemy"
          @patch-battle-enemy="onPatchBattleEnemy"
          @edit-npc-story="focusNpcStory"
          @patch-npc="patchGameMapNpc($event.npcUid, $event.patch)"
          @add-npc="promptAddGameMapNpc"
          @delete-npc="deleteGameMapNpcEntry"
          @enter-sub-map="(id) => drillDownToMap(id, 'map')"
        />
      </section>
    </main>

    <main
      v-if="
        !isHome &&
        !isMapRuntimeOpen &&
        !isResourceLibraryOpen &&
        !(editorViewMode === 'map' && currentGameMap)
      "
      ref="layoutEl"
      class="layout"
      :style="layoutStyle"
    >
      <aside v-if="!focusMode && leftPanelOpen" class="pane pane-left">
        <LeftPanel
          :project="project"
          :selected-graph-id="selectedGraphId"
          :selected-map-id="selectedMapId"
          :selected-game-map-id="selectedGameMapId"
          :focused-npc-uid="focusedNpcUid"
          :selected-battle-giver-uid="selectedBattleGiverUid"
          :selected-battle-spawn-uid="selectedBattleSpawnUid"
          :editor-view-mode="editorViewMode"
          @select-graph="selectGraph"
          @add-graph="addGraph"
          @add-node="addNode"
          @delete-graph="deleteGraph"
          @rename-graph-name="renameGraphName($event.id, $event.name)"
          @add-map="addMapRegion"
          @select-map="selectMapId"
          @delete-map="deleteMapRegion"
          @patch-map="patchMapRegion($event.id, $event.patch)"
          @rename-map-id="renameMapRegionId($event.oldId, $event.newId)"
          @fit-map="fitMapRegion"
          @select-game-map="selectGameMap"
          @add-game-map="addGameMapEntry"
          @delete-game-map="deleteGameMapEntry"
          @focus-npc="focusNpcStory"
          @select-npc="onMapNpcSelect"
          @select-battle-enemy="onSelectBattleEnemy"
          @focus-battle-node="onFocusBattleNode"
          @add-battle-branch="onAddBattleBranch"
          @add-multi-battle-branch="onAddMultiBattleBranch"
          @delete-battle-branch="onDeleteBattleBranch"
          @patch-battle-enemy="onPatchBattleEnemy"
          @switch-view="onLeftPanelSwitchView"
          @add-npc="promptAddGameMapNpc"
          @delete-npc="deleteGameMapNpcEntry"
          @patch-npc="patchGameMapNpc($event.npcUid, $event.patch as Partial<GameMapNpcDef>)"
          @patch-task-entry="patchTaskEntryTitle($event.npcUid, $event.title)"
          @patch-game-map="patchGameMap($event.id, $event.patch as Partial<GameMapDef>)"
          @link-graph-to-map="linkGraphToMap($event.gameMapId, $event.graphId)"
          @unlink-graph-from-map="unlinkGraphFromMap($event.gameMapId, $event.graphId)"
          @open-quest-detail="openQuestDetail"
          @add-global-quest="addGlobalQuest"
          @reorder-global-quest="onReorderGlobalQuest"
          @add-child-map="addChildGameMapEntry"
          @navigate-timeline="navigateToTimeline"
          @patch-portal-node="patchTimelinePortalNode($event.nodeId, $event.title)"
          @delete-portal="onDeletePortal"
        />
      </aside>
      <button
        v-if="!focusMode"
        class="panel-toggle panel-toggle-left"
        :title="leftPanelOpen ? '收起左栏 [ ]' : '展开左栏 [ ]'"
        @click="toggleLeftPanel"
      >
        {{ leftPanelOpen ? "⟨" : "⟩" }}
      </button>
      <div
        v-if="!focusMode && leftPanelOpen"
        class="resizer resizer-left"
        @pointerdown="startResize('left', $event)"
      ></div>

      <section class="pane-canvas">
        <div
          ref="canvasPaneEl"
          class="canvas-shell"
          @click="closeContextMenu"
          @pointerdown.capture="onCanvasPointerDownCapture"
          @contextmenu.capture.prevent="onCanvasContextMenu"
        >
          <Canvas
            ref="canvasRef"
            :nodes="nodes"
            :edges="edges"
            @connect="onConnect"
            @nodes-change="onNodesChange"
            @edges-change="onEdgesChange"
            @node-drag-start="onNodeDragStart"
            @node-drag="onNodeDrag"
            @node-drag-stop="onNodeDragStop"
            @node-click="onNodeClick"
            @edge-click="onEdgeClick"
            @selection-change="onSelectionChange"
            @selection-box="onSelectionBox($event.rect, $event.additive)"
            @pane-click="onPaneClick"
            @update:nodes="onNodesUpdated"
            @update:edges="onEdgesUpdated"
            @ready="onCanvasReady"
            @unready="onCanvasUnready"
          />
          <div
            v-if="contextMenu.open"
            class="context-menu"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
          >
            <button
              v-for="item in quickCreateKinds"
              :key="item.kind"
              class="context-item"
              @click.stop="createNodeFromContextMenu(item.kind)"
            >
              新建{{ item.label }}节点
            </button>
          </div>
          <div
            v-if="nodeContextMenu.open"
            class="context-menu"
            :style="{ left: `${nodeContextMenu.x}px`, top: `${nodeContextMenu.y}px` }"
          >
            <button
              class="context-item"
              :disabled="!canDeleteFlowNode(nodeContextMenu.flowNodeId)"
              @click.stop="deleteNodeContextMenuTarget"
            >
              删除节点
            </button>
            <div v-if="!canDeleteFlowNode(nodeContextMenu.flowNodeId)" class="context-hint">
              {{ getDeleteNodeBlockReason(currentGraph, nodeContextMenu.flowNodeId) || "该节点不能删除" }}
            </div>
          </div>
        </div>
      </section>

      <div
        v-if="!focusMode && rightPanelOpen"
        class="resizer resizer-right"
        @pointerdown="startResize('right', $event)"
      ></div>
      <button
        v-if="!focusMode"
        class="panel-toggle panel-toggle-right"
        :title="rightPanelOpen ? '收起右栏 ]' : '展开右栏 ]'"
        @click="toggleRightPanel"
      >
        {{ rightPanelOpen ? "⟩" : "⟨" }}
      </button>
      <aside v-if="!focusMode && rightPanelOpen" class="pane pane-right-wrap">
        <Inspector
          :project="project"
          :selected-node-id="selectedNodeId"
          :selected-map-id="selectedMapId"
          :focused-npc-uid="focusedNpcUid"
          :current-game-map="currentGameMap"
          @select-map="selectMapId"
          @delete-map="deleteMapRegion"
          @delete-node="deleteSelectedNodeFromInspector"
          @patch-map="patchMapRegion($event.id, $event.patch)"
          @rename-map-id="renameMapRegionId($event.oldId, $event.newId)"
          @fit-map="fitMapRegion"
          @layout-zone="autoLayoutCurrentZone"
          @patch-npc="patchGameMapNpc($event.npcUid, $event.patch as Partial<GameMapNpcDef>)"
          @patch-task-entry="patchTaskEntryTitle($event.npcUid, $event.title)"
          @patch-game-map="patchGameMap($event.id, $event.patch)"
          @export-to-cocos="exportGameMapToCocos"
        />
      </aside>
    </main>

    <main v-if="isHome" class="home">
      <div class="home-header">
        <div>
          <h1>项目主页</h1>
          <p class="home-subtitle">每个项目是独立画布编辑器，支持自动保存（约 0.6 秒）与按创建时间排序。</p>
        </div>
        <button class="btn btn-primary" @click="createNewProject">新建项目</button>
      </div>

      <div class="search-row">
        <input v-model="projectSearchKeyword" class="search-input" type="text" placeholder="搜索项目名..." />
      </div>

      <div class="project-list">
        <div v-for="item in filteredProjects" :key="item.id" class="project-item">
          <div class="project-main">
            <div class="project-name">{{ item.name || "未命名" }}</div>
            <div class="project-time">创建时间：{{ new Date(item.createdAt).toLocaleString() }}</div>
            <div class="project-time">最近保存：{{ new Date(item.updatedAt).toLocaleString() }}</div>
          </div>
          <div class="project-actions">
            <button class="btn" @click="activateProjectById(item.id)">进入</button>
            <button class="btn" @click="renameProject(item.id)">改名</button>
            <button class="btn danger" @click="deleteProjectEntry(item.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="filteredProjects.length === 0" class="empty-tip">没有匹配的项目。</div>
    </main>

    <AiAssistantFloating
      v-if="!isHome"
      :visible="isAiAssistantOpen"
      :project="project"
      :nav-context="aiNavContext"
      :selected-node-ids="aiSelectedNodeIds"
      @close="closeAiAssistant"
      @rebuild="onAiRebuild"
      @save="flushCurrentProjectSave"
      @pause-history="onAiPauseHistory"
      @resume-history="onAiResumeHistory"
      @suspend-autosave="onAiSuspendAutosave"
      @resume-autosave="onAiResumeAutosave"
      @export-audit="onAiExportAudit"
      @focus-node="onAiFocusNode"
      @navigate-to-target="navigateToAiTarget"
    />

    <GlobalCheckRepairModal
      :open="globalCheckRepairOpen"
      :project="project"
      @close="closeGlobalCheckRepair"
      @done="onGlobalCheckRepairDone"
      @rebuild="onGlobalCheckRepairDone"
      @save="flushCurrentProjectSave"
      @navigate-npc="onGlobalCheckNavigateNpc"
    />

    <AddNpcDialog
      :open="addNpcDialogOpen"
      :npc-resources="npcResources"
      :placed-count-by-resource-id="placedNpcCountByResourceId"
      @close="addNpcDialogOpen = false"
      @confirm="onAddNpcFromResource"
    />
    <AppModal />
  </div>
</template>

<style scoped>
.root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
}
.root.home-mode {
  /* home 视图占满剩余空间 */
}
.toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 10px;
  padding: 0 12px;
  min-height: 62px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border-strong);
  background: var(--bg-app);
}
.toolbar-main {
  min-width: 0;
}
.left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.brand {
  font-weight: 700;
  letter-spacing: 0.3px;
}
.subtitle {
  font-size: 12px;
  color: var(--fg-secondary);
}
.muted {
  color: var(--fg-tertiary);
}
.layout {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 0;
  overflow: hidden;
}
.library-layout {
  height: 100%;
  min-height: 0;
}
.pane {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.pane > * {
  height: 100%;
}
.pane-left {
  width: var(--left-panel-width);
  min-width: 0;
}
.pane-right-wrap {
  width: var(--right-panel-width);
  min-width: 0;
}
.pane-canvas {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.canvas-shell {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.context-menu {
  position: absolute;
  z-index: 30;
  min-width: 168px;
  max-height: min(420px, 70vh);
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.95);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.45);
}
.context-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 9px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-main);
  font-size: 12px;
  cursor: pointer;
}
.context-item:hover {
  border-color: var(--accent);
  background: rgba(30, 41, 59, 0.6);
}
.resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  flex: 0 0 auto;
}
.resizer:hover::before {
  background: rgba(56, 189, 248, 0.35);
}
.resizer::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(148, 163, 184, 0.2);
}
.panel-toggle {
  width: 18px;
  border: none;
  border-left: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  background: rgba(15, 23, 42, 0.75);
  color: var(--fg-secondary);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.panel-toggle:hover {
  color: var(--fg-main);
  background: rgba(30, 41, 59, 0.85);
}
.panel-toggle-left {
  border-right: none;
}
.panel-toggle-right {
  border-left: none;
}
.right {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.2);
  color: var(--fg-main);
  font-size: 12px;
  cursor: pointer;
}
.btn-soft {
  color: var(--fg-secondary);
}
.btn-warn {
  border-color: rgba(248, 113, 113, 0.55) !important;
  color: #fecaca !important;
}
.btn-danger {
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
}
.btn-danger:hover:not(:disabled) {
  background: rgba(185, 28, 28, 0.55);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.toolbar-hint {
  font-size: 12px;
}
.context-hint {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--fg-tertiary);
  max-width: 220px;
  line-height: 1.35;
}
.toolbar-subline {
  grid-column: 1 / -1;
  display: flex;
  gap: 6px;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 6px;
}
.status-chip {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--fg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(15, 23, 42, 0.35);
}
.save-chip {
  flex: 0 0 auto;
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid var(--border-default);
  background: rgba(15, 23, 42, 0.35);
  color: var(--fg-secondary);
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.save-chip.saving {
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.45);
}
.save-chip.synced {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.35);
}
.save-chip.local-only {
  color: #fde047;
  border-color: rgba(234, 179, 8, 0.45);
  cursor: pointer;
}
.save-chip.error {
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.45);
  cursor: pointer;
}
.storage-offline-banner.recovery-banner {
  background: rgba(14, 165, 233, 0.12);
  border-bottom-color: rgba(56, 189, 248, 0.35);
  color: #bae6fd;
}
.storage-offline-banner.export-blocker-banner {
  background: rgba(239, 68, 68, 0.12);
  border-bottom-color: rgba(248, 113, 113, 0.4);
  color: #fecaca;
}
.storage-offline-banner .link-btn {
  margin-left: 8px;
  padding: 0;
  border: none;
  background: none;
  color: #fda4af;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
}
.storage-offline-banner {
  flex: 0 0 auto;
  padding: 8px 16px;
  background: rgba(234, 179, 8, 0.15);
  border-bottom: 1px solid rgba(234, 179, 8, 0.35);
  color: #fde047;
  font-size: 12px;
  line-height: 1.4;
}
.storage-offline-banner code {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
}
.storage-offline-banner .banner-detail {
  color: rgba(253, 224, 71, 0.85);
}
.btn:hover:not(:disabled) {
  border-color: var(--accent);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.primary {
  border-color: #0ea5e9;
  background: #0369a1;
}
.btn.danger {
  border-color: #7f1d1d;
  background: #3f1111;
}
.home {
  flex: 1 1 auto;
  min-height: 0;
  padding: 24px;
  overflow: auto;
}
.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.home-header h1 {
  margin: 0 0 6px;
  font-size: 24px;
}
.home-subtitle {
  margin: 0;
  color: var(--fg-secondary);
  font-size: 13px;
}
.project-list {
  display: grid;
  gap: 10px;
}
.search-row {
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.25);
  color: var(--fg-main);
  padding: 0 10px;
  outline: none;
}
.search-input:focus {
  border-color: var(--accent);
}
.project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 12px;
  background: rgba(2, 6, 23, 0.35);
}
.project-main {
  display: grid;
  gap: 4px;
}
.project-name {
  font-size: 14px;
  font-weight: 600;
}
.project-time {
  font-size: 12px;
  color: var(--fg-secondary);
}
.project-actions {
  display: flex;
  gap: 8px;
}
.empty-tip {
  margin-top: 14px;
  color: var(--fg-secondary);
  font-size: 13px;
}
.map-layout {
  grid-template-columns: minmax(220px, 280px) 1fr;
}
.map-pane {
  min-height: 0;
  overflow: hidden;
}
.btn-primary {
  border-color: var(--accent-strong);
  background: rgba(14, 165, 233, 0.22);
}
</style>
