import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
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
  assert.deepEqual(resourcePermission('plans', 'inspection', 'generate'), ['facility/Inspection:generate'])
  assert.deepEqual(resourcePermission('plans', 'maintenance', 'generate'), ['facility/Maintenance:generate'])
  assert.deepEqual(resourcePermission('plans', 'inspection'), ['facility/Inspection:plan-save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance'), ['facility/Maintenance:plan-save'])
  assert.deepEqual(resourcePermission('plans', 'maintenance', 'delete'), ['facility/Maintenance:plan-delete'])
  assert.deepEqual(resourcePermission('groups', undefined, 'qr'), ['facility/Inspection:group-qr', 'facility/Maintenance:group-qr'])
  assert.deepEqual(resourcePermission('tasks', undefined, 'execute'), ['facility/Inspection:execute', 'facility/Maintenance:execute'])
  assert.equal(resourcePermission('unknown'), false)
})
test('能源、预警、通知操作绑定对应业务权限', () => {
  assert.equal(resourcePermission('energy/mappings'), 'facility/Energy:save')
  assert.equal(resourcePermission('alerts'), 'facility/Alerts:handle')
  assert.equal(resourcePermission('notifications'), 'facility/Notifications:retry')
  assert.equal(resourcePermission('devices'), 'facility/Devices:save')
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
