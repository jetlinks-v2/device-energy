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
        <section class="overview-panel overview-assets">
          <header class="overview-section-head"><h2><AIcon type="HddOutlined" /><a-tooltip :title="feText('overviewBindingScope')">{{ feText('overviewDevices') }}<AIcon type="InfoCircleOutlined" /></a-tooltip></h2>
            <a-button v-if="vm.can('devices')" type="link" @click="vm.go('devices')">{{ feText('deviceRegister') }}<AIcon type="RightOutlined" /></a-button>
          </header>
          <div class="overview-asset-line">
            <span>{{ feText('totalDevices') }}<strong>{{ number(vm.total) }}</strong></span>
            <span>{{ feText('online') }}<strong>{{ number(vm.assetOnline) }}</strong></span>
            <span>{{ feText('overviewNonOnline') }}<strong>{{ number(vm.nonOnline) }}</strong></span>
            <span>{{ feText('overviewOnlineRate') }}<strong>{{ vm.onlineRate === undefined ? '—' : vm.onlineRate.toFixed(1) + '%' }}</strong></span>
          </div>
          <a-progress :percent="vm.onlineRate || 0" :show-info="false" :stroke-width="6" stroke-color="#1683ff" />
          <div v-if="vm.can('faults')" class="overview-faults">
            <header class="overview-section-head"><h2><AIcon type="ToolOutlined" />{{ feText('overviewFaultRecords') }}</h2>
              <a-button type="link" @click="vm.go('faults')">{{ feText('details') }}<AIcon type="RightOutlined" /></a-button>
            </header>
            <div class="overview-asset-line"><span v-for="item in faultItems" :key="item.label">{{ item.label }}<strong>{{ number(item.count) }}</strong></span></div>
          </div>
        </section>
      </div>
    </a-spin>
  </div>
</template>
