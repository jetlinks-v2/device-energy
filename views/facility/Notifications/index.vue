<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import EmployeeNotificationRecords from '../../../components/EmployeeNotificationRecords.vue'
import ResourcePage from '../../../components/ResourcePage.vue'
import { feText } from '../../../shared/i18n'
const route = useRoute()
const tab = ref(route.query.overview === 'failed' ? 'device' : 'employee')
</script>
<template><FacilityWorkspace>
  <a-tabs v-model:active-key="tab" class="facility-tabs" destroy-inactive-tab-pane>
    <a-tab-pane key="employee" :tab="feText('employeeMessageRecords')"><EmployeeNotificationRecords /></a-tab-pane>
    <a-tab-pane key="device" :tab="feText('deviceDeliveryRecords')"><ResourcePage resource="notifications" /></a-tab-pane>
    <a-tab-pane key="plan" :tab="feText('planDeliveryRecords')"><ResourcePage resource="planNotifications" /></a-tab-pane>
  </a-tabs>
</FacilityWorkspace></template>
