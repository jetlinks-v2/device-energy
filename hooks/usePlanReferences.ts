import { computed, ref, watch, type Ref } from 'vue'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { messageOf, type Entity, type FormValues, type Option, type Query, type Resource } from '../shared/types'
import type { CycleRule } from '../shared/cycle/types'

/** 候选均限定当前项目；切换项目清空引用，旧请求不能覆盖新项目。 */
export function usePlanReferences(resource: () => Resource, form: FormValues, opened: Ref<boolean>,
  options: Record<string, Option[]>, error: Ref<string>) {
  const cycles = ref<Entity[]>([]), groups = ref<Entity[]>([])
  let sequence = 0
  const selectedCycle = computed(() => cycles.value.find(row => row.id === form.cycleId)?.rule as CycleRule | undefined)
  const deviceCount = computed(() => new Set(groups.value
    .filter(row => (form.groupIds as string[] || []).includes(row.id))
    .flatMap(row => row.deviceIds as string[] || [])).size)
  async function candidates(path: string, query: Query): Promise<Entity[]> {
    const rows: Entity[] = []
    for (let pageIndex = 0; pageIndex < 25; pageIndex++) {
      const page = await facility.query(path, { ...query, pageSize: 200, pageIndex, sorts: [{ name: 'id', order: 'asc' }] })
      if (page.total > 5000) throw Error(feText('referenceLimit'))
      rows.push(...page.data)
      if (rows.length >= page.total) return rows
      if (!page.data.length) throw Error(feText('requestFailed'))
    }
    throw Error(feText('referenceLimit'))
  }
  watch(() => [opened.value, form.projectId, form.kind], async () => {
    if (!['plans', 'groups'].includes(resource().path)) return
    const current = ++sequence
    if (resource().path === 'groups') {
      options.devices = []
      if (!opened.value || !form.projectId) return
      try {
        const rows = await candidates('devices', { terms: [
          { column: 'projectId', value: form.projectId },
          // Existing records may have only one of the former independent flags set.
          { type: 'and', terms: [{ column: 'inspectionEnabled', value: true },
            { type: 'or', column: 'maintenanceEnabled', value: true }] }
        ] })
        if (current === sequence) options.devices = rows.map(row => ({ value: row.id, label: row.name || row.id }))
      } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
      return
    }
    cycles.value = []; groups.value = []
    for (const source of ['standards', 'cycles', 'groups', 'employees']) options[source] = []
    if (!opened.value || !form.projectId) return
    const terms = [{ column: 'projectId', value: form.projectId }]
    try {
      const [standards, schedule, rooms, people] = await Promise.all([
        candidates('standards', { terms: [...terms, { column: 'kind', value: form.kind }, { column: 'enabled', value: true }] }),
        candidates('cycles', { terms: [...terms, { column: 'kind', value: form.kind }, { column: 'enabled', value: true }] }),
        candidates('groups', { terms }),
        facility.options<Entity>('employees/' + encodeURIComponent(String(form.projectId)))
      ])
      if (current !== sequence) return
      cycles.value = schedule; groups.value = rooms
      for (const [source, rows] of Object.entries({ standards, cycles: schedule, groups: rooms, employees: people }))
        options[source] = rows.map(row => ({ value: row.id, label: row.name || row.id }))
    } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
  })
  return { selectedCycle, deviceCount }
}
