/**
 * 将编辑器 GameMapDef + GraphData 导出为 Cocos 运行时 map_*.json
 */
import type { ActionStep, GameMapDef, GameMapNpcDef, GraphData, ProjectData, StoryNode } from "../types";
import { getOptionTargets } from "../types";
import { buildRuntimeTasksFromQuests, resolveQuestNumericTaskId, sanitizeNumericTaskId } from "./quest-logic";
import { listNpcBattleChains, battleChainNodeIds } from "./battle-enemy-bind";
import { exportNpcAppear, shouldExportInitialHidden, type RuntimeNpcAppear } from "./npc-appear";
import { defaultBattleRef } from "./client-runtime-manifest";
import {
  editorCheckToRuntime,
  editorRequirementToRuntime,
  mergeRuntimeRequirements,
  type RuntimeRequirement,
} from "./requirement-bridge";
import type {
  RuntimeChoiceScript,
  RuntimeDialogueScript,
  RuntimeMapConfig,
  RuntimeMapEvent,
  RuntimeMapNpc,
  RuntimeServerEffect,
} from "./map-runtime";
import { isVerticallyStitchedMap, resolveMapSliceSources, stitchedMapMetricsFromSources } from "./map-slice-layout";
import { isDeferChoiceOption, normalizeChoiceOptionForExport } from "./choice-option-defer";
import { sanitizeBattlePseudoChoicesInRuntime } from "../../../assets/Script/Game/story-runtime-sanitize";
import {
  battleEnemySpawnCoords,
  isBattleBranchEditorNode,
  resolveNpcBattleChain,
  resolveNpcBattleChains,
} from "./battle-enemy-bind";
import { parseNumericTaskId } from "./constants";

export type MapExportFoldWarning = {
  level: "warn" | "info";
  npcUid?: string;
  nodeId: string;
  nodeKind: string;
  message: string;
};

export type MapExportResult = {
  config: RuntimeMapConfig;
  foldWarnings: MapExportFoldWarning[];
};

function slugId(prefix: string, seed: string): string {
  const s = seed.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48);
  return `${prefix}_${s}`;
}

function collectReferencedTaskIds(project: ProjectData, graph: GraphData, gameMap: GameMapDef): Set<number> {
  const ids = new Set<number>();
  const scanNode = (node: StoryNode) => {
    const tid = resolveQuestNumericTaskId(project, node.questId);
    if (tid) ids.add(tid);
    for (const opt of node.options) {
      const accept = sanitizeNumericTaskId(opt.effectTaskAccept);
      const complete = sanitizeNumericTaskId(opt.effectTaskComplete);
      if (accept) ids.add(accept);
      if (complete) ids.add(complete);
    }
    for (const step of node.actions ?? []) {
      if (step.kind === "setQuestStatus") {
        const stid = resolveQuestNumericTaskId(project, step.questId);
        if (stid) ids.add(stid);
      }
    }
  };

  for (const npc of gameMap.npcs) {
    if (!npc.entryNodeId) continue;
    for (const node of collectNpcEventChain(graph, npc.entryNodeId)) {
      scanNode(node);
    }
    const bind = listNpcBattleChains(project, gameMap).find((b) => b.giverNpcUid === npc.npcUid);
    if (bind) {
      for (const nodeId of battleChainNodeIds(bind)) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (node) scanNode(node);
      }
    }
  }
  return ids;
}

/** 仅导出与当前地图 graph / 链内引用相关的 tasks */
export function buildRuntimeTasksForMap(project: ProjectData, gameMap: GameMapDef) {
  const quests = project.quests ?? [];
  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  const refTaskIds = graph ? collectReferencedTaskIds(project, graph, gameMap) : new Set<number>();
  const relevant = quests.filter(
    (q) => q.graphId === gameMap.graphId || (q.taskId != null && refTaskIds.has(q.taskId)),
  );
  return buildRuntimeTasksFromQuests(relevant);
}

