<script setup lang="ts">
import { reactive } from 'vue'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import ResourcePage from '../../../components/ResourcePage.vue'
import TaskDetail from '../../../components/TaskDetail.vue'
import ReportOperationsPanel from '../../../components/reports/ReportOperationsPanel.vue'
import ReportDrillDrawer from '../../../components/reports/ReportDrillDrawer.vue'
import ReportChart from '../../../components/reports/ReportChart.vue'
import { useReportAnalysis } from '../../../hooks/useReportAnalysis'
import { feText } from '../../../shared/i18n'
import { energyNames } from '../../../shared/types'
const vm = reactive(useReportAnalysis())
const shortcuts = [
  { value: 'month', label: feText('reportThisMonth') }, { value: 'last', label: feText('reportLastMonth') }, { value: 'custom', label: feText('reportCustom') }
]
const levels = [
  { value: 'master', label: feText('masterMeter') }, { value: 'submeter', label: feText('submeter') },
  { value: 'branch', label: feText('branch') }, { value: 'other', label: feText('other') }
]
</script>
<template>
  <FacilityWorkspace>
    <section class="facility-page reports-workspace">
      <div class="reports-filters">
        <ConditionFilter v-model="vm.terms" :fields="vm.fields" @change="vm.change" />
        <a-segmented :value="vm.shortcut" :options="shortcuts" :aria-label="feText('reportPeriod')" @change="vm.setShortcut" />
        <a-button :disabled="!vm.valid || !vm.panel.data || vm.panel.loading || !!vm.panel.error" @click="vm.exportCsv"><AIcon type="DownloadOutlined" />{{ feText('exportCurrentResults') }}</a-button>
      </div>
      <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon />
      <a-tabs v-model:active-key="vm.tab" @change="vm.changeTab">
        <a-tab-pane key="work" :tab="feText('reportOperations')" />
        <a-tab-pane key="faults" :tab="feText('reportFaultAlerts')" />
        <a-tab-pane key="energy" :tab="feText('reportEnergy')" />
      </a-tabs>
      <div class="reports-controls">
        <a-segmented v-if="vm.tab === 'work'" v-model:value="vm.kind" :options="[{ value: 'inspection', label: feText('inspection') }, { value: 'maintenance', label: feText('maintenance') }]" @change="vm.invalidate" />
        <a-segmented v-else-if="vm.tab === 'faults'" v-model:value="vm.faultMode" :options="[{ value: 'faults', label: feText('overviewFaultRecords') }, { value: 'alerts', label: feText('alertEvents') }]" @change="vm.invalidate" />
        <template v-else>
          <a-radio-group v-model:value="vm.energyType" button-style="solid" :class="['reports-energy', vm.energyType]" @change="vm.invalidate"><a-radio-button v-for="(name, type) in energyNames" :key="type" :value="type">{{ name }}</a-radio-button></a-radio-group>
          <a-select v-model:value="vm.level" :options="levels" :aria-label="feText('aggregationLevel')" style="width: 120px" @change="vm.invalidate" />
          <a-segmented v-model:value="vm.period" :options="[{ value: 'day', label: feText('reportDaily') }, { value: 'month', label: feText('reportMonthly') }]" @change="vm.invalidate" />
          <j-permission-button hasPermission="facility/Reports:save" @click="vm.planOpen = true">{{ feText('reportPlanSettings') }}</j-permission-button>
        </template>
        <a-button :loading="vm.panel.loading" @click="vm.refresh"><AIcon type="ReloadOutlined" />{{ feText('refresh') }}</a-button>
        <a-button :disabled="!vm.valid || !vm.panel.data" @click="vm.openDrill()">{{ feText('reportDetails') }}</a-button>
      </div>
      <a-alert v-if="vm.panel.error" type="error" :message="vm.panel.error" show-icon><template #action><a-button size="small" @click="vm.refresh">{{ feText('retry') }}</a-button></template></a-alert>
      <a-spin :spinning="vm.panel.loading">
        <template v-if="vm.tab !== 'energy'"><ReportOperationsPanel :view="vm.view" @drill="vm.chartClick" /></template>
        <template v-else>
          <p class="reports-note">{{ vm.view.note }}</p>
          <a-alert v-if="vm.panels.energy.data?.summary.meterCount === 0" type="info" :message="feText('reportNoMeters')" show-icon><template #action><a-button @click="vm.configureMeters">{{ feText('reportConfigureMeters') }}</a-button></template></a-alert>
          <template v-else>
            <div class="reports-metrics"><div v-for="metric in vm.view.metrics" :key="metric.title"><span>{{ metric.title }}</span><strong>{{ metric.value }}</strong></div></div>
            <a-alert v-if="vm.panels.energy.data && !vm.panels.energy.data.summary.accepted" type="info" :message="feText('reportNoValidReadings')" show-icon />
            <a-alert v-else-if="vm.panels.energy.data && !vm.panels.energy.data.summary.complete" type="warning" :message="feText('reportIncompleteUsage')" show-icon />
            <ReportChart :chart="vm.view.main" @click="vm.chartClick($event)" />
            <p v-if="vm.panels.energy.data?.summary.previousRate == null" class="reports-note">{{ feText('reportNoHistory') }}</p>
            <div class="reports-support"><ReportChart :chart="vm.view.left" @click="vm.openDrill()" /><a-spin :spinning="vm.panels.targets.loading"><a-alert v-if="vm.panels.targets.error" type="error" :message="vm.panels.targets.error" show-icon><template #action><a-button @click="vm.refresh">{{ feText('retry') }}</a-button></template></a-alert><ReportChart v-if="vm.view.right" :chart="vm.view.right" @click="vm.planOpen = true" /><p v-if="vm.panels.targets.data?.count === 0" class="reports-note">{{ feText('reportNoPlan') }}</p></a-spin></div>
          </template>
        </template>
      </a-spin>
      <ReportDrillDrawer v-if="vm.drill" :drill="vm.drill" :request="vm.requestDetails" @close="vm.drill = undefined" @original="vm.original" />
      <TaskDetail v-if="vm.taskId" :id="vm.taskId" @close="vm.taskId = undefined" @changed="vm.refresh" />
      <a-drawer :open="vm.planOpen" :title="feText('reportPlanSettings')" width="min(1000px, 100vw)" destroy-on-close @close="vm.planOpen = false; vm.refresh()"><ResourcePage resource="targets" /></a-drawer>
    </section>
  </FacilityWorkspace>
</template>
<style scoped>
.reports-filters, .reports-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 16px; }
.reports-filters > :first-child { flex: 1; min-width: 320px; }
.reports-controls > :last-child { margin-left: auto; }
.reports-note { color: var(--ant-color-text-secondary); margin: 12px 0; }
.reports-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
.reports-metrics > div { padding: 12px 14px; border-radius: 8px; background: var(--ant-color-fill-quaternary); }
.reports-metrics span { display: block; color: var(--ant-color-text-secondary); font-size: 12px; }
.reports-metrics strong { display: block; margin-top: 5px; font-size: 22px; }
.reports-support { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.reports-energy.water { --ant-color-primary: #0891d2; }.reports-energy.electricity { --ant-color-primary: #7c5ce7; }.reports-energy.gas { --ant-color-primary: #e28a2d; }
@media (max-width: 900px) { .reports-metrics { grid-template-columns: 1fr 1fr; }.reports-support { grid-template-columns: 1fr; } }
</style>
