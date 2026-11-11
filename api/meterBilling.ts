import { facility } from './index'
import type { Pager, Query } from '../shared/types'
import type { AllocatedDevice, Allocation, MeterRule, MeterStandard, MeterBillRow, BillingPeriod, BillConfirmation } from '../shared/meterBilling'
const billing = 'configuration/meter-billing'
/** Only device identity and period cross the confirmation boundary; finance owns quantities and amounts. */
export const meterApi = {
  devices: (query: Query) => facility.query<AllocatedDevice>('configuration/devices', query),
  allocate: (rows: Allocation[]) => facility.post<AllocatedDevice[]>('configuration/devices', rows),
  standards: (project: string) => facility.get<MeterStandard[]>(`${billing}/${encodeURIComponent(project)}/standards`),
  rules: (project: string) => facility.get<MeterRule[]>(`${billing}/${encodeURIComponent(project)}/rules`),
  saveRule: (rule: MeterRule) => facility.post<MeterRule>(`${billing}/rules`, rule),
  preview: (period: BillingPeriod) => facility.post<Pager<MeterBillRow>>(`${billing}/preview`, period),
  generate: (rows: BillConfirmation[]) => facility.post<MeterBillRow[]>(`${billing}/generate`, rows)
}
