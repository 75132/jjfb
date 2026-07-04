import type { InjectionKey } from "vue";

export type StoryEditorActions = {
  canDeleteFlowNode: (flowNodeId: string) => boolean;
  requestDeleteNodes: (flowNodeIds: string[]) => void;
  openNodeContextMenu: (payload: { x: number; y: number; flowNodeId: string }) => void;
  drillDownMapPortal?: (flowNodeId: string) => void;
};

export const STORY_EDITOR_ACTIONS_KEY: InjectionKey<StoryEditorActions> = Symbol("storyEditorActions");
