import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, 'package.json'))
const { build } = createRequire(resolve(root, '../../package.json'))('esbuild')
const ExcelJS = require('exceljs')
const bundled = await build({ entryPoints: [resolve(root, 'utils/deviceProfileWorkbook.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['exceljs'] })
const module = { exports: {} }
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports)
const { createProfileWorkbook, readProfileWorkbook, profileColumns } = module.exports
const devices = [{ id: 'local', cloudDeviceId: 'cloud', version: 7, name: '入户水表', sourceName: '水表01', projectId: 'p', projectName: '元时代物业',
  responsibleUserId: 'owner', spaceId: 'room', location: '水表箱', inspectionEnabled: true, maintenanceEnabled: false, energyEnabled: true, power: 0 }]
const references = [{ projectId: 'p', projectName: '元时代物业', people: [{ id: 'owner', name: '李秀辉', username: 'owner@CQHT' }], spaces: [{ id: 'room', fullName: '12栋/201' }] }]
const bytes = async change => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await createProfileWorkbook(devices, references))
  await change?.(workbook, workbook.worksheets[0])
  const data = await workbook.xlsx.writeBuffer()
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}
const column = key => profileColumns().findIndex(item => item.key === key) + 1

test('真实Excel往返包含详情全部可导入字段、负责人和空间参考，隐藏身份和版本', async () => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await createProfileWorkbook(devices, references))
  assert.equal(workbook.worksheets.length, 4)
  const sheet = workbook.worksheets[0]
  assert.equal(sheet.getColumn(column('cloudDeviceId')).hidden, true)
  assert.equal(sheet.getColumn(column('version')).hidden, true)
  assert.equal(sheet.getCell(2, column('responsibleAccount')).value, 'owner@CQHT')
  assert.equal(workbook.worksheets[2].getCell('B2').value, 'owner@CQHT')
  assert.equal(workbook.worksheets[3].getCell('B2').value, '12栋/201')
  const parsed = await readProfileWorkbook(await bytes())
  assert.equal(parsed.checks.length, 0)
  assert.equal(parsed.rows[0].version, 7)
  assert.deepEqual(parsed.rows[0].values, { name: '入户水表', responsibleAccount: 'owner@CQHT', spacePath: '12栋/201', power: 0, location: '水表箱', workEnabled: true, energyEnabled: true })
})

test('选填空白不会生成清空patch，否转换false，保留真实行号', async () => {
  const parsed = await readProfileWorkbook(await bytes((workbook, sheet) => {
    sheet.getCell(2, column('location')).value = ''
    sheet.getCell(2, column('energyEnabled')).value = '否'
    sheet.getCell(2, column('purchaseDate')).value = new Date('2026-11-17T00:00:00Z')
    sheet.getCell(2, column('purchaseDate')).numFmt = 'yyyy-mm-dd'
    const values = sheet.getRow(2).values; sheet.getRow(2).values = []; sheet.getRow(5).values = values
  }))
  assert.equal(parsed.checks.length, 0)
  assert.equal(parsed.rows[0].rowNumber, 5)
  assert.equal('location' in parsed.rows[0].values, false)
  assert.equal(parsed.rows[0].values.energyEnabled, false)
  assert.equal(parsed.rows[0].values.purchaseDate, '2026-11-17')
})

test('负责人必填、非法日期、负数、开关拼写、公式逐行报错且不生成写入行', async () => {
  for (const [key, value, expected] of [ ['responsibleAccount', '', /负责人/], ['purchaseDate', '2026-02-30', /日期/], ['power', '-1', /非负/],
    ['energyEnabled', '启用', /是.*否/], ['manufacturer', { formula: '1+1', result: 2 }, /公式/], ['version', '', /版本/] ]) {
    const parsed = await readProfileWorkbook(await bytes((_, sheet) => { sheet.getCell(2, column(key)).value = value }))
    assert.equal(parsed.rows.length, 0)
    assert.equal(parsed.checks[0].rowNumber, 2)
    assert.match(parsed.checks[0].message, expected)
  }
})

test('重复设备行、错误模板和空表会拒绝，防止误覆盖', async () => {
  const parsed = await readProfileWorkbook(await bytes((_, sheet) => { sheet.getRow(3).values = sheet.getRow(2).values }))
  assert.equal(parsed.rows.length, 1)
  assert.match(parsed.checks[0].message, /重复/)
  await assert.rejects(readProfileWorkbook(await bytes((_, sheet) => { sheet.getCell('A1').value = '错误列' })), /模板/)
  await assert.rejects(readProfileWorkbook(await bytes((_, sheet) => { sheet.spliceRows(2, 1) })), /1 至 1000/)
})

const hookBuild = await build({ entryPoints: [resolve(root, 'hooks/useDeviceImport.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'import-test-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api|\.\.\/utils\/deviceProfileWorkbook)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}})',
      '../api': 'export const facility=transport',
      '../utils/deviceProfileWorkbook': 'export const createProfileWorkbook=()=>{}; export const readProfileWorkbook=readFile'
    }[args.path] }))
  } }] })
function setup() {
  const calls = [], module = { exports: {} }; let changed = 0, resolveSave
  const transport = { post: async (url, rows) => {
    calls.push({ url, rows })
    if (url.endsWith('/validate')) return rows.map(row => ({ rowNumber: row.rowNumber, valid: row.values.responsibleAccount !== 'foreign', message: '不属于项目' }))
    await new Promise(resolve => { resolveSave = resolve })
  } }
  let parsed = { rows: [{ cloudDeviceId: 'cloud', version: 1, rowNumber: 2, values: { responsibleAccount: 'owner' } }], checks: [] }
  new Function('transport', 'readFile', 'module', 'exports', hookBuild.outputFiles[0].text)(transport, async () => parsed, module, module.exports)
  return { calls, vm: module.exports.useDeviceImport(() => 'p', () => { changed++ }), setParsed: value => { parsed = value }, complete: () => resolveSave(), changed: () => changed }
}
const file = () => new File(['xlsx'], '设备.xlsx')

test('选择文件不写库，校验不写库，确认只提交一次，成功通知刷新', async () => {
  const state = setup(), { vm, calls } = state
  vm.open(); vm.chooseFile(file())
  assert.equal(calls.length, 0); assert.equal(vm.canSubmit.value, false)
  await vm.validate()
  assert.equal(calls.length, 1); assert.match(calls[0].url, /validate$/); assert.equal(vm.canSubmit.value, true)
  const pending = vm.submit(); await vm.submit()
  assert.equal(calls.length, 2); assert.match(calls[1].url, /import$/)
  state.complete(); await pending
  assert.equal(state.changed(), 1); assert.equal(vm.canSubmit.value, false); assert.match(vm.notice.value, /1/)
})

test('存在本地或服务器错误禁止提交，换文件使旧校验失效', async () => {
  for (const localError of [false, true]) {
    const { vm, calls, setParsed } = setup()
    vm.open(); vm.chooseFile(file())
    setParsed({ rows: [{ rowNumber: 5, values: { responsibleAccount: localError ? 'owner' : 'foreign' } }],
      checks: localError ? [{ rowNumber: 2, valid: false, message: '负责人必填' }] : [] })
    await vm.validate(); await vm.submit()
    assert.equal(vm.canSubmit.value, false); assert.equal(calls.length, 1)
    vm.chooseFile(file()); assert.equal(vm.validated.value, false); assert.deepEqual(vm.checks.value, [])
  }
})
