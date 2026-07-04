import { connectGraphOption, deleteNodeFromGraph, disconnectGraphOption } from "../adapters";
import { createMapPortalWithGameMap } from "../timeline-logic";
import { createTaskChain } from "./ai-task-chain-sync";
import { findQuestForMapGraph } from "../quest-logic";
import {
  assertChoiceNodeAllowedForNpc,
  assertNodeKindAllowedForNpc,
  assertQuestUpdateAllowedForNpc,
} from "../chain-slot-guards";
import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../../types";
import { createNode, getOptionTargets, setOptionTargets } from "../../types";
import type { ApplyResult, StreamOp, StreamOpAddNode } from "./types";

const HORIZONTAL_STEP = 160;

export type ApplierContext = {
  project: ProjectData;
  graph: GraphData;
  gameMap?: GameMapDef | null;
  tempIdMap: Map<string, string>;
  layoutCursor: Map<string, number>;
  lastNodeByNpc: Map<string, string>;
  pendingConnects: import("./types").StreamOpConnect[];
};

export function createApplierContext(
  project: ProjectData,
  graph: GraphData,
  gameMap?: GameMapDef | null,
): ApplierContext {
  return {
    project,
    graph,
    gameMap,
    tempIdMap: new Map(),
    layoutCursor: new Map(),
    lastNodeByNpc: new Map(),
    pendingConnects: [],
  };
}

export function applyStreamOp(ctx: ApplierContext, op: StreamOp): ApplyResult {
  const warnings: string[] = [];
  switch (op.op) {
    case "addNode":
      return applyAddNode(ctx, op);
    case "connect":
      return applyConnect(ctx, op, warnings);
    case "patchNode":
      return applyPatchNode(ctx, op, warnings);
    case "addPortal":
      return applyAddPortal(ctx, op, warnings);
    case "addTaskChain":
      return applyAddTaskChain(ctx, op, warnings);
    case "deleteNode":
      return applyDeleteNode(ctx, op, warnings);
    case "disconnect":
      return applyDisconnect(ctx, op, warnings);
    default:
      warnings.push(`未知 op: ${(op as StreamOp).op}`);
      return { applied: 0, warnings };
  }
}

function resolveNpc(ctx: ApplierContext, npcUid?: string) {
  if (!ctx.gameMap || !npcUid) return null;
  return ctx.gameMap.npcs.find((n) => n.npcUid === npcUid) ?? null;
}

function nextPosition(ctx: ApplierContext, zoneId: string, zoneX: number, zoneY: number) {
  const cur = ctx.layoutCursor.get(zoneId) ?? 0;
  ctx.layoutCursor.set(zoneId, cur + 1);
  return { x: zoneX + 120 + cur * HORIZONTAL_STEP, y: zoneY + 100 };
}

function ensureNpcForUid(ctx: ApplierContext, npcUid?: string, title?: string) {
  if (!ctx.gameMap || !npcUid) return null;
  let npc = resolveNpc(ctx, npcUid);
  if (npc) return npc;
  const chainTitle = title?.trim() || npcUid;
  npc = createTaskChain(ctx.project, ctx.gameMap, {
    npcUid,
    title: chainTitle,
    npcName: chainTitle,
  });
  return npc;
}

function applyAddTaskChain(
  ctx: ApplierContext,
  op: import("./types").StreamOpAddTaskChain,
  warnings: string[],
): ApplyResult {
  if (!ctx.gameMap) {
    warnings.push("addTaskChain 需要地图上下文");
    return { applied: 0, warnings };
  }
  const npc = createTaskChain(ctx.project, ctx.gameMap, {
    npcUid: op.npcUid,
    title: op.title,
    npcName: op.npcName,
    npcResourceId: op.npcResourceId,
    x: op.x,
    y: op.y,
  });
  if (!npc) {
    warnings.push(`addTaskChain 创建失败: ${op.npcUid}`);
    return { applied: 0, warnings };
  }
  if (op.tempId) ctx.tempIdMap.set(op.tempId, npc.entryNodeId);
  ctx.lastNodeByNpc.set(op.npcUid, npc.entryNodeId);
  return { applied: 1, warnings, lastNodeKind: "npcEntry", lastNodeId: npc.entryNodeId };
}

