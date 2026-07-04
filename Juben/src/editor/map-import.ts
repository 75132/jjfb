/**
 * 将运行时 map JSON 反向同步到编辑器 project（剧情脚本 / tasks / shell；摆点坐标仍以 workspace 为准）
 */
import type { ActionStep, GameMapDef, GameMapNpcDef, GraphData, ProjectData, StoryNode } from "../types";
import { getOptionTargets, setOptionTargets } from "../types";
import { collectNpcEventChain } from "./map-export";
import { findGameMapById } from "./game-map-logic";
import { ensureNpcAppear } from "./npc-appear";
import { runtimeRequirementToEditor, type RuntimeRequirement } from "./requirement-bridge";
import { resolveQuestNumericTaskId } from "./quest-logic";
import type { RuntimeMapConfig, RuntimeMapEvent, RuntimeServerEffect } from "./map-runtime";
import { runtimeChoiceToEditorOption } from "./map-runtime";

export type MapImportResult = {
  ok: boolean;
  message: string;
  updatedNpcs: number;
  updatedNodes: number;
};

const FOLD_ONLY_KINDS = new Set(["condition", "check", "questCheck"]);

function isRuntimeMapConfig(raw: unknown): raw is RuntimeMapConfig {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as RuntimeMapConfig;
  return typeof o.mapCode === "string" || Array.isArray(o.npcs);
}

export function parseRuntimeMapJson(raw: string): RuntimeMapConfig | null {
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!isRuntimeMapConfig(obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

function syncableChain(chain: StoryNode[]): StoryNode[] {
  return chain.filter((n) => !FOLD_ONLY_KINDS.has(n.kind));
}

function syncDialogNode(
  node: StoryNode,
  scriptId: string | undefined,
  dlgScripts: Record<string, { speaker?: string; lines?: string[] }>,
): boolean {
  if (!scriptId || node.kind !== "dialog") return false;
  const scr = dlgScripts[scriptId];
  if (!scr) return false;
  node.speaker = scr.speaker ?? node.speaker;
  node.dialogLines = (scr.lines ?? []).map((text, i) => ({
    id: node.dialogLines?.[i]?.id ?? `line_${crypto.randomUUID()}`,
    text,
  }));
  if (node.dialogLines.length === 0 && scr.lines?.[0]) {
    node.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: scr.lines[0] }];
  }
  return true;
}

function syncChoiceNode(
  node: StoryNode,
  scriptId: string | undefined,
  chScripts: Record<string, { title?: string; options?: Array<{ id: string; text: string }> }>,
): boolean {
  if (!scriptId || (node.kind !== "choice" && node.kind !== "battle" && node.kind !== "action")) return false;
  const scr = chScripts[scriptId];
  if (!scr?.options?.length) return false;
  const oldTargets = node.options.map((o) => ({ id: o.id, targets: getOptionTargets(o) }));
  node.options = scr.options.map((opt, i) => {
    const prev = oldTargets[i];
    const ed = runtimeChoiceToEditorOption(opt as Parameters<typeof runtimeChoiceToEditorOption>[0]);
    if (prev?.targets.length) setOptionTargets(ed, prev.targets);
    return ed;
  });
  return true;
}

function syncBattleNode(node: StoryNode, ev: RuntimeMapEvent): boolean {
  if (node.kind !== "battle") return false;
  const ref = ev.server?.battleRef;
  if (ref) node.battleConfigId = ref;
  if (ev.client?.markerHint) node.markerHint = ev.client.markerHint;
  return !!ref;
}

