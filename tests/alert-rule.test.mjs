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
new Function('require', 'module', 'exports', displayCode)(() => ({ feText: key => ({ seconds: '秒', alertTriggered: '触发预警', alertEscalated: '预警升级', alertRecovered: '已恢复' }[key] || key) }), displayModule, displayModule.exports)
const { alertValue, alertProcess, alertMessage } = displayModule.exports

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
