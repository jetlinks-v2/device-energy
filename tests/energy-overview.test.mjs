import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(resolve(root, '../../package.json'))
const { buildSync, build } = require('esbuild')
const built = buildSync({ entryPoints: [resolve(root, 'shared/energyOverview.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' })
const module = { exports: {} }
new Function('module', 'exports', built.outputFiles[0].text)(module, module.exports)
const { energyTotal, energyMonth, energyMeterRows, energyRankingRows, energyHealth } = module.exports
const meter = (deviceId, type, value, unit, accepted = 2, complete = true) => ({ deviceId, energyType: type, name: deviceId, unit, propertyId: 'total', usage: { value, accepted, complete, anomalies: 0 } })

test('解绑后当前仪表明细减少，历史用量与排名保留，重新绑定不重复统计', () => {
  const current = { id: 'mapping', deviceId: 'current', name: '当前水表', energyType: 'water', enabled: true }
  const old = { ...current, id: 'old-mapping', deviceId: 'old', name: '历史水表' }
  const energy = [meter('current', 'water', 10, 'm³'), meter('old', 'water', 20, 'm³')]
  assert.equal(energyMeterRows([current], [], energy).length, 1)
  assert.equal(energyHealth([current], []).total, 1)
  assert.equal(energyTotal(energy, 'water', ['current']).value, 30)
  assert.deepEqual(energyRankingRows([current], [], energy).map(row => row.value), [10, 20])
  assert.equal(energyRankingRows([], [], energy).length, 2)
  assert.equal(energyRankingRows([current, old], [], energy).length, 2)
  assert.equal(energyMeterRows([current, old], [], energy).length, 2)
})

test('运行和采集分类各自完整互斥，历史采集不覆盖失败，未知状态不计为在线', () => {
  const mappings = [
    { deviceId: 'a', enabled: true, lastCollectionSuccessTime: 123 },
    { deviceId: 'b', enabled: true, lastCollectionSuccessTime: 123, collectionError: '连接超时' },
    { deviceId: 'c', enabled: true, collectionError: ' ' },
    { deviceId: 'd', enabled: false, lastCollectionSuccessTime: 123, collectionError: '连接超时' }
  ]
  assert.deepEqual(energyHealth(mappings, [{ id: 'a', sourceState: 'online' }, { id: 'b', sourceState: 'offline' }]), {
    total: 4, enabled: 3, online: 1, offline: 1, unknown: 2,
    collected: 1, failed: 1, awaiting: 1, disabled: 1
  })
  assert.equal(energyHealth([], []).total, 0)
})

test('能源总览分开统计水电气；保留有缺口的有效用量，缺读数及单位冲突不伪装成零', () => {
  const rows = [meter('w1', 'water', 15, 'm³'), meter('w2', 'water', 5, 'm3'), meter('e', 'electricity', 33, 'kWh'), meter('g', 'gas', 8, 'm³')]
  assert.equal(energyTotal(rows, 'water').value, 20)
  assert.equal(energyTotal(rows, 'electricity').value, 33)
  assert.equal(energyTotal(rows, 'gas').value, 8)
  assert.equal(energyTotal([meter('w', 'water', 0, 'm³')], 'water').value, 0)
  assert.equal(energyTotal([meter('w', 'water', 0, 'm³', 0)], 'water').value, undefined)
  assert.equal(energyTotal([meter('w', 'water', 0, 'm³', 1, false)], 'water').value, undefined)
  assert.equal(energyTotal([meter('w', 'water', 0, 'm³', 30, false)], 'water').value, undefined)
  assert.equal(energyTotal([meter('w', 'water', 5, 'm³', 2, false)], 'water').value, 5)
  assert.equal(energyTotal([meter('w', 'water', 5, 'm³', 2, false)], 'water').complete, false)
  assert.equal(energyTotal([meter('w', 'water', 5, 'L')], 'water').value, undefined)
  assert.equal(energyTotal([], 'gas').value, undefined)
  assert.equal(energyTotal(rows, 'water', ['w1', 'w2', 'unconfigured-water-meter']).value, undefined)
})
test('月份使用上海自然月，历史月完整，当月截至当前，拒绝未来和无效月份', () => {
  const now = Date.parse('2026-11-16T03:00:00Z')
  assert.deepEqual(energyMonth('2026-10', now), { from: Date.parse('2026-09-30T16:00:00Z'), to: Date.parse('2026-10-31T16:00:00Z'), year: 2026, month: 10 })
  assert.equal(energyMonth('2026-11', now).to, now)
  assert.throws(() => energyMonth('2026-12', now))
  assert.throws(() => energyMonth('2026-13', now))
  assert.throws(() => energyMonth('not-a-month', now))
})
test('仪表明细通过设备ID连接空间和在线状态，使用配置清单保留未采集仪表', () => {
  const rows = energyMeterRows([
    { id: 'm1', deviceId: 'd1', name: '一号总水表', energyType: 'water' },
    { id: 'm2', deviceId: 'd2', name: '二号总水表', energyType: 'water' }
  ], [{ id: 'd1', spaceName: '12-201', sourceState: 'online' }], [meter('d1', 'water', 12, 'm³')])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].spaceName, '12-201')
  assert.equal(rows[0].sourceState, 'online')
  assert.equal(rows[0].value, 12)
  assert.equal(rows[1].value, undefined)
  assert.equal(rows[1].sourceState, undefined)
})

