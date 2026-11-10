import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url), { build } = require('esbuild')
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
const root = fileURLToPath(new URL('..', import.meta.url))
const result = await build({ stdin: { contents: "export { useMobileTask } from './src/hooks/useMobileTask';export { issueTaskScanAccess } from './src/services/taskScanAccess'", resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{name: 'ports', setup(builder) {
  builder.onResolve({filter: /^(vue|\.\.\/api\/facility|\.\.\/services\/session|\.\.\/services\/offline)$/}, args=>({path:args.path,namespace:'port'}))
  builder.onLoad({filter:/.*/,namespace:'port'},args=>({contents:{
    vue:'export const ref=value=>({value});export const computed=fn=>({get value(){return fn()}});export const onMounted=()=>{};export const onBeforeUnmount=()=>{}',
    '../api/facility':'export const facility=ports.api;export const downloadFile=()=>{}',
    '../services/session':'export const state=ports.state;export const can=()=>true',
    '../services/offline':'export const cachedTask=async()=>ports.cachedTask;export const cacheFile=async()=>{};export const cachedPhoto=async()=>undefined;export const cachedFile=async()=>undefined;export const entries=async()=>[];export const loadDraft=async()=>undefined;export const cacheTask=async()=>{ports.writes++};export const saveDraft=async()=>{ports.writes++};export const savePhoto=async()=>{ports.writes++;return "photo"};export const enqueue=async()=>{ports.writes++};export const replay=async()=>{ports.replays=(ports.replays||0)+1}'
  }[args.path]}))
}}]})
function setup() {
  const task = {id:'device-task',parentTaskId:'whole-task',tenantId:'tenant',applicationId:'app',projectId:'project',version:1,state:'claimed',assigneeId:'worker',standardSnapshot:[],results:[]}
  const scope={tenantId:'tenant',applicationId:'app',userId:'worker'}
  const ports={state:{context:scope},writes:0,api:{task:async()=>task}}
  const module={exports:{}}
  new Function('ports','module','exports',result.outputFiles[0].text)(ports,module,module.exports)
  let scan
  const vm=module.exports.useMobileTask(task.id,()=>scan)
  return {vm,task,ports,unlock:()=>{scan=module.exports.issueTaskScanAccess(scope,[task])}}
}

test('opening a device detail or forging a scan URL cannot save, attach photos or submit',async()=>{
  const {vm,ports}=setup();await vm.load()
  assert.equal(vm.scannable.value,true);assert.equal(vm.executable.value,false)
  await vm.draft();await vm.photo('check',new File(['x'],'x.png',{type:'image/png'}));await vm.submit()
  assert.equal(ports.writes,0)
})
test('a matching scan opens editing, and changed task version immediately closes it',async()=>{
  const {vm,ports,task,unlock}=setup();await vm.load();unlock()
  assert.equal(vm.executable.value,true);await vm.draft();assert.ok(ports.writes>0)
  const written=ports.writes;task.version++;assert.equal(vm.executable.value,false)
  await vm.submit();assert.equal(ports.writes,written)
})

test('offline mode stays local even with network available; reconnect never submits without manual sync',async()=>{
  const {vm,ports,task,unlock}=setup()
  ports.state.offlineMode=true;ports.cachedTask=task
  ports.api.task=async()=>{throw Error('offline work must not fetch server tasks')}
  await vm.load();unlock();assert.equal(vm.executable.value,true)
  assert.equal(vm.online.value,false)
  await vm.submit();assert.equal(vm.pending.value,true);assert.equal(ports.replays||0,0)
  assert.ok(ports.writes>0);assert.match(vm.notice.value,/等待同步/)
})
