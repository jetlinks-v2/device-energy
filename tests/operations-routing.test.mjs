import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const vue = require('vue'), { transformSync } = require('esbuild')
const settle = async () => { for (let i = 0; i < 15; i++) { await vue.nextTick(); await Promise.resolve() } }
const fault = (id, projectId) => ({ id, projectId, name: id, state: 'open', version: 0, attachments: [] })
function setup(id, records = {}) {
  const route = vue.reactive({ query: { id, projectId: 'stale-route-project' } })
  const directories = [], queries = [], reads = [], employees = [], mounted = []
  const facility = {
    context: async () => ({ userId: 'admin' }),
    fault: async id => { reads.push(id); if (!records[id]) throw Error('not found'); return records[id] },
    faultHistory: async () => ({ data: [], total: 0 }),
    read: async (_, id) => { reads.push(id); if (!records[id]) throw Error('not found'); return records[id] },
    get: async path => path === 'alerts/levels' ? [{ level: 3, title: '严重' }] : ({ data: [], total: 0 }),
    query: async (path, query) => {
      const filter = query.terms.find(term => term.column === 'projectId')
      const project = filter?.value
      if (!project || Array.isArray(project)) { queries.push({ path, project, terms: query.terms }); return { data: [], total: 0 } }
      queries.push({ path, project, terms: query.terms })
      return { data: [fault(project + '-first', project)], total: 1 }
    },
    options: async path => { employees.push(path); return [{ id: 'staff', name: 'Staff' }] },
    devices: async () => ({ data: [] })
  }
  for (const project of ['a', 'b', 'c']) records[project + '-first'] = fault(project + '-first', project)
  const cache = new Map()
  function load(path, script = false) {
    path = resolve(root, path)
    if (cache.has(path)) return cache.get(path)
    let source = readFileSync(path, 'utf8')
    if (script) source = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1] + '\nexport { registerFault, faults, vm }'
    const module = { exports: {} }
    const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code
    new Function('require', 'module', 'exports', code)(specifier => {
      if (specifier === 'vue') return { ...vue, onMounted: callback => mounted.push(callback), onBeforeUnmount: () => {} }
      if (specifier === 'vue-router') return { useRoute: () => route }
      if (specifier === 'ant-design-vue') return { message: { success: () => {} } }
      if (specifier === '@jetlinks-web-core/store') return { useAuthStore: () => ({ hasPermission: () => true }) }
      if (specifier.endsWith('/api')) return { facility }
      if (specifier.endsWith('/i18n')) return { feText: key => key }
      if (specifier.endsWith('/types')) return { messageOf: error => error.message, taskTime: () => '' }
      if (specifier.endsWith('/useBillingProject')) return { useBillingProject: () => {
        const projectIds = vue.ref([])
        const project = { projectIds, projectTerms: () => projectIds.value.length ? [{ column: 'projectId', termType: projectIds.value.length === 1 ? 'eq' : 'in', value: projectIds.value.length === 1 ? projectIds.value[0] : projectIds.value }] : [], projectId: vue.computed({ get: () => projectIds.value.length === 1 ? projectIds.value[0] : undefined, set: value => { projectIds.value = value ? [value] : [] } }), projects: vue.ref([]), loading: vue.ref(true), error: vue.ref('') }
        directories.push(project); return project
      } }
      if (specifier.endsWith('.vue') || specifier.endsWith('.css') || specifier.startsWith('@')) return {}
      return load(resolve(dirname(path), specifier + '.ts'))
    }, module, module.exports)
    cache.set(path, module.exports)
    return module.exports
  }
  const scope = vue.effectScope()
  const start = name => scope.run(() => load('hooks/' + name + '.ts')[name]())
  const ready = async () => {
    for (const project of directories) {
      project.projects.value = ['a', 'b', 'c'].map(value => ({ value, label: value }))
      project.projectId.value = 'a'; project.loading.value = false
    }
    await settle()
  }
  return { route, facility, directories, queries, reads, employees, scope, start, ready, records,
    mount: async () => { for (const callback of mounted) await callback(); await settle() },
    alertsPage: () => scope.run(() => load('views/facility/Alerts/index.vue', true)) }
}

