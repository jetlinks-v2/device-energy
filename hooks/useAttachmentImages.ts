import { ref, watch } from 'vue'
import { downloadFile } from '../api'
import { messageOf } from '../shared/types'

export function useAttachmentImages(ids: () => string[]) {
  const images = ref<Record<string, { url: string; error: string }>>({})
  watch(ids, (values, _, onCleanup) => {
    let active = true
    const urls: string[] = []
    images.value = Object.fromEntries([...new Set(values)].map(id => [id, { url: '', error: '' }]))
    // 切换任务或关闭详情后释放图片，忽略仍在返回的旧请求。
    onCleanup(() => {
      active = false
      urls.forEach(url => URL.revokeObjectURL(url))
    })
    Object.keys(images.value).forEach(async id => {
      try {
        // 沿用平台鉴权下载接口，避免直接图片请求丢失访问凭证。
        const blob = await downloadFile(id)
        if (!active) return
        const url = URL.createObjectURL(blob)
        urls.push(url)
        images.value[id].url = url
      } catch (error) {
        if (active) images.value[id].error = messageOf(error)
      }
    })
  }, { immediate: true })
  return images
}
