<script setup lang="ts">
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useReports } from '../../../hooks/useReports'
import { display } from '../../../shared/types'
const vm = reactive(useReports())
const metrics = [
  { key: 'devices', label: feText('totalDevices') },
  { key: 'online', label: feText('onlineDevices') },
  { key: 'todayinspection', label: feText('inspectionsToday') },
  { key: 'todaymaintenance', label: feText('maintenanceToday') },
  { key: 'overdue', label: feText('overdueTasks') },
  { key: 'alerts', label: feText('pendingAlerts') },
  { key: 'notificationFailures', label: feText('failedNotifications') }
]
</script>

<template>
  <FacilityWorkspace>
    <section class="facility-page">
      <a-page-header
        :title="feText('facilityAndEnergyManagement')"
        :sub-title="feText('deviceOperationsAndEnergyMonitoring')"
      />
      <div class="facility-toolbar">
        <a-select
          v-model:value="vm.projectId"
          :options="vm.projects"
          allow-clear
          :placeholder="feText('allBusinessProjects')"
          class="facility-toolbar__project"
        />
        <a-button
          :loading="vm.busy"
          @click="vm.refresh"
        >
          {{ feText('refresh') }}
        </a-button>
      </div>
      <a-alert
        v-if="vm.error"
        type="error"
        :message="vm.error"
        show-icon
      />
      <a-spin :spinning="vm.busy">
        <div class="facility-metrics">
          <a-card v-for="metric in metrics" :key="metric.key">
              <a-statistic
                :title="metric.label"
                :value="(vm.overview[metric.key] as number) ?? 0"
              />
          </a-card>
        </div>
        <a-card
          :title="feText('energyUsageInTheLast24Hours')"
          style="margin-top: 20px"
        >
          <a-table
            :data-source="vm.rows"
            :row-key="(r) => r.deviceId + r.propertyId"
            :columns="[
              { title: feText('meter'), dataIndex: 'name' },
              { title: feText('energy'), dataIndex: 'energyType' },
              { title: feText('usage'), key: 'usage' },
              { title: feText('unit'), dataIndex: 'unit' }
            ]"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'energyType'">
                {{ display(record.energyType) }}
              </template>
              <template v-if="column.key === 'usage'">
                {{ record.usage.value }}
                <a-tag
                  v-if="!record.usage.complete"
                  color="orange"
                >
                  {{ feText('incompleteData') }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-spin>
    </section>
  </FacilityWorkspace>
</template>
