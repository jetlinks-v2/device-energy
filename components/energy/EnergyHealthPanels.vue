<script setup lang="ts">
import { computed } from 'vue'
import { feText } from '../../shared/i18n'
import type { EnergyHealth } from '../../shared/energyOverview'
import EnergyRingPanel from './EnergyRingPanel.vue'
const props = defineProps<{ health?: EnergyHealth; loading: boolean }>()
const metrics = computed(() => [
  { label: feText('eoMeterTotal'), value: props.health?.total, icon: 'DatabaseOutlined', tone: 'blue', detail: feText('eoSelectedLevel') },
  { label: feText('eoEnabledMeters'), value: props.health?.enabled, icon: 'CloudSyncOutlined', tone: 'teal', detail: feText('eoConfiguredCollection') },
  { label: feText('eoOnlineMeters'), value: props.health?.online, icon: 'CheckCircleOutlined', tone: 'blue', detail: feText('eoAssetState') },
  { label: feText('eoOfflineMeters'), value: props.health?.offline, icon: 'DisconnectOutlined', tone: 'amber', detail: feText('eoAssetState') }
])
const deviceStates = computed(() => [
  { name: feText('online'), value: props.health?.online, color: '#198bff' },
  { name: feText('offline'), value: props.health?.offline, color: '#ffad40' },
  { name: feText('eoUnknownState'), value: props.health?.unknown, color: '#bdcce2' }
])
const collectionStates = computed(() => [
  { name: feText('eoCollected'), value: props.health?.collected, color: '#14c69d' },
  { name: feText('eoFailed'), value: props.health?.failed, color: '#ff6a68' },
  { name: feText('eoAwaiting'), value: props.health?.awaiting, color: '#ffb647' },
  { name: feText('eoDisabled'), value: props.health?.disabled, color: '#bdcce2' }
])
</script>
<template>
  <a-spin :spinning="loading">
    <div class="eo-metric-grid"><div v-for="metric in metrics" :key="metric.label" :class="['eo-metric', metric.tone]">
      <span class="eo-metric-icon"><AIcon :type="metric.icon" /></span><div><strong>{{ metric.value ?? '—' }}<small>{{ feText('eoMeterUnit') }}</small></strong><span>{{ metric.label }}</span></div><small class="eo-metric-detail">{{ metric.detail }}</small>
    </div></div>
    <div class="eo-status-grid">
      <EnergyRingPanel :title="feText('eoDeviceStatus')" :caption="feText('eoMeterTotal')" :items="deviceStates" :total="health?.total" />
      <EnergyRingPanel :title="feText('eoCollectionSummary')" :caption="feText('eoMeterTotal')" :items="collectionStates" :total="health?.total" />
      <slot />
    </div>
  </a-spin>
</template>
