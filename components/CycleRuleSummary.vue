<template>
  <div class="rule-summary">
    <div v-if="!rows.length">{{ t('FacilityEnergy.ruleSummary.empty') }}</div>
    <div v-for="(row, index) in rows" :key="index">
      <strong>{{ row.date || row.days.map(day => t(`FacilityEnergy.week${day}`)).join('、') }}：</strong>
      <span v-if="!row.windows.length">{{ t('FacilityEnergy.ruleSummary.rest') }}</span>
      <span v-for="(window, windowIndex) in row.windows" :key="windowIndex" class="rule-window">
        {{ ruleWindowTime(window).start }}–{{ ruleWindowTime(window).end }}<span v-if="ruleWindowTime(window).nextDay">（{{ t('FacilityEnergy.ruleSummary.nextDay') }}）</span>
        <span v-else-if="window.startMinute === window.endMinute">（{{ t('FacilityEnergy.ruleSummary.allDay') }}）</span>
        {{ t('FacilityEnergy.ruleEditor.every') }} {{ ruleQuantity(window.intervalMinutes, window.frequencyUnit).value }} {{ t(`FacilityEnergy.ruleEditor.unit${ruleQuantity(window.intervalMinutes, window.frequencyUnit).unit}`) }}{{ t('FacilityEnergy.ruleEditor.patrol') }} {{ window.requiredCount }} {{ t('FacilityEnergy.times') }}，
        {{ t('FacilityEnergy.ruleEditor.interval') }} {{ ruleQuantity(window.cooldownMinutes ?? 0, window.cooldownUnit).value }} {{ t(`FacilityEnergy.ruleEditor.unit${ruleQuantity(window.cooldownMinutes ?? 0, window.cooldownUnit).unit}`) }}
        <span v-if="window.warningMinutes != null">，{{ t('FacilityEnergy.ruleEditor.warningAfter', { minutes: window.warningMinutes }) }}</span>
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CycleRule } from '../shared/cycle/types'
import { ruleSummaryRows, ruleWindowTime, ruleQuantity } from '../shared/cycle/rules'
const props = defineProps<{ rule?: CycleRule }>()
const { t } = useI18n()
const rows = computed(() => ruleSummaryRows(props.rule))
</script>
<style scoped>
.rule-summary { white-space: normal; line-height: 1.7; }
.rule-window { display: inline-block; margin-inline-end: 12px; }
</style>
