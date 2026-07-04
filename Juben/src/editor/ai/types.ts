import type { NodeKind, QuestStatus } from "../../types";
import type { AiEditMode } from "./ai-target";

export type AiStoryPhase = "discuss" | "generate";
export type AiStoryMode = "map_npc_chain" | "timeline_outline";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Plan 模式：结构化步骤（不展示原始 JSON） */
  planStep?: PlanStepPayload;
  /** 用户已完成的 plan 选择摘要 */
  planSelectionSummary?: string;
};

export type PlanOption = {
  id: string;
  label: string;
  description?: string;
  patch?: Record<string, unknown>;
};

export type PlanSelectionMode = "single" | "multi" | "number" | "text";

export type PlanStepPayload = {
  type: "planStep";
  stepId: string;
  title: string;
  prompt?: string;
  selectionMode: PlanSelectionMode;
  options?: PlanOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
};

export type StoryBeat = {
  kind: string;
  summary: string;
};

export type TaskBrief = {
  taskKey: string;
  title: string;
  npcName?: string;
  npcResourceId?: string;
  x?: number;
  y?: number;
  /** 蓝图槽：对话 / 战斗（每槽一条独立任务链） */
  slotKind?: "dialog" | "battle";
  /** 战斗链敌人数量（slotKind=battle） */
  enemyCount?: number;
  slotIndex?: number;
  /** AI 写 title/npcName 的剧情提示 */
  plotHint?: string;
};

export type RequirementsBrief = {
  type: "requirementsBrief";
  npcUid?: string;
  storyGoal?: string;
  character?: { name?: string; personality?: string; tone?: string };
  beats?: StoryBeat[];
  tasks?: TaskBrief[];
  constraints?: string[];
  editMode?: AiEditMode;
  targetNodeIds?: string[];
};

export type ExistingNodeSummary = {
  id: string;
  kind: NodeKind;
  title: string;
  speaker?: string;
  dialogPreview?: string;
  optionTexts?: string[];
  stepLabel?: string;
  outTargets?: Array<{ optionIndex: number; targetNodeId: string }>;
};

export type NpcChainSummary = {
  npcUid: string;
  npcName: string;
  x: number;
  y: number;
  zoneId: string;
  entryNodeId: string;
  exitNodeId?: string;
  existingNodes: ExistingNodeSummary[];
  isEmptyChain: boolean;
};

export type StoryAiContext = {
  mode: AiStoryMode;
  mapId?: number;
  mapCode?: string;
  mapName?: string;
  graphId?: string;
  graphKind?: string;
  focusNpcUid?: string;
  editMode?: AiEditMode;
  selectedNodeIds?: string[];
  npcs?: NpcChainSummary[];
  quests?: Array<{ id: string; name: string; taskId?: number; mainlineStep?: number }>;
  battleRefs?: string[];
  defaultBattleRef?: string;
  timelinePortals?: Array<{ id: string; title: string; gameMapId?: string }>;
  gameMapTree?: Array<{ id: string; mapName?: string; mapCode: string; parentId?: string | null }>;
  allGameMaps?: Array<{ id: string; mapName?: string; mapCode: string; mapId: number; npcCount: number }>;
  narrativeHint?: string;
  taskOrderHint?: string;
};

export type StreamOpAddNode = {
  op: "addNode";
  tempId: string;
  kind: NodeKind;
  npcUid?: string;
  title?: string;
  speaker?: string;
  text?: string;
  dialogLines?: string[] | Array<{ text: string }>;
  options?: Array<{
    text: string;
    npcReply?: string;
    systemTip?: string;
    completesEvent?: boolean;
    forcedResult?: "start_battle" | "block" | "teleport";
    effectTaskAccept?: number;
    effectTaskComplete?: number;
    teleportToMapId?: number;
    teleportX?: number;
    teleportY?: number;
  }>;
  battleConfigId?: string;
  markerHint?: string;
  questId?: string;
  questStatus?: QuestStatus;
  chainContinuous?: boolean;
  after?: "entry" | "exit";
  afterTempId?: string;
  afterNodeId?: string;
  gameMapId?: string;
};

export type StreamOpConnect = {
  op: "connect";
  fromTempId?: string;
  fromId?: string;
  toTempId?: string;
  toId?: string;
  to?: "entry" | "exit";
  optionIndex?: number;
  optionId?: string;
};

export type StreamOpPatchNode = {
  op: "patchNode";
  tempId?: string;
  nodeId?: string;
  patch: Partial<StreamOpAddNode>;
};

export type StreamOpDeleteNode = {
  op: "deleteNode";
  nodeId: string;
};

export type StreamOpDisconnect = {
  op: "disconnect";
  fromId: string;
  optionIndex?: number;
  optionId?: string;
  targetNodeId?: string;
};

export type StreamOpAddPortal = {
  op: "addPortal";
  tempId: string;
  title: string;
  gameMapId?: string;
  afterPortalId?: string;
  afterTempId?: string;
};

export type StreamOpAddTaskChain = {
  op: "addTaskChain";
  tempId?: string;
  npcUid: string;
  title: string;
  npcName?: string;
  npcResourceId?: string;
  x?: number;
  y?: number;
};

export type StreamOp =
  | StreamOpAddNode
  | StreamOpConnect
  | StreamOpPatchNode
  | StreamOpDeleteNode
  | StreamOpDisconnect
  | StreamOpAddPortal
  | StreamOpAddTaskChain;

export type ApplyResult = {
  applied: number;
  warnings: string[];
  lastNodeKind?: string;
  lastNodeId?: string;
};
