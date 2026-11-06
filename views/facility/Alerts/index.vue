<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
</script>
<template>
  <a-tabs class="facility-tabs" destroy-inactive-tab-pane>
    <a-tab-pane
      key="alerts"
      :tab="feText('alertEvents')"
    >
      <ResourcePage resource="alerts" />
    </a-tab-pane>
    <a-tab-pane
      key="plans"
      :tab="feText('energyPlanAlerts')"
    >
      <ResourcePage resource="planAlerts" />
    </a-tab-pane>
    <a-tab-pane
      key="rules"
      :tab="feText('alertRules')"
    >
      <ResourcePage resource="rules" />
    </a-tab-pane>
  </a-tabs>
</template>
