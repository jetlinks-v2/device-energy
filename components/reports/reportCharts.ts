import type { EChartsOption } from 'echarts'
import { feText } from '../../shared/i18n'
import { display, energyNames } from '../../shared/types'
import { alertTypes } from '../../shared/alerts'
import type { ReportChart, ReportView, ReportSource, ReportPanel, WorkReport, FaultReport, AlertReport, EnergyReport, TargetReport, ReportPoint } from './reportModel'

const colors = { water: '#0891d2', electricity: '#7c5ce7', gas: '#e28a2d' }
const number = (value: unknown, suffix = '') => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }) + suffix
const metrics = (values: [string, unknown, string?][]) => values.map(([title, value, suffix]) => ({ title, value: number(value, suffix) }))
const labels = () => ({ onTime: feText('reportOnTime'), late: feText('reportLate'), dueIncomplete: feText('reportDueIncomplete'), notDue: feText('reportNotDue'),
  closed: feText('closed'), cancelled: feText('cancelled'), created: feText('reportNewFaults'), completed: feText('reportVerified'),
  withinDay: feText('reportWithinDay'), oneToThreeDays: feText('reportOneToThreeDays'), threeToSevenDays: feText('reportThreeToSevenDays'), overSevenDays: feText('reportOverSevenDays') })
const label = (key: string) => (labels() as Record<string, string>)[key] || alertTypes().find(item => item.value === key)?.label ||
  (key === 'dueSoon' ? feText('taskApproachingDeadline') : key === 'overdue' ? feText('taskOverdue') : key === 'unknown' ? feText('reportUnknownType') : display(key))

function trend(title: string, data: ReportPoint[], keys: string[], type: 'line' | 'bar' = 'bar', unit = '', stacked = false, color?: string): ReportChart {
  const option: EChartsOption = {
    color: color ? [color] : ['#38a58a', '#d6a650', '#df766d', '#8ba4c3', '#a0a5ae', '#c7ccd4'],
    tooltip: { trigger: 'axis', valueFormatter: value => value == null ? '—' : number(value, unit ? ' ' + unit : '') },
    legend: { type: 'scroll', bottom: 0 }, grid: { left: 48, right: 24, top: 22, bottom: 68, containLabel: true },
    xAxis: { type: 'category', data: data.map(row => row.date), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: unit, minInterval: unit ? undefined : 1 },
    series: keys.map(key => ({ type, name: key === 'value' ? feText('usage') : label(key),
      data: data.map(row => row[key] == null ? null : Number(row[key])), stack: stacked ? 'total' : undefined, barMaxWidth: 36, connectNulls: false }))
  }
  return { title, option, empty: !data.length || data.every(row => keys.every(key => row[key] == null || (!unit && Number(row[key]) === 0))),
    rows: [[feText('date'), ...keys.map(key => key === 'value' ? feText('usage') + (unit ? ' (' + unit + ')' : '') : label(key))], ...data.map(row => [row.date, ...keys.map(key => row[key])])] }
}

function horizontal(title: string, data: { name: string; value: number | null }[], unit = '', color = '#5a8cd8'): ReportChart {
  return { title, empty: !data.length, rows: [[feText('name'), unit || feText('reportCount')], ...data.map(row => [row.name, row.value])], option: {
    color: [color], tooltip: { trigger: 'axis', valueFormatter: value => value == null ? '—' : number(value, unit ? ' ' + unit : '') },
    grid: { left: 8, right: 36, top: 16, bottom: 16, containLabel: true },
    xAxis: { type: 'value', max: unit === '%' ? 100 : undefined },
    yAxis: { type: 'category', inverse: true, data: data.map(row => row.name), axisLabel: { width: 140, overflow: 'truncate' } },
    series: [{ type: 'bar', barMaxWidth: 22, data: data.map(row => row.value), label: { show: true, position: 'right', formatter: param => number(param.value, unit === '%' ? '%' : '') } }]
  } }
}

function distribution(title: string, data: Record<string, number>): ReportChart {
  const rows = Object.entries(data).map(([key, count]) => ({ name: label(key), value: count }))
  return { title, empty: !rows.length, rows: [[feText('processingStatus'), feText('reportCount')], ...rows.map(row => [row.name, row.value])], option: {
    tooltip: { trigger: 'item' }, legend: { type: 'scroll', bottom: 0 },
    series: [{ type: 'pie', radius: ['38%', '66%'], center: ['50%', '44%'], label: { formatter: '{b}: {c}' }, data: rows }]
  } }
}

