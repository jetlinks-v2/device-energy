<script setup lang="ts">
import { computed } from 'vue'
import JEcharts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { feText } from '../../shared/i18n'
import { energyNumber, type EnergyMeterRow, type EnergyType } from '../../shared/energyOverview'
const props = defineProps<{ rows: EnergyMeterRow[]; type: EnergyType; loading: boolean }>()
const option = computed(() => ({
  animation: false, aria: { enabled: true }, grid: { top: 10, bottom: 5, left: 5, right: 52, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value: unknown) => energyNumber(Number(value)) + ' ' + (props.type === 'electricity' ? 'kWh' : 'm³') },
  xAxis: { type: 'value', show: false }, yAxis: { type: 'category', inverse: true, data: props.rows.map(row => row.name),
    axisLine: { show: false }, axisTick: { show: false }, axisLabel: { width: 125, overflow: 'truncate', color: '#526c94', fontSize: 11 } },
  series: [{ type: 'bar', barWidth: 9, showBackground: true, backgroundStyle: { color: '#eef4fd', borderRadius: 6 },
    itemStyle: { borderRadius: 6, color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#8cc6ff' }, { offset: 1, color: '#2687fa' }] } },
    label: { show: true, position: 'right', color: '#305786', fontSize: 11, formatter: (item: { value: number }) => energyNumber(item.value) },
    data: props.rows.map(row => row.value) }]
}))
</script>
<template>
  <section class="eo-panel eo-ranking"><header class="eo-section-head"><h3>{{ feText('eoUsageRanking') }}</h3><span>{{ feText('eoSameEnergy') }} · {{ type === 'electricity' ? 'kWh' : 'm³' }}</span></header>
    <a-spin :spinning="loading"><div class="eo-chart"><JEcharts v-if="rows.length" :option="option" /><a-empty v-else :description="feText('overviewNoUsage')" /></div></a-spin>
  </section>
</template>
