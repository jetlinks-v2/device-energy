import { ref, watch, onBeforeUnmount } from 'vue'
import type { Task } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
import { facility } from '../api/facility'
import { state } from '../services/session'
import { projectsReady } from './useProjects'
import { cachedTasks } from '../services/offline'
import { taskQuery, matchesTask, type TaskFilter } from '../services/taskQuery'
import { useConnection } from './useConnection'
import { m } from '../services/mobileText'
export type ListMode = 'mine' | 'pool' | 'review' | 'dispatch' | 'offline' | 'device'
export function useTaskList(filters: () => TaskFilter, mode: () => ListMode, review: () => 'pending' | 'approved' | 'rejected' | 'all' = () => 'pending') {
  const rows = ref<Task[]>([]), total = ref(0), busy = ref(false), error = ref(''), online = useConnection(true)
  let page = 0, generation = 0
  const load = async (more = false) => {
    if (more && busy.value) return
    const filter = filters()
    if (!state.context || !projectsReady.value || !filter.projectId) {
      generation++; rows.value = []; total.value = 0; busy.value = false; error.value = ''
      return
    }
    const ticket = ++generation, next = more ? page + 1 : 0
    busy.value = true; error.value = ''
    if (!more) { rows.value = []; total.value = 0 }
    try {
      const query = taskQuery(filter, next)
      if (!online.value || mode() === 'offline') {
        if (!['mine', 'offline'].includes(mode())) throw Error(m('联网后可查看此列表', 'Connect to view this list'))
        const all = (await cachedTasks(state.context)).filter(t => !t.parentTaskId && t.assigneeId === state.context?.userId && matchesTask(t, filter))
          .sort((a, b) => b.scheduledTime - a.scheduledTime || a.id.localeCompare(b.id))
        if (ticket !== generation) return
        total.value = all.length
        const current = all.slice(next * 20, (next + 1) * 20)
        rows.value = more ? [...rows.value, ...current] : current
      } else {
        const result = mode() === 'review' ? await facility.taskReviews(query, review()) : await facility.tasks(query, mode() === 'mine', mode() === 'pool')
        if (ticket !== generation) return
        total.value = result.total
        rows.value = more ? [...rows.value, ...result.data.filter(t => !rows.value.some(r => r.id === t.id))] : result.data
      }
      page = next
    } catch (e) { if (ticket === generation) error.value = messageOf(e) }
    finally { if (ticket === generation) busy.value = false }
  }
  watch(() => [filters(), mode(), review(), projectsReady.value, online.value], () => void load(), { deep: true, immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { rows, total, busy, error, online, load }
}