interface Panels { work: ReportPanel<WorkReport>; faults: ReportPanel<FaultReport>; alerts: ReportPanel<AlertReport>; energy: ReportPanel<EnergyReport>; targets: ReportPanel<TargetReport> }
export function reportView(source: ReportSource, panels: Panels, energyType: string): ReportView {
  if (source === 'work') {
    const data = panels.work.data
    return {
      metrics: metrics([[feText('reportPlanned'), data?.total], [feText('completedTasks'), data?.completed], [feText('reportOnTimeRate'), data?.onTimeRate, '%'], [feText('reportOverdueOpen'), data?.overdue]]),
      note: feText('reportSnapshotNote'),
      main: trend(feText('reportWorkTrend'), data?.trend || [], ['onTime', 'late', 'dueIncomplete', 'notDue', 'closed', 'cancelled'], 'bar', '', true),
      left: horizontal(feText('reportGroupRates'), (data?.groups || []).map(row => ({ name: row.name, value: row.onTimeRate })), '%'),
      right: distribution(feText('reportCurrentWork'), data?.states || {})
    }
  }
  if (source === 'faults') {
    const data = panels.faults.data
    return {
      metrics: metrics([[feText('reportNewFaults'), data?.total], [feText('reportVerified'), data?.completed], [feText('reportOutstanding'), data?.outstanding], [feText('reportClosureHours'), data?.averageClosureHours]]),
      note: feText('reportFaultNote'), main: trend(feText('reportFaultTrend'), data?.trend || [], ['created', 'completed'], 'line'),
      left: horizontal(feText('reportFaultTop'), (data?.devices || []).map(row => ({ name: row.name, value: row.count ?? 0 }))),
      right: distribution(feText('reportFaultAge'), data?.ages || {})
    }
  }
  if (source === 'alerts') {
    const data = panels.alerts.data
    return {
      metrics: metrics([[feText('reportNewEvents'), data?.total], [feText('reportCriticalEvents'), data?.critical], [feText('pending'), data?.pending], [feText('recovered'), data?.recovered]]),
      note: feText('reportAlertNote'), main: trend(feText('reportAlertTrend'), data?.trend || [], data?.types || [], 'bar', '', true),
      left: horizontal(feText('reportAlertTop'), (data?.devices || []).map(row => ({ name: row.name, value: row.count ?? 0 }))),
      right: distribution(feText('reportAlertStates'), data?.states || {})
    }
  }
  const data = panels.energy.data, plan = panels.targets.data, unit = data?.summary.unit || (energyType === 'electricity' ? 'kWh' : 'm³'), color = colors[energyType as keyof typeof colors]
  return {
    metrics: metrics([[feText('reportEffectiveUsage'), data?.summary.value, ' ' + unit], [feText('reportDailyAverage'), data?.summary.dailyAverage, ' ' + unit], [feText('reportPreviousRate'), data?.summary.previousRate, '%'], [feText('reportPlanRate'), plan?.executionRate, '%']]),
    note: feText('reportMonthPlanScope'), main: trend(feText('reportUsageTrend') + ' · ' + energyNames[energyType], data?.trend || [], ['value'], 'line', unit, false, color),
    left: horizontal(feText('reportUsageTop'), (data?.devices || []).map(row => ({ name: row.name, value: row.usage?.value ?? null })), unit, color),
    right: horizontal(feText('reportPlanActual'), plan?.count ? [{ name: feText('target'), value: plan.target }, { name: feText('actual'), value: plan.actual }] : [], unit, color)
  }
}

export function reportCsv(view: ReportView, scope: { project: string; from: number; to: number; kind: string; energyType: string; level: string }) {
  const rows: unknown[][] = [[feText('businessProject'), scope.project], [feText('time'), new Date(scope.from).toISOString(), new Date(scope.to).toISOString()],
    [feText('type'), display(scope.kind)], [feText('energy'), energyNames[scope.energyType]], [feText('aggregationLevel'),
      ({ master: feText('masterMeter'), submeter: feText('submeter'), branch: feText('branch'), other: feText('other') } as Record<string, string>)[scope.level]],
    ...view.metrics.map(metric => [metric.title, metric.value]), [], [view.main.title], ...view.main.rows, [], [view.left.title], ...view.left.rows,
    ...(view.right ? [[], [view.right.title], ...view.right.rows] : [])]
  // CSV 单元格来自业务名称，避免电子表格把名称解释成公式。
  return rows.map(row => row.map(value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"').join(',')).join('\r\n')
}
