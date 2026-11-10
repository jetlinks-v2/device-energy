import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync } = require('esbuild')
const bundle = buildSync({
  entryPoints: [resolve(root, 'hooks/useWorkNavigation.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue-router']
})
function navigation(kind, matched) {
  const paths = [], module = { exports: {} }
  const router = { resolve: () => ({ matched }), push: path => paths.push(path) }
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(() => ({ useRouter: () => router }), module, module.exports)
  return { paths, vm: module.exports.useWorkNavigation(kind) }
}

test('成功生成后进入同类型任务菜单，未注册菜单或仅匹配404不跳转', () => {
  for (const kind of ['inspection', 'maintenance']) {
    const path = '/facility/' + kind + '/tasks'
    const current = navigation(kind, [{ path }])
    current.vm.showTasks()
    assert.deepEqual(current.paths, [path])
    for (const matched of [[], [{ path: '/:pathMatch(.*)*' }]]) {
      const denied = navigation(kind, matched)
      denied.vm.showTasks()
      assert.deepEqual(denied.paths, [])
    }
  }
})

test('巡检维保各五个真实菜单可单独初始化、授权且具有对应的固定类型路由', async () => {
  const menu = JSON.parse(await readFile(resolve(root, 'baseMenu.json'), 'utf8'))[0].children
  const suffixes = ['Tasks', 'Standards', 'Cycles', 'Plans', 'Groups']
  const resources = ['tasks', 'standards', 'cycles', 'plans', 'groups']
  for (const [section, kind] of [['Inspection', 'inspection'], ['Maintenance', 'maintenance']]) {
    const parent = menu.find(item => item.code === 'facility/' + section)
    assert.deepEqual(parent.permissions, [])
    assert.deepEqual(parent.buttons, [])
    assert.deepEqual(parent.children.map(item => item.name), ['任务', '作业标准', '周期计划', '任务配置', '设备组'])
    for (const [index, child] of parent.children.entries()) {
      assert.equal(child.code, parent.code + '/' + suffixes[index])
      assert.equal(child.parentId, parent.id)
      assert.equal(child.sortIndex, index + 1)
      assert.equal(child.options.meta.componentCode, child.code)
      const view = await readFile(resolve(root, 'views/' + child.code + '/index.vue'), 'utf8')
      assert.ok(view.includes('kind="' + kind + '" resource="' + resources[index] + '"'))
      assert.ok(child.permissions.some(entry => entry.permission === 'facility-device' && entry.actions.includes('query')))
      assert.ok(child.buttons.length)
      if (['standards', 'cycles', 'plans'].includes(resources[index])) {
        assert.ok(child.buttons.some(button => button.id === 'toggle' && button.permissions.some(entry => entry.actions.includes('save'))))
      }
      assert.equal(child.buttons.some(button => button.id === 'delete' && button.permissions.some(entry => entry.actions.includes('save'))), false)
    }
    const plans = parent.children[3]
    assert.ok(plans.buttons.find(button => button.id === 'generate').permissions.some(entry => entry.permission === 'facility-task' && entry.actions.includes('generate')))
    assert.ok(parent.children[4].buttons.some(button => button.id === 'qr'))
    assert.equal(existsSync(resolve(root, 'views/' + parent.code + '/index.vue')), false)
  }
})
