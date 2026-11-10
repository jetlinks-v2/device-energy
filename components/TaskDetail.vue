<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed, reactive } from 'vue'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import SectionCard from '@jetlinks-web-core/components/SectionCard/index.vue'
import { useTask } from '../hooks/useTask'
import { display, taskTime } from '../shared/types'
import { actionNames } from '../shared/taskActions'
import { resourcePermission } from '../shared/permissions'
import AttachmentsEditor from './AttachmentsEditor.vue'
import ExecutionForm from './ExecutionForm.vue'
import TaskChecks from './TaskChecks.vue'
import TaskHistory from './TaskHistory.vue'
const props = defineProps<{ id: string; review?: boolean }>(), emit = defineEmits<{ close: []; changed: [] }>(),
  vm = reactive(useTask(props.id, () => emit('changed')))
const info = computed(() => vm.task ? [
  { label: feText('businessProject'), value: vm.task.projectName || '—' },
  { label: feText('device'), value: vm.task.deviceName },
  { label: feText('type'), value: display(vm.task.kind) },
  { label: feText('taskCreationTime'), value: taskTime(vm.task.createTime) },
  { label: feText('taskStartTime'), value: taskTime(vm.task.scheduledTime) },
  { label: feText('taskEndTime'), value: taskTime(vm.task.deadline) }
] : [])
const statusColor = computed(() => ({ open: 'blue', claimed: 'cyan', executing: 'processing',
  rectify: 'orange', review: 'gold', 'external-submitted': 'gold', completed: 'green', cancelled: 'default', closed: 'default' })[vm.task?.state || ''] || 'blue')
</script>
<template>
  <a-drawer open width="min(900px,100vw)" :title="feText('inspectionAndMaintenanceTask')"
    :closable="!vm.busy" :mask-closable="!vm.busy" :keyboard="!vm.busy" @close="emit('close')">
    <a-spin :spinning="vm.busy">
      <a-alert v-if="vm.error && !vm.pendingAction" :message="vm.error" type="error" show-icon />
      <div v-if="vm.task" class="task-detail">
        <header class="task-detail__header">
          <h2>{{ vm.task.name }}</h2><a-tag :color="statusColor">{{ display(vm.task.state) }}</a-tag>
        </header>
        <SectionCard icon="ProfileOutlined" :title="feText('taskInformation')">
          <KvGrid :items="info" :cols="2" />
        </SectionCard>
        <SectionCard icon="CheckSquareOutlined" :title="feText('checkRequirementsAndResults')">
          <a-alert v-if="vm.task.reviewComment && vm.task.state === 'rectify'" type="warning" show-icon
            :message="vm.task.reviewComment" style="margin-bottom: 12px; white-space: pre-wrap" />
          <AttachmentsEditor v-if="vm.task.instructionAttachments?.length" :ids="vm.task.instructionAttachments" readonly />
          <ExecutionForm v-if="vm.executable" :task="vm.task" :results="vm.results" :busy="vm.busy"
            @change="vm.results = $event" @photo="vm.photo" @submit="vm.submit" @draft="vm.draft" />
          <template v-else>
            <p v-if="vm.task.instructionSnapshot" style="white-space: pre-wrap">{{ vm.task.instructionSnapshot }}</p>
            <TaskChecks :items="vm.task.standardSnapshot || []" :results="vm.task.results || []" />
          </template>
        </SectionCard>
        <SectionCard icon="HistoryOutlined" :title="feText('processingHistory')">
          <TaskHistory :rows="vm.history" :total="vm.historyTotal" :page="vm.historyPage"
            :busy="vm.historyBusy" :error="vm.historyError" @page="vm.loadHistory" />
        </SectionCard>
      </div>
    </a-spin>
    <template v-if="vm.task" #footer>
      <a-space wrap>
        <j-permission-button v-for="action in vm.actions.filter(action => review || !['approve', 'reject'].includes(action))" :key="action"
          :hasPermission="resourcePermission('tasks', vm.task.kind, ['approve', 'reject'].includes(action) ? 'review' : 'execute')"
          :type="action === 'reject' ? 'default' : 'primary'" :disabled="vm.busy" @click="vm.requestAction(action)">
          {{ actionNames[action] }}
        </j-permission-button>
      </a-space>
    </template>
    <a-modal :open="!!vm.pendingAction" :title="actionNames[vm.pendingAction]" :confirm-loading="vm.busy"
      :mask-closable="!vm.busy" :closable="!vm.busy" :keyboard="!vm.busy" :cancel-button-props="{ disabled: vm.busy }"
      @cancel="vm.pendingAction = ''" @ok="vm.action(vm.pendingAction)">
      <a-alert v-if="vm.error" type="error" show-icon :message="vm.error" style="margin-bottom: 12px" />
      <a-form layout="vertical">
        <a-form-item :label="feText(vm.pendingAction === 'reject' ? 'rectificationReason' : 'reviewNotes')" :required="vm.pendingAction === 'reject'">
          <a-textarea v-model:value="vm.comment" :rows="4" :maxlength="256" :disabled="vm.busy" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-drawer>
</template>
<style scoped>
.task-detail { display: flex; flex-direction: column; gap: 16px; }
.task-detail__header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-detail__header h2 { margin: 0; font-size: 18px; overflow-wrap: anywhere; }
.task-detail__header .ant-tag { margin: 0; }
</style>
