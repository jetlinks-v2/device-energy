<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
import DeviceImportTools from '../../../components/DeviceImportTools.vue'
</script>
<template>
  <a-tabs class="facility-tabs" destroy-inactive-tab-pane>
    <a-tab-pane
      key="devices"
      :tab="feText('deviceRegister')"
    >
      <ResourcePage resource="devices">
        <template #tools="{ projectId, refresh }">
          <DeviceImportTools
            :project-id="projectId"
            @changed="refresh"
          />
        </template>
      </ResourcePage>
    </a-tab-pane>
    <a-tab-pane
      key="groups"
      :tab="feText('equipmentRoomsGroups')"
    >
      <ResourcePage resource="groups" />
    </a-tab-pane>
  </a-tabs>
</template>
