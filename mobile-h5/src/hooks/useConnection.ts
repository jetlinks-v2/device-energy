import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { state } from '../services/session'
/** 业务模式与物理网络分开：本机作业即使联网也不自动上传，同步页仍可联网。 */
export function useConnection(work = false) {
  const online = ref(navigator.onLine)
  const update = () => { online.value = navigator.onLine }
  onMounted(() => { window.addEventListener('online', update); window.addEventListener('offline', update) })
  onBeforeUnmount(() => { window.removeEventListener('online', update); window.removeEventListener('offline', update) })
  return computed(() => online.value && (!work || !state.offlineMode))
}
