import { onMounted, ref } from 'vue'
import { facility } from '../api'
import { messageOf, type Option } from '../shared/types'
/** Billing needs a project, without loading configuration editor state or standard candidates. */
export function useBillingProject() {
  const projects = ref<Option[]>([]), projectId = ref<string>(), loading = ref(false), error = ref('')
  onMounted(async () => {
    loading.value = true
    try {
      projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id }))
      projectId.value = projects.value[0]?.value
    } catch (cause) { error.value = messageOf(cause) }
    finally { loading.value = false }
  })
  return { projects, projectId, loading, error }
}