function applyAddNode(ctx: ApplierContext, op: StreamOpAddNode): ApplyResult {
  const npc = ensureNpcForUid(ctx, op.npcUid, op.title);
  const guard = assertNodeKindAllowedForNpc(ctx.project, ctx.graph, ctx.gameMap, op.npcUid ?? npc?.npcUid, op.kind, {
    title: op.title,
    actions: op.kind === "action" ? undefined : undefined,
  });
  if (!guard.ok) {
    return {
      applied: 0,
      warnings: [guard.reason + (guard.hint ? `（${guard.hint}）` : "")],
    };
  }
  if (op.kind === "questUpdate" && op.questStatus === "Completed") {
    const qGuard = assertQuestUpdateAllowedForNpc(ctx.project, ctx.graph, ctx.gameMap, op.npcUid, {
      kind: "questUpdate",
      questStatus: "Completed",
      requirements: undefined,
      npcUid: op.npcUid,
    });
    if (!qGuard.ok) {
      return { applied: 0, warnings: [qGuard.reason] };
    }
  }
  if (op.kind === "choice") {
    const cGuard = assertChoiceNodeAllowedForNpc(ctx.project, ctx.graph, ctx.gameMap, op.npcUid, {
      kind: "choice",
      title: op.title,
      npcUid: op.npcUid,
    });
    if (!cGuard.ok) {
      return { applied: 0, warnings: [cGuard.reason] };
    }
  }
  const zoneId = npc?.zoneId ?? ctx.graph.maps?.find((m) => m.npcUid === op.npcUid)?.id;
  const zone = zoneId ? ctx.graph.maps?.find((m) => m.id === zoneId) : undefined;
  const baseX = zone?.x ?? 40;
  const baseY = zone?.y ?? 40;
  const pos = zoneId ? nextPosition(ctx, zoneId, baseX, baseY) : { x: 120, y: 120 };

  const dialogLines = normalizeDialogLines(op);
  const options = normalizeOptions(op);

  const partial: Partial<StoryNode> = {
    kind: op.kind,
    title: op.title,
    text: op.text ?? "",
    speaker: op.speaker,
    dialogLines,
    mapId: zoneId,
    npcUid: op.npcUid,
    position: pos,
    battleConfigId: op.battleConfigId,
    markerHint: op.markerHint,
    questId: op.questId,
    questStatus: op.questStatus,
    chainContinuous: op.chainContinuous ?? (op.kind === "battle" || op.kind === "questUpdate"),
    gameMapId: op.gameMapId,
  };

  if (op.kind === "questUpdate" && !partial.questId && ctx.gameMap) {
    const chapterQuest = findQuestForMapGraph(ctx.project, ctx.gameMap.graphId);
    if (chapterQuest) partial.questId = chapterQuest.id;
  }

  if (op.kind === "choice" && options.length > 0) {
    partial.options = options;
  } else if (op.kind === "choice") {
    partial.options = [
      { id: `opt_${crypto.randomUUID()}`, text: "接受" },
      {
        id: `opt_${crypto.randomUUID()}`, text: "暂缓",
        completesEvent: false,
        forcedResult: "block",
      },
    ];
  }

  const node = createNode(partial);
  if (!node.npcUid && npc) node.npcUid = npc.npcUid;
  ctx.graph.nodes.push(node);
  ctx.tempIdMap.set(op.tempId, node.id);

  const wired = autoWireAfter(ctx, op, node.id, npc?.entryNodeId, npc?.exitNodeId);
  if (!wired && op.afterTempId) {
    ctx.pendingConnects.push({
      op: "connect",
      fromTempId: op.afterTempId,
      toTempId: op.tempId,
      optionIndex: 0,
    });
  }
  if (op.npcUid) ctx.lastNodeByNpc.set(op.npcUid, node.id);
  else if (zoneId) {
    const zoneNpc = ctx.gameMap?.npcs.find((n) => n.zoneId === zoneId);
    if (zoneNpc) ctx.lastNodeByNpc.set(zoneNpc.npcUid, node.id);
  }

  return { applied: 1, warnings: [], lastNodeKind: op.kind, lastNodeId: node.id };
}

