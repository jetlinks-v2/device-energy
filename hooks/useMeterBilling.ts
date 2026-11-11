import { ref, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { facility } from '../api'
import { meterApi } from '../api/meterBilling'
import { messageOf, type Option } from '../shared/types'
import type { MeterAssociation, MeterRule, MeterStandard } from '../shared/meterBilling'
import { feText } from '../shared/i18n'
export function useMeterBilling() {
  const projects = ref<Option[]>([]), projectId = ref<string>(), standards = ref<MeterStandard[]>([]), rules = ref<MeterRule[]>([])
  const busy = ref(false), error = ref(''), saving = ref<string>()
  let sequence = 0
  watch(projectId, async project => {
    const current = ++sequence; standards.value = []; rules.value = []; error.value = ''
    if (!project) return
    busy.value = true
    try {
      const [options, configured] = await Promise.all([meterApi.standards(project), meterApi.rules(project)])
      if (current !== sequence) return
      standards.value = options; rules.value = configured
    } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
    finally { if (current === sequence) busy.value = false }
  })
  const save = async (rule: MeterAssociation) => {
    const project = projectId.value, current = sequence
    if (!project || rule.projectId !== project) return
    saving.value = rule.energyType; error.value = ''
    try {
      const result = await meterApi.saveRule(rule)
      if (current !== sequence) return
      rules.value = [...rules.value.filter(row => row.energyType !== result.energyType), result]
      message.success(feText('ruleSaved'))
    } catch (cause) { if (current === sequence) error.value = messageOf(cause) }
    finally { if (current === sequence) saving.value = undefined }
  }
  onMounted(async () => {
    try {
      projects.value = (await facility.options('projects')).map(row => ({ value: row.id, label: row.name || row.id }))
      if (projects.value.length === 1) projectId.value = projects.value[0].value
    } catch (cause) { error.value = messageOf(cause) }
  })
  return { projects, projectId, standards, rules, busy, error, saving, save }
}