/** 从 npcEntry 沿主链 BFS 收集事件节点（跳过 npcEntry 本身） */
export function collectNpcEventChain(graph: GraphData, entryNodeId: string): StoryNode[] {
  const entry = graph.nodes.find((n) => n.id === entryNodeId);
  if (!entry || entry.kind !== "npcEntry") return [];

  const visited = new Set<string>();
  const chain: StoryNode[] = [];
  const queue: string[] = [];

  for (const tid of getOptionTargets(entry.options[0] ?? { id: "", text: "" })) {
    queue.push(tid);
  }

  while (queue.length > 0) {
    const nid = queue.shift()!;
    if (visited.has(nid)) continue;
    visited.add(nid);
    const node = graph.nodes.find((n) => n.id === nid);
    if (!node) continue;
    if (node.kind === "npcEntry" || node.kind === "taskEnd" || node.kind === "questEntry" || node.kind === "npcExit") {
      continue;
    }

    chain.push(node);

    for (const opt of node.options) {
      for (const tid of getOptionTargets(opt)) {
        if (!visited.has(tid)) queue.push(tid);
      }
    }
  }

  return chain;
}

/** 与导出管线一致的链上 eventId 列表（跳过折叠节点与无效 callQuest） */
export function collectNpcChainEventIds(
  graph: GraphData,
  npc: Pick<GameMapNpcDef, "entryNodeId" | "npcUid">,
  project?: ProjectData,
): string[] {
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const ids: string[] = [];
  let order = 1;

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]!;
    if (isFoldOnlyNode(node)) continue;

    if (node.kind === "callQuest") {
      const effects = exportCallQuestEffects(node, project);
      if (effects.length === 0) continue;
      ids.push(`${npc.npcUid}_e${order}`);
      order++;
      continue;
    }

    if (!resolveEventType(node)) continue;
    ids.push(`${npc.npcUid}_e${order}`);
    order++;
  }

  return ids;
}

/** 编辑器节点在导出链上对应的 eventId（用于模拟器 event_done 追踪） */
export function resolveNodeEventId(
  graph: GraphData,
  npc: GameMapNpcDef,
  nodeId: string,
  project?: ProjectData,
): string | null {
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  const nodeIndex = chain.findIndex((n) => n.id === nodeId);
  if (nodeIndex < 0) return null;

  let order = 0;
  for (let i = 0; i <= nodeIndex; i++) {
    const node = chain[i]!;
    if (isFoldOnlyNode(node)) continue;
    if (node.kind === "callQuest") {
      if (exportCallQuestEffects(node, project).length === 0) continue;
      order++;
      continue;
    }
    if (!resolveEventType(node)) continue;
    order++;
  }
  return order > 0 ? `${npc.npcUid}_e${order}` : null;
}

function shouldExportEndsSessionAfter(nextNode: StoryNode | undefined): boolean {
  if (!nextNode) return false;
  /** 默认中间节点保持同次接触（RMV 事件列表）；仅显式 chainContinuous=false 时断开 */
  return nextNode.chainContinuous === false;
}

function isFoldOnlyNode(node: StoryNode): boolean {
  return node.kind === "condition" || node.kind === "check" || node.kind === "questCheck";
}

function collectFoldedRequirements(node: StoryNode, project?: ProjectData): RuntimeRequirement[] {
  const out: RuntimeRequirement[] = [];
  if (node.kind === "condition" || node.kind === "questCheck") {
    for (const r of node.requirements ?? []) {
      const rt = editorRequirementToRuntime(project, r);
      if (rt) out.push(rt);
    }
  }
  if (node.kind === "check") {
    for (const c of node.checks ?? []) {
      const rt = editorCheckToRuntime(project, c);
      if (rt) out.push(rt);
    }
  }
  if (node.runtimeRequirements?.length) {
    for (const r of node.runtimeRequirements) {
      if (r && typeof r === "object" && "type" in r) {
        out.push(r as RuntimeRequirement);
      }
    }
  }
  return out;
}

function nodeToBaseEventType(kind: StoryNode["kind"]): string | null {
  if (kind === "dialog") return "dialog";
  if (kind === "choice") return "choice";
  if (kind === "battle") return "battle";
  if (kind === "questUpdate" || kind === "action") return "task";
  if (kind === "gainItem" || kind === "loseItem" || kind === "setVar") return "task";
  return null;
}

