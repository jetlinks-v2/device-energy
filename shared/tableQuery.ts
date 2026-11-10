import type { Entity, Pager, Query, Term } from './types'

/** 固定业务类型始终与用户条件取交集，用户的 OR 分组不能越过巡检／维保边界。 */
export function resourceQuery(query: Query, kind?: string): Query {
  return {
    ...query,
    terms: [
      ...(kind ? [{ column: 'kind', value: kind }] : []),
      ...(query.terms?.length ? [{ type: 'and', terms: query.terms }] : [])
    ]
  }
}

export function localTablePage<T>(rows: T[], query: Query): Pager<T> {
  const pageSize = Math.max(1, Number(query.pageSize) || 12)
  const pageIndex = Math.max(0, Number(query.pageIndex) || 0)
  return { data: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), total: rows.length, pageIndex, pageSize }
}

export function selectedProject(terms: Term[]): string | undefined {
  const selected: string[] = []
  // 仅确定的单项目 AND 条件能成为新增默认值，多项目或 OR 查询不能替用户选项目。
  const visit = (nodes: Term[]): boolean => nodes.every(term => {
    if (term.type === 'or') return false
    if (term.terms) return visit(term.terms)
    if (term.column !== 'projectId') return true
    const value = term.termType === 'in' && Array.isArray(term.value) && term.value.length === 1 ? term.value[0] : term.value
    if (!['eq', 'in'].includes(term.termType || 'eq') || typeof value !== 'string') return false
    selected.push(value)
    return true
  })
  return visit(terms) && selected.length === 1 ? selected[0] : undefined
}

export interface TableHandle {
  reload: (query?: Query) => void
}
