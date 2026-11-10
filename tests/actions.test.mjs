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
const { planGenerationReason } = load('shared/planActions.ts')
const { canExecute, canTransfer, canWithdraw } = load('shared/taskActions.ts')
const plan = { id: 'plan', cycleId: 'cycle', enabled: true, startTime: 100, endTime: 300, nextRunTime: 200 }

test('巡检与维保操作使用各自菜单按钮，未识别资源不开放权限', () => {
  assert.deepEqual(resourcePermission('plans', 'inspection', 'generate'), ['facility/Inspection/Plans:generate'])
  assert.deepEqual(resourcePermission('plans', 'maintenance', 'generate'), ['facility/Maintenance/Plans:generate'])
  assert.deepEqual(resourcePermission('plans', 'inspection'), ['facility/Inspection/Plans:save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance'), ['facility/Maintenance/Plans:save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance', 'delete'), ['facility/Maintenance/Plans:delete'])
  assert.deepEqual(resourcePermission('groups', undefined, 'qr'), ['facility/Inspection/Groups:qr', 'facility/Maintenance/Groups:qr'])
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
      ['plans', ['configure', 'delete', 'toggle', 'generate']], ['groups', ['configure', 'delete', 'qr']],
      ['tasks', ['execute', 'dispatch', 'review']], ['energy/mappings', ['configure', 'toggle']], ['rules', ['configure', 'toggle']]
    ]) for (const action of actions) {
      const codes = resourcePermission(resource, kind, action)
      for (const code of Array.isArray(codes) ? codes : [codes]) assert.ok(permissions.has(code), code)
    }
  }
})

test('任务详情与执行表单的按钮从真实任务菜单取权，不再引用父分组', () => {
  for (const file of ['components/TaskDetail.vue', 'components/ExecutionForm.vue']) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.ok(source.includes("resourcePermission('tasks',"))
    assert.equal(source.includes("'facility/' +"), false)
  }
})
test('停用、日期缺失或未开始的计划不能生成，边界到期允许生成', () => {
  assert.notEqual(planGenerationReason({ ...plan, enabled: false }, false, 200), '')
  assert.notEqual(planGenerationReason({ ...plan, nextRunTime: undefined }, false, 200), '')
  assert.notEqual(planGenerationReason({ ...plan, startTime: NaN }, false, 200), '')
  assert.notEqual(planGenerationReason(plan, false, 99), '')
  assert.notEqual(planGenerationReason(plan, false, 199), '')
  assert.equal(planGenerationReason(plan, false, 200), '')
})
test('临时任务按当前时间判断有效期，不等待下一次周期', () => {
  assert.equal(planGenerationReason(plan, true, 150), '')
  assert.notEqual(planGenerationReason(plan, true, 300), '')
  assert.notEqual(planGenerationReason(plan, true, 301), '')
  assert.notEqual(planGenerationReason({ ...plan, nextRunTime: 301 }, false, 400), '')
})
test('任务执行受身份和状态约束，终态不能转派或撤回', () => {
  const task = { id: 'task', assigneeId: 'worker', followUserId: 'follower', state: 'claimed' }
  assert.equal(canExecute(task, 'worker'), true)
  assert.equal(canExecute(task, 'other'), false)
  assert.equal(canExecute({ ...task, state: 'external-submitted' }, 'follower'), true)
  for (const state of ['completed', 'cancelled']) {
    assert.equal(canExecute({ ...task, state }, 'worker'), false)
    assert.equal(canTransfer({ ...task, state }), false)
    assert.equal(canWithdraw({ ...task, state }), false)
  }
})
