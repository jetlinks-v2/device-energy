import type { Entity } from './types'
import { feLocale, feText } from './i18n'
import type { TaskProcess } from './types'
export interface FacilityAlert extends Entity {
  name: string; deviceId?: string; targetId?: string; ruleType: string; energyType?: string
  state: string; processingState?: string; level: string; value?: number; threshold?: number; unit?: string
  firstTime?: number; lastTime?: number; recoveredTime?: number; occurrences?: number; episodeId?: string; comment?: string
  source?: string; sourceLevel?: number; sourceState?: string; sourceReason?: string; sourceCondition?: string
  deviceName?: string; spaceName?: string; sourceRecordId?: string
}
export const alertHandling = (state?: string) => state === 'closed' ? feText('alertHandled') : state === 'processing' || state === 'acknowledged' ? feText('alertHandlingNow') : feText('alertUnhandled')
export const alertHandlingColor = (state?: string) => state === 'closed' ? 'green' : state === 'processing' || state === 'acknowledged' ? 'blue' : 'orange'
/** 仅转换展示文案，保留平台原始条件，不将状态码猜成具体故障类型。 */
export function alertCondition(condition?: string): string {
  if (!condition) return '—'
  if (/^\s*故障状态\s*(?:is greater than|大于|>)\s*0\s*$/i.test(condition)) return feText('deviceFaultCondition')
  const operators: [string, string][] = [
    ['is greater than or equal to', feText('conditionGte')], ['is less than or equal to', feText('conditionLte')],
    ['is not equal to', feText('conditionNe')], ['is equal to', feText('conditionEq')],
    ['is greater than', feText('conditionGt')], ['is less than', feText('conditionLt')]
  ]
  return operators.reduce((text, [operator, label]) => text.replace(new RegExp(`\\b${operator}\\b`, 'gi'), label), condition)
}
export const alertSignal = (state: string, source?: string) => state === 'recovered' ? feText(source === 'saas' ? 'platformAlarmCleared' : 'alertRecovered') : feText('alertAbnormal')
/** 仅解释明确的故障上报；其他指标保留原值和比较方向。 */
export function alertReason(reason?: string): string {
  if (/^\s*故障状态\s*=\s*[1-9]\d*\s*$/.test(reason || '')) return feText('deviceFaultReported')
  return alertCondition(reason)
}
export function alertSummary(row: FacilityAlert): string {
  if (row.source !== 'saas') return alertValue(row.value, row.unit)
  const reason = row.sourceReason || row.sourceCondition || feText('platformDeviceAlarm')
  // 只解释明确的故障状态上报，不从数值猜测通信、传感器等具体故障类型。
  if (/^\s*故障状态\s*=\s*[1-9]\d*\s*$/.test(reason))
    return feText(row.state === 'recovered' ? 'deviceFaultReportedCleared' : 'deviceFaultReported')
  return alertReason(reason)
}
export interface PlatformAlarmLevel { level: number; title: string; i18nMessages?: Record<string, string> }
export function alertSeverity(row: FacilityAlert, levels: PlatformAlarmLevel[] = []): string {
  if (row.source !== 'saas') return feText(row.level === 'critical' ? 'criticalThreshold' : 'alertThreshold')
  const config = levels.find(item => item.level === row.sourceLevel)
  return config?.i18nMessages?.[feLocale()] || config?.title || `${feText('platformAlarmLevel')} ${row.sourceLevel ?? '—'}`
}
/** 与平台告警列表使用相同的等级配色；未配置等级不推断为本地严重。 */
export function alertColor(row: FacilityAlert): string | undefined {
  if (row.source !== 'saas') return row.level === 'critical' ? 'red' : 'orange'
  return ({ 1: '#e50012', 2: '#ff9457', 3: '#fabd47', 4: '#999999', 5: '#bbbbbb' } as Record<number, string>)[row.sourceLevel ?? -1]
}
export const alertTypes = () => [
  ['saas', feText('platformDeviceAlarm')], ['overdue', feText('taskOverdueReminder')], ['dueSoon', feText('taskDueSoonReminder')],
  ['offline', feText('deviceOffline')], ['stale', feText('reportingInterrupted')], ['instant', feText('instantaneousMetric')],
  ['balance', feText('actualBalanceRemainingQuantity')], ['usage', feText('usage')], ['reading-anomaly', feText('readingAnomaly')],
  ['state', feText('abnormalState')], ['plan', feText('monthlyEnergyPlanProgressPercent')]
].map(([value, label]) => ({ value, label }))
export const alertType = (value: string) => alertTypes().find(row => row.value === value)?.label || value

/** Keep protocol units in storage; translate known duration units only at the display boundary. */
export function alertValue(value?: number, unit?: string): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const suffix = unit === 'seconds' ? feText('seconds') : unit || ''
  return `${Number(value.toFixed(2))}${suffix ? ' ' + suffix : ''}`
}

/** 历史消息只描述当时的故障上报，不推断设备当前状态，不改写存储内容。 */
export function alertMessage(message?: string): string {
  return (message || '').split(/([·\r\n]+)/).map(part => part.replace(/^(\s*)故障状态\s*=\s*[1-9]\d*(\s*)$/, (_, before: string, after: string) => before + feText('deviceFaultRecorded') + after))
    .join('').replace(/(\d)\s*seconds\b/g, (_, value: string) => `${value} ${feText('seconds')}`)
}

export function alertProcess(log: TaskProcess, unit?: string): string {
  const key = log.action === 'trigger' ? 'alertTriggered' : log.action === 'escalate' ? 'alertEscalated' : log.action === 'recover' ? 'alertRecovered' : undefined
  if (!key) return log.comment || alertHandling(log.toState)
  const value = log.comment?.trim()
  return feText(key) + (value && Number.isFinite(Number(value)) ? ` · ${alertValue(Number(value), unit)}` : value ? ` · ${alertMessage(value)}` : '')
}
