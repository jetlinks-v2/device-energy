<script setup lang="ts">
import CorePagination from '@jetlinks-web-core/components/CorePagination'
import { reactive } from 'vue'
import { useAlertRules } from '../../hooks/useAlertRules'
import FacilityDataTable from '../FacilityDataTable.vue'
import CycleRuleSummary from '../CycleRuleSummary.vue'
import { alertType, alertTypes } from '../../shared/alerts'
import { feText } from '../../shared/i18n'
const vm = reactive(useAlertRules())
</script>
<template>
  <div class="operations-search"><a-select v-model:value="vm.projectId" :options="vm.projects" :loading="vm.loading" show-search option-filter-prop="label" class="operations-project" :placeholder="feText('businessProject')" /><j-permission-button hasPermission="facility/Alerts:rules" type="primary" :disabled="!vm.projectId" @click="vm.edit()"><AIcon type="PlusOutlined" />{{ feText('ruleAdd') }}</j-permission-button></div>
  <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon />
  <FacilityDataTable :data-source="vm.rows" :pagination="false" :loading="vm.busy" :columns="[{ title: feText('ruleName'), dataIndex: 'name' }, { title: feText('ruleType'), dataIndex: 'ruleType' }, { title: feText('ruleCondition'), dataIndex: 'threshold' }, { title: feText('status'), key: 'enabled' }, { title: feText('actions'), key: 'actions', width: 200 }]">
    <template #bodyCell="{ column, record }"><template v-if="column.key === 'ruleType'">{{ alertType(record.ruleType) }}</template><template v-else-if="column.key === 'threshold'">{{ record.ruleType === 'dueSoon' ? (record.legacySchedule ? feText('reminderLegacyTiming') : `${feText('reminderLeadMinutes')} ${record.staleAfterSeconds / 60}`) : record.ruleType === 'overdue' ? feText('reminderAtDeadline') : `${record.threshold} %` }}</template><template v-else-if="column.key === 'enabled'"><a-tag :color="record.enabled ? 'green' : 'default'">{{ feText(record.enabled ? 'ruleEnabled' : 'ruleDisabled') }}</a-tag></template><template v-else-if="column.key === 'actions'"><a-space><j-permission-button hasPermission="facility/Alerts:rules" type="link" @click="vm.edit(record)">{{ feText('edit') }}</j-permission-button><j-permission-button :hasPermission="'facility/Alerts:toggle'" type="link" :loading="vm.saving" @click="vm.toggle(record)">{{ feText(record.enabled ? 'disable' : 'enable') }}</j-permission-button></a-space></template></template>
  </FacilityDataTable><CorePagination v-model:current="vm.page" v-model:page-size="vm.pageSize" :total="vm.total" />
  <a-drawer :open="vm.opened" :title="feText('businessReminderRules')" width="min(680px, 100vw)" :closable="!vm.saving" :mask-closable="!vm.saving" @close="vm.opened = false"><a-alert v-if="vm.formError" type="error" :message="vm.formError" show-icon style="margin-bottom:16px" /><a-form layout="vertical">
    <a-form-item :label="feText('businessProject')" required><a-select v-model:value="vm.form.projectId" :options="vm.projects" :loading="vm.loading" :disabled="!!vm.form.id || vm.saving" show-search option-filter-prop="label" :placeholder="feText('businessProject')" @change="vm.changeProject" /></a-form-item>
    <a-form-item :label="feText('ruleName')" required><a-input v-model:value="vm.form.name" :maxlength="256" /></a-form-item>
    <a-form-item :label="feText('ruleType')" required><a-select v-model:value="vm.form.ruleType" @change="vm.changeType(String($event))" :options="alertTypes().filter(row => ['plan', 'overdue', 'dueSoon'].includes(row.value))" /></a-form-item>
    <a-form-item v-if="vm.form.ruleType !== 'plan'" :label="feText('ruleScope')" required><a-radio-group v-model:value="vm.range"><a-radio-button value="project">{{ feText('ruleProject') }}</a-radio-button><a-radio-button value="group">{{ feText('ruleGroup') }}</a-radio-button><a-radio-button value="device">{{ feText('ruleDevice') }}</a-radio-button></a-radio-group></a-form-item>
    <a-form-item v-if="vm.range === 'group' && vm.form.ruleType !== 'plan'" :label="feText('deviceGroup')" required><a-select v-model:value="vm.form.groupId" :options="vm.groups" :loading="vm.optionsBusy" :disabled="!vm.form.projectId || vm.optionsBusy" show-search option-filter-prop="label" :not-found-content="feText(vm.groups.length ? 'ruleNoMatch' : 'ruleNoGroups')" /></a-form-item>
    <a-form-item v-if="vm.range === 'device' && vm.form.ruleType !== 'plan'" :label="feText('deviceName')" required><a-select v-model:value="vm.form.deviceId" :options="vm.devices" :loading="vm.devicesBusy" :disabled="!vm.form.projectId" show-search :filter-option="false" :not-found-content="feText('ruleNoDevices')" @search="vm.searchDevices" /></a-form-item>
    <template v-if="vm.form.ruleType !== 'plan'">
      <a-form-item :label="feText('taskKind')"><a-select v-model:value="vm.form.taskKind" allow-clear :placeholder="feText('reminderAllKinds')" :options="[{ value: 'inspection', label: feText('inspection') }, { value: 'maintenance', label: feText('maintenance') }]" @change="vm.changeKind" /></a-form-item>
      <a-form-item :label="feText('cyclePlan')"><a-select v-model:value="vm.form.cycleId" allow-clear show-search option-filter-prop="label" :placeholder="feText('reminderAllCycles')" :options="vm.cycles" :loading="vm.cyclesBusy" :disabled="!vm.form.projectId || vm.cyclesBusy" :not-found-content="feText(vm.cycles.length ? 'ruleNoMatch' : 'ruleNoCycles')" @change="vm.changeCycle" /></a-form-item>
      <a-alert type="info" :message="feText('reminderTaskHint')" show-icon style="margin-bottom:16px" />
    </template>
    <div class="rule-condition"><h3>{{ feText('ruleCondition') }}</h3>
      <a-form-item v-if="vm.form.ruleType === 'plan'" :label="feText('energyType')" required><a-select v-model:value="vm.form.energyType" :options="[{ value: 'water', label: feText('water') }, { value: 'electricity', label: feText('electricity') }, { value: 'gas', label: feText('gas') }]" /></a-form-item>
      <a-form-item v-if="vm.form.ruleType === 'dueSoon' && vm.form.legacySchedule" :label="feText('reminderTimingMode')"><a-radio-group v-model:value="vm.timingMode"><a-radio value="legacy">{{ feText('reminderLegacyTiming') }}</a-radio><a-radio value="uniform">{{ feText('reminderUniformTiming') }}</a-radio></a-radio-group></a-form-item>
      <CycleRuleSummary v-if="vm.form.ruleType === 'dueSoon' && vm.timingMode === 'legacy' && vm.form.legacySchedule" :rule="vm.form.legacySchedule" show-warnings style="margin-bottom:16px" />
      <a-form-item v-if="vm.form.ruleType === 'dueSoon' && vm.timingMode === 'uniform'" :label="feText('reminderLeadMinutes')" required><a-input-number v-model:value="vm.minutes" :min="0.01" :max="43200" :precision="2" style="width:100%" /></a-form-item>
      <a-form-item v-if="vm.form.ruleType === 'plan'" :label="feText(vm.form.ruleType === 'plan' ? 'ruleThreshold' : 'reminderTaskCount')" required><a-input-number v-model:value="vm.form.threshold" :min="1" :precision="vm.form.ruleType === 'plan' ? 2 : 0" style="width:100%" /></a-form-item>
      <a-form-item v-if="vm.form.ruleType === 'plan'" :label="feText('ruleCritical')"><a-input-number v-model:value="vm.form.criticalThreshold" :min="0" :precision="2" style="width:100%" /></a-form-item>
    </div>
    <a-form-item v-if="vm.form.ruleType === 'plan'" :label="feText('ruleFallback')" required><a-select v-model:value="vm.form.notifyUserId" :options="vm.people" :loading="vm.optionsBusy" :disabled="!vm.form.projectId || vm.optionsBusy" show-search option-filter-prop="label" :not-found-content="feText(vm.people.length ? 'ruleNoMatch' : 'ruleNoEmployees')" /></a-form-item>
    <a-form-item v-if="vm.form.ruleType === 'plan'" :label="feText('ruleRepeat')" required><a-input-number v-model:value="vm.form.repeatHours" :min="1" :max="720" :precision="0" style="width:100%" /></a-form-item>
  </a-form><template #footer><a-space><a-button :disabled="vm.saving" @click="vm.opened = false">{{ feText('cancel') }}</a-button><a-button type="primary" :loading="vm.saving" :disabled="vm.cyclesBusy" @click="vm.save">{{ feText('save') }}</a-button></a-space></template></a-drawer>
</template>
<style scoped>.rule-condition{padding:20px 0 0;border-top:1px solid #e8edf3}.rule-condition h3{font-size:15px;margin:0 0 20px}</style>
