import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  stdin: { contents: "export { useResource } from './hooks/useResource'; export { resources } from './shared/resources'", resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'organization-options-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|ant-design-vue|\.\.\/api|\.\/useResourceQuery)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const computed=read=>({get value(){return read()}}); export const ref=value=>({value}); export const reactive=value=>value; export const watch=()=>{}; export const onMounted=callback=>mounted.push(callback)',
      'ant-design-vue': 'export const message={success:()=>{}}',
      '../api': 'export const facility=transport',
      './useResourceQuery': 'export const useResourceQuery=()=>({error:{value:""},projectId:{value:""},refresh:async()=>{}})'
    }[args.path] }))
  } }]
})
function setup(resourceName = 'plans', kind) {
  const mounted = [], calls = [], module = { exports: {} }
  const transport = { save: async (path, payload) => calls.push({ path, payload }) }
  new Function('transport', 'mounted', 'module', 'exports', bundled.outputFiles[0].text)(transport, mounted, module, module.exports)
  const resource = module.exports.resources[resourceName]
  const vm = module.exports.useResource(() => resource, kind)
  vm.edit()
  Object.assign(vm.form, { name: '巡检计划', projectId: 'project', standardId: 'standard', cycleId: 'cycle', groupIds: ['group'], reviewerId: 'owner' })
  return { vm, calls, transport }
}

test('配置可直接启停，保留版本与完整规则，不改动原列表记录', async () => {
  for (const resource of ['standards', 'cycles', 'plans', 'energy/mappings', 'rules']) {
    const { vm, calls } = setup(resource, 'inspection')
    const row = { id: 'config', version: 7, enabled: true, kind: 'inspection',
      checkItems: [{ id: 'check', name: '检查要求' }], rule: { mode: 'daily' }, groupIds: ['group'] }
    await vm.command(row, 'disable')
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { path: resource, payload: { ...row, enabled: false } })
    assert.equal(row.enabled, true)
    await vm.command({ ...row, enabled: false }, 'enable')
    assert.equal(calls[1].payload.enabled, true)
    assert.equal(calls[1].payload.version, 7)
  }
})

test('启停失败保留原状态并展示错误，提交中不能重复操作', async () => {
  const { vm, calls, transport } = setup('plans', 'inspection')
  const row = { id: 'config', version: 7, enabled: true }
  transport.save = async () => { throw new Error('配置已被修改，请刷新') }
  await vm.command(row, 'disable')
  assert.equal(row.enabled, true)
  assert.equal(vm.error.value, '配置已被修改，请刷新')
  assert.equal(vm.saving.value, false)
  vm.saving.value = true
  await vm.command(row, 'disable')
  assert.equal(calls.length, 0)
})

test('计划只选机房设备组，负责人、作业类型和工单模式必填，单工单不显示外协', () => {
  const { vm } = setup()
  const fields = vm.formFields.value
  for (const key of ['deviceIds', 'assigneeId', 'followUserId', 'externalOrganizationId'])
    assert.equal(fields.some(field => field.key === key), false)
  for (const key of ['reviewerId', 'kind', 'mode', 'cycleId', 'groupIds', 'startTime', 'endTime']) assert.equal(fields.find(field => field.key === key).required, true)
  assert.equal(fields.find(field => field.key === 'reviewerId').label, '负责人')
})

test('双工单外协必填，填好后可保存；切回单工单清除外协', async () => {
  const { vm, calls } = setup()
  vm.change('mode', 'double')
  assert.equal(vm.formFields.value.find(field => field.key === 'externalOrganizationId').required, true)
  await vm.save()
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('外协'))
  vm.change('externalOrganizationId', 'vendor')
  await vm.save()
  assert.equal(calls[0].payload.externalOrganizationId, 'vendor')
  vm.change('mode', 'single')
  assert.equal(vm.form.externalOrganizationId, undefined)
  await vm.save()
  assert.equal(calls[1].payload.externalOrganizationId, undefined)
})

