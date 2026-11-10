import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  stdin: { contents: "export { useTaskDispatch } from './hooks/useTaskDispatch'; export { useTask } from './hooks/useTask'; export { taskActions } from './shared/taskActions'; export { taskTime } from './shared/types'; export { facilityClient } from './shared/client'", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'task-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'port' }))
    builder.onLoad({ filter: /.*/, namespace: 'port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const onMounted=()=>{}',
      '../api': 'export const facility=transport'
    }[args.path] }))
  } }]
})
function setup() {
  const calls = [], row = { id: 'task/a', name: '水泵巡检', version: 4, state: 'open', mode: 'single', projectId: 'p', results: [], standardSnapshot: [] }
  const transport = {
    task: async () => ({ ...row }), context: async () => ({ userId: 'worker' }),
    canClaimTask: async () => false,
    taskHistory: async (id, page) => ({ data: [{ id: 'log', action: 'claim' }], total: 21, pageIndex: page }),
    taskAssignees: async id => { calls.push(['candidates', id]); return [{ id: 'allowed', name: '项目人员' }] },
    action: async (...args) => calls.push(args)
  }
  const module = { exports: {} }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  return { calls, row, transport, api: module.exports, vm: module.exports.useTaskDispatch(row.id) }
}
test('派单只读取任务范围的候选人，使用最新任务版本，拒绝伪造人员', async () => {
  const { vm, calls } = setup()
  await vm.load()
  assert.deepEqual(vm.options.value, [{ value: 'allowed', label: '项目人员' }])
  vm.userId.value = 'outside'
  assert.equal(await vm.save(), false)
  assert.equal(calls.length, 1)
  vm.userId.value = 'allowed'
  assert.equal(await vm.save(), true)
  assert.deepEqual(calls.at(-1), ['task/a', 'transfer', { version: 4, userId: 'allowed' }])
})
test('派单候选查询失败清空旧选项，终态和重复提交不能派单', async () => {
  const { vm, row, transport, calls } = setup()
  await vm.load()
  vm.userId.value = 'allowed'
  transport.taskAssignees = async () => { throw Error('无权查询人员') }
  await vm.load()
  assert.deepEqual(vm.options.value, [])
  assert.equal(vm.userId.value, undefined)
  assert.equal(vm.error.value, '无权查询人员')
  assert.equal(await vm.save(), false)
  row.state = 'completed'
  await vm.load()
  assert.equal(await vm.save(), false)
  assert.equal(calls.length, 1)
})

test('转单排除当前接单人，必须明确选择新项目员工，关闭任务不能转单', async () => {
  const { vm, row, transport, calls } = setup()
  row.state = 'rectify'; row.assigneeId = 'allowed'
  transport.taskAssignees = async () => [{ id: 'allowed', name: '原接单人' }, { id: 'next', name: '新接单人' }]
  await vm.load()
  assert.deepEqual(vm.options.value, [{ value: 'next', label: '新接单人' }])
  assert.equal(vm.userId.value, undefined)
  vm.userId.value = 'allowed'
  assert.equal(await vm.save(), false)
  vm.userId.value = 'next'
  assert.equal(await vm.save(), true)
  assert.deepEqual(calls.at(-1), ['task/a', 'transfer', { version: 4, userId: 'next' }])
  row.state = 'closed'; await vm.load()
  assert.deepEqual(vm.options.value, [])
  assert.equal(await vm.save(), false)
})
test('派单被服务器拒绝时保留选择和明确错误，防止重复保存', async () => {
  const { vm, transport } = setup()
  await vm.load()
  vm.userId.value = 'allowed'
  transport.action = async () => { throw Error('版本冲突，请刷新') }
  assert.equal(await vm.save(), false)
  assert.equal(vm.userId.value, 'allowed')
  assert.equal(vm.error.value, '版本冲突，请刷新')
  vm.busy.value = true
  assert.equal(await vm.save(), false)
})
test('任务详情不查询全量人员，未获接单资格时不显示接单，审核说明按操作显示', async () => {
  const { api, row, transport, calls } = setup()
  const vm = api.useTask(row.id)
  await vm.refresh()
  assert.deepEqual(vm.actions.value, [])
  transport.canClaimTask = async () => true
  await vm.refresh()
  assert.deepEqual(vm.actions.value, ['claim'])
  assert.deepEqual(api.taskActions({ ...row }, 'worker'), [])
  row.state = 'review'; row.reviewerId = 'worker'
  await vm.refresh()
  vm.requestAction('reject')
  assert.equal(vm.pendingAction.value, 'reject')
  assert.equal(calls.length, 0)
  await vm.action('reject')
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('整改原因'))
  vm.comment.value = '检查不符合要求'
  await vm.action('reject')
  assert.deepEqual(calls[0], ['task/a', 'reject', { version: 4, comment: '检查不符合要求' }])
  assert.equal(vm.pendingAction.value, '')
})
test('处理记录有独立分页和错误提示，不截断为第一页', async () => {
  const { api, row, transport } = setup()
  const vm = api.useTask(row.id)
  await vm.loadHistory(2)
  assert.equal(vm.historyPage.value, 2)
  assert.equal(vm.historyTotal.value, 21)
  transport.taskHistory = async () => { throw Error('记录加载失败') }
  await vm.loadHistory(1)
  assert.equal(vm.historyError.value, '记录加载失败')
  assert.equal(vm.historyPage.value, 2)
})
test('共享客户端明确传递待接单池筛选和编码任务ID，时间显示到分钟', async () => {
  const { api } = setup(), requests = []
  const http = { get: async url => requests.push(url), post: async (url, body) => requests.push([url, body]) }
  const client = api.facilityClient(http)
  await client.tasks({}, false, true)
  await client.taskAssignees('task/a')
  await client.canClaimTask('task/a')
  await client.taskHistory('task/a', 2)
  assert.deepEqual(requests, [
    ['/property/facility-energy/tasks/_query?mine=false&pool=true', {}],
    '/property/facility-energy/tasks/task%2Fa/assignees', '/property/facility-energy/tasks/task%2Fa/claimable',
    '/property/facility-energy/tasks/task%2Fa/history?pageIndex=2'
  ])
  assert.equal(api.taskTime(Date.UTC(2026, 10, 10, 10, 20, 59)), '2026/11/10 18:20')
  assert.equal(api.taskTime(undefined), '—')
})

test('旧外协已提交任务同样进入负责人审核，不再给内部跟进人显示执行按钮', () => {
  const { api } = setup()
  assert.deepEqual(api.taskActions({ state: 'external-submitted', reviewerId: 'owner', followUserId: 'old' }, 'owner'), ['approve', 'reject'])
  assert.deepEqual(api.taskActions({ state: 'external-submitted', reviewerId: 'owner', followUserId: 'old' }, 'old'), [])
})
