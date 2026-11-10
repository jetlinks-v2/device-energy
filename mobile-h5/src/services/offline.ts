import { feText } from '../../../shared/i18n.ts'
import type { Task, TaskCommand, CheckResult, Context } from '../../../shared/types'
import type { FacilityClient } from '../../../shared/client'
import { randomId } from '../utils/randomId.ts'
/** IndexedDB按租户、应用、账号隔离。提交先落本地发件箱，保留稳定幂等键和原任务版本。 */
export interface Pending {
  id: string
  taskId: string
  projectId: string
  taskName?: string
  requirements?: { id: string; name: string }[]
  action: string
  command: TaskCommand
  state: 'pending' | 'submitted' | 'conflict'
  error?: string
  createdAt: number
}
interface Photo {
  id: string
  file: File
  remoteId?: string
}
interface CachedFile {
  id: string
  blob: Blob
}
const database = (scope: Context) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('facility:' + JSON.stringify([scope.tenantId, scope.applicationId, scope.userId]), 3)
    req.onupgradeneeded = () => {
      for (const store of ['tasks', 'drafts', 'outbox', 'photos', 'files', 'settings'])
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
async function transact<T>(
  scope: Context,
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await database(scope)
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode),
        req = work(tx.objectStore(store))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
export async function cacheTask(scope: Context, task: Task, synced = false) {
  const db = await database(scope)
  try {
    // Whole-task snapshots commit atomically; a failed download cannot leave only some devices cached.
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['tasks', 'drafts', 'outbox'], 'readwrite'), store = tx.objectStore('tasks')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
      const drafts = tx.objectStore('drafts').getAll(), queue = tx.objectStore('outbox').getAll()
      queue.onsuccess = () => {
        const protectedIds = new Set<string>(synced ? [] : [...drafts.result.map(d => d.id), ...queue.result.filter(e => e.state !== 'submitted').map(e => e.taskId)])
        for (const row of [...task.deviceTasks || [], task]) {
          if (protectedIds.has(row.id)) {
            const existing = store.get(row.id)
            existing.onsuccess = () => { if (!existing.result) store.put(row) }
          } else store.put(row)
        }
      }
    })
  } finally { db.close() }
}
/** 服务端快照保持原版本；本机队列只投影进度，不能冒充审批通过。 */
export async function cachedTasks(scope: Context) {
  const [tasks, queue] = await Promise.all([transact<Task[]>(scope, 'tasks', 'readonly', s => s.getAll()), entries(scope)])
  const waiting = new Map(queue.filter(row => row.state !== 'submitted').map(row => [row.taskId, row]))
  const rows = tasks.map(task => {
    const entry = waiting.get(task.id)
    return entry ? { ...task, results: entry.command.results || task.results, pendingSync: true, state: entry.state === 'pending' ? 'review' : task.state } : task
  })
  const children = new Map<string, Task[]>()
  for (const row of rows) if (row.parentTaskId) {
    const group = children.get(row.parentTaskId) || []
    group.push(row); children.set(row.parentTaskId, group)
  }
  for (const task of rows.filter(row => !!row.deviceCount)) {
    task.deviceTasks = children.get(task.id) || []
    task.submittedDeviceCount = task.deviceTasks.filter(row => ['review', 'completed'].includes(row.state)).length
    task.pendingSync = task.deviceTasks.some(row => row.pendingSync)
    if (!task.pendingSync && task.deviceTasks.length === task.deviceCount &&
      task.deviceTasks.every(row => ['review', 'completed'].includes(row.state)))
      task.state = task.deviceTasks.every(row => row.state === 'completed') ? 'completed' : 'review'
  }
  return rows
}
export const cachedTask = async (scope: Context, id: string) => (await cachedTasks(scope)).find(row => row.id === id)
export const saveDraft = (scope: Context, id: string, results: CheckResult[], version?: number) =>
  transact(scope, 'drafts', 'readwrite', (s) => s.put({ id, results, version }))
export const loadDraft = (scope: Context, id: string) =>
  transact<{ id: string; results: CheckResult[]; version?: number } | undefined>(scope, 'drafts', 'readonly', (s) => s.get(id))
export const removeDraft = (scope: Context, id: string) => transact(scope, 'drafts', 'readwrite', s => s.delete(id))
export const entries = (scope: Context) => transact<Pending[]>(scope, 'outbox', 'readonly', (s) => s.getAll())
export const removeEntry = (scope: Context, id: string) => transact(scope, 'outbox', 'readwrite', (s) => s.delete(id))
export async function savePhoto(scope: Context, file: File) {
  if (!file.type.startsWith('image/')) throw Error('请选择图片文件')
  if (file.size > 10 * 1024 * 1024) throw Error(feText('eachPhotoMustBeNoLargerThan10Mb'))
  const id = randomId()
  await transact(scope, 'photos', 'readwrite', (s) => s.put({ id, file }))
  return 'local:' + id
}
export const cachedPhoto = (scope: Context, id: string) =>
  transact<Photo | undefined>(scope, 'photos', 'readonly', s => s.get(id.replace(/^local:/, '')))
