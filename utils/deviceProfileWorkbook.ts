import type { CellValue, Workbook } from 'exceljs'
import { feText } from '../shared/i18n'
import { deviceFields } from '../shared/resources'
import type { Device } from '../shared/types'

export interface ProfilePerson { id: string; name?: string; username?: string }
export interface ProfileSpace { id: string; name?: string; fullName?: string }
export interface ProfileReferences { projectId: string; projectName: string; people: ProfilePerson[]; spaces: ProfileSpace[] }
export interface ProfileRow { cloudDeviceId: string; version: number; rowNumber: number; values: Record<string, string | number | boolean> }
export interface ProfileCheck { rowNumber: number; deviceName?: string; valid: boolean; message?: string }

// 仅档案字段参与导入，来源身份与版本隐藏携带；显示字段不能用来改变项目归属。
export const profileColumns = () => [
  { key: 'name', label: feText('name'), type: 'text' },
  { key: 'sourceName', label: feText('profileSourceName'), type: 'reference' },
  { key: 'projectName', label: feText('profileProject'), type: 'reference' },
  { key: 'responsibleAccount', label: feText('profileAccount'), type: 'text' },
  { key: 'responsibleName', label: feText('profilePersonName'), type: 'reference' },
  { key: 'spacePath', label: feText('profileSpacePath'), type: 'text' },
  ...deviceFields.filter(field => !['name', 'responsibleUserId', 'spaceId', 'attachments'].includes(field.key))
    .map(field => ({ key: field.key, label: field.label, type: field.type || 'text' })),
  { key: 'cloudDeviceId', label: '_device', type: 'identity' },
  { key: 'version', label: '_version', type: 'identity' }
]
const excel = async () => (await import('exceljs')).default
const yes = () => feText('yes'), no = () => feText('no')

export async function createProfileWorkbook(devices: Device[], references: ProfileReferences[]): Promise<Uint8Array> {
  const ExcelJS = await excel(), workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(feText('profileSheet'), { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] })
  const columns = profileColumns()
  sheet.columns = columns.map(column => ({ key: column.key, header: column.label, width: column.type === 'identity' ? 20 : 25,
    hidden: column.type === 'identity', style: { numFmt: '@', alignment: { vertical: 'middle' } } }))
  sheet.getColumn('responsibleAccount').width = 34
  sheet.getColumn('spacePath').width = 42
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: devices.length + 1, column: columns.length - 2 } }
  for (const device of devices) {
    const reference = references.find(item => item.projectId === device.projectId)
    const person = reference?.people.find(item => item.id === device.responsibleUserId)
    const space = reference?.spaces.find(item => item.id === device.spaceId)
    const row = sheet.addRow(Object.fromEntries(columns.map(column => {
      const value = column.key === 'responsibleAccount' ? person?.username : column.key === 'responsibleName' ? person?.name :
        column.key === 'spacePath' ? space?.fullName : column.key === 'workEnabled' ? !!(device.inspectionEnabled || device.maintenanceEnabled) : device[column.key]
      return [column.key, typeof value === 'boolean' ? (value ? yes() : no()) : String(value ?? '')]
    })))
    row.height = 24
    columns.forEach((column, index) => {
      if (column.type === 'reference') row.getCell(index + 1).font = { color: { argb: 'FF7A7A7A' } }
      if (column.type === 'switch') row.getCell(index + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${yes()},${no()}"`] }
    })
  }
  styleHeader(sheet.getRow(1))
  const instructions = workbook.addWorksheet(feText('profileInstructions'))
  instructions.columns = [{ width: 110 }]
  instructions.addRows([[feText('profileInstructions')], [feText('profileImportHint')], [feText('profileResponsibleHint')],
    [feText('profileReferenceHint')], [feText('profileInstructionFields')], [feText('profileRowsLimit')]])
  instructions.eachRow(row => { row.alignment = { wrapText: true, vertical: 'middle' }; row.height = 42 })
  const people = workbook.addWorksheet(feText('profilePeople'))
  people.columns = [{ header: feText('project'), width: 28 }, { header: feText('profileAccount'), width: 42 }, { header: feText('responsiblePerson'), width: 24 }]
  const spaces = workbook.addWorksheet(feText('profileSpaces'))
  spaces.columns = [{ header: feText('project'), width: 28 }, { header: feText('profileSpacePath'), width: 80 }]
  for (const reference of references) {
    for (const person of reference.people) people.addRow([reference.projectName, person.username || '', person.name || ''])
    for (const space of reference.spaces) spaces.addRow([reference.projectName, space.fullName || ''])
  }
  styleHeader(people.getRow(1)); styleHeader(spaces.getRow(1))
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

function styleHeader(row: ReturnType<Workbook['addWorksheet']>['lastRow']) {
  if (!row) return
  row.height = 30
  row.eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } } })
}

