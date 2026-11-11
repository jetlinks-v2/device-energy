import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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

const grants = (menu, selected = []) => {
  const permissions = [...(menu.permissions || []), ...menu.buttons.filter(b => selected.includes(b.id)).flatMap(b => b.permissions || [])]
  return (resource, action) => permissions.some(p => p.permission === resource && p.actions.includes(action))
}

test('计费出账作为独立一级业务菜单初始化，配置保存不捆绑生成应收权限', () => {
  const configuration = all.find(menu => menu.code === 'facility/Configuration/MeterBilling')
  const billing = menus[0].children.find(menu => menu.code === 'facility/Billing')
  assert.ok(billing)
  assert.equal(billing.parentId, menus[0].id)
  assert.equal(billing.options.meta.componentCode, 'facility/Billing')
  assert.deepEqual(configuration.buttons.map(b => b.id), ['save'])
  assert.deepEqual(billing.buttons.map(b => b.id), ['preview', 'generate'])
  assert.equal(grants(configuration, ['save'])('facility-meter-billing', 'generate'), false)
  assert.equal(grants(billing, ['preview'])('facility-meter-billing', 'save'), false)
  assert.ok(grants(billing, ['generate'])('facility-meter-billing', 'generate'))
  const initialized = filterMenuByPermission(permissions, structuredClone(menus), true)
  assert.ok(initialized[0].children.some(menu => menu.code === 'facility/Billing'))
})

test('员工移动端单独授权即可覆盖实际使用的全部任务动作，审批和关闭不捆绑执行权限', () => {
  const employee = all.find(menu => menu.code === 'facility/Employee')
  const scan = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? scan(new URL(entry.name + '/', dir)) : /\.(ts|vue)$/.test(entry.name) ? [readFileSync(new URL(entry.name, dir), 'utf8')] : [])
  const actions = new Set(scan(new URL('../mobile-h5/src/', import.meta.url)).flatMap(source => [...source.matchAll(/\bcan\('([^']+)'\)/g)].map(match => match[1])))
  const full = grants(employee, employee.buttons.map(b => b.id))
  for (const action of actions) assert.ok(full('facility-task', action), 'H5 缺少任务动作：' + action)
  for (const action of ['review', 'dispatch', 'close']) {
    const has = grants(employee, [action])
    assert.ok(has('facility-task', 'query')); assert.ok(has('facility-task', action))
    assert.equal(has('facility-task', 'save'), false)
    assert.equal(has('file', 'save'), false)
  }
})

test('PC与H5查看任务可读照片，单独授权执行即可拍照，审阅角色不获得上传权限', () => {
  for (const code of ['facility/Inspection/Tasks', 'facility/Maintenance/Tasks', 'facility/Employee']) {
    const menu = all.find(item => item.code === code)
    assert.ok(grants(menu)('file', 'query'), code)
    assert.equal(grants(menu)('file', 'save'), false)
    const execute = grants(menu, ['execute'])
    assert.ok(execute('facility-task', 'save'), code)
    assert.ok(execute('file', 'save'), code)
    assert.equal(execute('facility-task', 'review'), false)
    assert.equal(execute('facility-task', 'close'), false)
  }
  assert.ok(grants(all.find(menu => menu.code === 'facility/Devices'), ['save'])('file', 'save'))
})

test('菜单编码及按钮ID唯一，所有父级归属正确', () => {
  assert.equal(new Set(all.map(menu => menu.id)).size, all.length)
  assert.equal(new Set(all.map(menu => menu.code)).size, all.length)
  for (const menu of all) {
    assert.equal(new Set((menu.buttons || []).map(button => button.id)).size, (menu.buttons || []).length, menu.code)
    for (const child of menu.children || []) assert.equal(child.parentId, menu.id)
  }
})
