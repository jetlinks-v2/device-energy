import { feText } from '../shared/i18n'
import { clone } from '../shared/types'
import { ref, computed, onMounted } from 'vue'
import { facility } from '../api'
import type { Task, CheckResult, Entity, Option } from '../shared/types'
import { messageOf } from '../shared/types'
import { canExecute, taskActions } from '../shared/taskActions'
export function useTask(id: string) {
  const task = ref<Task>(),
    results = ref<CheckResult[]>([]),
    userId = ref(''),
    busy = ref(false),
    error = ref(''),
    comment = ref(''),
    transferUser = ref<string>(),
    employees = ref<Option[]>([])
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      const [row, context, people] = await Promise.all([
        facility.task(id),
        facility.context(),
        facility.options('employees')
      ])
      task.value = row
      userId.value = context.userId
      employees.value = people.map((p) => ({ value: p.id, label: p.name || p.id }))
      results.value = clone(row.state === 'external-submitted' ? row.followResults || [] : row.results || [])
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const action = async (name: string) => {
    if (!task.value) return
    busy.value = true
    error.value = ''
    try {
      await facility.action(id, name, {
        version: task.value.version,
        comment: comment.value,
        userId: transferUser.value
      })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const submit = async () => {
    if (!task.value) return
    busy.value = true
    try {
      await facility.action(id, task.value.state === 'external-submitted' ? 'follow' : 'submit', {
        version: task.value.version,
        results: results.value,
        submissionId: crypto.randomUUID()
      })
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
  const actions = computed(() => (task.value ? taskActions(task.value, userId.value) : [])),
    executable = computed(() => !!task.value && canExecute(task.value, userId.value))
  onMounted(() => void refresh())
  return {
    task,
    results,
    userId,
    busy,
    error,
    comment,
    transferUser,
    employees,
    actions,
    executable,
    refresh,
    action,
    submit,
    photo,
    draft
  }
}