function syncTaskEffects(node: StoryNode, ev: RuntimeMapEvent, project: ProjectData): boolean {
  let touched = false;
  const effects = (ev.server?.effects ?? []) as RuntimeServerEffect[];
  for (const eff of effects) {
    const action = String(eff.action ?? "");
    if (action === "give_item" && node.kind === "gainItem") {
      node.itemId = String((eff as { itemId?: string }).itemId ?? "");
      node.itemCount = Number((eff as { count?: number }).count ?? 1);
      touched = true;
    }
    if (action === "take_item" && node.kind === "loseItem") {
      node.itemId = String((eff as { itemId?: string }).itemId ?? "");
      node.itemCount = Number((eff as { count?: number }).count ?? 1);
      touched = true;
    }
    if (action === "set_story_var" && node.kind === "setVar") {
      node.varId = String((eff as { varId?: string }).varId ?? "");
      node.varValue = (eff as { value?: boolean | number | string }).value;
      touched = true;
    }
    if ((action === "task_accept" || action === "task_complete") && node.kind === "questUpdate") {
      const taskId = Number((eff as { taskId?: number }).taskId);
      const questId = project.quests.find(
        (q) => q.taskId === taskId || resolveQuestNumericTaskId(project, q.id) === taskId,
      )?.id;
      if (questId) {
        node.questId = questId;
        node.questStatus = action === "task_accept" ? "InProgress" : "Completed";
        touched = true;
      }
    }
    if (node.kind === "action") {
      const steps = node.actions ?? [];
      if (action === "give_item") {
        steps.push({
          kind: "giveItem",
          itemId: String((eff as { itemId?: string }).itemId ?? ""),
          count: Number((eff as { count?: number }).count ?? 1),
        });
        touched = true;
      }
      if (action === "take_item") {
        steps.push({
          kind: "takeItem",
          itemId: String((eff as { itemId?: string }).itemId ?? ""),
          count: Number((eff as { count?: number }).count ?? 1),
        });
        touched = true;
      }
      if (action === "reveal_npc") {
        steps.push({ kind: "revealNpc", npcUid: String((eff as { npcUid?: string }).npcUid ?? "") });
        touched = true;
      }
      if (action === "spawn_npc") {
        steps.push({
          kind: "spawnNpc",
          npcUid: String((eff as { npcUid?: string }).npcUid ?? ""),
          npcName: (eff as { npcName?: string }).npcName,
          prefabKey: (eff as { prefabKey?: string }).prefabKey,
          x: (eff as { x?: number }).x,
          y: (eff as { y?: number }).y,
        });
        touched = true;
      }
      if (action === "teleport") {
        steps.push({
          kind: "teleport",
          toMapId: (eff as { toMapId?: number }).toMapId,
          toX: (eff as { toX?: number }).toX,
          toY: (eff as { toY?: number }).toY,
        });
        touched = true;
      }
      node.actions = steps;
    }
  }
  if (ev.client?.taskUiHint && (node.kind === "gainItem" || node.kind === "loseItem" || node.kind === "setVar")) {
    node.title = ev.client.taskUiHint;
    touched = true;
  }
  return touched;
}

function syncRuntimeRequirements(node: StoryNode, ev: RuntimeMapEvent, project: ProjectData): boolean {
  const reqs = ev.server?.requirements ?? [];
  if (!reqs.length) return false;
  node.runtimeRequirements = reqs.map((r) => ({ ...(r as object) }));
  if (node.kind === "condition" || node.kind === "questCheck") {
    const editorReqs = reqs.map((r) => runtimeRequirementToEditor(project, r as RuntimeRequirement)).filter(Boolean);
    if (editorReqs.length) {
      node.requirements = editorReqs as typeof node.requirements;
      return true;
    }
  }
  return reqs.length > 0;
}

function syncChainContinuousFromPrevEvent(node: StoryNode, prevEv: RuntimeMapEvent | undefined): void {
  if (!prevEv) return;
  node.chainContinuous = prevEv.client?.endsSession !== true;
}

function syncNpcAppearFromRuntime(
  def: GameMapNpcDef,
  row: NonNullable<RuntimeMapConfig["npcs"]>[number],
  project: ProjectData,
): boolean {
  let touched = false;
  if (row.appear) {
    ensureNpcAppear(def);
    def.appear = {
      mode: row.appear.mode ?? "conditional",
      matchMode: row.appear.matchMode ?? "ALL",
      requirements: [],
    };
    for (const r of row.appear.requirements ?? []) {
      const ed = runtimeRequirementToEditor(project, r as RuntimeRequirement);
      if (ed) def.appear!.requirements!.push(ed);
    }
    touched = true;
  }
  if (row.initialHidden === true) {
    ensureNpcAppear(def);
    def.appear = { ...(def.appear ?? { mode: "conditional", requirements: [] }), mode: "conditional" };
    touched = true;
  }
  return touched;
}

function syncNpcChainFromRuntime(
  graph: GraphData,
  entryNodeId: string,
  events: RuntimeMapEvent[],
  dlgScripts: Record<string, { speaker?: string; lines?: string[] }>,
  chScripts: Record<string, { title?: string; options?: Array<{ id: string; text: string }> }>,
  project: ProjectData,
): number {
  const chain = syncableChain(collectNpcEventChain(graph, entryNodeId));
  const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let updated = 0;
  for (let i = 0; i < Math.min(chain.length, sorted.length); i++) {
    const node = chain[i]!;
    const ev = sorted[i]!;
    let touched = false;
    if (ev.eventType === "dialog") {
      touched = syncDialogNode(node, ev.client?.dialogueScriptId, dlgScripts);
    } else if (ev.eventType === "choice" || ev.eventType === "teleport") {
      touched = syncChoiceNode(node, ev.client?.choiceScriptId, chScripts);
    } else if (ev.eventType === "battle") {
      touched = syncBattleNode(node, ev);
      if (ev.client?.choiceScriptId) {
        touched = syncChoiceNode(node, ev.client.choiceScriptId, chScripts) || touched;
      }
    } else if (ev.eventType === "task") {
      touched = syncTaskEffects(node, ev, project);
    }
    if (ev.client?.requiresApproach) {
      node.requiresApproach = true;
      touched = true;
    }
    touched = syncRuntimeRequirements(node, ev, project) || touched;
    syncChainContinuousFromPrevEvent(node, i > 0 ? sorted[i - 1] : undefined);
    if (touched) updated++;
  }
  return updated;
}

