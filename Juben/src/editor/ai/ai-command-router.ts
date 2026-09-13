import { storyTitleMaxLenConstraint } from "../story-title-limit";
import { buildOptimizeBriefFromExisting } from "./ai-optimize-brief";
import { buildRepairBriefFromIssues } from "./ai-repair-brief";
import type { ChainIssue } from "../map-chain-repair";
import type { ExistingNodeSummary, RequirementsBrief } from "./types";

export type AiCommandKind = "patch" | "repair" | "blueprint" | "timeline" | "chat";

export type AiCommandRouteInput = {
  text: string;
  isTimeline: boolean;
  hasExistingChain: boolean;
  hasSelectedNodes: boolean;
};

export type BuildCommandBriefInput = {
  text: string;
  kind: AiCommandKind;
  focusNpcUid?: string;
  selectedNodeIds?: string[];
  patchNodes: ExistingNodeSummary[];
  chainIssues?: ChainIssue[];
  mapCode?: string;
  editMode?: "append" | "patch";
};

const REPAIR_RE = /修复|补连线|补全|链条|断了|缺线|缺失|连不上|断开/;
const CHAT_RE = /^(问[：:?]?|为什么|怎么|能否解释|解释一下)/;
const FULL_RE = /从头|重新生成|整图重写|新建整条|按蓝图/;
const CREATE_RE = /生成|新建|写一段|做一条|加一条链/;
const APPEND_CHAIN_RE = /加一条|新增.*链|再来一条|追加一条/;

export function routeAiCommand(input: AiCommandRouteInput): AiCommandKind {
  const text = input.text.trim();
  if (!text) return "chat";
  if (input.isTimeline) return "timeline";
  if (REPAIR_RE.test(text)) return "repair";
  if (CHAT_RE.test(text)) return "chat";
  if (FULL_RE.test(text)) return "blueprint";
  if (input.hasExistingChain && APPEND_CHAIN_RE.test(text)) return "blueprint";
  if (!input.hasExistingChain && !input.hasSelectedNodes && CREATE_RE.test(text)) return "blueprint";
  if (input.hasSelectedNodes || input.hasExistingChain) return "patch";
  return "blueprint";
}

export function commandKindLabel(kind: AiCommandKind): string {
  switch (kind) {
    case "patch":
      return "局部修改";
    case "repair":
      return "修复链条";
    case "blueprint":
      return "生成剧情";
    case "timeline":
      return "时间线";
    default:
      return "对话";
  }
}

/** 白话 → requirementsBrief，供 generate 阶段直接执行 */
export function buildBriefForCommand(input: BuildCommandBriefInput): RequirementsBrief | null {
  const text = input.text.trim();
  if (!text) return null;

  switch (input.kind) {
    case "timeline":
      return {
        type: "requirementsBrief",
        storyGoal: text,
        beats: [{ kind: "mapPortal", summary: text }],
        constraints: [],
        editMode: "append",
      };
    case "repair": {
      const issues = input.chainIssues ?? [];
      return buildRepairBriefFromIssues(issues, {
        focusNpcUid: input.focusNpcUid,
        fallbackTargetNodeIds: input.selectedNodeIds,
        storyGoal: text,
      });
    }
    case "blueprint":
      return {
        type: "requirementsBrief",
        storyGoal: text,
        npcUid: input.focusNpcUid,
        beats: [{ kind: "dialog", summary: text }],
        constraints: ["autoQuestFlow", storyTitleMaxLenConstraint()],
        editMode: input.editMode ?? "append",
      };
    case "patch":
      return buildOptimizeBriefFromExisting(input.patchNodes, {
        focusNpcUid: input.focusNpcUid,
        selectedNodeIds: input.selectedNodeIds,
        userHint: text,
      });
    default:
      return null;
  }
}

export function shouldAutoExecuteCommand(kind: AiCommandKind): boolean {
  return kind === "patch" || kind === "repair" || kind === "blueprint" || kind === "timeline";
}

export function suggestQuickCommands(options: {
  hasSelectedNodes: boolean;
  hasExistingChain: boolean;
  selectedTitle?: string;
}): string[] {
  const out: string[] = [];
  if (options.hasSelectedNodes && options.selectedTitle) {
    out.push(`用 RPG 人味重写「${options.selectedTitle}」对白`);
    out.push(`给「${options.selectedTitle}」加态度分流选项`);
  } else if (options.hasSelectedNodes) {
    out.push("用 RPG 人味重写选中对白");
    out.push("给选中节点加态度分流选项");
  }
  if (options.hasExistingChain) {
    out.push("修复链条，补缺失连线");
    out.push("整链改掉任务板口吻");
  }
  out.push("把任务标题改短一点");
  return out.slice(0, 4);
}
