<script setup lang="ts">
import { reactive, ref, toRef, watch } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import MeterBillReview from '../../../components/configuration/MeterBillReview.vue'
import MeterBillDetail from '../../../components/configuration/MeterBillDetail.vue'
import MeterEnergyFilter from '../../../components/configuration/MeterEnergyFilter.vue'
import { useBillingProject } from '../../../hooks/useBillingProject'
import { useMeterBillLedger } from '../../../hooks/useMeterBillLedger'
import { feText } from '../../../shared/i18n'
import { meterMoney, meterSearchFields, meterUnit, meterChargeName, meterChargeColor } from '../../../shared/meterBillPresentation'
import type { TableHandle } from '../../../shared/tableQuery'
const project = reactive(useBillingProject()), vm = reactive(useMeterBillLedger(toRef(project, 'projectId')))
const filters = ref<ConditionFilterTerm[]>([]), fields = meterSearchFields()
watch(() => project.projectId, () => { filters.value = [] })
const setTable = (value: unknown) => { vm.table = value as TableHandle | undefined }
const columns = [
  { title: feText('billingMonth'), dataIndex: 'accountPeriod', width: 100 },
  { title: feText('meterChargeType'), key: 'energy', scopedSlots: true, width: 100 },
  { title: feText('installationSpace'), dataIndex: 'fullName', width: 260, ellipsis: true },
  { title: feText('billingCustomer'), dataIndex: 'customerName', width: 110 },
  { title: feText('deviceName'), key: 'device', scopedSlots: true, width: 170 },
  { title: feText('usageQuantity'), key: 'quantity', scopedSlots: true, width: 110, align: 'right' },
  { title: feText('billAmount'), key: 'amount', scopedSlots: true, width: 110, align: 'right' },
  { title: feText('billNo'), dataIndex: 'billNo', width: 240 },
  { title: feText('receivableDate'), dataIndex: 'receivableDate', width: 120 },
  { title: feText('dueDate'), dataIndex: 'dueDate', width: 120 },
  { title: feText('actions'), key: 'actions', scopedSlots: true, width: 80, fixed: 'right' }
]
</script>
<template>
  <FacilityWorkspace>
    <section class="facility-page facility-resource-page meter-ledger">
      <div class="meter-ledger__filters">
        <a-select v-model:value="project.projectId" :options="project.projects" :loading="project.loading" :placeholder="feText('chooseProject')"
          show-search option-filter-prop="label" class="meter-ledger__project" :disabled="vm.reviewing" />
        <ConditionFilter :key="project.projectId" v-model="filters" class="meter-ledger__search" :fields="fields" @change="vm.filter($event.filter.terms)" />
      </div>
      <a-alert v-if="project.error || vm.error" :message="project.error || vm.error" type="error" show-icon />
      <div class="facility-toolbar meter-ledger__actions">
        <j-permission-button hasPermission="facility/Billing:review" type="primary" :disabled="!project.projectId" @click="vm.reviewing = true">{{ feText('meterReview') }}</j-permission-button>
        <MeterEnergyFilter :value="vm.energy" :disabled="vm.reviewing" @change="vm.changeEnergy" />
      </div>
      <j-pro-table v-if="project.projectId" :key="project.projectId" :ref="setTable" mode="TABLE" type="PAGE" row-key="id"
        :columns="columns" :params="vm.params" :request="vm.request" :alert-show="false" :body-style="{ padding: 0 }"
        :pagination="{ pageSize: 20, showSizeChanger: false }" :no-pagination="false" :scroll="{ x: 1620 }">
        <template #energy="row"><a-tag :color="meterChargeColor(row.result?.energyType)">{{ meterChargeName(row.result?.energyType) }}</a-tag></template>
        <template #device="row">{{ row.result?.deviceName || '—' }}</template>
        <template #quantity="row">{{ meterMoney(row.result?.quantity) }} {{ meterUnit(row.result?.energyType) }}</template>
        <template #amount="row"><strong>{{ meterMoney(row.result?.amount) }}</strong></template>
        <template #actions="row"><j-permission-button hasPermission="facility/Billing:detail" type="link"
          @click="vm.detail = { id: row.id, projectId: project.projectId!, published: true }">{{ feText('details') }}</j-permission-button></template>
      </j-pro-table>
      <a-empty v-else-if="!project.loading" :description="feText('chooseProject')" />
      <MeterBillReview v-if="vm.reviewing && project.projectId" :project-id="project.projectId" @close="vm.reviewing = false" @changed="vm.refresh" />
      <MeterBillDetail v-if="vm.detail" :target="vm.detail" @close="vm.detail = undefined" />
    </section>
  </FacilityWorkspace>
</template>
<style scoped>
.meter-ledger { min-width: 0; overflow: hidden; }
.meter-ledger__filters { display: flex; align-items: center; gap: 12px; min-width: 0; margin-bottom: var(--space-4, 1rem); }
.meter-ledger__project { width: 220px; flex: 0 0 220px; }
.meter-ledger__search { flex: 1; min-width: 0; }
.meter-ledger__actions { justify-content: space-between; flex-wrap: wrap; }
.meter-ledger :deep(.pro-table-container) { min-width: 0; }
@media (max-width: 1100px) { .meter-ledger__project { width: 180px; flex-basis: 180px; } }
</style>
