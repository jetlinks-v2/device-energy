import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync } = require('esbuild')
function load(file) {
  const result = buildSync({ entryPoints: [resolve(root, file)], bundle: true, write: false, platform: 'node', format: 'cjs' })
  const module = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
  return module.exports
}
const { resourcePermission } = load('shared/permissions.ts')
const { canExecute, canTransfer, canWithdraw } = load('shared/taskActions.ts')

test('巡检与维保操作使用各自菜单按钮，未识别资源不开放权限', () => {
  assert.deepEqual(resourcePermission('plans', 'inspection'), ['facility/Inspection/Plans:save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance'), ['facility/Maintenance/Plans:save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance', 'delete'), ['facility/Maintenance/Plans:delete'])
  assert.equal(resourcePermission('groups', undefined, 'qr'), 'facility/Devices:groups-qr')
  assert.deepEqual(resourcePermission('tasks', undefined, 'execute'), ['facility/Inspection/Tasks:execute', 'facility/Maintenance/Tasks:execute'])
  assert.equal(resourcePermission('unknown'), false)
})
test('能源、预警、通知操作绑定对应业务权限', () => {
  assert.equal(resourcePermission('energy/mappings'), 'facility/Energy:save')
  assert.equal(resourcePermission('alerts'), 'facility/Alerts:handle')
  assert.equal(resourcePermission('notifications'), 'facility/Notifications:retry')
  assert.equal(resourcePermission('devices'), 'facility/Devices:save')
})

test('配置操作引用的每一个权限码均能在实际菜单按钮中找到', () => {
  const walk = nodes => nodes.flatMap(node => [node, ...walk(node.children || [])])
  const menus = walk(JSON.parse(readFileSync(resolve(root, 'baseMenu.json'), 'utf8')))
  const permissions = new Set(menus.flatMap(menu => (menu.buttons || []).map(button => menu.code + ':' + button.id)))
  assert.deepEqual(menus.find(menu => menu.code === 'facility/Energy').buttons.find(button => button.id === 'toggle').permissions,
    [{ permission: 'facility-mapping', actions: ['save'] }])
  for (const kind of ['inspection', 'maintenance']) {
    for (const [resource, actions] of [
      ['standards', ['configure', 'delete', 'toggle']], ['cycles', ['configure', 'delete', 'toggle']],
      ['plans', ['configure', 'delete', 'toggle']], ['groups', ['configure', 'delete', 'qr']],
      ['tasks', ['execute', 'dispatch', 'review', 'close']], ['energy/mappings', ['configure', 'toggle']], ['rules', ['configure', 'toggle']]
    ]) for (const action of actions) {
      const codes = resourcePermission(resource, kind, action)
      for (const code of Array.isArray(codes) ? codes : [codes]) assert.ok(permissions.has(code), code)
    }
  }
})

test('仅授权设备资产时，共享设备组使用本页独立按钮，档案维护不再捆绑删除设备组', () => {
  const menus = JSON.parse(readFileSync(resolve(root, 'baseMenu.json'), 'utf8'))[0].children
  const device = menus.find(menu => menu.code === 'facility/Devices')
  for (const [action, required] of [['configure', 'save'], ['delete', 'delete'], ['qr', 'query']]) {
    const code = resourcePermission('groups', undefined, action)
    assert.equal(typeof code, 'string')
    assert.ok(code.startsWith(device.code + ':'))
    const button = device.buttons.find(b => device.code + ':' + b.id === code)
    assert.ok(button.permissions.some(p => p.permission === 'facility-group' && p.actions.includes(required)))
  }
  assert.equal(device.buttons.find(b => b.id === 'save').permissions.some(p => p.permission === 'facility-group'), false)
  assert.deepEqual(resourcePermission('groups', 'inspection', 'delete'), ['facility/Inspection/Groups:delete'])
  assert.deepEqual(resourcePermission('groups', 'maintenance', 'delete'), ['facility/Maintenance/Groups:delete'])
})

test('任务详情与执行表单的按钮从真实任务菜单取权，不再引用父分组', () => {
  for (const file of ['components/TaskDetail.vue', 'components/ExecutionForm.vue']) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.ok(source.includes("resourcePermission('tasks',"))
    assert.equal(source.includes("'facility/' +"), false)
  }
})
test('任务执行受身份和状态约束，终态不能转派或撤回', () => {
  const task = { id: 'task', assigneeId: 'worker', followUserId: 'follower', state: 'claimed' }
  assert.equal(canExecute(task, 'worker'), true)
  assert.equal(canExecute(task, 'other'), false)
  assert.equal(canExecute({ ...task, state: 'external-submitted' }, 'follower'), false)
  for (const state of ['completed', 'cancelled', 'closed']) {
    assert.equal(canExecute({ ...task, state }, 'worker'), false)
    assert.equal(canTransfer({ ...task, state }), false)
    assert.equal(canWithdraw({ ...task, state }), false)
  }
})
