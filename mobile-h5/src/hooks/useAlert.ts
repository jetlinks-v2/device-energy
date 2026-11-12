import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { facility } from '../api/facility'
import { state } from '../services/session'
import { useConnection } from './useConnection'
import { messageOf } from '../../../shared/types'
import type { FacilityAlert } from '../../../shared/alerts'

/** 预警仅在线只读，切换项目和账号时丢弃旧请求。 */
export function useAlert() {
  const route = useRoute(), online = useConnection(), row = ref<FacilityAlert>()
  const busy = ref(false), error = ref('')
  let generation = 0
  async function load() {
    const ticket = ++generation
    row.value = undefined; error.value = ''; busy.value = false
    if (!online.value) { error.value = '当前无网络，联网后查看预警详情'; return }
    if (!state.authorization?.permissions.some(p => p.id === 'facility-alert' && p.actions.includes('query'))) { error.value = '暂无预警查看权限，请联系管理员'; return }
    busy.value = true
    try {
      const result = await facility.read<FacilityAlert>('alerts', String(route.params.id))
      if (ticket !== generation) return
      row.value = result
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  watch(() => [route.params.id, state.context?.tenantId, state.context?.applicationId, state.context?.userId, state.projectId, online.value], () => void load(), { immediate: true })
  onBeforeUnmount(() => generation++)
  return { row, busy, error, load }
}
