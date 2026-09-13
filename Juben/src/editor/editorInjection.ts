import type { InjectionKey } from "vue";

export type AiPendingCommand = {
  id: number;
  text: string;
};

export type AiAssistantBridge = {
  /** 打开 AI 助手并执行白话指令（可选聚焦节点 / 任务链） */
  runCommand: (text: string, options?: { nodeIds?: string[]; npcUid?: string }) => void;
};

export const AI_ASSISTANT_KEY: InjectionKey<AiAssistantBridge> = Symbol("aiAssistant");

export type StoryEditorActions = {
  canDeleteFlowNode: (flowNodeId: string) => boolean;
  requestDeleteNodes: (flowNodeIds: string[]) => void;
  openNodeContextMenu: (payload: { x: number; y: number; flowNodeId: string }) => void;
  drillDownMapPortal?: (flowNodeId: string) => void;
};

export const STORY_EDITOR_ACTIONS_KEY: InjectionKey<StoryEditorActions> = Symbol("storyEditorActions");
