import menus from './baseMenu.json'
type Menu={children?:Menu[];options?:Record<string,unknown>;[key:string]:unknown}
const prepare=(items:Menu[]):Menu[]=>items.map(item=>({...item,runtime:true,options:{appName:'facility-energy-ui',...item.options},children:item.children?prepare(item.children):undefined}))
export default ()=>prepare(menus)
