import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store'
import { facility } from '../api'
import { useBillingProject } from './useBillingProject'
import { useOperationRoute } from './useOperationRoute'
import { faultActions, type Fault } from '../shared/faults'
import { messageOf, type Entity, type Option, type TaskProcess, type Term } from '../shared/types'
import { feText } from '../shared/i18n'

export function useFaults(followRoute = true) {
  const project = useBillingProject(), auth = useAuthStore()
  const rows = ref<Fault[]>([]), total = ref(0), page = ref(1), busy = ref(false), error = project.error
  const status = ref('all'), mine = ref(false), overdue = ref(false), terms = ref<Term[]>([]), actor = ref('')
  const selected = ref<Fault>(), history = ref<TaskProcess[]>([]), historyTotal = ref(0), historyPage = ref(1), detailBusy = ref(false)
  const action = ref(''), actionBusy = ref(false), actionError = ref(''), people = ref<Option[]>([]), devices = ref<Option[]>([])
  const form = reactive({ deviceId: '', name: '', description: '', priority: 'normal', category: 'other', deadline: undefined as number | undefined, sourceType: 'manual', sourceId: undefined as string | undefined,
    reviewerId: '', assigneeId: undefined as string | undefined, comment: '', userId: undefined as string | undefined, attachments: [] as string[] })
  let generation = 0, detailGeneration = 0, peopleGeneration = 0, deviceGeneration = 0
  const permission = (value: string) => 'facility/Faults:' + (['dispatch', 'transfer', 'reviewer'].includes(value) ? 'dispatch' : ['approve', 'reject'].includes(value) ? 'review' : value === 'close' ? 'close' : 'save')
  const actions = computed(() => selected.value ? faultActions(selected.value, actor.value).filter(value => auth.hasPermission(permission(value))) : [])
  const canDispatch = computed(() => auth.hasPermission('facility/Faults:dispatch'))
  async function load() { await loadRequested() }
  async function loadRequested(requested?: Fault) {
    const ticket = ++generation; rows.value = []; total.value = 0; selected.value = undefined; detailGeneration++
    if (!project.projectId.value) { busy.value = false; detailBusy.value = false; return }
    busy.value = true; error.value = ''
    try {
      const filters: Term[] = [{ column: 'projectId', value: project.projectId.value }, ...terms.value]
      if (status.value !== 'all') filters.push({ column: 'state', value: status.value })
      if (overdue.value) filters.push({ column: 'deadline', termType: 'lt', value: Date.now() }, { column: 'state', termType: 'nin', value: ['closed', 'cancelled'] })
      const result = await facility.query<Fault>('faults', { pageIndex: page.value - 1, pageSize: 12, terms: filters, sorts: [{ name: 'createTime', order: 'desc' }] }, '?mine=' + mine.value)
      if (ticket !== generation) return
      rows.value = result.data; total.value = result.total
      if (requested) await select(requested)
      else if (result.data[0]) void select(result.data[0])
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  async function select(row: Fault, nextPage = 1) {
    const ticket = ++detailGeneration; selected.value = row; history.value = []; historyTotal.value = 0; detailBusy.value = true
    try {
      const [current, records] = await Promise.all([facility.fault(row.id), facility.faultHistory(row.id, nextPage - 1)])
      if (ticket !== detailGeneration) return
      selected.value = current; history.value = records.data; historyTotal.value = records.total; historyPage.value = nextPage
    } catch (cause) { if (ticket === detailGeneration) error.value = messageOf(cause) }
    finally { if (ticket === detailGeneration) detailBusy.value = false }
  }
  async function searchDevices(search = '') {
    const ticket = ++deviceGeneration
    if (!project.projectId.value) return
    try {
      const result = await facility.devices({ pageSize: 50, terms: [{ column: 'projectId', value: project.projectId.value }, ...(search ? [{ column: 'name', termType: 'like', value: search }] : [])] })
      if (ticket === deviceGeneration) devices.value = result.data.map(row => ({ value: row.id, label: String(row.name || row.sourceName) }))
    } catch (cause) { if (ticket === deviceGeneration) actionError.value = messageOf(cause) }
  }
  async function open(value: string, source?: { deviceId: string; sourceType: string; sourceId: string; description?: string }) {
    if (actionBusy.value || value !== 'create' && !actions.value.includes(value)) return
    action.value = value; actionError.value = ''; people.value = []
    Object.assign(form, { deviceId: '', name: '', description: '', priority: 'normal', category: 'other', deadline: undefined, sourceType: 'manual', sourceId: undefined,
      reviewerId: actor.value, assigneeId: undefined, comment: '', userId: undefined, attachments: [] })
    if (source) Object.assign(form, source)
    const ticket = ++peopleGeneration
    if (!['create', 'dispatch', 'transfer', 'reviewer'].includes(value) || !project.projectId.value) return
    actionBusy.value = true
    try {
      const persons = await facility.options<Entity>('employees/' + encodeURIComponent(project.projectId.value))
      if (ticket !== peopleGeneration) return
      people.value = persons.map(person => ({ value: person.id, label: String(person.name || person.id) }))
      if (value === 'create') await searchDevices()
    } catch (cause) { if (ticket === peopleGeneration) actionError.value = messageOf(cause) }
    finally { if (ticket === peopleGeneration) actionBusy.value = false }
  }
  async function confirm() {
    if (actionBusy.value || !action.value) return
    const value = action.value, target = selected.value
    actionError.value = ''
    if (value === 'create' && (!form.deviceId || !form.description.trim() || !form.reviewerId || !form.deadline || form.deadline <= Date.now())) { actionError.value = feText('faultCompleteRequired'); return }
    if (['dispatch', 'transfer', 'reviewer'].includes(value) && !form.userId) { actionError.value = feText('faultSelectAssignee'); return }
    if (['resolve', 'reject', 'transfer', 'reviewer', 'close'].includes(value) && !form.comment.trim()) { actionError.value = feText('faultReasonRequired'); return }
    actionBusy.value = true
    try {
      if (value === 'create') await facility.save<Fault>('faults', form)
      else if (target) await facility.faultAction(target.id, value, { version: target.version, comment: form.comment.trim(), userId: form.userId, attachments: form.attachments })
      action.value = ''; await load()
    } catch (cause) { actionError.value = messageOf(cause) }
    finally { actionBusy.value = false }
  }
  const routing = useOperationRoute<Fault>({ ...project, enabled: followRoute, read: facility.fault,
    invalidate: () => { generation++; detailGeneration++; selected.value = undefined; rows.value = []; busy.value = false; detailBusy.value = false },
    prepare: () => { page.value = 1; status.value = 'all'; mine.value = false; overdue.value = false; terms.value = [] }, load: loadRequested })
  watch(() => [project.projectId.value, status.value, mine.value, overdue.value, terms.value], () => { if (!routing.value) { page.value = 1; void load() } })
  watch(project.projectId, () => { action.value = ''; peopleGeneration++; deviceGeneration++; people.value = []; devices.value = []; actionBusy.value = false })
  watch(page, () => { if (!routing.value) void load() })
  onMounted(async () => { try { actor.value = (await facility.context()).userId } catch (cause) { error.value = messageOf(cause) } })
  onBeforeUnmount(() => { generation++; detailGeneration++; peopleGeneration++; deviceGeneration++ })
  return { ...project, rows, total, page, busy, error, status, mine, overdue, terms, selected, history, historyTotal, historyPage,
    detailBusy, actions, canDispatch, action, actionBusy, actionError, people, devices, form, permission, open, confirm, load, select, searchDevices }
}
