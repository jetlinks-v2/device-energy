import type { ConditionFilterField } from '@jetlinks-web-core/components/ConditionFilter/types'
import { feText } from './i18n'
import type { MeterReviewState } from './meterBilling'

export const meterMoney = (value: unknown) => value == null ? '—' : Number(value).toFixed(2)
export const meterState = (state: MeterReviewState) => ({
  pending: feText('meterPending'), approved: feText('meterApproved'), rejected: feText('meterRejected'),
  error: feText('meterException'), processing: feText('meterProcessing'), failed: feText('meterFailed')
})[state]
export const meterColor = (state: MeterReviewState) => ({ pending: 'blue', approved: 'green', rejected: 'orange', error: 'red', processing: 'processing', failed: 'red' })[state]
export const meterSearchFields = (review = false): ConditionFilterField[] => [
  { title: feText('billingMonth'), dataIndex: review ? 'month' : 'accountPeriod', search: { type: 'date', componentProps: { picker: 'month', format: 'YYYY-MM', valueFormat: 'YYYY-MM' }, termTypeOptions: ['eq', 'gt', 'lt'] } },
  { title: feText('installationSpace'), dataIndex: 'fullName', search: { type: 'string' } },
  { title: feText('billingCustomer'), dataIndex: 'customerName', search: { type: 'string' } },
  ...(review ? [
    { title: feText('deviceName'), dataIndex: 'deviceName', search: { type: 'string' as const } },
    { title: feText('energyType'), dataIndex: 'meterType', search: { type: 'select' as const, options: [
      { value: 'water', label: feText('water') }, { value: 'electricity', label: feText('electricity') }
    ] } }
  ] : [
    { title: feText('billNo'), dataIndex: 'billNo', search: { type: 'string' as const } },
    { title: feText('billingSubject'), dataIndex: 'subjectName', search: { type: 'string' as const } }
  ])
]