const ports = {
  vue: 'export const ref=value=>({value});export const computed=read=>({get value(){return typeof read==="function"?read():read.get()},set value(value){read.set(value)}});export const reactive=value=>value;export const onMounted=()=>{};export const onBeforeUnmount=()=>{}',
  'vue-router': 'export const useRoute=()=>({query:{projectId:"project/second"}})',
  '@jetlinks-web-core/store': 'export const useMenuStore=()=>({hasMenu:()=>access,jumpPage:(...args)=>args});export const useAuthStore=()=>({hasPermission:()=>access})',
  '../api': 'export const facility=transport', '../api/meterBilling': 'export const meterApi={reviews:async()=>({total:4}),reviewsProjects:async()=>({total:4})}',
  '../shared/i18n': 'export const feText=key=>key', '../shared/types': 'export const messageOf=error=>error.message'
}
const hook = await build({ entryPoints: [resolve(root, 'hooks/useEnergyOverview.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'ports', setup(builder) {
  builder.onResolve({ filter: /.*/ }, args => args.path in ports ? { path: args.path, namespace: 'port' } : undefined)
  builder.onLoad({ filter: /.*/, namespace: 'port' }, args => ({ contents: ports[args.path] }))
} }] })
function setup(get = async () => [], access = true) {
  const calls = [], module = { exports: {} }
  const transport = { get: url => { calls.push(url); return get(url) }, query: async (path, query) => { calls.push({ path, query }); return { data: [], total: 0 } }, devices: async query => { calls.push({ path: 'devices', query }); return { data: [], total: 0 } } }
  new Function('transport', 'access', 'module', 'exports', hook.outputFiles[0].text)(transport, access, module, module.exports)
  const vm = module.exports.useEnergyOverview(); vm.projectId.value = 'project/a'; vm.month.value = '2026-10'
  return { vm, calls, transport }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('月份只刷新用量及趋势，水电气切换本地复用全部数据，层级切换不重刷待办', async () => {
  const { vm, calls } = setup()
  await vm.refreshEnergy()
  assert.equal(calls.length, 2)
  assert.ok(calls.every(url => new URL(url, 'https://example.test').searchParams.get('projectId') === 'project/a'))
  assert.ok(calls.every(url => new URL(url, 'https://example.test').searchParams.get('level') === 'master'))
  vm.energyType.value = 'gas'; void vm.cards.value; void vm.meters.value
  assert.equal(calls.length, 2)
  vm.level.value = 'submeter'; await vm.changeLevel()
  assert.equal(calls.length, 5)
  assert.equal(calls.filter(call => typeof call === 'object' && call.path === 'energy/readings').length, 0)
})
test('项目切换后旧响应不能回填新项目，独立失败不影响其他面板', async () => {
  const old = deferred()
  const { vm } = setup(url => url.includes('project%2Fa') ? old.promise : Promise.resolve([]))
  const before = vm.refreshEnergy()
  vm.projectId.value = 'new-project'; await vm.changeProject()
  old.resolve([meter('old-device', 'water', 22, 'm³')]); await before
  assert.deepEqual(vm.states.energy.data, [])
  const broken = setup(async url => { if (url.startsWith('reports/periods')) throw Error('Network Error'); return [meter('d', 'water', 12, 'm³')] })
  await broken.vm.refreshEnergy()
  assert.equal(broken.vm.cards.value[0].value, 12)
  assert.equal(broken.vm.states.trend.error, 'overviewNetworkError')
  assert.equal(broken.vm.states.energy.error, '')
})
test('没有相关操作权限不请求审核或预警接口，全部项目时不伪造计费数量', async () => {
  const denied = setup(undefined, false)
  await denied.vm.refreshTodos(); assert.deepEqual(denied.calls, [])
  const { vm } = setup(); vm.projectId.value = undefined
  await vm.changeProject()
  assert.equal(vm.states.billing.data, 4)
})

test('预警待办统计未处理状态并兼容旧空状态，跳转携带同一项目和待处理条件', async () => {
  const { vm, calls } = setup()
  await vm.refreshTodos()
  const query = calls.find(call => call.path === 'alerts').query
  assert.deepEqual(query.terms, [{ column: 'projectId', termType: 'eq', value: 'project/a' }, { terms: [
    { column: 'processingState', value: 'open' }, { column: 'processingState', termType: 'isnull', type: 'or', value: true }
  ] }])
  assert.deepEqual(vm.openAlerts(), ['facility/Alerts', { query: { projectId: 'project/a', overview: 'pending' } }])
})
test('仪表分页继续取完；服务端空页但总数未满时明确报错', async () => {
  const { vm, transport } = setup()
  transport.query = async (_path, query) => ({ total: 201, data: query.pageIndex === 0 ? Array.from({ length: 200 }, (_, i) => ({ id: String(i), deviceId: String(i), energyType: 'water' })) : [{ id: 'last', deviceId: 'last', energyType: 'water' }] })
  await vm.refreshMeters(); assert.equal(vm.states.meters.data.mappings.length, 201)
  transport.query = async () => ({ total: 10, data: [] })
  await vm.refreshMeters(); assert.equal(vm.states.meters.data, undefined); assert.equal(vm.states.meters.error, 'eoTooMany')
})

test('旧设备接口仅返回空间ID时按项目补齐名称，目录失败保留设备统计并报告原因', async () => {
  const { vm, transport } = setup()
  transport.query = async () => ({ data: [{ id: 'm1', deviceId: 'd1', projectId: 'project/a', meterLevel: 'master', energyType: 'water' }], total: 1 })
  transport.devices = async () => ({ data: [{ id: 'd1', projectId: 'project/a', spaceId: 'room', sourceState: 'online' }], total: 1 })
  const requests = []
  transport.options = async kind => { requests.push(kind); return [{ id: 'room', fullName: '元时代物业/12幢/201' }] }
  await vm.refreshMeters()
  assert.equal(vm.meters.value[0].spaceName, '元时代物业/12幢/201')
  assert.deepEqual(requests, ['spaces/project%2Fa'])
  transport.options = async () => { throw Error('空间目录不可用') }
  await vm.refreshMeters()
  assert.equal(vm.health.value.online, 1)
  assert.equal(vm.states.meters.data.spaceError, '空间目录不可用')
})

test('用量排名只比较同类有效读数，取最高五台且不受明细搜索影响', () => {
  const { vm, calls } = setup()
  vm.states.meters.data = { mappings: Array.from({ length: 8 }, (_, i) => ({ id: 'm' + i, deviceId: 'd' + i, energyType: i === 7 ? 'gas' : 'water' })), devices: [] }
  vm.states.energy.data = Array.from({ length: 8 }, (_, i) => meter('d' + i, i === 7 ? 'gas' : 'water', i * 10, 'm³', i === 6 ? 0 : 2))
  vm.keyword.value = '没有匹配的仪表'
  assert.deepEqual(vm.ranking.value.map(row => row.value), [50, 40, 30, 20, 10])
  assert.equal(vm.meters.value.length, 0)
  vm.energyType.value = 'gas'
  assert.deepEqual(vm.ranking.value.map(row => row.value), [70])
  assert.deepEqual(calls, [])
})

test('工作台跳转保留已授权项目；无权访问的路由项目不会直接交给统计请求', async () => {
  const { vm, transport } = setup()
  transport.options = async () => [{ id: 'first', name: '项目一' }, { id: 'project/second', name: '项目二' }]
  await vm.initialize(); assert.equal(vm.projectId.value, 'project/second')
  transport.options = async () => [{ id: 'first', name: '项目一' }]
  await vm.initialize(); assert.equal(vm.projectId.value, undefined)
})
