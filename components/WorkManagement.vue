<script setup lang="ts">
import FacilityWorkspace from './FacilityWorkspace.vue'
import ResourcePage from './ResourcePage.vue'
import { useWorkManagement } from '../hooks/useWorkManagement'

defineProps<{ kind: 'inspection' | 'maintenance' }>()
const { activeTab, tabs, showTasks } = useWorkManagement()
</script>

<template>
  <FacilityWorkspace>
    <a-tabs v-model:active-key="activeTab" class="facility-tabs" destroy-inactive-tab-pane>
      <a-tab-pane v-for="tab in tabs" :key="tab.resource" :tab="tab.label">
        <ResourcePage :resource="tab.resource" :kind="tab.resource === 'groups' ? undefined : kind"
          @tasks-generated="showTasks" />
      </a-tab-pane>
    </a-tabs>
  </FacilityWorkspace>
</template>
