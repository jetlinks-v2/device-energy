<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useScannedGroup } from '../hooks/useScannedGroup'
import { display, time } from '../../../shared/types'
const vm = reactive(useScannedGroup(String(useRoute().params.id)))
</script>
<template>
  <div class="page">
    <a-button @click="$router.push('/')">{{ feText('backToWorkspace') }}</a-button>
    <h2>{{ vm.group?.name || feText('equipmentRoomsGroups') }}</h2>
    <p>{{ vm.group?.location }}</p>
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="error"
    />
    <a-button
      :loading="vm.busy"
      @click="vm.refresh"
    >
      {{ feText('refreshTasks') }}
    </a-button>
    <p class="muted">{{ feText('latest200AuthorizedDeviceTasks') }}</p>
    <a-card
      v-for="task in vm.tasks"
      :key="task.id"
      class="task-card"
      @click="$router.push('/tasks/' + task.id)"
    >
      <h3>{{ task.name }}</h3>
      <p>{{ task.deviceName }} · {{ display(task.kind) }} · {{ display(task.state) }}</p>
      <p>{{ feText('due') }} {{ time(task.deadline) }}</p>
    </a-card>
    <a-empty
      v-if="!vm.busy && !vm.tasks.length"
      :description="feText('noAuthorizedTasks')"
    />
  </div>
</template>
