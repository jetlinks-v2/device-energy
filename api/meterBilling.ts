import { facility } from './index'
import type { Pager, Query } from '../shared/types'
import type { AllocatedDevice, Allocation, MeterAssociation, MeterRule, MeterStandard } from '../shared/meterBilling'
import type { MeterLedgerRow, MeterMonthlyBill, MeterReviewAction, MeterReviewDecision, MeterReviewOutcome, MeterReviewLog } from '../shared/meterBilling'
const billing = 'configuration/meter-billing'
/** Only device identity and period cross the confirmation boundary; finance owns quantities and amounts. */
export const meterApi = {
  devices: (query: Query) => facility.query<AllocatedDevice>('configuration/devices', query),
  allocate: (rows: Allocation[]) => facility.post<AllocatedDevice[]>('configuration/devices', rows),
  standards: (project: string) => facility.get<MeterStandard[]>(`${billing}/${encodeURIComponent(project)}/standards`),
  rules: (project: string) => facility.get<MeterRule[]>(`${billing}/${encodeURIComponent(project)}/rules`),
  saveRule: (rule: MeterAssociation) => facility.post<MeterRule>(`${billing}/rules`, rule),
  ledger: (project: string, query: Query) => facility.post<Pager<MeterLedgerRow>>(`${billing}/${encodeURIComponent(project)}/bills/_query`, query),
  published: (project: string, id: string) => facility.get<MeterLedgerRow>(`${billing}/${encodeURIComponent(project)}/bills/${encodeURIComponent(id)}`),
  reviews: (project: string, state: string, query: Query) => facility.post<Pager<MeterMonthlyBill>>(`${billing}/${encodeURIComponent(project)}/reviews/_query?state=${encodeURIComponent(state)}`, query),
  detail: (id: string) => facility.get<MeterMonthlyBill>(`${billing}/reviews/${encodeURIComponent(id)}`),
  logs: (id: string, query: Query) => facility.post<Pager<MeterReviewLog>>(`${billing}/reviews/${encodeURIComponent(id)}/logs/_query`, query),
  review: (action: MeterReviewAction, rows: MeterReviewDecision[]) => facility.post<MeterReviewOutcome[]>(`${billing}/reviews/_${action}`, rows)
}
