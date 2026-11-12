import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url), { build } = require('esbuild')
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
const vue = 'export const ref=value=>({value});export const computed=fn=>({get value(){return fn()}});export const watch=()=>{};export const onBeforeUnmount=()=>{}'
async function bundle(file) {
  const result = await build({ entryPoints: [fileURLToPath(new URL('../src/hooks/' + file, import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [{ name: 'test-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api\/facility|\.\.\/services\/session|\.\/useProjects|\.\/useConnection|\.\.\/services\/offline)$/ }, args => ({ path: args.path, namespace: 'port' }))
    builder.onLoad({ filter: /.*/, namespace: 'port' }, args => ({ contents: {
      vue,
      '../api/facility': 'export const facility = ports.api',
      '../services/session': 'export const state = ports.state;export const can = action=>ports.permissions.includes(action);export const canWorkspace=()=>ports.state.authorization?.permissions.some(p=>["facility-task","facility-fault","facility-message"].includes(p.id)&&p.actions.includes("query"))',
      './useProjects': 'export const projectsReady={value:true}',
      './useConnection': 'export const useConnection=()=>({value:true})',
      '../services/offline': 'export const cachedTasks=()=>Promise.resolve([]);export const entries=()=>Promise.resolve([])'
    }[args.path] }))
  } }] })
  return ports => { const module = { exports: {} };new Function('ports', 'module', 'exports', result.outputFiles[0].text)(ports, module, module.exports); return module.exports }
}
const lists = await bundle('useTaskList.ts'), operations = await bundle('useTaskOperations.ts'), projectHooks = await bundle('useProjects.ts'), workspaces = await bundle('useWorkspace.ts')
const state = { context: { userId: 'worker' } }
const page = (id, total = 1) => ({ data: [{ id }], total, pageIndex: 0, pageSize: 20 })

test('late responses cannot replace a newer project/status list, and pagination appends the next page', async () => {
  const calls = [], api = { tasks: query => new Promise(resolve => calls.push({ query, resolve })) }
  let projectId = 'first'
  const vm = lists({ api, state }).useTaskList(() => ({ projectId }), () => 'mine')
  const first = vm.load(); projectId = 'second'; const second = vm.load()
  calls[1].resolve(page('second', 2)); await second
  calls[0].resolve(page('first')); await first
  assert.equal(vm.rows.value[0].id, 'second')
  assert.equal(vm.busy.value, false)
  const more = vm.load(true)
  assert.equal(calls[2].query.pageIndex, 1)
  calls[2].resolve(page('third', 2)); await more
  assert.deepEqual(vm.rows.value.map(x => x.id), ['second', 'third'])
})

test('review lists always use the responsible-person API and never broaden a failed query', async () => {
  let queryCalls = 0, reviewCalls = 0
  const api = { tasks: () => { queryCalls++; return page('wrong') }, taskReviews: async (_, status) => { reviewCalls++; assert.equal(status, 'rejected'); throw Error('没有审批权限') } }
  const vm = lists({ api, state }).useTaskList(() => ({ projectId: 'first' }), () => 'review', () => 'rejected')
  await vm.load()
  assert.equal(reviewCalls, 1); assert.equal(queryCalls, 0)
  assert.equal(vm.error.value, '没有审批权限'); assert.deepEqual(vm.rows.value, [])
})

test('missing project never loads an unscoped list and invalidates any earlier response', async () => {
  let calls = 0, resolve, projectId = 'first'
  const api = { tasks: () => { calls++; return new Promise(done => { resolve = done }) } }
  const vm = lists({ api, state }).useTaskList(() => ({ projectId }), () => 'mine')
  const pending = vm.load(); projectId = undefined; await vm.load()
  resolve(page('stale')); await pending
  assert.equal(calls, 1); assert.deepEqual(vm.rows.value, []); assert.equal(vm.total.value, 0)
  assert.equal(vm.busy.value, false)
})

test('workspace does not request cross-project counts when there is no selected project', async () => {
  let calls = 0
  const vm = workspaces({ state, permissions: ['query', 'review'], api: { tasks: () => { calls++ }, taskReviews: () => { calls++ } } }).useWorkspace()
  await vm.refresh()
  assert.equal(calls, 0); assert.deepEqual(vm.counts.value, []); assert.deepEqual(vm.tasks.value, [])
})

test('project loading selects one valid project, remembers a choice and rejects clearing or unknown IDs', async () => {
  const saved = new Map()
  globalThis.sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  const account = { context: { tenantId: 'tenant', applicationId: 'app', userId: 'worker' }, authorization: { permissions: [{ id: 'facility-task', actions: ['query'] }] } }
  let available = [{ id: 'first', name: '项目一' }, { id: 'second', name: '项目二' }]
  const vm = projectHooks({ state: account, api: { options: async () => available } })
  await vm.loadProjects(); assert.equal(account.projectId, 'first')
  vm.selectProject('second'); vm.selectProject(''); vm.selectProject('unknown')
  assert.equal(account.projectId, 'second')
  await vm.loadProjects(); assert.equal(account.projectId, 'second')
  available = [available[0]]; await vm.loadProjects(); assert.equal(account.projectId, 'first')
  available = []; await vm.loadProjects(); assert.equal(account.projectId, undefined)
  assert.equal(vm.projectsReady.value, true)
})

test('project-loading failure clears the old project and exposes the error without an all-project fallback', async () => {
  const account = { ...state, projectId: 'old', authorization: { permissions: [{ id: 'facility-task', actions: ['query'] }] } }
  const vm = projectHooks({ state: account, api: { options: async () => { throw Error('项目加载失败') } } })
  await vm.loadProjects()
  assert.equal(account.projectId, undefined); assert.equal(vm.projectError.value, '项目加载失败')
  assert.deepEqual(vm.projects.value, [])
})

test('transfer excludes the current worker and submits the latest task version; rejection requires a reason', async () => {
  const calls = [], api = { taskAssignees: async () => [{ id: 'worker', name: '员工' }, { id: 'other', name: '同事' }], action: async (...args) => calls.push(args) }
  const task = { id: 'task', version: 2, state: 'review', reviewerId: 'worker', assigneeId: 'worker' }
  let reloads = 0
  const vm = operations({ api, state, permissions: ['dispatch', 'review', 'close'] }).useTaskOperations(() => task, async () => { reloads++ })
  await vm.open('reject'); await vm.confirm()
  assert.equal(calls.length, 0); assert.ok(vm.error.value)
  vm.comment.value = '请重新检查'; task.version = 3; await vm.confirm()
  assert.equal(calls[0][2].version, 3); assert.equal(calls[0][2].comment, '请重新检查')
  assert.equal(reloads, 1)
  task.state = 'executing'; await vm.open('transfer')
  assert.deepEqual(vm.people.value.map(x => x.id), ['other'])
  vm.userId.value = 'other'; await vm.confirm()
  assert.equal(calls[1][1], 'transfer'); assert.equal(calls[1][2].userId, 'other')
})

test('review and transfer controls require both permission and task state/identity', () => {
  const task = { id: 'task', version: 1, state: 'review', reviewerId: 'another' }
  let vm = operations({ api: {}, state, permissions: ['review'] }).useTaskOperations(() => task, async () => {})
  assert.equal(vm.reviewable.value, false)
  task.reviewerId = 'worker'; assert.equal(vm.reviewable.value, true)
  task.state = 'closed'; assert.equal(vm.reviewable.value, false); assert.equal(vm.transferable.value, false)
  vm = operations({ api: {}, state, permissions: [] }).useTaskOperations(() => ({ ...task, state: 'review' }), async () => {})
  assert.equal(vm.reviewable.value, false)
})

test('mobile transfer is available only to the current assignee after claiming, and close is never offered', async () => {
  let calls = 0
  const task = { id: 'task', version: 1, state: 'open', assigneeId: 'worker' }
  const vm = operations({ state, permissions: ['dispatch', 'close'], api: {
    taskAssignees: async () => { calls++; return [] }, action: async () => { calls++ }
  } }).useTaskOperations(() => task, async () => {})
  assert.equal(vm.transferable.value, false)
  await vm.open('transfer'); await vm.open('close')
  assert.equal(vm.action.value, ''); assert.equal(calls, 0)
  for (const status of ['claimed', 'executing', 'rectify']) {
    task.state = status; assert.equal(vm.transferable.value, true)
    task.assigneeId = 'other'; assert.equal(vm.transferable.value, false)
    task.assigneeId = 'worker'
  }
  task.state = 'review'; assert.equal(vm.transferable.value, false)
  const noPermission = operations({ state, permissions: [], api: {} }).useTaskOperations(() => ({ ...task, state: 'claimed' }), async () => {})
  assert.equal(noPermission.transferable.value, false)
})

test('mobile rechecks transfer ownership before submitting a previously opened action', async () => {
  let calls = 0
  const task = { id: 'task', version: 1, state: 'claimed', assigneeId: 'worker' }
  const vm = operations({ state, permissions: ['dispatch'], api: {
    taskAssignees: async () => [{ id: 'other', name: '同事' }], action: async () => { calls++ }
  } }).useTaskOperations(() => task, async () => {})
  await vm.open('transfer'); vm.userId.value = 'other'
  task.assigneeId = 'another'; await vm.confirm()
  assert.equal(calls, 0); assert.ok(vm.error.value)
})


test('history is shown only for the whole task; device details never request a second activity stream', async () => {
  let calls = 0
  const task = { id: 'device-task', parentTaskId: 'task', version: 1, state: 'claimed', assigneeId: 'worker' }
  const vm = operations({ state, permissions: ['query'], api: { taskHistory: async () => { calls++; return { data: [{ id: 'log' }], total: 1 } } } }).useTaskOperations(() => task, async () => {})
  await vm.loadHistory(); assert.equal(calls, 0)
  delete task.parentTaskId; task.id = 'task'
  await vm.loadHistory(); assert.equal(calls, 1); assert.equal(vm.history.value[0].id, 'log')
})


test('message-only and repair-only employees can select their authorized project', async () => {
 globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}}
 for(const id of ['facility-fault','facility-message']){
  const account={context:{userId:id},authorization:{permissions:[{id,actions:['query']}]}}
  const vm=projectHooks({state:account,api:{options:async()=>[{id:'project'}]}})
  await vm.loadProjects();assert.equal(account.projectId,'project')
 }
})
