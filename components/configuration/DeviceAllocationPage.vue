<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import ConditionFilter, { type ConditionFilterTerm, type ConditionFilterField } from '@jetlinks-web-core/components/ConditionFilter'
import { useDeviceConfiguration } from '../../hooks/useDeviceConfiguration'
import { feText } from '../../shared/i18n'
import { time, type Option } from '../../shared/types'
import type { TableHandle } from '../../shared/tableQuery'
import type { AllocatedDevice } from '../../shared/meterBilling'
const vm = reactive(useDeviceConfiguration()), filters = ref<ConditionFilterTerm[]>([])
const types: Option[] = [
  { value: 'device', label: feText('ordinaryDevice') }, { value: 'water', label: feText('waterMeter') },
  { value: 'electricity', label: feText('electricMeter') }, { value: 'gas', label: feText('gasMeter') }
]
const fields: ConditionFilterField[] = [
  { title: feText('deviceName'), dataIndex: 'name', search: { type: 'string' } },
  { title: feText('deviceCode'), dataIndex: 'cloudDeviceId', search: { type: 'string' } },
  { title: feText('productName'), dataIndex: 'productName', search: { type: 'string' } },
  { title: feText('deviceCategory'), dataIndex: 'meterType', search: { type: 'select', options: types } }
]
const columns = computed(() => [
  { title: feText('deviceName'), dataIndex: 'name', width: 180, ellipsis: true },
  { title: feText('deviceCode'), dataIndex: 'cloudDeviceId', width: 180, ellipsis: true },
  { title: feText('productName'), dataIndex: 'productName', width: 150, ellipsis: true },
  { title: feText('project'), dataIndex: 'projectName', width: 170 },
  { title: feText('deviceCategory'), dataIndex: 'meterType', key: 'category', scopedSlots: true, width: 120 },
  { title: feText('installationSpace'), dataIndex: 'spaceId', key: 'space', scopedSlots: true, width: 160 },
  { title: feText('allocationSince'), dataIndex: 'allocationSince', key: 'effective', scopedSlots: true, width: 180 },
  { title: feText('actions'), key: 'actions', scopedSlots: true, width: 90, fixed: 'right' }
])
const spaceNames = ref<Record<string, string>>({})
const setTable = (value: unknown) => { vm.table = value as TableHandle | undefined }
const select = (keys: string[], rows: AllocatedDevice[]) => { vm.selected = keys; vm.selectedRows = rows }
</script>
<template>
  <section class="facility-page facility-resource-page">
    <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon closable @close="vm.error = ''" />
    <div class="facility-resource-controls--inline">
      <a-select v-model:value="vm.projectId" :options="vm.projects" :placeholder="feText('allBusinessProjects')"
        show-search option-filter-prop="label" allow-clear class="facility-toolbar__project" />
      <ConditionFilter v-model="filters" :fields="fields" class="facility-search" @change="vm.terms = $event.filter.terms" />
      <j-permission-button hasPermission="facility/Configuration/Devices:sync" :loading="vm.syncing" @click="vm.sync">
        {{ feText('syncCloudDevices') }}
      </j-permission-button>
    </div>
    <div class="facility-toolbar">
      <a-radio-group v-model:value="vm.state" button-style="solid">
        <a-radio-button value="all">{{ feText('allocationAll') }}</a-radio-button>
        <a-radio-button value="pending">{{ feText('allocationPending') }}</a-radio-button>
        <a-radio-button value="ready">{{ feText('allocationReady') }}</a-radio-button>
      </a-radio-group>
      <span v-if="vm.selected.length">{{ feText('selectedCount') }} {{ vm.selected.length }} {{ feText('itemsUnit') }}</span>
      <j-permission-button hasPermission="facility/Configuration/Devices:save" type="primary"
        :disabled="!vm.selected.length" @click="vm.edit()">{{ feText('batchAllocate') }}</j-permission-button>
    </div>
    <j-pro-table :ref="setTable" row-key="id" mode="TABLE" type="PAGE" :columns="columns"
      :params="vm.params" :request="vm.request" :pagination="{ pageSize: 20 }" :body-style="{ padding: 0 }"
      :row-selection="{ selectedRowKeys: vm.selected, onChange: select }"
      :alert-show="false" :scroll="{ x: 1230 }">
      <template #category="row"><a-tag>{{ types.find(type => type.value === row.meterType)?.label || feText('notConfigured') }}</a-tag></template>
      <template #space="row">{{ row.spaceName || row.fullName || spaceNames[row.spaceId] || (row.spaceId ? feText('configured') : '—') }}</template>
      <template #effective="row">{{ time(row.allocationSince) }}</template>
      <template #actions="row"><j-permission-button hasPermission="facility/Configuration/Devices:save" type="link" @click="vm.edit([row])">{{ feText('allocate') }}</j-permission-button></template>
    </j-pro-table>
    <a-drawer :open="vm.opened" :title="vm.editing.length === 1 ? vm.editing[0].name : feText('batchAllocate')" :width="480" @close="vm.opened = false">
      <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon class="meter-form-error" />
      <a-form layout="vertical">
        <a-form-item :label="feText('project')" required><a-select v-model:value="vm.targetProject" :options="vm.projects" show-search option-filter-prop="label" /></a-form-item>
        <a-form-item :label="feText('deviceCategory')" required><a-radio-group v-model:value="vm.meterType" :options="types" /></a-form-item>
        <a-form-item v-if="vm.editing.length === 1" :label="feText('installationSpace')">
          <a-tree-select v-model:value="vm.spaceId" :tree-data="vm.spaces" :tree-data-simple-mode="{ id: 'value', pId: 'parentId' }"
            :field-names="{ label: 'label', value: 'value' }" allow-clear show-search tree-node-filter-prop="label" />
        </a-form-item>
      </a-form>
      <template #footer><a-space><j-permission-button hasPermission="facility/Configuration/Devices:save" type="primary" :loading="vm.saving" :disabled="vm.spacesLoading || vm.editing.length === 1 && !vm.spacesReady" @click="vm.save">{{ feText('save') }}</j-permission-button><a-button @click="vm.opened = false">{{ feText('cancel') }}</a-button></a-space></template>
    </a-drawer>
  </section>
</template>