function resolveEventType(node: StoryNode): string | null {
  if (node.kind === "choice" && node.options.some((o) => o.forcedResult === "teleport")) return "teleport";
  if (node.kind === "action") {
    const hasTeleport = (node.actions ?? []).some((a) => a.kind === "teleport" && (a.toMapId != null || a.areaId));
    if (hasTeleport) return "teleport";
  }
  return nodeToBaseEventType(node.kind);
}

function exportDialogueScript(node: StoryNode, pool: Record<string, RuntimeDialogueScript>): string {
  const id = slugId("dlg", node.id);
  const lines = (node.dialogLines ?? []).map((l) => l.text).filter(Boolean);
  if (lines.length === 0 && node.text) lines.push(node.text);
  pool[id] = {
    speaker: node.speaker ?? node.title ?? "",
    lines: lines.length ? lines : ["（空对白）"],
  };
  return id;
}

function exportChoiceScript(node: StoryNode, pool: Record<string, RuntimeChoiceScript>): string {
  const id = slugId("choice", node.id);
  const options = node.options.map((opt) => normalizeChoiceOptionForExport(opt));
  pool[id] = {
    title: node.title || node.text || "请选择",
    options: options.length ? options : [{ id: "ok", text: "继续" }],
  };
  return id;
}

function pushQuestTaskEffects(node: StoryNode, effects: RuntimeServerEffect[], project?: ProjectData) {
  const taskId = project ? resolveQuestNumericTaskId(project, node.questId) : parseNumericTaskId(node.questId);
  if (!taskId) return;
  if (node.questStatus === "InProgress") effects.push({ action: "task_accept", taskId });
  else if (node.questStatus === "Completed") effects.push({ action: "task_complete", taskId });
}

function collectChoiceServerMeta(node: StoryNode): {
  allowedChoiceIds?: string[];
  effects: RuntimeServerEffect[];
} {
  const effects: RuntimeServerEffect[] = [];
  const allowed: string[] = [];
  for (const opt of node.options) {
    const ctx = { optionIndex: node.options.indexOf(opt), peerOptions: node.options };
    const defer = isDeferChoiceOption(opt, ctx);
    if (!defer) allowed.push(opt.id);
    if (defer) continue;
    const acceptId = sanitizeNumericTaskId(opt.effectTaskAccept);
    if (acceptId) {
      effects.push({ action: "task_accept", taskId: acceptId, choiceId: opt.id });
    }
    const completeId = sanitizeNumericTaskId(opt.effectTaskComplete);
    if (completeId) {
      effects.push({ action: "task_complete", taskId: completeId, choiceId: opt.id });
    }
    if (opt.forcedResult === "teleport" && opt.teleportToMapId != null) {
      effects.push({
        action: "teleport",
        toMapId: opt.teleportToMapId,
        toX: opt.teleportX ?? 0,
        toY: opt.teleportY ?? 0,
        choiceId: opt.id,
      });
    }
  }
  return {
    allowedChoiceIds: allowed.length ? allowed : undefined,
    effects,
  };
}

