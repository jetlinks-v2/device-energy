import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { facility } from '../api'
import { useBillingProject } from './useBillingProject'
import { validateAlertRule, type AlertRule } from '../shared/alertRule'
import { messageOf, type Entity, type Option } from '../shared/types'
import { feText } from '../shared/i18n'

export function useAlertRules() {
  const project = useBillingProject(), rows = ref<AlertRule[]>([]), total = ref(0), page = ref(1), busy = ref(false), saving = ref(false), error = project.error, formError = ref(''), opened = ref(false)
  const people = ref<Option[]>([]), devices = ref<Option[]>([]), groups = ref<Option[]>([]), range = ref('project'), minutes = ref<number>(30)
  const cycles = ref<Option[]>([]), cyclesBusy = ref(false), cycleError = ref(false), timingMode = ref('uniform')
  const form = reactive<Partial<AlertRule>>({})
  let generation = 0, optionGeneration = 0, cycleGeneration = 0, editGeneration = 0
  async function load() {
    const ticket = ++generation; rows.value = []; total.value = 0
    if (!project.projectId.value) { busy.value = false; return }
    busy.value = true; error.value = ''
    try {
      const result = await facility.query<AlertRule>('rules', { pageIndex: page.value - 1, pageSize: 12, terms: [{ column: 'projectId', value: project.projectId.value }, { column: 'ruleType', termType: 'in', value: ['plan', 'overdue', 'dueSoon'] }], sorts: [{ name: 'createTime', order: 'desc' }] })
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
  async function loadCycles() {
    const ticket = ++cycleGeneration, currentProject = project.projectId.value
    cycles.value = []; cyclesBusy.value = true; cycleError.value = false
    try {
      const result = await facility.query<Entity>('cycles', { pageSize: 2000, terms: [
        { column: 'projectId', value: currentProject },
        ...(form.taskKind ? [{ column: 'kind', value: form.taskKind }] : []),
      ] })
      if (ticket !== cycleGeneration || currentProject !== project.projectId.value) return
      if (result.total > result.data.length) throw Error(feText('tooManyDevicesNarrowScope'))
      cycles.value = result.data.map(row => ({ value: row.id, label: row.name || row.id }))
      // 编辑时保留旧引用的名称；失效引用仍由服务端核验，不能悄悄改成全部周期。
      if (form.cycleId && !cycles.value.some(row => row.value === form.cycleId))
        cycles.value.push({ value: form.cycleId, label: feText('reminderHistoricalCycle') })
    } catch (cause) { if (ticket === cycleGeneration) { cycleError.value = true; formError.value = messageOf(cause) } }
    finally { if (ticket === cycleGeneration) cyclesBusy.value = false }
  }
  function changeKind() { form.cycleId = undefined; form.legacySchedule = undefined; timingMode.value = 'uniform'; void loadCycles() }
  function changeCycle() { form.legacySchedule = undefined; timingMode.value = 'uniform' }
  async function edit(row?: AlertRule) {
    const ticket = ++editGeneration
    Object.keys(form).forEach(key => delete form[key]); Object.assign(form, row || { projectId: project.projectId.value, ruleType: 'plan', threshold: 80, name: '', energyType: 'electricity', period: 'month', repeatHours: 24, enabled: true })
    range.value = row?.deviceId ? 'device' : row?.groupId ? 'group' : 'project'
    minutes.value = Number(form.staleAfterSeconds || 1800) / 60; formError.value = ''; opened.value = true
    timingMode.value = form.legacySchedule ? 'legacy' : 'uniform'
    if (form.ruleType !== 'plan') void loadCycles()
    const currentProject = project.projectId.value
    try {
      const [employees, groupRows] = await Promise.all([facility.options<Entity>('employees/' + encodeURIComponent(currentProject || '')), facility.query('groups', { pageSize: 2000, terms: [{ column: 'projectId', value: currentProject }] })])
      if (ticket !== editGeneration || !opened.value || currentProject !== project.projectId.value) return
      if (groupRows.total > groupRows.data.length) throw Error(feText('tooManyDevicesNarrowScope'))
      people.value = employees.map(person => ({ value: person.id, label: person.name || person.id })); groups.value = groupRows.data.map(group => ({ value: group.id, label: group.name || group.id }))
      await searchDevices()
    } catch (cause) { formError.value = messageOf(cause) }
  }
  function changeType(type: string) {
    form.threshold = type === 'plan' ? 80 : 1; form.criticalThreshold = undefined
    form.taskKind = undefined; form.cycleId = undefined; form.legacySchedule = undefined; timingMode.value = 'uniform'
    if (type === 'plan') range.value = 'project'
    if (type !== 'plan') void loadCycles()
  }
  async function save() {
    if (saving.value || form.ruleType !== 'plan' && (cyclesBusy.value || cycleError.value)) return
    if (form.ruleType === 'plan') range.value = 'project'
    const payload = { ...form, projectId: project.projectId.value, deviceId: range.value === 'device' ? form.deviceId : undefined, groupId: range.value === 'group' ? form.groupId : undefined, smsEnabled: false }
    if (form.ruleType === 'dueSoon') {
      payload.legacySchedule = timingMode.value === 'legacy' ? form.legacySchedule : null
      payload.staleAfterSeconds = payload.legacySchedule ? undefined : Math.round(minutes.value * 60)
    }
    if (!['plan', 'overdue', 'dueSoon'].includes(payload.ruleType || '') || !validateAlertRule(payload, range.value)) { formError.value = feText('ruleRequired'); return }
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
  watch(project.projectId, () => { cycleGeneration++; editGeneration++; optionGeneration++; cyclesBusy.value = false; page.value = 1; opened.value = false; void load() }); watch(page, () => void load())
  onBeforeUnmount(() => { generation++; optionGeneration++; cycleGeneration++; editGeneration++ })
  return { ...project, rows, total, page, busy, saving, error, opened, formError, people, devices, groups, range, minutes, cycles, cyclesBusy, timingMode, changeKind, changeCycle, form, load, edit, changeType, searchDevices, save, toggle }
}
