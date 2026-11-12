import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync } = require('esbuild')
const load = (file) => {
  const result = buildSync({ entryPoints: [resolve(root, file)], bundle: true, write: false, platform: 'node', format: 'cjs' })
  const module = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
  return module.exports
}
const { resourceQuery, selectedProject, localTablePage } = load('shared/tableQuery.ts')
const { reportFilterValues } = load('shared/reportSearch.ts')
const { resourceSearchFields } = load('shared/resourceSearch.ts')
const { resources, resourceCellText } = load('shared/resources.ts')

test('历史设备组缺项目名称时按当前授权项目目录展示，不泄露不可见项目ID', () => {
  const projects = [{ value: 'p1', label: '5G园区' }]
  assert.equal(resourceCellText(resources.groups, 'projectName', { id: 'g', projectId: 'p1' }, projects), '5G园区')
  assert.equal(resourceCellText(resources.groups, 'projectName', { id: 'g', projectId: 'other' }, projects), '—')
  assert.equal(resourceCellText(resources.groups, 'projectName', { id: 'g', projectId: 'p1', projectName: '历史项目' }, projects), '历史项目')
})
const { display } = load('shared/types.ts')

test('抄表展示设备和仪表类型，搜索提交真实设备ID及指标类型', () => {
  const resource = resources.readings
  const row = { id: 'r', deviceId: 'd1', deviceName: '201水表', energyType: 'water', metricKind: 'counter' }
  assert.equal(resourceCellText(resource, 'deviceId', row), '201水表')
  assert.equal(resourceCellText(resource, 'deviceId', { id: 'r', deviceId: 'd1' }), 'd1')
  assert.equal(resourceCellText(resource, 'energyType', row), '水表')
  assert.equal(resourceCellText(resource, 'energyType', { id: 'r', energyType: 'electricity' }), '电表')
  assert.equal(resourceCellText(resource, 'energyType', { id: 'r', energyType: 'gas' }), '燃气表')
  assert.equal(resourceCellText(resource, 'metricKind', row), '累计读数')
  assert.ok(resource.columns.some(column => column.key === 'projectName'))
  const fields = resourceSearchFields(resource, { devices: [{ value: 'd1', label: '201水表' }] })
  assert.deepEqual(fields.find(field => field.dataIndex === 'deviceId').search.options, [{ value: 'd1', label: '201水表' }])
  assert.deepEqual(fields.find(field => field.dataIndex === 'metricKind').search.options.map(option => option.value), ['counter', 'increment'])
  assert.equal(fields.find(field => field.dataIndex === 'energyType').search.options[0].label, '水表')
  assert.ok(fields.some(field => field.dataIndex === 'projectId'))
  assert.equal(fields.some(field => ['deviceName', 'propertyId', 'projectName'].includes(field.dataIndex)), false)
})

test('读数指标按记录的指标类型展示，同名属性不会被通用状态翻译误判', () => {
  const readings = resources.readings
  for (const propertyId of ['total', 'meter_total', '累计用量']) {
    assert.equal(resourceCellText(readings, 'propertyId', { id: 'r', propertyId, metricKind: 'counter' }), '累计读数')
  }
  assert.equal(resourceCellText(readings, 'propertyId', { id: 'r', propertyId: 'increment', metricKind: 'increment' }), '周期增量')
  assert.equal(resourceCellText(readings, 'propertyId', { id: 'r', propertyId: 'increment', metricKind: 'instant' }), '瞬时指标')
  assert.equal(resourceCellText(readings, 'propertyId', { id: 'r', propertyId: 'increment' }), 'increment')
  assert.equal(resourceCellText(readings, 'propertyId', { id: 'r' }), '—')
})

test('读数来源用中文选项展示，搜索仍提交来源代码，不改写原始读数', () => {
  const row = { id: 'r', source: 'cloud', propertyId: 'total', metricKind: 'counter', value: 1220.6095 }
  const before = structuredClone(row)
  assert.equal(resourceCellText(resources.readings, 'source', row), 'Cloud采集')
  assert.equal(resourceCellText(resources.readings, 'source', { id: 'r', source: 'manual' }), '人工补录')
  assert.equal(resourceCellText(resources.readings, 'source', { id: 'r', source: 'legacy' }), 'legacy')
  assert.deepEqual(row, before)
  const source = resourceSearchFields(resources.readings, {}).find(field => field.dataIndex === 'source')
  assert.ok(source.search.options.some(option => option.value === 'cloud' && option.label === 'Cloud采集'))
})

