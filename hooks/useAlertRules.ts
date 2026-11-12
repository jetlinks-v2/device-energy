import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { facility } from '../api'
import { useBillingProject } from './useBillingProject'
import { ruleNeedsMetric, validateAlertRule, type AlertRule } from '../shared/alertRule'
import { messageOf, type Entity, type Option } from '../shared/types'
import { feText } from '../shared/i18n'

export function useAlertRules() {
  const project = useBillingProject(), rows = ref<AlertRule[]>([]), total = ref(0), page = ref(1), busy = ref(false), saving = ref(false), error = project.error, formError = ref(''), opened = ref(false)
  const people = ref<Option[]>([]), devices = ref<Option[]>([]), groups = ref<Option[]>([]), properties = ref<Option[]>([]), range = ref('project'), referenceDevice = ref<string>(), minutes = ref<number>(30)
  const form = reactive<Partial<AlertRule>>({}), metric = computed(() => ruleNeedsMetric(form.ruleType || ''))
  let generation = 0, optionGeneration = 0, propertyGeneration = 0
  async function load() {
    const ticket = ++generation; rows.value = []; total.value = 0
    if (!project.projectId.value) { busy.value = false; return }
    busy.value = true; error.value = ''
    try {
      const result = await facility.query<AlertRule>('rules', { pageIndex: page.value - 1, pageSize: 12, terms: [{ column: 'projectId', value: project.projectId.value }], sorts: [{ name: 'createTime', order: 'desc' }] })
      if (ticket === generation) { rows.value = result.data; total.value = result.total }
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  async function searchDevices(search = '') {
    const ticket = ++optionGeneration
    if (!project.projectId.value) return
    try {
      const result = await facility.devices({ pageSize: 50, terms: [{ column: 'projectId', value: project.projectId.value }, ...(search ? [{ column: 'name', termType: 'like', value: search }] : [])] })
      if (ticket === optionGeneration) devices.value = result.data.map(row => ({ value: row.id, label: row.name || row.sourceName }))
    } catch (cause) { if (ticket === optionGeneration) formError.value = messageOf(cause) }
  }
  async function edit(row?: AlertRule) {
    Object.keys(form).forEach(key => delete form[key]); Object.assign(form, row || { projectId: project.projectId.value, ruleType: 'offline', threshold: 1800, name: '', energyType: 'electricity', period: 'month', repeatHours: 24, enabled: true })
    range.value = row?.deviceId ? 'device' : row?.groupId ? 'group' : 'project'; referenceDevice.value = row?.deviceId
    minutes.value = Number(form.threshold || 1800) / 60; properties.value = []; formError.value = ''; opened.value = true
    const currentProject = project.projectId.value
    try {
      const [employees, groupRows] = await Promise.all([facility.options<Entity>('employees/' + encodeURIComponent(currentProject || '')), facility.query('groups', { pageSize: 2000, terms: [{ column: 'projectId', value: currentProject }] })])
      if (!opened.value || currentProject !== project.projectId.value) return
      if (groupRows.total > groupRows.data.length) throw Error(feText('tooManyDevicesNarrowScope'))
      people.value = employees.map(person => ({ value: person.id, label: person.name || person.id })); groups.value = groupRows.data.map(group => ({ value: group.id, label: group.name || group.id }))
      await searchDevices()
    } catch (cause) { formError.value = messageOf(cause) }
  }
  watch(() => [referenceDevice.value, form.energyType], async () => {
    const ticket = ++propertyGeneration, deviceId = referenceDevice.value; properties.value = []
    if (!deviceId || !opened.value) return
    try {
      const [metadata, mapping] = await Promise.all([facility.get<{ properties?: { id: string; name: string }[] }>('devices/' + deviceId + '/metadata'), facility.get<{ metrics?: { propertyId: string }[]; energyType?: string }>('devices/' + deviceId + '/mapping')])
      const allowed = new Set(mapping?.energyType === form.energyType ? (mapping.metrics || []).map(item => item.propertyId) : [])
      if (ticket === propertyGeneration) properties.value = (metadata.properties || []).filter(item => allowed.has(item.id)).map(item => ({ value: item.id, label: item.name || item.id }))
    } catch (cause) { if (ticket === propertyGeneration) formError.value = messageOf(cause) }
  })
  watch(() => form.deviceId, value => { if (range.value === 'device') referenceDevice.value = value })
  watch(() => form.ruleType, () => { if (form.ruleType === 'state' || form.ruleType === 'reading-anomaly') form.threshold = 1 })
  async function save() {
    if (saving.value) return
    if (form.ruleType === 'plan') range.value = 'project'
    const payload = { ...form, projectId: project.projectId.value, deviceId: range.value === 'device' ? form.deviceId : undefined, groupId: range.value === 'group' ? form.groupId : undefined, smsEnabled: false }
    if (['offline', 'stale'].includes(form.ruleType || '')) payload.threshold = minutes.value * 60
    if (['balance', 'instant', 'state'].includes(form.ruleType || '')) payload.staleAfterSeconds = form.staleAfterSeconds || 3600
    if (!validateAlertRule(payload, range.value)) { formError.value = feText('ruleRequired'); return }
    saving.value = true; formError.value = ''
    try { await facility.save('rules', payload); opened.value = false; await load() }
    catch (cause) { formError.value = messageOf(cause) }
    finally { saving.value = false }
  }
  async function toggle(row: AlertRule) {
    if (saving.value) return
    saving.value = true; error.value = ''
    try { await facility.save('rules', { ...row, enabled: !row.enabled, smsEnabled: false }); await load() }
    catch (cause) { error.value = messageOf(cause) } finally { saving.value = false }
  }
  watch(project.projectId, () => { page.value = 1; opened.value = false; void load() }); watch(page, () => void load())
  onBeforeUnmount(() => { generation++; optionGeneration++; propertyGeneration++ })
  return { ...project, rows, total, page, busy, saving, error, opened, formError, people, devices, groups, properties, range, referenceDevice, minutes, form, metric, load, edit, searchDevices, save, toggle }
}
