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
  if (resourceName === 'plans') Object.assign(vm.form, { startTime: Date.now(), endTime: Date.now() + 86400000 })
  return { vm, calls, transport }
}

test('新增任务配置时间留空且必填，编辑保留时间，清空后不能保存', async () => {
  const { vm, calls } = setup('plans', 'inspection')
  vm.edit()
  assert.equal(vm.form.startTime, undefined)
  assert.equal(vm.form.endTime, undefined)
  vm.edit({ id: 'plan', version: 1, name: '计划', projectId: 'project', kind: 'inspection', mode: 'single',
    standardId: 'standard', cycleId: 'cycle', groupIds: ['group'], reviewerId: 'owner', startTime: 100000, endTime: 200000 })
  assert.equal(vm.form.startTime, 100000)
  assert.equal(vm.form.endTime, 200000)
  vm.change('startTime', undefined)
  await vm.save()
  assert.equal(calls.length, 0)
  assert.ok(vm.error.value.includes('开始时间'))
})

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

test('任务配置只选设备组，负责人和作业类型必填，不再区分工单模式和外协', () => {
  const { vm } = setup()
  const fields = vm.formFields.value
  for (const key of ['deviceIds', 'assigneeId', 'followUserId', 'externalOrganizationId', 'mode'])
    assert.equal(fields.some(field => field.key === key), false)
  for (const key of ['reviewerId', 'kind', 'cycleId', 'groupIds', 'startTime', 'endTime']) assert.equal(fields.find(field => field.key === key).required, true)
  assert.equal(fields.find(field => field.key === 'reviewerId').label, '负责人')
})

test('旧双工单字段不再提交，所有任务使用项目工单流程', async () => {
  const { vm, calls } = setup()
  Object.assign(vm.form, { mode: 'double', externalOrganizationId: 'vendor', followUserId: 'follower' })
  await vm.save()
  assert.equal(calls.length, 1)
  for (const key of ['mode', 'externalOrganizationId', 'followUserId']) assert.equal(calls[0].payload[key], undefined)
})

test('缺作业类型或负责人阻止请求，旧执行人及跟进人不再提交，保留旧设备范围', async () => {
  for (const key of ['kind', 'reviewerId']) {
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

test('设备组切换项目清空原设备选择，入口类型不写入设备组', () => {
  const { vm } = setup('groups', 'inspection')
  vm.edit({ id: 'group', projectId: 'project-a', deviceIds: ['device-a'] })
  assert.equal(vm.form.kind, undefined)
  vm.change('projectId', 'project-b')
  assert.deepEqual(vm.form.deviceIds, [])
})
