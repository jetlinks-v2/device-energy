import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { state, can } from '../services/session'
import { messageOf } from '../../../shared/types'
import { m } from '../services/mobileText'
import { facility } from '../api/facility'
import { cachedTask } from '../services/offline'
import { taskScanResult } from '../services/taskScan'
import { issueTaskScanAccess } from '../services/taskScanAccess'
import { canExecute } from '../../../shared/taskActions'
export function useScanRoute() {
  const code = ref(''), error = ref(''), busy = ref(false), router = useRouter(), route = useRoute()
  const taskId = typeof route.query.taskId === 'string' ? route.query.taskId : undefined
  const deviceId = typeof route.query.deviceId === 'string' ? route.query.deviceId : undefined
  const title = taskId && !deviceId ? '扫描设备组二维码' : '扫描设备二维码'
  async function scan(value = code.value) {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      if (!taskId) { await router.push(taskScanResult(value, state.session?.applicationId || '').target); return }
      const scope = state.context
      if (!scope || !can('save')) throw Error('没有执行此任务的权限')
      const connected = navigator.onLine && !state.offlineMode
      const parent = connected ? await facility.task(taskId) : await cachedTask(scope, taskId)
      if (!parent || !canExecute(parent, scope.userId)) throw Error('任务状态或接单人已变更，请返回任务详情')
      const devices = parent.deviceCount ? connected ? await facility.taskDevices(taskId) : parent.deviceTasks || []
        : [{ ...parent, parentTaskId: taskId }]
      if (parent.deviceCount && devices.length !== parent.deviceCount) throw Error('设备任务不完整，请联网后重新下载')
      const result = taskScanResult(value, scope.applicationId, taskId, devices,
        deviceId ? { type: 'device', deviceId } : { type: 'group' })
      const rows = parent.deviceCount ? result.rows : [parent]
      const scan = issueTaskScanAccess(scope, rows, result.groupId)
      await router.replace({ path: result.target.split('?')[0], query: { scan, ...(result.groupId ? { groupId: result.groupId } : {}) } })
    } catch (e) { error.value = e instanceof SyntaxError ? m('二维码内容无效，请重新扫描', 'Invalid QR code. Scan again') : messageOf(e) }
    finally { busy.value = false }
  }
  return { code, error, busy, scan, title, taskId }
}