function textCell(value: CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map(part => part.text).join('').trim()
    throw Error(feText('profileFormula'))
  }
  return String(value).trim()
}

/** 每行保留真实 Excel 行号；选填空白不进入 patch，显式“否”仍提交 false。 */
export async function readProfileWorkbook(buffer: ArrayBuffer): Promise<{ rows: ProfileRow[]; checks: ProfileCheck[] }> {
  const ExcelJS = await excel(), workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0], columns = profileColumns()
  if (!sheet || sheet.columnCount !== columns.length || columns.some((column, i) => textCell(sheet.getRow(1).getCell(i + 1).value) !== column.label))
    throw Error(feText('profileBadTemplate'))
  if (sheet.rowCount > 10001) throw Error(feText('profileRowsLimit'))
  const rows: ProfileRow[] = [], checks: ProfileCheck[] = [], seen = new Set<string>()
  sheet.eachRow((row, number) => {
    if (number === 1 || !row.hasValues) return
    let deviceName = ''
    try {
      const values: ProfileRow['values'] = {}, cells = columns.map((column, index) => ({ ...column, value: textCell(row.getCell(index + 1).value) }))
      if (cells.every(cell => !cell.value)) return
      deviceName = cells[0].value
      const cloudDeviceId = cells.find(cell => cell.key === 'cloudDeviceId')!.value
      const versionText = cells.find(cell => cell.key === 'version')!.value, version = Number(versionText)
      if (!cloudDeviceId || !/^\d+$/.test(versionText) || !Number.isSafeInteger(version)) throw Error(feText('profileIdentity'))
      if (seen.has(cloudDeviceId)) throw Error(feText('profileDuplicate'))
      seen.add(cloudDeviceId)
      if (!cells.find(cell => cell.key === 'responsibleAccount')?.value) throw Error(feText('profileRequired'))
      for (const cell of cells) {
        if (['identity', 'reference'].includes(cell.type) || !cell.value) continue
        const fail = (key: Parameters<typeof feText>[0]) => { throw Error(cell.label + '：' + feText(key)) }
        if (cell.type === 'number') {
          if (!/^\d+(\.\d+)?$/.test(cell.value) || !Number.isFinite(Number(cell.value))) fail('profileNumber')
          values[cell.key] = Number(cell.value)
        } else if (cell.type === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(cell.value) || !Number.isFinite(Date.parse(cell.value)) || new Date(cell.value).toISOString().slice(0, 10) !== cell.value) fail('profileDate')
          values[cell.key] = cell.value
        } else if (cell.type === 'switch') {
          if (![yes(), no(), '是', '否', 'Yes', 'No'].includes(cell.value)) fail('profileBoolean')
          values[cell.key] = [yes(), '是', 'Yes'].includes(cell.value)
        } else {
          if (cell.value.length > (cell.key === 'remark' ? 4000 : 256)) fail('profileTextLength')
          values[cell.key] = cell.value
        }
      }
      rows.push({ cloudDeviceId, version, rowNumber: number, values })
    } catch (error) { checks.push({ rowNumber: number, deviceName, valid: false, message: error instanceof Error ? error.message : String(error) }) }
  })
  if (!rows.length && !checks.length || rows.length + checks.length > 1000) throw Error(feText('profileRowsLimit'))
  return { rows, checks }
}
