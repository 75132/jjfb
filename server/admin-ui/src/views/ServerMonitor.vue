<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { connected, onMessage, sendAdmin } from '@/composables/useWebSocket'
import { usePolling } from '@/composables/usePolling'
import type { OnlinePlayer, RouteStat, ServerStats } from '@/types/admin'
import { formatNumber, formatUptime } from '@/utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const stats = ref<ServerStats>({})
const onlineCount = ref(0)
const players = ref<OnlinePlayer[]>([])
const routeStats = ref<Record<string, RouteStat>>({})
const autoRefresh = ref(true)
const logsPaused = ref(false)
const activeChart = ref('qps')
const routeTab = ref('all')
const logs = ref<{ type: string; time: string; msg: string }[]>([])

const chartLabels = shallowRef<string[]>([])
const qpsData = shallowRef<number[]>([])
const connData = shallowRef<number[]>([])
const respData = shallowRef<number[]>([])
const errData = shallowRef<number[]>([])
const MAX_POINTS = 30
const chartReady = ref(false)

const unsubs: Array<() => void> = []

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true },
    x: { display: true },
  },
  animation: { duration: 0 },
}

const currentChartData = computed(() => {
  const map: Record<string, { label: string; data: number[]; color: string; bg: string }> = {
    qps: { label: 'QPS', data: qpsData.value, color: '#667eea', bg: 'rgba(102,126,234,0.1)' },
    connections: { label: '连接数', data: connData.value, color: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
    response: { label: '响应时间(ms)', data: respData.value, color: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
    errors: { label: '错误率(%)', data: errData.value, color: '#f44336', bg: 'rgba(244,67,54,0.1)' },
  }
  const c = map[activeChart.value] ?? map.qps
  return {
    labels: chartLabels.value.slice(),
    datasets: [{
      label: c.label,
      data: c.data.slice(),
      borderColor: c.color,
      backgroundColor: c.bg,
      tension: 0.4,
      fill: true,
    }],
  }
})

function pushChart(now: string, qps: number, conn: number, resp: number, err: number) {
  chartLabels.value = [...chartLabels.value, now].slice(-MAX_POINTS)
  qpsData.value = [...qpsData.value, qps].slice(-MAX_POINTS)
  connData.value = [...connData.value, conn].slice(-MAX_POINTS)
  respData.value = [...respData.value, resp].slice(-MAX_POINTS)
  errData.value = [...errData.value, err].slice(-MAX_POINTS)
}

function addLog(type: string, msg: string) {
  if (logsPaused.value) return
  logs.value.push({ type, time: new Date().toLocaleTimeString(), msg })
  if (logs.value.length > 100) logs.value.shift()
}

function updateFromStats(s: ServerStats) {
  stats.value = s
  const now = new Date().toLocaleTimeString()
  const qps = s.qps || 0
  const conn = s.current_connections || 0
  const err = s.route_stats?.total_error_rate || 0
  const resp = s.route_stats?.avg_time_per_call_ms || 0
  pushChart(now, qps, conn, resp, err)
}

const routesList = computed(() =>
  Object.entries(routeStats.value).map(([name, st]) => ({
    name,
    total_calls: st.total_calls || st.call_count || 0,
    avg_time: st.avg_time || 0,
    max_time: st.max_time || 0,
    error_count: st.error_count || 0,
    error_rate: st.error_rate || 0,
  })),
)

const topRoutes = computed(() => [...routesList.value].sort((a, b) => b.total_calls - a.total_calls).slice(0, 10))
const slowRoutes = computed(() => [...routesList.value].filter((r) => r.avg_time > 100).sort((a, b) => b.avg_time - a.avg_time).slice(0, 10))
const errorRoutes = computed(() => [...routesList.value].filter((r) => r.error_count > 0).sort((a, b) => b.error_rate - a.error_rate))

const sortedRoutes = computed(() => [...routesList.value].sort((a, b) => b.total_calls - a.total_calls))

function refreshStats() { sendAdmin('admin_get_server_stats') }
function refreshRoutes() { sendAdmin('admin_get_route_stats') }
function refreshPlayers() { sendAdmin('admin_get_online_players') }

const polling = usePolling(refreshStats, 2000, false)

function applyAutoRefresh() {
  if (autoRefresh.value) polling.start()
  else polling.stop()
}

const stopAutoRefreshWatch = watch(autoRefresh, applyAutoRefresh)

const stopConnectedWatch = watch(connected, (ok) => {
  if (!ok) return
  refreshStats()
  refreshRoutes()
  refreshPlayers()
})

onMounted(() => {
  chartReady.value = true
  unsubs.push(
    onMessage('admin_server_stats', (data) => {
      if (data.success && data.stats) updateFromStats(data.stats as ServerStats)
    }),
    onMessage('admin_route_stats', (data) => {
      if (data.success && data.stats) routeStats.value = data.stats as Record<string, RouteStat>
    }),
    onMessage('admin_online_players', (data) => {
      if (data.success) {
        onlineCount.value = (data.count as number) || 0
        players.value = (data.players as OnlinePlayer[]) || []
      }
    }),
  )
  if (connected.value) {
    refreshStats()
    refreshRoutes()
    refreshPlayers()
  }
  addLog('info', '服务器控制面板已启动')
  applyAutoRefresh()
})

onUnmounted(() => {
  chartReady.value = false
  stopAutoRefreshWatch()
  stopConnectedWatch()
  polling.stop()
  unsubs.forEach((u) => u())
})
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">⚙️ 服务器控制中心</h2>

    <div class="stat-grid">
      <el-card><template #header>运行时间</template>
        <div style="font-size: 24px; font-weight: 600">{{ formatUptime(stats.uptime || 0) }}</div>
      </el-card>
      <el-card><template #header>总请求数</template>
        <div style="font-size: 24px; font-weight: 600">{{ formatNumber(stats.total_requests || 0) }}</div>
      </el-card>
      <el-card><template #header>平均响应</template>
        <div style="font-size: 24px; font-weight: 600">{{ (stats.route_stats?.avg_time_per_call_ms || 0).toFixed(2) }}ms</div>
      </el-card>
      <el-card><template #header>错误率</template>
        <div style="font-size: 24px; font-weight: 600">{{ (stats.route_stats?.total_error_rate || 0).toFixed(2) }}%</div>
      </el-card>
      <el-card><template #header>当前 QPS</template>
        <div style="font-size: 24px; font-weight: 600">{{ stats.qps || 0 }}</div>
      </el-card>
    </div>

    <el-card class="page-card">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>实时性能监控</span>
          <div style="display: flex; gap: 12px; align-items: center">
            <el-switch v-model="autoRefresh" active-text="自动刷新" />
            <el-button size="small" @click="refreshStats">刷新</el-button>
          </div>
        </div>
      </template>
      <el-tabs v-model="activeChart">
        <el-tab-pane label="QPS趋势" name="qps" />
        <el-tab-pane label="连接数" name="connections" />
        <el-tab-pane label="响应时间" name="response" />
        <el-tab-pane label="错误率" name="errors" />
      </el-tabs>
      <div style="height: 300px">
        <Line v-if="chartReady" :data="currentChartData" :options="chartOptions" />
      </div>
    </el-card>

    <el-card class="page-card">
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>路由统计</span>
          <el-button size="small" @click="refreshRoutes">刷新</el-button>
        </div>
      </template>
      <el-tabs v-model="routeTab">
        <el-tab-pane label="全部路由" name="all">
          <el-table :data="sortedRoutes" size="small" max-height="400">
            <el-table-column prop="name" label="路由" min-width="160">
              <template #default="{ row }"><span class="mono" style="color:#667eea">{{ row.name }}</span></template>
            </el-table-column>
            <el-table-column prop="total_calls" label="调用次数" width="100" />
            <el-table-column label="平均耗时" width="100">
              <template #default="{ row }">{{ row.avg_time.toFixed(2) }}ms</template>
            </el-table-column>
            <el-table-column label="最大耗时" width="100">
              <template #default="{ row }">{{ row.max_time.toFixed(2) }}ms</template>
            </el-table-column>
            <el-table-column prop="error_count" label="错误数" width="80" />
            <el-table-column label="错误率" width="90">
              <template #default="{ row }">
                <span :style="{ color: row.error_rate > 5 ? '#f44336' : row.error_rate > 0 ? '#ff9800' : '#4caf50' }">
                  {{ row.error_rate.toFixed(2) }}%
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="热门路由" name="top">
          <el-table :data="topRoutes" size="small" max-height="300">
            <el-table-column prop="name" label="路由" />
            <el-table-column prop="total_calls" label="调用次数" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="慢路由" name="slow">
          <el-table :data="slowRoutes" size="small" max-height="300">
            <el-table-column prop="name" label="路由" />
            <el-table-column label="平均耗时">
              <template #default="{ row }">{{ row.avg_time.toFixed(2) }}ms</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="错误路由" name="error">
          <el-table :data="errorRoutes" size="small" max-height="300">
            <el-table-column prop="name" label="路由" />
            <el-table-column prop="error_count" label="错误数" />
            <el-table-column label="错误率">
              <template #default="{ row }">{{ row.error_rate.toFixed(2) }}%</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card class="page-card">
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>在线玩家 ({{ onlineCount }})</span>
          <el-button size="small" @click="refreshPlayers">刷新</el-button>
        </div>
      </template>
      <el-empty v-if="!players.length" description="暂无在线玩家" />
      <el-row v-else :gutter="16">
        <el-col v-for="p in players" :key="p.character_id" :xs="24" :sm="12" :md="8" :lg="6">
          <el-card shadow="hover" style="margin-bottom: 12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <strong>{{ p.role_name || '未知' }}</strong>
              <el-tag type="success" size="small">在线</el-tag>
            </div>
            <div style="font-size:12px;color:#666">账号: {{ p.account }}</div>
            <div style="font-size:12px;color:#666">角色ID: {{ p.character_id }}</div>
            <div style="font-size:12px;color:#666">等级: {{ p.level || 1 }}</div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>系统日志</span>
          <div>
            <el-button size="small" @click="logs = []">清空</el-button>
            <el-button size="small" @click="logsPaused = !logsPaused">{{ logsPaused ? '继续' : '暂停' }}</el-button>
          </div>
        </div>
      </template>
      <div class="log-container">
        <div v-for="(l, i) in logs" :key="i" :class="['log-entry', l.type]">
          [{{ l.time }}] {{ l.msg }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.log-container {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e0e0e0;
}
.log-entry.info { color: #4caf50; }
.log-entry.warning { color: #ff9800; }
.log-entry.error { color: #f44336; }
</style>
