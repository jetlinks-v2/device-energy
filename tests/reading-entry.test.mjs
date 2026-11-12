import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  stdin: { contents: "export { useManualReading } from './hooks/useManualReading'; export { useReadingReview } from './hooks/useReadingReview'; export { facilityClient } from './shared/client'", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'reading-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'port' }))
    builder.onLoad({ filter: /.*/, namespace: 'port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const reactive=value=>value; export const computed=read=>({get value(){return read()}}); export const onMounted=()=>{}',
      '../api': 'export const facility=transport'
    }[args.path] }))
  } }]
})
function setup() {
  const calls = [], transport = {
    query: async (...args) => { calls.push(['query', ...args]); return { data: [], total: 0 } },
    manualReading: async (...args) => { calls.push(['manual', ...args]) },
    reviewReading: async (...args) => { calls.push(['review', ...args]) },
    context: async () => ({ userId: 'reviewer' })
  }, module = { exports: {} }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  let saved = 0, changed = 0, reloads = 0
  const manual = module.exports.useManualReading(() => 'p1', () => saved++)
  const review = module.exports.useReadingReview(() => changed++)
  review.table.value = { reload: () => reloads++ }
  const ownRecords = module.exports.useReadingReview(() => changed++, true)
  return { manual, review, ownRecords, calls, transport, api: module.exports, counts: () => ({ saved, changed, reloads }) }
}
const meter = (id = 'm1') => ({ id, deviceId: 'd/1', name: '201水表', energyType: 'water', enabled: true,
  metrics: [{ propertyId: 'total', name: '总读数', kind: 'counter', unit: 'm³' }, { propertyId: 'pressure', kind: 'instant' }] })
const reading = (overrides = {}) => ({ id: 'r/1', version: 7, deviceId: 'd1', source: 'manual', status: 'pending', creatorId: 'entry-user', ...overrides })
function fill(vm) {
  vm.form.projectId = 'p1'; vm.mappings.value = [meter()]; vm.changeMeter('m1')
  Object.assign(vm.form, { value: '12345678901234567890.123456789012', observedTime: Date.now() - 1000, reason: ' 历史读数补录 ' })
}

test('项目设备切换清空原关联，仅提供计量指标；设备搜索按项目在服务端执行', async () => {
  const { manual: vm, calls, transport } = setup()
  fill(vm)
  assert.equal(vm.form.propertyId, 'total')
  assert.equal(vm.metrics.value.length, 1)
  transport.query = async (...args) => { calls.push(['query', ...args]); return { data: [meter('m2')], total: 1 } }
  vm.changeProject('p2'); await new Promise(done => setImmediate(done))
  assert.equal(vm.form.mappingId, ''); assert.equal(vm.form.propertyId, ''); assert.equal(vm.form.value, undefined)
  await vm.load('厨房')
  assert.deepEqual(calls.at(-1), ['query', 'energy/mappings', { pageIndex: 0, pageSize: 50, terms: [
    { column: 'projectId', value: 'p2' }, { column: 'enabled', value: true }, { column: 'name', termType: 'like', value: '%厨房%' }
  ] }])
})

test('旧项目查询响应晚到不能覆盖新项目设备', async () => {
  const { manual: vm, transport } = setup()
  let release
  transport.query = async (_path, query) => query.terms[0].value === 'old'
    ? new Promise(done => { release = done }) : { data: [meter('new')], total: 1 }
  vm.changeProject('old'); vm.changeProject('new')
  await new Promise(done => setImmediate(done))
  release({ data: [meter('old')], total: 1 }); await new Promise(done => setImmediate(done))
  assert.equal(vm.mappings.value[0].id, 'new')
})

test('补录保持原始小数精度，校验未来时间、负数和原因，提交成功后通知刷新', async () => {
  const { manual: vm, calls, counts } = setup()
  fill(vm)
  const timestamp = vm.form.observedTime
  await vm.submit()
  assert.deepEqual(calls[0], ['manual', 'd/1', { propertyId: 'total', value: '12345678901234567890.123456789012', observedTime: timestamp, reason: '历史读数补录' }])
  assert.equal(counts().saved, 1)
  for (const change of [{ value: '-1' }, { value: '' }, { value: '1.1234567890123' }, { value: '1'.repeat(33) }, { observedTime: Date.now() + 60000 }, { observedTime: undefined }, { reason: ' ' }]) {
    fill(vm); Object.assign(vm.form, change); await vm.submit(); assert.ok(vm.error.value)
  }
  assert.equal(calls.length, 1)
})

