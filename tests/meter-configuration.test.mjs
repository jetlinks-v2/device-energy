import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const vue = require('vue'), { transformSync } = require('esbuild')
const tick = async () => { await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
function load(name, api, facility = {}, dialogs = []) {
  const source = readFileSync(new URL('../hooks/' + name + '.ts', import.meta.url), 'utf8')
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, onMounted: () => {} }
    if (id === '../api') return { facility }
    if (id === '../api/meterBilling') return { meterApi: api }
    if (id === '../shared/i18n') return { feText: key => key }
    if (id === '../shared/types') return { messageOf: cause => cause.message }
    if (id === 'ant-design-vue') return { message: { warning() {}, success() {}, info() {} }, Modal: { confirm: options => dialogs.push(options) } }
    throw Error(id)
  }, module, module.exports)
  return module.exports
}
test('单设备空间加载中或失败时不保存，加载后保留原安装空间', async () => {
  let resolve, reject; const saved = []
  const facility = { options: () => new Promise((ok, fail) => { resolve = ok; reject = fail }) }
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { allocate: async rows => { saved.push(rows) } }, facility)
  const scope = vue.effectScope(), vm = scope.run(() => useDeviceConfiguration())
  const row = { id: 'meter', version: 2, projectId: 'p', meterType: 'water', spaceId: 'room' }
  vm.edit([row]); await tick()
  assert.equal(vm.spaceId.value, 'room'); assert.equal(vm.spacesLoading.value, true)
  await vm.save(); assert.equal(saved.length, 0)
  reject(Error('space service failed')); await tick(); await vm.save(); assert.equal(saved.length, 0)
  vm.edit([row]); await tick(); resolve([{ id: 'room', name: '101', fullName: '园区/1栋/101' }]); await tick()
  assert.equal(vm.spacesReady.value, true); assert.equal(vm.spaceId.value, 'room')
  await vm.save(); assert.equal(saved[0][0].spaceId, 'room'); assert.equal(saved[0][0].updateSpace, true)
  scope.stop()
})
test('切换项目后旧空间请求不能覆盖新项目候选或恢复旧空间', async () => {
  const requests = new Map()
  const { useDeviceConfiguration } = load('useDeviceConfiguration', {}, { options: path => new Promise(resolve => requests.set(path, resolve)) })
  const scope = vue.effectScope(), vm = scope.run(() => useDeviceConfiguration())
  vm.edit([{ id: 'meter', version: 0, projectId: 'a', spaceId: 'old' }]); await tick()
  vm.targetProject.value = 'b'; await tick()
  requests.get('spaces/b')([{ id: 'new', name: '新空间' }]); await tick()
  requests.get('spaces/a')([{ id: 'old', name: '旧空间' }]); await tick()
  assert.equal(vm.spaceId.value, undefined); assert.deepEqual(vm.spaces.value.map(row => row.value), ['new'])
  scope.stop()
})
test('审核只提交版本和意见，批量部分失败保留原因', async () => {
  const submitted = [], changed = []
  const { useMeterBillReview } = load('useMeterBillReview', { review: async (action, rows) => {
    submitted.push({ action, rows }); return [{ id: 'one', success: true }, { id: 'two', name: '102水表', success: false, error: '读数已经变化' }]
  } })
  const vm = useMeterBillReview('5G', () => changed.push(true))
  vm.selected.value = [{ id: 'one', version: 3, amount: 999, state: 'pending' }, { id: 'two', version: 4, state: 'pending' }]
  vm.start('review'); await vm.confirm()
  assert.equal(submitted[0].action, 'review')
  assert.deepEqual(Object.keys(submitted[0].rows[0]).sort(), ['comment', 'id', 'version'])
  assert.equal(submitted[0].rows[0].version, 3)
  assert.equal(vm.outcomes.value[1].error, '读数已经变化')
  assert.equal(vm.selected.value.length, 0); assert.equal(changed.length, 1)
})

test('驳回必须填原因，状态/条件切换清理已选账单', async () => {
  let submitted = 0
  const { useMeterBillReview } = load('useMeterBillReview', { review: async () => { submitted++; return [] } })
  const vm = useMeterBillReview('5G', () => {})
  vm.selected.value = [{ id: 'one', version: 3, state: 'pending' }]
  vm.start('reject'); await vm.confirm(); assert.equal(submitted, 0); assert.ok(vm.error.value)
  vm.action.value = undefined; vm.changeStatus('approved'); assert.equal(vm.selected.value.length, 0)
  vm.selected.value = [{ id: 'old', version: 1 }]; vm.filter([{ column: 'month', value: '2026-10' }]); assert.equal(vm.selected.value.length, 0)
})

test('台账默认查询不依赖日期，切换项目后旧响应不能覆盖', async () => {
  const requests = new Map()
  const { useMeterBillLedger } = load('useMeterBillLedger', { ledger: (project, query) => new Promise(resolve => requests.set(project, resolve)) })
  const scope = vue.effectScope(), project = vue.ref('5G'), vm = scope.run(() => useMeterBillLedger(project))
  const old = vm.request({ pageIndex: 0, pageSize: 20 })
  project.value = 'new'; await tick()
  const current = vm.request({ pageIndex: 0, pageSize: 20 })
  requests.get('new')({ data: [{ id: 'new-bill' }], total: 1 }); assert.equal((await current).result.data[0].id, 'new-bill')
  requests.get('5G')({ data: [{ id: 'old-bill' }], total: 1 }); assert.equal((await old).result.data.length, 0)
  scope.stop()
})
