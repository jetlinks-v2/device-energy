import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const { buildSync } = require('esbuild')
const built = buildSync({
  entryPoints: [fileURLToPath(new URL('../utils/menuNavigation.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  alias: { '@jetlinks-web-core': fileURLToPath(new URL('../../../jetlinks-web-core/src', import.meta.url)) },
})
const compiled = { exports: {} }
new Function('module', 'exports', built.outputFiles[0].text)(compiled, compiled.exports)
const filter = compiled.exports.facilityMenuFilter.filter
const definitions = JSON.parse(readFileSync(new URL('../baseMenu.json', import.meta.url), 'utf8'))
const system = definitions[0]
const baseMenus = JSON.parse(readFileSync(new URL('../../property-base-ui/baseMenu.json', import.meta.url), 'utf8'))

test('初始化保留设施设备授权根，模块注册导航扩展', () => {
  assert.equal(definitions.length, 1)
  assert.equal(system.code, 'facility-management')
  assert.ok(system.children.length)
  assert.match(readFileSync(new URL('../index.ts', import.meta.url), 'utf8'), /getMenuFilters:.*\[facilityMenuFilter\]/)
})

test('项目入口和无应用上下文保留完整菜单树', () => {
  const menus = [...baseMenus, system]
  for (const applicationScope of [undefined, '', '  ', '__jetlinks_project__', 'business_application:__jetlinks_project__']) {
    assert.strictEqual(filter(menus, { applicationScope }), menus)
  }
})

test('独立应用只展开设施一层，公共基础及隐藏授权节点不变，重复处理结果稳定', () => {
  const menus = structuredClone([...baseMenus, system])
  const before = structuredClone(menus)
  const navigation = filter(menus, { applicationScope: 'business_application:test-app' })
  assert.deepEqual(navigation, [...baseMenus, ...system.children])
  assert.deepEqual(menus, before)
  assert.deepEqual(navigation.filter(menu => menu.options?.show === false), system.children.filter(menu => menu.options?.show === false))
  assert.deepEqual(filter(navigation, { applicationScope: 'test-app' }), navigation)
})

test('部分授权不补菜单或按钮，空根移除，兼容旧平铺菜单', () => {
  const page = { ...system.children[0], buttons: [{ id: 'query' }], children: [] }
  assert.deepEqual(filter([{ ...system, children: [page] }], { applicationScope: 'test-app' }), [page])
  for (const children of [undefined, []]) {
    assert.deepEqual(filter([{ ...system, children }], { applicationScope: 'test-app' }), [])
  }
  const flat = [...baseMenus, page]
  assert.deepEqual(filter(flat, { applicationScope: 'test-app' }), flat)
})
