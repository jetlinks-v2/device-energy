<script setup lang="ts">
import FacilityDataTable from '../FacilityDataTable.vue'
import { feText } from '../../shared/i18n'
import { energyNumber, type EnergyMeterRow } from '../../shared/energyOverview'
import { taskTime } from '../../shared/types'
defineProps<{ rows: EnergyMeterRow[]; loading: boolean }>()
const columns = [
  { title: feText('meter'), dataIndex: 'name', width: 200 },
  { title: feText('installationSpace'), dataIndex: 'spaceName', width: 200 },
  { title: feText('status'), dataIndex: 'sourceState', width: 100 },
  { title: feText('lastCollectionSuccess'), dataIndex: 'lastCollectionSuccessTime', width: 180 },
  { title: feText('eoPeriodUsage'), dataIndex: 'value', width: 145 },
  { title: feText('collectionFailureReason'), dataIndex: 'collectionError', width: 200 }
]
</script>
<template>
  <FacilityDataTable :data-source="rows" :columns="columns" row-key="id" :loading="loading" :page-size="5">
    <template #bodyCell="{ column, record }">
      <a-tag v-if="column.dataIndex === 'sourceState'" :color="record.sourceState === 'online' ? 'success' : 'default'">{{ record.sourceState === 'online' ? feText('online') : record.sourceState === 'offline' ? feText('offline') : feText('eoUnknownState') }}</a-tag>
      <template v-else-if="column.dataIndex === 'lastCollectionSuccessTime'">{{ taskTime(record.lastCollectionSuccessTime) }}</template>
      <a-tooltip v-else-if="column.dataIndex === 'value'" :title="record.value !== undefined && !record.complete ? feText('eoAvailableUsage') : undefined"><span class="eo-table-value">{{ energyNumber(record.value) }} <small>{{ record.unit }}</small></span></a-tooltip>
      <span v-else :title="String(record[column.dataIndex as keyof EnergyMeterRow] || '')">{{ record[column.dataIndex as keyof EnergyMeterRow] || '—' }}</span>
    </template>
  </FacilityDataTable>
</template>
<style scoped>.eo-table-value { font-variant-numeric: tabular-nums; white-space: nowrap; }.eo-table-value small { color: var(--ant-color-text-tertiary, #6b7b8d); }</style>
