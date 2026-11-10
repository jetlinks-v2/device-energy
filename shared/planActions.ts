import type { Entity } from './types'
import { feText } from './i18n'

/** The server rechecks eligibility; these hints prevent submitting known invalid plan actions. */
export function planGenerationReason(plan: Entity, temporary: boolean, now = Date.now()): string {
  if (!plan.cycleId) return feText('legacyCycleRequired')
  if (Number(plan.nextRunTime) > 8640000000000000) return feText('noFutureTask')
  if (plan.enabled !== true) return feText('planDisabled')
  if (![plan.startTime, plan.endTime, plan.nextRunTime].every((v) => typeof v === 'number' && Number.isFinite(v)))
    return feText('planDatesRequired')
  if (now < Number(plan.startTime)) return feText('planNotStarted')
  const scheduled = temporary ? now : Number(plan.nextRunTime)
  if (scheduled >= Number(plan.endTime)) return feText('planFinished')
  if (scheduled > now) return feText('planNotDue')
  return ''
}