function normalizeDialogLines(op: StreamOpAddNode) {
  if (!op.dialogLines?.length) return undefined;
  return op.dialogLines.map((line) => {
    if (typeof line === "string") {
      return { id: `line_${crypto.randomUUID()}`, text: line };
    }
    return { id: `line_${crypto.randomUUID()}`, text: line.text };
  });
}

function normalizeOptions(op: StreamOpAddNode) {
  if (!op.options?.length) return [];
  return op.options.map((o, i) => {
    const completesEvent =
      o.completesEvent ??
      (i > 0 && op.kind === "choice" && /暂缓|稍后再|拒绝/.test(String(o.text ?? "")) ? false : true);
    const forcedResult =
      o.forcedResult ??
      (completesEvent === false ? ("block" as const) : undefined);
    return {
      id: `opt_${crypto.randomUUID()}`,
      text: o.text,
      npcReply: o.npcReply,
      systemTip: o.systemTip,
      completesEvent,
      forcedResult,
      effectTaskAccept: o.effectTaskAccept,
      effectTaskComplete: o.effectTaskComplete,
      teleportToMapId: o.teleportToMapId,
      teleportX: o.teleportX,
      teleportY: o.teleportY,
    };
  });
}

function autoWireAfter(
  ctx: ApplierContext,
  op: StreamOpAddNode,
  nodeId: string,
  entryNodeId?: string,
  exitNodeId?: string,
): boolean {
  if (op.after === "entry" && entryNodeId) {
    const entry = ctx.graph.nodes.find((n) => n.id === entryNodeId);
    if (entry?.options[0]) {
      setOptionTargets(entry.options[0], [nodeId]);
    }
    return true;
  }
  if (op.afterTempId) {
    const prevId = ctx.tempIdMap.get(op.afterTempId);
    if (prevId) {
      connectByDefaultOption(ctx.graph, prevId, nodeId);
      return true;
    }
    if (op.npcUid) {
      const fallback = ctx.lastNodeByNpc.get(op.npcUid);
      if (fallback) {
        connectByDefaultOption(ctx.graph, fallback, nodeId);
        return true;
      }
    }
    return false;
  }
  if (op.afterNodeId) {
    connectByDefaultOption(ctx.graph, op.afterNodeId, nodeId);
    return true;
  }
  if (op.after === "exit" && exitNodeId) {
    connectByDefaultOption(ctx.graph, nodeId, exitNodeId);
    return true;
  }
  if (op.npcUid && entryNodeId) {
    const entry = ctx.graph.nodes.find((n) => n.id === entryNodeId);
    if (entry) {
      if (entry.options.length === 0) {
        entry.options.push({ id: `opt_${crypto.randomUUID()}`, text: "开始" });
      }
      const entryTargets = getOptionTargets(entry.options[0]!);
      if (entryTargets.length === 0) {
        setOptionTargets(entry.options[0]!, [nodeId]);
        return true;
      }
    }
  }
  return false;
}

function connectByDefaultOption(graph: GraphData, fromId: string, toId: string) {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return;
  if (from.options.length === 0) {
    from.options.push({ id: `opt_${crypto.randomUUID()}`, text: "继续" });
  }
  connectGraphOption(graph, fromId, from.options[0]!.id, toId);
}

