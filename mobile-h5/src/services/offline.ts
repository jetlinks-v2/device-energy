import { feText } from '../../../shared/i18n.ts'
import type { Task, TaskCommand, CheckResult, Context } from '../../../shared/types'
import type { FacilityClient } from '../../../shared/client'
/** IndexedDB按租户、应用、账号隔离。提交先落本地发件箱，保留稳定幂等键和原任务版本。 */
export interface Pending {
  id: string
  taskId: string
  projectId: string
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
    const req = indexedDB.open('facility:' + JSON.stringify([scope.tenantId, scope.applicationId, scope.userId]), 2)
    req.onupgradeneeded = () => {
      for (const store of ['tasks', 'drafts', 'outbox', 'photos', 'files'])
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
export const cacheTask = (scope: Context, task: Task) => transact(scope, 'tasks', 'readwrite', (s) => s.put(task))
export const cachedTask = (scope: Context, id: string) =>
  transact<Task | undefined>(scope, 'tasks', 'readonly', (s) => s.get(id))
export const cachedTasks = (scope: Context) => transact<Task[]>(scope, 'tasks', 'readonly', (s) => s.getAll())
export const saveDraft = (scope: Context, id: string, results: CheckResult[]) =>
  transact(scope, 'drafts', 'readwrite', (s) => s.put({ id, results }))
export const loadDraft = (scope: Context, id: string) =>
  transact<{ id: string; results: CheckResult[] } | undefined>(scope, 'drafts', 'readonly', (s) => s.get(id))
export const entries = (scope: Context) => transact<Pending[]>(scope, 'outbox', 'readonly', (s) => s.getAll())
export const removeEntry = (scope: Context, id: string) => transact(scope, 'outbox', 'readwrite', (s) => s.delete(id))
export async function savePhoto(scope: Context, file: File) {
  if (file.size > 10 * 1024 * 1024) throw Error(feText('eachPhotoMustBeNoLargerThan10Mb'))
  const id = crypto.randomUUID()
  await transact(scope, 'photos', 'readwrite', (s) => s.put({ id, file }))
  return 'local:' + id
}
export async function enqueue(scope: Context, task: Task, action: string, results: CheckResult[]) {
  const existing = (await entries(scope)).find((row) => row.taskId === task.id && row.state === 'pending')
  const id = existing?.id || crypto.randomUUID()
  const row: Pending = {
    id,
    taskId: task.id,
    projectId: existing?.projectId || task.projectId,
    action,
    command: { version: existing?.command.version ?? task.version, submissionId: id, results },
    state: 'pending',
    createdAt: existing?.createdAt ?? Date.now()
  }
  await transact(scope, 'outbox', 'readwrite', (s) => s.put(row))
  return row
}
/** 一次只重放本账号队列。403/404/409保留为冲突；网络或照片失败保留待重试。 */
export async function replay(scope: Context, api: FacilityClient) {
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
          result.attachments[i] = photo.remoteId
        }
      const task = await api.action(row.taskId, row.action, row.command)
      await cacheTask(scope, task)
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
