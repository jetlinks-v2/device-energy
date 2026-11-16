<script setup lang="ts">
import { computed } from 'vue'
import { feText } from '../../shared/i18n'
interface Count { data?: number; loading: boolean; error: string }
const props = defineProps<{ state: { readings: Count; billing: Count; alerts: Count; canReadings: boolean; canBilling: boolean; canAlerts: boolean; projectId?: string } }>()
const emit = defineEmits<{ open: [key: 'readings' | 'billing' | 'alerts' | 'collection']; retry: [] }>()
const entries = computed(() => [
  { key: 'readings' as const, label: feText('manualReadingReview'), icon: 'FormOutlined', enabled: props.state.canReadings, count: props.state.readings, requiresProject: false, tone: 'blue' },
  { key: 'billing' as const, label: feText('eoPendingBilling'), icon: 'AuditOutlined', enabled: props.state.canBilling, count: props.state.billing, requiresProject: true, tone: 'purple' },
  { key: 'alerts' as const, label: feText('eoDeviceAlerts'), icon: 'AlertOutlined', enabled: props.state.canAlerts, count: props.state.alerts, requiresProject: true, tone: 'rose' }
].filter(entry => entry.enabled))
</script>
<template>
  <section class="eo-panel eo-todos">
    <header class="eo-section-head"><h3>{{ feText('overviewPending') }}</h3><a-tooltip :title="feText('eoTodoBasis')"><AIcon type="InfoCircleOutlined" /></a-tooltip></header>
    <div class="eo-todo-list">
      <div v-for="entry in entries" :key="entry.key" class="eo-todo-row">
        <span :class="['eo-todo-icon', entry.tone]"><AIcon :type="entry.icon" /></span>
        <span class="eo-todo-label">{{ entry.label }}</span>
        <a-tooltip :title="entry.count.error || (entry.requiresProject && !state.projectId ? feText('chooseProject') : undefined)">
          <a-button type="link" :aria-label="entry.label" :disabled="entry.requiresProject && !state.projectId" :loading="entry.count.loading" @click="emit('open', entry.key)">{{ entry.count.error ? '—' : entry.count.data ?? '—' }}<AIcon type="RightOutlined" /></a-button>
        </a-tooltip>
        <a-button v-if="entry.count.error" type="text" size="small" :aria-label="feText('retry')" @click="emit('retry')"><AIcon type="ReloadOutlined" /></a-button>
      </div>
      <a-button v-if="!entries.length" type="link" @click="emit('open', 'collection')">{{ feText('collectionStatus') }}<AIcon type="RightOutlined" /></a-button>
    </div>
    <footer><a-button type="link" size="small" @click="emit('open', 'collection')">{{ feText('collectionStatus') }}<AIcon type="ArrowRightOutlined" /></a-button></footer>
  </section>
</template>
