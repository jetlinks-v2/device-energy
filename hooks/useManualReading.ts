import { computed, onMounted, reactive, ref } from 'vue'
import { facility } from '../api'
import { feText } from '../shared/i18n'
import { messageOf, type Entity, type Metric, type Reading } from '../shared/types'

interface MeterMapping extends Entity { deviceId: string; energyType: string; enabled: boolean; metrics: Metric[] }
/** 补录输入为表上原始读数，保持十进制字符串，由服务端按当前映射换算并提交审核。 */
export function useManualReading(initialProject: () => string | undefined, saved: () => void, original?: Reading) {
  const form = reactive({ projectId: '', mappingId: '', propertyId: '', value: undefined as string | undefined,
    observedTime: undefined as number | undefined, reason: '' })
  const mappings = ref<MeterMapping[]>([]), loading = ref(false), saving = ref(false), error = ref('')
  const mapping = computed(() => mappings.value.find(row => row.id === form.mappingId))
  const metrics = computed(() => (mapping.value?.metrics || []).filter(metric => ['counter', 'increment'].includes(metric.kind)))
  let sequence = 0
  const load = async (name = '') => {
    const token = ++sequence
    if (!form.projectId) { mappings.value = []; loading.value = false; return }
    loading.value = true; error.value = ''
    try {
      const page = await facility.query<MeterMapping>('energy/mappings', { pageIndex: 0, pageSize: 50, terms: [
        { column: 'projectId', value: form.projectId }, { column: 'enabled', value: true },
        ...(original ? [{ column: 'deviceId', value: original.deviceId }] : []),
        ...(name.trim() ? [{ column: 'name', termType: 'like', value: `%${name.trim()}%` }] : [])
      ] })
      if (token !== sequence) return
      const current = mapping.value
      mappings.value = page.data.filter(row => row.metrics?.some(metric => ['counter', 'increment'].includes(metric.kind)))
      if (current && !mappings.value.some(row => row.id === current.id)) mappings.value.unshift(current)
    } catch (cause) { if (token === sequence) error.value = messageOf(cause) }
    finally { if (token === sequence) loading.value = false }
  }
  const changeMeter = (id?: unknown) => {
    if (original) return
    form.mappingId = typeof id === 'string' ? id : ''; form.propertyId = ''; form.value = undefined
    if (metrics.value.length === 1) form.propertyId = metrics.value[0].propertyId
  }
  const changeProject = (id?: unknown) => {
    if (saving.value || original) return
    form.projectId = typeof id === 'string' ? id : ''; changeMeter(); mappings.value = []
    void load()
  }
  const submit = async () => {
    if (saving.value || loading.value) return
    error.value = ''
    if (!form.projectId || !mapping.value || !metrics.value.some(metric => metric.propertyId === form.propertyId)) {
      error.value = feText('selectReadingMeter'); return
    }
    // 与数据库 numeric(44,12) 一致，避免浮点转换丢失原始读数精度。
    if (!/^(?:0|[1-9]\d{0,31})(?:\.\d{1,12})?$/.test(String(form.value ?? ''))) {
      error.value = feText('invalidManualReading'); return
    }
    if (!Number.isFinite(form.observedTime) || !form.observedTime || form.observedTime > Date.now()) {
      error.value = feText('invalidReadingTime'); return
    }
    if (!form.reason.trim() || form.reason.length > 4000) { error.value = feText('enterReadingReason'); return }
    saving.value = true
    try {
      const input = { propertyId: form.propertyId, value: String(form.value),
        observedTime: form.observedTime, reason: form.reason.trim() }
      if (original) await facility.resubmitReading(original, input)
      else await facility.manualReading(mapping.value.deviceId, input)
      saved()
    } catch (cause) { error.value = messageOf(cause) }
    finally { saving.value = false }
  }
  const initialize = async () => {
    if (!original) { changeProject(initialProject()); return }
    form.projectId = original.projectId || ''
    form.propertyId = original.propertyId; form.observedTime = original.observedTime
    // 回填原始读数，不能拿已乘倍率的标准化值再次换算。
    form.value = original.rawValue == null ? undefined : String(original.rawValue)
    form.reason = original.reason || ''
    await load()
    form.mappingId = mappings.value.find(row => row.deviceId === original.deviceId)?.id || ''
    if (!mapping.value || !metrics.value.some(metric => metric.propertyId === original.propertyId)) error.value = feText('readingMappingUnavailable')
  }
  onMounted(initialize)
  return { form, mappings, mapping, metrics, loading, saving, error, load, changeProject, changeMeter, submit, initialize }
}