function exportActionStepEffects(
  steps: ActionStep[] | undefined,
  project: ProjectData | undefined,
  choiceId?: string,
): RuntimeServerEffect[] {
  const effects: RuntimeServerEffect[] = [];
  for (const step of steps ?? []) {
    if (step.kind === "giveItem" && step.itemId) {
      effects.push({
        action: "give_item",
        itemId: step.itemId,
        count: step.count ?? 1,
        choiceId,
      });
    }
    if (step.kind === "takeItem" && step.itemId) {
      effects.push({
        action: "take_item",
        itemId: step.itemId,
        count: step.count ?? 1,
        choiceId,
      });
    }
    if (step.kind === "revealNpc" && step.npcUid) {
      effects.push({ action: "reveal_npc", npcUid: step.npcUid, choiceId });
    }
    if (step.kind === "spawnNpc" && step.npcUid) {
      effects.push({
        action: "spawn_npc",
        npcUid: step.npcUid,
        npcName: step.npcName,
        prefabKey: step.prefabKey,
        x: step.x,
        y: step.y,
        choiceId,
      });
    }
    if (step.kind === "teleport") {
      let toMapId = step.toMapId;
      let toX = step.toX ?? 0;
      let toY = step.toY ?? 0;
      if (step.areaId && project?.resources?.area) {
        const area = project.resources.area.find((a) => a.id === step.areaId);
        const note = area?.note?.trim();
        if (note?.startsWith("{")) {
          try {
            const parsed = JSON.parse(note) as { toMapId?: number; toX?: number; toY?: number };
            if (parsed.toMapId != null) toMapId = parsed.toMapId;
            if (parsed.toX != null) toX = parsed.toX;
            if (parsed.toY != null) toY = parsed.toY;
          } catch {
            /* ignore */
          }
        }
      }
      if (toMapId != null) {
        effects.push({ action: "teleport", toMapId, toX, toY, choiceId });
      }
    }
    if (step.kind === "setQuestStatus") {
      const tid = project ? resolveQuestNumericTaskId(project, step.questId) : parseNumericTaskId(step.questId);
      if (tid) {
        if (step.status === "InProgress") effects.push({ action: "task_accept", taskId: tid, choiceId });
        else if (step.status === "Completed") effects.push({ action: "task_complete", taskId: tid, choiceId });
      }
    }
    if (step.kind === "sendMail") {
      effects.push({
        action: "send_mail",
        subject: step.subject,
        body: step.body,
        choiceId,
      });
    }
    if (step.kind === "addCurrency") {
      effects.push({
        action: "add_exp",
        currency: step.currency,
        amount: step.amount,
        choiceId,
      });
    }
  }
  return effects;
}

function exportRewardNodeEffects(node: StoryNode): RuntimeServerEffect[] {
  const effects: RuntimeServerEffect[] = [];
  if (node.kind === "gainItem" && node.itemId) {
    effects.push({ action: "give_item", itemId: node.itemId, count: node.itemCount ?? 1 });
  }
  if (node.kind === "loseItem" && node.itemId) {
    effects.push({ action: "take_item", itemId: node.itemId, count: node.itemCount ?? 1 });
  }
  if (node.kind === "setVar" && node.varId) {
    effects.push({ action: "set_story_var", varId: node.varId, value: node.varValue });
  }
  return effects;
}

function exportCallQuestEffects(node: StoryNode, project?: ProjectData): RuntimeServerEffect[] {
  const effects: RuntimeServerEffect[] = [];
  for (const target of node.callQuestTargets ?? []) {
    const questId = target.startsWith("quest:") ? target.slice(6) : target;
    const tid = project ? resolveQuestNumericTaskId(project, questId) : parseNumericTaskId(questId);
    if (tid) effects.push({ action: "task_accept", taskId: tid });
  }
  return effects;
}

