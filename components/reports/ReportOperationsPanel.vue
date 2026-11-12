<script setup lang="ts">
import { feText } from '../../shared/i18n'
import type { ReportView } from './reportModel'
import ReportChart from './ReportChart.vue'
defineProps<{ view: ReportView }>(); const emit = defineEmits<{ drill: [{ name?: string; seriesName?: string }, string?] }>()
</script>
<template>
  <div class="report-panel">
    <p class="report-note">{{ view.note }}</p>
    <div class="report-metrics"><div v-for="metric in view.metrics" :key="metric.title"><span>{{ metric.title }}</span><strong>{{ metric.value }}</strong></div></div>
    <ReportChart :chart="view.main" @click="emit('drill', $event)" />
    <div class="report-support"><ReportChart :chart="view.left" @click="emit('drill', $event, 'left')" /><ReportChart v-if="view.right" :chart="view.right" @click="emit('drill', $event, 'right')" /></div>
  </div>
</template>
<style scoped>
.report-note { color: var(--ant-color-text-secondary); margin: 0 0 14px; }
.report-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.report-metrics > div { padding: 12px 14px; border-radius: 8px; background: var(--ant-color-fill-quaternary); }
.report-metrics span { display: block; color: var(--ant-color-text-secondary); font-size: 12px; }
.report-metrics strong { display: block; margin-top: 5px; font-size: 22px; }
.report-support { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 900px) { .report-metrics, .report-support { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .report-metrics, .report-support { grid-template-columns: 1fr; } }
</style>
