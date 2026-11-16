<script setup lang="ts">
import { computed } from 'vue'
import JEcharts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { feText } from '../../shared/i18n'
const props = defineProps<{ title: string; caption: string; items: { name: string; value?: number; color: string }[]; total?: number }>()
const option = computed(() => ({
  animation: false, aria: { enabled: true }, color: props.items.map(item => item.color),
  tooltip: { trigger: 'item', formatter: '{b}：{c}' },
  series: [{ type: 'pie', radius: ['67%', '89%'], center: ['50%', '50%'], label: { show: false },
    emphasis: { scale: false }, itemStyle: { borderColor: '#fff', borderWidth: 2 },
    data: props.items.map(item => ({ name: item.name, value: item.value || 0 })) }]
}))
</script>
<template>
  <section class="eo-panel eo-ring-panel">
    <header class="eo-section-head"><h3>{{ title }}</h3></header>
    <div class="eo-ring-layout">
      <div class="eo-ring"><JEcharts v-if="total" :option="option" /><div v-else class="eo-ring-empty" /><div class="eo-ring-caption"><strong>{{ total ?? '—' }}</strong><span>{{ caption }}</span></div></div>
      <dl class="eo-ring-legend"><div v-for="item in items" :key="item.name"><dt><i :style="{ background: item.color }" />{{ item.name }}</dt><dd>{{ item.value ?? '—' }}<small>{{ total ? ((item.value || 0) / total * 100).toFixed(1) + '%' : '—' }}</small></dd></div></dl>
    </div>
    <span v-if="total === 0" class="eo-ring-no-data">{{ feText('reportNoData') }}</span>
  </section>
</template>
