import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { facility } from '../api'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Entity, type Option, type Query, type Term } from '../shared/types'
import type { AllocatedDevice, MeterType } from '../shared/meterBilling'
import type { TableHandle } from '../shared/tableQuery'

/** Table owns paging and cancellation; form candidates are invalidated when its target project changes. */
export function useDeviceConfiguration() {
  const projects = ref<Option[]>([]), spaces = ref<Option[]>([]), projectId = ref<string>(), state = ref('all')
  const terms = ref<Term[]>([]), table = ref<TableHandle>(), error = ref(''), saving = ref(false), syncing = ref(false)
  const selected = ref<string[]>([]), selectedRows = ref<AllocatedDevice[]>([]), editing = ref<AllocatedDevice[]>([])
  const opened = ref(false), targetProject = ref<string>(), meterType = ref<MeterType>('device'), spaceId = ref<string>()
  const spacesLoading = ref(false), spacesReady = ref(false)
  const params = computed(() => ({ projectId: projectId.value, state: state.value, terms: terms.value }))
  const request = async (query: Query) => {
    const filters: Term[] = [...terms.value]
    if (projectId.value) filters.push({ column: 'projectId', value: projectId.value })
    if (state.value === 'ready') filters.push({ column: 'meterType', termType: 'notnull', value: 1 }, { column: 'projectConfirmed', value: true })
    if (state.value === 'pending') filters.push({ terms: [
      { column: 'meterType', termType: 'isnull', value: 1 }, { column: 'projectConfirmed', value: false, type: 'or' }
    ] })
    return { success: true, result: await meterApi.devices({ ...query, terms: [{ terms: filters }] }) }
  }
  watch(params, () => { selected.value = []; selectedRows.value = [] })
  let sequence = 0
  watch(targetProject, async project => {
    const current = ++sequence; spaces.value = []; spacesReady.value = false; spacesLoading.value = false
    spaceId.value = editing.value.length === 1 && editing.value[0].projectId === project ? editing.value[0].spaceId : undefined
    if (!project || editing.value.length !== 1) return
    spacesLoading.value = true
    try {
      const rows = await facility.options<Entity>('spaces/' + encodeURIComponent(project))
      if (current !== sequence) return
      spaces.value = rows.map(row => ({ value: row.id, label: String(row.fullName || row.name || row.id), parentId: row.parentId as string | undefined }))
      spacesReady.value = true
    } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
    finally { if (current === sequence) spacesLoading.value = false }
  })
  const edit = (rows = selectedRows.value) => {
    if (!rows.length) { message.warning(feText('chooseDevices')); return }
    editing.value = rows; meterType.value = rows[0].meterType || 'device'; opened.value = true
    // Reset first so reopening the same device reloads its current installation space.
    targetProject.value = undefined
    queueMicrotask(() => { targetProject.value = rows.every(row => row.projectId === rows[0].projectId) ? rows[0].projectId : undefined })
  }
  const save = async () => {
    if (saving.value || spacesLoading.value || editing.value.length === 1 && !spacesReady.value) return
    if (!targetProject.value) { message.warning(feText('chooseProject')); return }
    if (spaceId.value && !spaces.value.some(space => space.value === spaceId.value)) { message.warning(feText('requiredFields')); return }
    saving.value = true; error.value = ''
    try {
      await meterApi.allocate(editing.value.map(row => ({ id: row.id, version: row.version,
        projectId: targetProject.value!, meterType: meterType.value, spaceId: spaceId.value, updateSpace: editing.value.length === 1 })))
      opened.value = false; selected.value = []; selectedRows.value = []; table.value?.reload()
      message.success(feText('allocationSaved'))
    } catch (cause) { error.value = messageOf(cause) } finally { saving.value = false }
  }
  const sync = async () => {
    if (!projectId.value) { message.warning(feText('chooseProject')); return }
    syncing.value = true; error.value = ''
    try { await facility.sync(projectId.value); table.value?.reload() }
    catch (cause) { error.value = messageOf(cause) } finally { syncing.value = false }
  }
  onMounted(async () => {
    try { projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id })) }
    catch (cause) { error.value = messageOf(cause) }
  })
  return { projects, spaces, projectId, state, terms, table, error, saving, syncing, selected, selectedRows,
    editing, opened, targetProject, meterType, spaceId, spacesReady, spacesLoading, params, request, edit, save, sync }
}
