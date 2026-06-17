<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { connected, onMessage, sendAdmin } from '@/composables/useWebSocket'
import type { ServerStats } from '@/types/admin'

const router = useRouter()
const stats = ref<ServerStats>({})
const onlineCount = ref(0)
const clientUptime = ref('00:00:00')
const startTime = Date.now()
let uptimeTimer: ReturnType<typeof setInterval> | null = null

interface Activity {
  time: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}
const activities = ref<Activity[]>([])

const navCards = [
  { path: '/game-control', icon: '🎮', title: '游戏控制', desc: '管理玩家账号、角色数据、宠物机甲、公告等' },
  { path: '/server-monitor', icon: '⚙️', title: '服务器控制', desc: '查看服务器统计、路由信息、在线玩家等' },
  { path: '/client-simulator', icon: '💻', title: '客户端模拟', desc: '模拟客户端登录、查看角色信息、背包、机甲等' },
  { path: '/battle-rooms', icon: '⚔️', title: '战斗房间监控', desc: '实时查看进行中的战斗房间' },
  { path: '/daletou', icon: '🎲', title: '大乐透运维台', desc: '开发/运维用，无鉴权，仅本机使用' },
  { path: '/minigame2', icon: '📈', title: '期货 MiniGame2', desc: '轮次/下注查询与强制开奖运维' },
]

function addActivity(message: string, type: Activity['type'] = 'info') {
  activities.value.unshift({
    time: new Date().toLocaleTimeString('zh-CN'),
    message,
    type,
  })
  if (activities.value.length > 50) activities.value.pop()
}

const unsubs: Array<() => void> = []

onMounted(() => {
  addActivity('管理后台已就绪', 'info')
  unsubs.push(
    onMessage('admin_server_stats', (data) => {
      if (data.success && data.stats) {
        stats.value = data.stats as ServerStats
        onlineCount.value = stats.value.online_players || 0
      }
    }),
    onMessage('admin_online_players', (data) => {
      if (data.success) onlineCount.value = (data.count as number) || 0
    }),
  )
  if (connected.value) {
    sendAdmin('admin_get_server_stats')
    sendAdmin('admin_get_online_players')
  }
  uptimeTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
    const s = (elapsed % 60).toString().padStart(2, '0')
    clientUptime.value = `${h}:${m}:${s}`
  }, 1000)
})

onUnmounted(() => {
  unsubs.forEach((u) => u())
  if (uptimeTimer) clearInterval(uptimeTimer)
})
</script>

<template>
  <div>
    <div class="stat-grid">
      <el-card shadow="hover">
        <template #header>服务器状态</template>
        <div :style="{ fontSize: '28px', fontWeight: 700, color: connected ? '#4caf50' : '#f44336' }">
          {{ connected ? '运行中' : '离线' }}
        </div>
      </el-card>
      <el-card shadow="hover">
        <template #header>在线玩家</template>
        <div style="font-size: 28px; font-weight: 700; color: #4caf50">{{ onlineCount }}</div>
      </el-card>
      <el-card shadow="hover">
        <template #header>总请求数</template>
        <div style="font-size: 28px; font-weight: 700">{{ stats.total_requests || 0 }}</div>
      </el-card>
      <el-card shadow="hover">
        <template #header>页面运行时间</template>
        <div style="font-size: 28px; font-weight: 700">{{ clientUptime }}</div>
      </el-card>
      <el-card shadow="hover">
        <template #header>总用户数</template>
        <div style="font-size: 28px; font-weight: 700">{{ stats.total_users || 0 }}</div>
      </el-card>
      <el-card shadow="hover">
        <template #header>总角色数</template>
        <div style="font-size: 28px; font-weight: 700">{{ stats.total_characters || 0 }}</div>
      </el-card>
    </div>

    <el-card class="page-card">
      <template #header>功能导航</template>
      <el-row :gutter="16">
        <el-col v-for="card in navCards" :key="card.path" :xs="24" :sm="12" :md="8">
          <div class="nav-card" @click="router.push(card.path)">
            <div class="nav-icon">{{ card.icon }}</div>
            <div class="nav-title">{{ card.title }}</div>
            <div class="nav-desc">{{ card.desc }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <template #header>系统日志</template>
      <el-empty v-if="!activities.length" description="暂无活动记录" />
      <div v-else class="activity-list">
        <div v-for="(a, i) in activities" :key="i" class="activity-item">
          <span>{{ a.type === 'success' ? '✅' : a.type === 'error' ? '❌' : a.type === 'warning' ? '⚠️' : 'ℹ️' }}</span>
          <span style="flex: 1">{{ a.message }}</span>
          <span style="color: #999; font-size: 12px">{{ a.time }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.nav-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}
.nav-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}
.nav-icon { font-size: 32px; margin-bottom: 8px; }
.nav-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.nav-desc { font-size: 13px; color: #666; line-height: 1.5; }
.activity-list { max-height: 300px; overflow-y: auto; }
.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
</style>
