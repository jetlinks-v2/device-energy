<script setup lang="ts">
import { reactive, toRef } from 'vue'
import { useMeterBillPreview } from '../../hooks/useMeterBillPreview'
import { feText } from '../../shared/i18n'
import type { MeterBillRow } from '../../shared/meterBilling'
import type { TableHandle } from '../../shared/tableQuery'
const props = defineProps<{ projectId: string }>()
const vm = reactive(useMeterBillPreview(toRef(props, 'projectId')))
const columns = [
  { title: feText('deviceName'), dataIndex: 'deviceName', width: 160 },
  { title: feText('installationSpace'), key: 'space', scopedSlots: true, width: 200 },
  { title: feText('billingCustomer'), key: 'customer', scopedSlots: true, width: 120 },
  { title: feText('usageQuantity'), key: 'quantity', scopedSlots: true, width: 110 },
  { title: feText('billAmount'), key: 'amount', scopedSlots: true, width: 120 },
  { title: feText('validationResult'), key: 'status', scopedSlots: true, width: 240 },
  { title: feText('billNo'), key: 'billNo', scopedSlots: true, width: 180 }
]
const setTable = (value: unknown) => { vm.table = value as TableHandle | undefined }
const select = (keys: string[], rows: MeterBillRow[]) => { vm.selected = keys; vm.selectedRows = rows }
</script>
<template>
  <section class="facility-resource-page meter-preview">
    <a-alert v-if="vm.error" :message="vm.error" type="error" show-icon />
    <div class="facility-toolbar meter-period">
      <a-form layout="inline">
        <a-form-item :label="feText('billingMonth')"><a-date-picker v-model:value="vm.month" picker="month" value-format="YYYY-MM" :disabled="vm.generating" /></a-form-item>
        <a-form-item :label="feText('receivableDate')"><a-date-picker v-model:value="vm.receivableDate" value-format="YYYY-MM-DD" :disabled="vm.generating" /></a-form-item>
        <a-form-item :label="feText('dueDate')"><a-date-picker v-model:value="vm.dueDate" value-format="YYYY-MM-DD" :disabled="vm.generating" /></a-form-item>
      </a-form>
      <j-permission-button hasPermission="facility/Billing:preview" :disabled="vm.generating" @click="vm.preview">{{ feText('previewBills') }}</j-permission-button>
      <j-permission-button hasPermission="facility/Billing:generate" type="primary" :disabled="!vm.selected.length" :loading="vm.generating" @click="vm.generate">{{ feText('generateBills') }}</j-permission-button>
    </div>
    <a-alert v-for="row in vm.results.filter(row => row.error)" :key="row.id" type="error" show-icon :message="row.deviceName + '：' + row.error" />
    <j-pro-table :ref="setTable" row-key="id" mode="TABLE" type="PAGE" :columns="columns" :params="vm.params" :request="vm.request"
      :pagination="{ pageSize: 20, showSizeChanger: false }" :body-style="{ padding: 0 }" :alert-show="false" :scroll="{ x: 1230 }"
      :row-selection="{ selectedRowKeys: vm.selected, onChange: select, getCheckboxProps: (row: MeterBillRow) => ({ disabled: vm.generating || !!row.error || !row.result || !!row.result.billId }) }">
      <template #space="row">{{ row.result?.fullName || '—' }}</template>
      <template #customer="row">{{ row.result?.customerName || '—' }}</template>
      <template #quantity="row">{{ row.result ? row.result.quantity + (row.meterType === 'water' ? ' m³' : ' kW·h') : '—' }}</template>
      <template #amount="row">{{ row.result ? '¥ ' + row.result.amount : '—' }}</template>
      <template #status="row"><span v-if="row.error" class="meter-error-text">{{ row.error }}</span><a-tag v-else :color="row.result?.billId ? 'default' : 'blue'">{{ feText(row.result?.billId ? 'billCreated' : 'readyToBill') }}</a-tag></template>
      <template #billNo="row">{{ row.result?.billNo || '—' }}</template>
    </j-pro-table>
  </section>
</template>
