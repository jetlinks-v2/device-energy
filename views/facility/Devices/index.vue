<script setup lang="ts">
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import { feText } from '../../../shared/i18n'
import ResourcePage from '../../../components/ResourcePage.vue'
import DeviceImportTools from '../../../components/DeviceImportTools.vue'
</script>
<template>
  <FacilityWorkspace>
    <a-tabs class="facility-tabs" destroy-inactive-tab-pane>
      <a-tab-pane
        key="devices"
        :tab="feText('deviceRegister')"
      >
        <ResourcePage resource="devices" legacy>
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
        <ResourcePage resource="groups" legacy />
      </a-tab-pane>
    </a-tabs>
  </FacilityWorkspace>
</template>