function syncQuestNamesFromTasks(project: ProjectData, runtime: RuntimeMapConfig): void {
  for (const t of runtime.tasks ?? []) {
    const q = project.quests.find(
      (x) => x.taskId === t.taskId || resolveQuestNumericTaskId(project, x.id) === t.taskId,
    );
    if (q && t.taskName) q.name = t.taskName;
  }
}

export function importRuntimeMapIntoProject(
  project: ProjectData,
  gameMapId: string,
  runtime: RuntimeMapConfig,
): MapImportResult {
  const gameMap = findGameMapById(project, gameMapId);
  if (!gameMap) {
    return { ok: false, message: `未找到 gameMap：${gameMapId}`, updatedNpcs: 0, updatedNodes: 0 };
  }
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph) {
    return { ok: false, message: `未找到 graph：${gameMap.graphId}`, updatedNpcs: 0, updatedNodes: 0 };
  }

  if (runtime.tasks?.length) {
    gameMap.tasks = runtime.tasks.map((t) => ({
      taskId: t.taskId,
      taskName: t.taskName,
      mainlineStep: t.mainlineStep,
    }));
    syncQuestNamesFromTasks(project, runtime);
  }

  const client = runtime.client ?? {};
  const markerRaw = (client as { markerPrefabs?: { small?: string; elite?: string; boss?: string } }).markerPrefabs;
  gameMap.runtimeShell = {
    bgm: (client as { bgm?: string }).bgm,
    scenePrefabKey: (client as { scenePrefabKey?: string }).scenePrefabKey,
    markerPrefabs: markerRaw,
  };

  const dlgScripts = (client.dialogueScripts ?? {}) as Record<string, { speaker?: string; lines?: string[] }>;
  const chScripts = (client.choiceScripts ?? {}) as Record<
    string,
    { title?: string; options?: Array<{ id: string; text: string }> }
  >;

  let updatedNpcs = 0;
  let updatedNodes = 0;
  let appearSynced = 0;
  for (const row of runtime.npcs ?? []) {
    const uid = row.npcUid;
    if (!uid) continue;
    const def = gameMap.npcs.find((n) => n.npcUid === uid);
    if (!def?.entryNodeId) continue;
    let npcTouched = false;
    if (syncNpcAppearFromRuntime(def, row, project)) {
      appearSynced++;
      npcTouched = true;
    }
    const n = syncNpcChainFromRuntime(graph, def.entryNodeId, row.events ?? [], dlgScripts, chScripts, project);
    if (n > 0 || npcTouched) {
      updatedNpcs++;
      updatedNodes += n;
    }
  }

  return {
    ok: true,
    message: `已同步 tasks / 运行时壳 / appear(${appearSynced}) / ${updatedNpcs} 条 NPC 链（${updatedNodes} 个节点）。摆点坐标未回写。`,
    updatedNpcs,
    updatedNodes,
  };
}

export function buildMergeShellFromGameMap(gameMap: GameMapDef): Record<string, unknown> | null {
  const shell = gameMap.runtimeShell;
  const mp = shell?.markerPrefabs;
  const hasMarkers = !!(mp && (mp.small || mp.elite || mp.boss));
  if (!shell?.bgm && !shell?.scenePrefabKey && !hasMarkers) return null;
  return {
    client: {
      bgm: shell.bgm,
      scenePrefabKey: shell.scenePrefabKey,
      markerPrefabs: shell.markerPrefabs,
    },
  };
}

/** 从 merge 壳 JSON 解析 client 字段并写入 gameMap.runtimeShell（持久化） */
export function applyRuntimeShellFromMergeJson(gameMap: GameMapDef, merge: Record<string, unknown>): boolean {
  const client = (merge.client ?? merge) as {
    bgm?: string;
    scenePrefabKey?: string;
    markerPrefabs?: { small?: string; elite?: string; boss?: string };
  };
  const markerRaw = client.markerPrefabs;
  const hasMarkers = !!(markerRaw && (markerRaw.small || markerRaw.elite || markerRaw.boss));
  if (!client.bgm && !client.scenePrefabKey && !hasMarkers) return false;
  gameMap.runtimeShell = {
    bgm: client.bgm,
    scenePrefabKey: client.scenePrefabKey,
    markerPrefabs: markerRaw,
  };
  return true;
}
