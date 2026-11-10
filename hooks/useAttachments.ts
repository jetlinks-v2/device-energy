import { feText } from '../shared/i18n'
import { computed, ref } from 'vue'
import { Upload, type UploadProps } from 'ant-design-vue'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import { facility, downloadFile } from '../api'
import { messageOf } from '../shared/types'
export function useAttachments(ids: () => string[], change: (ids: string[]) => void, projectId: () => string | undefined) {
  const busy = ref(false),
    error = ref('')
  const names = ref<Record<string, string>>({})
  const fileList = computed(() => ids().map(id => ({ uid: id, name: names.value[id] || id, status: 'done' as const, url: getFileUrlById(id) })))
  const beforeUpload: UploadProps['beforeUpload'] = () => {
    error.value = ''
    if (ids().length >= 20) error.value = feText('upTo20AttachmentsAreAllowed')
    else if (!projectId()) error.value = feText('selectABusinessProjectFirst')
    return error.value ? Upload.LIST_IGNORE : true
  }
  // 使用平台文件列表，但上传仍走设施文件接口，保留项目归属和原有权限校验。
  const upload: NonNullable<UploadProps['customRequest']> = async ({ file, onSuccess, onError }) => {
    busy.value = true
    error.value = ''
    try {
      if (!(file instanceof File)) throw Error(feText('requestFailed'))
      if (ids().length >= 20) throw Error(feText('upTo20AttachmentsAreAllowed'))
      if (file.size > 20 * 1024 * 1024) throw Error(feText('eachAttachmentMustBeNoLargerThan20Mb'))
      if (!projectId()) throw Error(feText('selectABusinessProjectFirst'))
      const uploaded = await facility.upload(file, projectId()!)
      names.value[uploaded.id] = file.name
      change([...ids(), uploaded.id])
      onSuccess?.({ success: true, result: uploaded })
    } catch (e) {
      error.value = messageOf(e)
      onError?.(e instanceof Error ? e : new Error(error.value))
    } finally {
      busy.value = false
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
  const remove = (id: string) => change(ids().filter(value => value !== id))
  const removeFile: UploadProps['onRemove'] = file => { remove(file.uid); return true }
  return { busy, error, upload, beforeUpload, fileList, download, remove, removeFile }
}