function exportNodeEvent(
  node: StoryNode,
  npcUid: string,
  order: number,
  dialogueScripts: Record<string, RuntimeDialogueScript>,
  choiceScripts: Record<string, RuntimeChoiceScript>,
  project?: ProjectData,
  pendingRequirements: RuntimeRequirement[] = [],
): RuntimeMapEvent | null {
  const eventType = resolveEventType(node);
  if (!eventType) return null;

  const eventId = `${npcUid}_e${order}`;
  const baseReqs = node.runtimeRequirements ? (node.runtimeRequirements as RuntimeRequirement[]) : [];
  const nodeReqs: RuntimeRequirement[] = [];
  for (const r of node.requirements ?? []) {
    const rt = editorRequirementToRuntime(project, r);
    if (rt) nodeReqs.push(rt);
  }
  const mergedReqs = mergeRuntimeRequirements(
    mergeRuntimeRequirements(mergeRuntimeRequirements(baseReqs, pendingRequirements), nodeReqs),
    [],
  );

  const ev: RuntimeMapEvent = {
    eventId,
    eventType,
    eventTypeDesc: node.title,
    order,
    server: {
      requirements: mergedReqs.length ? [...mergedReqs] : [],
      effects: [],
    },
    client: {},
  };

  if (node.requiresApproach) {
    ev.client!.requiresApproach = true;
  }

  if (eventType === "dialog") {
    ev.client!.dialogueScriptId = exportDialogueScript(node, dialogueScripts);
  } else if (eventType === "choice" || eventType === "teleport") {
    ev.client!.choiceScriptId = exportChoiceScript(node, choiceScripts);
    const meta = collectChoiceServerMeta(node);
    if (meta.allowedChoiceIds) ev.server!.allowedChoiceIds = meta.allowedChoiceIds;
    ev.server!.effects!.push(...meta.effects);
  }

  if (eventType === "battle") {
    // 战斗结果由对战验证；battle 环不导出「胜利/失败」伪选项（战前 choice 在独立 choice 环）
    if (node.battleConfigId) {
      ev.server!.battleRef = node.battleConfigId;
    } else if (node.enemyIds?.[0]) {
      ev.server!.battleRef = `battle_${node.enemyIds[0]}`;
    } else {
      ev.server!.battleRef = defaultBattleRef();
    }
    pushQuestTaskEffects(node, ev.server!.effects!, project);
    if (node.markerHint) ev.client!.markerHint = node.markerHint;
  }

  if (eventType === "task") {
    if (node.kind === "questUpdate" && project) {
      const q = project.quests.find((x) => x.id === node.questId);
      const label =
        node.questStatus === "InProgress" ? "接取任务" : node.questStatus === "Completed" ? "完成任务" : "更新任务";
      ev.client!.taskUiHint = q?.name ? `${label}：${q.name}` : label;
    } else if (node.kind === "gainItem") {
      ev.client!.taskUiHint = node.title || `获得 ${node.itemId ?? "物品"}`;
    } else if (node.kind === "loseItem") {
      ev.client!.taskUiHint = node.title || `失去 ${node.itemId ?? "物品"}`;
    } else if (node.kind === "setVar") {
      ev.client!.taskUiHint = node.title || `设置变量 ${node.varId ?? ""}`;
    } else {
      ev.client!.taskUiHint = node.text || node.title || "";
    }
    if (node.kind === "questUpdate") {
      pushQuestTaskEffects(node, ev.server!.effects!, project);
    }
    if (node.kind === "action") {
      ev.server!.effects!.push(...exportActionStepEffects(node.actions, project));
    }
    if (node.kind === "gainItem" || node.kind === "loseItem" || node.kind === "setVar") {
      ev.server!.effects!.push(...exportRewardNodeEffects(node));
    }
  }

  if (eventType === "teleport" && node.kind === "action") {
    ev.client!.choiceScriptId = exportChoiceScript(node, choiceScripts);
    const meta = collectChoiceServerMeta(node);
    if (meta.allowedChoiceIds) ev.server!.allowedChoiceIds = meta.allowedChoiceIds;
    ev.server!.effects!.push(...meta.effects);
    ev.server!.effects!.push(...exportActionStepEffects(node.actions, project));
  }

  return ev;
}

/** 摆点 prefab：本图 override > 资源库 image */
export function resolveNpcPrefabKey(project: ProjectData | undefined, npc: GameMapNpcDef): string | undefined {
  const override = npc.prefabKey?.trim();
  if (override) return override;
  const rid = npc.npcResourceId ?? npc.npcUid;
  const img = project?.resources?.npc?.find((r) => r.id === rid)?.image?.trim();
  return img || undefined;
}

/** 导出用：从剧情链首条对白推断角色名（非任务链标题） */
export function resolveNpcCharacterName(
  graph: GraphData,
  npc: GameMapNpcDef,
  project?: ProjectData,
): string | undefined {
  const skip = new Set(["系统", "对话", ""]);
  const chain = collectNpcEventChain(graph, npc.entryNodeId);
  for (const node of chain) {
    if (node.kind === "dialog" || node.kind === "npcEntry") {
      const sp = (node.speaker ?? node.title ?? "").trim();
      if (sp && !skip.has(sp)) return sp;
    }
  }
  const rid = npc.npcResourceId ?? npc.npcUid;
  const resName = project?.resources?.npc?.find((r) => r.id === rid)?.name?.trim();
  if (resName && !skip.has(resName)) return resName;
  return undefined;
}

