import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../../types";
import { getOptionTargets } from "../../types";
import { computeChainStepLabels } from "../chain-step-labels";
import { getClientRuntimeManifest } from "../client-runtime-manifest";
import { getTimelineGraph } from "../map-tree";
import type { AiTarget } from "./ai-target";
import { getGameMapForTarget, isTimelineTarget } from "./ai-target";
import type { AiStoryMode, ExistingNodeSummary, StoryAiContext } from "./types";
import { allGameMapsSummary } from "./ai-target";

function summarizeNode(n: StoryNode, graph: GraphData, entryNodeId: string): ExistingNodeSummary {
  const labels = computeChainStepLabels(graph, entryNodeId);
  const outTargets = n.options
    .map((opt, optionIndex) => ({
      optionIndex,
      targetNodeId: getOptionTargets(opt)[0] ?? "",
    }))
    .filter((t) => t.targetNodeId);
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    speaker: n.speaker,
    dialogPreview: n.dialogLines?.[0]?.text?.slice(0, 80),
    optionTexts: n.options.map((o) => o.text).filter(Boolean),
    stepLabel: labels.get(n.id),
    outTargets: outTargets.length ? outTargets : undefined,
  };
}

export function buildStoryAiContext(
  project: ProjectData,
  options: {
    target: AiTarget;
    selectedNodeIds?: string[];
  },
): StoryAiContext {
  const manifest = getClientRuntimeManifest();
  const isTimeline = isTimelineTarget(options.target);
  const mode: AiStoryMode = isTimeline ? "timeline_outline" : "map_npc_chain";
  const gameMap = getGameMapForTarget(project, options.target);

  const ctx: StoryAiContext = {
    mode,
    quests: (project.quests ?? []).map((q) => ({
      id: q.id,
      name: q.name,
      taskId: q.taskId,
      mainlineStep: q.mainlineStep,
    })),
    battleRefs: manifest.battleRefs,
    defaultBattleRef: manifest.defaultBattleRef,
    narrativeHint: "防线、虫族、机甲、补给、前哨；战斗前写准备进入战斗；拒绝选项须 systemTip。",
    selectedNodeIds: options.selectedNodeIds?.length ? options.selectedNodeIds : undefined,
    allGameMaps: allGameMapsSummary(project),
    editMode: options.target.scope === "map" ? options.target.editMode : undefined,
    focusNpcUid: options.target.scope === "map" ? options.target.npcUid : undefined,
  };

  if (isTimeline) {
    const timeline = getTimelineGraph(project);
    ctx.graphId = timeline?.id;
    ctx.graphKind = "timeline";
    ctx.timelinePortals = (timeline?.nodes ?? [])
      .filter((n) => n.kind === "mapPortal")
      .map((n) => ({ id: n.id, title: n.title, gameMapId: n.gameMapId }));
    ctx.gameMapTree = (project.gameMaps ?? []).map((m) => ({
      id: m.id,
      mapName: m.mapName,
      mapCode: m.mapCode,
      parentId: m.parentGameMapId ?? null,
    }));
    return ctx;
  }

  const gm = gameMap;
  if (!gm) return ctx;

  const graph = project.graphs.find((g) => g.id === gm.graphId);
  ctx.mapId = gm.mapId;
  ctx.mapCode = gm.mapCode;
  ctx.mapName = gm.mapName;
  ctx.graphId = gm.graphId;
  ctx.graphKind = graph?.kind;
  ctx.taskOrderHint = "左栏任务链列表顺序 = 游戏中 NPC/任务逐个出现顺序；tasks[].taskKey 即 npcUid。";

  const focusUid = options.target.scope === "map" ? options.target.npcUid : undefined;

  ctx.npcs = gm.npcs.map((npc) => {
    const labels = graph ? computeChainStepLabels(graph, npc.entryNodeId) : new Map<string, string>();
    const middle = graph
      ? graph.nodes.filter(
          (n) =>
            n.mapId === npc.zoneId &&
            n.kind !== "npcEntry" &&
            n.kind !== "npcExit" &&
            labels.has(n.id) &&
            labels.get(n.id) !== "入" &&
            labels.get(n.id) !== "出",
        )
      : [];
    middle.sort((a, b) => {
      const la = labels.get(a.id) ?? "";
      const lb = labels.get(b.id) ?? "";
      const pa = la.split("-").map(Number);
      const pb = lb.split("-").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
      }
      return 0;
    });
    return {
      npcUid: npc.npcUid,
      npcName: npc.npcName,
      x: npc.x,
      y: npc.y,
      zoneId: npc.zoneId,
      entryNodeId: npc.entryNodeId,
      exitNodeId: npc.exitNodeId,
      existingNodes: middle.map((n) => summarizeNode(n, graph!, npc.entryNodeId)),
      isEmptyChain: middle.length === 0,
    };
  });

  if (focusUid) {
    ctx.npcs = ctx.npcs.filter((n) => n.npcUid === focusUid);
  }

  return ctx;
}

export function getGraphForTarget(project: ProjectData, target: AiTarget): GraphData | null {
  if (isTimelineTarget(target)) {
    return getTimelineGraph(project) ?? null;
  }
  const gm = getGameMapForTarget(project, target);
  if (!gm) return null;
  return project.graphs.find((g) => g.id === gm.graphId) ?? null;
}

/** @deprecated use getGraphForTarget */
export function getGraphForAi(project: ProjectData, isTimeline: boolean, gameMap?: GameMapDef | null): GraphData | null {
  if (isTimeline) return getTimelineGraph(project) ?? null;
  if (!gameMap) return null;
  return project.graphs.find((g) => g.id === gameMap.graphId) ?? null;
}
