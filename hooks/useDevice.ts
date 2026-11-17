import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { feText } from '../shared/i18n'
import { facility } from '../api'
import { deviceFields } from '../shared/resources'
import type { Device, Entity, FormValues, FormValue, Option } from '../shared/types'
import { messageOf } from '../shared/types'
/** 单设备档案及操作历史的组合状态。 */
export function useDevice(input: Device) {
  const device = ref<Device>(input),
    busy = ref(false),
    error = ref(''),
    form = reactive<FormValues>({}),
    options = reactive<Record<string, Option[]>>({}),
    history = ref<Entity[]>([])
  const fields = deviceFields
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      device.value = await facility.read<Device>('devices', input.id)
      Object.assign(form, device.value)
      form.workEnabled = !!(device.value.inspectionEnabled || device.value.maintenanceEnabled)
      options.employees = []
      const [people, spaces, logs] = await Promise.all([
        device.value.projectId ? facility.options('employees/' + encodeURIComponent(device.value.projectId)) : Promise.resolve([]),
        facility.options('spaces/' + device.value.projectId),
        facility.get<{ data: Entity[] }>('devices/' + input.id + '/history')
      ])
      options.employees = people.map((p) => ({ value: p.id, label: p.name || p.id }))
      // 空间目录已经按项目和权限裁剪；保留父级 ID，由 TreeSelect 组装层级。
      options.spaces = spaces.map((p) => ({ value: p.id, label: p.name || p.id, parentId: typeof p.parentId === 'string' ? p.parentId : undefined }))
      history.value = logs.data
      return true
    } catch (e) {
      error.value = messageOf(e)
      return false
    } finally {
      busy.value = false
    }
  }
  const change = (key: string, value: FormValue) => {
    form[key] = value
  }
  const save = async () => {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (typeof form.responsibleUserId !== 'string' || !form.responsibleUserId.trim()) throw Error(feText('profileResponsibleRequired'))
      const { workEnabled, ...values } = form
      // Both legacy columns now represent one switch; explicit false must clear both.
      await facility.updateDevice({ ...device.value, ...values,
        inspectionEnabled: !!workEnabled, maintenanceEnabled: !!workEnabled })
      // 更新成功与刷新失败分开反馈，避免把已保存的数据误报成保存失败。
      if (await refresh()) message.success(feText('profileSaved'))
      else message.warning(feText('profileSavedRefreshFailed') + error.value)
    } catch (e) {
      error.value = messageOf(e)
      message.error(error.value)
    } finally {
      busy.value = false
    }
  }
  const qr = computed(() =>
    JSON.stringify({ type: 'facility-device', applicationId: device.value.applicationId, id: device.value.id })
  )
  onMounted(() => void refresh())
  return {
    device,
    form,
    fields,
    options,
    history,
    busy,
    error,
    qr,
    refresh,
    change,
    save
  }
}
