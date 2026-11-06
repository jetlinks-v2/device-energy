<script setup lang="ts">
import { feText } from '../shared/i18n'
import { reactive, computed } from 'vue'
import type { Device } from '../shared/types'
import { time, display } from '../shared/types'
import { useDevice } from '../hooks/useDevice'
import RecordForm from './RecordForm.vue'
import DeviceRelations from './DeviceRelations.vue'
import SeriesChart from './SeriesChart.vue'
const props = defineProps<{ device: Device }>(),
  emit = defineEmits<{ close: [] }>(),
  vm = reactive(useDevice(props.device))
const points = computed(() => vm.series.map((v) => ({ time: v.observedTime, value: v.value ?? v.textValue ?? '' })))
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
            <a-descriptions-item :label="feText('cloudDevice')">{{ vm.device.cloudDeviceId }}</a-descriptions-item>
            <a-descriptions-item :label="feText('sourceStatus')">{{ display(vm.device.sourceState) }}</a-descriptions-item>
            <a-descriptions-item :label="feText('businessProject')">{{ vm.device.projectName }}</a-descriptions-item>
            <a-descriptions-item :label="feText('syncStatus')">{{ display(vm.device.syncState) }}</a-descriptions-item>
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
          key="energy"
          :tab="feText('liveAndHistoricalData')"
        >
          <a-empty
            v-if="!vm.mapping"
            :description="feText('configureMeteringMetricsInEnergyManagementFirst')"
          />
          <template v-else>
            <a-space wrap>
              <a-select
                v-model:value="vm.property"
                :options="vm.options.properties"
                style="min-width: 200px"
              />
              <a-date-picker
                show-time
                :value="undefined"
                :placeholder="feText('selectStartTime')"
                @change="(value) => (vm.from = Number(value?.valueOf()) || vm.from)"
              />
              <a-date-picker
                show-time
                :value="undefined"
                :placeholder="feText('selectEndTime')"
                @change="(value) => (vm.to = Number(value?.valueOf()) || vm.to)"
              />
              <a-button @click="vm.loadSeries">{{ feText('search') }}</a-button>
            </a-space>
            <p v-if="vm.usage">
              {{ feText('usageForPeriod') }}{{ vm.usage.value }}
              <a-tag :color="vm.usage.complete ? 'green' : 'orange'">
                {{ vm.usage.complete ? feText('completeData') : feText('boundaryReadingsOrCollectedDataAreIncomplete') }}
              </a-tag>
            </p>
            <SeriesChart :values="points" />
            <a-table
              :data-source="vm.series"
              row-key="id"
              size="small"
              :columns="[
                { title: feText('time'), key: 'time' },
                { title: feText('reading'), dataIndex: 'value' },
                { title: feText('unit'), dataIndex: 'unit' },
                { title: feText('source'), dataIndex: 'source' }
              ]"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'time'">{{ time(record.observedTime) }}</template>
              </template>
            </a-table>
            <a-divider>{{ feText('manualReadingRequest') }}</a-divider>
            <a-space wrap>
              <a-date-picker
                show-time
                :placeholder="feText('readingTimestamp')"
                @change="(value) => (vm.manual.observedTime = Number(value?.valueOf()) || Date.now())"
              />
              <a-input-number
                v-model:value="vm.manual.value"
                :placeholder="feText('reading')"
              />
              <a-input
                v-model:value="vm.manual.reason"
                :placeholder="feText('reasonForManualReading')"
              />
              <j-permission-button :hasPermission="'facility/Energy:save'" @click="vm.supplement">{{ feText('submitForReview') }}</j-permission-button>
            </a-space>
          </template>
        </a-tab-pane>
        <a-tab-pane
          key="binding"
          :tab="feText('responsibleCustomerAndContacts')"
        >
          <a-table
            row-key="id"
            :data-source="vm.bindings"
            size="small"
            :columns="[
              { title: feText('responsibleCustomer'), dataIndex: 'customerName' },
              { title: feText('start'), key: 'start' },
              { title: feText('end'), key: 'end' }
            ]"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'start'">{{ time(record.startTime) }}</template>
              <template v-if="column.key === 'end'">{{ record.endTime ? time(record.endTime) : feText('currentlyActive') }}</template>
            </template>
          </a-table>
          <a-form layout="vertical">
            <a-form-item :label="feText('propertySpace')">
              <a-select
                v-model:value="vm.binding.spaceId"
                :options="vm.options.spaces"
              />
            </a-form-item>
            <a-form-item :label="feText('responsibleCustomer')">
              <a-select
                v-model:value="vm.binding.customerId"
                :options="vm.options.customers"
              />
            </a-form-item>
            <a-space
              v-for="(contact, index) in vm.binding.contacts"
              :key="index"
              wrap
            >
              <a-input
                v-model:value="contact.name"
                :placeholder="feText('additionalContacts')"
              />
              <a-input
                v-model:value="contact.telephone"
                :placeholder="feText('smsPhoneNumber')"
              />
              <a-button
                danger
                @click="vm.binding.contacts.splice(index, 1)"
              >
                {{ feText('remove') }}
              </a-button>
            </a-space>
            <p>
              <a-button
                @click="vm.binding.contacts.push({ name: '', telephone: '', smsEnabled: true, portalEnabled: false })"
              >
                {{ feText('addSmsContact') }}
              </a-button>
            </p>
            <a-space>
              <j-permission-button :hasPermission="'facility/Devices:save'"
                type="primary"
                @click="vm.bind"
              >
                {{ feText('confirmBindingChange') }}
              </j-permission-button>
              <a-popconfirm
                :title="feText('endTheCurrentCustomerBinding')"
                @confirm="vm.endBinding"
              >
                <j-permission-button :hasPermission="'facility/Devices:save'" danger>{{ feText('endBinding') }}</j-permission-button>
              </a-popconfirm>
            </a-space>
          </a-form>
        </a-tab-pane>
        <a-tab-pane
          key="work"
          :tab="feText('inspectionsMaintenanceAndFaults')"
        >
          <DeviceRelations :device-id="vm.device.id" />
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
