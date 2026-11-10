import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { facility } from '../api/facility'
import { state } from '../services/session'
import { cachedTasks, cacheTask } from '../services/offline'
import type { Task } from '../../../shared/types'
import { clone, messageOf } from '../../../shared/types'

export function useTaskDevices(task: () => Task | undefined) {
  const route = useRoute(), rows = ref<Task[]>([]), busy = ref(false), error = ref('')
  let generation = 0
  async function load() {
    const parent = task(), ticket = ++generation
    rows.value = []; error.value = ''
    if (!parent?.deviceCount) { busy.value = false; return }
    busy.value = true
    try {
      const devices = navigator.onLine && !state.offlineMode ? await facility.taskDevices(parent.id)
        : state.context ? (await cachedTasks(state.context)).filter(row => row.parentTaskId === parent.id) : undefined
      if (!devices || devices.length !== parent.deviceCount) throw Error('设备任务不完整，请联网后重新下载')
      if (ticket !== generation) return
      rows.value = devices
      if (state.context && navigator.onLine && !state.offlineMode) await cacheTask(state.context, clone({ ...parent, deviceTasks: devices }))
    } catch (e) { if (ticket === generation) error.value = messageOf(e) }
    finally { if (ticket === generation) busy.value = false }
  }
  const groupId = computed(() => typeof route.query.groupId === 'string' ? route.query.groupId : '')
  const visible = computed(() => rows.value.filter(row => !groupId.value || row.groupIds?.includes(groupId.value)))
  watch(() => [task()?.id, task()?.version], () => void load(), { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { rows, visible, busy, error, load, groupId }
}
