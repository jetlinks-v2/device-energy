import { computed, ref } from 'vue'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { resourceQuery, type TableHandle } from '../shared/tableQuery'
import { messageOf, type Query, type Task, type Term } from '../shared/types'

type Decision = 'approve' | 'reject'
type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'all'
interface Outcome { id: string; name: string; success: boolean; error?: string }

/** Every selected task uses the existing versioned review transaction; partial failures stay visible. */
export function useTaskReview(kind: string | undefined, changed: () => void) {
  const table = ref<TableHandle>(), selected = ref<Task[]>([]), terms = ref<Term[]>([]), status = ref<ReviewStatus>('pending'),
    busy = ref(false), error = ref(''), decision = ref<Decision>(), targets = ref<Task[]>([]),
    comment = ref(''), outcomes = ref<Outcome[]>([]), progress = ref(0)
  const params = computed(() => ({ terms: terms.value }))
  const request = async (query: Query) => {
    selected.value = []
    error.value = ''
    try {
      // The server appends the authenticated reviewer and pending states before task asset filtering/paging.
      const result = await facility.taskReviews(resourceQuery(query, kind), status.value)
      return { success: true, result }
    } catch (cause) {
      error.value = messageOf(cause)
      throw cause
    }
  }
  const filter = (value: Term[]) => { if (!busy.value) { selected.value = []; terms.value = value } }
  const refresh = () => { selected.value = []; table.value?.reload() }
  const changeStatus = (value: unknown) => {
    if (busy.value || decision.value) return
    if (value !== 'pending' && value !== 'approved' && value !== 'rejected' && value !== 'all') return
    status.value = value
    selected.value = []; outcomes.value = []; error.value = ''
  }
  const selection = computed(() => ({
    selectedRowKeys: selected.value.map(row => row.id),
    preserveSelectedRowKeys: false,
    onChange: (_keys: unknown[], rows: Task[]) => { if (!busy.value) selected.value = rows },
    getCheckboxProps: () => ({ disabled: busy.value })
  }))
  const start = (action: Decision, rows = selected.value) => {
    if (busy.value || status.value !== 'pending') return
    if (!rows.length || rows.length > 100) { error.value = feText('selectReviewTasks'); return }
    targets.value = rows.map(row => ({ ...row }))
    decision.value = action
    comment.value = ''
    error.value = ''
  }
  const confirm = async () => {
    if (busy.value || !decision.value || !targets.value.length) return
    if (decision.value === 'reject' && !comment.value.trim()) {
      error.value = feText('enterRectificationReason'); return
    }
    busy.value = true
    error.value = ''
    outcomes.value = []
    progress.value = 0
    const action = decision.value, note = comment.value.trim(), rows = [...targets.value]
    try {
      // Bound concurrency to one: each item's CAS/permissions and failure are independent, without flooding the service.
      for (const row of rows) {
        try {
          await facility.action(row.id, action, { version: row.version, comment: note })
          outcomes.value.push({ id: row.id, name: row.name || row.deviceName, success: true })
        } catch (cause) {
          outcomes.value.push({ id: row.id, name: row.name || row.deviceName, success: false, error: messageOf(cause) })
        }
        progress.value++
      }
      decision.value = undefined
      if (outcomes.value.some(row => row.success)) changed()
      refresh()
    } finally { busy.value = false }
  }
  return { table, selected, params, selection, status, busy, error, decision, targets, comment, outcomes, progress,
    request, filter, refresh, changeStatus, start, confirm }
}
