import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import type { OwnerDetail } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useOwnerMeter(id: string) {
  const detail = ref<OwnerDetail>(),
    busy = ref(false),
    error = ref(''),
    from = ref(Date.now() - 30 * 86400000),
    to = ref(Date.now())
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      detail.value = await facility.ownerDetail(id, from.value, to.value)
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  onMounted(() => void refresh())
  return { detail, busy, error, from, to, refresh }
}
