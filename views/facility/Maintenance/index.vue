<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
</script>
<template>
  <a-tabs class="facility-tabs" destroy-inactive-tab-pane>
    <a-tab-pane
      key="tasks"
      :tab="feText('task')"
    >
      <ResourcePage
        resource="tasks"
        kind="maintenance"
      />
    </a-tab-pane>
    <a-tab-pane
      key="standards"
      :tab="feText('maintenanceStandards')"
    >
      <ResourcePage
        resource="standards"
        kind="maintenance"
      />
    </a-tab-pane>
    <a-tab-pane
      key="plans"
      :tab="feText('maintenancePlans')"
    >
      <ResourcePage
        resource="plans"
        kind="maintenance"
      />
    </a-tab-pane>
  </a-tabs>
</template>
