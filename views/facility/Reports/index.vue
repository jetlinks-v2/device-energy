<script setup lang="ts">
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import FacilityDataTable from '../../../components/FacilityDataTable.vue'
import { useReportSearch } from '../../../hooks/useReportSearch'
import { useReports } from '../../../hooks/useReports'
import ResourcePage from '../../../components/ResourcePage.vue'
import { display, energyNames } from '../../../shared/types'
const reports = useReports(true)
const vm = reactive(reports)
const search = reactive(useReportSearch(reports, true))
</script>

<template>
  <FacilityWorkspace>
    <section class="facility-page">
      <a-alert
        v-if="vm.error"
        type="error"
        :message="vm.error"
        show-icon
      />
      <ConditionFilter v-model="search.terms" :fields="search.fields" class="facility-search" @change="search.change" />
      <div class="facility-toolbar facility-actions">
        <a-button :disabled="!search.valid || !vm.rows.length || vm.busy" @click="vm.exportCsv">{{ feText('exportCurrentResults') }}</a-button>
      </div>
      <a-descriptions
        bordered
        style="margin-bottom: 20px"
      >
        <a-descriptions-item :label="feText('inspectionAndMaintenanceCompletionRate')">{{ vm.overview.completionRate ?? '—' }}%</a-descriptions-item>
        <a-descriptions-item :label="feText('overdueTasks')">{{ vm.overview.overdue }}</a-descriptions-item>
        <a-descriptions-item :label="feText('pendingAlerts')">{{ vm.overview.alerts }}</a-descriptions-item>
      </a-descriptions>
      <FacilityDataTable
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
          <template v-else-if="column.key === 'usage'">{{ record.usage.value }}</template>
          <template v-else-if="column.key === 'complete'">
            <a-tag :color="record.usage.complete ? 'green' : 'orange'">
              {{ record.usage.complete ? feText('complete') : feText('incomplete') }}
            </a-tag>
          </template>
          <template v-else>{{ display(record[column.dataIndex]) }}</template>
        </template>
      </FacilityDataTable>
      <a-divider>{{ feText('completedAndOverdueWork') }}</a-divider>
      <FacilityDataTable
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
      <FacilityDataTable
        :data-source="Object.entries(vm.operations?.faultTrend || {}).map(([date, count]) => ({ date, count }))"
        row-key="date"
        :columns="[
          { title: feText('date'), dataIndex: 'date' },
          { title: feText('newFaults'), dataIndex: 'count' }
        ]"
      />
      <a-divider>{{ feText('periodAndYearComparisons') }}</a-divider>
      <p>{{ feText('growthRatesAreHiddenWhenDataIsIncompleteOrTheBaselineIs') }}</p>
      <FacilityDataTable
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
      <ConditionFilter v-model="search.periodTerms" :fields="search.periodFields" class="facility-search" @change="search.changePeriod" />
      <div class="facility-toolbar facility-actions">
        <a-button :disabled="!search.valid || !search.periodValid" :loading="vm.busy" @click="vm.loadPeriods">{{ feText('generatePeriodReport') }}</a-button>
      </div>
      <a-collapse v-if="vm.periodRows.length" style="margin-top: 16px">
        <a-collapse-panel
          v-for="row in vm.periodRows"
          :key="row.period"
          :header="row.period"
        >
          <FacilityDataTable
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
              <template v-else>{{ display(record[column.dataIndex]) }}</template>
            </template>
          </FacilityDataTable>
        </a-collapse-panel>
      </a-collapse>
      <a-divider>{{ feText('monthlyEnergyPlanProgress') }}</a-divider>
      <FacilityDataTable
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
          <template v-else>{{ display(record[column.dataIndex]) }}</template>
        </template>
      </FacilityDataTable>
      <ResourcePage resource="targets" />
    </section>
  </FacilityWorkspace>
</template>
