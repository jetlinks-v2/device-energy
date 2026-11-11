import { ref, computed, watch, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Query } from '../shared/types'
import type { MeterBillRow, BillingPeriod } from '../shared/meterBilling'
import type { TableHandle } from '../shared/tableQuery'
/** Preview locks the chosen period. Changing any field invalidates selection and all confirmation fingerprints. */
export function useMeterBillPreview(projectId: Ref<string | undefined>) {
  const month = ref<string>(), receivableDate = ref<string>(), dueDate = ref<string>(), period = ref<BillingPeriod>()
  const selected = ref<string[]>([]), selectedRows = ref<MeterBillRow[]>([]), table = ref<TableHandle>()
  const error = ref(''), generating = ref(false), revision = ref(0), results = ref<MeterBillRow[]>([])
  const params = computed(() => ({ period: period.value, revision: revision.value }))
  let sequence = 0
  watch([projectId, month, receivableDate, dueDate], () => {
    ++sequence; period.value = undefined; selected.value = []; selectedRows.value = []; results.value = []; error.value = ''
  })
  const request = async (query: Query) => {
    const current = sequence
    if (!period.value) return { success: true, result: { data: [], total: 0, pageIndex: 0, pageSize: 20 } }
    const page = await meterApi.preview({ ...period.value, query })
    if (current !== sequence) return { success: true, result: { ...page, data: [], total: 0 } }
    return { success: true, result: page }
  }
  const preview = () => {
    if (!projectId.value || !month.value || !receivableDate.value || !dueDate.value || dueDate.value < receivableDate.value) {
      message.warning(feText('billingDatesRequired')); return
    }
    ++sequence; selected.value = []; selectedRows.value = []; results.value = []; error.value = ''
    period.value = { projectId: projectId.value, month: month.value, receivableDate: receivableDate.value, dueDate: dueDate.value }
    revision.value++
  }
  const generate = () => {
    if (!period.value || !selectedRows.value.length) { message.warning(feText('billingSelection')); return }
    const snapshot = { ...period.value }, rows = [...selectedRows.value], current = sequence
    Modal.confirm({ title: feText('confirmGenerate'), onOk: async () => {
      if (current !== sequence) return
      generating.value = true; error.value = ''
      try {
        const reply = await meterApi.generate(rows.filter(row => row.result && !row.error && !row.result.billId).map(row => ({
          deviceId: row.id, month: snapshot.month, receivableDate: snapshot.receivableDate, dueDate: snapshot.dueDate,
          fingerprint: row.result!.fingerprint
        })))
        if (current !== sequence) return
        results.value = reply; selected.value = []; selectedRows.value = []; table.value?.reload()
        message.info(feText('billGenerationDone'))
      } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
      finally { generating.value = false }
    } })
  }
  return { month, receivableDate, dueDate, selected, selectedRows, table, error, generating, results, params, request, preview, generate }
}
