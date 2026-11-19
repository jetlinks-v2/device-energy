<script setup lang="ts">
import { computed } from 'vue'
import { feText } from '../../shared/i18n'
import type { EnergyHealth } from '../../shared/energyOverview'
const props = defineProps<{ health?: EnergyHealth; loading: boolean; canCollection?: boolean }>()
const emit = defineEmits<{ collection: [] }>()
const number = (value?: number) => value?.toLocaleString() ?? '—'
const deviceStates = computed(() => [
  { name: feText('eoMeterTotal'), value: props.health?.total },
  { name: feText('online'), value: props.health?.online },
  { name: feText('offline'), value: props.health?.offline, warning: true },
  { name: feText('eoUnknownState'), value: props.health?.unknown, warning: true }
])
const collectionStates = computed(() => [
  { name: feText('eoFailed'), value: props.health?.failed, warning: true },
  { name: feText('eoAwaiting'), value: props.health?.awaiting, warning: true },
  { name: feText('eoDisabled'), value: props.health?.disabled }
])
</script>
<template>
  <div class="eo-health"><a-spin :spinning="loading">
    <div class="eo-health-grid">
      <section class="eo-panel">
        <header class="eo-section-head"><h3>{{ feText('eoMetersInScope') }}</h3><a-tooltip :title="feText('overviewBindingScope')"><span>{{ feText('eoSelectedLevel') }} <AIcon type="InfoCircleOutlined" /></span></a-tooltip></header>
        <dl class="eo-health-counts">
          <div v-for="item in deviceStates" :key="item.name"><dt>{{ item.name }}</dt><dd :class="{ 'eo-count-warning': item.warning && !!item.value }">{{ number(item.value) }}</dd></div>
        </dl>
        <p class="eo-health-note">{{ feText('eoCurrentMeterScope') }}</p>
      </section>
      <section class="eo-panel">
        <header class="eo-section-head"><h3>{{ feText('eoCollectionExceptions') }}</h3><a-button v-if="canCollection" type="link" size="small" @click="emit('collection')">{{ feText('details') }}<AIcon type="RightOutlined" /></a-button></header>
        <dl class="eo-health-counts">
          <div v-for="item in collectionStates" :key="item.name"><dt>{{ item.name }}</dt><dd :class="{ 'eo-count-warning': item.warning && !!item.value }">{{ number(item.value) }}</dd></div>
        </dl>
        <p class="eo-health-note"><a-tooltip :title="feText('eoCollectionHistoryBasis')"><span>{{ feText('eoCollected') }} {{ number(health?.collected) }} <AIcon type="InfoCircleOutlined" /></span></a-tooltip></p>
      </section>
    </div>
  </a-spin></div>
</template>
