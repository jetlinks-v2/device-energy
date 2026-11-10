import { feText } from '../shared/i18n'
import { clone } from '../shared/types'
import { computed, ref, reactive, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { facility } from '../api'
import type { CheckItem, Entity, FormValues, FormValue, Option, Organization, Resource } from '../shared/types'
import { messageOf } from '../shared/types'
import { planGenerationReason } from '../shared/planActions'
import { usePlanReferences } from './usePlanReferences'
import { defaultRule } from '../shared/cycle/editor'
import { useResourceQuery } from './useResourceQuery'
import { normalizeCheckItems, validateCheckItems } from './useCheckItems'
const organizationOptions = (nodes: Organization[]): Option[] => nodes.flatMap(node => [
  { value: node.id, label: node.name || node.id, parentId: node.parentId,
    selectable: node.organizationType?.value === 'external', disabled: node.organizationType?.value !== 'external' },
  ...organizationOptions(node.children || [])
])
/** 请求、选项联动和提交集中于hook，过期列表响应不会覆盖新筛选。 */
export function useResource(resource: () => Resource, kind?: string, managed = false) {
  const query = useResourceQuery(resource, kind, managed)
  const { projectId, busy, error, refresh } = query
  const saving = ref(false),
    opened = ref(false),
    detail = ref<Entity>(),
    form = reactive<FormValues>({}),
    options = reactive<Record<string, Option[]>>({}),
    previewRows = ref<
      { propertyId: string; time: number; raw: string; normalized?: number | string; unit: string; error?: string }[]
    >([]),
    templateId = ref<string>()
  const references = usePlanReferences(resource, form, opened, options, error)
  // Display and validation share the same fields; single work orders have no contractor.
  const formFields = computed(() => resource().fields.filter(field =>
    resource().path !== 'plans' || field.key !== 'externalOrganizationId' || form.mode === 'double'
  ).map(field => ['standards', 'cycles', 'plans'].includes(resource().path) && field.key === 'kind' && kind
    ? { ...field, disabled: true } : field))
  const loadOptions = async () => {
    try {
      const sources = new Set([
        'projects',
        ...resource()
          .fields.map((field) => field.source)
          .filter((value): value is string => !!value && value !== 'properties')
      ])
      await Promise.all(
        [...sources].map(async (source) => {
          if (resource().path === 'plans' && ['standards', 'cycles', 'groups', 'employees'].includes(source)) return
          if (source === 'organizations') {
            options[source] = organizationOptions(await facility.options<Organization>(source))
            return
          }
          const items = ['projects', 'employees'].includes(source)
            ? await facility.options(source)
            : (await facility.query(source, { pageSize: 200 })).data
          options[source] = items.map((row) => ({ value: row.id, label: row.name || row.id }))
        })
      )
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  const edit = (row?: Entity) => {
    Object.keys(form).forEach((key) => delete form[key])
    Object.assign(form, clone(row || resource().defaults || {}))
    if (resource().path === 'cycles' && !form.rule) form.rule = defaultRule()
    if (resource().path === 'standards') form.checkItems = normalizeCheckItems((form.checkItems as CheckItem[]) || [])
    if (!row && resource().path === 'plans') {
      form.startTime = Date.now()
      form.endTime = Date.now() + 365 * 86400000
    }
    if (kind) form.kind = kind
    if (!row && projectId.value) form.projectId = projectId.value
    previewRows.value = []
    opened.value = true
    if (resource().path === 'energy/mappings') void loadTemplates()
  }
  const change = (key: string, value: FormValue) => {
    if (['standards', 'cycles', 'plans'].includes(resource().path) && key === 'kind' && kind) return
    if (resource().path === 'plans' && ['projectId', 'kind'].includes(key) && form[key] !== value) {
      for (const field of ['standardId', 'cycleId', 'reviewerId']) form[field] = undefined
      form.groupIds = []
    }
    form[key] = value
    if (resource().path === 'plans' && key === 'mode' && value !== 'double') form.externalOrganizationId = undefined
  }
  const metadata = async (key: string) => {
    try {
      const result = await facility.get<{ properties: { id: string; name: string }[] }>(
        'devices/' + encodeURIComponent(key) + '/metadata'
      )
      options.properties = result.properties.map((p) => ({ value: p.id, label: p.name + ' (' + p.id + ')' }))
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  watch(
    () => form.deviceId,
    (key) => {
      options.properties = []
      if (typeof key === 'string' && key) void metadata(key)
    }
  )
  const loadTemplates = async () => {
    try {
      const result = await facility.query('energy/mappings', { pageSize: 200 })
      options.templates = result.data.map((row) => ({
        value: row.id,
        label: (row.name || row.id) + ' · ' + String(row.energyType)
      }))
      mappingTemplates.value = result.data
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  const mappingTemplates = ref<Entity[]>([])
  const applyTemplate = () => {
    const template = mappingTemplates.value.find((row) => row.id === templateId.value)
    if (!template) return
    const device = options.devices.find((row) => row.value === form.deviceId)
    if (!device) {
      error.value = feText('selectADeviceFirst')
      return
    }
    form.metrics = clone(template.metrics) as FormValue
    form.energyType = template.energyType as FormValue
    form.usagePropertyId = template.usagePropertyId as FormValue
    form.staleAfterSeconds = template.staleAfterSeconds as FormValue
    previewRows.value = []
  }
  const preview = async () => {
    if (!form.deviceId) {
      error.value = feText('selectADeviceFirst')
      return
    }
    saving.value = true
    error.value = ''
    try {
      previewRows.value = await facility.post(
        'energy/preview/' + encodeURIComponent(String(form.deviceId)),
        form.metrics
      )
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      saving.value = false
    }
  }
  const save = async () => {
    if (saving.value) return
    saving.value = true
    error.value = ''
    try {
      for (const field of formFields.value) if (field.required && (!form[field.key] || (Array.isArray(form[field.key]) && !(form[field.key] as unknown[]).length))) throw Error(feText('pleaseEnter') + field.label)
      if (resource().path === 'rules' && ['usage', 'balance', 'instant', 'stale', 'reading-anomaly', 'state'].includes(String(form.ruleType)) && !form.propertyId) {
        throw Error(feText('pleaseEnter') + resource().fields.find(field => field.key === 'propertyId')?.label)
      }
      const payload = { ...form }
      if (kind && ['standards', 'cycles', 'plans'].includes(resource().path)) payload.kind = kind
      if (resource().path === 'standards') {
        payload.checkItems = normalizeCheckItems((form.checkItems as CheckItem[]) || [])
        const failure = validateCheckItems(payload.checkItems)
        if (failure) throw Error(failure)
      }
      if (resource().path === 'plans') {
        if (Number(form.endTime) <= Number(form.startTime)) throw Error(feText('planDatesRequired'))
        payload.assigneeId = undefined
        payload.followUserId = undefined
        if (form.mode !== 'double') payload.externalOrganizationId = undefined
      }
      await facility.save(resource().path, payload)
      opened.value = false
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      saving.value = false
    }
  }
  const sync = async () => {
    if (!projectId.value) {
      error.value = feText('selectABusinessProjectFirst')
      return
    }
    busy.value = true
    try {
      await facility.sync(projectId.value)
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
      busy.value = false
    }
  }
  const command = async (row: Entity, action: string) => {
    if (saving.value) return
    saving.value = true
    error.value = ''
    let generated: number | undefined
    try {
      // Preserve the selected device alert as the fault's source; the server validates its ownership.
      if (action === 'fault' && resource().path === 'alerts') {
        const description = window.prompt(feText('enterFaultDescription'))?.trim()
        if (!description) return
        await facility.save('faults', {
          name: feText('energyAlertFault'),
          deviceId: row.deviceId,
          description,
          sourceType: 'alert',
          sourceId: row.id
        })
        message.success(feText('faultRegistered'))
      } else if (action === 'generate' || action === 'temporary') {
        const reason = planGenerationReason(row, action === 'temporary')
        if (reason) throw Error(reason)
        const tasks = await facility.post<Entity[]>('tasks/generate/' + row.id + '?temporary=' + (action === 'temporary'))
        generated = tasks.length
        message.success(feText('tasksGenerated') + ': ' + tasks.length)
      }
      else if (['alerts', 'alerts/plans'].includes(resource().path))
        await facility.post('alerts/' + row.id + '/handle', {
          version: row.version,
          state: action,
          comment: feText('processedByAdministrator')
        })
      else if (['alerts/notifications', 'alerts/plans/notifications'].includes(resource().path))
        await facility.post('alerts/notifications/' + row.id + '/retry')
      else if (resource().path === 'energy/readings' || resource().path === 'energy/replacements')
        await facility.post(resource().path + '/' + row.id + '/review', {
          version: row.version,
          approve: action === 'approve'
        })
      else if (resource().path === 'energy/mappings') await facility.post('energy/collect/' + row.deviceId)
      else if (resource().path === 'faults')
        await facility.post('faults/' + row.id + '/' + action, {
          version: row.version,
          comment: window.prompt(feText('enterProcessingNotes')) || ''
        })
      await refresh()
      return generated
    } catch (e) {
      const failure = messageOf(e)
      // Scheduling may advance the plan after the list was loaded. Reload without hiding the failure.
      if (action === 'generate' || action === 'temporary') await refresh()
      error.value = failure
    } finally {
      saving.value = false
    }
  }
  const remove = async (row: Entity) => {
    try {
      await facility.remove(resource().path, row)
      await refresh()
    } catch (e) {
      error.value = messageOf(e)
    }
  }
  onMounted(() => {
    void loadOptions()
  })
  return {
    ...query,
    ...references,
    saving,
    opened,
    detail,
    form,
    formFields,
    options,
    previewRows,
    templateId,
    applyTemplate,
    preview,
    refresh,
    edit,
    change,
    save,
    sync,
    command,
    remove
  }
}
