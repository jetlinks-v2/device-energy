<script setup lang="ts">
import { computed } from 'vue'
import JEcharts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { feText } from '../../shared/i18n'
import { energyNumber, energyTotal, type EnergyType, type EnergyPeriod } from '../../shared/energyOverview'
const props = defineProps<{ state: { data?: EnergyPeriod[]; loading: boolean; error: string }; type: EnergyType }>()
const emit = defineEmits<{ retry: [] }>()
const points = computed(() => (props.state.data || []).map(row => ({ name: row.period.slice(5), value: energyTotal(row.meters, props.type).value })))
const hasData = computed(() => points.value.some(point => point.value !== undefined))
const option = computed(() => {
  const color = { water: '#198bff', electricity: '#b9770b', gas: '#8155b9' }[props.type]
  return {
    animation: false, aria: { enabled: true }, color: [color], grid: { top: 21, left: 7, right: 12, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => value == null ? '—' : energyNumber(Number(value)) },
    xAxis: { type: 'category', boundaryGap: false, data: points.value.map(point => point.name), axisLine: { lineStyle: { color: '#dbe3ed' } }, axisTick: { show: false }, axisLabel: { color: '#6b7b8d' } },
    yAxis: { type: 'value', axisLabel: { color: '#6b7b8d' }, splitLine: { lineStyle: { color: '#edf1f6', type: 'dashed' } } },
    series: [{ type: 'line', data: points.value.map(point => point.value ?? null), connectNulls: false, smooth: false,
      showSymbol: true, symbolSize: 4, lineStyle: { width: 2.5 }, areaStyle: { color, opacity: .12 } }]
  }
})
</script>
<template>
  <section class="eo-trend eo-panel">
    <header class="eo-section-head"><h3>{{ feText('eoDailyTrend') }}</h3><span>{{ feText(type === 'water' ? 'overviewWaterUsage' : type === 'electricity' ? 'overviewElectricityUsage' : 'overviewGasUsage') }} · {{ type === 'electricity' ? 'kWh' : 'm³' }}</span></header>
    <a-alert v-if="state.error" type="error" show-icon :message="state.error"><template #action><a-button size="small" @click="emit('retry')">{{ feText('retry') }}</a-button></template></a-alert>
    <a-spin :spinning="state.loading"><div class="eo-chart"><JEcharts v-if="hasData" :option="option" /><CloudEmpty v-else :description="feText('overviewNoUsage')" /></div></a-spin>
  </section>
</template>
<style scoped>
.eo-chart { height: 140px; }
</style>