test('仪表用途和统计层级复用中文选项，筛选提交原始代码且兼容旧自定义用途', () => {
  const mapping = resources['energy/mappings']
  for (const [key, values] of [
    ['usageType', { private: '户用', public: '公用' }],
    ['meterLevel', { master: '总表', submeter: '分表', branch: '支路', other: '其他' }]
  ]) {
    const field = mapping.fields.find(field => field.key === key)
    assert.equal(field.type, 'select')
    const search = resourceSearchFields(mapping, {}).find(field => field.dataIndex === key)
    for (const [code, label] of Object.entries(values)) {
      assert.equal(display(code, field.options), label)
      assert.ok(search.search.options.some(option => option.value === code && option.label === label))
    }
  }
  assert.equal(display('自定义历史用途', mapping.fields.find(field => field.key === 'usageType').options), '自定义历史用途')
  assert.equal(display('private'), 'private')
  assert.equal(display(null), '—')
  assert.equal(display(false), '停用')
})

test('用户 OR 查询仍被限制在当前巡检或维保类型内，并保留分页排序', () => {
  const query = { pageIndex: 2, pageSize: 24, sorts: [{ name: 'createTime', order: 'desc' }], terms: [
    { column: 'state', value: 'open' }, { type: 'or', column: 'state', value: 'completed' }
  ] }
  const before = structuredClone(query)
  for (const kind of ['inspection', 'maintenance']) {
    const result = resourceQuery(query, kind)
    assert.deepEqual(result.terms, [{ column: 'kind', value: kind }, { type: 'and', terms: query.terms }])
    assert.equal(result.pageIndex, 2)
    assert.equal(result.pageSize, 24)
    assert.deepEqual(result.sorts, query.sorts)
  }
  assert.deepEqual(query, before)
})

test('选定唯一项目时新增可默认项目，多项目、否定和 OR 不能误选', () => {
  assert.equal(selectedProject([{ terms: [{ column: 'projectId', termType: 'in', value: ['p1'] }] }]), 'p1')
  assert.equal(selectedProject([{ column: 'projectId', value: 'p1' }]), 'p1')
  for (const terms of [
    [{ column: 'projectId', termType: 'in', value: ['p1', 'p2'] }],
    [{ column: 'projectId', termType: 'neq', value: 'p1' }],
    [{ column: 'projectId', value: 'p1' }, { type: 'or', column: 'name', value: 'test' }]
  ]) assert.equal(selectedProject(terms), undefined)
})

test('统计结果分页连续且不重复，末页及空数组总数正确', () => {
  const rows = Array.from({ length: 29 }, (_, id) => ({ id }))
  const pages = [0, 1, 2].map(pageIndex => localTablePage(rows, { pageSize: 12, pageIndex }))
  assert.deepEqual(pages.map(page => page.data.length), [12, 12, 5])
  assert.deepEqual(pages.flatMap(page => page.data), rows)
  assert.ok(pages.every(page => page.total === 29 && page.pageSize === 12))
  assert.deepEqual(localTablePage([], {}), { data: [], total: 0, pageSize: 12, pageIndex: 0 })
})

test('报表将 AND 条件与时间区间转换为现有接口参数', () => {
  assert.deepEqual(reportFilterValues([{ terms: [
    { column: 'projectId', value: 'p1' }, { column: 'level', value: 'submeter' },
    { column: 'timeRange', termType: 'btw', value: [1000, 2000] }
  ] }]), { projectId: 'p1', level: 'submeter', from: 1000, to: 2000, period: undefined, year: undefined, month: undefined })
})

test('报表不能静默丢弃 OR、重复字段、无效范围或未知统计口径', () => {
  for (const terms of [
    [{ column: 'projectId', value: 'p1' }, { type: 'or', column: 'level', value: 'master' }],
    [{ column: 'year', value: 2026 }, { column: 'year', value: 2025 }],
    [{ column: 'timeRange', termType: 'btw', value: [2000, 1000] }],
    [{ column: 'timeRange', termType: 'btw', value: ['invalid', 1000] }],
    [{ column: 'year', termType: 'gt', value: 2026 }], [{ column: 'month', value: 13 }],
    [{ column: 'level', value: 'invalid' }], [{ column: 'period', value: 'invalid' }],
    [{ column: 'unknown', value: 'test' }]
  ]) assert.equal(reportFilterValues(terms), undefined)
})

test('列表搜索使用状态选项、布尔值和时间编辑器，计算列不提交给后端', () => {
  const collection = resourceSearchFields(resources.collection, {})
  assert.equal(collection.some(field => field.dataIndex === 'collectionLag'), false)
  assert.equal(collection.find(field => field.dataIndex === 'lastCollectedTime').search.type, 'date')
  const enabled = collection.find(field => field.dataIndex === 'enabled').search
  assert.equal(enabled.handleValue('false'), false)
  assert.equal(enabled.handleValue('true'), true)
  const tasks = resourceSearchFields(resources.tasks, {}, 'inspection')
  assert.equal(tasks.some(field => field.dataIndex === 'kind'), false)
  assert.ok(tasks.find(field => field.dataIndex === 'state').search.options.some(option => option.value === 'completed'))
})
