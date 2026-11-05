<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useScannedDevice } from '../hooks/useScannedDevice'
import { display, time } from '../../../shared/types'
const vm = reactive(useScannedDevice(String(useRoute().params.id)))
</script>
<template>
  <div class="page">
    <a-button @click="$router.push('/')">{{ feText('back') }}</a-button>
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="error"
    />
    <a-spin :spinning="vm.busy">
      <h2>{{ vm.device?.name }}</h2>
      <a-descriptions
        :column="1"
        bordered
      >
        <a-descriptions-item :label="feText('facilityCategory')">{{ vm.device?.categoryName }}</a-descriptions-item>
        <a-descriptions-item :label="feText('location')">{{ vm.device?.location }}</a-descriptions-item>
        <a-descriptions-item :label="feText('modelSpecification')">{{ vm.device?.specification }}</a-descriptions-item>
        <a-descriptions-item :label="feText('status')">{{ display(vm.device?.sourceState) }}</a-descriptions-item>
      </a-descriptions>
      <h3>{{ feText('relatedInspectionsAndMaintenance') }}</h3>
      <a-card
        v-for="task in vm.tasks"
        :key="task.id"
        class="task-card"
        @click="$router.push('/tasks/' + task.id)"
      >
        {{ task.name }} · {{ display(task.state) }}
        <p>{{ feText('due') }} {{ time(task.deadline) }}</p>
      </a-card>
      <a-empty
        v-if="!vm.tasks.length"
        :description="feText('noRelatedTasks')"
      />
    </a-spin>
  </div>
</template>
