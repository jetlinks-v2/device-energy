import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { taskScanTarget } from '../src/services/taskScan.ts'
import { issueTaskScanAccess, taskScanAllowed, clearTaskScanAccess } from '../src/services/taskScanAccess.ts'
import { cacheTask, cachedTask, enqueue, replay, entries, saveDraft, loadDraft } from '../src/services/offline.ts'

const members = [
  { id: 'a', parentTaskId: 'task', deviceId: 'device-a', groupIds: ['group-a'], standardSnapshot: [], results: [] },
  { id: 'b', parentTaskId: 'task', deviceId: 'device-b', groupIds: ['group-a'], standardSnapshot: [], results: [] },
  { id: 'c', parentTaskId: 'other-task', deviceId: 'device-c', groupIds: ['group-c'], standardSnapshot: [], results: [] }
]
const code = (type, id, applicationId = 'app') => JSON.stringify({ type, id, applicationId })
test('group scanning stays in the current execution while device scanning opens its exact device work', () => {
  assert.equal(taskScanTarget(code('facility-group', 'group-a'), 'app', 'task', members), '/tasks/task?groupId=group-a')
  assert.equal(taskScanTarget(code('facility-device', 'device-b'), 'app', 'task', members), '/tasks/b')
  for (const value of [code('facility-group', 'group-c'), code('facility-device', 'device-c'), code('facility-device', 'device-a', 'another-app'), 'null', '{'])
    assert.throws(() => taskScanTarget(value, 'app', 'task', members))
  assert.equal(taskScanTarget(code('facility-device', 'device-a'), 'app'), '/device/device-a')
})

test('task scan entries require the right kind of code and an exact device match', () => {
  assert.throws(() => taskScanTarget(code('facility-device', 'device-a'), 'app', 'task', members, { type: 'group' }), /设备组/)
  assert.throws(() => taskScanTarget(code('facility-group', 'group-a'), 'app', 'task', members, { type: 'device', deviceId: 'device-a' }), /设备/)
  assert.throws(() => taskScanTarget(code('facility-device', 'device-b'), 'app', 'task', members, { type: 'device', deviceId: 'device-a' }), /不匹配/)
})

test('scanning grants only the selected device snapshots to the current account, never a URL alone', () => {
  const scope = { tenantId: 'tenant', applicationId: 'app', userId: 'worker' }
  const rows = members.slice(0, 2).map(row => ({ ...row, tenantId: 'tenant', applicationId: 'app', version: 3, state: 'claimed', assigneeId: 'worker' }))
  assert.equal(taskScanAllowed(scope, rows[0], 'invented'), false)
  const permit = issueTaskScanAccess(scope, rows, 'group-a')
  for (const row of rows) assert.equal(taskScanAllowed(scope, row, permit), true)
  assert.equal(taskScanAllowed(scope, rows[0], permit, 'group-a'), true)
  assert.equal(taskScanAllowed(scope, rows[0], permit, 'another-group'), false)
  for (const changes of [{ version: 4 }, { assigneeId: 'other' }, { state: 'review' }, { parentTaskId: 'another' }, { id: 'different' }])
    assert.equal(taskScanAllowed(scope, { ...rows[0], ...changes }, permit), false)
  for (const changes of [{ tenantId: 'other' }, { applicationId: 'other' }, { userId: 'other' }])
    assert.equal(taskScanAllowed({ ...scope, ...changes }, rows[0], permit), false)
  const single = issueTaskScanAccess(scope, [rows[0]])
  assert.equal(taskScanAllowed(scope, rows[1], single), false)
  clearTaskScanAccess()
  assert.equal(taskScanAllowed(scope, rows[0], permit), false)
})
test('downloading a whole task stores each device separately; submitting one never removes another device draft', async () => {
  const scope = { tenantId: 'tenant', applicationId: 'app', userId: 'execution-worker' }
  const parent = { id: 'task', deviceCount: 2, deviceTasks: members.slice(0, 2).map(row => ({ ...row, version: 1, projectId: 'project' })) }
  await cacheTask(scope, parent)
  assert.equal((await cachedTask(scope, 'a')).parentTaskId, 'task')
  assert.equal((await cachedTask(scope, 'b')).id, 'b')
  const draft = [{ itemId: 'pressure', value: '符合', attachments: ['local:b-photo'] }]
  await saveDraft(scope, 'b', draft, 1)
  await enqueue(scope, parent.deviceTasks[0], 'submit', [])
  await replay(scope, { action: async () => ({ ...parent.deviceTasks[0], state: 'review', version: 2 }) })
  assert.equal((await cachedTask(scope, 'a')).state, 'review')
  assert.equal((await cachedTask(scope, 'b')).version, 1)
  assert.deepEqual((await loadDraft(scope, 'b')).results, draft)
  assert.equal((await entries(scope))[0].taskId, 'a')
})
