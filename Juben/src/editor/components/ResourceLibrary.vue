<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  CharacterAsset,
  GraphKind,
  ProjectData,
  QuestDef,
  ResourceEntry,
  ResourceKind,
  VarType,
  VariableDef,
} from "../../types";
import { appConfirm } from "../useModal";
import NpcPortraitPicker from "./NpcPortraitPicker.vue";
import { normalizeNpcPortraitPath } from "../npc-portrait-catalog";

type ItemUsage = { id: string; count: number };

const props = defineProps<{
  project: ProjectData;
  selectedGraphId: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "addCharacterAsset"): void;
  (e: "deleteCharacterAsset", id: string): void;
  (e: "patchCharacterAsset", payload: { id: string; patch: Partial<CharacterAsset> }): void;
  (e: "renameCharacterAssetId", payload: { oldId: string; newId: string }): void;
  (e: "addVariable"): void;
  (e: "deleteVariable", id: string): void;
  (e: "patchVariable", payload: { id: string; patch: Partial<VariableDef> }): void;
  (e: "renameVariableId", payload: { oldId: string; newId: string }): void;
  (e: "renameItemId", payload: { oldId: string; newId: string }): void;
  (e: "createQuestGraph"): void;
  (e: "patchQuest", payload: { id: string; patch: Partial<QuestDef> }): void;
  (e: "selectGraph", id: string): void;
  (e: "addResource", payload: { kind: ResourceKind }): void;
  (e: "deleteResource", payload: { kind: ResourceKind; id: string }): void;
  (e: "patchResource", payload: { kind: ResourceKind; id: string; patch: Partial<ResourceEntry> }): void;
  (e: "renameResourceId", payload: { kind: ResourceKind; oldId: string; newId: string }): void;
}>();

const tab = ref<
  | "character"
  | "variable"
  | "item"
  | "quest"
  | "npc"
  | "pet"
  | "skill"
  | "itemDict"
  | "dropTable"
  | "battleConfig"
  | "area"
>("character");
const editingCharacterId = ref<string | null>(null);
const characterIdDraft = ref("");
const editingVariableId = ref<string | null>(null);
const variableIdDraft = ref("");
const itemRenameDraft = ref<Record<string, string>>({});
const search = ref("");
const onlyUnused = ref(false);
const editingResourceKey = ref<string | null>(null);
const resourceIdDraft = ref("");

const characterAssets = computed(() => props.project.characterAssets ?? []);
const variables = computed(() => props.project.variables);
const quests = computed(() => props.project.quests);
const graphById = computed(() => new Map(props.project.graphs.map((g) => [g.id, g] as const)));
const resources = computed(() => props.project.resources ?? {});
const resourceKinds: Array<{ kind: ResourceKind; label: string; tab: typeof tab.value }> = [
  { kind: "npc", label: "NPC", tab: "npc" },
  { kind: "pet", label: "宠物", tab: "pet" },
  { kind: "skill", label: "技能", tab: "skill" },
  { kind: "item", label: "道具", tab: "itemDict" },
  { kind: "dropTable", label: "掉落表", tab: "dropTable" },
  { kind: "battleConfig", label: "战斗配置", tab: "battleConfig" },
  { kind: "area", label: "地图/区域", tab: "area" },
];

function resourcesOf(kind: ResourceKind): ResourceEntry[] {
  return (resources.value as any)?.[kind] ?? [];
}

