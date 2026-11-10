import { ref, watch, onBeforeUnmount } from 'vue'
import { downloadFile } from '../api/facility'
import { cachedPhoto, cachedFile } from '../services/offline'
import { state } from '../services/session'
import { messageOf } from '../../../shared/types'
import { m } from '../services/mobileText'
export function useFilePreview(id: () => string) {
  const url = ref(''), error = ref('')
  let generation = 0
  const clear = () => { if (url.value) URL.revokeObjectURL(url.value); url.value = '' }
  async function load() {
    const ticket = ++generation
    clear(); error.value = ''
    try {
      const context = state.context
      if (!context) return
      const key = id()
      const blob = key.startsWith('local:') ? (await cachedPhoto(context, key))?.file
        : (await cachedFile(context, key))?.blob || (navigator.onLine && !state.offlineMode ? await downloadFile(key) : undefined)
      if (ticket !== generation) return
      if (!blob) throw Error(m('图片不可用，请联网重试', 'Image unavailable. Connect and retry'))
      url.value = URL.createObjectURL(blob)
    } catch (e) { if (ticket === generation) error.value = messageOf(e) }
  }
  watch(id, () => void load(), { immediate: true })
  onBeforeUnmount(() => { generation++; clear() })
  return { url, error, load }
}
