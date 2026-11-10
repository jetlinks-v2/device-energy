import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/usePlanReferences.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'plan-reference-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const watch=(read,callback)=>watchers.push(callback)',
      '../api': 'export const facility=transport'
    }[args.path] }))
  } }]
})
function setup(transport) {
  const watchers = [], module = { exports: {} }, options = {}, error = { value: '' }
  new Function('transport', 'watchers', 'module', 'exports', bundled.outputFiles[0].text)(transport, watchers, module, module.exports)
  const form = { projectId: 'project-a', kind: 'inspection' }
  module.exports.usePlanReferences(() => ({ path: 'plans' }), form, { value: true }, options, error)
  return { form, options, error, refresh: () => watchers[0]() }
}

test('巡检和维保候选分别按当前项目及作业类型过滤，只加载启用标准和周期', async () => {
  const calls = []
  const vm = setup({ query: async (path, query) => { calls.push({ path, query }); return { total: 0, data: [] } }, options: async () => [] })
  for (const kind of ['inspection', 'maintenance']) {
    vm.form.kind = kind
    await vm.refresh()
    for (const path of ['standards', 'cycles']) {
      const call = calls.filter(item => item.path === path).at(-1)
      assert.ok(call.query.terms.some(term => term.column === 'projectId' && term.value === 'project-a'))
      assert.ok(call.query.terms.some(term => term.column === 'kind' && term.value === kind))
      assert.ok(call.query.terms.some(term => term.column === 'enabled' && term.value === true))
    }
  }
})

test('切换项目及类型后旧请求返回不能覆盖新候选，失败时不回退全量候选', async () => {
  let release
  const old = new Promise(resolve => { release = resolve })
  const vm = setup({
    query: async (path, query) => {
      const project = query.terms.find(term => term.column === 'projectId').value
      if (project === 'project-a') await old
      return { total: 1, data: [{ id: project + '-' + path, name: project }] }
    }, options: async () => []
  })
  const previous = vm.refresh()
  vm.form.projectId = 'project-b'; vm.form.kind = 'maintenance'
  await vm.refresh()
  release(); await previous
  assert.equal(vm.options.cycles[0].value, 'project-b-cycles')
  assert.equal(vm.options.standards[0].value, 'project-b-standards')
  vm.form.projectId = undefined
  await vm.refresh()
  assert.deepEqual(vm.options.cycles, [])
  assert.deepEqual(vm.options.standards, [])
})