test('补录保存失败保留输入；提交中阻止重复保存和项目切换', async () => {
  const { manual: vm, transport, counts } = setup()
  fill(vm)
  let release, writes = 0
  transport.manualReading = async () => { writes++; await new Promise(done => { release = done }); throw Error('设备无写入权限') }
  const pending = vm.submit(); await vm.submit(); vm.changeProject('p2')
  assert.equal(vm.form.projectId, 'p1'); assert.equal(writes, 1)
  release(); await pending
  assert.equal(vm.form.value, '12345678901234567890.123456789012')
  assert.equal(vm.error.value, '设备无写入权限'); assert.equal(vm.saving.value, false); assert.equal(counts().saved, 0)
})

test('审核快捷筛选及搜索OR条件始终限定人工来源，并保留服务端分页排序', async () => {
  const { review: vm, calls } = setup()
  const terms = [{ column: 'deviceId', value: 'd1' }, { type: 'or', column: 'source', value: 'cloud' }]
  for (const status of ['pending', 'accepted', 'rejected', 'all']) {
    vm.changeStatus(status); vm.filter(terms)
    const query = { pageIndex: 2, pageSize: 12, terms, sorts: [{ name: 'observedTime', order: 'desc' }] }
    await vm.request(query)
    assert.deepEqual(calls.at(-1), ['query', 'energy/readings', { ...query, terms: [
      { column: 'source', value: 'manual' }, ...(status === 'all' ? [] : [{ column: 'status', value: status }]), { type: 'and', terms }
    ] }, ''])
  }
})

test('审核禁止本人、非人工、非待审核；通过驳回携带版本，失败保留确认窗口', async () => {
  const { review: vm, calls, transport, counts, api } = setup()
  assert.equal(vm.canReview(reading()), false)
  await vm.loadContext()
  for (const row of [reading({ creatorId: 'reviewer' }), reading({ source: 'cloud' }), reading({ status: 'accepted' })]) {
    vm.start(row, true); assert.equal(vm.target.value, undefined)
  }
  const original = reading(); vm.start(original, true); original.version = 999
  await vm.confirm()
  assert.equal(calls[0][1].version, 7); assert.equal(calls[0][2], true)
  assert.deepEqual(counts(), { saved: 0, changed: 1, reloads: 1 })
  vm.start(reading({ id: 'reject' }), false)
  transport.reviewReading = async () => { throw Error('版本已变化') }
  await vm.confirm()
  assert.equal(vm.error.value, '版本已变化'); assert.equal(vm.target.value.id, 'reject'); assert.equal(vm.busy.value, false)
  const http = { post: async (...args) => args }
  assert.deepEqual(await api.facilityClient(http).reviewReading(reading(), false),
    ['/property/facility-energy/energy/readings/r%2F1/review', { version: 7, approve: false }])
  assert.deepEqual(await api.facilityClient(http).manualReading('d/1', { value: '1.20' }),
    ['/property/facility-energy/energy/readings/d%2F1', { value: '1.20' }])
})

test('审核失败与查询失败展示真实原因；处理中不能重复审核或切换条件', async () => {
  const { review: vm, transport, counts } = setup()
  await vm.loadContext(); vm.start(reading(), false)
  let release, writes = 0
  transport.reviewReading = async (_row, pass) => { assert.equal(pass, false); writes++; await new Promise(done => { release = done }) }
  const pending = vm.confirm(); await vm.confirm(); vm.changeStatus('all'); vm.filter([{ column: 'deviceId', value: 'd2' }])
  assert.equal(writes, 1); assert.equal(vm.status.value, 'pending'); assert.deepEqual(vm.params.value.terms, [])
  release(); await pending; assert.equal(counts().changed, 1)
  transport.query = async () => { throw Error('项目无访问权限') }
  await assert.rejects(vm.request({}), /项目无访问权限/); assert.equal(vm.error.value, '项目无访问权限')
})

test('账号上下文获取失败时禁止审核，列表查询不能覆盖身份错误提示', async () => {
  const { review: vm, transport } = setup()
  await vm.loadContext()
  transport.context = async () => { throw Error('登录状态失效') }
  await vm.loadContext(); await vm.request({})
  assert.equal(vm.canReview(reading()), false)
  assert.equal(vm.contextError.value, '登录状态失效')
})

