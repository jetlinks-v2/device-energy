<script setup lang="ts">
import { reactive } from 'vue'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import MeterBillPreview from '../../../components/configuration/MeterBillPreview.vue'
import { useBillingProject } from '../../../hooks/useBillingProject'
import { feText } from '../../../shared/i18n'
const vm = reactive(useBillingProject())
</script>
<template>
  <FacilityWorkspace>
    <section class="facility-page facility-resource-page">
      <div class="facility-toolbar"><a-select v-model:value="vm.projectId" :options="vm.projects" :loading="vm.loading" :placeholder="feText('chooseProject')" show-search option-filter-prop="label" class="facility-toolbar__project" /></div>
      <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon />
      <MeterBillPreview v-if="vm.projectId" :key="vm.projectId" :project-id="vm.projectId" />
      <a-empty v-else :description="feText('chooseProject')" />
    </section>
  </FacilityWorkspace>
</template>
