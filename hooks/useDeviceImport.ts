import { feText } from '../shared/i18n'
import { computed, ref } from 'vue'
import { facility } from '../api'
import { messageOf, type Device } from '../shared/types'
import { createProfileWorkbook, readProfileWorkbook, type ProfileRow, type ProfileCheck, type ProfileReferences, type ProfilePerson, type ProfileSpace } from '../utils/deviceProfileWorkbook'

/** 下载、只读校验与确认导入分开；文件一变更就作废上一次校验。 */
export function useDeviceImport(getProject: () => string | undefined, changed: () => void) {
  const opened = ref(false), busy = ref(false), error = ref(''), notice = ref(''), file = ref<File>()
  const checks = ref<ProfileCheck[]>([]), rows = ref<ProfileRow[]>([]), validated = ref(false)
  const checkPassed = computed(() => validated.value && rows.value.length > 0 && checks.value.length === rows.value.length && checks.value.every(row => row.valid))
  const canSubmit = computed(() => checkPassed.value && !busy.value)
  const open = () => { opened.value = true; file.value = undefined; rows.value = []; checks.value = []; validated.value = false; error.value = ''; notice.value = '' }
  const close = () => { if (!busy.value) opened.value = false }
  const chooseFile = (value?: File) => {
    if (busy.value) return false
    file.value = undefined; rows.value = []; checks.value = []; validated.value = false; error.value = ''; notice.value = ''
    if (value && (!/\.xlsx$/i.test(value.name) || value.size > 5 * 1024 * 1024)) error.value = feText('profileBadFile')
    else file.value = value
    return false
  }
  const exportRows = async () => {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      const devices: Device[] = [], projectId = getProject()
      for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
        const result = await facility.devices({ pageIndex, pageSize: 200, sorts: [{ name: 'id', order: 'asc' }],
          terms: projectId ? [{ column: 'projectId', value: projectId }] : [] })
        if (result.total > 1000) throw Error(feText('narrowTheProjectSelectionBeforeExportingUpTo1000DevicesPer'))
        devices.push(...result.data)
        if (devices.length >= result.total) break
      }
      if (!devices.length) throw Error(feText('profileNoDevices'))
      const references: ProfileReferences[] = []
      for (const projectId of [...new Set(devices.map(device => device.projectId))]) {
        if (!projectId) throw Error(feText('profileNoDevices'))
        const [people, spaces] = await Promise.all([
          facility.options<ProfilePerson>('employee-accounts/' + encodeURIComponent(projectId)),
          facility.options<ProfileSpace>('spaces/' + encodeURIComponent(projectId))
        ])
        references.push({ projectId, projectName: devices.find(device => device.projectId === projectId)?.projectName || projectId, people, spaces })
      }
      const buffer = await createProfileWorkbook(devices, references)
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a'); link.href = url; link.download = feText('profileWorkbook'); link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  const validate = async () => {
    if (busy.value || !file.value) return
    busy.value = true; error.value = ''; checks.value = []; rows.value = []; validated.value = false
    try {
      const parsed = await readProfileWorkbook(await file.value.arrayBuffer())
      rows.value = parsed.rows
      // 本地错误也显示原文件行号；正确行继续服务端只读校验，不写入任何设备。
      const server = parsed.rows.length ? await facility.post<ProfileCheck[]>('devices/extensions/validate', parsed.rows) : []
      checks.value = [...parsed.checks, ...server.map(check => ({ ...check,
        deviceName: check.deviceName || String(parsed.rows.find(row => row.rowNumber === check.rowNumber)?.values.name || '') }))]
        .sort((a, b) => a.rowNumber - b.rowNumber)
      validated.value = true
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  const submit = async () => {
    if (!canSubmit.value) return
    busy.value = true; error.value = ''
    try {
      await facility.post('devices/extensions/import', rows.value)
      notice.value = feText('profileImported') + rows.value.length
      validated.value = false; file.value = undefined; rows.value = []; checks.value = []
      changed()
    } catch (e) { error.value = messageOf(e); validated.value = false }
    finally { busy.value = false }
  }
  return { opened, busy, error, notice, file, checks, validated, checkPassed, canSubmit, open, close, chooseFile, exportRows, validate, submit }
}
