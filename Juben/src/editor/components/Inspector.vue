<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  ActionStep,
  CharacterAsset,
  CheckCondition,
  GraphData,
  ProjectData,
  QuestDef,
  QuestStatus,
  Requirement,
  ResourceEntry,
  ResourceKind,
  StoryNode,
  StoryOption,
  StoryMapRegion,
  VariableDef,
} from "../../types";
import { getOptionTargets, setOptionTargets } from "../../types";
import { canDeleteStoryNode, getDeleteNodeBlockReason } from "../adapters";
import { findGameMapForGraph, taskLabelForNpc } from "../game-map-logic";
import { findQuestForMapGraph } from "../quest-logic";
import { NODE_KIND_GUIDE, NODE_OVERLAP_HINTS } from "../node-catalog";
import { normalizeEnemyTokenExpression } from "../enemy-format";
import { battleRefOptions, getClientRuntimeManifest } from "../client-runtime-manifest";
import { collectNpcEventChain, resolveNpcPrefabKey } from "../map-export";
import NpcAppearFields from "./NpcAppearFields.vue";
import NpcPortraitPicker from "./NpcPortraitPicker.vue";
import { normalizeNpcPortraitPath } from "../npc-portrait-catalog";
import { chainPortraitShortLabel } from "../npc-chain-portrait";
import { normalizeNpcAppear, provisionNpcAppearFromChainOrder } from "../npc-appear";
import { cocosMapJsonFilename } from "../cocos-map-publish";
import {
  assertChoiceNodeAllowedForNpc,
  assertChoiceOptionAllowedForNpc,
  chainSlotKindLabel,
  isBattleChoiceTitle,
} from "../chain-slot-guards";
import { inferChainSlotKind } from "../chain-slot-kind";
import { resolveNpcBattleChains } from "../battle-enemy-bind";
import { appAlert, appConfirm } from "../useModal";

const props = defineProps<{
  project: ProjectData;
  selectedNodeId: string | null;
  selectedMapId: string | null;
  focusedNpcUid?: string | null;
  currentGameMap?: import("../../types").GameMapDef | null;
}>();

const emit = defineEmits<{
  (e: "updateSelectedNode", node: StoryNode): void;
  (e: "selectMap", id: string | null): void;
  (e: "deleteMap", id: string): void;
  (e: "deleteNode", nodeId: string): void;
  (e: "patchMap", payload: { id: string; patch: Partial<StoryMapRegion> }): void;
  (e: "renameMapId", payload: { oldId: string; newId: string }): void;
  (e: "fitMap", id: string): void;
  (e: "layoutZone"): void;
  (e: "patchNpc", payload: { npcUid: string; patch: Record<string, unknown> }): void;
  (e: "patchTaskEntry", payload: { npcUid: string; title: string }): void;
  (e: "patchGameMap", payload: { id: string; patch: Partial<import("../../types").GameMapDef> }): void;
  (e: "exportToCocos", gameMapId: string): void;
}>();

const selectedNodeGraph = computed<GraphData | null>(() => {
  if (!props.selectedNodeId) return null;
  return props.project.graphs.find((g) => g.nodes.some((n) => n.id === props.selectedNodeId)) ?? null;
});

const selectedNode = computed<StoryNode | null>(() => {
  if (!props.selectedNodeId || !selectedNodeGraph.value) return null;
  return selectedNodeGraph.value.nodes.find((n) => n.id === props.selectedNodeId) ?? null;
});

const selectedNodeDeleteBlock = computed(() => {
  if (!props.selectedNodeId || !selectedNodeGraph.value) return null;
  return getDeleteNodeBlockReason(selectedNodeGraph.value, props.selectedNodeId);
});

const canDeleteSelectedNode = computed(() => {
  if (!props.selectedNodeId || !selectedNodeGraph.value) return false;
  return canDeleteStoryNode(selectedNodeGraph.value, props.selectedNodeId);
});

