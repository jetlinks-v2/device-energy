<script setup lang="ts">
import { useRoute } from 'vue-router'
import RelatedTasks from '../components/RelatedTasks.vue'
const route = useRoute()
</script>
<template><RelatedTasks type="devices" :id="String(route.params.id)" /></template>