/** 战斗敌人与所属任务官同步「何时出现在地图上」（避免仅用 task_active 导致第 1 幕接任务就刷敌） */
export function resolveBattleEnemyAppear(
  giver: GameMapNpcDef,
  project: ProjectData,
  taskId: number | null,
): RuntimeNpcAppear {
  const giverAppear = exportNpcAppear(giver, project);
  if (giverAppear.mode === "conditional" && (giverAppear.requirements?.length ?? 0) > 0) {
    return {
      mode: "conditional",
      matchMode: "ALL",
      requirements: [...giverAppear.requirements!],
    };
  }
  if (taskId) {
    return {
      mode: "conditional",
      matchMode: "ALL",
      requirements: [{ type: "task_active", taskId }],
    };
  }
  return { mode: "conditional", matchMode: "ALL", requirements: [] };
}

function insertRuntimeNpcAfterGiver(npcs: RuntimeMapNpc[], giverUid: string, row: RuntimeMapNpc): void {
  const giverIdx = npcs.findIndex((n) => n.npcUid === giverUid);
  if (giverIdx < 0) {
    npcs.push(row);
    return;
  }
  let insertAt = giverIdx + 1;
  while (insertAt < npcs.length) {
    const uid = String(npcs[insertAt]?.npcUid ?? "");
    if (!uid.startsWith(`${giverUid}_enemy`)) break;
    insertAt++;
  }
  npcs.splice(insertAt, 0, row);
}

