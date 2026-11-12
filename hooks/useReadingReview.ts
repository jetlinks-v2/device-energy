import { computed, onMounted, ref } from 'vue'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { messageOf, type Query, type Reading, type Term } from '../shared/types'
import type { TableHandle } from '../shared/tableQuery'

type Status = 'pending' | 'accepted' | 'rejected' | 'resubmitted' | 'all'
/** 补录来源和快捷状态与用户搜索取交集，不将自动采集记录混入补录审核。 */
export function useReadingReview(changed: () => void, mine = false) {
  const status = ref<Status>(mine ? 'all' : 'pending'), terms = ref<Term[]>([]), table = ref<TableHandle>(),
    error = ref(''), contextError = ref(''), busy = ref(false), userId = ref(''), target = ref<Reading>(), approve = ref(true), success = ref('')
  const params = computed(() => ({ terms: terms.value }))
  let sequence = 0
  const loadContext = async () => {
    try { userId.value = (await facility.context()).userId; contextError.value = '' }
    catch (cause) { userId.value = ''; contextError.value = messageOf(cause) }
  }
  onMounted(loadContext)
  const canReview = (row: Reading) => !mine && !!userId.value && row.source === 'manual' && row.status === 'pending' && row.creatorId !== userId.value
  const canEdit = (row: Reading) => mine && !!userId.value && row.source === 'manual' && row.status === 'rejected' && row.creatorId === userId.value
  const request = async (query: Query) => {
    const token = ++sequence
    error.value = ''
    try {
      const result = await facility.query<Reading>('energy/readings', { ...query, terms: [
        { column: 'source', value: 'manual' },
        ...(status.value === 'all' ? [] : [{ column: 'status', value: status.value }]),
        ...(query.terms?.length ? [{ type: 'and', terms: query.terms }] : [])
      ] }, mine ? '?mine=true' : '')
      return { success: true, result }
    } catch (cause) { if (token === sequence) error.value = messageOf(cause); throw cause }
  }
  const filter = (value: Term[]) => { if (!busy.value && !target.value) terms.value = value }
  const changeStatus = (value: unknown) => {
    if (busy.value || target.value || !['pending', 'accepted', 'rejected', 'all', ...(mine ? ['resubmitted'] : [])].includes(String(value))) return
    status.value = value as Status; success.value = ''; error.value = ''; sequence++
  }
  const start = (row: Reading, pass: boolean) => {
    if (busy.value || !canReview(row)) return
    target.value = { ...row }; approve.value = pass; error.value = ''
  }
  const confirm = async () => {
    if (busy.value || !target.value || !canReview(target.value)) return
    busy.value = true; error.value = ''; success.value = ''
    try {
      await facility.reviewReading(target.value, approve.value)
      target.value = undefined; success.value = feText('readingReviewed')
      changed(); table.value?.reload()
    } catch (cause) { error.value = messageOf(cause) }
    finally { busy.value = false }
  }
  return { status, params, table, error, contextError, busy, target, approve, success, userId,
    request, filter, changeStatus, start, confirm, canReview, canEdit, loadContext }
}
