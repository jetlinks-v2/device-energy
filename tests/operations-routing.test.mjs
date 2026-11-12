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
  const directories = [], queries = [], reads = [], employees = []
  const facility = {
    context: async () => ({ userId: 'admin' }),
    fault: async id => { reads.push(id); if (!records[id]) throw Error('not found'); return records[id] },
    faultHistory: async () => ({ data: [], total: 0 }),
    read: async (_, id) => { reads.push(id); if (!records[id]) throw Error('not found'); return records[id] },
    get: async () => ({ data: [], total: 0 }),
    query: async (path, query) => {
      const project = query.terms.find(term => term.column === 'projectId').value
      queries.push({ path, project })
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
      if (specifier === 'vue') return { ...vue, onMounted: () => {}, onBeforeUnmount: () => {} }
      if (specifier === 'vue-router') return { useRoute: () => route }
      if (specifier === '@jetlinks-web-core/store') return { useAuthStore: () => ({ hasPermission: () => true }) }
      if (specifier.endsWith('/api')) return { facility }
      if (specifier.endsWith('/i18n')) return { feText: key => key }
      if (specifier.endsWith('/types')) return { messageOf: error => error.message, taskTime: () => '' }
      if (specifier.endsWith('/useBillingProject')) return { useBillingProject: () => {
        const project = { projectId: vue.ref(), projects: vue.ref([]), loading: vue.ref(true), error: vue.ref('') }
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
    alertsPage: () => scope.run(() => load('views/facility/Alerts/index.vue', true)) }
}

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
