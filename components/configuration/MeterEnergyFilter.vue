<script setup lang="ts">
import type { MeterEnergyFilter } from '../../shared/meterBillQuery'
import { feText } from '../../shared/i18n'
defineProps<{ value: MeterEnergyFilter; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: MeterEnergyFilter] }>()
const options = [
  { value: 'all', label: 'meterAllCharges' }, { value: 'water', label: 'waterCharge' },
  { value: 'electricity', label: 'electricCharge' }, { value: 'gas', label: 'gasCharge' }
] as const
</script>
<template>
  <a-radio-group :value="value" :disabled="disabled" :aria-label="feText('meterChargeType')" button-style="solid"
    @change="emit('change', $event.target.value)">
    <a-radio-button v-for="option in options" :key="option.value" :value="option.value">{{ feText(option.label) }}</a-radio-button>
  </a-radio-group>
</template>
