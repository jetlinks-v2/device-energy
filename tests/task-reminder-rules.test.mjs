import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const vue = require('vue'), { transformSync } = require('esbuild')
const settle = async () => { for (let i=0;i<12;i++) { await vue.nextTick(); await Promise.resolve() } }
function setup(queryOverride) {
  const saves=[], queries=[], projectId=vue.ref('p')
  const facility={
    query: async (path,q) => { queries.push({path,q}); return queryOverride?.(path,q) ?? {data:[],total:0} },
    options: async () => [], devices: async () => ({data:[]}), save: async (path,row) => {saves.push(JSON.parse(JSON.stringify(row)));return row},
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
