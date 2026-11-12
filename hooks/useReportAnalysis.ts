import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { useMenuStore } from '@jetlinks-web-core/store'
import type { ConditionFilterChangePayload, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter/types'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { reportFilterValues } from '../shared/reportSearch'
import { alertType } from '../shared/alerts'
import { display, messageOf, type Option, type Query, type Pager, type Term } from '../shared/types'
import type { WorkReport, FaultReport, AlertReport, EnergyReport, TargetReport, ReportTab, ReportSource, ReportPanel, ReportDrill, ReportDetail } from '../components/reports/reportModel'
import { reportCsv, reportView } from '../components/reports/reportCharts'

export function useReportAnalysis() {
  const menu = useMenuStore(), projects = ref<Option[]>([]), projectId = ref<string>(), error = ref('')
  const tab = ref<ReportTab>('work'), kind = ref('inspection'), faultMode = ref<'faults' | 'alerts'>('faults')
  const energyType = ref('electricity'), level = ref('master'), period = ref('day'), shortcut = ref('month')
  const from = ref(dayjs().startOf('month').valueOf()), to = ref(dayjs().add(1, 'month').startOf('month').valueOf())
  const terms = ref<ConditionFilterTerm[]>([{ column: 'timeRange', termType: 'btw', value: [from.value, to.value] }])
  const panels = reactive({ work: { loading: false, error: '' } as ReportPanel<WorkReport>, faults: { loading: false, error: '' } as ReportPanel<FaultReport>,
    alerts: { loading: false, error: '' } as ReportPanel<AlertReport>, energy: { loading: false, error: '' } as ReportPanel<EnergyReport>, targets: { loading: false, error: '' } as ReportPanel<TargetReport> })
  const source = computed<ReportSource>(() => tab.value === 'faults' ? faultMode.value : tab.value)
  const panel = computed(() => panels[source.value])
  const view = computed(() => reportView(source.value, panels, energyType.value))
  const planOpen = ref(false), drill = ref<ReportDrill>(), taskId = ref<string>()
  const versions: Record<string, number> = {}, valid = ref(true)
  let revision = 0
  const fields = computed<ConditionFilterField[]>(() => [
    { title: feText('businessProject'), dataIndex: 'projectId', search: { type: 'select', options: projects.value, termTypeOptions: ['eq'] } },
    { title: feText('reportPeriod'), dataIndex: 'timeRange', search: { type: 'rangePicker', termTypeOptions: ['btw'], componentProps: { showTime: true, format: 'YYYY-MM-DD HH:mm' } } }
  ])
  const parameters = () => {
    const query = new URLSearchParams({ from: String(from.value), to: String(to.value), kind: kind.value, level: level.value, energyType: energyType.value, period: period.value })
    if (projectId.value) query.set('projectId', projectId.value)
    return query
  }
  async function load(key: keyof typeof panels, path: string) {
    const snapshot = revision, version = (versions[key] || 0) + 1; versions[key] = version
    const state = panels[key]; state.loading = true; state.error = ''
    try {
      const result = await facility.get(path)
      if (snapshot === revision && version === versions[key]) Object.assign(state, { data: result })
    } catch (cause) {
      if (snapshot === revision && version === versions[key]) state.error = messageOf(cause)
    } finally {
      if (snapshot === revision && version === versions[key]) state.loading = false
    }
  }
  const refresh = async () => {
    if (!valid.value) return
    const selected = source.value, query = parameters()
    if (selected === 'energy') {
      const month = dayjs(from.value), targets = new URLSearchParams({ year: String(month.year()), month: String(month.month() + 1), energyType: energyType.value })
      if (projectId.value) targets.set('projectId', projectId.value)
      await Promise.all([load('energy', 'reports/energy/analysis?' + query), load('targets', 'reports/targets/analysis?' + targets)])
    } else await load(selected, 'reports/' + selected + '?' + query)
  }
  const invalidate = () => {
    // 所有未完成响应立即失效，项目切换后不展示旧范围的数据或明细。
    revision++; drill.value = undefined
    for (const state of Object.values(panels)) { state.data = undefined; state.loading = false; state.error = '' }
    return refresh()
  }
  const change = ({ filter }: ConditionFilterChangePayload) => {
    const values = reportFilterValues(filter.terms)
    valid.value = !!values && values.from !== undefined && values.to !== undefined && values.to - values.from <= 366 * 86400000
    if (!valid.value || !values) { error.value = feText('reportDateLimit'); return }
    error.value = ''; projectId.value = values.projectId; from.value = values.from!; to.value = values.to!; shortcut.value = 'custom'
    return invalidate()
  }
  const setShortcut = (value: string | number) => {
    shortcut.value = String(value)
    if (value === 'custom') return
    const start = value === 'last' ? dayjs().subtract(1, 'month').startOf('month') : dayjs().startOf('month')
    from.value = start.valueOf(); to.value = start.add(1, 'month').valueOf()
    terms.value = [...(projectId.value ? [{ column: 'projectId', termType: 'eq', value: projectId.value }] : []), { column: 'timeRange', termType: 'btw', value: [from.value, to.value] }]
    valid.value = true; error.value = ''; return invalidate()
  }
  const changeTab = () => invalidate()
  const openDrill = (date?: string, extra: Term[] = [], options: Record<string, string> = {}) => {
    const query = parameters(), selected = source.value
    Object.entries(options).forEach(([key, value]) => query.set(key, value))
    if (date && selected !== 'energy') {
      // 故障趋势的验收列允许上期登记故障，因此期间选择与列条件分别保留。
      const field = selected === 'work' ? 'scheduledTime' : selected === 'alerts' ? 'firstTime' : 'createTime'
      extra = [...extra, { column: field, termType: 'gte', value: Math.max(from.value, dayjs(date).valueOf()) }, { column: field, termType: 'lt', value: Math.min(to.value, dayjs(date).add(1, 'day').valueOf()) }]
    }
    if (date && selected === 'energy') {
      const point = panels.energy.data?.trend.find(row => row.date === date)
      if (point) { query.set('from', String(point.from)); query.set('to', String(point.to)) }
    }
    drill.value = { source: selected, title: feText('reportDetails'), query: query.toString(), terms: extra,
      projectId: projectId.value, from: from.value, to: to.value, kind: kind.value }
  }
  const chartClick = (event: { name?: string; seriesName?: string; dataIndex?: number }, chart = 'main') => {
    const selected = source.value
    if (chart === 'left') {
      const index = event.dataIndex
      if (selected === 'work') {
        const group = index === undefined ? undefined : panels.work.data?.groups[index]
        openDrill(undefined, [], group ? { groupId: group.id } : {}); return
      }
      const device = index === undefined ? undefined : (selected === 'faults' ? panels.faults.data?.devices : panels.alerts.data?.devices)?.[index]
      openDrill(undefined, device?.id ? [{ column: 'deviceId', value: device.id }] : []); return
    }
    if (chart === 'right') {
      if (selected === 'work') {
        const states = event.name === display('open') ? ['open'] : event.name === display('review') ? ['review', 'external-submitted'] : ['claimed', 'executing', 'rectify']
        openDrill(undefined, event.name ? [{ column: 'state', termType: 'in', value: states }] : []); return
      }
      if (selected === 'alerts') {
        const states = event.name === display('pending') ? ['open', 'pending'] : event.name === display('processing') ? ['acknowledged', 'processing'] : ['closed']
        openDrill(undefined, event.name ? [{ column: 'processingState', termType: 'in', value: states }] : []); return
      }
      const ages = [feText('reportWithinDay'), feText('reportOneToThreeDays'), feText('reportThreeToSevenDays'), feText('reportOverSevenDays')]
      const age = event.name ? ages.indexOf(event.name) : -1, now = panels.faults.data?.asOf || Date.now(), bounds = [0, 1, 3, 7, Infinity]
      openDrill(undefined, age < 0 ? [] : [{ column: 'state', termType: 'not', value: 'closed' },
        { column: 'createTime', termType: 'gte', value: Math.max(from.value, age === 3 ? from.value : now - bounds[age + 1] * 86400000 + 1) },
        { column: 'createTime', termType: 'lt', value: Math.min(to.value, now - bounds[age] * 86400000 + 1) }]); return
    }
    const buckets: Record<string, string> = { [feText('reportOnTime')]: 'onTime', [feText('reportLate')]: 'late', [feText('reportDueIncomplete')]: 'dueIncomplete', [feText('reportNotDue')]: 'notDue', [feText('closed')]: 'closed', [feText('cancelled')]: 'cancelled' }
    if (selected === 'work') { openDrill(event.name, [], event.seriesName && buckets[event.seriesName] ? { bucket: buckets[event.seriesName] } : {}); return }
    if (source.value === 'faults' && event.seriesName === feText('reportVerified') && event.name) {
      openDrill(undefined, [{ column: 'completedTime', termType: 'gte', value: dayjs(event.name).valueOf() }, { column: 'completedTime', termType: 'lt', value: dayjs(event.name).add(1, 'day').valueOf() }, { column: 'state', value: 'closed' }])
    } else {
      const type = selected === 'alerts' ? panels.alerts.data?.types.find(value => event.seriesName === alertType(value)) : undefined
      openDrill(event.name, type ? [{ column: 'ruleType', value: type }] : [])
    }
  }
  const requestDetails = async (query: Query) => {
    const active = drill.value
    if (!active) return { success: true, result: { data: [], total: 0, pageIndex: 0, pageSize: 12 } }
    const request = { ...query, terms: [{ terms: query.terms || [] }, ...active.terms] }
    const result = await facility.post<Pager<ReportDetail>>('reports/' + active.source + '/_query?' + active.query, request)
    return { success: true, result }
  }
  const original = (row: ReportDetail) => {
    if (drill.value?.source === 'work') { taskId.value = row.id; return }
    const target = drill.value?.source === 'faults' ? 'facility/Faults' : drill.value?.source === 'alerts' ? 'facility/Alerts' : 'facility/Energy'
    return menu.jumpPage(target, { query: { ...(projectId.value ? { projectId: projectId.value } : {}),
      id: String(drill.value?.source === 'faults' ? row.id : drill.value?.source === 'alerts' ? row.episodeId || row.id : row.deviceId || row.id), from: String(from.value), to: String(to.value),
      ...(drill.value?.source === 'energy' ? { tab: 'collection' } : {}) } })
  }
  const configureMeters = () => menu.jumpPage('facility/Energy', { query: { tab: 'energy/mappings', ...(projectId.value ? { projectId: projectId.value } : {}) } })
  const exportCsv = () => {
    if (!valid.value || !panel.value.data || panel.value.loading || panel.value.error) return
    const csv = reportCsv(view.value, { project: projects.value.find(p => p.value === projectId.value)?.label || feText('allBusinessProjects'),
      from: from.value, to: to.value, kind: source.value === 'work' ? kind.value : source.value, energyType: energyType.value, level: level.value })
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a')
    anchor.href = url; anchor.download = feText('reportExportCsv'); anchor.click(); URL.revokeObjectURL(url)
  }
  onMounted(async () => {
    try { projects.value = (await facility.options('projects')).map(project => ({ value: project.id, label: project.name || project.id })) }
    catch (cause) { error.value = messageOf(cause) }
    await refresh()
  })
  onBeforeUnmount(() => { revision++ })
  return { projects, projectId, tab, kind, faultMode, energyType, level, period, shortcut, from, to, panels, panel, source, view,
    terms, fields, error, valid, planOpen, drill, taskId, refresh, invalidate, change, setShortcut, changeTab, openDrill, chartClick, requestDetails, original, configureMeters, exportCsv }
}
