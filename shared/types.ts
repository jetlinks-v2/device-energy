import { feLocale, feText } from './i18n'
/** PC与两类H5共享的业务契约，服务端拥有身份、权限及状态转换。 */
export interface Term {
  column?: string
  value?: unknown
  termType?: string
  type?: string
  terms?: Term[]
}
export interface Query {
  pageIndex?: number
  pageSize?: number
  terms?: Term[]
  sorts?: { name: string; order: string }[]
}
export interface Pager<T> {
  data: T[]
  total: number
  pageIndex: number
  pageSize: number
}
export interface Entity {
  id: string
  version: number
  name?: string
  projectId?: string
  projectName?: string
  createTime?: number
  state?: string
  [key: string]: unknown
}
export interface Device extends Entity {
  cloudDeviceId: string
  sourceName: string
  sourceState: string
  syncState: string
  energyEnabled: boolean
  inspectionEnabled: boolean
  maintenanceEnabled: boolean
  candidateProjectIds: string[]
}
export interface Option {
  value: string
  label: string
  parentId?: string
}
export interface CheckItem {
  id: string
  name: string
  kind: string
  required: boolean
  photoRequired: boolean
  minimum?: number
  maximum?: number
  options?: string[]
}
export interface CheckResult {
  itemId: string
  value: string
  abnormal: boolean
  remark?: string
  attachments: string[]
}
export interface Metric {
  propertyId: string
  name: string
  kind: string
  unit: string
  multiplier: number
  scale: number
}
export interface Task extends Entity {
  projectId: string
  kind: string
  deviceId: string
  deviceName: string
  mode: string
  assigneeId?: string
  followUserId?: string
  reviewerId: string
  deadline: number
  state: string
  standardSnapshot: CheckItem[]
  results: CheckResult[]
  followResults: CheckResult[]
  instructionSnapshot?: string
  instructionAttachments: string[]
}
export interface TaskCommand {
  version: number
  userId?: string
  comment?: string
  results?: CheckResult[]
  submissionId?: string
}
export interface Usage {
  value: number
  complete: boolean
  accepted: number
  anomalies: number
  firstTime?: number
  lastTime?: number
}
export interface Reading extends Entity {
  propertyId: string
  observedTime: number
  value?: number
  textValue?: string
  unit: string
  metricKind: string
  status: string
}
export interface MetricView {
  stale?: boolean
  propertyId: string
  name: string
  kind: string
  unit: string
  readings: { time: number; value: number | string }[]
  usage?: Usage
}
export interface OwnerMeter {
  bindingId: string
  deviceId: string
  name: string
  spaceId: string
  startTime: number
  endTime?: number
  current: boolean
}
export interface OwnerDetail {
  energyType: string
  from: number
  to: number
  metrics: MetricView[]
}
export interface Context {
  tenantId: string
  applicationId: string
  userId: string
  userName: string
}
export interface Authorization {
  user: { id: string; name?: string }
  permissions: { id: string; actions: string[] }[]
}
export interface FileInfo {
  id: string
  name?: string
}
export type FormValue = string | number | boolean | string[] | CheckItem[] | Metric[] | undefined
export type FormValues = Record<string, FormValue>
export interface Field {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'multi' | 'tree' | 'date' | 'datetime' | 'checks' | 'metrics' | 'files'
  required?: boolean
  options?: Option[]
  source?: string
}
export interface Resource {
  path: string
  title: string
  fields: Field[]
  columns: { key: string; title: string }[]
  defaults?: FormValues
  readonly?: boolean
  collection?: boolean
}
export const time = (value: unknown) =>
  typeof value === 'number'
    ? new Date(value).toLocaleString(feLocale() === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—'
/** Cursor lag is collection backlog, not a claim that devices have stopped reporting. */
export const collectionLag = (row: Entity, now = Date.now()): number | string =>
  row.enabled && typeof row.lastCollectedTime === 'number'
    ? Math.max(0, Math.ceil((now - row.lastCollectedTime) / 60000))
    : '—'
export const messageOf = (e: unknown): string => {
  // Axios rejects HTTP errors before unwrap; retain the server's translated business reason.
  if (e && typeof e === 'object' && 'response' in e) {
    const response = e.response
    if (response && typeof response === 'object' && 'data' in response) {
      const data = response.data
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message
    }
  }
  return e instanceof Error ? e.message : feText('operationFailedPleaseTryAgain')
}
export const energyNames: Record<string, string> = { water: feText('water'), electricity: feText('electricity'), gas: feText('gas') }
export const states: Record<string, string> = {
  active: feText('normal'),
  inactive: feText('disabled'),
  'pending-project': feText('projectConfirmationRequired'),
  'source-unavailable': feText('sourceVerificationRequired'),
  open: feText('awaitingClaim'),
  claimed: feText('claimed'),
  executing: feText('executing'),
  rectify: feText('rectifying'),
  'external-submitted': feText('awaitingInternalFollowUp'),
  review: feText('awaitingReview'),
  completed: feText('completed'),
  cancelled: feText('cancelled'),
  pending: feText('pending'),
  accepted: feText('effective'),
  rejected: feText('notApproved'),
  invalid: feText('invalid'),
  superseded: feText('corrected'),
  processing: feText('processing'),
  acknowledged: feText('acknowledged'),
  closed: feText('closed'),
  recovered: feText('recovered'),
  generated: feText('generated'),
  sent: feText('sent'),
  submitted: feText('smsAccepted'),
  delivered: feText('smsDelivered'),
  failed: feText('failed'),
  sending: feText('submitting'),
  uncertain: feText('submissionOutcomeUncertain'),
  success: feText('successful'),
  idle: feText('idle'),
  running: feText('running'),
  approved: feText('reviewed'),
  online: feText('online'),
  offline: feText('offline'),
  notActive: feText('notActivated'),
  near: feText('approachingThreshold'),
  warning: feText('warning'),
  critical: feText('critical'),
  single: feText('singleWorkOrder'),
  double: feText('dualWorkOrder'),
  counter: feText('cumulativeReading'),
  increment: feText('periodIncrement'),
  instant: feText('instantaneousMetric'),
  balance: feText('actualBalanceRemainingQuantity'),
  state: feText('status'),
  inspection: feText('inspection'),
  maintenance: feText('maintenance'),
  sms: feText('sms'),
  h5: feText('ownerMessage'),
  inside: feText('staffInbox'),
  manual: feText('manualRegistration'),
  task: feText('inspectionMaintenanceTask'),
  alert: feText('energyAlert')
}
export const display = (v: unknown): string =>
  v == null
    ? '—'
    : typeof v === 'boolean'
      ? v
        ? feText('enabled')
        : feText('disabled')
      : states[String(v)] || energyNames[String(v)] || String(v)

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
