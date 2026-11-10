import type { CycleRule, RuleWindow } from './types'
import { ruleSummaryRows, ruleQuantity } from './rules'

export type TimeUnit = '1' | '2' | '3'
export interface PeriodDraft {
  start: string
  end: string
  frequency: number | null
  frequencyUnit: TimeUnit
  times: number | null
  interval: number | null
  intervalUnit: TimeUnit
  warning: number | null
  warningUnit: TimeUnit
}
export interface WeekRuleDraft { days: number[]; periods: PeriodDraft[] }
export interface DateRuleDraft { date: string; periods: PeriodDraft[]; legacyRest?: boolean }
export interface RuleDraft { weekRules: WeekRuleDraft[]; dateRules: DateRuleDraft[] }
export interface RuleIssue { key: string; values?: Record<string, string | number> }
export const unitMinutes = (unit: TimeUnit) => ({ '1': 1, '2': 60, '3': 1440 })[unit]
export function defaultPeriod(): PeriodDraft {
  return { start: '00:00', end: '00:00', frequency: 1, frequencyUnit: '2', times: 1, interval: 1, intervalUnit: '2', warning: null, warningUnit: '1' }
}
export const defaultRule = (): CycleRule => ({
  weekly: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), [{
    startMinute: 0, endMinute: 0, intervalMinutes: 60, requiredCount: 1,
    cooldownMinutes: 60, frequencyUnit: '2', cooldownUnit: '2',
  }]])), dates: {},
})
const minuteText = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
export function minuteOf(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}
function periodDraft(window: RuleWindow, globalCooldown: number): PeriodDraft {
  const cooldown = window.cooldownMinutes ?? globalCooldown
  const frequencyUnit = ruleQuantity(window.intervalMinutes, window.frequencyUnit).unit
  const intervalUnit = ruleQuantity(cooldown, window.cooldownUnit).unit
  return {
    start: minuteText(window.startMinute), end: minuteText(window.endMinute),
    frequency: window.intervalMinutes / unitMinutes(frequencyUnit), frequencyUnit,
    warning: window.warningMinutes == null ? null : ruleQuantity(window.warningMinutes, window.warningUnit).value,
    warningUnit: ruleQuantity(window.warningMinutes ?? 0, window.warningUnit).unit,
    times: window.requiredCount, interval: cooldown / unitMinutes(intervalUnit), intervalUnit,
  }
}
/** 仅在打开编辑器时将相同星期合为规则卡；输入中的空规则和冲突由草稿保存，不被 map 合并丢失。 */
export function ruleDraft(rule: CycleRule): RuleDraft {
  const rows = ruleSummaryRows(rule)
  return {
    weekRules: rows.filter(row => !row.date).map(row => ({ days: [...row.days],
      periods: row.windows.map(w => periodDraft(w, 0)) })),
    dateRules: rows.filter(row => row.date).map(row => ({ date: row.date!, legacyRest: !row.windows.length,
      periods: row.windows.map(w => periodDraft(w, 0)) })),
  }
}
export function periodCount(period: PeriodDraft): number {
  const start = minuteOf(period.start), end = minuteOf(period.end)
  const duration = end > start ? end - start : end + 1440 - start
  const frequency = Number(period.frequency) * unitMinutes(period.frequencyUnit)
  return frequency > 0 ? Math.floor(duration / frequency) * Number(period.times) : 0
}
function toWindow(p: PeriodDraft): RuleWindow {
  return {
    startMinute: minuteOf(p.start), endMinute: minuteOf(p.end),
    intervalMinutes: Number(p.frequency) * unitMinutes(p.frequencyUnit), requiredCount: Number(p.times),
    cooldownMinutes: Number(p.interval) * unitMinutes(p.intervalUnit), frequencyUnit: p.frequencyUnit,
    cooldownUnit: p.intervalUnit, warningMinutes: p.warning == null ? undefined : Number(p.warning) * unitMinutes(p.warningUnit), warningUnit: p.warning == null ? undefined : p.warningUnit,
  }
}
export function serializeRule(draft: RuleDraft): CycleRule {
  const weekly: CycleRule['weekly'] = {}, dates: CycleRule['dates'] = {}
  for (const row of draft.weekRules) for (const day of row.days) weekly[day] = row.periods.map(toWindow)
  for (const row of draft.dateRules) dates[row.date] = row.periods.map(toWindow)
  return { weekly, dates }
}
const issue = (name: string, values?: RuleIssue['values']): RuleIssue => ({ key: `FacilityEnergy.ruleEditor.errors.${name}`, values })
function periodIssue(p: PeriodDraft): RuleIssue | undefined {
  const start = minuteOf(p.start), end = minuteOf(p.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return issue('time')
  const validPositive = (n: number | null) => n !== null && Number.isInteger(n) && n >= 1 && n <= 100
  if (!validPositive(p.frequency) || !validPositive(p.times)
    || !(validPositive(p.interval))) return issue('number')
  const count = periodCount(p)
  if (count < 1 || count > 10000 || (count > 1 && Number(p.interval) * unitMinutes(p.intervalUnit) > Number(p.frequency) * unitMinutes(p.frequencyUnit) / Number(p.times))) return issue('capacity')
  const duration = Number(p.frequency) * unitMinutes(p.frequencyUnit) / Number(p.times)
  const warning = Number(p.warning) * unitMinutes(p.warningUnit)
  if (p.warning == null || !Number.isFinite(warning) || warning <= 0) return issue('warningRequired')
  if (warning < duration / 2 || warning >= duration) return issue('warningRange', { min: duration / 2, max: duration })
}
const endOf = (w: RuleWindow) => w.endMinute <= w.startMinute ? w.endMinute + 1440 : w.endMinute
function dayOverlaps(today: RuleWindow[], previous: RuleWindow[]) {
  const spans = [...today.map(w => [w.startMinute, Math.min(1440, endOf(w))]),
    ...previous.filter(w => endOf(w) > 1440).map(w => [0, endOf(w) - 1440])].sort((a, b) => a[0] - b[0])
  return spans.some((span, i) => i > 0 && span[0] < spans[i - 1][1])
}
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
}
/** 草稿是表单唯一校验入口；检查整周及指定日期前后的跨天边界，服务端仍作权威校验。 */
export function ruleDraftIssue(draft: RuleDraft): RuleIssue | undefined {
  if (!draft.weekRules.length && !draft.dateRules.length) return issue('empty')
  const usedDays = new Set<number>(), usedDates = new Set<string>()
  for (const [i, row] of draft.weekRules.entries()) {
    if (!row.days.length) return issue('days', { index: i + 1 })
    if (!row.periods.length) return issue('periods', { index: i + 1 })
    if (row.periods.length > 24) return issue('limit')
    for (const day of row.days) {
      if (usedDays.has(day)) return issue('duplicateDay')
      usedDays.add(day)
    }
    if (row.periods.reduce((sum, p) => sum + periodCount(p), 0) > 10000) return issue('capacity')
    for (const p of row.periods) { const error = periodIssue(p); if (error) return error }
  }
  if (draft.dateRules.length > 366) return issue('limit')
  for (const row of draft.dateRules) {
    if (!validDate(row.date)) return issue('date')
    if (usedDates.has(row.date)) return issue('duplicateDate', { date: row.date })
    usedDates.add(row.date)
    if (!row.periods.length && !row.legacyRest) return issue('datePeriods', { date: row.date })
    if (row.periods.length > 24) return issue('limit')
    if (row.periods.reduce((sum, p) => sum + periodCount(p), 0) > 10000) return issue('capacity')
    for (const p of row.periods) { const error = periodIssue(p); if (error) return error }
  }
  const rule = serializeRule(draft)
  for (let day = 1; day <= 7; day++) if (dayOverlaps(rule.weekly[day] ?? [], rule.weekly[day === 1 ? 7 : day - 1] ?? [])) return issue('overlap')
  const windowsForDate = (date: string) => rule.dates[date] ?? rule.weekly[new Date(`${date}T00:00:00Z`).getUTCDay() || 7] ?? []
  const boundaryDates = new Set([...usedDates].flatMap(date => [date, shiftDate(date, 1)]))
  for (const date of boundaryDates) if (dayOverlaps(windowsForDate(date), windowsForDate(shiftDate(date, -1)))) return issue('overlap')
}
