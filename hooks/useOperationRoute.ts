import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { messageOf, type Entity, type Option } from '../shared/types'

/** Consume a detail link once, after the project directory is ready. */
export function useOperationRoute<T extends Entity>(options: {
  enabled?: boolean
  projectId: Ref<string | undefined>; projects: Ref<Option[]>; loading: Ref<boolean>; error: Ref<string>
  read: (id: string) => Promise<T>; invalidate: () => void
  prepare?: (row: T) => void; load: (row?: T) => Promise<void>
}) {
  const route = useRoute(), routing = ref(false)
  let generation = 0, consumed: string | undefined, applyingProject = false
  watch(options.projectId, () => {
    if (routing.value && !applyingProject) { generation++; routing.value = false }
  }, { flush: 'sync' })
  watch(() => [route.query.id, options.loading.value, options.projects.value], async () => {
    if (options.enabled === false || options.loading.value || !options.projects.value.length) return
    const id = typeof route.query.id === 'string' ? route.query.id : undefined
    if (id === consumed) return
    consumed = id
    const ticket = ++generation
    routing.value = !!id
    options.invalidate()
    if (!id) { await options.load(); return }
    options.error.value = ''
    try {
      const row = await options.read(id)
      if (ticket !== generation) return
      applyingProject = true
      options.projectId.value = row.projectId
      applyingProject = false
      options.prepare?.(row)
      await nextTick()
      if (ticket !== generation) return
      routing.value = false
      await options.load(row)
    } catch (cause) {
      if (ticket === generation) options.error.value = messageOf(cause)
    } finally { if (ticket === generation) routing.value = false }
  }, { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return routing
}
