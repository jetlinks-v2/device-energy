import { feText } from '../../../shared/i18n'
import { clone } from '../../../shared/types'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { facility, downloadFile } from '../api/facility'
import { request } from '../api/http'
import { state } from '../services/session'
import * as offline from '../services/offline'
import type { Task, CheckResult, Context } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useMobileTask(id: string) {
  const task = ref<Task>(),
    results = ref<CheckResult[]>([]),
    busy = ref(false),
    claimable = ref(false),
    error = ref(''),
    notice = ref(''),
    attachment = ref<{ url: string; type: string }>()
  let context: Context
  const account = async () => {
    if (!state.authorization || !state.session || !state.context) throw Error(feText('signInFirst'))
    context = state.context!
    return context
  }
  const load = async () => {
    busy.value = true
    error.value = ''
    claimable.value = false
    try {
      await account()
      if (navigator.onLine) {
        task.value = await facility.task(id)
        if (task.value.state === 'open' && state.authorization?.permissions.some(permission =>
          permission.id === 'facility-task' && permission.actions.includes('save'))) {
          claimable.value = await facility.canClaimTask(id)
        }
      } else task.value = await offline.cachedTask(context, id)
      if (!task.value) throw Error(feText('thisTaskHasNotBeenDownloadedConnectClaimAndDownloadItBefore'))
      const draft = await offline.loadDraft(context, id)
      results.value =
        draft?.results ||
        clone(task.value.results || [])
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const claim = async () => {
    if (!task.value || !claimable.value || busy.value || !navigator.onLine) return
    busy.value = true
    try {
      task.value = await facility.action(id, 'claim', { version: task.value.version })
      claimable.value = false
      await download()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const download = async () => {
    try {
      const row = await facility.downloadTask(id)
      await account()
      for (const fileId of row.instructionAttachments || [])
        await offline.cacheFile(context, fileId, await downloadFile(fileId))
      await offline.cacheTask(context, row)
      task.value = row
      notice.value = feText('taskAndMaterialsDownloadedYouCanNowWorkOffline')
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  const closeAttachment = () => {
    if (attachment.value) URL.revokeObjectURL(attachment.value.url)
    attachment.value = undefined
  }
  const openAttachment = async (id: string) => {
    try {
      await account()
      const cached = await offline.cachedFile(context, id)
      const blob = navigator.onLine ? await downloadFile(id) : cached?.blob
      if (!blob) throw Error(feText('thisAttachmentHasNotBeenDownloadedConnectToUpdateTheOfflineTask'))
      closeAttachment()
      attachment.value = { url: URL.createObjectURL(blob), type: blob.type }
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  onBeforeUnmount(closeAttachment)
  const draft = async () => {
    await offline.saveDraft(context, id, clone(results.value))
    notice.value = feText('draftSavedForTheCurrentAccount')
  }
  const photo = async (itemId: string, file: File) => {
    busy.value = true
    try {
      const key = await offline.savePhoto(context, file)
      const row = results.value.find((r) => r.itemId === itemId)
      if (row) row.attachments.push(key)
      else results.value.push({ itemId, value: '', abnormal: false, attachments: [key] })
      await draft()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const submit = async () => {
    if (!task.value || busy.value) return
    busy.value = true
    error.value = ''
    try {
      await offline.enqueue(
        context,
        clone(task.value),
        'submit',
        clone(results.value)
      )
      notice.value = feText('resultsSavedToTheSyncCenter')
      if (navigator.onLine) {
        await offline.replay(context, facility)
        const pending = (await offline.entries(context)).filter((row) => row.taskId === id).at(-1)
        if (pending?.state === 'conflict') error.value = feText('theTaskStatusHasChangedYourLocalContentIsRetainedInThe')
        else if (pending?.state === 'pending') error.value = pending.error || feText('waitingForAConnectionToRetry')
        else {
          notice.value = feText('submittedSuccessfully')
          await load()
        }
      }
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  onMounted(() => void load())
  return {
    task,
    claimable,
    results,
    busy,
    error,
    notice,
    attachment,
    closeAttachment,
    openAttachment,
    load,
    claim,
    download,
    draft,
    photo,
    submit
  }
}
