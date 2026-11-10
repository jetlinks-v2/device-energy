import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const { transformSync, buildSync } = require('esbuild')
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
const baseMenus = JSON.parse(readFileSync(new URL('../../property-base-ui/baseMenu.json', import.meta.url), 'utf8'))
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

test('设施业务归入设施设备，公共基础独立初始化且没有重复菜单', () => {
  const actual = filterMenuByPermission(permissions, structuredClone(menus), true)
  assert.equal(actual.length, 1)
  assert.equal(actual[0].name, '设施设备')
  assert.ok(actual[0].children.some(node => node.code === 'facility/Devices'))
  assert.ok(actual[0].children.some(node => node.code === 'system-management/Sync'))
  assert.ok(actual[0].children.filter(node => node.options?.show === false).length === 2)
  assert.ok(actual[0].children.every(node => node.parentId === actual[0].id))
  const combined = walk([...menus, ...baseMenus])
  assert.equal(new Set(combined.map(node => node.id)).size, combined.length)
  for (const code of ['charging/OrganizationType', 'charging/User', 'charging/Space', 'charging/Customer', 'charging/Dictionary']) {
    assert.equal(combined.filter(node => node.code === code).length, 1)
    assert.equal(all.filter(node => node.code === code).length, 0)
  }
})

test('设施开发及联合构建加载公共基础和认证模块，不额外打入巡更', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const key of ['dev', 'build:with-base']) {
    assert.match(scripts[key], /-- -- --module-name facility-energy-ui,property-base-ui,authentication-manager-ui$/)
    assert.doesNotMatch(scripts[key], /cloud-patrol-ui/)
  }
})

test('宿主菜单入口保持运行端标记，页面归属交由宿主解析', () => {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL('../baseMenu.ts', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'cjs',
  })
  const runtimeModule = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(runtimeModule, runtimeModule.exports)
  const actual = walk(runtimeModule.exports.default())
  assert.deepEqual(actual.map(node => node.id), all.map(node => node.id))
  assert.ok(actual.every(node => node.runtime === true && !node.options?.appName))
})
