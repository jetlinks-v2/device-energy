import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { facility, downloadFile } from '../api/facility'
import { state, can } from '../services/session'
import * as offline from '../services/offline'
import { canExecute } from '../../../shared/taskActions'
import type { Task, CheckResult, Context, Entity } from '../../../shared/types'
import { clone, messageOf } from '../../../shared/types'
import { incompleteCheck } from '../services/checks'
import { m } from '../services/mobileText'
import { useConnection } from './useConnection'
import { taskScanAllowed } from '../services/taskScanAccess'
export function useMobileTask(id: string, scan: () => unknown = () => undefined) {
  const task = ref<Task>(), results = ref<CheckResult[]>([]), busy = ref(false), claimable = ref(false)
  const error = ref(''), notice = ref(''), pending = ref(false), online = useConnection(true)
  const attachment = ref<{ url: string; type: string }>()
  const people = ref<Entity[]>([]), peopleError = ref('')
  const personName = (id?: string) => !id ? '—' : id === state.context?.userId ? state.context.userName : people.value.find(p => p.id === id)?.name || m('项目人员', 'Project staff')
  const context = (): Context => {
    if (!state.context) throw Error(m('请先登录', 'Please sign in'))
    return state.context
  }
  const downloadable = computed(() => !!task.value && can('save') && canExecute(task.value, context().userId) && !pending.value)
  const scannable = computed(() => downloadable.value && !task.value?.deviceCount)
  const executable = computed(() => scannable.value && taskScanAllowed(state.context, task.value, scan()))
  async function load() {
    busy.value = true; error.value = ''; notice.value = ''; claimable.value = false
    try {
      const scope = context()
      task.value = online.value ? await facility.task(id) : await offline.cachedTask(scope, id)
      if (!task.value) throw Error(m('此任务尚未下载，请联网后打开', 'Task not downloaded. Open it online first'))
      if (online.value && state.authorization?.permissions.some(p => p.id === 'facility-device' && p.actions.includes('query'))) {
        try { people.value = await facility.options<Entity>('employees/' + encodeURIComponent(task.value.projectId)); peopleError.value = '' }
        catch (e) { peopleError.value = messageOf(e) }
      }
      if (online.value && task.value.state === 'open' && can('save')) claimable.value = await facility.canClaimTask(id)
      pending.value = (await offline.entries(scope)).some(row => row.taskId === id && row.state !== 'submitted')
      const draft = await offline.loadDraft(scope, id)
      results.value = clone(draft?.version === task.value.version && canExecute(task.value, scope.userId) ? draft.results : task.value.results || [])
      if (draft && draft.version !== task.value.version) notice.value = m('任务状态已更新，已显示最新检查结果', 'Task updated. Showing the latest results')
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  async function claim() {
    if (!task.value || !claimable.value || busy.value || !online.value) return
    busy.value = true; error.value = ''; notice.value = ''
    try {
      task.value = await facility.action(id, 'claim', { version: task.value.version })
      claimable.value = false
      results.value = clone(task.value.results || [])
      await offline.cacheTask(context(), clone(task.value))
      notice.value = m('接单成功', 'Task claimed')
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  async function draft() {
    if (!task.value || !executable.value) return
    try {
      await offline.cacheTask(context(), clone(task.value))
      await offline.saveDraft(context(), id, clone(results.value), task.value.version)
      notice.value = m('草稿已保存', 'Draft saved')
    } catch (e) { error.value = messageOf(e) }
  }
  async function photo(itemId: string, file: File) {
    if (!executable.value || busy.value) return
    busy.value = true; error.value = ''
    try {
      const key = await offline.savePhoto(context(), file)
      const row = results.value.find(r => r.itemId === itemId)
      if (row) row.attachments.push(key)
      else results.value.push({ itemId, value: '', abnormal: false, attachments: [key] })
      await draft()
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  async function submit() {
    if (!task.value || busy.value || !executable.value) return
    const missing = incompleteCheck(task.value.standardSnapshot, results.value)
    if (missing) { error.value = m('请完善检查结果及照片：', 'Complete the result and photos: ') + missing.name; return }
    busy.value = true; error.value = ''; notice.value = ''
    try {
      await offline.cacheTask(context(), clone(task.value))
      await offline.saveDraft(context(), id, clone(results.value), task.value.version)
      await offline.enqueue(context(), clone(task.value), 'submit', clone(results.value))
      pending.value = true
      task.value = { ...task.value, pendingSync: true }
      notice.value = m('已保存，等待同步', 'Saved. Waiting to sync')
      if (online.value) {
        await offline.replay(context(), facility)
        const entry = (await offline.entries(context())).filter(row => row.taskId === id).sort((a, b) => b.createdAt - a.createdAt)[0]
        if (entry?.state === 'conflict') error.value = m('任务已变更，本地结果已保留在同步中心', 'Task changed. Local results are retained in Sync')
        else if (entry?.state === 'pending') error.value = entry.error || m('同步失败，可到同步中心重试', 'Sync failed. Retry in Sync')
        else { await load(); notice.value = task.value?.parentTaskId ? '设备检查已提交' : m('提交成功，等待负责人审批', 'Submitted for review') }
      }
    } catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  function closeAttachment() {
    if (attachment.value) URL.revokeObjectURL(attachment.value.url)
    attachment.value = undefined
  }
  async function openAttachment(key: string) {
    try {
      const cached = key.startsWith('local:') ? (await offline.cachedPhoto(context(), key))?.file : (await offline.cachedFile(context(), key))?.blob
      const blob = cached || (online.value ? await downloadFile(key) : undefined)
      if (!blob) throw Error(m('此附件未下载，请联网后查看', 'Attachment not downloaded. Connect to view'))
      closeAttachment(); attachment.value = { url: URL.createObjectURL(blob), type: blob.type }
    } catch (e) { error.value = messageOf(e) }
  }
  onMounted(() => void load())
  onBeforeUnmount(closeAttachment)
  return { task, results, busy, claimable, executable, scannable, downloadable, error, notice, pending, online, attachment, peopleError, personName, closeAttachment, openAttachment, load, claim, draft, photo, submit }
}
