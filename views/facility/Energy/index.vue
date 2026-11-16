<script setup lang="ts">
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
import ReadingTools from '../../../components/energy/ReadingTools.vue'
import EnergyOverview from '../../../components/energy/EnergyOverview.vue'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute(), router = useRouter()
const tab = route.query.tab
const activeTab = ref(typeof tab === 'string' && ['overview', 'energy/mappings', 'collection', 'readings', 'replacements'].includes(tab) ? tab : 'overview')
const navigate = async (tab: string, projectId?: string) => {
  await router.replace({ query: { ...route.query, projectId, tab } })
  activeTab.value = tab
}
</script>
<template>
  <FacilityWorkspace>
    <a-tabs v-model:active-key="activeTab" class="facility-tabs" destroy-inactive-tab-pane>
      <a-tab-pane key="overview" :tab="feText('eoTitle')">
        <EnergyOverview @navigate="navigate" />
      </a-tab-pane>
      <a-tab-pane
        key="energy/mappings"
        :tab="feText('metersAndDeviceModels')"
      >
        <ResourcePage resource="energy/mappings" />
      </a-tab-pane>
      <a-tab-pane key="collection" :tab="feText('collectionStatus')">
        <ResourcePage resource="collection" />
      </a-tab-pane>
      <a-tab-pane
        key="readings"
        :tab="feText('readingsAndManualEntryReview')"
      >
        <ResourcePage resource="readings">
          <template #tools="{ options, projectId, refresh }">
            <ReadingTools :options="options" :project-id="projectId" @changed="refresh" />
          </template>
        </ResourcePage>
      </a-tab-pane>
      <a-tab-pane
        key="replacements"
        :tab="feText('meterReplacementAndReset')"
      >
        <ResourcePage resource="replacements" />
      </a-tab-pane>
    </a-tabs>
  </FacilityWorkspace>
</template>
