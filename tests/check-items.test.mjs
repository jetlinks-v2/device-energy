import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({ entryPoints: [resolve(root, 'hooks/useCheckItems.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs' })
const module = { exports: {} }
new Function('module', 'exports', bundled.outputFiles[0].text)(module, module.exports)
const { useCheckItems, validateCheckItems, normalizeCheckItems } = module.exports

test('编辑保留检查项ID和其他行；切换填写方式清除旧范围和选项', () => {
  let items = [
    { id: 'a', name: '压力', kind: 'number', minimum: 1, maximum: 10, required: true, photoRequired: false },
    { id: 'b', name: '外观', kind: 'text', required: true, photoRequired: false }
  ]
  const original = items
  const editor = useCheckItems(() => items, next => { items = next })
  editor.update('a', { name: '水压' })
  assert.equal(items[0].id, 'a')
  assert.equal(original[0].name, '压力')
  assert.equal(items[1], original[1])
  editor.update('a', { kind: 'choice' })
  assert.equal(items[0].minimum, undefined)
  assert.equal(items[0].maximum, undefined)
  assert.deepEqual(items[0].options, ['符合', '不符合'])
  assert.equal(validateCheckItems(items), undefined)
  editor.update('a', { kind: 'text' })
  assert.equal(items[0].options, undefined)
  editor.remove('a')
  assert.deepEqual(items.map(item => item.id), ['b'])
  editor.add()
  assert.notEqual(items[1].id, 'b')
  assert.equal(items[1].required, true)
  assert.equal(items[1].photoRequired, true)
  assert.equal(items[1].kind, 'choice')
  assert.deepEqual(items[1].options, ['符合', '不符合'])
})

test('空检查项、空白或重复选项、反向范围都提示对应行；100项上限生效', () => {
  assert.ok(validateCheckItems([]))
  const check = { id: 'a', name: '压力', kind: 'choice', required: true, photoRequired: false }
  for (const options of [[], [' '], ['正常', ' 正常']])
    assert.match(validateCheckItems([{ ...check, options }]), /检查要求 1/)
  assert.match(validateCheckItems([{ ...check, kind: 'number', minimum: 10, maximum: 1 }]), /最小值/)
  assert.equal(validateCheckItems([{ ...check, kind: 'number', minimum: 0, maximum: 0 }]), undefined)
  let items = Array.from({ length: 100 }, (_, index) => ({ ...check, id: String(index), kind: 'text' }))
  const editor = useCheckItems(() => items, next => { items = next })
  editor.add()
  assert.equal(items.length, 100)
  assert.equal(validateCheckItems(items), undefined)
})


test('旧是否和自定义单选按固定选项编辑，保留已有拍照设置及历史快照', () => {
  const original = [{ id: 'old', name: '外观', kind: 'boolean', required: true, photoRequired: false },
    { id: 'choice', name: '外观', kind: 'choice', options: ['旧选项'], required: true, photoRequired: true }]
  const normalized = normalizeCheckItems(original)
  assert.equal(normalized[0].kind, 'choice')
  assert.equal(normalized[0].photoRequired, false)
  assert.deepEqual(normalized[0].options, ['符合', '不符合'])
  assert.deepEqual(normalized[1].options, ['符合', '不符合'])
  assert.equal(original[0].kind, 'boolean')
  assert.deepEqual(original[1].options, ['旧选项'])
})
