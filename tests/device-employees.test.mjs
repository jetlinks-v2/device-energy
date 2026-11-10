import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useDevice.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'device-employees-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const reactive=value=>value; export const computed=read=>({get value(){return read()}}); export const watch=()=>{}; export const onMounted=()=>{}',
      '../api': 'export const facility=transport'
    }[args.path] }))
  } }]
})

function setup(projectId, fail = false, flags = {}) {
  const calls = [], module = { exports: {} }
  const transport = {
    read: async () => ({ id: 'device', projectId, version: 3, ...flags }),
    updateDevice: async row => calls.push(row),
    options: async path => {
      calls.push(path)
      if (!path.startsWith('employees/')) return []
      if (fail) throw new Error('无权查询项目人员')
      return [{ id: 'employee', name: '项目员工' }]
    },
    get: async path => path.endsWith('/history') ? { data: [] } : undefined
  }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  return { calls, vm: module.exports.useDevice({ id: 'device', projectId: 'stale-project' }) }
}

test('负责人依据重新读取的设备所属项目查询，编码项目ID，不查询全量人员', async () => {
  const { vm, calls } = setup('project/a')
  await vm.refresh()
  assert.ok(calls.includes('employees/project%2Fa'))
  assert.equal(calls.includes('employees'), false)
  assert.deepEqual(vm.options.employees, [{ value: 'employee', label: '项目员工' }])
})

test('合并开关兼容旧单侧启用，保存时同步两字段，关闭时全部关闭', async () => {
  for (const inspectionEnabled of [false, true]) for (const maintenanceEnabled of [false, true]) {
    const { vm, calls } = setup('project', false, { inspectionEnabled, maintenanceEnabled })
    await vm.refresh()
    assert.equal(vm.form.workEnabled, inspectionEnabled || maintenanceEnabled)
    assert.deepEqual(vm.fields.filter(field => ['inspectionEnabled', 'maintenanceEnabled', 'workEnabled'].includes(field.key)).map(field => field.key), ['workEnabled'])
    for (const enabled of [false, true]) {
      vm.change('workEnabled', enabled)
      await vm.save()
      const saved = calls.filter(call => typeof call === 'object').at(-1)
      assert.equal(saved.inspectionEnabled, enabled)
      assert.equal(saved.maintenanceEnabled, enabled)
      assert.equal(saved.version, 3)
      assert.equal('workEnabled' in saved, false)
    }
  }
})

test('未归属项目时保持空负责人，不回退全量目录', async () => {
  const { vm, calls } = setup(undefined)
  await vm.refresh()
  assert.equal(calls.some(path => path.startsWith('employees')), false)
  assert.deepEqual(vm.options.employees, [])
})

test('项目人员查询失败时清空旧候选并展示错误，不扩大查询范围', async () => {
  const { vm, calls } = setup('project', true)
  vm.options.employees = [{ value: 'other-project-person', label: '旧候选' }]
  await vm.refresh()
  assert.deepEqual(vm.options.employees, [])
  assert.equal(vm.error.value, '无权查询项目人员')
  assert.equal(calls.includes('employees'), false)
})
