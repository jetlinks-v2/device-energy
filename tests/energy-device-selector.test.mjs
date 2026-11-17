import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(new URL('../../../package.json',import.meta.url))
const vue=require('vue'),{transformSync}=require('esbuild')
const settle=async()=>{for(let i=0;i<12;i++){await vue.nextTick();await Promise.resolve()}}
function setup(path='energy/mappings') {
  const queries=[],mounted=[],devices=[{id:'enabled',name:'启用水表',energyEnabled:true,syncState:'active'},
    {id:'off',name:'停用水表',energyEnabled:false,syncState:'active'},
    {id:'inactive',name:'历史水表',energyEnabled:true,syncState:'inactive'}]
  const facility={options:async()=>[],query:async(source,q)=>{
    queries.push({source,q})
    const rows=source==='devices'?devices.filter(row=>(q.terms||[]).every(term=>row[term.column]===term.value)):[]
    return {data:rows,total:rows.length}
  },get:async()=>({properties:[]})}
  const source=readFileSync(new URL('../hooks/useResource.ts',import.meta.url),'utf8')
  const code=transformSync(source,{loader:'ts',format:'cjs'}).code,module={exports:{}}
  new Function('require','module','exports',code)(id=>{
    if(id==='vue')return {...vue,onMounted:fn=>mounted.push(fn)}
    if(id==='ant-design-vue')return {message:{}}
    if(id==='../api')return {facility}
    if(id==='../shared/i18n')return {feText:key=>key}
    if(id==='../shared/types')return {clone:row=>structuredClone(row),display:String,messageOf:error=>error.message}
    if(id==='../shared/energyValidation')return {validateEnergyForm:()=>undefined}
    if(id==='./usePlanReferences')return {usePlanReferences:()=>({})}
    if(id==='./useResourceQuery')return {useResourceQuery:()=>({projectId:vue.ref(),error:vue.ref(''),refresh:async()=>{}})}
    if(id==='./useCheckItems')return {}
    if(id==='../shared/cycle/editor')return {}
    throw Error(id)
  },module,module.exports)
  const resource={path,fields:[{key:'deviceId',type:'select',source:'devices'},{key:'parentDeviceId',type:'select',source:'devices'}],defaults:{}}
  const vm=module.exports.useResource(()=>resource)
  mounted.forEach(fn=>fn())
  return {vm,queries,devices}
}
test('新增仪表只查询能源监测已启用且有效的设备，上级仪表复用相同候选',async()=>{
  const {vm,queries}=setup();await settle()
  assert.deepEqual(queries.find(row=>row.source==='devices').q.terms,[{column:'energyEnabled',value:true},{column:'syncState',value:'active'}])
  assert.deepEqual(vm.options.devices,[{value:'enabled',label:'启用水表'}])
  vm.edit();await settle()
  assert.equal(vm.formFields.value[0].options,undefined)
  assert.equal(vm.formFields.value[1].options,undefined)
})
test('原设备停用后编辑保留名称但不可重新选择，下一次新增不残留该选项',async()=>{
  const {vm}=setup();await settle()
  vm.edit({id:'mapping',deviceId:'off',name:'原水表'});await settle()
  assert.deepEqual(vm.formFields.value[0].options,[{value:'enabled',label:'启用水表'},{value:'off',label:'原水表',disabled:true}])
  assert.equal(vm.formFields.value[1].options,undefined)
  vm.edit();await settle()
  assert.equal(vm.formFields.value[0].options,undefined)
  assert.deepEqual(vm.options.devices,[{value:'enabled',label:'启用水表'}])
})
test('重新打开仪表时刷新能源开关状态，其他业务的设备候选不受影响',async()=>{
  const {vm,devices}=setup();await settle()
  devices[0].energyEnabled=false;vm.edit();await settle()
  assert.deepEqual(vm.options.devices,[])
  const other=setup('faults');await settle()
  assert.equal(other.queries.find(row=>row.source==='devices').q.terms,undefined)
  assert.equal(other.vm.options.devices.length,3)
})
