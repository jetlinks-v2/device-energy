import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useResourceQuery.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'resource-query-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}}); export const watch=()=>{}; export const onMounted=()=>{}',
      '../api': 'export const facility={query:transport}; export const queryResource=transport'
    }[args.path] }))
  } }]
})

test('设备组按项目共享，入口类型只用于按钮权限；其余作业资源保留类型隔离', async () => {
  for (const kind of ['inspection', 'maintenance']) for (const path of ['groups', 'tasks', 'standards', 'cycles', 'plans']) {
    for (const managed of [true, false]) {
      const calls = [], module = { exports: {} }
      const transport = async (resource, query) => { calls.push({ resource, query }); return { data: [], total: 0 } }
      new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
      const vm = module.exports.useResourceQuery(() => ({ path }), kind, managed)
      const terms = [{ column: 'projectId', value: 'project-a' }]
      if (managed) await vm.request({ terms, pageIndex: 1, pageSize: 12 })
      else { vm.projectId.value = 'project-a'; await vm.refresh() }
      assert.equal(calls[0].resource, path)
      assert.deepEqual(calls[0].query.terms, [
        ...(path === 'groups' ? [] : [{ column: 'kind', value: kind }]),
        { type: 'and', terms }
      ])
    }
  }
})
