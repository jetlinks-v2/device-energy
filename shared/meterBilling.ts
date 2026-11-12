import type { Device, Entity } from './types'
export type MeterType = 'device' | 'water' | 'electricity' | 'gas'
export interface AllocatedDevice extends Device { meterType?: MeterType; spaceId?: string; allocationSince?: number; productName?: string }
export interface Allocation { id: string; version: number; projectId: string }
export interface MeterVariable { code: string; name: string; system: boolean }
export interface MeterStandard {
  id: string; version: number; subjectId: string; subjectName: string; name: string; formula: string
  price: number; effectiveFrom?: string; effectiveTo?: string; variables: MeterVariable[]
}
export interface MeterRule extends Partial<Entity> {
  projectId: string; energyType: 'water' | 'electricity' | 'gas'; subjectId?: string; standardId?: string; usageVariable?: string
  fixedValues: Record<string, number | string>; effectiveFrom?: string; effectiveTo?: string; enabled: boolean
}
export type MeterAssociation = Pick<MeterRule, 'id' | 'version' | 'projectId' | 'energyType' | 'subjectId' | 'standardId'>
export interface MeterBillResult {
  deviceId: string; deviceName: string; projectId: string; spaceId: string; fullName: string; customerName: string
  energyType: string; month: string; quantity: number; amount: number; subjectName: string; standardName: string
  fingerprint: string; billId?: string; billNo?: string
  detail?: MeterCalculation
}
export interface MeterCalculation {
  receivableDate: string; dueDate: string; formula?: string; price?: number; values?: Record<string, number>
  readings?: { value: number; rawValue?: number; time: number }[]; reviewedName?: string; reviewedTime?: number
  tiers?: { from: number; to?: number; price: number; quantity: number; amount: number }[]
}
export interface MeterLedgerRow {
  id: string; accountPeriod: string; fullName: string; customerName: string; subjectName: string
  billNo: string; receivableDate: string; dueDate: string; result: MeterBillResult
}
export type MeterReviewState = 'pending' | 'approved' | 'rejected' | 'error' | 'processing' | 'failed'
export interface MeterMonthlyBill {
  id: string; projectId: string; deviceId: string; deviceName: string; meterType: string; month: string
  fullName?: string; customerName?: string; quantity?: number; amount?: number; state: MeterReviewState
  receivableDate: string; dueDate: string; result?: MeterBillResult; error?: string; version: number
  reviewerName?: string; reviewedTime?: number; modifyTime: number; comment?: string
}
export type MeterReviewAction = 'review' | 'reject' | 'recalculate' | 'recover'
export interface MeterReviewDecision { id: string; version: number; comment?: string; receivableDate?: string; dueDate?: string }
export interface MeterReviewOutcome { id: string; name: string; success: boolean; error?: string }
export interface MeterDetailTarget { id: string; projectId: string; published: boolean }
export interface MeterReviewLog { id: string; action: string; fromState: string; toState: string; creatorName: string; createTime: number; comment?: string }
