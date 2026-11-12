import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'api/index.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'http-port', setup(builder) {
    builder.onResolve({ filter: /^@jetlinks-web\/core$/ }, () => ({ path: 'http', namespace: 'port' }))
    builder.onLoad({ filter: /.*/, namespace: 'port' }, () => ({ contents: 'export const request=transport' }))
  } }]
})

test('历史采集允许云端分页耗时，普通查询保持默认超时且传递取消信号', async () => {
  const calls = [], module = { exports: {} }
  const transport = { post: async (...args) => { calls.push(args); return { status: 200, result: { data: [] } } } }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  await module.exports.facility.post('energy/collect/meter')
  assert.equal(calls[0][2].timeout, 60_000)
  await module.exports.facility.query('energy/mappings')
  assert.equal(calls[1][2], undefined)
  const controller = new AbortController()
  await module.exports.queryResource('energy/readings', { pageSize: 12 }, controller.signal)
  assert.equal(calls[2][2].signal, controller.signal)
  assert.equal(calls[2][2].timeout, undefined)
})
