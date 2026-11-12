import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { facility } from '../api'
import { meterApi } from '../api/meterBilling'
import { feText } from '../shared/i18n'
import { messageOf, type Option, type Query, type Term } from '../shared/types'
import type { AllocatedDevice } from '../shared/meterBilling'
import type { TableHandle } from '../shared/tableQuery'

/** 项目分配不提交表计类型和安装空间，避免覆盖各设备的能源配置及档案。 */
export function useDeviceConfiguration() {
  const projects = ref<Option[]>([]), projectId = ref<string>(), state = ref('all')
  const terms = ref<Term[]>([]), table = ref<TableHandle>(), error = ref(''), saving = ref(false), syncing = ref(false)
  const selected = ref<string[]>([]), selectedRows = ref<AllocatedDevice[]>([]), editing = ref<AllocatedDevice[]>([])
  const opened = ref(false), targetProject = ref<string>()
  const params = computed(() => ({ projectId: projectId.value, state: state.value, terms: terms.value }))
  const request = async (query: Query) => {
    const filters: Term[] = [...terms.value]
    if (projectId.value) filters.push({ column: 'projectId', value: projectId.value })
    if (state.value === 'ready') filters.push({ column: 'projectConfirmed', value: true })
    if (state.value === 'pending') filters.push({ column: 'projectConfirmed', value: false })
    return { success: true, result: await meterApi.devices({ ...query, terms: [{ terms: filters }] }) }
  }
  watch(params, () => { selected.value = []; selectedRows.value = [] })
  const edit = (rows = selectedRows.value) => {
    if (!rows.length) { message.warning(feText('chooseDevices')); return }
    editing.value = rows; opened.value = true; error.value = ''
    targetProject.value = rows.every(row => row.projectId === rows[0].projectId) ? rows[0].projectId : undefined
  }
  const save = async () => {
    if (saving.value) return
    if (!targetProject.value) { message.warning(feText('chooseProject')); return }
    saving.value = true; error.value = ''
    try {
      await meterApi.allocate(editing.value.map(row => ({ id: row.id, version: row.version,
        projectId: targetProject.value! })))
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
  return { projects, projectId, state, terms, table, error, saving, syncing, selected, selectedRows,
    editing, opened, targetProject, params, request, edit, save, sync }
}
