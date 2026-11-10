import type { CycleRule, RuleWindow } from './types'

export interface RuleSummaryRow {
  days: number[]
  date?: string
  windows: RuleWindow[]
}

/** 合并相同的星期规则仅用于展示；指定日期（含停巡）仍逐条保留。 */
export function ruleSummaryRows(rule?: CycleRule): RuleSummaryRow[] {
  if (!rule) return []
  const weekly = new Map<string, RuleSummaryRow>()
  for (let day = 1; day <= 7; day++) {
    const windows = rule.weekly?.[day] ?? []
    if (!windows.length) continue
    const key = JSON.stringify(windows)
    const row = weekly.get(key)
    if (row) row.days.push(day)
    else weekly.set(key, { days: [day], windows })
  }
  return [...weekly.values(), ...Object.entries(rule.dates ?? {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, windows]) => ({ days: [], date, windows }))]
}

/** 24:00保留已有录入；等值表示24小时，小于开始表示跨天。 */
export function ruleWindowTime(window: RuleWindow) {
  const format = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  return { start: format(window.startMinute), end: format(window.endMinute), nextDay: window.endMinute < window.startMinute }
}

/** 保留录入单位；历史数据没有单位时选用可整除的天/小时，否则显示分钟。 */
export function ruleQuantity(minutes: number, unit?: RuleWindow['frequencyUnit']) {
  const selected = unit ?? (minutes > 0 && minutes % 1440 === 0 ? '3' : minutes > 0 && minutes % 60 === 0 ? '2' : '1')
  return { value: minutes / ({ '1': 1, '2': 60, '3': 1440 }[selected]), unit: selected }
}
