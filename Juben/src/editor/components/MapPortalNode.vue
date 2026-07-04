<script setup lang="ts">
import { computed, inject } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { FLOW_TARGET_HANDLE_IN, type StoryNodeData } from "../adapters";
import { STORY_EDITOR_ACTIONS_KEY } from "../editorInjection";
import type { ProjectData } from "../../types";
import { findGameMapById } from "../game-map-logic";
import { countChildMaps } from "../map-tree";

const props = defineProps<{
  id: string;
  data: StoryNodeData;
  selected?: boolean;
}>();

const project = inject<{ value: ProjectData }>("storyProject", null);
const editorActions = inject(STORY_EDITOR_ACTIONS_KEY, null);

const node = computed(() => props.data.storyNode);
const gameMap = computed(() => {
  const gid = node.value.gameMapId;
  if (!gid || !project?.value) return null;
  return findGameMapById(project.value, gid);
});

const childCount = computed(() => {
  if (!project?.value || !gameMap.value) return 0;
  return countChildMaps(project.value, gameMap.value.id);
});

function onDblClick(e: MouseEvent) {
  e.stopPropagation();
  editorActions?.drillDownMapPortal?.(props.id);
}
</script>

<template>
  <div class="portal-node" :class="{ selected: !!selected || !!data.editorSelected }" @dblclick="onDblClick">
    <Handle :id="FLOW_TARGET_HANDLE_IN" type="target" :position="Position.Left" class="handle-in" />
    <div class="portal-badge">大剧情</div>
    <div class="portal-title">{{ node.title || "未命名" }}</div>
    <div v-if="gameMap" class="portal-meta">
      <span>{{ gameMap.mapCode }}</span>
      <span v-if="node.portalTaskId">taskId={{ node.portalTaskId }}</span>
    </div>
    <div v-if="childCount > 0" class="portal-sub">子地图 {{ childCount }}</div>
    <div v-if="!gameMap" class="portal-warn">未绑定地图</div>
    <div class="portal-hint">拖拽右侧圆点连线 · 双击进入地图</div>
    <div v-if="node.options.length > 0" class="opts">
      <div v-for="opt in node.options" :key="opt.id" class="opt">
        <div class="opt-text">{{ opt.text }}</div>
        <Handle :id="opt.id" type="source" :position="Position.Right" class="handle-out" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal-node {
  min-width: 200px;
  max-width: 280px;
  padding: 12px 14px 8px;
  border-radius: 12px;
  border: 2px solid rgba(56, 189, 248, 0.45);
  background: linear-gradient(145deg, rgba(14, 165, 233, 0.15), rgba(2, 6, 23, 0.85));
  color: #e2e8f0;
  cursor: grab;
  box-shadow: 0 4px 20px rgba(14, 165, 233, 0.12);
  position: relative;
}
.portal-node.selected {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35);
}
.portal-badge {
  font-size: 10px;
  color: #38bdf8;
  margin-bottom: 4px;
}
.portal-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.portal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.portal-sub {
  font-size: 11px;
  color: #a5b4fc;
  margin-top: 4px;
}
.portal-warn {
  font-size: 11px;
  color: #f87171;
  margin-top: 4px;
}
.portal-hint {
  font-size: 10px;
  color: #64748b;
  margin-top: 8px;
  margin-bottom: 4px;
}
.opts {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.opt {
  position: relative;
  padding: 4px 28px 4px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.08);
  font-size: 11px;
}
.opt-text {
  color: #cbd5e1;
}
.handle-in,
.handle-out {
  width: 10px;
  height: 10px;
  background: #38bdf8;
  border: 2px solid #0ea5e9;
}
</style>
