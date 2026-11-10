import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url),{build}=require('esbuild')
Object.defineProperty(globalThis.navigator,'onLine',{value:true,configurable:true})
const result=await build({entryPoints:[fileURLToPath(new URL('../src/hooks/useSession.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'session-ports',setup(b){
 b.onResolve({filter:/^(vue|vue-router|jsencrypt|\.\.\/api\/http|\.\.\/api\/facility|\.\.\/services\/session|\.\.\/services\/offline|\.\.\/services\/captcha)$/},a=>({path:a.path,namespace:'port'}))
 b.onLoad({filter:/.*/,namespace:'port'},a=>({contents:{
 'vue':'export const reactive=x=>x;export const ref=x=>({value:x});export const onBeforeUnmount=()=>{}',
 'vue-router':'export const useRouter=()=>({})',
 'jsencrypt':'export default class JSEncrypt {}',
 '../api/http':'export const request=async()=>{if(ports.failure)throw ports.failure;return ports.cached.context};export const errorText=e=>e.message',
 '../api/facility':'export const authorize=async()=>{if(ports.failure)throw ports.failure;return ports.cached.authorization}',
 '../services/session':'export const state=ports.state;export const clearSession=()=>{};export const setSession=()=>{}',
 '../services/offline':'export const offlineMode=async()=>({enabled:ports.mode})',
 '../services/captcha':'export const loginWithCaptcha=()=>{}'
 }[a.path]}))
}}]})
function setup(){
 const cached={at:Date.now(),fingerprint:'',context:{applicationId:'app',userId:'worker'},authorization:{user:{id:'worker'},permissions:[{id:'facility-task',actions:['query']}]}}
 const ports={cached,mode:true,state:{session:{token:'token',tenantDomain:'tenant',applicationId:'app'}}}
 const module={exports:{}};new Function('ports','module','exports',result.outputFiles[0].text)(ports,module,module.exports)
 globalThis.sessionStorage={getItem:()=>JSON.stringify(cached),setItem:()=>{}}
 return {ports,verify:module.exports.verifySession}
}
const {tokenFingerprint}=await import('../src/services/verification.ts')
test('failed network with an online navigator restores enabled offline mode and the exact cached identity',async()=>{
 const {ports,verify}=setup();ports.cached.fingerprint=await tokenFingerprint('token');ports.failure=new TypeError('Failed to fetch')
 await verify();assert.equal(ports.state.context.userId,'worker');assert.equal(ports.state.offlineMode,true)
})
test('server refusal, expired identity or disabled mode never falls back to cached access',async()=>{
 for(const kind of ['server','expired','disabled']){
  const {ports,verify}=setup();ports.cached.fingerprint=await tokenFingerprint('token');ports.failure=kind==='server'?Object.assign(new Error('没有权限'),{status:403}):new TypeError('Failed to fetch')
  if(kind==='expired')ports.cached.at-=86400001
  if(kind==='disabled')ports.mode=false
  await assert.rejects(verify);assert.equal(ports.state.context,undefined)
 }
})
