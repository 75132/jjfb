<script setup lang="ts">
import { computed, inject, ref } from "vue";
import type { GameMapDef, GraphData, NodeKind, ProjectData, StoryNode } from "../../types";
import { getOptionTargets } from "../../types";
import { collectNpcEventChain } from "../map-export";
import { getTimelineGraph } from "../map-tree";
import { primaryCatalogEntries } from "../node-catalog";
import { taskLabelForNpc } from "../game-map-logic";
import { isBattleEnemyMapNpc, isBattleOnlyNpc } from "../battle-npc-utils";
import {
  listNpcUidsUnlockedByEvent,
  resolveChainCompleteEventId,
  setUnlockTargetsAfterChainComplete,
} from "../npc-appear";
import { AI_ASSISTANT_KEY } from "../editorInjection";

const props = defineProps<{
  project: ProjectData;
  graph: GraphData;
  gameMap: GameMapDef | null;
  focusedNpcUid: string | null;
  selectedNodeId: string | null;
}>();

const emit = defineEmits<{
  (e: "selectNode", nodeId: string): void;
  (e: "addNode", kind: NodeKind): void;
  (e: "insertAfter", payload: { afterNodeId: string; kind: NodeKind }): void;
  (e: "deleteNode", nodeId: string): void;
  (e: "enterMap", gameMapId: string): void;
  (e: "focusNpc", npcUid: string): void;
  (e: "addGlobalQuest"): void;
  (e: "unlockTargetsChanged"): void;
}>();

const aiBridge = inject(AI_ASSISTANT_KEY, null);
const aiMenuOpen = ref(false);

const isTimeline = computed(() => props.graph.kind === "timeline");

const timelinePortals = computed(() => {
  const tl = getTimelineGraph(props.project);
  return tl?.nodes.filter((n) => n.kind === "mapPortal") ?? [];
});

const focusedNpc = computed(() => {
  if (!props.gameMap || !props.focusedNpcUid) return null;
  return props.gameMap.npcs.find((n) => n.npcUid === props.focusedNpcUid) ?? null;
});

const chainSteps = computed(() => {
  const npc = focusedNpc.value;
  if (!npc?.entryNodeId) return [] as StoryNode[];
  return collectNpcEventChain(props.graph, npc.entryNodeId);
});

const insertKinds = computed(() => primaryCatalogEntries(props.graph.kind).slice(0, 6));

const focusedNpcIndex = computed(() => {
  if (!props.gameMap || !focusedNpc.value) return -1;
  return props.gameMap.npcs.indexOf(focusedNpc.value);
});

const taskTitle = computed(() => {
  const npc = focusedNpc.value;
  if (!npc || !props.gameMap) return "";
  const idx = props.gameMap.npcs.indexOf(npc);
  return taskLabelForNpc(props.project, props.gameMap, npc, idx);
});

const completeEventId = computed(() => {
  if (!props.gameMap || !focusedNpc.value) return null;
  return resolveChainCompleteEventId(props.project, props.gameMap, focusedNpc.value);
});

const unlockCandidateNpcs = computed(() => {
  if (!props.gameMap || !props.focusedNpcUid) return [];
  return props.gameMap.npcs
    .map((npc, idx) => ({ npc, idx }))
    .filter(({ npc }) => {
      if (npc.npcUid === props.focusedNpcUid) return false;
      if (isBattleEnemyMapNpc(npc) || isBattleOnlyNpc(npc, props.graph)) return false;
      return true;
    });
});

const unlockedNpcUids = computed(() => {
  if (!props.gameMap || !completeEventId.value) return [] as string[];
  return listNpcUidsUnlockedByEvent(props.gameMap, completeEventId.value);
});

function isUnlockSelected(npcUid: string): boolean {
  return unlockedNpcUids.value.includes(npcUid);
}

