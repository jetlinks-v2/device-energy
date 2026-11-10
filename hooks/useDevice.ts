import { feText } from '../shared/i18n'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { facility } from '../api'
import { deviceFields } from '../shared/resources'
import type { Device, Entity, FormValues, FormValue, Option, Reading } from '../shared/types'
import { messageOf } from '../shared/types'
/** 单设备资料、物模型、客户关系与历史数据的组合状态。 */
export function useDevice(input: Device) {
  const device = ref<Device>(input),
    busy = ref(false),
    error = ref(''),
    form = reactive<FormValues>({}),
    options = reactive<Record<string, Option[]>>({}),
    mapping = ref<Entity>(),
    bindings = ref<Entity[]>([]),
    history = ref<Entity[]>([]),
    series = ref<Reading[]>([]),
    property = ref(''),
    usage = ref<{ value: number; complete: boolean }>(),
    from = ref(Date.now() - 86400000),
    to = ref(Date.now()),
    binding = reactive({
      customerId: '',
      spaceId: '',
      contacts: [] as { telephone: string; name: string; smsEnabled: boolean; portalEnabled: boolean }[]
    }),
    manual = reactive({ value: 0, reason: '', observedTime: Date.now() }),
    selectedProject = ref<string>()
  const fields = deviceFields
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      device.value = await facility.read<Device>('devices', input.id)
      Object.assign(form, device.value)
      const [people, spaces, linked, mapped, logs] = await Promise.all([
        facility.options('employees'),
        facility.options('spaces/' + device.value.projectId),
        facility.get<Entity[]>('devices/' + input.id + '/bindings'),
        facility.get<Entity | undefined>('devices/' + input.id + '/mapping'),
        facility.get<{ data: Entity[] }>('devices/' + input.id + '/history')
      ])
      options.employees = people.map((p) => ({ value: p.id, label: p.name || p.id }))
      // 空间目录已经按项目和权限裁剪；保留父级 ID，由 TreeSelect 组装层级。
      options.spaces = spaces.map((p) => ({ value: p.id, label: p.name || p.id, parentId: typeof p.parentId === 'string' ? p.parentId : undefined }))
      bindings.value = linked
      mapping.value = mapped
      history.value = logs.data
      if (mapped?.metrics) {
        options.properties = (mapped.metrics as { propertyId: string; name: string }[]).map((m) => ({
          value: m.propertyId,
          label: m.name || m.propertyId
        }))
        if (!property.value) property.value = options.properties[0]?.value || ''
      }
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
      await facility.updateDevice({ ...device.value, ...form })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
      busy.value = false
    }
  }
  const loadSeries = async () => {
    if (!property.value) return
    busy.value = true
    error.value = ''
    try {
      series.value = await facility.series(input.id, property.value, from.value, to.value)
      const metric = (mapping.value?.metrics as { propertyId: string; kind: string }[] | undefined)?.find(
        (m) => m.propertyId === property.value
      )
      usage.value =
        metric && ['counter', 'increment'].includes(metric.kind)
          ? await facility.usage(input.id, property.value, from.value, to.value)
          : undefined
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const bind = async () => {
    busy.value = true
    error.value = ''
    try {
      await facility.post('devices/' + input.id + '/bindings', { ...binding, version: device.value.version })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
      busy.value = false
    }
  }
  const endBinding = async () => {
    busy.value = true
    try {
      await facility.post('devices/' + input.id + '/bindings/end', {
        version: device.value.version,
        reason: feText('endResponsibleCustomerRelationship')
      })
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
      busy.value = false
    }
  }
  const supplement = async () => {
    busy.value = true
    try {
      await facility.post('energy/readings/' + input.id, { ...manual, propertyId: property.value })
      error.value = ''
      await loadSeries()
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
  watch(
    () => binding.spaceId,
    async (key) => {
      options.customers = []
      binding.customerId = ''
      if (key)
        try {
          const customers = await facility.options(
            'customers/' + device.value.projectId + '?spaceId=' + encodeURIComponent(key)
          )
          options.customers = customers.map((c) => ({ value: c.id, label: c.name || c.id }))
        } catch (e) {
          error.value = messageOf(e)
        }
    }
  )
  const qr = computed(() =>
    JSON.stringify({ type: 'facility-device', applicationId: device.value.applicationId, id: device.value.id })
  )
  onMounted(() => void refresh())
  return {
    device,
    form,
    fields,
    options,
    bindings,
    history,
    mapping,
    series,
    property,
    usage,
    from,
    to,
    binding,
    manual,
    busy,
    error,
    selectedProject,
    qr,
    refresh,
    change,
    save,
    loadSeries,
    bind,
    endBinding,
    supplement,
    confirmProject
  }
}
