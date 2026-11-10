import { ref, watch, onBeforeUnmount } from 'vue'
import { facility } from '../api/facility'
import { state, can } from '../services/session'
import { projectsReady } from './useProjects'
import { taskQuery, matchesTask } from '../services/taskQuery'
import * as offline from '../services/offline'
import type { Task } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
import { useConnection } from './useConnection'
export function useWorkspace() {
  const tasks = ref<Task[]>([]), counts = ref<(number | undefined)[]>([]), pending = ref(0)
  const busy = ref(false), error = ref(''), online = useConnection(true)
  let generation = 0
  async function refresh() {
    if (!state.context || !projectsReady.value || !state.projectId || !can('query')) {
      generation++; tasks.value = []; counts.value = []; busy.value = false; error.value = ''; pending.value = 0
      return
    }
    const ticket = ++generation, filter = { projectId: state.projectId }
    busy.value = true; error.value = ''; counts.value = []; tasks.value = []
    try {
      pending.value = (await offline.entries(state.context)).filter(e => e.state !== 'submitted').length
      if (!online.value) {
        const cached = (await offline.cachedTasks(state.context)).filter(t => !t.parentTaskId && t.assigneeId === state.context?.userId && matchesTask(t, { ...filter, status: 'active' }))
        if (ticket === generation) { tasks.value = cached.slice(0, 3); counts.value = [cached.length, cached.filter(t => t.deadline < Date.now()).length] }
        return
      }
      const result = await Promise.allSettled([
        facility.tasks({ ...taskQuery({ ...filter, status: 'active' }), pageSize: 1 }, true),
        facility.tasks({ ...taskQuery({ ...filter, status: 'overdue' }), pageSize: 1 }, true),
        can('review') ? facility.taskReviews({ ...taskQuery(filter), pageSize: 1 }) : Promise.resolve(undefined),
        facility.tasks({ ...taskQuery({ ...filter, status: 'active' }), pageSize: 3 }, true)
      ])
      if (ticket !== generation) return
      counts.value = result.slice(0, 3).map(r => r.status === 'fulfilled' ? r.value?.total : undefined)
      const list = result[3]
      if (list.status === 'fulfilled') tasks.value = list.value?.data || []
      const failed = result.find(r => r.status === 'rejected')
      if (failed?.status === 'rejected') error.value = messageOf(failed.reason)
    } catch (e) { if (ticket === generation) error.value = messageOf(e) }
    finally { if (ticket === generation) busy.value = false }
  }
  watch(() => [state.projectId, projectsReady.value, online.value], () => void refresh(), { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { tasks, counts, pending, busy, error, online, refresh }
}
