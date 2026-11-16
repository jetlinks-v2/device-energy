import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const vue = require('vue'), { transformSync } = require('esbuild')
async function project(query, aggregate, initial) {
  let mount
  const module = { exports: {} }
  const source = transformSync(readFileSync(resolve(root, 'hooks/useBillingProject.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'vue') return { ...vue, onMounted: fn => { mount = fn } }
    if (name === 'vue-router') return { useRoute: () => ({ query }) }
    if (name === '../api') return { facility: { options: async () => [{ id: 'a' }, { id: 'b' }] } }
    return { messageOf: cause => cause.message }
  }, module, module.exports)
  const vm = module.exports.useBillingProject(initial, aggregate); await mount(); return vm
}
test('查询模式默认全部、单项目与多项目深链按授权目录取交集', async () => {
  const all = await project({}, true)
  assert.deepEqual(all.projectIds.value, []); assert.deepEqual(all.projectTerms(), [])
  const single = await project({ projectId: 'b' }, true)
  assert.equal(single.projectId.value, 'b'); assert.equal(single.projectTerms()[0].value, 'b')
  const multi = await project({ projectIds: ['b', 'a', 'not-authorized'] }, true)
  assert.deepEqual(multi.projectIds.value, ['a', 'b'])
  assert.deepEqual(multi.projectTerms(), [{ column: 'projectId', termType: 'in', value: ['a', 'b'] }])
  multi.projectId.value = 'b'; assert.deepEqual(multi.projectIds.value, ['b'])
  multi.projectIds.value = []; assert.equal(multi.projectId.value, undefined)
})
test('计费写入模式继续要求单项目，保留既有默认及指定项目', async () => {
  const first = await project({}, false); assert.equal(first.projectId.value, 'a')
  const selected = await project({}, false, 'b'); assert.equal(selected.projectId.value, 'b')
})