test('预警列表读取平台等级配置，失败时清除旧配置并显示错误', async () => {
  const ctx = setup(), vm = ctx.start('useAlertCenter'); await ctx.ready()
  assert.deepEqual(vm.levels.value, [{ level: 3, title: '严重' }])
  const get = ctx.facility.get
  ctx.facility.get = async path => { if (path === 'alerts/levels') throw Error('等级不可用'); return get(path) }
  await vm.load()
  assert.equal(vm.error.value, '等级不可用'); assert.deepEqual(vm.levels.value, []); assert.deepEqual(vm.rows.value, [])
  ctx.scope.stop()
})

test('故障深链根据授权详情所属项目打开，后续项目筛选不重选旧 ID', async () => {
  const ctx = setup('target', { target: fault('target', 'b') }), vm = ctx.start('useFaults')
  await ctx.ready()
  assert.equal(vm.projectId.value, 'b'); assert.equal(vm.selected.value.id, 'target')
  assert.ok(ctx.queries.every(query => query.project === 'b'))
  assert.equal(vm.rows.value[0].projectId, 'b')
  await vm.open('reviewer'); assert.equal(ctx.employees.at(-1), 'employees/b')
  vm.projectId.value = 'c'; await settle()
  assert.equal(vm.selected.value.id, 'c-first'); assert.equal(vm.action.value, '')
  assert.equal(ctx.queries.at(-1).project, 'c')
  ctx.scope.stop()
})

test('同组件切换深链 ID 重新定位，旧详情请求晚返回不能覆盖新导航', async () => {
  const ctx = setup('old', { next: fault('next', 'c') })
  let resolveOld
  const read = ctx.facility.fault
  ctx.facility.fault = id => id === 'old' ? new Promise(resolve => { resolveOld = resolve }) : read(id)
  const vm = ctx.start('useFaults'); await ctx.ready()
  ctx.route.query.id = 'next'; await settle()
  assert.equal(vm.projectId.value, 'c'); assert.equal(vm.selected.value.id, 'next')
  resolveOld(fault('old', 'b')); await settle()
  assert.equal(vm.projectId.value, 'c'); assert.equal(vm.selected.value.id, 'next')
  vm.status.value = 'review'; await settle()
  assert.equal(vm.selected.value.id, 'c-first')
  ctx.scope.stop()
})

test('无权或已删除深链不留下可操作的伪详情', async () => {
  const ctx = setup('missing'), vm = ctx.start('useFaults'); await ctx.ready()
  assert.equal(vm.selected.value, undefined); assert.deepEqual(vm.actions.value, [])
  assert.equal(vm.error.value, 'not found')
  ctx.scope.stop()
})

test('手动切换项目使尚未完成的深链失效，不被迟到详情切回旧项目', async () => {
  const ctx = setup('pending')
  let resolvePending
  const read = ctx.facility.fault
  ctx.facility.fault = id => id === 'pending' ? new Promise(resolve => { resolvePending = resolve }) : read(id)
  const vm = ctx.start('useFaults'); await ctx.ready()
  vm.projectId.value = 'c'; await settle()
  resolvePending(fault('pending', 'b')); await settle()
  assert.equal(vm.projectId.value, 'c'); assert.equal(vm.selected.value.id, 'c-first')
  ctx.scope.stop()
})

test('预警深链定位对应项目和计划范围，后续筛选不受旧 ID 影响', async () => {
  const ctx = setup('plan-event', { 'plan-event': { ...fault('plan-event', 'b'), targetId: 'target' } })
  const vm = ctx.start('useAlertCenter'); await ctx.ready()
  assert.equal(vm.projectId.value, 'b'); assert.equal(vm.scope.value, 'plan')
  assert.equal(vm.selected.value.id, 'plan-event'); assert.equal(ctx.queries.at(-1).path, 'alerts/plans')
  vm.projectId.value = 'c'; await settle()
  assert.equal(vm.selected.value.id, 'c-first')
  ctx.scope.stop()
})

test('预警跨项目转故障等待项目清理完成，登记弹窗及来源不丢失', async () => {
  const ctx = setup(undefined), page = ctx.alertsPage(); await ctx.ready()
  page.vm.projectId = 'b'; await settle()
  page.vm.selected = { ...fault('alert-b', 'b'), deviceId: 'device-b', firstTime: 1 }
  await page.registerFault(); await settle()
  assert.equal(page.faults.projectId, 'b'); assert.equal(page.faults.action, 'create')
  assert.equal(page.faults.form.sourceId, 'alert-b'); assert.equal(page.faults.form.deviceId, 'device-b')
  assert.equal(ctx.employees.at(-1), 'employees/b')
  ctx.scope.stop()
})

