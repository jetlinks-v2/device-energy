<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FormInstance } from 'ant-design-vue'
import { feText } from '../../shared/i18n'
import type { MeterAssociation, MeterRule, MeterStandard } from '../../shared/meterBilling'
const props = defineProps<{ projectId: string; energyType: 'water' | 'electricity'; rule?: MeterRule; standards: MeterStandard[]; saving: boolean }>()
const emit = defineEmits<{ save: [rule: MeterAssociation] }>()
const form = ref<FormInstance>(), model = ref<MeterAssociation>({ projectId: props.projectId, energyType: props.energyType })
// Submit only the selected association; finance remains the source of formula, variables, prices and dates.
watch(() => props.rule, rule => { model.value = {
  id: rule?.id, version: rule?.version, projectId: props.projectId, energyType: props.energyType,
  subjectId: rule?.subjectId, standardId: rule?.standardId
} }, { immediate: true })
const subjects = computed(() => [...new Map(props.standards.map(row => [row.subjectId, { value: row.subjectId, label: row.subjectName }])).values()])
const candidates = computed(() => props.standards.filter(row => row.subjectId === model.value.subjectId))
const required = [{ required: true, message: feText('requiredFields') }]
async function save() {
  try { await form.value?.validate(); emit('save', { ...model.value }) } catch { /* Keep field validation next to the selection. */ }
}
</script>
<template>
  <a-card class="meter-rule-card" :bordered="true">
    <template #title><a-space><AIcon :type="energyType === 'water' ? 'ExperimentOutlined' : 'ThunderboltOutlined'" /><span>{{ feText(energyType === 'water' ? 'waterCharge' : 'electricCharge') }}</span></a-space></template>
    <template #extra><a-tag :color="rule?.enabled ? 'blue' : undefined">{{ rule ? feText(rule.enabled ? 'configured' : 'disabled') : feText('notConfigured') }}</a-tag></template>
    <a-form ref="form" :model="model" layout="vertical" :disabled="saving">
      <div class="meter-form-grid">
        <a-form-item :label="feText('chargeSubject')" name="subjectId" :rules="required"><a-select v-model:value="model.subjectId" :options="subjects" show-search option-filter-prop="label" @change="model.standardId = undefined" /></a-form-item>
        <a-form-item :label="feText('chargeStandard')" name="standardId" :rules="required"><a-select v-model:value="model.standardId" :options="candidates.map(s => ({ value: s.id, label: s.name }))" show-search option-filter-prop="label" /></a-form-item>
      </div>
      <div class="meter-rule-footer"><j-permission-button hasPermission="facility/Configuration/MeterBilling:save" type="primary" :loading="saving" @click="save">{{ feText('save') }}</j-permission-button></div>
    </a-form>
  </a-card>
</template>
