<script setup lang="ts">
import { computed, type UnwrapNestedRefs } from 'vue'
import type { useOverview } from '../../hooks/useOverview'
import { feText } from '../../shared/i18n'
import OverviewTasks from './OverviewTasks.vue'
const { vm } = defineProps<{ vm: UnwrapNestedRefs<ReturnType<typeof useOverview>> }>()
const number = (value?: number) => value === undefined ? '—' : value.toLocaleString()
const faultItems = computed(() => [
  { label: feText('faultPendingDispatch'), keys: ['open'] },
  { label: feText('faultPendingClaim'), keys: ['assigned'] },
  { label: feText('faultProcessing'), keys: ['claimed', 'processing'] },
  { label: feText('faultPendingAcceptance'), keys: ['review'] }
].map(item => ({ ...item, count: vm.faultStates ? item.keys.reduce((sum, key) => sum + (vm.faultStates?.[key] || 0), 0) : undefined })))
</script>
<template>
  <div class="overview-operations">
    <a-alert v-if="vm.states.overview.error" type="error" :message="vm.states.overview.error" show-icon>
      <template #action><a-button size="small" @click="vm.refreshOperations">{{ feText('retry') }}</a-button></template>
    </a-alert>
    <a-spin :spinning="vm.states.overview.loading">
      <div class="overview-grid">
        <OverviewTasks :state="vm.taskState" @navigate="vm.go" @changed="vm.refreshOperations" />
        <section class="overview-panel overview-action-panel">
          <slot name="todos" />
          <div v-if="vm.can('faults')" class="overview-faults">
            <header class="overview-section-head"><h2><AIcon type="ToolOutlined" />{{ feText('overviewFaultRecords') }}</h2>
              <a-button type="link" @click="vm.go('faults')">{{ feText('details') }}<AIcon type="RightOutlined" /></a-button>
            </header>
            <div class="overview-asset-line"><span v-for="item in faultItems" :key="item.label">{{ item.label }}<strong>{{ number(item.count) }}</strong></span></div>
          </div>
          <div v-if="vm.can('notifications')" class="overview-reminders">
            <a-button type="link" :class="{ warning: !!vm.taskState.counts.notificationFailures }" @click="vm.go('notifications', 'failed')"><AIcon type="BellOutlined" />{{ vm.taskState.counts.notificationFailures === 0 ? feText('overviewNotificationsNormal') : feText('failedNotifications') }}<strong v-if="vm.taskState.counts.notificationFailures !== 0">{{ number(vm.taskState.counts.notificationFailures) }}</strong></a-button>
          </div>
        </section>
      </div>
    </a-spin>
    <div class="overview-health-grid">
      <a-spin :spinning="vm.states.overview.loading">
        <section class="eo-panel overview-assets">
          <header class="overview-section-head"><h2><AIcon type="HddOutlined" /><a-tooltip :title="feText('overviewBindingScope')">{{ feText('overviewDevices') }}<AIcon type="InfoCircleOutlined" /></a-tooltip></h2>
            <a-button v-if="vm.can('devices')" type="link" @click="vm.go('devices')">{{ feText('deviceRegister') }}<AIcon type="RightOutlined" /></a-button>
          </header>
          <div class="overview-asset-line">
            <span>{{ feText('totalDevices') }}<strong>{{ number(vm.total) }}</strong></span>
            <span>{{ feText('online') }}<strong>{{ number(vm.assetOnline) }}</strong></span>
            <span>{{ feText('overviewNonOnline') }}<strong>{{ number(vm.nonOnline) }}</strong></span>
            <span>{{ feText('overviewOnlineRate') }}<strong>{{ vm.onlineRate === undefined ? '—' : vm.onlineRate.toFixed(1) + '%' }}</strong></span>
          </div>
          <p class="eo-health-note">{{ feText('overviewCurrentDevices') }}</p>
        </section>
      </a-spin>
      <slot name="health" />
    </div>
  </div>
</template>
