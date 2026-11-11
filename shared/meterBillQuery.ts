import type { Query } from './types'
import type { MeterType } from './meterBilling'

export type MeterEnergyFilter = 'all' | Exclude<MeterType, 'device'>
/** 快捷分类与组件条件取交集，OR 搜索不能越过已选择的费用类型。 */
export function meterBillQuery(query: Query, energy: MeterEnergyFilter, column: 'meterType' | 'energyType'): Query {
  if (energy === 'all') return query
  return { ...query, terms: [
    { column, termType: 'eq', value: energy },
    ...(query.terms?.length ? [{ type: 'and' as const, terms: query.terms }] : [])
  ] }
}
