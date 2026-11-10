import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { taskQuery, matchesTask } from '../src/services/taskQuery.ts'
import { incompleteCheck } from '../src/services/checks.ts'
import { saveDraft, loadDraft, enqueue, replay, entries, cachedTasks, savePhoto } from '../src/services/offline.ts'
import { feLocale, feText } from '../../shared/i18n.ts'

test('H5 stays Chinese with an English stored preference without changing the PC language preference', () => {
  const previousDocument = globalThis.document, previousStorage = globalThis.localStorage
  try {
    globalThis.localStorage = { getItem: () => 'en' }
    globalThis.document = { documentElement: { dataset: { locale: 'zh' } } }
    assert.equal(feLocale(), 'zh'); assert.equal(feText('inspection'), '巡检')
    delete globalThis.document.documentElement.dataset.locale
    assert.equal(feLocale(), 'en'); assert.equal(globalThis.localStorage.getItem('Accept-Language'), 'en')
  } finally { globalThis.document = previousDocument; globalThis.localStorage = previousStorage }
})

const now = Date.now()
const task = { id: 'task', projectId: 'p1', kind: 'inspection', name: '水泵巡检', deviceName: '泵一', scheduledTime: now - 1000, deadline: now - 10, state: 'claimed', assigneeId: 'worker', version: 3, standardSnapshot: [{ id: 'a', name: '检查外观', required: true, photoRequired: false, kind: 'boolean' }] }
const results = [{ itemId: 'a', value: 'false', abnormal: true, attachments: [] }]
const scope = userId => ({ tenantId: 'tenant', applicationId: 'app', userId, userName: userId })

test('overdue filters exclude completed and closed tasks; downloaded tasks obey project, kind, search and date ranges', () => {
  const filter = { projectId: 'p1', kind: 'inspection', status: 'overdue', search: '水泵', from: now - 2000, to: now }
  assert.equal(matchesTask(task, filter, now), true)
  for (const change of [{ projectId: 'p2' }, { kind: 'maintenance' }, { state: 'completed' }, { state: 'closed' }, { deadline: now + 10 }, { scheduledTime: now - 3000 }])
    assert.equal(matchesTask({ ...task, ...change }, filter, now), false)
  const query = taskQuery(filter, 2, now)
  assert.equal(query.pageIndex, 2)
  assert.equal(query.pageSize, 20)
  assert.ok(query.terms.some(t => t.column === 'deadline' && t.termType === 'lt' && t.value === now))
  assert.ok(query.terms.some(t => t.column === 'projectId' && t.value === 'p1'))
})

test('abnormal numeric measurements remain submittable; required answers and photos block incomplete work', () => {
  const numeric = { id: 'pressure', kind: 'number', name: '压力', minimum: 1, maximum: 4, required: true, photoRequired: true }
  const answer = { itemId: 'pressure', value: '9', abnormal: true, attachments: ['photo'] }
  assert.equal(incompleteCheck([numeric], [answer]), undefined)
  assert.equal(incompleteCheck([numeric], [{ ...answer, value: 'NaN' }]), numeric)
  assert.equal(incompleteCheck([numeric], [{ ...answer, attachments: [] }]), numeric)
  assert.equal(incompleteCheck([{ ...numeric, required: false }], []), undefined)
  assert.equal(incompleteCheck(task.standardSnapshot, []), task.standardSnapshot[0])
  assert.equal(incompleteCheck(task.standardSnapshot, results), undefined)
})

test('successful sync clears the matching draft, retains readable requirements and updates cached task state', async () => {
  const account = scope('submitted-worker')
  await saveDraft(account, task.id, results, task.version)
  assert.equal((await loadDraft(account, task.id)).version, 3)
  await enqueue(account, task, 'submit', results)
  await replay(account, { action: async () => ({ ...task, version: 4, state: 'review', results }) })
  assert.equal(await loadDraft(account, task.id), undefined)
  assert.equal((await entries(account))[0].requirements[0].name, '检查外观')
  assert.equal((await cachedTasks(account))[0].state, 'review')
})

test('a task-version conflict retains the draft and photos without re-submitting automatically', async () => {
  const account = scope('returned-worker')
  const photo = await savePhoto(account, new File(['photo'], 'site.jpg', { type: 'image/jpeg' }))
  const local = [{ ...results[0], attachments: [photo] }]
  await saveDraft(account, task.id, local, task.version)
  await enqueue(account, task, 'submit', local)
  let calls = 0
  const api = { upload: async () => ({ id: 'remote-photo' }), action: async () => { calls++; throw Object.assign(Error('任务已转单'), { status: 409 }) } }
  await replay(account, api); await replay(account, api)
  assert.equal(calls, 1)
  assert.equal((await loadDraft(account, task.id)).results[0].attachments[0], photo)
  assert.equal((await entries(account))[0].state, 'conflict')
})

test('photo upload rejects documents and oversize images before writing local storage', async () => {
  await assert.rejects(savePhoto(scope('invalid-photo'), new File(['pdf'], 'manual.pdf', { type: 'application/pdf' })))
  await assert.rejects(savePhoto(scope('invalid-photo'), new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })))
})

test('overlapping replay requests share one upload and one task submission', async () => {
  const account = scope('concurrent-worker')
  await enqueue(account, task, 'submit', results)
  let calls = 0, finish
  const api = { action: async () => { calls++; await new Promise(resolve => { finish = resolve }); return { ...task, state: 'review', version: 4 } } }
  const first = replay(account, api), second = replay(account, api)
  assert.equal(first, second)
  while (!finish) await new Promise(resolve => setTimeout(resolve, 1))
  finish(); await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.equal((await entries(account))[0].state, 'submitted')
})
