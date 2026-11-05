import { feText } from '../shared/i18n'
/** RFC 4180 CSV; Excel formula escaping applies only to export, never to submitted values. */
export const csvCell = (value: unknown) =>
  '"' +
  String(value ?? '')
    .replace(/^[=+@-]/, "'$&")
    .replace(/"/g, '""') +
  '"'
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [],
    row: string[] = []
  let value = '',
    quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"'
        i++
      } else if (quoted || value === '') quoted = !quoted
      else throw Error(feText('invalidCsvQuoting'))
    } else if (c === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(value)
      if (row.some(Boolean)) rows.push(row.splice(0))
      else row.length = 0
      value = ''
    } else value += c
  }
  if (quoted) throw Error(feText('unclosedCsvQuote'))
  row.push(value)
  if (row.some(Boolean)) rows.push(row)
  return rows
}
export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    })
  )
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
