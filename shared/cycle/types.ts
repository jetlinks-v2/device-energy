export interface RuleWindow {
  startMinute: number; endMinute: number; intervalMinutes: number; requiredCount: number
  warningMinutes?: number | null; warningUnit?: '1' | '2' | '3' | null
  cooldownMinutes: number; frequencyUnit?: '1' | '2' | '3' | null; cooldownUnit?: '1' | '2' | '3' | null
}
export interface CycleRule { weekly: Record<string, RuleWindow[]>; dates: Record<string, RuleWindow[]> }
