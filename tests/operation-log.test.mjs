import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const result = await build({
  stdin: { contents: "export { resources, resourceCellText } from './shared/resources'; export { resourceSearchFields } from './shared/resourceSearch'; export { operationStateText, resubmissionRecordId } from './shared/operationLog'", resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs',
})
const mod = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(mod, mod.exports)
const { resources, resourceCellText, resourceSearchFields } = mod.exports

test('日志业务对象及操作显示中文，筛选提交原始编码', () => {
  const config = resources.operations
  for (const [targetType, action, objectText, actionText] of [
    ['reading', 'approve', '抄表补录', '审核通过'],
    ['replacement', 'approve', '换表与归零', '审核通过'],
    ['fault', 'start', '设备故障', '开始处理'],
    ['meterBill', 'recalculate', '计费出账', '重新核算'],
  ]) {
    const row = { id: 'log-1', version: 0, targetType, action }
    assert.equal(resourceCellText(config, 'targetType', row), objectText)
    assert.equal(resourceCellText(config, 'action', row), actionText)
  }
  const fields = resourceSearchFields(config, { projects: [] })
  for (const key of ['targetType', 'action']) {
    const field = fields.find(item => item.dataIndex === key)
    assert.equal(field.search.type, 'select')
    assert.ok(field.search.options.some(option => option.value === (key === 'targetType' ? 'reading' : 'approve')))
  }
})

test('历史重新提交日志中的新记录编号不作为说明，普通备注保持原文', () => {
  const config = resources.operations
  const comment = '8c848cee1b830af581d2f162ad09d2cb'
  const row = { id: 'log-2', version: 0, targetType: 'reading', action: 'resubmit', comment }
  assert.equal(resourceCellText(config, 'comment', row), '重新提交补录申请')
  assert.equal(row.comment, comment)
  assert.equal(mod.exports.resubmissionRecordId(row), comment)
  assert.equal(mod.exports.resubmissionRecordId({ ...row, comment: '修正录入错误' }), undefined)
  assert.equal(resourceCellText(config, 'comment', { ...row, comment: '修正录入错误' }), '修正录入错误')
  assert.equal(resourceCellText(config, 'comment', { ...row, action: 'approve' }), comment)
  assert.equal(resourceCellText(config, 'targetType', { ...row, targetType: 'future-type' }), 'future-type')
})

test('日志状态按业务语义显示，关联项目编号不会按任务状态翻译', () => {
  const state = (targetType, toState, other = {}) => mod.exports.operationStateText({ id: 'log', version: 0, targetType, toState, ...other }, 'toState')
  assert.equal(state('fault', 'open'), '待派单')
  assert.equal(state('fault', 'assigned'), '待接单')
  assert.equal(state('fault', 'review'), '待验收')
  assert.equal(state('reading', 'pending'), '待审核')
  assert.equal(state('reading', 'accepted'), '已生效')
  assert.equal(state('device', 'project-id', { action: 'confirm-project', projectName: '5G园区' }), '5G园区')
  assert.equal(state('reading', null), '—')
})
