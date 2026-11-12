<script setup lang="ts">
import { computed, ref } from 'vue'
import { feText } from '../../shared/i18n'
import { display, energyNames } from '../../shared/types'
import { overviewEnergy } from '../../shared/overview'
import type { EnergyRow } from '../../hooks/useReports'
import FacilityDataTable from '../FacilityDataTable.vue'
const props = defineProps<{ rows: EnergyRow[]; ready: boolean; level: string; status: { loading: boolean; disabled: boolean; error: string } }>()
const emit = defineEmits<{ (event: 'update:level', level: string): void; (event: 'change'): void }>()
const levels = computed(() => [
  { value: 'master', label: feText('masterMeter') }, { value: 'submeter', label: feText('submeter') },
  { value: 'branch', label: feText('branch') }, { value: 'other', label: feText('other') }
])
const changeLevel = (value: string | number) => { emit('update:level', String(value)); emit('change') }
const opened = ref(false)
const cards = computed(() => [
  { type: 'water', label: feText('overviewWaterUsage'), icon: 'ExperimentOutlined' },
  { type: 'electricity', label: feText('overviewElectricityUsage'), icon: 'ThunderboltOutlined' },
  { type: 'gas', label: feText('overviewGasUsage'), icon: 'FireOutlined' }
].map(item => ({ ...item, ...overviewEnergy(props.rows, item.type) })))
const format = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
const columns = [
  { title: feText('meter'), dataIndex: 'name' }, { title: feText('energy'), dataIndex: 'energyType', width: 110 },
  { title: feText('usage'), dataIndex: 'usage' }, { title: feText('unit'), dataIndex: 'unit', width: 90 }
]
</script>
<template>
  <section class="overview-panel overview-energy">
    <header class="overview-section-head">
      <h2><AIcon type="BarChartOutlined" />{{ feText('energyUsageInTheLast24Hours') }}</h2>
      <div class="overview-energy-tools">
        <a-segmented :value="level" :options="levels" :disabled="status.disabled" :aria-label="feText('aggregationLevel')" @change="changeLevel" />
        <a-button type="link" :disabled="!ready || status.disabled || !!status.error" @click="opened = true">{{ feText('overviewUsageDetails') }}<AIcon type="RightOutlined" /></a-button>
      </div>
    </header>
    <a-alert v-if="status.error" type="error" :message="status.error" show-icon>
      <template #action><a-button size="small" @click="emit('change')">{{ feText('retry') }}</a-button></template>
    </a-alert>
    <a-spin :spinning="status.loading">
    <div class="overview-energy-grid">
      <div v-for="card in cards" :key="card.type" class="overview-energy-item">
        <span :class="['overview-icon', card.type]">
          <svg v-if="card.type === 'water'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z M8 15c0 2 1 3 3 3" /></svg>
          <AIcon v-else :type="card.icon" />
        </span>
        <div><div class="overview-energy-name">{{ card.label }}</div>
          <div class="overview-energy-value">{{ ready ? format(card.value) : '—' }}<span>{{ card.unit }}</span></div>
          <a-tag v-if="ready && card.invalidUnit" color="orange">{{ feText('overviewUnitMismatch') }}</a-tag>
        </div>
      </div>
    </div>
    <div v-if="ready && !status.loading && !status.error && !rows.length" class="overview-empty">{{ feText('overviewNoUsage') }}</div>
    </a-spin>
    <a-modal v-model:visible="opened" :title="feText('energyUsageInTheLast24Hours')" :footer="null" :width="920"
      :style="{ maxWidth: 'calc(100vw - 32px)', top: '5vh' }" :body-style="{ maxHeight: '76vh', overflow: 'auto' }" destroy-on-close>
      <FacilityDataTable :data-source="rows" :columns="columns" :row-key="(row) => row.deviceId + ':' + row.propertyId">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'usage'">{{ format(record.usage.value) }}</template>
          <template v-else-if="column.dataIndex === 'energyType'">{{ energyNames[record.energyType] || display(record.energyType) }}</template>
          <template v-else>{{ display(record[column.dataIndex as keyof EnergyRow]) }}</template>
        </template>
      </FacilityDataTable>
    </a-modal>
  </section>
</template>
