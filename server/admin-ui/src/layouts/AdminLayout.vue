<script setup lang="ts">
import { computed, onErrorCaptured, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { connect, connected, onMessage, sendAdmin } from '@/composables/useWebSocket'

const route = useRoute()
const router = useRouter()
const onlineCount = ref(0)
const pageError = ref('')

const isConnected = computed(() => connected.value)
const isDark = computed(() => route.matched.some((r) => r.meta.dark))

const navItems = [
  { path: '/', icon: 'HomeFilled', label: '主面板' },
  { path: '/game-control', icon: 'VideoPlay', label: '游戏控制' },
  { path: '/server-monitor', icon: 'Monitor', label: '服务器监控' },
  { path: '/client-simulator', icon: 'Iphone', label: '客户端模拟' },
  { path: '/battle-rooms', icon: 'Trophy', label: '战斗房间' },
  { path: '/daletou', icon: 'Present', label: '大乐透运维' },
  { path: '/minigame2', icon: 'TrendCharts', label: '期货运维' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

function navigate(path: string) {
  pageError.value = ''
  router.push(path).catch((e) => {
    console.error('[navigate]', path, e)
  })
}

onErrorCaptured((err) => {
  pageError.value = err instanceof Error ? err.message : String(err)
  console.error('[AdminLayout] child page error:', err)
  return false
})

onMounted(() => {
  connect()
  onMessage('admin_online_players', (data) => {
    if (data.success) onlineCount.value = (data.count as number) || 0
  })
  sendAdmin('admin_get_online_players')
})
</script>

<template>
  <div :class="{ 'dark-layout': isDark }">
    <header class="admin-header">
      <h1>🎮 游戏服务器管理后台</h1>
      <div style="display: flex; align-items: center; gap: 16px; font-size: 14px">
        <span style="display: flex; align-items: center; gap: 6px">
          <span class="status-dot" :class="{ off: !isConnected }" />
          {{ isConnected ? '已连接' : '未连接' }}
        </span>
        <span>在线: <strong>{{ onlineCount }}</strong></span>
      </div>
    </header>
    <div class="admin-body">
      <aside class="admin-sidebar">
        <nav class="side-nav">
          <a
            v-for="item in navItems"
            :key="item.path"
            href="#"
            class="side-nav-item"
            :class="{ active: isActive(item.path) }"
            @click.prevent="navigate(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </a>
        </nav>
      </aside>
      <main class="admin-content" :class="{ 'dark-page': isDark }">
        <el-alert
          v-if="pageError"
          type="error"
          :title="'页面渲染错误: ' + pageError"
          show-icon
          closable
          style="margin-bottom: 12px"
          @close="pageError = ''"
        />
        <router-view :key="route.path" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.dark-layout .admin-header {
  background: linear-gradient(135deg, #1a2240 0%, #0c0e12 100%);
}
.side-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}
.side-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  color: #303133;
  text-decoration: none;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
}
.side-nav-item:hover {
  background: #ecf5ff;
  color: #409eff;
}
.side-nav-item.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
  border-right: 3px solid #409eff;
}
.dark-layout .side-nav-item {
  color: #c0c4cc;
}
.dark-layout .side-nav-item:hover,
.dark-layout .side-nav-item.active {
  background: rgba(64, 158, 255, 0.12);
  color: #79bbff;
}
</style>
