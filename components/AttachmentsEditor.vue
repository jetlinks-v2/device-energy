<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
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
    v-if="ids.length"
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
    v-else
    :description="feText('noAttachments')"
    :image-style="{ height: '32px' }"
  />
  <label v-if="!readonly">
    {{ feText('uploadAttachmentsUpTo20MbEach') }}
    <input
      type="file"
      :disabled="vm.busy"
      @change="vm.upload"
    />
  </label>
</template>
