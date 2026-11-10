import type { CheckItem, CheckResult } from '../../../shared/types'
/** Server repeats this validation; client feedback points to the specific requirement. */
export function incompleteCheck(items: CheckItem[], results: CheckResult[]) {
  return items.find(item => {
    const row = results.find(r => r.itemId === item.id), value = row?.value?.trim() || ''
    if (item.required && !value) return true
    if (value && item.photoRequired && !row?.attachments.length) return true
    if (value && item.kind === 'number') {
      const number = Number(value)
      return !Number.isFinite(number)
    }
    if (value && item.kind === 'boolean') return !['true', 'false'].includes(value)
    if (value && item.kind === 'choice') return !item.options?.includes(value)
    if (value.length > 4000) return true
    return false
  })
}