export function exportGameMapToRuntimeWithMeta(
  gameMap: GameMapDef,
  graph: GraphData,
  project?: ProjectData,
): MapExportResult {
  const dialogueScripts: Record<string, RuntimeDialogueScript> = {};
  const choiceScripts: Record<string, RuntimeChoiceScript> = {};
  const npcs: RuntimeMapNpc[] = [];
  const foldWarnings: MapExportFoldWarning[] = [];

  for (const npc of gameMap.npcs) {
    const chain = collectNpcEventChain(graph, npc.entryNodeId);
    const battleBind = resolveNpcBattleChain(project, gameMap, npc.npcUid, graph);
    const events: RuntimeMapEvent[] = [];
    let order = 1;
    let pendingRequirements: RuntimeRequirement[] = [];

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i]!;

      if (battleBind?.enemyAppearNodeId && isBattleBranchEditorNode(node)) {
        continue;
      }

      if (node.kind === "choice" && node.title === "战斗结果") {
        foldWarnings.push({
          level: "warn",
          npcUid: npc.npcUid,
          nodeId: node.id,
          nodeKind: node.kind,
          message:
            "任务官链内误含「战斗结果」选项（已跳过导出）。请在左栏添加「+ 战斗分支」并重新发布地图",
        });
        continue;
      }

      if (isFoldOnlyNode(node)) {
        const folded = collectFoldedRequirements(node, project);
        pendingRequirements = mergeRuntimeRequirements(pendingRequirements, folded);
        foldWarnings.push({
          level: "info",
          npcUid: npc.npcUid,
          nodeId: node.id,
          nodeKind: node.kind,
          message: `${node.kind} 节点已折叠，${folded.length} 条条件合并到后继事件`,
        });
        continue;
      }

      if (node.kind === "callQuest") {
        const effects = exportCallQuestEffects(node, project);
        if (effects.length === 0) {
          foldWarnings.push({
            level: "warn",
            npcUid: npc.npcUid,
            nodeId: node.id,
            nodeKind: node.kind,
            message: "callQuest 无有效目标，已跳过",
          });
          continue;
        }
        const ev: RuntimeMapEvent = {
          eventId: `${npc.npcUid}_e${order}`,
          eventType: "task",
          eventTypeDesc: node.title,
          order,
          server: {
            requirements: pendingRequirements.length ? [...pendingRequirements] : [],
            effects,
          },
          client: { taskUiHint: node.title || "调用任务" },
        };
        pendingRequirements = [];
        const nextNode = chain[i + 1];
        if (shouldExportEndsSessionAfter(nextNode)) {
          ev.client = { ...(ev.client ?? {}), endsSession: true };
        }
        events.push(ev);
        order++;
        continue;
      }

      const ev = exportNodeEvent(node, npc.npcUid, order, dialogueScripts, choiceScripts, project, pendingRequirements);
      pendingRequirements = [];

      if (ev) {
        const nextNode = chain[i + 1];
        if (shouldExportEndsSessionAfter(nextNode)) {
          ev.client = { ...(ev.client ?? {}), endsSession: true };
        }
        events.push(ev);
        order++;
      } else {
        foldWarnings.push({
          level: "warn",
          npcUid: npc.npcUid,
          nodeId: node.id,
          nodeKind: node.kind,
          message: `节点类型 ${node.kind} 无法导出为运行时事件`,
        });
      }
    }

    if (pendingRequirements.length > 0) {
      foldWarnings.push({
        level: "warn",
        npcUid: npc.npcUid,
        nodeId: chain[chain.length - 1]?.id ?? "",
        nodeKind: "chain",
        message: `${pendingRequirements.length} 条折叠条件无后继事件可合并`,
      });
    }

    if (events.length > 0) {
      const last = events[events.length - 1]!;
      last.client = { ...(last.client ?? {}), endsSession: true };
    }

    const runtimeNpc: RuntimeMapNpc = {
      npcUid: npc.npcUid,
      npcName: npc.npcName,
      characterName: resolveNpcCharacterName(graph, npc, project),
      prefabKey: resolveNpcPrefabKey(project, npc),
      x: npc.x,
      y: npc.y,
      events,
    };
    if (shouldExportInitialHidden(npc)) {
      (runtimeNpc as RuntimeMapNpc & { initialHidden?: boolean }).initialHidden = true;
    }
    runtimeNpc.appear = exportNpcAppear(npc, project!);
    const exitNode = graph.nodes.find((n) => n.id === npc.exitNodeId);
    const hideWhenComplete = exitNode?.hideNpcOnEnd ?? true;
    (runtimeNpc as RuntimeMapNpc & { hideWhenComplete?: boolean }).hideWhenComplete = hideWhenComplete;
    npcs.push(runtimeNpc);
  }

  const exportedBattleEnemyUids = new Set<string>();
  for (const giver of gameMap.npcs) {
    const binds = resolveNpcBattleChains(project, gameMap, giver.npcUid, graph);
    for (const bind of binds) {
      if (!bind?.battleNodeId || !bind.spawnStep?.npcUid) continue;
      const spawnUid = bind.spawnStep.npcUid;
      if (exportedBattleEnemyUids.has(spawnUid)) continue;
      exportedBattleEnemyUids.add(spawnUid);

      const enemyEvents: RuntimeMapEvent[] = [];
      let order = 1;
      const branchNodeIds = [bind.battlePrepNodeId, bind.battleNodeId].filter(Boolean) as string[];
      for (const nodeId of branchNodeIds) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        const ev = exportNodeEvent(node, spawnUid, order, dialogueScripts, choiceScripts, project, []);
        if (ev) {
          enemyEvents.push(ev);
          order++;
        }
      }
      if (enemyEvents.length === 0) continue;

      const lastEnemyEv = enemyEvents[enemyEvents.length - 1]!;
      lastEnemyEv.client = { ...(lastEnemyEv.client ?? {}), endsSession: true };

      const coords = battleEnemySpawnCoords(bind, giver);
      const battleNode = bind.battleNodeId ? graph.nodes.find((n) => n.id === bind.battleNodeId) : null;
      const inProgressReq = battleNode?.requirements?.find(
        (r): r is Extract<import("../types").Requirement, { kind: "questStatus" }> =>
          r.kind === "questStatus" && r.status === "InProgress",
      );
      const questId = inProgressReq?.questId ?? project?.quests[0]?.id;
      const taskId = questId && project ? resolveQuestNumericTaskId(project, questId) : null;

      const runtimeEnemy: RuntimeMapNpc & { initialHidden?: boolean; hideWhenComplete?: boolean } = {
        npcUid: spawnUid,
        npcName: bind.enemyName,
        prefabKey: bind.spawnStep.prefabKey,
        x: coords.x,
        y: coords.y,
        initialHidden: true,
        appear: project ? resolveBattleEnemyAppear(giver, project, taskId) : {
          mode: "conditional",
          matchMode: "ALL",
          requirements: taskId ? [{ type: "task_active", taskId }] : [],
        },
        hideWhenComplete: true,
        events: enemyEvents,
      };
      insertRuntimeNpcAfterGiver(npcs, giver.npcUid, runtimeEnemy);
    }
  }

  const expectedBattleEnemies = gameMap.npcs.reduce((sum, n) => {
    return sum + resolveNpcBattleChains(project, gameMap, n.npcUid, graph).filter((b) => b.battleNodeId && b.spawnStep?.npcUid).length;
  }, 0);
  const exportedBattleEnemies = npcs.filter((n) => {
    const uid = n.npcUid ?? "";
    return uid.includes("_enemy");
  }).length;
  if (expectedBattleEnemies > exportedBattleEnemies) {
    foldWarnings.push({
      level: "warn",
      nodeId: "",
      nodeKind: "export",
      message: `有 ${expectedBattleEnemies - exportedBattleEnemies} 个战斗敌人未导出到 runtime（请检查战斗分支与 spawnNpc 配置）`,
    });
  }

  const sliceSources = resolveMapSliceSources(gameMap);
  const mapMetrics = stitchedMapMetricsFromSources(sliceSources);

  const config: RuntimeMapConfig = {
    configVersion: "1.0.1",
    mapId: gameMap.mapId,
    mapCode: gameMap.mapCode,
    mapName: gameMap.mapName,
    tileSize: gameMap.tileSize,
    mapWidth: mapMetrics.width,
    mapHeight: mapMetrics.height,
    mapLayout: isVerticallyStitchedMap(gameMap) ? "vertical_stitch" : "single",
    imageSlices: sliceSources.length > 1 ? sliceSources : undefined,
    tasks: buildRuntimeTasksForMap(project ?? { quests: [], graphs: [], gameMaps: [], variables: [], characterAssets: [], resources: {} }, gameMap),
    client: {
      dialogueScripts,
      choiceScripts,
    },
    npcs,
  };

  sanitizeBattlePseudoChoicesInRuntime(config);

  return { config, foldWarnings };
}

