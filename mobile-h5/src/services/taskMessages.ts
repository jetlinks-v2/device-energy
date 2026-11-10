import type { TaskMessage } from '../../../shared/types'
export function messageTiming(row: TaskMessage, now: number): string {
  if (row.messageType === 'new') return '新任务'
  const minutes = Math.max(1, Math.ceil(Math.abs(row.deadline - now) / 60000))
  return now >= row.deadline ? `已超期${minutes}分钟` : `距结束还有${minutes}分钟`
}