const variables = computed<VariableDef[]>(() => props.project.variables);
const quests = computed<QuestDef[]>(() => props.project.quests);
const questsWithTaskId = computed(() =>
  [...quests.value]
    .filter((q) => q.taskId != null && Number(q.taskId) > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
);
const graphByMap = computed<GraphData | null>(() => {
  if (!props.selectedMapId) return null;
  return props.project.graphs.find((g) => (g.maps ?? []).some((m) => m.id === props.selectedMapId)) ?? null;
});
const selectedMap = computed<StoryMapRegion | null>(() => {
  if (!props.selectedMapId) return null;
  return graphByMap.value?.maps?.find((m) => m.id === props.selectedMapId) ?? null;
});
const selectedMapNodes = computed(() => {
  if (!selectedMap.value || !graphByMap.value) return [];
  return graphByMap.value.nodes.filter((n) => n.mapId === selectedMap.value!.id);
});
const mapIdDraft = ref("");
const mapNameDraft = ref("");
const characterAssets = computed<CharacterAsset[]>(() => props.project.characterAssets ?? []);
const characterById = computed(() => new Map(characterAssets.value.map((x) => [x.id, x] as const)));
const sideGraphs = computed(() => props.project.graphs.filter((g) => g.kind === "side"));
const callQuestTargets = computed(() => [
  ...quests.value.map((q) => ({ value: `quest:${q.id}`, label: `任务：${q.name}`, graphId: q.graphId })),
  ...sideGraphs.value.map((g) => ({ value: `side:${g.id}`, label: `支线：${g.name}`, graphId: g.id })),
]);
const varById = computed(() => new Map(variables.value.map((v) => [v.id, v] as const)));
const questById = computed(() => new Map(quests.value.map((q) => [q.id, q] as const)));

const resourceDict = computed(() => props.project.resources ?? {});
function resourcesOf(kind: ResourceKind): ResourceEntry[] {
  return (resourceDict.value as any)?.[kind] ?? [];
}
function resourceName(kind: ResourceKind, id: string | undefined) {
  if (!id) return "";
  const item = resourcesOf(kind).find((x) => x.id === id);
  return item?.name ?? id;
}

const items = computed(() => resourcesOf("item"));
const npcs = computed(() => resourcesOf("npc"));
const pets = computed(() => resourcesOf("pet"));
const skills = computed(() => resourcesOf("skill"));
const dropTables = computed(() => resourcesOf("dropTable"));
const battleConfigs = computed(() => resourcesOf("battleConfig"));
const areas = computed(() => resourcesOf("area"));
const gameMapNpcs = computed(() => {
  const g = selectedNodeGraph.value;
  if (!g) return [];
  const gm = findGameMapForGraph(props.project, g.id);
  return gm?.npcs ?? [];
});

/** 当前地图画布关联的章节任务（时间线同步） */
const contextMapQuest = computed(() => {
  const g = selectedNodeGraph.value;
  if (!g || g.kind !== "map") return null;
  return findQuestForMapGraph(props.project, g.id);
});

const OPTION_INSPECTOR_KINDS = new Set<StoryNode["kind"]>(["choice", "condition", "questCheck", "callQuest"]);
const showOptionsInspector = computed(() => {
  const node = selectedNode.value;
  if (!node || node.options.length === 0) return false;
  return OPTION_INSPECTOR_KINDS.has(node.kind);
});

/** 选择节点才展示分支反馈 / 运行时字段 */
const showOptionRuntimeFields = computed(() => selectedNode.value?.kind === "choice");

/** 地图剧情链已有「任务进度」节点，选项内不再展示接/完成任务（旧数据仍导出） */
const showLegacyOptionTaskEffects = computed(() => {
  if (selectedNode.value?.kind !== "choice") return false;
  if (contextMapQuest.value) return false;
  return true;
});

const choiceMapTaskHint = computed(
  () => selectedNode.value?.kind === "choice" && !!contextMapQuest.value && selectedNodeGraph.value?.kind === "map",
);

const showResourceRefs = computed(() => {
  const k = selectedNode.value?.kind;
  return k === "battle" || k === "action" || k === "check";
});

const selectedNodeGuide = computed(() => {
  const k = selectedNode.value?.kind;
  return k ? NODE_KIND_GUIDE[k] : "";
});

const selectedNodeOverlapHint = computed(() => {
  const k = selectedNode.value?.kind;
  return k ? NODE_OVERLAP_HINTS[k] : "";
});

const selectedNpc = computed(() => {
  const gm = props.currentGameMap;
  if (!gm) return null;
  const node = selectedNode.value;

  // 画布 npcEntry / dialog / choice：每条任务链统一 prefabKey（GameMapNpc）
  if (node?.kind === "npcEntry" || node?.kind === "dialog" || node?.kind === "choice") {
    if (node.npcUid) {
      const byUid = gm.npcs.find((n) => n.npcUid === node.npcUid);
      if (byUid) return byUid;
    }
    if (node.mapId) {
      const graph = props.project.graphs.find((g) => g.id === gm.graphId);
      const zone = graph?.maps?.find((m) => m.id === node.mapId);
      if (zone?.npcUid) {
        const byZone = gm.npcs.find((n) => n.npcUid === zone.npcUid);
        if (byZone) return byZone;
      }
    }
    const byEntry = gm.npcs.find((n) => n.entryNodeId === node.id);
    if (byEntry) return byEntry;
  }

  if (node?.npcUid) {
    return gm.npcs.find((n) => n.npcUid === node.npcUid) ?? null;
  }

  const zone = selectedMap.value;
  if (zone?.npcUid) {
    return gm.npcs.find((n) => n.npcUid === zone.npcUid) ?? null;
  }

  if (props.focusedNpcUid) {
    return gm.npcs.find((n) => n.npcUid === props.focusedNpcUid) ?? null;
  }
  return null;
});

const selectedNodeNpcLabel = computed(() => {
  const npc = selectedNpc.value;
  const gm = props.currentGameMap;
  if (!npc || !gm) return "";
  const idx = gm.npcs.findIndex((n) => n.npcUid === npc.npcUid);
  return taskLabelForNpc(props.project, gm, npc, Math.max(idx, 0));
});

const selectedNpcBundleIndex = computed(() => {
  const gm = props.currentGameMap;
  const npc = selectedNpc.value;
  if (!gm || !npc) return -1;
  return gm.npcs.findIndex((n) => n.npcUid === npc.npcUid);
});

const selectedNpcAppear = computed(() => {
  const npc = selectedNpc.value;
  if (!npc) return null;
  return normalizeNpcAppear(npc);
});

const selectedNpcSlotKind = computed((): "dialog" | "battle" => {
  const npc = selectedNpc.value;
  const gm = props.currentGameMap;
  const graph = selectedNodeGraph.value;
  if (!npc || !gm || !graph) return "dialog";
  return npc.chainSlotKind ?? inferChainSlotKind(props.project, graph, gm, npc.npcUid);
});

const selectedNpcBattleBinds = computed(() => {
  const npc = selectedNpc.value;
  const gm = props.currentGameMap;
  const graph = selectedNodeGraph.value;
  if (!npc || !gm || !graph || selectedNpcSlotKind.value !== "battle") return [];
  return resolveNpcBattleChains(props.project, gm, npc.npcUid, graph);
});

const choiceBlocksStartBattle = computed(() => {
  const npc = selectedNpc.value;
  const gm = props.currentGameMap;
  const graph = selectedNodeGraph.value;
  if (!npc || !gm || !graph) return false;
  return selectedNpcSlotKind.value === "dialog";
});

const battleRmWinLoseOptions = computed(() => {
  const node = selectedNode.value;
  if (!node || node.kind !== "battle") return [];
  return node.options.slice(0, 2);
});

const portalBoundGameMap = computed(() => {
  const node = selectedNode.value;
  if (!node || node.kind !== "mapPortal" || !node.gameMapId) return null;
  return props.project.gameMaps?.find((gm) => gm.id === node.gameMapId) ?? null;
});

const portalCocosExportHint = computed(() => {
  const gm = portalBoundGameMap.value;
  if (!gm) return "";
  try {
    return cocosMapJsonFilename(gm.mapId);
  } catch {
    return "（请先设置地图 ID）";
  }
});

function patchPortalGameMap(patch: Partial<import("../../types").GameMapDef>) {
  const gm = portalBoundGameMap.value;
  if (!gm) return;
  emit("patchGameMap", { id: gm.id, patch });
}

function onPortalMapIdInput(ev: Event) {
  const raw = Number((ev.target as HTMLInputElement).value);
  patchPortalGameMap({ mapId: Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0 });
}

function patchNpcAppear(npcUid: string, patch: Partial<import("../../types").NpcAppearConfig>) {
  const npc = props.currentGameMap?.npcs.find((n) => n.npcUid === npcUid);
  if (!npc) return;
  const cur = normalizeNpcAppear(npc);
  emit("patchNpc", { npcUid, patch: { appear: { ...cur, ...patch } } });
}

function bindPrevBundleAppear() {
  const gm = props.currentGameMap;
  const npc = selectedNpc.value;
  if (!gm || !npc) return;
  provisionNpcAppearFromChainOrder(props.project, gm, { onlyEmpty: false, npcUid: npc.npcUid });
  const updated = gm.npcs.find((n) => n.npcUid === npc.npcUid);
  if (updated?.appear) {
    emit("patchNpc", { npcUid: npc.npcUid, patch: { appear: updated.appear } });
  }
}

async function onChainSlotKindChange(ev: Event) {
  const npc = selectedNpc.value;
  if (!npc) return;
  const next = (ev.target as HTMLSelectElement).value as "dialog" | "battle";
  const prev = npc.chainSlotKind ?? selectedNpcSlotKind.value;
  if (next === prev) return;
  if (next === "dialog") {
    const ok = await appConfirm(
      "切换为「对话页」将自动剥离战斗侧链（对标 RM：Show Text 页不含 Battle Processing）。确定？",
      "页类型",
    );
    if (!ok) {
      (ev.target as HTMLSelectElement).value = prev;
      return;
    }
  }
  emit("patchNpc", { npcUid: npc.npcUid, patch: { chainSlotKind: next } });
}

function onChoiceTitleBlur(node: StoryNode) {
  const gm = props.currentGameMap;
  const graph = selectedNodeGraph.value;
  if (!gm || !graph || node.kind !== "choice") return;
  const g = assertChoiceNodeAllowedForNpc(props.project, graph, gm, node.npcUid, node);
  if (!g.ok) {
    void appAlert(g.reason, "对话页限制");
    if (isBattleChoiceTitle(node.title)) node.title = "选择";
  }
}

function onForcedResultChange(opt: StoryOption, ev: Event) {
  const gm = props.currentGameMap;
  const graph = selectedNodeGraph.value;
  const npc = selectedNpc.value;
  const value = (ev.target as HTMLSelectElement).value;
  const next = value === "" ? undefined : (value as StoryOption["forcedResult"]);
  if (next && npc && gm && graph) {
    const g = assertChoiceOptionAllowedForNpc(props.project, graph, gm, npc.npcUid, {
      forcedResult: next,
      text: opt.text,
    });
    if (!g.ok) {
      void appAlert(g.hint ? `${g.reason}\n\n${g.hint}` : g.reason, "对话页限制");
      opt.forcedResult = undefined;
      return;
    }
  }
  opt.forcedResult = next;
}

function showSelfSwitchHint() {
  void appAlert(
    "本链交任务（questUpdate·已完成）或侧链战斗胜利后会写入 event_done，供下一条任务链的「页条件」引用——对标 RM MV 的 Self Switch A。",
    "Self Switch（event_done）",
  );
}

function commitEntryTitle() {
  const node = selectedNode.value;
  if (node?.kind !== "npcEntry" || !node.npcUid) return;
  emit("patchTaskEntry", { npcUid: node.npcUid, title: node.title?.trim() || "任务" });
}

/** 与地图标记、导出 JSON 同源：prefabKey override > 资源库 image */
const selectedNpcPortraitPath = computed({
  get(): string {
    const npc = selectedNpc.value;
    if (!npc) return "";
    return normalizeNpcPortraitPath(resolveNpcPrefabKey(props.project, npc)) ?? "";
  },
  set(value: string) {
    const npc = selectedNpc.value;
    if (!npc) return;
    const normalized = normalizeNpcPortraitPath(value.trim()) || undefined;
    emit("patchNpc", { npcUid: npc.npcUid, patch: { prefabKey: normalized } });
  },
});

watch(
  () => [selectedNode.value?.id, selectedNode.value?.kind, contextMapQuest.value?.id] as const,
  () => {
    const node = selectedNode.value;
    const q = contextMapQuest.value;
    if (!node || node.kind !== "questUpdate" || !q) return;
    if (!node.questId) node.questId = q.id;
  },
);

function ensureActions(node: StoryNode) {
  if (node.kind !== "action") return;
  if (!Array.isArray(node.actions)) node.actions = [];
}
function addActionStep(node: StoryNode) {
  if (node.kind !== "action") return;
  ensureActions(node);
  node.actions!.push({ kind: "popup", text: "" });
}
function addActionStepKind(node: StoryNode, kind: ActionStep["kind"]) {
  if (node.kind !== "action") return;
  ensureActions(node);
  if (kind === "revealNpc") node.actions!.push({ kind: "revealNpc", npcUid: "" });
  else if (kind === "spawnNpc") node.actions!.push({ kind: "spawnNpc", npcUid: "" });
  else if (kind === "teleport") node.actions!.push({ kind: "teleport", toMapId: 1, toX: 0, toY: 0 });
  else if (kind === "setQuestStatus") {
    const q = quests.value[0];
    node.actions!.push({ kind: "setQuestStatus", questId: q?.id ?? "", status: "Completed" });
  } else if (kind === "popup") node.actions!.push({ kind: "popup", text: "" });
}
function deleteActionStep(node: StoryNode, idx: number) {
  if (node.kind !== "action") return;
  ensureActions(node);
  node.actions = node.actions!.filter((_, i) => i !== idx);
}

function ensureChecks(node: StoryNode) {
  if (node.kind !== "check") return;
  if (!node.checkMode) node.checkMode = "ALL";
  if (!Array.isArray(node.checks)) node.checks = [];
}
function addCheck(node: StoryNode, kind: CheckCondition["kind"]) {
  if (node.kind !== "check") return;
  ensureChecks(node);
  if (kind === "questStatus") {
    const q = quests.value[0];
    node.checks!.push({ kind, questId: q?.id ?? "", status: "Completed" });
    return;
  }
  if (kind === "varEquals") {
    const v = variables.value[0];
    node.checks!.push({
      kind,
      varId: v?.id ?? "",
      value: v?.type === "number" ? 0 : v?.type === "string" ? "" : false,
    });
    return;
  }
  if (kind === "serverVarEquals") {
    node.checks!.push({ kind, key: "", value: true });
    return;
  }
  if (kind === "hasPet") {
    const p = pets.value[0];
    node.checks!.push({ kind, petId: p?.id ?? "" });
    return;
  }
  if (kind === "bagSpaceAtLeast") {
    node.checks!.push({ kind, slots: 1 });
    return;
  }
  node.checks!.push({ kind, key: "" });
}
function deleteCheck(node: StoryNode, idx: number) {
  if (node.kind !== "check") return;
  ensureChecks(node);
  node.checks = node.checks!.filter((_, i) => i !== idx);
}

function ensureDialogLines(node: StoryNode) {
  if (node.kind !== "dialog") return;
  if (!node.dialogLines || node.dialogLines.length === 0) {
    node.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: (node.text ?? "").trim() }];
  }
  if (node.text && node.dialogLines[0] && node.dialogLines[0].text.trim() === "") {
    node.dialogLines[0].text = node.text;
  }
}

