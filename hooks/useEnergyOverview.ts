import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { facility } from '../api'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { energyMonth, energyMeterRows, energyTotal, energyTypes, energyHealth, type EnergyMapping, type EnergyPeriod, type EnergyType } from '../shared/energyOverview'
import { messageOf, type Device, type Entity, type Option, type Pager, type Query, type Term } from '../shared/types'
import type { EnergyRow } from './useReports'

interface Panel<T> { data?: T; loading: boolean; error: string }
const panel = <T>(): Panel<T> => ({ loading: false, error: '' })
const currentMonth = () => new Date(Date.now() + 28800000).toISOString().slice(0, 7)

export function useEnergyOverview(withOperations = false) {
  const menu = useMenuStore(), auth = useAuthStore(), route = useRoute()
  const projectIds = ref<string[]>([])
  const projectId = computed({ get: () => projectIds.value.length === 1 ? projectIds.value[0] : undefined, set: (value: string | undefined) => { projectIds.value = value ? [value] : [] } })
  const projects = ref<Option[]>([]), projectError = ref(''), projectLoading = ref(false)
  const month = ref(currentMonth()), level = ref('master'), energyType = ref<EnergyType>('water')
  const readingsOpen = ref(false), billingOpen = ref(false), keyword = ref('')
  const states = reactive({ energy: panel<EnergyRow[]>(), trend: panel<EnergyPeriod[]>(),
    meters: panel<{ mappings: EnergyMapping[]; devices: Device[]; spaceError?: string }>(),
    readings: panel<number>(), billing: panel<number>(), alerts: panel<number>(), overview: panel<Record<string, unknown>>() })
  const versions: Record<string, number> = {}
  let alive = true
  const canReadings = computed(() => auth.hasPermission('facility/Energy:reading-review'))
  const canBilling = computed(() => menu.hasMenu('facility/Billing') && auth.hasPermission('facility/Billing:review'))
  const canAlerts = computed(() => menu.hasMenu('facility/Alerts'))
  const canCollection = computed(() => menu.hasMenu('facility/Energy'))
  const busy = computed(() => Object.values(states).some(state => state.loading))
  const errorText = (cause: unknown) => messageOf(cause) === 'Network Error' ? feText('overviewNetworkError') : messageOf(cause)
  async function load<T>(key: keyof typeof states, run: () => Promise<T>) {
    const version = (versions[key] || 0) + 1; versions[key] = version
    const state = states[key] as Panel<T>
    state.loading = true; state.error = ''; state.data = undefined
    try { const data = await run(); if (alive && version === versions[key]) state.data = data }
    catch (cause) { if (alive && version === versions[key]) state.error = errorText(cause) }
    finally { if (alive && version === versions[key]) state.loading = false }
  }
  const terms = (): Term[] => projectIds.value.length ? [{ column: 'projectId', termType: projectIds.value.length === 1 ? 'eq' : 'in', value: projectId.value || [...projectIds.value] }] : []
  const projectQuery = () => projectId.value ? { projectId: projectId.value } : projectIds.value.length ? { projectIds: [...projectIds.value] } : {}
  const params = (values: Record<string, string | number>) => {
    const query = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))
    if (projectId.value) query.set('projectId', projectId.value)
    else for (const id of projectIds.value) query.append('projectIds', id)
    return query
  }
  async function allPages<T extends Entity>(fetch: (query: Query) => Promise<Pager<T>>, filters: Term[]) {
    const rows: T[] = []
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const page = await fetch({ pageIndex, pageSize: 200, terms: filters, sorts: [{ name: 'id', order: 'asc' }] })
      rows.push(...page.data)
      if (rows.length >= page.total) return rows
      if (!page.data.length) break
    }
    throw Error(feText('eoTooMany'))
  }
  const refreshEnergy = async () => {
    let range: ReturnType<typeof energyMonth>
    try { range = energyMonth(month.value) }
    catch { for (const key of ['energy', 'trend'] as const) { versions[key] = (versions[key] || 0) + 1; states[key].data = undefined; states[key].loading = false; states[key].error = feText('eoInvalidMonth') }; return }
    const query = params({ from: range.from, to: range.to, level: level.value })
    const trend = params({ period: 'day', year: range.year, month: range.month, level: level.value })
    await Promise.all([
      load('energy', () => facility.get<EnergyRow[]>('reports/energy?' + query)),
      load('trend', () => facility.get<EnergyPeriod[]>('reports/periods?' + trend))
    ])
  }
  const refreshMeters = () => {
    const filters = [...terms(), { column: 'meterLevel', termType: 'eq', value: level.value }]
    return load('meters', async () => {
      const mappings = await allPages(query => facility.query<EnergyMapping>('energy/mappings', query), filters)
      const devices: Device[] = []
      const ids = [...new Set(mappings.map(row => row.deviceId))]
      for (let index = 0; index < ids.length; index += 200) {
        devices.push(...await allPages(query => facility.devices(query), [
          ...filters.filter(term => term.column !== 'meterLevel'), { column: 'id', termType: 'in', value: ids.slice(index, index + 200) }
        ]))
      }
      // 旧服务只返回空间 ID；仅为缺少名称的已授权设备按项目补查目录，失败不丢弃设备统计。
      const projects = [...new Set(devices.filter(device => device.spaceId && !device.spaceName).map(device => device.projectId).filter((id): id is string => !!id))]
      const errors: string[] = []
      for (const project of projects) {
        try {
          const spaces = new Map((await facility.options('spaces/' + encodeURIComponent(project)))
            .map(space => [space.id, typeof space.fullName === 'string' ? space.fullName : space.name]))
          for (const device of devices) if (device.projectId === project && !device.spaceName && typeof device.spaceId === 'string')
            device.spaceName = spaces.get(device.spaceId)
        } catch (cause) { errors.push(errorText(cause)) }
      }
      return { mappings, devices, spaceError: [...new Set(errors)].join('；') }
    })
  }
  const refreshTodos = async () => {
    const filters = terms(), project = projectId.value
    const count = async (path: string, extra: Term[]) => (await facility.query(path, { pageIndex: 0, pageSize: 1, terms: [...filters, ...extra] })).total
    await Promise.all([
      canReadings.value ? load('readings', () => count('energy/readings', [{ column: 'source', value: 'manual' }, { column: 'status', value: 'pending' }])) : undefined,
      canBilling.value ? load('billing', async () => (await (project ? meterApi.reviews(project, 'pending', { pageIndex: 0, pageSize: 1 })
        : meterApi.reviewsProjects([...projectIds.value], 'pending', { pageIndex: 0, pageSize: 1 }))).total) : undefined,
      canAlerts.value ? load('alerts', () => count('alerts', [{ terms: [
        { column: 'processingState', value: 'open' },
        { column: 'processingState', termType: 'isnull', type: 'or', value: true }
      ] }])) : undefined
    ])
  }
  const refreshOperations = () => withOperations
    ? load('overview', () => facility.get<Record<string, unknown>>('reports/overview?' + params({}))) : Promise.resolve()
  const refresh = () => Promise.all([refreshEnergy(), refreshMeters(), refreshTodos(), refreshOperations()])
  const changeLevel = () => { keyword.value = ''; return Promise.all([refreshEnergy(), refreshMeters()]) }
  const changeProject = () => {
    keyword.value = ''; readingsOpen.value = false; billingOpen.value = false
    for (const key of ['readings', 'billing', 'alerts'] as const) { versions[key] = (versions[key] || 0) + 1; states[key].data = undefined; states[key].loading = false; states[key].error = '' }
    return refresh()
  }
  const cards = computed(() => energyTypes.map(type => {
    const mappings = states.meters.data?.mappings.filter(row => row.energyType === type)
    return { type, ...energyTotal(states.energy.data || [], type, mappings?.map(row => row.deviceId)), meters: mappings?.length }
  }))
  const allMeters = computed(() => energyMeterRows(states.meters.data?.mappings || [], states.meters.data?.devices || [], states.energy.data || []))
  const health = computed(() => states.meters.data ? energyHealth(states.meters.data.mappings, states.meters.data.devices) : undefined)
  const ranking = computed(() => allMeters.value.filter(row => row.energyType === energyType.value && row.value !== undefined)
    .sort((left, right) => right.value! - left.value!).slice(0, 5))
  const meters = computed(() => allMeters.value.filter(row => row.energyType === energyType.value &&
    (!keyword.value.trim() || [row.name, row.spaceName].some(value => value?.toLowerCase().includes(keyword.value.trim().toLowerCase())))))
  const online = computed(() => {
    const rows = allMeters.value.filter(row => row.energyType === energyType.value)
    return { total: rows.length, online: rows.filter(row => row.sourceState === 'online').length,
      offline: rows.filter(row => row.sourceState === 'offline').length,
      unknown: rows.filter(row => !['online', 'offline'].includes(row.sourceState || '')).length }
  })
  const openAlerts = () => canAlerts.value && menu.jumpPage('facility/Alerts', { query: { ...projectQuery(), overview: 'pending' } })
  const initialize = async () => {
    projectLoading.value = true; projectError.value = ''
    try {
      projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id }))
      if (!alive) return
      const requested = route?.query.projectIds ?? route?.query.projectId
      projectIds.value = [...new Set((Array.isArray(requested) ? requested : typeof requested === 'string' ? [requested] : [])
        .filter((id): id is string => typeof id === 'string' && projects.value.some(project => project.value === id)))]
      await refresh()
    } catch (cause) { if (alive) projectError.value = errorText(cause) }
    finally { if (alive) projectLoading.value = false }
  }
  onMounted(initialize)
  onBeforeUnmount(() => { alive = false })
  return { projects, projectId, projectIds, projectQuery, projectError, projectLoading, month, level, energyType, states, cards, meters, online, keyword, health, ranking,
    busy, canReadings, canBilling, canAlerts, canCollection, readingsOpen, billingOpen, refresh, refreshEnergy, refreshMeters, refreshTodos, refreshOperations,
    changeLevel, changeProject, openAlerts, initialize }
}
