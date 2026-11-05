import { feText } from '../shared/i18n'
import { ref } from 'vue'
import { facility, downloadFile } from '../api'
import { messageOf } from '../shared/types'
export function useAttachments(ids: () => string[], change: (ids: string[]) => void, projectId: () => string | undefined) {
  const busy = ref(false),
    error = ref('')
  const upload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    busy.value = true
    error.value = ''
    try {
      if (ids().length >= 20) throw Error(feText('upTo20AttachmentsAreAllowed'))
      if (file.size > 20 * 1024 * 1024) throw Error(feText('eachAttachmentMustBeNoLargerThan20Mb'))
      if (!projectId()) throw Error(feText('selectABusinessProjectFirst'))
      const uploaded = await facility.upload(file, projectId()!)
      change([...ids(), uploaded.id])
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
      input.value = ''
    }
  }
  const download = async (id: string) => {
    busy.value = true
    error.value = ''
    try {
      const blob = await downloadFile(id),
        url = URL.createObjectURL(blob),
        link = document.createElement('a')
      link.href = url
      link.download = id
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  return { busy, error, upload, download, remove: (id: string) => change(ids().filter((value) => value !== id)) }
}
