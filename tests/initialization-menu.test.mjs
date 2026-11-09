import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const { transformSync } = require('esbuild')
const core = readFileSync(new URL('../../../jetlinks-web-core/src/views/init-home/Menu/index.vue', import.meta.url), 'utf8')
const source = core.match(/const filterMenuByPermission = \([\s\S]*?\n};/)[0]
const code = transformSync(source.replace('const filterMenuByPermission', 'export const filterMenuByPermission'), {
  loader: 'ts', format: 'cjs',
}).code
const module = { exports: {} }
new Function('module', 'exports', code)(module, module.exports)
const { filterMenuByPermission } = module.exports
const menus = JSON.parse(readFileSync(new URL('../baseMenu.json', import.meta.url), 'utf8'))
const walk = nodes => nodes.flatMap(node => [node, ...walk(node.children || [])])
const all = walk(menus)
const permissions = [...new Set(all.flatMap(node => [
  ...(node.permissions || []).map(item => item.permission),
  ...(node.buttons || []).flatMap(button => (button.permissions || []).map(item => item.permission)),
]))]

test('后端资源已注册时，真实初始化筛选保留业务菜单与全部按钮', () => {
  const actual = walk(filterMenuByPermission(permissions, structuredClone(menus), true))
  assert.deepEqual(actual.map(node => node.id), all.map(node => node.id))
  for (const expected of all) {
    assert.deepEqual(actual.find(node => node.id === expected.id).buttons || [], expected.buttons || [])
  }
})

test('后端未注册对应权限时，初始化不展示业务菜单', () => {
  assert.deepEqual(filterMenuByPermission([], structuredClone(menus), true), [])
})
