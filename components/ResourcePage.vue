<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed, reactive, ref } from 'vue'
import { resources } from '../shared/resources'
import { display, time, type Entity, type Device } from '../shared/types'
import { useResource } from '../hooks/useResource'
import ResourceActions from './ResourceActions.vue'
import GroupQr from './GroupQr.vue'
import MappingSamples from './MappingSamples.vue'
import RecordForm from './RecordForm.vue'
import DeviceDetail from './DeviceDetail.vue'
import TaskDetail from './TaskDetail.vue'
const props = defineProps<{ resource: string; kind?: string }>(),
  config = computed(() => resources[props.resource]),
  vm = reactive(useResource(() => config.value, props.kind)),
  device = ref<Device>(),
  taskId = ref<string>(),
  group = ref<Entity>()
const columns = computed(() => [
  ...config.value.columns.map((c) => ({ title: c.title, dataIndex: c.key, key: c.key })),
  { title: feText('actions'), key: 'actions', width: 280 }
])
const open = (row: Entity) => {
  if (props.resource === 'devices') device.value = row as Device
  else if (props.resource === 'tasks') taskId.value = row.id
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
</script>

<template>
  <section class="facility-page">
    <a-page-header :title="config.title" />
    <a-alert
      v-if="vm.error"
      type="error"
      :message="vm.error"
      show-icon
      closable
      @close="vm.error = ''"
    />
    <div class="facility-toolbar">
      <a-select
        v-model:value="vm.projectId"
        :placeholder="feText('allBusinessProjects')"
        allow-clear
        :options="vm.options.projects || []"
        class="facility-toolbar__project"
      />
      <a-input-search
        v-model:value="vm.search"
        class="facility-toolbar__search"
        :placeholder="feText('searchByName')"
        @search="vm.refresh"
      />
      <a-button
        :loading="vm.busy"
        @click="vm.refresh"
      >
        {{ feText('refresh') }}
      </a-button>
      <a-button
        v-if="resource === 'devices'"
        type="primary"
        :loading="vm.busy"
        @click="vm.sync"
      >
        {{ feText('syncCloudDevices') }}
      </a-button>
      <a-button
        v-else-if="!config.readonly"
        type="primary"
        @click="vm.edit()"
      >
        {{ feText('add') }}
      </a-button>
      <slot
        name="tools"
        :rows="vm.rows"
        :project-id="vm.projectId"
        :refresh="vm.refresh"
      />
    </div>
    <a-table
      row-key="id"
      :columns="columns"
      :data-source="vm.rows"
      :loading="vm.busy"
      :pagination="{ current: vm.page, total: vm.total, pageSize: 20, showSizeChanger: false }"
      :scroll="{ x: 900 }"
      @change="changes"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <ResourceActions
            :resource="resource"
            :record="record as Entity"
            :saving="vm.saving"
            @open="open(record as Entity)"
            @qr="group = record as Entity"
            @command="vm.command(record as Entity, $event)"
            @remove="vm.remove(record as Entity)"
          />
        </template>
        <template
          v-else-if="
            ['createTime', 'deadline', 'effectiveTime', 'observedTime', 'lastSuccessTime', 'nextRunTime'].includes(
              String(column.key)
            )
          "
        >
          {{ time(record[String(column.key)]) }}
        </template>
        <template v-else>{{ display(record[String(column.key)]) }}</template>
      </template>
      <template #emptyText><a-empty :description="feText('noRecords')" /></template>
    </a-table>
    <a-modal
      v-model:open="vm.opened"
      :title="config.title"
      width="900px"
      :confirm-loading="vm.saving"
      @ok="vm.save"
    >
      <MappingSamples
        v-if="resource === 'energy/mappings'"
        :state="vm"
        @select="vm.templateId = $event"
        @apply="vm.applyTemplate"
        @preview="vm.preview"
      />
      <RecordForm
        :fields="config.fields"
        :model="vm.form"
        :options="vm.options"
        @change="vm.change"
      />
      <template v-if="resource === 'energy/mappings'">
        <a-button
          :loading="vm.saving"
          @click="vm.preview"
        >
          {{ feText('previewSamplesFromTheLast24Hours') }}
        </a-button>
        <a-table
          v-if="vm.previewRows.length"
          :data-source="vm.previewRows"
          :pagination="false"
          size="small"
          :columns="[
            { title: feText('property'), dataIndex: 'propertyId' },
            { title: feText('rawReading'), dataIndex: 'raw' },
            { title: feText('convertedReading'), dataIndex: 'normalized' },
            { title: feText('unit'), dataIndex: 'unit' }
          ]"
        />
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
    <TaskDetail
      v-if="taskId"
      :id="taskId"
      @close="closeTask"
    />
  </section>
</template>
