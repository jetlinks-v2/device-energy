import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import type { Entity, OwnerMeter } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useOwnerHome() {
  const meters = ref<OwnerMeter[]>([]), messages = ref<Entity[]>([]), error = ref(''), busy = ref(false)
  async function load() {
    busy.value = true; error.value = ''
    try { [meters.value, messages.value] = await Promise.all([facility.meters(), facility.messages()]) }
    catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  onMounted(() => void load())
  return { meters, messages, error, busy, load }
}
