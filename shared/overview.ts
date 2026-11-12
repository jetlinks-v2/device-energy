import type { ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { Option, Usage } from './types'

export type OverviewTaskDestination = 'inspection' | 'maintenance' | 'alerts' | 'notifications'
export interface OverviewTaskState {
  counts: Record<string, number | undefined>
  access: Record<OverviewTaskDestination, boolean>
  reviewAccess: Record<'inspection' | 'maintenance', boolean>
  projectId?: string
  projects: Option[]
}

export interface OverviewEnergyRow {
  energyType: string
  unit: string
  usage: Usage
}

/** 每次只统计一个层级；自动选择以配置存在为准，不用缺失读数触发降级。 */
export async function loadOverviewEnergy<T>(load: (level: string) => Promise<T[]>, level = 'auto') {
  const levels = level === 'auto' ? ['master', 'submeter', 'branch', 'other'] : [level]
  for (const candidate of levels) {
    const rows = await load(candidate)
    if (rows.length) return { rows, level: candidate }
  }
  return { rows: [] as T[], level: levels[0] }
}

/** 只汇总同类单位；缺读数或单位不兼容不能被包装成完整的零用量。 */
export function overviewEnergy(rows: OverviewEnergyRow[], type: string) {
  const meters = rows.filter(row => row.energyType === type)
  const compatible = (unit: string) => type === 'electricity'
    ? ['kwh', 'kw·h', 'kw.h'].includes(unit.trim().toLowerCase())
    : ['m³', 'm3'].includes(unit.trim().toLowerCase())
  const invalidUnit = meters.some(row => !compatible(row.unit || ''))
  const valid = meters.every(row => row.usage.value != null && Number.isFinite(Number(row.usage.value)))
  return {
    value: meters.length && valid && !invalidUnit ? meters.reduce((sum, row) => sum + Number(row.usage.value), 0) : undefined,
    complete: meters.length > 0 && valid && !invalidUnit && meters.every(row => row.usage.complete),
    invalidUnit,
    count: meters.length,
    unit: type === 'electricity' ? 'kWh' : 'm³'
  }
}

/** 工作台下钻条件与服务端统计一致，今天固定按上海时区计算。 */
export function overviewTerms(resource: string, query: Record<string, unknown>, now = Date.now()): ConditionFilterTerm[] {
  const terms: ConditionFilterTerm[] = typeof query.projectId === 'string' && query.projectId
    ? [{ column: 'projectId', termType: 'eq', value: query.projectId }] : []
  const focus = query.overview
  if (resource === 'tasks' && focus === 'claim')
    terms.push({ column: 'state', termType: 'eq', value: 'open' })
  if (resource === 'tasks' && focus === 'progress')
    terms.push({ column: 'state', termType: 'in', value: ['claimed', 'executing', 'rectify'] })
  if (resource === 'tasks' && focus === 'overdue') terms.push(
    { column: 'deadline', termType: 'lt', value: now },
    { column: 'state', termType: 'nin', value: ['completed', 'cancelled', 'closed'] }
  )
  if (resource === 'tasks' && focus === 'today') {
    const start = Math.floor((now + 28800000) / 86400000) * 86400000 - 28800000
    terms.push({ column: 'scheduledTime', termType: 'gte', value: start },
      { column: 'scheduledTime', termType: 'lt', value: start + 86400000 },
      { column: 'state', termType: 'nin', value: ['cancelled', 'closed'] })
  }
  if (['alerts', 'planAlerts'].includes(resource) && focus === 'alerts')
    terms.push({ column: 'state', termType: 'nin', value: ['closed', 'recovered'] })
  if (['notifications', 'planNotifications'].includes(resource) && focus === 'failed')
    terms.push({ column: 'state', termType: 'in', value: ['failed', 'uncertain'] })
  return terms
}
