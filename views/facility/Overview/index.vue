<script setup lang="ts">
import { reactive } from 'vue'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import EnergyOverview from '../../../components/energy/EnergyOverview.vue'
import OverviewOperations from '../../../components/overview/OverviewOperations.vue'
import { useOverview } from '../../../hooks/useOverview'
import '../../../styles/overview.css'
const vm = reactive(useOverview())
</script>

<template>
  <FacilityWorkspace>
    <EnergyOverview :vm="vm" class="facility-overview" @navigate="tab => vm.go('energy', undefined, tab)">
      <template #operations><OverviewOperations :vm="vm" /></template>
    </EnergyOverview>
  </FacilityWorkspace>
</template>
