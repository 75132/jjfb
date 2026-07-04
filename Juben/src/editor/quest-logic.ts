import type { ProjectData, QuestDef, QuestStatus, GraphData, GameMapDef } from "../types";
import { createGraph, createNode } from "../types";
import { TASK_ID_BASE } from "./constants";

/** 将各 gameMap.tasks 合并进 project.quests（按 taskId 去重，不覆盖已有 quest） */
export function migrateGameMapTasksToQuests(data: ProjectData): void {
  const quests = data.quests ?? [];
  const byTaskId = new Map<number, QuestDef>();
  for (const q of quests) {
    if (q.taskId != null) byTaskId.set(q.taskId, q);
  }

  for (const gm of data.gameMaps ?? []) {
    for (const t of gm.tasks ?? []) {
      const tid = Number(t.taskId);
      if (!Number.isFinite(tid) || tid <= 0) continue;
      if (byTaskId.has(tid)) {
        const existing = byTaskId.get(tid)!;
        if (!existing.name?.trim() && t.taskName) existing.name = t.taskName;
        if (t.mainlineStep != null && existing.mainlineStep == null) {
          existing.mainlineStep = t.mainlineStep;
        }
        continue;
      }
      let graph = data.graphs.find(
        (g) => g.kind === "quest" && (g.name.includes(String(t.taskName ?? "")) || g.id.includes(String(tid))),
      );
      if (!graph) {
        const gid = `g_quest_migrated_${tid}`;
        graph = createGraph({
          id: gid,
          kind: "quest",
          name: `任务：${t.taskName ?? tid}`,
          nodes: [
            createNode({ kind: "questEntry", position: { x: 160, y: 120 } }),
            createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 120 } }),
          ],
        });
        data.graphs.push(graph);
      }
      const q: QuestDef = {
        id: `q_migrated_${tid}`,
        name: t.taskName ?? `任务${tid}`,
        initialStatus: "NotStarted",
        graphId: graph.id,
        taskId: tid,
        mainlineStep: t.mainlineStep,
      };
      quests.push(q);
      byTaskId.set(tid, q);
    }
  }
  data.quests = quests;
}

/** 为 quest 补全 taskId / sortOrder / mainlineStep（按 quests 数组当前顺序） */
export function normalizeGlobalQuests(data: ProjectData): void {
  const quests = data.quests ?? [];
  let maxTaskId = TASK_ID_BASE - 1;
  for (const q of quests) {
    if (q.taskId != null && q.taskId > maxTaskId) maxTaskId = q.taskId;
  }

  quests.forEach((q, idx) => {
    q.sortOrder = idx;
    q.mainlineStep = idx + 1;
    if (q.taskId == null || q.taskId <= 0) {
      maxTaskId += 1;
      q.taskId = maxTaskId;
    }
  });

  data.quests = quests;
}

export function buildRuntimeTasksFromQuests(quests: QuestDef[]) {
  return [...quests]
    .filter((q) => q.taskId != null && Number(q.taskId) > 0)
    .sort((a, b) => (a.sortOrder ?? a.mainlineStep ?? 0) - (b.sortOrder ?? b.mainlineStep ?? 0))
    .map((q) => ({
      taskId: q.taskId!,
      taskName: q.name,
      mainlineStep: q.mainlineStep ?? q.sortOrder ?? 0,
    }));
}

export function questStatusLabel(status: QuestStatus): string {
  if (status === "NotStarted") return "未开始";
  if (status === "InProgress") return "进行中";
  if (status === "Completed") return "已完成";
  if (status === "Failed") return "失败";
  return status;
}

