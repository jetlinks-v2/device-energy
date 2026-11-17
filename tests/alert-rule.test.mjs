import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const source = await readFile(new URL('../shared/alertRule.ts', import.meta.url), 'utf8')
const { transformSync } = await import('esbuild')
const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code
const module = { exports: {} }
new Function('module', 'exports', code)(module, module.exports)
const { validateAlertRule } = module.exports
const rule = () => ({ projectId: 'p', name: '水表离线', ruleType: 'offline', notifyUserId: 'worker', threshold: 1800, repeatHours: 24 })
test('离线时长和提醒间隔不接受空值、负值或小数小时', () => {
  assert.equal(validateAlertRule(rule(), 'project'), true)
  for (const threshold of [undefined, NaN, 0, -1]) assert.equal(validateAlertRule({ ...rule(), threshold }, 'project'), false)
  for (const repeatHours of [undefined, 0, -1, 0.5, 721]) assert.equal(validateAlertRule({ ...rule(), repeatHours }, 'project'), false)
})
test('每种监测范围必须填写对应对象，真实指标和接收员工不可缺失', () => {
  assert.equal(validateAlertRule(rule(), 'device'), false)
  assert.equal(validateAlertRule({ ...rule(), deviceId: 'meter' }, 'device'), true)
  assert.equal(validateAlertRule(rule(), 'group'), false)
  assert.equal(validateAlertRule({ ...rule(), ruleType: 'instant', energyType: 'water' }, 'project'), false)
  assert.equal(validateAlertRule({ ...rule(), ruleType: 'instant', energyType: 'water', propertyId: 'pressure' }, 'project'), true)
  assert.equal(validateAlertRule({ ...rule(), notifyUserId: '' }, 'project'), false)
})
test('余额严重值方向与用量严重值相反，状态异常必须指定真实状态', () => {
  const metric = { ...rule(), energyType: 'water', propertyId: 'value', threshold: 10 }
  assert.equal(validateAlertRule({ ...metric, ruleType: 'balance', criticalThreshold: 5 }, 'project'), true)
  assert.equal(validateAlertRule({ ...metric, ruleType: 'balance', criticalThreshold: 20 }, 'project'), false)
  assert.equal(validateAlertRule({ ...metric, ruleType: 'usage', criticalThreshold: 5 }, 'project'), false)
  assert.equal(validateAlertRule({ ...metric, ruleType: 'state', stateValue: '' }, 'project'), false)
})

