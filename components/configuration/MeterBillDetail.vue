<script setup lang="ts">
import { reactive } from 'vue'
import { useMeterBillDetail } from '../../hooks/useMeterBillDetail'
import { feText } from '../../shared/i18n'
import { taskTime } from '../../shared/types'
import { meterMoney, meterState, meterColor, meterUnit, meterEnergy } from '../../shared/meterBillPresentation'
import type { MeterDetailTarget, MeterMonthlyBill, MeterReviewAction } from '../../shared/meterBilling'
const props = defineProps<{ target: MeterDetailTarget }>()
const emit = defineEmits<{ close: []; changed: []; action: [action: MeterReviewAction, row: MeterMonthlyBill] }>()
const vm = reactive(useMeterBillDetail(props.target, () => emit('changed')))
const logName = (action: string) => ({ review: feText('meterApproved'), reject: feText('meterRejected'), recalculate: feText('meterRecalculate'), recover: feText('meterRecover') })[action] || action
const variableName = (key: string) => ({ STANDARD_PRICE: feText('meterUnitPrice'), WATER_USAGE: feText('meterWaterUsage'), ELECTRICITY_USAGE: feText('meterElectricUsage'), GAS_USAGE: feText('meterGasUsage'), BILLING_AREA: feText('managementArea'), PERIOD_MONTHS: feText('meterPeriodMonths') })[key] || key
</script>
<template>
  <a-drawer open :title="feText('meterBillDetail')" :width="'min(780px, calc(100vw - 48px))'" :mask-closable="false"
    :closable="!vm.busy" :keyboard="!vm.busy" @close="emit('close')">
    <a-spin :spinning="vm.loading">
      <div class="meter-detail">
        <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon />
        <a-alert v-if="vm.row?.error" :message="vm.row.error" type="error" show-icon />
        <template v-if="vm.result || vm.row">
          <div class="meter-detail__summary">
            <div><h3>{{ vm.result?.fullName || vm.row?.fullName || vm.row?.deviceName }}</h3><span>{{ vm.result?.customerName || vm.row?.customerName || '—' }} · {{ vm.result?.month || vm.row?.month }}</span></div>
            <div class="meter-detail__amount"><a-tag v-if="vm.row" :color="meterColor(vm.row.state)">{{ meterState(vm.row.state) }}</a-tag><strong>¥ {{ meterMoney(vm.result?.amount ?? vm.row?.amount) }}</strong></div>
          </div>
          <a-descriptions :column="2" size="small">
            <a-descriptions-item :label="feText('deviceName')">{{ vm.result?.deviceName || vm.row?.deviceName }}</a-descriptions-item>
            <a-descriptions-item :label="feText('energyType')">{{ meterEnergy(vm.result?.energyType || vm.row?.meterType) }}</a-descriptions-item>
            <a-descriptions-item :label="feText('receivableDate')">{{ vm.receivableDate || '—' }}</a-descriptions-item>
            <a-descriptions-item :label="feText('dueDate')">{{ vm.dueDate || '—' }}</a-descriptions-item>
            <a-descriptions-item :label="feText('billNo')" :span="2">{{ vm.result?.billNo || '—' }}</a-descriptions-item>
          </a-descriptions>
          <j-permission-button v-if="vm.editable && !vm.editing" hasPermission="facility/Billing:recalculate" type="link" class="meter-detail__date-action" @click="vm.editing = true">{{ feText('meterAdjustDates') }}</j-permission-button>
          <a-form v-if="vm.editing" layout="inline" class="meter-detail__dates">
            <a-form-item :label="feText('receivableDate')"><a-date-picker v-model:value="vm.receivableDate" value-format="YYYY-MM-DD" :disabled="vm.busy" /></a-form-item>
            <a-form-item :label="feText('dueDate')"><a-date-picker v-model:value="vm.dueDate" value-format="YYYY-MM-DD" :disabled="vm.busy" /></a-form-item>
            <a-form-item><j-permission-button hasPermission="facility/Billing:recalculate" type="primary" :loading="vm.busy" @click="vm.saveDates">{{ feText('meterSaveRecalculate') }}</j-permission-button></a-form-item>
          </a-form>
          <section>
            <h4>{{ feText('meterUsageDetail') }}</h4>
            <div v-if="vm.result?.detail?.readings?.length" class="meter-detail__readings">
              <div v-for="(reading, index) in vm.result.detail.readings" :key="index">
                <span>{{ feText(index === 0 ? 'meterStartReading' : 'meterEndReading') }}</span><strong>{{ meterMoney(reading.value) }}</strong><span>{{ taskTime(reading.time) }}</span>
              </div>
              <div><span>{{ feText('usageQuantity') }}</span><strong>{{ meterMoney(vm.result.quantity) }}</strong><span>{{ meterUnit(vm.result.energyType) }}</span></div>
            </div>
            <a-empty v-else :image="undefined" :description="feText('meterNoReadoutSnapshot')" />
          </section>
          <section v-if="vm.result">
            <h4>{{ feText('meterCalculation') }}</h4>
            <a-descriptions :column="2" size="small">
              <a-descriptions-item :label="feText('billingSubject')">{{ vm.result.subjectName }}</a-descriptions-item>
              <a-descriptions-item :label="feText('meterChargeStandard')">{{ vm.result.standardName }}</a-descriptions-item>
              <a-descriptions-item :label="feText('meterFormula')" :span="2"><span class="meter-detail__formula">{{ vm.result.detail?.formula || '—' }}</span></a-descriptions-item>
              <a-descriptions-item v-for="(value, key) in vm.result.detail?.values || {}" :key="key" :label="variableName(String(key))">{{ meterMoney(value) }}</a-descriptions-item>
            </a-descriptions>
            <table v-if="vm.result.detail?.tiers?.length" class="meter-detail__tiers">
              <thead><tr><th>{{ feText('meterTierRange') }}</th><th>{{ feText('usageQuantity') }}</th><th>{{ feText('meterUnitPrice') }}</th><th>{{ feText('meterTierAmount') }}</th></tr></thead>
              <tbody><tr v-for="(tier, index) in vm.result.detail.tiers" :key="index">
                <td>{{ meterMoney(tier.from) }}–{{ tier.to == null ? feText('meterNoUpperLimit') : meterMoney(tier.to) }}</td>
                <td>{{ meterMoney(tier.quantity) }}</td><td>{{ meterMoney(tier.price) }}</td><td>{{ meterMoney(tier.amount) }}</td>
              </tr></tbody>
            </table>
          </section>
          <section>
            <h4>{{ feText('meterReviewHistory') }}</h4>
            <a-alert v-if="vm.logsError" :message="vm.logsError" type="error" show-icon />
            <a-timeline v-if="vm.logs.length">
              <a-timeline-item v-for="log in vm.logs" :key="log.id">
                <strong>{{ logName(log.action) }}</strong> · {{ log.creatorName }} · {{ taskTime(log.createTime) }}<div v-if="log.comment">{{ log.comment }}</div>
              </a-timeline-item>
            </a-timeline>
            <a-descriptions v-else :column="2" size="small">
              <a-descriptions-item :label="feText('meterReviewer')">{{ vm.row?.reviewerName || vm.result?.detail?.reviewedName || '—' }}</a-descriptions-item>
              <a-descriptions-item :label="feText('meterReviewedTime')">{{ taskTime(vm.row?.reviewedTime || vm.result?.detail?.reviewedTime) }}</a-descriptions-item>
            </a-descriptions>
          </section>
        </template>
      </div>
    </a-spin>
    <template v-if="vm.row?.state === 'pending' && !vm.editing" #footer>
      <a-space>
        <j-permission-button hasPermission="facility/Billing:review" type="primary" @click="emit('action', 'review', vm.row!)">{{ feText('approveTask') }}</j-permission-button>
        <j-permission-button hasPermission="facility/Billing:reject" @click="emit('action', 'reject', vm.row!)">{{ feText('rejectTask') }}</j-permission-button>
      </a-space>
    </template>
  </a-drawer>
</template>
<style scoped>
.meter-detail { display: flex; flex-direction: column; gap: 20px; }
.meter-detail__summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.meter-detail h3 { font-size: 16px; margin: 0 0 6px; line-height: 1.6; }
.meter-detail h4 { font-size: 14px; margin: 0 0 16px; font-weight: 600; }
.meter-detail section { border-top: 1px solid #f0f0f0; padding-top: 20px; }
.meter-detail__amount { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; white-space: nowrap; }
.meter-detail__amount strong { font-size: 24px; color: #1677ff; font-variant-numeric: tabular-nums; }
.meter-detail__readings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.meter-detail__readings > div { display: flex; flex-direction: column; gap: 8px; }
.meter-detail__readings strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.meter-detail__readings span { color: #666; }
.meter-detail__formula { overflow-wrap: anywhere; }
.meter-detail__date-action { padding: 0; align-self: flex-start; }
.meter-detail__dates { row-gap: 12px; }
.meter-detail__tiers { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.meter-detail__tiers th, .meter-detail__tiers td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; }
.meter-detail__tiers th { background: #fafafa; font-weight: 500; }
.meter-detail__tiers th:first-child, .meter-detail__tiers td:first-child { text-align: left; }
</style>
