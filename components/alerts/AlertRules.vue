<script setup lang="ts">
import { reactive } from 'vue'
import { useAlertRules } from '../../hooks/useAlertRules'
import FacilityDataTable from '../FacilityDataTable.vue'
import { alertType, alertTypes } from '../../shared/alerts'
import { feText } from '../../shared/i18n'
const vm = reactive(useAlertRules())
</script>
<template>
  <div class="operations-search"><a-select v-model:value="vm.projectId" :options="vm.projects" :loading="vm.loading" class="operations-project" :placeholder="feText('businessProject')" /><j-permission-button hasPermission="facility/Alerts:rules" type="primary" :disabled="!vm.projectId" @click="vm.edit()"><AIcon type="PlusOutlined" />{{ feText('ruleAdd') }}</j-permission-button></div>
  <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon />
  <FacilityDataTable :data-source="vm.rows" :pagination="false" :loading="vm.busy" :columns="[{ title: feText('ruleName'), dataIndex: 'name' }, { title: feText('ruleType'), dataIndex: 'ruleType' }, { title: feText('ruleThreshold'), dataIndex: 'threshold' }, { title: feText('status'), key: 'enabled' }, { title: feText('actions'), key: 'actions', width: 200 }]">
    <template #bodyCell="{ column, record }"><template v-if="column.key === 'ruleType'">{{ alertType(record.ruleType) }}</template><template v-else-if="column.key === 'threshold'">{{ ['offline', 'stale'].includes(record.ruleType) ? record.threshold / 60 : record.threshold }} {{ ['offline', 'stale'].includes(record.ruleType) ? feText('minutes') : '' }}</template><template v-else-if="column.key === 'enabled'"><a-tag :color="record.enabled ? 'green' : 'default'">{{ feText(record.enabled ? 'ruleEnabled' : 'ruleDisabled') }}</a-tag></template><template v-else-if="column.key === 'actions'"><a-space><j-permission-button hasPermission="facility/Alerts:rules" type="link" @click="vm.edit(record)">{{ feText('edit') }}</j-permission-button><j-permission-button :hasPermission="'facility/Alerts:toggle'" type="link" :loading="vm.saving" @click="vm.toggle(record)">{{ feText(record.enabled ? 'disable' : 'enable') }}</j-permission-button></a-space></template></template>
  </FacilityDataTable><a-pagination v-if="vm.total > 12" v-model:current="vm.page" :page-size="12" :total="vm.total" :show-size-changer="false" size="small" />
  <a-drawer :open="vm.opened" :title="feText('alertRules')" width="min(680px, 100vw)" :closable="!vm.saving" :mask-closable="!vm.saving" @close="vm.opened = false"><a-alert v-if="vm.formError" type="error" :message="vm.formError" show-icon style="margin-bottom:16px" /><a-form layout="vertical">
    <a-form-item :label="feText('ruleName')" required><a-input v-model:value="vm.form.name" :maxlength="256" /></a-form-item>
    <a-form-item :label="feText('ruleType')" required><a-select v-model:value="vm.form.ruleType" :options="alertTypes()" /></a-form-item>
    <a-form-item v-if="vm.form.ruleType !== 'plan'" :label="feText('ruleScope')" required><a-radio-group v-model:value="vm.range"><a-radio-button value="project">{{ feText('ruleProject') }}</a-radio-button><a-radio-button value="group">{{ feText('ruleGroup') }}</a-radio-button><a-radio-button value="device">{{ feText('ruleDevice') }}</a-radio-button></a-radio-group></a-form-item>
    <a-form-item v-if="vm.range === 'group' && vm.form.ruleType !== 'plan'" :label="feText('deviceGroup')" required><a-select v-model:value="vm.form.groupId" :options="vm.groups" show-search option-filter-prop="label" /></a-form-item>
    <a-form-item v-if="vm.range === 'device' && vm.form.ruleType !== 'plan'" :label="feText('deviceName')" required><a-select v-model:value="vm.form.deviceId" :options="vm.devices" show-search :filter-option="false" @search="vm.searchDevices" /></a-form-item>
    <div class="rule-condition"><h3>{{ feText('ruleCondition') }}</h3>
      <a-form-item v-if="vm.metric || vm.form.ruleType === 'plan'" :label="feText('energyType')" required><a-select v-model:value="vm.form.energyType" :options="[{ value: 'water', label: feText('water') }, { value: 'electricity', label: feText('electricity') }, { value: 'gas', label: feText('gas') }]" /></a-form-item>
      <a-form-item v-if="vm.metric && vm.range !== 'device'" :label="feText('ruleReference')" required><a-select v-model:value="vm.referenceDevice" :options="vm.devices" show-search :filter-option="false" @search="vm.searchDevices" /></a-form-item>
      <a-form-item v-if="vm.metric" :label="feText('ruleProperty')" required><a-select v-model:value="vm.form.propertyId" :options="vm.properties" :placeholder="feText('ruleNoProperties')" show-search option-filter-prop="label" /></a-form-item>
      <a-form-item v-if="['offline', 'stale'].includes(vm.form.ruleType || '')" :label="feText('ruleDuration')" required><a-input-number v-model:value="vm.minutes" :min="1" :max="43200" :precision="0" style="width:100%" /></a-form-item>
      <a-form-item v-else-if="!['state', 'reading-anomaly'].includes(vm.form.ruleType || '')" :label="feText('ruleThreshold')" required><a-input-number v-model:value="vm.form.threshold" :min="0" :precision="2" style="width:100%" /></a-form-item>
      <a-form-item v-if="['usage', 'instant', 'balance', 'plan'].includes(vm.form.ruleType || '')" :label="feText('ruleCritical')"><a-input-number v-model:value="vm.form.criticalThreshold" :min="0" :precision="2" style="width:100%" /></a-form-item>
      <a-form-item v-if="vm.form.ruleType === 'state'" :label="feText('stateValueThatTriggersTheAlert')" required><a-input v-model:value="vm.form.stateValue" :maxlength="256" /></a-form-item>
      <a-form-item v-if="vm.form.ruleType === 'usage'" :label="feText('usagePeriod')" required><a-radio-group v-model:value="vm.form.period"><a-radio value="day">{{ feText('daily') }}</a-radio><a-radio value="month">{{ feText('month') }}</a-radio></a-radio-group></a-form-item>
    </div>
    <a-form-item :label="feText('ruleFallback')" required><a-select v-model:value="vm.form.notifyUserId" :options="vm.people" show-search option-filter-prop="label" /></a-form-item>
    <a-form-item :label="feText('ruleRepeat')" required><a-input-number v-model:value="vm.form.repeatHours" :min="1" :max="720" :precision="0" style="width:100%" /></a-form-item>
  </a-form><template #footer><a-space><a-button :disabled="vm.saving" @click="vm.opened = false">{{ feText('cancel') }}</a-button><a-button type="primary" :loading="vm.saving" @click="vm.save">{{ feText('save') }}</a-button></a-space></template></a-drawer>
</template>
<style scoped>.rule-condition{padding:20px 0 0;border-top:1px solid #e8edf3}.rule-condition h3{font-size:15px;margin:0 0 20px}</style>