function applyConnect(ctx: ApplierContext, op: import("./types").StreamOpConnect, warnings: string[]): ApplyResult {
  const fromId = op.fromId ?? (op.fromTempId ? ctx.tempIdMap.get(op.fromTempId) : undefined);
  let toId = op.toId ?? (op.toTempId ? ctx.tempIdMap.get(op.toTempId) : undefined);

  if (op.to === "exit" && ctx.gameMap) {
    const fromNode = fromId ? ctx.graph.nodes.find((n) => n.id === fromId) : undefined;
    const npc =
      (fromNode?.npcUid ? ctx.gameMap.npcs.find((n) => n.npcUid === fromNode.npcUid) : undefined) ??
      (fromNode?.mapId ? ctx.gameMap.npcs.find((n) => n.zoneId === fromNode.mapId) : undefined) ??
      ctx.gameMap.npcs[0];
    toId = npc?.exitNodeId ?? toId;
  }
  if (op.to === "entry" && ctx.gameMap) {
    const fromNode = fromId ? ctx.graph.nodes.find((n) => n.id === fromId) : undefined;
    const npc =
      (fromNode?.npcUid ? ctx.gameMap.npcs.find((n) => n.npcUid === fromNode.npcUid) : undefined) ??
      ctx.gameMap.npcs[0];
    toId = npc?.entryNodeId ?? toId;
  }

  if (!fromId || !toId) {
    if (op.fromTempId || op.toTempId) {
      ctx.pendingConnects.push(op);
      return { applied: 0, warnings };
    }
    warnings.push(`connect 缺少 from/to: ${JSON.stringify(op)}`);
    return { applied: 0, warnings };
  }

  const from = ctx.graph.nodes.find((n) => n.id === fromId);
  if (!from) {
    warnings.push(`connect 找不到 from 节点 ${fromId}`);
    return { applied: 0, warnings };
  }
  const optIdx = op.optionIndex ?? 0;
  while (from.options.length <= optIdx) {
    from.options.push({
      id: `opt_${crypto.randomUUID()}`,
      text: from.kind === "choice" ? (from.options.length === 0 ? "接受" : "暂缓") : "继续",
    });
  }
  const opt = from.options[optIdx];
  if (!opt) {
    warnings.push(`connect 选项索引无效 ${optIdx}`);
    return { applied: 0, warnings };
  }
  connectGraphOption(ctx.graph, fromId, opt.id, toId);
  return { applied: 1, warnings };
}

/** 延迟 connect：tempId 尚未注册时先入队，生成结束后再刷 */
export function flushPendingConnects(ctx: ApplierContext): ApplyResult {
  const warnings: string[] = [];
  let applied = 0;
  let pass = true;
  while (pass && ctx.pendingConnects.length > 0) {
    pass = false;
    const remaining: import("./types").StreamOpConnect[] = [];
    for (const op of ctx.pendingConnects) {
      const r = applyConnect(ctx, op, warnings);
      if (r.applied > 0) {
        applied += r.applied;
        pass = true;
      } else {
        remaining.push(op);
      }
    }
    ctx.pendingConnects = remaining;
  }
  if (ctx.pendingConnects.length > 0) {
    warnings.push(`仍有 ${ctx.pendingConnects.length} 条 connect 未能解析 tempId`);
  }
  return { applied, warnings };
}

function applyPatchNode(ctx: ApplierContext, op: import("./types").StreamOpPatchNode, warnings: string[]): ApplyResult {
  const nodeId = op.nodeId ?? (op.tempId ? ctx.tempIdMap.get(op.tempId) : undefined);
  if (!nodeId) {
    warnings.push("patchNode 缺少 nodeId/tempId");
    return { applied: 0, warnings };
  }
  const node = ctx.graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    warnings.push(`patchNode 找不到 ${nodeId}`);
    return { applied: 0, warnings };
  }
  const p = op.patch;
  if (p.title) {
    if (node.kind === "choice") {
      const g = assertChoiceNodeAllowedForNpc(ctx.project, ctx.graph, ctx.gameMap, node.npcUid, {
        kind: "choice",
        title: p.title,
        npcUid: node.npcUid,
      });
      if (!g.ok) {
        warnings.push(g.reason);
        return { applied: 0, warnings };
      }
    }
    node.title = p.title;
  }
  if (p.speaker) node.speaker = p.speaker;
  if (p.text) node.text = p.text;
  if (p.dialogLines) {
    node.dialogLines = normalizeDialogLines({ ...p, op: "addNode", tempId: "", kind: "dialog" });
  }
  if (p.options?.length && node.kind === "choice") {
    node.options = normalizeOptions({ ...p, op: "addNode", tempId: "", kind: "choice" });
  }
  if (p.battleConfigId) node.battleConfigId = p.battleConfigId;
  if (p.questId) node.questId = p.questId;
  if (p.questStatus) node.questStatus = p.questStatus;
  return { applied: 1, warnings, lastNodeKind: node.kind, lastNodeId: node.id };
}

