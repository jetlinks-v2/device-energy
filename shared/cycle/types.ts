export type RuleTimeUnit = '1' | '2' | '3' | 'minute' | 'hour' | 'day'
export interface RuleWindow {
  startMinute: number; endMinute: number; intervalMinutes: number; requiredCount: number
  warningMinutes?: number | null; warningUnit?: RuleTimeUnit | null
  cooldownMinutes: number; frequencyUnit?: RuleTimeUnit | null; cooldownUnit?: RuleTimeUnit | null
}
export interface CycleRule { weekly: Record<string, RuleWindow[]>; dates: Record<string, RuleWindow[]> }
