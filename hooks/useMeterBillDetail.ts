import { computed, onMounted, ref } from 'vue'
import { meterApi } from '../api/meterBilling'
import { messageOf } from '../shared/types'
import { feText } from '../shared/i18n'
import type { MeterBillResult, MeterDetailTarget, MeterMonthlyBill, MeterReviewLog } from '../shared/meterBilling'

export function useMeterBillDetail(target: MeterDetailTarget, changed: () => void) {
  const loading = ref(false), busy = ref(false), error = ref(''), logsError = ref(''), row = ref<MeterMonthlyBill>()
  const result = ref<MeterBillResult>(), logs = ref<MeterReviewLog[]>([]), editing = ref(false)
  const receivableDate = ref(''), dueDate = ref('')
  const editable = computed(() => !target.published && !!row.value && ['pending', 'rejected', 'error'].includes(row.value.state))
  const load = async () => {
    loading.value = true; error.value = ''; logsError.value = ''
    try {
      if (target.published) result.value = (await meterApi.published(target.projectId, target.id)).result
      else {
        row.value = await meterApi.detail(target.id); result.value = row.value.result
        try { logs.value = (await meterApi.logs(target.id, { pageSize: 50, sorts: [{ name: 'createTime', order: 'desc' }] })).data }
        catch (cause) { logsError.value = messageOf(cause) }
      }
      receivableDate.value = row.value?.receivableDate || result.value?.detail?.receivableDate || ''
      dueDate.value = row.value?.dueDate || result.value?.detail?.dueDate || ''
    } catch (cause) { error.value = messageOf(cause) }
    finally { loading.value = false }
  }
  const saveDates = async () => {
    if (busy.value || !editable.value || !row.value) return
    if (!receivableDate.value || !dueDate.value || dueDate.value < receivableDate.value) { error.value = feText('billingDatesRequired'); return }
    busy.value = true; error.value = ''
    try {
      const outcomes = await meterApi.review('recalculate', [{ id: row.value.id, version: row.value.version, receivableDate: receivableDate.value, dueDate: dueDate.value }])
      if (!outcomes[0]?.success) { error.value = outcomes[0]?.error || feText('requestFailed'); return }
      editing.value = false; changed(); await load()
    } catch (cause) { error.value = messageOf(cause) }
    finally { busy.value = false }
  }
  onMounted(load)
  return { loading, busy, error, logsError, row, result, logs, editing, editable, receivableDate, dueDate, saveDates }
}
