import type { Entity } from './types'
export interface AlertRule extends Entity {
  name: string; projectId: string; ruleType: string; energyType: string; deviceId?: string; groupId?: string
  propertyId?: string; stateValue?: string; notifyUserId?: string; threshold: number; criticalThreshold?: number
  repeatHours: number; staleAfterSeconds?: number; period: string; enabled: boolean
}
export const ruleNeedsMetric = (type: string) => ['usage', 'balance', 'instant', 'stale', 'reading-anomaly', 'state'].includes(type)
export function validateAlertRule(row: Partial<AlertRule>, range: string): boolean {
  return !!row.projectId && !!row.name?.trim() && !!row.ruleType && !!row.notifyUserId &&
    Number.isFinite(row.threshold) && Number(row.threshold) >= 0 &&
    (!['offline', 'stale'].includes(row.ruleType) || Number(row.threshold) > 0) &&
    Number.isInteger(row.repeatHours) && Number(row.repeatHours) > 0 && Number(row.repeatHours) <= 720 &&
    (!ruleNeedsMetric(row.ruleType) || !!row.propertyId && !!row.energyType) &&
    (range !== 'device' || !!row.deviceId) && (range !== 'group' || !!row.groupId) &&
    (row.ruleType !== 'state' || !!row.stateValue?.trim()) &&
    (row.criticalThreshold == null || (row.ruleType === 'balance' ? row.criticalThreshold <= Number(row.threshold) : row.criticalThreshold >= Number(row.threshold)))
}
