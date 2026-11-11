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
test('确认仅提交服务端指纹和账期，部分出账失败保持可见', async () => {
  const submitted = [], dialogs = []
  const { useMeterBillPreview } = load('useMeterBillPreview', { generate: async rows => {
    submitted.push(rows); return [{ id: 'one', result: { billId: 'bill' } }, { id: 'two', deviceName: '102水表', error: '月结已关闭' }]
  } }, {}, dialogs)
  const project = vue.ref('p'), scope = vue.effectScope(), vm = scope.run(() => useMeterBillPreview(project))
  vm.month.value = '2024-02'; vm.receivableDate.value = '2024-03-01'; vm.dueDate.value = '2024-03-20'; await tick(); vm.preview()
  vm.selectedRows.value = [{ id: 'one', result: { fingerprint: 'fp1', amount: 999 } }, { id: 'two', result: { fingerprint: 'fp2', amount: 888 } }]
  vm.selected.value = ['one', 'two']; vm.generate(); await dialogs[0].onOk()
  assert.deepEqual(Object.keys(submitted[0][0]).sort(), ['deviceId', 'dueDate', 'fingerprint', 'month', 'receivableDate'])
  assert.equal(vm.results.value[1].error, '月结已关闭'); assert.equal(vm.selected.value.length, 0)
  scope.stop()
})
test('出账确认打开后切换项目使旧确认失效', async () => {
  let generated = 0; const dialogs = []
  const { useMeterBillPreview } = load('useMeterBillPreview', { generate: () => { generated++ } }, {}, dialogs)
  const project = vue.ref('p'), scope = vue.effectScope(), vm = scope.run(() => useMeterBillPreview(project))
  vm.month.value = '2024-02'; vm.receivableDate.value = '2024-03-01'; vm.dueDate.value = '2024-03-20'; await tick(); vm.preview()
  vm.selectedRows.value = [{ id: 'one', result: { fingerprint: 'fp1' } }]; vm.generate()
  project.value = 'other'; await tick(); await dialogs[0].onOk(); assert.equal(generated, 0)
  scope.stop()
})
