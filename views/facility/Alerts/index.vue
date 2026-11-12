<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import AlertRules from '../../../components/alerts/AlertRules.vue'
import FaultAction from '../../../components/faults/FaultAction.vue'
import { useAlertCenter } from '../../../hooks/useAlertCenter'
import { useFaults } from '../../../hooks/useFaults'
import { alertHandling, alertSignal, alertType, alertTypes, alertValue, alertProcess } from '../../../shared/alerts'
import { taskTime } from '../../../shared/types'
import { feText } from '../../../shared/i18n'
import '../../../styles/operations.css'
const vm = reactive(useAlertCenter()), faults = reactive(useFaults(false)), tab = ref('events'), filters = ref<ConditionFilterTerm[]>([])
const listPane = ref<HTMLElement>(), detailPane = ref<HTMLElement>()
watch(() => vm.selected?.id, () => detailPane.value?.scrollTo({ top: 0 }), { flush: 'post' })
watch(() => vm.page, () => listPane.value?.scrollTo({ top: 0 }), { flush: 'post' })
const fields = [{ title: feText('ruleName'), dataIndex: 'name', search: { type: 'string' as const } },
  { title: feText('ruleType'), dataIndex: 'ruleType', search: { type: 'select' as const, options: alertTypes() } }]
async function registerFault() {
  const row = vm.selected
  if (!row?.deviceId) return
  faults.projectId = vm.projectId
  await nextTick()
  void faults.open('create', { deviceId: row.deviceId, sourceType: 'alert', sourceId: row.id,
    description: `${row.name} · ${taskTime(row.firstTime)} · ${alertValue(row.value, row.unit)}` })
}
</script>
<template>
  <FacilityWorkspace><section class="facility-page operations-workspace" :class="{ 'operations-master-detail': tab === 'events' }">
    <a-tabs v-model:active-key="tab"><a-tab-pane key="events" :tab="feText('alertEvents')" /><a-tab-pane key="rules" :tab="feText('alertRules')" /></a-tabs>
    <AlertRules v-if="tab === 'rules'" />
    <template v-else>
      <div class="operations-search"><a-select v-model:value="vm.projectId" :options="vm.projects" :loading="vm.loading" class="operations-project" :placeholder="feText('businessProject')" /><ConditionFilter v-model="filters" :fields="fields" @change="vm.terms = $event.filter.terms" /></div>
      <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon><template #action><a-button @click="vm.load">{{ feText('retry') }}</a-button></template></a-alert>
      <div class="operations-status"><a-radio-group v-model:value="vm.scope"><a-radio-button value="device">{{ feText('alertDeviceScope') }}</a-radio-button><a-radio-button value="plan">{{ feText('alertPlanScope') }}</a-radio-button></a-radio-group>
        <a-select v-model:value="vm.handling" style="width:140px" :options="[{ value: 'all', label: feText('all') }, { value: 'open', label: feText('alertUnhandled') }, { value: 'processing', label: feText('alertHandlingNow') }, { value: 'closed', label: feText('alertHandled') }]" /><a-checkbox v-if="vm.scope === 'device'" v-model:checked="vm.historyMode">{{ feText('alertPast') }}</a-checkbox></div>
      <div class="operations-split"><a-spin :spinning="vm.busy" wrapper-class-name="operations-master"><div ref="listPane" class="operations-list"><button v-for="row in vm.rows" :key="row.id" class="operations-row" :class="{ selected: row.id === vm.selected?.id }" @click="vm.select(row)"><div class="operations-row-head"><strong>{{ row.name }}</strong><a-tag :color="row.level === 'critical' ? 'red' : 'orange'">{{ row.level === 'critical' ? feText('criticalThreshold') : feText('alertThreshold') }}</a-tag></div><p>{{ alertType(row.ruleType) }} · {{ alertValue(row.value, row.unit) }}</p><div class="operations-meta"><span>{{ alertSignal(row.state) }}</span><span>{{ alertHandling(row.processingState) }}</span><span>{{ taskTime(row.lastTime) }}</span></div></button><a-empty v-if="!vm.rows.length && !vm.busy" :description="feText('alertNoEvents')" /></div><a-pagination v-if="vm.total > 12" v-model:current="vm.page" :page-size="12" :total="vm.total" :show-size-changer="false" size="small" /></a-spin>
        <div ref="detailPane" class="operations-detail"><a-spin :spinning="vm.detailBusy"><template v-if="vm.selected"><div class="operations-detail-head"><div><h2>{{ vm.selected.name }}</h2><p>{{ alertType(vm.selected.ruleType) }}</p></div><a-tag :color="vm.selected.state === 'recovered' ? 'green' : 'orange'">{{ alertSignal(vm.selected.state) }}</a-tag></div>
          <a-descriptions :column="2" size="small"><a-descriptions-item :label="feText('alertHandling')">{{ alertHandling(vm.selected.processingState) }}</a-descriptions-item><a-descriptions-item :label="feText('currentValue')">{{ alertValue(vm.selected.value, vm.selected.unit) }}</a-descriptions-item><a-descriptions-item :label="feText('threshold')">{{ alertValue(vm.selected.threshold, vm.selected.unit) }}</a-descriptions-item><a-descriptions-item :label="feText('alertOccurrences')">{{ vm.selected.occurrences ?? 1 }}</a-descriptions-item><a-descriptions-item :label="feText('alertFirst')">{{ taskTime(vm.selected.firstTime) }}</a-descriptions-item><a-descriptions-item :label="feText('alertLast')">{{ taskTime(vm.selected.lastTime) }}</a-descriptions-item><a-descriptions-item :label="feText('alertRecovery')">{{ taskTime(vm.selected.recoveredTime) }}</a-descriptions-item></a-descriptions>
          <p v-if="vm.selected.comment">{{ vm.selected.comment }}</p>
          <div v-if="!vm.historyMode" class="facility-actions"><j-permission-button v-if="vm.selected.processingState !== 'closed'" hasPermission="facility/Alerts:handle" @click="vm.action = 'processing'" :disabled="vm.selected.processingState === 'processing'">{{ feText('alertProcess') }}</j-permission-button><j-permission-button v-if="vm.selected.processingState !== 'closed'" hasPermission="facility/Alerts:handle" @click="vm.action = 'closed'">{{ feText('alertFinish') }}</j-permission-button><j-permission-button v-if="vm.selected.deviceId" hasPermission="facility/Alerts:fault" @click="registerFault">{{ feText('alertTurnFault') }}</j-permission-button></div>
          <a-divider orientation="left">{{ feText('alertHistory') }}</a-divider><div v-for="row in vm.history" :key="row.id" class="alert-episode"><span>{{ taskTime(row.firstTime) }} — {{ row.recoveredTime ? taskTime(row.recoveredTime) : feText('alertAbnormal') }}</span><a-tag>{{ alertHandling(row.processingState) }}</a-tag></div><a-pagination v-if="vm.historyTotal > 15" :current="vm.historyPage" :total="vm.historyTotal" :page-size="15" size="small" :show-size-changer="false" @change="vm.select(vm.selected, $event, vm.processPage)" />
          <a-divider orientation="left">{{ feText('processingRecords') }}</a-divider><a-timeline><a-timeline-item v-for="log in vm.processes" :key="log.id"><strong>{{ log.creatorName }}</strong> · {{ taskTime(log.createTime) }}<p>{{ alertProcess(log, vm.selected.unit) }}</p></a-timeline-item></a-timeline><a-pagination v-if="vm.processTotal > 20" :current="vm.processPage" :total="vm.processTotal" :page-size="20" size="small" :show-size-changer="false" @change="vm.select(vm.selected, vm.historyPage, $event)" />
        </template><a-empty v-else :description="feText('alertSelect')" /></a-spin></div></div>
    </template>
    <a-modal :open="!!vm.action" :title="feText(vm.action === 'closed' ? 'alertFinish' : 'alertProcess')" :confirm-loading="vm.actionBusy" :ok-button-props="{ disabled: vm.action === 'closed' && !vm.comment.trim() }" @cancel="vm.action = ''" @ok="vm.handle"><a-form layout="vertical"><a-form-item :label="feText('alertCloseReason')" :required="vm.action === 'closed'"><a-textarea v-model:value="vm.comment" :rows="4" :maxlength="4000" /></a-form-item></a-form></a-modal>
    <FaultAction :vm="faults" />
  </section></FacilityWorkspace>
</template>
<style scoped>.alert-episode{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #edf1f5}.operations-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.operations-detail-head h2{font-size:18px;margin:0 0 8px}.operations-detail-head p{color:#52657b}</style>
