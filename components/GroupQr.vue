<script setup lang="ts">
import { feText } from '../shared/i18n'
import type { Entity } from '../shared/types'
defineProps<{ group: Entity }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <a-modal
    open
    :title="feText('equipmentRoomGroupQrCode')"
    :footer="null"
    @cancel="emit('close')"
  >
    <h3>{{ group.name }}</h3>
    <a-qrcode :value="JSON.stringify({ type: 'facility-group', applicationId: group.applicationId, id: group.id })" />
    <p>{{ feText('staffCanScanToViewAuthorizedInspectionAndMaintenanceTasksForThis') }}</p>
  </a-modal>
</template>
