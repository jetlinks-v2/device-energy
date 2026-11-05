import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cacheTask,
  cachedTasks,
  savePhoto,
  enqueue,
  entries,
  replay,
  cacheFile,
  cachedFile
} from '../src/services/offline.ts'
const account = (userId) => ({ tenantId: 'tenant', applicationId: 'app', userId, userName: userId })
const task = (id) => ({ id, projectId: 'project', version: 3, state: 'claimed', mode: 'single', assigneeId: 'worker', standardSnapshot: [] })
const result = (attachments) => [{ itemId: 'pressure', value: '3.5', abnormal: false, attachments }]
test('cached tasks and queues are isolated by user, tenant and application', async () => {
  const scope = account('worker')
  await cacheTask(scope, task('isolation'))
  assert.equal((await cachedTasks(scope))[0].id, 'isolation')
  for (const other of [account('other'), { ...scope, tenantId: 'other' }, { ...scope, applicationId: 'other' }])
    assert.deepEqual(await cachedTasks(other), [])
})
test('double tap preserves one queued submission and its original version', async () => {
  const scope = account('double-tap'),
    t = task('tap')
  const a = await enqueue(scope, t, 'submit', result([]))
  const b = await enqueue(scope, { ...t, version: 99 }, 'submit', result([]))
  assert.equal(a.id, b.id)
  assert.equal((await entries(scope)).length, 1)
  assert.equal(b.command.version, 3)
})
test('photo upload failure preserves local payload and retry uses one stable submission key', async () => {
  const scope = account('photo'),
    t = task('photo-task'),
    local = await savePhoto(scope, new File(['photo'], 'pressure.jpg', { type: 'image/jpeg' }))
  const pending = await enqueue(scope, t, 'submit', result([local]))
  let uploads = 0,
    calls = []
  const api = {
    upload: async (_file, projectId) => {
      assert.equal(projectId, t.projectId)
      if (++uploads === 1) throw Error('network offline')
      return { id: 'remote-photo' }
    },
    action: async (id, action, command) => {
      calls.push({ id, action, command })
      return { ...t, version: 4, state: 'review' }
    }
  }
  await replay(scope, api)
  assert.equal((await entries(scope))[0].state, 'pending')
  assert.equal((await entries(scope))[0].command.results[0].attachments[0], local)
  await replay(scope, api)
  assert.equal((await entries(scope))[0].state, 'submitted')
  assert.equal(calls[0].command.submissionId, pending.id)
  assert.deepEqual(calls[0].command.results[0].attachments, ['remote-photo'])
  await replay(scope, api)
  assert.equal(calls.length, 1)
})
test('403 and 409 retain local contents as conflicts and are never silently replayed again', async () => {
  for (const status of [403, 409]) {
    const scope = account('conflict' + status),
      t = task('reassigned')
    await enqueue(scope, t, 'submit', result([]))
    let calls = 0
    const api = {
      action: async () => {
        calls++
        throw Object.assign(Error('task changed'), { status })
      }
    }
    await replay(scope, api)
    await replay(scope, api)
    const saved = (await entries(scope))[0]
    assert.equal(saved.state, 'conflict')
    assert.equal(saved.command.version, 3)
    assert.equal(saved.command.results[0].value, '3.5')
    assert.equal(calls, 1)
  }
})

test('downloaded instruction files are isolated by account', async () => {
  const scope = account('instruction')
  await cacheFile(scope, 'manual', new Blob(['private manual'], { type: 'application/pdf' }))
  assert.equal(await (await cachedFile(scope, 'manual')).blob.text(), 'private manual')
  assert.equal(await cachedFile(account('other-instruction'), 'manual'), undefined)
})