function toggleUnlockTarget(npcUid: string) {
  if (!props.gameMap || !props.focusedNpcUid || !completeEventId.value) return;
  const next = new Set(unlockedNpcUids.value);
  if (next.has(npcUid)) next.delete(npcUid);
  else next.add(npcUid);
  setUnlockTargetsAfterChainComplete(props.project, props.gameMap, props.focusedNpcUid, [...next]);
  emit("unlockTargetsChanged");
}

function kindBadge(kind: string): string {
  const map: Record<string, string> = {
    dialog: "对话",
    choice: "选择",
    battle: "战斗",
    questUpdate: "任务",
    gainItem: "获得",
    loseItem: "失去",
    condition: "条件",
    action: "动作",
    check: "检查",
    setVar: "变量",
    callQuest: "跳转",
    mapPortal: "章节",
  };
  return map[kind] ?? kind;
}

function previewText(node: StoryNode): string {
  if (node.kind === "dialog") {
    const line = node.dialogLines?.[0]?.text || node.text || "";
    return line.slice(0, 80) || "（无对白）";
  }
  if (node.kind === "choice") {
    const opts = (node.options ?? []).map((o) => o.text || "选项").join(" / ");
    return opts.slice(0, 80) || "（无选项）";
  }
  if (node.kind === "battle") return node.battleConfigId || node.title || "战斗";
  return node.text?.slice(0, 80) || node.title || "";
}

function choiceBranches(node: StoryNode): Array<{ text: string; targetTitle: string }> {
  if (node.kind !== "choice") return [];
  return (node.options ?? []).map((opt) => {
    const tid = getOptionTargets(opt)[0];
    const target = tid ? props.graph.nodes.find((n) => n.id === tid) : null;
    return {
      text: opt.text || "选项",
      targetTitle: target ? `${kindBadge(target.kind)} · ${target.title || target.id}` : "（未连接）",
    };
  });
}

function onInsert(kind: NodeKind) {
  const afterId = props.selectedNodeId || focusedNpc.value?.entryNodeId;
  if (afterId) {
    emit("insertAfter", { afterNodeId: afterId, kind });
    return;
  }
  emit("addNode", kind);
}

function candidateLabel(npc: import("../../types").GameMapNpcDef, idx: number): string {
  if (!props.gameMap) return npc.npcName || npc.npcUid;
  return taskLabelForNpc(props.project, props.gameMap, npc, idx);
}

function runAiPolishChain() {
  if (!focusedNpc.value || focusedNpcIndex.value < 0) return;
  aiBridge?.runCommand(
    `用传统 RPG 水准润色任务链「${taskTitle.value}」：改掉任务板式对白，写出角色脾气与信息差；可改短标题，保留任务结构`,
    { npcUid: focusedNpc.value.npcUid },
  );
  aiMenuOpen.value = false;
}

function runAiAfterStep(node: StoryNode, mode: "dialog" | "choice" | "side") {
  if (!focusedNpc.value) return;
  const prompts = {
    dialog: `在步骤「${node.title || node.id}」后追加有人味的 RPG 对白（禁止任务板说明），再回到主线`,
    choice: `在步骤「${node.title || node.id}」后加选择分支（态度/代价分流），保留主线可完成`,
    side: `在步骤「${node.title || node.id}」后加一小段支线，再汇回主线`,
  } as const;
  aiBridge?.runCommand(prompts[mode], {
    npcUid: focusedNpc.value.npcUid,
    nodeIds: [node.id],
  });
}

function runAiRewriteStep(node: StoryNode) {
  if (!focusedNpc.value) return;
  aiBridge?.runCommand(
    `只改写步骤「${node.title || node.id}」的对白/选项：达到传统 RPG 水准，禁止任务板口吻，保留节点 kind 与连线`,
    { npcUid: focusedNpc.value.npcUid, nodeIds: [node.id] },
  );
}
</script>

