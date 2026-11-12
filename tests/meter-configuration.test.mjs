import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const vue = require('vue'), { transformSync } = require('esbuild')
const tick = async () => { await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
function loadShared(name) {
  const code = transformSync(readFileSync(new URL('../shared/' + name + '.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  new Function('module', 'exports', code)(module, module.exports)
  return module.exports
}
function load(name, api, facility = {}, dialogs = [], notices = []) {
  const source = readFileSync(new URL('../hooks/' + name + '.ts', import.meta.url), 'utf8')
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, onMounted: () => {} }
    if (id === '../api') return { facility }
    if (id === '../api/meterBilling') return { meterApi: api }
    if (id === '../shared/i18n') return { feText: key => key }
    if (id === '../shared/types') return { messageOf: cause => cause.message }
    if (id === '../shared/meterBillQuery') return loadShared('meterBillQuery')
    if (id === 'ant-design-vue') return { message: { warning() {}, success: (...args) => notices.push(args), info() {} }, Modal: { confirm: options => dialogs.push(options) } }
    throw Error(id)
  }, module, module.exports)
  return module.exports
}
test('项目分配不查询安装空间，只提交项目和版本', async () => {
  const saved = [], queried = []
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { allocate: async rows => saved.push(rows) },
    { options: async path => { queried.push(path); throw Error('空间服务不可用') } })
  const scope = vue.effectScope(), vm = scope.run(() => useDeviceConfiguration())
  vm.edit([{ id: 'gas', version: 2, projectId: 'p', meterType: 'gas', spaceId: 'room' }]); await tick()
  await vm.save()
  assert.deepEqual(queried, [])
  assert.deepEqual(saved, [[{ id: 'gas', version: 2, projectId: 'p' }]])
  scope.stop()
})

test('混合表计批量分配不会统一覆盖设备类型和安装空间', async () => {
  const saved = []
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { allocate: async rows => saved.push(rows) })
  const scope = vue.effectScope(), vm = scope.run(() => useDeviceConfiguration())
  vm.edit([{ id: 'water', version: 1, projectId: 'a', meterType: 'water' },
    { id: 'gas', version: 3, projectId: 'b', meterType: 'gas', spaceId: 'room' }]); await tick()
  await vm.save(); assert.equal(saved.length, 0)
  vm.targetProject.value = 'c'; await vm.save()
  assert.deepEqual(saved[0], [{ id: 'water', version: 1, projectId: 'c' }, { id: 'gas', version: 3, projectId: 'c' }])
  scope.stop()
})

test('项目分配完成状态只按项目确认判断，不要求重复配置类型', async () => {
  const requests = []
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { devices: async query => { requests.push(query); return { data: [], total: 0 } } })
  const scope = vue.effectScope(), vm = scope.run(() => useDeviceConfiguration())
  vm.state.value = 'ready'; await vm.request({})
  assert.deepEqual(requests[0].terms[0].terms, [{ column: 'projectConfirmed', value: true }])
  vm.state.value = 'pending'; await vm.request({})
  assert.deepEqual(requests[1].terms[0].terms, [{ column: 'projectConfirmed', value: false }])
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

test('审核全部成功短暂提示，部分失败保留原因且不提示全部成功', async () => {
  const notices = []
  let results = [{ id: 'one', success: true }]
  const { useMeterBillReview } = load('useMeterBillReview', { review: async () => results }, {}, [], notices)
  const vm = useMeterBillReview('5G', () => {})
  vm.start('review', [{ id: 'one', version: 1, state: 'pending' }]); await vm.confirm()
  assert.deepEqual(notices, [['approvalSucceeded 1', 3]])
  results = [{ id: 'one', success: true }, { id: 'two', success: false, error: '账单已经变化' }]
  vm.start('review', [{ id: 'one', version: 1 }, { id: 'two', version: 2 }]); await vm.confirm()
  assert.equal(notices.length, 1)
  assert.equal(vm.outcomes.value.filter(row => !row.success)[0].error, '账单已经变化')
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

test('能源快捷筛选与OR搜索取交集，全部费用移除固定分类且保留分页', () => {
  const { meterBillQuery } = loadShared('meterBillQuery')
  const query = { pageIndex: 2, pageSize: 12, terms: [{ column: 'fullName', value: '201' }, { type: 'or', column: 'customerName', value: '李白' }] }
  const gas = meterBillQuery(query, 'gas', 'energyType')
  assert.equal(gas.pageIndex, 2)
  assert.deepEqual(gas.terms, [{ column: 'energyType', termType: 'eq', value: 'gas' }, { type: 'and', terms: query.terms }])
  assert.deepEqual(meterBillQuery(query, 'all', 'energyType'), query)
})

test('审核能源切换清理勾选、保留状态搜索并丢弃旧响应；确认期间不能切换', async () => {
  const requests = [], submitted = []
  const { useMeterBillReview } = load('useMeterBillReview', {
    reviews: (project, state, query) => new Promise(resolve => requests.push({ project, state, query, resolve })),
    review: async (action, rows) => { submitted.push(rows); return [] }
  })
  const vm = useMeterBillReview('5G', () => {})
  vm.filter([{ column: 'month', value: '2026-10' }]); vm.changeStatus('approved')
  const old = vm.request({ terms: vm.params.value.terms, pageIndex: 0 })
  vm.selected.value = [{ id: 'water', version: 1, state: 'pending' }]
  vm.changeEnergy('gas'); assert.equal(vm.selected.value.length, 0)
  const current = vm.request({ terms: vm.params.value.terms, pageIndex: 0 })
  assert.equal(requests[1].state, 'approved')
  assert.equal(requests[1].query.terms[0].column, 'meterType'); assert.equal(requests[1].query.terms[0].value, 'gas')
  assert.deepEqual(requests[1].query.terms[1].terms, [{ column: 'month', value: '2026-10' }])
  requests[1].resolve({ data: [{ id: 'gas' }], total: 1 }); assert.equal((await current).result.data[0].id, 'gas')
  requests[0].resolve({ data: [{ id: 'water' }], total: 1 }); assert.equal((await old).result.data.length, 0)
  vm.start('review', [{ id: 'gas', version: 2, state: 'pending' }]); vm.changeEnergy('water')
  assert.equal(vm.energy.value, 'gas'); await vm.confirm()
  assert.deepEqual(submitted[0].map(row => row.id), ['gas'])
})

test('台账能源筛选请求后端快照类型，快速切换不会显示旧分类响应', async () => {
  const requests = []
  const { useMeterBillLedger } = load('useMeterBillLedger', { ledger: (project, query) => new Promise(resolve => requests.push({ query, resolve })) })
  const scope = vue.effectScope(), vm = scope.run(() => useMeterBillLedger(vue.ref('5G')))
  vm.changeEnergy('water'); const old = vm.request({ pageIndex: 0, pageSize: 20 })
  vm.changeEnergy('gas'); const current = vm.request({ pageIndex: 0, pageSize: 20 })
  assert.equal(requests[1].query.terms[0].column, 'energyType'); assert.equal(requests[1].query.terms[0].value, 'gas')
  requests[1].resolve({ data: [{ id: 'gas' }], total: 1 }); assert.equal((await current).result.total, 1)
  requests[0].resolve({ data: [{ id: 'water' }], total: 1 }); assert.equal((await old).result.total, 0)
  vm.changeEnergy('all'); const all = vm.request({ pageIndex: 0 })
  assert.equal(requests[2].query.terms, undefined); requests[2].resolve({ data: [], total: 0 }); await all
  scope.stop()
})
