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
const { resources } = load('shared/resources.ts')

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
