import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { build } = require('esbuild')
const bundled = await build({
  entryPoints: [resolve(root, 'hooks/useAttachments.ts')], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'attachment-test-ports', setup(builder) {
    builder.onResolve({ filter: /^(vue|ant-design-vue|@jetlinks-web-core\/api\/comm|\.\.\/api)$/ }, args => ({ path: args.path, namespace: 'test-port' }))
    builder.onLoad({ filter: /.*/, namespace: 'test-port' }, args => ({ contents: {
      vue: 'export const ref=value=>({value}); export const computed=read=>({get value(){return read()}})',
      'ant-design-vue': 'export const Upload={LIST_IGNORE:"ignore"}',
      '@jetlinks-web-core/api/comm': 'export const getFileUrlById=id=>"/file/"+id',
      '../api': 'export const facility=transport; export const downloadFile=()=>{}'
    }[args.path] }))
  } }]
})
function setup(initial = [], project = 'project') {
  let ids = initial
  const calls = [], module = { exports: {} }
  const transport = { upload: (file, projectId) => new Promise((resolve, reject) => calls.push({ file, projectId, resolve, reject })) }
  new Function('transport', 'module', 'exports', bundled.outputFiles[0].text)(transport, module, module.exports)
  return { calls, vm: module.exports.useAttachments(() => ids, value => { ids = value }, () => project), ids: () => ids }
}
const file = () => new File(['test'], '设备说明.txt', { type: 'text/plain' })

test('上传成功后才关联附件，并保留名称、项目和下载地址；删除只移除对应附件', async () => {
  const { vm, calls, ids } = setup(['existing'])
  const selected = file(), successes = []
  const pending = vm.upload({ file: selected, onSuccess: result => successes.push(result) })
  assert.deepEqual(ids(), ['existing'])
  assert.equal(vm.busy.value, true)
  assert.equal(calls[0].file, selected)
  assert.equal(calls[0].projectId, 'project')
  calls[0].resolve({ id: 'new' }); await pending
  assert.deepEqual(ids(), ['existing', 'new'])
  assert.equal(vm.fileList.value[1].name, '设备说明.txt')
  assert.equal(vm.fileList.value[1].url, '/file/new')
  assert.equal(successes[0].result.id, 'new')
  assert.equal(vm.busy.value, false)
  vm.removeFile({ uid: 'new' })
  assert.deepEqual(ids(), ['existing'])
})

test('上传失败展示原因，不关联失败文件，并恢复加载状态', async () => {
  const { vm, calls, ids } = setup(['existing'])
  let failure
  const pending = vm.upload({ file: file(), onError: error => { failure = error } })
  calls[0].reject(new Error('上传服务不可用')); await pending
  assert.deepEqual(ids(), ['existing'])
  assert.equal(vm.error.value, '上传服务不可用')
  assert.equal(failure.message, '上传服务不可用')
  assert.equal(vm.busy.value, false)
})

test('缺少项目、超出数量或大小限制时阻止上传，不发请求', async () => {
  for (const fixture of [setup([], ''), setup(Array.from({ length: 20 }, (_, i) => String(i)))]) {
    assert.equal(fixture.vm.beforeUpload(file(), []), 'ignore')
    await fixture.vm.upload({ file: file() })
    assert.equal(fixture.calls.length, 0)
    assert.ok(fixture.vm.error.value)
  }
  const oversized = setup()
  await oversized.vm.upload({ file: new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.txt') })
  assert.equal(oversized.calls.length, 0)
  assert.ok(oversized.vm.error.value)
})