function resourceUsageCount(kind: ResourceKind) {
  const out = new Map<string, number>();
  const bump = (id: string | undefined) => {
    const k = String(id ?? "").trim();
    if (!k) return;
    out.set(k, (out.get(k) ?? 0) + 1);
  };
  for (const g of props.project.graphs) {
    for (const n of g.nodes) {
      if (kind === "npc") bump(n.npcId);
      if (kind === "pet") bump(n.petId);
      if (kind === "skill") bump(n.skillId);
      if (kind === "item") bump(n.itemId);
      if (kind === "dropTable") bump(n.dropTableId);
      if (kind === "battleConfig") bump(n.battleConfigId);
      if (kind === "area") bump(n.areaId);

      if (kind === "item" && (n.kind === "action" || Array.isArray(n.actions))) {
        for (const a of n.actions ?? []) {
          if (a.kind === "giveItem" || a.kind === "takeItem") bump(a.itemId);
        }
      }
      if (kind === "pet" && (n.kind === "action" || Array.isArray(n.actions))) {
        for (const a of n.actions ?? []) {
          if (a.kind === "givePet") bump(a.petId);
        }
      }
      if (kind === "battleConfig" && (n.kind === "action" || Array.isArray(n.actions))) {
        for (const a of n.actions ?? []) {
          if (a.kind === "triggerBattle") bump(a.battleConfigId);
        }
      }
      if (kind === "area" && (n.kind === "action" || Array.isArray(n.actions))) {
        for (const a of n.actions ?? []) {
          if (a.kind === "teleport") bump(a.areaId);
        }
      }
      if (kind === "pet" && (n.kind === "check" || Array.isArray(n.checks))) {
        for (const c of n.checks ?? []) {
          if (c.kind === "hasPet") bump(c.petId);
        }
      }
    }
  }
  if (kind === "npc") {
    for (const gm of props.project.gameMaps ?? []) {
      for (const npc of gm.npcs) bump(npc.npcResourceId ?? npc.npcUid);
    }
  }
  return out;
}

const usageByKind = computed(() => {
  const map = new Map<ResourceKind, Map<string, number>>();
  for (const k of resourceKinds) map.set(k.kind, resourceUsageCount(k.kind));
  return map;
});

const filteredResources = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const kind =
    tab.value === "npc"
      ? "npc"
      : tab.value === "pet"
        ? "pet"
        : tab.value === "skill"
          ? "skill"
          : tab.value === "itemDict"
            ? "item"
            : tab.value === "dropTable"
              ? "dropTable"
              : tab.value === "battleConfig"
                ? "battleConfig"
                : tab.value === "area"
                  ? "area"
                  : null;
  if (!kind) return { kind: null as null, list: [] as ResourceEntry[], usage: new Map<string, number>() };
  const usage = usageByKind.value.get(kind) ?? new Map<string, number>();
  const list = resourcesOf(kind).filter((r) => {
    const byKeyword =
      !keyword ||
      r.id.toLowerCase().includes(keyword) ||
      String(r.name ?? "")
        .toLowerCase()
        .includes(keyword);
    const u = usage.get(r.id) ?? 0;
    return byKeyword && (!onlyUnused.value || u === 0);
  });
  list.sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  return { kind, list, usage };
});

function beginEditResourceId(kind: ResourceKind, id: string) {
  editingResourceKey.value = `${kind}:${id}`;
  resourceIdDraft.value = id;
}

function commitResourceIdRename(kind: ResourceKind, id: string) {
  if (editingResourceKey.value !== `${kind}:${id}`) return;
  const next = resourceIdDraft.value.trim();
  if (!next || next === id) {
    editingResourceKey.value = null;
    resourceIdDraft.value = "";
    return;
  }
  emit("renameResourceId", { kind, oldId: id, newId: next });
  editingResourceKey.value = null;
  resourceIdDraft.value = "";
}

function requestDeleteResource(kind: ResourceKind, id: string) {
  const usage = (usageByKind.value.get(kind)?.get(id) ?? 0) as number;
  void (async () => {
    if (usage > 0) {
      const ok = await appConfirm(`资源仍被 ${usage} 处引用，确认删除并清空这些引用吗？`, "删除资源");
      if (!ok) return;
    }
    emit("deleteResource", { kind, id });
  })();
}

