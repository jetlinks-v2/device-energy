import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { facility } from '../api/facility'
import { state } from '../services/session'
import { useConnection } from './useConnection'
import { faultActions, type Fault } from '../../../shared/faults'
import { messageOf, type TaskProcess, type Term } from '../../../shared/types'

export const canFault = (action: string) => !!state.authorization?.permissions.find(p => p.id === 'facility-fault')?.actions.includes(action)
export function useFaultWork() {
  const route = useRoute(), online = useConnection(), rows = ref<Fault[]>([]), selected = ref<Fault>()
  const historyTotal = ref(0), historyBusy = ref(false)
  const history = ref<TaskProcess[]>([]), total = ref(0), status = ref('active'), search = ref(''), busy = ref(false), error = ref('')
  const action = ref(''), comment = ref(''), photos = ref<string[]>([]), submitting = ref(false)
  let generation = 0, historyGeneration = 0, historyPage = 0, page = 0
  const actions = computed(() => selected.value ? faultActions(selected.value, state.context?.userId || '').filter(value => {
    if (['dispatch', 'transfer', 'reviewer', 'close'].includes(value)) return false
    return canFault(['approve', 'reject'].includes(value) ? 'review' : 'save')
  }) : [])
  async function load(more = false) {
    const ticket = ++generation; if (!more) { rows.value = []; total.value = 0; page = 0; selected.value = undefined; history.value = []; historyTotal.value = 0; historyBusy.value = false; historyGeneration++ }
    if (!online.value || state.offlineMode || !state.projectId || !canFault('query')) { busy.value = false; return }
    busy.value = true; error.value = ''
    try {
      if (route.params.id) {
        const row = await facility.fault(String(route.params.id))
        if (ticket !== generation) return
        selected.value = row; await loadHistory()
      } else {
        const next = more ? page + 1 : 0, terms: Term[] = [{ column: 'projectId', value: state.projectId }]
        if (status.value === 'active') terms.push({ column: 'state', termType: 'nin', value: ['closed', 'cancelled'] })
        else if (status.value !== 'all') terms.push({ column: 'state', value: status.value })
        if (search.value.trim()) terms.push({ column: 'name', termType: 'like', value: search.value.trim() })
        const result = await facility.query<Fault>('faults', { pageIndex: next, pageSize: 15, terms, sorts: [{ name: 'createTime', order: 'desc' }] }, '?mine=true')
        if (ticket !== generation) return
        rows.value = more ? [...rows.value, ...result.data] : result.data; total.value = result.total; page = next
      }
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause) }
    finally { if (ticket === generation) busy.value = false }
  }
  /** 历史记录单独分页，失败保留已加载内容，切换对象后拒绝旧响应。 */
  async function loadHistory(more = false) {
    const row = selected.value, ticket = ++historyGeneration
    if (!row || !online.value || !canFault('query')) return
    historyBusy.value = true
    const next = more ? historyPage + 1 : 0
    try {
      const result = await facility.faultHistory(row.id, next)
      if (ticket !== historyGeneration || selected.value?.id !== row.id) return
      history.value = more ? [...history.value, ...result.data] : result.data
      historyTotal.value = result.total; historyPage = next
    } catch (cause) { if (ticket === historyGeneration) error.value = messageOf(cause) }
    finally { if (ticket === historyGeneration) historyBusy.value = false }
  }
  function open(value: string) { if (!actions.value.includes(value)) return; action.value = value; comment.value = ''; photos.value = []; error.value = '' }
  async function photo(file: File) {
    if (!state.projectId || submitting.value) return
    if (photos.value.length >= 20 || file.size > 20 * 1024 * 1024 || !file.type.startsWith('image/')) { error.value = '最多20张照片，单张不超过20MB'; return }
    submitting.value = true
    try { const result = await facility.upload(file, state.projectId); photos.value.push(result.id) }
    catch (cause) { error.value = messageOf(cause) } finally { submitting.value = false }
  }
  async function confirm() {
    const row = selected.value
    if (!row || !online.value || submitting.value || !actions.value.includes(action.value)) return
    if (['resolve', 'reject'].includes(action.value) && !comment.value.trim()) { error.value = '请填写处理结果或驳回原因'; return }
    submitting.value = true; error.value = ''
    try { await facility.faultAction(row.id, action.value, { version: row.version, comment: comment.value.trim(), attachments: photos.value }); action.value = ''; await load() }
    catch (cause) { error.value = messageOf(cause) } finally { submitting.value = false }
  }
  watch(() => [route.params.id, state.context?.tenantId, state.context?.applicationId, state.context?.userId, state.projectId, online.value, state.offlineMode, status.value], () => void load(), { immediate: true })
  onBeforeUnmount(() => { generation++; historyGeneration++ })
  return { rows, selected, history, historyTotal, historyBusy, loadHistory, total, status, search, busy, error, online, actions, action, comment, photos, submitting, load, open, confirm, photo }
}
