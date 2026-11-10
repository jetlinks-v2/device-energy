import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useReports.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'report-test-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: args.path === 'vue'
      ? 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const onMounted=()=>{}; export const onBeforeUnmount=()=>{}'
      : 'export const facility=transport' }))
  } }]
})
function setup() {
  const calls = []
  const transport = { get: url => new Promise((resolve, reject) => calls.push({ url, resolve, reject })) }
  const module = { exports: {} }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  return { calls, vm: module.exports.useReports(true) }
}
const complete = (calls, project) => calls.forEach(call => call.resolve(call.url.includes('/overview?') ? { project } : [{ project }]))

test('快速切换统计条件时只展示最后一次结果，所有接口使用同一份条件', async () => {
  const { vm, calls } = setup()
  vm.projectId.value = 'old'
  const old = vm.refresh(), first = calls.splice(0)
  vm.projectId.value = 'new'
  vm.from.value = 1000; vm.to.value = 2000
  const latest = vm.refresh(), second = calls.splice(0)
  assert.equal(second.length, 5)
  assert.ok(second.every(call => call.url.includes('projectId=new')))
  assert.ok(second.filter(call => /energy\?|operations\?|comparison\?/.test(call.url)).every(call => call.url.includes('from=1000&to=2000')))
  complete(second, 'new'); await latest
  complete(first, 'old'); await old
  assert.deepEqual(vm.overview.value, { project: 'new' })
  assert.deepEqual(vm.rows.value, [{ project: 'new' }])
  assert.deepEqual(vm.targets.value, [{ project: 'new' }])
  assert.equal(vm.busy.value, false)
})

test('旧请求报错不能覆盖新筛选，也不能提前结束新请求的加载状态', async () => {
  const { vm, calls } = setup()
  const old = vm.refresh(), first = calls.splice(0)
  const latest = vm.refresh(), second = calls.splice(0)
  first.forEach(call => call.reject(new Error('old failure'))); await old
  assert.equal(vm.error.value, '')
  assert.equal(vm.busy.value, true)
  complete(second, 'new'); await latest
  assert.equal(vm.busy.value, false)
})

test('切换主筛选后旧周期报表响应失效，当前请求失败明确展示错误', async () => {
  const { vm, calls } = setup()
  const period = vm.loadPeriods(), first = calls.splice(0)
  const latest = vm.refresh(), second = calls.splice(0)
  first[0].resolve([{ period: 'old', meters: [] }]); await period
  assert.deepEqual(vm.periodRows.value, [])
  second.forEach(call => call.reject(new Error('current failure'))); await latest
  assert.equal(vm.error.value, 'current failure')
  assert.deepEqual(vm.rows.value, [])
  assert.equal(vm.busy.value, false)
})
