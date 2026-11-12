import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { facility } from '../api/facility'
import { state, canMessage } from '../services/session'

export const unreadMessages = ref(0)
const identity = () => [state.context?.tenantId, state.context?.applicationId, state.context?.userId, state.projectId].join(':')
let generation = 0
export async function refreshMessageBadge() {
  const ticket = ++generation, key = identity(), project = state.projectId
  if (!state.context || !project || !canMessage()) { unreadMessages.value = 0; return }
  if (!navigator.onLine) return
  const count = await facility.unreadMessages(project)
  // 切换账号、项目或更晚请求返回后，旧响应不得覆盖当前人的未读数。
  if (ticket === generation && key === identity()) unreadMessages.value = count
}
export function useMessageBadge() {
  const refresh = () => { if (document.visibilityState !== 'hidden') void refreshMessageBadge().catch(() => {}) }
  watch(identity, () => { generation++; unreadMessages.value = 0; refresh() }, { immediate: true })
  let timer: ReturnType<typeof setInterval>
  onMounted(() => {
    timer = setInterval(refresh, 15000)
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
  })
  onBeforeUnmount(() => {
    generation++; clearInterval(timer)
    window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh)
  })
  return unreadMessages
}