export async function enqueue(scope: Context, task: Task, action: string, results: CheckResult[]) {
  const existing = (await entries(scope)).find((row) => row.taskId === task.id && row.state === 'pending')
  const id = existing?.id || randomId()
  const row: Pending = {
    id,
    taskId: task.id,
    projectId: existing?.projectId || task.projectId,
    taskName: task.parentTaskId ? task.deviceName : task.name || task.deviceName,
    requirements: task.standardSnapshot.map(item => ({ id: item.id, name: item.name })),
    action,
    command: { version: existing?.command.version ?? task.version, submissionId: id, results },
    state: 'pending',
    createdAt: existing?.createdAt ?? Date.now()
  }
  await transact(scope, 'outbox', 'readwrite', (s) => s.put(row))
  return row
}
/** 一次只重放本账号队列。403/404/409保留为冲突；网络或照片失败保留待重试。 */
const replays = new Map<string, Promise<void>>()
const clearing = new Set<string>()
const scopeKey = (scope: Context) => JSON.stringify([scope.tenantId, scope.applicationId, scope.userId])
export function replay(scope: Context, api: FacilityClient): Promise<void> {
  const key = scopeKey(scope)
  if (clearing.has(key)) return Promise.reject(Error('正在清空离线缓存，请稍后再同步'))
  const running = replays.get(key)
  if (running) return running
  const next = replayEntries(scope, api).finally(() => replays.delete(key))
  replays.set(key, next)
  return next
}
async function replayEntries(scope: Context, api: FacilityClient) {
  for (const original of await entries(scope)) {
    if (original.state !== 'pending') continue
    const row = structuredClone(original)
    try {
      for (const result of row.command.results || [])
        for (let i = 0; i < result.attachments.length; i++) {
          const key = result.attachments[i]
          if (!key.startsWith('local:')) continue
          const photo = await transact<Photo | undefined>(scope, 'photos', 'readonly', (s) => s.get(key.slice(6)))
          if (!photo) throw Error(feText('theLocalPhotoIsMissingAddItAgainBeforeProceeding'))
          if (!photo.remoteId) {
            photo.remoteId = (await api.upload(photo.file, row.projectId)).id
            await transact(scope, 'photos', 'readwrite', (s) => s.put(photo))
          }
          await cacheFile(scope, photo.remoteId, photo.file)
          result.attachments[i] = photo.remoteId
        }
      const task = await api.action(row.taskId, row.action, row.command)
      await cacheTask(scope, task, true)
      const draft = await loadDraft(scope, task.id)
      if (draft?.version === row.command.version) await removeDraft(scope, task.id)
      row.state = 'submitted'
      row.error = undefined
    } catch (e) {
      const status = (e as { status?: number }).status
      row.state = [403, 404, 409].includes(status || 0) ? 'conflict' : 'pending'
      row.error = e instanceof Error ? e.message : feText('submissionFailed')
    }
    await transact(scope, 'outbox', 'readwrite', (s) => s.put(row))
  }
}

export const cacheFile = (scope: Context, id: string, blob: Blob) =>
  transact(scope, 'files', 'readwrite', (s) => s.put({ id, blob }))
export const cachedFile = (scope: Context, id: string) =>
  transact<CachedFile | undefined>(scope, 'files', 'readonly', (s) => s.get(id))

export const offlineMode = (scope: Context) => transact<{ id: string; enabled: boolean; at: number } | undefined>(scope, 'settings', 'readonly', s => s.get('mode'))
export const setOfflineMode = (scope: Context) => transact(scope, 'settings', 'readwrite', s => s.put({ id: 'mode', enabled: true, at: Date.now() }))
export async function cacheSummary(scope: Context) {
  const [tasks, queue, drafts] = await Promise.all([cachedTasks(scope), entries(scope), transact<{ id: string; version?: number }[]>(scope, 'drafts', 'readonly', s => s.getAll())])
  const queued = new Set(queue.filter(row => row.state !== 'submitted').map(row => row.taskId))
  return { tasks: tasks.filter(row => !row.parentTaskId).length, pending: queue.filter(row => row.state !== 'submitted').length, drafts: drafts.filter(row => !queued.has(row.id)).length }
}
/** 同步与清理互斥，业务缓存同事务清空，不删除登录身份或应用静态资源。 */
export async function clearOfflineData(scope: Context) {
  const key = scopeKey(scope)
  if (replays.has(key)) throw Error('正在同步，请等待同步结束后再关闭离线模式')
  if (clearing.has(key)) throw Error('正在清空缓存，请稍候')
  clearing.add(key)
  try {
    const db = await database(scope)
    try {
      await new Promise<void>((resolve, reject) => {
        const names = Array.from(db.objectStoreNames), tx = db.transaction(names, 'readwrite')
        tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error)
        for (const name of names) tx.objectStore(name).clear()
      })
    } finally { db.close() }
  } finally { clearing.delete(key) }
}
