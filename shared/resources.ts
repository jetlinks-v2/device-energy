import { defaultRule } from './cycle/editor'
import { feText } from './i18n'
import type { Resource, Field, Option } from './types'
import { display, type Entity } from './types'
import { operationTargets, operationActions, operationComment } from './operationLog'
const options = (values: string[][]): Option[] => values.map(([value, label]) => ({ value, label }))
export const energyOptions = options([
  ['water', feText('water')],
  ['electricity', feText('electricity')],
  ['gas', feText('gas')]
])
export const metricOptions = options([
  ['counter', feText('cumulativeReading')],
  ['increment', feText('periodIncrement')],
  ['instant', feText('instantaneousMetric')],
  ['balance', feText('actualBalanceRemainingQuantity')],
  ['state', feText('status')]
])
/** 指标代码不参与通用状态翻译；按每条采集记录保存的指标语义展示。 */
export function resourceCellText(resource: Resource, key: string, row: Entity, projects: Option[] = [], devices: Option[] = []): string {
  if (resource.path === 'operations' && key === 'comment') return operationComment(row)
  if (key === 'projectName' && !row.projectName) {
    return projects.find(project => project.value === row.projectId)?.label || '—'
  }
  if (resource.path === 'energy/readings' && key === 'deviceId') {
    return String(row.deviceName || row.deviceId || '—')
  }
  if (resource.path === 'energy/readings' && key === 'propertyId') {
    return metricOptions.find(option => option.value === row.metricKind)?.label || String(row.propertyId ?? '—')
  }
  if (resource.path === 'energy/replacements' && ['oldDeviceId', 'newDeviceId'].includes(key)) return devices.find(device => device.value === row[key])?.label || String(row[key] || '—')
  if (resource.path === 'energy/replacements' && key === 'state' && row.state === 'pending') return feText('awaitingReview')
  return display(row[key], resource.fields.find(field => field.key === key)?.options)
}
const f = (key: string, label: string, type: Field['type'] = 'text', source?: string): Field => ({
  key,
  label,
  type,
  source
})
const project = { ...f('projectId', feText('businessProject'), 'select', 'projects'), required: true },
  name = { ...f('name', feText('name')), required: true },
  enabled = f('enabled', feText('enabled'), 'switch')
