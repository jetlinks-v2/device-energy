import type { Entity } from './types'
import { feText } from './i18n'

export interface Fault extends Entity {
  deviceId: string; deviceName: string; state: string; description: string
  assigneeId?: string; assigneeName?: string; reviewerId?: string; reviewerName?: string
  priority: 'normal' | 'urgent'; category?: string; deadline?: number
  sourceType?: string; sourceId?: string; resolution?: string; closeReason?: string
  attachments: string[]; resolutionAttachments: string[]; completedTime?: number
}
export interface FaultCommand { version: number; comment?: string; userId?: string; attachments?: string[] }
export const faultStates = () => [
  { value: 'open', label: feText('faultPendingDispatch'), color: 'default' },
  { value: 'assigned', label: feText('faultPendingClaim'), color: 'blue' },
  { value: 'claimed', label: feText('faultClaimed'), color: 'cyan' },
  { value: 'processing', label: feText('faultProcessing'), color: 'processing' },
  { value: 'review', label: feText('faultPendingAcceptance'), color: 'purple' },
  { value: 'closed', label: feText('faultCompleted'), color: 'green' },
  { value: 'cancelled', label: feText('faultClosed'), color: 'default' }
]
export const faultState = (value: string) => faultStates().find(item => item.value === value)
export const faultActions = (row: Fault, actor: string) => {
  if (['closed', 'cancelled'].includes(row.state)) return []
  const result: string[] = []
  if (row.state === 'open') result.push('dispatch')
  else if (['assigned', 'claimed', 'processing'].includes(row.state)) result.push('transfer')
  if (row.assigneeId === actor) {
    if (row.state === 'assigned') result.push('claim')
    if (row.state === 'claimed') result.push('start')
    if (row.state === 'processing') result.push('resolve')
  }
  if (row.state === 'review' && row.assigneeId !== actor && (!row.reviewerId || row.reviewerId === actor)) result.push('approve', 'reject')
  return [...result, 'reviewer', 'close']
}
export const faultActionText = (action: string) => feText(({
  create: 'faultRegister', dispatch: 'faultDispatch', transfer: 'faultTransfer', claim: 'faultClaim', start: 'faultStart',
  reviewer: 'faultChangeReviewer', resolve: 'faultSubmitAcceptance', approve: 'faultAccept', reject: 'faultReject', close: 'faultClose'
} as Record<string, Parameters<typeof feText>[0]>)[action] || 'faultActionComment')
export const faultOverdue = (row: Fault, now = Date.now()) => !!row.deadline && row.deadline < now && !['closed', 'cancelled'].includes(row.state)

export const faultCategories = () => [
  ['mechanical', feText('faultCategory_mechanical')], ['electrical', feText('faultCategory_electrical')],
  ['communication', feText('faultCategory_communication')], ['leakage', feText('faultCategory_leakage')], ['other', feText('faultCategory_other')]
].map(([value, label]) => ({ value, label }))
