import { computed, ref } from 'vue'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Query, type Term } from '../shared/types'
import type { TableHandle } from '../shared/tableQuery'
import type { MeterMonthlyBill, MeterReviewAction, MeterReviewOutcome } from '../shared/meterBilling'

export function useMeterBillReview(project: string, changed: () => void) {
  const status = ref('pending'), terms = ref<Term[]>([]), table = ref<TableHandle>(), selected = ref<MeterMonthlyBill[]>([])
  const busy = ref(false), error = ref(''), outcomes = ref<MeterReviewOutcome[]>([]), action = ref<MeterReviewAction>()
  const targets = ref<MeterMonthlyBill[]>([]), comment = ref('')
  const params = computed(() => ({ terms: terms.value, state: status.value }))
  const request = async (query: Query) => {
    selected.value = []; error.value = ''
    try { return { success: true, result: await meterApi.reviews(project, status.value, query) } }
    catch (cause) { error.value = messageOf(cause); throw cause }
  }
  const filter = (value: Term[]) => { selected.value = []; terms.value = value }
  const changeStatus = (value: unknown) => {
    if (busy.value || action.value || typeof value !== 'string') return
    selected.value = []; outcomes.value = []; status.value = value
  }
  const start = (value: MeterReviewAction, rows = selected.value) => {
    if (busy.value || !rows.length || rows.length > 100) return
    action.value = value; targets.value = rows.map(row => ({ ...row })); comment.value = ''; error.value = ''
  }
  const confirm = async () => {
    if (busy.value || !action.value) return
    if (action.value === 'reject' && !comment.value.trim()) { error.value = feText('meterReasonRequired'); return }
    busy.value = true; error.value = ''
    try {
      outcomes.value = await meterApi.review(action.value, targets.value.map(row => ({ id: row.id, version: row.version, comment: comment.value.trim() })))
      action.value = undefined; selected.value = []; table.value?.reload()
      if (outcomes.value.some(row => row.success)) changed()
    } catch (cause) { error.value = messageOf(cause) }
    finally { busy.value = false }
  }
  const selection = computed(() => ({
    selectedRowKeys: selected.value.map(row => row.id), preserveSelectedRowKeys: false,
    onChange: (_keys: unknown[], rows: MeterMonthlyBill[]) => { if (!busy.value) selected.value = rows },
    getCheckboxProps: (row: MeterMonthlyBill) => ({ disabled: busy.value || row.state !== 'pending' })
  }))
  return { status, table, selected, busy, error, outcomes, action, targets, comment, params, request, filter, changeStatus, start, confirm, selection }
}
