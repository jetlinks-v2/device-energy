import { onMounted, ref } from 'vue'
import { facility } from '../api'
import { canTransfer } from '../shared/taskActions'
import { messageOf, type Option, type Task } from '../shared/types'
import { feText } from '../shared/i18n'

/** Candidates are scoped by the persisted task, never by client-provided organization IDs. */
export function useTaskDispatch(id: string) {
  const task = ref<Task>(), options = ref<Option[]>([]), userId = ref<string>(),
    busy = ref(false), error = ref('')
  const load = async () => {
    busy.value = true
    error.value = ''
    options.value = []
    userId.value = undefined
    try {
      task.value = await facility.task(id)
      if (!canTransfer(task.value)) throw Error(feText('taskCannotBeDispatched'))
      const people = await facility.taskAssignees(id)
      // A transfer requires an explicit new recipient; never silently keep the current assignee.
      options.value = people.filter(person => person.id !== task.value?.assigneeId)
        .map(person => ({ value: person.id, label: person.name }))
    } catch (cause) {
      error.value = messageOf(cause)
    } finally { busy.value = false }
  }
  const save = async (): Promise<boolean> => {
    if (busy.value || !task.value || !canTransfer(task.value)) return false
    if (!userId.value || !options.value.some(person => person.value === userId.value)) {
      error.value = feText('selectTaskAssignee')
      return false
    }
    busy.value = true
    error.value = ''
    try {
      await facility.action(id, 'transfer', { version: task.value.version, userId: userId.value })
      return true
    } catch (cause) {
      error.value = messageOf(cause)
      return false
    } finally { busy.value = false }
  }
  onMounted(() => void load())
  return { task, options, userId, busy, error, load, save }
}