function patchResourceField(kind: ResourceKind, id: string, field: "name" | "note" | "image", ev: Event) {
  const v = (ev.target as HTMLInputElement).value;
  emit("patchResource", { kind, id, patch: { [field]: v } });
}
const characterUsageCount = computed(() => {
  const out = new Map<string, number>();
  for (const g of props.project.graphs) {
    for (const n of g.nodes) {
      const id = String(n.characterId ?? "").trim();
      if (!id) continue;
      out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
});
const variableUsageCount = computed(() => {
  const out = new Map<string, number>();
  for (const g of props.project.graphs) {
    for (const n of g.nodes) {
      const directVar = String(n.varId ?? "").trim();
      if (directVar) out.set(directVar, (out.get(directVar) ?? 0) + 1);
      for (const r of n.requirements ?? []) {
        if (r.kind !== "varEquals") continue;
        out.set(r.varId, (out.get(r.varId) ?? 0) + 1);
      }
    }
  }
  return out;
});
const questUsageCount = computed(() => {
  const out = new Map<string, number>();
  for (const g of props.project.graphs) {
    for (const n of g.nodes) {
      const qid = String(n.questId ?? "").trim();
      if (qid) out.set(qid, (out.get(qid) ?? 0) + 1);
      for (const t of n.callQuestTargets ?? []) {
        const [kind, id] = t.split(":");
        if (kind !== "quest" || !id) continue;
        out.set(id, (out.get(id) ?? 0) + 1);
      }
      for (const r of n.requirements ?? []) {
        if (r.kind !== "questStatus") continue;
        out.set(r.questId, (out.get(r.questId) ?? 0) + 1);
      }
    }
  }
  return out;
});
const filteredCharacters = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const list = characterAssets.value.filter((a) => {
    const byKeyword = !keyword || a.id.toLowerCase().includes(keyword) || a.name.toLowerCase().includes(keyword);
    const usage = characterUsageCount.value.get(a.id) ?? 0;
    return byKeyword && (!onlyUnused.value || usage === 0);
  });
  return list.sort((a, b) => (characterUsageCount.value.get(b.id) ?? 0) - (characterUsageCount.value.get(a.id) ?? 0));
});
const filteredVariables = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const list = variables.value.filter((v) => {
    const byKeyword = !keyword || v.id.toLowerCase().includes(keyword) || v.name.toLowerCase().includes(keyword);
    const usage = variableUsageCount.value.get(v.id) ?? 0;
    return byKeyword && (!onlyUnused.value || usage === 0);
  });
  return list.sort((a, b) => (variableUsageCount.value.get(b.id) ?? 0) - (variableUsageCount.value.get(a.id) ?? 0));
});
const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return itemUsages.value.filter((x) => {
    const byKeyword = !keyword || x.id.toLowerCase().includes(keyword);
    return byKeyword && (!onlyUnused.value || x.count === 0);
  });
});
const filteredQuests = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const list = quests.value.filter((q) => {
    const byKeyword = !keyword || q.id.toLowerCase().includes(keyword) || q.name.toLowerCase().includes(keyword);
    const usage = questUsageCount.value.get(q.id) ?? 0;
    return byKeyword && (!onlyUnused.value || usage === 0);
  });
  return list.sort((a, b) => (questUsageCount.value.get(b.id) ?? 0) - (questUsageCount.value.get(a.id) ?? 0));
});