test('补录记录默认全部，调用本人查询接口；只有自己驳回的记录可以重新编辑', async () => {
  const { ownRecords: vm, calls } = setup()
  assert.equal(vm.status.value, 'all')
  await vm.loadContext()
  assert.equal(vm.canEdit(reading({ creatorId: 'reviewer', status: 'rejected' })), true)
  for (const row of [reading({ status: 'rejected' }), reading({ creatorId: 'reviewer' }),
    reading({ creatorId: 'reviewer', status: 'rejected', source: 'cloud' }), reading({ creatorId: 'reviewer', status: 'superseded' })]) assert.equal(vm.canEdit(row), false)
  assert.equal(vm.canReview(reading()), false)
  for (const status of ['all', 'pending', 'accepted', 'rejected', 'resubmitted']) {
    vm.changeStatus(status)
    const terms = [{ column: 'projectId', value: 'p1' }, { type: 'or', column: 'creatorId', value: 'someone-else' }]
    await vm.request({ pageIndex: 1, pageSize: 12, terms })
    const call = calls.at(-1)
    assert.equal(call[3], '?mine=true')
    assert.deepEqual(call[2].terms, [
      { column: 'source', value: 'manual' }, ...(status === 'all' ? [] : [{ column: 'status', value: status }]), { type: 'and', terms }
    ])
  }
})

test('重新编辑准确加载原设备映射，回填原始读数，重提携带原版本且失败不关闭', async () => {
  const { transport, api, calls } = setup()
  const original = reading({ projectId: 'p1', propertyId: 'total', rawValue: '6.25', value: 12.5,
    observedTime: 1000, reason: '旧原因', status: 'rejected' })
  transport.query = async (...args) => { calls.push(['query', ...args]); return { data: [{ ...meter('exact'), deviceId: 'd1' }], total: 1 } }
  let saved = 0
  const vm = api.useManualReading(() => 'wrong-project', () => saved++, original)
  await vm.initialize()
  assert.equal(vm.form.projectId, 'p1'); assert.equal(vm.form.mappingId, 'exact')
  assert.equal(vm.form.value, '6.25'); assert.equal(vm.form.reason, '旧原因'); assert.equal(vm.form.observedTime, 1000)
  assert.ok(calls[0][2].terms.some(term => term.column === 'deviceId' && term.value === 'd1'))
  vm.changeProject('p2'); vm.changeMeter('other')
  assert.equal(vm.form.projectId, 'p1'); assert.equal(vm.form.mappingId, 'exact')
  transport.resubmitReading = async (...args) => { calls.push(['resubmit', ...args]); throw Error('原记录已经重新提交') }
  vm.form.value = '7.50'; vm.form.reason = '重新核对读数'
  await vm.submit()
  assert.equal(saved, 0); assert.equal(vm.error.value, '原记录已经重新提交'); assert.equal(vm.form.value, '7.50')
  assert.equal(calls.at(-1)[1].version, 7); assert.equal(calls.at(-1)[2].value, '7.50')
  transport.resubmitReading = async (...args) => calls.push(['resubmit', ...args])
  await vm.submit(); assert.equal(saved, 1)
  assert.equal(original.status, 'rejected'); assert.equal(original.value, 12.5)
  const http = { post: async (...args) => args }
  assert.deepEqual(await api.facilityClient(http).resubmitReading(original, { value: '7.50' }),
    ['/property/facility-energy/energy/readings/r%2F1/resubmit?version=7', { value: '7.50' }])
})

test('重提时原计量配置缺失或指标移除不允许提交', async () => {
  const { transport, api } = setup()
  for (const data of [[], [{ ...meter(), metrics: [{ propertyId: 'changed', kind: 'counter' }] }]]) {
    transport.query = async () => ({ data, total: data.length })
    const vm = api.useManualReading(() => 'p1', () => assert.fail('不应提交'), reading({ projectId: 'p1', propertyId: 'total', status: 'rejected', rawValue: 6, reason: '原原因', observedTime: 1000 }))
    await vm.initialize(); assert.ok(vm.error.value)
    await vm.submit(); assert.ok(vm.error.value)
  }
})