/** 将 questId（qp_xxx 或数字字符串）解析为运行时 taskId */
export function resolveQuestNumericTaskId(project: ProjectData, questOrTaskId: string | undefined): number | null {
  if (!questOrTaskId) return null;
  const direct = parseInt(questOrTaskId, 10);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const q = project.quests.find((x) => x.id === questOrTaskId);
  if (q?.taskId != null && Number.isFinite(q.taskId) && q.taskId > 0) return q.taskId;
  const digits = questOrTaskId.replace(/\D/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 清洗选项/导出用 taskId，拒绝 NaN、0、负数与非数字字符串 */
export function sanitizeNumericTaskId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  return null;
}

/** 修复地图链内失效 questId / 非法 effectTaskAccept，避免导出 taskId=NaN */
export function repairMapQuestTaskBindings(
  project: ProjectData,
  graph: GraphData,
  gameMap: GameMapDef,
): number {
  normalizeGlobalQuests(project);
  const chapterQuest = findQuestForMapGraph(project, gameMap.graphId);
  const chapterTaskId = chapterQuest ? resolveQuestNumericTaskId(project, chapterQuest.id) : null;
  const validQuestIds = new Set((project.quests ?? []).map((q) => q.id));
  let fixed = 0;

  for (const node of graph.nodes) {
    if (node.kind === "questUpdate" && chapterQuest?.id) {
      if (!node.questId || !validQuestIds.has(node.questId)) {
        node.questId = chapterQuest.id;
        fixed += 1;
      }
    }
    for (const opt of node.options) {
      const accept = sanitizeNumericTaskId(opt.effectTaskAccept);
      if (opt.effectTaskAccept != null && accept == null) {
        delete opt.effectTaskAccept;
        if (chapterTaskId) opt.effectTaskAccept = chapterTaskId;
        fixed += 1;
      } else if (accept != null && opt.effectTaskAccept !== accept) {
        opt.effectTaskAccept = accept;
        fixed += 1;
      }
      const complete = sanitizeNumericTaskId(opt.effectTaskComplete);
      if (opt.effectTaskComplete != null && complete == null) {
        delete opt.effectTaskComplete;
        fixed += 1;
      } else if (complete != null && opt.effectTaskComplete !== complete) {
        opt.effectTaskComplete = complete;
        fixed += 1;
      }
    }
    for (const step of node.actions ?? []) {
      if (step.kind !== "setQuestStatus") continue;
      if (!step.questId || !validQuestIds.has(step.questId)) {
        if (chapterQuest?.id) {
          step.questId = chapterQuest.id;
          fixed += 1;
        }
      }
    }
  }
  return fixed;
}

/** 地图剧情画布默认关联的本章任务（由时间线 mapPortal 同步） */
export function findQuestForMapGraph(project: ProjectData, graphId: string): QuestDef | null {
  const gm = project.gameMaps?.find((m) => m.graphId === graphId);
  if (!gm) return null;
  return project.quests.find((q) => q.graphId === gm.graphId) ?? null;
}

/** 统计项目中引用该 quest 的次数（questCheck / callQuest / questUpdate） */
export function countQuestReferences(project: ProjectData, questId: string): number {
  let n = 0;
  for (const g of project.graphs) {
    for (const node of g.nodes) {
      if (node.kind === "questUpdate" && node.questId === questId) n++;
      if (node.kind === "questCheck" || node.kind === "condition") {
        for (const r of node.requirements ?? []) {
          if (r.kind === "questStatus" && r.questId === questId) n++;
        }
      }
      if (node.kind === "callQuest") {
        for (const t of node.callQuestTargets ?? []) {
          if (t === `quest:${questId}`) n++;
        }
      }
    }
  }
  return n;
}

/** 统计 numeric taskId 在地图链中的引用 */
export function countTaskIdReferences(project: ProjectData, taskId: number): number {
  const sid = String(taskId);
  let n = 0;
  for (const g of project.graphs) {
    for (const node of g.nodes) {
      if (node.kind === "questUpdate" && node.questId === sid) n++;
      for (const opt of node.options) {
        if (opt.effectTaskAccept === taskId || opt.effectTaskComplete === taskId) n++;
      }
      for (const step of node.actions ?? []) {
        if (step.kind === "setQuestStatus" && step.questId === sid) n++;
      }
    }
  }
  return n;
}

export function reorderQuests(project: ProjectData, fromIndex: number, toIndex: number): void {
  const list = project.quests;
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  normalizeGlobalQuests(project);
}
