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


test('预警按开始后经过时长，至少一半且严格早于结束；多次执行按单次时长', () => {
  assert.equal(ruleDraftIssue(draft([period({ warning: null })])).key, 'FacilityEnergy.ruleEditor.errors.warningRequired')
  assert.equal(ruleDraftIssue(draft([period({ warning: 29 })])).key, 'FacilityEnergy.ruleEditor.errors.warningRange')
  assert.equal(ruleDraftIssue(draft([period({ warning: 60 })])).key, 'FacilityEnergy.ruleEditor.errors.warningRange')
  assert.equal(ruleDraftIssue(draft([period({ warning: 40 })])), undefined)
  const two = period({ times: 2, interval: 30, intervalUnit: '1', warning: 15 })
  assert.equal(ruleDraftIssue(draft([two])), undefined)
  assert.equal(serializeRule(draft([two])).weekly['1'][0].warningMinutes, 15)
  assert.equal(ruleDraft(serializeRule(draft([two]))).weekRules[0].periods[0].warning, 15)
})