export function exportGameMapToRuntime(gameMap: GameMapDef, graph: GraphData, project?: ProjectData): RuntimeMapConfig {
  return exportGameMapToRuntimeWithMeta(gameMap, graph, project).config;
}

/** 统计指向某 npcEntry 节点的跨 graph 入边数 */
export function countIncomingEdgesToNode(projectGraphs: GraphData[], targetNodeId: string): number {
  let count = 0;
  for (const g of projectGraphs) {
    for (const from of g.nodes) {
      for (const opt of from.options) {
        if (getOptionTargets(opt).includes(targetNodeId)) count++;
      }
    }
  }
  return count;
}

/** 查找项目中所有 npcEntry 节点 id → { graphId, npcUid } */
export function findAllNpcEntryNodes(projectGraphs: GraphData[]): Map<string, { graphId: string; npcUid?: string }> {
  const out = new Map<string, { graphId: string; npcUid?: string }>();
  for (const g of projectGraphs) {
    for (const n of g.nodes) {
      if (n.kind === "npcEntry") {
        out.set(n.id, { graphId: g.id, npcUid: n.npcUid });
      }
    }
  }
  return out;
}

/** 从选项解析接/交任务（供 Inspector 快捷写入） */
export function questIdToTaskId(questId: string): number | null {
  return parseNumericTaskId(questId);
}
