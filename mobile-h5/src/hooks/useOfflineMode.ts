import { ref } from 'vue'
import { state } from '../services/session'
import { facility, downloadFile } from '../api/facility'
import { prepareOfflineMode } from '../services/offlineMode'
import { cacheSummary, clearOfflineData } from '../services/offline'
import { clearTaskScanAccess } from '../services/taskScanAccess'
import { clone, messageOf } from '../../../shared/types'

export function useOfflineMode() {
  const confirming = ref(false), progress = ref(''), error = ref(''), notice = ref('')
  const summary = ref({ tasks: 0, pending: 0, drafts: 0 })
  async function toggle() {
    if (!state.context || state.offlineBusy) return
    error.value = ''; notice.value = ''
    if (state.offlineMode) {
      try { summary.value = await cacheSummary(state.context); confirming.value = true }
      catch (e) { error.value = messageOf(e) }
      return
    }
    if (!navigator.onLine) { error.value = '请先连接网络，再开启离线模式缓存任务'; return }
    const scope = clone(state.context)
    state.offlineBusy = true; progress.value = '正在缓存已接单任务'
    try {
      await prepareOfflineMode(scope, facility, downloadFile, value => { progress.value = value })
      if (state.context?.userId !== scope.userId || state.context?.applicationId !== scope.applicationId || state.context?.tenantId !== scope.tenantId) throw Error('账号已切换，请重新开启离线模式')
      state.offlineMode = true; notice.value = '离线模式已开启'
    } catch (e) { error.value = '离线模式尚未开启：' + messageOf(e) }
    finally { state.offlineBusy = false; progress.value = '' }
  }
  async function close() {
    if (!state.context || state.offlineBusy) return
    state.offlineBusy = true; error.value = ''
    try {
      await clearOfflineData(clone(state.context))
      clearTaskScanAccess(); state.offlineMode = false; confirming.value = false; notice.value = '离线模式已关闭，缓存已清空'
    } catch (e) { error.value = messageOf(e) }
    finally { state.offlineBusy = false }
  }
  return { confirming, progress, error, notice, summary, toggle, close }
}
