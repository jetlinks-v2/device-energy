import { feText } from '../shared/i18n'
import { clone } from '../shared/types'
import { ref, computed, onMounted } from 'vue'
import { facility } from '../api'
import type { Task, CheckResult, TaskProcess } from '../shared/types'
import { messageOf } from '../shared/types'
import { canExecute, taskActions } from '../shared/taskActions'
export function useTask(id: string, changed?: () => void) {
  const task = ref<Task>(),
    results = ref<CheckResult[]>([]),
    userId = ref(''),
    busy = ref(false),
    error = ref(''),
    comment = ref(''),
    pendingAction = ref(''),
    claimable = ref(false),
    history = ref<TaskProcess[]>([]), historyTotal = ref(0), historyPage = ref(1),
    historyBusy = ref(false), historyError = ref('')
  const loadHistory = async (page = 1) => {
    if (historyBusy.value) return
    historyBusy.value = true
    historyError.value = ''
    try {
      const result = await facility.taskHistory(id, page - 1)
      history.value = result.data
      historyTotal.value = result.total
      historyPage.value = page
    } catch (cause) { historyError.value = messageOf(cause) }
    finally { historyBusy.value = false }
  }
  const refresh = async () => {
    busy.value = true
    error.value = ''
    claimable.value = false
    try {
      const [row, context] = await Promise.all([facility.task(id), facility.context()])
      task.value = row
      userId.value = context.userId
      if (row.state === 'open') claimable.value = await facility.canClaimTask(id)
      void loadHistory()
      results.value = clone(row.results || [])
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const action = async (name: string) => {
    if (!task.value || busy.value) return
    if (name === 'reject' && !comment.value.trim()) { error.value = feText('enterRectificationReason'); return }
    busy.value = true
    error.value = ''
    try {
      await facility.action(id, name, {
        version: task.value.version,
        comment: comment.value
      })
      changed?.()
      pendingAction.value = ''
      comment.value = ''
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const requestAction = (name: string) => {
    if (busy.value) return
    comment.value = ''
    error.value = ''
    if (['approve', 'reject'].includes(name)) pendingAction.value = name
    else void action(name)
  }
  const submit = async () => {
    if (!task.value || busy.value) return
    busy.value = true
    error.value = ''
    try {
      await facility.action(id, 'submit', {
        version: task.value.version,
        results: results.value,
        submissionId: crypto.randomUUID()
      })
      changed?.()
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const photo = async (itemId: string, file: File) => {
    busy.value = true
    try {
      if (!task.value) return
      const uploaded = await facility.upload(file, task.value.projectId)
      const row = results.value.find((r) => r.itemId === itemId)
      if (row) row.attachments.push(uploaded.id)
      else results.value.push({ itemId, value: '', abnormal: false, attachments: [uploaded.id] })
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const draft = () => {
    error.value = feText('draftSavedOnThisPageUseTheStaffMobileAppForOffline')
  }
  const actions = computed(() => (task.value ? taskActions(task.value, userId.value, claimable.value) : [])),
    executable = computed(() => !!task.value && canExecute(task.value, userId.value))
  onMounted(() => void refresh())
  return {
    task,
    results,
    userId,
    busy,
    error,
    comment,
    pendingAction,
    requestAction,
    history, historyTotal, historyPage, historyBusy, historyError, loadHistory,
    actions,
    executable,
    refresh,
    action,
    submit,
    photo,
    draft
  }
}
