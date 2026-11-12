<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { overviewTerms } from '../shared/overview'
import { selectedProject } from '../shared/tableQuery'
import { resources, resourceCellText } from '../shared/resources'
import { resourcePermission } from '../shared/permissions'
import { collectionLag, display, time, taskTime, type Entity, type Device } from '../shared/types'
import { useResource } from '../hooks/useResource'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { resourceSearchFields, timeColumns } from '../shared/resourceSearch'
import type { TableHandle } from '../shared/tableQuery'
import FacilityDataTable from './FacilityDataTable.vue'
import ResourceActions from './ResourceActions.vue'
import OperationLogDetail from './OperationLogDetail.vue'
import CycleRuleSummary from './CycleRuleSummary.vue'
import GroupQr from './GroupQr.vue'
import MappingSamples from './MappingSamples.vue'
import RecordForm from './RecordForm.vue'
import DeviceDetail from './DeviceDetail.vue'
import TaskDetail from './TaskDetail.vue'
import TaskDispatch from './TaskDispatch.vue'
import TaskReviewButton from './TaskReviewButton.vue'
import DeviceAssetCard from './devices/DeviceAssetCard.vue'
import { connectionStatusTones } from '../shared/deviceStatus'
const props = defineProps<{ resource: string; kind?: string; legacy?: boolean }>(),
  config = computed(() => resources[props.resource]),
  vm = reactive(useResource(() => config.value, props.kind, !props.legacy)),
  device = ref<Device>(),
  taskId = ref<string>(),
  dispatchId = ref<string>(),
  group = ref<Entity>()
const recordForm = ref<InstanceType<typeof RecordForm>>()
const save = async () => {
  try { recordForm.value?.validateCycle(); await vm.save() }
  catch (cause) { vm.error = cause instanceof Error ? cause.message : String(cause) }
}
const route = useRoute()
const initialTerms = overviewTerms(props.resource, route.query)
const filters = ref<ConditionFilterTerm[]>(props.resource === 'devices' ? [] : initialTerms)
// 工作台入口保留项目和业务快捷条件，设备页项目由独立选择器承接。
if (!props.legacy && initialTerms.length) {
  vm.filter(filters.value)
  vm.projectId = selectedProject(initialTerms)
}
const fields = computed(() => resourceSearchFields(config.value, vm.options, props.kind))
const showActions = computed(() => !['collection', 'readings'].includes(props.resource))
const columns = computed(() => [
  ...config.value.columns.map((c) => ({ title: c.title, dataIndex: c.key, key: 'cell-' + c.key, scopedSlots: true, ellipsis: props.resource === 'operations' && ['targetId', 'comment'].includes(c.key), width: timeColumns.has(c.key) ? 185 : props.resource === 'operations' && c.key === 'comment' ? 260 : 160 })),
  ...(showActions.value ? [{ title: feText('actions'), key: 'actions', dataIndex: 'actions', scopedSlots: true, width: ['devices', 'operations'].includes(props.resource) ? 100 : 280, fixed: 'right' }] : [])
])
const legacyColumns = computed(() => [
  ...config.value.columns.map(column => ({ title: column.title, dataIndex: column.key, key: column.key })),
  ...(showActions.value ? [{ title: feText('actions'), key: 'actions', width: 280 }] : [])
])
const open = (row: Entity) => {
  if (props.resource === 'devices') device.value = row as Device
  else if (props.resource === 'tasks') taskId.value = row.id
  else if (['faults', 'readings', 'replacements', 'operations'].includes(props.resource)) vm.detail = row
  else vm.edit(row)
}
const closeDevice = () => {
  device.value = undefined
  void vm.refresh()
}
const closeTask = () => {
  taskId.value = undefined
  void vm.refresh()
}
const changes = (v: { current?: number }) => {
  vm.page = v.current || 1
}
const setTable = (value: unknown) => { vm.table = value ? value as TableHandle : undefined }
const cellText = (key: string, row: Entity) => resourceCellText(config.value, key, row, vm.options.projects, vm.options.devices)
</script>

