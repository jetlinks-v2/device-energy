<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
</script>
<template>
  <a-tabs class="facility-tabs">
    <a-tab-pane
      key="energy/mappings"
      :tab="feText('metersAndDeviceModels')"
    >
      <ResourcePage resource="energy/mappings" />
    </a-tab-pane>
    <a-tab-pane
      key="readings"
      :tab="feText('readingsAndManualEntryReview')"
    >
      <ResourcePage resource="readings" />
    </a-tab-pane>
    <a-tab-pane
      key="replacements"
      :tab="feText('meterReplacementAndReset')"
    >
      <ResourcePage resource="replacements" />
    </a-tab-pane>
  </a-tabs>
</template>
