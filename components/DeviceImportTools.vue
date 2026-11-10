<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive, ref } from 'vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import { useDeviceImport } from '../hooks/useDeviceImport'
const props = defineProps<{ projectId?: string }>(),
  emit = defineEmits<{ changed: [] }>()
const fileInput = ref<HTMLInputElement>()
const vm = reactive(
  useDeviceImport(
    () => props.projectId,
    () => emit('changed')
  )
)
const upload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void vm.upload(file)
  ;(event.target as HTMLInputElement).value = ''
}
</script>
<template>
  <a-button
    :loading="vm.busy"
    @click="vm.exportRows"
  >
    {{ feText('exportExtendedProfileTemplate') }}
  </a-button>
  <j-permission-button hasPermission="facility/Devices:save"
    :loading="vm.busy" :disabled="vm.busy" @click="fileInput?.click()">
    <UploadOutlined />
    {{ feText('importExtendedProfiles') }}
  </j-permission-button>
  <input ref="fileInput" type="file" accept=".csv" hidden :disabled="vm.busy" @change="upload" />
  <span
    v-if="vm.error"
    role="alert"
    class="facility-import-error"
  >
    {{ vm.error }}
  </span>
  <span
    v-if="vm.notice"
    role="status"
  >
    {{ vm.notice }}
  </span>
</template>
<style scoped>
.facility-import-error {
  color: var(--err);
}
</style>