const itemUsages = computed<ItemUsage[]>(() => {
  const counts = new Map<string, number>();
  for (const g of props.project.graphs) {
    for (const n of g.nodes) {
      const itemId = String(n.itemId ?? "").trim();
      if (!itemId) continue;
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
});

function beginEditCharacterId(assetId: string) {
  editingCharacterId.value = assetId;
  characterIdDraft.value = assetId;
}

function commitCharacterIdRename(assetId: string) {
  if (editingCharacterId.value !== assetId) return;
  const next = characterIdDraft.value.trim();
  if (!next || next === assetId) {
    editingCharacterId.value = null;
    characterIdDraft.value = "";
    return;
  }
  emit("renameCharacterAssetId", { oldId: assetId, newId: next });
  editingCharacterId.value = null;
  characterIdDraft.value = "";
}

function beginEditVariableId(varId: string) {
  editingVariableId.value = varId;
  variableIdDraft.value = varId;
}

function commitVariableIdRename(varId: string) {
  if (editingVariableId.value !== varId) return;
  const next = variableIdDraft.value.trim();
  if (!next || next === varId) {
    editingVariableId.value = null;
    variableIdDraft.value = "";
    return;
  }
  emit("renameVariableId", { oldId: varId, newId: next });
  editingVariableId.value = null;
  variableIdDraft.value = "";
}

function onVariableTypeChange(v: VariableDef, nextType: VarType) {
  let initialValue: boolean | number | string = false;
  if (nextType === "number") initialValue = 0;
  else if (nextType === "string") initialValue = "";
  emit("patchVariable", { id: v.id, patch: { type: nextType, initialValue } });
}

function renameItemEverywhere(oldId: string) {
  const nextId = String(itemRenameDraft.value[oldId] ?? "").trim();
  if (!nextId || nextId === oldId) return;
  emit("renameItemId", { oldId, newId: nextId });
  itemRenameDraft.value[oldId] = "";
}

function requestDeleteCharacter(assetId: string) {
  const usage = characterUsageCount.value.get(assetId) ?? 0;
  void (async () => {
    if (usage > 0) {
      const ok = await appConfirm(`角色仍被 ${usage} 个节点引用，确认删除并清空这些引用吗？`, "删除角色");
      if (!ok) return;
    }
    emit("deleteCharacterAsset", assetId);
  })();
}

function requestDeleteVariable(varId: string) {
  const usage = variableUsageCount.value.get(varId) ?? 0;
  void (async () => {
    if (usage > 0) {
      const ok = await appConfirm(`变量仍被 ${usage} 处逻辑引用，确认删除并清理这些引用吗？`, "删除变量");
      if (!ok) return;
    }
    emit("deleteVariable", varId);
  })();
}

function graphTypeLabel(kind: GraphKind) {
  if (kind === "mainline") return "主线";
  if (kind === "side") return "支线";
  return "任务";
}
</script>

<template>
  <section class="library">
    <div class="library-header">
      <div>
        <h2>资源库</h2>
        <div class="sub">集中管理可复用资源，避免在侧栏滚动查找。</div>
      </div>
      <button class="btn" @click="emit('close')">返回编辑器</button>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'character' }" @click="tab = 'character'">角色资产</button>
      <button class="tab" :class="{ active: tab === 'variable' }" @click="tab = 'variable'">变量</button>
      <button class="tab" :class="{ active: tab === 'item' }" @click="tab = 'item'">物品ID</button>
      <button class="tab" :class="{ active: tab === 'quest' }" @click="tab = 'quest'">任务</button>
      <button class="tab" :class="{ active: tab === 'npc' }" @click="tab = 'npc'">NPC</button>
      <button class="tab" :class="{ active: tab === 'pet' }" @click="tab = 'pet'">宠物</button>
      <button class="tab" :class="{ active: tab === 'skill' }" @click="tab = 'skill'">技能</button>
      <button class="tab" :class="{ active: tab === 'itemDict' }" @click="tab = 'itemDict'">道具</button>
      <button class="tab" :class="{ active: tab === 'dropTable' }" @click="tab = 'dropTable'">掉落表</button>
      <button class="tab" :class="{ active: tab === 'battleConfig' }" @click="tab = 'battleConfig'">战斗配置</button>
      <button class="tab" :class="{ active: tab === 'area' }" @click="tab = 'area'">地图/区域</button>
    </div>
    <div class="filters">
      <input v-model="search" placeholder="搜索当前分组资源（ID/名称）" />
      <label class="check">
        <input v-model="onlyUnused" type="checkbox" />
        仅看未使用
      </label>
    </div>

    <div v-if="tab === 'character'" class="pane">
      <div class="toolbar">
        <button class="btn btn-primary" @click="emit('addCharacterAsset')">+ 添加角色</button>
      </div>
      <div v-if="filteredCharacters.length === 0" class="empty">暂无匹配角色资产</div>
      <div v-for="a in filteredCharacters" :key="a.id" class="card">
        <label class="field">
          <span>ID</span>
          <input
            v-if="editingCharacterId === a.id"
            v-model="characterIdDraft"
            @blur="commitCharacterIdRename(a.id)"
            @change="commitCharacterIdRename(a.id)"
          />
          <input v-else :value="a.id" readonly @focus="beginEditCharacterId(a.id)" />
        </label>
        <label class="field">
          <span>名称</span>
          <input
            :value="a.name"
            @input="
              emit('patchCharacterAsset', { id: a.id, patch: { name: ($event.target as HTMLInputElement).value } })
            "
          />
        </label>
        <label class="field">
          <span>图像 URL/路径</span>
          <input
            :value="a.image ?? ''"
            @input="
              emit('patchCharacterAsset', { id: a.id, patch: { image: ($event.target as HTMLInputElement).value } })
            "
          />
        </label>
        <div class="usage">引用 {{ characterUsageCount.get(a.id) ?? 0 }} 处</div>
        <button class="btn btn-danger" @click="requestDeleteCharacter(a.id)">删除角色</button>
      </div>
    </div>

    <div v-else-if="tab === 'variable'" class="pane">
      <div class="toolbar">
        <button class="btn btn-primary" @click="emit('addVariable')">+ 添加变量</button>
      </div>
      <div v-if="filteredVariables.length === 0" class="empty">暂无匹配变量</div>
      <div v-for="v in filteredVariables" :key="v.id" class="card">
        <label class="field">
          <span>ID</span>
          <input
            v-if="editingVariableId === v.id"
            v-model="variableIdDraft"
            @blur="commitVariableIdRename(v.id)"
            @change="commitVariableIdRename(v.id)"
          />
          <input v-else :value="v.id" readonly @focus="beginEditVariableId(v.id)" />
        </label>
        <label class="field">
          <span>名称</span>
          <input
            :value="v.name"
            @input="emit('patchVariable', { id: v.id, patch: { name: ($event.target as HTMLInputElement).value } })"
          />
        </label>
        <div class="row">
          <label class="field mini">
            <span>类型</span>
            <select
              :value="v.type"
              @change="onVariableTypeChange(v, ($event.target as HTMLSelectElement).value as VarType)"
            >
              <option value="bool">bool</option>
              <option value="number">number</option>
              <option value="string">string</option>
            </select>
          </label>
          <label class="field mini">
            <span>初始值</span>
            <input
              :value="String(v.initialValue)"
              @change="
                emit('patchVariable', {
                  id: v.id,
                  patch: { initialValue: ($event.target as HTMLInputElement).value as any },
                })
              "
            />
          </label>
        </div>
        <div class="usage">引用 {{ variableUsageCount.get(v.id) ?? 0 }} 处</div>
        <button class="btn btn-danger" @click="requestDeleteVariable(v.id)">删除变量</button>
      </div>
    </div>

    <div v-else-if="tab === 'item'" class="pane">
      <div class="hint">当前项目里所有 `gainItem/loseItem` 节点出现过的 itemId。这里可全局重命名，节点会同步更新。</div>
      <div v-if="filteredItems.length === 0" class="empty">暂无匹配物品ID</div>
      <div v-for="x in filteredItems" :key="x.id" class="card">
        <div class="row row-top">
          <div class="item-id">{{ x.id }}</div>
          <div class="usage">使用 {{ x.count }} 次</div>
        </div>
        <div class="row">
          <input
            :value="itemRenameDraft[x.id] ?? ''"
            placeholder="新的 itemId"
            @input="itemRenameDraft[x.id] = ($event.target as HTMLInputElement).value"
          />
          <button class="btn" @click="renameItemEverywhere(x.id)">全局改名</button>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'quest'" class="pane">
      <div class="toolbar">
        <button class="btn btn-primary" @click="emit('createQuestGraph')">+ 新建任务画布</button>
      </div>
      <div v-if="filteredQuests.length === 0" class="empty">暂无匹配任务</div>
      <div v-for="q in filteredQuests" :key="q.id" class="card">
        <label class="field">
          <span>任务名称</span>
          <input
            :value="q.name"
            @input="emit('patchQuest', { id: q.id, patch: { name: ($event.target as HTMLInputElement).value } })"
          />
        </label>
        <label class="field">
          <span>初始状态</span>
          <select
            :value="q.initialStatus"
            @change="
              emit('patchQuest', {
                id: q.id,
                patch: { initialStatus: ($event.target as HTMLSelectElement).value as any },
              })
            "
          >
            <option value="NotStarted">未开始</option>
            <option value="InProgress">进行中</option>
            <option value="Completed">已完成</option>
            <option value="Failed">失败</option>
          </select>
        </label>
        <div class="row row-top">
          <div class="meta">
            画布：{{ graphById.get(q.graphId)?.name || q.graphId }}（{{
              graphTypeLabel(graphById.get(q.graphId)?.kind || "quest")
            }}）
          </div>
          <button class="btn" :disabled="!graphById.get(q.graphId)" @click="emit('selectGraph', q.graphId)">
            定位画布
          </button>
        </div>
        <div v-if="q.graphId === selectedGraphId" class="selected-tag">当前正在编辑该画布</div>
        <div class="usage">被引用 {{ questUsageCount.get(q.id) ?? 0 }} 处</div>
      </div>
    </div>

    <div v-else class="pane">
      <div class="toolbar">
        <button
          v-if="filteredResources.kind"
          class="btn btn-primary"
          type="button"
          @click="emit('addResource', { kind: filteredResources.kind })"
        >
          + 添加资源
        </button>
        <div v-else class="hint">请选择一个资源分组</div>
      </div>

      <div v-if="filteredResources.kind && filteredResources.list.length === 0" class="empty">暂无匹配资源</div>
      <div v-for="r in filteredResources.list" :key="`${filteredResources.kind}:${r.id}`" class="card">
        <label class="field">
          <span>ID</span>
          <input
            v-if="editingResourceKey === `${filteredResources.kind}:${r.id}`"
            v-model="resourceIdDraft"
            @blur="commitResourceIdRename(filteredResources.kind, r.id)"
            @change="commitResourceIdRename(filteredResources.kind, r.id)"
          />
          <input v-else :value="r.id" readonly @focus="beginEditResourceId(filteredResources.kind, r.id)" />
        </label>
        <label class="field">
          <span>名称</span>
          <input :value="r.name" @input="patchResourceField(filteredResources.kind!, r.id, 'name', $event)" />
        </label>
        <label class="field">
          <span>备注</span>
          <input :value="r.note ?? ''" @input="patchResourceField(filteredResources.kind!, r.id, 'note', $event)" />
        </label>
        <label v-if="filteredResources.kind === 'npc'" class="field">
          <NpcPortraitPicker
            :model-value="normalizeNpcPortraitPath(r.image) ?? ''"
            label="默认形象（全项目 NPC 资源共用）"
            @update:model-value="
              emit('patchResource', {
                kind: filteredResources.kind,
                id: r.id,
                patch: { image: $event || undefined },
              })
            "
          />
        </label>
        <label v-if="filteredResources.kind === 'area'" class="field">
          <span>地图 PNG（可选，URL/路径）</span>
          <input
            :value="r.image ?? ''"
            placeholder="例如：/maps/map_001.png 或 https://..."
            @input="patchResourceField(filteredResources.kind!, r.id, 'image', $event)"
          />
        </label>
        <label v-if="filteredResources.kind === 'area'" class="field">
          <span>tileSize（默认 48）</span>
          <input
            :value="String(r.tileSize ?? 48)"
            type="number"
            min="1"
            @change="
              emit('patchResource', {
                kind: filteredResources.kind,
                id: r.id,
                patch: { tileSize: Number(($event.target as HTMLInputElement).value) },
              })
            "
          />
        </label>
        <div class="usage">引用 {{ filteredResources.usage.get(r.id) ?? 0 }} 处</div>
        <button class="btn btn-danger" type="button" @click="requestDeleteResource(filteredResources.kind, r.id)">
          删除资源
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.library {
  height: 100%;
  overflow: auto;
  padding: 16px;
  background: var(--bg-app);
}
.library-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.library-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.sub {
  color: var(--fg-secondary);
  font-size: 12px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.tab {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.2);
  color: var(--fg-main);
  cursor: pointer;
}
.tab.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-focus);
}
.toolbar {
  margin-bottom: 10px;
}
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.check {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--fg-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.check input {
  width: 14px;
  height: 14px;
}
.pane {
  display: grid;
  gap: 10px;
}
.card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px;
  background: rgba(2, 6, 23, 0.35);
  display: grid;
  gap: 8px;
}
.field {
  display: grid;
  gap: 4px;
}
.field span {
  font-size: 12px;
  color: var(--fg-secondary);
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.row-top {
  justify-content: space-between;
}
.mini {
  flex: 1;
}
.hint,
.empty,
.meta,
.usage {
  font-size: 12px;
  color: var(--fg-secondary);
}
.selected-tag {
  font-size: 12px;
  color: #7dd3fc;
}
.item-id {
  font-weight: 600;
}
input,
select {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.35);
  color: var(--fg-main);
  font-size: 13px;
}
.btn {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(2, 6, 23, 0.2);
  color: var(--fg-main);
  cursor: pointer;
}
.btn-primary {
  border-color: var(--accent-strong);
  background: rgba(14, 165, 233, 0.18);
}
.btn-danger {
  border-color: #7f1d1d;
  background: #3f1111;
}
</style>
