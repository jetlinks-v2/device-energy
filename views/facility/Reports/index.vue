<script setup lang="ts">
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useReports } from '../../../hooks/useReports'
import ResourcePage from '../../../components/ResourcePage.vue'
import { energyNames } from '../../../shared/types'
const vm = reactive(useReports(true))
</script>

<template>
  <FacilityWorkspace>
    <section class="facility-page">
      <a-page-header :title="feText('reports')" />
      <a-alert
        v-if="vm.error"
        type="error"
        :message="vm.error"
        show-icon
      />
      <div class="facility-toolbar">
        <a-select
          v-model:value="vm.projectId"
          :options="vm.projects"
          allow-clear
          :placeholder="feText('allBusinessProjects')"
          class="facility-toolbar__project"
        />
        <a-select
          v-model:value="vm.level"
          :options="[
            { value: 'master', label: feText('masterMeter') },
            { value: 'submeter', label: feText('submeter') },
            { value: 'branch', label: feText('branch') },
            { value: 'other', label: feText('other') }
          ]"
          class="facility-toolbar__level"
        />
        <a-date-picker
          class="facility-toolbar__date"
          show-time
          :placeholder="feText('startTime')"
          @change="(value) => (vm.from = Number(value?.valueOf()) || vm.from)"
        />
        <a-date-picker
          class="facility-toolbar__date"
          show-time
          :placeholder="feText('endTime')"
          @change="(value) => (vm.to = Number(value?.valueOf()) || vm.to)"
        />
        <a-button
          type="primary"
          :loading="vm.busy"
          @click="vm.refresh"
        >
          {{ feText('search') }}
        </a-button>
        <a-button
          :disabled="!vm.rows.length"
          @click="vm.exportCsv"
        >
          {{ feText('exportCurrentResults') }}
        </a-button>
      </div>
      <a-descriptions
        bordered
        style="margin-bottom: 20px"
      >
        <a-descriptions-item :label="feText('inspectionAndMaintenanceCompletionRate')">{{ vm.overview.completionRate ?? '—' }}%</a-descriptions-item>
        <a-descriptions-item :label="feText('overdueTasks')">{{ vm.overview.overdue }}</a-descriptions-item>
        <a-descriptions-item :label="feText('pendingAlerts')">{{ vm.overview.alerts }}</a-descriptions-item>
      </a-descriptions>
      <a-table
        :data-source="vm.rows"
        :loading="vm.busy"
        :row-key="(r) => r.deviceId + r.propertyId"
        :columns="[
          { title: feText('meter'), dataIndex: 'name' },
          { title: feText('energy'), key: 'energy' },
          { title: feText('metric'), dataIndex: 'propertyId' },
          { title: feText('usage'), key: 'usage' },
          { title: feText('unit'), dataIndex: 'unit' },
          { title: feText('completeness'), key: 'complete' }
        ]"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'energy'">{{ energyNames[record.energyType] }}</template>
          <template v-if="column.key === 'usage'">{{ record.usage.value }}</template>
          <template v-if="column.key === 'complete'">
            <a-tag :color="record.usage.complete ? 'green' : 'orange'">
              {{ record.usage.complete ? feText('complete') : feText('incomplete') }}
            </a-tag>
          </template>
        </template>
      </a-table>
      <a-divider>{{ feText('completedAndOverdueWork') }}</a-divider>
      <a-table
        :data-source="vm.operations?.tasks || []"
        row-key="kind"
        :pagination="false"
        :columns="[
          { title: feText('type'), dataIndex: 'kind' },
          { title: feText('tasks'), dataIndex: 'total' },
          { title: feText('completedTasks'), dataIndex: 'completed' },
          { title: feText('completionRate'), dataIndex: 'completionRate' },
          { title: feText('overdueCount'), dataIndex: 'overdue' },
          { title: feText('overdueRate'), dataIndex: 'overdueRate' }
        ]"
      />
      <a-divider>{{ feText('faultTrendsAndNotificationStatistics') }}</a-divider>
      <a-descriptions bordered>
        <a-descriptions-item
          v-for="(count, state) in vm.operations?.notifications"
          :key="state"
          :label="String(state)"
        >
          {{ count }}
        </a-descriptions-item>
      </a-descriptions>
      <a-table
        :data-source="Object.entries(vm.operations?.faultTrend || {}).map(([date, count]) => ({ date, count }))"
        row-key="date"
        :columns="[
          { title: feText('date'), dataIndex: 'date' },
          { title: feText('newFaults'), dataIndex: 'count' }
        ]"
      />
      <a-divider>{{ feText('periodAndYearComparisons') }}</a-divider>
      <p>{{ feText('growthRatesAreHiddenWhenDataIsIncompleteOrTheBaselineIs') }}</p>
      <a-table
        :data-source="vm.comparison"
        :row-key="(row) => row.deviceId + row.propertyId"
        :columns="[
          { title: feText('meter'), dataIndex: 'name' },
          { title: feText('unit'), dataIndex: 'unit' },
          { title: feText('changeFromPreviousPeriod'), dataIndex: 'previousRate' },
          { title: feText('changeFromPreviousYear'), dataIndex: 'lastYearRate' }
        ]"
      />
      <a-divider>{{ feText('dailyMonthlyAnnualReports') }}</a-divider>
      <div class="facility-toolbar">
        <a-select
          v-model:value="vm.period"
          :options="[
            { value: 'day', label: feText('dailyReport') },
            { value: 'month', label: feText('monthlyReport') },
            { value: 'year', label: feText('annualReport') }
          ]"
          class="facility-toolbar__period"
        />
        <a-input-number
          v-model:value="vm.year"
          :min="2000"
          :max="2200"
        />
        <a-input-number
          v-model:value="vm.month"
          :min="1"
          :max="12"
        />
        <a-button
          :loading="vm.busy"
          @click="vm.loadPeriods"
        >
          {{ feText('generatePeriodReport') }}
        </a-button>
      </div>
      <a-collapse v-if="vm.periodRows.length" style="margin-top: 16px">
        <a-collapse-panel
          v-for="row in vm.periodRows"
          :key="row.period"
          :header="row.period"
        >
          <a-table
            :data-source="row.meters"
            :row-key="(r) => r.deviceId + r.propertyId"
            :pagination="false"
            :columns="[
              { title: feText('meter'), dataIndex: 'name' },
              { title: feText('energy'), dataIndex: 'energyType' },
              { title: feText('usage'), key: 'usage' },
              { title: feText('unit'), dataIndex: 'unit' }
            ]"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'usage'">
                {{ record.usage.value }}
                <a-tag
                  v-if="!record.usage.complete"
                  color="orange"
                >
                  {{ feText('incomplete') }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </a-collapse-panel>
      </a-collapse>
      <a-divider>{{ feText('monthlyEnergyPlanProgress') }}</a-divider>
      <a-table
        :data-source="vm.targets"
        row-key="id"
        :columns="[
          { title: feText('project'), dataIndex: 'projectId' },
          { title: feText('energy'), dataIndex: 'energyType' },
          { title: feText('target'), dataIndex: 'target' },
          { title: feText('actual'), dataIndex: 'actual' },
          { title: feText('unit'), dataIndex: 'unit' },
          { title: feText('progress'), dataIndex: 'executionRate' },
          { title: feText('completeness'), key: 'complete' }
        ]"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'complete'">
            <a-tag :color="record.complete ? 'green' : 'orange'">
              {{ record.complete ? feText('complete') : feText('incompleteDataOrInconsistentUnits') }}
            </a-tag>
            <a-tag
              v-if="record.exceeded"
              color="red"
            >
              {{ feText('planTargetReachedOrExceeded') }}
            </a-tag>
          </template>
        </template>
      </a-table>
      <ResourcePage resource="targets" />
    </section>
  </FacilityWorkspace>
</template>
