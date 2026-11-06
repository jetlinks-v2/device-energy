<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
</script>
<template>
  <a-tabs class="facility-tabs" destroy-inactive-tab-pane>
    <a-tab-pane
      key="device"
      :tab="feText('deviceNotifications')"
    >
      <ResourcePage resource="notifications" />
    </a-tab-pane>
    <a-tab-pane
      key="plan"
      :tab="feText('energyPlanNotifications')"
    >
      <ResourcePage resource="planNotifications" />
    </a-tab-pane>
  </a-tabs>
</template>
