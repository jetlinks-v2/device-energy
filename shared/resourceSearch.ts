import type { ConditionFilterField } from '@jetlinks-web-core/components/ConditionFilter/types'
import { feText } from './i18n'
import { energyOptions, resources } from './resources'
import { states, type Option, type Resource } from './types'

export const timeColumns = new Set([
  'startTime', 'endTime', 'createTime', 'deadline', 'effectiveTime', 'observedTime',
  'lastSuccessTime', 'nextRunTime', 'lastCollectedTime', 'lastCollectionTime', 'lastCollectionSuccessTime'
])
const optionsFor = (values: string[]) => values.map(value => ({ value, label: states[value] || value }))
const statusValues: Record<string, string[]> = {
  tasks: ['open', 'claimed', 'executing', 'rectify', 'external-submitted', 'review', 'completed', 'cancelled'],
  faults: ['open', 'processing', 'closed'],
  alerts: ['open', 'acknowledged', 'closed', 'recovered'],
  'alerts/plans': ['open', 'acknowledged', 'closed', 'recovered'],
  'energy/readings': ['pending', 'accepted', 'rejected', 'invalid', 'superseded'],
  'energy/replacements': ['pending', 'approved', 'rejected'],
  'devices/sync': ['idle', 'running', 'success', 'failed']
}

/** 只开放真实持久化字段；采集积压是计算列，不作为服务端查询字段。 */
export function resourceSearchFields(resource: Resource, options: Record<string, Option[]>, kind?: string): ConditionFilterField[] {
  const fields: ConditionFilterField[] = [{
    title: feText('businessProject'), dataIndex: 'projectId',
    search: { type: 'select', options: options.projects || [] }
  }]
  for (const column of resource.columns) {
    const key = column.key
    if (['projectId', 'projectName', 'collectionLag'].includes(key) || (key === 'kind' && kind)) continue
    const field = resource.fields.find(item => item.key === key)
    let choices = field?.options || (field?.source ? options[field.source] : undefined)
    if (key === 'energyType') choices = energyOptions
    if (resource.path === 'devices' && key === 'sourceState') choices = optionsFor(['online', 'offline', 'notActive'])
    if (resource.path === 'devices' && key === 'syncState') choices = optionsFor(['active', 'inactive', 'pending-project', 'source-unavailable'])
    if (key === 'meterLevel') choices = resources['energy/mappings'].fields.find(item => item.key === key)?.options
    if (key === 'kind') choices = optionsFor(['inspection', 'maintenance'])
    if (key === 'mode') choices = optionsFor(['single', 'double'])
    if (key === 'channel') choices = optionsFor(['sms', 'h5', 'inside'])
    if (key === 'level') choices = optionsFor(['near', 'warning', 'critical'])
    if (key === 'sourceType') choices = optionsFor(['manual', 'task', 'alert'])
    if (key === 'state' || key === 'status') choices = optionsFor(statusValues[resource.path] || [
      'pending', 'sending', 'submitted', 'delivered', 'sent', 'failed', 'uncertain', 'cancelled'
    ])
    if (key === 'enabled') choices = [{ value: 'true', label: feText('enabled') }, { value: 'false', label: feText('disabled') }]
    if (key === 'ruleType' && !choices) choices = resources.rules.fields.find(item => item.key === 'ruleType')?.options
    fields.push({
      title: column.title, dataIndex: key,
      search: timeColumns.has(key)
        ? { type: 'date', componentProps: { showTime: true, format: 'YYYY-MM-DD HH:mm' } }
        : choices?.length
          ? { type: 'select', options: choices, ...(key === 'enabled' ? { termTypeOptions: ['eq'], handleValue: (value: unknown) => value === true || value === 'true' } : {}) }
          : { type: field?.type === 'number' || ['value', 'attempts', 'processed', 'year', 'month', 'targetUsage', 'managementArea'].includes(key) ? 'number' : 'string' }
    })
  }
  return fields
}
