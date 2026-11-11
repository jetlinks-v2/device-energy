import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Query, type Term } from '../shared/types'
import type { TableHandle } from '../shared/tableQuery'
import type { MeterMonthlyBill, MeterReviewAction, MeterReviewOutcome } from '../shared/meterBilling'
import { meterBillQuery, type MeterEnergyFilter } from '../shared/meterBillQuery'

export function useMeterBillReview(project: string, changed: () => void) {
  const status = ref('pending'), terms = ref<Term[]>([]), table = ref<TableHandle>(), selected = ref<MeterMonthlyBill[]>([])
  const busy = ref(false), error = ref(''), outcomes = ref<MeterReviewOutcome[]>([]), action = ref<MeterReviewAction>()
  const targets = ref<MeterMonthlyBill[]>([]), comment = ref('')
  const energy = ref<MeterEnergyFilter>('all')
  let sequence = 0
  const params = computed(() => ({ terms: terms.value, state: status.value, energy: energy.value }))
  const request = async (query: Query) => {
    const current = ++sequence
    selected.value = []; error.value = ''
    try {
      const result = await meterApi.reviews(project, status.value, meterBillQuery(query, energy.value, 'meterType'))
      return { success: true, result: current === sequence ? result : { ...result, data: [], total: 0 } }
    }
    catch (cause) { if (current === sequence) error.value = messageOf(cause); throw cause }
  }
  const filter = (value: Term[]) => { selected.value = []; terms.value = value }
  const changeStatus = (value: unknown) => {
    if (busy.value || action.value || typeof value !== 'string') return
    sequence++; selected.value = []; outcomes.value = []; status.value = value
  }
  const changeEnergy = (value: MeterEnergyFilter) => {
    if (busy.value || action.value) return
    sequence++; selected.value = []; outcomes.value = []; energy.value = value; error.value = ''
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
      if (outcomes.value.length && outcomes.value.every(row => row.success)) {
        message.success(`${feText('approvalSucceeded')} ${outcomes.value.length}`, 3)
      }
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
  return { status, table, selected, busy, error, outcomes, action, targets, comment, energy, changeEnergy, params, request, filter, changeStatus, start, confirm, selection }
}
