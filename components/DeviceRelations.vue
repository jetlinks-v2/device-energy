<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import { useDeviceRelations } from '../hooks/useDeviceRelations'
import { display, time } from '../shared/types'
import TaskDetail from './TaskDetail.vue'
const props = defineProps<{ deviceId: string }>(),
  vm = reactive(useDeviceRelations(props.deviceId))
</script>
<template>
  <a-alert
    v-if="vm.error"
    :message="vm.error"
    type="error"
  />
  <a-button
    :loading="vm.busy"
    @click="vm.refresh"
  >
    {{ feText('refreshRelatedRecords') }}
  </a-button>
  <p>{{ feText('showingTheLatest200AuthorizedRecordsViewMoreInInspectionsMaintenanceOr') }}</p>
  <a-table
    :loading="vm.busy"
    :data-source="vm.tasks"
    row-key="id"
    :columns="[
      { title: feText('task'), key: 'name' },
      { title: feText('type'), key: 'kind' },
      { title: feText('status'), key: 'state' },
      { title: feText('due'), key: 'deadline' }
    ]"
  >
    <template #bodyCell="{ column, record }">
      <a
        v-if="column.key === 'name'"
        @click="vm.selected = record.id"
      >
        {{ record.name }}
      </a>
      <span v-else-if="column.key === 'deadline'">{{ time(record.deadline) }}</span>
      <span v-else>{{ display(record[String(column.key)]) }}</span>
    </template>
  </a-table>
  <a-divider>{{ feText('relatedFaults') }}</a-divider>
  <a-table
    :loading="vm.busy"
    :data-source="vm.faults"
    row-key="id"
    :columns="[
      { title: feText('fault'), dataIndex: 'name' },
      { title: feText('status'), key: 'state' },
      { title: feText('description'), dataIndex: 'description' }
    ]"
  >
    <template #bodyCell="{ column, record }">
      <span v-if="column.key === 'state'">{{ display(record.state) }}</span>
    </template>
  </a-table>
  <TaskDetail
    v-if="vm.selected"
    :id="vm.selected"
    @close="vm.close"
  />
</template>
