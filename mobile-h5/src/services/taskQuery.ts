import type { Query, Task, Term } from '../../../shared/types'

export interface TaskFilter {
  projectId?: string
  kind?: string
  status?: string
  search?: string
  from?: number
  to?: number
  deviceIds?: string[]
}
const active = ['claimed', 'executing', 'rectify']
/** Same filters drive online paging and downloaded tasks; overdue is derived from deadline. */
export function taskQuery(filter: TaskFilter, pageIndex = 0, now = Date.now()): Query {
  const terms: Term[] = []
  if (filter.projectId) terms.push({ column: 'projectId', value: filter.projectId })
  if (filter.kind) terms.push({ column: 'kind', value: filter.kind })
  if (filter.deviceIds) terms.push({ column: 'deviceId', termType: 'in', value: filter.deviceIds })
  const status = filter.status || ''
  if (status === 'active') terms.push({ column: 'state', termType: 'in', value: active })
  else if (status === 'overdue') terms.push(
    { column: 'state', termType: 'in', value: active }, { column: 'deadline', termType: 'lt', value: now })
  else if (status === 'upcoming') terms.push(
    { column: 'state', termType: 'in', value: active }, { column: 'scheduledTime', termType: 'gt', value: now })
  else if (status) terms.push({ column: 'state', value: status })
  if (filter.search?.trim()) terms.push({ terms: [
    { column: 'name', termType: 'like', value: '%' + filter.search.trim() + '%' },
    { column: 'deviceName', termType: 'like', value: '%' + filter.search.trim() + '%', type: 'or' }
  ] })
  if (filter.from != null) terms.push({ column: 'scheduledTime', termType: 'gte', value: filter.from })
  if (filter.to != null) terms.push({ column: 'scheduledTime', termType: 'lte', value: filter.to })
  return { pageIndex, pageSize: 20, terms, sorts: [{ name: 'scheduledTime', order: 'desc' }, { name: 'id', order: 'asc' }] }
}
export function matchesTask(task: Task, filter: TaskFilter, now = Date.now()) {
  if (filter.projectId && task.projectId !== filter.projectId) return false
  if (filter.kind && task.kind !== filter.kind) return false
  if (filter.deviceIds && !filter.deviceIds.includes(task.deviceId)) return false
  if (filter.search?.trim() && ![task.name, task.deviceName].some(v => v?.toLowerCase().includes(filter.search!.trim().toLowerCase()))) return false
  if (filter.from != null && task.scheduledTime < filter.from) return false
  if (filter.to != null && task.scheduledTime > filter.to) return false
  switch (filter.status) {
    case 'active': return active.includes(task.state)
    case 'overdue': return active.includes(task.state) && task.deadline < now
    case 'upcoming': return active.includes(task.state) && task.scheduledTime > now
    default: return !filter.status || task.state === filter.status
  }
}
export const overdue = (task: Task) => active.includes(task.state) && task.deadline < Date.now()
