import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync } = require('esbuild')
const bundle = buildSync({
  entryPoints: [resolve(root, 'hooks/useWorkManagement.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue']
})
const module = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(() => ({ ref: value => ({ value }) }), module, module.exports)

test('巡检维保均可在同一工作区配置设备范围和周期，生成后回到任务列表', () => {
  {
    const vm = module.exports.useWorkManagement()
    assert.deepEqual(vm.tabs.map(tab => tab.resource), ['tasks', 'standards', 'cycles', 'plans', 'groups'])
    assert.deepEqual(vm.tabs.map(tab => tab.label), ['任务', '作业标准', '周期计划', '任务配置', '设备组'])
    assert.equal(vm.activeTab.value, 'tasks')
    vm.activeTab.value = 'plans'
    vm.showTasks()
    assert.equal(vm.activeTab.value, 'tasks')
  }
})

test('巡检维保菜单包含任务配置查询、配置、生成所需权限与资产，不再保留独立入口', async () => {
  const menu = JSON.parse(await readFile(resolve(root, 'baseMenu.json'), 'utf8'))[0].children
  assert.equal(menu.some(item => item.code === 'facility/TaskConfigurations'), false)
  for (const code of ['facility/Inspection', 'facility/Maintenance']) {
    const item = menu.find(item => item.code === code)
    for (const permission of ['facility-plan', 'facility-cycle', 'facility-standard', 'facility-group', 'facility-device'])
      assert.ok(item.permissions.some(entry => entry.permission === permission && entry.actions.includes('query')))
    for (const resource of ['standard', 'cycle', 'plan', 'group']) {
      for (const action of ['save', 'delete']) {
        const button = item.buttons.find(button => button.id === resource + '-' + action)
        assert.ok(button.permissions.some(entry => entry.permission === 'facility-' + resource && entry.actions.includes(action)))
        if (action === 'save') assert.equal(button.permissions.some(entry => entry.actions.includes('delete')), false)
      }
    }
    assert.ok(item.buttons.find(button => button.id === 'group-qr'))
    const generate = item.buttons.find(button => button.id === 'generate')
    assert.ok(generate.permissions.some(entry => entry.permission === 'facility-task' && entry.actions.includes('generate')))
    assert.ok(generate.permissions.some(entry => entry.permission === 'facility-plan' && entry.actions.includes('save')))
    assert.ok(item.assetTypes.includes('facilityPlan') && item.assetTypes.includes('facilityCycle'))
  }
})