const displayModule = { exports: {} }
const displayCode = transformSync(await readFile(new URL('../shared/alerts.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
new Function('require', 'module', 'exports', displayCode)(() => ({ feLocale: () => 'zh', feText: key => ({ seconds: '秒', alertTriggered: '触发预警', alertEscalated: '预警升级', alertRecovered: '已恢复', deviceFaultReported: '设备上报故障状态，请检查设备', deviceFaultReportedCleared: '设备曾上报故障状态，平台告警已解除，请核实现场情况' }[key] || key) }), displayModule, displayModule.exports)
const { alertValue, alertProcess, alertMessage } = displayModule.exports

test('告警说明、历史消息与转故障摘要使用可读文案，不改写非告警值或人工说明', () => {
  const { alertReason } = displayModule.exports
  assert.equal(alertReason('故障状态 = 1'), '设备上报故障状态，请检查设备')
  assert.equal(alertReason('故障状态 = 2'), '设备上报故障状态，请检查设备')
  for (const reason of ['电压 = 1', '故障状态 = 0', '故障状态 = -1', '故障状态 = 1.5', '故障状态 = 1号设备', '传感器通信中断'])
    assert.equal(alertReason(reason), reason)
  assert.equal(alertMessage('5G园区 · 201 · 智能电表故障告警 · 故障状态 = 1'), '5G园区 · 201 · 智能电表故障告警 · deviceFaultRecorded')
  assert.equal(alertMessage('故障状态 = 2\n请检查现场'), 'deviceFaultRecorded\n请检查现场')
  assert.equal(alertMessage('故障状态 = 10.5'), '故障状态 = 10.5')
  assert.equal(alertMessage('故障状态 = 10号设备'), '故障状态 = 10号设备')
  assert.equal(alertProcess({ action: 'trigger', comment: '故障状态 = 1' }), '触发预警 · deviceFaultRecorded')
  assert.equal(alertProcess({ action: 'handle', comment: '故障状态 = 1' }), '故障状态 = 1')
})

test('预警消息中的协议时长单位本地化，物理单位和其他文案不变', () => {
  assert.equal(alertMessage('设备离线，当前1810seconds'), '设备离线，当前1810 秒')
  assert.equal(alertMessage('设备离线，当前1.5 seconds'), '设备离线，当前1.5 秒')
  assert.equal(alertMessage('用量提醒，当前20kWh'), '用量提醒，当前20kWh')
  assert.equal(alertMessage(undefined), '')
})

test('预警值保留有效零值和原始物理单位，时长翻译为秒，缺数据不伪造零', () => {
  assert.equal(alertValue(669, 'seconds'), '669 秒')
  assert.equal(alertValue(0, 'm³'), '0 m³')
  assert.equal(alertValue(1.239, 'kWh'), '1.24 kWh')
  assert.equal(alertValue(undefined, 'seconds'), '—')
  assert.equal(alertValue(NaN, 'seconds'), '—')
})
test('自动触发和恢复日志展示事件含义与数值，人工处理说明原样保留', () => {
  assert.equal(alertProcess({ action: 'trigger', comment: '519' }, 'seconds'), '触发预警 · 519 秒')
  assert.equal(alertProcess({ action: 'recover', comment: '0' }, 'seconds'), '已恢复 · 0 秒')
  assert.equal(alertProcess({ action: 'escalate', comment: '12' }, 'A'), '预警升级 · 12 A')
  assert.equal(alertProcess({ action: 'handle', comment: '已确认网络故障' }, 'seconds'), '已确认网络故障')
})

const { alertSignal, alertSummary, alertSeverity } = displayModule.exports
const { alertColor } = displayModule.exports

test('触发条件用业务中文展示，比较方向和值保持原意', () => {
  const { alertCondition } = displayModule.exports
  assert.equal(alertCondition('故障状态 is greater than 0'), 'deviceFaultCondition')
  assert.equal(alertCondition('故障状态 IS GREATER THAN 0'), 'deviceFaultCondition')
  for (const [operator, key] of [['greater than', 'Gt'], ['less than', 'Lt'], ['greater than or equal to', 'Gte'], ['less than or equal to', 'Lte'], ['equal to', 'Eq'], ['not equal to', 'Ne']])
    assert.equal(alertCondition(`电压 is ${operator} 220`), `电压 condition${key} 220`)
  assert.equal(alertCondition('故障状态 is greater than 10'), '故障状态 conditionGt 10')
  assert.equal(alertCondition('持续用水超过30分钟'), '持续用水超过30分钟')
  assert.equal(alertCondition(), '—')
  assert.equal(alertSummary({ source: 'saas', sourceCondition: '故障状态 is greater than 0' }), 'deviceFaultCondition')
})

test('人工处理状态独立使用橙蓝绿标识，不受平台解除状态影响', () => {
  const { alertHandlingColor } = displayModule.exports
  assert.equal(alertHandlingColor('open'), 'orange')
  assert.equal(alertHandlingColor(undefined), 'orange')
  assert.equal(alertHandlingColor('processing'), 'blue')
  assert.equal(alertHandlingColor('acknowledged'), 'blue')
  assert.equal(alertHandlingColor('closed'), 'green')
})

test('故障状态提示面向员工，解除记录不冒充当前故障，原始证据不改写', () => {
  const row = { source: 'saas', sourceReason: '故障状态 = 1', sourceCondition: '故障状态 is greater than 0', state: 'open' }
  assert.equal(alertSummary(row), '设备上报故障状态，请检查设备')
  assert.equal(alertSummary({ ...row, state: 'recovered' }), '设备曾上报故障状态，平台告警已解除，请核实现场情况')
  assert.equal(row.sourceReason, '故障状态 = 1'); assert.equal(row.sourceCondition, '故障状态 is greater than 0')
  for (const sourceReason of ['电压 = 1', '故障状态 = 0', '故障状态 = -1', '传感器通信中断'])
    assert.equal(alertSummary({ ...row, sourceReason }), sourceReason)
  assert.equal(alertSummary({ value: 1, unit: 'kWh' }), '1 kWh')
})

test('平台等级按配置名称展示，颜色沿用平台等级且不误用本地严重值', () => {
  const levels = [{ level: 2, title: '紧急' }, { level: 3, title: '严重' }, { level: 8, title: '园区提醒' }]
  const row = { source: 'saas', sourceLevel: 3, level: 'warning' }
  assert.equal(alertSeverity(row, levels), '严重')
  assert.equal(alertSeverity({ ...row, sourceLevel: 2 }, levels), '紧急')
  assert.equal(alertSeverity({ ...row, sourceLevel: 8 }, levels), '园区提醒')
  assert.equal(alertSeverity({ ...row, sourceLevel: 6 }, levels), 'platformAlarmLevel 6')
  assert.equal(alertColor({ ...row, sourceLevel: 6, level: 'critical' }), undefined)
  assert.deepEqual([1, 2, 3, 4, 5].map(sourceLevel => alertColor({ ...row, sourceLevel })),
    ['#e50012', '#ff9457', '#fabd47', '#999999', '#bbbbbb'])
  assert.equal(alertColor({ level: 'critical' }), 'red')
  assert.equal(alertColor({ level: 'warning' }), 'orange')
})

test('平台告警展示来源原因与原始等级，解除与人工处理状态独立', () => {
  const row = { source: 'saas', sourceLevel: 4, sourceReason: '持续用水超过30分钟', value: 999, unit: 'kWh' }
  assert.equal(alertSummary(row), '持续用水超过30分钟')
  assert.equal(alertSummary({ ...row, sourceReason: '', sourceCondition: '压力低于范围' }), '压力低于范围')
  assert.equal(alertSeverity(row), 'platformAlarmLevel 4')
  assert.equal(alertSignal('recovered', 'saas'), 'platformAlarmCleared')
  assert.equal(alertSignal('recovered'), '已恢复')
  assert.equal(alertSummary({ value: 0, unit: 'kWh' }), '0 kWh')
})

test('任务提醒按项目负责人分发无需另选员工，计划提醒仍需指定员工', () => {
  const task = { ...rule(), ruleType: 'overdue', threshold: 1, notifyUserId: undefined }
  assert.equal(validateAlertRule(task, 'project'), true)
  assert.equal(validateAlertRule({ ...task, ruleType: 'dueSoon' }, 'project'), false)
  assert.equal(validateAlertRule({ ...task, ruleType: 'dueSoon', staleAfterSeconds: 1800 }, 'project'), true)
  assert.equal(validateAlertRule({ ...task, ruleType: 'plan' }, 'project'), false)
  assert.equal(validateAlertRule({ ...task, ruleType: 'plan', notifyUserId: 'worker', threshold: 0 }, 'project'), false)
})

test('任务提醒无需累计任务数和重复间隔，支持类型筛选与旧时段保留', () => {
  const row={ projectId: 'p', name: '巡检提醒', ruleType: 'dueSoon', taskKind: 'inspection', cycleId: 'cycle', staleAfterSeconds: 600 }
  assert.equal(validateAlertRule(row,'project'),true)
  assert.equal(validateAlertRule({...row,taskKind:'other'},'project'),false)
  assert.equal(validateAlertRule({...row,staleAfterSeconds:0},'project'),false)
  assert.equal(validateAlertRule({...row,staleAfterSeconds:undefined,legacySchedule:{weekly:{},dates:{}}},'project'),true)
  assert.equal(validateAlertRule({...row,ruleType:'overdue',staleAfterSeconds:undefined},'project'),true)
})
