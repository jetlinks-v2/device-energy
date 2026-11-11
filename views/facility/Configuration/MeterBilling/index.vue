<script setup lang="ts">
import { reactive } from 'vue'
import FacilityWorkspace from '../../../../components/FacilityWorkspace.vue'
import MeterRuleEditor from '../../../../components/configuration/MeterRuleEditor.vue'
import { useMeterBilling } from '../../../../hooks/useMeterBilling'
import { feText } from '../../../../shared/i18n'
const vm = reactive(useMeterBilling())
const types = ['water', 'electricity', 'gas'] as const
</script>
<template>
  <FacilityWorkspace>
    <section class="facility-page facility-resource-page">
      <div class="facility-toolbar"><a-select v-model:value="vm.projectId" :options="vm.projects" :placeholder="feText('chooseProject')" show-search option-filter-prop="label" class="facility-toolbar__project" /></div>
      <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon closable @close="vm.error = ''" />
      <a-empty v-if="!vm.projectId" :description="feText('chooseProject')" />
      <a-spin v-else :spinning="vm.busy"><div class="meter-rule-grid">
        <MeterRuleEditor v-for="type in types" :key="vm.projectId + type" :project-id="vm.projectId" :energy-type="type"
          :rule="vm.rules.find(rule => rule.energyType === type)" :standards="vm.standards" :saving="vm.saving === type" @save="vm.save" />
      </div></a-spin>
    </section>
  </FacilityWorkspace>
</template>
