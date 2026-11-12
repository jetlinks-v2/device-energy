import type { EChartsOption } from 'echarts'
import type { Entity, Usage } from '../../shared/types'

export type ReportTab = 'work' | 'faults' | 'energy'
export type ReportSource = 'work' | 'faults' | 'alerts' | 'energy'
export interface ReportPoint { date: string; [key: string]: string | number | boolean | null | undefined }
export interface ReportDevice { id?: string; deviceId?: string; name: string; count?: number; usage?: Usage; unit?: string }
export interface WorkReport {
  total: number; completed: number; due: number; onTimeRate: number | null; overdue: number; closed: number; cancelled: number; asOf: number
  trend: ReportPoint[]; groups: { id: string; name: string; total: number; onTimeRate: number | null }[]; states: Record<string, number>
}
export interface FaultReport {
  total: number; completed: number; outstanding: number; completionRate: number | null; averageClosureHours: number | null; asOf: number
  trend: ReportPoint[]; devices: ReportDevice[]; ages: Record<string, number>
}
export interface AlertReport {
  total: number; critical: number; pending: number; recovered: number; asOf: number
  trend: ReportPoint[]; types: string[]; devices: ReportDevice[]; states: Record<string, number>
}
export interface EnergyReport {
  summary: { value: number | null; dailyAverage: number | null; previousRate: number | null; unit: string; complete: boolean; meterCount: number; accepted: number; anomalies: number }
  trend: ReportPoint[]; devices: ReportDevice[]
}
export interface TargetReport { target: number; actual: number; executionRate: number | null; count: number; complete: boolean; unit: string }
export interface ReportPanel<T> { data?: T; loading: boolean; error: string }
export interface ReportChart { title: string; option: EChartsOption; empty: boolean; rows: unknown[][] }
export interface ReportView {
  metrics: { title: string; value: string }[]; note: string
  main: ReportChart; left: ReportChart; right?: ReportChart
}
export interface ReportDrill {
  source: ReportSource; title: string; query: string; terms: import('../../shared/types').Term[]
  projectId?: string; from: number; to: number; kind: string
}
export interface ReportDetail extends Entity { deviceId?: string; deviceCount?: number; scheduledTime?: number; firstTime?: number; completedTime?: number; usage?: Usage }
