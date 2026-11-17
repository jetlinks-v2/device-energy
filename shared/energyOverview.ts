import type { EnergyRow } from '../hooks/useReports'
import type { Device, Entity } from './types'
import { overviewEnergy } from './overview'

export const energyTypes = ['water', 'electricity', 'gas'] as const
export type EnergyType = typeof energyTypes[number]
export interface EnergyPeriod { period: string; from: number; to: number; meters: EnergyRow[] }
export interface EnergyMapping extends Entity {
  deviceId: string; energyType: string; meterLevel: string; enabled: boolean
  lastCollectionSuccessTime?: number; collectionError?: string
}
export interface EnergyMeterRow extends EnergyMapping {
  spaceName?: string; sourceState?: string; value?: number; unit: string; complete: boolean
}

/** 运行状态与采集状态分别统计；未知、未采集、停用不能混入正常。 */
export function energyHealth(mappings: EnergyMapping[], devices: Device[]) {
  const directory = new Map(devices.map(device => [device.id, device.sourceState]))
  const result = { total: mappings.length, enabled: 0, online: 0, offline: 0, unknown: 0,
    collected: 0, failed: 0, awaiting: 0, disabled: 0 }
  for (const mapping of mappings) {
    const state = directory.get(mapping.deviceId)
    if (state === 'online') result.online++
    else if (state === 'offline') result.offline++
    else result.unknown++
    if (!mapping.enabled) { result.disabled++; continue }
    result.enabled++
    if (mapping.collectionError?.trim()) result.failed++
    else if (mapping.lastCollectionSuccessTime) result.collected++
    else result.awaiting++
  }
  return result
}
export type EnergyHealth = ReturnType<typeof energyHealth>

/** 有采集缺口仍展示有效读数算出的用量；保留完整性，不把缺读数或单位冲突显示为零。 */
export function energyTotal(rows: EnergyRow[], type: string, expectedDevices?: string[]) {
  const total = overviewEnergy(rows, type)
  const selected = rows.filter(row => row.energyType === type)
  const included = new Set(selected.map(row => row.deviceId))
  const covered = !expectedDevices || expectedDevices.every(id => included.has(id))
  // 不完整的零值也可能只是缺少累计基线；只有完整区间才能确认真实零用量。
  const measurable = selected.every(row => row.usage.accepted > 0 && (row.usage.complete || Number(row.usage.value) > 0))
  return { ...total, complete: covered && total.complete, value: covered && measurable ? total.value : undefined }
}

/** 月份及自然日统一按上海时区；当月只统计到刷新时刻。 */
export function energyMonth(month: string, now = Date.now()) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match || Number(match[1]) < 2000 || Number(match[1]) > 2200 || Number(match[2]) < 1 || Number(match[2]) > 12)
    throw Error('invalid_month')
  const year = Number(match[1]), index = Number(match[2]) - 1
  const from = Date.UTC(year, index, 1) - 28800000
  const to = Math.min(now, Date.UTC(year, index + 1, 1) - 28800000)
  if (from >= to) throw Error('invalid_month')
  return { from, to, year, month: index + 1 }
}

export function energyMeterRows(mappings: EnergyMapping[], devices: Device[], energy: EnergyRow[]): EnergyMeterRow[] {
  const directory = new Map(devices.map(row => [row.id, row]))
  const usages = new Map<string, EnergyRow[]>()
  for (const row of energy) {
    const key = JSON.stringify([row.deviceId, row.energyType])
    const group = usages.get(key) || []
    group.push(row); usages.set(key, group)
  }
  return mappings.map(mapping => {
    const device = directory.get(mapping.deviceId)
    const rows = usages.get(JSON.stringify([mapping.deviceId, mapping.energyType])) || []
    const total = energyTotal(rows, mapping.energyType)
    return { ...mapping, name: mapping.name || device?.name || mapping.deviceId,
      spaceName: typeof device?.spaceName === 'string' ? device.spaceName : undefined,
      sourceState: device?.sourceState, value: total.value, unit: total.unit, complete: total.complete }
  })
}

/** 期间排名包含已解绑仪表的历史用量，当前设备数与明细仍使用当前配置清单。 */
export function energyRankingRows(mappings: EnergyMapping[], devices: Device[], energy: EnergyRow[]): EnergyMeterRow[] {
  const key = (row: { deviceId: string; energyType: string }) => JSON.stringify([row.deviceId, row.energyType])
  const directory = new Map(mappings.map(row => [key(row), row]))
  for (const row of energy) if (!directory.has(key(row))) directory.set(key(row), {
    id: key(row), version: 0, deviceId: row.deviceId, name: row.name, energyType: row.energyType, meterLevel: '', enabled: false
  })
  return energyMeterRows([...directory.values()], devices, energy)
}

export const energyNumber = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