test('缺作业类型或工单模式阻止请求，旧执行人及跟进人不再提交，保留旧设备范围', async () => {
  for (const key of ['kind', 'mode', 'reviewerId']) {
    const { vm, calls } = setup()
    vm.form[key] = undefined
    await vm.save()
    assert.equal(calls.length, 0)
    assert.notEqual(vm.error.value, '')
  }
  const { vm, calls } = setup()
  Object.assign(vm.form, { assigneeId: 'old', followUserId: 'old', deviceIds: ['legacy-device'], externalOrganizationId: 'old-vendor' })
  await vm.save()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.assigneeId, undefined)
  assert.equal(calls[0].payload.followUserId, undefined)
  assert.equal(calls[0].payload.externalOrganizationId, undefined)
  assert.deepEqual(calls[0].payload.deviceIds, ['legacy-device'])
})


test('作业标准按入口固定巡检或维保，标记必填且禁用类型选择，移除指导书和附件', async () => {
  for (const kind of ['inspection', 'maintenance']) {
    const { vm, calls } = setup('standards', kind)
    assert.equal(vm.form.kind, kind)
    assert.equal(vm.formFields.value.find(field => field.key === 'kind').required, true)
    assert.equal(vm.formFields.value.find(field => field.key === 'kind').disabled, true)
    assert.equal(vm.formFields.value.some(field => ['instruction', 'attachments'].includes(field.key)), false)
    vm.change('kind', kind === 'inspection' ? 'maintenance' : 'inspection')
    assert.equal(vm.form.kind, kind)
    vm.form.checkItems = [{ id: 'check', name: '外观是否完整', kind: 'boolean', required: true, photoRequired: false }]
    vm.form.kind = 'tampered'
    await vm.save()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].payload.kind, kind)
  }
})

test('任务配置切换作业类型或项目清空原标准、周期、负责人和设备组', () => {
  for (const [key, value] of [['kind', 'maintenance'], ['projectId', 'another-project']]) {
    const { vm } = setup()
    vm.change(key, value)
    for (const field of ['standardId', 'cycleId', 'reviewerId']) assert.equal(vm.form[field], undefined)
    assert.deepEqual(vm.form.groupIds, [])
  }
})

test('任务配置随巡检维保入口固定类型，保存不能提交另一类型', async () => {
  for (const kind of ['inspection', 'maintenance']) {
    const { vm, calls } = setup('plans', kind)
    assert.equal(vm.form.kind, kind)
    assert.equal(vm.formFields.value.find(field => field.key === 'kind').disabled, true)
    vm.change('kind', 'other')
    assert.equal(vm.form.kind, kind)
    vm.form.kind = 'other'
    await vm.save()
    assert.equal(calls[0].payload.kind, kind)
  }
})

test('生成返回数量用于同页查看任务，失败不返回成功数量并保留具体错误', async () => {
  const { vm, transport } = setup('plans', 'inspection')
  const now = Date.now()
  const row = { id: 'plan', cycleId: 'cycle', enabled: true, startTime: now - 60000, endTime: now + 60000, nextRunTime: now - 1000 }
  transport.post = async () => [{ id: 'task' }]
  assert.equal(await vm.command(row, 'generate'), 1)
  transport.post = async () => []
  assert.equal(await vm.command(row, 'generate'), 0)
  transport.post = async () => { throw Error('生成失败') }
  assert.equal(await vm.command(row, 'generate'), undefined)
  assert.equal(vm.error.value, '生成失败')
})

test('检查项校验失败时不发送保存请求，并指出具体问题', async () => {
  const { vm, calls } = setup('standards', 'inspection')
  vm.form.checkItems = []
  await vm.save()
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('检查项'))
  vm.form.checkItems = [{ id: 'a', name: '', kind: 'boolean' }]
  await vm.save()
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('检查要求 1'))
})


test('周期只维护规则且绑定项目，有效期只由任务配置决定，空设备组不能保存', async () => {
  const { vm: cycle } = setup('cycles', 'inspection')
  assert.equal(cycle.formFields.value.some(field => ['startTime', 'endTime'].includes(field.key)), false)
  assert.equal(cycle.formFields.value.find(field => field.key === 'projectId').required, true)
  const { vm, calls } = setup()
  vm.form.groupIds = []
  await vm.save()
  assert.equal(calls.length, 0)
  vm.form.groupIds = ['group']
  vm.form.endTime = Number(vm.form.startTime) - 1
  await vm.save()
  assert.equal(calls.length, 0)
})
