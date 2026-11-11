import { computed, ref, watch, type Ref } from 'vue'
import { meterApi } from '../api/meterBilling'
import { messageOf, type Query, type Term } from '../shared/types'
import type { TableHandle } from '../shared/tableQuery'
import type { MeterDetailTarget } from '../shared/meterBilling'

export function useMeterBillLedger(project: Ref<string | undefined>) {
  const terms = ref<Term[]>([]), table = ref<TableHandle>(), error = ref(''), reviewing = ref(false), detail = ref<MeterDetailTarget>()
  const params = computed(() => ({ project: project.value, terms: terms.value }))
  let sequence = 0
  watch(project, () => { sequence++; terms.value = []; error.value = ''; detail.value = undefined; reviewing.value = false })
  const request = async (query: Query) => {
    const current = sequence, id = project.value
    if (!id) return { success: true, result: { data: [], total: 0, pageSize: 20, pageIndex: 0 } }
    error.value = ''
    try {
      const result = await meterApi.ledger(id, query)
      return { success: true, result: current === sequence ? result : { ...result, data: [], total: 0 } }
    } catch (cause) { if (current === sequence) error.value = messageOf(cause); throw cause }
  }
  const filter = (value: Term[]) => { terms.value = value }
  const refresh = () => table.value?.reload()
  return { terms, table, error, reviewing, detail, params, request, filter, refresh }
}
