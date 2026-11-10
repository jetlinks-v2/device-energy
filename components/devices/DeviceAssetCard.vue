<script setup lang="ts">
import { computed } from 'vue'
import { CardSummary } from '@jetlinks-web-core/components'
import type { CardSummaryData } from '@jetlinks-web-core/components/CardBox/types'
import { feText } from '../../shared/i18n'
import { display, type Device } from '../../shared/types'
import { connectionStatusTones } from '../../shared/deviceStatus'
import onlineImage from '../../assets/device-online.svg'
import offlineImage from '../../assets/device-offline.svg'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ open: [] }>()
const image = computed(() => props.device.sourceState === 'online' ? onlineImage : offlineImage)
const summary = computed<CardSummaryData>(() => {
  const device = props.device
  const title = device.name || device.sourceName || device.cloudDeviceId
  return {
    title,
    status: { text: display(device.sourceState), tone: connectionStatusTones[device.sourceState] || 'default' },
    footer: [{ label: feText('businessProject'), value: display(device.projectName) }],
    footerActionIcon: 'ArrowRightOutlined'
  }
})
</script>

<template>
  <CardSummary class="facility-device-card" :data="summary" :background-opacity="100" @click="emit('open')">
    <template #avatar>
      <img class="facility-device-card__image" :src="image" alt="" width="64" height="64" />
    </template>
    <template #title>
      <j-ellipsis>{{ summary.title }}</j-ellipsis>
    </template>
    <template v-if="device.categoryName || (device.sourceName && device.sourceName !== summary.title)" #subtitle>
      <span class="facility-device-card__info">
        <StatusTag v-if="device.categoryName" :text="device.categoryName" status="info" :bordered="false" />
        <j-ellipsis v-if="device.sourceName && device.sourceName !== summary.title">{{ device.sourceName }}</j-ellipsis>
      </span>
    </template>
    <template #footer>
      <div class="facility-device-card__project">
        <AIcon type="EnvironmentOutlined" />
        <j-ellipsis>{{ display(device.projectName) }}</j-ellipsis>
      </div>
      <span class="facility-device-card__details">{{ feText('details') }} <AIcon type="ArrowRightOutlined" /></span>
    </template>
  </CardSummary>
</template>

<style scoped>
.facility-device-card {
  border-color: var(--card-shell-border-hover);
  border-radius: var(--r-4);
  box-shadow: var(--shadow-hover);
}
.facility-device-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-lifted);
}
.facility-device-card__image {
  flex: none;
  object-fit: contain;
}
.facility-device-card__info {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  flex-direction: column;
  gap: var(--space-2);
}
.facility-device-card__project {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink-2);
}
.facility-device-card__details {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
  color: var(--ant-color-primary);
}
</style>
