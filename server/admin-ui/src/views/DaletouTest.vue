<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { postDaletou } from '@/api/http'
import { todayStr } from '@/utils/format'

const day = ref(todayStr())
const listLimit = ref(400)
const onlineSec = ref(10800)
const winnerCid = ref('')
const winnerName = ref('')
const immediate = ref(true)
const rawJson = ref('{}')

const meta = ref<Record<string, unknown>>({})
const poolRows = ref<Array<Record<string, unknown>>>([])
const allPlayers = ref<Array<Record<string, unknown>>>([])

const pillDay = computed(() => (meta.value.query_day as string) || '—')
const pillIssue = computed(() => (meta.value.issue as string) || '—')
const pillPool = computed(() => {
  const dr = meta.value.draw_record as Record<string, unknown> | undefined
  return dr?.participant_count != null ? String(dr.participant_count) : '—'
})
const pillDl = computed(() => {
  const d = (meta.value.draw_deadline as string) || ''
  return d ? d.slice(5, 16) + '…' : '—'
})
const pillSt = computed(() => {
  const dr = meta.value.draw_record as Record<string, unknown> | undefined
  if (!dr) return '—'
  if (dr.drawn) return `已开 · ${dr.winner_role_name || dr.winner_character_id || ''}`
  return meta.value.deadline_passed ? '过截止' : '未开奖'
})

const maxPoolSec = computed(() => Math.max(1, ...poolRows.value.map((p) => Number(p.online_seconds) || 0)))

async function api(action: string, body: Record<string, unknown> = {}) {
  try {
    const data = await postDaletou({ action, day: day.value, ...body })
    rawJson.value = JSON.stringify(data, null, 2)
    if (data.success === false) {
      ElMessage.error(String(data.message || data.error || '请求失败'))
      return { data, ok: false }
    }
    return { data, ok: true }
  } catch (e) {
    rawJson.value = String(e)
    ElMessage.error('网络: ' + e)
    return { data: {}, ok: false }
  }
}

function setWinner(cid: string, name: string) {
  winnerCid.value = cid
  winnerName.value = name
}

async function loadMeta() {
  const { data, ok } = await api('meta', {})
  if (ok) meta.value = data
}

async function loadPool() {
  const { data, ok } = await api('list', {})
  if (ok) poolRows.value = (data.participants as Array<Record<string, unknown>>) || []
}

async function loadAll() {
  const { data, ok } = await api('list_players', { limit: listLimit.value })
  if (ok) allPlayers.value = (data.players as Array<Record<string, unknown>>) || []
}

async function refresh() {
  await loadMeta()
  await loadPool()
  await loadAll()
}

onMounted(() => refresh())
</script>

