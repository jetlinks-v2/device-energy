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
  const comment = ref(''), photos = ref<string[]>([]), submitting = ref(false)
  let generation = 0, historyGeneration = 0, historyPage = 0, page = 0
  const actions = computed(() => selected.value ? faultActions(selected.value, state.context?.userId || '').filter(value => {
    if (['dispatch', 'transfer', 'reviewer', 'close'].includes(value)) return false
    return canFault(['approve', 'reject'].includes(value) ? 'review' : 'save')
  }) : [])
  async function load(more = false) {
    const ticket = ++generation; if (!more) { rows.value = []; total.value = 0; page = 0; selected.value = undefined; history.value = []; historyTotal.value = 0; historyBusy.value = false; historyGeneration++; comment.value = ''; photos.value = [] }
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
  async function photo(file: File) {
    const row = selected.value, ticket = generation
    if (!row || !row.projectId || !actions.value.includes('resolve') || !online.value || state.offlineMode || !state.projectId || submitting.value) return
    if (photos.value.length >= 20 || file.size > 20 * 1024 * 1024 || !file.type.startsWith('image/')) { error.value = '最多20张照片，单张不超过20MB'; return }
    submitting.value = true
    try { const result = await facility.upload(file, row.projectId); if (ticket === generation) photos.value.push(result.id) }
    catch (cause) { if (ticket === generation) error.value = messageOf(cause) } finally { submitting.value = false }
  }
  async function confirm(value: string) {
    const row = selected.value
    if (!row || !online.value || state.offlineMode || submitting.value || !actions.value.includes(value)) return false
    if (['resolve', 'reject'].includes(value) && !comment.value.trim()) { error.value = value === 'resolve' ? '请填写维修结果' : '请填写退回原因'; return false }
    const ticket = generation
    submitting.value = true; error.value = ''
    try {
      const updated = await facility.faultAction(row.id, value, { version: row.version, comment: comment.value.trim(), attachments: value === 'resolve' ? [...photos.value] : [] })
      // 使用操作响应推进状态，避免提交成功后刷新失败让用户误以为没提交而重复操作。
      if (ticket !== generation || selected.value?.id !== row.id) return false
      selected.value = updated; comment.value = ''; photos.value = []
      await loadHistory()
      return true
    } catch (cause) { if (ticket === generation) error.value = messageOf(cause); return false }
    finally { submitting.value = false }
  }
  watch(() => [route.params.id, state.context?.tenantId, state.context?.applicationId, state.context?.userId, state.projectId, state.offlineMode, status.value], () => void load(), { immediate: true })
  // 网络波动不重置正在填写的维修结果；尚未载入详情时才在恢复连接后重试。
  watch(online, value => { if (value && !selected.value) void load() })
  onBeforeUnmount(() => { generation++; historyGeneration++ })
  return { rows, selected, history, historyTotal, historyBusy, loadHistory, total, status, search, busy, error, online, actions, comment, photos, submitting, load, confirm, photo }
}
