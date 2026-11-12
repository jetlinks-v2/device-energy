<script setup lang="ts">
import JEcharts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { computed } from 'vue'
import { feText } from '../../shared/i18n'
import type { ReportChart as Chart } from './reportModel'
const props = defineProps<{ chart: Chart }>(), emit = defineEmits<{ click: [{ name?: string; seriesName?: string }] }>()
const events = computed(() => ({ click: (params: unknown) => emit('click', params as { name?: string; seriesName?: string }) }))
</script>
<template>
  <section class="report-chart">
    <header><h3>{{ chart.title }}</h3><a-button v-if="!chart.empty" type="link" size="small" @click="emit('click', {})">{{ feText('reportDetails') }}</a-button></header>
    <div v-if="chart.empty" class="report-chart__empty"><a-empty :description="feText('reportNoData')" /></div>
    <div v-else class="report-chart__canvas"><JEcharts :option="chart.option" :events="events" /></div>
  </section>
</template>
<style scoped>
.report-chart { min-height: 300px; background: var(--ant-color-bg-container, #fff); border: 1px solid var(--ant-color-border-secondary, #eee); border-radius: 8px; padding: 16px; }
.report-chart header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.report-chart h3 { margin: 0; font-size: 15px; font-weight: 600; }
.report-chart__canvas { height: 280px; }
.report-chart__empty { height: 280px; display: grid; place-items: center; }
</style>
