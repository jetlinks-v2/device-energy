import type { Context } from '../../../shared/types'
import type { FacilityClient } from '../../../shared/client'
import { cacheTask, cacheFile, cachedFile, setOfflineMode } from './offline.ts'

/** 分页顺序缓存全部已接单待办；完整快照及照片全部落盘后，才标记离线模式开启。 */
export async function prepareOfflineMode(scope: Context, api: FacilityClient, file: (id: string) => Promise<Blob>, progress: (value: string) => void) {
  const seen = new Set<string>(), files = new Set<string>()
  for (let pageIndex = 0; pageIndex < 1000; pageIndex++) {
    const page = await api.tasks({ pageIndex, pageSize: 50, sorts: [{ name: 'id', order: 'asc' }], terms: [
      { column: 'state', termType: 'in', value: ['claimed', 'executing', 'rectify'] }
    ] }, true)
    if (!page.data.length && seen.size < page.total) throw Error('任务列表已变更，请重新开启离线模式')
    for (const row of page.data) {
      if (seen.has(row.id)) throw Error('任务列表已变更，请重新开启离线模式')
      const task = await api.downloadTask(row.id)
      if (task.deviceCount && task.deviceTasks?.length !== task.deviceCount) throw Error('设备任务不完整，请重新开启离线模式')
      for (const entry of [task, ...task.deviceTasks || []]) {
        for (const id of [...entry.instructionAttachments || [], ...entry.results.flatMap(result => result.attachments)]) {
          if (files.has(id) || id.startsWith('local:')) continue
          if (!await cachedFile(scope, id)) await cacheFile(scope, id, await file(id))
          files.add(id)
        }
      }
      await cacheTask(scope, task); seen.add(row.id)
      progress('已缓存 ' + seen.size + ' / ' + page.total + ' 个任务')
    }
    if (seen.size >= page.total) { await setOfflineMode(scope); return }
  }
  throw Error('任务数量过多，离线模式尚未开启，请联系管理员')
}
