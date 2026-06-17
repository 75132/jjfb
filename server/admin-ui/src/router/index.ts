import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '主面板' },
        },
        {
          path: 'game-control',
          name: 'game-control',
          component: () => import('@/views/GameControl.vue'),
          meta: { title: '游戏控制' },
        },
        {
          path: 'server-monitor',
          name: 'server-monitor',
          component: () => import('@/views/ServerMonitor.vue'),
          meta: { title: '服务器监控' },
        },
        {
          path: 'client-simulator',
          name: 'client-simulator',
          component: () => import('@/views/ClientSimulator.vue'),
          meta: { title: '客户端模拟' },
        },
        {
          path: 'battle-rooms',
          name: 'battle-rooms',
          component: () => import('@/views/BattleRooms.vue'),
          meta: { title: '战斗房间' },
        },
        {
          path: 'daletou',
          name: 'daletou',
          component: () => import('@/views/DaletouTest.vue'),
          meta: { title: '大乐透运维', dark: true },
        },
        {
          path: 'minigame2',
          name: 'minigame2',
          component: () => import('@/views/Minigame2Test.vue'),
          meta: { title: '期货运维', dark: true },
        },
      ],
    },
    // legacy URL redirects
    { path: '/index.html', redirect: '/' },
    { path: '/game-control.html', redirect: '/game-control' },
    { path: '/server-control.html', redirect: '/server-monitor' },
    { path: '/client-simulator.html', redirect: '/client-simulator' },
    { path: '/battle-rooms.html', redirect: '/battle-rooms' },
    { path: '/daletou-test.html', redirect: '/daletou' },
    { path: '/minigame2-test.html', redirect: '/minigame2' },
    { path: '/console.html', redirect: '/' },
    { path: '/admin-client.html', redirect: '/client-simulator' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  const matched = to.matched.filter((r) => r.meta?.title)
  const title = (matched[matched.length - 1]?.meta?.title as string) || '管理后台'
  document.title = `${title} - 游戏服务器管理后台`
})

export default router
