<script setup lang="ts">
import { reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useTaskDispatch } from '../hooks/useTaskDispatch'
import { feText } from '../shared/i18n'
import { taskTime } from '../shared/types'
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const vm = reactive(useTaskDispatch(props.id))
const save = async () => {
  if (await vm.save()) { message.success(feText(vm.task?.assigneeId ? 'transferSucceeded' : 'dispatchSucceeded')); emit('saved') }
}
</script>
<template>
  <a-modal open :title="feText(vm.task?.assigneeId ? 'transferTask' : 'dispatchTask')" :width="560" :confirm-loading="vm.busy"
    :ok-text="feText(vm.task?.assigneeId ? 'transferTask' : 'dispatchTask')" :ok-button-props="{ disabled: !vm.userId || !vm.options.length }"
    :mask-closable="!vm.busy" :closable="!vm.busy" :keyboard="!vm.busy"
    :cancel-button-props="{ disabled: vm.busy }" @ok="save" @cancel="emit('close')">
    <a-alert v-if="vm.error" type="error" show-icon :message="vm.error" style="margin-bottom: 16px" />
    <a-spin :spinning="vm.busy">
      <a-descriptions v-if="vm.task" :column="1" size="small">
        <a-descriptions-item :label="feText('task')">{{ vm.task.name }}</a-descriptions-item>
        <a-descriptions-item :label="feText('businessProject')">{{ vm.task.projectName || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="feText('device')">{{ vm.task.deviceName }}</a-descriptions-item>
        <a-descriptions-item :label="feText('taskStartTime')">{{ taskTime(vm.task.scheduledTime) }}</a-descriptions-item>
        <a-descriptions-item :label="feText('taskEndTime')">{{ taskTime(vm.task.deadline) }}</a-descriptions-item>
      </a-descriptions>
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item :label="feText('assignedHandler')" required>
          <a-select v-model:value="vm.userId" :options="vm.options" show-search option-filter-prop="label"
            :disabled="vm.busy" :placeholder="feText(vm.task?.assigneeId ? 'selectAnotherAssignee' : 'selectTaskAssignee')"
            :not-found-content="feText('noTaskAssignees')" />
        </a-form-item>
      </a-form>
      <a-button v-if="vm.error" type="link" :disabled="vm.busy" @click="vm.load">{{ feText('retry') }}</a-button>
    </a-spin>
  </a-modal>
</template>
