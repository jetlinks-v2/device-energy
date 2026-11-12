import { feText } from './i18n'
import { display, type Entity, type Option } from './types'

export const operationTargets: Option[] = [
  { value: 'reading', label: feText('logReading') },
  { value: 'replacement', label: feText('meterReplacementAndReset') },
  { value: 'fault', label: feText('deviceFaults') },
  { value: 'task', label: feText('inspectionMaintenanceTask') },
  { value: 'device', label: feText('device') },
  { value: 'binding', label: feText('logBinding') },
  { value: 'alert', label: feText('energyAlert') },
  { value: 'meterBill', label: feText('logMeterBill') },
  { value: 'configuration', label: feText('configuration') },
]
export const operationActions: Option[] = [
  { value: 'create', label: feText('add') },
  { value: 'update', label: feText('edit') },
  { value: 'delete', label: feText('delete') },
  { value: 'approve', label: feText('approve') },
  { value: 'review', label: feText('approve') },
  { value: 'reject', label: feText('reject') },
  { value: 'resubmit', label: feText('logResubmit') },
  { value: 'claim', label: feText('claim') },
  { value: 'dispatch', label: feText('dispatchTask') },
  { value: 'transfer', label: feText('taskTransferred') },
  { value: 'start', label: feText('startProcessing') },
  { value: 'submit', label: feText('taskSubmitted') },
  { value: 'resolve', label: feText('submitForVerification') },
  { value: 'close', label: feText('close') },
  { value: 'cancel', label: feText('cancel') },
  { value: 'generate', label: feText('taskCreated') },
  { value: 'follow', label: feText('taskFollowed') },
  { value: 'recalculate', label: feText('meterRecalculate') },
  { value: 'failed', label: feText('failed') },
  { value: 'confirm-project', label: feText('logConfirmProject') },
  { value: 'bind', label: feText('logBind') },
  { value: 'trigger', label: feText('logTrigger') },
  { value: 'recover', label: feText('recovered') },
  { value: 'handle', label: feText('process') },
  { value: 'end', label: feText('logEndBinding') },
]

/** 已落库的旧日志把新申请编号存在 comment；只在该明确场景转换显示，保留原记录供追溯。 */
export function resubmissionRecordId(row: Entity): string | undefined {
  return row.targetType === 'reading' && row.action === 'resubmit' && typeof row.comment === 'string'
    && /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(row.comment)
    ? row.comment : undefined
}
export const operationComment = (row: Entity): string =>
  resubmissionRecordId(row) ? feText('logResubmit') : String(row.comment || '—')

/** 状态属于对应业务；项目确认日志的 toState 实际是项目ID，不能作为工单状态翻译。 */
export function operationStateText(row: Entity, key: 'fromState' | 'toState'): string {
  const value = row[key]
  if (!value) return '—'
  if (row.action === 'confirm-project') return String(row.projectName || value)
  if (row.targetType === 'fault') {
    if (value === 'open') return feText('logAwaitingDispatch')
    if (value === 'assigned') return feText('logAwaitingClaim')
    if (value === 'review') return feText('logAwaitingVerification')
  }
  if (value === 'pending' && ['reading', 'replacement', 'meterBill'].includes(String(row.targetType))) return feText('awaitingReview')
  return display(value)
}
