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

test('repair claim and start execute directly with the latest returned version, without reopening a form or re-reading the fault', async()=>{
 let row={id:'detail',projectId:'project',state:'assigned',assigneeId:'worker',version:2},reads=0
 const calls=[],{exports}=fault({fault:async()=>{reads++;return {...row}},faultHistory:async()=>({data:[],total:0}),faultAction:async(id,action,body)=>{
  calls.push({id,action,body});assert.equal(body.version,row.version)
  row={...row,state:action==='claim'?'claimed':'processing',version:row.version+1};return {...row}
 }},[{id:'facility-fault',actions:['query','save']}])
 const vm=exports.useFaultWork();await vm.load()
 assert.equal(await vm.confirm('claim'),true);assert.deepEqual(vm.actions.value,['start'])
 assert.equal(await vm.confirm('start'),true);assert.deepEqual(vm.actions.value,['resolve'])
 assert.deepEqual(calls.map(c=>c.action),['claim','start']);assert.equal(reads,1)
})

test('repair submission requires a result, preserves inputs on failure, prevents duplicate sends and advances to review on success',async()=>{
 let finish,calls=0,fail=true
 const row={id:'detail',projectId:'project',state:'processing',assigneeId:'worker',version:4}
 const {exports}=fault({fault:async()=>({...row}),faultHistory:async()=>({data:[],total:0}),faultAction:async(id,action,body)=>{
  calls++;assert.equal(action,'resolve');assert.equal(body.comment,'更换接头，复测无渗漏');assert.deepEqual(body.attachments,['photo'])
  if(fail)throw Error('网络异常');await new Promise(done=>finish=done);return {...row,state:'review',version:5}
 }},[{id:'facility-fault',actions:['query','save']}])
 const vm=exports.useFaultWork();await vm.load();assert.equal(await vm.confirm('resolve'),false);assert.equal(calls,0)
 vm.comment.value=' 更换接头，复测无渗漏 ';vm.photos.value=['photo']
 assert.equal(await vm.confirm('resolve'),false);assert.equal(vm.error.value,'网络异常');assert.deepEqual(vm.photos.value,['photo']);assert.ok(vm.comment.value)
 fail=false;const pending=vm.confirm('resolve');assert.equal(await vm.confirm('resolve'),false);assert.equal(calls,2)
 finish();assert.equal(await pending,true);assert.equal(vm.selected.value.state,'review');assert.deepEqual(vm.actions.value,[]);assert.equal(vm.comment.value,'');assert.deepEqual(vm.photos.value,[])
})

test('successful repair does not become an apparent failed submission when history is unavailable',async()=>{
 let fail=false
 const row={id:'detail',projectId:'project',state:'processing',assigneeId:'worker',version:1}
 const {exports}=fault({fault:async()=>row,faultHistory:async()=>{if(fail)throw Error('记录加载失败');return {data:[],total:0}},faultAction:async()=>({...row,state:'review',version:2})},[{id:'facility-fault',actions:['query','save']}])
 const vm=exports.useFaultWork();await vm.load();vm.comment.value='完成维修';fail=true
 assert.equal(await vm.confirm('resolve'),true);assert.equal(vm.selected.value.state,'review');assert.equal(vm.error.value,'记录加载失败');assert.equal(await vm.confirm('resolve'),false)
})

test('review rejection requires a reason, passes no repair photos and respects the responsible reviewer',async()=>{
 const calls=[],row={id:'detail',state:'review',assigneeId:'other',reviewerId:'worker',version:3}
 const {exports}=fault({fault:async()=>row,faultHistory:async()=>({data:[],total:0}),faultAction:async(id,action,body)=>{calls.push(body);return {...row,state:'processing',version:4}}},[{id:'facility-fault',actions:['query','review']}])
 const vm=exports.useFaultWork();await vm.load();assert.equal(await vm.confirm('reject'),false);assert.equal(calls.length,0)
 vm.comment.value='请补充复测结果';vm.photos.value=['not-a-review-photo'];assert.equal(await vm.confirm('reject'),true)
 assert.deepEqual(calls,[{version:3,comment:'请补充复测结果',attachments:[]}])
 vm.selected.value={...row,reviewerId:'another'};assert.equal(await vm.confirm('approve'),false)
})

test('offline, missing permission and another assignee cannot mutate repairs or upload photos',async()=>{
 let calls=0
 const {ports,exports}=fault({faultAction:async()=>calls++,upload:async()=>calls++},[{id:'facility-fault',actions:['query','save']}])
 const vm=exports.useFaultWork();vm.selected.value={id:'detail',projectId:'project',state:'processing',assigneeId:'other'}
 assert.equal(await vm.confirm('resolve'),false);await vm.photo({});assert.equal(calls,0)
 vm.selected.value.assigneeId='worker';ports.online.value=false;vm.comment.value='维修结果'
 assert.equal(await vm.confirm('resolve'),false);await vm.photo({});assert.equal(calls,0)
 ports.online.value=true;ports.state.authorization.permissions=[]
 assert.equal(await vm.confirm('resolve'),false);await vm.photo({});assert.equal(calls,0)
})
