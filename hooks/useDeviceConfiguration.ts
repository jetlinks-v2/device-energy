import { ref, watch, onMounted, onScopeDispose } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { facility } from '../api'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Option, type Term } from '../shared/types'
import type { AllocatedDevice, DeviceCatalogCursor } from '../shared/meterBilling'

/** 项目分配不提交表计类型和安装空间，避免覆盖各设备的能源配置及档案。 */
export function useDeviceConfiguration() {
  const projects = ref<Option[]>([]), projectId = ref<string>(), state = ref('all')
  const terms = ref<Term[]>([]), error = ref(''), saving = ref(false), syncing = ref(false)
  const selected = ref<string[]>([]), selectedRows = ref<AllocatedDevice[]>([]), editing = ref<AllocatedDevice[]>([])
  const opened = ref(false), targetProject = ref<string>()
  const rows = ref<AllocatedDevice[]>([]), loading = ref(false), listError = ref('')
  const pageIndex = ref(0), nextCursor = ref<DeviceCatalogCursor | null>()
  const starts: (DeviceCatalogCursor | undefined)[] = [undefined]
  let requestId = 0
  let failedPage: { index: number; after?: DeviceCatalogCursor } | undefined

  const clearSelection = () => { selected.value = []; selectedRows.value = [] }
  const load = async (index: number, after?: DeviceCatalogCursor) => {
    const id = ++requestId
    loading.value = true; listError.value = ''; failedPage = undefined
    const filters: Term[] = terms.value.length ? [{ terms: terms.value }] : []
    if (projectId.value) filters.push({ column: 'projectId', value: projectId.value })
    if (state.value === 'ready') filters.push({ column: 'projectConfirmed', value: true })
    if (state.value === 'pending') filters.push({ column: 'projectConfirmed', value: false })
    try {
      const page = await meterApi.deviceSlice({ pageSize: 20, terms: [{ terms: filters }] }, after)
      if (id !== requestId) return
      rows.value = page.data
      pageIndex.value = index
      nextCursor.value = page.nextCursor
      starts.splice(index, starts.length, after)
      clearSelection()
    } catch (cause) {
      if (id === requestId) {
        listError.value = messageOf(cause)
        failedPage = { index, after }
      }
    } finally {
      if (id === requestId) loading.value = false
    }
  }
  const reload = () => load(pageIndex.value, starts[pageIndex.value])
  const retry = () => failedPage && load(failedPage.index, failedPage.after)
  const first = () => {
    starts.splice(1)
    pageIndex.value = 0; rows.value = []; nextCursor.value = null
    clearSelection()
    return load(0)
  }
  const previous = () => {
    if (!loading.value && pageIndex.value > 0) return load(pageIndex.value - 1, starts[pageIndex.value - 1])
  }
  const next = () => {
    if (!loading.value && nextCursor.value) return load(pageIndex.value + 1, nextCursor.value)
  }
  watch([projectId, state, terms], first)
  onScopeDispose(() => { requestId++ })
  const edit = (rows = selectedRows.value) => {
    if (!rows.length) { message.warning(feText('chooseDevices')); return }
    editing.value = rows; opened.value = true; error.value = ''
    targetProject.value = rows.every(row => row.projectId === rows[0].projectId) ? rows[0].projectId : undefined
  }
  const persist = async () => {
    if (saving.value) return
    if (!targetProject.value) { message.warning(feText('chooseProject')); return }
    saving.value = true; error.value = ''
    try {
      await meterApi.allocate(editing.value.map(row => ({ id: row.id, version: row.version,
        projectId: targetProject.value! })))
      opened.value = false; clearSelection(); void reload()
      message.success(feText('allocationSavedPendingSync'))
    } catch (cause) { error.value = messageOf(cause) } finally { saving.value = false }
  }
  const save = async () => {
    if (saving.value) return
    if (!targetProject.value) { message.warning(feText('chooseProject')); return }
    if (editing.value.some(row => row.assetProjectId && row.assetProjectId !== targetProject.value)) {
      Modal.confirm({ title: feText('moveProjectTitle'), content: feText('moveProjectDescription'), onOk: persist })
      return
    }
    await persist()
  }
  const sync = async () => {
    if (syncing.value) return
    syncing.value = true; error.value = ''
    try { const count = await meterApi.refreshDevices(); void first(); message.success(feText('catalogRefreshed') + ' ' + count) }
    catch (cause) { error.value = messageOf(cause) } finally { syncing.value = false }
  }
  onMounted(async () => {
    void first()
    try { projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id })) }
    catch (cause) { error.value = messageOf(cause) }
  })
  return { projects, projectId, state, terms, rows, loading, listError, pageIndex, nextCursor, previous, next, retry,
    error, saving, syncing, selected, selectedRows, editing, opened, targetProject, edit, save, sync }
}
