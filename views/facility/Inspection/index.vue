<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
</script>
<template>
  <a-tabs class="facility-tabs">
    <a-tab-pane
      key="tasks"
      :tab="feText('task')"
    >
      <ResourcePage
        resource="tasks"
        kind="inspection"
      />
    </a-tab-pane>
    <a-tab-pane
      key="standards"
      :tab="feText('workStandard')"
    >
      <ResourcePage
        resource="standards"
        kind="inspection"
      />
    </a-tab-pane>
    <a-tab-pane
      key="plans"
      :tab="feText('recurringPlans')"
    >
      <ResourcePage
        resource="plans"
        kind="inspection"
      />
    </a-tab-pane>
    <a-tab-pane
      key="groups"
      :tab="feText('equipmentRoomGroups')"
    >
      <ResourcePage resource="groups" />
    </a-tab-pane>
  </a-tabs>
</template>
