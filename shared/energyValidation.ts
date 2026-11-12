import { feText } from './i18n'
import type { FormValues, Metric } from './types'

/** Match metering constraints before writing; zero readings remain valid for meter resets. */
export function validateEnergyForm(path: string, form: FormValues): string | undefined {
  if (path === 'energy/mappings') {
    if (!['water', 'electricity', 'gas'].includes(String(form.energyType)) ||
      !['master', 'submeter', 'branch', 'other'].includes(String(form.meterLevel))) return feText('mappingClassificationRequired')
    if (!Number.isSafeInteger(form.staleAfterSeconds) || Number(form.staleAfterSeconds) <= 0) return feText('mappingFreshnessInvalid')
    const metrics = form.metrics as Metric[] | undefined
    if (!metrics?.length || metrics.length > 50) return feText('mappingMetricsRequired')
    const ids = new Set<string>()
    for (const [index, metric] of metrics.entries()) {
      if (!metric.propertyId?.trim() || !['counter', 'increment', 'instant', 'balance', 'state'].includes(metric.kind) ||
        !metric.unit?.trim() || !Number.isFinite(metric.multiplier) || metric.multiplier <= 0 ||
        !Number.isInteger(metric.scale) || metric.scale < 0 || metric.scale > 12) {
        return feText('mappingMetricInvalid').replace('{index}', String(index + 1))
      }
      if (ids.has(metric.propertyId)) return feText('mappingMetricDuplicate')
      ids.add(metric.propertyId)
    }
    const usage = metrics.filter(metric => ['counter', 'increment'].includes(metric.kind))
    if ((form.usagePropertyId || usage.length > 1) && !usage.some(metric => metric.propertyId === form.usagePropertyId)) return feText('mappingUsageInvalid')
    if (form.parentDeviceId === form.deviceId) return feText('mappingParentInvalid')
  }
  if (path === 'energy/replacements') {
    if (!Number.isFinite(form.effectiveTime) || Number(form.effectiveTime) <= 0 || Number(form.effectiveTime) > Date.now()) return feText('replacementTimeInvalid')
    if (['finalReading', 'initialReading'].some(key => typeof form[key] !== 'number' || !Number.isFinite(form[key]) || Number(form[key]) < 0)) return feText('replacementReadingInvalid')
  }
}
