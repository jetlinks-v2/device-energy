import { ref, watch, computed } from 'vue'
import { facility } from '../api/facility'
import { state, can } from '../services/session'
import { canExecute } from '../../../shared/taskActions'
import type { Task, TaskAssignee, TaskProcess } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
import { m } from '../services/mobileText'
export function useTaskOperations(task: () => Task | undefined, reload: () => Promise<void>) {
  const history = ref<TaskProcess[]>([]), total = ref(0), historyBusy = ref(false), historyError = ref('')
  const action = ref(''), people = ref<TaskAssignee[]>([]), userId = ref<string>(), comment = ref(''), busy = ref(false), error = ref('')
  let page = 0, historyGeneration = 0
  const reviewable = computed(() => !!task() && !task()!.parentTaskId && can('review') && task()!.reviewerId === state.context?.userId && ['review', 'external-submitted'].includes(task()!.state))
  const transferable = computed(() => !!task() && !task()!.parentTaskId && !!state.context?.userId && can('dispatch') && canExecute(task()!, state.context.userId))
  const allowed = (value: string) => value === 'transfer' ? transferable.value : ['approve', 'reject'].includes(value) && reviewable.value
  async function loadHistory(more = false) {
    const current = task()
    // 接单、转单及审批属于整项任务；单设备页只展示要求、结果和照片。
    if (!current || current.parentTaskId || (!navigator.onLine || state.offlineMode) || historyBusy.value && more) return
    const ticket = ++historyGeneration, next = more ? page + 1 : 0
    historyBusy.value = true; historyError.value = ''
    if (!more) history.value = []
    try {
      const result = await facility.taskHistory(current.id, next)
      if (ticket !== historyGeneration) return
      history.value = more ? [...history.value, ...result.data] : result.data
      total.value = result.total; page = next
    } catch (e) { if (ticket === historyGeneration) historyError.value = messageOf(e) }
    finally { if (ticket === historyGeneration) historyBusy.value = false }
  }
  async function open(value: string) {
    if ((!navigator.onLine || state.offlineMode) || busy.value || !allowed(value)) return
    action.value = value; comment.value = ''; userId.value = undefined; people.value = []; error.value = ''
    if (value !== 'transfer' || !task()) return
    busy.value = true
    try { people.value = (await facility.taskAssignees(task()!.id)).filter(p => p.id !== task()!.assigneeId) }
    catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  async function confirm() {
    const row = task()
    if (!row || busy.value || !action.value || !navigator.onLine) return
    if (!allowed(action.value)) { error.value = m('任务状态或处理人已变更，请重新打开任务', 'Task status or assignee changed. Reopen the task'); return }
    if (action.value === 'transfer' && !userId.value) { error.value = m('请选择接单人', 'Select an assignee'); return }
    if (action.value === 'reject' && !comment.value.trim()) { error.value = m('请填写原因', 'Enter a reason'); return }
    busy.value = true; error.value = ''
    try {
      await facility.action(row.id, action.value, { version: row.version, userId: userId.value, comment: comment.value.trim() })
      action.value = ''; await reload()
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  watch(() => [task()?.id, task()?.version], () => void loadHistory())
  return { history, total, historyBusy, historyError, loadHistory, reviewable, transferable, action, people, userId, comment, busy, error, open, confirm }
}
