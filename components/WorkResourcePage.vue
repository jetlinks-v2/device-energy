<script setup lang="ts">
import FacilityWorkspace from './FacilityWorkspace.vue'
import ResourcePage from './ResourcePage.vue'
import { useWorkNavigation } from '../hooks/useWorkNavigation'

const props = defineProps<{
  kind: 'inspection' | 'maintenance'
  resource: 'tasks' | 'standards' | 'cycles' | 'plans' | 'groups'
}>()
const { showTasks } = useWorkNavigation(props.kind)
</script>

<template>
  <FacilityWorkspace>
    <ResourcePage :resource="resource" :kind="kind" @tasks-generated="showTasks" />
  </FacilityWorkspace>
</template>
