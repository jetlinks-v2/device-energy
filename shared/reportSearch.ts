import type { Term } from './types'

/** 报表接口接收单一项目及时间段，拒绝无法表达的 OR、重复条件，避免显示与统计口径不一致。 */
export function reportFilterValues(terms: Term[]) {
  const values: Record<string, unknown> = {}
  const visit = (nodes: Term[]): boolean => nodes.every(term => {
    if (term.type === 'or') return false
    if (term.terms) return visit(term.terms)
    const column = term.column
    if (!column || Object.hasOwn(values, column) || !['projectId', 'level', 'timeRange', 'period', 'year', 'month'].includes(column)) return false
    if ((term.termType || 'eq') !== (column === 'timeRange' ? 'btw' : 'eq')) return false
    values[column] = term.value
    return true
  })
  if (!visit(terms)) return undefined
  if (values.projectId !== undefined && (typeof values.projectId !== 'string' || !values.projectId.trim())) return undefined
  if (values.level !== undefined && !['master', 'submeter', 'branch', 'other'].includes(String(values.level))) return undefined
  if (values.period !== undefined && !['day', 'month', 'year'].includes(String(values.period))) return undefined
  const range = values.timeRange
  if (range !== undefined && (!Array.isArray(range) || range.length !== 2 || !range.every(value => Number.isFinite(Number(value))) || Number(range[0]) >= Number(range[1]))) return undefined
  if (values.year !== undefined && (!Number.isInteger(Number(values.year)) || Number(values.year) < 2000 || Number(values.year) > 2200)) return undefined
  if (values.month !== undefined && (!Number.isInteger(Number(values.month)) || Number(values.month) < 1 || Number(values.month) > 12)) return undefined
  return {
    projectId: typeof values.projectId === 'string' ? values.projectId : undefined,
    level: typeof values.level === 'string' ? values.level : undefined,
    from: Array.isArray(range) ? Number(range[0]) : undefined,
    to: Array.isArray(range) ? Number(range[1]) : undefined,
    period: typeof values.period === 'string' ? values.period : undefined,
    year: values.year === undefined ? undefined : Number(values.year),
    month: values.month === undefined ? undefined : Number(values.month)
  }
}
