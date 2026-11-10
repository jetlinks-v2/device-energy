<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { resources } from '../shared/resources'
import { resourceSearchFields, timeColumns } from '../shared/resourceSearch'
import { resourcePermission } from '../shared/permissions'
import { feText } from '../shared/i18n'
import { display, taskTime, type Option } from '../shared/types'
import type { TableHandle } from '../shared/tableQuery'
import { useTaskReview } from '../hooks/useTaskReview'
import TaskDetail from './TaskDetail.vue'
const props = defineProps<{ kind?: string; options: Record<string, Option[]> }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const vm = reactive(useTaskReview(props.kind, () => emit('changed'))), detailId = ref<string>(), filters = ref<ConditionFilterTerm[]>([])
const fields = computed(() => resourceSearchFields(resources.tasks, props.options, props.kind).filter(field => field.dataIndex !== 'state'))
const columns = computed(() => [
  ...resources.tasks.columns.filter(column => column.key !== 'kind').map(column => ({
    title: column.title, key: 'cell-' + column.key, dataIndex: column.key, scopedSlots: true,
    width: timeColumns.has(column.key) ? 185 : 160
  })),
  { title: feText('actions'), dataIndex: 'actions', key: 'actions', scopedSlots: true, width: 190, fixed: 'right' }
])
const failed = computed(() => vm.outcomes.filter(row => !row.success))
const setTable = (value: unknown) => { vm.table = value ? value as TableHandle : undefined }
const detailChanged = () => { emit('changed'); vm.refresh() }
</script>
<template>
  <a-modal open :title="feText('taskApproval')" :width="'min(1320px, calc(100vw - 48px))'" :footer="null"
    :mask-closable="false" :closable="!vm.busy && !vm.decision && !detailId" :keyboard="false"
    :body-style="{ maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' }" @cancel="emit('close')">
    <div class="task-review">
      <a-tabs :active-key="vm.status" :animated="false" @change="vm.changeStatus($event)">
        <a-tab-pane v-for="tab in (['pending', 'approved', 'rejected', 'all'] as const)" :key="tab"
          :tab="feText(({ pending: 'reviewPending', approved: 'reviewApproved', rejected: 'reviewRejected', all: 'reviewAll' } as const)[tab])"
          :disabled="vm.busy || !!vm.decision || !!detailId" />
      </a-tabs>
      <ConditionFilter v-model="filters" :fields="fields" @change="vm.filter($event.filter.terms)" />
      <a-alert v-if="vm.error && !vm.decision" type="error" show-icon :message="vm.error" />
      <div v-if="vm.status === 'pending'" class="task-review__toolbar">
        <a-space wrap>
          <j-permission-button :hasPermission="resourcePermission('tasks', kind, 'review')" type="primary"
            :disabled="vm.busy || !vm.selected.length" @click="vm.start('approve')">{{ feText('batchApprove') }}</j-permission-button>
          <j-permission-button :hasPermission="resourcePermission('tasks', kind, 'review')"
            :disabled="vm.busy || !vm.selected.length" @click="vm.start('reject')">{{ feText('batchReject') }}</j-permission-button>
        </a-space>
        <span v-if="vm.selected.length">{{ feText('selectedTasks') }} {{ vm.selected.length }} {{ feText('tasksUnit') }}</span>
      </div>
      <a-alert v-if="vm.outcomes.length" :type="failed.length ? 'warning' : 'success'" show-icon
        :message="`${feText('approvalSucceeded')} ${vm.outcomes.filter(row => row.success).length}，${feText('approvalFailed')} ${failed.length}`">
        <template v-if="failed.length" #description>
          <div v-for="row in failed" :key="row.id">{{ row.name }}：{{ row.error }}</div>
        </template>
      </a-alert>
      <j-pro-table :key="vm.status" :ref="setTable" mode="TABLE" type="PAGE" row-key="id" :columns="columns"
        :params="vm.params" :request="vm.request" :row-selection="vm.status === 'pending' ? vm.selection : undefined" :alert-show="false"
        :pagination="{ pageSize: 12 }" :no-pagination="false" :body-style="{ padding: 0 }"
        :scroll="{ x: columns.reduce((sum, column) => sum + column.width, 0), y: 'min(420px, calc(100dvh - 390px))' }">
        <template v-for="column in columns" :key="column.key" #[column.key]="row">
          <a-space v-if="column.key === 'actions'" :size="0">
            <a-button type="link" :disabled="vm.busy" @click="detailId = row.id">{{ feText('details') }}</a-button>
            <j-permission-button v-if="vm.status === 'pending'" :hasPermission="resourcePermission('tasks', kind, 'review')" type="link"
              :disabled="vm.busy" @click="vm.start('approve', [row])">{{ feText('approveTask') }}</j-permission-button>
            <j-permission-button v-if="vm.status === 'pending'" :hasPermission="resourcePermission('tasks', kind, 'review')" type="link"
              :disabled="vm.busy" @click="vm.start('reject', [row])">{{ feText('rejectTask') }}</j-permission-button>
          </a-space>
          <template v-else-if="timeColumns.has(column.dataIndex)">{{ taskTime(row[column.dataIndex]) }}</template>
          <template v-else>{{ display(row[column.dataIndex]) }}</template>
        </template>
        <template #emptyText><a-empty :description="feText(vm.status === 'pending' ? 'noPendingReviews' : 'noReviewTasks')" /></template>
      </j-pro-table>
    </div>
    <TaskDetail v-if="detailId" :id="detailId" :review="vm.status === 'pending'" @close="detailId = undefined" @changed="detailChanged" />
    <a-modal :open="!!vm.decision" :title="feText(vm.decision === 'reject' ? 'confirmRejectTasks' : 'confirmApproveTasks')"
      :confirm-loading="vm.busy" :mask-closable="false" :closable="!vm.busy" :keyboard="!vm.busy"
      :cancel-button-props="{ disabled: vm.busy }" @cancel="vm.decision = undefined" @ok="vm.confirm">
      <p>{{ feText('selectedTasks') }} {{ vm.targets.length }} {{ feText('tasksUnit') }}</p>
      <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon style="margin-bottom: 12px" />
      <a-form layout="vertical">
        <a-form-item :label="feText(vm.decision === 'reject' ? 'rectificationReason' : 'reviewNotes')" :required="vm.decision === 'reject'">
          <a-textarea v-model:value="vm.comment" :rows="4" :maxlength="256" :disabled="vm.busy" />
        </a-form-item>
      </a-form>
      <p v-if="vm.busy">{{ feText('approvalProgress') }} {{ vm.progress }} / {{ vm.targets.length }}</p>
    </a-modal>
  </a-modal>
</template>
<style scoped>
.task-review { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.task-review__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.task-review :deep(.ant-tabs-nav) { margin-bottom: 0; }
.task-review :deep(.ant-alert-description) { max-height: 120px; overflow-y: auto; overflow-wrap: anywhere; }
</style>
