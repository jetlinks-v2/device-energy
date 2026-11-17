<script setup lang="ts">
import { computed, defineAsyncComponent, type UnwrapNestedRefs } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import type { useEnergyOverview } from '../../hooks/useEnergyOverview'
import { feText } from '../../shared/i18n'
import EnergyUsageScene from './EnergyUsageScene.vue'
import EnergyTrend from './EnergyTrend.vue'
import EnergyHealthPanels from './EnergyHealthPanels.vue'
import EnergyTodos from './EnergyTodos.vue'
import EnergyRanking from './EnergyRanking.vue'
import EnergyMeterList from './EnergyMeterList.vue'
import '../../styles/energy-overview.css'
const { vm } = defineProps<{ vm: UnwrapNestedRefs<ReturnType<typeof useEnergyOverview>> }>()
const ReadingReview = defineAsyncComponent(() => import('./ReadingReview.vue'))
const MeterBillReview = defineAsyncComponent(() => import('../configuration/MeterBillReview.vue'))
const emit = defineEmits<{ navigate: [tab: string, projectId?: string] }>()
const levels = [
  { value: 'master', label: feText('masterMeter') }, { value: 'submeter', label: feText('submeter') },
  { value: 'branch', label: feText('branch') }, { value: 'other', label: feText('other') }
]
const types = [{ value: 'water', label: feText('water') }, { value: 'electricity', label: feText('electricity') }, { value: 'gas', label: feText('gas') }]
const futureMonth = (date: Dayjs) => date.isAfter(dayjs().endOf('month')) || date.year() < 2000
const todoState = computed(() => ({ ...vm.states, canReadings: vm.canReadings, canBilling: vm.canBilling, canAlerts: vm.canAlerts, canCollection: vm.canCollection, projectId: vm.projectId }))
const openTodo = (key: 'readings' | 'billing' | 'alerts' | 'collection') => {
  if (key === 'readings') vm.readingsOpen = true
  else if (key === 'billing') vm.billingOpen = true
  else if (key === 'alerts') vm.openAlerts()
  else emit('navigate', 'collection', vm.projectId)
}
</script>
<template>
  <section class="energy-overview">
    <div class="eo-toolbar">
      <div class="eo-filters">
        <a-select v-model:value="vm.projectIds" mode="multiple" :max-tag-count="1" :options="vm.projects" :loading="vm.projectLoading" class="eo-project"
          :placeholder="feText('overviewAllAuthorizedProjects')" :aria-label="feText('businessProject')" show-search option-filter-prop="label" allow-clear @change="vm.changeProject" />
        <a-tooltip :title="feText('overviewEnergyFilters')"><a-date-picker v-model:value="vm.month" picker="month" value-format="YYYY-MM" :allow-clear="false" :disabled-date="futureMonth" :aria-label="feText('billingMonth')" @change="vm.refreshEnergy" /></a-tooltip>
        <a-tooltip :title="feText('overviewEnergyFilters')"><a-segmented v-model:value="vm.level" :options="levels" :aria-label="feText('aggregationLevel')" @change="vm.changeLevel" /></a-tooltip>
      </div>
      <a-button :loading="vm.busy" @click="vm.refresh"><template #icon><AIcon type="ReloadOutlined" /></template>{{ feText('refresh') }}</a-button>
    </div>
    <a-alert v-if="vm.projectError" type="error" show-icon :message="vm.projectError"><template #action><a-button @click="vm.initialize">{{ feText('retry') }}</a-button></template></a-alert>
    <a-alert v-if="vm.states.energy.error" type="error" show-icon :message="vm.states.energy.error"><template #action><a-button @click="vm.refreshEnergy">{{ feText('retry') }}</a-button></template></a-alert>
    <a-alert type="info" show-icon :message="feText('overviewBindingScope')" />
    <EnergyUsageScene :cards="vm.cards" :selected="vm.energyType" :loading="vm.states.energy.loading" @select="vm.energyType = $event" />
    <slot name="operations" />
    <a-alert v-if="vm.states.meters.error" type="error" show-icon :message="vm.states.meters.error"><template #action><a-button @click="vm.refreshMeters">{{ feText('retry') }}</a-button></template></a-alert>
    <EnergyHealthPanels :health="vm.health" :loading="vm.states.meters.loading">
      <EnergyTodos :state="todoState" @open="openTodo" @retry="vm.refreshTodos" />
    </EnergyHealthPanels>
    <div class="eo-chart-grid">
      <EnergyTrend :state="vm.states.trend" :type="vm.energyType" @retry="vm.refreshEnergy" />
      <EnergyRanking :rows="vm.ranking" :type="vm.energyType" :loading="vm.states.energy.loading || vm.states.meters.loading" />
    </div>
    <section class="eo-panel eo-meters">
      <header class="eo-section-head"><div class="eo-meter-title"><h3>{{ feText('eoMeterDetails') }}</h3><a-segmented v-model:value="vm.energyType" :options="types" :aria-label="feText('energyType')" size="small" /></div><a-input-search v-model:value="vm.keyword" :placeholder="feText('eoSearchMeter')" :aria-label="feText('eoSearchMeter')" allow-clear class="eo-meter-search" /></header>
      <a-alert v-if="vm.states.meters.data?.spaceError" type="warning" show-icon :message="vm.states.meters.data.spaceError"><template #action><a-button size="small" @click="vm.refreshMeters">{{ feText('retry') }}</a-button></template></a-alert>
      <EnergyMeterList :rows="vm.meters" :loading="vm.states.meters.loading || vm.states.energy.loading" />
    </section>
    <ReadingReview v-if="vm.readingsOpen" :project-id="vm.projectId" :project-ids="vm.projectIds" :options="{ projects: vm.projects }" @close="vm.readingsOpen = false" @changed="vm.refreshTodos" />
    <MeterBillReview v-if="vm.billingOpen" :project-id="vm.projectId" :project-ids="vm.projectIds" @close="vm.billingOpen = false" @changed="vm.refreshTodos" />
  </section>
</template>