<template>
  <section class="story-ops" @wheel.stop>
    <!-- 时间线：章节操作 -->
    <template v-if="isTimeline">
      <header class="ops-head">
        <div>
          <h2 class="ops-title">剧情操作面板 · 时间线</h2>
          <p class="ops-sub">管理大剧情章节。进入地图后在此编辑任务链步骤；摆点请切到「摆点」工作台。</p>
        </div>
        <button class="btn btn-primary" type="button" @click="emit('addGlobalQuest')">+ 新建章节</button>
      </header>
      <div v-if="timelinePortals.length === 0" class="empty-box">
        <div class="empty-title">还没有章节</div>
        <div class="empty-desc">创建章节后，由 AI 或手动进入地图写任务链。</div>
      </div>
      <div v-else class="chapter-grid">
        <button
          v-for="(portal, idx) in timelinePortals"
          :key="portal.id"
          type="button"
          class="chapter-tile"
          :class="{ active: selectedNodeId === portal.id }"
          @click="emit('selectNode', portal.id)"
          @dblclick="portal.gameMapId && emit('enterMap', portal.gameMapId)"
        >
          <div class="tile-meta">第 {{ idx + 1 }} 章</div>
          <div class="tile-title">{{ portal.title || "未命名章节" }}</div>
          <div class="tile-actions">
            <span class="muted-small">双击进入地图</span>
            <span
              v-if="portal.gameMapId"
              class="linkish"
              @click.stop="emit('enterMap', portal.gameMapId!)"
            >进入</span>
          </div>
        </button>
      </div>
    </template>

    <!-- 地图剧情：任务链步骤 -->
    <template v-else>
      <header class="ops-head">
        <div class="ops-head-text">
          <div class="ops-kicker">写作区</div>
          <h2 class="ops-title">{{ focusedNpc ? taskTitle : "选择一条任务开始" }}</h2>
        </div>
        <div v-if="focusedNpc && aiBridge" class="ops-ai">
          <button class="btn btn-ai" type="button" @click="runAiPolishChain">AI 润色</button>
          <button class="btn btn-soft btn-sm" type="button" @click="aiMenuOpen = !aiMenuOpen">更多 ▾</button>
          <div v-if="aiMenuOpen" class="ops-ai-menu">
            <button type="button" @click="(aiBridge?.runCommand(`在任务链「${taskTitle}」后追加有人味对话`, { npcUid: focusedNpc.npcUid }), (aiMenuOpen = false))">
              补对话
            </button>
            <button type="button" @click="(aiBridge?.runCommand(`在任务链「${taskTitle}」加选择分支（态度分流）`, { npcUid: focusedNpc.npcUid }), (aiMenuOpen = false))">
              加选择
            </button>
            <button type="button" @click="(aiBridge?.runCommand(`在任务链「${taskTitle}」补战前戏与战斗`, { npcUid: focusedNpc.npcUid }), (aiMenuOpen = false))">
              补战斗
            </button>
          </div>
        </div>
      </header>

      <div v-if="!focusedNpc" class="npc-pick">
        <div v-if="!gameMap?.npcs?.length" class="empty-box">
          <div class="empty-title">暂无任务链</div>
          <div class="empty-desc">在左侧点「+ 新建」，或用 AI 助手生成整条剧情。</div>
        </div>
        <button
          v-for="(npc, idx) in gameMap?.npcs ?? []"
          :key="npc.npcUid"
          type="button"
          class="npc-pick-card"
          @click="emit('focusNpc', npc.npcUid)"
        >
          <span class="npc-idx">#{{ idx + 1 }}</span>
          <span>{{ taskLabelForNpc(project, gameMap!, npc, idx) }}</span>
        </button>
      </div>

      <template v-else>
        <div class="insert-row">
          <span class="insert-label">插入</span>
          <button
            v-for="entry in insertKinds"
            :key="entry.kind"
            type="button"
            class="btn btn-soft btn-sm insert-chip"
            :title="entry.summary"
            @click="onInsert(entry.kind)"
          >
            + {{ entry.label }}
          </button>
        </div>

        <div v-if="chainSteps.length === 0" class="empty-box">
          <div class="empty-title">链上还没有步骤</div>
          <div class="empty-desc">用上方按钮插入对话/选择等，或打开 AI 助手生成。</div>
        </div>

        <ol class="step-list">
          <li
            v-for="(node, idx) in chainSteps"
            :key="node.id"
            class="step-card"
            :class="{ active: selectedNodeId === node.id }"
            @click="emit('selectNode', node.id)"
          >
            <div class="step-head">
              <span class="step-num">{{ idx + 1 }}</span>
              <span class="kind-pill" :class="node.kind">{{ kindBadge(node.kind) }}</span>
              <span class="step-title">{{ node.title || "未命名" }}</span>
              <div class="step-actions" @click.stop>
                <button
                  v-if="aiBridge && (node.kind === 'dialog' || node.kind === 'choice')"
                  type="button"
                  class="btn btn-ai-mini step-action"
                  title="AI 改写本步"
                  @click="runAiRewriteStep(node)"
                >
                  AI
                </button>
                <button
                  v-if="aiBridge"
                  type="button"
                  class="btn btn-mini step-action"
                  title="AI 在此步后加内容"
                  @click="runAiAfterStep(node, 'side')"
                >
                  +
                </button>
                <button
                  type="button"
                  class="btn btn-del btn-mini"
                  title="删除此步骤"
                  @click="emit('deleteNode', node.id)"
                >
                  ×
                </button>
              </div>
            </div>
            <div class="step-preview">{{ previewText(node) }}</div>
            <ul v-if="choiceBranches(node).length" class="branch-list">
              <li v-for="(b, bi) in choiceBranches(node)" :key="bi">
                <span class="branch-opt">{{ b.text }}</span>
                <span class="branch-arrow">→</span>
                <span class="branch-target">{{ b.targetTitle }}</span>
              </li>
            </ul>
          </li>
        </ol>

        <section class="unlock-panel">
          <details class="unlock-details">
            <summary class="unlock-summary">完成后开启</summary>
            <p class="unlock-hint">本链结束后，勾选下一条要出现的任务。</p>
            <div v-if="!completeEventId" class="unlock-empty">还没有完成信号，先加对话或任务进度。</div>
            <div v-else-if="unlockCandidateNpcs.length === 0" class="unlock-empty">没有其他可选任务。</div>
            <div v-else class="unlock-list">
              <label
                v-for="{ npc, idx } in unlockCandidateNpcs"
                :key="npc.npcUid"
                class="unlock-item"
                :class="{ on: isUnlockSelected(npc.npcUid) }"
              >
                <input
                  type="checkbox"
                  :checked="isUnlockSelected(npc.npcUid)"
                  @change="toggleUnlockTarget(npc.npcUid)"
                />
                <span class="unlock-idx">#{{ idx + 1 }}</span>
                <span class="unlock-name">{{ candidateLabel(npc, idx) }}</span>
              </label>
            </div>
          </details>
        </section>
      </template>
    </template>
  </section>
