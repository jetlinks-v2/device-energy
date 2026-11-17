import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const { buildSync } = require('esbuild')
const build = buildSync({ entryPoints: [fileURLToPath(new URL('../shared/cycle/editor.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs' })
const compiled = { exports: {} }
new Function('module', 'exports', build.outputFiles[0].text)(compiled, compiled.exports)
const { defaultRule, ruleDraft, serializeRule, ruleDraftIssue, periodCount } = compiled.exports
const period = (patch = {}) => ({ start: '08:00', end: '12:00', frequency: 1, frequencyUnit: '2',
  times: 1, interval: 1, intervalUnit: '2', warning: 30, warningUnit: '1', ...patch })
const draft = periods => ({ weekRules: [{ days: [1], periods }], dateRules: [] })

test('四小时每小时一次生成4次，默认全天24次，尾段不补次数', () => {
  assert.equal(periodCount(period()), 4)
  assert.equal(periodCount(period({ end: '12:59' })), 4)
  assert.equal(periodCount(ruleDraft(defaultRule()).weekRules[0].periods[0]), 24)
  assert.equal(ruleDraftIssue(draft([period()])), undefined)
})
test('每小时两次必须容纳最小间隔，不能缩减次数后保存', () => {
  const valid = period({ times: 2, interval: 30, intervalUnit: '1', warning: 15 })
  assert.equal(periodCount(valid), 8)
  assert.equal(ruleDraftIssue(draft([valid])), undefined)
  assert.equal(ruleDraftIssue(draft([{ ...valid, interval: 31 }])).key, 'FacilityEnergy.ruleEditor.errors.capacity')
})
test('重复星期、当天及跨天重叠均拒绝保存，日期覆盖不并入星期', () => {
  const duplicate = draft([period()])
  duplicate.weekRules.push({ days: [1], periods: [period()] })
  assert.equal(ruleDraftIssue(duplicate).key, 'FacilityEnergy.ruleEditor.errors.duplicateDay')
  const overnight = draft([period({ start: '23:00', end: '02:00' })])
  overnight.weekRules.push({ days: [2], periods: [period({ start: '01:00', end: '03:00' })] })
  assert.equal(ruleDraftIssue(overnight).key, 'FacilityEnergy.ruleEditor.errors.overlap')
  const rest = draft([period()])
  rest.dateRules.push({ date: '2026-11-09', periods: [], legacyRest: true })
  assert.equal(ruleDraftIssue(rest), undefined)
  assert.deepEqual(serializeRule(rest).dates['2026-11-09'], [])
})
test('周期保存回显不丢时段、日期覆盖和录入单位', () => {
  const source = draft([period({ start: '22:00', end: '02:00', frequency: 60, frequencyUnit: '1' })])
  source.dateRules = [{ date: '2028-02-29', periods: [period()], legacyRest: false }]
  const value = serializeRule(source)
  assert.deepEqual(serializeRule(ruleDraft(value)), value)
  source.dateRules[0].date = '2027-02-29'
  assert.equal(ruleDraftIssue(source).key, 'FacilityEnergy.ruleEditor.errors.date')
})

test('历史英文时间单位归一化后可预览及保存，保留分钟数与执行次数', () => {
  for (const [legacy, unit, minutes] of [['minute', '1', 1], ['hour', '2', 60], ['day', '3', 1440]]) {
    const window = { startMinute: 0, endMinute: 0, intervalMinutes: minutes, requiredCount: 1,
      cooldownMinutes: minutes, warningMinutes: minutes / 2,
      frequencyUnit: legacy, cooldownUnit: legacy, warningUnit: legacy }
    const value = ruleDraft({ weekly: { 1: [window] }, dates: {} })
    const period = value.weekRules[0].periods[0]
    assert.equal(period.frequencyUnit, unit)
    assert.equal(period.intervalUnit, unit)
    assert.equal(period.frequency, 1)
    assert.equal(period.interval, 1)
    assert.equal(periodCount(period), 1440 / minutes)
    assert.equal(ruleDraftIssue(value), undefined)
    assert.deepEqual(serializeRule(value).weekly[1][0], {
      startMinute: 0, endMinute: 0, intervalMinutes: minutes, requiredCount: 1,
      cooldownMinutes: minutes, frequencyUnit: unit, cooldownUnit: unit,
    })
  }
})

test('未保存单位的旧周期按分钟数推断，零间隔回显仍保持为零', () => {
  const source = { startMinute: 480, endMinute: 1080, intervalMinutes: 120, requiredCount: 1,
    cooldownMinutes: 0, warningMinutes: 60 }
  const value = ruleDraft({ weekly: { 2: [source] }, dates: {} })
  const period = value.weekRules[0].periods[0]
  assert.equal(period.frequency, 2)
  assert.equal(period.frequencyUnit, '2')
  assert.equal(period.interval, 0)
  assert.equal(period.intervalUnit, '1')
  assert.equal(periodCount(period), 5)
  assert.equal(serializeRule(value).weekly[2][0].cooldownMinutes, 0)
})


test('周期编辑只保存排程，旧预警不会重新写入周期，新周期无预警也能保存', () => {
  for (const warning of [null, 29, 60, 40]) {
    const value=draft([period({ warning })])
    assert.equal(ruleDraftIssue(value), undefined)
    assert.equal('warningMinutes' in serializeRule(value).weekly['1'][0], false)
    assert.equal('warningUnit' in serializeRule(value).weekly['1'][0], false)
  }
  const legacy={ weekly: { 1: [{ startMinute: 480, endMinute: 720, intervalMinutes: 60, requiredCount: 1, cooldownMinutes: 60, warningMinutes: 30 }] }, dates: {} }
  assert.equal('warning' in ruleDraft(legacy).weekRules[0].periods[0],false)
  assert.equal(ruleDraftIssue(ruleDraft(defaultRule())), undefined)
})
