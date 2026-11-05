import { feText } from '../shared/i18n'
import { ref, onMounted } from 'vue'
import { facility } from '../api'
import type { Entity, Option, Usage } from '../shared/types'
import { messageOf } from '../shared/types'
export interface EnergyRow {
  deviceId: string
  name: string
  energyType: string
  propertyId: string
  unit: string
  usage: Usage
}
export function useReports(detailed = false) {
  const projects = ref<Option[]>([]),
    projectId = ref<string>(),
    overview = ref<Record<string, unknown>>({}),
    rows = ref<EnergyRow[]>([]),
    busy = ref(false),
    error = ref(''),
    from = ref(Date.now() - 86400000),
    to = ref(Date.now()),
    level = ref('master'),
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
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      const query = projectId.value ? 'projectId=' + encodeURIComponent(projectId.value) + '&' : ''
      const [summary, energy] = await Promise.all([
        facility.get<Record<string, unknown>>('reports/overview?' + query),
        facility.get<EnergyRow[]>(
          'reports/energy?' + query + 'from=' + from.value + '&to=' + to.value + '&level=' + level.value
        )
      ])
      overview.value = summary
      rows.value = energy
      if (detailed) {
        const extra = await Promise.all([
          facility.get<typeof operations.value>(
            'reports/operations?' + query + 'from=' + from.value + '&to=' + to.value
          ),
          facility.get<typeof comparison.value>(
            'reports/comparison?' + query + 'from=' + from.value + '&to=' + to.value + '&level=' + level.value
          ),
          facility.get<Record<string, unknown>[]>(
            'reports/targets/execution?' + query + 'year=' + year.value + '&month=' + month.value
          )
        ])
        operations.value = extra[0]
        comparison.value = extra[1]
        targets.value = extra[2]
      }
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const loadPeriods = async () => {
    busy.value = true
    error.value = ''
    try {
      const query = projectId.value ? 'projectId=' + encodeURIComponent(projectId.value) + '&' : ''
      periodRows.value = await facility.get<typeof periodRows.value>(
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
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
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