function addDialogLine(node: StoryNode) {
  ensureDialogLines(node);
  node.dialogLines!.push({ id: `line_${crypto.randomUUID()}`, text: "" });
}

function deleteDialogLine(node: StoryNode, lineId: string) {
  ensureDialogLines(node);
  node.dialogLines = node.dialogLines!.filter((l) => l.id !== lineId);
  if (node.dialogLines.length === 0) node.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: "" }];
}

function moveDialogLine(node: StoryNode, lineId: string, dir: -1 | 1) {
  ensureDialogLines(node);
  const idx = node.dialogLines!.findIndex((l) => l.id === lineId);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= node.dialogLines!.length) return;
  const next = [...node.dialogLines!];
  const tmp = next[idx];
  next[idx] = next[j];
  next[j] = tmp;
  node.dialogLines = next;
}

function normalizeYesNo(node: StoryNode) {
  node.options = [
    node.options[0] ? { ...node.options[0], text: "是" } : { id: `opt_${crypto.randomUUID()}`, text: "是" },
    node.options[1] ? { ...node.options[1], text: "否" } : { id: `opt_${crypto.randomUUID()}`, text: "否" },
  ];
}

function normalizeWinLose(node: StoryNode) {
  node.options = [
    node.options[0] ? { ...node.options[0], text: "胜利" } : { id: `opt_${crypto.randomUUID()}`, text: "胜利" },
    node.options[1] ? { ...node.options[1], text: "失败" } : { id: `opt_${crypto.randomUUID()}`, text: "失败" },
  ];
}

function ensureEnemyIds(node: StoryNode) {
  if (node.kind !== "battle") return;
  if (!Array.isArray(node.enemyIds) || node.enemyIds.length === 0) {
    node.enemyIds = [""];
  }
}

function normalizeEnemyIdAt(node: StoryNode, index: number) {
  if (node.kind !== "battle") return;
  ensureEnemyIds(node);
  const list = node.enemyIds!;
  list[index] = normalizeEnemyTokenExpression(list[index] ?? "");
}

function addEnemyRow(node: StoryNode) {
  if (node.kind !== "battle") return;
  ensureEnemyIds(node);
  node.enemyIds!.push("");
}

function deleteEnemyRow(node: StoryNode, idx: number) {
  if (node.kind !== "battle") return;
  ensureEnemyIds(node);
  if (node.enemyIds!.length <= 1) return;
  node.enemyIds!.splice(idx, 1);
}

function addOption(node: StoryNode) {
  node.options.push({ id: `opt_${crypto.randomUUID()}`, text: "新的选项" });
}

function deleteOption(node: StoryNode, idx: number) {
  if (node.options.length <= 1) return;
  node.options.splice(idx, 1);
}

function ensureCallQuestPrimaryOption(node: StoryNode) {
  if (node.kind !== "callQuest") return;
  if (!node.options.length) {
    node.options.push({ id: `opt_${crypto.randomUUID()}`, text: "开始并进入任务" });
  } else {
    node.options[0].text = "开始并进入任务";
  }
}

function optionTargetsLabel(opt: StoryOption) {
  const t = getOptionTargets(opt);
  return t.length ? t.join("、") : "未连接";
}

function onOptionEndChange(opt: StoryOption) {
  if (opt.isEnd) setOptionTargets(opt, []);
}

function onCompletesEventChange(opt: StoryOption, e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  if (v === "false") opt.completesEvent = false;
  else if (v === "true") opt.completesEvent = true;
  else delete opt.completesEvent;
}

function optionTaskActionValue(opt: StoryOption): string {
  if (opt.effectTaskAccept) return `accept:${opt.effectTaskAccept}`;
  if (opt.effectTaskComplete) return `complete:${opt.effectTaskComplete}`;
  return "";
}

function setOptionTaskAction(opt: StoryOption, value: string) {
  delete opt.effectTaskAccept;
  delete opt.effectTaskComplete;
  if (!value) return;
  const sep = value.indexOf(":");
  if (sep <= 0) return;
  const action = value.slice(0, sep);
  const taskId = Number(value.slice(sep + 1));
  if (!Number.isFinite(taskId) || taskId <= 0) return;
  if (action === "accept") opt.effectTaskAccept = taskId;
  else if (action === "complete") opt.effectTaskComplete = taskId;
}

function hasLegacyOptionTaskEffect(opt: StoryOption): boolean {
  return !!(opt.effectTaskAccept || opt.effectTaskComplete);
}

function legacyOptionTaskEffectLabel(opt: StoryOption): string {
  const parts: string[] = [];
  if (opt.effectTaskAccept) {
    const q = questsWithTaskId.value.find((x) => x.taskId === opt.effectTaskAccept);
    parts.push(`接取 ${q?.name ?? opt.effectTaskAccept}`);
  }
  if (opt.effectTaskComplete) {
    const q = questsWithTaskId.value.find((x) => x.taskId === opt.effectTaskComplete);
    parts.push(`完成 ${q?.name ?? opt.effectTaskComplete}`);
  }
  return parts.join("；");
}

function clearLegacyOptionTaskEffects(opt: StoryOption) {
  delete opt.effectTaskAccept;
  delete opt.effectTaskComplete;
}

function forcedResultLabel(value: StoryOption["forcedResult"]): string {
  if (value === "block") return "阻断";
  if (value === "start_battle") return "进入战斗";
  if (value === "teleport") return "传送";
  return "无";
}

function onNpcExitHideChange(e: Event) {
  const node = selectedNode.value;
  if (!node || node.kind !== "npcExit") return;
  node.hideNpcOnEnd = (e.target as HTMLInputElement).checked;
}

const MAP_CHAIN_EVENT_KINDS = new Set(["dialog", "choice", "battle", "questUpdate", "action"]);

const isMapChainEventNode = computed(() => {
  const n = selectedNode.value;
  const g = selectedNodeGraph.value;
  if (!n || !g || g.kind !== "map") return false;
  return MAP_CHAIN_EVENT_KINDS.has(n.kind);
});

function onChainContinuousChange(e: Event) {
  const node = selectedNode.value;
  if (!node) return;
  node.chainContinuous = (e.target as HTMLInputElement).checked;
}

function onRequiresApproachChange(e: Event) {
  const node = selectedNode.value;
  if (!node) return;
  node.requiresApproach = (e.target as HTMLInputElement).checked;
}

const manifestBattleRefs = computed(() => battleRefOptions());
const supportedReqTypes = computed(() => getClientRuntimeManifest().supportedRequirementTypes);

const chainExportHint = computed(() => {
  const node = selectedNode.value;
  const g = selectedNodeGraph.value;
  if (!node || !g || g.kind !== "map") return "";
  const chain = props.currentGameMap
    ? (() => {
        const npc = props.currentGameMap!.npcs.find((n) => n.zoneId === node.mapId);
        if (!npc?.entryNodeId) return [];
        return collectNpcEventChain(g, npc.entryNodeId);
      })()
    : [];
  const idx = chain.findIndex((n) => n.id === node.id);
  const nextNode = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
  const parts: string[] = [];
  if (node.requiresApproach) parts.push("requiresApproach=是");
  if (idx === 0) parts.push("链首须按 E 开始");
  if (idx > 0) {
    parts.push(node.chainContinuous ? "上一环→本步：同次接触" : "上一环→本步：须再接触");
  }
  if (nextNode) {
    parts.push(nextNode.chainContinuous ? "本步→下一步：保持接触（仍须再按 E）" : "本步→下一步：结束接触");
  } else if (idx >= 0) {
    parts.push("链末：结束接触");
  }
  return parts.join(" · ");
});

function ensureRuntimeRequirements(node: StoryNode) {
  if (!node.runtimeRequirements) node.runtimeRequirements = [];
}

function addRuntimeRequirement(node: StoryNode) {
  ensureRuntimeRequirements(node);
  node.runtimeRequirements!.push({ type: "task_completed", taskId: 100001 });
}

