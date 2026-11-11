<script setup lang="ts">
import { reactive, ref } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { useMeterBillReview } from '../../hooks/useMeterBillReview'
import { feText } from '../../shared/i18n'
import { meterColor, meterMoney, meterSearchFields, meterState, meterUnit, meterChargeName, meterChargeColor } from '../../shared/meterBillPresentation'
import type { MeterDetailTarget, MeterMonthlyBill, MeterReviewAction } from '../../shared/meterBilling'
import type { TableHandle } from '../../shared/tableQuery'
import MeterBillDetail from './MeterBillDetail.vue'
import MeterEnergyFilter from './MeterEnergyFilter.vue'
const props = defineProps<{ projectId: string }>(), emit = defineEmits<{ close: []; changed: [] }>()
const vm = reactive(useMeterBillReview(props.projectId, () => emit('changed')))
const filters = ref<ConditionFilterTerm[]>([]), detail = ref<MeterDetailTarget>(), fields = meterSearchFields(true)
const tabs = [{ key: 'pending', label: 'meterPending' }, { key: 'approved', label: 'meterApproved' },
  { key: 'rejected', label: 'meterRejected' }, { key: 'error', label: 'meterException' }, { key: 'all', label: 'reviewAll' }] as const
const columns = [
  { title: feText('billingMonth'), dataIndex: 'month', width: 100 },
  { title: feText('meterChargeType'), key: 'energy', scopedSlots: true, width: 100 },
  { title: feText('installationSpace'), dataIndex: 'fullName', width: 240, ellipsis: true },
  { title: feText('billingCustomer'), dataIndex: 'customerName', width: 100 },
  { title: feText('deviceName'), dataIndex: 'deviceName', width: 180 },
  { title: feText('usageQuantity'), key: 'quantity', scopedSlots: true, width: 110, align: 'right' },
  { title: feText('billAmount'), key: 'amount', scopedSlots: true, width: 110, align: 'right' },
  { title: feText('status'), key: 'state', scopedSlots: true, width: 110 },
  { title: feText('actions'), key: 'actions', scopedSlots: true, width: 200, fixed: 'right' }
]
const setTable = (value: unknown) => { vm.table = value as TableHandle | undefined }
const actFromDetail = (action: MeterReviewAction, row: MeterMonthlyBill) => { detail.value = undefined; vm.start(action, [row]) }
const detailChanged = () => { vm.table?.reload(); emit('changed') }
</script>
<template>
  <a-modal open :title="feText('meterReviewTitle')" :width="'min(1380px, calc(100vw - 48px))'" :footer="null" :mask-closable="false"
    :closable="!vm.busy && !vm.action && !detail" :keyboard="false" :body-style="{ maxHeight: 'calc(100dvh - 160px)', overflowY: 'auto' }" @cancel="emit('close')">
    <section class="meter-review">
      <a-tabs :active-key="vm.status" :animated="false" @change="vm.changeStatus">
        <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="feText(tab.label)" :disabled="vm.busy || !!vm.action || !!detail" />
      </a-tabs>
      <MeterEnergyFilter :value="vm.energy" :disabled="vm.busy || !!vm.action || !!detail" @change="vm.changeEnergy" />
      <ConditionFilter v-model="filters" :fields="fields" @change="vm.filter($event.filter.terms)" />
      <div v-if="vm.status === 'pending'" class="meter-review__batch">
        <a-space>
          <j-permission-button hasPermission="facility/Billing:review" type="primary" :disabled="vm.busy || !vm.selected.length" @click="vm.start('review')">{{ feText('batchApprove') }}</j-permission-button>
          <j-permission-button hasPermission="facility/Billing:reject" :disabled="vm.busy || !vm.selected.length" @click="vm.start('reject')">{{ feText('batchReject') }}</j-permission-button>
        </a-space>
        <span v-if="vm.selected.length">{{ feText('meterSelected') }} {{ vm.selected.length }}</span>
      </div>
      <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon />
      <a-alert v-if="vm.outcomes.some(row => !row.success)" type="warning" show-icon
        :message="`${feText('approvalSucceeded')} ${vm.outcomes.filter(row => row.success).length}，${feText('approvalFailed')} ${vm.outcomes.filter(row => !row.success).length}`">
        <template #description><div v-for="row in vm.outcomes.filter(row => !row.success)" :key="row.id">{{ row.name }}：{{ row.error }}</div></template>
      </a-alert>
      <j-pro-table :key="vm.status" :ref="setTable" mode="TABLE" type="PAGE" row-key="id" :columns="columns"
        :params="vm.params" :request="vm.request" :row-selection="vm.status === 'pending' ? vm.selection : undefined" :alert-show="false"
        :pagination="{ pageSize: 12, showSizeChanger: false }" :no-pagination="false" :body-style="{ padding: 0 }"
        :scroll="{ x: 1350, y: 'min(420px, calc(100dvh - 440px))' }">
        <template #energy="row"><a-tag :color="meterChargeColor(row.meterType)">{{ meterChargeName(row.meterType) }}</a-tag></template>
        <template #quantity="row">{{ meterMoney(row.quantity) }} {{ meterUnit(row.meterType) }}</template>
        <template #amount="row"><strong>{{ meterMoney(row.amount) }}</strong></template>
        <template #state="row"><a-tag :color="meterColor(row.state)">{{ meterState(row.state) }}</a-tag></template>
        <template #actions="row">
          <a-space :size="0">
            <j-permission-button hasPermission="facility/Billing:detail" type="link" @click="detail = { id: row.id, projectId, published: false }">{{ feText('details') }}</j-permission-button>
            <j-permission-button v-if="row.state === 'pending'" hasPermission="facility/Billing:review" type="link" :disabled="vm.busy" @click="vm.start('review', [row])">{{ feText('approveTask') }}</j-permission-button>
            <j-permission-button v-if="row.state === 'pending'" hasPermission="facility/Billing:reject" type="link" :disabled="vm.busy" @click="vm.start('reject', [row])">{{ feText('rejectTask') }}</j-permission-button>
            <j-permission-button v-if="['error', 'rejected'].includes(row.state)" hasPermission="facility/Billing:recalculate" type="link" @click="vm.start('recalculate', [row])">{{ feText('meterRecalculate') }}</j-permission-button>
            <j-permission-button v-if="['failed', 'processing'].includes(row.state)" hasPermission="facility/Billing:recover" type="link" @click="vm.start('recover', [row])">{{ feText('meterRecover') }}</j-permission-button>
          </a-space>
        </template>
      </j-pro-table>
    </section>
    <MeterBillDetail v-if="detail" :target="detail" @close="detail = undefined" @action="actFromDetail" @changed="detailChanged" />
    <a-modal :open="!!vm.action" :title="feText(vm.action === 'reject' ? 'meterConfirmReject' : vm.action === 'review' ? 'meterConfirmApprove' : 'meterConfirmRecalculate')"
      :confirm-loading="vm.busy" :mask-closable="false" :closable="!vm.busy" :keyboard="!vm.busy" :cancel-button-props="{ disabled: vm.busy }"
      @cancel="vm.action = undefined" @ok="vm.confirm">
      <p>{{ feText('meterSelected') }} {{ vm.targets.length }}</p>
      <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon />
      <a-form v-if="vm.action === 'review' || vm.action === 'reject'" layout="vertical">
        <a-form-item :label="feText(vm.action === 'reject' ? 'rectificationReason' : 'reviewNotes')" :required="vm.action === 'reject'">
          <a-textarea v-model:value="vm.comment" :maxlength="512" :rows="3" :disabled="vm.busy" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-modal>
</template>
<style scoped>
.meter-review { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.meter-review__batch { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.meter-review :deep(.ant-tabs-nav) { margin-bottom: 0; }
.meter-review :deep(.ant-alert-description) { max-height: 100px; overflow-y: auto; overflow-wrap: anywhere; }
</style>
