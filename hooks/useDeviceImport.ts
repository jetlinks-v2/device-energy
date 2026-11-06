import { feText } from '../shared/i18n'
import { ref } from 'vue'
import { facility } from '../api'
import { deviceFields } from '../shared/resources'
import { messageOf, type Device } from '../shared/types'
import { downloadCsv, parseCsv } from '../utils/csv'
// Attachments require the protected upload flow and are not part of extension imports.
const columns = deviceFields.filter((field) => !['switch', 'select', 'files'].includes(field.type || ''))
/** Import matches immutable Cloud IDs and submitted versions; never creates devices. */
export function useDeviceImport(getProject: () => string | undefined, changed: () => void) {
  const busy = ref(false),
    error = ref(''),
    notice = ref('')
  const exportRows = async () => {
    busy.value = true
    error.value = ''
    try {
      const rows: Device[] = []
      for (let page = 0; page < 5; page++) {
        const result = await facility.devices({
          pageIndex: page,
          pageSize: 200,
          terms: getProject() ? [{ column: 'projectId', value: getProject() }] : []
        })
        if (result.total > 1000) throw Error(feText('narrowTheProjectSelectionBeforeExportingUpTo1000DevicesPer'))
        rows.push(...result.data)
        if (rows.length >= result.total) break
      }
      downloadCsv(feText('facilityExtendedProfilesCsv'), [
        ['cloudDeviceId', 'version', ...columns.map((field) => field.key)],
        ...rows.map((row) => [row.cloudDeviceId, row.version, ...columns.map((field) => row[field.key])])
      ])
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  const upload = async (file: File) => {
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      if (file.size > 2 * 1024 * 1024) throw Error(feText('theCsvFileMustBeNoLargerThan2Mb'))
      const [header, ...data] = parseCsv(await file.text())
      if (!header || !['cloudDeviceId', feText('cloudDeviceId')].includes(header[0]) || !['version', feText('version')].includes(header[1]) || !data.length || data.length > 1000)
        throw Error(feText('useTheExportedCsvTemplateAndFillIn1To1000'))
      const fields = header.slice(2).map((name) => {
        const field = columns.find((field) => field.key === name || field.label === name)
        if (!field) throw Error(feText('unsupportedColumn') + name)
        return field
      })
      const rows = data.map((values) => {
        if (values.length !== header.length) throw Error(feText('csvColumnCountsDoNotMatch'))
        const version = Number(values[1])
        if (!Number.isSafeInteger(version) || version < 0) throw Error(feText('keepTheExportedVersionValue'))
        return {
          cloudDeviceId: values[0],
          version,
          values: Object.fromEntries(
            fields.map((field, i) => {
              const raw = values[i + 2]
              const value = field.type === 'number' ? (raw === '' ? null : Number(raw)) : raw
              if (typeof value === 'number' && !Number.isFinite(value)) throw Error(feText('invalidNumber') + field.label)
              return [field.key, value]
            })
          )
        }
      })
      await facility.post('devices/extensions/import', rows)
      notice.value = feText('imported') + rows.length + feText('deviceExtendedProfiles')
      changed()
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      busy.value = false
    }
  }
  return { busy, error, notice, exportRows, upload }
}
