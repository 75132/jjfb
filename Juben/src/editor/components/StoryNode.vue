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
  return node.value.text || "";
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

    <div class="body">
      <div v-if="node.kind === 'battle'" class="meta">
        敌人：{{ node.enemyIds && node.enemyIds.length ? node.enemyIds.join(" | ") : "（未填）" }}
      </div>
      <div v-if="node.kind === 'battle' && node.battleConfigId" class="meta">战斗配置：{{ node.battleConfigId }}</div>
      <div v-if="node.dropTableId" class="meta">掉落表：{{ node.dropTableId }}</div>
      <div v-if="node.kind === 'gainItem'" class="meta">
        + {{ node.itemId || "（未填）" }} × {{ node.itemCount ?? 1 }}
      </div>
      <div v-if="node.kind === 'loseItem'" class="meta">
        - {{ node.itemId || "（未填）" }} × {{ node.itemCount ?? 1 }}
      </div>
      <div v-if="node.kind === 'setVar'" class="meta">
        set {{ node.varId || "（未选）" }} = {{ String(node.varValue ?? "") }}
      </div>
      <div v-if="node.kind === 'questUpdate'" class="meta">
        任务 {{ node.questId || "（未选）" }} → {{ questStatusLabel(node.questStatus) }}
      </div>
      <div v-if="node.kind === 'action'" class="meta">动作：{{ node.actions?.length ?? 0 }} 条</div>
      <div v-if="node.kind === 'check'" class="meta">
        检查：{{ node.checkMode || "ALL" }} / {{ node.checks?.length ?? 0 }} 条
      </div>
      <div v-if="node.kind === 'callQuest'" class="meta">
        start targets：{{
          (node.callQuestTargets?.length ?? 0) > 0 ? `${node.callQuestTargets?.length} 个` : "（未选）"
        }}
      </div>
      <div v-if="node.kind === 'questCheck'" class="meta">
        {{ node.conditionMode || "ALL" }}：{{ node.requirements?.length ?? 0 }} 条任务条件
      </div>
      <div v-if="node.kind === 'condition'" class="meta">
        {{ node.conditionMode || "ALL" }}：{{ node.requirements?.length ?? 0 }} 条
      </div>
      <div v-if="node.kind === 'questEntry'" class="meta">
        接入状态：{{ data.entryLinked ? `已连接（${data.entryLinkCount || 0}）` : "未连接" }}
      </div>
      <div v-if="node.kind === 'npcEntry'" class="meta">
        接入状态：{{ data.entryLinked ? `已连接（${data.entryLinkCount || 0}）` : "未连接" }}
        <span v-if="data.appearLabel"> · {{ data.appearLabel }}</span>
        <span v-if="node.npcId"> · NPC：{{ node.npcId }}</span>
        <span v-else-if="node.characterId"> · 形象：{{ node.characterId }}</span>
      </div>
      <div v-if="node.kind === 'taskEnd'" class="meta">
        结束状态：{{ questStatusLabel(node.questStatus || "Completed") }}
      </div>
      <div v-if="node.kind === 'npcExit'" class="meta">
        接入：{{ data.entryLinked ? `已连接（${data.entryLinkCount || 0}）` : "未连接" }}
        <span v-if="node.npcUid"> · {{ node.npcUid }}</span>
      </div>
      <div v-if="node.kind === 'npcExit'" class="meta">结束后：{{ node.hideNpcOnEnd ? "隐藏 NPC" : "保持显示" }}</div>
      <div v-if="node.mapId" class="meta">地图：{{ node.mapId }}</div>
      <div v-if="node.characterId" class="meta">
        角色：{{ node.characterId }} @ ({{ node.characterX ?? 0 }}, {{ node.characterY ?? 0 }})
      </div>
      <div v-if="node.npcId" class="meta">NPC：{{ node.npcId }}</div>
      <div v-if="node.petId" class="meta">宠物：{{ node.petId }}</div>
      <div v-if="node.skillId" class="meta">技能：{{ node.skillId }}</div>
      <div v-if="node.areaId" class="meta">区域：{{ node.areaId }}</div>
      <div v-if="preview" class="preview">{{ preview }}</div>
      <div v-else class="preview empty">（空）</div>
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
  width: 260px;
  border-radius: var(--radius-md);
  background: #0b1220;
  border: 1px solid var(--border-strong);
  color: var(--fg-main);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
.story-node.node-entry {
  border-color: rgba(56, 189, 248, 0.45);
}
.story-node.node-exit {
  border-color: rgba(74, 222, 128, 0.4);
}
.story-node.selected {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px #0ea5e9,
    0 10px 30px rgba(0, 0, 0, 0.25);
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
}
.preview {
  font-size: 13px;
  color: #e5e7eb;
  line-height: 1.35;
  max-height: 54px;
  overflow: hidden;
}
.preview.empty {
  color: var(--fg-tertiary);
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
