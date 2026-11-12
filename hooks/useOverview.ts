import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { useReports, type EnergyRow } from './useReports'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { messageOf } from '../shared/types'
import type { OverviewTaskState } from '../shared/overview'

const menus = {
  devices: 'facility/Devices', inspection: 'facility/Inspection/Tasks',
  maintenance: 'facility/Maintenance/Tasks', alerts: 'facility/Alerts',
  notifications: 'facility/Notifications', energy: 'facility/Energy', faults: 'facility/Faults'
}
export type OverviewDestination = keyof typeof menus

export function useOverview() {
  const reports = useReports()
  const menu = useMenuStore()
  const auth = useAuthStore()
  const energyLoading = ref(false), energyError = ref('')
  let energyGeneration = 0
  const energyStatus = computed(() => ({
    loading: energyLoading.value, disabled: reports.busy.value || energyLoading.value,
    error: energyError.value === 'Network Error' ? feText('overviewNetworkError') : energyError.value
  }))
  const error = computed(() => reports.error.value === 'Network Error' ? feText('overviewNetworkError') : reports.error.value)
  const ready = computed(() => typeof reports.overview.value.devices === 'number')
  const count = (key: string) => ready.value && typeof reports.overview.value[key] === 'number'
    ? Number(reports.overview.value[key]) : undefined
  const total = computed(() => count('devices'))
  const online = computed(() => count('online'))
  const nonOnline = computed(() => total.value === undefined || online.value === undefined
    ? undefined : Math.max(0, total.value - online.value))
  const onlineRate = computed(() => total.value && online.value !== undefined ? online.value / total.value * 100 : undefined)
  const can = (target: OverviewDestination) => menu.hasMenu(menus[target])
  const taskState = computed<OverviewTaskState>(() => ({
    counts: Object.fromEntries(['pendingClaim', 'inProgress', 'pendingReview', 'overdue', 'todayinspection', 'todaymaintenance', 'alerts', 'notificationFailures'].map(key => [key, count(key)])),
    access: { inspection: can('inspection'), maintenance: can('maintenance'), alerts: can('alerts'), notifications: can('notifications') },
    reviewAccess: { inspection: can('inspection') && auth.hasPermission('facility/Inspection/Tasks:review'), maintenance: can('maintenance') && auth.hasPermission('facility/Maintenance/Tasks:review') },
    projectId: reports.projectId.value, projects: reports.projects.value
  }))
  const go = (target: OverviewDestination, focus?: string, tab?: string) => {
    if (!can(target)) return
    return menu.jumpPage(menus[target], { query: {
      ...(reports.projectId.value ? { projectId: reports.projectId.value } : {}),
      ...(focus ? { overview: focus } : {}), ...(tab ? { tab } : {})
    } })
  }
  const refresh = () => {
    // 项目或整页刷新后，旧层级请求不能回填新项目的能源数据。
    energyGeneration++
    energyLoading.value = false
    energyError.value = ''
    reports.to.value = Date.now()
    reports.from.value = reports.to.value - 86400000
    return reports.refresh()
  }
  const refreshEnergy = async () => {
    if (reports.busy.value) return
    const current = ++energyGeneration
    energyLoading.value = true
    energyError.value = ''
    reports.rows.value = []
    reports.to.value = Date.now()
    reports.from.value = reports.to.value - 86400000
    const query = new URLSearchParams({ from: String(reports.from.value), to: String(reports.to.value), level: reports.level.value })
    if (reports.projectId.value) query.set('projectId', reports.projectId.value)
    try {
      const rows = await facility.get<EnergyRow[]>('reports/energy?' + query)
      if (current === energyGeneration) reports.rows.value = rows
    } catch (e) {
      if (current === energyGeneration) energyError.value = messageOf(e)
    } finally {
      if (current === energyGeneration) energyLoading.value = false
    }
  }
  const changeProject = () => {
    reports.level.value = 'master'
    return refresh()
  }
  // 用户停留时更新滚动24小时窗口；请求中、隐藏标签页不重复采集。
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (!reports.busy.value && !energyLoading.value && document.visibilityState === 'visible') void refresh()
    }, 60000)
  })
  onBeforeUnmount(() => { energyGeneration++; clearInterval(timer) })
  return { ...reports, error, ready, count, total, online, nonOnline, onlineRate, can, go, refresh, changeProject, refreshEnergy, energyStatus, taskState }
}
