import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const { build } = createRequire(import.meta.url)('esbuild')
async function bundle(file) {
 const result=await build({entryPoints:[fileURLToPath(new URL('../src/hooks/'+file,import.meta.url))],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'ports',setup(b){
  b.onResolve({filter:/^(vue|vue-router|\.\.\/api\/facility|\.\.\/services\/session|\.\/useConnection)$/},a=>({path:a.path,namespace:'port'}))
  b.onLoad({filter:/.*/,namespace:'port'},a=>({contents:{
   vue:'export const ref=value=>({value});export const computed=fn=>({get value(){return fn()}});export const watch=()=>{};export const onBeforeUnmount=()=>{}',
   'vue-router':'export const useRoute=()=>ports.route',
   '../api/facility':'export const facility=ports.api',
   '../services/session':'export const state=ports.state',
   './useConnection':'export const useConnection=()=>ports.online'
  }[a.path]}))
 }}]})
 return (api, permissions, route={params:{id:'detail'}})=>{
  const ports={api,route,state:{context:{userId:'worker'},projectId:'project',authorization:{permissions}},online:{value:true}}
  const module={exports:{}};new Function('ports','module','exports',result.outputFiles[0].text)(ports,module,module.exports)
  return {ports,exports:module.exports}
 }
}
const alert=await bundle('useAlert.ts'),fault=await bundle('useFaultWork.ts')
test('alert details read the alert resource and reject stale responses or missing permission',async()=>{
 let resolve,calls=0
 const {ports,exports}=alert({read:async(resource,id)=>{assert.equal(resource,'alerts');assert.equal(id,'detail');calls++;return new Promise(done=>resolve=done)}},[{id:'facility-alert',actions:['query']}])
 const vm=exports.useAlert(),pending=vm.load()
 ports.state.authorization.permissions=[];await vm.load();resolve({id:'stale'});await pending
 assert.equal(calls,1);assert.equal(vm.row.value,undefined);assert.ok(vm.error.value)
})
test('alert details preserve independent automatic and processing states and surface read failure',async()=>{
 let fail=false
 const {exports}=alert({read:async()=>{if(fail)throw Error('预警不可用');return {id:'detail',state:'recovered',processingState:'unhandled',firstTime:1,lastTime:2,recoveredTime:3}}},[{id:'facility-alert',actions:['query']}])
 const vm=exports.useAlert();await vm.load();assert.equal(vm.row.value.state,'recovered');assert.equal(vm.row.value.processingState,'unhandled')
 fail=true;await vm.load();assert.equal(vm.row.value,undefined);assert.equal(vm.error.value,'预警不可用')
})
test('repair history loads additional pages and retains records when the next page fails',async()=>{
 const queries=[];let fail=false
 const {exports}=fault({fault:async()=>({id:'detail',state:'assigned'}),faultHistory:async(id,page)=>{queries.push([id,page]);if(fail)throw Error('记录加载失败');return {data:[{id:'log-'+page}],total:25}}},[{id:'facility-fault',actions:['query']}])
 const vm=exports.useFaultWork();await vm.load();await vm.loadHistory(true)
 assert.deepEqual(queries,[['detail',0],['detail',1]]);assert.deepEqual(vm.history.value.map(r=>r.id),['log-0','log-1']);assert.equal(vm.historyTotal.value,25)
 fail=true;await vm.loadHistory(true);assert.equal(vm.history.value.length,2);assert.equal(vm.error.value,'记录加载失败')
})


test('repair actions expose only executable staff and reviewer actions, never incomplete admin commands', async()=>{
 const {exports}=fault({},[{id:'facility-fault',actions:['query','save','review','dispatch']}])
 const vm=exports.useFaultWork();vm.selected.value={id:'fault',state:'processing',assigneeId:'worker'}
 assert.deepEqual(vm.actions.value,['resolve'])
 vm.selected.value={id:'fault',state:'review',assigneeId:'other',reviewerId:'worker'}
 assert.deepEqual(vm.actions.value,['approve','reject'])
})
