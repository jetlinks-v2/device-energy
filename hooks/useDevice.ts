import { ref, reactive, computed, onMounted } from 'vue'
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
    history = ref<Entity[]>([]),
    selectedProject = ref<string>()
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
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const change = (key: string, value: FormValue) => {
    form[key] = value
  }
  const save = async () => {
    busy.value = true
    try {
      const { workEnabled, ...values } = form
      // Both legacy columns now represent one switch; explicit false must clear both.
      await facility.updateDevice({ ...device.value, ...values,
        inspectionEnabled: !!workEnabled, maintenanceEnabled: !!workEnabled })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
      busy.value = false
    }
  }
  const confirmProject = async () => {
    if (!selectedProject.value) return
    try {
      await facility.post('devices/' + input.id + '/project', {
        projectId: selectedProject.value,
        version: device.value.version
      })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
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
    selectedProject,
    qr,
    refresh,
    change,
    save,
    confirmProject
  }
}
