<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { useReadingReview } from '../../hooks/useReadingReview'
import { resources, resourceCellText } from '../../shared/resources'
import { resourceSearchFields, timeColumns } from '../../shared/resourceSearch'
import { feText } from '../../shared/i18n'
import { time, type Reading, type Option } from '../../shared/types'
import type { TableHandle } from '../../shared/tableQuery'
import ManualReading from './ManualReading.vue'
const props = defineProps<{ options: Record<string, Option[]>; mine?: boolean }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const vm = reactive(useReadingReview(() => emit('changed'), props.mine)), detail = ref<Reading>(), editing = ref<Reading>(), filters = ref<ConditionFilterTerm[]>([])
const resource = resources.readings
const columns = [
  ...resource.columns.filter(column => !['unit', 'source'].includes(column.key)),
  { key: 'creatorName', title: feText('readingSubmittedBy') }
].map(column => ({ title: column.title, dataIndex: column.key, key: column.key, scopedSlots: true,
  width: timeColumns.has(column.key) ? 185 : column.key === 'deviceId' ? 180 : 120 }))
columns.push({ title: feText('actions'), dataIndex: 'actions', key: 'actions', scopedSlots: true, width: 190 })
const statusTabs = [
  { value: 'pending', label: feText('pendingReadingReview') }, { value: 'accepted', label: feText('reviewApproved') },
  { value: 'rejected', label: feText('reviewRejected') },
  ...(props.mine ? [{ value: 'resubmitted', label: feText('readingResubmitted') }] : []),
  { value: 'all', label: feText('reviewAll') }
]
const cell = (key: string, row: Reading) => key === 'status'
  ? statusTabs.find(tab => tab.value === row.status)?.label || resourceCellText(resource, key, row)
  : timeColumns.has(key) ? time(row[key]) : resourceCellText(resource, key, row)
const setTable = (value: unknown) => { vm.table = value ? value as TableHandle : undefined }
const resubmitted = () => {
  editing.value = undefined; vm.success = feText('readingSubmitted'); vm.table?.reload(); emit('changed')
}
const detailFields = computed(() => [
  ...resource.columns.filter(column => column.key !== 'source'),
  { key: 'rawValue', title: feText('rawReading') }, { key: 'creatorName', title: feText('readingSubmittedBy') },
  { key: 'createTime', title: feText('readingSubmissionTime') }
])
</script>
<template>
  <a-modal open :title="feText(mine ? 'manualReadingRecords' : 'manualReadingReview')" :width="'min(1320px, calc(100vw - 48px))'" :footer="null"
    :mask-closable="false" :closable="!vm.busy && !vm.target && !detail && !editing" :keyboard="false"
    :body-style="{ maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' }" @cancel="emit('close')">
    <div class="reading-review">
      <a-tabs :active-key="vm.status" :animated="false" @change="vm.changeStatus">
        <a-tab-pane v-for="tab in statusTabs" :key="tab.value" :tab="tab.label" :disabled="vm.busy || !!vm.target || !!detail || !!editing" />
      </a-tabs>
      <ConditionFilter v-model="filters"
        :fields="resourceSearchFields(resource, options).filter(field => !['source', 'status'].includes(field.dataIndex))"
        @change="vm.filter($event.filter.terms)" />
      <a-alert v-if="(vm.error || vm.contextError) && !vm.target" type="error" show-icon :message="vm.error || vm.contextError" />
      <a-alert v-if="vm.success" type="success" show-icon :message="vm.success" />
      <j-pro-table :key="vm.status" :ref="setTable" mode="TABLE" type="PAGE" row-key="id" :columns="columns"
        :params="vm.params" :request="vm.request" :pagination="{ pageSize: 12 }" :no-pagination="false"
        :alert-show="false" :body-style="{ padding: 0 }" :scroll="{ x: 1320, y: 'min(420px, calc(100dvh - 350px))' }">
        <template v-for="column in columns" :key="column.key" #[column.key]="row">
          <a-space v-if="column.key === 'actions'" :size="0">
            <a-button type="link" :disabled="vm.busy" @click="detail = row">{{ feText('details') }}</a-button>
            <j-permission-button v-if="vm.canEdit(row)" has-permission="facility/Energy:reading-resubmit" type="link"
              :disabled="vm.busy" @click="editing = row">{{ feText('editRejectedReading') }}</j-permission-button>
            <template v-if="!mine && row.status === 'pending'">
              <a-tooltip :title="row.creatorId === vm.userId ? feText('cannotReviewOwnReading') : undefined">
                <span><j-permission-button has-permission="facility/Energy:reading-review" type="link"
                  :disabled="vm.busy || !vm.canReview(row)" @click="vm.start(row, true)">{{ feText('approve') }}</j-permission-button></span>
              </a-tooltip>
              <j-permission-button has-permission="facility/Energy:reading-review" type="link"
                :disabled="vm.busy || !vm.canReview(row)" @click="vm.start(row, false)">{{ feText('reject') }}</j-permission-button>
            </template>
          </a-space>
          <a-tag v-else-if="column.key === 'status'" :color="({ pending: 'processing', accepted: 'success', rejected: 'error' } as Record<string, string>)[row.status]">{{ cell(column.key, row) }}</a-tag>
          <template v-else>{{ cell(column.key, row) }}<template v-if="column.key === 'value' && row.unit"> {{ row.unit }}</template></template>
        </template>
        <template #emptyText><a-empty :description="feText('noManualReadings')" /></template>
      </j-pro-table>
    </div>
    <ManualReading v-if="editing" :projects="options.projects || []" :original="editing" @close="editing = undefined" @saved="resubmitted" />
    <a-modal :open="!!detail" :title="feText('readingDetails')" :width="'min(680px, calc(100vw - 32px))'" :footer="null"
      :body-style="{ maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }" @cancel="detail = undefined">
      <a-descriptions v-if="detail" :column="2" bordered size="small">
        <a-descriptions-item v-for="field in detailFields" :key="field.key" :label="field.title">{{ cell(field.key, detail) }}</a-descriptions-item>
        <a-descriptions-item :label="feText('reasonForManualReading')" :span="2"><span class="reading-review__reason">{{ detail.reason || '—' }}</span></a-descriptions-item>
      </a-descriptions>
    </a-modal>
    <a-modal :open="!!vm.target" :title="feText(vm.approve ? 'confirmApproveReading' : 'confirmRejectReading')"
      :confirm-loading="vm.busy" :mask-closable="false" :closable="!vm.busy" :keyboard="!vm.busy"
      :cancel-button-props="{ disabled: vm.busy }" @cancel="vm.target = undefined" @ok="vm.confirm">
      <a-alert v-if="vm.error" type="error" show-icon :message="vm.error" style="margin-bottom: 12px" />
      <a-descriptions v-if="vm.target" :column="1" size="small">
        <a-descriptions-item :label="feText('deviceName')">{{ cell('deviceId', vm.target) }}</a-descriptions-item>
        <a-descriptions-item :label="feText('readingTimestamp')">{{ time(vm.target.observedTime) }}</a-descriptions-item>
        <a-descriptions-item :label="feText('reading')">{{ vm.target.value }} {{ vm.target.unit }}</a-descriptions-item>
        <a-descriptions-item :label="feText('reasonForManualReading')"><span class="reading-review__reason">{{ vm.target.reason || '—' }}</span></a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </a-modal>
</template>
<style scoped>
.reading-review { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.reading-review :deep(.ant-tabs-nav) { margin-bottom: 0; }
.reading-review__reason { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
