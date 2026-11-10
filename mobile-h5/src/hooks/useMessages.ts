import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { facility } from '../api/facility'
import { state, can } from '../services/session'
import { refreshMessageBadge, unreadMessages } from './useMessageBadge'
import { useConnection } from './useConnection'
import type { TaskMessage } from '../../../shared/types'
import { messageOf } from '../../../shared/types'

export function useMessages() {
  const router = useRouter(), online = useConnection()
  const now = ref(Date.now())
  const rows = ref<TaskMessage[]>([]), total = ref(0), unreadOnly = ref(false)
  const busy = ref(false), actionBusy = ref(false), error = ref('')
  let generation = 0, pageIndex = 0
  const identity = () => [state.context?.userId, state.projectId, unreadOnly.value].join(':')
  async function load(more = false) {
    const ticket = ++generation, key = identity(), project = state.projectId
    if (!more) { rows.value = []; total.value = 0; pageIndex = 0 }
    if (!state.context || !project || !can('query') || !online.value) { busy.value = false; return }
    busy.value = true; error.value = ''
    const page = more ? pageIndex + 1 : 0
    try {
      const terms = [{ column: 'projectId', value: project }, ...(unreadOnly.value ? [{ column: 'readTime', termType: 'isnull', value: true }] : [])]
      const result = await facility.taskMessages({ pageIndex: page, pageSize: 20, terms, sorts: [{ name: 'createTime', order: 'desc' }, { name: 'id', order: 'desc' }] })
      if (ticket !== generation || key !== identity()) return
      rows.value = more ? [...rows.value, ...result.data] : result.data
      total.value = result.total; pageIndex = page
    } catch (e) { if (ticket === generation) error.value = messageOf(e) }
    finally { if (ticket === generation) busy.value = false }
  }
  async function open(row: TaskMessage) {
    if (actionBusy.value || !online.value) return
    const key = identity(); actionBusy.value = true; error.value = ''
    try {
      if (!row.readTime) await facility.readMessage(row.id)
      if (key !== identity()) return
      row.readTime = Date.now()
      void refreshMessageBadge().catch(() => {})
      // 跳转只读任务详情，仍由任务接口核验实时状态，绝不附带扫码执行凭证。
      await router.push('/tasks/' + encodeURIComponent(row.taskId))
    } catch (e) { error.value = messageOf(e) }
    finally { actionBusy.value = false }
  }
  async function readAll() {
    const project = state.projectId, key = identity()
    if (!project || actionBusy.value || !online.value) return
    actionBusy.value = true; error.value = ''
    try {
      await facility.readAllMessages(project)
      if (key !== identity()) return
      await Promise.all([load(), refreshMessageBadge()])
    } catch (e) { error.value = messageOf(e) }
    finally { actionBusy.value = false }
  }
  watch(() => identity() + ':' + online.value, () => void load(), { immediate: true })
  watch(unreadMessages, () => { if (!busy.value && !actionBusy.value) void load() })
  let timer: ReturnType<typeof setInterval>
  onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 15000) })
  onBeforeUnmount(() => { generation++; clearInterval(timer) })
  return { now, rows, total, busy, actionBusy, error, unreadOnly, online, load, open, readAll }
}
