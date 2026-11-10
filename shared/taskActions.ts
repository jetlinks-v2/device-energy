import { feText } from './i18n'
import type { Task } from './types'
/** 操作可见性仅辅助交互，执行时由服务端再校验身份、版本和状态。 */
export function taskActions(task: Task, userId: string, claimable = false): string[] {
  const actions: string[] = []
  if (task.state === 'open' && claimable && !task.parentTaskId) actions.push('claim')
  if (task.assigneeId === userId && ['claimed', 'rectify'].includes(task.state)) actions.push('start')
  if (!task.parentTaskId && task.reviewerId === userId && ['review', 'external-submitted'].includes(task.state)) actions.push('approve', 'reject')
  return actions
}
export const canExecute = (task: Task, userId: string) =>
  task.assigneeId === userId && ['claimed', 'executing', 'rectify'].includes(task.state)
export const canTransfer = (task: Task) => ['open', 'claimed', 'executing', 'rectify'].includes(task.state)
export const canWithdraw = (task: Task) => !['completed', 'cancelled', 'closed'].includes(task.state)
export const actionNames: Record<string, string> = {
  claim: feText('claim'),
  start: feText('startExecution'),
  approve: feText('approve'),
  reject: feText('returnForRectification'),
  transfer: feText('taskTransferred'),
  generate: feText('taskCreated'),
  submit: feText('taskSubmitted'),
  follow: feText('taskFollowed'),
  cancel: feText('taskClosed'),
  close: feText('taskClosed')
}
