<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import { UploadOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { useDeviceImport } from '../hooks/useDeviceImport'
const props = defineProps<{ projectId?: string }>(), emit = defineEmits<{ changed: [] }>()
const vm = reactive(useDeviceImport(() => props.projectId, () => emit('changed')))
const columns = [
  { title: feText('profileRow'), dataIndex: 'rowNumber', width: 100 },
  { title: feText('name'), dataIndex: 'deviceName', width: 190 },
  { title: feText('profileResult'), key: 'result' }
]
</script>
<template>
  <j-permission-button hasPermission="facility/Devices:save" @click="vm.open">
    <UploadOutlined />{{ feText('importExtendedProfiles') }}
  </j-permission-button>
  <a-modal :open="vm.opened" :title="feText('importExtendedProfiles')" :width="780"
    :mask-closable="false" :closable="!vm.busy" :keyboard="!vm.busy" @cancel="vm.close">
    <a-form layout="vertical">
      <a-form-item :label="feText('profileDownload')">
        <a-button :loading="vm.busy" @click="vm.exportRows"><DownloadOutlined />{{ feText('profileWorkbook') }}</a-button>
        <p class="profile-import-hint">{{ feText('profileImportHint') }}</p>
      </a-form-item>
      <a-form-item :label="feText('profileChoose')" required>
        <a-upload-dragger accept=".xlsx" :multiple="false" :max-count="1" :disabled="vm.busy"
          :before-upload="vm.chooseFile" :file-list="vm.file ? [{ uid: 'device-profile', name: vm.file.name, status: 'done' }] : []"
          @remove="vm.chooseFile()">
          <p class="ant-upload-drag-icon"><InboxOutlined /></p>
          <p class="ant-upload-text">{{ feText('profileChoose') }}</p>
          <p class="ant-upload-hint">{{ feText('profileFileHint') }}</p>
        </a-upload-dragger>
      </a-form-item>
    </a-form>
    <a-alert v-if="vm.error" type="error" show-icon :message="vm.error" />
    <a-alert v-if="vm.notice" type="success" show-icon :message="vm.notice" />
    <template v-if="vm.validated">
      <a-alert :type="vm.checkPassed ? 'success' : 'error'" show-icon
        :message="feText(vm.checkPassed ? 'profileCheckOk' : 'profileCheckFailed')" />
      <a-table class="profile-import-results" :columns="columns" :data-source="vm.checks" row-key="rowNumber"
        size="small" :pagination="{ pageSize: 8, showSizeChanger: false }" :scroll="{ y: 280 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'result'">
            <a-tag v-if="record.valid" color="success">{{ feText('profileValid') }}</a-tag>
            <span v-else class="profile-import-error">{{ record.message }}</span>
          </template>
        </template>
      </a-table>
    </template>
    <template #footer>
      <a-space>
        <a-button :disabled="vm.busy" @click="vm.close">{{ feText('cancel') }}</a-button>
        <a-button :disabled="!vm.file || vm.busy" :loading="vm.busy" @click="vm.validate">{{ feText('profileCheck') }}</a-button>
        <j-permission-button hasPermission="facility/Devices:save" type="primary" :loading="vm.busy"
          :disabled="!vm.canSubmit" @click="vm.submit">{{ feText('profileConfirm') }}</j-permission-button>
      </a-space>
    </template>
  </a-modal>
</template>
<style scoped>
.profile-import-hint { color: var(--ink-3); margin: 8px 0 0; line-height: 1.6; }
.profile-import-results { margin-top: 12px; }
.profile-import-error { color: var(--err); }
</style>