test('预警页内登记故障 hook 不把预警深链误当作故障 ID 读取', async () => {
  const ctx = setup('alert-b', { 'alert-b': { ...fault('alert-b', 'b'), deviceId: 'device-b' } })
  let faultReads = 0
  const read = ctx.facility.fault; ctx.facility.fault = id => { if (id === 'alert-b') faultReads++; return read(id) }
  const page = ctx.alertsPage(); await ctx.ready()
  assert.equal(page.vm.selected.id, 'alert-b'); assert.equal(faultReads, 0)
  ctx.scope.stop()
})

test('预警处理记录可以翻到第二页，保留事件历史页码和记录总数', async () => {
  const ctx = setup(undefined), calls = []
  ctx.facility.get = async path => {
    calls.push(path)
    if (path.includes('/processes')) return { data: [{ id: path.endsWith('=1') ? 'log-21' : 'log-1' }], total: 25 }
    return { data: [], total: 32 }
  }
  const vm = ctx.start('useAlertCenter'); await ctx.ready()
  await vm.select(ctx.records['a-first'], 2, 2)
  assert.ok(calls.includes('alerts/a-first/processes?pageIndex=1'))
  assert.ok(calls.includes('alerts/a-first/history?pageIndex=1'))
  assert.equal(vm.processes.value[0].id, 'log-21')
  assert.equal(vm.processTotal.value, 25); assert.equal(vm.processPage.value, 2)
  assert.equal(vm.historyTotal.value, 32); assert.equal(vm.historyPage.value, 2)
  ctx.scope.stop()
})

for (const hook of ['useFaults', 'useAlertCenter']) test(hook + ' 全部及多项目查询不退回首项目，详情写入使用记录项目', async () => {
  const ctx = setup(undefined), vm = ctx.start(hook); await ctx.ready()
  vm.projectIds.value = []; await settle()
  assert.equal(ctx.queries.at(-1).project, undefined)
  vm.projectIds.value = ['b', 'c']; await settle()
  assert.deepEqual(ctx.queries.at(-1).project, ['b', 'c'])
  if (hook === 'useFaults') {
    await vm.select(ctx.records['b-first']); await vm.open('reviewer')
    assert.equal(ctx.employees.at(-1), 'employees/b')
  }
  ctx.scope.stop()
})
test('待处理预警入口承接统计口径，包含旧数据未设置处理状态的事件', async () => {
  const ctx = setup(undefined); ctx.route.query.overview = 'pending'
  const vm = ctx.start('useAlertCenter'); await ctx.ready()
  assert.equal(vm.handling.value, 'open')
  assert.deepEqual(ctx.queries.at(-1).terms.at(-1).terms.map(term => term.termType || term.value), ['open', 'isnull'])
  ctx.scope.stop()
})

for (const member of [false, true]) test(`登记故障仅在当前账号属于候选员工时默认选为验收人：${member}`, async () => {
  const ctx = setup(undefined), vm = ctx.start('useFaults')
  await ctx.ready(); await ctx.mount()
  ctx.facility.options = async () => [{ id: member ? 'admin' : 'staff', name: '项目员工' }]
  await vm.open('create')
  assert.equal(vm.form.reviewerId, member ? 'admin' : '')
  assert.deepEqual(vm.people.value, [{ value: member ? 'admin' : 'staff', label: '项目员工' }])
  ctx.scope.stop()
})

test('人员查询失败不会留下默认用户 ID，也不阻止登记设备加载', async () => {
  const ctx = setup(undefined), vm = ctx.start('useFaults')
  await ctx.ready(); await ctx.mount()
  ctx.facility.options = async () => { throw Error('人员查询无权限') }
  ctx.facility.devices = async () => ({ data: [{ id: 'device', name: '智能水表' }] })
  await vm.open('create')
  assert.equal(vm.form.reviewerId, '')
  assert.deepEqual(vm.people.value, [])
  assert.deepEqual(vm.devices.value, [{ value: 'device', label: '智能水表' }])
  assert.equal(vm.actionError.value, '人员查询无权限')
  assert.equal(vm.actionBusy.value, false)
  ctx.scope.stop()
})
