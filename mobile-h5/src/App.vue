<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, can, canMessage, canWorkspace } from './services/session'
import { loadProjects, projectError, projectsReady } from './hooks/useProjects'
import { m } from './services/mobileText'
import ProjectPicker from './components/ProjectPicker.vue'
import { useMessageBadge } from './hooks/useMessageBadge'
const unread = useMessageBadge()
const route = useRoute(), router = useRouter()
const login = computed(() => route.path === '/login')
const root = computed(() => ['/', '/tasks', '/sync', '/messages', '/profile'].includes(route.path))
const nav = computed(() => [
  { to: '/', name: m('工作台', 'Home'), icon: 'home-o', show: true },
  { to: '/tasks', name: m('任务', 'Tasks'), icon: 'orders-o', show: can('query') },
  { to: '/sync', name: m('同步', 'Sync'), icon: 'exchange', show: can('query') },
  { to: '/messages', name: '消息', icon: 'bell', show: canMessage() },
  { to: '/profile', name: m('我的', 'Me'), icon: 'user-o', show: true }
].filter(item => item.show))
const title = computed(() => {
  if (route.path === '/') return '工作台'
  if (route.path === '/faults') return '维修任务'
  if (/^\/faults\/[^/]+\/repair$/.test(route.path)) return '维修处理'
  if (route.path.startsWith('/faults/')) return '维修详情'
  if (route.path === '/profile') return '我的'
  if (route.path.startsWith('/alerts/')) return '告警详情'
  if (route.path === '/messages') return '消息'
  if (route.path === '/sync') return '同步中心'
  if (route.path === '/tasks') {
    if (route.query.mode === 'review' && can('review')) return '我的审批'
    if (route.query.mode === 'dispatch' && can('dispatch')) return '任务转派'
    if (route.query.mode === 'offline') return '离线模式'
    return '任务'
  }
  return route.path.startsWith('/tasks/') ? route.query.scan ? '设备检查' : '任务详情' : route.path.startsWith('/device/') ? '设备详情' : route.path.startsWith('/groups/') ? '设备组' : route.path.startsWith('/meters/') ? '表计详情' : route.path === '/owner' ? '我的表计与消息' : route.query.taskId ? route.query.deviceId ? '扫描设备' : '扫描设备组' : '扫码查看'
})
watch(() => state.context, context => { if (context) void loadProjects() }, { immediate: true })
function back() { if (window.history.state?.back) router.back(); else void router.replace('/') }
</script>
<template>
  <van-config-provider :theme-vars="{ primaryColor: '#0874bb', textColor: '#203448', borderRadiusLg: '12px', buttonDefaultHeight: '44px', fieldLabelColor: '#4d6275' }">
    <div class="app" :class="{ 'has-nav': root && !login }">
      <van-nav-bar v-if="!login" :title="title" :left-arrow="!root" fixed placeholder safe-area-inset-top @click-left="back">
        <template v-if="root && canWorkspace()" #right><ProjectPicker /></template>
      </van-nav-bar>
      <div v-if="root && !login && canWorkspace() && projectsReady && !state.projectId" class="project-notice"><MobileNotice :type="projectError ? 'error' : 'info'" :message="projectError || '暂无可用项目，请联系管理员配置项目权限'"><template v-if="projectError" #action><van-button size="small" plain @click="loadProjects">重试</van-button></template></MobileNotice></div>
      <router-view :key="route.path" />
      <van-tabbar v-if="root && !login" route safe-area-inset-bottom>
        <van-tabbar-item v-for="item in nav" :key="item.to" :to="item.to" :dot="item.to === '/messages' && unread > 0"><template #icon><van-icon :name="item.icon" /></template>{{ item.name }}</van-tabbar-item>
      </van-tabbar>
    </div>
  </van-config-provider>
</template>
