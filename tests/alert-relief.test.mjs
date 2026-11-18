import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const vue = require('vue'), { transformSync } = require('esbuild')
function setup() {
  const posts = [], notices = [], record = { id: 'alarm', version: 4, source: 'saas', state: 'open' }
  const api = {
    post: async (path, body) => { posts.push({ path, body }); Object.assign(record, { state: 'recovered' }); return record },
    query: async () => ({ data: [record], total: 1 }), read: async () => record,
    get: async path => path === 'alerts/levels' ? [] : { data: [], total: 0 }
  }
  const module = { exports: {} }
  const code = transformSync(readFileSync(resolve(root, 'hooks/useAlertCenter.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'vue') return { ...vue, onBeforeUnmount: () => {} }
    if (name === 'vue-router') return { useRoute: () => ({ query: {} }) }
    if (name === 'ant-design-vue') return { message: { success: value => notices.push(value) } }
    if (name.endsWith('/api')) return { facility: api }
    if (name.endsWith('/i18n')) return { feText: value => value }
    if (name.endsWith('/types')) return { messageOf: error => error.message }
    if (name.endsWith('/useOperationRoute')) return { useOperationRoute: () => vue.ref(false) }
    if (name.endsWith('/useBillingProject')) return { useBillingProject: () => ({ projectIds: vue.ref([]), projectTerms: () => [], error: vue.ref('') }) }
    throw Error(name)
  }, module, module.exports)
  const scope = vue.effectScope(), vm = scope.run(() => module.exports.useAlertCenter())
  vm.selected.value = record
  return { vm, api, posts, notices, scope }
}
test('解除要求说明，提交独立接口和当前版本，成功后保留返回状态', async () => {
  const c = setup(); c.vm.action.value = 'relieve'; c.vm.comment.value = ' '
  await c.vm.handle(); assert.equal(c.posts.length, 0)
  c.vm.comment.value = ' valve checked '; await c.vm.handle()
  assert.deepEqual(c.posts, [{ path: 'alerts/alarm/relieve', body: { version: 4, comment: 'valve checked' } }])
  assert.equal(c.vm.selected.value.state, 'recovered'); assert.equal(c.vm.action.value, '')
  assert.deepEqual(c.notices, ['platformAlarmRelieved']); c.scope.stop()
})
test('解除失败保留说明和弹窗，不提示成功；忙态阻止重复点击', async () => {
  const c = setup(); c.vm.action.value = 'relieve'; c.vm.comment.value = 'checked'
  let reject; c.api.post = () => new Promise((_, r) => { reject = r })
  const first = c.vm.handle(); await c.vm.handle(); assert.equal(c.vm.actionBusy.value, true)
  reject(Error('RPC unavailable')); await first
  assert.equal(c.vm.error.value, 'RPC unavailable'); assert.equal(c.vm.action.value, 'relieve')
  assert.equal(c.vm.comment.value, 'checked'); assert.deepEqual(c.notices, []); c.scope.stop()
})
test('标记已处理仍走本地处理接口', async () => {
  const c = setup(); c.vm.action.value = 'closed'; c.vm.comment.value = 'finished'; await c.vm.handle()
  assert.equal(c.posts[0].path, 'alerts/alarm/handle'); assert.equal(c.posts[0].body.state, 'closed'); c.scope.stop()
})

test('切换告警后忽略旧解除响应及成功提示', async () => {
  const c = setup(); c.vm.action.value = 'relieve'; c.vm.comment.value = 'checked'
  let finish; c.api.post = () => new Promise(resolve => { finish = resolve })
  const pending = c.vm.handle()
  await c.vm.select({ id: 'other', version: 1 })
  finish({ id: 'alarm', state: 'recovered' }); await pending
  assert.deepEqual(c.notices, []); assert.equal(c.vm.action.value, 'relieve'); c.scope.stop()
})
