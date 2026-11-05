import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import type { Entity, Task } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useScannedGroup(id: string) {
  const group = ref<Entity>(),
    tasks = ref<Task[]>([]),
    busy = ref(false),
    error = ref('')
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      const row = await facility.read<Entity>('groups', id)
      group.value = row
      const devices = row.deviceIds as string[] | undefined
      tasks.value = devices?.length
        ? (
            await facility.tasks({
              pageSize: 200,
              terms: [
                { column: 'deviceId', termType: 'in', value: devices },
                { column: 'projectId', value: row.projectId }
              ]
            })
          ).data
        : []
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  onMounted(refresh)
  return { group, tasks, busy, error, refresh }
}
