<template>
  <div class="periods">
    <div v-for="(period, index) in modelValue" :key="index" class="period-card">
      <div class="period-row">
        <span class="period-index">{{ index + 1 }}</span>
        <span class="field-label">{{ t('FacilityEnergy.ruleEditor.period') }}</span>
        <a-input class="time-input" type="time" :aria-label="t('FacilityEnergy.startTime')" :value="period.start" @update:value="patch(index, { start: $event })" />
        <span>{{ t('FacilityEnergy.ruleEditor.to') }}</span>
        <a-input class="time-input" type="time" :aria-label="t('FacilityEnergy.endTime')" :value="period.end" @update:value="patch(index, { end: $event })" />
        <span v-if="minuteOf(period.end) < minuteOf(period.start)" class="cross-day">{{ t('FacilityEnergy.ruleEditor.overnight', { end: period.end }) }}</span>
        <span v-else-if="period.start && period.start === period.end" class="cross-day">{{ t('FacilityEnergy.ruleEditor.allDay') }}</span>
        <a-button class="period-delete" type="link" danger @click="emit('update:modelValue', modelValue.filter((_, i) => i !== index))">{{ t('FacilityEnergy.ruleEditor.removePeriod') }}</a-button>
      </div>
      <div class="period-row frequency-row">
        <span class="field-label">{{ t('FacilityEnergy.ruleEditor.frequency') }}</span><span>{{ t('FacilityEnergy.ruleEditor.every') }}</span>
        <a-input-number :value="period.frequency ?? undefined" :min="1" :max="100" :precision="0" :controls="false" :aria-label="t('FacilityEnergy.ruleEditor.frequency')" @update:value="patch(index, { frequency: numberValue($event) })" />
        <a-select :value="period.frequencyUnit" :options="units" :aria-label="t('FacilityEnergy.ruleEditor.frequencyUnit')" @update:value="patch(index, { frequencyUnit: $event as TimeUnit })" />
        <span>{{ t('FacilityEnergy.ruleEditor.patrol') }}</span>
        <a-input-number :value="period.times ?? undefined" :min="1" :max="100" :precision="0" :controls="false" :aria-label="t('FacilityEnergy.requiredCount')" @update:value="patch(index, { times: numberValue($event) })" />
        <span>{{ t('FacilityEnergy.times') }}</span>
        <span class="gap-label">{{ t('FacilityEnergy.ruleEditor.interval') }}</span>
        <a-input-number :value="period.interval ?? undefined" :min="1" :max="100" :precision="0" :controls="false" :aria-label="t('FacilityEnergy.cooldown')" @update:value="patch(index, { interval: numberValue($event) })" />
        <a-select :value="period.intervalUnit" :options="units" :aria-label="t('FacilityEnergy.ruleEditor.intervalUnit')" @update:value="patch(index, { intervalUnit: $event as TimeUnit })" />
        <span class="gap-label">{{ t('FacilityEnergy.ruleEditor.warning') }}</span>
        <a-input-number :value="period.warning ?? undefined" :min="0.01" :precision="2" :controls="false" :aria-label="t('FacilityEnergy.ruleEditor.warning')" @update:value="patch(index, { warning: numberValue($event) })" />
        <a-select :value="period.warningUnit || '1'" :options="units" :aria-label="t('FacilityEnergy.ruleEditor.warningUnit')" @update:value="patch(index, { warningUnit: $event as TimeUnit })" />
      </div>
    </div>
    <a-button type="dashed" block :disabled="modelValue.length >= 24" @click="emit('update:modelValue', [...modelValue, defaultPeriod()])">+ {{ t('FacilityEnergy.addWindow') }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input as AInput, InputNumber as AInputNumber, Select as ASelect, Button as AButton } from 'ant-design-vue'
import { defaultPeriod, minuteOf, type PeriodDraft, type TimeUnit } from '../shared/cycle/editor'
const props = defineProps<{ modelValue: PeriodDraft[] }>()
const emit = defineEmits<{ 'update:modelValue': [windows: PeriodDraft[]] }>()
const { t } = useI18n()
const units = computed(() => (['1', '2', '3'] as const).map(value => ({ value, label: t(`FacilityEnergy.ruleEditor.unit${value}`) })))
const numberValue = (value: string | number | null) => value === null || value === '' ? null : Number(value)
function patch(index: number, value: Partial<PeriodDraft>) {
  emit('update:modelValue', props.modelValue.map((item, i) => i === index ? { ...item, ...value } : item))
}
</script>
<style scoped>
.periods { display: grid; gap: 10px; }
.period-card { padding: 12px; border: 1px solid var(--ant-color-border-secondary, #dfeafa); border-radius: 4px; background: var(--ant-color-bg-container, #fff); }
.period-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.period-index { width: 22px; line-height: 22px; text-align: center; border-radius: 50%; color: var(--ant-color-primary, #1677ff); background: var(--ant-color-primary-bg, #eaf4ff); }
.time-input { width: 112px; }
.period-delete { margin-inline-start: auto; }
.frequency-row { margin-top: 10px; padding-inline-start: 30px; }
.frequency-row :deep(.ant-input-number) { width: 72px; }
.frequency-row :deep(.ant-select) { width: 90px; }
.gap-label { margin-inline-start: 18px; }
.cross-day { color: var(--ant-color-warning, #d9901a); font-size: 12px; }
.field-label { color: var(--ant-color-text-secondary, #606266); }
@media (max-width: 800px) { .frequency-row { padding-inline-start: 0; } .gap-label { margin-inline-start: 0; } }
</style>