const columns = (fields: string[][]) => fields.map(([key, title]) => ({ key, title }))
const select = (key: string, label: string, values: string[][]): Field => ({
  ...f(key, label, 'select'),
  options: options(values)
})
export const resources: Record<string, Resource> = {
  devices: {
    path: 'devices',
    title: feText('facilityDeviceRegister'),
    readonly: true,
    fields: [],
    columns: columns([
      ['name', feText('deviceName')],
      ['sourceName', feText('cloudName')],
      ['sourceState', feText('connectionStatus')],
      ['categoryName', feText('facilityCategory')],
      ['projectName', feText('businessProject')]
    ])
  },
  groups: {
    path: 'groups',
    title: feText('equipmentRoomsGroups'),
    fields: [name, project, f('location', feText('location')), f('deviceIds', feText('memberDevices'), 'multi', 'devices')],
    columns: columns([
      ['name', feText('name')],
      ['location', feText('location')],
      ['projectName', feText('project')]
    ]),
    defaults: { deviceIds: [] }
  },
  standards: {
    path: 'standards',
    title: feText('workStandard'),
    fields: [
      name,
      project,
      { ...select('kind', feText('workType'), [
        ['inspection', feText('inspection')],
        ['maintenance', feText('maintenance')]
      ]), required: true },
      { ...f('checkItems', feText('inspectionItems'), 'checks'), required: true },
      enabled
    ],
    columns: columns([
      ['name', feText('standard')],
      ['kind', feText('type')],
      ['enabled', feText('enabled')]
    ]),
    defaults: { kind: 'inspection', enabled: true, checkItems: [] }
  },
  cycles: {
    path: 'cycles', title: feText('cyclePlan'),
    fields: [name, project, { ...select('kind', feText('workType'), [
      ['inspection', feText('inspection')], ['maintenance', feText('maintenance')]
    ]), required: true }, { ...f('rule', feText('executionFrequency'), 'cycle'), required: true }, enabled],
    columns: columns([['name', feText('cyclePlan')], ['projectName', feText('project')],
      ['enabled', feText('enabled')]]),
    defaults: { kind: 'inspection', rule: defaultRule(), enabled: true }
  },
  plans: {
    path: 'plans', title: feText('taskConfiguration'),
    fields: [name, project,
      { ...select('kind', feText('workType'), [
        ['inspection', feText('inspection')], ['maintenance', feText('maintenance')]
      ]), required: true },
      { ...f('standardId', feText('workStandard'), 'select', 'standards'), required: true },
      { ...f('cycleId', feText('cyclePlan'), 'select', 'cycles'), required: true },
      { ...f('groupIds', feText('equipmentRoomsGroups'), 'multi', 'groups'), required: true },
      { ...f('reviewerId', feText('responsiblePerson'), 'select', 'employees'), required: true },
      { ...f('startTime', feText('startTime'), 'datetime'), required: true },
      { ...f('endTime', feText('endTime'), 'datetime'), required: true }, enabled],
    columns: columns([['name', feText('taskConfiguration')], ['projectName', feText('project')], ['standardName', feText('workStandard')], ['cycleName', feText('cyclePlan')], ['reviewerName', feText('responsiblePerson')], ['kind', feText('type')],
      ['nextRunTime', feText('nextGenerationTime')],
      ['startTime', feText('startTime')], ['endTime', feText('endTime')], ['enabled', feText('enabled')]]),
    defaults: { kind: 'inspection', deviceIds: [], groupIds: [], enabled: true }
  },
  tasks: {
    path: 'tasks',
    title: feText('taskExecution'),
    readonly: true,
    fields: [],
    columns: columns([
      ['name', feText('task')],
      ['projectName', feText('businessProject')],
      ['deviceName', feText('device')],
      ['kind', feText('type')],
      ['state', feText('status')],
      ['scheduledTime', feText('taskStartTime')],
      ['deadline', feText('taskEndTime')]
    ])
  },
  faults: {
    path: 'faults',
    title: feText('deviceFaults'),
    fields: [
      name,
      f('deviceId', feText('device'), 'select', 'devices'),
      f('description', feText('faultDescription'), 'textarea'),
      f('assigneeId', feText('assignedHandler'), 'select', 'employees')
    ],
    columns: columns([
      ['name', feText('fault')],
      ['deviceName', feText('device')],
      ['sourceType', feText('faultSource')],
      ['sourceId', feText('sourceRecord')],
      ['state', feText('status')],
      ['description', feText('description')]
    ]),
    defaults: { sourceType: 'manual' }
  },
  'energy/mappings': {
    path: 'energy/mappings',
    title: feText('waterElectricityAndGasMeters'),
    fields: [
      { ...f('deviceId', feText('device'), 'select', 'devices'), required: true },
      { ...f('energyType', feText('energyType'), 'select'), options: energyOptions, required: true },
      select('usageType', feText('meteringPurpose'), [
        ['private', feText('householdUse')],
        ['public', feText('publicUse')]
      ]),
      f('usagePropertyId', feText('usageMetricForAggregation'), 'select', 'properties'),
      { ...select('meterLevel', feText('aggregationLevel'), [
        ['master', feText('masterMeter')],
        ['submeter', feText('submeter')],
        ['branch', feText('branch')],
        ['other', feText('other')]
      ]), required: true },
      f('parentDeviceId', feText('parentMeter'), 'select', 'devices'),
      { ...f('staleAfterSeconds', feText('dataFreshnessSeconds'), 'number'), required: true },
      { ...f('metrics', feText('meteringMetrics'), 'metrics'), required: true },
      enabled
    ],
    columns: columns([
      ['name', feText('meter')],
      ['energyType', feText('energy')],
      ['usageType', feText('purpose')],
      ['meterLevel', feText('aggregationLevel')],
      ['enabled', feText('enabled')]
    ]),
    defaults: { meterLevel: 'master', metrics: [], staleAfterSeconds: 3600, enabled: true }
  },
  collection: {
    path: 'energy/mappings',
    title: feText('collectionStatus'),
    readonly: true,
    collection: true,
    fields: [],
    columns: columns([
      ['name', feText('meter')],
      ['enabled', feText('enabled')],
      ['lastCollectedTime', feText('historyCollectedUntil')],
      ['collectionLag', feText('historyBacklogMinutes')],
      ['lastCollectionTime', feText('lastCollectionAttempt')],
      ['lastCollectionSuccessTime', feText('lastCollectionSuccess')],
      ['collectionError', feText('collectionFailureReason')]
    ])
  },
  rules: {
    path: 'rules',
    title: feText('alertRules'),
    fields: [
      name,
      project,
      select('ruleType', feText('ruleType'), [
        ['usage', feText('usage')],
        ['balance', feText('actualBalanceRemainingQuantity')],
        ['instant', feText('instantaneousMetric')],
        ['offline', feText('deviceOffline')],
        ['stale', feText('reportingInterrupted')],
        ['overdue', feText('taskOverdue')],
        ['dueSoon', feText('taskApproachingDeadline')],
        ['reading-anomaly', feText('readingAnomaly')],
        ['state', feText('abnormalState')],
        ['plan', feText('monthlyEnergyPlanProgressPercent')]
      ]),
      { ...f('energyType', feText('energyType'), 'select'), options: energyOptions },
      f('deviceId', feText('deviceLeaveBlankToApplyToProject'), 'select', 'devices'),
      f('groupId', feText('deviceGroup'), 'select', 'groups'),
      f('propertyId', feText('deviceModelPropertyId')),
      f('stateValue', feText('stateValueThatTriggersTheAlert')),
      f('notifyUserId', feText('staffRecipientForEnergyPlanAlerts'), 'select', 'employees'),
      select('period', feText('usagePeriod'), [
        ['day', feText('daily')],
        ['month', feText('month')]
      ]),
      f('threshold', feText('alertThresholdPercentForPlanRules'), 'number'),
      f('criticalThreshold', feText('criticalThreshold'), 'number'),
      f('nearRatio', feText('approachingThresholdRatio0To1'), 'number'),
      f('staleAfterSeconds', feText('freshnessAdvanceWarningSeconds'), 'number'),
      f('repeatHours', feText('repeatReminderIntervalHours'), 'number'),
      f('smsEnabled', feText('sendSms'), 'switch'),
      f('smsNotifierId', feText('configuredSmsNotifierId')),
      f('smsTemplateId', feText('approvedSmsTemplateId')),
      enabled
    ],
    columns: columns([
      ['name', feText('rule')],
      ['ruleType', feText('type')],
      ['threshold', feText('threshold')],
      ['enabled', feText('enabled')]
    ]),
    defaults: {
      ruleType: 'usage',
      period: 'day',
      energyType: 'electricity',
      threshold: 100,
      nearRatio: 0.8,
      repeatHours: 24,
      staleAfterSeconds: 3600,
      enabled: false,
      smsEnabled: false
    }
  },
  alerts: {
    path: 'alerts',
    title: feText('alertEvents'),
    readonly: true,
    fields: [],
    columns: columns([
      ['name', feText('rule')],
      ['ruleType', feText('type')],
      ['energyType', feText('energy')],
      ['value', feText('currentValue')],
      ['unit', feText('unit')],
      ['level', feText('severity')],
      ['state', feText('processingStatus')]
    ])
  },
  notifications: {
    path: 'alerts/notifications',
    title: feText('notificationRecords'),
    readonly: true,
    fields: [],
    columns: columns([
      ['title', feText('notification')],
      ['channel', feText('channel')],
      ['state', feText('status')],
      ['attempts', feText('attempts')],
      ['failureReason', feText('failureReason')],
      ['createTime', feText('time')]
    ])
  },
  readings: {
    path: 'energy/readings',
    title: feText('readingsAndManualEntryReview'),
    readonly: true,
    fields: [f('deviceId', feText('deviceName'), 'select', 'devices'),
      select('energyType', feText('meterType'), [
        ['water', feText('waterMeter')], ['electricity', feText('electricMeter')], ['gas', feText('gasMeter')]
      ]), select('metricKind', feText('metric'), [
        ['counter', feText('cumulativeReading')], ['increment', feText('periodIncrement')]
      ]), select('source', feText('source'), [
      ['cloud', feText('cloudCollection')],
      ['manual', feText('manualReadingEntry')]
    ])],
    columns: columns([
      ['deviceId', feText('deviceName')],
      ['projectName', feText('businessProject')],
      ['energyType', feText('meterType')],
      ['metricKind', feText('metric')],
      ['value', feText('reading')],
      ['unit', feText('unit')],
      ['source', feText('source')],
      ['status', feText('status')],
      ['observedTime', feText('collectionTime')]
    ])
  },
  replacements: {
    path: 'energy/replacements',
    title: feText('meterReplacementAndReset'),
    fields: [
      { ...f('oldDeviceId', feText('originalDevice'), 'select', 'devices'), required: true },
      { ...f('newDeviceId', feText('newOriginalDevice'), 'select', 'devices'), required: true },
      { ...f('effectiveTime', feText('effectiveTime'), 'datetime'), required: true },
      { ...f('finalReading', feText('finalReadingOfOriginalMeter'), 'number'), required: true },
      { ...f('initialReading', feText('initialReadingOfNewMeter'), 'number'), required: true },
      { ...f('reason', feText('reason'), 'textarea'), required: true }
    ],
    columns: columns([
      ['oldDeviceId', feText('originalDevice')],
      ['newDeviceId', feText('newDevice')],
      ['effectiveTime', feText('effectiveTime')],
      ['state', feText('reviewStatus')]
    ]),
    defaults: {}
  },
  jobs: {
    path: 'devices/sync',
    title: feText('deviceSyncStatus'),
    readonly: true,
    fields: [],
    columns: columns([
      ['name', feText('businessProject')],
      ['state', feText('status')],
      ['processed', feText('devicesProcessedLastRun')],
      ['lastSuccessTime', feText('lastSuccess')],
      ['nextRunTime', feText('nextRun')],
      ['failureReason', feText('failureReason')]
    ])
  },
  operations: {
    path: 'operations',
    title: feText('applicationActivityLog'),
    readonly: true,
    fields: [
      { ...f('targetType', feText('businessObject'), 'select'), options: operationTargets },
      { ...f('action', feText('logAction'), 'select'), options: operationActions }
    ],
    columns: columns([
      ['projectName', feText('businessProject')],
      ['targetType', feText('businessObject')],
      ['targetId', feText('logRelatedId')],
      ['action', feText('logAction')],
      ['creatorName', feText('operator')],
      ['comment', feText('notes')],
      ['createTime', feText('time')]
    ])
  },
  targets: {
    path: 'reports/targets',
    title: feText('monthlyEnergyPlan'),
    fields: [
      project,
      { ...f('energyType', feText('energyType'), 'select'), options: energyOptions },
      f('year', feText('yearNumber'), 'number'),
      f('month', feText('monthNumber'), 'number'),
      f('targetUsage', feText('targetUsageElectricityKwhWaterGasM'), 'number'),
      f('managementArea', feText('managedAreaM'), 'number')
    ],
    columns: columns([
      ['projectId', feText('project')],
      ['energyType', feText('energy')],
      ['year', feText('yearNumber')],
      ['month', feText('monthNumber')],
      ['targetUsage', feText('targetUsage')],
      ['managementArea', feText('managedArea')]
    ]),
    defaults: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      energyType: 'electricity',
      targetUsage: 0
    }
  }
}
export const deviceFields: Field[] = [
  name,
  f('systemName', feText('technicalSystem')),
  f('categoryName', feText('facilityCategory')),
  f('specification', feText('modelSpecification')),
  f('power', feText('powerKw'), 'number'),
  f('manufacturer', feText('manufacturer')),
  f('purchasePrice', feText('purchasePrice'), 'number'),
  f('purchaseDate', feText('purchaseDate'), 'date'),
  f('startDate', feText('commissioningDate'), 'date'),
  f('warrantyDate', feText('warrantyEndDate'), 'date'),
  f('maintainer', feText('maintenanceProvider')),
  f('responsibleUserId', feText('responsiblePerson'), 'select', 'employees'),
  f('spaceId', feText('installationSpace'), 'tree', 'spaces'),
  f('location', feText('installationLocation')),
  f('floor', feText('floor')),
  f('workEnabled', feText('enableInspectionMaintenance'), 'switch'),
  f('energyEnabled', feText('enableEnergyMonitoring'), 'switch'),
  f('attachments', feText('deviceAttachments'), 'files'),
  f('remark', feText('remarks'), 'textarea')
]

resources.planAlerts = { ...resources.alerts, path: 'alerts/plans', title: feText('energyPlanAlerts') }
resources.planNotifications = { ...resources.notifications, path: 'alerts/plans/notifications', title: feText('energyPlanNotifications') }
