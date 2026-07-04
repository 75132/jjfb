import type { GameMapDef, GraphData, ProjectData } from "../../types";
import { ensureNpcZonesAndEntries } from "../game-map-logic";
import { layoutZoneNodes } from "../graph-auto-layout";
import { detectMapChainIssues, repairMapChains, type ChainIssue } from "../map-chain-repair";
import { syncTaskChainsFromBrief } from "./ai-task-chain-sync";
import { buildRepairBriefFromIssues } from "./ai-repair-brief";
import { streamStoryAi } from "./deepseek-client";
import { buildStoryAiContext } from "./story-context-builder";
import { NdjsonLineParser } from "./story-stream-parser";
import {
  applyStreamOp,
  createApplierContext,
  flushPendingConnects,
} from "./story-stream-applier";
import type { RequirementsBrief } from "./types";

export type AiChainRepairResult = {
  ok: boolean;
  appliedOps: number;
  addedNodes: number;
  warnings: string[];
  error?: string;
};

export type AiChainRepairOptions = {
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
};

/** 对单条 NPC 链执行 AI patch 生成 + 落地 + repair/layout */
export async function runAiChainRepairForNpc(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
  npcUid: string,
  issues?: ChainIssue[],
  options: AiChainRepairOptions = {},
): Promise<AiChainRepairResult> {
  const npcIssues =
    issues ?? detectMapChainIssues(project, graph, gameMap).filter((i) => i.npcUid === npcUid);
  const brief: RequirementsBrief = buildRepairBriefFromIssues(npcIssues, {
    focusNpcUid: npcUid,
    storyGoal: `修复「${gameMap.npcs.find((n) => n.npcUid === npcUid)?.npcName ?? npcUid}」任务链`,
  });

  const target = { scope: "map" as const, gameMapId: gameMap.id, npcUid, editMode: "patch" as const };
  const aiContext = buildStoryAiContext(project, { target, selectedNodeIds: brief.targetNodeIds ?? [] });
  const applierCtx = createApplierContext(project, graph, gameMap);
  syncTaskChainsFromBrief(project, gameMap, brief);

  const parser = new NdjsonLineParser();
  let appliedOps = 0;
  const warnings: string[] = [];

  const applyOps = (ops: import("./types").StreamOp[]) => {
    for (const op of ops) {
      const result = applyStreamOp(applierCtx, op);
      appliedOps += result.applied;
      if (result.warnings.length) warnings.push(...result.warnings);
    }
  };

  options.onProgress?.(`AI 生成：${npcUid}`);

  return new Promise((resolve) => {
    void streamStoryAi(
      {
        phase: "generate",
        mode: "map_npc_chain",
        messages: [{ role: "user", content: "请按 brief 补全缺失节点与连线，每行一条 NDJSON。" }],
        context: aiContext,
        requirementsBrief: brief,
        focusNpcUid: npcUid,
        signal: options.signal,
      },
      {
        onChunk: (t) => {
          const { ops, warnings: w } = parser.push(t);
          if (w.length) warnings.push(...w);
          applyOps(ops);
        },
        onDone: () => {
          const { ops, warnings: w } = parser.flush();
          if (w.length) warnings.push(...w);
          applyOps(ops);
          void (async () => {
            try {
              flushPendingConnects(applierCtx);
              syncTaskChainsFromBrief(project, gameMap, brief);
              ensureNpcZonesAndEntries(project, gameMap);
              const repairResult = repairMapChains(project, graph, gameMap);
              warnings.push(...repairResult.warnings);
              const npc = gameMap.npcs.find((n) => n.npcUid === npcUid);
              if (npc?.zoneId) await layoutZoneNodes(graph, npc.zoneId);
              ensureNpcZonesAndEntries(project, gameMap);
              resolve({
                ok: true,
                appliedOps,
                addedNodes: repairResult.addedNodes,
                warnings,
              });
            } catch (e) {
              resolve({
                ok: false,
                appliedOps,
                addedNodes: 0,
                warnings,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          })();
        },
        onError: (msg) => {
          resolve({ ok: false, appliedOps, addedNodes: 0, warnings, error: msg });
        },
      },
    );
  });
}
