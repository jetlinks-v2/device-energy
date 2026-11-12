import { ref, watch, onBeforeUnmount } from 'vue'
import { useBillingProject } from './useBillingProject'
import { useOperationRoute } from './useOperationRoute'
import { facility } from '../api'
import type { FacilityAlert } from '../shared/alerts'
import { messageOf, type TaskProcess, type Term } from '../shared/types'

export function useAlertCenter() {
  const project = useBillingProject(), rows = ref<FacilityAlert[]>([]), selected = ref<FacilityAlert>()
  const scope = ref('device'), handling = ref('all'), historyMode = ref(false), terms = ref<Term[]>([])
  const busy = ref(false), detailBusy = ref(false), actionBusy = ref(false), error = project.error, comment = ref(''), action = ref('')
  const total = ref(0), page = ref(1), history = ref<FacilityAlert[]>([]), processes = ref<TaskProcess[]>([]), historyTotal = ref(0), historyPage = ref(1)
  const processTotal = ref(0), processPage = ref(1)
  let generation = 0, detailGeneration = 0
  async function load() { await loadRequested() }
  async function loadRequested(requested?: FacilityAlert) {
    const ticket = ++generation; detailGeneration++; selected.value = undefined; detailBusy.value = false; rows.value = []; total.value = 0
    if (!project.projectId.value) { busy.value = false; return }
    busy.value = true; error.value = ''
    try {
      const filters: Term[] = [{ column: 'projectId', value: project.projectId.value }, ...terms.value]
      if (handling.value !== 'all') filters.push(handling.value === 'open' ? { terms: [{ column: 'processingState', value: 'open' }, { column: 'processingState', termType: 'isnull', type: 'or', value: true }] } : { column: 'processingState', value: handling.value })
      const path = historyMode.value ? 'alerts/history' : scope.value === 'plan' ? 'alerts/plans' : 'alerts'
      const result = await facility.query<FacilityAlert>(path, { pageIndex: page.value - 1, pageSize: 12, terms: filters, sorts: [{ name: 'lastTime', order: 'desc' }, { name: 'id', order: 'desc' }] })
      if (ticket !== generation) return
      rows.value = result.data; total.value = result.total
      if (requested) await select(requested)
      else if (result.data[0]) void select(result.data[0])
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  async function select(row: FacilityAlert, nextPage = 1, nextProcessPage = 1) {
    const ticket = ++detailGeneration; selected.value = row; detailBusy.value = true; history.value = []; processes.value = []; historyTotal.value = 0
    try {
      const [current, rounds, logs] = await Promise.all([facility.read<FacilityAlert>('alerts', row.id), facility.get<{ data: FacilityAlert[]; total: number }>('alerts/' + row.id + '/history?pageIndex=' + (nextPage - 1)), facility.get<{ data: TaskProcess[]; total: number }>('alerts/' + row.id + '/processes?pageIndex=' + (nextProcessPage - 1))])
      if (ticket !== detailGeneration) return
      selected.value = current; history.value = rounds.data; historyTotal.value = rounds.total; historyPage.value = nextPage; processes.value = logs.data
      processTotal.value = logs.total; processPage.value = nextProcessPage
    } catch (cause) { if (ticket === detailGeneration) error.value = messageOf(cause) }
    finally { if (ticket === detailGeneration) detailBusy.value = false }
  }
  async function handle() {
    const row = selected.value, value = action.value
    if (!row || !value || actionBusy.value || value === 'closed' && !comment.value.trim()) return
    actionBusy.value = true; error.value = ''
    try {
      await facility.post('alerts/' + row.id + '/handle', { version: row.version, state: value, comment: comment.value.trim() })
      action.value = ''; comment.value = ''; await load()
    } catch (cause) { error.value = messageOf(cause) }
    finally { actionBusy.value = false }
  }
  const routing = useOperationRoute<FacilityAlert>({ ...project, read: id => facility.read<FacilityAlert>('alerts', id),
    invalidate: () => { generation++; detailGeneration++; selected.value = undefined; rows.value = []; busy.value = false; detailBusy.value = false },
    prepare: row => { page.value = 1; scope.value = row.targetId ? 'plan' : 'device'; historyMode.value = false; handling.value = 'all'; terms.value = [] }, load: loadRequested })
  watch(() => [project.projectId.value, scope.value, handling.value, terms.value, historyMode.value], () => { if (!routing.value) { page.value = 1; void load() } })
  watch(page, () => { if (!routing.value) void load() })
  onBeforeUnmount(() => { generation++; detailGeneration++ })
  return { ...project, rows, selected, scope, handling, historyMode, terms, busy, detailBusy, actionBusy, error, comment, action, total, page, history, processes, historyTotal, historyPage, processTotal, processPage, load, select, handle }
}
