import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const vue = require('vue'), { transformSync } = require('esbuild')
const settle = async () => { for (let i=0;i<12;i++) { await vue.nextTick(); await Promise.resolve() } }
function setup(queryOverride, overrides={}) {
  const saves=[], queries=[], projectId=vue.ref('p')
  const facility={
    query: async (path,q) => { queries.push({path,q}); return queryOverride?.(path,q) ?? {data:[],total:0} },
    options: async () => [], devices: async () => ({data:[]}), save: async (path,row) => {saves.push(JSON.parse(JSON.stringify(row)));return row},
    ...overrides,
  }
  function compile(path, dependencies) {
    const module={exports:{}}
    const code=transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code
    new Function('require','module','exports',code)(dependencies,module,module.exports)
    return module.exports
  }
  const validation=compile('../shared/alertRule.ts',()=>({}))
  const hook=compile('../hooks/useAlertRules.ts',specifier => {
    if (specifier==='vue') return {...vue,onBeforeUnmount:()=>{}}
    if (specifier.endsWith('/api')) return {facility}
    if (specifier.endsWith('/alertRule')) return validation
    if (specifier.endsWith('/types')) return {messageOf:e=>e.message}
    if (specifier.endsWith('/i18n')) return {feText:key=>key}
    if (specifier.endsWith('/useBillingProject')) return {useBillingProject:()=>({projectId,error:vue.ref('')})}
    throw Error(specifier)
  })
  return {vm:hook.useAlertRules(),saves,queries,projectId}
}
const legacy={weekly:{1:[{startMinute:480,endMinute:720,intervalMinutes:60,requiredCount:1,cooldownMinutes:60,warningMinutes:30}]},dates:{}}
const old=()=>({id:'r',version:1,projectId:'p',name:'巡检提醒',ruleType:'dueSoon',taskKind:'inspection',cycleId:'c',legacySchedule:legacy,enabled:true})
test('编辑迁移提醒保留原时段，主动切换后仅提交统一提前量',async()=>{
  const {vm,saves}=setup()
  await vm.edit(old()); await settle()
  assert.equal(vm.timingMode.value,'legacy')
  await vm.save()
  assert.deepEqual(saves[0].legacySchedule,legacy)
  await vm.edit(old()); await settle(); vm.timingMode.value='uniform';vm.minutes.value=12.5
  await vm.save()
  assert.equal(saves[1].legacySchedule,null);assert.equal(saves[1].staleAfterSeconds,750)
})

test('弹窗项目与列表筛选独立，切换清空旧引用并按新项目加载及保存',async()=>{
  const calls=[]
  const {vm,projectId,queries,saves}=setup((path,q)=>({data:path==='groups'?[{id:q.terms[0].value+'-group',name:'设备组'}]:[],total:path==='groups'?1:0}),{
    options:async path=>{calls.push(path);return [{id:path+'-person',name:'员工'}]},
    devices:async q=>{calls.push(q);return {data:[{id:q.terms[0].value+'-device',name:'设备'}]}},
  })
  await vm.edit({...old(),id:undefined});vm.form.groupId='old-group';vm.form.deviceId='old-device';vm.form.notifyUserId='old-person'
  vm.form.projectId='new';await vm.changeProject();await settle()
  assert.equal(projectId.value,'p');assert.equal(vm.opened.value,true)
  for(const key of ['groupId','deviceId','cycleId','notifyUserId','legacySchedule'])assert.equal(vm.form[key],undefined)
  assert.ok(calls.includes('employees/new'));assert.equal(vm.devices.value[0].value,'new-device')
  assert.equal(vm.groups.value[0].value,'new-group')
  assert.equal(queries.filter(q=>q.path==='cycles').at(-1).q.terms[0].value,'new')
  await vm.save();assert.equal(saves[0].projectId,'new');assert.equal(projectId.value,'new')
})

test('员工接口失败不阻断设备组和设备，错误可见且不伪装成全部无数据',async()=>{
  const {vm}=setup(path=>path==='groups'?{data:[{id:'group',name:'设备组'}],total:1}:undefined,{
    options:async()=>{throw Error('员工查询被拒绝')},
    devices:async()=>({data:[{id:'device',name:'设备'}]}),
  })
  await vm.edit()
  assert.equal(vm.formError.value,'员工查询被拒绝')
  assert.equal(vm.groups.value[0].value,'group');assert.equal(vm.devices.value[0].value,'device')
  assert.equal(vm.optionsBusy.value,false)
})

test('弹窗切换项目后迟到候选不能串入，清空项目不发送无范围请求',async()=>{
  let finish
  const {vm}=setup(undefined,{options:path=>path==='employees/p'?new Promise(resolve=>{finish=resolve}):Promise.resolve([{id:'new-person',name:'新员工'}])})
  const oldLoad=vm.edit();vm.form.projectId='new';await vm.changeProject()
  finish([{id:'old-person',name:'旧员工'}]);await oldLoad
  assert.equal(vm.people.value[0].value,'new-person')
  vm.form.projectId=undefined;await vm.changeProject()
  assert.deepEqual(vm.people.value,[]);assert.deepEqual(vm.groups.value,[]);assert.deepEqual(vm.devices.value,[])
})
test('切换巡检维保清除旧周期和迁移时间，异步旧候选返回不能覆盖新候选',async()=>{
  const pending=[]
  const {vm,queries}=setup(path=>path==='cycles'?new Promise(resolve=>pending.push(resolve)):undefined)
  await vm.edit(old())
  vm.form.taskKind='maintenance';vm.changeKind()
  assert.equal(vm.form.cycleId,undefined);assert.equal(vm.form.legacySchedule,undefined)
  pending[1]({data:[{id:'new',name:'维保周期'}],total:1});await settle()
  pending[0]({data:[{id:'old',name:'巡检周期'}],total:1});await settle()
  assert.deepEqual(vm.cycles.value,[{value:'new',label:'维保周期'}])
  assert.equal(queries.filter(q=>q.path==='cycles')[1].q.terms[1].value,'maintenance')
})
test('周期候选失败时显示错误并禁止误存为全部周期，项目切换丢弃旧返回',async()=>{
  const {vm,saves}=setup(path=>path==='cycles'?Promise.reject(Error('周期加载失败')):undefined)
  await vm.edit(old());await settle();await vm.save()
  assert.equal(vm.formError.value,'周期加载失败');assert.equal(saves.length,0)
  let finish
  const env=setup(path=>path==='cycles'?new Promise(resolve=>{finish=resolve}):undefined)
  await env.vm.edit(old());env.projectId.value='new-project';await settle()
  finish({data:[{id:'old',name:'旧项目周期'}],total:1});await settle()
  assert.equal(env.vm.opened.value,false);assert.deepEqual(env.vm.cycles.value,[])
})
