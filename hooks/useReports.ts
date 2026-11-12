import { feText } from '../shared/i18n'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { facility } from '../api'
import type { Entity, Option, Usage } from '../shared/types'
import { messageOf } from '../shared/types'
import { loadOverviewEnergy } from '../shared/overview'
export interface EnergyRow {
  deviceId: string
  name: string
  energyType: string
  propertyId: string
  unit: string
  usage: Usage
}
export function useReports(detailed = false, autoLevel = false) {
  const projects = ref<Option[]>([]),
    projectId = ref<string>(),
    overview = ref<Record<string, unknown>>({}),
    rows = ref<EnergyRow[]>([]),
    refreshing = ref(false),
    periodLoading = ref(false),
    error = ref(''),
    from = ref(Date.now() - 86400000),
    to = ref(Date.now()),
    level = ref(autoLevel ? 'auto' : 'master'),
    operations = ref<{
      tasks: {
        kind: string
        total: number
        completed: number
        overdue: number
        completionRate: number | null
        overdueRate: number | null
      }[]
      faultTrend: Record<string, number>
      notifications: Record<string, number>
    }>(),
    comparison = ref<(EnergyRow & { previousRate?: number | null; lastYearRate?: number | null })[]>([]),
    periodRows = ref<{ period: string; meters: EnergyRow[] }[]>([]),
    targets = ref<Record<string, unknown>[]>([]),
    period = ref('day'),
    year = ref(new Date().getFullYear()),
    month = ref(new Date().getMonth() + 1)
  const busy = computed(() => refreshing.value || periodLoading.value)
  let generation = 0, periodGeneration = 0
  onBeforeUnmount(() => { generation++; periodGeneration++ })
  const refresh = async () => {
    const current = ++generation
    // 筛选变化使旧统计及周期结果失效，迟到的响应不能覆盖新条件。
    periodGeneration++
    periodLoading.value = false
    periodRows.value = []
    rows.value = []
    overview.value = {}
    operations.value = undefined
    comparison.value = []
    targets.value = []
    refreshing.value = true
    error.value = ''
    try {
      const query = projectId.value ? 'projectId=' + encodeURIComponent(projectId.value) + '&' : ''
      const range = 'from=' + from.value + '&to=' + to.value
      const aggregation = '&level=' + level.value
      const [summary, energy, operationResult, comparisonResult, targetResult] = await Promise.all([
        facility.get<Record<string, unknown>>('reports/overview?' + query),
        loadOverviewEnergy(candidate => facility.get<EnergyRow[]>('reports/energy?' + query + range + '&level=' + candidate), level.value),
        detailed ? facility.get<typeof operations.value>('reports/operations?' + query + range) : undefined,
        detailed ? facility.get<typeof comparison.value>('reports/comparison?' + query + range + aggregation) : [],
        detailed ? facility.get<Record<string, unknown>[]>('reports/targets/execution?' + query + 'year=' + year.value + '&month=' + month.value) : []
      ])
      if (current !== generation) return
      overview.value = summary
      rows.value = energy.rows
      level.value = energy.level
      operations.value = operationResult
      comparison.value = comparisonResult
      targets.value = targetResult
    } catch (e) {
      if (current === generation) error.value = messageOf(e)
    } finally {
      if (current === generation) refreshing.value = false
    }
  }
  const loadPeriods = async () => {
    const current = ++periodGeneration
    periodLoading.value = true
    error.value = ''
    try {
      const query = projectId.value ? 'projectId=' + encodeURIComponent(projectId.value) + '&' : ''
      const result = await facility.get<typeof periodRows.value>(
        'reports/periods?' +
          query +
          'period=' +
          period.value +
          '&year=' +
          year.value +
          '&month=' +
          month.value +
          '&level=' +
          level.value
      )
      if (current === periodGeneration) periodRows.value = result
    } catch (e) {
      if (current === periodGeneration) error.value = messageOf(e)
    } finally {
      if (current === periodGeneration) periodLoading.value = false
    }
  }
  const exportCsv = () => {
    const escape = (v: unknown) =>
      '"' +
      String(v ?? '')
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"'
    const csv = [
      [feText('meter'), feText('energy'), feText('metric'), feText('usage'), feText('unit'), feText('completeData'), feText('anomalies')],
      ...rows.value.map((r) => [
        r.name,
        r.energyType,
        r.propertyId,
        r.usage.value,
        r.unit,
        r.usage.complete ? feText('complete') : feText('incomplete'),
        r.usage.anomalies
      ])
    ]
      .map((row) => row.map(escape).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = feText('facilityEnergyStatisticsCsv')
    a.click()
    URL.revokeObjectURL(url)
  }
  onMounted(async () => {
    try {
      projects.value = (await facility.options('projects')).map((p) => ({ value: p.id, label: p.name || p.id }))
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    }
  })
  return {
    projects,
    projectId,
    overview,
    rows,
    busy,
    error,
    from,
    to,
    level,
    operations,
    comparison,
    periodRows,
    targets,
    period,
    year,
    month,
    loadPeriods,
    refresh,
    exportCsv
  }
}
