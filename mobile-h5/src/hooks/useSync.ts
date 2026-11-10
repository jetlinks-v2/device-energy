import { ref, onMounted } from 'vue'
import { facility } from '../api/facility'
import { state } from '../services/session'
import * as offline from '../services/offline'
import { messageOf } from '../../../shared/types'
import { useConnection } from './useConnection'
export function useSync() {
  const rows = ref<offline.Pending[]>([]), busy = ref(false), error = ref(''), online = useConnection()
  async function load() {
    try { if (state.context) rows.value = (await offline.entries(state.context)).sort((a, b) => b.createdAt - a.createdAt) }
    catch (e) { error.value = messageOf(e) }
  }
  async function replay() {
    if (!state.context || busy.value || !online.value) return
    busy.value = true; error.value = ''
    try { await offline.replay(state.context, facility); await load() }
    catch (e) { error.value = messageOf(e) }
    finally { busy.value = false }
  }
  async function remove(id: string) {
    if (!state.context || busy.value || !rows.value.some(r => r.id === id && r.state === 'submitted')) return
    try { await offline.removeEntry(state.context, id); await load() }
    catch (e) { error.value = messageOf(e) }
  }
  onMounted(() => void load())
  return { rows, busy, error, online, load, replay, remove }
}
