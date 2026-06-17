<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { postMinigame2 } from '@/api/http'

const issueKey = ref('')
const roundLimit = ref(35)
const immediate = ref(true)
const strategy = ref<'explicit' | 'random'>('random')
const winnerKey = ref('')
const rawJson = ref('{}')

const meta = ref<Record<string, unknown>>({})
const categories = ref<Array<{ key: string; name?: string; multiplier?: number }>>([])
const lastBets = ref<Array<Record<string, unknown>>>([])
const rounds = ref<Array<Record<string, unknown>>>([])

const agg = computed(() => {
  const byC: Record<string, { total: number; keys: Record<string, number> }> = {}
  const byCat: Record<string, number> = {}
  for (const b of lastBets.value) {
    const cid = String(b.character_id || '')
    const k = String(b.selected_key || '')
    const amt = Number(b.bet_amount) || 0
    if (!cid) continue
    if (!byC[cid]) byC[cid] = { total: 0, keys: {} }
    byC[cid].total += amt
    byC[cid].keys[k] = (byC[cid].keys[k] || 0) + amt
    byCat[k] = (byCat[k] || 0) + amt
  }
  return { byC, byCat }
})

const catKeys = computed(() =>
  categories.value.length ? categories.value.map((c) => String(c.key)) : Object.keys(agg.value.byCat),
)

const maxCatAmt = computed(() => Math.max(1, ...catKeys.value.map((k) => agg.value.byCat[k] || 0)))

const pillIssue = computed(() => (meta.value.issue_key as string) || '—')
const pillClose = computed(() => {
  const t = (meta.value.close_time as string) || ''
  return t ? t.slice(5, 16) + '…' : '—'
})
const pillSec = computed(() => meta.value.seconds_until_close ?? '—')
const pillDrawn = computed(() => {
  const rd = meta.value.round_doc as Record<string, unknown> | undefined
  return rd?.drawn ? `已开 ${rd.winner_key || ''}` : '未开'
})

