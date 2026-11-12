<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive } from 'vue'
import type { Device } from '../shared/types'
import { time, display } from '../shared/types'
import { useDevice } from '../hooks/useDevice'
import RecordForm from './RecordForm.vue'
const props = defineProps<{ device: Device }>(),
  emit = defineEmits<{ close: [] }>(),
  vm = reactive(useDevice(props.device))
</script>

<template>
  <a-drawer
    open
    width="min(1100px,100vw)"
    :title="vm.device.name || vm.device.sourceName"
    @close="emit('close')"
  >
    <a-spin :spinning="vm.busy">
      <a-alert
        v-if="vm.error"
        :message="vm.error"
        type="error"
        show-icon
      />
      <a-tabs>
        <a-tab-pane
          key="profile"
          :tab="feText('facilityProfile')"
        >
          <a-descriptions
            :column="2"
            bordered
            size="small"
          >
            <a-descriptions-item :label="feText('cloudName')">{{ vm.device.sourceName || '—' }}</a-descriptions-item>
            <a-descriptions-item :label="feText('sourceStatus')">{{ display(vm.device.sourceState) }}</a-descriptions-item>
            <a-descriptions-item :label="feText('cloudDeviceId')">{{ vm.device.cloudDeviceId }}</a-descriptions-item>
            <a-descriptions-item :label="feText('syncStatus')">{{ display(vm.device.syncState) }}</a-descriptions-item>
            <a-descriptions-item :label="feText('businessProject')">{{ vm.device.projectName }}</a-descriptions-item>
          </a-descriptions>
          <a-space
            v-if="vm.device.syncState === 'pending-project'"
            style="margin: 16px 0"
          >
            <a-select
              v-model:value="vm.selectedProject"
              :options="vm.device.candidateProjectIds.map((v) => ({ value: v, label: v }))"
              :placeholder="feText('selectOperatingProject')"
              style="width: 240px"
            />
            <j-permission-button :hasPermission="'facility/Devices:save'" @click="vm.confirmProject">{{ feText('confirmProject') }}</j-permission-button>
          </a-space>
          <RecordForm
            :fields="vm.fields"
            :model="vm.form"
            :options="vm.options"
            style="margin-top: 20px"
            @change="vm.change"
          />
          <j-permission-button :hasPermission="'facility/Devices:save'"
            type="primary"
            :loading="vm.busy"
            @click="vm.save"
          >
            {{ feText('saveExtendedProfile') }}
          </j-permission-button>
          <a-divider>{{ feText('deviceQrCode') }}</a-divider>
          <a-qrcode :value="vm.qr" />
          <p>{{ feText('staffCanScanToViewTheProfileAndRelatedTasks') }}</p>
        </a-tab-pane>
        <a-tab-pane
          key="history"
          :tab="feText('activityHistory')"
        >
          <a-timeline>
            <a-timeline-item
              v-for="row in vm.history"
              :key="row.id"
            >
              {{ time(row.createTime) }} · {{ row.creatorName }} · {{ display(row.action) }} {{ row.comment }}
            </a-timeline-item>
          </a-timeline>
          <a-empty
            v-if="!vm.history.length"
            :description="feText('noHistory')"
          />
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>
