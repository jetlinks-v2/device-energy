import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { prepareOfflineMode } from '../src/services/offlineMode.ts'
import { cacheTask, cachedTask, cachedTasks, saveDraft, loadDraft, savePhoto, cachedPhoto, enqueue, entries, replay, offlineMode, cacheSummary, clearOfflineData } from '../src/services/offline.ts'
const scope = userId => ({ tenantId:'tenant',applicationId:'app',userId })
const member = (id,parent='root') => ({ id, parentTaskId:parent, version:1,projectId:'project',assigneeId:'worker',state:'claimed',deviceId:id,groupIds:['group'],standardSnapshot:[],results:[],instructionAttachments:[] })
const whole = (id='root',count=2) => ({ ...member(id),parentTaskId:undefined,deviceCount:count,submittedDeviceCount:0,deviceTasks:Array.from({length:count},(_,i)=>member(id+'-'+i,id)) })

test('enabling caches all pages and complete device/group snapshots before setting enabled',async()=>{
  const ctx=scope('pages'),roots=[whole('one'),whole('two')],calls=[]
  const api={tasks:async(q,mine)=>{assert.equal(mine,true);calls.push(q.pageIndex);return {data:[roots[q.pageIndex]],total:2}},downloadTask:async id=>roots.find(r=>r.id===id)}
  await prepareOfflineMode(ctx,api,async()=>new Blob(),()=>{})
  assert.deepEqual(calls,[0,1]);assert.equal((await offlineMode(ctx)).enabled,true)
  assert.equal((await cachedTask(ctx,'two')).deviceTasks.length,2)
  assert.deepEqual((await cachedTask(ctx,'one-0')).groupIds,['group'])
})
test('incomplete snapshots or failed downloads cannot enable the mode',async()=>{
  for(const broken of [true,false]){
    const ctx=scope('failure-'+broken),root=whole()
    const api={tasks:async()=>({data:[root],total:1}),downloadTask:async()=>{if(broken)return {...root,deviceTasks:[root.deviceTasks[0]]};throw Error('断开连接')}}
    await assert.rejects(prepareOfflineMode(ctx,api,async()=>new Blob(),()=>{}))
    assert.notEqual((await offlineMode(ctx))?.enabled,true)
  }
})
test('local submissions update only local progress, block editing and retain independent drafts',async()=>{
  const ctx=scope('progress'),root=whole();await cacheTask(ctx,root)
  await saveDraft(ctx,'root-1',[{itemId:'check',value:'符合',attachments:[]}],1)
  await enqueue(ctx,root.deviceTasks[0],'submit',[])
  assert.equal((await cachedTask(ctx,'root-0')).pendingSync,true)
  assert.equal((await cachedTask(ctx,'root-0')).state,'review')
  assert.equal((await cachedTask(ctx,'root')).submittedDeviceCount,1)
  assert.equal((await cachedTask(ctx,'root')).pendingSync,true)
  await cacheTask(ctx,{...root,version:8,deviceTasks:root.deviceTasks.map(x=>({...x,version:8}))})
  assert.equal((await cachedTask(ctx,'root-0')).version,1)
  assert.equal((await cachedTask(ctx,'root-1')).version,1)
  assert.ok(await loadDraft(ctx,'root-1'))
})
test('closing clears this account cache atomically, including photos/drafts/outbox/mode, leaving other accounts',async()=>{
  const ctx=scope('clear'),other=scope('other');await cacheTask(ctx,whole());await cacheTask(other,whole('other-root'))
  const photo=await savePhoto(ctx,new File(['image'],'x.png',{type:'image/png'}));await saveDraft(ctx,'root-0',[],1);await enqueue(ctx,member('root-0'),'submit',[])
  assert.deepEqual(await cacheSummary(ctx),{tasks:1,pending:1,drafts:0})
  await clearOfflineData(ctx)
  assert.equal((await cachedTasks(ctx)).length,0);assert.equal((await entries(ctx)).length,0);assert.equal(await loadDraft(ctx,'root-0'),undefined);assert.equal(await cachedPhoto(ctx,photo),undefined);assert.equal(await offlineMode(ctx),undefined)
  assert.equal((await cachedTasks(other)).length,3)
})
test('cannot clear cache while upload is running; failed sync retains one idempotent pending entry',async()=>{
  const ctx=scope('concurrent'),row=member('row');await cacheTask(ctx,row);await enqueue(ctx,row,'submit',[])
  let fail;const running=replay(ctx,{action:()=>new Promise((_,reject)=>{fail=reject})})
  await new Promise(r=>setTimeout(r,20));await assert.rejects(clearOfflineData(ctx),/同步/)
  fail(Error('网络中断'));await running;assert.equal((await entries(ctx))[0].state,'pending')
})
