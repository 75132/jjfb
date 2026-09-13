<script setup lang="ts">
import { computed, inject } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { FLOW_TARGET_HANDLE_IN, type StoryNodeData } from "../adapters";
import { STORY_EDITOR_ACTIONS_KEY } from "../editorInjection";
import type { QuestStatus } from "../../types";

const props = defineProps<{
  id: string;
  data: StoryNodeData;
  selected?: boolean;
}>();

const editorActions = inject(STORY_EDITOR_ACTIONS_KEY, null);
const node = computed(() => props.data.storyNode);
const showDelete = computed(
  () => !!props.selected && !props.data.ghost && !!editorActions?.canDeleteFlowNode(props.id),
);

function onDeleteClick(e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  editorActions?.requestDeleteNodes([props.id]);
}

function onContextMenu(e: MouseEvent) {
  if (!editorActions) return;
  e.preventDefault();
  e.stopPropagation();
  editorActions.openNodeContextMenu({ x: e.clientX, y: e.clientY, flowNodeId: props.id });
}

const kindLabel = computed(() => {
  const k = node.value.kind;
  return k === "dialog"
    ? "对话"
    : k === "choice"
      ? "选择"
      : k === "battle"
        ? "战斗"
        : k === "gainItem"
          ? "获得"
          : k === "loseItem"
            ? "失去"
            : k === "setVar"
              ? "变量"
              : k === "questUpdate"
                ? "任务"
                : k === "action"
                  ? "动作"
                  : k === "check"
                    ? "检查"
                    : k === "callQuest"
                      ? "开始任务"
                      : k === "questCheck"
                        ? "任务检查"
                        : k === "npcEntry"
                          ? "任务入口"
                          : k === "npcExit"
                            ? "任务结尾"
                            : k === "condition"
                              ? "条件"
                              : "节点";
});

const preview = computed(() => {
  if (node.value.kind === "dialog") {
    const t =
      node.value.dialogLines
        ?.map((x) => x.text)
        .filter(Boolean)
        .join(" / ") ?? "";
    return t.trim() || node.value.text || "";
  }
  if (node.value.kind === "choice") return node.value.text || "";
  return "";
});

const primaryMeta = computed(() => {
  const n = node.value;
  const d = props.data;
  switch (n.kind) {
    case "battle":
      return n.enemyIds?.length ? `敌人 ${n.enemyIds.join(" | ")}` : "敌人未填";
    case "gainItem":
      return `+ ${n.itemId || "未填"} × ${n.itemCount ?? 1}`;
    case "loseItem":
      return `- ${n.itemId || "未填"} × ${n.itemCount ?? 1}`;
    case "setVar":
      return `${n.varId || "变量"} = ${String(n.varValue ?? "")}`;
    case "questUpdate":
      return `${questStatusLabel(n.questStatus)}`;
    case "action":
      return `${n.actions?.length ?? 0} 条动作`;
    case "check":
      return `${n.checkMode || "ALL"} · ${n.checks?.length ?? 0} 条`;
    case "condition":
    case "questCheck":
      return `${n.conditionMode || "ALL"} · ${n.requirements?.length ?? 0} 条`;
    case "callQuest":
      return n.callQuestTargets?.length ? `${n.callQuestTargets.length} 个目标` : "未选目标";
    case "questEntry":
    case "npcEntry":
      return d.entryLinked
        ? `已接入${d.appearLabel ? ` · ${d.appearLabel}` : ""}`
        : "未接入";
    case "taskEnd":
      return questStatusLabel(n.questStatus || "Completed");
    case "npcExit":
      return n.hideNpcOnEnd ? "结束后隐藏" : "结束后保持";
    default:
      return "";
  }
});

function questStatusLabel(status?: QuestStatus) {
  if (status === "NotStarted") return "未开始";
  if (status === "InProgress") return "进行中";
  if (status === "Completed") return "已完成";
  if (status === "Failed") return "失败";
  return "未设置";
}
</script>

