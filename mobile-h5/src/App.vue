<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HomeOutlined, UnorderedListOutlined, CloudSyncOutlined, UserOutlined, BellOutlined, LeftOutlined } from '@ant-design/icons-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { state, can } from './services/session'
import { loadProjects, projectError, projectsReady } from './hooks/useProjects'
import { m } from './services/mobileText'
import ProjectPicker from './components/ProjectPicker.vue'
import { useMessageBadge } from './hooks/useMessageBadge'
const unread = useMessageBadge()
const route = useRoute(), router = useRouter()
const login = computed(() => route.path === '/login')
const root = computed(() => ['/', '/tasks', '/sync', '/messages', '/profile'].includes(route.path))
const nav = computed(() => [
  { to: '/', name: m('工作台', 'Home'), icon: HomeOutlined, show: true },
  { to: '/tasks', name: m('任务', 'Tasks'), icon: UnorderedListOutlined, show: can('query') },
  { to: '/sync', name: m('同步', 'Sync'), icon: CloudSyncOutlined, show: can('query') },
  { to: '/messages', name: '消息', icon: BellOutlined, show: can('query') },
  { to: '/profile', name: m('我的', 'Me'), icon: UserOutlined, show: true }
].filter(item => item.show))
const title = computed(() => {
  if (route.path === '/') return '工作台'
  if (route.path === '/profile') return '我的'
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
  <a-config-provider :locale="zhCN" :theme="{ token: { colorPrimary: '#0874bb', colorText: '#203448', colorTextSecondary: '#5a6f83', colorTextPlaceholder: '#65798a', borderRadius: 10, controlHeight: 42, fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif' } }">
    <div class="app" :class="{ 'has-nav': root && !login }">
      <header v-if="!login" class="topbar">
        <div class="topbar-side"><button v-if="!root" class="icon-button" :aria-label="m('返回', 'Back')" @click="back"><LeftOutlined /></button></div>
        <strong>{{ title }}</strong>
        <div class="topbar-side topbar-end"><ProjectPicker v-if="root && can('query')" /></div>
      </header>
      <div v-if="root && !login && can('query') && projectsReady && !state.projectId" class="project-notice"><a-alert :type="projectError ? 'error' : 'info'" :message="projectError || '暂无可用项目，请联系管理员配置项目权限'"><template v-if="projectError" #action><a-button type="link" @click="loadProjects">重试</a-button></template></a-alert></div>
      <router-view :key="route.path" />
      <nav v-if="root && !login" class="bottom-nav" :aria-label="m('主导航', 'Main navigation')"><router-link v-for="item in nav" :key="item.to" :to="item.to" :class="{ current: route.path === item.to }" :aria-current="route.path === item.to ? 'page' : undefined"><a-badge :dot="item.to === '/messages' && unread > 0"><component :is="item.icon" /></a-badge><span>{{ item.name }}</span></router-link></nav>
    </div>
  </a-config-provider>
</template>