<template>
  <section class="facility-page" :class="{ 'facility-resource-page': !legacy }">
    <a-alert
      v-if="vm.error && !vm.opened"
      type="error"
      :message="vm.error"
      show-icon
      closable
      @close="vm.error = ''"
    />
    <div :class="{ 'facility-resource-controls--inline': resource === 'devices' && !legacy }">
    <a-select v-if="resource === 'devices' && !legacy"
      v-model:value="vm.projectId" :placeholder="feText('allBusinessProjects')"
      allow-clear show-search option-filter-prop="label"
      :options="vm.options.projects || []" class="facility-toolbar__project" />
    <ConditionFilter v-if="!legacy" v-model="filters" :fields="fields" class="facility-search"
      @change="vm.filter($event.filter.terms)" />
    <div v-if="legacy || !config.readonly || resource === 'tasks' || $slots.tools" class="facility-toolbar">
      <a-select
        v-if="legacy"
        v-model:value="vm.projectId"
        :placeholder="feText('allBusinessProjects')"
        allow-clear
        :options="vm.options.projects || []"
        class="facility-toolbar__project"
      />
      <a-input-search
        v-if="legacy"
        v-model:value="vm.search"
        class="facility-toolbar__search"
        :placeholder="feText('searchByName')"
        @search="vm.refresh"
      />
      <a-button
        v-if="legacy"
        :loading="vm.busy"
        @click="vm.refresh"
      >
        {{ feText('refresh') }}
      </a-button>
      <j-permission-button :hasPermission="resourcePermission(resource, kind)"
        v-if="resource === 'devices'"
        type="primary"
        :loading="vm.busy"
        @click="vm.sync"
      >
        {{ feText('syncCloudDevices') }}
      </j-permission-button>
      <j-permission-button :hasPermission="resourcePermission(resource, kind)"
        v-else-if="!config.readonly"
        type="primary"
        @click="vm.edit()"
      >
        {{ feText('add') }}
      </j-permission-button>
      <TaskReviewButton v-if="resource === 'tasks'" :kind="kind" :options="vm.options" @changed="vm.refresh" />
      <slot
        name="tools"
        :rows="vm.rows"
        :project-id="vm.projectId"
        :options="vm.options"
        :refresh="vm.refresh"
      />
      <template v-if="legacy && config.collection">
        <a-checkbox v-model:checked="vm.failedOnly">{{ feText('failedCollectionsOnly') }}</a-checkbox>
        <a-tag>{{ feText('matchingMeters') }}: {{ vm.total }}</a-tag>
      </template>
    </div>
    </div>
    <a-table
      v-if="legacy"
      row-key="id"
      :columns="legacyColumns"
      :data-source="vm.rows"
      :loading="vm.busy"
      :pagination="{ current: vm.page, total: vm.total, pageSize: 20, showSizeChanger: false }"
      :scroll="{ x: 900 }"
      @change="changes"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <ResourceActions :current-user-id="vm.currentUserId"
            :resource="resource"
            :record="record as Entity"
            :saving="vm.saving"
            :kind="kind"
            @open="open(record as Entity)"
            @dispatch="dispatchId = record.id"
            @qr="group = record as Entity"
            @command="vm.command(record as Entity, $event)"
            @remove="vm.remove(record as Entity)"
          />
        </template>
        <template
          v-else-if="
            ['startTime', 'endTime', 'createTime', 'scheduledTime', 'deadline', 'effectiveTime', 'observedTime', 'lastSuccessTime', 'nextRunTime', 'lastCollectedTime', 'lastCollectionTime', 'lastCollectionSuccessTime'].includes(
              String(column.key)
            )
          "
        >
          {{ resource === 'tasks' ? taskTime(record[String(column.key)]) : time(record[String(column.key)]) }}
        </template>
        <template v-else-if="column.key === 'collectionLag'">
          {{ collectionLag(record as Entity) }}
        </template>
        <template v-else>{{ cellText(String(column.key), record as Entity) }}</template>
      </template>
      <template #emptyText><a-empty :description="feText('noRecords')" /></template>
    </a-table>
    <j-pro-table v-else :ref="setTable"
      row-key="id" :mode="resource === 'devices' ? undefined : 'TABLE'"
      :mode-value="resource === 'devices' ? 'CARD' : 'TABLE'" :grid-columns="[2, 3, 4]"
      type="PAGE" :columns="columns" :params="vm.params" :request="vm.request"
      :no-pagination="false" :pagination="{ pageSize: 12 }" :alert-show="false" :body-style="{ padding: 0 }"
      :scroll="{ x: columns.reduce((width, column) => width + column.width, 0) }">
      <template v-if="resource === 'devices'" #card="record">
        <DeviceAssetCard :device="record" @open="open(record)" />
      </template>
      <template v-for="column in columns" :key="column.key" #[column.key]="record">
        <ResourceActions :current-user-id="vm.currentUserId" v-if="column.key === 'actions'" :resource="resource" :record="record" :kind="kind"
          :saving="vm.saving" @open="open(record)" @dispatch="dispatchId = record.id" @qr="group = record"
          @command="vm.command(record, $event)" @remove="vm.remove(record)" />
        <StatusTag v-else-if="resource === 'devices' && column.dataIndex === 'sourceState'"
          :text="display(record[column.dataIndex])"
          :status="connectionStatusTones[String(record[column.dataIndex])] || 'default'" />
        <template v-else-if="timeColumns.has(column.dataIndex)">{{ record[column.dataIndex] === 9223372036854775807 ? '—' : (resource === 'tasks' ? taskTime(record[column.dataIndex]) : time(record[column.dataIndex])) }}</template>
        <template v-else-if="column.dataIndex === 'collectionLag'">{{ collectionLag(record) }}</template>
        <template v-else>{{ cellText(column.dataIndex, record) }}</template>
      </template>
    </j-pro-table>
    <a-modal
      :open="!!vm.detail && resource !== 'operations'"
      :title="feText('details')"
      :footer="null"
      @cancel="vm.detail = undefined"
    >
      <a-descriptions v-if="vm.detail" :column="1" bordered>
        <a-descriptions-item v-for="column in config.columns" :key="column.key" :label="column.title">
          {{ timeColumns.has(column.key) ? time(vm.detail[column.key]) : cellText(column.key, vm.detail) }}
        </a-descriptions-item>
        <a-descriptions-item v-if="resource === 'replacements'" :label="feText('finalReadingOfOriginalMeter')">{{ vm.detail.finalReading ?? '—' }}</a-descriptions-item>
        <a-descriptions-item v-if="resource === 'replacements'" :label="feText('initialReadingOfNewMeter')">{{ vm.detail.initialReading ?? '—' }}</a-descriptions-item>
        <a-descriptions-item v-if="resource === 'replacements'" :label="feText('reason')">{{ vm.detail.reason || '—' }}</a-descriptions-item>
        <a-descriptions-item v-if="resource === 'readings'" :label="feText('reasonForManualReading')">{{ vm.detail.reason || '—' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
    <OperationLogDetail v-if="resource === 'operations' && vm.detail" :record="vm.detail"
      :projects="vm.options.projects || []" @close="vm.detail = undefined" />
    <a-modal
      v-model:open="vm.opened"
      :title="config.title"
      :width="resource === 'cycles' ? 1100 : 900"
      :body-style="{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }"
      :destroy-on-close="true"
      :confirm-loading="vm.saving"
      @ok="save"
    >
      <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon class="facility-form-error" />
      <MappingSamples
        v-if="resource === 'energy/mappings'"
        :state="vm"
        @select="vm.templateId = $event"
        @apply="vm.applyTemplate"
        @preview="vm.preview"
      />
      <RecordForm ref="recordForm"
        :fields="vm.formFields"
        :model="vm.form"
        :options="vm.options"
        @change="vm.change"
      />
      <template v-if="resource === 'plans'">
        <a-tag>{{ feText('devicesSelected') }}: {{ vm.deviceCount }}</a-tag>
        <CycleRuleSummary v-if="vm.selectedCycle" :rule="vm.selectedCycle" />
      </template>
      <template v-if="resource === 'energy/mappings'">
        <a-button
          :loading="vm.saving"
          @click="vm.preview"
        >
          {{ feText('previewSamplesFromTheLast24Hours') }}
        </a-button>
        <FacilityDataTable
          v-if="vm.previewRows.length"
          :data-source="vm.previewRows"
          :pagination="false"
          :row-key="(row: { propertyId: string; time: number }) => `${row.propertyId}:${row.time}`"
          :columns="[
            { title: feText('property'), dataIndex: 'propertyId' },
            { title: feText('time'), dataIndex: 'time' },
            { title: feText('rawReading'), dataIndex: 'raw' },
            { title: feText('convertedReading'), dataIndex: 'normalized' },
            { title: feText('unit'), dataIndex: 'unit' }
          ]"
        ><template #bodyCell="{ column, record }">{{ column.key === 'time' ? time(record.time) : display(record[column.key]) }}</template></FacilityDataTable>
        <a-empty
          v-else
          :description="feText('noSamplesYetPreviewAndVerifyBeforeSaving')"
        />
      </template>
    </a-modal>
    <DeviceDetail
      v-if="device"
      :device="device"
      @close="closeDevice"
    />
    <GroupQr
      v-if="group"
      :group="group"
      @close="group = undefined"
    />
    <TaskDispatch v-if="dispatchId" :id="dispatchId" @close="dispatchId = undefined"
      @saved="dispatchId = undefined; vm.refresh()" />
    <TaskDetail
      v-if="taskId"
      :id="taskId"
      @close="closeTask"
    />
  </section>
</template>
