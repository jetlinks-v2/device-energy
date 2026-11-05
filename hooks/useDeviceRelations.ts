import { ref, onMounted } from 'vue'
import { facility } from '../api'
import type { Entity, Task } from '../shared/types'
import { messageOf } from '../shared/types'
export function useDeviceRelations(deviceId: string) {
  const tasks = ref<Task[]>([]),
    faults = ref<Entity[]>([]),
    selected = ref<string>(),
    busy = ref(false),
    error = ref('')
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      const terms = [{ column: 'deviceId', value: deviceId }]
      const [work, issues] = await Promise.all([
        facility.query<Task>('tasks', { terms, pageSize: 200 }),
        facility.query('faults', { terms, pageSize: 200 })
      ])
      tasks.value = work.data
      faults.value = issues.data
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  onMounted(refresh)
  return {
    tasks,
    faults,
    selected,
    busy,
    error,
    refresh,
    close: () => {
      selected.value = undefined
      void refresh()
    }
  }
}