<template>
  <div class="dark-wrap">
    <h2 style="margin: 0 0 6px">大乐透 · 可视化运维</h2>
    <p class="tagline">奖池参与可视化 · 点选玩家指定头奖 · 支持立即开奖 / 自然开奖 / 删记录</p>
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px" title="/api/daletou 无鉴权，仅本机；勿暴露公网" />

    <el-card class="dark-card toolbar">
      <el-input v-model="day" placeholder="YYYY-MM-DD" style="width: 160px" class="mono" />
      <el-button @click="day = todayStr(); refresh()">今天</el-button>
      <el-button type="primary" @click="refresh">同步数据</el-button>
      <el-input-number v-model="listLimit" :min="50" :max="2000" style="width: 100px" />
      <el-button @click="api('list_draws', { limit: 20 })">最近开奖 JSON</el-button>
    </el-card>

    <div class="pills">
      <el-tag>日期 {{ pillDay }}</el-tag>
      <el-tag>期号 {{ pillIssue }}</el-tag>
      <el-tag>奖池人数 {{ pillPool }}</el-tag>
      <el-tag>截止 {{ pillDl }}</el-tag>
      <el-tag>状态 {{ pillSt }}</el-tag>
    </div>

    <el-card class="dark-card danger-border">
      <template #header>一键重置当日开奖</template>
      <p class="tagline">删除当前日期下 daletou_draws 开奖记录，不会扣回已发放能量块</p>
      <el-button type="danger" @click="ElMessageBox.confirm('确认删除当日开奖记录？').then(async () => { await api('reset_draw', {}); await refresh() })">
        一键删除当日开奖记录
      </el-button>
    </el-card>

    <el-card class="dark-card">
      <template #header>奖池 · 在线时长分布</template>
      <el-empty v-if="!poolRows.length" description="暂无奖池数据" />
      <div v-else class="pool-grid">
        <div
          v-for="p in poolRows"
          :key="String(p.character_id)"
          class="pool-card"
          :class="{ selected: winnerCid === String(p.character_id) }"
          @click="setWinner(String(p.character_id), String(p.role_name || p.character_id))"
        >
          <div class="pool-head">
            <span class="ava">{{ String(p.role_name || '?').slice(0, 1).toUpperCase() }}</span>
            <div>
              <div class="pname">{{ p.role_name }}</div>
              <div class="pcid mono">{{ p.character_id }}</div>
            </div>
          </div>
          <el-progress
            :percentage="Math.round(((Number(p.online_seconds) || 0) / maxPoolSec) * 100)"
            :show-text="false"
            style="margin: 8px 0"
          />
          <div class="pool-meta">在线 {{ p.online_seconds }} 秒 · 已达3h {{ Number(p.online_seconds) >= 10800 ? '✓' : '…' }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>全角色列表</template>
      <el-table :data="allPlayers" size="small" max-height="240" @row-click="(row) => setWinner(String(row.character_id), String(row.role_name))">
        <el-table-column prop="role_name" label="角色" />
        <el-table-column prop="character_id" label="cid" class-name="mono" />
        <el-table-column prop="online_seconds" label="在线秒" />
        <el-table-column label="已领">
          <template #default="{ row }">{{ row.claimed ? '是' : '否' }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="dark-card">
      <template #header>快捷写库</template>
      <p>当前指定头奖: <strong style="color: #3b82f6">{{ winnerCid ? `${winnerName} · ${winnerCid}` : '（未选）' }}</strong></p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0">
        <el-input-number v-model="onlineSec" :min="0" />
        <el-button @click="onlineSec = 0">0</el-button>
        <el-button @click="onlineSec = 3600">1h</el-button>
        <el-button @click="onlineSec = 10800">3h</el-button>
        <el-button :disabled="!winnerCid" @click="api('set_online', { character_id: winnerCid, online_seconds: onlineSec }).then(refresh)">写入在线</el-button>
        <el-button :disabled="!winnerCid" @click="api('set_claimed', { character_id: winnerCid, claimed: true }).then(refresh)">已领+</el-button>
        <el-button :disabled="!winnerCid" @click="api('set_claimed', { character_id: winnerCid, claimed: false }).then(refresh)">已领−</el-button>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>开奖</template>
      <el-checkbox v-model="immediate">立即开奖（无视24点）</el-checkbox>
      <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap">
        <el-button type="primary" :disabled="!winnerCid" @click="ElMessageBox.confirm('确认立即开奖？').then(async () => { await api('draw', { immediate, winner_character_id: winnerCid }); await refresh() })">
          立即开奖（使用指定）
        </el-button>
        <el-button @click="ElMessageBox.confirm('随机头奖？').then(async () => { await api('draw', { immediate: true, winner_character_id: null }); await refresh() })">
          立即开奖（随机）
        </el-button>
        <el-button @click="api('draw', { immediate: false, winner_character_id: winnerCid || null }).then(refresh)">自然开奖</el-button>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>原始响应</template>
      <pre class="raw">{{ rawJson }}</pre>
    </el-card>
  </div>
</template>

<style scoped>
.dark-wrap { color: #eef1f6; }
.tagline { color: #8b93a7; font-size: 12px; margin-bottom: 12px; }
.dark-card { background: #151922; border-color: #2a3142; margin-bottom: 16px; color: #eef1f6; }
.dark-card :deep(.el-card__header) { border-color: #2a3142; color: #8b93a7; }
.danger-border { border-color: #7f1d1d !important; }
.toolbar :deep(.el-card__body) { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.pool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.pool-card {
  padding: 12px; border-radius: 12px; border: 1px solid #2a3142; background: #0f1218; cursor: pointer;
}
.pool-card.selected { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
.pool-head { display: flex; gap: 10px; align-items: center; }
.ava {
  width: 40px; height: 40px; border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #3b82f6);
  display: flex; align-items: center; justify-content: center; font-weight: 700;
}
.pname { font-weight: 600; }
.pcid { font-size: 11px; color: #8b93a7; }
.pool-meta { font-size: 11px; color: #8b93a7; }
.raw {
  margin: 0; padding: 12px; border-radius: 10px; background: #0a0c10;
  border: 1px solid #2a3142; font-size: 11px; max-height: 280px; overflow: auto;
  white-space: pre-wrap; color: #9ca3af;
}
</style>
