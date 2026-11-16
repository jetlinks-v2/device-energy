import { computed, onMounted, ref, watch } from 'vue'
import { facility, queryResource } from '../api'
import { feText } from '../shared/i18n'
import { messageOf, type Entity, type Query, type Resource, type Term } from '../shared/types'
import { resourceQuery, selectedProject, type TableHandle } from '../shared/tableQuery'

/** 组件列表由平台表格负责分页、重载和请求取消；兼容页面保留原查询。 */
export function useResourceQuery(resource: () => Resource, kind?: string, managed = false) {
  const table = ref<TableHandle>()
  const rows = ref<Entity[]>([]), total = ref(0), page = ref(1), search = ref('')
  const projectId = ref<string>(), busy = ref(false), failedOnly = ref(false), error = ref('')
  const terms = ref<Term[]>([])
  const params = computed<Query>(() => ({
    terms: managed && resource().path === 'devices' && projectId.value
      ? [{ column: 'projectId', value: projectId.value }, ...(terms.value.length ? [{ type: 'and', terms: terms.value }] : [])]
      : terms.value
  }))
  let sequence = 0
  const request = async (query: Query, context?: { signal: AbortSignal }) => {
    const current = ++sequence
    busy.value = true
    error.value = ''
    try {
      const result = await queryResource(resource().path, resourceQuery(query, resource().path === 'groups' ? undefined : kind), context?.signal)
      if (current === sequence && !context?.signal.aborted) {
        rows.value = result.data
        total.value = result.total
      }
      return { success: true, result }
    } catch (cause) {
      if (current === sequence && !context?.signal.aborted) error.value = messageOf(cause)
      throw cause
    } finally {
      if (current === sequence) busy.value = false
    }
  }
  const refresh = async () => {
    if (managed) {
      table.value?.reload()
      return
    }
    const current = ++sequence
    busy.value = true
    error.value = ''
    try {
      const filters: Term[] = []
      if (resource().collection && failedOnly.value) filters.push({ column: 'collectionError', termType: 'notnull', value: true })
      if (search.value) filters.push({ column: 'name', termType: 'like', value: '%' + search.value + '%' })
      if (projectId.value) filters.push({ column: 'projectId', value: projectId.value })
      const result = await facility.query(resource().path, resourceQuery({ pageIndex: page.value - 1, pageSize: 20, terms: filters }, resource().path === 'groups' ? undefined : kind))
      if (current === sequence) { rows.value = result.data; total.value = result.total }
    } catch (cause) {
      if (current === sequence) error.value = messageOf(cause) || feText('operationFailedPleaseTryAgain')
    } finally {
      if (current === sequence) busy.value = false
    }
  }
  const filter = (value: Term[]) => {
    if (resource().path !== 'devices') projectId.value = selectedProject(value)
    terms.value = value
  }
  if (!managed) {
    watch([() => resource().path, page, projectId, failedOnly], () => void refresh())
    onMounted(() => void refresh())
  }
  return { table, params, request, filter, rows, total, page, search, projectId, busy, failedOnly, error, refresh }
}
