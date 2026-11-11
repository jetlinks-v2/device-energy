<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { clone } from '../../shared/types'
import type { FormInstance } from 'ant-design-vue'
import { feText } from '../../shared/i18n'
import type { MeterRule, MeterStandard } from '../../shared/meterBilling'
const props = defineProps<{ projectId: string; energyType: 'water' | 'electricity'; rule?: MeterRule; standards: MeterStandard[]; saving: boolean }>()
const emit = defineEmits<{ save: [rule: MeterRule] }>()
const form = ref<FormInstance>(), model = ref<MeterRule>({ projectId: props.projectId, energyType: props.energyType, enabled: true, fixedValues: {} })
watch(() => props.rule, rule => { model.value = rule ? clone(rule) : {
  projectId: props.projectId, energyType: props.energyType, enabled: true, fixedValues: {}
} }, { immediate: true })
const subjects = computed(() => [...new Map(props.standards.map(row => [row.subjectId, { value: row.subjectId, label: row.subjectName }])).values()])
const candidates = computed(() => props.standards.filter(row => row.subjectId === model.value.subjectId))
const standard = computed(() => candidates.value.find(row => row.id === model.value.standardId))
const variables = computed(() => standard.value?.variables.filter(v => !v.system) || [])
const fixed = computed(() => variables.value.filter(v => v.code !== model.value.usageVariable))
const changeSubject = () => { model.value.standardId = undefined; changeStandard() }
const changeStandard = () => {
  model.value.usageVariable = undefined; model.value.fixedValues = {}
  if (variables.value.length === 1) model.value.usageVariable = variables.value[0].code
}
const changeUsage = () => { model.value.fixedValues = {} }
async function save() {
  try { await form.value?.validate(); emit('save', clone(model.value)) } catch { /* Ant form keeps validation next to the relevant field. */ }
}
const required = [{ required: true, message: feText('requiredFields') }]
</script>
<template>
  <a-card class="meter-rule-card" :bordered="true">
    <template #title><a-space><AIcon :type="energyType === 'water' ? 'ExperimentOutlined' : 'ThunderboltOutlined'" /><span>{{ feText(energyType === 'water' ? 'waterCharge' : 'electricCharge') }}</span></a-space></template>
    <template #extra><a-tag :color="rule?.enabled ? 'blue' : undefined">{{ rule ? feText(rule.enabled ? 'configured' : 'disabled') : feText('notConfigured') }}</a-tag></template>
    <a-form ref="form" :model="model" layout="vertical">
      <div class="meter-form-grid">
        <a-form-item :label="feText('chargeSubject')" name="subjectId" :rules="required"><a-select v-model:value="model.subjectId" :options="subjects" show-search option-filter-prop="label" @change="changeSubject" /></a-form-item>
        <a-form-item :label="feText('chargeStandard')" name="standardId" :rules="required"><a-select v-model:value="model.standardId" :options="candidates.map(s => ({ value: s.id, label: s.name }))" show-search option-filter-prop="label" @change="changeStandard" /></a-form-item>
      </div>
      <a-form-item :label="feText('chargeFormula')"><div class="meter-formula">{{ standard?.formula || feText('noFormula') }}</div></a-form-item>
      <a-form-item :label="feText('usageVariable')" name="usageVariable" :rules="required"><a-select v-model:value="model.usageVariable" :options="variables.map(v => ({ value: v.code, label: v.name }))" @change="changeUsage" /></a-form-item>
      <div v-if="fixed.length" class="meter-form-grid"><a-form-item v-for="variable in fixed" :key="variable.code" :label="variable.name" :name="['fixedValues', variable.code]" :rules="required"><a-input-number v-model:value="model.fixedValues[variable.code]" :min="0" string-mode /></a-form-item></div>
      <div class="meter-form-grid">
        <a-form-item :label="feText('effectiveFrom')" name="effectiveFrom" :rules="required"><a-date-picker v-model:value="model.effectiveFrom" value-format="YYYY-MM-DD" /></a-form-item>
        <a-form-item :label="feText('effectiveTo')"><a-date-picker v-model:value="model.effectiveTo" value-format="YYYY-MM-DD" /></a-form-item>
      </div>
      <div class="meter-rule-footer"><a-space><a-switch v-model:checked="model.enabled" /><span>{{ feText('activeRule') }}</span></a-space><j-permission-button hasPermission="facility/Configuration/MeterBilling:save" type="primary" :loading="saving" @click="save">{{ feText('save') }}</j-permission-button></div>
    </a-form>
  </a-card>
</template>