function removeRuntimeRequirement(node: StoryNode, idx: number) {
  node.runtimeRequirements?.splice(idx, 1);
}

function requirementLabel(r: Requirement) {
  if (r.kind === "questStatus")
    return `任务 ${questById.value.get(r.questId)?.name ?? r.questId} = ${questStatusLabel(r.status)}`;
  return `变量 ${varById.value.get(r.varId)?.name ?? r.varId} == ${String(r.value)}`;
}

function questStatusLabel(status?: QuestStatus) {
  if (status === "NotStarted") return "未开始";
  if (status === "InProgress") return "进行中";
  if (status === "Completed") return "已完成";
  if (status === "Failed") return "失败";
  return "未设置";
}

function addQuestRequirement(node: StoryNode) {
  if (node.kind !== "condition" && node.kind !== "questCheck") return;
  const q = quests.value[0];
  node.requirements = node.requirements ?? [];
  node.requirements.push({ kind: "questStatus", questId: q?.id ?? "", status: "Completed" });
}

function addVarRequirement(node: StoryNode) {
  if (node.kind !== "condition" && node.kind !== "questCheck") return;
  const v = variables.value[0];
  node.requirements = node.requirements ?? [];
  node.requirements.push({
    kind: "varEquals",
    varId: v?.id ?? "",
    value: v?.type === "number" ? 0 : v?.type === "string" ? "" : false,
  });
}

function deleteRequirement(node: StoryNode, idx: number) {
  if (node.kind !== "condition" && node.kind !== "questCheck") return;
  node.requirements = (node.requirements ?? []).filter((_, i) => i !== idx);
}

function ensureCallQuestTargets(node: StoryNode) {
  if (!node.callQuestTargets) node.callQuestTargets = [];
}

function isCallQuestTargetChecked(node: StoryNode, value: string) {
  ensureCallQuestTargets(node);
  return node.callQuestTargets!.includes(value);
}

function toggleCallQuestTarget(node: StoryNode, value: string, checked: boolean) {
  ensureCallQuestTargets(node);
  const set = new Set(node.callQuestTargets!);
  if (checked) set.add(value);
  else set.delete(value);
  node.callQuestTargets = [...set];
}

function onCharacterOffsetInput(node: StoryNode, key: "characterX" | "characterY", raw: string) {
  const v = Number(raw);
  if (Number.isFinite(v)) {
    node[key] = v;
    return;
  }
  delete node[key];
}

watch(
  () => selectedMap.value?.id,
  (id) => {
    mapIdDraft.value = id ?? "";
  },
  { immediate: true },
);

watch(
  () => selectedMap.value?.id,
  () => {
    mapNameDraft.value = selectedMap.value?.name ?? "";
  },
  { immediate: true },
);

function commitMapIdRename() {
  const m = selectedMap.value;
  if (!m) return;
  const next = mapIdDraft.value.trim();
  if (!next || next === m.id) {
    mapIdDraft.value = m.id;
    return;
  }
  emit("renameMapId", { oldId: m.id, newId: next });
}

function commitMapNamePatch() {
  const m = selectedMap.value;
  if (!m) return;
  const next = mapNameDraft.value;
  const prev = m.name ?? "";
  if (next === prev) return;
  emit("patchMap", { id: m.id, patch: { name: next } });
}
</script>

