export type AiStoryPhase = "discuss" | "generate";
export type AiStoryMode = "map_npc_chain" | "timeline_outline";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StoryStreamRequest = {
  phase: AiStoryPhase;
  mode: AiStoryMode;
  messages: ChatMessage[];
  context: unknown;
  requirementsBrief?: unknown;
  focusNpcUid?: string;
};
