<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import { useTask } from '../hooks/useTask'
import { display, time } from '../shared/types'
import { actionNames, canTransfer, canWithdraw } from '../shared/taskActions'
import AttachmentsEditor from './AttachmentsEditor.vue'
import ExecutionForm from './ExecutionForm.vue'
const props = defineProps<{ id: string }>(),
  emit = defineEmits<{ close: [] }>(),
  vm = reactive(useTask(props.id))
</script>

<template>
  <a-drawer
    open
    width="min(900px,100vw)"
    :title="feText('inspectionAndMaintenanceTask')"
    @close="emit('close')"
  >
    <a-spin :spinning="vm.busy">
      <a-alert
        v-if="vm.error"
        :message="vm.error"
        type="info"
        show-icon
      />
      <template v-if="vm.task">
        <a-descriptions
          bordered
          :column="2"
        >
          <a-descriptions-item :label="feText('device')">{{ vm.task.deviceName }}</a-descriptions-item>
          <a-descriptions-item :label="feText('status')">{{ display(vm.task.state) }}</a-descriptions-item>
          <a-descriptions-item :label="feText('mode')">{{ display(vm.task.mode) }}</a-descriptions-item>
          <a-descriptions-item :label="feText('deadline')">{{ time(vm.task.deadline) }}</a-descriptions-item>
        </a-descriptions>
        <a-space
          style="margin: 16px 0"
          wrap
        >
          <j-permission-button :hasPermission="'facility/' + (vm.task.kind === 'maintenance' ? 'Maintenance' : 'Inspection') + ':' + (['approve', 'reject'].includes(action) ? 'review' : 'execute')"
            v-for="action in vm.actions"
            :key="action"
            type="primary"
            :disabled="vm.busy"
            @click="vm.action(action)"
          >
            {{ actionNames[action] }}
          </j-permission-button>
          <a-input
            v-model:value="vm.comment"
            :placeholder="feText('reviewRectificationNotes')"
          />
        </a-space>
        <AttachmentsEditor
          v-if="vm.task.instructionAttachments?.length"
          :ids="vm.task.instructionAttachments"
          readonly
        />
        <ExecutionForm
          v-if="vm.executable"
          :task="vm.task"
          :results="vm.results"
          :busy="vm.busy"
          @change="vm.results = $event"
          @photo="vm.photo"
          @submit="vm.submit"
          @draft="vm.draft"
        />
        <template v-else>
          <a-card
            v-for="result in vm.task.results"
            :key="result.itemId"
            size="small"
          >
            <p>{{ vm.task.standardSnapshot.find((v) => v.id === result.itemId)?.name }}：{{ result.value }}</p>
            <a-tag
              v-if="result.abnormal"
              color="red"
            >
              {{ feText('abnormal') }}
            </a-tag>
            <p>{{ result.remark }}</p>
          </a-card>
          <a-divider v-if="vm.task.followResults?.length">{{ feText('internalFollowUpResults') }}</a-divider>
          <p
            v-for="result in vm.task.followResults"
            :key="result.itemId"
          >
            {{ vm.task.standardSnapshot.find((v) => v.id === result.itemId)?.name }}：{{ result.value }}
            {{ result.remark }}
          </p>
        </template>
        <a-divider v-if="canTransfer(vm.task) || canWithdraw(vm.task)">{{ feText('taskAssignment') }}</a-divider>
        <a-space v-if="canTransfer(vm.task) || canWithdraw(vm.task)" wrap>
          <a-select
            v-if="canTransfer(vm.task)"
            v-model:value="vm.transferUser"
            :options="vm.employees"
            :placeholder="feText('selectANewAssignee')"
            style="width: 200px"
          />
          <j-permission-button :hasPermission="'facility/' + (vm.task.kind === 'maintenance' ? 'Maintenance' : 'Inspection') + ':dispatch'"
            v-if="canTransfer(vm.task)"
            :disabled="vm.busy || !vm.transferUser"
            @click="vm.action('transfer')"
          >
            {{ feText('reassign') }}
          </j-permission-button>
          <a-popconfirm
            v-if="canWithdraw(vm.task)"
            :title="feText('withdrawThisTaskOfflineSubmissionsWillBeMarkedAsConflicts')"
            @confirm="vm.action('cancel')"
          >
            <j-permission-button :hasPermission="'facility/' + (vm.task.kind === 'maintenance' ? 'Maintenance' : 'Inspection') + ':dispatch'" :disabled="vm.busy" danger>{{ feText('withdrawTask') }}</j-permission-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-spin>
  </a-drawer>
</template>