<template>
  <section class="panel panel-right" @wheel.stop>
    <div class="section-title">属性</div>

    <div v-if="selectedNode" class="node-summary">
      <div class="summary-line"><span class="summary-k">类型</span>{{ selectedNode.kind }}</div>
      <div class="summary-line"><span class="summary-k">标题</span>{{ selectedNode.title || "（无）" }}</div>
      <div v-if="selectedNodeNpcLabel" class="summary-line">
        <span class="summary-k">所属 NPC</span>{{ selectedNodeNpcLabel }}
      </div>
    </div>

    <div v-if="selectedNode">
      <div v-if="selectedNodeGuide" class="node-guide">{{ selectedNodeGuide }}</div>
      <div v-if="selectedNodeOverlapHint" class="node-guide warn">{{ selectedNodeOverlapHint }}</div>

      <div class="row row-left node-actions">
        <button
          class="btn btn-danger"
          type="button"
          :disabled="!canDeleteSelectedNode"
          :title="selectedNodeDeleteBlock || '删除选中节点 (Del)'"
          @click="emit('deleteNode', selectedNode.id)"
        >
          删除节点
        </button>
        <span v-if="selectedNodeDeleteBlock" class="hint">{{ selectedNodeDeleteBlock }}</span>
      </div>

      <div class="field">
        <label>所属地图</label>
        <input :value="selectedNode.mapId || '（未分配）'" readonly />
      </div>

      <div class="field">
        <label>{{ selectedNode.kind === "npcEntry" ? "任务标题" : "标题（画布显示名）" }}</label>
        <input
          v-model="selectedNode.title"
          @change="selectedNode.kind === 'npcEntry' ? commitEntryTitle() : undefined"
        />
      </div>

      <details v-if="isMapChainEventNode" class="inspector-group" open>
        <summary>运行时</summary>
        <div class="group-body">
          <div v-if="isMapChainEventNode" class="field">
            <label class="inline checkbox-row">
              <input
                type="checkbox"
                :checked="selectedNode.chainContinuous === true"
                @change="onChainContinuousChange"
              />
              持续触发
            </label>
            <label class="inline checkbox-row">
              <input
                type="checkbox"
                :checked="selectedNode.requiresApproach === true"
                @change="onRequiresApproachChange"
              />
              须再次靠近才触发本步
            </label>
            <div v-if="chainExportHint" class="hint export-hint">导出预览：{{ chainExportHint }}</div>
            <div class="hint">
              持续触发：勾选表示与上一环同一次接触（无需再靠近），但本步仍须按
              E/确定才会开始；不勾选则完成上一环后须再次接触才能继续。
            </div>
          </div>

          <div v-if="isMapChainEventNode" class="field">
            <label>推进条件</label>
            <div class="hint">仅使用客户端 manifest 支持的 type（task_* / event_done）。</div>
            <div
              v-for="(req, ri) in (ensureRuntimeRequirements(selectedNode), selectedNode.runtimeRequirements!)"
              :key="ri"
              class="row row-left"
            >
              <select v-model="(req as Record<string, unknown>).type" style="width: 140px">
                <option v-for="t in supportedReqTypes" :key="t" :value="t">{{ t }}</option>
              </select>
              <input
                v-if="String((req as Record<string, unknown>).type).includes('task')"
                type="number"
                placeholder="taskId"
                :value="Number((req as Record<string, unknown>).taskId ?? 0)"
                @input="(req as Record<string, unknown>).taskId = Number(($event.target as HTMLInputElement).value)"
              />
              <button class="btn btn-del-opt" type="button" @click="removeRuntimeRequirement(selectedNode, ri)">
                删
              </button>
            </div>
            <button class="btn" type="button" @click="addRuntimeRequirement(selectedNode)">+ 条件</button>
          </div>
        </div>
      </details>

      <div v-if="selectedNode.kind === 'mapPortal'" class="field">
        <label>绑定地图</label>
        <select v-model="selectedNode.gameMapId">
          <option value="">（未绑定）</option>
          <option v-for="gm in project.gameMaps ?? []" :key="gm.id" :value="gm.id">
            {{ gm.mapName || gm.mapCode }}
          </option>
        </select>
      </div>
      <div v-if="selectedNode.kind === 'mapPortal' && portalBoundGameMap" class="field">
        <label>地图 ID</label>
        <input
          type="number"
          min="0"
          step="1"
          :value="portalBoundGameMap.mapId"
          @input="onPortalMapIdInput"
        />
        <div class="hint">导出 Cocos 文件名：{{ portalCocosExportHint }} · mapCode：{{ portalBoundGameMap.mapCode }}</div>
      </div>
      <div v-if="selectedNode.kind === 'mapPortal'" class="field">
        <label>任务编号</label>
        <input
          type="number"
          :value="selectedNode.portalTaskId"
          @input="selectedNode.portalTaskId = Number(($event.target as HTMLInputElement).value) || undefined"
        />
      </div>
      <div v-if="selectedNode.kind === 'mapPortal'" class="field">
        <label>初始任务状态</label>
        <select v-model="selectedNode.initialQuestStatus">
          <option value="NotStarted">未开始</option>
          <option value="InProgress">进行中</option>
          <option value="Completed">已完成</option>
          <option value="Failed">失败</option>
        </select>
      </div>
      <div v-if="selectedNode.kind === 'mapPortal' && portalBoundGameMap" class="field">
        <button
          class="btn btn-primary"
          type="button"
          @click="emit('exportToCocos', portalBoundGameMap.id)"
        >
          发布到游戏
        </button>
        <div class="hint">双写 Cocos map_{mapId}.json + server/data/story_maps（已存在时会提示覆盖）</div>
      </div>
      <div v-if="selectedNode.kind === 'mapPortal'" class="hint">双击节点进入地图摆点与任务剧情链。</div>

      <div v-if="selectedNode.kind === 'npcEntry' && selectedNpc" class="field entry-visual">
        <div class="hint task-visual-hint">
          本任务链：{{ selectedNodeNpcLabel }}（{{ selectedNpc.npcUid }}）
        </div>
        <label>页类型（对标 RM Event Page）</label>
        <select
          class="shell-input"
          :value="selectedNpc.chainSlotKind ?? selectedNpcSlotKind"
          @change="onChainSlotKindChange"
        >
          <option value="dialog">对话页 · 仅 Show Text / 接取交任务</option>
          <option value="battle">战斗页 · 任务官 + 独立战斗 Event</option>
        </select>
        <div class="hint">当前：{{ chainSlotKindLabel(selectedNpc.chainSlotKind ?? selectedNpcSlotKind) }}</div>
        <label style="margin-top: 8px">触发方式</label>
        <div class="hint">玩家交互（Action Button）— 走近 NPC 按交互键</div>
        <label class="inline" style="margin-top: 6px">
          <input v-model="selectedNode.chainContinuous" type="checkbox" />
          连续执行（类似 Autorun，接取后不中断；完成后需交任务/exit 防循环）
        </label>
        <NpcPortraitPicker
          v-model="selectedNpcPortraitPath"
          label="NPC 形象（本任务链）"
          compact
        />
        <div class="hint">全链统一：对话 / 左栏 / 地图蓝点 / 导出一致。仅红色「战斗敌人」可单独指定。</div>
        <div v-if="selectedNpcPortraitPath" class="row row-left" style="margin-top: 6px">
          <label class="inline mini-field">
            <span>X</span>
            <input
              :value="String(selectedNode.characterX ?? 0)"
              type="number"
              @change="onCharacterOffsetInput(selectedNode, 'characterX', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="inline mini-field">
            <span>Y</span>
            <input
              :value="String(selectedNode.characterY ?? 0)"
              type="number"
              @change="onCharacterOffsetInput(selectedNode, 'characterY', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <div v-if="selectedNode.kind === 'npcEntry' && selectedNpc && currentGameMap" class="field entry-appear">
        <label>页条件（出现条件 · Page Conditions）</label>
        <div class="hint">
          任务束 #{{ selectedNpcBundleIndex + 1 }} / 共 {{ currentGameMap.npcs.length }} 条 · 列表顺序决定游戏里逐个出现
        </div>
        <div
          v-if="selectedNpcAppear?.mode === 'conditional' && !(selectedNpcAppear.requirements?.length ?? 0)"
          class="hint warn"
        >
          未配置条件时 NPC 在地图上保持隐藏。
        </div>
        <NpcAppearFields
          :npc="selectedNpc"
          :project="project"
          @patch="patchNpcAppear(selectedNpc.npcUid, $event)"
        />
        <button
          v-if="selectedNpcBundleIndex > 0"
          class="btn btn-sm"
          type="button"
          @click="bindPrevBundleAppear"
        >
          绑定前一条 event_done（Self Switch）
        </button>
        <button class="btn btn-sm" type="button" style="margin-left: 6px" @click="showSelfSwitchHint">
          Self Switch 说明
        </button>
      </div>

      <details v-if="selectedNpc && selectedNpcSlotKind === 'battle' && selectedNpcBattleBinds.length" class="inspector-group">
        <summary>战斗 Event（侧链 · 对标 RM Battle Processing）</summary>
        <div class="group-body">
          <p class="hint">任务官主链只负责对话与接取；开战在下方独立敌人 Event，勿在主链加 battle 节点。</p>
          <ul class="battle-bind-list">
            <li v-for="(bind, i) in selectedNpcBattleBinds" :key="i">
              {{ bind.enemyName }} ·
              {{ bind.enemyAppearNodeId ? "敌人出现" : "—" }} →
              {{ bind.battlePrepNodeId ? "战前" : "—" }} →
              {{ bind.battleNodeId ? "战斗" : "—" }}
              <span v-if="bind.battleConfigId" class="muted">（{{ bind.battleConfigId }}）</span>
            </li>
          </ul>
        </div>
      </details>

      <div v-if="selectedNode.kind === 'dialog'" class="field">
        <label>说话人</label>
        <input v-model="selectedNode.speaker" placeholder="比如：旁白 / NPC_001" />
      </div>

      <div v-if="(selectedNode.kind === 'dialog' || selectedNode.kind === 'choice') && selectedNpc" class="field">
        <NpcPortraitPicker
          v-model="selectedNpcPortraitPath"
          label="NPC 形象（本任务链统一）"
          compact
        />
        <div class="hint">
          当前：{{ chainPortraitShortLabel(project, selectedNpc) }} · 修改后同步左栏与地图。
          战斗页额外召唤的敌人请在左栏红色「战斗敌人」行单独指定。
        </div>
      </div>

      <div v-if="selectedNode.kind === 'dialog'" class="field">
        <label>NPC 资源（可选）</label>
        <select v-model="selectedNode.npcId">
          <option value="">（不绑定 NPC）</option>
          <option v-for="x in npcs" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
        </select>
        <div v-if="selectedNode.npcId" class="hint">当前：{{ resourceName("npc", selectedNode.npcId) }}</div>
      </div>

      <div v-if="selectedNode.kind === 'dialog'" class="field">
        <label>对白（正式内容）</label>
        <div class="hint">这里是对白正文，会按顺序播放；与下方「备注」不同。</div>
        <div
          v-for="line in (ensureDialogLines(selectedNode), selectedNode.dialogLines!)"
          :key="line.id"
          class="dialog-edit"
        >
          <textarea v-model="line.text" placeholder="这一句对白…" />
          <div class="row">
            <button class="btn" @click="moveDialogLine(selectedNode, line.id, -1)">上移</button>
            <button class="btn" @click="moveDialogLine(selectedNode, line.id, 1)">下移</button>
            <button class="btn" @click="deleteDialogLine(selectedNode, line.id)">删除段</button>
          </div>
        </div>
        <button class="btn" @click="addDialogLine(selectedNode)">+ 增加一段</button>
      </div>

      <div v-else class="field">
        <label>备注</label>
        <div v-if="selectedNode.kind === 'choice'" class="hint">
          可选，给自己看的说明；玩家看到的分支文案请在下方「选项」里编辑。
        </div>
        <div v-else class="hint">可选，画布上展示摘要、方便区分节点；具体逻辑以上方各配置为准。</div>
        <textarea v-model="selectedNode.text" placeholder="例如：这步要干啥、注意点…" />
      </div>

      <details v-if="selectedNode.kind === 'battle'" class="inspector-group" open>
        <summary>Battle Processing（战斗）</summary>
        <div class="group-body">
          <div class="field rm-battle-branches">
            <label>When Win / When Lose（对标 RM 内嵌分支）</label>
            <div v-for="(opt, wi) in battleRmWinLoseOptions" :key="opt.id" class="rm-branch-row">
              <span class="rm-branch-label">{{ wi === 0 ? "◆ When Win" : "◆ When Lose" }}</span>
              <span class="muted">→ {{ optionTargetsLabel(opt) || "（画布连线）" }}</span>
            </div>
            <button class="btn btn-sm" type="button" @click="normalizeWinLose(selectedNode)">标准化胜/负出口</button>
          </div>
          <div v-if="selectedNode.kind === 'battle'" class="field">
            <label>战斗配置</label>
            <select v-model="selectedNode.battleConfigId">
              <option value="">（默认 {{ manifestBattleRefs[0]?.id }}）</option>
              <option v-for="x in manifestBattleRefs" :key="x.id" :value="x.id">{{ x.label }}</option>
            </select>
            <div class="hint">导出后直接触发 BattleScene.startStoryBattle。</div>
          </div>

          <div v-if="selectedNode.kind === 'battle'" class="field advanced-collapsed">
            <label>敌人列表（策划备忘，导出以 battleRef 为准）</label>
            <div class="hint">
              每一行是一个「候选池」，最终从所有行中等概率随机一行，再在该行内部按范围/列表随机具体 ID。
            </div>
            <div
              v-for="(eid, idx) in (ensureEnemyIds(selectedNode), selectedNode.enemyIds!)"
              :key="idx"
              class="opt-edit"
            >
              <div class="opt-row">
                <input
                  class="opt-input"
                  :value="eid"
                  placeholder="示例：1-5,7,10-12 或 slime_01,slime_02"
                  @blur="normalizeEnemyIdAt(selectedNode, idx)"
                  @change="normalizeEnemyIdAt(selectedNode, idx)"
                  @input="selectedNode.enemyIds![idx] = ($event.target as HTMLInputElement).value"
                />
                <button
                  type="button"
                  class="btn btn-del-opt"
                  :disabled="selectedNode.enemyIds!.length <= 1"
                  title="至少保留一个敌人池"
                  @click="deleteEnemyRow(selectedNode, idx)"
                >
                  删除
                </button>
              </div>
            </div>
            <button class="btn" type="button" @click="addEnemyRow(selectedNode)">+ 增加一个敌人</button>
            <div style="height: 6px"></div>
            <button class="btn" @click="normalizeWinLose(selectedNode)">一键变成「胜利/失败」</button>
          </div>

          <div v-if="selectedNode.kind === 'battle'" class="field">
            <label>掉落表资源（可选）</label>
            <select v-model="selectedNode.dropTableId">
              <option value="">（不绑定掉落表）</option>
              <option v-for="x in dropTables" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
          </div>

          <div v-if="selectedNode.kind === 'battle'" class="field">
            <label>战斗提示 markerHint（导出 client.markerHint）</label>
            <input v-model="selectedNode.markerHint" placeholder="如：与博士对战" />
          </div>
        </div>
      </details>

      <div v-if="selectedNode.kind === 'gainItem' || selectedNode.kind === 'loseItem'" class="field">
        <label>itemId</label>
        <div class="row row-left">
          <select v-model="selectedNode.itemId" style="flex: 1">
            <option value="">（未选择）</option>
            <option v-for="x in items" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
          </select>
          <input
            v-model="selectedNode.itemId"
            style="width: 170px"
            placeholder="或手填 itemId"
            title="兼容：也允许直接手填，资源库可后续补齐条目"
          />
        </div>
        <div style="height: 6px"></div>
        <label>数量</label>
        <input
          :value="selectedNode.itemCount ?? 1"
          type="number"
          min="1"
          @input="selectedNode.itemCount = Number(($event.target as HTMLInputElement).value || 1)"
        />
      </div>

      <div v-if="selectedNode.kind === 'setVar'" class="field">
        <label>变量</label>
        <select v-model="selectedNode.varId">
          <option v-for="v in variables" :key="v.id" :value="v.id">{{ v.name }} ({{ v.type }})</option>
        </select>
        <div style="height: 6px"></div>
        <label>值</label>
        <input
          v-if="varById.get(selectedNode.varId || '')?.type !== 'bool'"
          :value="String(selectedNode.varValue ?? '')"
          @input="selectedNode.varValue = ($event.target as HTMLInputElement).value as any"
        />
        <label v-else class="inline">
          <input
            type="checkbox"
            :checked="Boolean(selectedNode.varValue)"
            @change="selectedNode.varValue = ($event.target as HTMLInputElement).checked"
          />
          true/false
        </label>
      </div>

      <details v-if="selectedNode.kind === 'questUpdate'" class="inspector-group" open>
        <summary>任务</summary>
        <div class="group-body">
          <div v-if="selectedNode.kind === 'questUpdate'" class="field">
            <template v-if="contextMapQuest">
              <label>章节任务</label>
              <input :value="`${contextMapQuest.name} (${contextMapQuest.taskId ?? '—'})`" readonly />
              <div class="hint">已自动关联当前地图所属章节，无需再选手动任务。</div>
            </template>
            <template v-else>
              <label>任务</label>
              <select v-model="selectedNode.questId">
                <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
              </select>
            </template>
            <div style="height: 6px"></div>
            <label>状态</label>
            <select v-model="selectedNode.questStatus">
              <option value="NotStarted">未开始</option>
              <option value="InProgress">进行中</option>
              <option value="Completed">已完成</option>
              <option value="Failed">失败</option>
            </select>
          </div>
        </div>
      </details>

      <div v-if="selectedNode.kind === 'taskEnd'" class="field">
        <label>断开状态（用于主线判断）</label>
        <select v-model="selectedNode.questStatus">
          <option value="Completed">已完成</option>
          <option value="Failed">失败</option>
          <option value="InProgress">进行中</option>
          <option value="NotStarted">未开始</option>
        </select>
      </div>

      <div v-if="selectedNode.kind === 'npcExit'" class="field">
        <label>结尾行为</label>
        <label class="inline check-row">
          <input type="checkbox" :checked="selectedNode.hideNpcOnEnd !== false" @change="onNpcExitHideChange" />
          <span>剧情链走完后隐藏该 NPC（人物消失）</span>
        </label>
        <div class="hint">取消勾选则事件全部完成后 NPC 仍留在地图上。</div>
      </div>

      <div v-if="selectedNode.kind === 'callQuest'" class="field">
        <label>开始目标（可多选：任务/支线）</label>
        <div class="target-list">
          <label v-for="t in callQuestTargets" :key="t.value" class="target-item">
            <input
              type="checkbox"
              :checked="isCallQuestTargetChecked(selectedNode, t.value)"
              @change="toggleCallQuestTarget(selectedNode, t.value, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ t.label }}</span>
          </label>
        </div>
        <div class="hint">画布上从同一出口可拖多条线连到不同节点（并行）；无需再添加多个出口。</div>
        <div style="height: 6px"></div>
        <button class="btn" type="button" @click="ensureCallQuestPrimaryOption(selectedNode)">
          首条文案：开始并进入任务
        </button>
      </div>

      <div v-if="selectedNode.kind === 'condition' || selectedNode.kind === 'questCheck'" class="field">
        <label>条件模式</label>
        <select v-model="selectedNode.conditionMode">
          <option value="ALL">ALL（全部满足）</option>
          <option value="ANY">ANY（任意满足）</option>
        </select>

        <div style="height: 6px"></div>
        <label>条件列表</label>
        <div v-for="(r, idx) in selectedNode.requirements || []" :key="idx" class="req-card">
          <div class="req-title">{{ requirementLabel(r) }}</div>
          <div v-if="r.kind === 'questStatus'" class="row">
            <select v-model="r.questId" style="flex: 1">
              <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
            </select>
            <select v-model="r.status" style="width: 130px">
              <option value="NotStarted">未开始</option>
              <option value="InProgress">进行中</option>
              <option value="Completed">已完成</option>
              <option value="Failed">失败</option>
            </select>
          </div>
          <div v-else class="row">
            <select v-model="r.varId" style="flex: 1">
              <option v-for="v in variables" :key="v.id" :value="v.id">{{ v.name }} ({{ v.type }})</option>
            </select>
            <input
              :value="String(r.value)"
              @input="r.value = ($event.target as HTMLInputElement).value as any"
              style="width: 120px"
            />
          </div>
          <div style="margin-top: 6px; text-align: right">
            <button class="btn" @click="deleteRequirement(selectedNode, idx)">删除条件</button>
          </div>
        </div>

        <div class="row">
          <button class="btn" @click="addQuestRequirement(selectedNode)">+ 任务条件</button>
          <button v-if="selectedNode.kind === 'condition'" class="btn" @click="addVarRequirement(selectedNode)">
            + 变量条件
          </button>
        </div>
      </div>

      <div v-if="selectedNode.kind === 'check'" class="field">
        <label>检查模式</label>
        <select v-model="selectedNode.checkMode">
          <option value="ALL">ALL（全部满足）</option>
          <option value="ANY">ANY（任意满足）</option>
        </select>

        <div style="height: 6px"></div>
        <label>检查列表</label>
        <div v-for="(c, idx) in (ensureChecks(selectedNode), selectedNode.checks || [])" :key="idx" class="req-card">
          <div class="req-title">{{ c.kind }}</div>

          <div v-if="c.kind === 'questStatus'" class="row">
            <select v-model="c.questId" style="flex: 1">
              <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
            </select>
            <select v-model="c.status" style="width: 130px">
              <option value="NotStarted">未开始</option>
              <option value="InProgress">进行中</option>
              <option value="Completed">已完成</option>
              <option value="Failed">失败</option>
            </select>
          </div>

          <div v-else-if="c.kind === 'varEquals'" class="row">
            <select v-model="c.varId" style="flex: 1">
              <option v-for="v in variables" :key="v.id" :value="v.id">{{ v.name }} ({{ v.type }})</option>
            </select>
            <input
              :value="String(c.value)"
              @input="c.value = ($event.target as HTMLInputElement).value as any"
              style="width: 140px"
            />
          </div>

          <div v-else-if="c.kind === 'serverVarEquals'" class="row">
            <input v-model="c.key" placeholder="server var key" style="flex: 1" />
            <input
              :value="String(c.value)"
              @input="c.value = ($event.target as HTMLInputElement).value as any"
              style="width: 140px"
            />
          </div>

          <div v-else-if="c.kind === 'hasPet'" class="row">
            <select v-model="c.petId" style="flex: 1">
              <option value="">（未选择）</option>
              <option v-for="p in pets" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
            </select>
          </div>

          <div v-else-if="c.kind === 'bagSpaceAtLeast'" class="row">
            <input
              type="number"
              min="0"
              :value="c.slots"
              @input="c.slots = Number(($event.target as HTMLInputElement).value || 0)"
              style="width: 160px"
            />
            <span class="muted">格</span>
          </div>

          <div v-else class="row">
            <input v-model="(c as any).key" placeholder="activity switch key" style="flex: 1" />
          </div>

          <div style="margin-top: 6px; text-align: right">
            <button class="btn" type="button" @click="deleteCheck(selectedNode, idx)">删除检查</button>
          </div>
        </div>

        <div class="row row-left">
          <button class="btn" type="button" @click="addCheck(selectedNode, 'serverVarEquals')">+ 服务器变量</button>
          <button class="btn" type="button" @click="addCheck(selectedNode, 'hasPet')">+ 宠物条件</button>
          <button class="btn" type="button" @click="addCheck(selectedNode, 'bagSpaceAtLeast')">+ 背包空间</button>
          <button class="btn" type="button" @click="addCheck(selectedNode, 'activitySwitchOn')">+ 活动开关</button>
        </div>
      </div>

      <div v-if="selectedNode.kind === 'action'" class="field">
        <label>动作列表（按顺序执行）</label>
        <div v-for="(a, idx) in (ensureActions(selectedNode), selectedNode.actions || [])" :key="idx" class="req-card">
          <div class="row row-left" style="justify-content: space-between">
            <div class="req-title">{{ a.kind }}</div>
            <button class="btn" type="button" @click="deleteActionStep(selectedNode, idx)">删除动作</button>
          </div>

          <div v-if="a.kind === 'giveItem' || a.kind === 'takeItem'" class="row">
            <select v-model="a.itemId" style="flex: 1">
              <option value="">（未选择）</option>
              <option v-for="x in items" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
            <input
              type="number"
              min="1"
              :value="a.count"
              @input="a.count = Math.max(1, Number(($event.target as HTMLInputElement).value || 1))"
              style="width: 120px"
            />
          </div>
          <div v-else-if="a.kind === 'addCurrency'" class="row">
            <input v-model="a.currency" placeholder="currency id" style="flex: 1" />
            <input
              type="number"
              :value="a.amount"
              @input="a.amount = Number(($event.target as HTMLInputElement).value || 0)"
              style="width: 120px"
            />
          </div>
          <div v-else-if="a.kind === 'setQuestStatus'" class="row">
            <select v-model="a.questId" style="flex: 1">
              <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
            </select>
            <select v-model="a.status" style="width: 130px">
              <option value="NotStarted">未开始</option>
              <option value="InProgress">进行中</option>
              <option value="Completed">已完成</option>
              <option value="Failed">失败</option>
            </select>
          </div>
          <div v-else-if="a.kind === 'givePet'" class="row">
            <select v-model="a.petId" style="flex: 1">
              <option value="">（未选择）</option>
              <option v-for="p in pets" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
            </select>
          </div>
          <div v-else-if="a.kind === 'teleport'" class="field">
            <label>传送目标</label>
            <div class="row">
              <input
                type="number"
                :value="a.toMapId"
                placeholder="toMapId"
                style="flex: 1"
                @input="a.toMapId = Number(($event.target as HTMLInputElement).value)"
              />
              <input
                type="number"
                :value="a.toX"
                placeholder="toX"
                style="width: 90px"
                @input="a.toX = Number(($event.target as HTMLInputElement).value)"
              />
              <input
                type="number"
                :value="a.toY"
                placeholder="toY"
                style="width: 90px"
                @input="a.toY = Number(($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="row" style="margin-top: 6px">
              <select v-model="a.areaId" style="flex: 1">
                <option value="">（或选 area 资源）</option>
                <option v-for="x in areas" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
              </select>
            </div>
          </div>
          <div v-else-if="a.kind === 'revealNpc'" class="row">
            <select v-model="a.npcUid" style="flex: 1">
              <option value="">（选择 NPC）</option>
              <option v-for="n in gameMapNpcs" :key="n.npcUid" :value="n.npcUid">
                {{ n.npcName }} ({{ n.npcUid }})
              </option>
            </select>
          </div>
          <div v-else-if="a.kind === 'spawnNpc'" class="field">
            <div class="row">
              <input v-model="a.npcUid" placeholder="npcUid" style="flex: 1" />
              <input v-model="a.npcName" placeholder="名称" style="flex: 1" />
            </div>
            <div class="row" style="margin-top: 6px">
              <input v-model="a.prefabKey" placeholder="prefabKey" style="flex: 1" />
              <input
                type="number"
                :value="a.x"
                placeholder="x"
                style="width: 90px"
                @input="a.x = Number(($event.target as HTMLInputElement).value)"
              />
              <input
                type="number"
                :value="a.y"
                placeholder="y"
                style="width: 90px"
                @input="a.y = Number(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div v-else-if="a.kind === 'triggerBattle'" class="row">
            <select v-model="a.battleConfigId" style="flex: 1">
              <option value="">（未选择）</option>
              <option v-for="x in battleConfigs" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
          </div>
          <div v-else-if="a.kind === 'sendMail'" class="field">
            <label>标题</label>
            <input v-model="a.subject" />
            <div style="height: 6px"></div>
            <label>正文</label>
            <textarea v-model="a.body" />
          </div>
          <div v-else class="field">
            <label>内容</label>
            <textarea v-model="(a as any).text" placeholder="弹窗内容…" />
          </div>
        </div>

        <div class="row row-left" style="flex-wrap: wrap">
          <button class="btn" type="button" @click="addActionStep(selectedNode)">+ 弹窗</button>
          <button class="btn" type="button" @click="addActionStepKind(selectedNode, 'revealNpc')">+ 显现 NPC</button>
          <button class="btn" type="button" @click="addActionStepKind(selectedNode, 'spawnNpc')">+ 生成 NPC</button>
          <button class="btn" type="button" @click="addActionStepKind(selectedNode, 'teleport')">+ 传送</button>
          <button class="btn" type="button" @click="addActionStepKind(selectedNode, 'setQuestStatus')">
            + 任务状态
          </button>
        </div>
      </div>

      <div v-if="showResourceRefs" class="field">
        <label>区域 / 宠物 / 技能（可选引用）</label>
        <div class="row row-left">
          <label class="field mini" style="flex: 1">
            <span>区域</span>
            <select v-model="selectedNode.areaId">
              <option value="">（无）</option>
              <option v-for="x in areas" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
          </label>
          <label class="field mini" style="flex: 1">
            <span>宠物</span>
            <select v-model="selectedNode.petId">
              <option value="">（无）</option>
              <option v-for="x in pets" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
          </label>
          <label class="field mini" style="flex: 1">
            <span>技能</span>
            <select v-model="selectedNode.skillId">
              <option value="">（无）</option>
              <option v-for="x in skills" :key="x.id" :value="x.id">{{ x.name }} ({{ x.id }})</option>
            </select>
          </label>
        </div>
      </div>

      <div v-if="showOptionsInspector" class="field">
        <label>{{ selectedNode.kind === "choice" ? "选项（玩家分支）" : "分支出口" }}</label>
        <div v-if="selectedNode.kind === 'choice'" class="hint">
          每条选项对应一个右侧锚点；同一锚点可拖多条线到多个下游（并行）。互斥分支（如 是/否）请用多个选项。
        </div>
        <div v-else class="hint">编辑「满足 / 不满足」等出口文案；连线在画布上拖拽。</div>
        <div v-if="selectedNode.kind === 'choice'" class="hint">
          <strong>断开</strong
          >：勾选＝本分支到此为止，并<strong>清空本选项全部连线</strong>；取消勾选后可重新拖线。若只删其中一条连线，请在画布上选中该连线后按
          Delete。
        </div>
        <div v-if="selectedNode.kind === 'choice'" style="margin-bottom: 6px">
          <button class="btn" @click="normalizeYesNo(selectedNode)">一键变成「是/否」</button>
        </div>
        <div v-if="choiceMapTaskHint" class="hint" style="margin-bottom: 8px">
          接取/完成任务请插入「任务进度」节点并连线，勿在选项里重复配置。
        </div>
        <div v-for="(opt, idx) in selectedNode.options" :key="opt.id" class="opt-edit">
          <div class="opt-row">
            <input
              v-model="opt.text"
              class="opt-input"
              placeholder="分支文案（玩家可见，也作连线标签）"
              @blur="selectedNode.kind === 'choice' ? onChoiceTitleBlur(selectedNode) : undefined"
            />
            <button
              type="button"
              class="btn btn-del-opt"
              :disabled="selectedNode.options.length <= 1"
              title="至少保留一个选项"
              @click="deleteOption(selectedNode, idx)"
            >
              删除
            </button>
          </div>
          <div class="opt-meta">
            <span class="muted">连线：{{ optionTargetsLabel(opt) }}</span>
            <label class="inline" style="margin-left: auto">
              <span class="muted" title="勾选后清空连线，本分支不再连后续节点">断开</span>
              <input type="checkbox" v-model="opt.isEnd" @change="onOptionEndChange(opt)" />
            </label>
          </div>
          <div v-if="showOptionRuntimeFields" class="opt-runtime">
            <div class="opt-runtime-section">
              <div class="opt-runtime-title">分支反馈</div>
              <input v-model="opt.npcReply" class="opt-input opt-sub" placeholder="NPC 反馈（选后 NPC 再说一句）" />
              <input v-model="opt.systemTip" class="opt-input opt-sub" placeholder="系统提示（Toast）" />
            </div>
            <div class="opt-runtime-section">
              <div class="opt-runtime-title">运行时</div>
              <div class="row row-left opt-flags">
                <label class="inline">
                  <span class="muted">结束本事件</span>
                  <select
                    :value="opt.completesEvent === false ? 'false' : 'true'"
                    @change="onCompletesEventChange(opt, $event)"
                  >
                    <option value="true">是（默认）</option>
                    <option value="false">否（仅选分支）</option>
                  </select>
                </label>
                <label class="inline">
                  <span class="muted">特殊结果</span>
                  <select
                    :value="opt.forcedResult ?? ''"
                    @change="onForcedResultChange(opt, $event)"
                  >
                    <option value="">无</option>
                    <option value="block">阻断</option>
                    <option v-if="!choiceBlocksStartBattle" value="start_battle">进入战斗</option>
                    <option value="teleport">传送</option>
                  </select>
                </label>
              </div>
              <div v-if="opt.forcedResult === 'teleport'" class="row row-left opt-flags" style="margin-top: 4px">
                <input
                  type="number"
                  :value="opt.teleportToMapId"
                  placeholder="目标地图 ID"
                  style="width: 100px"
                  @input="opt.teleportToMapId = Number(($event.target as HTMLInputElement).value)"
                />
                <input
                  type="number"
                  :value="opt.teleportX"
                  placeholder="X"
                  style="width: 72px"
                  @input="opt.teleportX = Number(($event.target as HTMLInputElement).value)"
                />
                <input
                  type="number"
                  :value="opt.teleportY"
                  placeholder="Y"
                  style="width: 72px"
                  @input="opt.teleportY = Number(($event.target as HTMLInputElement).value)"
                />
              </div>
              <div v-if="opt.forcedResult" class="hint">当前：{{ forcedResultLabel(opt.forcedResult) }}</div>
            </div>
            <div v-if="choiceMapTaskHint && hasLegacyOptionTaskEffect(opt)" class="legacy-task-warn">
              <span>旧版任务配置：{{ legacyOptionTaskEffectLabel(opt) }}</span>
              <button class="btn btn-mini" type="button" @click="clearLegacyOptionTaskEffects(opt)">清除</button>
            </div>
            <div v-if="showLegacyOptionTaskEffects" class="opt-runtime-section">
              <div class="opt-runtime-title">任务操作</div>
              <select
                :value="optionTaskActionValue(opt)"
                @change="setOptionTaskAction(opt, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">无</option>
                <optgroup label="接取">
                  <option v-for="q in questsWithTaskId" :key="`a-${q.id}`" :value="`accept:${q.taskId}`">
                    接取 · {{ q.name }} ({{ q.taskId }})
                  </option>
                </optgroup>
                <optgroup label="完成">
                  <option v-for="q in questsWithTaskId" :key="`c-${q.id}`" :value="`complete:${q.taskId}`">
                    完成 · {{ q.name }} ({{ q.taskId }})
                  </option>
                </optgroup>
              </select>
              <div class="hint">非地图剧情可用；地图内请用「任务进度」节点。</div>
            </div>
          </div>
        </div>
        <button class="btn" @click="addOption(selectedNode)">+ 增加一个选项</button>
      </div>

      <div v-else-if="selectedNode && selectedNode.options.length > 0 && !showOptionsInspector" class="field hint-only">
        <div class="hint">
          <template v-if="selectedNode.kind === 'dialog'">
            对话节点单线推进：在画布上拖拽右侧圆点连线即可，无需配置下方选项。
          </template>
          <template v-else>
            连线请在画布上拖拽节点右侧圆点；任务请用「任务进度」节点，物品请用「获得/失去」节点。
          </template>
        </div>
      </div>
    </div>
    <div v-else-if="selectedMap" class="map-form">
      <div class="field">
        <label>当前地图</label>
        <input :value="selectedMap.name || selectedMap.id" readonly />
      </div>
      <div class="row row-left">
        <button class="btn" @click="emit('fitMap', selectedMap.id)">自动紧裹节点</button>
        <button class="btn" @click="emit('deleteMap', selectedMap.id)">删除地图</button>
      </div>
      <label class="inline check-row">
        <input
          type="checkbox"
          :checked="!!selectedMap.skipAutoLayout"
          @change="
            emit('patchMap', {
              id: selectedMap.id,
              patch: { skipAutoLayout: ($event.target as HTMLInputElement).checked },
            })
          "
        />
        全局整理时跳过此区域
      </label>
      <div class="field">
        <label>地图 ID</label>
        <input v-model="mapIdDraft" @change="commitMapIdRename" @blur="commitMapIdRename" />
      </div>
      <div class="field">
        <label>显示名</label>
        <input v-model="mapNameDraft" @change="commitMapNamePatch" @blur="commitMapNamePatch" />
      </div>
      <div class="row row-left">
        <label class="inline mini-field">
          <span>X</span>
          <input
            type="number"
            :value="selectedMap.x"
            @change="
              emit('patchMap', {
                id: selectedMap.id,
                patch: { x: Number(($event.target as HTMLInputElement).value) },
              })
            "
          />
        </label>
        <label class="inline mini-field">
          <span>Y</span>
          <input
            type="number"
            :value="selectedMap.y"
            @change="
              emit('patchMap', {
                id: selectedMap.id,
                patch: { y: Number(($event.target as HTMLInputElement).value) },
              })
            "
          />
        </label>
        <label class="inline mini-field">
          <span>宽</span>
          <input
            type="number"
            :value="selectedMap.width"
            @change="
              emit('patchMap', {
                id: selectedMap.id,
                patch: { width: Math.max(80, Number(($event.target as HTMLInputElement).value)) },
              })
            "
          />
        </label>
        <label class="inline mini-field">
          <span>高</span>
          <input
            type="number"
            :value="selectedMap.height"
            @change="
              emit('patchMap', {
                id: selectedMap.id,
                patch: { height: Math.max(60, Number(($event.target as HTMLInputElement).value)) },
              })
            "
          />
        </label>
      </div>
      <div class="field">
        <label>地图内节点（{{ selectedMapNodes.length }}）</label>
        <div v-if="selectedMapNodes.length === 0" class="hint">暂无节点</div>
        <div v-for="n in selectedMapNodes" :key="n.id" class="node-chip">
          {{ n.title || n.id }}
        </div>
      </div>
    </div>
    <div v-else class="empty">请选择一个节点或地图</div>
  </section>
