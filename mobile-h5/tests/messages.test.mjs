import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { messageTiming } from '../src/services/taskMessages.ts'
const require = createRequire(import.meta.url), { build } = require('esbuild')
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/hooks/useMessages.ts', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [{ name: 'ports', setup(b) {
  b.onResolve({filter:/^(vue|vue-router|\.\.\/api\/facility|\.\.\/services\/session|\.\/useMessageBadge|\.\/useConnection)$/}, args=>({path:args.path,namespace:'port'}))
  b.onLoad({filter:/.*/,namespace:'port'},args=>({contents:{
    vue:'export const ref=value=>({value});export const watch=()=>{};export const onMounted=()=>{};export const onBeforeUnmount=()=>{}',
    'vue-router':'export const useRouter=()=>ports.router',
    '../api/facility':'export const facility=ports.api',
    '../services/session':'export const state=ports.state;export const canMessage=()=>ports.allowed !== false',
    './useMessageBadge':'export const unreadMessages={value:1};export const refreshMessageBadge=async()=>{}',
    './useConnection':'export const useConnection=()=>({value:true})'
  }[args.path]}))
} }] })
function setup(api, state={context:{userId:'worker'},projectId:'p'}) {
  const module={exports:{}}, paths=[]
  const ports={api,state,router:{push:async path=>paths.push(path)}}
  new Function('ports','module','exports',result.outputFiles[0].text)(ports,module,module.exports)
  return {vm:module.exports.useMessages(),state,paths,ports}
}
const page=(id,total=1)=>({data:[{id,taskId:'task-'+id}],total,pageIndex:0,pageSize:20})
test('lifecycle messages show their outcome instead of an expired deadline', () => {
 const now=120000, deadline=60000
 for (const [messageType,label] of Object.entries({'task:transfer':'待处理','task:review':'待审批','task:reject':'待整改','task:approve':'已通过','task:close':'已关闭'})) {
  assert.equal(messageTiming({taskId:'task',messageType,deadline},now),label)
 }
 for (const [messageType,label] of Object.entries({'fault:assigned':'待接单','fault:acceptance':'待验收','fault:rejected':'需重做','fault:accepted':'已验收','fault:closed':'已关闭'})) {
  assert.equal(messageTiming({faultId:'fault',messageType,deadline},now),label)
 }
 assert.equal(messageTiming({taskId:'task',messageType:'warning',deadline:180000},now),'距结束还有1分钟')
 assert.equal(messageTiming({taskId:'task',messageType:'overdue',deadline},now),'已超期1分钟')
})
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


test('message categories are server terms and compose with unread filtering', async () => {
  const queries=[], {vm}=setup({taskMessages:async q=>{queries.push(q);return {data:[],total:0}}})
  for (const category of ['all','task','fault','alert','review']) { vm.category.value=category;vm.unreadOnly.value=true;await vm.load() }
  assert.equal(queries[0].terms.length,2)
  for (const [index,column] of [[1,'taskId'],[2,'faultId'],[3,'alertId']]) assert.ok(queries[index].terms.some(t=>t.column===column && t.termType==='notnull'))
  assert.ok(queries[4].terms.some(t=>t.column==='messageType' && t.termType==='in' && t.value.includes('task:review') && t.value.includes('fault:acceptance')))
  assert.ok(queries.every(q=>q.terms.some(t=>t.column==='readTime' && t.termType==='isnull')))
})

test('repair and alert messages route to their details, generic messages stay in inbox', async () => {
 const {vm,paths}=setup({readMessage:async()=>{}})
 await vm.open({id:'fault',faultId:'repair/id'});await vm.open({id:'alert',alertId:'alert/id'});await vm.open({id:'generic'})
 assert.deepEqual(paths,['/faults/repair%2Fid','/alerts/alert%2Fid'])
})

test('missing message permission shows an actionable error without querying or retaining stale messages', async () => {
 const {vm,ports}=setup({taskMessages:async()=>page('allowed')})
 await vm.load();assert.equal(vm.rows.value.length,1)
 ports.allowed=false;await vm.load()
 assert.deepEqual(vm.rows.value,[]);assert.equal(vm.total.value,0)
 assert.match(vm.error.value,/消息权限/)
 ports.allowed=true;await vm.load()
 assert.equal(vm.error.value,'');assert.equal(vm.rows.value[0].id,'allowed')
})
