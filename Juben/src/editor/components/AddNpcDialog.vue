<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ResourceEntry } from "../../types";
import type { NpcChainPreset } from "../npc-chain-presets";
import { battleRefOptions } from "../client-runtime-manifest";
import { normalizeNpcPortraitPath } from "../npc-portrait-catalog";

const props = defineProps<{
  open: boolean;
  npcResources: ResourceEntry[];
  placedCountByResourceId: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "confirm",
    payload: { resourceId: string; prefabKey?: string; chainPreset: NpcChainPreset; battleRef?: string },
  ): void;
}>();

const selectedId = ref("");
const prefabKey = ref("");
const chainPreset = ref<NpcChainPreset>("empty");
const battleRef = ref("");

const available = computed(() => props.npcResources);
const manifestBattleRefs = computed(() => battleRefOptions());

const selectedResource = computed(() => available.value.find((r) => r.id === selectedId.value) ?? null);

const placementHint = computed(() => {
  const id = selectedId.value;
  if (!id) return "";
  const n = props.placedCountByResourceId[id] ?? 0;
  if (n === 0) return "尚未摆点";
  return `已在本地图摆点 ${n} 次，可再次摆点（新坐标/独立剧情链）`;
});

const chainPresetHint = computed(() => {
  if (chainPreset.value === "battleEncounter") {
    return "自动在本摆点生成任务链：接取 → 敌人出现(分支) → 战前选择 → 战斗 → 交任务。不另建战斗摆点。";
  }
  return "仅创建入口/结尾，中间节点自己拖（引导、选择、接任务等）。";
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selectedId.value = available.value[0]?.id ?? "";
    prefabKey.value = normalizeNpcPortraitPath(available.value[0]?.image) ?? "";
    chainPreset.value = "empty";
    battleRef.value = manifestBattleRefs.value[0]?.id ?? "";
  },
);

watch(selectedResource, (res) => {
  if (!props.open || prefabKey.value.trim()) return;
  const fromLib = normalizeNpcPortraitPath(res?.image);
  if (fromLib) prefabKey.value = fromLib;
});

function submit() {
  const id = selectedId.value.trim();
  if (!id) return;
  const path = normalizeNpcPortraitPath(selectedResource.value?.image) ?? prefabKey.value.trim();
  emit("confirm", {
    resourceId: id,
    prefabKey: path || undefined,
    chainPreset: chainPreset.value,
    battleRef: chainPreset.value === "battleEncounter" ? battleRef.value || undefined : undefined,
  });
}
</script>

<template>
  <div v-if="open" class="backdrop" @click="emit('close')">
    <div class="dialog" @click.stop>
      <h3>添加任务 / NPC</h3>
      <p class="hint">
        任务列表顺序 = 游戏里逐个出现。「战斗遭遇」在当前摆点生成完整任务链（含敌人出现分支、战前选择、战斗、交任务）。
      </p>

      <div v-if="available.length === 0" class="empty">资源库中尚无 NPC，请先到「资源 → NPC」添加。</div>

      <template v-else>
        <label class="field">
          <span>剧情链类型</span>
          <select v-model="chainPreset">
            <option value="empty">空白链（自己编）</option>
            <option value="battleEncounter">战斗遭遇（单链 + 分支：敌人出现/战前/战斗/交任务）</option>
          </select>
        </label>
        <p class="meta">{{ chainPresetHint }}</p>

        <label v-if="chainPreset === 'battleEncounter'" class="field">
          <span>战斗 battleRef</span>
          <select v-model="battleRef">
            <option v-for="x in manifestBattleRefs" :key="x.id" :value="x.id">{{ x.label }}</option>
          </select>
        </label>

        <label class="field">
          <span>NPC 资源</span>
          <select v-model="selectedId">
            <option v-for="r in available" :key="r.id" :value="r.id">
              {{ r.name }} ({{ r.id }}){{
                (placedCountByResourceId[r.id] ?? 0) > 0 ? ` · 已摆${placedCountByResourceId[r.id]}次` : ""
              }}
            </option>
          </select>
        </label>
        <p v-if="placementHint" class="meta">{{ placementHint }}</p>
        <p v-if="selectedResource?.image" class="meta">
          形象：继承资源库默认（{{ normalizeNpcPortraitPath(selectedResource.image) ?? selectedResource.image }}）
        </p>
        <p class="meta">添加后可在右侧属性或「资源 → NPC」中修改形象。</p>
      </template>

      <div class="actions">
        <button class="btn" type="button" @click="emit('close')">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!selectedId" @click="submit">添加</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(2, 6, 23, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  width: min(440px, 92vw);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #0f172a;
}
.hint,
.meta,
.empty {
  font-size: 12px;
  color: #94a3b8;
  margin: 8px 0;
}
.field {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
}
.field span {
  font-size: 12px;
  color: #cbd5e1;
}
.field input,
.field select {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #020617;
  color: #e2e8f0;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: rgba(2, 6, 23, 0.3);
  color: #e2e8f0;
  cursor: pointer;
}
.btn-primary {
  border-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.2);
}
</style>