<template>
  <div
    class="story-node"
    :data-kind="node.kind"
    :class="{
      selected: !!selected || !!data.editorSelected,
      dimmed: !!data.dimmed,
      ghost: !!data.ghost,
      'node-exit': node.kind === 'npcExit' || node.kind === 'taskEnd',
      'node-entry': node.kind === 'npcEntry' || node.kind === 'questEntry',
    }"
    @contextmenu="onContextMenu"
  >
    <Handle :id="FLOW_TARGET_HANDLE_IN" type="target" :position="Position.Left" class="handle-in" />

    <div class="top">
      <span v-if="data.stepLabel" class="step-badge">{{ data.stepLabel }}</span>
      <span class="pill">{{ kindLabel }}</span>
      <span class="title">{{ node.title }}</span>
      <button
        v-if="showDelete"
        class="node-del"
        type="button"
        title="删除节点 (Del)"
        @pointerdown.stop
        @click.stop="onDeleteClick"
      >
        ×
      </button>
    </div>

    <div v-if="primaryMeta || preview" class="body">
      <div v-if="primaryMeta" class="meta">{{ primaryMeta }}</div>
      <div v-if="preview" class="preview">{{ preview }}</div>
    </div>

    <div v-if="node.options.length > 0" class="opts">
      <div v-for="opt in node.options" :key="opt.id" class="opt">
        <div class="opt-text">{{ opt.text }}</div>
        <Handle :id="opt.id" type="source" :position="Position.Right" class="handle-out" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-node {
  width: 240px;
  border-radius: 8px;
  background: #0b1220;
  border: 1px solid var(--border-strong);
  color: var(--fg-main);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
}
.story-node:hover {
  border-color: rgba(148, 163, 184, 0.4);
}
.story-node.node-entry {
  border-color: rgba(56, 189, 248, 0.4);
}
.story-node.node-exit {
  border-color: rgba(74, 222, 128, 0.35);
}
.story-node.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.5);
}
.story-node.dimmed {
  opacity: 0.35;
}
.story-node.ghost {
  opacity: 0.85;
  border-style: dashed;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.step-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 4px;
  padding: 1px 5px;
  font-variant-numeric: tabular-nums;
}
.node-del {
  margin-left: auto;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.node-del:hover {
  background: rgba(185, 28, 28, 0.55);
  border-color: rgba(252, 165, 165, 0.8);
}
.pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--bg-muted);
  color: #cbd5e1;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.story-node[data-kind="dialog"] .pill {
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.3);
}
.story-node[data-kind="choice"] .pill {
  background: rgba(167, 139, 250, 0.16);
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.35);
}
.story-node[data-kind="battle"] .pill {
  background: rgba(248, 113, 113, 0.14);
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.35);
}
.story-node[data-kind="questUpdate"] .pill {
  background: rgba(74, 222, 128, 0.12);
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.35);
}
.story-node[data-kind="condition"] .pill,
.story-node[data-kind="check"] .pill,
.story-node[data-kind="questCheck"] .pill {
  background: rgba(251, 191, 36, 0.12);
  color: #fde68a;
  border-color: rgba(251, 191, 36, 0.35);
}
.story-node[data-kind="npcEntry"] .pill,
.story-node[data-kind="questEntry"] .pill {
  background: rgba(56, 189, 248, 0.16);
  color: #bae6fd;
}
.story-node[data-kind="npcExit"] .pill,
.story-node[data-kind="taskEnd"] .pill {
  background: rgba(74, 222, 128, 0.14);
  color: #bbf7d0;
}
.title {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.body {
  padding: 8px 10px;
}
.meta {
  font-size: 12px;
  color: var(--fg-secondary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview {
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.35;
  max-height: 40px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.opts {
  padding: 6px 10px 10px;
  display: grid;
  gap: 6px;
}
.opt {
  position: relative;
  padding-right: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(148, 163, 184, 0.06);
  border-radius: 8px;
  padding: 6px 10px;
}
.opt-text {
  font-size: 12px;
  color: #c7d2fe;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.handle-in,
.handle-out {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(147, 197, 253, 0.9);
  background: rgba(14, 165, 233, 0.2);
}
.handle-out {
  right: -6px;
}
.handle-in {
  left: -6px;
}
</style>
