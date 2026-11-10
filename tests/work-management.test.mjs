import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
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
    assert.deepEqual(plans.buttons.map(button => button.id), ['save', 'delete', 'toggle'])
    assert.ok(parent.children[4].buttons.some(button => button.id === 'qr'))
    assert.equal(existsSync(resolve(root, 'views/' + parent.code + '/index.vue')), false)
  }
})
