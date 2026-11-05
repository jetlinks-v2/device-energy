<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileTask } from '../hooks/useMobileTask'
import { state } from '../services/session'
import { canExecute } from '../../../shared/taskActions'
import { display, time } from '../../../shared/types'
import ExecutionForm from '../../../components/ExecutionForm.vue'
const route = useRoute(),
  vm = reactive(useMobileTask(String(route.params.id))),
  executable = computed(() => !!vm.task && canExecute(vm.task, state.authorization?.user.id || ''))
</script>
<template>
  <div class="page">
    <a-button @click="$router.push('/')">{{ feText('backToWorkspace') }}</a-button>
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="error"
      show-icon
    />
    <a-alert
      v-if="vm.notice"
      :message="vm.notice"
      type="success"
      show-icon
    />
    <a-spin :spinning="vm.busy">
      <template v-if="vm.task">
        <h2>{{ vm.task.name }}</h2>
        <p>{{ vm.task.deviceName }} · {{ display(vm.task.state) }}</p>
        <p>{{ feText('due2') }}{{ time(vm.task.deadline) }}</p>
        <a-space class="toolbar">
          <a-button
            v-if="vm.task.state === 'open'"
            type="primary"
            @click="vm.claim"
          >
            {{ feText('claimAndDownload') }}
          </a-button>
          <a-button
            v-if="executable"
            @click="vm.download"
          >
            {{ feText('downloadUpdateOfflineTask') }}
          </a-button>
        </a-space>
        <a-space
          v-if="vm.task.instructionAttachments?.length"
          wrap
        >
          <a-button
            v-for="(id, index) in vm.task.instructionAttachments"
            :key="id"
            @click="vm.openAttachment(id)"
          >
            {{ feText('workInstructionAttachments') }} {{ index + 1 }}
          </a-button>
        </a-space>
        <ExecutionForm
          v-if="executable"
          :task="vm.task"
          :results="vm.results"
          :busy="vm.busy"
          @change="vm.results = $event"
          @photo="vm.photo"
          @submit="vm.submit"
          @draft="vm.draft"
        />
        <a-empty
          v-else-if="vm.task.state !== 'open'"
          :description="feText('thisTaskDoesNotRequireYourExecution')"
        />
      </template>
    </a-spin>
    <a-modal
      :open="!!vm.attachment"
      :title="feText('workInstructions')"
      :footer="null"
      width="90vw"
      @cancel="vm.closeAttachment"
    >
      <template v-if="vm.attachment">
        <img
          v-if="vm.attachment.type.startsWith('image/')"
          :src="vm.attachment.url"
          :alt="feText('workInstructions')"
          style="max-width: 100%"
        />
        <iframe
          v-else-if="vm.attachment.type === 'application/pdf'"
          :src="vm.attachment.url"
          :title="feText('instructionsPdf')"
          style="width: 100%; height: 70vh; border: 0"
        />
        <a
          :href="vm.attachment.url"
          :download="feText('workInstructions')"
        >
          {{ feText('downloadAttachment') }}
        </a>
      </template>
    </a-modal>
  </div>
</template>
