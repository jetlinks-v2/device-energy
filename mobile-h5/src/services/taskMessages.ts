import type { TaskMessage, Term } from '../../../shared/types'
export type MessageCategory = 'all' | 'task' | 'fault' | 'alert' | 'review'
/** 分类条件交给服务端分页，避免本页筛选漏掉后续消息。 */
export function messageTerms(category: MessageCategory): Term[] {
  if (category === 'review') return [{ column: 'messageType', termType: 'in', value: ['task:review', 'fault:acceptance'] }]
  const column = { task: 'taskId', fault: 'faultId', alert: 'alertId' }[category as 'task' | 'fault' | 'alert']
  return column ? [{ column, termType: 'notnull', value: true }] : []
}
export function messageTarget(row: TaskMessage): string | undefined {
  if (row.faultId) return '/faults/' + encodeURIComponent(row.faultId)
  if (row.alertId) return '/alerts/' + encodeURIComponent(row.alertId)
  if (row.taskId) return '/tasks/' + encodeURIComponent(row.taskId)
}
export function messageTiming(row: TaskMessage, now: number): string {
  const lifecycle: Record<string, string> = {
    'task:transfer': '待处理', 'task:review': '待审批', 'task:reject': '待整改', 'task:approve': '已通过', 'task:close': '已关闭',
    'fault:assigned': '待接单', 'fault:acceptance': '待验收', 'fault:rejected': '需重做', 'fault:accepted': '已验收', 'fault:closed': '已关闭',
  }
  if (lifecycle[row.messageType]) return lifecycle[row.messageType]
  if (row.faultId) return '维修消息'
  if (row.alertId) return '设备预警'
  if (row.messageType === 'new') return '新任务'
  if (!row.taskId || !row.deadline) return '通知消息'
  const minutes = Math.max(1, Math.ceil(Math.abs(row.deadline - now) / 60000))
  return now >= row.deadline ? `已超期${minutes}分钟` : `距结束还有${minutes}分钟`
}
