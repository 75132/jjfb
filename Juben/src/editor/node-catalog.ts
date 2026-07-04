import type { GraphKind, NodeKind } from "../types";

export type NodeCatalogEntry = {
  kind: NodeKind;
  label: string;
  /** 一句话说明用途 */
  summary: string;
  category: "story" | "combat" | "reward" | "logic" | "advanced" | "timeline";
};

export const NODE_CATEGORY_LABEL: Record<NodeCatalogEntry["category"], string> = {
  story: "剧情",
  combat: "战斗",
  reward: "物品",
  logic: "任务与分支",
  advanced: "高级（少用）",
  timeline: "时间线",
};

/** 地图 NPC 剧情链常用节点 */
export const MAP_NODE_CATALOG: NodeCatalogEntry[] = [
  { kind: "dialog", label: "对话", summary: "NPC 对白，单线连下一个节点", category: "story" },
  { kind: "choice", label: "选择", summary: "玩家选分支；接/完成任务请连「任务进度」节点", category: "story" },
  { kind: "battle", label: "战斗", summary: "进入战斗，胜利/失败两出口", category: "combat" },
  { kind: "gainItem", label: "获得物品", summary: "发放道具到背包", category: "reward" },
  { kind: "loseItem", label: "失去物品", summary: "扣除道具", category: "reward" },
  { kind: "questUpdate", label: "任务进度", summary: "接取/完成当前章节任务（地图内推荐）", category: "logic" },
  { kind: "condition", label: "条件分支", summary: "按任务状态或变量走满足/不满足", category: "logic" },
  { kind: "setVar", label: "变量", summary: "修改剧情变量值", category: "advanced" },
  { kind: "action", label: "复合动作", summary: "弹窗、传送、显现 NPC 等组合步骤", category: "advanced" },
  { kind: "check", label: "准入检查", summary: "服务器检查：宠物、背包、活动开关等", category: "advanced" },
  { kind: "callQuest", label: "跳转任务", summary: "旧版：进入另一任务画布（新流程少用）", category: "advanced" },
  { kind: "questCheck", label: "任务检查", summary: "与「条件分支」重复，请优先用条件", category: "advanced" },
];

export const TIMELINE_NODE_CATALOG: NodeCatalogEntry[] = [
  { kind: "mapPortal", label: "大剧情", summary: "章节入口，双击进入地图", category: "timeline" },
  { kind: "condition", label: "条件", summary: "章节流转：任务/变量判断", category: "timeline" },
];

export const NODE_KIND_GUIDE: Partial<Record<NodeKind, string>> = Object.fromEntries(
  [...MAP_NODE_CATALOG, ...TIMELINE_NODE_CATALOG].map((e) => [e.kind, e.summary]),
) as Partial<Record<NodeKind, string>>;

/** 功能重叠说明（Inspector 提示用） */
export const NODE_OVERLAP_HINTS: Partial<Record<NodeKind, string>> = {
  choice: "选项负责分支文案与反馈。地图内接取/完成任务请连「任务进度」节点，勿与选项内旧版任务配置重复。",
  questCheck: "「任务检查」与「条件分支」能力重叠。条件节点同样可检查任务状态，建议统一用条件分支。",
  callQuest: "新流程在地图内用「任务进度」节点即可。跳转任务仅用于旧版多画布任务。",
  action: "复合动作可一次做很多事；简单场景请用对话/获得/任务等专用节点，更清晰。",
  check: "准入检查偏服务器规则；普通剧情分支请用「条件分支」。",
  questUpdate: "章节任务已自动关联当前地图。状态选「进行中」= 接取，「已完成」= 完成。",
};

export function catalogForGraph(kind: GraphKind | undefined): NodeCatalogEntry[] {
  return kind === "timeline" ? TIMELINE_NODE_CATALOG : MAP_NODE_CATALOG;
}

export function primaryCatalogEntries(kind: GraphKind | undefined): NodeCatalogEntry[] {
  return catalogForGraph(kind).filter((e) => e.category !== "advanced");
}

export function advancedCatalogEntries(kind: GraphKind | undefined): NodeCatalogEntry[] {
  return catalogForGraph(kind).filter((e) => e.category === "advanced");
}

export function quickCreateForGraph(kind: GraphKind | undefined): Array<{ kind: NodeKind; label: string }> {
  if (kind === "timeline") {
    return TIMELINE_NODE_CATALOG.map((e) => ({ kind: e.kind, label: e.label }));
  }
  return [
    { kind: "dialog", label: "对话" },
    { kind: "choice", label: "选择" },
    { kind: "questUpdate", label: "任务进度" },
  ];
}
