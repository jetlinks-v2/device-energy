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
export const alertSignal = (state: string, source?: string) => state === 'recovered' ? feText(source === 'saas' ? 'platformAlarmCleared' : 'alertRecovered') : feText('alertAbnormal')
export const alertSummary = (row: FacilityAlert) => row.source === 'saas' ? row.sourceReason || row.sourceCondition || feText('platformDeviceAlarm') : alertValue(row.value, row.unit)
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

/** Older notifications contain the protocol unit in their saved message. */
export function alertMessage(message?: string): string {
  return (message || '').replace(/(\d)\s*seconds\b/g, (_, value: string) => `${value} ${feText('seconds')}`)
}

export function alertProcess(log: TaskProcess, unit?: string): string {
  const key = log.action === 'trigger' ? 'alertTriggered' : log.action === 'escalate' ? 'alertEscalated' : log.action === 'recover' ? 'alertRecovered' : undefined
  if (!key) return log.comment || alertHandling(log.toState)
  const value = log.comment?.trim()
  return feText(key) + (value && Number.isFinite(Number(value)) ? ` · ${alertValue(Number(value), unit)}` : value ? ` · ${value}` : '')
}
