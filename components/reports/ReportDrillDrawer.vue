<script setup lang="ts">
import { computed } from 'vue'
import { feText } from '../../shared/i18n'
import { display, taskTime, type Pager, type Query } from '../../shared/types'
import { faultState } from '../../shared/faults'
import { alertHandling, alertSignal } from '../../shared/alerts'
import type { ReportDetail, ReportDrill } from './reportModel'
const props = defineProps<{ drill: ReportDrill; request: (query: Query) => Promise<{ success: boolean; result: Pager<ReportDetail> }> }>()
const emit = defineEmits<{ close: []; original: [ReportDetail] }>()
const columns = computed(() => [
  { title: feText('name'), dataIndex: 'name', key: 'name', scopedSlots: true, width: 220 },
  ...(props.drill.source === 'energy' ? [
    { title: feText('usage'), dataIndex: 'usage', key: 'usage', scopedSlots: true, width: 160 },
    { title: feText('unit'), dataIndex: 'unit', key: 'unit', scopedSlots: true, width: 90 }
  ] : [
    { title: feText('deviceName'), dataIndex: 'deviceName', key: 'deviceName', scopedSlots: true, width: 160 },
    { title: feText('status'), dataIndex: 'state', key: 'state', scopedSlots: true, width: 130 },
    ...(props.drill.source === 'alerts' ? [{ title: feText('processingStatus'), dataIndex: 'processingState', key: 'processingState', scopedSlots: true, width: 130 }] : []),
    { title: feText('time'), dataIndex: props.drill.source === 'work' ? 'scheduledTime' : props.drill.source === 'alerts' ? 'firstTime' : 'createTime', key: 'time', scopedSlots: true, width: 185 }
  ]), { title: feText('actions'), key: 'actions', scopedSlots: true, width: 160 }
])
</script>
<template>
  <a-drawer open :title="drill.title" width="min(960px, 100vw)" @close="emit('close')">
    <j-pro-table mode="TABLE" type="PAGE" :columns="columns" :request="request" :params="drill" :row-key="(row: ReportDetail) => row.id || row.deviceId"
      :alert-show="false" :pagination="{ pageSize: 12 }" :scroll="{ x: 850 }">
      <template #name="record">{{ record.name || '—' }}</template>
      <template #deviceName="record">{{ record.deviceName || '—' }}</template>
      <template #state="record">{{ drill.source === 'faults' ? faultState(record.state)?.label || display(record.state) : drill.source === 'alerts' ? alertSignal(record.state) : display(record.state) }}</template>
      <template #processingState="record">{{ alertHandling(record.processingState) }}</template>
      <template #time="record">{{ taskTime(record[drill.source === 'work' ? 'scheduledTime' : drill.source === 'alerts' ? 'firstTime' : 'createTime']) }}</template>
      <template #usage="record">{{ record.usage?.value ?? '—' }} <a-tag v-if="!record.usage?.complete" color="orange">{{ feText('incomplete') }}</a-tag></template>
      <template #unit="record">{{ record.unit }}</template>
      <template #actions="record"><a-button type="link" @click="emit('original', record)">{{ feText('reportViewRecord') }}</a-button></template>
    </j-pro-table>
  </a-drawer>
</template>
