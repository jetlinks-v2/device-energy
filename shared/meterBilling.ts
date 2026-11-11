import type { Device, Entity, Query } from './types'
export type MeterType = 'device' | 'water' | 'electricity'
export interface AllocatedDevice extends Device { meterType?: MeterType; spaceId?: string; allocationSince?: number; productName?: string }
export interface Allocation { id: string; version: number; projectId: string; meterType: MeterType; spaceId?: string; updateSpace: boolean }
export interface MeterVariable { code: string; name: string; system: boolean }
export interface MeterStandard {
  id: string; version: number; subjectId: string; subjectName: string; name: string; formula: string
  price: number; effectiveFrom?: string; effectiveTo?: string; variables: MeterVariable[]
}
export interface MeterRule extends Partial<Entity> {
  projectId: string; energyType: 'water' | 'electricity'; subjectId?: string; standardId?: string; usageVariable?: string
  fixedValues: Record<string, number | string>; effectiveFrom?: string; effectiveTo?: string; enabled: boolean
}
export type MeterAssociation = Pick<MeterRule, 'id' | 'version' | 'projectId' | 'energyType' | 'subjectId' | 'standardId'>
export interface BillingPeriod { projectId: string; month: string; receivableDate: string; dueDate: string; query?: Query }
export interface MeterBillResult {
  deviceId: string; deviceName: string; projectId: string; spaceId: string; fullName: string; customerName: string
  energyType: string; month: string; quantity: number; amount: number; subjectName: string; standardName: string
  fingerprint: string; billId?: string; billNo?: string
}
export interface MeterBillRow { id: string; deviceName: string; meterType: string; result?: MeterBillResult; error?: string }
export interface BillConfirmation { deviceId: string; month: string; receivableDate: string; dueDate: string; fingerprint: string }
