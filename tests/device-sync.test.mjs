import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const vue = require('vue'), { transformSync } = require('esbuild')
function load(name, ports) {
  const module = { exports: {} }
  const code = transformSync(readFileSync(new URL('../hooks/' + name + '.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, onMounted: fn => ports.mounted?.push(fn) }
    if (id === '../api') return { facility: ports.facility }
    if (id === '../api/meterBilling') return { meterApi: ports.api }
    if (id === '../shared/i18n') return { feText: key => key }
    if (id === '../shared/types') return { clone: value => structuredClone(value), display: value => value, messageOf: cause => cause.message }
    if (id === 'ant-design-vue') return { message: { success: value => ports.notices?.push(value), info: value => ports.notices?.push(value), warning() {} }, Modal: { confirm: options => ports.dialogs.push(options) } }
    if (id === './useResourceQuery') return { useResourceQuery: () => ports.query }
    if (id === './usePlanReferences') return { usePlanReferences: () => ({}) }
    if (id === '../shared/cycle/editor') return { defaultRule: () => ({}) }
    if (id === '../shared/energyValidation') return { validateEnergyForm: () => undefined }
    if (id === './useCheckItems') return { normalizeCheckItems: rows => rows, validateCheckItems: () => undefined }
    throw Error(id)
  }, module, module.exports)
  return module.exports
}
test('刷新来源列表无需选项目，重复点击不会重复请求且保留当前筛选', async () => {
  let finish, calls = 0, reloads = 0
  const notices = []
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { notices, api: {
    refreshDevices: () => { calls++; return new Promise(resolve => { finish = resolve }) },
    deviceSlice: async () => { reloads++; return { data: [] } }
  } })
  const scope = vue.effectScope(), vm = scope.run(useDeviceConfiguration)
  vm.projectId.value = 'filter-project'; await vue.nextTick()
  reloads = 0
  const running = vm.sync(); await vm.sync(); assert.equal(calls, 1)
  finish(8); await running
  assert.equal(vm.projectId.value, 'filter-project'); assert.equal(reloads, 1); assert.equal(vm.syncing.value, false)
  assert.match(notices[0], /8/)
  scope.stop()
})
test('已有资产改项目先确认，确认后只保存分配配置不直接同步资产', async () => {
  const dialogs = [], saved = []
  const { useDeviceConfiguration } = load('useDeviceConfiguration', { dialogs, api: { allocate: async rows => saved.push(rows) } })
  const vm = useDeviceConfiguration(); vm.edit([{ id: 'water', version: 4, projectId: 'old', assetProjectId: 'old' }])
  vm.targetProject.value = 'new'; await vm.save(); assert.equal(saved.length, 0); assert.equal(dialogs.length, 1)
  await dialogs[0].onOk(); assert.deepEqual(saved[0], [{ id: 'water', version: 4, projectId: 'new' }])
})
test('资产同步不传筛选项目，显示部分失败且不改当前选择', async () => {
  let calls = 0, reloads = 0
  const query = { projectId: vue.ref('project-a'), error: vue.ref(''), refresh: async () => reloads++ }
  const { useResource } = load('useResource', { query, facility: { syncConfigured: async (...args) => {
    calls++; assert.equal(args.length, 0)
    return { inserted: 2, updated: 3, failed: 1, projects: 2, failures: ['project-b: source unavailable'] }
  } } })
  const vm = useResource(() => ({ path: 'devices', fields: [] }), undefined, true)
  await vm.sync(); assert.equal(calls, 1); assert.equal(reloads, 1); assert.equal(query.projectId.value, 'project-a')
  assert.match(query.error.value, /project-b/); assert.equal(vm.syncing.value, false)
})
test('资产默认全部授权项目；路由已经选择的有效项目保持不变', async () => {
  for (const initial of [undefined, 'project-b', 'missing']) {
    const mounted = [], query = { projectId: vue.ref(initial), error: vue.ref('') }
    const { useResource } = load('useResource', { mounted, query, facility: { options: async () => [{ id: 'project-a' }, { id: 'project-b' }] } })
    const vm = useResource(() => ({ path: 'devices', fields: [] }), undefined, true)
    mounted[0](); await new Promise(resolve => setImmediate(resolve))
    assert.equal(vm.projectId.value, initial === 'project-b' ? initial : undefined)
  }
})
