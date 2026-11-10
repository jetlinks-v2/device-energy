<script setup lang="ts">
import FacilityWorkspace from './FacilityWorkspace.vue'
import ResourcePage from './ResourcePage.vue'

defineProps<{
  kind: 'inspection' | 'maintenance'
  resource: 'tasks' | 'standards' | 'cycles' | 'plans' | 'groups'
}>()
</script>

<template>
  <FacilityWorkspace>
    <ResourcePage :resource="resource" :kind="kind" />
  </FacilityWorkspace>
</template>