</template>

<style scoped>
.story-ops {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 20px 22px 32px;
  background:
    radial-gradient(1200px 400px at 10% -10%, rgba(94, 200, 240, 0.06), transparent 55%),
    var(--bg-panel);
  scrollbar-gutter: stable;
}
.ops-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 4px 0 12px;
  background: linear-gradient(180deg, var(--bg-panel) 70%, transparent);
}
.ops-kicker {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
  margin-bottom: 4px;
}
.ops-title {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: 0.01em;
  color: var(--fg-main);
  line-height: 1.25;
}
.ops-ai {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  flex-shrink: 0;
  margin-top: 4px;
}
.ops-ai-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 8;
  min-width: 120px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-default, #2a3a52);
  background: rgba(15, 23, 42, 0.98);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ops-ai-menu button {
  text-align: left;
  border: none;
  background: transparent;
  color: var(--fg-main, #e8eef7);
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.ops-ai-menu button:hover {
  background: rgba(56, 189, 248, 0.12);
}
.ops-sub {
  display: none;
}
.insert-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  position: sticky;
  top: 56px;
  z-index: 3;
  backdrop-filter: blur(8px);
}
.insert-label {
  font-size: 11px;
  font-weight: 650;
  color: var(--fg-tertiary);
  margin-right: 4px;
}
.insert-chip {
  border-radius: 999px;
}
.step-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
}
.step-card {
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}
.step-card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.step-card:hover .step-action {
  opacity: 1;
}
.step-card.active {
  border-color: rgba(94, 200, 240, 0.45);
  background: linear-gradient(180deg, rgba(94, 200, 240, 0.1), var(--bg-elevated));
  box-shadow: 0 0 0 1px rgba(94, 200, 240, 0.12);
}
.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.step-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.step-action {
  opacity: 0.35;
  transition: opacity 0.12s ease;
}
.step-card.active .step-action,
.step-actions:focus-within .step-action {
  opacity: 1;
}
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
  background: var(--accent-soft);
  color: #9adcf5;
}
.step-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-main);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-preview {
  font-size: 14px;
  line-height: 1.65;
  color: var(--fg-secondary);
  white-space: pre-wrap;
}
.unlock-panel {
  margin-top: 22px;
  max-width: 720px;
}
.unlock-details {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  padding: 0;
}
.unlock-summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 650;
  color: var(--fg-secondary);
}
.unlock-summary::-webkit-details-marker {
  display: none;
}
.unlock-details[open] .unlock-summary {
  border-bottom: 1px solid var(--border-default);
  color: var(--fg-main);
}
.unlock-details .unlock-hint,
.unlock-details .unlock-empty,
.unlock-details .unlock-list {
  margin: 10px 12px 12px;
}
.empty-box {
  padding: 28px 16px;
  text-align: center;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.4);
}
.empty-title {
  font-size: 14px;
  color: #e8eef7;
  margin-bottom: 6px;
}
.empty-desc {
  font-size: 12px;
  color: #7b8ba0;
}
.chapter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.chapter-tile {
  text-align: left;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default, #2a3a52);
  background: rgba(15, 23, 42, 0.55);
  color: inherit;
  cursor: pointer;
}
.chapter-tile:hover,
.chapter-tile.active {
  border-color: var(--accent, #38bdf8);
  background: rgba(14, 165, 233, 0.1);
}
.tile-meta {
  font-size: 11px;
  color: #38bdf8;
  font-weight: 650;
  margin-bottom: 6px;
}
.tile-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 10px;
}
.tile-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.linkish {
  color: #38bdf8;
  font-size: 12px;
}
.npc-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.npc-pick-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-default, #2a3a52);
  background: rgba(15, 23, 42, 0.45);
  color: #e8eef7;
  cursor: pointer;
  text-align: left;
}
.npc-pick-card:hover {
  border-color: rgba(56, 189, 248, 0.4);
}
.npc-idx {
  font-size: 11px;
  color: var(--fg-tertiary);
  min-width: 28px;
}
.branch-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}
.branch-list li {
  font-size: 12px;
  color: var(--fg-tertiary);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}
.branch-opt {
  color: #c7d2fe;
  font-weight: 650;
}
.branch-arrow {
  opacity: 0.55;
}
.branch-target {
  color: var(--fg-secondary);
}
.unlock-hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--fg-tertiary);
}
.unlock-empty {
  font-size: 12px;
  color: var(--fg-tertiary);
  padding: 4px 0;
}
.unlock-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.unlock-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  cursor: pointer;
  font-size: 12px;
  color: var(--fg-main);
}
.unlock-item.on {
  border-color: rgba(94, 200, 240, 0.4);
  background: var(--accent-soft);
}
.unlock-item input {
  width: 14px;
  height: 14px;
  margin: 0;
}
.unlock-idx {
  font-size: 10px;
  color: var(--fg-tertiary);
  min-width: 28px;
}
.unlock-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
