import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync } = require('esbuild')
const built = buildSync({ entryPoints: [resolve(root, 'shared/overview.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' })
const module = { exports: {} }
new Function('module', 'exports', built.outputFiles[0].text)(module, module.exports)
const { overviewEnergy, overviewTerms, loadOverviewEnergy } = module.exports
const meter = (energyType, value, unit, complete = true) => ({ energyType, unit, usage: { value, complete } })

test('没有总表时默认显示分表，同层缺读数不会混入其他层级', async () => {
  const called = []
  const rows = [meter('water', null, 'm³', false)]
  const selected = await loadOverviewEnergy(async level => {
    called.push(level)
    return level === 'submeter' ? rows : []
  })
  assert.equal(selected.level, 'submeter')
  assert.deepEqual(selected.rows, rows)
  assert.deepEqual(called, ['master', 'submeter'])
})
test('手选空层级保持空态，自动选择全空及请求失败均不伪造数据', async () => {
  const called = []
  assert.deepEqual(await loadOverviewEnergy(async level => { called.push(level); return [] }, 'branch'), { rows: [], level: 'branch' })
  assert.deepEqual(called, ['branch'])
  assert.deepEqual(await loadOverviewEnergy(async () => []), { rows: [], level: 'master' })
  await assert.rejects(loadOverviewEnergy(async () => { throw Error('network') }), /network/)
})

test('水电气分开汇总，兼容同类单位，缺失不冒充零', () => {
  const rows = [meter('water', 12.5, 'm³'), meter('water', 2.5, 'm3'), meter('electricity', 80, 'kWh'), meter('gas', 4, 'm³')]
  assert.equal(overviewEnergy(rows, 'water').value, 15)
  assert.equal(overviewEnergy(rows, 'electricity').value, 80)
  assert.equal(overviewEnergy(rows, 'gas').value, 4)
  assert.equal(overviewEnergy([], 'water').value, undefined)
  assert.equal(overviewEnergy([meter('water', 0, 'm³')], 'water').value, 0)
})
test('单位不一致不能相加，不完整和无效读数不能表示完整', () => {
  assert.deepEqual(overviewEnergy([meter('water', 2, 'L')], 'water'), { value: undefined, complete: false, invalidUnit: true, count: 1, unit: 'm³' })
  assert.equal(overviewEnergy([meter('water', 2, 'm³', false)], 'water').complete, false)
  assert.equal(overviewEnergy([meter('water', NaN, 'm³')], 'water').value, undefined)
  assert.equal(overviewEnergy([meter('water', null, 'm³')], 'water').value, undefined)
})
test('逾期条件排除已完成与关闭任务，并携带项目', () => {
  assert.deepEqual(overviewTerms('tasks', { projectId: 'p', overview: 'overdue' }, 100), [
    { column: 'projectId', termType: 'eq', value: 'p' },
    { column: 'deadline', termType: 'lt', value: 100 },
    { column: 'state', termType: 'nin', value: ['completed', 'cancelled', 'closed'] }
  ])
})
test('待接单与进行中下钻使用同一任务阶段，整改仍属于进行中', () => {
  assert.deepEqual(overviewTerms('tasks', { projectId: 'p', overview: 'claim' }), [
    { column: 'projectId', termType: 'eq', value: 'p' }, { column: 'state', termType: 'eq', value: 'open' }
  ])
  assert.deepEqual(overviewTerms('tasks', { overview: 'progress' }), [
    { column: 'state', termType: 'in', value: ['claimed', 'executing', 'rectify'] }
  ])
})
test('今日任务按上海自然日，不受浏览器时区影响', () => {
  const now = Date.parse('2026-11-10T17:00:00Z')
  const terms = overviewTerms('tasks', { overview: 'today' }, now)
  assert.equal(terms[0].value, Date.parse('2026-11-10T16:00:00Z'))
  assert.equal(terms[1].value, Date.parse('2026-11-11T16:00:00Z'))
  assert.deepEqual(terms[2].value, ['cancelled', 'closed'])
})
test('预警、通知的两类页签使用相同筛选，其他资源不套用状态', () => {
  for (const path of ['alerts', 'planAlerts']) assert.deepEqual(overviewTerms(path, { overview: 'alerts' })[0].value, ['closed', 'recovered'])
  for (const path of ['notifications', 'planNotifications']) assert.deepEqual(overviewTerms(path, { overview: 'failed' })[0].value, ['failed', 'uncertain'])
  assert.deepEqual(overviewTerms('devices', { overview: 'overdue' }), [])
})
