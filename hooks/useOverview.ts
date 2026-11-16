import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { useEnergyOverview } from './useEnergyOverview'
import type { OverviewTaskState } from '../shared/overview'

const menus = {
  devices: 'facility/Devices', inspection: 'facility/Inspection/Tasks',
  maintenance: 'facility/Maintenance/Tasks', alerts: 'facility/Alerts',
  notifications: 'facility/Notifications', energy: 'facility/Energy', faults: 'facility/Faults'
}
export type OverviewDestination = keyof typeof menus

export function useOverview() {
  const energy = useEnergyOverview(true)
  const menu = useMenuStore(), auth = useAuthStore()
  const count = (key: string) => typeof energy.states.overview.data?.[key] === 'number'
    ? Number(energy.states.overview.data[key]) : undefined
  const total = computed(() => count('devices'))
  const assetOnline = computed(() => count('online'))
  const nonOnline = computed(() => total.value === undefined || assetOnline.value === undefined
    ? undefined : Math.max(0, total.value - assetOnline.value))
  const onlineRate = computed(() => total.value && assetOnline.value !== undefined ? assetOnline.value / total.value * 100 : undefined)
  const faultStates = computed(() => energy.states.overview.data?.faultStates as Record<string, number> | undefined)
  const can = (target: OverviewDestination) => menu.hasMenu(menus[target])
  const taskState = computed<OverviewTaskState>(() => ({
    counts: Object.fromEntries(['pendingClaim', 'inProgress', 'pendingReview', 'overdue', 'todayinspection', 'todaymaintenance', 'alerts', 'notificationFailures'].map(key => [key, count(key)])),
    access: { inspection: can('inspection'), maintenance: can('maintenance'), alerts: can('alerts'), notifications: can('notifications') },
    reviewAccess: { inspection: can('inspection') && auth.hasPermission('facility/Inspection/Tasks:review'), maintenance: can('maintenance') && auth.hasPermission('facility/Maintenance/Tasks:review') },
    projectId: energy.projectId.value, projects: energy.projects.value
  }))
  const go = (target: OverviewDestination, focus?: string, tab?: string) => {
    if (!can(target)) return
    return menu.jumpPage(menus[target], { query: {
      ...(energy.projectId.value ? { projectId: energy.projectId.value } : {}),
      ...(focus ? { overview: focus } : {}), ...(tab ? { tab } : {})
    } })
  }
  // 实时作业待办定时更新；历史能源统计只在筛选或主动刷新时加载。
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (!energy.busy.value && document.visibilityState === 'visible') {
        void energy.refreshOperations()
        void energy.refreshTodos()
      }
    }, 60000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return { ...energy, count, total, assetOnline, nonOnline, onlineRate, faultStates, can, go, taskState }
}
