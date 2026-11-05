import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import type { Device, Task } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useScannedDevice(id: string) {
  const device = ref<Device>(),
    tasks = ref<Task[]>([]),
    busy = ref(false),
    error = ref('')
  onMounted(async () => {
    busy.value = true
    try {
      device.value = await facility.read<Device>('devices', id)
      tasks.value = (await facility.tasks({ terms: [{ column: 'deviceId', value: id }] })).data
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  })
  return { device, tasks, busy, error }
}
