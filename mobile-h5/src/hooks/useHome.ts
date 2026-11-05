import { feText } from '../../../shared/i18n'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { facility } from '../api/facility'
import { state } from '../services/session'
import * as offline from '../services/offline'
import type { Task, OwnerMeter, Entity, Context } from '../../../shared/types'
import { messageOf } from '../../../shared/types'
export function useHome() {
  const router = useRouter(),
    tasks = ref<Task[]>([]),
    meters = ref<OwnerMeter[]>([]),
    messages = ref<Entity[]>([]),
    pending = ref<offline.Pending[]>([]),
    busy = ref(false),
    error = ref(''),
    pool = ref(false),
    code = ref(''),
    online = ref(navigator.onLine)
  const can = (resource: string) =>
    !!state.authorization?.permissions.some((p) => p.id === resource && p.actions.includes('query'))
  const scope = (): Context => {
    if (!state.session || !state.authorization || !state.context) throw Error(feText('signInFirst'))
    return state.context!
  }
  const refresh = async () => {
    busy.value = true
    error.value = ''
    try {
      if (can('facility-task')) {
        tasks.value = navigator.onLine
          ? (await facility.tasks(pool.value ? { terms: [{ column: 'state', value: 'open' }] } : {}, !pool.value)).data
          : await offline.cachedTasks(scope())
        pending.value = await offline.entries(scope())
      }
      if (can('facility-owner')) {
        ;[meters.value, messages.value] = await Promise.all([facility.meters(), facility.messages()])
      }
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const replay = async () => {
    busy.value = true
    try {
      await offline.replay(scope(), facility)
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const remove = async (id: string) => {
    await offline.removeEntry(scope(), id)
    await refresh()
  }
  const scan = async () => {
    try {
      const parsed = JSON.parse(code.value) as { type: string; id: string; applicationId: string }
      if (
        !['facility-device', 'facility-group'].includes(parsed.type) ||
        parsed.applicationId !== state.session?.applicationId
      )
        throw Error(feText('thisQrCodeDoesNotBelongToTheCurrentApplication'))
      await router.push((parsed.type === 'facility-group' ? '/groups/' : '/device/') + encodeURIComponent(parsed.id))
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  const connection = () => {
    online.value = navigator.onLine
  }
  onMounted(() => {
    void refresh()
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', connection)
    window.removeEventListener('offline', connection)
  })
  return { tasks, meters, messages, pending, busy, error, pool, code, online, can, refresh, replay, remove, scan }
}
