import type { RequirementsBrief, StoryBeat, TaskBrief } from "./types";

/** 用户只需选择：这一格是对话还是战斗（每格 = 一条独立任务链） */
export type BlueprintSlotKind = "dialog" | "battle";

export type BlueprintSlot = {
  kind: BlueprintSlotKind;
  /** 仅战斗格有效：该任务链需几个地图战斗 NPC */
  enemyCount: number;
};

export type StoryBlueprint = {
  storyGoal: string;
  nodeCount: number;
  nodes: BlueprintSlot[];
};

export function blueprintSlotLabel(kind: BlueprintSlotKind): string {
  return kind === "battle" ? "战斗" : "对话";
}

export function defaultBlueprintSlot(kind: BlueprintSlotKind = "dialog"): BlueprintSlot {
  return { kind, enemyCount: kind === "battle" ? 1 : 0 };
}

export function defaultStoryBlueprint(nodeCount = 4): StoryBlueprint {
  const n = Math.min(8, Math.max(2, nodeCount));
  const nodes: BlueprintSlot[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) nodes.push(defaultBlueprintSlot("dialog"));
    else if (i === 1 && n >= 3) nodes.push(defaultBlueprintSlot("battle"));
    else nodes.push(defaultBlueprintSlot("dialog"));
  }
  return { storyGoal: "", nodeCount: n, nodes };
}

export function resizeBlueprintNodes(blueprint: StoryBlueprint, nextCount: number): StoryBlueprint {
  const n = Math.min(8, Math.max(2, nextCount));
  const nodes = [...blueprint.nodes];
  const fresh = defaultStoryBlueprint(n).nodes;
  while (nodes.length < n) nodes.push({ ...fresh[nodes.length]! });
  if (nodes.length > n) nodes.length = n;
  return { ...blueprint, nodeCount: n, nodes };
}

export function totalBattleEnemyCount(nodes: BlueprintSlot[]): number {
  return nodes
    .filter((row) => row.kind === "battle")
    .reduce((sum, row) => sum + Math.max(1, row.enemyCount), 0);
}

/** 供 AI 写标题的剧情提示（非「xxx-1对话」模板） */
export function blueprintTaskPlotHint(storyGoal: string, index: number, slot: BlueprintSlot, total: number): string {
  const ord = total > 1 ? `（共${total}条任务线之第${index + 1}条）` : "";
  if (slot.kind === "battle") {
    const n = Math.max(1, slot.enemyCount);
    return `围绕「${storyGoal}」${ord}：玩家接取后在地图击败 ${n} 个敌人，AI 须写独立任务名`;
  }
  return `围绕「${storyGoal}」${ord}：纯对话推进，禁止战斗节点与战斗敌人`;
}

/** 占位标题（AI 生成后应 patch 为剧情名） */
export function blueprintTaskPlaceholderTitle(storyGoal: string, index: number, total: number): string {
  if (total <= 1) return storyGoal;
  return `${storyGoal} · 第${index + 1}幕`;
}

/** 每格生成一条独立任务链 */
export function buildBlueprintTasks(
  blueprint: StoryBlueprint,
  options?: { baseNpcUid?: string; mapCode?: string },
): TaskBrief[] {
  const mapCode = options?.mapCode?.trim() || "map";
  const base = options?.baseNpcUid?.trim() || `${mapCode}_chain`;
  const total = blueprint.nodes.length;
  return blueprint.nodes.map((slot, i) => ({
    taskKey: `${base}_${i + 1}`,
    title: blueprintTaskPlaceholderTitle(blueprint.storyGoal, i, total),
    npcName: blueprintTaskPlaceholderTitle(blueprint.storyGoal, i, total),
    plotHint: blueprintTaskPlotHint(blueprint.storyGoal, i, slot, total),
    slotKind: slot.kind,
    enemyCount: slot.kind === "battle" ? Math.max(1, slot.enemyCount) : undefined,
    slotIndex: i + 1,
  }));
}

/** 每条任务链一条 beat，供 AI 按 npcUid 分别生成 */
export function blueprintTasksToBeats(tasks: TaskBrief[]): StoryBeat[] {
  return tasks.map((task) => ({
    kind: task.slotKind === "battle" ? "battle" : "dialog",
    summary: task.plotHint ?? task.title,
  }));
}

/** 一次性蓝图 → requirementsBrief（N 格 = N 条任务链） */
export function synthesizeBriefFromBlueprint(
  blueprint: StoryBlueprint,
  partial?: Partial<RequirementsBrief> & { mapCode?: string } | null,
): RequirementsBrief | null {
  const storyGoal = blueprint.storyGoal.trim();
  if (!storyGoal) return null;

  const tasks = buildBlueprintTasks(blueprint, {
    baseNpcUid: partial?.npcUid,
    mapCode: partial?.mapCode,
  });
  const beats = blueprintTasksToBeats(tasks);
  const constraints: string[] = [...(partial?.constraints ?? [])];

  if (!constraints.includes("multiChainBlueprint")) constraints.push("multiChainBlueprint");
  if (!constraints.includes("autoQuestFlow")) constraints.push("autoQuestFlow");
  if (blueprint.nodes.some((n) => n.kind === "battle")) {
    if (!constraints.includes("deferUntilAccept")) constraints.push("deferUntilAccept");
  }

  for (const task of tasks) {
    if (task.slotKind === "battle") {
      constraints.push(`chainTask:${task.taskKey}:battle:${Math.max(1, task.enemyCount ?? 1)}`);
    } else {
      constraints.push(`chainTask:${task.taskKey}:dialog`);
    }
  }

  const brief: RequirementsBrief = {
    type: "requirementsBrief",
    storyGoal,
    character: partial?.character ?? {},
    beats,
    tasks,
    constraints,
    editMode: partial?.editMode,
    targetNodeIds: partial?.targetNodeIds,
  };

  return brief;
}

export function isBlueprintReady(blueprint: StoryBlueprint): boolean {
  return blueprint.storyGoal.trim().length > 0 && blueprint.nodes.length >= 2;
}
