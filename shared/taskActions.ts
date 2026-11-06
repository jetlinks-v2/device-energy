import { feText } from './i18n'
import type { Task } from './types'
/** 操作可见性仅辅助交互，执行时由服务端再校验身份、版本和状态。 */
export function taskActions(task: Task, userId: string): string[] {
  const actions: string[] = []
  if (task.state === 'open') actions.push('claim')
  if (task.assigneeId === userId && ['claimed', 'rectify'].includes(task.state)) actions.push('start')
  if (task.reviewerId === userId && task.state === 'review') actions.push('approve', 'reject')
  return actions
}
export const canExecute = (task: Task, userId: string) =>
  (task.assigneeId === userId && ['claimed', 'executing', 'rectify'].includes(task.state)) ||
  (task.followUserId === userId && task.state === 'external-submitted')
export const canTransfer = (task: Task) => ['open', 'claimed', 'executing', 'rectify'].includes(task.state)
export const canWithdraw = (task: Task) => !['completed', 'cancelled'].includes(task.state)
export const actionNames: Record<string, string> = {
  claim: feText('claim'),
  start: feText('startExecution'),
  approve: feText('approve'),
  reject: feText('returnForRectification'),
  transfer: feText('reassign'),
  cancel: feText('withdraw')
}
