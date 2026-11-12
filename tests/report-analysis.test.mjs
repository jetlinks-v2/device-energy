import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url)), require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useReportAnalysis.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'report-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api|@jetlinks-web-core\/store)$/ }, args => ({ path: args.path, namespace: 'report-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'report-port' }, args => ({ contents: args.path === 'vue'
      ? 'export const ref=value=>({value}); export const reactive=value=>value; export const computed=read=>({get value(){return read()}}); export const onMounted=()=>{}; export const onBeforeUnmount=()=>{}'
      : args.path.endsWith('/store') ? 'export const useMenuStore=()=>({jumpPage:()=>{}})' : 'export const facility=transport' }))
  } }]
})
function setup() {
  const calls = [], transport = { get: url => new Promise((resolve, reject) => calls.push({ url, resolve, reject })), post: async (url, query) => ({ data: [], total: 0, pageIndex: query.pageIndex, pageSize: query.pageSize, url, query }) }
  const module = { exports: {} }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  return { calls, vm: module.exports.useReportAnalysis() }
}

test('only selected tab loads and meter level remains master when none are configured', async () => {
  const { vm, calls } = setup()
  let run = vm.refresh()
  assert.equal(calls.length, 1); assert.match(calls[0].url, /^reports\/work\?/)
  calls.shift().resolve({ total: 0 }); await run
  vm.tab.value = 'energy'; run = vm.changeTab()
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /reports\/energy\/analysis\?.*level=master/)
  assert.match(calls[1].url, /reports\/targets\/analysis\?/)
  calls[0].resolve({ summary: { meterCount: 0 } }); calls[1].resolve({ count: 0 }); await run
  assert.equal(vm.level.value, 'master'); assert.equal(vm.panels.energy.data.summary.meterCount, 0)
})

test('energy and monthly plan fail independently and old project response cannot replace new scope', async () => {
  const { vm, calls } = setup(); vm.tab.value = 'energy'; vm.projectId.value = 'old'
  const old = vm.refresh(), first = calls.splice(0)
  vm.projectId.value = 'new'; const next = vm.invalidate(), latest = calls.splice(0)
  assert.ok(latest.every(call => call.url.includes('projectId=new')))
  latest[0].resolve({ summary: { meterCount: 1, value: 0 } }); latest[1].reject(Error('plan unavailable')); await next
  assert.equal(vm.panels.energy.data.summary.value, 0); assert.equal(vm.panels.energy.error, '')
  assert.equal(vm.panels.targets.error, 'plan unavailable')
  first[0].resolve({ summary: { value: 999 } }); first[1].resolve({ count: 999 }); await old
  assert.equal(vm.panels.energy.data.summary.value, 0); assert.equal(vm.panels.targets.data, undefined)
})

test('date drill retains project period kind and the server page request', async () => {
  const { vm } = setup(); vm.projectId.value = 'project'; vm.kind.value = 'maintenance'
  vm.openDrill('2026-11-04')
  const result = await vm.requestDetails({ pageIndex: 2, pageSize: 12 })
  assert.match(result.result.url, /reports\/work\/_query\?.*kind=maintenance/)
  assert.match(result.result.url, /projectId=project/)
  assert.equal(result.result.query.pageIndex, 2)
  assert.equal(result.result.query.terms[1].column, 'scheduledTime')
  assert.equal(result.result.query.terms[2].termType, 'lt')
})

test('invalid date range cannot refresh or accidentally export old report scope', async () => {
  const { vm, calls } = setup()
  vm.change({ filter: { terms: [{ column: 'timeRange', termType: 'btw', value: [1, 367 * 86400000] }] } })
  assert.equal(vm.valid.value, false); assert.ok(vm.error.value); await vm.refresh(); assert.equal(calls.length, 0)
})

test('group comparison drill preserves the selected group and verified fault trend uses closed final state', async () => {
  const { vm } = setup()
  vm.panels.work.data = { groups: [{ id: 'group-one', name: 'Equipment', onTimeRate: 100 }] }
  vm.chartClick({ name: 'Equipment', dataIndex: 0 }, 'left')
  assert.match(vm.drill.value.query, /groupId=group-one/)
  vm.tab.value = 'faults'; vm.faultMode.value = 'faults'
  const verifiedName = vm.view.value.main.option.series[1].name
  vm.chartClick({ name: '2026-11-04', seriesName: verifiedName })
  assert.ok(vm.drill.value.terms.some(term => term.column === 'state' && term.value === 'closed'))
  assert.ok(vm.drill.value.terms.some(term => term.column === 'completedTime'))
  assert.ok(!vm.drill.value.terms.some(term => term.column === 'createTime'))
})

test('zero valid energy remains a plotted zero while missing readings remain empty', () => {
  const { vm } = setup(); vm.tab.value = 'energy'
  vm.panels.energy.data = { summary: { value: 0, dailyAverage: 0, previousRate: 0, unit: 'kWh' }, trend: [{ date: '2026-11-01', value: 0 }], devices: [] }
  assert.equal(vm.view.value.main.empty, false)
  assert.equal(vm.view.value.metrics[0].value, '0 kWh')
  assert.equal(vm.view.value.metrics[2].value, '0%')
  vm.panels.energy.data.trend[0].value = null; vm.panels.energy.data.summary.value = null
  assert.equal(vm.view.value.main.empty, true)
  assert.equal(vm.view.value.metrics[0].value, '—')
})

test('CSV exports the current scope and chart values while protecting spreadsheet formula names', async () => {
  const code = await build({ entryPoints: [resolve(root, 'components/reports/reportCharts.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' })
  const module = { exports: {} }; new Function('module', 'exports', code.outputFiles[0].text)(module, module.exports)
  const view = { metrics: [{ title: 'Completed', value: '3' }], main: { title: 'Trend', rows: [['Date', 'Count'], ['2026-11-04', 3]] }, left: { title: 'Devices', rows: [['Name', 'Count'], ['=1+1', 3]] } }
  const csv = module.exports.reportCsv(view, { project: 'Current project', from: 1000, to: 2000, kind: 'inspection', energyType: 'water', level: 'master' })
  assert.ok(csv.includes('Current project')); assert.ok(csv.includes('1970-01-01T00:00:01.000Z')); assert.ok(csv.includes('"2026-11-04","3"'))
  assert.ok(csv.includes('"\'=1+1","3"')); assert.ok(!csv.includes('"=1+1"'))
})
