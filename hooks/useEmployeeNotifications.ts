import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { facility } from '../api'
import { useBillingProject } from './useBillingProject'
import type { Entity, TaskMessage, Term } from '../shared/types'
import { messageOf } from '../shared/types'

export function useEmployeeNotifications() {
  const project = useBillingProject(), rows = ref<TaskMessage[]>([]), total = ref(0), page = ref(1), busy = ref(false), saving = ref(false), error = project.error
  const names = ref<Record<string, string>>({})
  const terms = ref<Term[]>([]), category = ref('all'), read = ref('all'), selected = ref<TaskMessage>(), settingsOpen = ref(false), policy = reactive<{ id?: string; projectId?: string; version?: number; taskEnabled: boolean; faultEnabled: boolean; alertEnabled: boolean }>({ taskEnabled: true, faultEnabled: true, alertEnabled: true })
  let generation = 0, policyGeneration = 0
  async function load() {
    const ticket = ++generation; rows.value = []; total.value = 0; selected.value = undefined
    if (!project.projectId.value) { busy.value = false; return }
    busy.value = true; error.value = ''
    try {
      const filters: Term[] = [{ column: 'projectId', value: project.projectId.value }, ...terms.value]
      if (category.value === 'task') filters.push({ column: 'taskId', termType: 'notnull', value: true })
      else if (category.value === 'fault') filters.push({ column: 'faultId', termType: 'notnull', value: true })
      else if (category.value === 'alert') filters.push({ column: 'alertId', termType: 'notnull', value: true })
      if (read.value === 'failed') filters.push({ column: 'state', value: 'failed' })
      else if (read.value !== 'all') filters.push({ column: 'readTime', termType: read.value === 'read' ? 'notnull' : 'isnull', value: true }, { column: 'state', value: 'generated' })
      const result = await facility.query<TaskMessage>('messages/records', { pageIndex: page.value - 1, pageSize: 12, terms: filters, sorts: [{ name: 'createTime', order: 'desc' }] })
      if (ticket === generation) { rows.value = result.data; total.value = result.total }
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  async function openSettings() {
    if (!project.projectId.value) return
    const ticket = ++policyGeneration; saving.value = true; error.value = ''
    try { const row = await facility.get<Entity>('messages/settings/' + project.projectId.value); if (ticket === policyGeneration) { Object.assign(policy, row); settingsOpen.value = true } }
    catch (cause) { if (ticket === policyGeneration) error.value = messageOf(cause) }
    finally { if (ticket === policyGeneration) saving.value = false }
  }
  async function saveSettings() {
    if (saving.value || !settingsOpen.value) return
    saving.value = true; error.value = ''
    try { await facility.post('messages/settings', policy); settingsOpen.value = false }
    catch (cause) { error.value = messageOf(cause) } finally { saving.value = false }
  }
  watch(() => [project.projectId.value, terms.value, category.value, read.value], () => { page.value = 1; settingsOpen.value = false; policyGeneration++; void load(); names.value = {}; const projectId = project.projectId.value; if (projectId) void facility.options<Entity>('employees/' + encodeURIComponent(projectId)).then(people => { if (projectId === project.projectId.value) names.value = Object.fromEntries(people.map(person => [person.id, String(person.name || '')])) }).catch(cause => { error.value = messageOf(cause) }) })
  watch(page, () => void load()); onBeforeUnmount(() => { generation++; policyGeneration++ })
  return { ...project, names, rows, total, page, busy, saving, error, terms, category, read, selected, settingsOpen, policy, load, openSettings, saveSettings }
}
