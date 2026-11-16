import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { facility } from '../api'
import { messageOf, type Option, type Term } from '../shared/types'
/** Billing needs a project, without loading configuration editor state or standard candidates. */
export function useBillingProject(initialProject?: string, aggregate = false) {
  const route = useRoute(), projectIds = ref<string[]>([])
  const projects = ref<Option[]>([]), singleProject = ref<string>(), loading = ref(false), error = ref('')
  // 查询页空选代表授权资产全集；写入页继续要求一个明确项目。
  const projectId = computed({ get: () => aggregate ? projectIds.value.length === 1 ? projectIds.value[0] : undefined : singleProject.value,
    set: (value: string | undefined) => { if (aggregate) projectIds.value = value ? [value] : []; else singleProject.value = value } })
  const projectTerms = (): Term[] => aggregate ? projectIds.value.length ? [{ column: 'projectId', termType: projectIds.value.length === 1 ? 'eq' : 'in', value: projectId.value || [...projectIds.value] }] : []
    : projectId.value ? [{ column: 'projectId', value: projectId.value }] : []
  onMounted(async () => {
    loading.value = true
    try {
      projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id }))
      if (aggregate) {
        const requested = typeof route.query.projectId === 'string' ? [route.query.projectId] : Array.isArray(route.query.projectIds) ? route.query.projectIds : typeof route.query.projectIds === 'string' ? [route.query.projectIds] : []
        projectIds.value = projects.value.filter(project => requested.includes(project.value)).map(project => project.value)
      } else projectId.value = projects.value.some(project => project.value === initialProject) ? initialProject : projects.value[0]?.value
    } catch (cause) { error.value = messageOf(cause) }
    finally { loading.value = false }
  })
  return { projects, projectId, projectIds, projectTerms, loading, error }
}
