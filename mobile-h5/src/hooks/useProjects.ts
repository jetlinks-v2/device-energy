import { ref } from 'vue'
import { facility } from '../api/facility'
import { state, canWorkspace } from '../services/session'
import type { Entity } from '../../../shared/types'
import { messageOf } from '../../../shared/types'

export const projects = ref<Entity[]>([]), projectsReady = ref(false), projectError = ref('')
const key = () => 'facility:projects:' + JSON.stringify([state.context?.tenantId, state.context?.applicationId, state.context?.userId])
export async function loadProjects() {
  projectsReady.value = false
  projectError.value = ''
  projects.value = []
  state.projectId = undefined
  try {
    if (!canWorkspace()) return
    if (navigator.onLine && !state.offlineMode) {
      projects.value = await facility.options('projects')
      sessionStorage.setItem(key(), JSON.stringify(projects.value))
    } else projects.value = JSON.parse(sessionStorage.getItem(key()) || '[]') as Entity[]
    const saved = sessionStorage.getItem(key() + ':selected') || ''
    state.projectId = projects.value.some(p => p.id === saved) ? saved : projects.value[0]?.id
  } catch (e) {
    projectError.value = messageOf(e)
    state.projectId = undefined
  } finally { projectsReady.value = true }
}
export function selectProject(id: string) {
  if (!id || !projects.value.some(p => p.id === id)) return
  state.projectId = id
  sessionStorage.setItem(key() + ':selected', id)
}
