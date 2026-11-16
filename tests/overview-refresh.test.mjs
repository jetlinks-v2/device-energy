import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const ports = {
  vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const reactive=value=>value; export const onMounted=run=>mounts.push(run); export const onBeforeUnmount=run=>unmounts.push(run)',
  'vue-router': 'export const useRoute=()=>({query:{projectId:"project/a"}})',
  '@jetlinks-web-core/store': 'export const useMenuStore=()=>({hasMenu:()=>access,jumpPage:(...args)=>args}); export const useAuthStore=()=>({hasPermission:()=>access})',
  '../api': 'export const facility=transport',
  '../api/meterBilling': 'export const meterApi={reviews:async()=>({total:3})}',
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
function setup(get = async url => url.startsWith('reports/overview') ? { devices: 10, online: 7, overdue: 5, faultStates: { open: 2 } } : [], access = true) {
  const calls = [], mounts = [], unmounts = [], timers = [], module = { exports: {} }
  const transport = {
    options: async () => { calls.push('projects'); return [{ id: 'project/a', name: '园区' }, { id: 'project/b', name: '大厦' }] },
    get: url => { calls.push(url); return get(url) },
    query: async (path, query) => { calls.push({ path, query }); return { data: [], total: 0 } }
  }
  const setInterval = run => { timers.push(run); return 1 }
  new Function('transport', 'access', 'mounts', 'unmounts', 'setInterval', 'module', 'exports', bundled.outputFiles[0].text)(transport, access, mounts, unmounts, setInterval, module, module.exports)
  const vm = module.exports.useOverview(); vm.projectId.value = 'project/a'; vm.month.value = '2026-10'
  return { vm, calls, mounts, unmounts, timers }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const overviewCalls = calls => calls.filter(call => typeof call === 'string' && call.startsWith('reports/overview'))

test('综合工作台只加载一次项目目录及作业摘要，不再加载重复24小时能源统计', async () => {
  const { vm, calls } = setup()
  await vm.initialize()
  assert.equal(calls.filter(call => call === 'projects').length, 1)
  assert.equal(overviewCalls(calls).length, 1)
  assert.equal(calls.filter(call => typeof call === 'string' && call.startsWith('reports/energy')).length, 1)
  assert.equal(vm.total.value, 10)
  assert.equal(vm.nonOnline.value, 3)
  assert.equal(vm.taskState.value.counts.overdue, 5)
  assert.deepEqual(vm.faultStates.value, { open: 2 })
})

test('月份和层级只更新能源相关面板，任务、故障、补录及出账不重复请求', async () => {
  const { vm, calls } = setup()
  await vm.refresh()
  calls.length = 0
  await vm.refreshEnergy()
  assert.equal(calls.length, 2)
  vm.level.value = 'submeter'
  await vm.changeLevel()
  assert.equal(calls.length, 5)
  assert.equal(overviewCalls(calls).length, 0)
  assert.ok(calls.every(call => typeof call === 'string' || call.path === 'energy/mappings'))
  assert.equal(vm.total.value, 10)
})

test('项目快速切换后所有摘要与下钻使用新项目，旧作业响应不能回填', async () => {
  const pending = deferred()
  const { vm } = setup(url => url.startsWith('reports/overview')
    ? url.includes('project%2Fa') ? pending.promise : Promise.resolve({ devices: 4, online: 0, overdue: 1 }) : Promise.resolve([]))
  const old = vm.refreshOperations()
  vm.projectId.value = 'project/b'
  await vm.changeProject()
  pending.resolve({ devices: 100, overdue: 50 })
  await old
  assert.equal(vm.total.value, 4)
  assert.equal(vm.taskState.value.projectId, 'project/b')
  assert.deepEqual(vm.go('inspection', 'overdue'), ['facility/Inspection/Tasks', { query: { projectId: 'project/b', overview: 'overdue' } }])
  assert.deepEqual(vm.go('energy', undefined, 'collection'), ['facility/Energy', { query: { projectId: 'project/b', tab: 'collection' } }])
})

test('作业请求失败保留能源结果，局部重试不重新请求能源', async () => {
  let fail = true
  const { vm, calls } = setup(async url => {
    if (url.startsWith('reports/overview')) { if (fail) throw Error('Network Error'); return { devices: 0, online: 0 } }
    return []
  })
  await vm.refresh()
  assert.equal(vm.states.overview.error, 'overviewNetworkError')
  assert.deepEqual(vm.states.energy.data, [])
  assert.equal(vm.total.value, undefined)
  calls.length = 0; fail = false
  await vm.refreshOperations()
  assert.equal(calls.length, 1)
  assert.equal(vm.total.value, 0)
  assert.equal(vm.states.overview.error, '')
})

test('没有权限的审核及跳转不启用，卸载后响应不能回填作业摘要', async () => {
  const pending = deferred()
  const { vm, unmounts, calls } = setup(() => pending.promise, false)
  assert.equal(vm.go('faults'), undefined)
  assert.equal(vm.taskState.value.reviewAccess.inspection, false)
  await vm.refreshTodos()
  assert.equal(calls.length, 0)
  const loading = vm.refreshOperations()
  unmounts.forEach(run => run())
  pending.resolve({ devices: 5 })
  await loading
  assert.equal(vm.total.value, undefined)
})
