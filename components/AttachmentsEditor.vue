<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import { FileUpload } from '@jetlinks-web-core/components'
import { useAttachments } from '../hooks/useAttachments'
const props = defineProps<{ ids: string[]; readonly?: boolean; projectId?: string }>()
const emit = defineEmits<{ change: [ids: string[]] }>()
const vm = reactive(
  useAttachments(
    () => props.ids,
    (ids) => emit('change', ids),
    () => props.projectId
  )
)
</script>
<template>
  <a-alert
    v-if="vm.error"
    :message="vm.error"
    type="error"
  />
  <a-list
    v-if="readonly && ids.length"
    :data-source="ids"
    size="small"
  >
    <template #renderItem="{ item }">
      <a-list-item>
        <a-button
          type="link"
          :loading="vm.busy"
          @click="vm.download(item)"
        >
          {{ feText('downloadAttachment') }} {{ item }}
        </a-button>
        <a-button
          v-if="!readonly"
          danger
          type="text"
          :disabled="vm.busy"
          @click="vm.remove(item)"
        >
          {{ feText('unlink') }}
        </a-button>
      </a-list-item>
    </template>
  </a-list>
  <a-empty
    v-else-if="readonly"
    :description="feText('noAttachments')"
    :image-style="{ height: '32px' }"
  />
  <FileUpload v-else :value="vm.fileList" :size="20" :max-count="20" :multiple="false"
    :disabled="vm.busy" :before-upload="vm.beforeUpload" :custom-request="vm.upload" drag @remove="vm.removeFile">
    <div class="facility-attachment-dropzone">
      <AIcon :type="vm.busy ? 'LoadingOutlined' : 'InboxOutlined'" />
      <div class="facility-attachment-title">{{ feText(vm.busy ? 'uploadingAttachment' : 'clickOrDragAttachment') }}</div>
      <a-tag>20MB</a-tag>
    </div>
  </FileUpload>
</template>

<style scoped>
.facility-attachment-dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-3, .75rem);
  padding: var(--space-4, 1rem);
}
.facility-attachment-dropzone > .anticon {
  color: var(--ant-color-primary, #1677ff);
  font-size: 28px;
}
.facility-attachment-title { font-weight: 500; }
.facility-attachment-dropzone .ant-tag { margin: 0; }
</style>
