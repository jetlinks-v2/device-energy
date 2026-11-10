import type { Task } from '../../../shared/types'

/** 扫码只能定位当前执行任务的设备快照，不扩大到其他时隙或任务配置。 */
export function taskScanResult(code: string, applicationId: string, taskId?: string, devices: Task[] = [], expected?: { type: 'group' | 'device'; deviceId?: string }) {
  let parsed: { type?: string; id?: string; applicationId?: string }
  try { parsed = JSON.parse(code) } catch { throw Error('二维码内容无效，请重新扫描') }
  if (!parsed || !['facility-device', 'facility-group'].includes(parsed.type || '') ||
    parsed.applicationId !== applicationId || typeof parsed.id !== 'string' || !parsed.id)
    throw Error('请扫描当前应用的设备或设备组二维码')
  if (expected && parsed.type !== 'facility-' + expected.type)
    throw Error(expected.type === 'group' ? '请扫描当前任务的设备组二维码' : '请扫描当前设备的二维码')
  if (expected?.deviceId && parsed.id !== expected.deviceId) throw Error('设备二维码不匹配，请扫描当前设备')
  if (!taskId) return { target: (parsed.type === 'facility-group' ? '/groups/' : '/device/') + encodeURIComponent(parsed.id), rows: [], groupId: '' }
  const rows = devices.filter(row => row.parentTaskId === taskId && (parsed.type === 'facility-device'
    ? row.deviceId === parsed.id : row.groupIds?.includes(parsed.id!)))
  if (!rows.length) throw Error('该设备或设备组不在当前任务内，请重新扫描')
  const groupId = parsed.type === 'facility-group' ? parsed.id : ''
  return { target: groupId ? '/tasks/' + encodeURIComponent(taskId) + '?groupId=' + encodeURIComponent(groupId)
    : '/tasks/' + encodeURIComponent(rows[0]!.id), rows, groupId }
}

export const taskScanTarget = (...args: Parameters<typeof taskScanResult>) => taskScanResult(...args).target
