<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import { useDeviceImport } from '../hooks/useDeviceImport'
const props = defineProps<{ projectId?: string }>(),
  emit = defineEmits<{ changed: [] }>()
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
  <label class="import-button" :aria-disabled="vm.busy">
    <span>{{ feText('importExtendedProfiles') }}</span>
    <input
      type="file"
      accept=".csv"
      :disabled="vm.busy"
      @change="upload"
    />
  </label>
  <span
    v-if="vm.error"
    role="alert"
    style="color: #cf1322"
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
.import-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding-inline: .9375rem;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: var(--r-2, .375rem);
  cursor: pointer;
}
.import-button:focus-within { outline: 2px solid var(--ant-color-primary, #1677ff); outline-offset: 2px; }
.import-button[aria-disabled='true'] { opacity: .5; cursor: not-allowed; }
.import-button input { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
