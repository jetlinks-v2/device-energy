import type { Context, Task } from '../../../shared/types'
import { randomId } from '../utils/randomId.ts'

interface ScanAccess { scope: string; groupId: string; rows: { id: string; parentTaskId?: string; version: number }[] }
const access = new Map<string, ScanAccess>()
const scopeKey = (scope: Context) => JSON.stringify([scope.tenantId, scope.applicationId, scope.userId])

/** 执行入口只接受本次扫码产生的内存许可；刷新、账号切换或任务版本变化后需重新扫码。 */
export function issueTaskScanAccess(scope: Context, rows: Task[], groupId = '') {
  const id = randomId()
  if (access.size >= 100) access.delete(access.keys().next().value!)
  access.set(id, { scope: scopeKey(scope), groupId, rows: rows.map(row => ({ id: row.id, parentTaskId: row.parentTaskId, version: row.version })) })
  return id
}
export function taskScanAllowed(scope: Context | undefined, task: Task | undefined, id: unknown, groupId?: string): boolean {
  if (!scope || !task || typeof id !== 'string' || task.assigneeId !== scope.userId ||
    !['claimed', 'executing', 'rectify'].includes(task.state)) return false
  const permit = access.get(id)
  return permit?.scope === scopeKey(scope) && (!groupId || permit.groupId === groupId) && permit.rows.some(row => row.id === task.id &&
    row.parentTaskId === task.parentTaskId && row.version === task.version)
}
export function clearTaskScanAccess() { access.clear() }
