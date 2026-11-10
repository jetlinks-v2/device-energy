import { feText } from './i18n'
import type { Resource, Field, Option } from './types'
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
    title: feText('workStandardsAndInstructions'),
    fields: [
      name,
      project,
      select('kind', feText('workType'), [
        ['inspection', feText('inspection')],
        ['maintenance', feText('maintenance')]
      ]),
      f('instruction', feText('workInstructions'), 'textarea'),
      f('attachments', feText('instructionAttachments'), 'files'),
      f('checkItems', feText('inspectionItems'), 'checks'),
      enabled
    ],
    columns: columns([
      ['name', feText('standard')],
      ['kind', feText('type')],
      ['enabled', feText('enabled')]
    ]),
    defaults: { kind: 'inspection', enabled: true, checkItems: [] }
  },
  plans: {
    path: 'plans',
    title: feText('recurringAndAdHocPlans'),
    fields: [
      name,
      project,
      select('kind', feText('workType'), [
        ['inspection', feText('inspection')],
        ['maintenance', feText('maintenance')]
      ]),
      { ...f('standardId', feText('workStandard'), 'select', 'standards'), required: true },
      f('deviceIds', feText('device'), 'multi', 'devices'),
      f('groupIds', feText('equipmentRoomsGroups'), 'multi', 'groups'),
      select('mode', feText('workOrderMode'), [
        ['single', feText('singleWorkOrder')],
        ['double', feText('dualWorkOrder')]
      ]),
      f('assigneeId', feText('assigneeLeaveBlankForTaskPool'), 'select', 'employees'),
      f('followUserId', feText('internalFollowUpAssignee'), 'select', 'employees'),
      f('externalOrganizationId', feText('externalContractorOrganization'), 'tree', 'organizations'),
      { ...f('reviewerId', feText('reviewer'), 'select', 'employees'), required: true },
      { ...f('startTime', feText('startTime'), 'datetime'), required: true },
      { ...f('endTime', feText('endTime'), 'datetime'), required: true },
      { ...f('intervalValue', feText('interval'), 'number'), required: true },
      select('intervalUnit', feText('intervalUnit'), [
        ['hour', feText('hour')],
        ['day', feText('day')],
        ['week', feText('week')],
        ['month', feText('month')],
        ['year', feText('year')]
      ]),
      { ...f('deadlineHours', feText('completionDeadlineHours'), 'number'), required: true },
      enabled
    ],
    columns: columns([
      ['name', feText('plan')],
      ['kind', feText('type')],
      ['mode', feText('workOrderMode')],
      ['nextRunTime', feText('nextGenerationTime')],
      ['endTime', feText('endTime')],
      ['enabled', feText('enabled')]
    ]),
    defaults: {
      kind: 'inspection',
      deviceIds: [],
      groupIds: [],
      mode: 'single',
      startTime: Date.now(),
      endTime: Date.now() + 365 * 86400000,
      intervalValue: 1,
      intervalUnit: 'day',
      deadlineHours: 24,
      enabled: true
    }
  },
  tasks: {
    path: 'tasks',
    title: feText('taskExecution'),
    readonly: true,
    fields: [],
    columns: columns([
      ['name', feText('task')],
      ['deviceName', feText('device')],
      ['kind', feText('type')],
      ['mode', feText('workOrderMode')],
      ['state', feText('status')],
      ['deadline', feText('deadline')]
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
      f('deviceId', feText('device'), 'select', 'devices'),
      { ...f('energyType', feText('energyType'), 'select'), options: energyOptions },
      f('usageType', feText('meteringPurpose')),
      f('usagePropertyId', feText('usageMetricForAggregation'), 'select', 'properties'),
      select('meterLevel', feText('aggregationLevel'), [
        ['master', feText('masterMeter')],
        ['submeter', feText('submeter')],
        ['branch', feText('branch')],
        ['other', feText('other')]
      ]),
      f('parentDeviceId', feText('parentMeter'), 'select', 'devices'),
      f('staleAfterSeconds', feText('dataFreshnessSeconds'), 'number'),
      f('metrics', feText('meteringMetrics'), 'metrics'),
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
    fields: [],
    columns: columns([
      ['propertyId', feText('metric')],
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
      f('oldDeviceId', feText('originalDevice'), 'select', 'devices'),
      f('newDeviceId', feText('newOriginalDevice'), 'select', 'devices'),
      f('effectiveTime', feText('effectiveTime'), 'datetime'),
      f('finalReading', feText('finalReadingOfOriginalMeter'), 'number'),
      f('initialReading', feText('initialReadingOfNewMeter'), 'number'),
      f('reason', feText('reason'), 'textarea')
    ],
    columns: columns([
      ['oldDeviceId', feText('originalDevice')],
      ['newDeviceId', feText('newDevice')],
      ['effectiveTime', feText('effectiveTime')],
      ['state', feText('reviewStatus')]
    ]),
    defaults: { effectiveTime: Date.now() }
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
    fields: [],
    columns: columns([
      ['targetType', feText('businessObject')],
      ['targetId', feText('relatedRecord')],
      ['action', feText('actions')],
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
  f('inspectionEnabled', feText('enableInspections'), 'switch'),
  f('maintenanceEnabled', feText('enableMaintenance'), 'switch'),
  f('energyEnabled', feText('enableEnergyMonitoring'), 'switch'),
  f('attachments', feText('deviceAttachments'), 'files'),
  f('remark', feText('remarks'), 'textarea')
]

resources.planAlerts = { ...resources.alerts, path: 'alerts/plans', title: feText('energyPlanAlerts') }
resources.planNotifications = { ...resources.notifications, path: 'alerts/plans/notifications', title: feText('energyPlanNotifications') }