async function api(action: string, body: Record<string, unknown> = {}) {
  try {
    const data = await postMinigame2({ action, ...body })
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

async function loadMeta() {
  const { data, ok } = await api('meta', {})
  if (!ok) return
  meta.value = data
  categories.value = Array.isArray(data.categories) ? data.categories : []
  if (data.issue_key && !issueKey.value) issueKey.value = String(data.issue_key)
}

async function loadBets() {
  const ik = issueKey.value.trim()
  if (!ik) { ElMessage.warning('填写 issue_key'); return }
  const { data, ok } = await api('list_bets', { issue_key: ik, limit: 800 })
  if (ok) lastBets.value = (data.bets as Array<Record<string, unknown>>) || []
}

async function loadRounds() {
  const { data, ok } = await api('list_rounds', { limit: roundLimit.value })
  if (ok) rounds.value = (data.rounds as Array<Record<string, unknown>>) || []
}

async function doForce() {
  const ik = issueKey.value.trim()
  if (!ik) { ElMessage.warning('issue_key 必填'); return }
  const body: Record<string, unknown> = { issue_key: ik, immediate: immediate.value }
  if (strategy.value === 'explicit') {
    if (!winnerKey.value) { ElMessage.warning('请选择 winner_key'); return }
    body.winner_key = winnerKey.value
  }
  await ElMessageBox.confirm('确认 force_draw？')
  const { data, ok } = await api('force_draw', body)
  if (ok) ElMessage.success(data.already_drawn ? '已开过奖' : `开奖完成 · ${data.winner_key || ''}`)
  await loadMeta()
  await loadBets()
  await loadRounds()
}

onMounted(() => {
  loadMeta().then(loadRounds)
})
</script>

<template>
  <div class="dark-wrap">
    <h2 style="margin: 0 0 6px">期货 · 可视化运维</h2>
    <p class="tagline">类目筹码分布 · 支持立即开奖（指定类目或随机）</p>
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px" title="/api/minigame2 含 force_draw，无鉴权，仅本机" />

    <el-card class="dark-card toolbar">
      <el-input v-model="issueKey" placeholder="issue YYYYMMDDHH" style="width: 180px" class="mono" />
      <el-button @click="loadMeta">当前期</el-button>
      <el-button type="primary" @click="loadBets">加载本期注单</el-button>
      <el-input-number v-model="roundLimit" :min="5" :max="200" style="width: 90px" />
      <el-button @click="loadRounds">轮次表</el-button>
    </el-card>

    <div class="pills">
      <el-tag>期 {{ pillIssue }}</el-tag>
      <el-tag>封盘 {{ pillClose }}</el-tag>
      <el-tag>剩余秒 {{ pillSec }}</el-tag>
      <el-tag>状态 {{ pillDrawn }}</el-tag>
    </div>

    <el-card class="dark-card danger-border">
      <template #header>清除本期开奖状态</template>
      <el-button type="danger" @click="ElMessageBox.confirm('清除本期开奖记录？').then(async () => {
        await api('clear_round_draw', { issue_key: issueKey }); await loadMeta(); await loadRounds()
      })">一键清除本期开奖记录</el-button>
    </el-card>

    <el-card class="dark-card">
      <template #header>类目筹码（本期已下注合计）</template>
      <div v-for="k in catKeys" :key="k" class="cat-row">
        <span class="cat-name">{{ categories.find(c => String(c.key) === k)?.name || k }}</span>
        <el-progress :percentage="Math.round(((agg.byCat[k] || 0) / maxCatAmt) * 100)" :show-text="false" />
        <span class="cat-amt">{{ agg.byCat[k] || 0 }}</span>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>已下注玩家（只读）</template>
      <el-empty v-if="!Object.keys(agg.byC).length" description="暂无下注" />
      <div v-else class="pgrid">
        <div v-for="(o, cid) in agg.byC" :key="cid" class="pcard">
          <div class="t mono">{{ cid }}</div>
          <div class="sub">合计 {{ o.total }}<br>{{ Object.entries(o.keys).map(([k,v]) => `${k}:${v}`).join(' · ') }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>开奖策略</template>
      <el-radio-group v-model="strategy">
        <el-radio value="explicit">指定类目</el-radio>
        <el-radio value="random">随机</el-radio>
      </el-radio-group>
      <div style="margin: 12px 0">
        <el-select v-model="winnerKey" placeholder="选择类目" style="width: 220px">
          <el-option v-for="c in categories" :key="c.key" :label="`${c.name || c.key} x${c.multiplier || ''}`" :value="String(c.key)" />
        </el-select>
      </div>
      <el-checkbox v-model="immediate">立即开奖（未到封盘也可）</el-checkbox>
      <div style="margin-top: 12px; display: flex; gap: 8px">
        <el-button type="primary" @click="doForce">执行 force_draw</el-button>
        <el-button @click="loadMeta">仅刷新 meta</el-button>
      </div>
    </el-card>

    <el-card class="dark-card">
      <template #header>最近轮次（点击行填 issue）</template>
      <el-table :data="rounds" size="small" max-height="200" @row-click="(row) => { issueKey = String(row.issue_key); loadBets() }">
        <el-table-column prop="issue_key" label="issue" class-name="mono" />
        <el-table-column label="开奖">
          <template #default="{ row }">{{ row.drawn ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="winner_key" label="winner" />
      </el-table>
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
.cat-row { display: grid; grid-template-columns: 120px 1fr 48px; gap: 10px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.cat-name { color: #8b93a7; }
.cat-amt { text-align: right; font-family: monospace; color: #2dd4bf; }
.pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.pcard { border: 1px solid #2a3142; border-radius: 12px; padding: 12px; background: #0f1218; }
.pcard .t { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
.pcard .sub { font-size: 11px; color: #8b93a7; }
.raw {
  margin: 0; padding: 12px; border-radius: 10px; background: #0a0c10;
  border: 1px solid #2a3142; font-size: 11px; max-height: 260px; overflow: auto;
  white-space: pre-wrap; color: #9ca3af;
}
</style>
