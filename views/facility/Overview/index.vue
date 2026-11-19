<script setup lang="ts">
import { reactive } from 'vue'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import EnergyOverview from '../../../components/energy/EnergyOverview.vue'
import OverviewOperations from '../../../components/overview/OverviewOperations.vue'
import EnergyTodos from '../../../components/energy/EnergyTodos.vue'
import EnergyHealthPanels from '../../../components/energy/EnergyHealthPanels.vue'
import { useOverview } from '../../../hooks/useOverview'
import '../../../styles/overview.css'
const vm = reactive(useOverview())
</script>

<template>
  <FacilityWorkspace>
    <EnergyOverview :vm="vm" class="facility-overview" @navigate="tab => vm.go('energy', undefined, tab)">
      <template #operations="{ todoState, openTodo }">
        <OverviewOperations :vm="vm">
          <template #todos><EnergyTodos :state="todoState" embedded @open="openTodo" @retry="vm.refreshTodos" /></template>
          <template #health><EnergyHealthPanels :health="vm.health" :loading="vm.states.meters.loading" :can-collection="vm.canCollection" @collection="openTodo('collection')" /></template>
        </OverviewOperations>
      </template>
    </EnergyOverview>
  </FacilityWorkspace>
</template>
