import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const ports = {
  vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const onMounted=()=>{}; export const onBeforeUnmount=()=>{}',
  '@jetlinks-web-core/store': 'export const useMenuStore=()=>({hasMenu:()=>true}); export const useAuthStore=()=>({hasPermission:()=>true})',
  './useReports': 'export const useReports=()=>reports',
  '../api': 'export const facility=transport',
  '../shared/i18n': 'export const feText=key=>key',
  '../shared/types': 'export const messageOf=error=>error.message'
}
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useOverview.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'overview-ports', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in ports ? { path: args.path, namespace: 'test-port' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: ports[args.path] }))
  } }]
})
function setup(load) {
  const calls = [], module = { exports: {} }
  const reports = {
    projectId: { value: 'project/a' }, level: { value: 'submeter' },
    overview: { value: { devices: 10, online: 10, overdue: 5 } }, rows: { value: [{ deviceId: 'old' }] },
    busy: { value: false }, error: { value: '' }, from: { value: 0 }, to: { value: 0 }, projects: { value: [] },
    refresh: async () => calls.push('full-refresh')
  }
  const transport = { get: async url => { calls.push(url); return load(url) } }
  new Function('reports', 'transport', 'module', 'exports', bundled.outputFiles[0].text)(reports, transport, module, module.exports)
  return { vm: module.exports.useOverview(), reports, calls }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('层级切换只请求能源，保持上方数据和整页加载状态', async () => {
  const pending = deferred()
  const { vm, reports, calls } = setup(() => pending.promise)
  const original = reports.overview.value
  const refreshing = vm.refreshEnergy()
  assert.equal(vm.energyStatus.value.loading, true)
  assert.equal(reports.busy.value, false)
  assert.equal(reports.overview.value, original)
  pending.resolve([{ deviceId: 'new' }])
  await refreshing
  assert.equal(calls.length, 1)
  const url = new URL(calls[0], 'https://example.test/')
  assert.equal(url.pathname, '/reports/energy')
  assert.equal(url.searchParams.get('projectId'), 'project/a')
  assert.equal(url.searchParams.get('level'), 'submeter')
  assert.equal(Number(url.searchParams.get('to')) - Number(url.searchParams.get('from')), 86400000)
  assert.deepEqual(reports.rows.value, [{ deviceId: 'new' }])
  assert.equal(vm.energyStatus.value.loading, false)
})
test('切换项目使旧层级响应失效，默认总表并触发完整刷新', async () => {
  const pending = deferred()
  const { vm, reports, calls } = setup(() => pending.promise)
  const refreshing = vm.refreshEnergy()
  reports.projectId.value = 'new-project'
  await vm.changeProject()
  reports.rows.value = [{ deviceId: 'new-project-meter' }]
  pending.resolve([{ deviceId: 'old-project-meter' }])
  await refreshing
  assert.equal(reports.level.value, 'master')
  assert.equal(calls.at(-1), 'full-refresh')
  assert.deepEqual(reports.rows.value, [{ deviceId: 'new-project-meter' }])
  assert.equal(vm.energyStatus.value.loading, false)
})
test('能源请求失败仅在能源区域显示错误，重试后恢复', async () => {
  let fail = true
  const { vm, reports } = setup(() => { if (fail) throw Error('Network Error'); return [] })
  await vm.refreshEnergy()
  assert.equal(vm.energyStatus.value.error, 'overviewNetworkError')
  assert.equal(reports.error.value, '')
  assert.equal(reports.overview.value.devices, 10)
  fail = false
  await vm.refreshEnergy()
  assert.equal(vm.energyStatus.value.error, '')
  assert.deepEqual(reports.rows.value, [])
})
