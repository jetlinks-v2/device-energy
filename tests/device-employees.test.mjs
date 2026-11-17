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
    builder.onResolve({ filter: /^(vue|ant-design-vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const reactive=value=>value; export const computed=read=>({get value(){return read()}}); export const watch=()=>{}; export const onMounted=()=>{}',
      '../api': 'export const facility=transport',
      'ant-design-vue': 'export const message=notifier'
    }[args.path] }))
  } }]
})

function setup(projectId, fail = false, flags = {}, overrides = {}) {
  const calls = [], notices = [], module = { exports: {} }
  const transport = {
    read: async () => ({ id: 'device', projectId, version: 3, responsibleUserId: 'employee', ...flags }),
    updateDevice: async row => calls.push(row),
    options: async path => {
      calls.push(path)
      if (!path.startsWith('employees/')) return []
      if (fail) throw new Error('无权查询项目人员')
      return [{ id: 'employee', name: '项目员工' }]
    },
    get: async path => { calls.push(path); return path.endsWith('/history') ? { data: [] } : undefined },
    ...overrides
  }
  const notifier = Object.fromEntries(['success', 'error', 'warning'].map(type => [type, text => notices.push({ type, text })]))
  new Function('transport', 'notifier', 'module', 'exports', bundled.outputFiles[0].text)(transport, notifier, module, module.exports)
  return { calls, notices, vm: module.exports.useDevice({ id: 'device', projectId: 'stale-project' }) }
}

test('负责人依据重新读取的设备所属项目查询，编码项目ID，不查询全量人员', async () => {
  const { vm, calls } = setup('project/a')
  await vm.refresh()
  assert.ok(calls.includes('employees/project%2Fa'))
  assert.equal(calls.includes('employees'), false)
  assert.deepEqual(vm.options.employees, [{ value: 'employee', label: '项目员工' }])
})

test('设备详情只加载档案所需目录和操作历史，不加载已移除页签的数据', async () => {
  const { vm, calls } = setup('project')
  await vm.refresh()
  assert.deepEqual(calls, ['employees/project', 'spaces/project', 'devices/device/history'])
  assert.deepEqual(vm.history.value, [])
  assert.equal(vm.error.value, '')
  assert.equal(vm.busy.value, false)
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


test('详情负责人必填：空白不发送保存，选中负责人后保存成功', async () => {
  const { vm, calls, notices } = setup('project', false, { responsibleUserId: undefined })
  await vm.refresh()
  assert.equal(vm.fields.find(field => field.key === 'responsibleUserId').required, true)
  await vm.save()
  assert.equal(calls.some(call => typeof call === 'object'), false)
  assert.match(vm.error.value, /负责人/)
  assert.equal(notices.at(-1).type, 'error')
  assert.match(notices.at(-1).text, /负责人/)
  vm.change('responsibleUserId', 'employee')
  await vm.save()
  assert.equal(calls.filter(call => typeof call === 'object').at(-1).responsibleUserId, 'employee')
  assert.deepEqual(notices.at(-1), { type: 'success', text: '设备档案保存成功' })
  assert.equal(vm.busy.value, false)
})

test('保存请求失败明确提示错误，保留填写内容且不误报成功', async () => {
  const { vm, notices } = setup('project', false, {}, { updateDevice: async () => { throw Error('设备档案版本已变更') } })
  await vm.refresh()
  vm.change('remark', '检查记录')
  await vm.save()
  assert.deepEqual(notices, [{ type: 'error', text: '设备档案版本已变更' }])
  assert.equal(vm.form.remark, '检查记录')
  assert.equal(vm.busy.value, false)
})

test('更新已成功但刷新失败时明确说明已保存，不提示保存失败', async () => {
  let reads = 0
  const { vm, notices } = setup('project', false, {}, { read: async () => {
    if (reads++) throw Error('网络连接中断')
    return { id: 'device', projectId: 'project', version: 3, responsibleUserId: 'employee' }
  } })
  await vm.refresh()
  await vm.save()
  assert.deepEqual(notices, [{ type: 'warning', text: '设备档案已保存，但刷新失败，请重新打开详情。原因：网络连接中断' }])
  assert.equal(vm.busy.value, false)
})

test('保存等待期间保持加载且重复点击只请求一次，完成后只提示一次成功', async () => {
  let complete, requests = 0
  const { vm, notices } = setup('project', false, {}, { updateDevice: () => {
    requests++
    return new Promise(resolve => { complete = resolve })
  } })
  await vm.refresh()
  const pending = vm.save()
  assert.equal(vm.busy.value, true)
  await vm.save()
  assert.equal(requests, 1)
  assert.deepEqual(notices, [])
  complete()
  await pending
  assert.equal(vm.busy.value, false)
  assert.deepEqual(notices, [{ type: 'success', text: '设备档案保存成功' }])
})
