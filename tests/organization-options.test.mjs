import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useResource.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'organization-options-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|ant-design-vue|\.\.\/api|\.\/useResourceQuery)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const computed=read=>({get value(){return read()}}); export const ref=value=>({value}); export const reactive=value=>value; export const watch=()=>{}; export const onMounted=callback=>mounted.push(callback)',
      'ant-design-vue': 'export const message={}',
      '../api': 'export const facility=transport',
      './useResourceQuery': 'export const useResourceQuery=()=>({error:{value:""},projectId:{value:""}})'
    }[args.path] }))
  } }]
})
async function load(rows) {
  const mounted = [], calls = [], module = { exports: {} }
  const transport = { options: async source => { calls.push(source); return source === 'organizations' ? rows : [] } }
  new Function('transport', 'mounted', 'module', 'exports', bundled.outputFiles[0].text)(transport, mounted, module, module.exports)
  const vm = module.exports.useResource(() => ({ path: 'plans', fields: [{ source: 'organizations' }] }))
  mounted.forEach(callback => callback())
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.sort(), ['organizations', 'projects'])
  assert.equal(vm.error.value, '')
  return vm.options.organizations
}

test('外协组织保留树形父子关系，仅明确标注外协的节点可选，类型不向下继承', async () => {
  const options = await load([{ id: 'root', name: '重庆', children: [
    { id: 'branch', name: '茶园', parentId: 'root', organizationType: { value: 'project', text: '项目' }, children: [
      { id: 'vendor', name: '时代都会', parentId: 'branch', organizationType: { value: 'external', text: '外协单位' }, children: [
        { id: 'unmarked', name: '下级', parentId: 'vendor' }
      ] }
    ] }
  ] }])
  assert.deepEqual(options.map(({ value, parentId, selectable }) => ({ value, parentId, selectable })), [
    { value: 'root', parentId: undefined, selectable: false },
    { value: 'branch', parentId: 'root', selectable: false },
    { value: 'vendor', parentId: 'branch', selectable: true },
    { value: 'unmarked', parentId: 'vendor', selectable: false }
  ])
  assert.equal(options.find(option => option.value === 'vendor').label, '时代都会')
  assert.deepEqual(options.map(option => option.disabled), [true, true, false, true])
})

test('没有外协单位时保持空选项，不回退到全部组织', async () => {
  assert.deepEqual(await load([]), [])
})
