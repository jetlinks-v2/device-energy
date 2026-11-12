import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const { build }=createRequire(import.meta.url)('esbuild')
async function bundle(file,ports={}) {
 const result=await build({entryPoints:[fileURLToPath(new URL('../src/'+file,import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',define:{'import.meta.env.PROD':'false'},plugins:[{name:'ports',setup(b){
  b.onResolve({filter:/\.vue$/},a=>({path:a.path,namespace:'page'}))
  b.onLoad({filter:/.*/,namespace:'page'},a=>({contents:'export default '+JSON.stringify(a.path)}))
  if(file.includes('useOfflineMode')){
   b.onResolve({filter:/^(vue|\.\.\/services\/(session|offlineAssets|offlineMode|offline|taskScanAccess)|\.\.\/api\/facility)$/},a=>({path:a.path,namespace:'port'}))
   b.onLoad({filter:/.*/,namespace:'port'},a=>({contents:{
    vue:'export const ref=value=>({value})',
    '../services/session':'export const state=ports.state',
    '../api/facility':'export const facility={};export const downloadFile=()=>{}',
    '../services/offlineAssets':'export const prepareOfflineResources=()=>ports.resources()',
    '../services/offlineMode':'export const prepareOfflineMode=()=>ports.data()',
    '../services/offline':'export const cacheSummary=()=>{};export const clearOfflineData=()=>{}',
    '../services/taskScanAccess':'export const clearTaskScanAccess=()=>{}'
   }[a.path]}))
  }
 }}]})
 const module={exports:{}};new Function('ports','module','exports',result.outputFiles[0].text)(ports,module,module.exports);return module.exports
}
const routes=await bundle('routes.ts'),assets=await bundle('services/offlineAssets.ts')
test('offline route preload runs every page loader and propagates any failed page import',async()=>{
 const called=[];await routes.preloadOfflineRoutes([async()=>called.push('tasks'),async()=>called.push('scan')]);assert.deepEqual(called,['tasks','scan'])
 await assert.rejects(routes.preloadOfflineRoutes([async()=>{throw Error('页面下载失败')}]),/页面下载失败/)
 const pages=await Promise.all(routes.offlineRoutePages.map(load=>load()));assert.ok(pages.some(p=>p.default.includes('TaskListPage')));assert.ok(pages.some(p=>p.default.includes('TaskPage')));assert.ok(pages.some(p=>p.default.includes('ScanPage')));assert.ok(pages.some(p=>p.default.includes('GroupPage')));assert.ok(pages.some(p=>p.default.includes('DevicePage')))
})
test('production waits for worker activation and complete-cache confirmation; dev needs no worker',async()=>{
 await assets.ensureOfflineAssets(false,undefined)
 let installed=false,checked=false
 const worker=new EventTarget();worker.state='installing';worker.postMessage=(message,ports)=>{assert.equal(installed,true);assert.equal(message.type,'facility:offline-ready');checked=true;ports[0].postMessage({ready:true});ports[0].close()}
 const pending=assets.ensureOfflineAssets(true,{register:async()=>({installing:worker})})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(checked,false)
 installed=true;worker.state='activated';worker.dispatchEvent(new Event('statechange'));await pending;assert.equal(checked,true)
})
test('registration failure, failed installation and missing cached assets are visible failures',async()=>{
 await assert.rejects(assets.ensureOfflineAssets(true,undefined),/不支持/)
 await assert.rejects(assets.ensureOfflineAssets(true,{register:async()=>{throw Error('注册失败')}}),/注册失败/)
 const broken=new EventTarget();broken.state='redundant'
 await assert.rejects(assets.ensureOfflineAssets(true,{register:async()=>({installing:broken})}),/安装失败/)
 const incomplete={state:'activated',postMessage:(_,ports)=>{ports[0].postMessage({ready:false});ports[0].close()}}
 await assert.rejects(assets.ensureOfflineAssets(true,{register:async()=>({active:incomplete})}),/缓存不完整/)
})
test('offline toggle does not cache or enable when page resources fail; successful resources precede data',async()=>{
 Object.defineProperty(globalThis.navigator,'onLine',{value:true,configurable:true})
 const calls=[],state={context:{userId:'worker',tenantId:'tenant',applicationId:'app'},offlineMode:false}
 let fail=true
 const hook=await bundle('hooks/useOfflineMode.ts',{state,resources:async()=>{calls.push('pages');if(fail)throw Error('页面缓存失败')},data:async()=>calls.push('data')})
 const vm=hook.useOfflineMode();await vm.toggle();assert.equal(state.offlineMode,false);assert.deepEqual(calls,['pages']);assert.match(vm.error.value,/页面缓存失败/)
 fail=false;await vm.toggle();assert.deepEqual(calls,['pages','pages','data']);assert.equal(state.offlineMode,true)
})


test('generated worker serves whitelisted cached modules despite request headers and never intercepts APIs',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm')
 const config=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8')
 const template=config.match(/source: (`[^`]+`)/s)[1],source=new Function('files','return '+template)(['./','index.html','assets/task.js'])
 const listeners={},cached={body:'cached module'},matches=[]
 runInNewContext(source,{URL,self:{registration:{scope:'https://mobile.example/'},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({match:async key=>{matches.push(key);return cached}})},fetch:()=>{throw Error('offline network request')}})
 let response
 listeners.fetch({request:{method:'GET',url:'https://mobile.example/assets/task.js',headers:{Origin:'https://mobile.example/'}},respondWith:value=>response=value})
 assert.equal(await response,cached);assert.deepEqual(matches,['https://mobile.example/assets/task.js'])
 response=undefined;listeners.fetch({request:{method:'GET',url:'https://mobile.example/api/tasks'},respondWith:value=>response=value});assert.equal(response,undefined)
})
