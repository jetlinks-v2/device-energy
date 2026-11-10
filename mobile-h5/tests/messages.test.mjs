import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url), { build } = require('esbuild')
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/hooks/useMessages.ts', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [{ name: 'ports', setup(b) {
  b.onResolve({filter:/^(vue|vue-router|\.\.\/api\/facility|\.\.\/services\/session|\.\/useMessageBadge|\.\/useConnection)$/}, args=>({path:args.path,namespace:'port'}))
  b.onLoad({filter:/.*/,namespace:'port'},args=>({contents:{
    vue:'export const ref=value=>({value});export const watch=()=>{};export const onMounted=()=>{};export const onBeforeUnmount=()=>{}',
    'vue-router':'export const useRouter=()=>ports.router',
    '../api/facility':'export const facility=ports.api',
    '../services/session':'export const state=ports.state;export const can=()=>true',
    './useMessageBadge':'export const unreadMessages={value:1};export const refreshMessageBadge=async()=>{}',
    './useConnection':'export const useConnection=()=>({value:true})'
  }[args.path]}))
} }] })
function setup(api, state={context:{userId:'worker'},projectId:'p'}) {
  const module={exports:{}}, paths=[]
  new Function('ports','module','exports',result.outputFiles[0].text)({api,state,router:{push:async path=>paths.push(path)}},module,module.exports)
  return {vm:module.exports.useMessages(),state,paths}
}
const page=(id,total=1)=>({data:[{id,taskId:'task-'+id}],total,pageIndex:0,pageSize:20})
test('messages paginate and unread filter is sent to server before pagination',async()=>{
  const queries=[],{vm}=setup({taskMessages:async q=>{queries.push(q);return page(String(q.pageIndex),40)}})
  vm.unreadOnly.value=true;await vm.load();await vm.load(true)
  assert.equal(queries[0].terms[1].termType,'isnull');assert.equal(queries[1].pageIndex,1)
  assert.deepEqual(vm.rows.value.map(x=>x.id),['0','1'])
})
test('late project response cannot replace current messages; missing project clears list',async()=>{
  const calls=[],{vm,state}=setup({taskMessages:()=>new Promise(resolve=>calls.push(resolve))})
  const first=vm.load();state.projectId='q';const second=vm.load();calls[1](page('q'));await second
  calls[0](page('p'));await first;assert.equal(vm.rows.value[0].id,'q')
  state.projectId=undefined;await vm.load();assert.deepEqual(vm.rows.value,[])
})
test('opening marks just that message read and routes to task without a scan credential',async()=>{
  const ids=[],{vm,paths}=setup({readMessage:async id=>ids.push(id)})
  const row={id:'message',taskId:'root'};await vm.open(row)
  assert.deepEqual(ids,['message']);assert.deepEqual(paths,['/tasks/root']);assert.ok(row.readTime)
})
test('failed read keeps unread state and shows error; failed read-all is not shown as success',async()=>{
  const {vm,paths}=setup({readMessage:async()=>{throw Error('未能标记已读')},readAllMessages:async()=>{throw Error('未能更新')}})
  const row={id:'message',taskId:'root'};await vm.open(row)
  assert.equal(row.readTime,undefined);assert.equal(paths.length,0);assert.equal(vm.error.value,'未能标记已读')
  await vm.readAll();assert.equal(vm.error.value,'未能更新')
})