function applyAddPortal(ctx: ApplierContext, op: import("./types").StreamOpAddPortal, warnings: string[]): ApplyResult {
  if (ctx.graph.kind !== "timeline") {
    warnings.push("addPortal 仅用于 timeline 画布");
    return { applied: 0, warnings };
  }
  const { portal } = createMapPortalWithGameMap(ctx.project, { title: op.title });
  ctx.tempIdMap.set(op.tempId, portal.id);
  if (op.afterPortalId || op.afterTempId) {
    const afterId = op.afterPortalId ?? (op.afterTempId ? ctx.tempIdMap.get(op.afterTempId) : undefined);
    if (afterId) {
      const afterNode = ctx.graph.nodes.find((n) => n.id === afterId);
      if (afterNode?.options[0]) {
        const existing = getOptionTargets(afterNode.options[0]);
        if (!existing.includes(portal.id)) {
          connectGraphOption(ctx.graph, afterId, afterNode.options[0].id, portal.id);
        }
      }
    }
  }
  return { applied: 1, warnings, lastNodeKind: "mapPortal", lastNodeId: portal.id };
}

function applyDeleteNode(
  ctx: ApplierContext,
  op: import("./types").StreamOpDeleteNode,
  warnings: string[],
): ApplyResult {
  const result = deleteNodeFromGraph(ctx.graph, op.nodeId);
  if (!result.ok) {
    warnings.push(result.reason);
    return { applied: 0, warnings };
  }
  ctx.tempIdMap.forEach((id, tempId) => {
    if (id === op.nodeId) ctx.tempIdMap.delete(tempId);
  });
  return { applied: 1, warnings };
}

function applyDisconnect(
  ctx: ApplierContext,
  op: import("./types").StreamOpDisconnect,
  warnings: string[],
): ApplyResult {
  const from = ctx.graph.nodes.find((n) => n.id === op.fromId);
  if (!from) {
    warnings.push(`disconnect 找不到 from ${op.fromId}`);
    return { applied: 0, warnings };
  }
  const opt = op.optionId
    ? from.options.find((o) => o.id === op.optionId)
    : from.options[op.optionIndex ?? 0];
  if (!opt) {
    warnings.push("disconnect 选项无效");
    return { applied: 0, warnings };
  }
  disconnectGraphOption(ctx.graph, op.fromId, opt.id, op.targetNodeId);
  return { applied: 1, warnings };
}

/** 链尾自动接到 exit（generate 结束时调用） */
export function wireOpenChainTailsToExit(ctx: ApplierContext) {
  if (!ctx.gameMap) return;
  for (const npc of ctx.gameMap.npcs) {
    if (!npc.exitNodeId) continue;
    const chainIds = new Set(
      ctx.graph.nodes.filter((n) => n.mapId === npc.zoneId && n.kind !== "npcEntry" && n.kind !== "npcExit").map((n) => n.id),
    );
    for (const nid of chainIds) {
      const node = ctx.graph.nodes.find((n) => n.id === nid);
      if (!node) continue;
      const targets = node.options.flatMap((o) => getOptionTargets(o));
      const hasExit = targets.includes(npc.exitNodeId);
      const hasInternal = targets.some((t) => chainIds.has(t));
      if (!hasExit && !hasInternal && node.options[0]) {
        connectGraphOption(ctx.graph, nid, node.options[0].id, npc.exitNodeId);
      }
    }
  }
}
