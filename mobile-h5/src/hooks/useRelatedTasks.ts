import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import type { Entity, Task } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useRelatedTasks(type: 'devices' | 'groups', id: string) {
  const entity = ref<Entity>(), tasks = ref<Task[]>([]), total = ref(0), busy = ref(false), error = ref('')
  let page = 0
  async function load(more = false) {
    if (busy.value) return
    busy.value = true; error.value = ''
    if (!more) { tasks.value = []; total.value = 0 }
    try {
      const row = more && entity.value ? entity.value : await facility.read<Entity>(type, id)
      entity.value = row
      const devices = type === 'devices' ? [row.id] : row.deviceIds as string[] || []
      if (!devices.length) return
      const next = more ? page + 1 : 0
      const result = await facility.relatedTasks({ pageSize: 20, pageIndex: next, sorts: [{ name: 'scheduledTime', order: 'desc' }], terms: [{ column: 'deviceId', termType: 'in', value: devices }, { column: 'projectId', value: row.projectId }] })
      tasks.value = more ? [...tasks.value, ...result.data] : result.data
      total.value = result.total; page = next
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  onMounted(() => void load())
  return { entity, tasks, total, busy, error, load }
}