</template>

<style scoped>
.panel {
  padding: 10px;
  background: var(--bg-app);
  overflow: auto;
  overscroll-behavior: contain;
}
.panel-right {
  border-left: 1px solid var(--border-strong);
}
.section-title {
  font-size: 12px;
  color: var(--fg-secondary);
  margin-bottom: 10px;
}
.node-summary {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-surface-2);
  font-size: 11px;
}
.summary-line {
  margin: 2px 0;
  color: var(--fg-secondary);
}
.summary-k {
  display: inline-block;
  min-width: 52px;
  color: var(--fg-tertiary);
  margin-right: 6px;
}
.node-guide {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.45;
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: var(--radius-sm);
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
}
.block-title {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 6px;
}
.node-guide.warn {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border-color: rgba(251, 191, 36, 0.25);
}
.field {
  margin-bottom: 10px;
}
label {
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--fg-secondary);
}
input,
textarea,
select {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.35);
  color: var(--fg-main);
  font-size: 13px;
}
textarea {
  min-height: 70px;
  resize: vertical;
}
.btn {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.2);
  color: var(--fg-main);
  font-size: 12px;
  cursor: pointer;
}
.btn:hover {
  border-color: var(--accent);
}
.row {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  align-items: center;
}
.row-left {
  justify-content: flex-start;
}
.hint {
  font-size: 11px;
  color: var(--fg-tertiary);
  margin-bottom: 6px;
}
.dialog-edit {
  margin-bottom: 8px;
}
.req-card {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(148, 163, 184, 0.06);
  padding: 8px;
  border-radius: 10px;
  margin-bottom: 8px;
}
.req-title {
  font-size: 12px;
  color: #c7d2fe;
  margin-bottom: 6px;
}
.opt-edit {
  margin-bottom: 8px;
}
.node-actions {
  margin-bottom: 10px;
  align-items: center;
  gap: 8px;
}
.btn-danger {
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
}
.btn-danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.opt-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.opt-input {
  flex: 1;
  min-width: 0;
}
.opt-runtime {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt-runtime-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.12);
}
.opt-runtime-title {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.02em;
}
.legacy-task-warn {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #fcd34d;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.25);
  border: 1px solid rgba(251, 191, 36, 0.25);
}
.btn-mini {
  padding: 2px 8px;
  font-size: 11px;
}
.opt-sub {
  font-size: 12px;
}
.opt-flags {
  gap: 10px;
  flex-wrap: wrap;
}
.btn-del-opt {
  flex-shrink: 0;
  padding: 6px 8px;
}
.btn-del-opt:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.opt-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
.muted {
  color: var(--fg-tertiary);
  font-size: 12px;
}
.inline {
  display: flex;
  gap: 6px;
  align-items: center;
}
.mini-field {
  gap: 4px;
}
.mini-field input {
  width: 90px;
}
.empty {
  color: var(--fg-tertiary);
  font-size: 13px;
}
.target-list {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(148, 163, 184, 0.06);
  border-radius: 8px;
  padding: 6px 8px;
  display: grid;
  gap: 6px;
}
.target-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}
.target-item input {
  width: 14px;
  height: 14px;
}
.map-form {
  display: grid;
  gap: 10px;
}
.node-chip {
  font-size: 11px;
  color: var(--fg-main);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  padding: 4px 8px;
  width: fit-content;
  margin-top: 6px;
}
.rm-battle-branches {
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface-2);
  border: 1px solid var(--border-default);
}
.rm-branch-row {
  font-size: 11px;
  margin: 4px 0 4px 12px;
  font-family: ui-monospace, monospace;
}
.rm-branch-label {
  color: #a5b4fc;
  margin-right: 6px;
}
.battle-bind-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--fg-secondary);
}
</style>
