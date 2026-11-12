import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  stdin: { contents: "export { useTaskReview } from './hooks/useTaskReview'; export { facilityClient } from './shared/client'", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'review-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'port' }))
    builder.onLoad({ filter: /.*/, namespace: 'port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}})',
      '../api': 'export const facility=transport'
    }[args.path] }))
  } }]
})
function setup(kind = 'inspection', projectId) {
  const calls = [], transport = {
    taskReviews: async (...args) => { calls.push(['query', ...args]); return { data: [], total: 0 } },
    action: async (...args) => { calls.push(args) }
  }, module = { exports: {} }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  let changes = 0, reloads = 0
  const vm = module.exports.useTaskReview(kind, () => changes++, projectId)
  vm.table.value = { reload: () => reloads++ }
  return { vm, transport, calls, api: module.exports, counts: () => ({ changes, reloads }) }
}
const task = (id, version = 3) => ({ id, version, name: id, state: 'review', kind: 'inspection' })

test('工作台打开审批沿用当前项目和作业类型，普通入口保留原默认范围', async () => {
  const { vm, calls } = setup('maintenance', 'project/a')
  assert.deepEqual(vm.params.value.terms, [{ column: 'projectId', termType: 'eq', value: 'project/a' }])
  await vm.request({ terms: vm.params.value.terms, pageSize: 12 })
  assert.deepEqual(calls[0][1].terms, [
    { column: 'kind', value: 'maintenance' },
    { type: 'and', terms: [{ column: 'projectId', termType: 'eq', value: 'project/a' }] }
  ])
  assert.deepEqual(setup().vm.params.value.terms, [])
})

test('审批列表使用专用接口，查询类型取交集，翻页与搜索清空选择', async () => {
  const { vm, calls } = setup()
  vm.selected.value = [task('a')]
  const terms = [{ column: 'name', value: '水泵' }, { column: 'kind', type: 'or', value: 'maintenance' }]
  const response = await vm.request({ pageIndex: 2, pageSize: 12, terms })
  assert.equal(response.success, true)
  assert.deepEqual(vm.selected.value, [])
  assert.deepEqual(calls[0], ['query', { pageIndex: 2, pageSize: 12, terms: [
    { column: 'kind', value: 'inspection' }, { type: 'and', terms }
  ] }, 'pending'])
  vm.selected.value = [task('a')]; vm.filter(terms)
  assert.deepEqual(vm.params.value, { terms })
  assert.deepEqual(vm.selected.value, [])
})

test('四个审批页签切换清空选中与反馈，非待审批页签不能发起审批', async () => {
  const { vm, calls, api } = setup('maintenance')
  for (const status of ['approved', 'rejected', 'all', 'pending']) {
    vm.selected.value = [task('old')]; vm.outcomes.value = [{ success: true }]
    vm.changeStatus(status)
    assert.deepEqual(vm.selected.value, [])
    assert.deepEqual(vm.outcomes.value, [])
    await vm.request({ pageIndex: 0 })
    assert.equal(calls.at(-1)[2], status)
    vm.start('approve', [task('a')])
    assert.equal(vm.decision.value, status === 'pending' ? 'approve' : undefined)
  }
  const http = { post: async (...args) => args }
  assert.deepEqual(await api.facilityClient(http).taskReviews({}, 'rejected'),
    ['/property/facility-energy/tasks/review/_query?status=rejected', {}])
})

test('批量审批按版本逐条执行，部分失败逐项可见并继续，选中数据使用快照', async () => {
  const { vm, calls, transport, counts } = setup()
  const rows = [task('a', 1), task('b', 7), task('c', 9)]
  vm.selected.value = rows
  vm.start('approve')
  rows[0].version = 999
  vm.comment.value = ' 已核对 '
  transport.action = async (...args) => { calls.push(args); if (args[0] === 'b') throw Error('版本冲突') }
  await vm.confirm()
  assert.deepEqual(calls, [
    ['a', 'approve', { version: 1, comment: '已核对' }],
    ['b', 'approve', { version: 7, comment: '已核对' }],
    ['c', 'approve', { version: 9, comment: '已核对' }]
  ])
  assert.deepEqual(vm.outcomes.value.map(row => [row.id, row.success, row.error]),
    [['a', true, undefined], ['b', false, '版本冲突'], ['c', true, undefined]])
  assert.deepEqual(counts(), { changes: 1, reloads: 1 })
  assert.equal(vm.progress.value, 3)
  assert.equal(vm.busy.value, false)
  assert.equal(vm.decision.value, undefined)
})

test('驳回必须有原因，全部失败不通知主表成功，失败明细保留', async () => {
  const { vm, transport, calls, counts } = setup()
  vm.start('reject', [task('a')])
  vm.comment.value = '  '
  await vm.confirm()
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('整改原因'))
  transport.action = async (...args) => { calls.push(args); throw Error('无审批权限') }
  vm.comment.value = '补充现场照片'
  await vm.confirm()
  assert.deepEqual(calls, [['a', 'reject', { version: 3, comment: '补充现场照片' }]])
  assert.equal(vm.outcomes.value[0].error, '无审批权限')
  assert.deepEqual(counts(), { changes: 0, reloads: 1 })
})

test('批量串行有界，防重复提交和处理中切换，选择上限100条', async () => {
  const { vm, transport, calls } = setup()
  vm.start('approve', Array.from({ length: 101 }, (_, i) => task(String(i))))
  assert.equal(vm.decision.value, undefined)
  vm.start('approve', [task('a'), task('b')])
  let release
  transport.action = async (...args) => { calls.push(args); if (args[0] === 'a') await new Promise(done => { release = done }) }
  const running = vm.confirm()
  await vm.confirm()
  vm.changeStatus('all'); vm.filter([{ column: 'name', value: 'new' }])
  assert.equal(vm.status.value, 'pending')
  assert.deepEqual(vm.params.value.terms, [])
  assert.equal(calls.length, 1)
  release(); await running
  assert.equal(calls.length, 2)
})

test('审批队列加载失败显示真实错误，不回退全量任务', async () => {
  const { vm, transport, counts } = setup()
  transport.taskReviews = async () => { throw Error('审批范围无权限') }
  await assert.rejects(vm.request({}), /审批范围无权限/)
  assert.equal(vm.error.value, '审批范围无权限')
  assert.deepEqual(counts(), { changes: 0, reloads: 0 })
})
