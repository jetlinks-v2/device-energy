import { feText } from '../shared/i18n'
import type { CheckItem } from '../shared/types'

export const fixedCheckOptions = () => [feText('compliant'), feText('nonCompliant')]

/** Legacy yes/no checks are edited as compliance choices; existing task snapshots stay unchanged. */
export const normalizeCheckItems = (items: CheckItem[]): CheckItem[] => items.map(item =>
  ['boolean', 'choice'].includes(item.kind)
    ? { ...item, kind: 'choice', options: fixedCheckOptions() } : item)

/** Keep stable item IDs because generated tasks refer to them in their result snapshots. */
export function useCheckItems(items: () => CheckItem[], change: (items: CheckItem[]) => void) {
  const update = (id: string, patch: Partial<CheckItem>) => change(normalizeCheckItems(items().map(item => {
    if (item.id !== id) return item
    const next = { ...item, ...patch }
    if (patch.kind && patch.kind !== item.kind) {
      next.minimum = undefined
      next.maximum = undefined
      next.options = undefined
    }
    return next
  })))
  const add = () => {
    if (items().length >= 100) return
    change([...items(), { id: crypto.randomUUID(), name: '', kind: 'choice', options: fixedCheckOptions(), required: true, photoRequired: true }])
  }
  const remove = (id: string) => change(items().filter(item => item.id !== id))
  return { update, add, remove }
}

export function validateCheckItems(items: CheckItem[]): string | undefined {
  if (!items.length || items.length > 100) return feText('checkItemsCountRequired')
  for (const [index, item] of items.entries()) {
    const prefix = `${feText('inspectionItem')} ${index + 1}：`
    if (!item.name.trim()) return prefix + feText('enterCheckItemName')
    if (!['boolean', 'number', 'text', 'choice'].includes(item.kind)) return prefix + feText('selectCheckResultType')
    if (item.kind === 'choice' && (!item.options?.length || item.options.some(option => !option.trim()) ||
      new Set(item.options.map(option => option.trim())).size !== item.options.length)) return prefix + feText('checkOptionsRequired')
    if (item.kind === 'number' && item.minimum != null && item.maximum != null && item.minimum > item.maximum)
      return prefix + feText('checkRangeInvalid')
  }
}
